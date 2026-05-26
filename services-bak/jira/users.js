// const config = require('config');
import request from 'request';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';
import async from 'async';
import fs from 'fs';
import path from 'path';

import { LDAPConfig } from '../../connectors/ldap.js';
import Auth from '../../connectors/auth.js';
import { logger } from './../../utils/logger.js';
import { User } from './../../models/user.js';
import { Jjed } from './../../models/jjed.js';
import { Group } from './../../models/group.js';
import { createRandomString } from '../../utils/randomString.js';
import { encipherment } from '../../utils/encipherment.js';
import PermissionsClient from '../../utils/permissions.js';
import { CONSTANTS } from '../../utils/constants.js';
import { getJiraClient } from './../../connectors/jira.js';
import { gitlabUserServices } from '../gitlab/users.js';
import { gitlabGroupServices } from '../gitlab/group.js';
import server from '../../server.js';
import { jiraGroupServices } from './group.js';

const { LDAP, DEFAULT_USERS } = CONSTANTS;

/**
 * Create user. By default created user will not be notified with email.
 * ADMIN LEVEL
 *
 * @method createUser
 * @param {Object} opts The request options.
 * @param {Object} opts.user User details object.
 * @returns {Promise}
 */
function createUser(opts) {
  return new Promise((resolve, reject) => {
    // 1. Check user exists in LDAP
    LDAPConfig.findUser(opts.user.email).then((ldapUser) => {
      // 1.a. User found in LDAP
      // 2. Check existence in DB -> Create user -> save to DB
      Auth.checkUserAndSave(ldapUser, true).then((res) => {
        if (res.isNew) {
          let gitlabPayload = {
            "email": res.user.email,
            "name": res.user.name,
            "username": res.user.username,
            "reset_password": true,
            "skip_confirmation": true
          };
          gitlabUserServices.createUser(gitlabPayload).then(() => {
            //Adding scope code user to GUEST Group for read acess to all repositories 
            // GUEST GROUP ID: 96, access_level: 20
            gitlabGroupServices.addGroupMember('96', res.user.username, '20').then(() => {
              // User created successfully, resolve the promise
              return resolve({
                message: 'User created',
                code: 201,
                user: res.user,
              });
            }).catch((err) => {
              // Handle error if the promise is rejected
              logger.error(err, 'ERROR_GITLAB_ADDING_USER_TO_GROUP');
              return resolve({
                message: 'User Created Successfully, But failed to create in user in Guest Group',
                code: 207,
                user: req.user
              });
            });
          }).catch((err) => {
            // Handle error if the promise is rejected
            logger.error(err, 'ERROR_GITLAB_CREATE_USER');
            return resolve({
              message: 'User Created Successfully, But failed to create in scope code',
              code: 207,
              user: req.user
            });
          });
        } else if (!res.user.isEnabled) {
          return reject({
            message: 'This account has been disabled',
            code: 400,
          });
        } else {
          return resolve({
            message: 'Given user already exists in the system',
            code: 200,
            user: res.user,
          });
        }
      }).catch((dbErr) => {
        logger.error(dbErr, 'FAILED_TO_CHECK_USER');
        return reject(dbErr);
      });
    }).catch((ldapErr) => {
      // 1.b. User not found in LDAP
      logger.error(ldapErr, 'FAILED_TO_FIND_LDAP_USER');
      return reject(ldapErr);
    });
  });
}

/**
 * Bulk create users. By default created user will not be notified with email.
 * ADMIN LEVEL
 *
 * @method bulkCreateUsers
 * @param {Object} opts The request options.
 * @param {Array} opts.users Array of User details object.
 * @returns {Promise}
 */
function bulkCreateUsers(opts) {
  return new Promise((resolve, reject) => {
    const promises = [];
    opts.users.forEach((user) => {
      promises.push(createUser({ user }));
    });
    Promise.all(promises).then((success) => {
      resolve(success);
    }, (err) => {
      reject(err);
    });
  });
}

function createUserInJira(email, displayName, jiraAuth) {
  return new Promise((resolve, reject) => {
    // Create new user in JIRA
    const jiraUsername = email.split('@')[0];
    const jiraPassword = createRandomString();
    const newJiraUser = {
      name: jiraUsername,
      password: jiraPassword,
      emailAddress: email,
      displayName,
    };
    const jiraClient = getJiraClient(jiraAuth);
    jiraClient.user.createUser({ user: newJiraUser }).then((jiraUser) => {
      resolve({ jiraUser, jiraPassword: encipherment.encrypt(jiraPassword) });
    }, (jiraCreateError) => {
      logger.error(jiraCreateError, 'ERROR_JUSER_CREATE');
      try {
        const errObj = JSON.parse(jiraCreateError);
        reject({
          message: errObj.body.errorMessages[0],
          code: errObj.statusCode,
          error: 'ERROR_JUSER_CREATE',
          body: errObj.body,
        });
      } catch (exc) {
        reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_JUSER_CREATE' });
      }
    });
  });
}

/**
 * Removes user.
 * ADMIN LEVEL
 *
 * @method deleteUser
 * @param opts The request options.
 * @param {String} opts.username The username of the user.
 * @returns {Promise}
 */
function deleteUser(opts) {
  return new Promise(async (resolve, reject) => {
    // clear the server cache
    // server.emit('clear-cache', 'jira-users');
    try {
      const updtUser = await User.findOneAndUpdate({ username: opts.username }, { $set: { isEnabled: false } }, { new: true, strict: true, runValidators: true }).lean();
      // 1.b. User marked as deleted in DB.
      return resolve({
        message: 'User successfully deleted',
        code: 200,
        user: updtUser,
      });
    } catch (err) {
      // 1.a. Failure to delete user, log and reject
      logger.error(err, 'ERROR_DBUSER_DELETE');
      return reject({
        message: 'Failed to delete User',
        code: 500,
        error: 'ERROR_DBUSER_DELETE',
      });
    }
  });
}

/**
 * Removes user permanently.
 * ADMIN LEVEL
 *
 * @method deleteUserPermanent
 * @param opts The request options.
 * @param {String} opts.username The username of the user.
 * @returns {Promise}
 */
function deleteUserPermanent(opts) {
  return new Promise(async (resolve, reject) => {
    // 1. Delete user from DB.
    try {
      await User.deleteOne({ username: opts.username }).lean();
      // 1.b. User deleted from DB.
      return resolve({
        message: 'User Deleted Permanently',
        code: 200,
      });
    } catch (err) {
      // 1.a. Failure to delete user, log and reject
      logger.error(err, 'ERROR_DBUSER_DELETE');
      reject({
        message: 'Failed to delete User',
        code: 500,
        error: 'ERROR_DBUSER_DELETE',
      });
    }
  });
}

/**
 * Restores User account.
 * ADMIN LEVEL
 *
 * @method restoreUser
 * @param opts The request options.
 * @param {String} opts.email The email of the user.
 * @param {String} opts.username The username of the user.
 * @param {String} opts.displayName The display name to be given to the user.
 * @returns {Promise}
 */
function restoreUser(opts) {
  return new Promise(async (resolve, reject) => {
    // Update user in DB. Set isEnabled field to true
    try {
      const updtUser = await User.findOneAndUpdate(
        { username: opts.username },
        { $set: { isEnabled: true } },
        { new: true, strict: true, runValidators: true }).lean();
      // 1.b. User account restored
      resolve({
        message: 'User account restored successfully',
        code: 200,
        user: updtUser,
      });
    } catch (err) {
      // 1.a. Failure to restore user, log and reject
      logger.error(err, 'ERROR_DBUSER_RESTORE');
      reject({
        message: 'Failed to restore User',
        code: 500,
        error: 'ERROR_DBUSER_RESTORE',
      });
    }
  });
}

/**
 * Get user details from DB
 * @return {Promise} Resolved when the user data has been retrieved.
 */
function getUserDetailsFromDB(data) {
  return new Promise(async (resolve, reject) => {
    // Get user details from DB
    try {
      const result = await Promise.all(
        data.map((item) => {
          return new Promise(async (resolve, reject) => {
            try {
              const uData = await User.findOne({ username: item?.name }).select('isSuperAdmin').exec();
              return resolve({
                ...item,
                isSuperAdmin: uData?.isSuperAdmin ?? false,
              });
            } catch (err) {
              return reject({
                message: 'Internal Server Error',
                code: 500,
                error: 'ERROR_DB_FIND_PROJECT',
              })
            }
          })
        })
      );
      return resolve(result);
    } catch (error) {
      logger.error(err, 'ERROR_DB_FIND_PROJECT');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_PROJECT',
      });
    }
  });
}

function getUser(opts) {
  return new Promise((resolve, reject) => {
    const jiraClient = getJiraClient(opts.auth);
    jiraClient.user.getUser(opts).then((res) => {
      return resolve(res);
    }, (err) => {
      try {
        const errorObj = JSON.parse(err);
        return reject(errorObj);
      } catch (e) {
        return reject(err);
      }
    });
  });
}

function editUser(opts) {
  return new Promise((resolve, reject) => {
    // TODO Update user in DB as well
    const jiraClient = getJiraClient(opts.auth);
    jiraClient.user.editUser(opts).then((res) => {
      resolve(res);
    }, (err) => {
      try {
        const errorObj = JSON.parse(err);
        reject(errorObj);
      } catch (e) {
        reject(err);
      }
    });
  });
}

async function search(opts) {
  return new Promise(async (resolve, reject) => {
    // 1 Get user details from DB
    const filter = {
      $and: [
        {
          $or:
            [
              { username: { $regex: opts.query, $options: 'i' } },
              { email: { $regex: opts.query, $options: 'i' } },
              { name: { $regex: opts.query, $options: 'i' } },
            ],
        },
        { isEnabled: true },
      ],
    };

    // Aggregation query
    const query = [
      // {$sort: {...}}
      { $match: filter },
      {
        $facet: {
          stage1: [{ $group: { _id: null, count: { $sum: 1 } } }],
          stage2: [
            { $skip: opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0 },
            { $limit: opts.perPage },
          ],
        },
      },
      { $unwind: '$stage1' },
      // output projection
      {
        $project: {
          count: '$stage1.count',
          data: '$stage2',
        },
      },
    ];
    try {
      const dbRes = await User.aggregate(query);
      return resolve(dbRes);
    } catch (dbErr) {
      // 1.a User not found in DB
      logger.error(dbErr, 'ERROR_DB_FIND_USER');
      return reject(dbErr);
    }
  });
}

// --- PERMISSIONS --- //
/**
 * Returns all permissions in the system and whether the currently logged in user has them.
 *
 * @method myPermissions
 * @param {Object} opts The request options sent to the Jira API.
 * @param {String} opts.auth The JIRA auth details of the requesting user.
 * @param {Function} next callback function.
 */
function myPermissions(opts, next) {
  const jiraClient = getJiraClient(opts.auth);
  const pClient = new PermissionsClient(jiraClient);
  pClient.getMyPermissions(opts).then((res) => {
    // Transforming the response from object to array
    const permArr = [];
    const permKeys = Object.keys(res.permissions);
    permKeys.forEach((key) => {
      permArr.push(res.permissions[key]);
    });
    next(null, permArr);
  }, (err) => {
    try {
      const errorObj = JSON.parse(err);
      next(errorObj);
    } catch (e) {
      next(err);
    }
  });
}
// server.method('jira.users.myPermissions', myPermissions, {
//   // cache: cacheConfig,
//   // generate a key to differentiate between requests
//   // generateKey(opts) {
//   //   return opts.auth.username;
//   // },
// });

/**
 * Returns a list of active users that match the search string and have all specified permissions
 * for the project or issue.
 * This resource can be accessed by users with ADMINISTER_PROJECT permission for the project or
 * global ADMIN or SYSADMIN rights.
 *
 * @method searchPermissions
 * @param {Object} opts The request options sent to the Jira API.
 * @param {String} opts.auth The JIRA auth details of the requesting user.
 * @param {String} opts.username The username filter, list includes all users if unspecified
 * @param {Array} opts.permissions Array of permissions for project/issue returned users must have
   *     [Permissions]{@link
      *     https://developer.atlassian.com/static/javadoc/jira/6.0/reference/com/atlassian/jira/security/Permissions.Permission.html}
      *     JavaDoc for the list of all possible permissions.
 * @param {string} [opts.issueKey] the issue key for the issue for which returned users
 * have specified permissions.
 * @param {string} [opts.projectKey] the optional project key to search for users with
 * if no issueKey is supplied.
 * @param {number} [opts.startAt] the index of the first user to return (0-based)
 * @param {number} [opts.maxResults] the maximum number of users to return (defaults to 50).
 * @param {Function} next callback function.
 */
function searchPermissions(opts, next) {
  const jiraClient = getJiraClient(opts.auth);
  jiraClient.user.searchPermissions(opts).then((res) => {
    next(null, res);
  }, (err) => {
    try {
      const errorObj = JSON.parse(err);
      next(errorObj);
    } catch (e) {
      next(err);
    }
  });
}
// server.method('jira.users.searchPermissions', searchPermissions, {
//   // cache: cacheConfig,
//   // // generate a key to differentiate between requests
//   // generateKey(opts) {
//   //   return JSON.stringify(opts);
//   // },
// });

function extractOptions(data) {
  const optionData = data.filter((each) => { return each.name === 'select'; });
  if (optionData.length) {
    const options = optionData[0].children.map((each) => {
      if (each.firstChild && each.firstChild.data.indexOf('-') < 0) {
        const vars = each.attribs.value.split('&');
        const uVal = vars.find((v) => { return v.startsWith('u='); });
        let wwid = '';
        if (uVal) {
          wwid = uVal.slice(2);
        }
        const obj = {
          key: each.firstChild.data,
          wwid,
          url: `http://browsejjeds.jnj.com/detail.jsp${each.attribs.value}`,
        };
        return obj;
      }
      return false;
    });
    return options.filter((each) => { return each; });
  }
  return true;
}

function extractValues(data) {
  if (data.firstChild) {
    return extractValues(data.firstChild);
  }

  return data.data;
}

function toCamelCase(str) {
  const newStr = (str.split(' ')).join('');
  const str2 = newStr.charAt(0).toLowerCase() + newStr.slice(1);
  return str2;
}

/**
 * Saves JJEDS Users Data in DB
 * @author Aniket
 * @param {Object} data The jjeds properties
 * @returns {Promise}
*/
function saveJjedsDetails(data) {
  return new Promise(async (resolve, reject) => {
    const jData = JSON.parse(JSON.stringify(data));
    jData._id = jData.wWID;
    if (jData.directReports && jData.directReports.length) {
      jData.directReports = data.directReports.map((e) => { return e.wwid; });
    }
    if (jData.sponsoredPartners && jData.sponsoredPartners.length) {
      jData.sponsoredPartners = data.sponsoredPartners.map((e) => { return e.wwid; });
    }
    // Transform the direct reports/sponsored partners array
    try {
      const instance = new Jjed(jData);
      const res = await instance.save();
      // 1.b Jjeds data has been successfully saved to db
      return resolve(res);
    } catch (saveErr) {
      // 1.a Jjeds data saving in DB failed
      logger.error(saveErr, 'ERROR_DB_SAVE');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_SAVE' });
    }
  });
}

function getData(url) {
  return new Promise((resolve, reject) => {
    const json = {};
    request(url, (error, response, html) => {
      if (!error) {
        const $ = cheerio.load(html);

        $('.objectDetail').find('tbody').find('tr').map((i, each) => {
          let value = '';
          const key1 = extractValues(each.children[0]);
          const key = toCamelCase(key1);
          if (key === 'directReports' || key === 'sponsoredPartners') {
            value = extractOptions(each.children[1].children);
          } else {
            value = extractValues(each.children[1]);
          }
          json[key] = value;
          return true;
        });
        json.selfUrl = url;
        resolve(json);
      } else {
        reject(error);
      }
    });
  });
}

function startScraping(startUrl) {
  return new Promise((resolve, reject) => {
    getData(startUrl).then(async (res) => {
      await saveJjedsDetails(res);
      const data = res;
      const childrenPromises = [];
      if (data && data.directReports && data.directReports.length > 0) {
        data.directReports.forEach((each) => {
          childrenPromises.push(startScraping(each.url));
        });
      }
      if (data && data.sponsoredPartners && data.sponsoredPartners.length > 0) {
        data.sponsoredPartners.forEach((each) => {
          childrenPromises.push(startScraping(each.url));
        });
      }
      if (childrenPromises.length) {
        Promise.all(childrenPromises).then((pRes) => { //eslint-disable-line
          return resolve(data);
        }, (err2) => {
          return reject(err2);
        });
      } else {
        return resolve(data);
      }
    }).catch((err) => {
      return reject(err);
    });
  });
}

function scrapeJjedsData() {
  return new Promise((resolve, reject) => {
    const url = 'http://browsejjeds.jnj.com/detail.jsp?detail=less&u=1046563&o=Employees&st=01234'; // Cyrus
    const allData = {};
    startScraping(url, allData).then((res) => { //eslint-disable-line
      resolve('Scraping Done');
    }, (err) => {
      reject(err);
    });
  });
}

/**
 * Get all jjeds data from DB
 *
 * @method getAllJjedsData
 * @param {Boolean} superAdmin The user is superadmin or not.
 * @param {String} type Type of data to be send to client.
 * @return {Promise} Resolved when the all jjeds data has been retrieved.
 */
function getAllJjedsData(superAdmin, type) {
  return new Promise(async (resolve, reject) => {
    // Get all jjeds data from DB
    if (!superAdmin) {
      reject({
        message: 'Unauthorized: Please contact your super administrator',
        code: 401,
      });
    } else {
      try {
        let query;
        if (type === 'hierarchy') {
          query = Jjed.findOne({ _id: '1046563' }) // Cyrus
            .select('wWID commonName directReports supervisor -_id')
            .populate({
              path: 'directReports',
              select: 'wWID commonName directReports supervisor -_id',
              populate: {
                path: 'directReports',
                select: 'wWID commonName directReports supervisor -_id',
                populate: {
                  path: 'directReports',
                  select: 'wWID commonName directReports supervisor -_id',
                  populate: {
                    path: 'directReports',
                    select: 'wWID commonName directReports supervisor -_id',
                    populate: {
                      path: 'directReports',
                      select: 'wWID commonName directReports supervisor -_id',
                      populate: {
                        path: 'directReports',
                        select: 'wWID commonName directReports supervisor -_id',
                        populate: {
                          path: 'directReports',
                          select: 'wWID commonName directReports supervisor -_id',
                          populate: {
                            path: 'directReports',
                            select: 'wWID commonName directReports supervisor -_id',
                          },
                        },
                      },
                    },
                  },
                },
              },
            });
        }
        if (type === 'json') {
          query = Jjed.find({}).select('-__v -createdAt -updatedAt');
        }
        const jData = await query.exec();
        if (jData) {
          resolve(jData);
        } else {
          // 1.c If error, reject with error
          logger.error('ERROR_DB_FIND_JJED');
          return reject({
            message: 'Error in finding jjeds data',
            code: 404,
            error: 'ERROR_DB_FIND_JJED',
          });
        }
      } catch (error) {
        // 1.a If error, reject with error
        logger.error(findErr, 'ERROR_DB_FIND_JJED');
        return reject({
          message: 'Internal Server Error',
          code: 500,
          error: 'ERROR_DB_FIND_JJED',
        });
      }
    }
  });
}

/**
 * Bulk create JJEDS data in DB.
 *
 * @method createJjedsData
 * @param {Array} data The jjeds data.
 * @param {Boolean} superAdmin The user is superadmin or not.
 * @return {Promise} Resolved when the jjeds data has been created.
 */
function createJjedsData(data, superAdmin) {
  return new Promise(async (resolve, reject) => {
    if (!superAdmin) {
      reject({
        message: 'Unauthorized: Please contact your super administrator',
        code: 401,
      });
    } else {
      const userError = [];
      async.forEachOf(data, async (item, key, callback) => {
        // 1 Create jjed data in DB
        const jData = item;
        jData._id = jData.wWID;
        try {
          const instance = new Jjed(item);
          const res = await instance.save();
          if (res && res.emailAddress) {
            const uData = { user: { email: res.emailAddress } };
            // 2 Create user in User Collection.
            createUser(uData).then(() => {
              const organizationalUnit = res && res.organizationalUnit;
              // 2.a IF: User is JnJ Employee add user to JnJ Guest group.
              if (organizationalUnit === LDAP.ORGANIZATIONAL_UNIT.EMPLOYEES) {
                // 3. Add JnJ Employee to Guest group(Scope + Gitlab).
                jiraGroupServices.addUserToGuestGroup({ wWID: jData.wWID }).then(() => {
                  // 3.a User added to guest group.
                  callback();
                }).catch(() => {
                  // 3.b Failed to add user to guest group.
                  callback();
                });
              } else {
                // 2.b ELSE: Callback success Non-JnJ Employees - User data has been successfully saved to db
                callback();
              }
            }).catch(() => {
              userError.push(res.commonName);
              // 2.b User data creation in DB failed
              callback();
            });
          } else {
            userError.push(res.commonName);
            // 1.c Failed to get Jjed user emailAddress.
            callback();
          }
        } catch (saveErr) {
          logger.error(saveErr, 'ERROR_DB_SAVE_JJED');
          if (saveErr.code === 11000) {
            callback({ code: 11000 });
          } else {
            callback({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_SAVE_JJED' });
          }
        }
      }, (err) => {
        if (err) {
          if (err.code === 11000) {
            return resolve({ message: 'Jjeds data creation process completed. Some of the jjeds data would not have been created due to duplication in wWID.', code: 200 });
          } else {
            return reject(err);
          }
        } else {
          return resolve(userError.length ? {
            message: `Users added to JJEDS hierarchy but couldn\'t sync users: ${userError.join(', ')} in scope`,
            code: 207,
            error: 'ERROR_DB_SAVE_USER',
          } : { message: 'All jjeds data created successfully', code: 200 });
        }
      });
    }
  });
}

/**
 * Updates jjeds user data in DB
 * *
 * @method updateJjedsDataDb
 * @param {Object} filter The data for query.
 * @param {Object} update The data for update.
 * @return {Promise} Resolved when the jjed user data has been updated.
 */
function updateJjedsDataDb(filter, update) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await Jjed.findOneAndUpdate(
        filter,
        update,
        { new: true, strict: true }).lean();
      // 1.b Jjed user data has been successfully updated to db
      resolve({ message: 'Jjeds user data updated successfully', code: 200, data: res });
    } catch (err) {
      // 1.a Jjed user data updation in DB failed
      logger.error(err, 'ERROR_DB_UPDATE_JJED');
      if (err.code === 11000) {
        reject({ message: 'Duplicate: Jjed user data with same wwid already exist in system', code: 403, error: 'ERROR_DB_UPDATE_JJED' });
      } else {
        reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE_JJED' });
      }
    }
  });
}

/**
 * Updates jjeds direct reports in DB
 * *
 * @method updateJjedsDirectReports
 * @param {Array} wWIDS The direct reports ids.
 * @return {Promise} Resolved when the jjeds direct reports has been updated.
 */
function updateJjedsDirectReports(wWIDS) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await Jjed.update(
        {},
        { $pull: { directReports: { $in: wWIDS } } },
        { multi: true }).lean();
      return resolve(res);
    } catch (err) {
      // 1.a Jjed user data updation in DB failed
      logger.error(err, 'ERROR_DB_UPDATE_JJED');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE_JJED' });
    }

  });
}

/**
 * Updates direct reports supervisor in DB
 * *
 * @method updateDirectReportsSupervisor
 * @param {Array} wWIDS The direct reports ids.
 * @param {String} supervisor The supervisor wwid.
 * @return {Promise} Resolved when the direct reports supervisorhas been updated.
 */
function updateDirectReportsSupervisor(wWIDS, supervisor) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await Jjed.update(
        { _id: { $in: wWIDS } },
        { $set: { supervisor } },
        { multi: true }).lean();
      return resolve(res);
    } catch (err) {
      // 1.a Jjed user data updation in DB failed
      logger.error(err, 'ERROR_DB_UPDATE_JJED');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE_JJED' });
    }
  });
}

/**
 * Updates jjeds user data.
 *
 * @method updateJjedsData
 * @param {Object} opts The jjeds properties sent to the DB.
 * @param {String} opts.id The jjed id.
 * @param {Object} opts.data The jjed user data.
 * @param {Boolean} opts.superAdmin The user is superadmin or not.
 * @return {Promise} Resolved when the jjed user data has been updated.
 */
function updateJjedsData(opts) {
  return new Promise((resolve, reject) => {
    if (!opts.superAdmin) {
      reject({
        message: 'Unauthorized: Please contact your super administrator',
        code: 401,
      });
    } else {
      // 1 Update jjeds direct reports in DB
      const filter = {
        _id: opts.id,
      };
      const jData = opts;
      const df = jData.data.directReports;
      delete jData.data.directReports;
      if (df && df.length > 0) {
        if (jData.data.type === 'remove') {
          const update = {
            $pull: { directReports: { $in: df } },
            $set: jData.data,
          };
          // 1 Update jjed user data
          updateJjedsDataDb(filter, update).then((dbRes) => {
            // 1.a If found, resolve with data
            if (dbRes) {
              resolve(dbRes);
            }
          }, (dbErr) => {
            // 1.b Jjed user updation from DB failed
            reject(dbErr);
          });
        } else {
          updateJjedsDirectReports(df).then((res) => {
            // 1.a Jjeds direct reports has been successfully updated in db
            if (res) {
              const update = {
                $addToSet: { directReports: { $each: df } },
                $set: jData.data,
              };
              // 2 Update jjed user data
              updateJjedsDataDb(filter, update).then((dbRes) => {
                // 2.a If found, resolve with data
                if (dbRes) {
                  resolve(dbRes);
                }
              }, (dbErr) => {
                // 2.b Jjed user updation from DB failed
                reject(dbErr);
              });
            }
          }, (err) => {
            // 1.b Jjeds direct reports updation in DB failed
            reject(err);
          });
        }
      } else {
        const update = {
          $set: jData.data,
        };
        // 1 Update jjed user data
        updateJjedsDataDb(filter, update).then((dbRes) => {
          // 1.a If found, resolve with data
          if (dbRes) {
            resolve(dbRes);
          }
        }, (dbErr) => {
          // 1.b Jjed user updation from DB failed
          reject(dbErr);
        });
      }
    }
  });
}

/**
 * Removes jjeds user from DB
 * *
 * @method deleteJjedsUser
 * @param {Object} filter The data for query.
 * @return {Promise} Resolved when the jjed user has been removed from db.
 */
function deleteJjedsUser(filter) {
  return new Promise(async (resolve, reject) => {
    try {
      await Jjed.remove(filter);
      // 3.b Jjed user data successfully deleted from DB
      return resolve({ message: 'Jjeds user data deleted successfully', code: 200 });
    } catch (err) {
      // 3.a Jjed user data deletion in DB failed
      logger.error(err, 'ERROR_DB_DELETE_JJED');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_DELETE_JJED' });
    }
  });
}

/**
 * Deletes jjeds data from DB.
 *
 * @method deleteJjedsData
 * @param {String} id The jjed id.
 * @param {Boolean} superAdmin The user is superadmin or not.
 * @return {Promise} Resolved when the jjeds user data has been removed.
 */
function deleteJjedsData(id, superAdmin) {
  return new Promise(async (resolve, reject) => {
    if (!superAdmin) {
      reject({
        message: 'Unauthorized: Please contact your super administrator',
        code: 401,
      });
    } else {
      const filter = {
        _id: id,
      };
      // 1 Get jjeds user data from DB
      try {
        const query = Jjed.findOne(filter);
        const jData = await query.exec();
        if (jData) {
          // 1.b. Jjeds user data found
          if (jData.directReports && jData.directReports.length > 0) {
            // If direct reports are there, transfer direct reports to his/her supervisor
            const update = {
              $addToSet: { directReports: { $each: jData.directReports } },
            };
            // 2 Update user's supervisor data
            updateJjedsDataDb({ _id: jData.supervisor }, update).then((dbRes) => {
              // 2.a If data updated pull requesting user from his supervisor direct reports
              if (dbRes) {
                // 3 Pull user from supervisor direct reports
                updateJjedsDirectReports([id]).then((dRes) => {
                  // 3.a Jjeds direct reports has been successfully updated in db
                  if (dRes) {
                    // 4 Update user direct reports supervisor
                    updateDirectReportsSupervisor([jData.directReports], jData.supervisor)
                      .then((sRes) => {
                        // 4.a Direct reports supervisor has been successfully updated in db
                        if (sRes) {
                          // 5 Delete jjed user data from DB
                          deleteJjedsUser(filter).then((uRes) => {
                            // 5.a Jjed user data successfully deleted from DB
                            if (uRes) {
                              resolve(uRes);
                            }
                          }, (uErr) => {
                            // 5.b Jjed user data deletion in DB failed
                            reject(uErr);
                          });
                        }
                      }, (sErr) => {
                        // 4.b Jjeds direct reports updation in DB failed
                        reject(sErr);
                      });
                  }
                }).catch((dErr) => {
                  // 3.b Jjeds direct reports updation in DB failed
                  reject(dErr);
                });
              }
            }, (dbErr) => {
              // 2.b Jjed user updation from DB failed
              reject(dbErr);
            });
          } else {
            // 2 If direct reports are not there, pull user wwid from jjeds users direct reports
            updateJjedsDirectReports([id]).then((dbRes) => {
              // 2.a Jjeds direct reports has been successfully updated in db
              if (dbRes) {
                // 3 Delete jjed user data from DB
                deleteJjedsUser(filter).then((uRes) => {
                  // 3.a Jjed user data successfully deleted from DB
                  if (uRes) {
                    resolve(uRes);
                  }
                }).catch((uErr) => {
                  // 3.b Jjed user data deletion in DB failed
                  reject(uErr);
                });
              }
            }, (dbErr) => {
              // 2.b Jjeds direct reports updation in DB failed
              reject(dbErr);
            });
          }
        } else {
          // 1.c If data not found, reject with error
          logger.error(findErr, 'ERROR_DB_FIND_JJED');
          reject({
            message: 'Error in finding jjed user data',
            code: 404,
            error: 'ERROR_DB_FIND_JJED',
          });
        }
      } catch (findErr) {
        // 1.a If error, reject with error
        logger.error(findErr, 'ERROR_DB_FIND_JJED');
        return reject({
          message: 'Internal Server Error',
          code: 500,
          error: 'ERROR_DB_FIND_JJED',
        });
      }
    }
  });
}

/**
 * @method getJjedsData
 *
 * Get jjeds user data from DB
 * @param {String} id The jjeds id.
 * @return {Promise} Resolved when the jjeds user data has been retrieved.
 */
function getJjedsData(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const query = Jjed.find({ _id: id })
        .select('directReports emailAddress organizationalUnit')
        .populate('directReports', 'commonName emailAddress');
      const jData = await query.exec();
      if (jData) {
        // 1.b. Jjeds user data found
        return resolve(jData);
      } else {
        // 1.c If error, reject with error
        logger.error(findErr, 'ERROR_DB_FIND_JJED');
        return reject({
          message: 'Error in finding jjed user data',
          code: 404,
          error: 'ERROR_DB_FIND_JJED',
        });
      }
    } catch (findErr) {
      // 1.a If error, reject with error
      logger.error(findErr, 'ERROR_DB_FIND_JJED');
      reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_JJED',
      });
    }
  });
}

function findMemberInGroup(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const gData = await Group.findOne({ members: { $in: [{ _id: id }] } }).lean();
      resolve(gData);
    } catch (findErr) {
      logger.error(findErr, 'ERROR_DB_FIND_GROUP');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_GROUP',
      });
    }
  });
}

function findMemberInGroupByGroupName(name, id) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(name);
      const gData = await Group.findOne({ name, members: { $in: [{ _id: id }] } }).lean();
      console.log(gData, 'gDATA');
      resolve(gData);
    } catch (findErr) {
      logger.error(findErr, 'ERROR_DB_FIND_GROUP');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_GROUP',
      });
    }
  });
}
/**
 * Upload JJEDS data in DB.
 *
 * @method uploadjedsData
 * @param {Array} data The jjeds data.
 * @param {Boolean} superAdmin The user is superadmin or not.
 * @return {Promise} Resolved when the jjeds data has been uploaded.
 */
function uploadJjedsData(data, superAdmin) {
  return new Promise((resolve, reject) => {
    if (!superAdmin) {
      reject({
        message: 'Unauthorized: Please contact your super administrator',
        code: 401,
      });
    } else {
      deleteJjedsUser({}).then((dRes) => {
        // 1.a Jjeds user data successfully deleted from DB
        if (dRes) {
          createJjedsData(data, superAdmin).then((cRes) => {
            // 2.a Jjeds user data successfully uploaded in DB
            if (cRes) {
              resolve(cRes);
            }
          }, (cErr) => {
            // 2.b Jjeds user data upload in DB failed
            reject(cErr);
          });
        }
      }, (dErr) => {
        // 1.b Jjeds user data deletion in DB failed
        reject(dErr);
      });
    }
  });
}

/**
 * Authorize or revoke superamdin permissions.
 *
 * @method superAdminUser.
 * @param {String} username The name of the user to authorize or revoke superamdin permissions.
 * @return {Promise} Resolved when the user superamdin status has been updated.
 */
function superAdminUser(id) {
  return new Promise(async (resolve, reject) => {
    // Find user in DB
    try {
      const filter = {
        username: id,
      };
      const userData = await User.findOne(filter).lean();
      if (userData) {
        // 1.b User found in DB
        const update = {
          $set: {
            isSuperAdmin: !userData.isSuperAdmin,
          },
        };
        // 2 Update user superadmin status in DB
        try {
          const res = await User.findOneAndUpdate(
            filter,
            update,
            { new: true, strict: true, runValidators: true }).lean();
          // 1.a User superadmin status updated in DB
          resolve(res);
        } catch (err) {
          logger.error(err, 'ERROR_DB_UPDATE_USER');
          reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FIND_USER' });
        }
      }
    } catch (uErr) {
      // 1.a User not found in DB
      logger.error(uErr, 'ERROR_DB_FIND_USER');
      reject({ message: 'Internal Server Error', code: 404, error: 'ERROR_DB_FIND_USER' });
    }
  });
}

/**
 * Uploades profile image.
 *
 * @method uploader
 * @param {Object} file The profile image file data.
 * @param {Object} options The profile image options .
 * @return {Promise} Resolved when the profile image has been uploaded.
 */

function uploader(id, file, options) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject({
        message: 'No file uploaded.',
        code: 500,
      });
    }

    const fileName = `${createRandomString()}.png`;
    const filePath = `${options.dest}${fileName}`;
    const fileStream = fs.createWriteStream(filePath);

    file.on('error', (err) => {
      reject(err);
    });

    file.pipe(fileStream);

    file.on('end', (err) => { //eslint-disable-line
      resolve(fileName);
    });
  });
}

/**
 * Update user profile image.
 *
 * @method updateProfileImage.
 * @param {opts} data The profile image data to update.
 * @return {Promise} Resolved when the user profile image details has been updated in db.
 */

function updateProfileImage(opts) {
  return new Promise(async (resolve, reject) => {
    // save data to database
    try {
      const filter = {
        username: opts.id,
      };
      const update = {
        $set: opts.data,
      };
      const res = await User.findOneAndUpdate(
        filter,
        update,
        { new: true, strict: true, runValidators: true });
      return resolve(res);
    } catch (err) {
      // 2.a User profile image details not updated in DB
      logger.error(err, 'ERROR_DB_UPDATE_USER');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FIND_USER' });
    }
  });
}

/**
 * Upload user profile image.
 *
 * @method uploadProfileImage.
 * @param {opts} data The profile image data from request.
 * @return {Promise} Resolved when the user profile image has been successfully uploaded.
 */

function uploadProfileImage(opts) {
  return new Promise((resolve, reject) => {
    const UPLOAD_PATH = `static/profile-images/${opts.id}`;
    const fileOptions = { dest: `${UPLOAD_PATH}/` };
    if (!fs.existsSync(UPLOAD_PATH)) {
      fs.mkdir(UPLOAD_PATH, (dirErr) => {
        if (dirErr) reject(dirErr);
        // save the file
        uploader(opts.id, opts.profileImage, fileOptions).then((uploadRes) => {
          // save data to database
          const data = {
            id: opts.id,
            data: {
              profileImage: `profile-images/${opts.id}/${uploadRes}`,
            },
          };
          updateProfileImage(data).then((result) => {
            resolve(result);
          }, (err) => {
            reject(err);
          });
        }, (uploadErr) => {
          reject(uploadErr);
        });
      });
    } else {
      const directory = `static/profile-images/${opts.id}`;
      fs.readdir(directory, (readErr, files) => {
        if (readErr) {
          reject(readErr);
        }
        if (files.length) {
          files.forEach((file) => {
            fs.unlink(path.join(directory, file), (unlinkErr) => {
              if (unlinkErr) {
                reject(unlinkErr);
              }
              uploader(opts.id, opts.profileImage, fileOptions).then((uploadRes) => {
                // save data to database
                const data = {
                  id: opts.id,
                  data: {
                    profileImage: `profile-images/${opts.id}/${uploadRes}`,
                  },
                };
                updateProfileImage(data).then((result) => {
                  resolve(result);
                }, (err) => {
                  reject(err);
                });
              }, (uploadErr) => {
                reject(uploadErr);
              });
            });
          });
        } else {
          uploader(opts.id, opts.profileImage, fileOptions).then((uploadRes) => {
            // save data to database
            const data = {
              id: opts.id,
              data: {
                profileImage: `profile-images/${opts.id}/${uploadRes}`,
              },
            };
            updateProfileImage(data).then((result) => {
              resolve(result);
            }, (err) => {
              reject(err);
            });
          }, (uploadErr) => {
            reject(uploadErr);
          });
        }
      });
    }
  });
}

/**
 * Updates default page.
 *
 * @method updateDefaultPage
 * @param {String} opts.id The name of the user
 * @param {String} opts.page The page name
 * @return {Promise} Resolved when the user default page has been updated.
 */
function updateDefaultPage(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const filter = {
        username: opts.id,
      };
      const update = {
        $set: {
          defaultPage: opts.page,
        },
      };
      const res = await User.findOneAndUpdate(
        filter,
        update,
        { new: true, strict: true, runValidators: true });
      return resolve(res);
    } catch (err) {
      // 2.a User default page not updated in DB
      logger.error(err, 'ERROR_DB_UPDATE_USER');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FIND_USER' });
    }
  });
}

/**
 * Updates default project type.
 *
 * @method updateDefaultType
 * @param {String} opts.id The name of the user
 * @param {String} opts.type The project type data
 * @return {Promise} Resolved when the user default project type has been updated.
 */
function updateDefaultType(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const filter = {
        username: opts.id,
      };
      if (opts?.type.hasOwnProperty(opts?.type?.skipTemplateSelection)) {
        opts.type.skipTemplateSelection = opts.type.skipTemplateSelection ? 'yes' : 'no';
      }
      const update = {
        $set: {
          defaultType: { ...opts.type },
        },
      };
      const res = await User.findOneAndUpdate(
        filter,
        update,
        { new: true, strict: true, runValidators: true });
      resolve(res);
    } catch (err) {
      logger.error(err, 'ERROR_DB_UPDATE_USER');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FIND_USER' });
    }
  });
}

/**
 * Updates default project type.
 *
 * @method updateAllProjects
 * @param {String} opts.id The name of the user
 * @param {String} opts.allProjects The project type data
 * @return {Promise} Resolved when the user default project type has been updated.
 */
function updateAllProjects(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const filter = {
        _id: new mongoose.Types.ObjectId(opts.id),
      };
      const update = {
        $set: {
          allProjects: opts.allProjects,
        },
      };
      // 2 Update user default project type in DB
      const res = await User.findOneAndUpdate(
        filter,
        update,
        { new: true, strict: true, runValidators: true }
      );
      return resolve(res);
    } catch (err) {
      // 2.a User default page not updated in DB
      logger.error(err, 'ERROR_DB_UPDATE_USER');
      reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FIND_USER' });
    }
  });
}

/**
 * Updates display of project confirmation page.
 *
 * @method updateDisplayPrConPage
 * @param {String} opts.id The name of the user
 * @param {String} opts.prConPage The project confirmation page data
 * @return {Promise} Resolved when the user display of project confirmation page has been updated.
 */
function updateDisplayPrConPage(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const filter = {
        username: opts.id,
      };
      const update = {
        $set: {
          displayPrConPage: opts.prConPage,
        },
      };
      // 2 Update user display of project confirmation page in DB
      const res = await User.findOneAndUpdate(
        filter,
        update,
        { new: true, strict: true, runValidators: true });
      return resolve(res);
    } catch (err) {
      logger.error(err, 'ERROR_DB_UPDATE_USER');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FIND_USER' });
    }
  });
}

function updateRequestTabs(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const filter = {
        username: opts.id,
      };
      const update = {
        $set: {
          requestTabs: opts.requestTabs,
        },
      };
      // 2 Update user display of project confirmation page in DB
      const res = await User.findOneAndUpdate(
        filter,
        update,
        { new: true, strict: true, runValidators: true });
      return resolve(res);
    } catch (err) {
      // 2.a User display of project confirmation page not updated in DB
      logger.error(err, 'ERROR_DB_UPDATE_USER');
      reject({ message: 'Failed to update request tabs', code: 500, error: 'ERROR_DB_FIND_USER' });
    }
  });
}

/**
 * Check if there are matching projects with typeId in DB
 *
 * @method validateUserOrganizationalUnit
 * @param {Object} auth The user's authentication details.
 * @return {Promise} Resolved with user's organizational details.
 */
function validateUserOrganizationalUnit(auth) {
  return new Promise((resolve, reject) => {
    // 1 Find user's organizational details
    let username = auth.email || auth.username;
    const { REQUEST_ADMIN, REQUESTER, SCOPE_USER } = DEFAULT_USERS;
    if ([REQUEST_ADMIN.USERNAME, REQUESTER.USERNAME, SCOPE_USER.USERNAME, 'jira_admin'].includes(username) && typeof auth.wWID === 'object') {
      username = auth.wWID.wWID || auth.wWID.email;
    }
    if (!username && typeof auth.wWID === 'string') {
      username = auth.wWID;
    }
    LDAPConfig.findUser(username).then((ldapUser) => {
      if (ldapUser) {
        // 1.b If found, check organizational unit
        if (ldapUser.employeeType && ldapUser.employeeType === 'employee') {
          resolve('success');
        } else {
          logger.error(username, 'ERROR_DB_FIND_USER_ORGANIZATIONAL_UNIT');
          reject({
            message: `Error: (${ldapUser.fullName}) is not an employee.`,
            code: 403,
          });
        }
      } else {
        // 1.c reject with error
        logger.error(username, 'ERROR_DB_FIND_USER_ORGANIZATIONAL_UNIT');
        reject({
          message: 'User not found in Jjeds.',
          code: 404,
        });
      }
    }).catch((error) => {
      logger.error(error, 'ERROR_DB_FIND_USER_ORGANIZATIONAL_UNIT');
      reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_USER_ORGANIZATIONAL_UNIT',
      });
    });
  });
}

/**
 * Returns a list of J&J Employees that match the search string.
 *
 * @method getJJEmployees
 * @param {Object} opts The request options
 * @param {string} opts.query A query string used to search username, name or e-mail address
 * @param {number} [opts.page] The current page of the user table
 * @param {number} [opts.perPage] The documents per page to return
 * @param {Promise} Resolved with J&J Employees data.
 */
function getJJEmployees(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1 Get J&J Employees data from DB
      const filter = {
        $and: [
          {
            $or:
              [
                { username: { $regex: opts.query, $options: 'i' } },
                { email: { $regex: opts.query, $options: 'i' } },
                { name: { $regex: opts.query, $options: 'i' } },
              ],
          },
          { 'wWID.organizationalUnit': 'Employees' },
          { isEnabled: true },
        ],
      };
      const dbRes = await User.aggregate([
        // {$sort: {...}}
        {
          $lookup:
          {
            from: 'jjeds',
            localField: 'wWID',
            foreignField: '_id',
            as: 'wWID',
          },
        },
        { $match: filter },
        {
          $facet: {
            stage1: [{ $group: { _id: null, count: { $sum: 1 } } }],
            stage2: [
              { $skip: opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0 },
              { $limit: opts.perPage },
            ],
          },
        },
        { $unwind: '$stage1' },
        // output projection
        {
          $project: {
            count: '$stage1.count',
            data: '$stage2',
          },
        },
      ]);
      if (dbRes) {
        // 1.b J&J Employees data found in DB
        return resolve(dbRes);
      } else {
        // 1.c J&J Employees data not found in DB
        logger.error('ERROR_DB_FIND_JJ_EMPLOYEES');
        return reject({
          message: 'J&J Employees not found.',
          code: 404,
        });
      }
    } catch (dbErr) {
      // 1.a J&J Employees data not found in DB
      logger.error(dbErr, 'ERROR_DB_FIND_JJ_EMPLOYEES');
      reject({
        message: 'Error in getting J&J Employees data',
        code: 500,
        error: 'ERROR_DB_FIND_JJ_EMPLOYEES',
      });
    }
  });
}

/**
 * Email email notification.
 *
 * @method enableEmailNotification
 * @param {String} opts.id The name of the user
 * @param {String} opts.emailNotification The email notification preferences
 * @return {Promise} Resolved when the user's preferences of enabling email
 * notification has been updated.
 */
function updateEmailNotification(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const filter = {
        username: opts.id,
      };
      const update = {
        $set: {
          emailNotification: opts.emailNotification,
        },
      };
      // 2 Update user's preferences of enabling email notification in DB
      const res = await User.findOneAndUpdate(
        filter,
        update,
        { new: true, strict: true, runValidators: true });
      return resolve(res);
    } catch (err) {
      // 2.a User's preferences of enabling email notification not updated in DB
      logger.error(err, 'ERROR_DB_UPDATE_USER');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FIND_USER' });
    }
  });
}

function updateGitVersionControlType(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const filter = {
        username: opts.id,
      };
      const update = {
        $set: {
          gitVersionControlType: opts.gitVersionControlType,
        },
      };
      // 2 Update user's preferences of enabling email notification in DB
      const res = await User.findOneAndUpdate(
        filter,
        update,
        { new: true, strict: true, runValidators: true });
      return resolve(res);
    } catch (err) {
      // 2.a User's preferences of enabling email notification not updated in DB
      logger.error(err, 'ERROR_DB_UPDATE_USER');
      reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FIND_USER' });
    }
  });
}


/**
 * Email email notification.
 *
 * @method updateDefaultProjectStatus
 * @param {String} opts.id The name of the user
 * @param {String[]} opts.status array of string
 * @return {Promise} Resolved when the user's preferences
 * status has been updated.
 */
function updateDefaultProjectStatus(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const update = {
        $set: {
          [opts.department !== 'SBO' ? 'defaultProjectStatus' : 'sboProjectStatus']: opts.status,
        },
      };
      // 2 Update user's preferences of enabling email notification in DB
      const res = await User.findByIdAndUpdate(
        opts.id,
        update,
        { new: true, strict: true, runValidators: true });
      return resolve(res);
    } catch (err) {
      // 2.a User's preferences of enabling email notification not updated in DB
      logger.error(err, 'ERROR_DB_UPDATE_USER_PROJECT_STATUS');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE_USER_PROJECT_STATUS' });
    }
  });
}

function updateUserCustomDisplayValues(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const update = {
        $set: {
          [opts.department !== 'SBO' ? 'customDisplayValues' : 'customSboDisplayValues']: [...new Set(opts.customDisplayValues)],
        },
      };
      // 2 Update user's preferences of enabling email notification in DB
      const res = await User.findByIdAndUpdate(
        opts.id,
        update,
        { new: true, strict: true, runValidators: true });
      return resolve(res);
    } catch (err) {
      // 2.a User's preferences of enabling email notification not updated in DB
      logger.error(err, 'ERROR_DB_UPDATE_CUSTOM_DISPLAY_VALUES');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE_CUSTOM_DISPLAY_VALUES' });
    }
  });
}

function getUserByObjectId(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const userResponse = await User.findOne({ _id: new mongoose.Types.ObjectId(opts?.id) }).lean();
      if (userResponse) {
        return resolve({
          code: 200,
          message: 'User Data fetched successfully',
          data: userResponse
        });
      }
      return reject({
        code: 404,
        message: 'User not found',
      });
    } catch (error) {
      console.log(error);
      logger.error('Failed to find user', 'FAILED_TO_FIND_USER');
      return reject({
        code: 400,
        message: 'Failed to find User',
        error
      });
    }
  })
}

export const jiraUserServices = {
  createUser,
  bulkCreateUsers,
  createUserInJira,
  deleteUser,
  deleteUserPermanent,
  restoreUser,
  getUserDetailsFromDB,
  getUser,
  editUser,
  search,
  myPermissions,
  searchPermissions,
  scrapeJjedsData,
  getAllJjedsData,
  createJjedsData,
  updateJjedsData,
  deleteJjedsData,
  getJjedsData,
  findMemberInGroup,
  findMemberInGroupByGroupName,
  uploadJjedsData,
  superAdminUser,
  uploadProfileImage,
  updateDefaultPage,
  updateDefaultType,
  updateAllProjects,
  updateDisplayPrConPage,
  updateRequestTabs,
  validateUserOrganizationalUnit,
  getJJEmployees,
  updateEmailNotification,
  updateDefaultProjectStatus,
  updateUserCustomDisplayValues,
  updateGitVersionControlType,
  getUserByObjectId,
}