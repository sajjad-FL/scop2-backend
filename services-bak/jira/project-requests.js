import mongoose from 'mongoose';
import moment from 'moment';
import _ from 'lodash';

import { uploadCustomFieldsAttachments } from './../../utils/helper.js';
import { ProjectRequest } from '../../models/project-request.js';
import { Category } from '../../models/category.js';
import { Counter } from '../../models/counter.js';
import { Fulfiller as Fulfillers } from '../../models/fulfillers.js';
import { Project } from '../../models/project.js';
import { Type } from '../../models/type.js';
import { User } from '../../models/user.js';
import { CONSTANTS as constants } from '../../utils/constants.js';
import { createRandomString } from '../../utils/randomString.js';
import { jiraProjectServices } from './project.js';
import { logger } from '../../utils/logger.js';
import { sendEmail } from '../../utils/email.js';
import S3 from '../../utils/S3.js';
const ObjectId = new mongoose.Types.ObjectId;

/**
 * Saves the project details in DB
 * @param {Object} data The project properties
*/

function saveProjectRequestDetails (data) {
  return new Promise(async (resolve, reject) => {
    try {
      const instance = new ProjectRequest(data);
      const newProject = await instance.save();
      return resolve(newProject);
    } catch (error) {
      logger.error(error, 'ERROR_DB_SAVE');
      if (error.code === 11000) {
        return reject({ message: 'Duplicate: Project with same name already exist in system', code: 403, error: 'ERROR_DB_SAVE' });
      }
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_SAVE' });
    }
  })
};

/**
 * Convert dropdown-many custom field to message text
 * @param {Object} customField custom value
 * @returns {String} message
*/

function recursiveCustomValue (customField) {
  const value = customField.value?.name || customField.value;
  let message = `<tr><td>${customField.name}: </td><td>${value === '-' ? 'N/A' : value}</td></tr>`;
  if (customField.value?.name) {
    message += recursiveCustomValue({ ...customField.value, name: `${customField.name}-${customField.value.name}` });
  }
  return message;
};

async function sendEmailToFulfillers(projectRequest, recipients, currentUser) {
  try {
    const category = await Category.findOne({ _id: projectRequest.categoryId }).lean();
    const customFields = projectRequest?.customFields ?? [];

    const getCustomValue = (fieldName, fieldType) =>
      customFields.find(f => f.name === fieldName && (!fieldType || f.type === fieldType))?.value ?? 'N/A';

    const clinicalProgram = getCustomValue('Clinical Program', 'DROPDOWN');
    const additionalDetails = getCustomValue('Additional Details', 'TEXTAREA');
    const requestPriority = getCustomValue('Request Priority', 'DROPDOWN');
    const studyID = getCustomValue('Study ID');
    const teamToBeNotified = getCustomValue('Team To Be Notified');
    const IdpOrWbs = getCustomValue('IDP(s) or WBS');
    const requestOnBehalfOf = getCustomValue('Request on Behalf of');
    const deliveryDeadline = getCustomValue('Delivery Deadline');
    const databaseSnapshot = getCustomValue('Database snapshot(s)', 'TEXTAREA')
    const accountableBudgetOwner = getCustomValue('Accountable Budget Owner (Funder) of the Request')
    const hasAttachments = projectRequest.files?.length > 0;
    const attachmentSize = hasAttachments
      ? projectRequest.files.reduce((acc, { size = 0 }) => acc + size, 0)
      : 0;

    const shouldIncludeAttachment = attachmentSize / 1_000_000 < 20;
    const attachments = shouldIncludeAttachment
      ? projectRequest?.files?.map(({ name, data }) => ({
          filename: name,
          content: data.split(',')[1],
          encoding: 'base64',
        }))
      : [];

    const requestLink = `${process.env.UI_HOST}/dashboard/requests/view-${projectRequest.requestID}`;
    const requestPurpose = projectRequest?.typeData?.name ?? 'N/A';
    
    let primaryFulfillers = recipients.filter(r => r.isPrimarySP || r.isPrimarySDS);
    let otherFulfillers = recipients.filter(r => !r.isPrimarySP && !r.isPrimarySDS && !r.isTypeFulfiller);

    // Fallback if no primary found
    if (primaryFulfillers.length === 0) {
      primaryFulfillers = recipients.filter(r => !r.isPrimarySP && !r.isPrimarySDS && !r.isTypeFulfiller);
      otherFulfillers = [];
    }

    // Fallback again
    if (primaryFulfillers.length === 0) {
      primaryFulfillers = recipients.filter(r => r.isTypeFulfiller);
    }

    otherFulfillers.push(currentUser);

    const toEmails = [...new Set(primaryFulfillers.map(r => r.email.toLowerCase()))].join(', ');
    const ccEmails = [...new Set(otherFulfillers.map(r => r.email.toLowerCase()))].join(', ');

    if (!toEmails) {
      return { message: 'No fulfillers available for this template', code: 404 };
    }

    const invitees = primaryFulfillers
      .map(r => r.name)
      .reduce((msg, name, idx, arr) => {
        if (arr.length === 1) return name;
        if (idx < arr.length - 2) return `${msg}${name}, `;
        if (idx === arr.length - 2) return `${msg}${name} and ${arr[idx + 1]}`;
        return msg;
      }, '');

    const emailData = {
      to: toEmails,
      cc: ccEmails,
      bcc: 'spiotrow@its.jnj.com',
      subject: `${requestPurpose} (${projectRequest.displayId}) for ${clinicalProgram}`,
      attachments,
      html: `
        Hi ${invitees},
        <br><br>
        A Post Hoc Analysis has been requested by ${projectRequest.createdBy?.name}. Please see below for the details:
        <br><br>
        <table style="margin-left: 40px;">
          <tbody>
            <tr><td>Request Id: </td><td>${projectRequest.displayId ?? 'N/A'}</td></tr>
            <tr><td>Request Date/Time: </td><td>${moment().format('MMMM DD, YYYY h:mm A')}</td></tr>
            <tr><td>Brief Description: </td><td>${projectRequest.displayName ?? 'N/A'}</td></tr>
            <tr><td>Priority: </td><td>${requestPriority}</td></tr>
            <tr><td>Therapeutic Area: </td><td>${(category?.name ?? 'N/A').split('-')[0]}</td></tr>
            <tr><td>Clinical Program: </td><td>${clinicalProgram}</td></tr>
            <tr><td>Study ID: </td><td>${studyID}</td></tr>
            <tr><td>Late Development: </td><td>${teamToBeNotified}</td></tr>
            <tr><td>Purpose: </td><td>${requestPurpose}</td></tr>
            <tr><td>Accountable Budget Owner (Funder) of the Request: </td><td>${accountableBudgetOwner?.name || "-"}</td></tr>
            <tr><td>IDP(s) or WBS: </td><td>${IdpOrWbs}</td></tr>
            <tr><td>Request on Behalf of: </td><td>${requestOnBehalfOf}</td></tr>
            <tr><td>Delivery Deadline: </td><td>${deliveryDeadline}</td></tr>
            <tr><td>Database snapshot(s) to be used for the request: </td><td>${databaseSnapshot}</td></tr>
            <tr><td>Additional Details: </td><td>${additionalDetails}</td></tr>
          </tbody>
        </table>
        <br>
        ${!shouldIncludeAttachment ? '<p style="color: red;">Attachment too large to email. The attachment(s) will be available on the request’s details page in Scope.</p>' : ''}
        <br>
        <span style="margin-left: 40px;">The full request can be viewed <a href="${requestLink}">here</a>.</span><br><br>
        Once you review the request, please reach out to the requester on the cc line (and cross-functional team as needed) to determine the scope and support of the request.
        <br><br>Sincerely,<br>Team Scope<br><br>
      `,
    };

    await sendEmail(emailData);
    return emailData;
  } catch (error) {
    console.error('EMAIL ERROR:', error);
    logger.error('ERROR_SEND_EMAIL', error);
    throw { message: 'No fulfillers available for this template', code: 404 };
  }
}


/**
 * Upload request attachments to S3 bucket
 * @param {Array<{ data: String, name: String }>} files Request attachments
 * @param {String} requestId Request Id or display Id
 * @returns {Promise<Promise<String>[]>}
*/

function uploadRequestAttchments(files, requestId) {
  return new Promise(async (resolve, reject) => {
    try {
      const s3 = new S3();
      const prefix = process.env.NODE_ENV === 'production' ? 'Requests' : 'ProjectRequest';
      const defaultUploadPath = `${prefix}/${requestId}/`;

      const uploads = files.map((file) => {
        const content = Buffer.from(file.data);
        const fileName = defaultUploadPath + file.name;
        return s3.upload(fileName, content);
      });

      return resolve(uploads);
    } catch (error) {
      return reject({ code: 500, message: 'Something went wrong', error });
    }
  })
};

/**
 * Sort object by keys
 * @param {Object} object object
 * @returns {Object} key-sorted object
*/
const sortObjectkeys = (object) => {
  return Object.keys(object).sort().reduce((obj, key) => {
    obj[key] = object[key];
    return obj;
  }, {});
}

/**
 * Get fulfillers for the request by custom fields- Attributes
 * @param {Object} request project request details
 * @param {Object} request.typeData template details
 * @param {import('aws-sdk/clients/batch').String} request.typeData.id template Id
 * @returns {Promise<{ name: String, email: String, username: String, wWID: String }[]>}
 */

async function getRequestFulfillers(request) {
  try {
    const data = await Fulfillers.findOne({ typeId: request?.typeData?.id }).lean();

    if (!data) return [];

    const { attributeSet, fulfillers: defaultFulfillers = [] } = data;

    // Handle case with attributeSet
    if (Array.isArray(attributeSet) && attributeSet.length > 0) {
      let fulfillers = [];

      for (const attribute of attributeSet) {
        const matchesAll = attribute.attributes.every((list) => {
          return request.customFields.some((field) => {
            const namesMatch = field.name.toLowerCase() === list.name.toLowerCase();
            const typesMatch = field.type === list.type;

            if (field.type === 'DROPDOWNMANY' && list.type === 'DROPDOWNMANY') {
              return namesMatch &&
                JSON.stringify(sortObjectkeys(field.value)).toLowerCase() ===
                JSON.stringify(sortObjectkeys(list.value)).toLowerCase();
            }

            return namesMatch &&
              typesMatch &&
              field.value?.toLowerCase?.() === list.value?.toLowerCase?.();
          });
        });

        if (matchesAll) {
          fulfillers.push(...attribute.fulfillers);
        }
      }

      if (fulfillers.length > 0) {
        return _.uniqBy(fulfillers, 'email');
      }

      return _.uniqBy(defaultFulfillers, 'email');
    }

    // Fallback to default fulfillers if no attributeSet match
    return _.uniqBy(defaultFulfillers, 'email');
  } catch (error) {
    console.error('Error in getRequestFulfillers:', error);
    return [];
  }
}


/**
 * Creates a project.
 *
 * @param {Object} opts The request options.
 * @param {Object} opts.project The project properties.
 * @param {Object} curentUser The details of current logged-in user.
 */
async function createProjectRequest(opts, currentUser) {
  try {
    // Step 1: Generate a project key
    const key = createRandomString('', 4);

    // Step 2: Increment and fetch updated counter
    const counterData = await Counter.findOneAndUpdate(
      { type: 'requestID' },
      { $inc: { count: 1 } },
      { new: true, strict: true, runValidators: true }
    ).lean();

    if (!counterData) {
      throw {
        message: 'Error in updating Project ID count',
        code: 500,
        error: 'ERROR_DB_COUNTER_UPDATE'
      };
    }

    const requestID = counterData.count.toString();
    const originalData = { ...opts.project };

    originalData.key = `P${key.toUpperCase()}`;
    originalData.requestID = requestID;

    // Step 3: Add createdBy metadata
    const { name, username, wWID, email } = currentUser ?? {};
    originalData.createdBy = { name, username, wWID, email };

    // Step 4: Upload FILEINPUT custom fields
    const fileInputFields = originalData.customFields?.filter(
      cf => cf.type === 'FILEINPUT' && cf.values?.length
    ) ?? [];

    for (const fileData of fileInputFields) {
      try {
        const uploadedFiles = await uploadCustomFieldsAttachments(
          'requests',
          fileData.values,
          requestID,
          fileData.name
        );

        if (uploadedFiles?.length) {
          fileData.values = fileData.values.map(({ name }) => ({
            name,
            link: `${process.env.NODE_ENV === 'production' ? 'production' : 'staging'}/requests/${requestID}/${fileData.name}`
          }));
        }
      } catch (uploadError) {
        logger.error(uploadError, 'ERROR_CUSTOM_FIELD_FILE_UPLOAD');
        throw {
          code: 400,
          message: 'Failed to upload attachments in custom fields'
        };
      }
    }

    // Step 5: Check if request should be automated
    const isAutomateRequest = await shouldAutomateRequest(originalData?.typeData?.id);

    // Step 6: Save request in DB
    const dbRes = await createScopeProjectRequest(originalData, currentUser, isAutomateRequest);

    // Step 7: If automation enabled, sync to project system
    if (isAutomateRequest) {
      const project = await syncProjectRequest(dbRes.request, currentUser);
      return { ...dbRes, project };
    }

    return dbRes;

  } catch (err) {
    logger.error(err, 'ERROR_CREATE_PROJECT_REQUEST');

    if (err.code === 11000) {
      throw {
        message: 'Duplicate: Counter with same value already exists in system',
        code: 403,
        error: 'ERROR_DB_COUNTER_UPDATE'
      };
    }

    throw err.code
      ? err
      : {
          message: 'Error in creating project request',
          code: 500,
          error: 'ERROR_CREATE_PROJECT_REQUEST'
        };
  }
}

/**
 * Get all projects from DB
 * @return {Promise} Resolved when the project has been retrieved.
*/
function getAllProjectsFromDB (opts) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get filter criteria from project services
      const filter = await jiraProjectServices.filterProjects(opts);
      const pipeline = [
        {
          $lookup: {
            from: 'categories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'categoryId',
          },
        },
        {
          $addFields: {
            requestedBy: '$createdBy.name',
          },
        },
        {
          $addFields: {
            area: {
              $filter: {
                input: '$customFields',
                as: 'cf',
                cond: { $eq: ['$$cf.name', 'Clinical Program'] },
              },
            },
          },
        },
        {
          $addFields: {
            requestPriority: {
              $filter: {
                input: '$customFields',
                as: 'cf',
                cond: { $eq: ['$$cf.name', 'Request Priority'] },
              },
            },
          },
        },
        { $unwind: { path: '$area', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$requestPriority', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            compoundArea: '$area.value',
            priority: '$requestPriority.value',
          },
        },
        {
          $lookup: {
            from: 'projects',
            localField: 'projectId',
            foreignField: '_id',
            as: 'projectDetails',
          },
        },
        { $match: filter },
        { $unwind: { path: '$categoryId', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            therapeuticArea: '$categoryId.name',
          },
        },
      ];

      // Sorting logic
      const sortStageIndex = pipeline.length;
      let sortBy = opts.sortBy || 'createdAt';
      if (sortBy === 'categoryId') {
        sortBy = 'categoryId.name';
      }

      const sortOrder = opts.sort || -1;
      const sortObj = { $sort: { [sortBy]: sortOrder } };

      if (sortBy !== 'createdAt') {
        sortObj.$sort.createdAt = -1;
      }

      pipeline.splice(sortStageIndex, 0, sortObj);

      // Pagination or full list
      const facetStage = {
        $facet: {
          stage1: [{ $group: { _id: null, count: { $sum: 1 } } }],
          stage2: [],
        },
      };

      if (opts.page !== 'all') {
        const skip = opts.page > 0 ? (opts.page - 1) * opts.perPage : 0;
        facetStage.$facet.stage2 = [
          { $skip: skip },
          { $limit: opts.perPage },
        ];
      }

      pipeline.push(facetStage);
      pipeline.push({ $unwind: '$stage1' });
      pipeline.push({
        $project: {
          count: '$stage1.count',
          projects: '$stage2',
        },
      });

      // Aggregate query execution
      const pData = await ProjectRequest.aggregate(pipeline).exec();

      const projectRequest = (Array.isArray(pData) && pData.length && pData[0]) || { count: 0, projects: [] };

      return resolve({
        code: 200,
        message: 'Project request fetched',
        success: true,
        count: projectRequest.count,
        projects: projectRequest.projects,
      });
    } catch (error) {
      logger.error(error, 'ERROR_DB_FIND_PROJECTS');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_PROJECTS',
      });
    }
  })
}

/**
 * Get all projects requests
*/
function jiraGetAllProjectRequests (opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const projects = await getAllProjectsFromDB(opts);
      return resolve(projects);
    } catch (error) {
      return reject(error);
    }
  })
}

/**
 * Create Scope project.
 *
 * @param {Project} project - Project details
 * @param {User} currentUser - API Requester
 * @param {Boolean} isAutomateRequest - Check if the request should be automated
 * @returns {Promise<Object>} Resolved when the project has been created
 */
function createScopeProjectRequest(project, currentUser, isAutomateRequest) {
  return new Promise(async (resolve, reject) => {
    try {
      // Default custom field values
      const customFieldsData = {
        ta: 'NA',
        compound: 'NA',
        description: project.description,
        client: 'NA',
        deliverable: 'NA',
        das_pas: 'NA',
        idpNumber: 'NA',
        devPhase: 'NA',
        scientist: 'NA',
      };

      // Set initial status if request is automated
      if (isAutomateRequest) {
        project.status = constants.PROJECT_REQUEST.STATES.RECEIVED;
      }
      
      // Extract custom fields
      if (Array.isArray(project.customFields) && project.customFields.length) {
        for (const item of project.customFields) {
          const name = item?.name?.toLowerCase();
          const value = typeof item?.value === 'string' ? item?.value?.trim() : item?.value;
  
          if (['compound name or number', 'compound name or #'].includes(name)) {
            customFieldsData.compound = value;
          } else if (['ta', 'therapeutic area'].includes(name)) {
            customFieldsData.ta = value;
          } else if (name === 'das/pas') {
            customFieldsData.das_pas = value;
          } else if (name === 'development phase') {
            customFieldsData.devPhase = value;
          } else if (name === 'idp number') {
            customFieldsData.idpNumber = value;
          } else if (name === 'scientist') {
            customFieldsData.scientist = value;
          } else if (name === 'client name') {
            customFieldsData.client = value;
          } else if (name === 'deliverable') {
            customFieldsData.deliverable = value;
          }
        }
      }
  
      project.displayId = `${moment().format('YYYY')}-${project.requestID}`;
  
      // Upload files if present
      if (Array.isArray(project.files) && project.files.length) {
        try {
          await uploadRequestAttchments([...project.files], project.displayId);
          project.hasAttachments = true;
        } catch (error) {
          throw { message: 'ERROR_IN_UPLOADING_FILES', code: 404, error };
        }
      }
  
      // Get fulfillers
      const fulfillers = await getRequestFulfillers(project);
      project.fulfillers = fulfillers;

      // Save project request
      const _request = await saveProjectRequestDetails(project);

      // Send email to fulfillers
      await sendEmailToFulfillers(project, fulfillers, currentUser);

      // Mark email status as true
      await ProjectRequest.findByIdAndUpdate(
        _request._id,
        { emailStatus: true },
        { new: true, strict: true, runValidators: true }
      );
  
      // Return final result
      return resolve({
        message: `Request (${project.displayId}) Created Successfully in Scope.`,
        code: 207,
        id: project.requestID,
        key: project.key,
        displayId: project.displayId,
        request: { ...project, ..._request?._doc, fulfillers: [...project.fulfillers] },
      });
  
    } catch (error) {
      logger.error(error, 'ERROR_CREATE_REQUEST');
      return reject({
        code: error.code || 500,
        message: error.message || 'Something went wrong',
        error: error.error || error,
      });
    }
  })
}

// Check if request should be automated.
const shouldAutomateRequest = async (typeId) => {
  if (!typeId) return false;

  try {
    const automateRequest = await Type.findOne({
      _id: typeId,
      automateRequest: true,
    }).lean();
    return Boolean(automateRequest);
  } catch(err){
    console.error('shouldAutomateRequest error:', err);
    return false;
  }
};


function syncProjectRequest(request, currentUser) {
  return new Promise(async (resolve, reject) => {
    try {
      const { customFields, ...rest } = request;
  
      const requestCategory = await Category.findOne({ isTA: true, _id: request?.categoryId }).lean();
      if (!requestCategory || !requestCategory.name || !requestCategory.name.includes('-TA')) {
        return reject({
          success: true,
          code: 203,
          message: 'Request created successfully but failed to automate project creation (Unable to find request TA)',
          data: request,
        });
      }
  
      const [categoryName] = requestCategory.name.split('-TA');
      const category = await Category.findOne({ isTA: false, name: { $regex: categoryName, $options: 'i' } }).lean();
      if (!category) {
        return reject({
          code: 203,
          message: 'Request created successfully but failed to automate project creation (Unable to link request TA with department)',
          success: true,
          data: request,
        });
      }
  
      const type = await Type.findOne({
        isDeleted: false,
        isTA: false,
        isRequest: true,
        categoryId: category._id,
        isEnabled: true,
      }).lean();
  
      if (!type) {
        return reject({
          code: 203,
          message: `Request created successfully but failed to automate project creation (No templates available for ${category.name} department)`,
          success: true,
          data: request,
        });
      }
  
      const project = {
        name: request?.name,
        displayName: request?.displayName,
        categoryId: category._id,
        typeData: {
          name: type.name,
          id: type._id,
        },
        importProjectCustomType: type.name,
        status: constants?.PROJECT?.STATUS?.TO_DO,
        requestMeta: {
          requestId: request?._id,
          typeId: request?.typeData?.id,
          categoryId: request?.categoryId,
          displayId: request?.displayId,
        },
        startDate: request?.createdAt,
        customFields: [],
        collaborators: [],
        notes: '',
        isAutomateRequest: true,
      };
  
      // Assign custom fields
      try {
        const requestCustomFields = _.cloneDeep(request?.customFields || []);
        const projectCustomFields = sanitizeCustomFields(type.attributes || []);
        const mergedCustomFields = _.uniqBy([...requestCustomFields, ...projectCustomFields], 'name');
  
        const requestPriorityIndex = mergedCustomFields.findIndex(cf => cf.name === 'Request Priority');
        if (requestPriorityIndex > -1) {
          mergedCustomFields[requestPriorityIndex].name = 'Project Priority';
        }
  
        project.customFields = mergedCustomFields;
      } catch (error) {
        logger.error(error, 'ERROR_ASSIGN_PROJECT_CUSTOM_FIELDS');
        return reject({
          success: false,
          code: 203,
          message: 'Failed to automate project creation, Request created successfully',
          data: request,
        });
      }
  
      // Assign collaborators and lead
      try {
        const fulfillers = _.cloneDeep(request?.fulfillers || []);
        const categorized = fulfillers.reduce(
          (acc, fulfiller) => {
            if (fulfiller.isPrimarySP) acc.primarySP.push(fulfiller);
            else if (fulfiller.isPrimarySDS) acc.primarySDS.push(fulfiller);
            else if (fulfiller.isTypeFulfiller) acc.defaultFulfiller.push(fulfiller);
            else acc.otherFulfiller.push(fulfiller);
            return acc;
          },
          { primarySP: [], primarySDS: [], otherFulfiller: [], defaultFulfiller: [] }
        );
  
        const collaborators = [
          ...categorized.primarySDS,
          ...categorized.primarySP,
          ...categorized.otherFulfiller,
          ...categorized.defaultFulfiller,
        ].map(user => ({
          userName: user.username?.toLowerCase() || '',
          displayName: user.name || '',
          type: 'user',
          wWID: user.wWID || '',
        }));
  
        let [projectLead, ...projectCollaborators] = collaborators;
  
        if (!projectLead) {
          projectLead = await fetchRequestAdminDetails();
        }
  
        project.lead = projectLead;
        project.collaborators = projectCollaborators;
      } catch (error) {
        logger.error(error, 'ERROR_ASSIGN_PROJECT_LEAD_COLLABORATORS');
        return reject({
          success: false,
          code: 203,
          message: 'Failed to automate project creation, Request created successfully',
          data: request,
        });
      }
  
      // Create project
      const projectOpts = {
        project,
        versionControl: true,
      };
      let currUser = currentUser;
      if (!currUser?._id && currUser?.username) {
        const user = await User.findOne({
          username: currUser.username,
        }).lean();

        if (user?._id) {
          currUser = user;
        }
      }
      if (!currUser?._id && project.collaborators?.length) {
        for (const el of project.collaborators) {
          const user = await User.findOne({
            username: el.userName,
          }).lean();
          console.log({ user })
          if (user?._id) {
            currUser = user;
            break;
          }
        }
      }
      if (!currUser?._id) {
        return Promise.reject({
          success: false,
          code: 403,
          message: 'Unable to identify user to create project',
        });
      }
      try {
        const projectData = await jiraProjectServices.createProject(projectOpts, currentUser);
        if (!projectData) { 
          return reject({
            code: 203,
            message: 'Request created successfully but failed to create project in scope',
            success: false,
          });
        }
  
        return resolve(project);
      } catch (error) {
        return reject({
          code: 203,
          message: 'Request created successfully but failed to create project in scope',
          success: true,
        });
      }
    } catch (error) {
      logger.error(error, 'ERROR_AUTOMATE_REQUEST');
      return reject(error);
    }
  })
}

// Get request admin details for project automation from request.
function fetchRequestAdminDetails(){
  return new Promise(async (resolve, rejec) => {
    try {
      const user = await User.findOne({ username: constants.DEFAULT_USERS.REQUEST_ADMIN.USERNAME }).lean();
      if (user) {
        return resolve({
          userName: user?.username,
          displayName: user?.name,
          wWID: user?.wWID,
        });
      }
      return resolve({
        message: 'Request Admin Not Found',
        code: 204
      });
    } catch (error) {
      return reject(error);
    }
  })
}

const sanitizeCustomFields = (customFields = []) => {
  try {
    const cf = [];
    for (let index = 0; index < customFields.length; index += 1) {
      const customField = customFields[index];
      // Custom field is valid as required criteria is fulfilled
      const cField = { ...customField };
      switch (cField?.type) {
        case 'DATE':
        case 'LIST':
        case 'LISTMANY':
        case 'LDAP':
        case 'LDAPMANY':
        case 'DROPDOWN':
        case 'DROPDOWNMANY': {
          cField.value = 'N/A';
          break;
        }
        case 'INPUT':
        case 'HYPERLINK':
        case 'NUMBER':
        case 'TEXTAREA': {
          cField.value = '-';
          break;
        }
        default: {
          cField.value = '-';
          break;
        }
      }
      cf.push(cField);
    }
    return cf;
  } catch (error) {
    logger.error(error, 'ERROR_VALIDATE_CUSTOM_FIELDS');
    return customFields;
  }
}

  // OLDER_APPROACH

/**
 * Get direct reports projects by user id
 * @param {Array} id The user wWID's Array.
 * @param {String|Number} opts.perPage The projects limit per page.
 * @param {String} opts.query The search term for searching projects.
 * @param {String} opts.quarter The quarter name to filter projects.
 * @param {String} opts.startDate The start date to filter projects
 * @param {String} opts.endDate The end date to filter projects.
 * @return {Promise} Resolved when the projects corresponding to user data has been retrieved.
 */
function getProjectRequests(opts) {
  return new Promise(async (resolve, reject) => {
    const filter = jiraProjectServices.filterProjects(opts);
    const pipeline = [
      {
        $lookup:
        {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'categoryId',
        },
      },
      { $match: filter },
      // output projection
    ];
    pipeline.splice(2, 0, { $sort: { createdAt: -1 } });
    try {
      const pData = await ProjectRequest.aggregate(pipeline).exec();
      if (pData && Array.isArray(pData) && pData.length > 0) {
        // 1.b. Project data found, resolve with data
        const uniqArr = pData.reduce((acc, current) => {
          const x = acc.find((item) => { return item.name === current.name; });
          if (!x) {
            return acc.concat([current]);
          }
          return acc;
        }, []);
        const queryLanguageProjects = [];
        const finalArr = uniqArr.map((data) => {
          const result = data;
          const categoryData = result.categoryId[0];
          result.categoryId = categoryData;
          if (opts.queryLanguage && (opts.queryLanguage.indexOf('&') !== -1 || opts.queryLanguage.indexOf('|') !== -1 || opts.queryLanguage.indexOf('!') !== -1 || opts.queryLanguage.indexOf('(') !== -1 || opts.queryLanguage.indexOf(')') !== -1)) {
            const customData = JSON.parse(JSON.stringify(result));
            customData.categoryId = customData.categoryId.name;
            customData.typeData = customData.typeData.name;
            customData.customFieldsName = _.map(customData.customFields, 'name').join(',');
            customData.customFieldsValue = _.map(customData.customFields, 'value').join(',');
            const searchTermArr = opts.queryLanguage.split(/(\(|\)|&|!|\|)/g); // split with &,!,|,(,) with keeping seperators
            const finalSearchTermArr = searchTermArr.filter((str) => { return /\S/.test(str); }); // remove all whitespaces from array
            const finalQueryArr = [];
            finalSearchTermArr.forEach((item) => {
              if (item === '&') {
                finalQueryArr.push('&&');
              } else if (item === '|') {
                finalQueryArr.push('||');
              } else if (item === '!') {
                finalQueryArr.push('&& !');
              } else if (item === '(') {
                finalQueryArr.push('(');
              } else if (item === ')') {
                finalQueryArr.push(')');
              } else {
                const field = item.trim();
                const fieldExists = Object.keys(customData).some((k) => {
                  const value = customData[k].toString();
                  return value.toLowerCase().includes(field.toLowerCase());
                });
                finalQueryArr.push(fieldExists);
              }
            });
            if (finalQueryArr.length) {
              let finalStr = finalQueryArr.join(' ');
              if (finalStr.indexOf('&&') === 0 || finalStr.indexOf('||') === 0) {
                finalStr = `true ${finalStr}`;
              }
              let evalResult = '';
              try {
                evalResult = eval(finalStr); // eslint-disable-line
              } catch (err) {
                if (err) {
                  return false;
                }
              }
              if (evalResult) {
                queryLanguageProjects.push(result);
                return true;
              }
              return false;
            }
          }
          return result;
        });

        const allP = queryLanguageProjects.length > 0 ? _.filter(queryLanguageProjects, ['isDeleted', false]) : _.filter(finalArr, ['isDeleted', false]);
        const finalP = _.filter(allP, 'createdAt');
        if (opts.page) {
          const skip = opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0;
          const slicedP = finalP.slice(skip).slice(0, opts.perPage);
          return resolve({
            projects: slicedP,
            totalCount: finalP.length,
          });
        } else {
          return resolve({
            projects: finalP,
            totalCount: finalP.length,
          });
        }
      } else {
        // 1.c Project data empty, resolve it
        return resolve({
          projects: [],
          totalCount: 0,
        });
      }
    } catch (error) {
      // 1.a If error, reject with error
      logger.error(findErr, 'ERROR_DB_FIND_PROJECT_DETAILS');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_PROJECT_DETAILS',
      });
    }
  });
}

/**
 * Get project details from DB
 * @return {Promise} Resolved when the project data has been retrieved.
 */
async function getRequestDetailsFromDB(id) {
  try {
    // Step 1: Fetch project request from DB with related data
    const pData = await ProjectRequest.findOne({ requestID: id })
      .populate('categoryId', '_id self name description createdAt updatedAt __v')
      .populate('typeData.id', '_id createdAt updatedAt name categoryId attributes isEnabled htmlFile __v')
      .populate('projectId', '_id displayId')
      .lean();
    if (!pData) {
      logger.error(`No project found for requestID: ${id}`, 'ERROR_DB_FIND_PROJECT');
      throw {
        message: 'Error in finding project data',
        code: 404,
        error: 'ERROR_DB_FIND_PROJECT',
      };
    }

    const data = JSON.parse(JSON.stringify(pData));
    const fileInputFields = data.customFields?.filter(
      cf => cf.type === 'FILEINPUT' && cf.values?.length
    ) ?? [];

    if (!fileInputFields.length) {
      return data;
    }

    // Step 2: Handle FILEINPUT fields
    const s3 = new S3();

    await Promise.all(fileInputFields.map(async (cfField) => {
      const cfIndex = data.customFields.findIndex(
        cf => cf.name === cfField.name && cf.type === cfField.type
      );

      try {
        const fileResults = await s3.fetchFilesByFolder(cfField.values[0].link);
        const fulfilledFiles = (await Promise.allSettled(fileResults))
          .filter(res => res.status === 'fulfilled')
          .map(res => res.value);

        data.customFields[cfIndex].values = fulfilledFiles;
      } catch (err) {
        throw {
          message: 'Error in finding attachments',
          code: 500,
          error: 'ERROR_IN_FINDING_ATTACHMENTS',
          stackTrace: err,
        };
      }
    }));

    return data;
  } catch (err) {
    logger.error(err, 'ERROR_DB_FIND_PROJECT');
    throw err.code
      ? err
      : {
          message: 'Internal Server Error',
          code: 500,
          error: 'ERROR_DB_FIND_PROJECT',
        };
  }
}


/**
 * Get a project request by id or key
 * @param {Object} opts The request options.
 * @param {String} opts.projectIdOrKey The id or key of the project.
 * @return {Promise} Resolved when the project data has been retrieved.
 */
function getProjectRequestById(opts) {
  return new Promise((resolve, reject) => {
    // 1 Get project details from DB
    getRequestDetailsFromDB(opts.requestId).then((dbRes) => {
      // 1.a If found, resolve with data
      if (dbRes) {
        return resolve(dbRes);
      }
    }).catch((dbErr) => {
      // 1.b Project details from DB failed
      return reject(dbErr);
    });
  });
}

function arrayEqual(a1, a2) {
  return JSON.stringify(a1) === JSON.stringify(a2);
}

/**
 * Updates the project request details in DB
 * @author Aniket
 * @param {Object} data The project properties
*/
async function updateProjectRequest(data, currentUser) {
  try {
    const { requestID, key, id, payload } = data;
    const isCategoryUpdate = payload?.updateType === 'category';

    // Step 1: Define update filter and data
    let filter = requestID
      ? { projectID: requestID }
      : { key };

    let update = requestID
      ? { $set: payload }
      : {
          $set: {
            requestID: id,
            displayId: `${moment().format('YYYY')}-${id}`,
          }
        };

    if (isCategoryUpdate) {
      filter = { projectID: requestID };
      update = { $set: { categoryId: payload.categoryId } };
    }

    // Step 2: Get request data and check for changes in custom fields
    const requestData = await ProjectRequest.findOne({ requestID }).populate('categoryId').lean();
    const fulfillers = await getRequestFulfillers(requestData);
    const isCustomFieldsSame = arrayEqual(requestData.customFields, payload?.customFields);
    update.$set = { ...update.$set, fulfillers };

    // Step 3: Try updating Project collection first
    const projectUpdateRes = await Project.findOneAndUpdate(filter, update, {
      new: false,
      strict: true,
      runValidators: true,
    }).lean();

    // Determine the appropriate filter for ProjectRequest update
    const requestFilter = projectUpdateRes
      ? { _id: projectUpdateRes.requestId }
      : { requestID };

    // Step 4: Update ProjectRequest
    const requestUpdateRes = await ProjectRequest.findOneAndUpdate(requestFilter, update, {
      new: false,
      strict: true,
      runValidators: true,
    }).lean();

    if (!requestUpdateRes) {
      throw {
        message: 'Project Request update failed',
        code: 500,
        error: 'ERROR_DB_PROJECT_REQUEST_UPDATE',
      };
    }

    // Step 5: Send email if customFields changed
    if (!isCustomFieldsSame) {
      requestData.customFields = payload.customFields;
      await sendEmailToFulfillers(requestData, fulfillers, currentUser);
    }

    return requestUpdateRes;

  } catch (err) {
    logger.error(err, 'ERROR_DBPROJECT_UPDATE');
    throw err.code
      ? err
      : {
          message: 'Error updating project request',
          code: 500,
          error: 'ERROR_DB_PROJECT_UPDATE',
        };
  }
}

/**
 * Deletes project permanently from Db
 *
 * @method deleteProjectPermanent
 * @param opts The request options sent to the Jira API.
 * @param {String} opts.auth The auth details of the requesting user.
 * @param {String} opts.projectIdOrKey The project id or project key.
 * @param {String} gitlabId The ID of Gitlab project.
 * @return {Promise} Resolved when the project has been deleted permanently.
 */
const deleteProjectRequest = async (opts) => {
  try {
    // 1. Find project request
    const projectRequest = await ProjectRequest.findOne({
      requestID: opts.requestId,
    });

    if (!projectRequest) {
      return {
        message: "Project request not found",
        code: 404,
      };
    }

    // 2. If linked project exists → delete it
    if (projectRequest.projectId) {
      await Project.deleteOne({
        _id: new mongoose.Types.ObjectId(projectRequest.projectId),
      });
    }

    // 3. Delete project request
    await ProjectRequest.deleteOne({
      requestID: opts.requestId,
    });

    return {
      message: "Project request deleted successfully",
      code: 200,
    };

  } catch (error) {
    logger.error(error, "ERROR_DB_DELETE_LINKED_PROJECT");

    throw {
      message: "Failed to delete project request",
      code: 500,
      error: "ERROR_DB_DELETE_LINKED_PROJECT",
    };
  }
};


function getUnRespondedRequests(opts) {
  return new Promise((resolve, reject) => {
    try {
      if (!opts.startDate) {
        opts.startDate = '2000-01-01';
      }

      if (!opts.endDate) {
        opts.endDate = moment().format('YYYY-MM-DD');
      }

      /**
       * Purpose pipeline
       * @description Get purpose and therapeuticArea of the requests at root level, Users can
       * easily seaarch by purpose and therapeuticArea text without typeData.id and categoryId lookup.
       *
       * $match: Get purpose/type associated with the request
       * $lookup: fetch therapeuticArea name
       * $unwind: flat lookup
       * $project: data clean-up, purpose and TA is associated with - TA flag so split and trim values
       */
      const purposePipeline = [
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: ['$isTA', true],
                  $eq: ['$_id', '$$purposeId'],
                },
              ],
            },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'therapeuticArea',
          },
        },
        { $unwind: { path: '$therapeuticArea', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            purpose: {
              $cond: {
                if: {
                  $eq: ['$isDeleted', true],
                },
                then: {
                  $substr: [
                    '$name',
                    0,
                    {
                      $add: [
                        {
                          $strLenCP: '$name',
                        },
                        -15,
                      ],
                    },
                  ],
                },
                else: '$name',
              },
            },
            therapeuticArea: {
              $first: {
                $split: ['$therapeuticArea.name', '-'],
              },
            },
          },
        },
        {
          $project: {
            purpose: {
              $first: {
                $split: ['$purpose', '-'],
              },
            },
            therapeuticArea: 1,
          },
        },
        {
          $project: {
            purpose: {
              $trim: {
                input: '$purpose',
              },
            },
            therapeuticArea: {
              $trim: {
                input: '$therapeuticArea',
              },
            },
          },
        },
      ];

      /**
       * purpose lookup
       * @description lookup for type/purpose details by typeData.id
       */
      const purposeLookup = {
        $lookup: {
          from: 'types',
          let: { purposeId: '$typeData.id' },
          pipeline: purposePipeline,
          as: 'purpose',
        },
      };

      /**
       * purpose query
       * @description Get purpose and therapeuticArea details from types and categories collection
       * purposeLookup: Get purpose and therapeuticArea
       * $unwind: flat lookup
       * $addFields: Add purpose and therapeuticArea to root level from projection
       */
      const purposeQuery = [
        purposeLookup,
        { $unwind: { path: '$purpose', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            purpose: '$purpose.purpose',
            therapeuticArea: '$purpose.therapeuticArea',
          },
        },
      ];

      /**
       * Project custom field filter
       * @description Generic method to get custom fields data
       */
      function projectCustomFieldFilter(value) {
        return {
          $filter: {
            input: '$customFields',
            as: 'cf',
            cond: {
              $regexMatch: { input: '$$cf.name', regex: value, options: 'si' },
            },
          },
        };
      }

      const datasetFilter = projectCustomFieldFilter('Number of Datasets');
      const tableFilter = projectCustomFieldFilter('Number of Tables');
      const listingFilter = projectCustomFieldFilter('Number of Listings');
      const figureFilter = projectCustomFieldFilter('Number of Figures');
      const outputFilter = projectCustomFieldFilter('Number of Outputs');
      const compoundFilter = projectCustomFieldFilter('Clinical Program');

      /**
       * Project pipeline
       * @description Get project details from requests
       * $match: filter projects which requests are assoicated with it.
       * $project: clean-up data
       * $unwind: add data to $ROOT
       * $addFields: pick required data from projection
       */
      const projectPipeline = [
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: ['$_id', '$$projectId'],
                },
              ],
            },
          },
        },
        {
          $project: {
            datasets: {
              ...datasetFilter,
            },
            tables: {
              ...tableFilter,
            },
            listings: {
              ...listingFilter,
            },
            figures: {
              ...figureFilter,
            },
            outputs: {
              ...outputFilter,
            },
            compound: {
              ...compoundFilter,
            },
            projectName: '$displayName',
            startDate: '$startDate',
            endDate: '$endDate',
            projectId: '$displayId',
            projectKey: '$projectID',
          },
        },
        { $unwind: { path: '$datasets', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$tables', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$listings', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$figures', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$outputs', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$compound', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            datasets: {
              $convert: {
                input: '$datasets.value',
                to: 'int',
                onError: 0,
                onNull: 0,
              },
            },
            tables: {
              $convert: {
                input: '$tables.value',
                to: 'int',
                onError: 0,
                onNull: 0,
              },
            },
            listings: {
              $convert: {
                input: '$listings.value',
                to: 'int',
                onError: 0,
                onNull: 0,
              },
            },
            figures: {
              $convert: {
                input: '$figures.value',
                to: 'int',
                onError: 0,
                onNull: 0,
              },
            },
            outputs: {
              $convert: {
                input: '$outputs.value',
                to: 'int',
                onError: 0,
                onNull: 0,
              },
            },
            compound: {
              $trim: {
                input: '$compound.value',
              },
            },
          },
        },
      ];

      /**
       * Project lookup
       * @description get project details from request
       */
      const projectLookup = {
        $lookup: {
          from: 'projects',
          let: { projectId: '$projectId' },
          pipeline: projectPipeline,
          as: 'project',
        },
      };

      /**
       * Project query
       * @description fetch project details from projects collection and unwind data.
       */
      const projectQuery = [
        projectLookup,
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      ];

      /**
       * Request Projection
       */
      const baseProjection = {
        $project: {
          _id: 0,
          purpose: 1,
          therapeuticArea: 1,
          datasets: {
            $cond: {
              if: {
                $not: ['$project.datasets'],
              },
              then: 0,
              else: '$project.datasets',
            },
          },
          tables: {
            $cond: {
              if: {
                $not: ['$project.tables'],
              },
              then: 0,
              else: '$project.tables',
            },
          },
          listings: {
            $cond: {
              if: {
                $not: ['$project.listings'],
              },
              then: 0,
              else: '$project.listings',
            },
          },
          figures: {
            $cond: {
              if: {
                $not: ['$project.figures'],
              },
              then: 0,
              else: '$project.figures',
            },
          },
          outputs: {
            $cond: {
              if: {
                $not: ['$project.outputs'],
              },
              then: 0,
              else: '$project.outputs',
            },
          },
          compound: {
            $cond: {
              if: {
                $not: ['$project.compound'],
              },
              then: null,
              else: '$project.compound',
            },
          },
          requester: '$createdBy.name',
          createdAt: '$createdAt',
          createdBy: {
            name: '$createdBy.name',
            email: '$createdBy.email',
          },
          state: '$state',
          requestCompound: {
            ...compoundFilter,
          },
          requestedDate: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' },
          },
          projectName: '$project.projectName',
          projectId: '$project.projectId',
          projectKey: '$project.projectKey',
          startDate: '$project.startDate',
          endDate: '$project.endDate',
          requestId: '$displayId',
          requestKey: '$requestID',
        },
      };

      const unwindBaseProjection = { $unwind: { path: '$requestCompound', preserveNullAndEmptyArrays: true } };

      const commonRequestProjection = {
        purpose: 1,
        therapeuticArea: 1,
        datasets: 1,
        tables: 1,
        listings: 1,
        figures: 1,
        outputs: 1,
        compound: 1,
        requester: 1,
        createdAt: 1,
        createdBy: 1,
        state: 1,
        requestedDate: 1,
        projectName: 1,
        projectId: 1,
        projectKey: 1,
        startDate: 1,
        endDate: 1,
        projectName: 1,
        requestId: 1,
        requestKey: 1,
      };

      const projectionCleanup = {
        $project: {
          requestCompound: {
            $trim: {
              input: '$requestCompound.value',
            },
          },
          ...commonRequestProjection,
          compound: {
            $trim: {
              input: '$compound',
            },
          },
        },
      };

      const projection = {
        $project: {
          ...commonRequestProjection,
          compound: {
            $cond: {
              if: {
                $not: ['$compound'],
              },
              then: '$requestCompound',
              else: '$compound',
            },
          },
          outputs: {
            $sum: ['$datasets', '$tables', '$listings', '$figures'],
          },
        },
      };

      const filters = {
        $match: {
          $and: [
            {
              $or: [
                {
                  endDate: {
                    $lte: moment(opts.endDate, 'MM/DD/YYYY').utc(true).toDate(),
                  },
                  startDate: {
                    $gte: moment(opts.startDate, 'MM/DD/YYYY').utc(true).toDate(),
                  },
                },
                {
                  endDate: {
                    $exists: false,
                  },
                  startDate: {
                    $gte: moment(opts.startDate, 'MM/DD/YYYY').utc(true).toDate(),
                  },
                },
              ],
              outputs: {
                $lte: 0,
              },
            },
          ],
        },
      };

      const query = [
        ...purposeQuery,
        ...projectQuery,
        baseProjection,
        unwindBaseProjection,
        projectionCleanup,
        projection,
        filters, // Query filters
      ];
      const plannedReportAggregation = ProjectRequest.aggregate(query);
      plannedReportAggregation.options = { allowDiskUse: true };
      const report = plannedReportAggregation.exec();
      report.then((response) => {
        const data = response.length ? response[0] : [];
        return resolve({
          message: 'Unplanned request fetched successfully',
          code: 200,
          data,
          response,
        });
      }).catch((error) => {
        logger.error(error, 'ERROR_FETCH_UNPLANNED_REQUEST');
        return reject({
          message: 'Failed to fetch unplanned request report',
          code: 500,
          error,
        });
      });
    } catch (error) {
      logger.error(error, 'ERROR_FETCH_UNPLANNED_REQUEST');
      return reject({
        message: 'Failed to fetch unplanned request metrics',
        code: 500,
        error,
      });
    }
  });
}

function getPlannedRequestReport(opts) {
  return new Promise((resolve, reject) => {
    try {
      if (!opts.startDate) {
        opts.startDate = '2000-01-01';
      }

      if (!opts.endDate) {
        opts.endDate = moment().format('YYYY-MM-DD');
      }

      /**
       * Purpose pipeline
       * @description Get purpose and therapeuticArea of the requests at root level, Users can
       * easily seaarch by purpose and therapeuticArea text without typeData.id and categoryId lookup.
       *
       * $match: Get purpose/type associated with the request
       * $lookup: fetch therapeuticArea name
       * $unwind: flat lookup
       * $project: data clean-up, purpose and TA is associated with - TA flag so split and trim values
       */
      const purposePipeline = [
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: ['$isTA', true],
                  $eq: ['$_id', '$$purposeId'],
                },
              ],
            },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'therapeuticArea',
          },
        },
        { $unwind: { path: '$therapeuticArea', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            purpose: {
              $cond: {
                if: {
                  $eq: ['$isDeleted', true],
                },
                then: {
                  $substr: [
                    '$name',
                    0,
                    {
                      $add: [
                        {
                          $strLenCP: '$name',
                        },
                        -15,
                      ],
                    },
                  ],
                },
                else: '$name',
              },
            },
            therapeuticArea: {
              $first: {
                $split: ['$therapeuticArea.name', '-'],
              },
            },
          },
        },
        {
          $project: {
            purpose: {
              $first: {
                $split: ['$purpose', '-'],
              },
            },
            therapeuticArea: 1,
          },
        },
        {
          $project: {
            purpose: {
              $trim: {
                input: '$purpose',
              },
            },
            therapeuticArea: {
              $trim: {
                input: '$therapeuticArea',
              },
            },
          },
        },
      ];

      /**
       * purpose lookup
       * @description lookup for type/purpose details by typeData.id
       */
      const purposeLookup = {
        $lookup: {
          from: 'types',
          let: { purposeId: '$typeData.id' },
          pipeline: purposePipeline,
          as: 'purpose',
        },
      };

      /**
       * purpose query
       * @description Get purpose and therapeuticArea details from types and categories collection
       * purposeLookup: Get purpose and therapeuticArea
       * $unwind: flat lookup
       * $addFields: Add purpose and therapeuticArea to root level from projection
       */
      const purposeQuery = [
        purposeLookup,
        { $unwind: { path: '$purpose', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            purpose: '$purpose.purpose',
            therapeuticArea: '$purpose.therapeuticArea',
          },
        },
      ];

      /**
       * Project custom field filter
       * @description Generic method to get custom fields data
       */
      function projectCustomFieldFilter(value) {
        return {
          $filter: {
            input: '$customFields',
            as: 'cf',
            cond: {
              $regexMatch: { input: '$$cf.name', regex: value, options: 'si' },
            },
          },
        };
      }

      const datasetFilter = projectCustomFieldFilter('Number of Datasets');
      const tableFilter = projectCustomFieldFilter('Number of Tables');
      const listingFilter = projectCustomFieldFilter('Number of Listings');
      const figureFilter = projectCustomFieldFilter('Number of Figures');
      const outputFilter = projectCustomFieldFilter('Number of Outputs');
      const compoundFilter = projectCustomFieldFilter('Clinical Program');

      /**
       * Project pipeline
       * @description Get project details from requests
       * $match: filter projects which requests are assoicated with it.
       * $project: clean-up data
       * $unwind: add data to $ROOT
       * $addFields: pick required data from projection
       */
      const projectPipeline = [
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: ['$_id', '$$projectId'],
                },
              ],
            },
          },
        },
        {
          $project: {
            datasets: {
              ...datasetFilter,
            },
            tables: {
              ...tableFilter,
            },
            listings: {
              ...listingFilter,
            },
            figures: {
              ...figureFilter,
            },
            outputs: {
              ...outputFilter,
            },
            compound: {
              ...compoundFilter,
            },
            projectCreatedAt: '$createdAt',
            projectUpdatedAt: '$updatedAt',
          },
        },
        { $unwind: { path: '$datasets', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$tables', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$listings', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$figures', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$outputs', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$compound', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            datasets: {
              $convert: {
                input: '$datasets.value',
                to: 'int',
                onError: 0,
                onNull: 0,
              },
            },
            tables: {
              $convert: {
                input: '$tables.value',
                to: 'int',
                onError: 0,
                onNull: 0,
              },
            },
            listings: {
              $convert: {
                input: '$listings.value',
                to: 'int',
                onError: 0,
                onNull: 0,
              },
            },
            figures: {
              $convert: {
                input: '$figures.value',
                to: 'int',
                onError: 0,
                onNull: 0,
              },
            },
            outputs: {
              $convert: {
                input: '$outputs.value',
                to: 'int',
                onError: 0,
                onNull: 0,
              },
            },
            compound: {
              $trim: {
                input: '$compound.value',
              },
            },
          },
        },
      ];

      /**
       * Project lookup
       * @description get project details from request
       */
      const projectLookup = {
        $lookup: {
          from: 'projects',
          let: { projectId: '$projectId' },
          pipeline: projectPipeline,
          as: 'project',
        },
      };

      /**
       * Project query
       * @description fetch project details from projects collection and unwind data.
       */
      const projectQuery = [
        projectLookup,
        { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      ];

      /**
       * Base filter
       * @description get requests which project are associated with it.
       * $match: filter requests by project id
       */
      const baseFilter = {
        $match: {
          projectId: {
            $exists: true,
          },
        },
      };

      /**
       * Base Projection
       */
      const baseProjection = {
        $project: {
          _id: 0,
          report: 'query_report', // Static text to group by reports
          purpose: 1,
          therapeuticArea: 1,
          datasets: {
            $cond: {
              if: {
                $not: ['$project.datasets'],
              },
              then: 0,
              else: '$project.datasets',
            },
          },
          tables: {
            $cond: {
              if: {
                $not: ['$project.tables'],
              },
              then: 0,
              else: '$project.tables',
            },
          },
          listings: {
            $cond: {
              if: {
                $not: ['$project.listings'],
              },
              then: 0,
              else: '$project.listings',
            },
          },
          figures: {
            $cond: {
              if: {
                $not: ['$project.figures'],
              },
              then: 0,
              else: '$project.figures',
            },
          },
          outputs: {
            $sum: ['$project.datasets', '$project.listings', '$project.figures', '$project.tables'],
          },
          compound: {
            $cond: {
              if: {
                $not: ['$project.compound'],
              },
              then: null,
              else: '$project.compound',
            },
          },
          requester: '$createdBy.name',
          createdAt: '$createdAt',
          createdBy: {
            name: '$createdBy.name',
            email: '$createdBy.email',
          },
          state: '$state',
          requestCompound: {
            ...compoundFilter,
          },
          requestedDate: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' },
          },
        },
      };

      const unwindBaseProjection = { $unwind: { path: '$requestCompound', preserveNullAndEmptyArrays: true } };

      const commonRequestProjection = {
        report: 'query_report', // Static text to group by reports
        purpose: 1,
        therapeuticArea: 1,
        datasets: 1,
        tables: 1,
        listings: 1,
        figures: 1,
        outputs: 1,
        compound: 1,
        requester: 1,
        createdAt: 1,
        createdBy: 1,
        state: 1,
        requestedDate: 1,
      };

      const projectionCleanup = {
        $project: {
          requestCompound: {
            $trim: {
              input: '$requestCompound.value',
            },
          },
          ...commonRequestProjection,
          compound: {
            $trim: {
              input: '$compound',
            },
          },
        },
      };

      const projection = {
        $project: {
          ...commonRequestProjection,
          compound: {
            $cond: {
              if: {
                $not: ['$compound'],
              },
              then: '$requestCompound',
              else: '$compound',
            },
          },
        },
      };

      /**
       * Sum custom fields
       */
      const sum = {
        datasets: {
          $sum: '$datasets',
        },
        tables: {
          $sum: '$tables',
        },
        listings: {
          $sum: '$listings',
        },
        figures: {
          $sum: '$figures',
        },
        outputs: {
          $sum: '$outputs',
        },
        requests: {
          $sum: 1,
        },
        requesters: {
          $sum: 1,
        },
        createdBy: {
          $addToSet: '$createdBy',
        },
      };

      /**
       * Group by purpose
       */
      const groupRequesterPurpose = [
        {
          $group: {
            _id: {
              report: '$report',
              requester: '$requester',
              purpose: '$purpose',
              therapeuticArea: '$therapeuticArea',
            },
            ...sum,
            requests: {
              $sum: 1,
            },
          },
        },
        {
          $group: {
            _id: {
              purpose: '$_id.purpose',
              therapeuticArea: '$_id.therapeuticArea',
            },
            ...sum,
            requests: {
              $sum: '$requests',
            },
          },
        },
      ];

      const groupAllRequesterPurpose = [
        {
          $group: {
            _id: {
              report: '$report',
              requester: '$requester',
            },
            report: {
              $first: '$report',
            },
            ...sum,
            requests: {
              $sum: 1,
            },
          },
        },
        {
          $group: {
            _id: '$report',
            ...sum,
            requests: {
              $sum: '$requests',
            },
          },
        },
      ];

      const groupCompound = {
        $group: {
          _id: {
            compound: '$compound',
          },
          ...sum,
          purpose: {
            $first: '$purpose',
          },
          therapeuticArea: {
            $first: '$therapeuticArea',
          },
        },
      };

      const groupCompoundOverTime = {
        $group: {
          _id: {
            compound: '$compound',
            requestedDate: '$requestedDate',
          },
          ...sum,
          purpose: {
            $first: '$purpose',
          },
          therapeuticArea: {
            $first: '$therapeuticArea',
          },
        },
      };

      // Common Projection for all the metrics
      const commonProjection = {
        datasets: '$datasets',
        tables: '$tables',
        listings: '$listings',
        figures: '$figures',
        outputs: '$outputs',
        requests: '$requests',
        createdBy: '$createdBy',
        requesters: {
          $cond: {
            if: { $isArray: '$createdBy' },
            then: { $size: '$createdBy' },
            else: 0,
          },
        },
      };

      const filterNullCompound = {
        $match: {
          compound: {
            $ne: null,
          },
        },
      };

      /**
       * multi level aggregation pipelin
       * @description Multi stage report metrics.
       * $facet: multi stage metics
       * - all: Total of datasets, tables, listings, figures, outputs, requests of all reports
       * - allRequestByPurpose: Similar to all metric with additional total of requestors metric
       * - requestByPurpose: Metrics for datasets, tables, listings, figures, outputs, requests grouped by TA and Purpose
       * - requestByCompound: Metrics for datasets, tables, listings, figures, outputs, requests grouped by Compound
       * - requestByPurposeOverTime: Metrics for datasets, tables, listings, figures, outputs, requests grouped by TA, Purpose and date(YYYY-MM)
       * - requestByCompoundOverTime: Metrics for datasets, tables, listings, figures, outputs, requests grouped by compound and date(YYYY-MM)
       */
      const multiLevelPipeline = {
        $facet: {
          all: [
            filterNullCompound,
            {
              $group: {
                _id: '$report',
                ...sum,
              },
            },
            {
              $project: {
                _id: 0,
                purpose: 'All',
                therapeuticArea: 'All',
                compound: 'All',
                ...commonProjection,
              },
            },
          ],
          allRequestByPurpose: [
            ...groupAllRequesterPurpose,
            {
              $project: {
                _id: 0,
                purpose: 'All',
                therapeuticArea: 'All',
                ...commonProjection,
                createdBy: {
                  $reduce: {
                    input: '$createdBy',
                    initialValue: [],
                    in: { $concatArrays: ['$$value', '$$this'] },
                  },
                },
              },
            },
          ],
          requestByPurpose: [
            ...groupRequesterPurpose,
            {
              $project: {
                _id: 0,
                purpose: '$_id.purpose',
                therapeuticArea: '$_id.therapeuticArea',
                ...commonProjection,
                createdBy: {
                  $reduce: {
                    input: '$createdBy',
                    initialValue: [],
                    in: { $concatArrays: ['$$value', '$$this'] },
                  },
                },
              },
            },
          ],
          requestByCompound: [
            filterNullCompound,
            groupCompound,
            {
              $project: {
                _id: 0,
                compound: '$_id.compound',
                purpose: '$purpose',
                therapeuticArea: '$therapeuticArea',
                ...commonProjection,
              },
            },
          ],
          requestByPurposeOverTime: [
            {
              $group: {
                _id: {
                  requestedDate: '$requestedDate',
                  report: '$report',
                  purpose: '$purpose',
                  therapeuticArea: '$therapeuticArea',
                },
                ...sum,
              },
            },
            {
              $project: {
                _id: 0,
                date: '$_id.requestedDate',
                purpose: '$_id.purpose',
                therapeuticArea: '$_id.therapeuticArea',
                ...commonProjection,
              },
            },
          ],
          requestByCompoundOverTime: [
            filterNullCompound,
            groupCompoundOverTime,
            {
              $project: {
                _id: 0,
                date: '$_id.requestedDate',
                compound: '$_id.compound',
                purpose: '$_id.purpose',
                therapeuticArea: '$therapeuticArea',
                ...commonProjection,
              },
            },
          ],
        },
      };

      const filters = {
        $match: {
          $and: [
            // Purpose
            {
              purpose: { $regex: opts.purpose, $options: 'i' },
            },
            // Therapeutic Area
            {
              therapeuticArea: { $regex: opts.therapeuticArea, $options: 'i' },
            },
            // Requester
            {
              requester: { $regex: opts.requester, $options: 'i' },
            },
            // Compound
            {
              compound: { $regex: opts.compound, $options: 'i' },
            },
            // Request State.
            {
              state: { $regex: opts.state, $options: 'i' },
            },
            // Start Date
            {
              createdAt: { $gte: new Date(opts.startDate) },
            },
            // End Date
            {
              createdAt: { $lte: new Date(opts.endDate) },
            },
          ],
        },
      };

      const mergeTA = {
        $project: {
          ...commonRequestProjection,
          therapeuticArea: {
            $cond: {
              if: {
                $ne: [opts.therapeuticArea, ''],
              },
              then: '$therapeuticArea',
              else: 'All',
            },
          },
        },
      };

      const query = [
        ...purposeQuery,
        ...projectQuery,
        baseProjection,
        unwindBaseProjection,
        projectionCleanup,
        projection,
        filters, // Query filters
        mergeTA,
        multiLevelPipeline,
        {
          $project: {
            requestByPurpose: {
              $concatArrays: ['$allRequestByPurpose', '$requestByPurpose'],
            },
            requestByCompound: {
              $concatArrays: ['$all', '$requestByCompound'],
            },
            requestByPurposeOverTime: {
              $concatArrays: ['$requestByPurposeOverTime'],
            },
            requestByCompoundOverTime: {
              $concatArrays: ['$requestByCompoundOverTime'],
            },
          },
        },
      ];
      const plannedReportAggregation = ProjectRequest.aggregate(query);
      plannedReportAggregation.options = { allowDiskUse: true };
      const report = plannedReportAggregation.exec();
      report.then((response) => {
        const data = response.length ? response[0] : [];
        resolve({
          message: 'Request metrics fetched successfully',
          code: 200,
          data,
        });
      }).catch((error) => {
        logger.error(error, 'ERROR_FETCH_REQUEST_METRICS');
        reject({
          message: 'Failed to fetch planned request report',
          code: 500,
          error,
        });
      });
    } catch (error) {
      logger.error(error, 'ERROR_FETCH_REQUEST_METRICS');
      reject({
        message: 'Failed to fetch request metrics',
        code: 500,
        error,
      });
    }
  });
}

function getNonTAProjects(opts) {
  return new Promise((resolve, reject) => {
    try {
      const categoryFilter = {
        $match: {
          $expr: {
            $and: [
              {
                $eq: ['$_id', '$$categoryId'],
              },
              {
                $ne: ['$isTA', true],
              },
            ],
          },
        },
      };

      const categoryProjection = [
        {
          $project: {
            _id: 0,
            department: {
              $trim: {
                input: '$name',
              },
            },
          },
        },
      ];

      const categoryPipeline = [
        categoryFilter,
        ...categoryProjection,
      ];

      const baseFilter = {
        $match: {
          $expr: {
            $and: [
              {
                $or: [
                  {
                    $eq: [
                      '$isTA',
                      false,
                    ],
                  },
                  {
                    $ne: [
                      '$isTA',
                      true,
                    ],
                  },
                ],
              },
              {
                $or: [
                  {
                    $eq: [
                      '$isRequest',
                      false,
                    ],
                  },
                  {
                    $ne: [
                      '$isRequest',
                      true,
                    ],
                  },
                ],
              },
            ],
          },
        },
      };

      const categoryLookup = {
        $lookup: {
          from: 'categories',
          let: { categoryId: '$categoryId' },
          pipeline: categoryPipeline,
          as: 'department',
        },
      };

      const unwindTherapeuticArea = {
        $unwind: {
          path: '$department', preserveNullAndEmptyArrays: true,
        },
      };

      const baseProjection = [
        {
          $project: {
            _id: 1,
            department: '$department.department',
            template: {
              $trim: {
                input: '$name',
              },
            },
            isDeleted: 1,
          },
        },
        {
          $project: {
            _id: 1,
            template: {
              $cond: {
                if: {
                  $eq: ['$isDeleted', true],
                },
                then: {
                  $substr: [
                    '$template',
                    0,
                    {
                      $add: [
                        {
                          $strLenCP: '$template',
                        },
                        -15,
                      ],
                    },
                  ],
                },
                else: '$template',
              },
            },
            department: 1,
          },
        },
      ];

      const department = opts && opts.hasOwnProperty('department') ? opts.department : '';
      const template = opts && opts.hasOwnProperty('template') ? opts.template : '';

      opts = {
        ...opts,
        department,
        template,
      };

      const matchDepartments = {
        $match: {
          $and: [
            // Purpose
            {
              department: { $regex: opts.department, $options: 'i' },
            },
            // Therapeutic Area
            {
              template: { $regex: opts.template, $options: 'i' },
            },
          ],
        },
      };

      const collaboratorPipeline = [
        {
          $match: {
            $expr: {
              $and: [
                {
                  $in: ['$_id', '$$userIds'],
                },
              ],
            },
          },
        },
        {
          $project: {
            _id: 0,
            username: 1,
            name: 1,
            type: 'collaborator',
          },
        },
      ];

      const projectCollaboratorPipeline = [
        {
          $lookup: {
            from: 'groups',
            localField: 'collaborators.name',
            foreignField: 'name',
            as: 'groups',
          },
        },
        { $unwind: { path: '$groups', preserveNullAndEmptyArrays: true } },
        {
          $lookup:
          {
            from: 'users',
            let: { userIds: '$groups.members._id' },
            pipeline: collaboratorPipeline,
            as: 'pGroupCollaborators',
          },
        },
      ];

      const projectCollaborators = [
        {
          $addFields: {
            gCollaborators: {
              $map: {
                input: {
                  $filter: {
                    input: '$collaborators',
                    as: 'cGroup',
                    cond: {
                      $and: [
                        {
                          $eq: ['$$cGroup.type', 'group'],
                        },
                      ],
                    },
                  },
                },
                as: 'cGroup',
                in: {
                  type: 'collaborator',
                  username: '$$cGroup.name',
                  name: '$$cGroup.displayName',
                },
              },
            },
          },
        },
        {
          $addFields: {
            pCollaborators: {
              $map: {
                input: {
                  $filter: {
                    input: '$collaborators',
                    as: 'cUser',
                    cond: {
                      $and: [
                        {
                          $eq: ['$$cUser.type', 'user'],
                        },
                      ],
                    },
                  },
                },
                as: 'cUser',
                in: {
                  type: 'collaborator',
                  username: '$$cUser.name',
                  name: '$$cUser.displayName',
                },
              },
            },
          },
        },
        {
          $addFields: {
            pLead: [{
              type: 'lead',
              username: '$lead.userName',
              name: '$lead.displayName',
            }],
          },
        },
        {
          $addFields: {
            projectCollaborators: {
              $reduce: {
                input: ['$pLead', '$pCollaborators', '$pGroupCollaborators', '$gCollaborators'],
                initialValue: [],
                in: { $concatArrays: ['$$value', '$$this'] },
              },
            },
          },
        },
        {
          $project: {
            collaborators: 0,
            lead: 0,
            pLead: 0,
            pCollaborators: 0,
            pGroupCollaborators: 0,
            gCollaborators: 0,
            groups: 0,
          },
        },
        {
          $addFields: {
            collaborators: '$projectCollaborators',
          },
        },
      ];

      // Filters
      const page = 1;
      const perPage = 10;
      const requester = '';

      const pagination = [
        {
          $facet: {
            stage1: [{ $group: { _id: null, count: { $sum: 1 } } }],
            stage2: [
              { $skip: page > 0 ? ((page - 1) * perPage) : 0 },
              { $limit: perPage },
            ],
          },
        },
        { $unwind: '$stage1' },
        // output projection
        {
          $project: {
            count: '$stage1.count',
            projects: '$stage2',
          },
        },
      ];

      const projectFilter = {
        $match: {
          $and: [
            {
              $or: [
                {
                  'collaborators.username': { $regex: requester, $options: 'i' },
                },
                {
                  'collaborators.name': { $regex: requester, $options: 'i' },
                },
              ],
            },
            {
              $or: [
                {
                  endDate: {
                    $lte: moment(opts.endDate, 'YYYY-MM-DD').utc(true).toDate(),
                  },
                  startDate: {
                    $gte: moment(opts.startDate, 'YYYY-MM-DD').utc(true).toDate(),
                  },
                },
                {
                  endDate: {
                    $exists: false,
                  },
                  startDate: {
                    $gte: moment(opts.startDate, 'YYYY-MM-DD').utc(true).toDate(),
                  },
                },
              ],
            },
          ],
        },
      };

      const projectPipeline = [
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: ['$typeData.id', '$$typeId'],
                },
              ],
            },
          },
        },
        {
          $set: {
            items: {
              $map: {
                input: '$customFields',
                in: {
                  k: '$$this.name',
                  v: {
                    $cond: {
                      if: {
                        $eq: [
                          {
                            $type: '$$this.value',
                          },
                          'object',
                        ],
                      },
                      then: '$$this.value.name',
                      else: '$$this.value',
                    },
                  },
                },
              },
            },
          },
        },
        ...projectCollaboratorPipeline,
        ...projectCollaborators,
        { $set: { items: { $arrayToObject: ['$items'] } } },
        { $replaceRoot: { newRoot: { $mergeObjects: ['$items', '$$ROOT'] } } },
        {
          $project: {
            __v: 0,
            projectCollaborators: 0,
            customFields: 0,
            items: 0,
          },
        },
        {
          $sort: {
            createdAt: -1,
            updatedAt: -1,
          },
        },
        projectFilter,
        ...pagination,
      ];

      const projectLookup = {
        $lookup: {
          from: 'projects',
          let: { typeId: '$_id' },
          pipeline: projectPipeline,
          as: 'projects',
        },
      };

      const groupDepartments = {
        $group: {
          _id: {
            department: '$department',
            template: '$template',
          },
          department: {
            $first: '$department',
          },
          template: {
            $first: '$template',
          },
          projects: {
            $addToSet: '$projects',
          },
        },
      };

      const departmentFilter = {
        $match: {
          department: {
            $ne: null,
          },
        },
      };

      const finalProjection = [
        {
          $project: {
            _id: 0,
            department: 1,
            template: 1,
            projects: {
              $reduce: {
                input: '$projects',
                initialValue: [],
                in: { $concatArrays: ['$$value', '$$this'] },
              },
            },
          },
        },
        {
          $project: {
            department: 1,
            template: 1,
            projects: '$projects',
          },
        },
      ];

      const query = [
        baseFilter,
        categoryLookup,
        unwindTherapeuticArea,
        ...baseProjection,
        matchDepartments,
        projectLookup,
        groupDepartments,
        departmentFilter,
        ...finalProjection,
      ];
      const typeAggregation = Type.aggregate(query);
      typeAggregation.options = { allowDiskUse: true };
      const report = typeAggregation.exec();
      report.then((response) => {
        const data = response.length ? response[0] : [];
        return resolve({
          message: 'Non TA Projects fetched',
          code: 200,
          data,
          response,
        });
      });
    } catch (error) {
      logger.error(error, 'ERROR_FETCH_NON_TA_PROJECTS');
      return reject({
        message: 'Something went wrong',
        code: 500,
        error,
      });
    }
  });
}

function getClinicalPrograms(opts) {
  return new Promise((resolve, reject) => {
    try {
      if (!opts.therapeuticArea) {
        logger.error('Invalid Request Payload', 'ERROR_FETCH_CLINICAL_PROGRAM');
        return reject({
          message: 'Invalid request, Therapeutic area is required.',
          code: 400,
          error,
        });
      }
      const TAFilter = {
        $match: {
          isTA: true,
        },
      };

      const projectTA = [
        {
          $project: {
            therapeuticArea: {
              $first: {
                $split: [
                  '$name',
                  '-',
                ],
              },
            },
          },
        },
        {
          $project: {
            therapeuticArea: {
              $trim: {
                input: '$therapeuticArea',
              },
            },
          },
        },
      ];

      const baseFilter = {
        $match: {
          therapeuticArea: { $regex: opts.therapeuticArea, $options: 'i' },
        },
      };

      const categoryFilter = {
        $match: {
          $expr: {
            $and: [
              {
                $eq: ['$categoryId', '$$categoryId'],
              },
              {
                $eq: ['$isDeleted', false],
              },
            ],
          },
        },
      };

      const projectClinicalProgram = {
        $project: {
          _id: 0,
          clinicalProgram: {
            $filter: {
              input: '$attributes',
              as: 'attr',
              cond: [{ $eq: ['$$attr.name', 'Clinical Program'] }],
            },
          },
        },
      };

      const unwindClinicalProgram = {
        $unwind: {
          path: '$clinicalProgram', preserveNullAndEmptyArrays: true,
        },
      };

      const matchClinicalProgram = {
        $match: {
          'clinicalProgram.name': 'Clinical Program',
        },
      };

      const projectValues = {
        $project: {
          clinicalProgram: '$clinicalProgram.values',
        },
      };

      const groupClinicalProgram = {
        $group: {
          _id: null,
          clinicalProgram: {
            $addToSet: '$clinicalProgram',
          },
        },
      };

      const purposePipeline = [
        categoryFilter,
        projectClinicalProgram,
        unwindClinicalProgram,
        matchClinicalProgram,
        unwindClinicalProgram,
        projectValues,
        groupClinicalProgram,
        {
          $project: {
            _id: 0,
          },
        },
      ];

      const purposeLookup = {
        $lookup: {
          from: 'types',
          let: { categoryId: '$_id' },
          pipeline: purposePipeline,
          as: 'clinicalProgram',
        },
      };

      const projectClinicalProgramArray = {
        $project: {
          clinicalProgram: '$clinicalProgram.clinicalProgram',
        },
      };

      const query = [
        TAFilter,
        ...projectTA,
        baseFilter,
        purposeLookup,
        unwindClinicalProgram,
        projectClinicalProgramArray,
        unwindClinicalProgram,
        {
          $project: {
            _id: 0,
          },
        },
        {
          $sort: {
            clinicalProgram: -1,
          },
        },
      ];

      const categoryAggregation = Category.aggregate(query);
      categoryAggregation.options = { allowDiskUse: true };
      const report = categoryAggregation.exec();
      report.then((response) => {
        const data = response.length ? response[0] : [];
        return resolve({
          message: 'Clinical Program fetched',
          code: 200,
          data,
        });
      }).catch((error) => {
        logger.error(error, 'ERROR_FETCH_CLINICAL_PROGRAM');
        return reject({
          message: 'Failed to clinical program details.',
          code: 500,
          error,
        });
      });
    } catch (error) {
      logger.error(error, 'ERROR_FETCH_CLINICAL_PROGRAM');
      return reject({
        message: 'Failed to clinical program details.',
        code: 500,
        error,
      });
    }
  });
}

function getPurposeByTA(opts) {
  return new Promise((resolve, reject) => {
    try {
      const categoryFilter = {
        $match: {
          $expr: {
            $and: [
              {
                $eq: ['$_id', '$$categoryId'],
              },
              {
                $eq: ['$isTA', true],
              },
            ],
          },
        },
      };

      const categoryProjection = [
        {
          $project: {
            therapeuticArea: {
              $first: {
                $split: [
                  '$name',
                  '-',
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            therapeuticArea: {
              $trim: {
                input: '$therapeuticArea',
              },
            },
          },
        },
      ];

      const categoryPipeline = [
        categoryFilter,
        ...categoryProjection,
      ];

      const baseFilter = {
        $match: {
          isTA: true,
          isDeleted: false,
        },
      };

      const categoryLookup = {
        $lookup: {
          from: 'categories',
          let: { categoryId: '$categoryId' },
          pipeline: categoryPipeline,
          as: 'therapeuticArea',
        },
      };

      const unwindTherapeuticArea = {
        $unwind: {
          path: '$therapeuticArea', preserveNullAndEmptyArrays: true,
        },
      };

      const baseProjection = [
        {
          $project: {
            _id: 0,
            therapeuticArea: 1,
            name: {
              $first: {
                $split: [
                  '$name',
                  '-',
                ],
              },
            },
          },
        },
        {
          $project: {
            therapeuticArea: '$therapeuticArea.therapeuticArea',
            purpose: {
              $trim: {
                input: '$name',
              },
            },
          },
        },
      ];

      const groupTherapeuticArea = {
        $group: {
          _id: '$therapeuticArea',
          purpose: {
            $addToSet: '$purpose',
          },
        },
      };

      const projectPurpose = {
        $project: {
          _id: 0,
          therapeuticArea: '$_id',
          purpose: '$purpose',
        },
      };

      const matchTA = {
        $match: {
          therapeuticArea: {
            $regex: opts.therapeuticArea, $options: 'i',
          },
        },
      };

      const query = [
        baseFilter,
        categoryLookup,
        unwindTherapeuticArea,
        ...baseProjection,
        groupTherapeuticArea,
        projectPurpose,
        matchTA,
        {
          $sort: {
            purpose: -1,
          },
        },
      ];
      const typeAggregation = Type.aggregate(query);
      typeAggregation.options = { allowDiskUse: true };
      const report = typeAggregation.exec();
      report.then((response) => {
        const data = response.length ? response[0] : [];
        return resolve({
          message: 'Purpose fetched',
          code: 200,
          data,
          response,
        });
      });
    } catch (error) {
      logger.error(error, 'ERROR_FETCH_PURPOSE');
      return reject({
        message: 'Failed to purpose program details.',
        code: 500,
        error,
      });
    }
  });
}

// Fulfillers
function getFulfillerReport(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!opts.therapeuticArea || !opts.purpose) {
        return reject({
          message: 'Invalid request payload',
          code: 400,
          success: false,
        });
      }
      const fulfiller = await Fulfillers.findOne({ categoryId: opts.therapeuticArea, typeId: opts.purpose }).lean();
      if (!fulfiller) {
        return resolve({
          message: 'Fulfiller report fetched successfully',
          code: 200,
          data: {},
          // fulfiller,
          success: true,
        });
      }
      if (fulfiller) {
        const formatUserDetails = (user) => {
          const name = user?.name?.toLowerCase().replace(/\b\w/g, (l) => { return l.toUpperCase(); }) || 'N/A';
          const userDetails = {
            name,
            email: user.email || 'N/A',
          };
          userDetails.displayName = `${name} [${user.email}]`;
          return userDetails;
        };
        const response = {};
        response.defaultFulfillers = fulfiller.fulfillers.filter((user) => { return user.isTypeFulfiller; }).map((user) => { return formatUserDetails(user); });
        response.fields = [];
        response.attributes = fulfiller.attributeSet.map((attr) => {
          const attributes = [];
          const attributeDetails = {};
          const groupedAttributes = _.groupBy(attr.attributes, 'name');
          response.fields.push(...Object.keys(groupedAttributes));
          attributeDetails.secondaryFulfillers = attr.fulfillers
            .filter((user) => { return !user.isPrimarySP && !user.isPrimarySDS && !user.isTypeFulfiller; })
            .map((user) => { return formatUserDetails(user); });
          attributeDetails.primarySPFulfillers = attr.fulfillers.filter((user) => { return user.isPrimarySP; }).map((user) => { return formatUserDetails(user); });
          attributeDetails.primarySDSFulfillers = attr.fulfillers.filter((user) => { return user.isPrimarySDS; }).map((user) => { return formatUserDetails(user); });
          attributeDetails.field = [...Object.keys(groupedAttributes)];
          attributes.push(attributeDetails);
          Object.keys(groupedAttributes).forEach((key) => {
            // const attributeDetails = {};

            attributeDetails[key] = groupedAttributes[key] && groupedAttributes[key].length && groupedAttributes[key][0].value || 'N/A';

          });
          return attributes;
        }).flat(1);
        if (opts.compound) {
          response.attributes = response.attributes.filter((attr) => { return attr['Clinical Program'] && attr['Clinical Program'].trim().toLowerCase() === opts.compound.trim().toLowerCase(); });
        }
        // Filter duplicate fields
        response.fields = [...new Set(response.fields)];
        return resolve({
          message: 'Fulfiller report fetched successfully',
          code: 200,
          data: response,
          // fulfiller,
          success: true,
        });
      }
      return reject({
        message: 'No fulfillers found with given Therapeutic Area and purpose',
        code: 404,
        success: false,
      });
    } catch (error) {
      logger.error(error, 'ERROR_GENERATE_FULFILLER_REPORTS');
      reject({
        message: 'Error while generating fulfiller report',
        code: 500,
        success: false,
        error,
      });
    }
  });
}

function resendEmailToFulfillers(opts, currentUser) {
  return new Promise(async (resolve, reject) => {
    if (currentUser.isAdmin || currentUser.isSuperAdmin) {
      const projectRequest = await ProjectRequest.findOne({ requestID: opts?.requestID }).lean();
      if(projectRequest){
        const fulfillers = await getRequestFulfillers(projectRequest);
        //Send email to fulfillers
        try{
          await sendEmailToFulfillers(projectRequest, fulfillers, currentUser);
          return resolve({
            code: 200,
            message: 'Email has been successfully resent.',
          });
        } catch (error) {
          logger.error(error, 'FAILED_TO_SEND_EMAIL_TO_FULLFILLERS');
          return reject({
            code: 400,
            message: 'Failed to send emails to Fullfillers',
            message: 'FAILED_TO_SEND_EMAIL_TO_FULLFILLERS'
          });
        }
      } else {
        logger.error('error', 'ERROR_IN_FETCHING_PROJECT_REQUEST_DETAILS');
        return reject({
          code: 400,
          message: 'Project request not found',
          error: 'PROJECT_REQUEST_NOT_FOUND'
        });
      }
    } else {
      logger.error(error, 'ACCESS_DENIED_THIS_API_RESTRICT_TO_ADMINS');
      return reject({
        code: 400,
        message: 'Access Denied: This api is restricted to administrators only.',
        error: 'ACCESS_DENIED_THIS_API_RESTRICT_TO_ADMINS'
      });
    }
  })
}

export const jiraProjectRequestsServices = {
  getProjectRequestById,
  getProjectRequests,
  jiraGetAllProjectRequests,
  createProjectRequest,
  updateProjectRequest,
  deleteProjectRequest,
  saveProjectRequestDetails,
  getPlannedRequestReport,
  getFulfillerReport,
  getClinicalPrograms,
  sanitizeCustomFields,
  sendEmailToFulfillers,
  resendEmailToFulfillers,
  getPurposeByTA,
  getNonTAProjects,
  getUnRespondedRequests,
  syncProjectRequest
};