import { logger } from '../../utils/logger.js';
import request from 'request';
import { gitlabUserServices } from './users.js';


/**
 * Transforms the various types of errors and tries to convert them into a standard output.
 * PRIVATE
 * @param {String} [statusCode] The response status code to be sent in the response
 * @param {String} [message] The message to be sent in the error response
 * @param {String} [errCode] The error custom code to be sent in the response
 */
function handleError(statusCode, message, errCode) {
  return {
    code: statusCode,
    error: errCode,
    message,
  };
}

/**
 * Get group's details from GitLab
 *
 * @method getGroupsByCustomAttributes
 * @param {String} query Group search by query
 * @return {Promise} Resolved when the group details has been retrieved.
 */
function getGroupsByCustomAttributes(name, customAttribues) {
  const custom_attributes = {};
  Object.keys(customAttribues).forEach((key) => {
    custom_attributes[key] = customAttribues[key];
  });
  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      url: `${process.env.GITLAB_HOST}/api/v4/groups`,
      json: true,
      qs: {
        search: name,
        with_custom_attributes: true,
        custom_attributes,
      },
      headers: {
        'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
      },
      strictSSL: false,
    }, (error, response, body) => {
      if (error) {
        logger.error(error, 'ERROR_GITLAB_FIND_GROUP');
        return reject(handleError(500, 'Error in fetching group details', 'ERROR_GITLAB_FIND_GROUP'));
      }
      if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
        resolve({
          message: 'Group details fetched successfully',
          code: 201,
          body,
        });
      } else if (response.statusCode &&
        (response.statusCode === 401 || response.statusCode === 403)
      ) {
        logger.error(body.message, 'ERROR_GITLAB_FIND_GROUP');
        reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_FIND_GROUP'));
      } else {
        logger.error(body.message, 'ERROR_GITLAB_FIND_GROUP');
        reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_FIND_GROUP'));
      }
    });
  });
}

/**
 * Get group's details from GitLab
 *
 * @method getGroups
 * @param {String} query Group search by query
 * @return {Promise} Resolved when the group details has been retrieved.
 */
function getGroups(name) {
  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      url: `${process.env.GITLAB_HOST}/api/v4/groups`,
      json: true,
      qs: {
        search: name,
      },
      headers: {
        'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
      },
      strictSSL: false,
    }, (error, response, body) => {
      if (error) {
        logger.error(error, 'ERROR_GITLAB_FIND_GROUP');
        return reject(handleError(500, 'Error in fetching group details', 'ERROR_GITLAB_FIND_GROUP'));
      }
      if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
        resolve({
          message: 'Group details fetched successfully',
          code: 201,
          body,
        });
      } else if (response.statusCode &&
        (response.statusCode === 401 || response.statusCode === 403)
      ) {
        logger.error(body.message, 'ERROR_GITLAB_FIND_GROUP');
        reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_FIND_GROUP'));
      } else {
        logger.error(body.message, 'ERROR_GITLAB_FIND_GROUP');
        reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_FIND_GROUP'));
      }
    });
  });
}

/**
 * Creates a new group group in GitLab
 *
 * @method createGroup
 * @param {Object} payload Group payload
 * @param {String} payload.name Group name
 * @param {String} payload.path Group path
 * @param {String} [payload.visibility] Group visibility
 * @return {Promise} Resolved when the group is created.
 */
function createGroup(payload) {
  return new Promise((resolve, reject) => {
    request({
      method: 'POST',
      url: `${process.env.GITLAB_HOST}/api/v4/groups`,
      json: true,
      body: payload,
      headers: {
        'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
      },
      strictSSL: false,
    }, (error, response, body) => {
      if (error) {
        logger.error(error, 'ERROR_GITLAB_FIND_USER');
        return reject(handleError(500, 'Error in fetching user details', 'ERROR_GITLAB_FIND_USER'));
      }
      if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
        resolve({
          message: 'Group created successfully',
          code: 201,
          body,
        });
      } else if (response.statusCode &&
        (response.statusCode === 401 || response.statusCode === 403)
      ) {
        logger.error(body.message, 'ERROR_GITLAB_CREATE_GROUP');
        reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_CREATE_GROUP'));
      } else {
        logger.error(body.message, 'ERROR_GITLAB_CREATE_GROUP');
        reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_CREATE_GROUP'));
      }
    });
  });
}

/**
 * Creates a new group group in GitLab
 *
 * @method addCustomAttribute
 * @param {String} groupId Group Id
 * @param {String} key Custom Attribute Key
 * @param {String} value Custom Attribute Value
 * @return {Promise} Resolved when the custom attribure is added to group.
 */
function addCustomAttribute(groupId, key, value) {
  return new Promise((resolve, reject) => {
    request({
      method: 'PUT',
      url: `${process.env.GITLAB_HOST}/api/v4/groups/${groupId}/custom_attributes/${key}`,
      json: true,
      // body: {},
      form: {
        value,
      },
      headers: {
        'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
      },
      strictSSL: false,
    }, (error, response, body) => {
      if (error) {
        logger.error(error, 'ERROR_GITLAB_ADD_CUSTOM_ATTRIBUTE');
        return reject(handleError(500, 'Failed to set custom attributes', 'ERROR_GITLAB_ADD_CUSTOM_ATTRIBUTE'));
      }
      if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
        resolve({
          message: 'Added custom attributes to group',
          code: 201,
          body,
        });
      } else if (response.statusCode &&
        (response.statusCode === 401 || response.statusCode === 403)
      ) {
        logger.error(body.message, 'ERROR_GITLAB_ADD_CUSTOM_ATTRIBUTE');
        reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_ADD_CUSTOM_ATTRIBUTE'));
      } else {
        logger.error(body.message, 'ERROR_GITLAB_ADD_CUSTOM_ATTRIBUTE');
        reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_ADD_CUSTOM_ATTRIBUTE'));
      }
    });
  });
}

/**
 * Add a new memeber to group
 *
 * @method addGroupMember
 * @param {String} groupId The ID of Gitlab group
 * @param {String} username The username of the group member
 * @param {String} accessLevel The access level of the member in Gitlab group
 * @return {Promise} Resolved when the group member has been added successfully.
 * @returns {Promise} Resolved when member is added to group
 */
function addGroupMember(groupId, username, accessLevel) {
  return new Promise((resolve, reject) => {
    gitlabUserServices.getUser(username).then((uRes) => {
      if (uRes) {
        request({
          method: 'POST',
          url: `${process.env.GITLAB_HOST}/api/v4/groups/${groupId}/members`,
          json: true,
          body: {
            user_id: uRes.body.id,
            access_level: accessLevel,
          },
          headers: {
            'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
          },
          strictSSL: false,
        }, (error, response, body) => {
          console.log("GGG", {error, response, body} )
          if (error) {
            logger.error(error, 'ERROR_GITLAB_ADD_GROUP_MEMBER');
            return reject(handleError(response.statusCode || 500, 'Error in adding group member', 'ERROR_GITLAB_ADD_GROUP_MEMBER'));
          }
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
            resolve({
              message: 'Group member added successfully',
              code: 201,
              body,
            });
          } else if (response.statusCode &&
            (response.statusCode === 401 || response.statusCode === 403)
          ) {
            logger.error(body.message, 'ERROR_GITLAB_ADD_GROUP_MEMBER');
            reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_ADD_GROUP_MEMBER'));
          } else if (response.statusCode === 409) {
            resolve({
              message: 'Group member already exists',
              code: 409,
              body: { id: uRes.body.id, username },
            });
          } else {
            logger.error(body.message, 'ERROR_GITLAB_ADD_GROUP_MEMBER');
            reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_ADD_GROUP_MEMBER'));
          }
        });
      }
    }, (uErr) => {
      logger.error(uErr, 'ERROR_GITLAB_ADD_GROUP_MEMBER');
      // reject(handleError(uErr.code, 'Error in fetching group member details', 'ERROR_GITLAB_ADD_GROUP_MEMBER'));
      resolve({
        message: `${username} not exists in GitLab`,
        code: 409,
        body: { username },
      });
    });
  });
}

/**
 * Remove group member in GitLab
 *
 * @method removeGroupMember
 * @param {String} groupId The ID of Gitlab group
 * @param {String} username The username of the group member
 * @return {Promise} Resolved when the group member has been removed successfully.
 */
function removeGroupMember(groupId, username) {
  return new Promise((resolve, reject) => {
    gitlabUserServices.getUser(username).then((uRes) => {
      if (uRes) {
        request({
          method: 'DELETE',
          url: `${process.env.GITLAB_HOST}/api/v4/groups/${groupId}/members/${uRes.body.id}`,
          json: true,
          headers: {
            'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
            // Sudo: 'root',
          },
          strictSSL: false,
        }, (error, response, body) => {
          if (error) {
            logger.error(error, 'ERROR_GITLAB_REMOVE_GROUP_MEMBER');
            return reject(handleError(500, 'Error in removing group member', 'ERROR_GITLAB_REMOVE_GROUP_MEMBER'));
          }
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
            resolve({
              message: 'Group member removed successfully',
              code: 200,
              body,
            });
          } else if (response.statusCode &&
            (response.statusCode === 401 || response.statusCode === 403)
          ) {
            logger.error(body.message, 'ERROR_GITLAB_REMOVE_GROUP_MEMBER');
            reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_REMOVE_GROUP_MEMBER'));
          } else if (response.statusCode && response.statusCode === 404) {
            logger.error(body.message, 'ERROR_GITLAB_REMOVE_GROUP_MEMBER');
            resolve({
              message: 'Group member not found',
              code: 200,
              body,
            });
          } else {
            logger.error(body.message, 'ERROR_GITLAB_REMOVE_GROUP_MEMBER');
            reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_REMOVE_GROUP_MEMBER'));
          }
        });
      }
    }, (uErr) => {
      logger.error(uErr, 'ERROR_GITLAB_REMOVE_GROUP_MEMBER');
      resolve({
        message: 'User not found',
        code: 200,
      });
    });
  });
}

/**
* Removes a group in GitLab
*
* @method removeGroup
* @param {Number} groupId ID of the group to be removed
* @return {Promise} Resolved when the group is removed.
*/
function removeGroup(groupId) {
  return new Promise((resolve, reject) => {
    request({
      method: 'DELETE',
      url: `${process.env.GITLAB_HOST}/api/v4/groups/${groupId}`,
      headers: {
        'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
      },
      strictSSL: false,
    }, (error, response, body) => {
      if (error) {
        logger.error(error, 'ERROR_GITLAB_REMOVE_GROUP');
        return reject(handleError(500, 'Error in removing group', 'ERROR_GITLAB_REMOVE_GROUP'));
      }
      if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
        resolve({
          message: 'Group removed successfully',
          code: 200,
          body,
        });
      } else if (response.statusCode &&
        (response.statusCode === 404)
      ) {
        logger.error(body.message, 'ERROR_GITLAB_GROUP_NOTFOUND');
        resolve({
          message: 'Group Not Found',
          code: 200,
        });
      } else {
        logger.error(body.message, 'ERROR_GITLAB_REMOVE_GROUP');
        reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_REMOVE_GROUP'));
      }
    });
  });
}


export const gitlabGroupServices = {
  createGroup,
  addCustomAttribute,
  addGroupMember,
  removeGroupMember,
  getGroups,
  getGroupsByCustomAttributes,
  removeGroup,
};
