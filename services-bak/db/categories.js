import { getJiraClient } from "../../connectors/jira.js";
import { Category } from "../../models/category.js";
import { logger } from "../../utils/logger.js";
import async from 'async';

/**
 * Scrapes jira categories in DB.
 *
 * @method scrapeJiraCategories
 * @param {Object} auth The JIRA auth details of the requesting user.
 * @return {Promise} Resolved when the categories has been scraped and created in DB.
 */
function scrapeJiraCategories(auth) {
  return new Promise((resolve, reject) => {
    const jiraClient = getJiraClient(auth);
    jiraClient.projectCategory.getAllProjectCategories().then((jRes) => {
      async.forEachOf(jRes, async (item, key, callback) => {
        // 1 Create category in DB
        const data = item;
        data._id = data.id;
        delete data.id;
        try {
          const instance = new Category(data);
          await instance.save();
          // 1.b Category has been successfully saved to db
          callback();
        } catch (saveErr) {
          // 1.a Category creation in DB failed
          logger.error(saveErr, 'ERROR_DB_SAVE_CATEGORY');
          if (saveErr.code === 11000) {
            callback({ code: 11000 });
          } else {
            callback({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_SAVE_CATEGORY' });
          }
        }
      }, (err) => {
        if (err) {
          if (err.code === 11000) {
            return resolve({ message: 'Categories creation process completed. Some of the categories would not have been created due to duplication in category name.', code: 200 });
          } else {
            logger.error(err, 'ERROR_DB_SAVE_CATEGORY');
            return reject(err);
          }
        } else {
          return resolve({ message: 'All categories created successfully', code: 200 });
        }
      });
    }).catch((jErr) => {
      logger.error(jErr, 'ERROR_DB_SAVE_CATEGORY');
      return reject(jErr);
    });
  });
}

export const dbCategoriesServices = {
  scrapeJiraCategories,
};
