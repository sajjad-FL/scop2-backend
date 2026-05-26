import request from 'request';
import { logger } from '../../utils/logger.js';

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
 * Get current authenticated user details from GitLab
 *
 * @method getUser
 * @param {String} username The username of user
 * @return {Promise} Resolved when the user details has been retrieved.
 */
function getUser(username) {
  return new Promise((resolve, reject) => {
    request({
      method: 'GET',
      url: `${process.env.GITLAB_HOST}/api/v4/user/`,
      json: true,
      headers: {
        'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
        Sudo: username,
      },
      strictSSL: false,
    }, (error, response, body) => {
      if (error) {
        logger.error(error, 'ERROR_GITLAB_FIND_USER');
        return reject(handleError(500, 'Error in fetching user details', 'ERROR_GITLAB_FIND_USER'));
      }
      if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
        resolve({
          message: 'User details fetched successfully',
          code: 201,
          body,
        });
      } else if (response.statusCode &&
        (response.statusCode === 401 || response.statusCode === 403)
      ) {
        logger.error(body.message, 'ERROR_GITLAB_FIND_USER');
        reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_FIND_USER'));
      } else {
        logger.error(body.message, 'ERROR_GITLAB_FIND_USER');
        reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_FIND_USER'));
      }
    });
  });
}

function createUser(payload) {
  return new Promise((resolve, reject) => {
    request({
      method: 'POST',
      url: `${process.env.GITLAB_HOST}/api/v4/users`, // Update endpoint URL
      json: true,
      body: payload,
      headers: {
        'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
      },
      strictSSL: false,
    }, (error, response, body) => {
      if (error) {
        logger.error(error, 'ERROR_GITLAB_CREATE_USER');
        return reject(handleError(500, 'Error in creating user in scope code', 'ERROR_GITLAB_CREATE_USER'));
      }
      if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
        return resolve({
          message: 'User Created successfully',
          code: 201,
          body,
        });
      } else if (response.statusCode === 409) {
        logger.error(body.message, 'GITLAB_USER_EXIST');
        return resolve({
          message: 'User already exists',
          code: 200,
        });
      } else if (response.statusCode && (response.statusCode === 401 || response.statusCode === 403)) {
        logger.error(body.message, 'ERROR_GITLAB_CREATE_USER');
        reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_CREATE_USER'));
      } else {
        logger.error(body.message, 'ERROR_GITLAB_CREATE_USER');
        reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_CREATE_USER'));
      }
    });
  });
}


export const gitlabUserServices = {
  getUser,
  createUser,
};
