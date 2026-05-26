import { Group } from '../models/group.js';
import { User } from '../models/user.js';
import { logger } from './logger.js';
import { CONSTANTS } from '../utils/constants.js';
import { defaultUser as createDefaultUser } from './defaultUser.js';
import { jiraGroupServices } from '../services-bak/jira/group.js';

const { GROUPS, DEFAULT_USERS } = CONSTANTS;

const addUserToGroup = (data) => {
  return new Promise((resolve, reject) => {
    const opts = {
      gid: data.gid,
      id: data._id,
    };
    jiraGroupServices.addUserToScopeGroup(opts).then((gRes) => {
      logger.info(gRes, 'REQUEST_ADMIN_ADDED_TO_GROUP');
      return resolve('success');
    }).catch((gErr) => {
      logger.error(gErr, 'ERROR_ADD_REQUEST_ADMIN_TO_GROUP');
      return reject('failed');
    });
  })
};

/**
 * Add request admin to group
 * @param {Object} group group details
 * @param {String} group._id group unique id
 * @param {String} group.name group name
 * @param {Array.<Object>} group.members group members
 * @param {String} group.members._id group members user id
 */
const addUserToRequestAdminGroup = (group) => {
  return new Promise(async (resolve, reject) => {
    try {
      const userRes = await User.findOne({ username: DEFAULT_USERS.REQUEST_ADMIN.USERNAME }).lean();
      if (userRes) {
        const requestAdminExists = group.members.some((member) => member?._id.equals(userRes?._id));
        if (!requestAdminExists) {
          const opts = {
            gid: group?._id,
            _id: userRes?._id,
          };
          try {
            await addUserToGroup(opts);
          } catch (error) {
            logger.error('FAILED_TO_ADD_USER');
          }
          return resolve('success');
        }
        return resolve('success');
      } else {
        const admin = {
          name: DEFAULT_USERS.REQUEST_ADMIN.NAME,
          username: DEFAULT_USERS.REQUEST_ADMIN.USERNAME || process.env.REQUEST_ADMIN,
          password: process.env.REQUEST_ADMIN_PASS,
          email: 'spiotrow@its.jnj.com',
          isAdmin: false,
          isSuperAdmin: false,
        };
        try {
          const newUser = await createDefaultUser(admin);
          const opts = {
            gid: group._id,
            _id: newUser?._id,
          };
          try {
            await addUserToGroup(opts);
          } catch (error) {
            logger.error('FAILED_TO_ADD_USER');
          }
          return resolve('success');
        } catch (uErr) {
          logger.error(uErr, 'FAILED_TO_CREATE_DEFAULT_USER');
          return reject('failed');
        }
      }
    } catch (error) {
      logger.error(error, 'ERROR_FIND_REQUEST_ADMIN_USER');
      return reject('failed');
    }
  })
};

const addUserToDtrAdminGroup = (group) => {
  return new Promise(async (resolve, reject) => {
    try {
      const userRes = await User.findOne({ username: DEFAULT_USERS.DTR_ADMIN.USERNAME }).lean();
      if (userRes) {
        const dtrAdminExists = group.members.some((member) => member?._id.equals(userRes?._id));
        if (!dtrAdminExists) {
          const opts = {
            gid: group?._id,
            _id: userRes?._id,
          };
          try {
            await addUserToGroup(opts);
          } catch (error) {
            logger.error('FAILED_TO_ADD_USER');
          }
          return resolve('success');
        }
        return resolve('success');
      } else {
        const dtrAdmin = {
          name: DEFAULT_USERS.DTR_ADMIN.NAME,
          username: DEFAULT_USERS.DTR_ADMIN.USERNAME || process.env.DTR_ADMIN,
          password: process.env.DTR_ADMIN_PASS,
          email: 'spiotrow@its.jnj.com',
          isAdmin: false,
          isSuperAdmin: false,
        };
        try {
          const newUser = await createDefaultUser(dtrAdmin);
          const opts = {
            gid: group._id,
            _id: newUser?._id,
          };
          try {
            await addUserToGroup(opts);
          } catch (error) {
            logger.error('FAILED_TO_ADD_USER');
          }
          return resolve('success');
        } catch (uErr) {
          logger.error(uErr, 'FAILED_TO_CREATE_DTR_DEFAULT_USER');
          return reject('failed');
        }
      }
    } catch (error) {
      logger.error(error, 'ERROR_FIND_DTR_ADMIN_USER');
      return reject('failed');
    }
  })
};

export const defaultGroup = async () => {
  // Scope Administrators Group.
  try {
    const filter = {
      name: GROUPS.ADMIN,
    };
    const adminGroup = await Group.findOne(filter).lean();
    if (!adminGroup) {
      const instance = new Group(filter);
      await instance.save();
      logger.info('GROUP_ADDED');
    }
  } catch (error) {
    logger.error(error, 'ERROR_DB_SAVE');
  }

  try {
    const requestFilter = {
      name: GROUPS.REQUEST_ADMIN,
    };
    const groupRes = await Group.findOne(requestFilter).lean();
    if (groupRes) {
      // 2. Check if request admin user is available for request admin group
      if (groupRes.name === GROUPS.REQUEST_ADMIN) {
        try {
          await addUserToRequestAdminGroup(groupRes);
        } catch (error) {
          logger.error('FAILED_TO_ADD_USER_IN_REQUEST_GROUP');
        }
      }
    } else {
      try {
        const instance = new Group(requestFilter);
        const reqRes = await instance.save();
        console.log(reqRes, 'TEST1')
        if (reqRes.name === GROUPS.REQUEST_ADMIN) {
          try {
            await addUserToRequestAdminGroup(reqRes);
          } catch (error) {
            logger.error('FAILED_TO_ADD_USER_IN_REQUEST_GROUP');
          }
        }
        logger.info(reqRes, 'ADDED_GROUP_SUCCESS');
      } catch (rErr) {
        logger.error(rErr, 'ERROR_DB_GROUP_REQUEST');
      }
    }
  } catch (dbErr) {
    logger.error(dbErr, 'ERROR_FINDING_REQUEST_ADMIN');
  }

  // Request Adminstrators Group.
  try {
    const dtrFilter = {
      name: GROUPS.DTR_ADMIN,
    };
    const groupDTRRes = await Group.findOne(dtrFilter).lean();
    console.log(groupDTRRes, 'TEST1')
    if (groupDTRRes) {
      // 2. Check if request admin user is available for request admin group
      if (groupDTRRes.name === GROUPS.DTR_ADMIN) {
        try {
          await addUserToDtrAdminGroup(groupDTRRes);
        } catch (error) {
          logger.error('FAILED_TO_ADD_USER_IN_DTR_GROUP');
        }
      }
    } else {
      try {
        const instance = new Group(dtrFilter);
        const dtrResponse = await instance.save();
        if (dtrResponse.name === GROUPS.DTR_ADMIN) {
          try {
            await addUserToDtrAdminGroup(dtrResponse);
          } catch (error) {
            logger.error('FAILED_TO_ADD_USER_IN_DTR_GROUP');
          }
        }
        logger.info('DTR_GROUP_CREATED_SUCCESSFULLY');
      } catch (saveErr) {
        logger.error(saveErr, 'FAILED_TO_CREATE_DTR_GROUP');
      }
    }
  } catch (dbErr) {
    logger.error(dbErr, 'ERROR_FINDING_DTR_ADMIN');
  }
}
