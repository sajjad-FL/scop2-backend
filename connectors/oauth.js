const moment = require('moment');
const LDAP = require('./ldap');
const logger = require('./../utils/logger');
const User = require('./../models/user');
const Client = require('./../models/client');
const encipherment = require('./../utils/encipherment');

// --- Helper functions --- //

/**
 * Updates the client with user details in DB
 * @author Aniket
 * @param {Object} _id The user id
 * @param {String} clientId The client id
 * @param {String} code the client code
 * @returns {Promise}
 */
function updateClientDetails(_id, clientId, code) {
  return new Promise((resolve, reject) => {
    let filter;
    let update;
    // 1 Checks if user has requested for authentication before or not ?
    Client.findOne({
      clientId,
      'userDetails._id': _id,
    }, {
      'userDetails.$': 1,
    }, (cErr, cData) => {
      if (cErr) {
        // 1.a If error, reject with error
        logger.error(cErr, 'ERROR_DB_UPDATE_CLIENT');
        reject({
          message: 'Internal Server Error',
          code: 500,
          error: 'ERROR_DB_UPDATE_CLIENT',
        });
      } if (cData) {
        // 1.b If yes, update client db and replace user details with new one
        filter = {
          clientId,
          'userDetails._id': _id,
        };
        update = {
          $set: {
            'userDetails.$.code': code,
            'userDetails.$.codeExpiry': moment().utc().add(60, 'seconds')._d,
            'userDetails.$.isCodeUsed': false,
            'userDetails.$.authenticatedAt': moment().utc().toDate(),
          },
        };
        global.services.db.oauthServices.updateClientDB(filter, update).then((dbRes) => {
          if (dbRes) {
            resolve(dbRes);
          }
        }, (dbErr) => {
          reject(dbErr);
        });
      } else {
        // 1.c If no, update client db and push user details into that
        const userData = {
          _id,
          code,
          codeExpiry: moment().utc().add(60, 'seconds')._d,
          authenticatedAt: moment().utc().toDate(),
        };
        filter = {
          clientId,
        };
        update = {
          $push: {
            userDetails: userData,
          },
        };
        global.services.db.oauthServices.updateClientDB(filter, update).then((dbRes) => {
          if (dbRes) {
            resolve(dbRes);
          }
        }, (dbErr) => {
          reject(dbErr);
        });
      }
    });
  });
}

/**
 * Class for Authenticating a client user.
 * @class
 * @constructor
 */
class Oauth {
  constructor(username, password) {
    this.username = username;
    this.password = password;
  }
  /**
   * Checks for existence of user in LDAP and authenticates the user
   * Please refer to the login protocol document for the workflow
   * @author Aniket
   * @returns {Promise}
   */
  loginLDAP() {
    return new Promise((resolve, reject) => {
      if (this.username === process.env.SUPER_ADMIN) {
        if (this.password === process.env.SUPER_ADMIN_PASS) {
          const ldapUser = {
            mail: this.username,
          };
          resolve(ldapUser);
        } else {
          reject({ message: 'Incorrect password', code: 400 });
        }
      } else {
        // 1. Check if the user exists in LDAP or not.
      // We need to check before because we need the field "cn" from the response
        LDAP.findUser(this.username).then((ldapUser) => {
          if (ldapUser) {
          // 1.a If user is found, try authenticating him with LDAP
          // 2. Authenticating the user with LDAP
            LDAP.authenticate(ldapUser.cn, this.password).then(() => {
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
          reject(findErr);
        });
      }
    });
  }

  /**
   * Finds if a client user exists or not in our db.
   * and then saves it to DB
   * @author Aniket
   * @param {Object} ldapUser The response returned from loginLDAP()
   * @returns {Promise}
   */
  static checkUser(ldapUser) {
    const promise = new Promise((resolve, reject) => {
      // 1. Check if user exists in our DB or not
      const email = ldapUser.mail.toLowerCase();
      let filter;
      if (ldapUser.mail === process.env.SUPER_ADMIN) {
        filter = {
          username: ldapUser.mail,
        };
      } else {
        filter = {
          username: email.split('@')[0],
        };
      }
      User.findOne(filter, '+password', (findErr, user) => { // TODO add isDeleted filter
        if (findErr) {
          // 1.a If error, reject with error
          logger.error(findErr, 'ERROR_DB_FIND_CLIENT_USER');
          reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FIND_CLIENT_USER' });
        } else if (user) {
          // 1.b. User found, resolve user
          resolve(user);
        } else {
          // 1.c User not found in DB
          reject({ message: 'User not found', code: 404, error: 'ERROR_DB_FIND_CLIENT_USER' });
        }
      });
    });
    return promise;
  }

  /**
   * Authenticates the client user. On success, returns a url with code
   */
  login(data) {
    return new Promise((resolve, reject) => {
      this.loginLDAP().then((ldapUser) => {
        Oauth.checkUser(ldapUser).then((response) => {
          if (response) {
            const code = encipherment.encrypt(response._id.toString());
            updateClientDetails(response._id, data.client_id, code).then((updateRes) => {
              if (updateRes) {
                // 3.a Update client with user details to DB successful
                const state = data.state ? `&state=${data.state}` : '';
                const redirectUrl = `${data.redirect_uri}?${data.response_type}=${code}${state}`;
                resolve(redirectUrl);
              }
            }, (updateErr) => {
              // 3.b Update client with user details to DB failed
              reject(updateErr);
            });
          }
        }, (err) => {
          reject(err);
        });
      }, (ldapErr) => {
        reject(ldapErr);
      });
    });
  }
}

module.exports = Oauth;
