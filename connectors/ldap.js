import ActiveDirectory from 'activedirectory';
import { logger } from './../utils/logger.js';
import config from '../config/default.js';

class LDAP {
  constructor() {
    this.config = config.ldap;
    this.ad = ActiveDirectory(this.config);
  }

  findUser(username) {
    return new Promise((resolve, reject) => {
      const searchUser = (ou) => {
        return new Promise((resolve, reject) => {
          this.ad.findUser(
            {
              baseDN: ou,
              filter: `(|(jnjMSUserName=${username})(mail=${username})(cn=${username}))`,
              attributes: [
                'cn',
                'mail',
                'sn',
                'givenName',
                'fullName',
                'jnjMSUserName',
                'preferredName',
                'employeeType',
                'jnjRelationship'
              ],
            },
            ou,
            (err, user) => {
              if (err) {
                // If there is an error in finding the user, log and reject
                logger.error(err, 'ERROR_LDAP_FINDUSER');
                reject({
                  message: 'Error searching in LDAP',
                  code: 400,
                  error: 'ERROR_LDAP_FINDUSER',
                });
              } else {
                resolve(user || null); // Resolve with user or null if not found
              }
            }
          );
        });
      };
  
      // First, search in this.config.ou
      searchUser(this.config.ou)
        .then((user) => {
          if (user) {
            resolve(user);
          } else {
            // If user not found, search in this.config.service_ou
            return searchUser(this.config.service_ou);
          }
        })
        .then((user) => {
          if (user) {
            resolve(user);
          } else {
            reject({
              message: 'User not found in LDAP',
              code: 404,
              error: 'ERROR_LDAP_FINDUSER',
            });
          }
        })
        .catch(reject);
    });
  }
  

  /**
   * DEPRECATED
   * USE server.methods.ldap.users.findUsers instead
   * Perform a generic search for users that match the specified filter.
   * @param {Object} filters Filters
   * @param {String} filters.username search by username
   * @param {String} filters.firstName search by first name
   * @param {String} filters.lastName search by last name
   * @param {String} filters.email search by email
   * @return {Promise<Users|Error>}
   */
  findUsers(filters) {
    return new Promise((resolve, reject) => {
      /**
       * sn - surname
       * givenName - first name
       * cn - common name - givenName + sn,
       * mail - email address
       */
      this.ad.findUsers(
        {
          baseDN: this.config.ou,
          filter: `(|(mail=${filters.email})(cn=${filters.username}))`,
        },
        false,
        (err, users) => {
          if (err) {
            // If there is an error in finding the user, log and reject
            logger.error(err, 'ERROR_LDAP_FINDUSERS');
            reject({
              message: 'No results found',
              code: 400,
              error: 'ERROR_LDAP_FINDUSERS',
            });
          } else if (users) {
            resolve(users);
          } else {
            reject({
              message: 'No results found',
              code: 404,
              error: 'ERROR_LDAP_FINDUSERS',
            });
          }
        },
      );
    });
  }

  /**
   * Authenticates a given user as per the Scope login protocol(See document #PMD_FLOWS_1)
   * @param {String} userid The userid. This is the cn.
   * @param {String} password password
   * @returns {Promise}
   */
  authenticate(userid, password) {
    return new Promise((resolve, reject) => {
      // Helper function to authenticate against a given `ou`
      const authenticateWithOU = (ou) => {
        const dn = `cn=${userid},${ou}`;
        return new Promise((resolve, reject) => {
          this.ad.authenticate(dn, password, (err, auth) => {
            if (err) {
              logger.error(err, `ERROR_LDAP_AUTH for DN: ${dn}`);
              if (err.name === 'InvalidCredentialsError') {
                reject({ message: 'Authentication Failed. Invalid credentials', code: 401 });
              } else {
                reject({ message: 'Authentication Failed.', code: 401 });
              }
            } else if (auth) {
              resolve(auth);
            } else {
              reject({ message: 'Authentication Failed. Wrong credentials', code: 401 });
            }
          });
        });
      };
  
      // Try authenticating with `ou` and fallback to `service_ou` if the first fails
      authenticateWithOU(this.config.ou)
        .then(resolve)
        .catch((err) => {
          if (err.code === 401) {
            logger.info('Falling back to service_ou for authentication');
            return authenticateWithOU(this.config.service_ou).then(resolve).catch(reject);
          } else {
            reject(err); // Reject other errors without fallback
          }
        });
    });
  }
  
}

export const LDAPConfig = new LDAP();
