import { User } from '../models/user.js';
import { logger } from './logger.js';
import { encipherment } from './encipherment.js';
import { CONSTANTS } from './constants.js';
import { LDAPConfig } from '../connectors/ldap.js';

const { DEFAULT_USERS } = CONSTANTS;
/**
 * Create default user
 * @param {Object} user user details
 * @param {String} user.name user name
 * @param {String} user.username user unique username
 * @param {String} user.password user password
 * @param {String} user.email user email
 * @param {String} user.isAdmin user isAdmin
 * @param {String} user.isSuperAdmin user isSuperAdmin
 * @returns {Promise.<User>} user instance
 */
const createDefaultUser = (user) => {
  return new Promise(async (resolve, reject) => {
    try {
      const userExists = await User.findOne({ username: user?.username }).lean();
      if (userExists) {
        return resolve(userExists);
      } else {
        const ldapUser = await LDAPConfig.findUser(user?.email);
        if (ldapUser) {
          const doc = {
            email: user?.email,
            name: user?.name,
            username: user?.username,
            password: encipherment.encrypt(user?.password),
            isAdmin: user?.isAdmin,
            isSuperAdmin: user?.isSuperAdmin,
            meta: {
              ldap: ldapUser,
            },
            wWID: ldapUser?.cn,
          };
          // 1.a If user is found, try authenticating him with LDAP
          try {
            const instance = new User(doc);
            const userData = await instance.save();
            return resolve(userData);
          } catch (saveErr) {
            return reject(saveErr);
          }
        } else {
          return reject({ message: 'User not found', code: 404 });
        }
      }
    } catch (error) {
      return reject(error);
    }
  });
};

export const defaultUser = async () => {
  try {
    const isSuperAdminExists = await User.findOne({ username: process.env.JIRA_ADMIN }).lean()
    if (!isSuperAdminExists) {
      try {
        const doc = {
          email: 'spiotrow@its.jnj.com',
          name: 'Super Admin',
          username: process.env.JIRA_ADMIN,
          password: encipherment.encrypt(process.env.JIRA_ADMIN_PASS),
          isAdmin: true,
          isSuperAdmin: true,
        };
        const instance = new User(doc);
        await instance.save();
      } catch (uErr) {
        logger.error(uErr, 'FAILED_TO_CREATE_DEFAULT_USER');
      }
    } 
  } catch (error) {
    logger.error(error, 'ERROR_DB_SAVE');
  }
  const defaultUsers = [
    {
      name: DEFAULT_USERS.SCOPE_USER.NAME,
      username: DEFAULT_USERS.SCOPE_USER.USERNAME || process.env.SCOPE_USER,
      password: process.env.SCOPE_USER_PASS,
      email: 'spiotrow@its.jnj.com',
      isAdmin: false,
      isSuperAdmin: false,
    },
    {
      name: DEFAULT_USERS.REQUEST_ADMIN.NAME,
      username: DEFAULT_USERS.REQUEST_ADMIN.USERNAME || process.env.REQUEST_ADMIN,
      password: process.env.REQUEST_ADMIN_PASS,
      email: 'spiotrow@its.jnj.com',
      isAdmin: false,
      isSuperAdmin: false,
    },
    {
      name: DEFAULT_USERS.DTR_ADMIN.NAME,
      username: DEFAULT_USERS.DTR_ADMIN.USERNAME || process.env.DTR_ADMIN,
      password: process.env.DTR_ADMIN_PASS,
      email: 'spiotrow@its.jnj.com',
      isAdmin: false,
      isSuperAdmin: false,
    },
    {
      name: DEFAULT_USERS.REQUESTER.NAME,
      username: DEFAULT_USERS.REQUESTER.USERNAME || process.env.REQUESTER,
      password: process.env.REQUESTER_PASS,
      email: 'spiotrow@its.jnj.com',
      isAdmin: false,
      isSuperAdmin: false,
    },
  ];
  defaultUsers.forEach((user) => {
    createDefaultUser(user).then((res) => {
      logger.info(res, 'ADDED_DEFAULT_USER');
    }).catch((error) => {
      logger.error(error, 'ERROR_DB_SAVE');
    });
  });
}
