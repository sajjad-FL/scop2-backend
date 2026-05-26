// const logger = require('./../../utils/logger');
// const request = require('request');
// const async = require('async');
// const constants = require('../../utils/constants');
// // const gitlabUploads = require('../../static/gitlab');
// const fs = require('fs');
// const path = require('path');
// const filePath = path.join(process.cwd(), 'static', 'gitlab', 'discoveryTemplates_1.0.6.tar.gz');
// const content = fs.readFileSync(filePath).toString('base64');

// module.exports = function projectServices() {
//   /**
//    * Transforms the various types of errors and tries to convert them into a standard output.
//    * PRIVATE
//    * @param {String} [statusCode] The response status code to be sent in the response
//    * @param {String|Object} [message] The message to be sent in the error response
//    * @param {String} [errCode] The error custom code to be sent in the response
//    */
//   function handleError(statusCode, message, errCode) {
//     let errMessage = '';
//     if (typeof (message) === 'string') {
//       errMessage = message;
//     } else if (typeof (message) === 'object' && message.name) {
//       errMessage = `Gitlab Error - Project name ${message.name[0]}`;
//     } else {
//       errMessage = message;
//     }
//     return {
//       code: statusCode,
//       error: errCode,
//       message: errMessage,
//     };
//   }

//   /**
//    * Get all projects from GitLab
//    *
//    * @method getProjects
//    * @return {Promise} Resolved when the projects has been retrieved.
//    */
//   function getProjects() {
//     return new Promise((resolve, reject) => {
//       request({
//         method: 'GET',
//         url: `${process.env.GITLAB_HOST}/api/v4/projects/`,
//         json: true,
//         headers: {
//           'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
//           // Sudo: 'root',
//         },
//         strictSSL: false,
//       }, (error, response, body) => {
//         if (error) {
//           logger.error(error, 'ERROR_GITLAB_FIND_PROJECTS');
//           return reject(handleError(500, 'Error in fetching projects', 'ERROR_GITLAB_FIND_PROJECTS'));
//         }
//         if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
//           resolve({
//             message: 'All projects fetched successfully',
//             code: 200,
//             body,
//           });
//         } else if (response.statusCode &&
//           (response.statusCode === 401 || response.statusCode === 403)
//         ) {
//           logger.error(body.message, 'ERROR_GITLAB_FIND_PROJECTS');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_FIND_PROJECTS'));
//         } else {
//           logger.error(body.message, 'ERROR_GITLAB_FIND_PROJECTS');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_FIND_PROJECTS'));
//         }
//       });
//     });
//   }

//   /**
//    * Add project member in GitLab
//    *
//    * @method addProjectMember
//    * @param {String} projectId The ID of Gitlab project
//    * @param {String} username The username of the project member
//    * @param {String} accessLevel The access level of the member in Gitlab project
//    * @return {Promise} Resolved when the project member has been added successfully.
//    */
//   function addProjectMember(projectId, username, accessLevel) {
//     return new Promise((resolve, reject) => {
//       global.services.gitlab.userServices.getUser(username).then((uRes) => {
//         if (uRes) {
//           request({
//             method: 'POST',
//             url: `${process.env.GITLAB_HOST}/api/v4/projects/${projectId}/members`,
//             json: true,
//             body: {
//               user_id: uRes.body.id,
//               access_level: accessLevel,
//             },
//             headers: {
//               'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
//               // Sudo: 'root',
//             },
//             strictSSL: false,
//           }, (error, response, body) => {
//             if (error) {
//               logger.error(error, 'ERROR_GITLAB_ADD_PROJECT_MEMBER');
//               return reject(handleError(500, 'Error in adding project member', 'ERROR_GITLAB_ADD_PROJECT_MEMBER'));
//             }
//             if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
//               resolve({
//                 message: 'Project member added successfully',
//                 code: 201,
//                 body,
//               });
//             } else if (response.statusCode &&
//               (response.statusCode === 401 || response.statusCode === 403)
//             ) {
//               logger.error(body.message, 'ERROR_GITLAB_ADD_PROJECT_MEMBER');
//               reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_ADD_PROJECT_MEMBER'));
//             } else {
//               logger.error(body.message, 'ERROR_GITLAB_ADD_PROJECT_MEMBER');
//               reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_ADD_PROJECT_MEMBER'));
//             }
//           });
//         }
//       }, (uErr) => {
//         logger.error(uErr, 'ERROR_GITLAB_ADD_PROJECT_MEMBER');
//         reject(handleError(uErr.code, 'Error in fetching project member details', 'ERROR_GITLAB_ADD_PROJECT_MEMBER'));
//       });
//     });
//   }

//   /**
//    * Remove project member in GitLab
//    *
//    * @method removeProjectMember
//    * @param {String} projectId The ID of Gitlab project
//    * @param {String} username The username of the project member
//    * @return {Promise} Resolved when the project member has been removed successfully.
//    */
//   function removeProjectMember(projectId, username) {
//     return new Promise((resolve, reject) => {
//       global.services.gitlab.userServices.getUser(username).then((uRes) => {
//         if (uRes) {
//           request({
//             method: 'DELETE',
//             url: `${process.env.GITLAB_HOST}/api/v4/projects/${projectId}/members/${uRes.body.id}`,
//             json: true,
//             headers: {
//               'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
//               // Sudo: 'root',
//             },
//             strictSSL: false,
//           }, (error, response, body) => {
//             if (error) {
//               logger.error(error, 'ERROR_GITLAB_REMOVE_PROJECT_MEMBER');
//               return reject(handleError(500, 'Error in removing project member', 'ERROR_GITLAB_REMOVE_PROJECT_MEMBER'));
//             }
//             if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
//               resolve({
//                 message: 'Project member removed successfully',
//                 code: 200,
//                 body,
//               });
//             } else if (response.statusCode &&
//               (response.statusCode === 401 || response.statusCode === 403)
//             ) {
//               logger.error(body.message, 'ERROR_GITLAB_REMOVE_PROJECT_MEMBER');
//               reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_REMOVE_PROJECT_MEMBER'));
//             } else if (response.statusCode && response.statusCode === 404) {
//               logger.error(body.message, 'ERROR_GITLAB_REMOVE_PROJECT_MEMBER');
//               resolve({
//                 message: 'Project member not found',
//                 code: 200,
//                 body,
//               });
//             } else {
//               logger.error(body.message, 'ERROR_GITLAB_REMOVE_PROJECT_MEMBER');
//               reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_REMOVE_PROJECT_MEMBER'));
//             }
//           });
//         }
//       }, (uErr) => {
//         logger.error(uErr, 'ERROR_GITLAB_REMOVE_PROJECT_MEMBER');
//         resolve({
//           message: 'User not found',
//           code: 200,
//         });
//       });
//     });
//   }

//   /**
//    * Add multiple project members in GitLab
//    *
//    * @method addProjectMember
//    * @param {String} projectId The ID of Gitlab project
//    * @param {String} username The username of the project member
//    * @param {String} collaborator The username of the project collaborator
//    * @param {String} accessLevel The access level of the member in Gitlab project
//    * @return {Promise} Resolved when the project member has been added successfully.
//    */
//   function addMultipleProjectMember(projectId, username, collaborator, accessLevel) {
//     return new Promise((resolve, reject) => {
//       const result = [];
//       const data = [username, ...collaborator].filter((a) => a !== 'scope-administrators');
//       async.forEachOf(data, (item, key, callback) => {
//         global.services.gitlab.projectServices.addProjectMember(
//           projectId,
//           item, accessLevel,
//         ).then((gRes) => {
//           Array.prototype.push.apply(result, gRes);
//           callback();
//         }, (gErr) => {
//           callback(gErr);
//         });
//         // return true;
//       }, (err) => {
//         if (err) {
//           try {
//             const errorObj = JSON.parse(err);
//             logger.error(errorObj, 'ERROR_GITLAB_ADD_PROJECT_MEMBER');
//             return reject(handleError(500, 'Error in adding project member', 'ERROR_GITLAB_ADD_PROJECT_MEMBER'));
//           } catch (e) {
//             logger.error(err, 'ERROR_GITLAB_ADD_PROJECT_MEMBER');
//             return reject(handleError(500, 'Error in adding project member', 'ERROR_GITLAB_ADD_PROJECT_MEMBER'));
//           }
//         } else {
//           resolve({
//             message: 'Project member added successfully',
//             code: 201,
//           });
//         }
//       });
//     });
//   }

//   /**
//    * Create new dcm file in GitLab repository
//    *
//    * @method createFile
//    * @param {String} projectId The ID of Gitlab project
//    * @param {String} alfrescoProjectRoot The project root of the alfresco.
//    * @return {Promise} Resolved when the dcm file has been created in GitLab successfully.
//    */
//   function createFile(projectId, alfrescoProjectRoot) {
//     return new Promise((resolve, reject) => {
//       request({
//         method: 'POST',
//         url: `${process.env.GITLAB_HOST}/api/v4/projects/${projectId}/repository/files/.dcmproperties`,
//         json: true,
//         body: {
//           branch: 'master',
//           content: `rid = ${projectId}\nprojectRoot = ${alfrescoProjectRoot}`,
//           commit_message: 'Added .dcmproperties file',
//         },
//         headers: {
//           'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
//           // Sudo: 'root',
//         },
//         strictSSL: false,
//       }, (error, response, body) => {
//         if (error) {
//           logger.error(error, 'ERROR_GITLAB_CREATE_FILE');
//           return reject(handleError(500, 'Error in creating file', 'ERROR_GITLAB_CREATE_FILE'));
//         }
//         if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
//           resolve({
//             message: 'File created successfully',
//             code: 201,
//             body,
//           });
//         } else if (response.statusCode &&
//           (response.statusCode === 401 || response.statusCode === 403)
//         ) {
//           logger.error(body.message, 'ERROR_GITLAB_CREATE_FILE');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_CREATE_FILE'));
//         } else {
//           logger.error(body.message, 'ERROR_GITLAB_CREATE_FILE');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_CREATE_FILE'));
//         }
//       });
//     });
//   }

//   /**
//    * Create a commit with multiple files and actions
//    *
//    * @method createCommit
//    * @param {String} projectId The ID of Gitlab project
//    * @param {String} alfrescoProjectRoot The project root of the alfresco.
//    * @param {String} projectName The project name
//    * @param {Object} customFieldsData The custom fields data.
//    * @return {Promise} Resolved when the commit with multiple files
//    * has been created in GitLab successfully.
//    */
//   function createCommit(projectId, alfrescoProjectRoot, projectName, customFieldsData, projectDepartment) {
//     return new Promise((resolve, reject) => {
//       const actions = [
//         // {
//         //   action: 'create',
//         //   file_path: '.dcmproperties',
//         //   content: `rid = ${projectId}\nprojectRoot = ${alfrescoProjectRoot}\nlead = ${customFieldsData.lead}\ndescription = ${customFieldsData.description}\ncompound = ${customFieldsData.compound}\nta = ${customFieldsData.ta}\nclient = ${customFieldsData.client}\ndeliverable = ${customFieldsData.deliverable}\ndas_pas = ${customFieldsData.das_pas}\nidpNumber = ${customFieldsData.idpNumber}\ndevPhase = ${customFieldsData.devPhase}\nscientist = ${customFieldsData.scientist}`,
//         //   // content: `rid = ${projectId}\nprojectRoot = ${alfrescoProjectRoot}\n
//         //   // TherapeuticArea = ${customFieldsData.ta}\nCompound = ${customFieldsData.compound}\n
//         //   // Lead = ${customFieldsData.lead}\nDescription = ${customFieldsData.description}`,
//         // },
//         {
//           action: 'create',
//           file_path: '.gitignore',
//           content: 'smm_gitignore.txt',
//         },
//         {
//           action: 'create',
//           file_path: `${projectName}.Rproj`,
//           content: 'Version: 1.0\n\nRestoreWorkspace: Default\nSaveWorkspace: Default\nAlwaysSaveHistory: Default\n\nEnableCodeIndexing: Yes\nUseSpacesForTab: Yes\nNumSpacesForTab: 2\nEncoding: UTF-8\n\nRnwWeave: Sweave\nLaTeX: pdfLaTeX',
//         },
//         {
//           action: 'create',
//           file_path: 'Code/readme.txt',
//           content: 'This is the default location for code.',
//         },
//         {
//           action: 'create',
//           file_path: 'Data/readme.txt',
//           content: 'This is the default location for data.',
//         },
//         {
//           action: 'create',
//           file_path: 'Documents/readme.txt',
//           content: 'This is the default location for documents.',
//         },
//         {
//           action: 'create',
//           file_path: 'Output/readme.txt',
//           content: 'This is the default location for outputs and results.',
//         },
//       ];
//       if (projectDepartment && (projectDepartment.toLowerCase() === constants.SCOPE.CATEGORY.TMEDS.toLowerCase())) {
//         const tmedsActions = [
//           {
//             action: 'create',
//             file_path: 'Output/discoveryTemplates_1.0.6.tar.gz',
//             encoding: 'base64',
//             content,
//           },
//         ]
//         Array.prototype.push.apply(actions, tmedsActions);
//       }
//       request({
//         method: 'POST',
//         url: `${process.env.GITLAB_HOST}/api/v4/projects/${projectId}/repository/commits`,
//         json: true,
//         body: {
//           branch: 'master',
//           actions,
//           commit_message: 'Project initialization check-in',
//         },
//         headers: {
//           'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
//           // Sudo: 'root',
//         },
//         strictSSL: false,
//       }, (error, response, body) => {
//         if (error) {
//           logger.error(error, 'ERROR_GITLAB_CREATE_COMMIT');
//           return reject(handleError(500, 'Error in creating commit with multiple files', 'ERROR_GITLAB_CREATE_COMMIT'));
//         }
//         if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
//           resolve({
//             message: 'Commit created successfully',
//             code: 201,
//             body,
//           });
//         } else if (response.statusCode &&
//           (response.statusCode === 401 || response.statusCode === 403)
//         ) {
//           logger.error(body.message, 'ERROR_GITLAB_CREATE_COMMIT');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_CREATE_COMMIT'));
//         } else {
//           logger.error(body.message, 'ERROR_GITLAB_CREATE_COMMIT');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_CREATE_COMMIT'));
//         }
//       });
//     });
//   }

//   /**
//    * Fetch file from remote branch.
//    *
//    * @method updateContent
//    * @param {String} projectId The ID of Gitlab project
//    * @param {String} filePath URI Encoded file path
//    * @param {String} branch branch
//    * @return {Promise} Resolved when the file is fetched.
//    */
//    function fetchFile(projectId, filePath, branch) {
//     return new Promise((resolve, reject) => {
//       request({
//         method: 'GET',
//         url: `${process.env.GITLAB_HOST}/api/v4/projects/${projectId}/repository/files/${filePath}`,
//         json: true,
//         qs: {
//           ref: branch,
//         },
//         headers: {
//           'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
//         },
//         strictSSL: false,
//       }, (error, response, body) => {
//         if (error) {
//           logger.error(error, 'ERROR_GITLAB_FETCH_FILE');
//           return reject(handleError(500, 'Error while fetching the file', 'ERROR_GITLAB_FETCH_FILE'));
//         }
//         if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
//           resolve({
//             message: 'File fetched successfully',
//             code: 201,
//             body,
//           });
//         } else if (response.statusCode &&
//           (response.statusCode === 401 || response.statusCode === 403)
//         ) {
//           logger.error(body.message, 'ERROR_GITLAB_FETCH_FILE');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_FETCH_FILE'));
//         } else {
//           logger.error(body.message, 'ERROR_GITLAB_FETCH_FILE');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_FETCH_FILE'));
//         }
//       });
//     });
//   }

//   /**
//    * Create a commit with multiple files and actions changes
//    *
//    * @method updateContent
//    * @param {String} projectId The ID of Gitlab project
//    * @param {Array.<{ action: String, file_path: String, content: String }>} actions Actions
//    * @param {String} commitMessage Commit message
//    * @param {String} branch Remote branch
//    * @return {Promise} Resolved when the commit with multiple files
//    * has been created in GitLab successfully.
//    */
//    function updateContent(projectId, actions, commitMessage, branch = 'master') {
//     return new Promise((resolve, reject) => {
//       request({
//         method: 'POST',
//         url: `${process.env.GITLAB_HOST}/api/v4/projects/${projectId}/repository/commits`,
//         json: true,
//         body: {
//           branch,
//           actions,
//           commit_message: commitMessage,
//         },
//         headers: {
//           'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
//         },
//         strictSSL: false,
//       }, (error, response, body) => {
//         if (error) {
//           logger.error(error, 'ERROR_GITLAB_CREATE_COMMIT');
//           return reject(handleError(500, 'Error in creating commit with multiple files', 'ERROR_GITLAB_CREATE_COMMIT'));
//         }
//         if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
//           resolve({
//             message: 'Commit created successfully',
//             code: 201,
//             body,
//           });
//         } else if (response.statusCode &&
//           (response.statusCode === 401 || response.statusCode === 403)
//         ) {
//           logger.error(body.message, 'ERROR_GITLAB_CREATE_COMMIT');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_CREATE_COMMIT'));
//         } else {
//           logger.error(body.message, 'ERROR_GITLAB_CREATE_COMMIT');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_CREATE_COMMIT'));
//         }
//       });
//     });
//   }

//   /**
//    * Create project in GitLab
//    *
//    * @method createProject
//    * @param {Object} payload The project properties.
//    * @param {String} currentUser The username of current logged-in user.
//    * @param {String} projectLead The username of the project lead.
//    * @param {String} alfrescoProjectRoot The project root of the alfresco.
//    * @param {Object} customFieldsData The custom fields data.
//    * @param {Object} projectData The project data.
//    * @return {Promise} Resolved when the project has been created.
//    */
//   function createProject(
//     payload, currentUser, projectLead, alfrescoProjectRoot, customFieldsData,
//     projectData, category
//   ) {
//     return new Promise((resolve, reject) => {
//       request({
//         method: 'POST',
//         url: `${process.env.GITLAB_HOST}/api/v4/projects/`,
//         json: true,
//         body: payload,
//         headers: {
//           'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
//           Sudo: 'root',
//         },
//         strictSSL: false,
//       }, (error, response, body) => {
//         if (error) {
//           logger.info('ERROR_IN_GITLAB.....', new Date());
//           logger.error(error, 'ERROR_GITLAB_CREATE_PROJECT');
//           if (error?.code === 'ETIMEDOUT') {
//             return reject({
//               code: 500,
//               message: 'Failed to create project in Scope Code(GitLab)',
//               error: 'ERROR_GITLAB_CREATE_PROJECT',
//               gitCode: '500',
//               data: projectData,
//             });
//           }
//           return reject({...handleError(500, 'Failed to create project in Scope Code(GitLab)', 'ERROR_GITLAB_CREATE_PROJECT'), data: projectData});
//         }
//         if (response && response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
//           createCommit(
//             body.id, alfrescoProjectRoot, payload.name,
//             customFieldsData, category,
//           ).then((fRes) => {
//             if (fRes) {
//               if (projectData.collaborators && projectData.collaborators.length > 0) {
//                 const collaboratorsData = projectData.collaborators.map((collaborator) => collaborator?.name);
//                 addMultipleProjectMember(
//                   body.id, projectLead,
//                   collaboratorsData, 40,
//                 ).then((mRes) => {
//                   if (mRes) {
//                     resolve({
//                       message: 'Project created successfully',
//                       code: 201,
//                       body,
//                     });
//                   }
//                 }, (mErr) => {
//                   logger.error(mErr, 'ERROR_GITLAB_ADD_PROJECT_MEMBER');
//                   resolve({
//                     message: 'Project created successfully but error in adding project lead and j&j collaborator to GitLab',
//                     code: 201,
//                     body,
//                   });
//                 });
//               } else {
//                 addProjectMember(body.id, projectLead, 40).then((mRes) => {
//                   if (mRes) {
//                     resolve({
//                       message: 'Project created successfully',
//                       code: 201,
//                       body,
//                     });
//                   }
//                 }, (mErr) => {
//                   logger.error(mErr, 'ERROR_GITLAB_ADD_PROJECT_MEMBER');
//                   resolve({
//                     message: 'Project created successfully but error in adding project lead to GitLab',
//                     code: 201,
//                     body,
//                   });
//                 });
//               }
//             }
//           }, (fErr) => {
//             logger.error(fErr, 'ERROR_GITLAB_CREATE_FILE');
//             resolve({
//               message: 'Project created successfully but error in creating dcm file in GitLab',
//               code: 201,
//               body,
//             });
//           });
//         } else if (response && response.statusCode &&
//           (response.statusCode === 401 || response.statusCode === 403)
//         ) {
//           logger.error(body.message, 'ERROR_GITLAB_CREATE_PROJECT');
//           reject({ ...handleError(response.statusCode, response.body.message ? response.body.message : 'Error in gitlab project creation', 'ERROR_GITLAB_CREATE_PROJECT'), data: projectData });
//         } else {
//           logger.error(body.message, 'ERROR_GITLAB_CREATE_PROJECT');
//           reject({ ...handleError(response.statusCode, response.body.message ? response.body.message : 'Error in gitlab project creation', 'ERROR_GITLAB_CREATE_PROJECT'), data: projectData });
//         }
//       });
//     });
//   }

//   /**
//    * Update project in GitLab
//    *
//    * @method updateProject
//    * @param {Object} payload The project properties
//    * @param {String} projectId The ID of the Gitlab project
//    * @param {String} oldLead The username of the old project lead.
//    * @param {String} newLead The username of the new project lead.
//    * @return {Promise} Resolved when the project has been updated.
//    */
//   function updateProject(payload, projectId, oldLead, newLead) {
//     return new Promise((resolve, reject) => {
//       request({
//         method: 'PUT',
//         url: `${process.env.GITLAB_HOST}/api/v4/projects/${projectId}`,
//         json: true,
//         body: payload,
//         headers: {
//           'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
//           // Sudo: 'root',
//         },
//         strictSSL: false,
//       }, (error, response, body) => {
//         if (error) {
//           logger.error(error, 'ERROR_GITLAB_UPDATE_PROJECT');
//           return reject(handleError(500, 'Error in updating project', 'ERROR_GITLAB_UPDATE_PROJECT'));
//         }
//         if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
//           if (oldLead !== newLead) {
//             removeProjectMember(body.id, oldLead).then((rmRes) => {
//               if (rmRes) {
//                 addProjectMember(body.id, newLead, 40).then((addRes) => {
//                   if (addRes) {
//                     resolve({
//                       message: 'Project updated successfully',
//                       code: 200,
//                       body,
//                     });
//                   }
//                 }, (addErr) => {
//                   logger.error(addErr, 'ERROR_GITLAB_UPDATE_PROJECT');
//                   if (addErr.code === 404) {
//                     resolve({
//                       message: 'Project updated successfully in Scope but lead not found in GitLab',
//                       code: 207,
//                       gitlabErr: addErr,
//                       body,
//                     });
//                   } else {
//                     resolve({
//                       message: 'Project updated successfully but error in updating project lead of GitLab',
//                       code: 207,
//                       gitlabErr: addErr,
//                       body,
//                     });
//                   }
//                 });
//               }
//             }, (rmErr) => {
//               logger.error(rmErr, 'ERROR_GITLAB_UPDATE_PROJECT');
//               if (rmErr.code === 404) {
//                 resolve({
//                   message: 'Project updated successfully in Scope but lead not found in GitLab',
//                   code: 207,
//                   gitlabErr: rmErr,
//                   body,
//                 });
//               } else {
//                 resolve({
//                   message: 'Project updated successfully but error in updating project lead of GitLab',
//                   code: 207,
//                   gitlabErr: rmErr,
//                   body,
//                 });
//               }
//             });
//           } else {
//             resolve({
//               message: 'Project updated successfully',
//               code: 200,
//               body,
//             });
//           }
//         } else if (response.statusCode &&
//           (response.statusCode === 401 || response.statusCode === 403)
//         ) {
//           logger.error(body.message, 'ERROR_GITLAB_UPDATE_PROJECT');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_UPDATE_PROJECT'));
//         } else {
//           logger.error(body.message, 'ERROR_GITLAB_UPDATE_PROJECT');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_UPDATE_PROJECT'));
//         }
//       });
//     });
//   }

//   /**
//    * Archive a project in GitLab
//    *
//    * @method archiveProject
//    * @param {String} projectId The ID of the Gitlab project.
//    * @return {Promise} Resolved when the project has been archived.
//    */
//   function archiveProject(projectId) {
//     return new Promise((resolve, reject) => {
//       request({
//         method: 'POST',
//         url: `${process.env.GITLAB_HOST}/api/v4/projects/${projectId}/archive`,
//         json: true,
//         headers: {
//           'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
//           // Sudo: 'root',
//         },
//         strictSSL: false,
//       }, (error, response, body) => {
//         if (error) {
//           logger.error(error, 'ERROR_GITLAB_ARCHIVE_PROJECT');
//           return reject(handleError(500, 'Error in archiving project', 'ERROR_GITLAB_ARCHIVE_PROJECT'));
//         }
//         if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
//           resolve({
//             message: 'Project archived successfully',
//             code: 200,
//             body,
//           });
//         } else if (response.statusCode &&
//           (response.statusCode === 401 || response.statusCode === 403)
//         ) {
//           logger.error(body.message, 'ERROR_GITLAB_ARCHIVE_PROJECT');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_ARCHIVE_PROJECT'));
//         } else {
//           logger.error(body.message, 'ERROR_GITLAB_ARCHIVE_PROJECT');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_ARCHIVE_PROJECT'));
//         }
//       });
//     });
//   }

//   /**
//    * @private
//    * 
//    * @method shareProjectWithGroup
//    * @description Share project with group in GitLab
//    *
//    * @param {String} projectId The ID of Gitlab project.
//    * @param {String} groupId The ID of Gitlab group.
//    * @param {Number} [accessLevel] The access level of the member in Gitlab project.
//    * @return {Promise.<{code: Number, message: String, body?: Object}>} Resolved when the project is successfully shared with group.
//    */
//    function shareProjectWithGroup(projectId, groupId, accessLevel = constants.GITLAB.ACCESS_LEVEL.REPORTER) {
//     return new Promise((resolve, reject) => {
//       request({
//         method: 'POST',
//         url: `${process.env.GITLAB_HOST}/api/v4/projects/${projectId}/share`,
//         json: true,
//         body: {
//           group_id: +groupId,
//           group_access: accessLevel,
//         },
//         headers: {
//           'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
//         },
//         strictSSL: false,
//       }, (error, response, body) => {
//         if (error) {
//           logger.error(error, 'ERROR_GITLAB_SHARE_PROJECT_GROUP');
//           return reject(handleError(500, 'Error in sharing project with group', 'ERROR_GITLAB_SHARE_PROJECT_GROUP'));
//         }
//         if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
//           resolve({
//             message: 'Project shared with group',
//             code: 201,
//             body,
//           });
//         } else if (response.statusCode &&
//           (response.statusCode === 401 || response.statusCode === 403)
//         ) {
//           logger.error(body.message, 'ERROR_GITLAB_SHARE_PROJECT_GROUP');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_SHARE_PROJECT_GROUP'));
//         } else if (response.statusCode === 409) {
//           resolve({
//             message: 'Project already shared with this group.',
//             code: 409,
//             body: { id: projectId, groupId },
//           });
//         } else {
//           logger.error(body.message, 'ERROR_GITLAB_SHARE_PROJECT_GROUP');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_SHARE_PROJECT_GROUP'));
//         }
//       });
//     });
//   }

//   /**
//    * @private
//    *
//    * @method unlinkProjectWithGroup
//    * @description Share project with group in GitLab
//    *
//    * @param {String} projectId The ID of Gitlab project.
//    * @param {String} groupId The ID of Gitlab group.
//    * @param {Number} [accessLevel] The access level of the member in Gitlab project.
//    * @return {Promise.<{code: Number, message: String, body?: Object}>} Resolved when the project is successfully shared with group.
//    */
//    function unlinkProjectWithGroup(projectId, groupId) {
//     return new Promise((resolve, reject) => {
//       request({
//         method: 'DELETE',
//         url: `${process.env.GITLAB_HOST}/api/v4/projects/${projectId}/share/${groupId}`,
//         json: true,
//         body: {},
//         headers: {
//           'Private-Token': process.env.GITLAB_ACCESS_TOKEN,
//         },
//         strictSSL: false,
//       }, (error, response, body) => {
//         if (error) {
//           logger.error(error, `PROJECT: ${projectId}, GROUP: ${groupId}, CODE: ${response.statusCode}`, 'ERROR_GITLAB_UNLINK_SHARE_PROJECT_GROUP');
//           return reject(handleError(500, 'Error while project is unlinked with group', 'ERROR_GITLAB_UNLINK_SHARE_PROJECT_GROUP'));
//         }
//         if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
//           resolve({
//             message: 'Project unlinked with group',
//             code: 201,
//             body,
//           });
//         } else if (response.statusCode &&
//           (response.statusCode === 401 || response.statusCode === 403)
//         ) {
//           logger.error(body.message, `PROJECT: ${projectId}, GROUP: ${groupId}, CODE: ${response.statusCode}`, 'ERROR_GITLAB_UNLINK_SHARE_PROJECT_GROUP');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_UNLINK_SHARE_PROJECT_GROUP'));
//         } else if (response.statusCode === 409) {
//           resolve({
//             message: 'Project already unlinked with this group.',
//             code: 409,
//             body: { id: projectId, groupId },
//           });
//         } else {
//           logger.error(body.message, `PROJECT: ${projectId}, GROUP: ${groupId}, CODE: ${response.statusCode}`, 'ERROR_GITLAB_UNLINK_SHARE_PROJECT_GROUP');
//           reject(handleError(response.statusCode, response.body.message, 'ERROR_GITLAB_UNLINK_SHARE_PROJECT_GROUP'));
//         }
//       });
//     });
//   }

//   return {
//     getProjects,
//     addProjectMember,
//     removeProjectMember,
//     createFile,
//     createCommit,
//     createProject,
//     updateProject,
//     archiveProject,
//     updateContent,
//     shareProjectWithGroup,
//     unlinkProjectWithGroup,
//     fetchFile,
//   };
// };

import request from "request";
import { exec } from "child_process";
import util from "util";
import fs from "fs";
import path from "path";
import { logger } from "./../../utils/logger.js";

const execAsync = util.promisify(exec);

const BITBUCKET_URL = process.env.BITBUCKET_URL;
const PROJECT = process.env.BITBUCKET_PROJECT;
const BITBUCKET_USER = process.env.BITBUCKET_USERNAME;
const BITBUCKET_PASSWORD = process.env.BITBUCKET_PASSWORD;

const BASE_URL = process.env.BITBUCKET_BASE_URL;
const BRANCH_URL = process.env.BITBUCKET_BRANCH_URL;


const AUTH = {
  user: BITBUCKET_USER,
  pass: BITBUCKET_PASSWORD
};

const authHeader =
  "Basic " +
  Buffer.from(
    `${BITBUCKET_USER}:${BITBUCKET_PASSWORD}`
  ).toString("base64");



const TMP_DIR = "./tmp-repos";

function handleError(statusCode, message, errCode) {
  return {
    code: statusCode,
    error: errCode,
    message: message || "Bitbucket Error"
  };
}

//
// ✅ CREATE REPO
//
function generateEnterpriseSlug(name) {
  return name
    ?.toLowerCase()
    ?.trim()
    ?.replace(/\s+/g, "-")        // replace spaces with -
    ?.replace(/[^a-z0-9-]/g, "")  // allow only alphanumeric and -
    ?.substring(0, 100);
}

function createRepo(repoName) {
  return new Promise((resolve, reject) => {

    const cleanName = repoName.trim();
    const slug = generateEnterpriseSlug(cleanName);
    console.log({ cleanName, slug })
    request({
      method: "POST",
      url: `${BASE_URL}/projects/${PROJECT}/repos`,
      json: true,
      auth: AUTH,
      body: {
        name: slug,
        scmId: "git",
        forkable: true
      }
    }, (error, response, body) => {

      console.log("📥 Bitbucket Response:", body);

      if (error) {
        return reject(handleError(500, error.message, "CREATE_REPO"));
      }

      if (!response || response.statusCode >= 400) {
        return reject(handleError(response.statusCode, body, "CREATE_REPO"));
      }

      // 🔥 FIXED RETURN
      return resolve({
        slug: body.slug,   // ✅ MUST USE THIS
        data: body
      });
    });

  });
}
//
// ✅ ADD USER
 // const response = await fetch(url, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: authHeader,
    //   },
    //   body: JSON.stringify({
    //     type: permissionType,
    //     matcher: {
    //       id: "refs/heads/main",
    //       type: {
    //         id: "BRANCH",
    //         name: "Branch"
    //       }
    //     },
    //     users: users
    //   })
    // });
//

const addRepoUser = async (payload) => {
  try {
    const { repoSlug, users = [], permissionType = [] } = payload;

    console.log({ repoSlug, users, permissionType });

    const url =
      `${BITBUCKET_URL}/rest/branch-permissions/2.0/projects/${PROJECT}/repos/${repoSlug}/restrictions`;

    // ✅ run all rules in parallel
    const results = await Promise.all(
      permissionType.map(async (type) => {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader
          },
          body: JSON.stringify({
            type,
            matcher: {
              id: "refs/heads/main",
              type: {
                id: "BRANCH",
                name: "Branch"
              }
            },
            users
          })
        });

        const data = await response.json();

        console.log(`Rule: ${type}`, data);

        if (!response.ok) {
          throw {
            type,
            error: data
          };
        }

        return {
          type,
          status: response.status,
          data
        };
      })
    );

    return {
      code: 200,
      message: "All branch permissions applied successfully ✅",
      results
    };

  } catch (error) {
    console.log("Branch permission error:", error);

    return {
      code: 400,
      error: "BRANCH_PERMISSION_FAILED",
      message: error
    };
  }
};


// function addRepoUser(repo, username, permission = "WRITE") {
//   console.log("Adding user:", { repo, username, permission });

//   return new Promise((resolve, reject) => {

//     request({
//       method: "PUT",
//       url: `${BASE_URL}/projects/${PROJECT}/repos/${repo}/permissions/users`,
//       qs: {
//         name: username,
//         permission: permission   // ✅ FIXED
//       },
//       json: true,
//       auth: AUTH
//     }, (error, response, body) => {

//       console.log("User API response:", {
//         status: response?.statusCode,
//         body
//       });

//       if (error) {
//         return reject(handleError(500, error.message, "ADD_USER"));
//       }

//       if (response.statusCode >= 200 && response.statusCode < 400) {
//         return resolve(body);
//       }

//       return reject(
//         handleError(response.statusCode, body, "ADD_USER")
//       );
//     });

//   });
// }


//
// ✅ CLONE OR INIT REPO (HELPER)
//
async function prepareRepo(repo) {
  const repoPath = path.join(TMP_DIR, repo);

  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

  if (!fs.existsSync(repoPath)) {
    const cloneUrl = `https://${AUTH.user}:${AUTH.pass}@sourcecode.jnj.com/scm/asx-jjjc/${repo}.git`;

    await execAsync(`git clone ${cloneUrl} ${repoPath}`);
  }

  return repoPath;
}

//
// ✅ CREATE FILE (FIXED)
//
async function createFile(repo, filePath, content) {
  try {
    const repoPath = await prepareRepo(repo);

    const fullPath = path.join(repoPath, filePath);

    // ensure directory exists
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

    fs.writeFileSync(fullPath, content);

    return { message: "File created locally" };

  } catch (err) {
    logger.error(err, "ERROR_CREATE_FILE");
    throw handleError(500, err.message, "ERROR_CREATE_FILE");
  }
}

//
// ✅ CREATE COMMIT (FIXED)
//
async function createCommit(repo, commitMessage = "Auto commit") {
  try {
    const repoPath = await prepareRepo(repo);

    await execAsync(`cd ${repoPath} && git add .`);
    await execAsync(`cd ${repoPath} && git commit -m "${commitMessage}" || true`);
    await execAsync(`cd ${repoPath} && git push`);

    return { message: "Commit pushed successfully" };

  } catch (err) {
    logger.error(err, "ERROR_CREATE_COMMIT");
    throw handleError(500, err.message, "ERROR_CREATE_COMMIT");
  }
}

//
// ✅ CREATE PROJECT (SAME FLOW AS GITLAB)
//
async function createProject(payload, currentUser, projectLead, alfrescoProjectRoot, customFieldsData,
  projectData, category) {
  console.log({
    payload, currentUser, projectLead, alfrescoProjectRoot, customFieldsData,
    projectData, category
  });
  try {
    const coll = projectData?.collaborators?.filter((a) => a?.name !== 'scope-administrators')?.map(e => e?.name?.toLowerCase());
    console.log({ coll })
    // collaborators = collaborators?.map(e =>)
    console.log("INPUT:", payload);

    const name = payload?.name;

    // 1. Create repo
    const repoRes = await createRepo(name);

    const slug = repoRes.slug;   // 🔥 MOST IMPORTANT

    console.log("USING SLUG:", slug);

    // 2. Create files
    await createFile(slug, ".gitignore", "node_modules\n.env");
    await createFile(slug, "README.md", `# ${name}`);
    await createFile(slug, "Code/readme.txt", "Code folder");
    await createFile(slug, "Data/readme.txt", "Data folder");

    // 3. Commit
    await createCommit(slug, "Initial commit");
    // 4. Add users
    const lead = projectLead ? projectLead?.toLowerCase() : "";
    const rules = [
      "read-only",            // Prevent all changes
      "no-deletes",           // Prevent deletion
      "no-force-push",        // Prevent rewriting history
      "pull-request-only"     // Prevent changes without PR
    ];
    // if (lead) {
    //   await addRepoUser({ repoSlug: slug, users: [projectLead], permissionType: "fast-forward-only" });
    // }

    // await addRepoUser({repoSlug: slug, users: coll, permissionType: 'no-deletes'});

    await addRepoUser({ repoSlug: slug, users: [projectLead, ...coll], permissionType: rules });

    // 5. Branch rules
    // await setBranchPermissions(slug);

    return {
      message: "Project created successfully 🚀",
      body: repoRes?.data,
      code: 201
    };

  } catch (err) {
    console.error("ERROR:", err?.message);
    throw err;
  }
}

//
// ✅ BRANCH PERMISSIONS
//
function setBranchPermissions(repo) {
  const matcher = {
    id: "refs/heads/main",
    type: { id: "BRANCH", name: "Branch" }
  };

  const rules = [
    { type: "read-only", users: [{ name: "spw@its.jnj.com" }] },
    { type: "pull-request-only", users: [{ name: "spw@its.jnj.com" }] },
    { type: "no-deletes" },
    { type: "no-force-push" }
  ];

  return Promise.all(
    rules.map(rule =>
      new Promise((resolve, reject) => {
        request({
          method: "POST",
          url: `${BRANCH_URL}/projects/${PROJECT}/repos/${repo}/restrictions`,
          json: true,
          auth: AUTH,
          body: {
            type: rule.type,
            matcher,
            users: rule.users
          }
        }, (error, response, body) => {

          if (error) return reject(error);

          if (response.statusCode >= 200 && response.statusCode < 400) {
            return resolve(body);
          }

          reject(body);
        });
      })
    )
  );
}

export const gitlabProjectServices = {
  createRepo,
  addRepoUser,
  createFile,        // ✅ now works
  createCommit,      // ✅ now works
  createProject,     // ✅ same flow as GitLab
  setBranchPermissions
};