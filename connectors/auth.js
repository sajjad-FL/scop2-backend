import _ from 'lodash';
import config from '../config/default.js';
import { LDAPConfig } from './ldap.js';
import { logger } from '../utils/logger.js';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.js';
import { CONSTANTS } from '../utils/constants.js';
import { jiraGroupServices } from '../services-bak/jira/group.js';
import { jiraUserServices } from '../services-bak/jira/users.js';

const { DEFAULT_USERS, LDAP, GROUPS } = CONSTANTS;

// --- Helper functions --- //
/**
 * Synchronously creates a JWT token and returns it
 * @author Aniket
 * @param {Object} user The user object we get from our DB
 * @return {String}
 */
function createToken(user) {
  const payload = _.pick(user, ['_id', 'email', 'username', 'name', 'isEnabled', 'isAdmin', 'isSuperAdmin', 'wWID']);
  const token = jwt.sign(payload, config.JWTConfig.secret);
  return token;
}

/**
 * Saves the user to DB from Graph API data
 * @author Aniket
 * @param {Object} graphUser User details from Microsoft Graph API
 * @returns {Promise}
 */
function saveUserToDB(graphUser) {
  return new Promise(async (resolve, reject) => {
    const doc = {
      email: graphUser.mail.toLowerCase(),
      name: graphUser.fullName ? graphUser.fullName : graphUser.givenName,
      username: graphUser.jnjMSUserName.toLowerCase(),
      meta: {
        graph: graphUser, // Store Graph API data
      },
      wWID: graphUser.cn,
    };
    try {
      const instance = new User(doc);
      const newUser = await instance.save();
      if (graphUser.organizationalUnit === LDAP.ORGANIZATIONAL_UNIT.EMPLOYEES) {
        jiraGroupServices.addUserToGuestGroup({ wWID: doc.wWID }).then(() => {
          return resolve(newUser);
        }).catch(() => {
          return resolve(newUser);
        });
      } else {
        return resolve(newUser);
      }
    } catch (saveErr) {
      logger.error(saveErr, 'ERROR_DB_SAVE');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_SAVE' });
    }
  });
}

function defaultJnJUser(ldapUser, isSDSEmployee) {
  let username;
  username = ldapUser?.jnjMSUserName.toLowerCase();
  const jnjUser = {
    username,
    name: ldapUser?.fullName,
    email: ldapUser?.mail.toLowerCase(),
    wWID: ldapUser?.cn,
    isSDSEmployee,
    isAdmin: false,
    isSuperAdmin: false,
    isRequestAdmin: false,
    isScopeUser: false,
  };
  const payload = {
    username, name: jnjUser.name, email: jnjUser.email, wWID: jnjUser.wWID, permissions: ['project-request'],
  };
  jnjUser.requestToken = jwt.sign(payload, config.JWTConfig.secret);
  return jnjUser;
}

/**
 * Class for Authenticating a user.
 * @class
 * @constructor
 */
class Auth {
  constructor(username, password) {
    this.username = username;
    this.password = password;
  }

  /**
   * Checks for existence of user in LDAP and authenticates the user
   * Please refer to the login protocol document for the workflow
   * @returns {Promise}
   */
  getUserFromLDAP() {
    return new Promise((resolve, reject) => {
      const defaultUsers = [process.env.JIRA_ADMIN, process.env.SCOPE_USER, process.env.REQUEST_ADMIN, process.env.REQUESTER, process.env.DTR_ADMIN];
      if (defaultUsers.includes(this.username)) {
        User.findOne({ username:this.username, isEnabled: true }).then((user) => {
          const scopedefaultUser = {
            jnjMSUserName:user?.username,
            fullName: user?.name,
            mail: user?.email.toLowerCase(),
          };
          resolve(scopedefaultUser);
        })
       
      } else {
        // 1. Check if the user exists in LDAP or not.
      // We need to check before because we need the field "cn" from the response
        LDAPConfig.findUser(this.username).then((ldapUser) => {
          if (ldapUser) {
            // 1.a If user is found, try authenticating him with LDAP
            resolve(ldapUser);
          } else {
          // 1.b Otherwise user is not found. Reject with message
            reject({ message: 'User not found', code: 404 });
          }
        }, (findErr) => {
          reject(findErr);
        });
      }
    });
  }

  validate() {
    return new Promise((resolve, reject) => {
      try {
        // 1. Get user details from LDAP
        this.getUserFromLDAP().then((ldapUser) => {
          let username;
          username = ldapUser?.jnjMSUserName.toLowerCase();
          jiraUserServices.getJjedsData(ldapUser.cn).then((res) => {
            if (res) {
              // 2. Check If jjeds details are available then consider user to be SDS Employee
              const isDefaultUser = [process.env.SCOPE_USER, process.env.REQUEST_ADMIN].includes(username);
              const isSDSEmployee = !!(Array.isArray(res) && res.length) || isDefaultUser;
              // 1.a Check user is part of Scope
              User.findOne({ username, isEnabled: true }).then((user) => {
                if (user) {
                  const isScopeUser = username !== DEFAULT_USERS.REQUESTER.USERNAME;
                  // 1.b User is part of Scope
                  const scopeUser = {
                    username,
                    name: user.name,
                    email: user.email,
                    wWID: user.wWID,
                    isSDSEmployee,
                    isAdmin: false,
                    isSuperAdmin: false,
                    isRequestAdmin: false,
                    isScopeUser,
                  };
                  if (!isScopeUser) {
                    const payload = {
                      username, name: user.name, email: user.email, wWID: user.wWID, permissions: ['project-request'],
                    };
                    scopeUser.requestToken = jwt.sign(payload, config.JWTConfig.secret);
                  }
                  resolve(scopeUser);
                }
                // 1.c User is not part of Scope
                const jnjUser = defaultJnJUser(ldapUser, isSDSEmployee);
                resolve(jnjUser);
              }).catch(() => {
                // 1.a User is not part of Scope
                const jnjUser = defaultJnJUser(ldapUser, isSDSEmployee);
                resolve(jnjUser);
              });
            }
          }).catch(() => {
            const jnjUser = defaultJnJUser(ldapUser, false);
            resolve(jnjUser);
          });
        }).catch((err) => {
          // 2. Failed to get user details from LDAP
          reject(err);
        });
      } catch (error) {
        // 3. Failed to fetch user details
        reject(error);
      }
    });
  }

  /**
   * Checks for existence of user in LDAP and authenticates the user
   * Please refer to the login protocol document for the workflow
   * @author Aniket
   * @returns {Promise}
   */
  loginLDAP() {
    return new Promise((resolve, reject) => {
      const { username, password } = this;
      const adminUsers = [
        { envUser: 'JIRA_ADMIN', envPass: 'JIRA_ADMIN_PASS' },
        { envUser: 'SCOPE_USER', envPass: 'SCOPE_USER_PASS' },
        { envUser: 'REQUEST_ADMIN', envPass: 'REQUEST_ADMIN_PASS' },
        { envUser: 'DTR_ADMIN', envPass: 'DTR_ADMIN_PASS' }
      ];
  
      // 1. Check if the username matches any admin user
      const matchedAdmin = adminUsers.find(
        (admin) => username === process.env[admin.envUser]
      );
  
      if (matchedAdmin) {
        // 1.a If username matches, check if the password is correct
        if (password === process.env[matchedAdmin.envPass]) {
          // 1.a.i If password is correct, retrieve user details from database
          User.findOne({ username, isEnabled: true }).then((user) => {
            const scopedefaultUser = {
              jnjMSUserName: user?.username,
              fullName: user?.name,
              mail: user?.email.toLowerCase(),
            };
            // 1.a.ii Resolve with scopedefaultUser details
            resolve(scopedefaultUser);
          }).catch((err) => reject(err)); // 1.a.iii If error in fetching user, reject with error
        } else {
          // 1.b If password is incorrect, reject with error message
          reject({ message: 'Incorrect password', code: 400 });
        }
      } else {
        // 1. Check if the user exists in LDAP or not.
        // We need to check before because we need the field "cn" from the response
        LDAPConfig.findUser(username).then((ldapUser) => {
          if (ldapUser) {
            // 1.a If user is found, try authenticating him with LDAP
            // 2. Authenticating the user with LDAP
            LDAPConfig.authenticate(ldapUser.cn, password).then(() => {
              // 2.a Authenticated successfully, return user details
              resolve(ldapUser);
            }, (authErr) => {
              // 2.b Error in LDAP Authentication
              reject(authErr);
            });
          } else {
            // 1.b Otherwise user is not found. Reject with message
            reject({ message: 'User not found', code: 404 });
          }
        }, (findErr) => {
          // 1.c Error in finding user in LDAP
          reject(findErr);
        });
      }
    });
  }
  

  /**
   * Finds if a user exists or not in our db. If not present, then saves it to DB
   * @author Aniket
   * @param {Object} userData User data from Graph API or LDAP
   * @param {Boolean} shouldCreateUser Whether to create user if not found
   * @returns {Promise}
   */
  static checkUserAndSave(userData, shouldCreateUser = false) {
    return new Promise(async (resolve, reject) => {
      // 1. Check if user exists in our DB or not
      const filter = {
        username: userData.jnjMSUserName.toLowerCase(),
      };
      try {
        const user = await User.findOne(filter).lean();
        if (user) {
          // 1.b. User found, resolve user
          jiraUserServices.getJjedsData(user.wWID).then((res) => {
            if (res) {
              // 2. Check If jjeds details are available then consider user to be SDS Employee
              const isDefaultUser = [process.env.SCOPE_USER, process.env.REQUEST_ADMIN].includes(user.username);
              const isSDSEmployee = !!(Array.isArray(res) && res.length) || isDefaultUser;
              const userDetails = JSON.parse(JSON.stringify(user));
              jiraUserServices.findMemberInGroupByGroupName(GROUPS.REQUEST_ADMIN, userDetails._id).then(async(response) => {
                const dtrRes = await jiraUserServices.findMemberInGroupByGroupName(GROUPS.DTR_ADMIN, userDetails._id);
                return resolve({
                  isNew: false,
                  user,
                  isSDSEmployee,
                  isRequestAdmin: !!response,
                  isDTRAdmin: !!dtrRes,
                  directReports: res,
                });
              }).catch((error) => {
                reject(error);
              });
            }
          }, (err) => {
            reject(err);
          });
        } else if (shouldCreateUser) {
          try {
            const nRes = await jiraUserServices.getJjedsData(userData.cn);
            let username;
            username = userData.jnjMSUserName.toLowerCase();
            const isDefaultUser = [process.env.SCOPE_USER, process.env.REQUEST_ADMIN, process.env.DTR_ADMIN].includes(username);
            const isSDSEmployee = !!(nRes && Array.isArray(nRes) && nRes.length) || isDefaultUser;
            // Save user to MongoDB (from Graph API or LDAP)
            saveUserToDB(userData).then((newUser) => {
              const userDetails = JSON.parse(JSON.stringify(newUser));
              jiraUserServices.findMemberInGroupByGroupName(GROUPS.REQUEST_ADMIN, userDetails._id).then(async(response) => {
               const dtrRes = await jiraUserServices.findMemberInGroupByGroupName(GROUPS.DTR_ADMIN, userDetails._id);
                resolve({
                  isNew: true,
                  user: newUser,
                  isSDSEmployee,
                  isRequestAdmin: !!response,
                  isDTRAdmin: !!dtrRes,
                  directReports: nRes,
                });
              }).catch((error) => {
                logger.error(error, 'ERROR_FIND_GROUP');
                reject(error);
              });
            });
          } catch (nErr) {
            logger.error(nErr, 'ERROR_FETCH_JJEDS_DETAILS');
            return reject(nErr);
          }
        } else {
          return reject({
            code: 400,
            message: 'User not found. Please click the Request Access button to proceed.',
            error: 'USER_NOT_FOUND_TO_GET_ACCESS',
          });
        }
      } catch (findErr) {
        logger.error(findErr, 'ERROR_DB_FINDUSER');
        return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FINDUSER' });
      }
    });
  }

  /**
   * Authenticates the user. On success, returns a token, user object and status code
   */
  login() {
    return new Promise((resolve, reject) => {
      this.loginLDAP().then((ldapUser) => {
        Auth.checkUserAndSave(ldapUser).then(async (response) => {
          if ((!response.isNew) && (!response.user.isEnabled)) {
            reject({ message: 'This account has been disabled', code: 400 });
          } else {
            // create token and send
            try {
              const user = response.user;
              const token = createToken(user);
              if (response.directReports && response.directReports.length) {
                const [{ _doc: jJEDData }] = response.directReports;
                user.organizationalUnit = jJEDData && jJEDData.organizationalUnit;
              }
              const groupDepartmentLeads = await jiraGroupServices.groupsByUserID(response?.user?._id);
              user.groupDepartmentLeads = groupDepartmentLeads || [];
              user.isSDSEmployee = response?.isSDSEmployee || user.isAdmin || user.isSuperAdmin;
              user.isRequestAdmin = response?.isRequestAdmin;
              user.isDTRAdmin = response?.isDTRAdmin;
              user.isScopeUser = true;
              // Get the user's department leads
              user.isSBOLead = groupDepartmentLeads.includes("SBO") ? true : false;
              return resolve({
                token,
                user,
                code: 200,
                directReports: response?.directReports?.length > 0 ?
                  response?.directReports[0]?.directReports : [],
              });
            } catch (error) {
              reject({ message: 'Internal server error', code: 500 });
            }
          }
        }).catch(async (err) => {
          // User not found in Scope DB - allow limited access for requests-only
          if (err.error === 'USER_NOT_FOUND_TO_GET_ACCESS') {
            try {
              const jjedsData = await jiraUserServices.getJjedsData(ldapUser.cn);
              const isSDSEmployee = !!(jjedsData && Array.isArray(jjedsData) && jjedsData.length);
              const nonScopeUser = defaultJnJUser(ldapUser, isSDSEmployee);
              return resolve({
                token: nonScopeUser.requestToken,
                user: nonScopeUser,
                code: 200,
                directReports: jjedsData?.length > 0 ? jjedsData[0]?.directReports : [],
              });
            } catch (jjedsErr) {
              const nonScopeUser = defaultJnJUser(ldapUser, false);
              return resolve({
                token: nonScopeUser.requestToken,
                user: nonScopeUser,
                code: 200,
                directReports: [],
              });
            }
          }
          reject(err);
        });
      }, (ldapErr) => {
        reject(ldapErr);
      });
    });
  }
}

export default Auth;
