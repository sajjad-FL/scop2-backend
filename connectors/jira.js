import JiraClient from 'jira-connector';
import config from '../config/default.js';

/**
 * Returns a unique JiraClient instance for a user.
 * If username and password is not provided, it will work only with public resources
 * @param {Object} authObj Object containing the auth details.
 * @param {String} authObj.username The unique identifier for a user in JIRA.
 * @param {String} authObj.password Password.
 * @returns {JiraClient}
 */
export const getJiraClient = (authObj) => {
  const jiraConf = config.jira;
  if (authObj.username && authObj.password) {
    jiraConf.basic_auth = authObj;
  }
  return new JiraClient(jiraConf);
};
