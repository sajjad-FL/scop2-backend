// ----- Project Definition's -----

/**
 * @typedef {Object} Project
 * @property {mongoose.Types.ObjectId} _id Project database id.
 * @property {String} displayName Project name.
 * @property {String} description Project description.
 * @property {String} name Project name - Ceator username (project name - creator username).
 * @property {Object} lead Project lead details.
 * @property {String} lead.displayName Project lead name.
 * @property {String} lead.userName Project lead username.
 * @property {String} key Project key.
 * @property {String} projectID Project id.
 * @property {String} displayId Project display id.
 * @property {Object} gitlab Project gitlab details.
 * @property {String} gitlab.projectUrl gitlab project url.
 * @property {String} gitlab.projectId gitlab project id.
 * @property {String} gitlab.sdsForgeImportLink gitlab link.
 * @property {String[]} gitlab.groupId gitlab group Id.
 * @property {Object} alfresco Project Alfreco details.
 * @property {String} alfresco.projectRoot Alfreco project root.
 * @property {String} alfresco.repositoryId Alfreco repository id.
 * @property {String} alfresco.nodeId Alfreco node id.
 * @property {String[]} alfresco.groupId gitlab group Id.
 * @property {Object[]} collaborators Project collaborators details.
 * @property {String} collaborators.type Project collaborator type.
 * @property {String} collaborators.displayName Project collaborator display name.
 * @property {String} collaborators.name Project collaborator name.
 * @property {String} [collaborators.wWID] Project collaborator user wWID.
 * @property {mongoose.Types.ObjectId} createdBy Project creator.
 * @property {Object[]} comments Project comments.
 * @property {Object[]} customFields Project custom fields.
 * @property {String} [customFields.ta] Project custom field - ta details.
 * @property {String} [customFields.compound] Project custom field - compound details.
 * @property {String} [customFields.lead] Project custom field - lead details.
 * @property {String} [customFields.description] Project custom field - description details.
 * @property {String} [customFields.client] Project custom field - client details.
 * @property {String} [customFields.deliverable] Project custom field - deliverable details.
 * @property {String} [customFields.das_pas] Project custom field - das_pas details.
 * @property {String} [customFields.idpNumber] Project custom field - idpNumber details.
 * @property {String} [customFields.devPhase] Project custom field - devPhase details.
 * @property {String} [customFields.scientist] Project custom field - scientist details.
 * @property {Object} typeData Project typeData.
 * @property {mongoose.Types.ObjectId} typeData.id Project typeData _id.
 * @property {String} typeData.name Project typeData name.
 * @property {Date} createdAt Project createdAt.
 * @property {Date} updatedAt Project updatedAt.
 * @property {Date} startDate Project Start Date.
 * @property {Date} endDate Project End Date.
 * @property {String} status Project status.
 * @property {String} priority Project priority.
 * @property {Boolean} isDeleted Project deleted.
 */

// ----- User Definitions's -----

/**
 * @typedef {Object} LoggedUser
 * @property {mongoose.Types.ObjectId} _id User Id.
 * @property {String} username username.
 * @property {Boolean} isSuperAdmin superAdmin.
 * @property {Object} wWID user wwid.
 * @property {Object} email user email.
 * @property {Object} name user name.
 * @property {Boolean} emailNotification user email preference.
 */

// ----- Group Definitions's -----

/**
 * @typedef {Object} Group
 * @property {mongoose.Types.ObjectId} _id group Id.
 * @property {String} gitlabId gitlab guest group Id.
 * @property {String} alfrescoId alfresco guest group Id.
 * @property {mongoose.Types.ObjectId[]} members members Id.
 */
