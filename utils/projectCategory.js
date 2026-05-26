/* eslint-disable */
"use strict";

module.exports = ProjectCategoryClient;

/**
 * Used to access Jira REST endpoints in '/rest/api/2/projectCategory'
 *
 * @param {JiraClient} jiraClient
 * @constructor ProjectCategoryClient
 */
function ProjectCategoryClient(jiraClient) {
  this.jiraClient = jiraClient;

  /**
   * Creates a project category.
   *
   * @method createProjectCategory
   * @memberOf ProjectCategoryClient#
   * @param project The project properties. See {@link https://developer.atlassian.com/cloud/jira/platform/rest/#api-api-2-projectCategory-post}
   * @param [callback] Called when the project category has been created.
   * @return {Promise} Resolved when the project category has been created.
   */
  this.createProjectCategory = function (project, callback) {
    var options = {
      uri: this.jiraClient.buildURL('/projectCategory'),
      method: 'POST',
      followAllRedirects: true,
      json: true,
      body: project
    };

    return this.jiraClient.makeRequest(options, callback);
  };

  /**
   * Deletes a project category
   *
   * @method deleteProjectCategory
   * @memberOf ProjectCategoryClient#
   * @param opts The request options sent to the Jira API. 
   * @param opts.id The project category id.
   * @param [callback] Called when the project category has been removed.
   * @return {Promise} Resolved when the project category has been removed.
   */
  this.deleteProjectCategory = function(opts, callback) {
    var options = {
      uri: this.jiraClient.buildURL('/projectCategory/' + opts.id),
      method: 'DELETE',
      followAllRedirects: true,
      json: true
    };
    return this.jiraClient.makeRequest(options, callback, 'Project Department Deleted');
  };

  /**
   * Updates a project category
   *
   * Modify a project category via PUT. 
   * Any fields present in the PUT will override existing values.
   * As a convenience, if a field is not present, it is silently ignored.
   *
   * @method updateProjectCategory
   * @memberOf ProjectCategoryClient#
   * @param opts The request options sent to the Jira API. 
   * @param opts.id The project category id.
   * @param opts.project The body of the project category to update.
   * @param [callback] Called when the project category has been updated.
   * @return {Promise} Resolved when the project category has been updated.
   */
  this.updateProjectCategory = function(opts, callback) {
    var options = {
      uri: this.jiraClient.buildURL('/projectCategory/' + opts.id),
      method: 'PUT',
      followAllRedirects: true,
      json: true,
      body: opts.project
    };
    return this.jiraClient.makeRequest(options, callback);
  };
}