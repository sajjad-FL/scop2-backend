/**
 * Used to access Jira REST endpoints in '/rest/api/2/project'
 *
 * @param {JiraClient} jiraClient
 * @constructor ProjectClient
 */
function ProjectClient(jiraClient) {
  this.jiraClient = jiraClient;

  /**
   * Returns all the project types defined on the Jira instance
   *
   * @method getAllProjectTypes
   * @memberOf ProjectClient#
   * @param opts The request options sent to the Jira API.
   * @param [callback] Called when the types have been retrieved.
   * @return {Promise} Resolved when the types have been retrieved.
   */
  this.getAllProjectTypes = function (opts, callback) {
    var options = {
      uri: this.jiraClient.buildURL('/project/type'),
      method: 'GET',
      json: true,
      followAllRedirects: true
    };
    return this.jiraClient.makeRequest(options, callback);
  };

  /**
   * Updates a project
   *
   * Updates the details of an existing project
   *
   * @method updateProject
   * @memberOf ProjectClient#
   * @param opts The request options sent to the Jira API. 
   * @param opts.projectIdOrKey The project id or key.
   * @param opts.project The body of the project to update.
   * @param [callback] Called when the project has been updated.
   * @return {Promise} Resolved when the project has been updated.
   */
  this.updateProject = function(opts, callback) {
    var options = {
      uri: this.jiraClient.buildURL('/project/' + opts.projectIdOrKey),
      method: 'PUT',
      followAllRedirects: true,
      json: true,
      body: opts.project
    };
    return this.jiraClient.makeRequest(options, callback);
  };

  /**
   * Gets a permission scheme assigned with a project.
   *
   * @method assignPermissionScheme
   * @memberOf ProjectClient#
   * @param opts The request options sent to the Jira API. 
   * @param opts.projectIdOrKey The project id or key.
   * @param {Object} opts.expand The fields to be expanded.
   * @param opts.project The project properties.
   * @param [callback] Called when the assigned permission scheme has been retrieved.
   * @return {Promise} Resolved when the assigned permission scheme has been retrieved.
   */
  this.getAssignedPermissionScheme = function(opts, callback) {
    var expand = opts.expand
    if (opts.expand && opts.expand instanceof Array) {
      expand = opts.expand.join(',');
    }
    var options = {
      uri: this.jiraClient.buildURL('/project/' + opts.projectIdOrKey + '/permissionscheme'),
      method: 'GET',
      followAllRedirects: true,
      json: true,
      qs: {
        expand: expand
      }
    };
    return this.jiraClient.makeRequest(options, callback);
  };

  /**
   * Assigns a permission scheme with a project.
   *
   * @method assignPermissionScheme
   * @memberOf ProjectClient#
   * @param opts The request options sent to the Jira API. 
   * @param opts.projectIdOrKey The project id or key.
   * @param {Object} opts.expand The fields to be expanded.
   * @param opts.project The project properties.
   * @param [callback] Called when the permission scheme has been assigned to the project.
   * @return {Promise} Resolved when the permission scheme has been assigned to the project.
   */
  this.assignPermissionScheme = function(opts, callback) {
    var expand = opts.expand
    if (opts.expand && opts.expand instanceof Array) {
      expand = opts.expand.join(',');
    }
    var options = {
      uri: this.jiraClient.buildURL('/project/' + opts.projectIdOrKey + '/permissionscheme'),
      method: 'PUT',
      followAllRedirects: true,
      json: true,
      body: opts.project,
      qs: {
        expand: expand
      }
    };
    return this.jiraClient.makeRequest(options, callback);
  };

  /**
   * Deletes actors (users or groups) from a project role.
   *
   * @method deleteProjectActor
   * @memberOf ProjectClient#
   * @param opts The request options sent to the Jira API. 
   * @param opts.projectIdOrKey The project id or key.
   * @param opts.roleId The id of the role to retrieve.
   * @param {String} opts.group The groupname to remove from the project role.
   * @param {String} opts.user The username to remove from the project role.
   * @param [callback] Called when the actor have been deleted.
   * @return {Promise} Resolved wwhen the actor have been deleted.
   */
  this.deleteProjectActor = function(opts, callback) {
    var options = {
      uri: this.jiraClient.buildURL('/project/' + opts.projectIdOrKey + '/role/' + opts.roleId),
      method: 'DELETE',
      followAllRedirects: true,
      json: true,
      qs: {
        group: opts.group,
        user: opts.user
      }
    };
    return this.jiraClient.makeRequest(options, callback);
  };

  /**
   * Returns all the project templates
   *
   * @method getProjectTemplates
   * @memberOf ProjectClient#
   * @param opts The request options sent to the Jira API.
   * @param [callback] Called when the project templates have been retrieved.
   * @return {Promise} Resolved when the project templates have been retrieved.
   */
  this.getProjectTemplates = function (opts, callback) {
    var options = {
      uri: `http://${process.env.JIRA_HOST}:${process.env.JIRA_PORT}/rest/project-templates/1.0/templates`,
      method: 'GET',
      json: true,
      followAllRedirects: true
    };
    return this.jiraClient.makeRequest(options, callback);
  };

  /**
   * Updates project type of a single project.
   *
   * @method updateProjectType
   * @memberOf ProjectClient#
   * @param opts The request options sent to the Jira API. 
   * @param opts.projectIdOrKey The project id or key.
   * @param opts.newProjectTypeKey Key of the new project type.
   * @param [callback] Called when the project type has been updated.
   * @return {Promise} Resolved when the project type has been updated.
   */
  this.updateProjectType = function(opts, callback) {
    var options = {
      uri: this.jiraClient.buildURL('/project/' + opts.projectIdOrKey + '/type/' + opts.newProjectTypeKey),
      method: 'PUT',
      followAllRedirects: true,
      json: true,
    };
    return this.jiraClient.makeRequest(options, callback);
  };
}

export default ProjectClient;