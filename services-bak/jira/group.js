import { gitlabGroupServices } from '../gitlab/group.js';

// const config from 'config');
import mongoose from 'mongoose';
import async from 'async';
import GroupClient from '../../utils/group.js';
import { Group } from '../../models/group.js';
import { logger } from '../../utils/logger.js';
import { User } from '../../models/user.js';
import { CONSTANTS } from '../../utils/constants.js';
import { getJiraClient } from '../../connectors/jira.js';

const { GROUPS, GITLAB, LDAP } = CONSTANTS;

/**
 * Transforms the various types of errors and tries to convert them into a standard output.
 * PRIVATE
 * @param {Object|String} err The err response sent from JIRA
 * @param {String} message The message to be sent in the error response
 */
function handleError(err, message) {
  try {
    const errorObj = JSON.parse(err);
    if (errorObj.statusCode) {
      return {
        code: errorObj.statusCode,
        error: errorObj.body,
        message,
      };
    }
    return errorObj;
  } catch (e) {
    return err;
  }
}

/**
 * Create Group.
 * ADMIN LEVEL
 *
 * @method createGroup
 *
 * @param {Object} opts The request options.
 * @param {Object} opts.group The group to create.
 * @param {String} opts.group.name The group name.
 * @returns {Promise}
 */
function createGroup(opts) {
  return new Promise(async (resolve, reject) => {
    const { name } = opts.group;
    // 1 Check if group with same name already exists
    try {
      const dbRes = await Group.findOne({ name: { $regex: name, $options: 'i' } }).lean();
      if (!dbRes) {
        // 2 Create Gitlab group.
        createGitlabGroup(opts.group.name).then((gRes) => {
          const gitlabId = gRes && gRes.body && gRes.body.id;
          opts.group.gitlabId = gitlabId;
          createScopeGroup(opts)
            .then((dbRes) => { return resolve(dbRes); })
            .catch((dbErr) => { return reject(dbErr); });
        }).catch((gErr) => {
          // 2.b Failed to Create group in Gitlab.
          reject(gErr);
        });
      } else {
        // 1.b Failed to create group. Group with similar name already exists.
        reject({
          message: 'Duplicate: Group with same name already exist in system', code: 403, error: 'ERROR_DB_SAVE', dbRes,
        });
      }
    } catch (error) {
      // Failed to search group.
      return reject(dbErr);
    }
  });
}

/**
 * Create Group in Scope.
 * ADMIN LEVEL
 *
 * @method createScopeGroup
 *
 * @param {Object} opts The request options.
 * @param {Object} opts.group The group to create.
 * @param {String} opts.group.name The group name.
 * @param {String} [opts.group.gitlabId] Gitlab Group Id.
 * @param {String} [opts.group.alfrescoId] Gitlab Group Id.
 * @returns {Promise}
 */
function createScopeGroup(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const instance = new Group(opts.group);
      const newGroup = await instance.save();
      return resolve(newGroup);
    } catch (error) {
      // 1.a Group creation in DB failed
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_SAVE' });
    }
  });
}

/**
 * Returns groups.
 *
 * @method findGroups
 *
 * @param {Object} opts filter options
 * @param {Boolean} opts.internal get internal groups.
 * @return {Promise} Resolved when the groups have been retrieved.
 */
function findGroups(opts) {
  return new Promise(async (resolve, reject) => {
    let filter = { name: { $ne: GROUPS.GUEST } };
    if (opts.internal) {
      filter = {};
    }
    try {
      const gData = await Group.find(filter).lean();
      if (gData) {
        // 1.b. Groups data found
        resolve(gData);
      } else {
        // 1.c If error, reject with error
        logger.error(findErr, 'ERROR_DB_FIND_GROUPS');
        reject({
          message: 'Error in finding groups',
          code: 404,
          error: 'ERROR_DB_FIND_GROUPS',
        });
      }
    } catch (error) {
      // 1.a If error, reject with error
      logger.error(findErr, 'ERROR_DB_FIND_GROUPS');
      reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_GROUPS',
      });
    }
  });
}

/**
 * Returns groups.
 *
 * @method findGroup
 *
 * @param {Object} opts group options
 * @param {Boolean} opts.gid group ID.
 * @return {Promise} Resolved when the group have been retrieved.
 */
function findGroup(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const gData = await Group.findOne({ _id: opts.gid }).lean();
      if (gData) {
        // 1.b. Groups data found
        return resolve(gData);
      } else {
        // 1.c If error, reject with error
        logger.error(findErr, 'ERROR_DB_FIND_GROUP');
        return reject({
          message: 'Error in finding group',
          code: 404,
          error: 'ERROR_DB_FIND_GROUP',
        });
      }
    } catch (error) {
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
 * Deletes a group by given group parameter. Returns no content
 * ADMIN LEVEL
 *
 * @method removeGroup
 *
 * @param {Object} opts The request options
 * @param {String} opts.gid The Group ID of the group to delete.
 * @returns {Promise}
 */
function removeGroup(opts) {
  return new Promise((resolve, reject) => {

    findGroup(opts).then((data) => {
      if (data) {
        gitlabGroupServices.removeGroup(data.gitlabId).then(async (gRes) => {
          // 1. Delete group from DB.
          try {
            const res = await Group.deleteOne({ _id: opts.gid }).lean();
            if (res) {
              // 1.b. Group deleted from DB.
              return resolve({
                message: 'Group Deleted Permanently',
                code: 200,
              });
            } else {
              // 1.c. Group not found in DB.
              return reject({
                message: 'Group not found',
                code: 404,
                error: 'ERROR_GROUP_NOT_FOUND',
              });
            }
          } catch (error) {
            // 1.a. Failure to delete group, log and reject
            logger.error(err, 'ERROR_DB_DELETE_GROUP');
            return reject({
              message: 'Failed to delete Group',
              code: 500,
              error: 'ERROR_DB_DELETE_GROUP',
            });
          }
        }).catch((gErr) => {
          // Handle error from GitLab removeGroup service
          logger.error(gErr, 'ERROR_GITLAB_REMOVE_GROUP');
          return reject({
            message: 'Failed to remove Group from GitLab',
            code: gErr.response ? gErr.response.statusCode : 500,
            error: 'ERROR_GITLAB_REMOVE_GROUP',
          });
        });
      } else {
        // 1.d. Group not found in DB during initial find
        return reject({
          message: 'Group not found',
          code: 404,
          error: 'ERROR_GROUP_NOT_FOUND',
        });
      }
    }).catch((err) => {
      // Handle error from findGroup
      logger.error(err, 'ERROR_FIND_GROUP');
      return reject({
        message: 'Failed to find Group',
        code: 500,
        error: 'ERROR_FIND_GROUP',
      });
    });
  });
}



/**
 * Add group members in GitLab
 *
 * @method addUsersToGitlabGroup
 * @param {Array.<string>} gitlabGId The GitLab group ID
 * @param {Array.<string>} data The usernames of the project members
 * @param {number} accessLevel Access level of project members
 * @return {Promise.<{ body: string[]]}> | Error} Resolved when the project members has been added in GitLab
 */
function addUsersToGitlabGroup(gitlabGId, data, accessLevel) {
  return new Promise((resolve, reject) => {
    const result = [];
    const errors = [];
    async.forEachOf(data, (username, key, callback) => {
      gitlabGroupServices.addGroupMember(
        gitlabGId,
        username, accessLevel,
      ).then((gRes) => {
        if (gRes && gRes.body) {
          result.push(username);
        }
        callback();
      }, () => {
        errors.push(username); // Don't resolve async callback in case of error.
        callback();
      });
    }, (err) => {
      if (err) {
        try {
          const errorObj = JSON.parse(err);
          resolve({
            message: 'Failed to add few members in GitLab',
            code: 207,
            gitlabErr: errorObj,
          });
        } catch (e) {
          resolve({
            message: 'Failed to add few members in GitLab',
            code: 207,
            gitlabErr: err,
          });
        }
      } else {
        result && result.length ? resolve({
          message: 'Members added successfully',
          code: 200,
          body: result,
        }) : reject({
          message: `Failed to add ${errors.join(', ')} members to gitlab`,
          code: 409,
          body: errors,
        });
      }
    });
  });
}

/**
 * Add group members in Alfresco
 *
 * @method addUsersToAlfrscoGroup
 * @param {Array.<string>} alfrescoGId The Alfresco group ID
 * @param {Array.<string>} data The usernames of the project members
 * @param {number} memberType Membership type of project members
 * @return {Promise.<{ body: string[]]}> | Error} Resolved when the project members has been added in Alfresco
 */
// function addUsersToAlfrescoGroup(alfrescoGId, data, memberType = constants.ALFRESCO.MEMBER_TYPE.PERSON) {
//   return new Promise((resolve, reject) => {
//     const result = [];
//     const errors = [];
//     async.forEachOf(data, (username, key, callback) => {
//       global.services.alfresco.groupServices.addGroupMember(
//         alfrescoGId,
//         username, memberType,
//       ).then((aRes) => {
//         if (aRes && aRes.body) {
//           result.push(username);
//         }
//         callback();
//       }, () => {
//         errors.push(username); // Don't resolve async callback in case of error.
//         callback();
//       });
//     }, (err) => {
//       if (err) {
//         try {
//           const errorObj = JSON.parse(err);
//           resolve({
//             message: 'Failed to add few members in Alfresco group',
//             code: 207,
//             alfrescoErr: errorObj,
//           });
//         } catch (e) {
//           resolve({
//             message: 'Failed to add few members in Alfresco group',
//             code: 207,
//             alfrescoErr: err,
//           });
//         }
//       } else {
//         result && result.length ? resolve({
//           message: 'Members added successfully',
//           code: 200,
//           body: result,
//         }) : reject({
//           message: `Failed to add ${errors.join(', ')} members to Alfresco`,
//           code: 409,
//           body: errors,
//         });
//       }
//     });
//   });
// }

/**
 * Remove group members in GitLab
 *
 * @method removeUserFromGitlabGroup
 * @param {String} gitLabId The GitLab group ID
 * @param {Array} data The usernames of the project members
 * @param {Object} dbRes The DB response
 * @return {Promise} Resolved when the project members has been added in GitLab
 */
function removeUserFromGitlabGroup(gitLabId, data, dbRes) {
  return new Promise((resolve, reject) => { //eslint-disable-line
    const result = [];
    async.forEachOf(data, (username, key, callback) => {
      gitlabGroupServices.removeGroupMember(
        gitLabId,
        username,
      ).then((gRes) => {
        Array.prototype.push.apply(result, gRes);
        callback();
      }, (gErr) => {
        callback(gErr);
      });
    }, (err) => {
      if (err) {
        try {
          const errorObj = JSON.parse(err);
          resolve({
            message: 'Members removed from Scope group but got failed in remove few to GitLab',
            code: 207,
            gitlabErr: errorObj,
            dbRes,
          });
        } catch (e) {
          resolve({
            message: 'Members removed from Scope group but got failed in remove few to GitLab',
            code: 207,
            gitlabErr: err,
            dbRes,
          });
        }
      } else {
        resolve({
          message: 'Members removed successfully',
          code: 200,
          dbRes,
        });
      }
    });
  });
}

/**
 * Creates GitLab project group.
 * ADMIN LEVEL
 *
 * @method createGitlabGroup
 *
 * @param {string} groupName Group name
 * @returns {Promise}
 */
function createGitlabGroup(groupName) {
  return new Promise((resolve, reject) => {
    try {
      let prefixgroupName = process.env.NODE_ENV === "development" ? "DEV_" + groupName : process.env.NODE_ENV === "staging" ? "QA_" + groupName : process.env.NODE_ENV === "production" ? groupName : groupName;
      const payload = {
        name: prefixgroupName,
        path: prefixgroupName.toLowerCase().replace(/[^a-zA-Z0-9 ]/g, '').split(/[\s_-]+/).join('-'),
      };
      gitlabGroupServices.createGroup(payload).then((gRes) => {
        resolve(gRes);
      }, (gErr) => {
        reject(gErr);
      });
    } catch (error) {
      logger.error(uErr, 'ERROR_CREATE_GITLAB_GROUP');
      reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_CREATE_GITLAB_GROUP' });
    }
  });
}

/**
 * Creates Alfresco group.
 * ADMIN LEVEL
 *
 * @method createAlfrescoGroup
 *
 * @param {string} groupName Group name
 * @returns {Promise.<{ code: Number, message: String, body?: Object }>}
 */
// function createAlfrescoGroup(groupName) {
//   return new Promise((resolve, reject) => {
//     try {
//       const payload = {
//         displayName: groupName,
//         id: `SCOPE_${groupName.toUpperCase().replace(/[^a-zA-Z0-9 ]/g, '').split(/[\s_-]+/).join('_')}`,
//       };
//       global.services.alfresco.groupServices.createGroup(payload).then((aRes) => {
//         resolve(aRes);
//       }, (aErr) => {
//         reject(aErr);
//       });
//     } catch (error) {
//       logger.error(uErr, 'ERROR_CREATE_ALFRESCO_GROUP');
//       reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_CREATE_ALFRESCO_GROUP' });
//     }
//   });
// }

/**
 * Get scope user id by WWID
 * ADMIN LEVEL
 *
 * @method getScopeUserDetails
 * @private
 *
 * @param {Object} opts The request options.
 * @param {Array.<string[]>} emails The email Address of user.
 * @returns {Promise.<{wWID: string, _id: string, email: string, username: string}[]>|Error}
 */
function getScopeUserDetails(emails) {
  return new Promise(async (resolve, reject) => {
    try {
      const dbRes = await User.find({ email: { $in: emails } }).select('email wWID username').lean();
      const users = dbRes && dbRes.map((user) => {
        return {
          wWID: user.wWID,
          _id: user._id,
          email: user.email,
          username: user.username,
        };
      });
      return resolve(users);
    } catch (dbErr) {
      logger.error('ERROR_IN_GET_SCOPE_USER_DETAILS', dbErr);
      return reject(dbErr);
    }
  });
}

/**
 * Adds given user to a gitLab and scope group.
 * ADMIN LEVEL
 *
 * @method addUserToGroup
 *
 * @param {Object} opts The request options.
 * @param {string} opts.gid The Group Id of requested group.
 * @param {string} opts.id The id of the user to add to the group.
 * @param {number} [opts.accessLevel] Access Level of gitlab group.
 * @param {boolean} [opts.addTeamMembers] Add Direct reports to groop
 * @returns {Promise}
 */
function addUserToGroup(opts) {
  return new Promise(async (resolve, reject) => {
    // 1. Get Current Scope group details
    try {
      const group = await Group.findOne({ _id: opts.gid }).lean();
      // 1.a Failed to get group details
      if (!group) {
        reject({
          message: 'Group not found.',
          code: 404,
          error: 'ERROR_DB_FIND_GROUP',
        });
      }
      // 1.b Failed to get gitlab group details
      if (group && !group.gitlabId) {
        reject({
          message: 'Gitlab group is not linked, Please contact Administration.',
          code: 403,
          error: 'ERROR_DB_FIND_GITLAB_GROUP',
        });
      }
      const members = [];
      // 2. Add members to Scope and Gitlab group.
      if (opts.addTeamMembers) {
        // 2.a Add team members to scope and gitlab group
        // 3. Get direct reports for current user/supervisor.
        await jiraProjectServices.getAllDirectReportsDetails([opts.id], true).then(async (dReports) => {
          const directReports = [];
          // 3.a Concat members with directReport details with current user data.
          if (dReports && Array.isArray(dReports) && dReports.length) {
            Array.prototype.push.apply(directReports, dReports);
          }
          const emails = directReports.map((user) => { return user.email; });
          // 3.b Get user's details with _id
          await getScopeUserDetails(emails).then((uRes) => {
            if (uRes && uRes.length) {
              Array.prototype.push.apply(members, uRes);
            }
          });
        });
      } else {
        const user = await User.findOne({ wWID: opts.id });

        if (!user) {
          throw new Error('User not found');
        }

        // Add current user to member array
        const member = {
          _id: user._id,
          username: user.username,
          wWID: user.wWID,
        };
        members.push(member);
      }
      // 4. Add members to Gitlab group
      const usernames = members.map((member) => { return member.username; });
      addUsersToGitlabGroup(group.gitlabId, usernames, opts.accessLevel || GITLAB.ACCESS_LEVEL.DEVELOPER).then((gRes) => {
        // 5. Save members to scope group.
        const gitlabUsers = members.filter((member) => { return gRes.body.some((username) => { return username === member.username; }); }).map((user) => { return user.username; });
        // Alfresco Under Maintainence
        // addUsersToAlfrescoGroup(group.alfrescoId, gitlabUsers, constants.ALFRESCO.MEMBER_TYPE.PERSON).then((aRes) => {
        // const ids = members.filter((member) => { return aRes.body.some((username) => { return username === member.username; }); }).map((user) => { return user._id; });
        const ids = members.filter((member) => { return gitlabUsers.includes(member.username); });
        const memberDetails = { gid: group._id, ids };
        // 5.a Only add to Scope group when it were added in gitlab + alfresco group.
        addUsersToScopeGroup(memberDetails).then((dbRes) => {
          // 6. Resolve response based on numbers of users that were successfully added.
          // 6.a All the members were successfully added to Gitlab and Scope group
          if (members.length === ids.length) {
            resolve({
              message: 'Group member added successfully',
              code: 201,
              dbRes,
            });
          } else {
            // 6.b Failed to add few members to gitlab group.
            const users = members
              .filter((member) => { return !gRes.body.some((username) => { return username === member.username; }); })
              .map((user) => { return user.username; });
            return resolve({
              message: `Failed to add ${users.join(', ')}`,
              code: 207,
              dbRes,
            });
          }
        }).catch((dbErr) => {
          // 5.b Failed to save members to scope group.
          logger.error('ERROR_IN_ADD_USER_TO_SCOPE_GROUP_INVOKE', dbErr);
          return reject(dbErr);
        });
      }).catch((gErr) => {
        logger.error('ERROR_IN_ADD_GITLAB_GROUP_INVOKE', gErr);
        return reject(gErr);
      });
    } catch (error) {
      logger.error(dbErr, 'ERROR_IN_ADD_USER_TO_GROUP');
      reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_IN_ADD_USER_TO_GROUP' });
    }
  });
}

/**
 * Adds given users to a group.
 * ADMIN LEVEL
 *
 * @method addUsersToScopeGroup
 *
 * @param {Object} opts The request options.
 * @param {string} opts.gid The Group Id of requested group.
 * @param {string[]} opts.ids The ids of the users to add to the group.
 * @param {string} [opts.gitlabId] Gitlab group Id.
 * @param {Boolean} [opts.addMemberAsAdmin] Whether to add member as a admin or not in users DB.
 * @returns {Promise}
 */
function addUsersToScopeGroup(opts) {
  return new Promise(async (resolve, reject) => {
    // 1 Add member to group in DB
    const filter = { _id: opts.gid };
    const membersData = opts.ids.map((id) => { return { _id: id }; });
    const update = {
      $addToSet: {
        members: { $each: membersData },
      },
    };
    if (opts.gitlabId) {
      update.$set = {
        gitlabId: opts.gitlabId,
      };
    }
    try {
      const res = await Group.findOneAndUpdate(filter, update, { new: true, strict: true, runValidators: true }).lean();
      if (res) {
        // 1.b Member to group has been successfully added to db
        if (opts?.addMemberAsAdmin) {
          const filterUser = {
            _id: { $in: opts.ids },
          };
          const updateUser = {
            $set: {
              isAdmin: opts.addMemberAsAdmin,
            },
          };
          // 2 Update user admin status in DB
          try {
            await User.findOneAndUpdate(filterUser, updateUser, { new: true, strict: true, runValidators: true });
            // 1.a User admin status updated in DB
            return resolve(res);
          } catch (error) {
            logger.error(errUser, 'ERROR_DB_UPDATE_USER');
            return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FIND_USER' });
          }
        } else {
          resolve(res);
        }
      } else {
        logger.error('RESULT_EMPTY_WITH_APPLIED_FILTER_IN_GROUP');
        return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE' });
      }
    } catch (error) {
      logger.error(err, 'ERROR_IN_GROUP_FIND_AND_UPDATE');
      return reject({
        message: 'Internal Server Error', code: 500, error: 'ERROR_IN_GROUP_FIND_AND_UPDATE', err,
      });
    }
  });
}

/**
 * Adds given user to a group.
 * ADMIN LEVEL
 *
 * @method addUserToScopeGroup
 *
 * @param {Object} opts The request options.
 * @param {string} opts.gid The Group Id of requested group.
 * @param {string} opts.id The id of the user to add to the group.
 * @param {Boolean} opts.addMemberAsAdmin Whether to add member as a admin or not in users DB.
 * @returns {Promise}
 */
function addUserToScopeGroup(opts) {
  return new Promise(async (resolve, reject) => {
    // 1 Add member to group in DB
    const filter = {
      _id: opts.gid,
    };
    const memberData = {
      _id: opts.id,
    };
    const update = {
      $addToSet: {
        members: memberData,
      },
    };
    try {
      const res = await Group.findOneAndUpdate(filter, update, { new: true, strict: true, runValidators: true }).lean();
      if (opts.addMemberAsAdmin) {
        const filterUser = {
          _id: opts.id,
        };
        const updateUser = {
          $set: {
            isAdmin: opts.addMemberAsAdmin,
          },
        };
        // 2 Update user admin status in DB
        try {
          await User.findOneAndUpdate(filterUser, updateUser, { new: true, strict: true, runValidators: true }).lean();
          return resolve(res);
        } catch (error) {
          // 2.a User admin status not updated in DB
          logger.error(errUser, 'ERROR_DB_UPDATE_USER');
          return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FIND_USER' });
        }
      } else {
        return resolve(res);
      }
    } catch (err) {
      logger.error(err, 'ERROR_DB_UPDATE');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE' });
    }
  });
}

/**
 * Adds given user to a guest group.
 * ADMIN LEVEL
 *
 * @method addUserToGuestGroup
 * @description JnJ Gitlab guest group has guest access to all projects.
 * * All JnJ Employees will have read-only access to projects.
 * * Non-JnJ Employees will only have access to projects they lead or collaborate on.
 *
 * @param {Object} opts The request options.
 * @param {string} opts.wWID The wWID of the user to add to the group.
 * @returns {Promise.<{ code: number, message: string }>}
 */
function addUserToGuestGroup(opts) {
  return new Promise(async (resolve, reject) => {
    // 1. Find JnJ Guest group
    try {
      const group = await Group.findOne({ name: GROUPS.GUEST }).lean();
      if (group && group.gitlabId && group.alfrescoId) {
        const { gitlabId, alfrescoId } = group;
        const user = await User.findOne({ wWID: opts.wWID }).populate('wWID', 'organizationalUnit').lean();
        const organizationalUnit = user && user.wWID && user.wWID._doc && user.wWID._doc.organizationalUnit;
        // 2.a Check user organizationalUnit to verify if the user is JnJ Employee.
        if (organizationalUnit === LDAP.ORGANIZATIONAL_UNIT.EMPLOYEES) {
          // 3. Add user to Gitlab guest group.
          addUsersToGitlabGroup(gitlabId, [user.username], GITLAB.ACCESS_LEVEL.GUEST).then(() => {
            // 3.a User successfully added to Gitlab Guest Group
            // 4. Add user to Alfresco guest group.
            const groupDetails = { gid: group._id, id: user._id };
            addUserToScopeGroup(groupDetails).then(() => {
              // 5.a User added to scope guest group.
              resolve({ message: 'User added to Guest group', code: 201 });
            }).catch((dbErr) => {
              // 5.b Failed to add user to scope guest group.
              reject(dbErr);
            });
            // addUsersToAlfrescoGroup(alfrescoId, [user.username], constants.ALFRESCO.MEMBER_TYPE.PERSON).then(() => {
            //   // 4.a User added to alfresco group.
            //   
            //   // 5. Add user to scope group.
              
            // }).catch((aErr) => {
            //   // 4.b Failed to add user to Alfresco Guest group
            //   logger.error('ERROR_ADD_MEMBER_ALFRESCO_GUEST_GROUP', gErr);
            //   reject(aErr);
            // });
          }).catch((gErr) => {
            logger.error('ERROR_ADD_MEMBER_GITLAB_GUEST_GROUP', gErr);
            // 3.b Failed to add user to Guest group
            reject(gErr);
          });
        } else {
          // 2.b Failed: User is Non-JnJ Employee.
          reject({ message: 'Invalid user scope.', code: 403, error: 'ERROR_GUEST_GROUP_USER_PERMISSION' });
        }
      } else {
        // 1.b Failed: Gitlab groupId is not linked with scope guest group.
        logger.error('ERROR_FIND_GUEST_GROUP');
        reject({ message: 'Failed to fetch guest group details.', code: 404, error: 'ERROR_FIND_GUEST_GROUP' });
      }
    } catch (error) {
      logger.error('ERROR_FIND_GUEST_GROUP', error);
      return reject({ message: 'Internal Server Error', code: 500, error });
    }
    Group.findOne({ name: GROUPS.GUEST }).then((group) => {
      // 1.a Check if gitlab groupId is linked with the group.
      if (group && group.gitlabId && group.alfrescoId) {
        const { gitlabId, alfrescoId } = group;
        // 2. Find user by wWID
        User.findOne({ wWID: opts.wWID }).populate('wWID', 'organizationalUnit').then((user) => {
          const organizationalUnit = user && user.wWID && user.wWID._doc && user.wWID._doc.organizationalUnit;
          // 2.a Check user organizationalUnit to verify if the user is JnJ Employee.
          if (organizationalUnit === LDAP.ORGANIZATIONAL_UNIT.EMPLOYEES) {
            // 3. Add user to Gitlab guest group.
            addUsersToGitlabGroup(gitlabId, [user.username], GITLAB.ACCESS_LEVEL.GUEST).then(() => {
              // 3.a User successfully added to Gitlab Guest Group
              // 4. Add user to Alfresco guest group.
              const groupDetails = { gid: group._id, id: user._id };
                // 5. Add user to scope group.
                addUserToScopeGroup(groupDetails).then(() => {
                  // 5.a User added to scope guest group.
                  resolve({ message: 'User added to Guest group', code: 201 });
                }).catch((dbErr) => {
                  // 5.b Failed to add user to scope guest group.
                  reject(dbErr);
                });
              // addUsersToAlfrescoGroup(alfrescoId, [user.username], constants.ALFRESCO.MEMBER_TYPE.PERSON).then(() => {
              //   // 4.a User added to alfresco group.
              // }).catch((aErr) => {
              //   // 4.b Failed to add user to Alfresco Guest group
              //   logger.error('ERROR_ADD_MEMBER_ALFRESCO_GUEST_GROUP', gErr);
              //   reject(aErr);
              // });
            }).catch((gErr) => {
              logger.error('ERROR_ADD_MEMBER_GITLAB_GUEST_GROUP', gErr);
              // 3.b Failed to add user to Guest group
              reject(gErr);
            });
          } else {
            // 2.b Failed: User is Non-JnJ Employee.
            reject({ message: 'Invalid user scope.', code: 403, error: 'ERROR_GUEST_GROUP_USER_PERMISSION' });
          }
        }).catch((jError) => {
          logger.error('ERROR_GUEST_GROUP', jError);
          reject({ message: 'Failed to fetch user details.', code: 404, error: 'ERROR_GUEST_GROUP' });
        });
      } else {
        // 1.b Failed: Gitlab groupId is not linked with scope guest group.
        logger.error('ERROR_FIND_GUEST_GROUP');
        reject({ message: 'Failed to fetch guest group details.', code: 404, error: 'ERROR_FIND_GUEST_GROUP' });
      }
    }).catch((error) => {
      // 1.b Failed to find group

    });
  });
}

/**
 * Adds given user to admin group.
 * ADMIN LEVEL
 *
 * @method addUserToScopeAdminGroup
 *
 * @param {Object} opts The request options.
 * @param {string} opts.gid The Group Id of requested group.
 * @param {string} opts.id The id of the user to add to the group.
 * @param {Boolean} [opts.addTeamMembers] Whether to add current user and their direct reports as a admin or not in users DB.
 * @param {Boolean} [opts.addMemberAsAdmin] Whether to add member as a admin or not in users DB.
 * @returns {Promise}
 */
function addUserToScopeAdminGroup(opts) {
  return new Promise(async (resolve, reject) => {
    // 1.a Add current user and directReports to admin group
    if (opts.addTeamMembers) {
      // 2 Get directReports of current user.
      jiraProjectServices.getAllDirectReportsDetails([opts.id], true).then((dReports) => {
        const directReports = [];
        // 2.a Concat users with directReport details with current user data.
        if (dReports && Array.isArray(dReports) && dReports.length) {
          Array.prototype.push.apply(directReports, dReports);
        }
        const emails = directReports.map((user) => { return user.email; });
        // 2.b Get user's details with _id
        getScopeUserDetails(emails).then((uRes) => {
          if (uRes && uRes.length) {
            const ids = uRes.map((user) => { return user._id; });
            const groupDetails = { ids, ...opts };
            delete groupDetails.id;
            addUsersToScopeGroup(groupDetails).then((dbRes) => { return resolve(dbRes); })
              .catch((dbErr) => { return reject(dbErr); });
          } else {
            return reject({ message: 'User not found', code: 404, error: 'ERROR_DB_FIND_USER' });
          }
        });
      });
    } else {
      // 1.b Add current user to admin group
      const filterUser = {
        wWID: opts.id,
      };
      try {
        const res = await User.findOne(filterUser).lean();
        if (res) {
          const groupDetails = { ...opts, id: res._id };
          addUserToScopeGroup(groupDetails).then((dbRes) => { 
            return resolve(dbRes);
          }).catch((dbErr) => { return reject(dbErr); });
        }
      } catch (error) {
        // 2.a User admin status not updated in DB
        logger.error(errUser, 'ERROR_IN_FINDING_USER');
        reject({ message: 'User not found', code: 404, error: 'ERROR_IN_FINDING_USER' });
      }
    }
  });
}

/**
 * Removes given user from a group.
 * ADMIN LEVEL
 *
 * @method removeUserFromGroup
 *
 * @param {Object} opts The request options.
 * @param {string} opts.gid The Group ID of requested group.
 * @param {string} opts.uid The User ID of the user to remove from the group.
 * @param {String} opts.removeMemberAsAdmin Whether to remove member
 *  as a admin or not in users DB.
 * @returns {Promise}
 */
function removeUserFromGroup(opts) {
  return new Promise(async (resolve, reject) => {
    // 1 Remove group member from DB
    const filter = {
      _id: opts.gid,
    };
    const update = {
      $pull: {
        members: {
          _id: opts.uid,
        },
      },
    };
    try {
      const res = await Group.findOneAndUpdate(filter, update, { new: true, strict: true, runValidators: true }).lean();
      if (res) {
        // 1.b Removal of group member has been successfully done from DB
        if (opts.removeMemberAsAdmin === 'true') {
          const filterUser = {
            _id: opts.uid,
          };
          const updateUser = {
            $set: {
              isAdmin: false,
            },
          };
          // 2 Update user admin status in DB
          try {
            await User.findOneAndUpdate(filterUser, updateUser, { new: true, strict: true, runValidators: true }).lean();
            resolve(res);
          } catch (error) {
            // 2.a User admin status not updated in DB
            logger.error(errUser, 'ERROR_DB_UPDATE_USER');
            reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FIND_USER' });
          }
        } else {
          resolve(res);
        }
        // 2 Remove user from Gitlab group
        if (res.gitlabId) {
          const filterUser = {
            _id: opts.uid,
          };
          try {
            const resUser = await User.findOne(filterUser).lean();
            removeUserFromGitlabGroup(res.gitlabId, [resUser.username], res).then((gRes) => {
              resolve(gRes);
            });
          } catch (error) {
            // 2.a User admin status not updated in DB
            logger.error(errUser, 'ERROR_DB_UPDATE_USER');
            reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FIND_USER' });
          }
        }
      } else {
        resolve(res);
      }
    } catch (error) {
      // 1.a Removal of group member from DB failed
      logger.error(err, 'ERROR_DB_REMOVE_MEMBER');
      reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_REMOVE_MEMBER' });
    }
  });
}

/**
 * Get recurring members based upon pagination.
 * User of this resource is required to have sysadmin or admin permissions.
 *
 * @method getRecurringMembers
 * @param {Object} opts The request options sent to the Jira API
 * @param {Object} opts.auth The jira auth details of the requesting user
 * @param {String} opts.groupName A name of requested group.
 * @param {Boolean} opts.includeInactiveUsers inactive users will be included in the response if
 * set to true. Default false.
 * @param {Number} opts.startAt the index of the first user in group to return (0 based).
 * @param {Number} opts.maxResults the maximum number of users to return (max 50).
 * @param [callback] Called when the members of group have been retrieved.
 */
function getRecurringMembers(opts) {
  return new Promise((resolve, reject) => {
    // TODO replace gclient with jiraClient.group once pull request gets approved
    const jiraClient = getJiraClient(opts.auth);
    const gClient = new GroupClient(jiraClient);
    gClient.getMembers(opts).then((res) => {
      resolve(res);
    }, (err) => {
      reject(err);
    });
  });
}

/**
 * Get all members of groups.
 * User of this resource is required to have sysadmin or admin permissions.
 *
 * @method getAllMembers
 * @param {Object} opts The request options sent to the Jira API
 * @param {Object} opts.auth The jira auth details of the requesting user
 * @param {String} opts.groupName A name of requested group.
 * @param {Boolean} opts.includeInactiveUsers inactive users will be included in the response if
 * set to true. Default false.
 * @param {Number} opts.startAt the index of the first user in group to return (0 based).
 * @param {Number} opts.maxResults the maximum number of users to return (max 50).
 * @param [callback] Called when the all the members of group have been retrieved.
 */
function getAllMembers(opts) {
  const finalRes = {};
  return getRecurringMembers(opts)
    .then((res) => {
      Object.assign(finalRes, res);
      if (!res.isLast) {
        const data = opts;
        data.startAt = res.startAt + res.values.length;
        return getAllMembers(data)
          .then((nextRes) => {
            const gData = nextRes;
            const gDataValues = gData.values;
            delete gData.values;
            Object.assign(finalRes, gData);
            Array.prototype.push.apply(finalRes.values, gDataValues);
            return finalRes;
          }, (err) => {
            return err;
          });
      }
      return finalRes;
    }, (err) => {
      return err;
    });
}

/**
 * This resource returns a paginated list of users who are members of the specified group
 * and its subgroups. Users in the page are ordered by user names.
 * User of this resource is required to have sysadmin or admin permissions.
 *
 * @method getMembers
 * @param {Object} opts The request options
 * @param {String} opts.gid A Group ID of requested group.
 * @param {string} opts.query A query string used to search username, name or e-mail address
 * @param {number} [opts.page] The current page of the group members table
 * @param {number} [opts.perPage] The documents per page to return
 * @return {Promise} Resolved when the group members are retrieved.
 */
function getMembers(opts) {
  return new Promise(async (resolve, reject) => {
    const filter = {
      $or:
        [
          { 'members.username': { $regex: opts.query, $options: 'i' } },
          { 'members.email': { $regex: opts.query, $options: 'i' } },
          { 'members.name': { $regex: opts.query, $options: 'i' } },
        ],
    };
    try {
      const dbRes = await Group.aggregate([
        // {$sort: {...}}
        { $match: { _id: new mongoose.Types.ObjectId(opts.gid) } },
        {
          $lookup:
          {
            from: 'users',
            localField: 'members._id',
            foreignField: '_id',
            as: 'members',
          },
        },
        { $unwind: '$members' },
        { $match: filter },
        {
          $facet: {
            stage1: [{ $group: { _id: '$_id', count: { $sum: 1 } } }],
            stage2: [
              { $skip: opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0 },
              { $limit: opts.perPage },
            ],
          },
        },
        // output projection
        {
          $project: {
            count: '$stage1.count',
            membersData: '$stage2',
          },
        },
      ]);
      return resolve(dbRes);
    } catch (dbErr) {
      logger.error(dbErr, 'ERROR_DB_FIND_GROUP_MEMBERS');
      return reject(dbErr);
    }
  });
}

/**
 * Returns a list of users and groups matching query with highlighting
 *
 * @method findUsersAndGroups
 * @memberOf GroupUserPickerClient#
 * @param {Object} opts The request options
 * @param {String} opts.query A string used to search username, Name or e-mail address
 * @param [callback] Called when the users and groups are retrieved.
 * @return {Promise} Resolved when the users and groups are retrieved.
 */
function findUsersAndGroups(opts) {
  return new Promise(async (resolve, reject) => {
    const userFilter = {
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
    const groupFilter = {
      $and: [
        { name: { $regex: opts.query, $options: 'i' } },
        { name: { $ne: GROUPS.GUEST } },
      ],
    };
    // 1 Find users baaed upon query
    try {
      const users = await User.find(userFilter).lean();
      const groups = await Group.find(groupFilter).lean();
      resolve({
        groups,
        users,
      });
    } catch (uErr) {
      // 1.a If error, reject with error
      logger.error(uErr, 'ERROR_DB_FIND_USERS');
      reject(handleError(uErr, 'Error in fetching user data'));
    }
  });
}

function searchGroup(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const rData = await Group.find({ name: new RegExp(opts.searchElement, 'i') }).lean();
      return resolve(rData);
    } catch (error) {
      logger.error('ERROR_IN_SEARCH_GROUP', error);
      reject({ message: 'Failed to fetch group data', error });
    }
  });
}

async function groupsByUserID(userId) {
  try {
    const groups = await Group.find(
      { "members._id": userId },
      { name: 1, _id: 0 }
    ).lean();

    const defaultGroups = Object.values(GROUPS);

    const groupNames = (groups || [])
      .map(group => group.name?.replace('_LEADS', ''))
      .filter(name => name && !defaultGroups.includes(name));

    return groupNames;

  } catch (error) {
    logger.error('ERROR_IN_FINDING_USER_BY_ID', error);
    throw new Error('Failed to fetch groups list');
  }
}

export const jiraGroupServices = {
  createGroup,
  createScopeGroup,
  findGroup,
  findGroups,
  removeGroup,
  addUserToGroup,
  addUserToScopeGroup,
  removeUserFromGroup,
  getAllMembers,
  getMembers,
  findUsersAndGroups,
  addUserToScopeAdminGroup,
  addUsersToGitlabGroup,
  addUserToGuestGroup,
  searchGroup,
  groupsByUserID,
};
