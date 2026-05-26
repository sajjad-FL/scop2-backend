import { logger } from "../../utils/logger.js";
import { jiraProjectServices } from "../jira/project.js";

/**
 * Get all data
 * @param {Object} opts The request options.
 * @param {String} opts.auth The auth details of the requesting user.
 * @return {Promise} Resolved when the data has been retrieved.
 */
function getAllData(opts) {
  return new Promise((resolve, reject) => {
    // Get projects data from DB
    if (opts.auth.isSuperAdmin || opts.auth.isAdmin) {
      jiraProjectServices.getAllProjects(opts).then((projects) => {
        return resolve(projects)
      }).catch((err) => {
        logger.error(err, 'ERROR_IN_GET_ALL_DATA');
        if (err.statusCode && err.statusCode === 403) {
          return reject({ message: 'You are unauthorized to perform this action', code: 403 }).code(err.statusCode);
        } else if (err.statusCode) {
          return reject(err.body).code(err.statusCode);
        } else {
          return reject(err);
        }
      })
    } else {
      let wWID = opts.auth.wWID;
      if (typeof opts.auth.wWID === 'object' && opts.auth.wWID.wWID) {
        wWID = opts.auth.wWID.wWID || opts.auth.wWID.email;
      }
      if (typeof opts.auth.wWID === 'string' && opts.auth.wWID) {
        wWID = opts.auth.wWID;
      }
      opts.auth.wWID = wWID;
      jiraProjectServices.getProjectsByUserId(wWID, opts).then((res) => {
        return resolve(res);
      }).catch((err) => {
        logger.error(err, 'ERROR_IN_GET_ALL_DATA')
        return reject(err);
      });
    }
  });
}

export const reportsDashboardServices = {
  getAllData,
};
