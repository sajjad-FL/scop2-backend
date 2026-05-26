import { createRandomString } from "../../utils/randomString.js";
import { Category } from '../../models/category.js';
import { Project } from '../../models/project.js';
import { ProjectRequest } from '../../models/project-request.js';
import { Fulfiller } from '../../models/fulfillers.js';
import { Type } from '../../models/type.js';
import { Group } from '../../models/group.js';
import { User } from '../../models/user.js';
import { Jjed } from '../../models/jjed.js';
// import { Hotsheet } from '../../models/hotsheet.js';
import { Counter } from '../../models/counter.js';
import { CaseStudyApprover } from '../../models/case-study-approvers.js';
import { DataTransferRequest } from '../../models/data-transfer-request.js';
import { getJiraClient } from "../../connectors/jira.js";
import {
  extractUserNameFromLDAPManyValue,
  uploadCustomFieldsAttachments,
  therapeuticAreaNameConversion,
  formatFullName,
  removeDuplicates,
  contentdrrProjectLeadChange,
  updateColumnWidths
} from "../../utils/helper.js";
import { logger } from "../../utils/logger.js";
import { pipeline } from 'stream/promises';
import { sendEmail } from "../../utils/email.js";
import { gitlabProjectServices } from "../gitlab/project.js";
import { CONSTANTS } from "../../utils/constants.js";
import { Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Tab, 
  Table, 
  TableRow, 
  TableCell,
  HeightRule, 
  HeadingLevel, 
  AlignmentType,
  WidthType, 
  TabStopType, 
  TabStopPosition } from "docx";
import S3 from "../../utils/S3.js";
import async from 'async';
import ProjectClient from "../../utils/project.js";
import moment from "moment";
import mongoose from "mongoose";
import ExcelJS from 'exceljs';
import _ from "lodash";
import fs from 'fs';
import { jiraGroupServices } from "./group.js";
import { LDAPConfig } from "../../connectors/ldap.js";
import { jiraDataTransferRequestServices } from "./data-transfer-request.js";
import newCommentNotification from "../../utils/templates/newCommentNotification.js";
import { jiraUserPreferenceServices } from "./user-preference.js";

const {
  SBO_ACTION_HOURS,
  PROJECT,
  ALFRESCO,
  GITLAB,
  GROUPS,
  PROJECT_REQUEST,
  SMH_CASE_STUDY_STATUS,
  REQUEST_THROTTLE_LIMIT,
  REPORTS_HEADER
} = CONSTANTS;

const requestLookup = () => {
  return [
    {
      $lookup:
      {
        from: 'projectrequests',
        localField: 'requestMeta.requestId',
        foreignField: '_id',
        as: 'requestLookup',
      },
    },
    {
      $unwind: { path: '$requestLookup', preserveNullAndEmptyArrays: true },
    },
    {
      $addFields: {
        requestMeta: {
          name: '$requestLookup.name',
          displayId: '$requestLookup.displayId',
          requestId: '$requestLookup._id',
          categoryId: '$requestLookup.categoryId',
          typeId: '$requestLookup.typeData.id',
          createdAt: '$requestLookup.createdAt',
        },
      },
    },
    {
      $project: {
        requestLookup: 0,
      }
    }
  ]
};

const smhCaseStudyLookup = (username) => {
  return [
    {
      $lookup: {
        from: "casestudyapprovers",
        localField: "caseStudyApproversId",
        foreignField: "_id",
        as: "caseStudyApprovers",
      },
    },
    {
      $unwind: {
        path: "$caseStudyApprovers",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        caseStudyApprovers: {
          $map: {
            input: "$caseStudyApprovers.approvers",
            as: "approver",
            in: {
              $toLower: "$$approver.username",
            },
          },
        },
      },
    },
    {
      $match: {
        $or: [
          {
            caseStudyApproversId: { $exists: false, $eq: null },
          },
          {
            caseStudyApproversId: { $exists: true, $ne: null },
            smhApprovalStatus: SMH_CASE_STUDY_STATUS.PENDING,
            caseStudyApprovers: { $in: [username] },
          },
          {
            caseStudyApproversId: { $exists: true, $ne: null },
            smhApprovalStatus: SMH_CASE_STUDY_STATUS.APPROVED
          },
        ],
      },
    },
  ]
}

const dtrLookup = () => {
  return [
    {
      $lookup:
      {
        from: 'datatransferrequests',
        localField: 'dtrMeta.dtrId',
        foreignField: '_id',
        as: 'dtrLookup',
      },
    },
    {
      $unwind: { path: '$dtrLookup', preserveNullAndEmptyArrays: true },
    },
    {
      $addFields: {
        dtrMeta: {
          name: '$dtrLookup.name',
          displayId: '$dtrLookup.displayId',
          requestId: '$dtrLookup._id',
          categoryId: '$dtrLookup.categoryId',
          typeId: '$dtrLookup.typeData.id',
          createdAt: '$dtrLookup.createdAt',
        },
      },
    },
    {
      $project: {
        dtrLookup: 0,
      }
    }
  ]
};

/**
 * Creates a project category.
 *
 * @method createProjectCategory
 * @param {Object} opts The request options.
 * @param {Object} opts.name The project category name.
 * @param {Object} opts.description The project category description.
 * @return {Promise} Resolved when the project category has been created.
 */
function createProjectCategory(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const data = opts;
      data._id = createRandomString();

      const newCategory = await Category.create(data);
      const message = `${newCategory?.isTA ? 'Therapeutic Area' : 'Department'} named ${newCategory?.isTA ? therapeuticAreaNameConversion(newCategory?.name) : newCategory?.name} created successfully`;
      return resolve({
        code: 200,
        message,
        data: newCategory,
      });
    } catch (saveErr) {
      logger.error(saveErr, 'FAILED_TO_CREATE_DEPARTMENT')
      if (saveErr?.code === 11000) {
        return reject({ message: `Duplicate: ${data.isTA ? 'Therapeutic Area' : 'Department'} with same name already exist in system`, code: 403, error: 'ERROR_DB_SAVE_CATEGORY' });
      } else {
        return reject({ message: 'Failed to create project department', code: 500, error: 'ERROR_DB_SAVE_CATEGORY' });
      }
    }
  });
}

/**
 * Returns a list of all project categories visible to the user.
 *
 * @method getAllProjectCategories
 * @return {Promise} Resolved when the project categories have been retrieved.
 */
function getAllProjectCategories() {
  return new Promise(async (resolve, reject) => {
    try {
      const cData = await Category.find({}).lean();
      return resolve(cData);
    } catch (findErr) {
      // 1.a If error, reject with error
      logger.error(findErr, 'ERROR_DB_FIND_CATEGORIES');
      reject({
        message: 'Failed to fetch categories',
        code: 500,
        error: 'ERROR_DB_FIND_CATEGORIES',
      });
    }
  });
}

function getProjectCategoryById(opts, next) {
  return new Promise((resolve, reject) => {
    const jiraClient = getJiraClient(opts.auth);
    jiraClient.projectCategory.getProjectCategory(opts).then((res) => {
      return resolve(res);
    }, (err) => {
      try {
        const errorObj = JSON.parse(err);
        return reject(errorObj);
      } catch (e) {
        return reject(err);
      }
    });
  });
}
  
/**
 * Updates a project category.
 *
 * @method updateProjectCategory
 * @param {Object} opts The request options.
 * @param {String} opts.id The project category id.
 * @param {Object} opts.data The project category properties.
 * @return {Promise} Resolved when the project category has been updated.
 */
function updateProjectCategory(opts) {
  return new Promise(async (resolve, reject) => {
    // 1 Update project category
    try {
      const filter = {
        _id: opts.id,
      };
      const update = {
        $set: opts.data,
      };
      const res = await Category.findOneAndUpdate(
        filter,
        update,
        { new: true, strict: true, runValidators: true, }).lean();
          // 1.b Project category has been successfully updated to db
          const message = `${res.isTA ? 'Therapeutic Area' : 'Department'} named ${res.isTA ? therapeuticAreaNameConversion(res.name) : res.name} updated successfully`;
          return resolve({
            code: 200,
            message,
            data: res,
          });
    } catch (err) {
      // 1.a Project category updation in DB failed
      logger.error(err, 'ERROR_DB_UPDATE_CATEGORY');
      if (err.code === 11000) {
        reject({ message: 'Duplicate: Department with same name already exist in system', code: 403, error: 'ERROR_DB_UPDATE_CATEGORY' });
      } else {
        reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE_CATEGORY' });
      }
    }
  });
}

/**
 * Deleted a project category.
 *
 * @method deleteProjectCategory
 * @param {Object} opts The request options.
 * @param {Object} opts.id The project category id.
 * @return {Promise} Resolved when the project category has been deleted.
 */
function deleteProjectCategory(opts) {
  return new Promise(async (resolve, reject) => {
    // 1 Find matching projects with category received from client
    try {
      const pData = await Project.findOne({ categoryId: opts.id }).lean();
      if (pData) {
        // 1.b If found, reject with error
        logger.error(pErr, 'ERROR_DB_FIND_PROJECT_DEPARTMENT');
        return reject({
          message: `Error: There are currently projects linked to this ${!!pData.requestId ? 'therapeutic area' : 'department'}.`,
          code: 403,
        });
      } else {
        // 1 Remove Category
        try {
          const res = await Category.findOneAndDelete({ _id: opts.id }).lean()
          if (res) {
            // 1.b. Category deleted from DB.
            if (res?.isTA) {
              try {
                const tRes = await Type.deleteOne({ categoryId: opts.id }).lean();
                if(tRes) {
                  try {
                    const taRes = await Fulfiller.deleteOne({ categoryId: opts.id }).lean();
                    if (taRes) {
                      try {
                        await ProjectRequest.deleteOne({ categoryId: opts.id }).lean();
                        return resolve({
                          message: 'Therapeutic Area deleted successfully',
                          code: 200,
                        });
                      } catch (error) {
                        // 1.a. Failure to delete category, log and reject
                        logger.error(taErr, 'ERROR_DB_DELETE_CATEGORY');
                        return reject({
                          message: 'Failed to delete tproject request',
                          code: 500,
                          error: 'ERROR_DB_DELETE_CATEGORY',
                        });
                      }
                    } else {
                      return resolve({
                        message: 'Therapeutic Area deleted successfully',
                        code: 200,
                      });
                    }
                  } catch (taErr) {
                    // 1.a. Failure to delete category, log and reject
                    logger.error(taErr, 'ERROR_DB_DELETE_CATEGORY');
                    return reject({
                      message: 'Failed to delete therapeutic area',
                      code: 500,
                      error: 'ERROR_DB_DELETE_CATEGORY',
                    });
                  }
                } else {
                  return resolve({
                    message: 'Therapeutic Area deleted successfully',
                    code: 200,
                  });
                }
              } catch (tErr) {
                logger.error(tErr, 'ERROR_DB_DELETE_CATEGORY');
                return reject({
                  message: 'Failed to delete therapeutic area',
                  code: 500,
                  error: 'ERROR_DB_DELETE_CATEGORY',
                });
              }
            } else {
              return resolve({
                message: 'Department deleted successfully',
                code: 200,
              });
            }
          } else {
            return reject({
              message: 'Department not found',
              code: 401
            })
          }
        } catch (err) {
          logger.error(err, 'ERROR_DB_DELETE_CATEGORY');
          return reject({
            message: 'Failed to delete department',
            code: 500,
            error: 'ERROR_DB_DELETE_CATEGORY',
          });
        }
      }
    } catch (pErr) {
      // 1.a If error, reject with error
      logger.error(pErr, 'ERROR_DB_FIND_PROJECT_DEPARTMENT');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_PROJECT_DEPARTMENT',
      });
    }
  });
}

/**
 * Creates custom project type in DB.
 *
 * @method createCustomProjectType
 * @param {Object} data The project custom type properties sent to the DB.
 * @param {String} data.name The project custom type name.
 * @param {Array} data.templates The project custom type template details.
 * @param {Array} data.attributes The project custom type attribute details.
 * @return {Promise} Resolved when the project custom type has been created.
 */
function createCustomProjectType(data) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1 Create project type in DB
      const instance = new Type(data);
      const newType = await instance.save();
      // 1.b Project type has been successfully saved to db
      const newTypeOutput = JSON.parse(JSON.stringify(newType));
      if (data?.previousTypeId && newTypeOutput?.isTA) {
        try {
          const fRes = await Fulfiller.findOne({ typeId: data.previousTypeId }).lean();
          if (fRes) {
            const fulData = JSON.parse(JSON.stringify(fRes));
            const duplicateAttributeSet = [];
            fulData.attributeSet.forEach((aSet, index) => {
              duplicateAttributeSet.push({ fulfillers: aSet.fulfillers, attributes: [] });
              aSet.attributes.forEach((attr) => {
                let count = 0;
                newType.attributes.forEach((each) => {
                  if (attr.name === each.name && attr.type === each.type) {
                    count++;
                  }
                });
                if (count != 0) {
                  duplicateAttributeSet[index].attributes.push(attr);
                }
              });
            });
            const attributesSet = duplicateAttributeSet.filter((each) => each.attributes.length);
            try {
              await Fulfiller.findOneAndUpdate({ typeId: data.previousTypeId }, { typeId: newType._id, attributeSet: attributesSet });
              return resolve({
                message: 'Request Template created successfully',
                data: newType,
              });
            } catch (fuErr) {
              logger.error(fuErr, 'ERROR_IN_FIND_AND_UPDATE_FULFILERRS');
              return resolve({
                message: 'Request Template created successfully',
                data: newType,
              });
            }
          } else {
            return resolve({
              message: 'Request Template created successfully',
              data: newType,
            });
          }
        } catch (fErr) {
          logger.error(fErr, 'ERROR_IN_FIND_FULFILERRS');
          return resolve(newType);
        }
      } else {
        return resolve({
          message: `${newTypeOutput.isTA ? 'Request' : 'Project' } Template created successfully`,
          data: newType,
          code: 200,
        });
      }
    } catch (saveErr) {
      // 1.a Project type creation in DB failed
      if (saveErr.code === 11000) {
        return reject({ message: 'Duplicate: Project type with same name already exist in system', code: 403, error: 'ERROR_DB_SAVE' });
      } 
      else if (saveErr.name === 'ValidationError') {
        // Handle validation error from the pre-save hook
        return reject({ message: saveErr.message, code: 400, error: 'VALIDATION_ERROR' });
      }else {
        return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_SAVE' });
      }
    }
  });
}

/**
 * Get all project custom types from DB
 * @return {Promise} Resolved when the project custom types has been retrieved.
 */
function getCustomProjectTypes() {
  return new Promise(async (resolve, reject) => {
    // Get all project custom types from DB
    try {
      const types = await Type.find({ $or: [{ "isDeleted": { "$exists": false } }, { isDeleted: false }]}).lean();
      // 1.b. Project types found
      return resolve({ types });
    } catch (findErr) {
      // 1.a If error, reject with error
      logger.error(findErr, 'ERROR_DB_FIND_PROJECT_TYPES');
      return reject({
        message: 'Failed to find project templates',
        code: 500,
        error: 'ERROR_DB_FIND_PROJECT_TYPES',
      });
    }
  });
}

/**
 * Get all project custom types from DB
 * @return {Promise} Resolved when the project custom types has been retrieved.
 */
function getCustomProjectTypesById(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get all project custom types from DB
      const types = await Type.find({ $and: [{ categoryId: opts.categoryId }, { $or: [{ "isDeleted": { "$exists": false } }, { isDeleted: false }] }]}, { name: 1, _id: 1 }).lean();
      // 1.b. Project types found
      return resolve({
        status: 200,
        message: 'Successfully fetched types data by id',
        data: types,
      });
    } catch (findErr) {
      // 1.a If error, reject with error
      logger.error(findErr, 'ERROR_DB_FIND_PROJECT_TYPES_BY_ID');
      return reject({
        message: 'Failed to find project types by id.',
        code: 500,
        error: 'ERROR_DB_FIND_PROJECT_TYPES_BY_ID',
      });
    }
  });
}

/**
 * Updates project type of a single project.
 *
 * @method updateProjectType
 * @param {Object} opts The request options sent to the Jira API.
 * @param {String} opts.projectIdOrKey The project id or key.
 * @param {String} opts.typeId The project custom type.
 * @return {Promise} Resolved when the project type has been updated.
 */
function updateProjectType(opts) {
  return new Promise(async (resolve, reject) => {
    // Update projeect type in DB
    const filter = {
      projectID: opts.projectIdOrKey,
    };
    const update = {
      $set: {
        'typeData.id': opts.typeId,
      },
    };
    try {
      const res = await Project.findOneAndUpdate(filter, update, { new: true, strict: true, runValidators: true }).lean();
      // 1.b Project type has been successfully updated to db
      resolve(res);
    } catch (err) {
      // 1.a Project type updation in DB failed
      logger.error(err, 'ERROR_DB_UPDATE');
      reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE' });
    }
  });
}

/**
 * Updates custom project type in DB.
 *
 * @method updateCustomProjectType
 * @param {Object} opts The project custom type properties sent to the DB.
 * @param {String} opts.id The project custom type id.
 * @param {Object} opts.data The project custom type data .
 * @return {Promise} Resolved when the project custom type has been updated.
 */
function updateCustomProjectType(opts) {
  return new Promise(async (resolve, reject) => {
    // 1 Update project type in DB
    const filter = {
      _id: opts?.id,
    };
    const update = {
      $set: opts?.data,
    };
    try {
      const res = await Type.findOneAndUpdate(filter, update, { new: true, strict: true, runValidators: true }).lean();
      return resolve(res);
    } catch (err) {
      // 1.a Project type updation in DB failed
      logger.error(err, 'ERROR_DB_UPDATE');
      if (err?.code === 11000) {
        return reject({ message: 'Duplicate: Project type with same name already exist in system', code: 403, error: 'ERROR_DB_UPDATE' });
      }else if (err?.name === 'ValidationError') {
        // Handle validation error from the pre-save hook
        return reject({ message: err?.message , code: 400, error: 'VALIDATION_ERROR' });
      }else {
        return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE' });
      }
    }
  });
}

/**
 * Check if there are matching projects with typeId in DB
 *
 * @method validateCustomProjectType
 * @param {String} typeId The project custom typeId.
 * @return {Promise} Resolved with success when no projects are found matching with project type.
 */
function validateCustomProjectType(typeId) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1 Find matching projects with typeId received from client
      const pData = await Project.findOne({ 'typeData.id': typeId }).lean();
      if (pData) {
        // 1.b If found, reject with error
        return reject({
          message: `Error: Project type is associated with project (${pData.displayName}).`,
          code: 403,
        });
      }
      // 1.c resolve with success
      return resolve('success');
    } catch (pErr) {
      // 1.a If error, reject with error
      logger.error(pErr, 'ERROR_DB_FIND_PROJECT_CUSTOM_TYPE');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_PROJECT_CUSTOM_TYPE',
      });
    }
  });
}

/**
 * Delete custom project type in DB.
 *
 * @method deleteCustomProjectType
 * @param {Object} opts The project custom type properties.
 * @param {String} opts.id The project custom type id.
 * @return {Promise} Resolved when the project custom type has been removed.
 */
function deleteCustomProjectType(opts) {
  return new Promise((resolve, reject) => {
    // 1 Find matching projects with typeId received from client
    validateCustomProjectType(opts.id).then(async (dbRes) => {
      // 2.a If success, delete custom project type from DB
      if (dbRes === 'success') {
        try {
          const filter = {
            _id: opts.id,
          };
          const res = await Type.findOneAndDelete(filter).lean();
          // 2.b Project custom type successfully deleted from DB
          if (res?.isTA) {
            try {
              const taRes = await ProjectRequest.deleteOne({ 'typeData.id': opts.id }).lean();
              if (taRes) {
                try {
                  await Fulfiller.deleteOne({ typeId: opts.id }).lean();
                  return resolve({
                    message: 'Template deleted successfully',
                    code: 200,
                  });
                } catch (pErr) {
                  // 1.a. Failure to delete category, log and reject
                  logger.error(taErr, 'ERROR_DB_DELETE_TYPE');
                  return reject({
                    message: 'Failed to delete type in fulfiller',
                    code: 500,
                    error: 'ERROR_DB_DELETE_TYPE',
                  });
                }
              }
            } catch (taErr) {
              // 1.a. Failure to delete category, log and reject
              logger.error(taErr, 'ERROR_DB_DELETE_TYPE');
              return reject({
                message: 'Failed to delete type in project request',
                code: 500,
                error: 'ERROR_DB_DELETE_TYPE',
              });
            }
          } else {
            return resolve(res);
          }
        } catch (err) {
          logger.error(err, 'ERROR_DB_DELETE');
          return reject({ message: 'Failed to find removed type', code: 500, error: 'ERROR_DB_DELETE' });
        }
      }
    }).catch((dbErr) => {
      return reject(dbErr);
    });
  });
}

function validateCustomRequestType(typeId) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1 Find matching requests with typeId received from client
      const pData = await ProjectRequest.findOne({ 'typeData.id': typeId }).lean();
      if (pData) {
        // 1.b If found, reject with error
        // logger.error(pErr, 'ERROR_DB_FIND_REQUEST_CUSTOM_TYPE');
        return reject({
          message: `Error: Request type is associated with request (${pData.displayName}).`,
          code: 403,
        });
      } else {
        // 1.c resolve with success
        return resolve('success');
      }
    } catch (pErr) {
      // 1.a If error, reject with error
      logger.error(pErr, 'ERROR_DB_FIND_REQUEST_CUSTOM_TYPE');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_REQUEST_CUSTOM_TYPE',
      });
    }
  });
}

/**
 * Upload html for custom project type in DB.
 *
 * @method uploadHtmlCustomProjectType
 * @param {Object} opts The project custom type properties sent to the DB.
 * @param {String} opts.id The project custom type id.
 * @param {Object} opts.data The project custom type data .
 * @return {Promise} Resolved when the project custom type has been updated.
 */
function uploadHtmlCustomProjectType(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const types = await Type.findOne({ 'htmlFile.originalName': opts?.file?.hapi?.filename }).lean();
      // 1.b. Project types found
      if (types && types.htmlFile) {
        const data = {
          id: opts.id,
          data: {
            htmlFile: types.htmlFile,
          },
        };
        updateCustomProjectType(data).then((result) => {
          return resolve(result);
        }, (err) => {
          return reject(err);
        });
      } else {
        const UPLOAD_PATH = 'uploads';
        const fileOptions = { dest: `${UPLOAD_PATH}/` };
        if (!fs.existsSync(UPLOAD_PATH)) {
          try {
            fs.mkdirSync(UPLOAD_PATH, { recursive: true });
            // save the file
            uploader(opts.file, fileOptions).then((uploadRes) => {
              // save data to database
              const data = {
                id: opts.id,
                data: {
                  htmlFile: uploadRes,
                },
              };
              updateCustomProjectType(data).then((result) => {
                return resolve(result);
              }).catch((err) => {
                return reject(err);
              });
            }).catch((uploadErr) => {
              return reject(uploadErr);
            });
          } catch (diErr) {
            return reject({
              code: 400,
              message: 'Failed to create upload directory',
              diErr
            })
          }
        } else {
          // save the file
          uploader(opts.file, fileOptions).then((uploadRes) => {
            // save data to database
            const data = {
              id: opts.id,
              data: {
                htmlFile: uploadRes,
              },
            };
            updateCustomProjectType(data).then((result) => {
              return resolve(result);
            }, (err) => {
              return reject(err);
            });
          }, (uploadErr) => {
            return reject(uploadErr);
          });
        }
      }
    } catch (findErr) {
      // 1.a If error, reject with error
      logger.error(findErr, 'ERROR_DB_FIND_PROJECT_TYPES');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_PROJECT_TYPES',
      });
      
    }
  });
}

/**
 * Uploades profile image.
 *
 * @method uploader
 * @param {Object} file The profile image file data.
 * @param {Object} options The profile image options .
 * @return {Promise} Resolved when the profile image has been uploaded.
 */
function uploader(file, options) {
  return new Promise(async (resolve, reject) => {
    if (!file) {
      return reject({
        message: 'No file uploaded.',
        code: 500,
      });
    }

    const originalName = file.hapi.filename;
    const fileName = `${createRandomString()}_${file.hapi.filename.replace(/[ )(]+/g, '')}`;
    const filePath = `${options.dest}${fileName}`;
    const fileStream = fs.createWriteStream(filePath);

    try {
      await pipeline(file, fileStream); // This waits for stream to finish
      const fileDetails = {
        originalName,
        fileName,
        mimeType: file.hapi.headers['content-type'],
        destination: `${options.dest}`,
        filePath,
      };

      return resolve(fileDetails);
    } catch (err) {
      console.error('Pipeline failed:', err);
      return reject({
        message: 'File upload failed.',
        code: 500,
        error: err,
      });
    }
  });
}

/**
 * Upload request attachments to S3 bucket
 * @param {Array<{ data: String, name: String }>} files Request attachments
 * @param {String} requestId Request Id or display Id
 * @returns {Promise<Promise<String>[]>}
 */
function uploadProjectAttchments(files, requestId) {
  try {
    const s3 = new S3();
    const prefix = process.env.NODE_ENV === 'production' ? 'ProjectProduction' : 'ProjectStaging';
    const defaultUploadPath = `${prefix}/${requestId}/`;
    return new Promise((resolve, reject) => {
      const uploads = files.map((file) => {
        return new Promise((res, rej) => {
          const content = new Buffer.from(file.data);
          const fileName = defaultUploadPath + file.name;
          s3.upload(fileName, content)
            .then((data) => { return res(data); })
            .catch((err) => { return rej(err); });
        });
      });
      return resolve(uploads);
    });
  } catch (error) {
    return Promise.reject({ code: 500, message: 'Something went wrong', error });
  }
}

/**
 * Saves the project details in DB
 * @author Aniket
 * @param {Object} data The project properties
 * @returns {Promise}
*/
async function saveProjectDetails(data) {
  try {
    const instance = new Project(data);
    const newProject = await instance.save();
    return newProject; // resolved value
  } catch (error) {
    logger.error(error, 'ERROR_DB_SAVE');
    if (error.code === 11000) {
      throw {
        message: 'Duplicate: Project with same name and lead already exists in the system',
        code: 403,
        error: 'ERROR_DB_SAVE',
      };
    } else {
      throw {
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_SAVE',
      };
    }
  }
}

/**
 * Create Scope project.
 *
 * @param {Project} project project details
 * @return {Promise.<{ code: Number, error: String, message: String, id: String, key: String, displayId: String }>
 * | Promise.<{ code: Number, error: String, message: String }>} Resolved when the project has been created.
 */
async function createScopeProject(project) {
  try {
    const customFieldsData = {
      ta: 'NA',
      compound: 'NA',
      lead: project?.lead?.displayName || 'NA',
      description: project?.description || '',
      client: 'NA',
      deliverable: 'NA',
      das_pas: 'NA',
      idpNumber: 'NA',
      devPhase: 'NA',
      scientist: 'NA',
    };

    if (Array.isArray(project?.customFields)) {
      for (const item of project.customFields) {
        const name = item?.name?.toLowerCase().trim();
        const value = typeof item?.value === 'string' ? (item?.value?.trim() || '') : item?.value;

        switch (name) {
          case 'compound name or number':
          case 'compound name or #':
            customFieldsData.compound = value;
            break;
          case 'ta':
          case 'therapeutic area':
            customFieldsData.ta = value;
            break;
          case 'das/pas':
            customFieldsData.das_pas = value;
            break;
          case 'development phase':
            customFieldsData.devPhase = value;
            break;
          case 'idp number':
            customFieldsData.idpNumber = value;
            break;
          case 'scientist':
            customFieldsData.scientist = value;
            break;
          case 'client name':
            customFieldsData.client = value;
            break;
          case 'deliverable':
            customFieldsData.deliverable = value;
            break;
          default:
            break;
        }
      }
    }

    // Add scope-admin group as collaborator
    project.collaborators = Array.isArray(project.collaborators) ? project.collaborators : [];
    project.collaborators.push({
      type: 'group',
      displayName: 'scope-administrators',
      name: 'scope-administrators',
    });

    const displayId = `${moment().format('YYYY')}-${project.projectID}`;
    project.displayId = displayId;

    if (Array.isArray(project.files) && project.files.length > 0) {
      try {
        await uploadProjectAttchments([...project.files], displayId);
        project.hasAttachments = true;
      } catch (error) {
        throw { message: 'ERROR_IN_UPLOADING_FILES', code: 404, error };
      }
    }

    const { requestMeta } = project;

    const savedProject = await saveProjectDetails(project);

    if (savedProject && requestMeta && requestMeta.requestId) {
      try {
        const utcNow = moment.utc().valueOf();

        const projectRequestUpdates = {
          state: project.status === 'Completed'
            ? PROJECT_REQUEST.STATES.COMPLETED
            : PROJECT_REQUEST.STATES.INPROGRESS,
          fulfilledAt: new Date(),
          projectId: savedProject._id,
          projectKey: project.projectID,
          fulfilledBy: savedProject.createdBy,
          completedAt: project.status === 'Completed' ? new Date(utcNow) : null,
        };

        if (project.isAutomateRequest && !['On Hold', 'Completed'].includes(projectRequestUpdates.state)) {
          projectRequestUpdates.state = PROJECT_REQUEST.STATES.RECEIVED;
        }

        const updatedRequest = await ProjectRequest.findOneAndUpdate(
          { _id: requestMeta.requestId },
          projectRequestUpdates,
          { strict: true, runValidators: true }
        );

        savedProject.requestId = updatedRequest?._id;
        await savedProject.save();
      } catch (prError) {
        throw {
          message: `Failed to update project request details for (${requestMeta.displayId}) in Scope.`,
          code: 500,
          id: project.projectID,
          key: project.key,
          displayId,
        };
      }
    }

    return {
      message: `Project (${displayId}) Created Successfully in Scope.`,
      code: 207,
      id: project.projectID,
      key: project.key,
      data: savedProject,
      displayId,
    };
  } catch (error) {
    throw error;
  }
}


/**
 * Creates a project.
 *
 * @param {Object} opts The request options.
 * @param {Object} opts.project The project properties.
 * @param {Object} curentUser The details of current logged-in user.
 * @return {Promise} Resolved when the project has been created.
 */
function createProject(opts, currentUser) {
  return new Promise(async (resolve, reject) => {
    // 1. Search for Guest group.
    const group = await Group.findOne({ name: GROUPS.GUEST }).lean();
    // Guest group must be linked with Gitlab group.
    if (!(group && group.gitlabId)) {
      return reject({
        code: 404,
        message: 'Guest Group not found',
        error: 'ERROR_FIND_GUEST_GROUP'
      });
    }
    // Create random key using function createRandomString.
    const key = createRandomString('', 4);
    try {
      const counterData = await Counter.findOneAndUpdate(
        { type: 'projectID' },
        { $inc: { count: +1 } },
        { new: true, strict: true, runValidators: true }).lean();
        if (counterData) {
          try {
            // 1.b Counter has been successfully updated in db
            const projectID = counterData.count.toString();
            const originalData = opts.project;
            originalData.key = `P${key.toUpperCase()}`;
            originalData.projectID = projectID;
            originalData.statusLastUpdatedBy = currentUser?.name || currentUser?.username || '';
            originalData.createdBy = currentUser._id; // Project Creator
            const categoryId = originalData?.categoryId;
            if (!categoryId) {
              return reject({
                message: 'categoryId not found',
                code: 400,
                error: 'CATEGORYID_NOT_FOUND',
              });
            }
            let isSMHCaseStudyTemplate; 
            try {
              const category = await Category.findById(categoryId).lean();
              isSMHCaseStudyTemplate = category?.name === 'SMH' && originalData?.importProjectCustomType === 'Case Study';
            } catch (error) {
              return reject(error);
            }
            if (!opts?.isRequestProject) {
              const fileInputFields = originalData.customFields.filter((cf) => cf.type === 'FILEINPUT' && cf.values.length);
              for (let i = 0; i < fileInputFields.length; i++) {
                const fileInputIndex = originalData.customFields.findIndex((cf) => cf.type === 'FILEINPUT' && cf.values.length);
                if (fileInputIndex > -1) {
                  const fileData = originalData.customFields[fileInputIndex];
                  try {
                    const fileInputData = await uploadCustomFieldsAttachments('projects', fileData.values, originalData.projectID, fileData.name);
                    if (fileInputData?.length) {
                      originalData.customFields[fileInputIndex].values = originalData.customFields[fileInputIndex].values.map((data) => ({
                        name: data.name,
                        link: `${process.env.NODE_ENV === 'production' ? 'production' : 'staging'}/projects/${originalData.projectID}/${fileData.name}`
                      }));
                    }
                  } catch (error) {
                    return reject({
                      code: 400,
                      message: 'Failed to upload attachments in custom fields'
                    })
                  }
                }
              }
            }
            // 2. If version control is disabled, Create project only in scope.
            if (!opts.versionControl || originalData?.gitVersionControl || process.env.GITLAB_STATUS === 'true' || isSMHCaseStudyTemplate) {
              try {
                originalData.gitlab = { status: !originalData?.gitVersionControl ? 'New' : 'None' };
                if (originalData?.gitRepoLink) {
                  const isGitRepoLinkIsThereInProjectCollection = await Project.findOne({ "gitlab.sdsForgeImportLink": { $regex: originalData.gitRepoLink, $options: "i" }}).lean();
                  if (isGitRepoLinkIsThereInProjectCollection?.gitlab && Object.keys(isGitRepoLinkIsThereInProjectCollection.gitlab)?.length) {
                    originalData.gitlab = { ...isGitRepoLinkIsThereInProjectCollection.gitlab, status: 'Existing' };
                  } else {
                    let gitNotExist = {
                      projectUrl: originalData.gitRepoLink,
                      projectId: null,
                      sdsForgeImportLink: originalData.gitRepoLink,
                      groupId: null,
                      status: 'Existing'
                    };
                    originalData.gitlab = { ...gitNotExist, status: 'Existing' }
                  }
                }
                const taCustomField = (originalData?.customFields || [])?.find(elem => elem.name === 'TA');
                let caseStudyApprover;
                if (taCustomField?.value) {
                  caseStudyApprover = await CaseStudyApprover.findOne({ value: taCustomField?.value }).lean() || {};
                  originalData.caseStudyApproversId = caseStudyApprover?._id;
                }
                if(isSMHCaseStudyTemplate) {
                  originalData.smhApprovalStatus = SMH_CASE_STUDY_STATUS.PENDING;
                }
                const dbRes = await createScopeProject(originalData);
                let toEmails = [];
                  if (caseStudyApprover?.approvers?.length) {
                  toEmails = caseStudyApprover?.approvers?.map((approver) => approver?.email) || [];
                } else {
                  const superAdminResponse = await User.findOne({ username: 'jira_admin' }).lean();
                  toEmails.push(superAdminResponse?.email);
                }
                if (isSMHCaseStudyTemplate && toEmails?.length) {
                  const emailData = {
                    to: toEmails,
                    cc: [currentUser?.email || ''],
                    subject: 'SMH Case Study Approval Request',
                    html: `<p>Hello ,</p>
                            <p>${formatFullName(currentUser?.name)} (${currentUser?.username}) submitted a case study project for your approval through the SMH Central repository. Please review and approve it here: <a href="${process.env.UI_HOST}/smh/projects/detail-${dbRes?.data?._doc?.projectID}">Project Link</a></p>
                            </br>
                            <p>Thank you,</br>Team Scope</p><hr>`
                  };
                  await sendEmail(emailData);
                }
                // 2.a Project created successfully in scope.
                return resolve(dbRes);
              } catch (error) {
                // 2.b Failed to create project in scope.
                logger.error(error, 'FAILED_TO_CREATE_PROJECT')
                return reject(error);
              }
            }
            // 3. Create Project in Gitlab.
            if(!isSMHCaseStudyTemplate) {
              const gRes = await createGitlabProject(originalData, currentUser, group);
              if (gRes && gRes.data) {
                return resolve({ ...gRes });
              }
            }
          } catch (gErr) {
            // 3.b Failed to create project in Gitlab.
            if (gErr.error === 'ERROR_GITLAB_CREATE_PROJECT') {
              try {
                const data = {
                  ...gErr.data,
                  gitlab: { ...gErr.data.gitlab, status: 'New'}
                }
                const dbRes = await createScopeProject({ ...data });
                // 2.a Project created successfully in scope.
                return resolve({
                  ...dbRes, message: `${dbRes.message} but failed to create project in gitlab.`
                });
              } catch (error) {
                logger.error(error, 'ERROR_IN_CREATE_PROJECT');
                return reject({
                  message: error?.message || 'Failed to create project',
                  code: error?.code || 500,
                  error: 'ERROR_IN_CREATE_PROJECT',
                });
              }
            }
            return reject(gErr);
          }
        } else {
          // 1.c Failed to update counter.
          return reject({ message: 'Error in updating Project ID count', code: 500, error: 'ERROR_DB_COUNTER_UPDATE' });
        }
    } catch (errCount) {
      // 1.a Counter updation in DB failed
      logger.error(errCount, 'ERROR_DB_COUNTER_UPDATE');
      if (errCount.code === 11000) {
        return reject({ message: 'Duplicate: Counter with same value already exist in system', code: 403, error: 'ERROR_DB_COUNTER_UPDATE' });
      } else {
        return reject({ message: 'Error in updating Project ID count', code: 500, error: 'ERROR_DB_COUNTER_UPDATE' });
      }
    }
  });
}

/**
 * Create Gitlab project.
 *
 * @param {Project} project project details
 * @param {LoggedUser} currentUser The details of current logged-in user.
 * @param {Group} group group details
 * @return {Promise.<{ code: Number, error: String, message: String, id: String, key: String, displayId: String, data: Project }>
 * | Promise.<{ code: Number, error: String, message: String }>} Resolved when the project has been created.
 */
function createGitlabProject(project, currentUser, group) {
  return new Promise(async (resolve, reject) => {
    try {
      let gitlabGroup = group; // Alfresco guest group

      // Check if group exists in project.
      if (!(gitlabGroup && gitlabGroup.gitlabId)) {
        gitlabGroup = await Group.findOne({ name: GROUPS.GUEST }).lean();
      }

      // Guest group must be linked with Alfresco group.
      if (!(gitlabGroup && gitlabGroup.gitlabId)) {
        return reject({
          code: 404, 
          message: 'Guest Group not found',
          error: 'ERROR_FIND_GUEST_GROUP'
        });
      }

      const existingProject = await Project.findOne({ projectID: project.projectID });
      // Check if project is already created in scope.
      if (existingProject && existingProject._id && existingProject._doc) {
        project = { ...existingProject._doc };
      }

      // Reject if project is already linked with gitlab server.
      if (project && project.gitlab && project.gitlab.projectId && project.gitlab.projectId.includes(project.projectID)) {
        return reject({ code: 409, message: 'Project already linked to gitlab', data: project });
      }

      // Defaults
      const customFieldsData = {
        ta: 'NA',
        compound: 'NA',
        lead: project.lead.displayName,
        description: project.description,
        client: 'NA',
        deliverable: 'NA',
        das_pas: 'NA',
        idpNumber: 'NA',
        devPhase: 'NA',
        scientist: 'NA',
      };

      if (project.customFields.length) {
        project.customFields.forEach((item) => {
          if (item.name.toLowerCase() === 'compound name or number' ||
            item.name.toLowerCase() === 'compound name or #') {
            customFieldsData.compound = item.value.trim();
          }
          if (item.name.toLowerCase() === 'ta' || item.name.toLowerCase() === 'therapeutic area') {
            customFieldsData.ta = item.value.trim();
          }
          if (item.name.toLowerCase() === 'das/pas') {
            customFieldsData.das_pas = item.value.trim();
          }
          if (item.name.toLowerCase() === 'development phase') {
            customFieldsData.devPhase = item.value.trim();
          }
          if (item.name.toLowerCase() === 'idp number') {
            customFieldsData.idpNumber = item.value.trim();
          }
          if (item.name.toLowerCase() === 'scientist') {
            customFieldsData.scientist = item.value.trim();
          }
          if (item.name.toLowerCase() === 'client name') {
            customFieldsData.client = item.value.trim();
          }
          if (item.name.toLowerCase() === 'deliverable') {
            customFieldsData.deliverable = item.value.trim();
          }
        });
      }

      // Add Collaborators to project if exists.
      if (project.collaborators && project.collaborators.length > 0) {
        project.collaborators.push({
          type: 'group',
          displayName: 'scope-administrators',
          name: 'scope-administrators',
        });
      }

      // Gitlab Request Payload
      const payload = {
        name: `${moment().format('YYYY')}-${project.projectID}-${project.displayName}`,
        description: project.description,
        lfs_enabled: false,
      };

      if (project.requestMeta) {
        payload.name = `${moment().format('YYYY')}-${project.projectID}`;
        payload.description = project.displayName;
      }
      // Gitlab user - Scope-Admin
      const username = currentUser.username === process.env.JIRA_ADMIN ? 'root' : currentUser.username;

      // Alfresco repository path
      const alfrescoProjectRoot = `/Projects/${moment().format('YYYY')}-${project.projectID}-${project.displayName}`;

      const category = await Category.findOne({ _id: project.categoryId }).lean();
      if (project && project.requestMeta && Object.keys(project.requestMeta)?.length) {
        const therapeuticArea = await Category.findOne({ _id: project.requestMeta.categoryId }).lean();
        customFieldsData.ta = therapeuticArea.name.split('-')[0];
      }
      console.log({payload}, {username}, project.lead.userName,
        {alfrescoProjectRoot}, {customFieldsData}, {project}, (category && category.name) || '')
      // 1. Save project to gitlab server.
      gitlabProjectServices.createProject(payload, username, project.lead.userName,
        alfrescoProjectRoot, customFieldsData, project, (category && category.name) || '').then(async (response) => {
          if (response) {
            const httpHref = response?.body?.links?.clone?.find(link => link.name === 'http')?.href || "";
            const browseHref = response?.body?.links?.self?.[0]?.href;
            // 1. Project was successfully saved to Gitlab.
            try {
              // 2. Add project to gitlab guest group.
              // await addProjectsToGitlabGroup(gitlabGroup.gitlabId, [response.body.id], GITLAB.ACCESS_LEVEL.REPORTER);
              // 2.b Project was successfully added to Gitlab guest group.
              // Update the project details
              project.displayId = `${moment().format('YYYY')}-${project.projectID}`;
              project.gitlab = {
                projectUrl: browseHref,
                projectId: response.body.id,
                sdsForgeImportLink: httpHref,
                status: 'New',
                groupId: [gitlabGroup.gitlabId],
              };
  
              try {
                // 3. Save the project details in DB
                let dbRes = null;
                const requestMeta = project.requestMeta;
                // delete project.requestMeta;
  
                if (project._id) {
                  const filter = { _id: new mongoose.Types.ObjectId(project._id) };
                  const update = { gitlab: project.gitlab };
                  dbRes = await Project.findOneAndUpdate(filter, update);
                } else {
                  if (Array.isArray(project.files) && project.files.length > 0) {
                    try {
                      await uploadProjectAttchments([...project.files], project.displayId);
                      project.hasAttachments = true;
                    } catch (error) {
                      throw { message: 'ERROR_IN_UPLOADING_FILES', code: 404, error };
                    }
                  }
                  dbRes = await saveProjectDetails(project);
                  project._id = dbRes._id;
                }
  
                if (project._id && requestMeta && Object.keys(requestMeta)?.length) {
                  try {
                    var utc = moment.utc().valueOf();
                    const projectRequestUpdates = {
                      state: project.status === 'Completed' ? PROJECT_REQUEST.STATES.COMPLETED : PROJECT_REQUEST.STATES.INPROGRESS,
                      fulfilledAt: new Date(),
                      projectId: dbRes._id,
                      projectKey: project.projectID,
                      fulfilledBy: dbRes.createdBy,
                      completedAt: project.status === 'Completed' ? moment.utc(utc).toDate() : null,
                    };
                    // ? If request is automated change state to received.
                    if (project?.isAutomateRequest && !['On Hold', 'Completed'].includes(projectRequestUpdates.state)) {
                      projectRequestUpdates.state = PROJECT_REQUEST.STATES.RECEIVED;
                    }
                    const projectRequest = await ProjectRequest.findOneAndUpdate(
                      { _id: requestMeta.requestId },
                      projectRequestUpdates,
                      {strict: true, runValidators: true });
                      dbRes.requestId = projectRequest._id;
                      dbRes.save();
                  } catch (prError) {
                    return reject({
                      message: `Failed to update project request details for (${requestMeta.displayId}) in Scope.`,
                      code: 500,
                      id: project.projectID,
                      key: project.key,
                      displayId: `${project.displayId}`,
                    })
                  }
                }
                // 3.a Project details successfully saved to scope db.
                return resolve({
                  message: `Project (${project.displayId}) Created Successfully in Gitlab.`,
                  code: 201,
                  id: project.projectID,
                  key: project.key,
                  displayId: `${project.displayId}`,
                  data: { ...project },
                });
              } catch (dbError) {
                // 3.b Failed to save project details to scope db.
                return reject(dbError);
              }
            } catch (gError) {
              // 2.c Failed to add project to gitlab guest group.
              return reject(gError);
            }
          }
        }).catch((error) => {
          return reject({
            code: error?.code || 409,
            error: error?.error || 'ERROR_GITLAB_CREATE_PROJECT',
            message: error?.message || 'Failed to create project in gitlab.',
            data: error?.data || [],
          });
        });
    } catch (error) {
      // 1.c Failed to save project in alfresco server.
      return reject(error);
    }
  });
}

/**
 * Creates a project in gitlab and alfresco.
 *
 * @param {Object} opts The request options.
 * @param {Object} curentUser The details of current logged-in user.
 * @return {Promise} Resolved when the project has been created.
 */
function createVersionControlProjects(opts, currentUser) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Search for Guest group.
      const group = await Group.findOne({ name: GROUPS.GUEST }).lean();
      // Guest group must be linked with Gitlab group.
      if (!(group && group.gitlabId && group.alfrescoId)) {
        return reject({
          code: 404, 
          message: 'Guest Group not found',
          error: 'ERROR_FIND_GUEST_GROUP'
        });
      }
      const project = await Project.findOne({ projectID: opts.projectID }).lean();
      if(!project){
        logger.error('ERROR_GITLAB_CREATE_PROJECT');
        return reject({
          code: 500,
          success: true,
          message: 'Failed to create project in Scope Code(GitLab)'
        });
      }
      // 2. Create project in gitlab.
      const gRes = await createGitlabProject(opts, currentUser, group);
      return resolve({ ...gRes });
    } catch (error) {
      // 2.b Failed to create project in gitlab.
      return reject(error); 
    }
  });
}

/**
 * Create Alfresco project.
 * 
 * @param {Project} project project details
 * @param {Group} group group details
 * @return {Promise.<{ code: Number, error: String, message: String, id: String, key: String, displayId: String, data: Object }>
 * | Promise.<{ code: Number, error: String, message: String }>} Resolved when the project has been created.
 */
function createAlfrescoProject(project, group) {
  return new Promise(async (resolve, reject) => {
    // TODO: Alfresco LFS is down due to maintance please remove below code once Scope LFS is up and running.
    return reject({
      message: 'Scope LFS down due to maintenance',
      code: 502,
      code: 'ERROR_CREATE_ALFRESCO_ENTRY'
    });
    try {
      let alfrescoGroup = group; // Alfresco guest group

      // Check if group exists in project.
      if (!(alfrescoGroup && alfrescoGroup.alfrescoId)) {
        alfrescoGroup = await Group.findOne({ name: GROUPS.GUEST });
      }

      // Guest group must be linked with Alfresco group.
      if (!(alfrescoGroup && alfrescoGroup.alfrescoId)) {
        return reject({
          code: 404, 
          message: 'Guest Group not found',
          error: 'ERROR_FIND_GUEST_GROUP'
        });
      }

      const existingProject = await Project.findOne({ projectID: project.projectID });
      // Check if project is already created in scope.
      if (existingProject && existingProject._id && existingProject._doc) {
        project = { ...existingProject._doc };
      }

      // Reject if project is already linked with alfresco server.
      if (project && project.alfresco && project.alfresco.nodeId) {
        return reject({ code: 409, message: 'Project already linked to alfresco', data: project });
      }

      // Alfresco project will be saved to below path.
      let alfrescoProjectRoot = `/Projects/${moment().format('YYYY')}-${project.projectID}-${project.displayName}`;

      if (project.requestMeta) {
        alfrescoProjectRoot = `/Projects/${moment().format('YYYY')}-${project.projectID}`;
        project.name = `${moment().format('YYYY')}-${project.projectID}`;
      }

      const queryObj = {
        projectRoot: alfrescoProjectRoot,
        repositoryId: project.gitlab.projectId, // * Gitlab project must be linked before creating project in alfresco.
      };

      // 1. Create project in alfresco server.
      const response = await global.services.alfresco.projectServices.createProject(queryObj, project.lead.userName, project);
      // 1.a Project successfully created in alfresco.
      if (response) {
        try {
          // 2. Share project with alfresco group.
          await addProjectsToAlfrescoGroup(alfrescoGroup.alfrescoId, [response.body.nodeId], ALFRESCO.ACCESS_LEVEL.CONSUMER);
          // 2.a Project successfully shared with guest group.
          project.alfresco = {
            projectRoot: response.body.projectRoot,
            repositoryId: response.body.repositoryId,
            nodeId: response.body.nodeId,
            groupId: [alfrescoGroup.alfrescoId],
          };
          try {
            // 3. Update gitlab .dcmProperties content with new rid and root
            const commitOpts = {
              filePath: '.dcmproperties',
              branch: 'master',
              commitMessage: 'Project successfully linked with large file storage system',
              updates: [
                {
                  oldContent: 'projectRoot = NA',
                  newContent: `projectRoot = ${alfrescoProjectRoot}`,
                },
                {
                  oldContent: 'rid = NA',
                  newContent: `rid = ${project.gitlab.projectId}`,
                },
              ]
            };
            const remote = await updateGitlabFile(project, commitOpts);
            if (remote && remote.data) {
              try {
                const filter = { _id: mongoose.Types.ObjectId(project._id) };
                const update = { alfresco: project.alfresco };
                // 3. Save project to scope database.
                const dbRes = await Project.findOneAndUpdate(filter, update);
                if (dbRes) {
                  // 3.a Project successfully saved to scope db.
                  return resolve({
                    message: `Project (${project.displayId}) Created Successfully in alfresco.`,
                    code: 201,
                    id: project.projectID,
                    key: project.key,
                    displayId: `${project.displayId}`,
                  });
                }
              } catch (dbErr) {
                // 3.b Failed to save project to scope db.
                return reject(dbErr);
              }
            }
          } catch (cError) {
            return reject(cError);
          }
        } catch (gError) {
          // 2.b Failed to add project to guest group.
          return reject(gError);
        }
      } else {
        // 1.b Failed to get response from Alfresco.
        return reject({
          code: error.code || 409,
          error: error.error || 'ERROR_ALFRESCO_CREATE_PROJECT',
          message: error.message || 'Failed to create project in alfresco.'
        });
      }
    } catch (error) {
      // 1.c Failed to save project in Alfresco.
      return reject(error); 
    }
  });
}

/**
 * Update Gitlab File Content
 * 
 * @private
 * @method updateGitlabFile
 * 
 * @param {Project} project project details
 * @param {{ 
 *  filePath: String,
 *  branch: String,
 *  commitMessage: String
 *  updates: Array.<{ oldContent: String, newContent: String }>,
 * }} opts Update options
 * @returns {Promise.<{ code: Number, message: String, data: Object }>} Resolved when file is updated
 */
function updateGitlabFile(project, opts) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Fetch the file to get the file content.
      const filePath = encodeURI(opts.filePath);
      const fetchFile = await gitlabProjectServices.fetchFile(project.gitlab.projectId, filePath, opts.branch);
      if (fetchFile && fetchFile.body && fetchFile.body.content) {
        // 1.a File successfully fetched from remote. Decode it from base45 to ascii
        const contentBuffer = new Buffer.from(fetchFile.body.content, 'base64');
        const content = contentBuffer.toString('ascii');
        // 2. Update the file content.
        let newContent = content;
        opts.updates.forEach((update) => {
          // 2.a Patch changes to file content.
          newContent = newContent.replace(update.oldContent, update.newContent);
        });
        try {
          // Gitlab commit payload.
          const actions = [{
            action: 'update',
            file_path: opts.filePath,
            content: newContent,
          }];
          // 3. Push changes to remote.
          const gitlabCommit = await gitlabProjectServices.updateContent(project.gitlab.projectId, actions, opts.commitMessage);
          if (gitlabCommit) {
            // 3.a Changes successfully applied to remote branch.
            return resolve({
              message: `Successfully updated gitlab file content.`,
              code: 201,
              data: gitlabCommit.body,
            });
          }
        } catch (cError) {
          // 3.b Failed to push changes to remote.
          reject(cError);
        }
      }
    } catch (fError) {
      // 1.b Failed to fetch file from remote.
      reject(fError);
    }
  });
}

async function filterProjects(opts) {
  // Initialize an empty filter object
  const filter = {
      $and: [], // Using $and operator to combine multiple conditions
      $or:[] // Using $or operator to combine multiple conditions
  };

  // Helper function to add regex condition to the filter
  function addRegexCondition(field, value) {
      if (value !== '') {
          const regex = { $regex: new RegExp(_.escapeRegExp(value), 'i') };
          filter.$and.push({ [field]: regex });
      }
  }

  // Helper function to add $in condition to the filter
  function addInCondition(field, values) {
    if (values && values.length > 0) {
      if(field === "collaborators.name"){
        values.forEach((value)=>{
          filter.$or.push({ 'collaborators.name': { $regex: value, $options: 'i' }});
        })
      } else if (field === "leads.name") {
        values.forEach((value) => {
          filter.$or.push({ 'leads.name': { $regex: value, $options: 'i' } });
        })
      }
      else if (field === "displayName" || field === "displayId") {
        //search filter for regex (name , projectid)
        values.forEach((value) => {
          filter.$and.push({ [field]: { $regex: value, $options: 'i' } });
        })
      } else if(field === "createdBy"){
        filter.$and.push({
          $expr: {
            $in: [`$${field}`, values.map(val => val)]
          }
        });
      } else{
        filter.$and.push({
          $expr: {
            // $in: [`$${field}`, values.map(val => val)]
            $in: [
              { $toLower: `$${field}` },
              values.map((val) => val.toLowerCase())
            ]
          }
        });
      }  
    }
  }

  // Helper function to add date range condition to the filter
  function addDateRangeCondition(startValue, endValue,completedValue, createdValue) {
    if (startValue ) {
      filter.$and.push({
        $expr: {
          $gte: [{ $dateToString: { format: "%Y-%m-%d", date: "$startDate" }}, startValue ]
        }
      });
    }
    if (endValue) {
      filter.$and.push({
        $expr: {
            $lte: [{ $dateToString: { format: "%Y-%m-%d", date: "$endDate" }}, endValue ]
        }
      });
    }
    if (completedValue) {
      filter.$and.push({
        $expr: {
            $gte: [{ $dateToString: { format: "%Y-%m-%d", date: "$completedAt" }}, completedValue ]
        }
      });
    }
    if (createdValue) {
      filter.$and.push({
        $expr: {
          $gte: [{ $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, createdValue]
        }
      });
    }
  }

  // Add department condition if provided
  if (opts.department && opts.department !== 'All') {
    filter.$and.push({ 'categoryId': opts.department });
  }

  // Add template condition if provided
  if (opts.template && opts.template !== 'All') {
    const templateName = await Type.findById(opts.template).select('name').lean();
    filter.$and.push({ 'typeData.name': templateName?.name });
  }

  // Add regex condition for query if provided
  if (opts.query && typeof opts.query === 'string') {
    const escChars = ['(', ')'];
    if (escChars.some(eStr => opts.query.includes(eStr))) {
      opts.query = opts.query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }
    const queryConditions = [
      'name',
      'projectID',
      'description',
      'state',
      'displayId',
      'lead.displayName',
      'priority',
      'status',
      'customFields.name',
      'customFields.value',
      'categoryId.name',
      'typeData.name',
      'collaborators.name',
      'collaborators.displayName',
      'gitlab.projectUrl',
      'gitlab.projectId',
      'requestID',
      'createdBy.name',
      'createdBy.username',
      'createdBy.email',
    ].map(field => ({ [field]: { $regex: opts.query, $options: 'i' } }));
    filter.$and.push({ $or: queryConditions });
}

  // Add lead condition if provided need to be removed later
  if (opts.lead) {
    addInCondition('lead.userName', opts.lead.split(', '));
  }

  // Add status condition if provided
  if (opts.status && opts.status !== 'all') {
    addInCondition('status', opts.status.split(', '));
  }

  // Add date range condition for start and end date if provided
  addDateRangeCondition(opts.startDate, opts.endDate, opts.completedAt, opts.createdAt);
  // Add additional filters if provided
  if (opts.filters && opts.filters.length > 0) {
    const defaultColumns = JSON.parse(JSON.stringify(REPORTS_HEADER));
    opts.filters.forEach(filterItem => {
      let fieldName = Object.keys(filterItem)[0].trim();
      if(!defaultColumns.some(column => column.field === fieldName) && fieldName !== "leads"){
        const values = filterItem[Object.keys(filterItem)[0]].split(';').map(value => value.trim());
        if (values.length > 0 && values[0] !== '') {
          const orConditions = values.map(value => ({
            customFields: {
              $elemMatch: {
                name: fieldName,
                value: { $regex: value.trim(), $options: 'i' } 
              }
            }
          }));
        
          filter.$and.push({
            $or: orConditions
          });
        }
      } else{
        if(Object.keys(filterItem)[0].trim() === "lead"){
          fieldName = 'lead.userName';
        }
        if(Object.keys(filterItem)[0].trim() === "collaborators"){
          fieldName = 'collaborators.name';
        }
        if(Object.keys(filterItem)[0].trim() === "leads"){
          fieldName = 'leads.name';
        }
        if(Object.keys(filterItem)[0].trim() === "createdBy"){
          fieldName = 'createdBy';
        }
        let values = filterItem[Object.keys(filterItem)[0]].split(';').map(value => value.trim());
        if(Object.keys(filterItem)[0].trim() === "createdBy"){
          values.forEach((ele,index) =>{
            values[index] = mongoose.Types.ObjectId(ele); 
          }) 
        }
        addInCondition(fieldName, values);
      }
    });
  }

  // Remove empty $and array if no conditions were added
  if (filter.$and.length === 0) {
    delete filter.$and;
  }
  if (filter.$or.length === 0) {
    delete filter.$or;
  }

  // Return the constructed filter
  return filter;
}

function filterProjectByQueryLanguage(projects, opts) {
  return new Promise((resolve, reject) => {
    try {
      const queryLanguageProjects = [];
      const finalArr = projects.map((data) => {
        const result = data;
        if (opts.queryLanguage && (opts.queryLanguage.indexOf('&') !== -1 || opts.queryLanguage.indexOf('|') !== -1 || opts.queryLanguage.indexOf('!') !== -1 || opts.queryLanguage.indexOf('(') !== -1 || opts.queryLanguage.indexOf(')') !== -1)) {
          const customData = JSON.parse(JSON.stringify(result));
          customData.lead = customData.lead.displayName;
          customData.categoryId = customData.categoryId.name;
          customData.typeData = customData.typeData.name;
          customData.gitlabUrl = customData.gitlab && customData.gitlab.projectUrl ? customData.gitlab.projectUrl : '';
          customData.gitlabId = customData.gitlab && customData.gitlab.projectId ? customData.gitlab.projectId : '';
          customData.collaboratorsName = _.map(customData.collaborators, 'name').join(',');
          customData.collaboratorsDisplayName = _.map(customData.collaborators, 'displayName').join(',');
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
                const value = customData[k]
                return value ? value.toString().toLowerCase().includes(field.toLowerCase()) : false;
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
      if (queryLanguageProjects.length) {
        const finalP = _.filter(queryLanguageProjects, 'createdAt');
        return resolve(finalP);
      } else {
        const finalP = _.filter(finalArr, 'createdAt');
        return resolve(finalP);
      }
    } catch (error) {
      logger.error(error, 'ERROR_FILTER_QUERY_LANGUAGE_PROJECTS');
      return reject(projects);
    }
  });
}

/**
 * Get all projects from DB
 * @return {Promise} Resolved when the project has been retrieved.
 */
function getAllProjectsFromDB(opts) {
  return new Promise(async (resolve, reject) => {
    // Get all projects from DB
    const limit = opts.perPage;
    const filter = await filterProjects(opts);
    const requestQuery = requestLookup();
    const dtrQuery = dtrLookup();
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
      {
        $lookup:
        {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdBy',
        },
      },
      {
        $unwind: {
          path: "$createdBy",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          createdBy: "$createdBy.name"
        }
      },
      { $match: filter },
      ...requestQuery,
      ...dtrQuery,
    ];


    const countQuery = [
      { $group: { _id: null, count: { $sum: 1 } } },
      { $project: { _id: 0 } }
    ];

    const goalCompletionPipeline = [
      ...pipeline,
      {
        $facet: {
          "completed": [
            // Filter out documents without a price e.g., _id: 7
            { $match: { status: 'Completed' } },
            ...countQuery,
          ],
          "completedInTime": [
            {
              $match: {
                $and: [
                  { status: 'Completed' },
                  { endDate: { $gt: null } },
                  { completedAt: { $gt: null } },
                  { completedAt: { $lte: '$endDate' } },
                ]
              }
            },
            ...countQuery,
          ],
          "completedBeyondTime": [
            {
              $match: {
                $and: [
                  { status: 'Completed' },
                  { endDate: { $gt: null } },
                  { completedAt: { $gt: null } },
                  { completedAt: { $gt: '$endDate' } },
                ]
              }
            },
            ...countQuery,
          ]
        }
      },
    ];
    const totalCount = [...pipeline, ...countQuery];
    if (opts.sort !== undefined && opts.sort && limit !== 'all' && !opts.queryLanguage)  {
      pipeline.push({ $sort: { updatedAt: -1 } });
    } else {
      pipeline.push({ $sort: { createdAt: -1 } });
    }

    if (opts.tableSort && opts.sortBy) { 
      let sortBy = opts.sortBy;
      if (sortBy === 'type') {
        sortBy = 'typeData.name';
      }
      if (sortBy === 'lead') {
        sortBy = 'lead.displayName'
      }
      const sortOptions = { $sort: { [sortBy]: opts.tableSort } };
      if (sortBy !== 'createdAt') {
        sortOptions.$sort.createdAt = -1;
      }
      pipeline.push(sortOptions);
    }
      
    if (opts.page && limit !== 'all' && !opts.queryLanguage) {
      const skip = { $skip: opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0 };
      pipeline.push(skip);
    }
    // Return all requests
    if (opts.page === 'all') {
      const stageIndex = pipeline.findIndex((p) => { return Object.keys(p).includes('$facet'); });
      if (stageIndex) {
        pipeline[stageIndex].$facet.stage2 = [];
      }
    }


    if (limit !== 'all' && !opts.queryLanguage) {
      pipeline.push({ $limit: limit });
    }

    const [projectAggregation, projectCountAggregation, goalCompletionAggregation] = [Project.aggregate(pipeline), Project.aggregate(totalCount), Project.aggregate(goalCompletionPipeline)];
    projectAggregation.options = projectCountAggregation.options = goalCompletionAggregation.options = { allowDiskUse: true };
    Promise.allSettled([projectAggregation.exec(), projectCountAggregation.exec(), goalCompletionAggregation.exec()]).then((aggregationResponses) => {
      const errors = aggregationResponses.filter((res) => res.status === 'rejected');
      if (errors.length) {
        // 1.a If error, reject with error
        logger.error(errors, 'ERROR_DB_FIND_PROJECTS');
        reject({
          message: 'Internal Server Error',
          code: 500,
          error: 'ERROR_DB_FIND_PROJECTS',
        });
      } else {
        let [pData = [], count = [{ count: 0 }], [ {completed = [{ count: 0 }], completedInTime = [{ count: 0 }], completedBeyondTime = [{ count: 0 }]}]] = aggregationResponses.filter((res) => res.status === 'fulfilled').map((res) => res.value);
        count = count.length ? (count[0]?.count || 0) : 0;
        if (pData && pData.length > 0) {
          // 1.b. Project data found, resolve with data
          const finalArr = pData.map((data) => {
            const result = data;
            const categoryData = Array.isArray(result.categoryId) ? result.categoryId[0] : result.categoryId;
            result.categoryId = categoryData;
            return result;
          });
          if (opts && opts.queryLanguage) {
            filterProjectByQueryLanguage(pData, opts).then((qProjects) => {
              const filterQueryProjects = qProjects.map((data) => {
                const result = data;
                const categoryData = Array.isArray(result.categoryId) ? result.categoryId[0] : result.categoryId;
                result.categoryId = categoryData;
                return result;
              });
              if (opts && opts.page && opts.perPage) {
                const skip = opts.page && opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0;
                const paginatedProjects = opts.perPage !== 'all' ? filterQueryProjects.slice(skip).slice(0, opts.perPage) : filterQueryProjects;
                resolve({
                  isFound: true,
                  projects: paginatedProjects,
                  totalCount: filterQueryProjects.length,
                  completed: completed.length ? (completed[0]?.count || 0) : 0,
                  completedInTime: completedInTime.length ? (completedInTime[0]?.count || 0) : 0,
                  completedBeyondTime: completedBeyondTime.length ? (completedBeyondTime[0]?.count || 0) : 0,
                });
              } else {
                resolve({
                  isFound: true,
                  projects: filterQueryProjects,
                  totalCount: filterQueryProjects.length,
                  completed: completed.length ? (completed[0]?.count || 0) : 0,
                  completedInTime: completedInTime.length ? (completedInTime[0]?.count || 0) : 0,
                  completedBeyondTime: completedBeyondTime.length ? (completedBeyondTime[0]?.count || 0) : 0,
                });
              }
            }).catch((err) => {
              resolve({
                isFound: true,
                projects: finalArr,
                totalCount: count,
                completed: completed.length ? (completed[0]?.count || 0) : 0,
                completedInTime: completedInTime.length ? (completedInTime[0]?.count || 0) : 0,
                completedBeyondTime: completedBeyondTime.length ? (completedBeyondTime[0]?.count || 0) : 0,
              });
            });
          } else {
            resolve({
              isFound: true,
              projects: finalArr,
              totalCount: count,
              completed: completed.length ? (completed[0]?.count || 0) : 0,
              completedInTime: completedInTime.length ? (completedInTime[0]?.count || 0) : 0,
              completedBeyondTime: completedBeyondTime.length ? (completedBeyondTime[0]?.count || 0) : 0,
            });
          }
        } else {
          // 1.c Project data empty, resolve it
          resolve({
            isFound: false,
            projects: pData,
            totalCount: 0,
            completed: completed.length ? (completed[0]?.count || 0) : 0,
            completedInTime: completedInTime.length ? (completedInTime[0]?.count || 0) : 0,
            completedBeyondTime: completedBeyondTime.length ? (completedBeyondTime[0]?.count || 0) : 0,
          });
        }
      }
    })
  })
}

/**
 * Get all projects
 * @param {Function} next callback function.
 */
function getAllProjects(opts) {
  return new Promise((resolve, reject) => {
    // 1 Get all projects from DB
    getAllProjectsFromDB(opts).then((dBRes) => {
      if (dBRes.isFound) {
        // const allP = _.filter(dBRes.projects, ['isDeleted', false]);
        // const finalP = _.filter(dBRes.projects, 'createdAt');
        const finalData = {
          projects: _.filter(dBRes.projects, 'createdAt'),
          ...dBRes,
        }
        return resolve(finalData)
      } else {
        const finalData = {
          projects: _.filter(dBRes.projects, 'createdAt'),
          ...dBRes,
        }
        return resolve(finalData);
      }
    }).catch((dbErr) => {
      // 2.b Project details from DB failed
      return reject(dbErr);
    });
  })
}

/**
 * Get all direct reports projects from DB
 * @return {Promise} Resolved when the project has been retrieved.
 */
function getAllDirectReportsProjects(opts) {
  return new Promise(async (resolve, reject) => {
    // Get all direct reports projects from DB
    const limit = opts.perPage;
    const filter = await filterProjects(opts);
    const requestQuery = requestLookup();
    const dtrQuery = dtrLookup();
    // const isUserInSMHGroup = await Group.findOne({ name: 'SMH_LEADS', "members._id": { $in: [new mongoose.Types.ObjectId(opts?.auth?._id)] }}).lean();
    let smhQuery = [];
    console.log(opts.auth);
    // if (!(opts?.auth?.isSuperAdmin || opts?.auth?.isAdmin || !!isUserInSMHGroup)) {
    //   smhQuery = smhCaseStudyLookup(opts?.auth?.username);
    // }
    const defaultColumns = JSON.parse(JSON.stringify(REPORTS_HEADER)); // deep copy from constants
    if (opts?.filters?.length) {      
      
    }

    const durationFilter = [];
    if (opts?.hasOwnProperty('duration') && opts?.duration) {
      const duration = opts.duration?.toLowerCase().replace('days', '').replace('day', '');
      durationFilter.push({
        $match: {
          duration: { $eq: Number(duration) }
        }
      })
    }

    const pipeline = [
      { $match: { ...filter, isDeleted: false } },
      {
        $lookup:
        {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'categoryId',
        },
      },
      {
        $lookup:
        {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdBy',
        },
      },
      { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          createdBy: "$createdBy.name"
        }
      },
      {
        $addFields: {
          duration: {
            $cond: {
              if: { $and: [{ $ifNull: ["$startDate", false] }, { $ifNull: ["$endDate", false] }] },
              then: {
                $ceil: {
                  $divide: [
                    { $subtract: ["$endDate", "$startDate"] },
                    1000 * 60 * 60 * 24 // Convert milliseconds to days
                  ]
                }
              },
              else: null
            }
          }
        }
      },
      ...durationFilter,
      ...requestQuery,
      ...dtrQuery,
      ...smhQuery
    ];
    // for selected projects
    if (opts?.selectedProjectIds?.length) {
      pipeline.push({
        $match: {
          $expr: {
            $in: ['$displayId', opts?.selectedProjectIds.split(', ')]
          }
        }
      });
    }

    // Fetching All CustomFields from projects
    let allCustomFieldsPipeline = [...pipeline]; //Create a copy of the pipeline array
    // let allCustomFields ; // Declare a variable to store the result of the aggregation
    // Add stages to the pipeline to extract all custom field names
    allCustomFieldsPipeline.push(
      { '$unwind': '$customFields' },
      { '$group': { '_id': null, 'allFields': { '$addToSet': { name: '$customFields.name', type: '$customFields.type' } } } },
      { '$project': { '_id': 0, 'allFields': 1 } }
    );
    let allCustomFields = []
    try{
      allCustomFields = await Project.aggregate(allCustomFieldsPipeline).exec();
    } catch (error) {
      console.error("Error fetching data:", error);
    }

    pipeline.push(
      {
        '$addFields': {
          customFields: {
            '$map': {
              input: '$customFields',
              as: 'field',
              in: {
                k: { $concat: ["", "$$field.name"] }, // Field name
                v: {
                  value: { $ifNull: ["$$field.value", "-"] }, // Field value or default to '-'
                  type: { $ifNull: ["$$field.type", "-"] }  // Field type or default to '-'
                }
              }
            }
          }
        }
      },
      {
        '$addFields': {
          customFieldMap: {
            '$arrayToObject': '$customFields'
          }
        }
      },
      {
        '$addFields': {
          customFieldMap: {
            $mergeObjects: [
              {
                $arrayToObject: {
                  $map: {
                    input: allCustomFields[0]?.allFields !== undefined ? allCustomFields[0]?.allFields : [],
                    as: 'field',
                    in: [
                      "$$field.name",  // Use field name as key
                      { 
                        value: { $ifNull: ["", "-"] },  // Default value for missing field
                        type: { $ifNull: ["$$field.type", "-"] }  // Dynamically set type or default to '-'
                      }
                    ]
                  }
                }
              },
              "$customFieldMap"
            ]
          }
        }
      }
    );

    // sorting start
    if (opts.sort !== undefined && opts.sort && limit !== 'all' && !opts.queryLanguage)  {
      pipeline.push({ $sort: { updatedAt: -1 } });
    } else {
      pipeline.push({ $sort: { updatedAt: -1 } });
    }
    if (opts.tableSort && opts.sortBy) { 
      let sortBy = opts.sortBy;
      if (sortBy === 'type') {
        sortBy = 'typeData.name';
      }
      if (sortBy === 'lead') {
        sortBy = 'lead.displayName';
      }
    
      let pipelineAddFields = [];
      let sortOptions;
    
      if (!defaultColumns.some(obj => obj.field === opts.sortBy) && !['createdAt', 'leads', 'updatedAt'].includes(opts.sortBy)) {
        // Sorting by custom fields within customFieldMap
        pipelineAddFields.push({
          $addFields: {
            [opts.sortBy]: `$customFieldMap.${opts.sortBy}`
          }
        });
        sortOptions = { $sort: { [opts.sortBy]: opts.tableSort} };
      } else {
        // Sorting by standard fields
        sortOptions = { $sort: { [sortBy]: opts.tableSort} };
      }
    
      pipelineAddFields.push(sortOptions);
      pipeline.push(...pipelineAddFields);
    }

    // TODO: Temporary fix to get project count
    let usePagination = false;
    const countPipeline = _.cloneDeep(pipeline);

    if (opts.queryLanguage !== undefined && opts.queryLanguage.indexOf('&') === -1 && opts.queryLanguage.indexOf('|') === -1 && opts.queryLanguage.indexOf('!') === -1 && opts.queryLanguage.indexOf('(') === -1 && opts.queryLanguage.indexOf(')') === -1 && !opts.type) {
      pipeline.push(...[
        { $skip: opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0 },
        { $limit: opts.perPage },
      ]);
      usePagination = true;
    } else {
      pipeline.push(...[
        { $skip: 0 },
      ]);
    }

    const countQuery = [
      { $group: { _id: null, count: { $sum: 1 } } },
      { $project: { _id: 0 } }
    ];

    const totalCountPipeline = [...countPipeline, ...countQuery];
    const countAggregation = Project.aggregate(totalCountPipeline);
    const aggregation = Project.aggregate(pipeline);
    aggregation.options = countAggregation.options = { allowDiskUse: true };
    Promise.allSettled([aggregation.exec(), countAggregation.exec()]).then((aggregationResponses) => {
      const errors = aggregationResponses.filter((res) => res.status === 'rejected');
      if (errors.length) {
        console.error(errors);
        // 1.a If error, reject with error
        logger.error('ERROR_DB_FIND_PROJECTS');
        return reject({
          message: 'Internal Server Error',
          code: 500,
          error: 'ERROR_DB_FIND_PROJECTS',
        });
      } else {
        const [pData, pCount] = aggregationResponses.map((pRes) => pRes.value);
        if (pData && pData.length) {
          // Get Here, Please
          // 1.b. Project data found, resolve with data
          const projectsData = pData;
          const totalCount = usePagination ? (Array.isArray(pCount) && pCount.length ? (pCount[0].count || 0) : 0) : (projectsData.length || 0);
          filterProjectByQueryLanguage(projectsData, opts).then((qProjects) =>{
            if (qProjects.length && opts.queryLanguage) {
              const skip = opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0;
              const finalP = qProjects.slice(skip).slice(0, opts.perPage);
              return resolve({
                projects: finalP,
                totalCount: finalP.length,
              });
            } else if (!qProjects.length && opts.queryLanguage) {
              return resolve({
                projects: [],
                totalCount: 0,
              });
            } else {
              return resolve({
                projects: projectsData,
                totalCount: totalCount,
              });
            }
          }).catch((err) => {
            return resolve({
              projects: projectsData,
              totalCount: totalCount,
            });
          });
        } else {
          // 1.c Project data empty, resolve it
          return resolve({
            projects: [],
            totalCount: 0,
          });
        }
      }
    });
  });
}

/**
 * Get project details from DB
 * @return {Promise} Resolved when the project data has been retrieved.
 */
function getProjectDetailsFromDB(id) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get all project custom types from DB
      console.log(id)
      const pData = await Project.findOne({ projectID: id })
        .populate('comments.author', '_id name profileImage')
        .populate('categoryId', '_id self name description createdAt updatedAt __v')
        .populate('typeData.id', '_id createdAt updatedAt name categoryId attributes isEnabled htmlFile __v')
        .populate('requestMeta.typeId', '_id name')
        .populate('requestMeta.categoryId', '_id name isTA updatedAt description createdAt')
        .populate('requestMeta.requestId', '_id hasAttachments displayName state customFields createdBy fulfilledAt')
        .populate('dtrMeta.typeId', '_id name')
        .populate('dtrMeta.categoryId', '_id name isTA updatedAt description createdAt')
        .populate('caseStudyApproversId', 'approvers')  
        .populate({
          path: 'dtrMeta.dtrId',
          select: '_id hasAttachments displayName state customFields approvedBy approvedAt',
          populate: {
            path: 'approvedBy',
            select: 'username name',
          }
        }).exec();
      if (pData) {
        // 1.b. Project data found, resolve with data
        const data = JSON.parse(JSON.stringify(pData));
        return resolve(data);
      } else {
        // 1.c If error, reject with error
        logger.error('ERROR_DB_FIND_PROJECT');
        return reject({
          message: 'Error in finding project data',
          code: 404,
          error: 'ERROR_DB_FIND_PROJECT',
        });
      }
    } catch (findErr) {
      // 1.a If error, reject with error
      logger.error(findErr, 'ERROR_DB_FIND_PROJECT');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_PROJECT',
      });
    }
  });
}

/**
 * Get a project by id or key
 * @param {Object} opts The request options.
 * @param {String} opts.projectIdOrKey The id or key of the project.
 * @return {Promise} Resolved when the project data has been retrieved.
 */
function getProjectById(opts) {
  return new Promise((resolve, reject) => {
    // 1 Get project details from DB
    getProjectDetailsFromDB(opts.projectIdOrKey).then((dbRes) => {
      // 1.a If found, resolve with data
      if (dbRes) {
        resolve(dbRes);
      }
    }, (dbErr) => {
      // 1.b Project details from DB failed
      reject(dbErr);
    });
  });
}

/**
 * Add project members in GitLab
 *
 * @method addGitLabProjectMembers
 * @param {Array} data The usernames of the project members
 * @param {String} gitLabId The GitLab project ID
 * @param {String} leadName The username of project lead
 * @param {Object} dbRes The DB response
 * @return {Promise} Resolved when the project members has been added in GitLab
 */
function addGitLabProjectMembers(data, gitLabId, leadName, dbRes) {
  return new Promise(async (resolve, reject) => { //eslint-disable-line
    try {
      const gitlabPromises = data.map(async (username) => {
        if (username !== leadName) {
          try {
            const gRes = await gitlabProjectServices.addProjectMember(gitLabId, username, 30);
            return { status: 'fulfilled', value: gRes };
          } catch (err) {
            return { status: 'rejected', reason: err };
          }
        }
        return { status: 'skipped' };
      });
  
      const results = await Promise.allSettled(gitlabPromises);
      const gitlabErr = [];
      const result = [];
  
      results.forEach((res) => {
        if (res.status === 'fulfilled' && res.value && res.value.length) {
          result.push(...res.value);
        } else if (res.status === 'rejected') {
          gitlabErr.push(res.reason);
        }
      });
  
      if (gitlabErr.length) {
        return resolve({
          message: 'Collaborators added to Scope but failed in adding few to GitLab',
          code: 207,
          gitlabErr,
          dbRes,
        });
      } else {
        return resolve({
          message: 'Collaborators added successfully',
          code: 200,
          dbRes,
        });
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Add project members in Alfresco
 *
 * @method addAlfrescoProjectMembers
 * @param {Array} data The usernames of the project members
 * @param {String} nodeId The node ID of the Alfresco
 * @param {String} leadName The username of project lead
 * @param {Object} dbRes The DB response
 * @return {Promise} Resolved when the project members has been added in Alfresco
 */
function addAlfrescoProjectMembers(data, nodeId, leadName, dbRes) {
  return new Promise((resolve, reject) => { //eslint-disable-line
    global.services.alfresco.projectServices.updateProjectPermissions(nodeId, data, 'add', true, leadName).then((gRes) => {
      if (gRes) {
        resolve({
          message: 'Collaborators added successfully',
          code: 200,
          dbRes,
        });
      }
    }, (gErr) => {
      resolve({
        message: 'Collaborators added to Scope but got failed in adding few to Alfresco',
        code: 207,
        alfrescoErr: gErr,
        dbRes,
      });
    });
  });
}

/**
 * Adds collaborators to a project
 *
 * @method addCollaboratorsToProject
 * @param {Object} opts The request options.
 * @param {String} opts.projectIdOrKey The id or key of the project..
 * @param {Object} opts.payload The project collaborators payload.
 * @return {Promise} Resolved when the collaborators has been added to the project.
 */
function addCollaboratorsToProject(opts) {
  return new Promise((resolve, reject) => {
    const data = opts;
    const cl = data.payload.collaborators;
    delete data.payload.collaborators;
    const gitLabId = data.payload.gitlabId;
    delete data.payload.gitlabId;
    const alfrescoID = data.payload.alfrescoId;
    delete data.payload.alfrescoId;
    const leadName = data.payload.lead;
    delete data.payload.lead;
    const dbData = {
      projectID: opts.projectIdOrKey,
      updateType: 'addCollaborators',
      collaborators: cl,
    };
    updateProjectDetails(dbData).then((dbRes) => {
      if (dbRes) {
        if (gitLabId && alfrescoID && opts.payload.user.length > 0) {
          const promise1 = addGitLabProjectMembers(opts.payload.user, gitLabId, leadName, dbRes);
          // const promise2 = addAlfrescoProjectMembers(
          //   opts.payload.user,
          //   alfrescoID, leadName, dbRes,
          // );
          Promise.all([promise1]).then((values) => {
            if (values[0].code === 200) {
              return resolve({
                message: 'Collaborators added successfully',
                code: 200,
                dbRes,
              });
            } else if (values[0].code === 207) {
              return resolve(values[0]);
            } else if (values[0].code === 207) {
              return resolve({
                message: 'Collaborators added successfully but got failed in adding few to GitLab and Alfresco',
                code: 207,
                gitlabErr: values[0].gitlabErr,
                alfrescoErr: values[1].alfrescoErr,
                dbRes,
              });
            }
          }).catch((error) => {
            return resolve({
              message: 'Collaborators added successfully but got failed in adding few to GitLab and Alfresco',
              code: 207,
              gitlabErr: error,
              alfrescoErr: error,
              dbRes,
            });
          });
        } else if (gitLabId && !alfrescoID && opts?.payload?.user?.length > 0) {
          addGitLabProjectMembers(opts.payload.user, gitLabId, leadName, dbRes).then((gRes) => {
            if (gRes) {
              return resolve(gRes);
            }
          }, (gErr) => {
            return resolve({
              message: 'Collaborators added successfully but got failed in adding few to GitLab',
              code: 207,
              gitlabErr: gErr,
              dbRes,
            });
          });
        } else {
          return resolve({
            message: 'Collaborators added successfully',
            code: 200,
            dbRes,
          });
        }
      }
    }, (dbErr) => {
      return reject(dbErr);
    });
  });
}

/**
 * Updates the project details in DB
 * @author Aniket
 * @param {Object} data The project properties
*/
function updateProjectDetails(data, currentUser) {
  return new Promise(async (resolve, reject) => {
    const projectData = await Project.findOne({ projectID: data.projectID, 'dtrMeta.displayId': { $exists: true }, 'dtrMeta.dtrId': { $exists: true } }).lean();
    const isLeadChanges = !!projectData && projectData?.lead?.userName !== data?.lead?.userName;
    let filter;
    let update;
    if (data?.endDate && data?.isRequestProject) {
      data.completedAt = moment.utc(data.endDate).toDate();
    }
    const addCollaborators = {
      user: [],
      group: [],
      collaborators: [],
    };
    const removingCollaborators = [];
    if (data?.collaborators?.collaborators?.length) {
      const projectDetails = await Project.findOne( { projectID: data.projectID }).lean();
      const oldCollabortors = [ ...projectDetails.collaborators ];
      const newCollaborators = data?.collaborators || {};
      newCollaborators?.collaborators?.forEach((nCol) => {
        const oldCollaboatorsUsernames = oldCollabortors.map((oCol) => oCol.name);
        if (!oldCollaboatorsUsernames.includes(nCol.name)) {
          if (nCol.type === 'group') {
            addCollaborators.group.push(nCol.name);
          }
          if (nCol.type === 'user') {
            addCollaborators.user.push(nCol.name);
          }
          addCollaborators.collaborators.push({ ...nCol });
        }
      })
      oldCollabortors?.forEach((oCol) => {
        const newCollaboratorsUserNames = newCollaborators?.collaborators?.map((nCol) => nCol.name);
        if (!newCollaboratorsUserNames?.includes(oCol.name)) {
          removingCollaborators.push({
            [`${oCol.type === 'group' ? 'group' : 'user'}`]: oCol.name,
            gitlabId: newCollaborators?.gitlabId || '',
            alfrescoId: newCollaborators?.alfrescoId || '',
            lead: newCollaborators?.lead || '',
          })
        }
      })
      addCollaborators.gitlabId = data.collaborators?.gitlabId || '';
      addCollaborators.alfrescoId = data.collaborators?.alfrescoId || '';
      addCollaborators.lead = data.collaborators?.lead || '';
      delete data.collaborators;
    }
    if (addCollaborators?.collaborators?.length) {
      try {
        const addCollaboratorsPayload = {
          projectIdOrKey: data.projectID,
          payload: { ...addCollaborators },
        };
        await addCollaboratorsToProject(addCollaboratorsPayload);
      } catch (cErr) {
        return reject(cErr);
      }
    }
    if (removingCollaborators?.length) {
      await Promise.all((removingCollaborators.map(async (rCol) => {
        try {
          const opts = {
            auth: currentUser,
            projectIdOrKey: data.projectID,
            group: rCol?.group,
            user: rCol?.user,
            gitlabId: rCol.gitlabId,
            alfrescoId: rCol.alfrescoId,
            lead: rCol.lead,
          };
          return await deleteProjectCollaborator(opts);
        } catch (rErr) {
          return rErr;
        }
      })))
    }
    delete data.isRequestProject;
    if (data.projectID) {
      filter = {
        projectID: data.projectID,
      };
      update = {
        $set: data,
      };
    } else {
      filter = {
        key: data.key,
      };
      update = {
        $set: {
          projectID: data.id,
          displayId: `${moment().format('YYYY')}-${data.id}`,
        },
      };
    }
    if (data.updateType === 'category') {
      filter = {
        projectID: data.projectID,
      };
      update = {
        $set: {
          categoryId: data.categoryId,
        },
      };
    }
    if (data.updateType === 'addCollaborators') {
      filter = {
        projectID: data.projectID,
      };
      update = {
        $addToSet: { collaborators: { $each: data.collaborators } },
      };
    }
    if (data.updateType === 'removeCollaborators') {
      filter = {
        projectID: data.projectID,
      };
      update = {
        $pull: {
          collaborators: {
            name: data.collaborators,
          },
        },
      };
    }
    try {
      // check sa
      const dbRes = await Project.findOneAndUpdate(filter, update, { new: true, strict: true, runValidators: true }).lean();
      if (isLeadChanges) {
        const data = contentdrrProjectLeadChange(dbRes);
        const emailData = {
          to: [`${dbRes.lead.userName}@its.jnj.com`],
          cc: [currentUser?.email || ''],
          subject: data.subject,
          html: data.html,
        };
        await sendEmail(emailData);
      }
      return resolve(JSON.parse(JSON.stringify(dbRes)));
    } catch (err) {
      logger.error(err, 'ERROR_DBPROJECT_UPDATE');
      return reject({ message: 'Error in updating project details to DB', code: 500, error: 'ERROR_DBPROJECT_UPDATE' });
    }
  });
}

/**
 * Updates a project details.
 *
 * @method updateProject
 * @memberOf ProjectClient#
 * @param {Object} opts The request options.
 * @param {String} opts.projectIdOrKey The project id or key.
 * @param {Object} opts.project The project properties.
 * @return {Promise} Resolved when the project has been updated.
 */
function updateProject(opts, currentUser) {
  return new Promise((resolve, reject) => {
    const isRequestProject = opts && opts.project && opts.project.isRequestProject;
    const data = opts;
    const gitLabId = data.project.gitlabId;
    const alfrescoID = data.project.alfrescoId;
    const oLead = data.project.oldLead;
    const collaborators = data?.project?.collaborators || null;
    const leads = data?.project?.leads || null;
    data.project.projectID = opts.projectIdOrKey;
    // 1 Update project details in DB
    updateProjectDetails(data.project, currentUser).then(async (dbRes) => {
      if (dbRes) {
        if (gitLabId && !alfrescoID) {
          // 2 Update project details in Gitlab
          const payload = {
            name: `${dbRes.displayId}-${data.project.displayName}`,
            description: opts.project.description,
          };
          if (isRequestProject) {
            payload.name = `${dbRes.displayId}`;
            payload.description = `${data.project.displayName}`;
          }
          updateGitLabProjectDetails(
            payload,
            gitLabId, oLead, data.project.lead.userName, collaborators, leads
          ).then(async (gRes) => {
            if (gRes) {
              const data = await getProjectDetailsFromDB(dbRes?.projectID);
              return resolve(data);
            }
          }, (gErr) => {
            return resolve({
              message: 'Project updated successfully in Scope but got failed in updating to GitLab',
              code: 207,
              gitlabErr: gErr,
            });
          });
        } else if (gitLabId && alfrescoID) {
          // 3 Update project details in Gitlab and Alfresco
          const payload = {
            name: `${dbRes.displayId}-${data.project.displayName}`,
            description: opts.project.description,
          };
          if (isRequestProject) {
            payload.name = `${dbRes.displayId}`;
            payload.description = `${data.project.displayName}`;
          }
          const promise1 = updateGitLabProjectDetails(
            payload,
            gitLabId, oLead, data.project.lead.userName, collaborators, leads
          );
          // const promise2 = updateAlfrescoProjectDetails(
          //   alfrescoID,
          //   oLead, data.project.lead.userName,
          // );
          Promise.all([promise1]).then((values) => {
            if (values[0].code === 200) {
              return resolve({
                message: 'Project updated successfully ',
                code: 200,
              });
            } else if (values[0].code === 207) {
              return resolve({
                message: 'Project updated successfully in Scope but got failed in updating to GitLab and Alfresco',
                code: 207,
                gitlabErr: values[0].gitlabErr,
                alfrescoErr: values[1].alfrescoErr,
              });
            }
          }).catch((error) => {
            return resolve({
              message: 'Project updated successfully in Scope but got failed in updating to GitLab and Alfresco',
              code: 207,
              gitlabErr: error,
              alfrescoErr: error,
            });
          });
        } else {
          const data = await getProjectDetailsFromDB(dbRes?.projectID);
          return resolve(data);
        }
      }
    }).catch((dbErr) => {
      reject(dbErr);
    });
  });
}

/**
 * Deletes collaborator (users or groups) from a project role.
 *
 * @method deleteProjectCollaborator
 * @param {Object} opts The request options.
 * @param {String} opts.projectIdOrKey The project id or key.
 * @param {String} opts.group The groupname to remove from the project role.
 * @param {String} opts.user The username to remove from the project role.
 * @return {Promise} Resolved when the project actor has been deleted.
 */
function deleteProjectCollaborator(opts) {
  return new Promise((resolve, reject) => {
    // 1 Delete project collaborator
    console.log(opts);
    const data = opts;
    const gitLabId = data.gitlabId;
    delete data.gitlabId;
    const alfrescoID = data.alfrescoId;
    delete data.alfrescoId;
    const leadName = data.lead;
    delete data.lead;
    const collaborators = opts.user || opts.group;
    const dbData = {
      projectID: opts.projectIdOrKey,
      updateType: 'removeCollaborators',
      collaborators,
    };
    updateProjectDetails(dbData).then((dbRes) => {
      if (dbRes) {
        if (gitLabId && !alfrescoID && opts.user && (opts.user !== leadName)) {
          removeGitLabProjectMember(gitLabId, opts.user, dbRes).then((gRes) => {
            if (gRes) {
              return resolve(gRes);
            }
          }).catch((gErr) => {
            return resolve({
              message: 'Project collaborator removed successfully from Scope but got failed in removing from GitLab',
              code: 207,
              gitlabErr: gErr,
              dbRes,
            });
          });
        } else if (gitLabId && alfrescoID && opts.user && (opts.user !== leadName)) {
          const promise1 = removeGitLabProjectMember(gitLabId, opts.user, dbRes);
          // const promise2 = removeAlfrescoProjectMember(alfrescoID, opts.user, dbRes);
          Promise.all([promise1]).then((values) => {
            if (values[0].code === 200) {
              return resolve({
                message: 'Project collaborator removed successfully',
                code: 200,
                dbRes,
              });
            } else if (values[0].code === 207) {
              return resolve(values[0]);
            } else {
              return resolve({
                message: 'Project collaborator removed successfully from Scope but got failed in removing from GitLab and Alfresco',
                code: 207,
                gitlabErr: values[0].gitlabErr,
                alfrescoErr: values[1].alfrescoErr,
                dbRes,
              });
            }
          }).catch((error) => {
            return resolve({
              message: 'Project collaborator removed successfully from Scope but got failed in removing from GitLab and Alfresco',
              code: 207,
              gitlabErr: error,
              alfrescoErr: error,
              dbRes,
            });
          });
        } else {
          return resolve({
            message: 'Project collaborator removed successfully',
            code: 200,
            dbRes,
          });
        }
      }
    }).catch((dbErr) => {
      reject(dbErr);
    });
  });
}

/**
 * Remove project member in GitLab
 *
 * @method removeGitLabProjectMember
 * @param {String} gitLabId The project ID of the GitLab
 * @param {String} username The username of project member
 * @param {Object} dbRes The DB response
 * @return {Promise} Resolved when the project member has been removed from GitLab
 */
function removeGitLabProjectMember(gitLabId, username, dbRes) {
  return new Promise((resolve, reject) => { //eslint-disable-line
    gitlabProjectServices.removeProjectMember(
      gitLabId,
      username,
    ).then((gRes) => {
      if (gRes) {
        return resolve({
          message: 'Project collaborator removed successfully',
          code: 200,
          gitlabRes: gRes,
          dbRes,
        });
      }
    }, (gErr) => {
      if (gErr.code === 404) {
        return resolve({
          message: 'Project collaborator removed successfully from Scope but user not found in GitLab',
          code: 207,
          gitlabErr: gErr,
          dbRes,
        });
      } else {
        return resolve({
          message: 'Project collaborator removed successfully from Scope but got failed in removing from GitLab',
          code: 207,
          gitlabErr: gErr,
          dbRes,
        });
      }
    });
  });
}

//@TODO: Remove this function is deprecated
/**
 * Remove project member in Alfresco
 *
 * @method removeAlfrescoProjectMember
 * @param {String} nodeId The node ID of the Alfresco
 * @param {String} username The username of project member
 * @param {Object} dbRes The DB response
 * @return {Promise} Resolved when the project member has been removed from Alfresco
 */
function removeAlfrescoProjectMember(nodeId, username, dbRes) {
  return new Promise((resolve, reject) => { //eslint-disable-line
    global.services.alfresco.projectServices.updateProjectPermissions(nodeId, username, 'remove', false, '').then((aRes) => {
      if (aRes) {
        resolve({
          message: 'Project collaborator removed successfully',
          code: 200,
          alfrescoRes: aRes,
          dbRes,
        });
      }
    }, (aErr) => {
      if (aErr.code === 404) {
        resolve({
          message: 'Project collaborator removed successfully from Scope but user not found in Alfresco',
          code: 207,
          alfrescoErr: aErr,
          dbRes,
        });
      } else {
        resolve({
          message: 'Project collaborator removed successfully from Scope but got failed in removing from Alfresco',
          code: 207,
          alfrescoErr: aErr,
          dbRes,
        });
      }
    });
  });
}

/**
 * Updates project details in GitLab
 *
 * @method updateGitLabProjectDetails
 * @param {Object} payload The details to be updated in GitLab
 * @param {String} gitLabId The project ID of the GitLab
 * @param {String} oLead The username of old project lead
 * @param {String} nLead The username of new project lead
 * @return {Promise} Resolved when the project details has been updated in GitLab
 */
function updateGitLabProjectDetails(payload, gitLabId, oLead, nLead, collaborators, leads) {
  return new Promise((resolve) => {
    gitlabProjectServices.updateProject(payload, gitLabId, oLead, nLead, collaborators, leads).then((gRes) => {
      if (gRes) {
        return resolve(gRes);
      }
    }).catch((gErr) => {
      if (gErr.code === 404) {
        return resolve({
          message: 'Project updated successfully in Scope but project not found in GitLab',
          code: 207,
          gitlabErr: gErr,
        });
      } else {
        return resolve({
          message: 'Project updated successfully in Scope but got failed in updating to GitLab',
          code: 207,
          gitlabErr: gErr,
        });
      }
    });
  });
}

//@TODO: Remove this function is deprecated
/**
 * Updates project details in Alfresco
 *
 * @method updateAlfrescoProjectDetails
 * @param {String} nodeId The node ID of the Alfresco
 * @param {String} oLead The username of old project lead
 * @param {String} nLead The username of new project lead
 * @return {Promise} Resolved when the project details has been updated in Alfresco
 */
function updateAlfrescoProjectDetails(nodeId, oLead, nLead) {
  return new Promise((resolve) => {
    global.services.alfresco.projectServices.updateProjectPermissions(nodeId, oLead, 'remove', false, '')
      .then((aRes) => {
        if (aRes) {
          global.services.alfresco.projectServices.updateProjectPermissions(nodeId, nLead, 'add', false, '').then((nRes) => {
            if (nRes) {
              return resolve({
                message: 'Project updated successfully',
                code: 200,
                alfrescoRes: nRes,
              });
            }
          }).catch((nErr) => {
            return resolve({
              message: 'Project updated successfully in Scope but got failed in updating to Alfresco',
              code: 207,
              alfrescoErr: nErr,
            });
          });
        }
      }).catch((aErr) => {
        if (aErr.code === 404) {
          return resolve({
            message: 'Project updated successfully in Scope but project not found in Alfresco',
            code: 207,
            alfrescoErr: aErr,
          });
        } else {
          return resolve({
            message: 'Project updated successfully in Scope but got failed in updating to Alfresco',
            code: 207,
            alfrescoErr: aErr,
          });
        }
      });
  });
}

/**
 * Update Project(associated with request) status.
 * @param {{ projectID: string }} opts query params
 * @returns Promise<{ message: string, code: number, success: boolean, data: Object }>
 */
function updateProjectRequestStatus(opts, user) {
  return new Promise(async (resolve, reject) => {
    try {
      const filter = {
        projectID: opts.projectID,
      };
      const update = {
        $set: {
          status: opts.status,
        },
      };
      const projectOnHold = opts.status === PROJECT.STATUS.ON_HOLD
      if (projectOnHold) {
        const comment = {
          author: user._id,
          comment: opts.note,
          commentAt: moment().utc(true).toDate(),
        };
        update.$push = {
          comments: comment,
        };
        update.$set.notes = opts.note;
      }
      const updateOptions = { new: true, strict: true, runValidators: true };
      // Update Project Status
      const project = await Project.findOneAndUpdate(filter, update, updateOptions).lean();
      if (project && projectOnHold) {
        const projectRequest = await ProjectRequest.findOneAndUpdate(
          { _id: project.requestMeta.requestId },
          { $set: { state: PROJECT_REQUEST.STATES.REJECTED } },
          updateOptions
        );
        if (projectRequest) {
          return Promise.resolve({
            message: 'Project and request status updated successfully',
            code: 201,
            project,
            request: projectRequest
          });
        } else {
          logger.error('ERROR_UPDATE_PROJECT_REQUEST_STATUS', error);
          return Promise.resolve({
            message: 'Project status updated successfully but failed to update request state',
            code: 203,
            error: 'ERROR_UPDATE_PROJECT_REQUEST_STATUS'
          });
        }
      } else if (project) {
        return Promise.resolve({
          message: 'Project status updated successfully',
          code: 201,
          project,
        });
      } else {
        logger.error('ERROR_UPDATE_PROJECT_REQUEST_STATUS');
        return Promise.reject({
          message: 'Failed to update project status, Project not found',
          code: 404,
          error: 'ERROR_UPDATE_PROJECT_REQUEST_STATUS'
        });
      }
    } catch (error) {
      logger.error('ERROR_UPDATE_PROJECT_REQUEST_STATUS', error);
      return Promise.reject({
        message: 'Failed to update project status',
        code: 500,
        error: 'ERROR_UPDATE_PROJECT_REQUEST_STATUS'
      });
    }
  })
}

/**
 * Deletes a project
 *
 * @method deleteProject
 * @param opts The request options.
 * @param {String} opts.auth The auth details of the requesting user.
 * @param {String} opts.projectIdOrKey The project id or project key.
 * @return {Promise} Resolved when the project has been deleted.
 */
function deleteProject(opts) {
  return new Promise(async (resolve, reject) => {
    // 1 Check user permissions
    if (opts?.auth?.isSuperAdmin || opts?.auth?.isAdmin) {
      // 2 Quarantine the project
      try {
        const res = await Project.findOneAndUpdate(
          { projectID: opts.projectIdOrKey },
          { $set: { isDeleted: true, deleteOn: moment().utc().add(30, 'days')._d } },
          { new: true, strict: true, runValidators: true }).lean();
        const projectData = JSON.parse(JSON.stringify(res));
        if (projectData && projectData.requestMeta && projectData.requestMeta.requestId) {
          try {
            await ProjectRequest.findOneAndUpdate({_id:  projectData.requestMeta.requestId}, {state: 'REQUESTED'}).lean();
          } catch (rErr) {
            logger.error(rErr, 'ERROR_UPDATE_REQUEST');
            return resolve({
              message: 'Project Deleted Successfully, But failed to update request status',
              code: 207,
            });
          }
          return resolve({
            message: 'Project Deleted Successfully',
            code: 200,
          });
        }
        return resolve({
          message: 'Project Deleted Successfully',
          code: 200,
        });
      } catch (err) {
        // 2.a Quarantine of project has been failed
        logger.error(err, 'ERROR_DBPROJECT_DELETE');
        return reject({
          message: 'Failed to delete project',
          code: 500,
          error: 'ERROR_DBPROJECT_DELETE',
        });
      }
    } else {
      logger.error('ERROR_DBPROJECT_DELETE');
      return reject({
        message: 'Failed: You dont have permissions to delete this project',
        code: 403,
        error: 'ERROR_DBPROJECT_DELETE',
      });
    }
  });
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
function deleteProjectPermanent(opts, gitLabId) {
  return new Promise(async (resolve, reject) => {
    // 1 Delete project from DB
    try {
      await Project.deleteOne({ projectID: opts.projectIdOrKey }).lean();
      if (gitLabId) {
        // 2 Archive project in Gitlab
        gitlabProjectServices.archiveProject(gitLabId).then((gRes) => {
          if (gRes) {
            // 2.a Archive project successfull in Gitlab
            return resolve({
              message: 'Project Deleted Permanently',
              code: 200,
            });
          }
        }).catch((gErr) => {
          if (gErr.code === 404) {
            // 2.b Archive project failed in Gitlab
            return resolve({
              message: 'Project deleted permanently from Scope but project not found in GitLab',
              code: 207,
              gitlabErr: gErr,
            });
          } else {
            // 2.c Archive project failed in Gitlab
            return resolve({
              message: 'Project deleted permanently from Scope but got failed in archiving from GitLab',
              code: 207,
              gitlabErr: gErr,
            });
          }
        });
      } else {
        return resolve({
          message: 'Project Deleted Permanently',
          code: 200,
        });
      }
    } catch (error) {
      logger.error(err, 'ERROR_DBPROJECT_DELETE');
      return reject({
        message: 'Failed to delete project',
        code: 500,
        error: 'ERROR_DBPROJECT_DELETE',
      });
    }
  });
}

/**
 * Restores a project.
 *
 * @param {String} id Project ID.
 * @return {Promise} Resolved when the project has been restored.
 */
function restoreProject(id) {
  return new Promise(async (resolve, reject) => {
    // 1 Restore project
    try {
      const res = await Project.findOneAndUpdate(
        { projectID: id },
        { $set: { isDeleted: false }, $unset: { deleteOn: '' } },
        { new: true, strict: true, runValidators: true }).lean();
      // 1.b Project successfully restored
      const projectData = JSON.parse(JSON.stringify(res));
      if (projectData && projectData.requestMeta && projectData.requestMeta.requestId) {
        const update = {
          state: projectData.status === 'Completed' ? 'COMPLETED' : 'IN PROGRESS',
        };
        try {
          await ProjectRequest.findOneAndUpdate({ _id: projectData.requestMeta.requestId }, update);
        } catch (rErr) {
          logger.error(rErr, 'ERROR_UPDATE_REQUEST');
          return resolve({
            message: 'Project Restored Successfully, But failed to update request status',
            code: 207,
          });
        }
      }
      return resolve({
        message: 'Project Restored Successfully',
        code: 200,
      });
    } catch (err) {
      // 1.a Project restoration failed
      logger.error(err, 'ERROR_DBPROJECT_RESTORE');
      return reject({
        message: 'Failed to restore project',
        code: 500,
        error: 'ERROR_DBPROJECT_RESTORE',
      });
    }
  });
}

/**
 * Gets a permission scheme assigned with a project
 *
 * @param {Object} opts The request options sent to the Jira API.
 * @param {String} opts.auth The JIRA auth details of the requesting user.
 * @param {String} opts.projectIdOrKey The id or key of the project.
 * @param {Object} opts.expand The fields to be expanded.
 * @param {Function} next callback function.
 */
function getProjectPermissionSchemes(opts) {
  return new Promise((resolve, reject) => {
    const jiraClient = getJiraClient(opts.auth);
    const projectClient = new ProjectClient(jiraClient);
    projectClient.getAssignedPermissionScheme(opts).then((res) => {
      return resolve(res);
    }, (err) => {
      try {
        const errorObj = JSON.parse(err);
        return reject(errorObj)
      } catch (e) {
        return e;
      }
    });
  })
}

/**
 * Assigns a permission scheme with a project.
 *
 * @method assignPermissionScheme
 * @memberOf ProjectClient#
 * @param {Object} opts The request options sent to the Jira API.
 * @param {String} opts.auth The JIRA auth details of the requesting user.
 * @param {String} opts.projectIdOrKey The id or key of the project.
 * @param {Object} opts.expand The fields to be expanded.
 * @param {Object} opts.project The project permissions details.
 * @return {Promise} Resolved when the permission scheme has been assigned to the project.
 */
function assignPermissionScheme(opts) {
  return new Promise((resolve, reject) => {
    // 1 Assign a permission scheme to project
    const jiraClient = getJiraClient(opts.auth);
    const projectClient = new ProjectClient(jiraClient);
    projectClient.assignPermissionScheme(opts).then((jRes) => {
      // 1.a Permission scheme assigned to project successfully,
      return resolve(jRes);
    }, (jiraDelError) => {
      // 1.b Permission scheme assigning to project in JIRA failed
      logger.error(jiraDelError, 'ERROR_JPROJECT_PERMISSION_ASSIGN');
      try {
        const errObj = JSON.parse(jiraDelError);
        return reject({
          message: errObj.body.errorMessages[0] ? errObj.body.errorMessages[0] : 'Error in assigning permission scheme to project',
          code: errObj.statusCode,
          error: 'ERROR_JPROJECT_PERMISSION_ASSIGN',
        });
      } catch (exc) {
        return reject({
          message: 'Internal Server Error',
          code: 500,
          error: 'ERROR_JPROJECT_PERMISSION_ASSIGN',
        });
      }
    });
  });
}

/**
 * Get list of roles in this project with links to full details.
 * @param {Object} opts The request options sent to the Jira API.
 * @param {String} opts.auth The JIRA auth details of the requesting user.
 * @param {String} opts.projectIdOrKey The id or key of the project.
 * @param {Function} next callback function.
 */
function getProjectRoles(opts, next) {
  return new Promise((resolve, reject) => {
    const jiraClient = getJiraClient(opts.auth);
    jiraClient.project.getRoles(opts).then((res) => {
      return resolve(res);
    }, (err) => {
      try {
        const errorObj = JSON.parse(err);
        return reject(errorObj);
      } catch (e) {
        return reject(err);
      }
    });
  })
}

/**
 * Get list of roles in this project with links to full details.
 * @param {Object} opts The request options sent to the Jira API.
 * @param {String} opts.auth The JIRA auth details of the requesting user.
 * @param {String} opts.projectIdOrKey The id or key of the project.
 * @param {String} opts.roleId The id of the role.
 * @param {Function} next callback function.
 */
function getProjectRoleDetails(opts, next) {
  return new Promise((resolve, reject) => {
    const jiraClient = getJiraClient(opts.auth);
    const roleIds = opts.roleId.split(',');
    const result = [];
    async.forEachOf(roleIds, (id, key, callback) => {
      const data = opts;
      data.roleId = id;
      jiraClient.project.getRole(data).then((res) => {
        result.push(res);
        return callback();
      }, (err) => {
        return callback(err);
      });
    }, (err) => {
      if (err) {
        try {
          const errorObj = JSON.parse(err);
          return reject(errorObj);
        } catch (e) {
          return reject(err);
        }
      } else {
        return resolve(result);
      }
    });
  })
}

/**
 * Get all issue types with valid status values for a project
 *
 * @method getStatuses
 * @memberOf ProjectClient#
 * @param opts The request options sent to the Jira API.
 * @param {String} opts.auth The JIRA auth details of the requesting user.
 * @param {String} opts.projectIdOrKey The project id or project key.
 * @return {Promise} Resolved when the statuses have been retrieved.
 */
function getStatuses(opts, next) {
  return new Promise((resolve, reject) => {
    const jiraClient = getJiraClient(opts.auth);
    jiraClient.project.getStatuses(opts).then((res) => {
      return resolve(res);
    }, (err) => {
      try {
        const errorObj = JSON.parse(err);
        return reject(errorObj);
      } catch (e) {
        return reject(err);
      }
    });
  })
}

/**
 * Updates project status in DB.
 *
 * @method updateProjectStatus
 * @param {Object} opts The project properties sent to the DB.
 * @param {String} opts.id The project id.
 * @param {Object} opts.status The project status.
 * @param {Object} opts.auth The user authentication details.
 * @return {Promise} Resolved when the project status has been updated.
 */
function updateProjectStatus(opts) {
  return new Promise(async (resolve, reject) => {
    // 1 Update project status in DB
    const filter = {
      projectID: opts.id,
    };
    const update = {
      $set: {
        status: opts.status,
      },
    };
    if (opts.status === 'Completed' || opts.status === 'Results shared') {
      const completedTime = moment().utcOffset(0);
      completedTime.set({
        hour: 0, minute: 0, second: 0, millisecond: 0,
      });
      completedTime.toISOString();
      completedTime.format();
      update.$set.completedAt = completedTime;
    } else {
      update.$unset = {
        completedAt: '',
      };
    }
    if (opts.requestId) {
      if (opts.status === 'Completed') {
        update.$set.endDate = moment.utc(opts.endDate).toDate();
        update.$set.completedAt = moment.utc(opts.endDate).toDate();
      } else {
        update.$unset = {
          endDate: '',
          completedAt: '',
        };
      }
    }

    update.$set.statusLastUpdatedBy = opts.auth?.name || "";

    try {
      const res = await Project.findOneAndUpdate(filter, update, { new: true, strict: true, runValidators: true }).lean();
      try {
        const data = JSON.parse(JSON.stringify(res));
        let approverUsers = [];
        if (data?.dtrMeta?.dtrId && opts.status) {
          await DataTransferRequest.findOneAndUpdate({ _id: data?.dtrMeta?.dtrId}, { $set: { state: opts.status.toUpperCase() }}, { new: true, strict: true, runValidators: true },)
          const dtrDetails = await jiraDataTransferRequestServices.getDataTransferRequestById({dtrID: data?.dtrMeta?.displayId.split('-')[1]});
          if (dtrDetails?.approversData && Object.keys(dtrDetails?.approversData)?.length) {
            const { lead, collaborators, approvers } = dtrDetails?.approversData;
            const approversData = _.uniqBy([...approvers, ...lead, ...collaborators], 'email');
            for(let i = 0; i < approversData?.length; i++) {
              const userResponse = await User.findOne({wWID: approversData[i].wWID, emailNotification: 'yes'}).lean();
              if (userResponse && Object.keys(userResponse)?.length) {
                approverUsers.push(approversData[i]);
              }
            }
            const emailData = {
              to: approverUsers.map((d) => d.email),
              subject: `Data Reuse Project (${data.displayId}) Status Updated`,
              html: `<p>Hi ${inviteMessage(approverUsers)},</p><p>Your Data Reuse Project (${data.displayId}) for Data Reuse Request (${data?.dtrMeta?.displayId}) had its status changed to ${data.status}.</p></br><p>Thanks,</br>Team Scope</p><hr><p><b>Note:</b> Please do not reply to this e-mail as it is an automated message.</p>`,
            };
            await sendEmail(emailData);
          }
        }
      } catch (error) {
        logger.error(error, 'ERROR_IN_SENDING_EMAIL_TO_APPROVERS');
      }
      // 1.b Project status has been successfully updated to db
      if (res && opts.status && opts.requestId) {
        const filter = {
          _id: opts.requestId,
        }
        var utc = moment.utc().valueOf();
        const update = {
          state: opts.status === 'Completed' ? opts.status.toUpperCase() : opts.status === 'On Hold' ? 'REJECTED' : 'IN PROGRESS',
          completedAt: opts.status === 'Completed' ? moment.utc(utc).toDate() : null,
        }
        try {
          await ProjectRequest.findOneAndUpdate(filter, update, { new: false, strict: true, runValidators: true }).lean();
          resolve(res);
        } catch (err) {
          logger.error(err, 'ERROR_PROJECT_REQUEST_STATUS_UPDATE');
          reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_PROJECT_REQUEST_STATUS_UPDATE', stackTrace: err });
        }
      } else {
        resolve(res);
      }
      if (res && opts.auth.emailNotification && ['true', 'yes'].includes(opts.auth.emailNotification)) {
        try {
          const pipeline = [
            { $match: filter },
            {
              $lookup:
              {
                from: 'users',
                localField: 'lead.wWID',
                foreignField: 'wWID',
                as: 'type1',
              },
            },
            {
              $lookup:
              {
                from: 'users',
                localField: 'collaborators.name',
                foreignField: 'username',
                as: 'type2',
              },
            },
            {
              $lookup:
              {
                from: 'groups',
                localField: 'collaborators.name',
                foreignField: 'name',
                as: 'groups',
              },
            },
            { $unwind: '$groups' },
            {
              $lookup:
              {
                from: 'users',
                localField: 'groups.members._id',
                foreignField: '_id',
                as: 'type3',
              },
            },
            // output projection
            {
              $project: {
                values: {
                  $concatArrays: [
                    '$type1',
                    '$type2',
                    '$type3',
                  ],
                },
              },
            },
          ];
          const aggregation = Project.aggregate(pipeline);
          aggregation.options = { allowDiskUse: true };
          const pData = await aggregation.exec();
          if (pData && pData[0] && pData[0].values && pData[0].values.length > 0) {
            const uniqArr = pData[0].values.reduce((acc, current) => {
              const x = acc.find((item) => { return item.email === current.email; });
              if (!x) {
                return acc.concat([current]);
              }
              return acc;
            }, []);
            const toEmails = uniqArr.map((data) => {
              return data.email;
            }).join(', ');
            const emailData = {
              to: toEmails,
              subject: `Project (${res.displayId}) Status Updated`,
              html: `<p>Dear Scope User,</p><p>Your project (${res.displayId}) status has been updated to ${opts.status}.</p></br><p>Thanks,</br>Team Scope</p><hr><p><b>Note:</b> Please do not reply to this e-mail as it is an automated message.</p>`,
            };
            await sendEmail(emailData);
          }
        } catch (findErr) {
          logger.error(findErr, 'ERROR_DB_FIND_PROJECT_DETAILS');
        }
      }
    } catch (err) {
      // 1.a Project status updation in DB failed
      logger.error(err, 'ERROR_PROJECT_STATUS_UPDATE');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_PROJECT_STATUS_UPDATE' });
    }
  });
}

/**
 * Adds comment to the project.
 *
 * @method addProjectComment
 * @param {Object} opts The project comment properties sent to the DB.
 * @param {String} opts.id The project id.
 * @param {Object} opts.comment The project comment details.
 * @return {Promise} Resolved when the project comment has been added.
 */
 async function addProjectComment(opts) {
    try {
      // 1. Find the project
      const project = await Project.findOne({ projectID: opts.id })
        .populate("categoryId", "name")
        .lean();

      if (!project) {
        throw new Error("Project not found");
      }

      // 2. Prepare comment
      const commentData = {
        ...opts.comment,
        commentAt: new Date(),
      };

      // 3. Add comment and repopulate
      const updatedProject = await Project.findOneAndUpdate(
        { projectID: opts.id },
        { $push: { comments: commentData } },
        { new: true, runValidators: true }
      ).populate("comments.author", "_id name profileImage");

      // 4. Check if category is SMH → send email
      if (project.categoryId?.name === "SMH") {
        const toEmail = async (username) => {
          if (!username) return null;
          const user = await User.findOne({ username }).lean();
          return user?.email || null;
        };

        const userLookups = [
          toEmail(project.lead?.userName),
          ...[...(project.leads || []), ...(project.collaborators || [])]
            .map((u) => toEmail(u?.name)),
        ];

        // Resolve all user lookups in parallel
        let recipients = (await Promise.all(userLookups)).filter(Boolean);

        // Deduplicate & filter
        recipients = [...new Set(recipients)].filter(
          (email) => !email.includes("scope-administrators")
        );

        if (recipients.length > 0) {
          const emailBody = newCommentNotification(
            process.env.UI_HOST,
            project.projectID
          );

          await sendEmail({
            to: recipients,
            subject: "New Comment Added to Your Project",
            html: emailBody,
          });
        }
      }

      return updatedProject;
    } catch (err) {
      logger.error(err, "ERROR_ADDING_COMMENT");
      throw {
        message: "Internal Server Error",
        code: 500,
        error: "ERROR_ADDING_COMMENT",
      };
    }
  }

/**
 * Deletes project comment.
 *
 * @method deleteProjectComment
 * @param {Object} opts The project comment properties sent to the DB.
 * @param {String} opts.id The project id.
 * @param {String} opts.cid The project comment id.
 * @return {Promise} Resolved when the project comment has been deleted.
 */
function deleteProjectComment(opts) {
  return new Promise(async (resolve, reject) => {
    // 1 Delete project comment from DB
    try {
      const filter = {
        projectID: opts.id,
      };
      console.log(opts.cid)
      const update = {
        $pull: {
          comments: {
            _id: new mongoose.Types.ObjectId(opts.cid),
          },
        },
      };
      const query = Project.findOneAndUpdate(filter, update, { new: true, strict: true, runValidators: true })
                          .populate('comments.author', '_id name profileImage');
      const res = await query.exec();
      return resolve(res);
    } catch (err) {
      // 1.a Project comment deletion in DB failed
      logger.error(err, 'ERROR_DB_UPDATE');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE' });
    }
  });
}

/**
 * Get all project comments.
 *
 * @method getProjectComments
 * @param {Object} opts The project comment properties sent to the DB.
 * @param {String} opts.id The project id.
 * @return {Promise} Resolved when the project comments has been retrieved.
 */
function getProjectComments(opts) {
  return new Promise(async (resolve, reject) => {
    // 1 Get all project comments from DB
    try {
      const query = Project.find({ projectID: opts.id }).select('comments').populate('comments.author', '_id name profileImage');
      const res = await query.exec()
      // 1.b Project comment has been successfully retrieved from db
      return resolve(res);
    } catch (err) {
      // 1.a Project comment retrieving from failed
      logger.error(err, 'ERROR_DB_FIND');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_FIND' });
    }
  });
}

/**
 * Get all project types
 *
 * @method getTypes
 * @memberOf ProjectClient#
 * @param opts The request options sent to the Jira API.
 * @param {String} opts.auth The JIRA auth details of the requesting user.
 * @return {Promise} Resolved when the types have been retrieved.
 */
function getTypes(opts, next) {
  return new Promise((resolve, reject) => {
    const jiraClient = getJiraClient(opts.auth);
    const projectClient = new ProjectClient(jiraClient);
    projectClient.getAllProjectTypes(opts).then((res) => {
      return resolve(res);
    }, (err) => {
      try {
        const errorObj = JSON.parse(err);
        return reject(errorObj);
      } catch (e) {
        return reject(err);
      }
    });
  })
}

/**
 * Import projects
 * @param {Array} data The projects to import.
 * @return {Promise} Resolved when the projects has been imported.
 */
function importProjects(data) {
  return new Promise(async (resolve, reject) => {
    try {
      const projectPromises = data.map(async (item) => {
        const pData = item;
        try {
          const tData = await Type.findOne({ name: pData.projectCustomType }).exec().lean();
          // 1.b. Type data found
          if (tData) {
            delete pData.projectCustomType;
            pData.typeData = {
              id: tData._id,
              name: tData.name,
            };
            try {
              const uData = Jjed.findOne({ emailAddress: `${pData.lead.userName}@its.jnj.com`}).exec().lean();
              if (uData) {
                pData.lead.wWID = uData._id;
                if (pData.collaborators && pData.collaborators.length > 0) {
                  pData.collaborators.forEach((cl) => {
                    const clData = cl;
                    clData.type = 'user';
                  });
                }
                if (pData.collaborators && pData.collaborators.length > 0) {
                  pData.collaborators.push({
                    type: 'group',
                    displayName: 'scope-administrators',
                    name: 'scope-administrators',
                  });
                } else {
                  pData.collaborators = [{
                    type: 'group',
                    displayName: 'scope-administrators',
                    name: 'scope-administrators',
                  }];
                }
                delete pData.permissionScheme;
                delete pData.projectTypeKey;
                delete pData.projectTemplateKey;
                delete pData.importProjectCustomType;
                return { status: 'fulfilled', value: pData };
              } else {
                logger.error(uErr, 'ERROR_DB_IMPORT_PROJECTS');
                return { status: 'rejected', reason: 'JJED not found' };
              }
            } catch (uErr) {
              logger.error(uErr, 'ERROR_DB_IMPORT_PROJECTS');
              return { status: 'rejected', reason: uErr };
            }
          } else {
            // 1.c If error, reject with error
            logger.error('TYPE_DATA_NOT_FOUND');
            return { status: 'rejected', reason: 'Type Data not found' };
          }
        } catch (tErr) {
          // 1.a If error, reject with error
          logger.error(tErr, 'ERROR_DB_IMPORT_PROJECTS');
          return { status: 'rejected', reason: tErr };
        }
      });
  
      const results = await Promise.allSettled(projectPromises);
      const projectErr = [];
      const result = [];
  
      results.forEach((res) => {
        if (res.status === 'fulfilled' && res.value && res.value.length) {
          result.push(...res.value);
        } else if (res.status === 'rejected') {
          projectErr.push(res.reason);
        }
      });
  
      if (projectErr.length) {
        logger.error(err, 'ERROR_DB_IMPORT_PROJECTS');
        return reject({
          message: 'Error in importing projects',
          code: 400,
          error: 'ERROR_DB_IMPORT_PROJECTS',
        });
      } else {
        // 1 Save the projects in DB
        try {
          const res = await Project.insertMany(result);
          // 1.b Projects has been successfully imported to db
          return resolve({ message: 'Projects imported successfully', code: 200 });
        } catch (saveErr) {
          // 1.a Project creation in DB failed
          logger.error(saveErr, 'ERROR_DB_SAVE');
          if (saveErr.code === 11000) {
            return reject({ message: 'Duplicate: Project with same name and lead already exist in system', code: 403, error: 'ERROR_DB_SAVE' });
          } else {
            return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_SAVE' });
          }
        }
      }
    } catch (err) {
      return reject(err);
    }
  });
}

/**
 * Deletes the project from DB
 * @author Aniket
 * @param {Object} opts The project properties
*/
function deleteProjectFromDB(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      let obj;
      if (opts.key) {
        obj = { key: opts.key };
      } else if (opts.projectIdOrKey) {
        obj = { projectID: opts.projectIdOrKey };
      }
      await Project.deleteOne(obj).lean();
      return resolve({
        message: 'Project deleted succrssfully',
        code: 200
      });
    } catch (error) {
      logger.error(err, 'ERROR_DBPROJECT_DELETE');
      return reject({
        message: 'Failed to delete project from DB',
        code: 400,
        error: ERROR_DBPROJECT_DELETE
      })
    }
  })
}

/**
 * Get all projects from DB which has been quarantined
 * @return {Promise} Resolved when the project has been retrieved.
 */
function getDeletedProjectsFromDB() {
  return new Promise(async (resolve, reject) => {
    // Get all projects from DB which has been quarantined
    try {
      const projects = await Project.find({ isDeleted: true }).lean();
      if (projects.length > 0) {
        // 1.b. Projects found
        return resolve({
          isFound: true,
          projects,
        });
      } else {
        // 1.c If not found, resolve it
        return resolve({
          isFound: false,
          projects,
        });
      }
    } catch (findErr) {
      // 1.a If error, reject with error
      logger.error(findErr, 'ERROR_DB_FINDPROJECTS');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FINDPROJECTS',
      });
    }
  });
}

/**
 * Get all project templates
 * @return {Promise} Resolved when the project templates has been retrieved.
 */
function getProjectTemplates(opts) {
  return new Promise((resolve, reject) => {
    // Get all projects templates
    const jiraClient = getJiraClient(opts.auth);
    const projectClient = new ProjectClient(jiraClient);
    projectClient.getProjectTemplates(opts).then((res) => {
      // 1.b If found, resolve with data
      return resolve(res);
    }).catch((jiraError) => {
      // 1.b If error, reject with error
      logger.error(jiraError, 'ERROR_FIND_PROJECT_TEMPLATES');
      try {
        const errObj = JSON.parse(jiraError);
        return reject({
          message: errObj.body ? errObj.body : 'Error in getting project templates',
          code: errObj.statusCode,
          error: 'ERROR_FIND_PROJECT_TEMPLATES',
        });
      } catch (exc) {
        return reject({
          message: 'Internal Server Error',
          code: 500,
          error: 'ERROR_FIND_PROJECT_TEMPLATES',
        });
      }
    });
  });
}

/**
 * Get projects by user id
 * @param {String} id The user wWID.
 * @param {String|Number} opts.perPage The projects limit per page.
 * @param {String} opts.query The search term for searching projects.
 * @param {String} opts.quarter The quarter name to filter projects.
 * @param {String} opts.startDate The start date to filter projects
 * @param {String} opts.endDate The end date to filter projects.
 * @return {Promise} Resolved when the projects corresponding to user data has been retrieved.
 */
function getProjectsByUserId(id, opts) {
  return new Promise(async (resolve, reject) => {
    /**
     * Note:
     * Using multiple aggregation is not recommended. use $facet instead
     * Issue: Due to BSON size limit 16MB per query, We cannot use multi-level
     * Aggregation to have below pipeline within same aggregation.
     */
    // 1 Get projects corresponding to the user data
    const limit = opts.perPage;
    // Filter projects by user details
    const userFilter = {
      $or:
        [
          { 'lead.wWID': id },
          { 'collaborators.wWID': id },
        ],
    };
    // Filter projects by group member details
    const groupFilter = {
      'users.wWID': id,
    };
    // Filter projects by query params
    const queryFilter = await filterProjects(opts);
    // Lookup for requst details
    const requestQuery = requestLookup();

    const basePipeline = [
      // Lookup for category details for base query filter.
      {
        $lookup:
        {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'categoryId',
        },
      },
      // Base query filter
      { $match: queryFilter },
      // Lookup for user details by group member _id.
      {
        $lookup:
        {
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
          localField: 'groups.members._id',
          foreignField: '_id',
          as: 'users',
        },
      },
      {
        $lookup:
        {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdBy',
        },
      },
      {
        $unwind: {
          path: "$createdBy",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          createdBy: "$createdBy.name"
        }
      },
      // Filter projects by user and group details.
      {
        $match: {
          $or: [
            userFilter,
            groupFilter,
          ],
        },
      }
    ];

    // Fetch recently created projects
    // if (opts.sort === undefined) {
    //   basePipeline.splice(3, 0, { $sort: { createdAt: -1 } });
    // }

  
    if (opts.sort !== undefined && opts.sort && limit !== 'all' && !opts.queryLanguage)  {
      basePipeline.push({ $sort: { updatedAt: -1 } });
    } else {
      basePipeline.push({ $sort: { createdAt: -1 } });
    }

    const countQuery = [
      { $group: { _id: null, count: { $sum: 1 } } },
      { $project: { _id: 0 } }
    ];

    const goalCompletionPipeline = [
      ...basePipeline,
      {
        $facet: {
          "completed": [
            // Filter out documents without a price e.g., _id: 7
            { $match: { status: 'Completed' } },
            ...countQuery,
          ],
          "completedInTime": [
            {
              $match: {
                $and: [
                  { status: 'Completed' },
                  { endDate: { $gt: null } },
                  { completedAt: { $gt: null } },
                  { completedAt: { $lte: '$endDate' } },
                ]
              }
            },
            ...countQuery,
          ],
          "completedBeyondTime": [
            {
              $match: {
                $and: [
                  { status: 'Completed' },
                  { endDate: { $gt: null } },
                  { completedAt: { $gt: null } },
                  { completedAt: { $gt: '$endDate' } },
                ]
              }
            },
            ...countQuery,
          ]
        }
      },
    ];

    const baseCount = [...basePipeline, ...countQuery];

    // Reports API Handler
    if (opts.sort && limit !== 'all' && opts.forReport && !opts.queryLanguage) {
      // TODO: Check filter for reports API
      basePipeline.unshift({ $sort: { updatedAt: -1 } });
    }

    if (opts.tableSort && opts.sortBy) { 
      let sortBy = opts.sortBy;
      if (sortBy === 'type') {
        sortBy = 'typeData.name';
      }
      if (sortBy === 'lead') {
        sortBy = 'lead.displayName'
      }
      const sortOptions = { $sort: { [sortBy]: opts.tableSort } };
      if (sortBy !== 'createdAt') {
        sortOptions.$sort.createdAt = -1;
      }
      basePipeline.push(sortOptions);
    }

    // Pagination:: Page: Skip records based on page.
    if (opts.page && limit !== 'all' && !opts.queryLanguage) {
      const skip = { $skip: opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0 };
      basePipeline.push(skip);
    }

    // Pagination:: Per Page: limit records based on per page.
    if (limit !== 'all' && !opts.queryLanguage) {
      basePipeline.push({ $limit: limit });
    }

    // Push request query at end to avoid size limit
    basePipeline.push(...requestQuery);
    const [baseAggregation, baseAggregationCount, goalCompletionAggregation] = [Project.aggregate(basePipeline), Project.aggregate(baseCount), Project.aggregate(goalCompletionPipeline)];

    baseAggregation.options = baseAggregationCount.options = goalCompletionAggregation.options = { allowDiskUse: true };
    Promise.allSettled([baseAggregation.exec(), baseAggregationCount.exec(), goalCompletionAggregation.exec()]).then((aggregationResponses) => {
      const errors = aggregationResponses.filter((res) => res.status === 'rejected');
      if (errors.length) {
        reject({
          message: 'Internal Server Error',
          code: 500,
          error: 'ERROR_DB_FIND_PROJECT_DETAILS',
        });
        logger.error(errors, 'ERROR_DB_FIND_PROJECT_DETAILS');
      } else {
        let [projectData = [], count = [{ count: 0 }], [ { completed = [{ count: 0 }], completedInTime = [{ count: 0 }], completedBeyondTime = [{ count: 0 }]} ] ] = aggregationResponses.filter((res) => res.status === 'fulfilled').map((res) => res.value);
        count = count.length ? (count[0]?.count || 0) : 0;
        if (projectData && projectData.length) {
          // 1.b. Project data found, resolve with data
          const finalArr = projectData.map((data) => {
            const result = data;
            const categoryData = Array.isArray(result.categoryId) ? result.categoryId[0] : result.categoryId;
            result.categoryId = categoryData;
            return result;
          });
          // Filter by query language
          if (opts && opts.queryLanguage) {
            filterProjectByQueryLanguage(projectData, opts).then((qProjects) =>{
              const filterQueryProjects = qProjects.map((data) => {
                const result = data;
                const categoryData = Array.isArray(result.categoryId) ? result.categoryId[0] : result.categoryId;
                result.categoryId = categoryData;
                return result;
              });

              const finalP = _.filter(filterQueryProjects, 'createdAt');
              // Sort projects by updatedAt based on query filter.
              if (opts.sort !== undefined && opts.sort === 'true') {
                const sortP = finalP.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                const skip = opts.page && opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0;
                if (skip) {
                  const paginatedProjects = opts.perPage !== 'all' ? sortP.slice(skip).slice(0, opts.perPage) : sortP;
                  resolve({
                    success: true,
                    projects: paginatedProjects,
                    totalCount: finalP.length,
                    completed: completed.length ? (completed[0]?.count || 0) : 0,
                    completedInTime: completedInTime.length ? (completedInTime[0]?.count || 0) : 0,
                    completedBeyondTime: completedBeyondTime.length ? (completedBeyondTime[0]?.count || 0) : 0,
                  })
                } else {
                  const paginatedProjects = opts.perPage !== 'all' ? finalP.slice(0, opts.perPage) : finalP;
                  resolve({
                    success: true,
                    projects: paginatedProjects,
                    totalCount: finalP.length,
                    completed: completed.length ? (completed[0]?.count || 0) : 0,
                    completedInTime: completedInTime.length ? (completedInTime[0]?.count || 0) : 0,
                    completedBeyondTime: completedBeyondTime.length ? (completedBeyondTime[0]?.count || 0) : 0,
                  })
                }
              } else {
                if (opts && opts.page && opts.perPage) {
                  const skip = opts.page && opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0;
                  const paginatedProjects = opts.perPage !== 'all' ? finalP.slice(skip).slice(0, opts.perPage) : finalP;
                  resolve({
                    success: true,
                    projects: paginatedProjects,
                    totalCount: finalP.length,
                    completed: completed.length ? (completed[0]?.count || 0) : 0,
                    completedInTime: completedInTime.length ? (completedInTime[0]?.count || 0) : 0,
                    completedBeyondTime: completedBeyondTime.length ? (completedBeyondTime[0]?.count || 0) : 0,
                  });
                } else {
                  resolve({
                    success: true,
                    projects: finalP,
                    totalCount: finalP.length,
                    completed: completed.length ? (completed[0]?.count || 0) : 0,
                    completedInTime: completedInTime.length ? (completedInTime[0]?.count || 0) : 0,
                    completedBeyondTime: completedBeyondTime.length ? (completedBeyondTime[0]?.count || 0) : 0,
                  });
                }
              }
            }).catch((err) => {
              const finalP = _.filter(finalArr, 'createdAt');
              if (opts.sort !== undefined && opts.sort === 'true') {
                const sortP = finalP.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                const skip = opts.page && opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0;
                if (skip) {
                  const paginatedProjects = opts.perPage !== 'all' ? sortP.slice(skip).slice(0, opts.perPage) : sortP;
                  resolve({
                    success: true,
                    projects: paginatedProjects,
                    totalCount: finalP.length,
                    completed: completed.length ? (completed[0]?.count || 0) : 0,
                    completedInTime: completedInTime.length ? (completedInTime[0]?.count || 0) : 0,
                    completedBeyondTime: completedBeyondTime.length ? (completedBeyondTime[0]?.count || 0) : 0,
                  })
                } else {
                  const paginatedProjects = opts.perPage !== 'all' ? finalP.slice(0, opts.perPage) : finalP;
                  resolve({
                    success: true,
                    projects: paginatedProjects,
                    totalCount: finalP.length,
                    completed: completed.length ? (completed[0]?.count || 0) : 0,
                    completedInTime: completedInTime.length ? (completedInTime[0]?.count || 0) : 0,
                    completedBeyondTime: completedBeyondTime.length ? (completedBeyondTime[0]?.count || 0) : 0,
                  })
                }
              } else {
                resolve({
                  success: true,
                  projects: finalP,
                  totalCount: finalP.length,
                  completed: completed.length ? (completed[0]?.count || 0) : 0,
                  completedInTime: completedInTime.length ? (completedInTime[0]?.count || 0) : 0,
                  completedBeyondTime: completedBeyondTime.length ? (completedBeyondTime[0]?.count || 0) : 0,
                });
              }
            })
          } else {
            const finalP = _.filter(finalArr, 'createdAt');
              resolve({
                projects: finalP,
                totalCount: count,
                completed: completed.length ? (completed[0]?.count || 0) : 0,
                completedInTime: completedInTime.length ? (completedInTime[0]?.count || 0) : 0,
                completedBeyondTime: completedBeyondTime.length ? (completedBeyondTime[0]?.count || 0) : 0,
                success: true,
              });
          }
        } else {
          // 1.c Project data empty, resolve it
          resolve({
            projects: [],
            totalCount: count,
            success: true,
          });
        }
      }
    });
  });
}

/**
 * Get project details by user id
 * @param {String} pid The project id
 * @param {String} id The user wWID.
 * @return {Promise} Resolved when the project details by username has been retrieved.
 */
function getProjectDetailsByUserId(pid, id) {
  return new Promise(async (resolve, reject) => {
    // 1 Get project details corrsponding to the user data
    try {
      const query = Project.findOne({ projectID: pid, 'lead.wWID': id })
                          .populate('comments.author', '_id name profileImage')
                          .populate('categoryId', '_id self name description createdAt updatedAt __v')
                          .populate('typeData.id', '_id createdAt updatedAt name categoryId attributes isEnabled htmlFile __v');
      const pData = await query.exec();
      if (pData) {
        // 1.b. Project data found, resolve with data
        return resolve(pData);
      } else {
        // 1.c If error, reject with error
        logger.error(findErr, 'ERROR_DB_FIND_PROJECT');
        return reject({
          message: 'Error in finding project data',
          code: 404,
          error: 'ERROR_DB_FIND_PROJECT',
        });
      }
    } catch (findErr) {
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

function processProjects(projects, defaultColumns, uniqueKeys) {
  projects.forEach((project) => {
    Object.keys(project.customFieldMap).forEach((cField) => {
      uniqueKeys.add(cField);
      if (!defaultColumns.some(obj => obj.label === cField)) {
            defaultColumns.push({
              label: cField,
              field: cField,
              sortable:true,
              thClass: "center-text trunc-desc",
              tdClass: "center-text trunc-desc",
              width: "120px",
              filterOptions: {
                  enabled: true,
                  trigger:"enter"
              },
              typeDef: {},
              isCFField:true,
              isLoading:false,
              isRendered:true,
              type:project.customFieldMap[cField]?.type
          });
      }
    });
    
    // Process quarters
    if (project.quarters) {
      project.quarters.forEach((quarter) => {
        uniqueKeys.add(quarter.quarter);
        // Process the quarter key
        if (!defaultColumns.some(obj => obj.field === quarter.quarter)) {
          defaultColumns.push({
            label: quarter.quarter.replace(/_/g, ' '),
            field: quarter.quarter,
            key: "quarter",          
            sortable: false,
            thClass: "center-text trunc-desc",
            tdClass: "center-text trunc-desc",
            width: "400px",
            filterOptions: {
              enabled: false,
              styleClass: "quarter-header",
              trigger: "enter"
            },
            typeDef: {},
            isCFField: false,
            isLoading: false,
            isRendered: true
          });
        }
      });
    }
  });
}

function createProjectRows(projects, uniqueKeys, defaultColumns,userName,userID) {
  return new Promise(async (resolve, reject) => {
    try {
      const projectRowsData = await Promise.all(projects.map(async (project) => {
        const obj = {};
        Array.from(uniqueKeys).forEach((field) => {
          if(project.customFieldMap.hasOwnProperty(field)){
            if(field === 'Project Priority'){
              obj['priority'] = project.customFieldMap[field].value;
            }else{
              obj[field] = isValidDate(project.customFieldMap[field].value) ? moment.utc(project.customFieldMap[field].value).format('MM/DD/YYYY') : project.customFieldMap[field].value || '-';
            }
          }else if(field !== 'Project Priority'){
            obj[field] = getFieldValue(field, project, defaultColumns);
          }
        });
        if (project?.categoryId?.length && project?.categoryId[0]?.name === 'SBO' && project?.duration) {
          obj['duration'] = `${project.duration} Day${project?.duration === 1 ? '' : 's'}`;
        }
        if(project?.requestMeta){
          obj['requestId'] = project?.requestMeta?.requestId ? project?.requestMeta?.requestId : '-'
        }
        if(project?.dtrMeta){
          obj['dtrId'] = project?.dtrMeta?.dtrId ? project?.dtrMeta?.dtrId : '-'
        }
        if (project?.createdAt){
          obj['createdAt'] = project?.createdAt ? moment(project?.createdAt).format('MM/DD/YYYY') : '-'
        }
        if(project?.categoryId){
          obj['category'] = project?.categoryId[0]?.name ? project?.categoryId[0]?.name : '-'
        }
        if(project?.quarters){
          project?.quarters ? Object.assign(obj, convertQuartersFormat(project?.quarters)) : '-'
        }
        // if(project?.lead){
        //   obj['leadUserName'] = project?.lead.userName ? project?.lead?.userName : '-'
        // }
        if (project?.leads) {
          obj['leads'] = project?.leads?.length ? project?.leads?.map(e => e?.displayName)?.join(', ') : '-';
        }
        if(project?.displayId){
          obj['isMyProject'] = await checkProjectExistence(project?.displayId,userName,userID)
        }
        return obj;
      }));
      return resolve(projectRowsData);
    } catch (error) {
      return reject(error);
    }
  });
}

function getFieldValue(key, project, defaultColumns) {
  switch (key) {
    case 'lead':
      return getNestedPropertyValue('displayName', project.lead);
    case 'gitlab':
      return getNestedPropertyValue('projectUrl', project.gitlab);
    case 'collaborators':
    return convertObjectsToString(project.collaborators);
    case 'startDate':
      return  project.startDate ? moment.utc(project.startDate).format('MM/DD/YYYY') : '-';
    case 'completedAt':
      return  project.completedAt ? moment.utc(project.completedAt).format('MM/DD/YYYY') : '-';
    case 'endDate':
      return  project.endDate ? moment.utc(project.endDate).format('MM/DD/YYYY') : '-';
    default:
      return project[key] ? project[key] : '-';
  }
}

async function checkProjectExistence(displayId, searchValue, userID) {
  try {
    // Step 1: Get project category
    const projectCategory = await Project.aggregate([
      { $match: { displayId } },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryDetails"
        }
      },
      { $unwind: "$categoryDetails" },
      {
        $project: {
          _id: 0,
          categoryName: "$categoryDetails.name"
        }
      }
    ]);

    const categoryNames = projectCategory.map(c => c.categoryName);

    // Step 2: Get user's department leads
    const usersDepartmentLead = await jiraGroupServices.groupsByUserID(userID);

    const isCategoryInUserLeads = categoryNames.some(name =>
      usersDepartmentLead?.includes(name)
    );

    // If user belongs to the same category → allow access
    if (isCategoryInUserLeads) return true;

    // Step 3: SBO specific filters
    const SBOAdditionFilters = categoryNames.includes("SBO")
      ? [
          {
            $and: [
              { "customFields.name": "SDS Lead" },
              { "customFields.value": { $regex: searchValue, $options: "i" } }
            ]
          },
          {
            $and: [
              { "customFields.name": "Sponsor" },
              { "customFields.value": { $regex: searchValue, $options: "i" } }
            ]
          }
        ]
      : [];

    // Step 4: Search project
    const result = await Project.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $addFields: {
          user: { $arrayElemAt: ["$user", 0] }
        }
      },
      {
        $match: {
          displayId,
          $or: [
            { "collaborators.name": { $regex: searchValue, $options: "i" } },
            { "lead.userName": { $regex: searchValue, $options: "i" } },
            { "user.username": { $regex: searchValue, $options: "i" } },
            ...SBOAdditionFilters
          ]
        }
      }
    ]);

    return result.length > 0;

  } catch (error) {
    logger.error("Error checking project existence:", error);
    return false;
  }
}

function isValidDate(dateString) {
  // Regular expression to check YYYY-MM-DDTHH:MM:SS.SSSZ format
  const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  // If the date string doesn't match the regex, it's invalid
  if (!regex.test(dateString)) {
    return false;
  }

  // Attempt to create a Date object from the input string
  const date = new Date(dateString);

  // Check if the Date object's time value is a valid number
  if (isNaN(date.getTime())) {
    return false;
  }

  // Additional check to ensure the date parts are correct
  const year = parseInt(dateString.slice(0, 4), 10);
  const month = parseInt(dateString.slice(5, 7), 10);
  const day = parseInt(dateString.slice(8, 10), 10);
  const hours = parseInt(dateString.slice(11, 13), 10);
  const minutes = parseInt(dateString.slice(14, 16), 10);
  const seconds = parseInt(dateString.slice(17, 19), 10);
  const milliseconds = parseInt(dateString.slice(20, 23), 10);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hours ||
    date.getUTCMinutes() !== minutes ||
    date.getUTCSeconds() !== seconds ||
    date.getUTCMilliseconds() !== milliseconds
  ) {
    return false;
  }

  return true;
}

function convertQuartersFormat(quartersArray) {
  return quartersArray.reduce((acc, { quarter, actualFTE, notes }) => {
    acc[quarter] = { actualFTE, notes };
    return acc;
  }, {});
}

/**
 * Get projects for reports
 *
 * @method getProjectsForReports
 * @param {Object} opts The request options sent to the Jira API.
 * @param {String} opts.auth The JIRA auth details of the requesting user.
 * @param {Array} opts.directReports The requesting user direct reports details.
 * @param {String} opts.perPage The projects limit per page.
 * @param {String} opts.query The search term for searching projects.
 * @param {String} opts.showAll To display all projects or not.
 * @return {Promise} Resolved when the projects for reports has been retrieved.
 */
function getProjectsForReports(opts) {
  return new Promise((resolve, reject) => {
    if (opts.auth.isSuperAdmin || opts.auth.isAdmin || opts.showAll === 'true') {
      // 1 Get all projects
      getAllDirectReportsProjects(opts).then(async (response) => {
        console.log({ response });
        // 1.a Resolve the resposne
        // Deep copy from constants and initialize unique keys set
        let defaultColumns = JSON.parse(JSON.stringify(REPORTS_HEADER));
        const uniqueKeys = new Set(defaultColumns.map(column => column.field));


        // Process each project to extract custom fields and dropdown values
        processProjects(response.projects, defaultColumns, uniqueKeys);
        
        // Create rows for each project with the necessary fields
        const projectRows = await createProjectRows(response.projects, uniqueKeys, defaultColumns,opts.auth.username,opts.auth._id);
        let projectHeader;
        if(opts.department !== "All"){
          const categories = await Category.findOne(
            { _id: opts.department },
            { name: 1, _id: 0 }
            ).exec();
          if(categories?.name === "TMEDS"){
            defaultColumns = defaultColumns.filter(item => item.label !== "Priority");
          }

          if(categories?.name === "SBO"){
            projectHeader = [
              ...defaultColumns.slice(0, 11),
              ...defaultColumns.slice(11)
                .filter(item => !item.label.match(/^Q[1-4]\s\d{4}$/)) // Exclude quarter-year labels
                .sort((a, b) => a.label.localeCompare(b.label)), // Sort other labels alphabetically
              ...defaultColumns.slice(11)
                .filter(item => item.label.match(/^Q[1-4]\s\d{4}$/)) // Only include quarter-year labels
                .sort((a, b) => {
                  const [quarterA, yearA] = a.label.split(' ').map((val, i) => (i === 1 ? +val : +val[1]));
                  const [quarterB, yearB] = b.label.split(' ').map((val, i) => (i === 1 ? +val : +val[1]));
                  return yearA - yearB || quarterA - quarterB; // Sort by year, then by quarter
                })
            ].filter(item => item.label !== "Project Priority");
          } else {
              const findSBOIndex = defaultColumns.findIndex((column) => column.field === 'duration');
              defaultColumns = defaultColumns?.map(elem => {
                if (elem?.label === "Lead" && categories.name === 'SMMC') {
                  return { ...elem, label: 'Submitter' };
                }
                return elem;
              })
              if (findSBOIndex > -1) {
                defaultColumns.splice(findSBOIndex, 1);
              }
              const submitDateObj = [];
              const leadsHeaderObj = [];
            if (['SMH', 'SMMC'].includes(categories.name)) {
              submitDateObj.push({
                label: 'Submit Date',
                field: 'createdAt',
                sortable: true,
                thClass: 'center-text trunc-desc',
                tdClass: 'center-text trunc-desc',
                width: '120px',
                filterOptions: { enabled: true, trigger: 'enter' },
                typeDef: {},
                type: 'DATE'
              },
              );
              if (categories.name === 'SMMC') {
                leadsHeaderObj.push({
                  label: 'Leads',
                  field: 'leads',
                  sortable: true,
                  thClass: "center-text trunc-desc",
                  tdClass: "center-text trunc-desc",
                  width: "120px",
                  filterOptions: {
                    enabled: true,
                    trigger: "enter",
                  },
                  typeDef: {},
                  isLoading: false,
                  isRendered: true,
                  type: "LDAP",
                })
              }
              if (categories.name === 'SMH') {
                submitDateObj.push({
                  label: 'Update Date',
                  field: 'updatedAt',
                  sortable: true,
                  thClass: 'center-text trunc-desc',
                  tdClass: 'center-text trunc-desc',
                  width: '120px',
                  filterOptions: { enabled: true, trigger: 'enter' },
                  typeDef: {},
                  type: 'DATE'
                })
              }
            }
            projectHeader = [...defaultColumns.slice(0, 11), ...submitDateObj, ...leadsHeaderObj, ...defaultColumns.slice(11).sort((a, b) => a.label.localeCompare(b.label))].filter(item => item.label !== "Project Priority");  // Filter out items with label "Project Priority"
            if (categories.name === 'SMH') {
              projectHeader = projectHeader?.filter(e => e.field !== "priority");
            }
          }
        } else {
          projectHeader = [...defaultColumns]
        }
        const updates = await jiraUserPreferenceServices.getTableWidth({ userId: opts?.auth?._id, tableName: "project" })
        console.log({ updates })
        const updatedHeaders = updateColumnWidths(projectHeader, updates?.columns || []);
        resolve({ projectRows, projectHeader: updatedHeaders ,totalCount:response.totalCount });
      }, (err) => {
        // 1.b If error, reject with error
        reject(err);
      });
    } else {
      const ids = opts.directReports ? opts.directReports.split(',') : [];
      const wWID = (opts.auth.wWID && typeof opts.auth.wWID === 'object' && opts.auth.wWID.wWID) ? opts.auth.wWID.wWID : opts.auth.wWID;
      ids.push(wWID);
      getDirectReportsProjectsByUserId(ids, opts).then(async (response) => {
        console.log({ response1: response });

        // 2.a Resolve the resposne
          // Deep copy from constants and initialize unique keys set
          let defaultColumns = JSON.parse(JSON.stringify(REPORTS_HEADER));
          const uniqueKeys = new Set(defaultColumns.map(column => column.field));

          // Process each project to extract custom fields and dropdown values
          processProjects(response.projects, defaultColumns, uniqueKeys);

          // Create rows for each project with the necessary fields
          const projectRows = await createProjectRows(response.projects, uniqueKeys, defaultColumns,opts.auth.username,opts.auth._id);
          let projectHeader;
          if(opts.department !== "All"){
            const categories = await Category.findOne(
              { _id: opts.department },
              { name: 1, _id: 0 }
              ).exec();
            if(categories.name === "TMEDS"){
              defaultColumns = defaultColumns.filter(item => item.label !== "Priority");
            }

            if(categories.name === "SBO"){
              projectHeader = [
                ...defaultColumns.slice(0, 11), 
                ...defaultColumns.slice(11)
                  .filter(item => !item.label.match(/^Q[1-4]\s\d{4}$/)) // Exclude quarter-year labels
                  .sort((a, b) => a.label.localeCompare(b.label)), // Sort other labels alphabetically
                ...defaultColumns.slice(11)
                  .filter(item => item.label.match(/^Q[1-4]\s\d{4}$/)) // Only include quarter-year labels
                  .sort((a, b) => {
                    const [quarterA, yearA] = a.label.split(' ').map((val, i) => (i === 1 ? +val : +val[1]));
                    const [quarterB, yearB] = b.label.split(' ').map((val, i) => (i === 1 ? +val : +val[1]));
                    return yearA - yearB || quarterA - quarterB; // Sort by year, then by quarter
                  })
              ].filter(item => item.label !== "Project Priority");
            } else {
              const findSBOIndex = defaultColumns.findIndex((column) => column.field === 'duration');
              if (findSBOIndex > -1) {
                defaultColumns.splice(findSBOIndex, 1);
              }
              defaultColumns = defaultColumns?.map(elem => {
                if (elem?.label === "Lead" && categories.name === 'SMMC') {
                  return { ...elem, label: 'Submitter' };
                }
                return elem;
              })
              const submitDateObj = [];
              const leadsHeaderObj = [];
              if (['SMH', 'SMMC'].includes(categories.name)) {
                submitDateObj.push({
                  label: 'Submit Date',
                  field: 'createdAt',
                  sortable: true,
                  thClass: 'center-text trunc-desc',
                  tdClass: 'center-text trunc-desc',
                  width: '120px',
                  filterOptions: { enabled: true, trigger: 'enter' },
                  typeDef: {},
                  type: 'DATE'
                });
              }
              if (categories.name === 'SMMC') {
                leadsHeaderObj.push({
                  label: 'Leads',
                  field: 'leads',
                  sortable: true,
                  thClass: "center-text trunc-desc",
                  tdClass: "center-text trunc-desc",
                  width: "120px",
                  filterOptions: {
                    enabled: true,
                    trigger: "enter",
                  },
                  typeDef: {},
                  isLoading: false,
                  isRendered: true,
                  type: "LDAP",
                })
              }
              if (categories.name === 'SMH') {
                submitDateObj.push({
                  label: 'Update Date',
                  field: 'updatedAt',
                  sortable: true,
                  thClass: 'center-text trunc-desc',
                  tdClass: 'center-text trunc-desc',
                  width: '120px',
                  filterOptions: { enabled: true, trigger: 'enter' },
                  typeDef: {},
                  type: 'DATE'
                })
              }
              projectHeader = [...defaultColumns.slice(0, 11), ...submitDateObj, ...leadsHeaderObj, ...defaultColumns.slice(11).sort((a, b) => a.label.localeCompare(b.label))].filter(item => item.label !== "Project Priority");  // Filter out items with label "Project Priority"
              if (categories.name === 'SMH') {
                projectHeader = projectHeader?.filter(e => e.field !== "priority");
              }
            }
          }
        const updates = await jiraUserPreferenceServices.getTableWidth({ userId: opts?.auth?._id, tableName: "project" })
        const updatedHeaders = updateColumnWidths(projectHeader, updates?.columns || []);

        resolve({ projectRows, projectHeader: updatedHeaders ,totalCount:response.totalCount});
      }, (err) => {
        // 2.b If error, reject with error
        reject(err);
      });
    }
  });
}



/**
 * Get direct reports projects by user id
 * @param {Array} ids The user wWID's Array.
 * @param {String|Number} opts.perPage The projects limit per page.
 * @param {String} opts.query The search term for searching projects.
 * @param {String} opts.quarter The quarter name to filter projects.
 * @param {String} opts.startDate The start date to filter projects
 * @param {String} opts.endDate The end date to filter projects.
 * @return {Promise} Resolved when the projects corresponding to user data has been retrieved.
 */
function getDirectReportsProjectsByUserId(ids, opts) {
  return new Promise(async (resolve, reject) => {
    // Filter projects by query params
    const limit = opts.perPage;
    const queryFilter = await filterProjects(opts); // Generic filter to filter project by project details
    const requestQuery = requestLookup();
    const dtrQuery = dtrLookup();
    // const isUserInSMHGroup = await Group.findOne({ name: 'SMH_LEADS', "members._id": { $in: [opts?.auth?._id] }}).lean();
    let smhQuery = [];
    // if (!isUserInSMHGroup) {
    //   smhQuery = smhCaseStudyLookup(opts?.auth?.username);
    // }
    const defaultColumns = JSON.parse(JSON.stringify(REPORTS_HEADER)); // deep copy from constants
    // Base pipeline to filter projects by lead and collaborators
    const durationFilter = [];
    if (opts?.hasOwnProperty('duration') && opts?.duration) {
      const duration = opts.duration?.toLowerCase().replace('days', '').replace('day', '');
      durationFilter.push({
        $match: {
          duration: { $eq: Number(duration) }
        }
      })
    }
    const pipeline = [
      // Apply generic filter.
      { $match: { ...queryFilter, isDeleted: false } },
      // Get categories details for base filer.
      {
        $lookup:
        {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'categoryId',
        },
      },
      {
        $lookup:
        {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdBy',
        },
      },
      { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          createdBy: "$createdBy.name"
        }
      },
      {
        $addFields: {
          duration: {
            $cond: {
              if: { $and: [{ $ifNull: ["$startDate", false] }, { $ifNull: ["$endDate", false] }] },
              then: {
                $floor: {
                  $divide: [
                    { $subtract: ["$endDate", "$startDate"] },
                    1000 * 60 * 60 * 24
                  ]
                }
              },
              else: null
            }
          }
        }
      },
      ...durationFilter,
      ...requestQuery,
      ...dtrQuery,
      ...smhQuery,
      // ...createdByFilter,
    ];

    // ! Issue: Mongo Queries has limit of 16MB per query, So filter unwanted details when lookup.
    // * User can also be part of a group added to current project, So lookup by group.
    // Group pipeline to fetch projects by group members
    const collaboratorPipeline = [
      {
        $lookup:
        {
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
          localField: 'groups.members._id',
          foreignField: '_id',
          as: 'users',
        },
      },
      { $addFields: { groupCollaborators: '$users.wWID' } },
      { $project: { groups: 0, users: 0 } },
    ];

    pipeline.push(...collaboratorPipeline);

    // Filter projects by user details
    // 1 Get direct reports projects corresponding to the user data
    const userFilter = {
      $match: {
        $or:
          [
            { 'lead.wWID': { $in: ids } },
            { 'collaborators.wWID': { $in: ids } },
            { 'groupCollaborators': { $in: ids } },
          ],
      }
    };

    pipeline.push(userFilter);

    let allCustomFieldsPipeline = [...pipeline];
    let allCustomFields ;

    allCustomFieldsPipeline.push(
      { '$unwind': '$customFields' },
      { '$group': { '_id': null, 'allFieldNames': { '$addToSet': '$customFields.name' } } },
      { '$project': { '_id': 0, 'allFieldNames': 1 } }
    );
    


    const aggregationallCustomFields = Project.aggregate(allCustomFieldsPipeline);
    aggregationallCustomFields.options = { allowDiskUse: true };
    // Executing aggregation and handling the result
    try {
      allCustomFields = await aggregationallCustomFields.exec();
      // Further processing of allCustomFields
    } catch (error) {
        console.error("Error fetching data:", error);
        // Handle error appropriately
    }

    pipeline.push(
      {
        '$addFields': {
          customFields: {
            '$map': {
              input: '$customFields',
              as: 'field',
              in: {
                k: { $concat: ["", "$$field.name"] }, // Field name
                v: {
                  value: { $ifNull: ["$$field.value", "-"] }, // Field value or default to '-'
                  type: { $ifNull: ["$$field.type", "-"] }  // Field type or default to '-'
                }
              }
            }
          }
        }
      },
      {
        '$addFields': {
          customFieldMap: {
            '$arrayToObject': '$customFields'
          }
        }
      },
      {
        '$addFields': {
          customFieldMap: {
            $mergeObjects: [
              {
                $arrayToObject: {
                  $map: {
                    input: allCustomFields[0]?.allFields !== undefined ? allCustomFields[0]?.allFields : [],
                    as: 'field',
                    in: [
                      "$$field.name",  // Use field name as key
                      { 
                        value: { $ifNull: ["", "-"] },  // Default value for missing field
                        type: { $ifNull: ["$$field.type", "-"] }  // Dynamically set type or default to '-'
                      }
                    ]
                  }
                }
              },
              "$customFieldMap"
            ]
          }
        }
      }
    );

    // Create a seperate pipeline for count, (!Due to query max limit of 16MB)
    const countPipeline = [...pipeline];
    // Sort project by last
    // pipeline.push({ $sort: { createdAt: -1 } });
    if (opts.sort !== undefined && opts.sort && limit !== 'all' && !opts.queryLanguage)  {
      pipeline.push({ $sort: { updatedAt: -1 } });
    } else {
      pipeline.push({ $sort: { updatedAt: -1 } });
    }
    // If page is available, Apply pagination
    if (opts.page && limit !== 'all' && !opts.queryLanguage) {
      const skip = { $skip: opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0 };
      pipeline.push(skip);
    }

    if (opts.tableSort && opts.sortBy) { 
      let sortBy = opts.sortBy;
      if (sortBy === 'type') {
        sortBy = 'typeData.name';
      }
      if (sortBy === 'lead') {
        sortBy = 'lead.displayName';
      }
    
      let pipelineAddFields = [];
      let sortOptions;
    
      if (!defaultColumns.some(obj => obj.field === opts.sortBy) && !['createdAt', 'leads', 'updatedAt'].includes(opts.sortBy)) {
        // Sorting by custom fields within customFieldMap
        pipelineAddFields.push({
          $addFields: {
            [opts.sortBy]: `$customFieldMap.${opts.sortBy}`
          }
        });
        sortOptions = { $sort: { [opts.sortBy]: opts.tableSort} };
      } else {
        // Sorting by standard fields
        sortOptions = { $sort: { [sortBy]: opts.tableSort} };
      }
    
      pipelineAddFields.push(sortOptions);
      pipeline.push(...pipelineAddFields);
    }

    countPipeline.push({ $group: { _id: null, count: { $sum: 1 } }});

    const [projectAggregation, projectCountAggregation] = [Project.aggregate(pipeline), Project.aggregate(countPipeline)];
    projectAggregation.options = projectCountAggregation.options = { allowDiskUse: true };
    Promise.allSettled([projectAggregation.exec(), projectCountAggregation.exec()]).then((aggregationResponses) => {
      const [projectData, countData] = aggregationResponses.filter((res) => res.status === 'fulfilled').map((res) => res.value);
      const errors = aggregationResponses.filter((res) => res.status === 'rejected');
      if (errors.length) {
      // 1.a If error, reject with error
        logger.error(errors, 'ERROR_DB_FIND_PROJECT_DETAILS');
        reject({
          message: 'Internal Server Error',
          code: 500,
          error: 'ERROR_DB_FIND_PROJECT_DETAILS',
        });
      }
      if (projectData && projectData.length) {
        let count = projectData.length;
        if (Array.isArray(countData) && countData.length) {
          count = countData[0].count ? countData[0].count : 0;
        }
        // 1.b. Project data found, resolve with data
        if (opts && opts.queryLanguage) {
          filterProjectByQueryLanguage(projectData, opts).then((qProjects) =>{
            const allP = qProjects.length ? _.filter(qProjects, ['isDeleted', false]) : _.filter(finalArr, ['isDeleted', false]);
            const finalP = _.filter(allP, 'createdAt');
            if (opts.page) {
              const skip = opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0;
              const slicedP = finalP.slice(skip).slice(0, opts.perPage);
              resolve({
                projects: slicedP,
                totalCount: finalP.length,
              });
            } else {
              resolve({
                projects: finalP,
                totalCount: finalP.length,
              });
            }
          }).catch(() => {
            resolve({
              projects: projectData,
              totalCount: count,
            });
          });
        } else {
          resolve({
            projects: projectData,
            totalCount: count,
          });
        }
      } else {
        // 1.c Project data empty, resolve it
        resolve({
          projects: [],
          totalCount: 0,
        });
      }
    });
  });
}

/**
 * Update old Scope 1 project collaborators in DB
 * @return {Promise} Resolved when the old Scope 1 project collaborators has been updated.
 */
function updateOldProjectsCollaborators() {
  return new Promise(async (resolve, reject) => {
    // Get all projects from DB
    try {
      const query = Project.find();
      const data = await query.exec();
      if (data) {
        // 1.b. Project data found, update collaborators
        async.forEachOf(data, (item, key, callback) => {
          const pData = item;
          const pCollaborators = [];
          console.log(pData, pData?.collaborators?.length)
          if (pData.collaborators && pData.collaborators.length > 0) {
            async.forEachOf(pData.collaborators, (cl, key2, callback2) => {
              const clData = cl;
              if (clData.wWID === undefined && clData.type === 'user') {
                const query2 = Jjed.findOne({
                  emailAddress: `${clData.name}@its.jnj.com`,
                });
                query2.exec((uErr, uData) => {
                  if (uErr) {
                    logger.error(uErr, 'ERROR_DB_UPDATE_PROJECT_COLLABORATORS');
                    callback2(uErr);
                  }
                  if (uData) {
                    clData.wWID = uData._id;
                    pCollaborators.push(clData);
                    callback2();
                  } else {
                    const clErr = {
                      name: clData.name,
                      displayName: clData.displayName,
                      projectID: pData.projectID,
                      err: uErr,
                    };
                    logger.error(clErr, 'ERROR_DB_UPDATE_PROJECT_COLLABORATORS');
                    callback2(uErr);
                  }
                });
              } else {
                pCollaborators.push(clData);
                callback2();
              }
            }, async (err) => {
              if (err) {
                logger.error(err, 'ERROR_DB_UPDATE_PROJECT_COLLABORATORS');
                callback(err);
              } else if (pCollaborators.length > 0) {
                const filter = {
                  projectID: pData.projectID,
                };
                const update = {
                  $set: {
                    collaborators: pCollaborators,
                  },
                };
                try {
                  await Project.findOneAndUpdate(
                    filter,
                    update,
                    { new: true, strict: true, runValidators: true });
                  callback();
                } catch (err) {
                   // 1.a Project collaborators updation in DB failed
                   logger.error(err, 'ERROR_DB_UPDATE_PROJECT_COLLABORATORS');
                   callback(err);
                }
              }
            });
          } else {
            callback()
          }
        }, (err) => {
          if (err) {
            logger.error(err, 'ERROR_DB_UPDATE_PROJECT_COLLABORATORS');
            reject({
              message: 'Error in updating project collaborators',
              code: 400,
              error: 'ERROR_DB_UPDATE_PROJECT_COLLABORATORS',
            });
          } else {
            resolve({ message: 'Projects collaborators updated successfully', code: 200 });
          }
        });
      } else {
        // 1.c If error, reject with error
        logger.error(findErr, 'ERROR_DB_UPDATE_PROJECT_COLLABORATORS');
        return reject({
          message: 'Error in finding project data',
          code: 404,
          error: 'ERROR_DB_UPDATE_PROJECT_COLLABORATORS',
        });
      }
    } catch (findErr) {
      // 1.a If error, reject with error
      logger.error(findErr, 'ERROR_DB_UPDATE_PROJECT_COLLABORATORS');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_UPDATE_PROJECT_COLLABORATORS',
      });
    }
  });
}

/**
 * Get multi level direct reports for given ids
 *
 * @method getMultiLevelDirectReports
 * @param {Array} ids The direct reports ids.
 * @return {Promise} Resolved when the multi level direct reports has been retrieved.
 */
function getMultiLevelDirectReports(ids) {
  return new Promise((resolve, reject) => {
    const result = [];
    async.forEachOf(ids, (id, key, callback) => {
      jiraUserServices.getJjedsData(id).then((jRes) => {
        const directReports = jRes && jRes.length && jRes[0].directReports.map((each) => { return each._id; }) || [];
        Array.prototype.push.apply(result, directReports);
        return callback();
      }, (jErr) => {
        return callback(jErr);
      });
    }, (err) => {
      if (err) {
        try {
          const errorObj = JSON.parse(err);
          reject(errorObj);
        } catch (e) {
          reject(err);
        }
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Get all direct reports tree for given ids
 *
 * @method getAllDirectReportsTree
 * @param {Array} ids The direct reports ids.
 * @return {Promise} Resolved when all the direct reports tree for given ids has been retrieved.
 */
function getAllDirectReportsTree(ids) {
  const finalDRs = [];
  return getMultiLevelDirectReports(ids)
    .then((directReports) => {
      if (directReports.length > 0) {
        Array.prototype.push.apply(finalDRs, directReports);
        return getAllDirectReportsTree(directReports)
          .then((nextDR) => {
            Array.prototype.push.apply(finalDRs, nextDR);
            return finalDRs;
          });
      }
      return finalDRs;
    }); 
}

/**
 * Get all direct reports tree for given ids
 *
 * @method getAllDirectReportsDetails
 * @param {Array} ids The direct reports ids (wWIDs).
 * @param {Boolean} [includeCurrent] Include current user.
 * @return {Promise.<[{id: string, username: string, email: string}]>|Error} Resolved when all the direct reports tree for given ids has been retrieved.
 */
function getAllDirectReportsDetails(ids, includeCurrent) {
  const finalDRs = [];
  const count = ids.length;
  return getMultiLevelUserDetails(ids, includeCurrent)
    .then(async (directReports) => {
      if (directReports.length > 0) {
        Array.prototype.push.apply(finalDRs, directReports);
        const ids = directReports.map(dr => dr.id) || [];
        if (includeCurrent) {
          ids.splice(0, count);
        }
        return getAllDirectReportsDetails(ids, false)
          .then((nextDR) => {
            Array.prototype.push.apply(finalDRs, nextDR);
            return finalDRs;
          });
      } else if (directReports.length === 0 && includeCurrent) {
        const dbRes = await User.find({ wWID: { $in: ids } }).select({ id: '_id', username: 1, email: 1 }).lean();
        if (dbRes && dbRes.length) {
          Array.prototype.push.apply(finalDRs, [...dbRes]);
        }
      }
      return finalDRs;
    });
}

/**
 * Get multi level direct reports for given ids
 *
 * @method getMultiLevelUserDetails
 * @param {Array} ids The direct reports ids.
 * @param {Boolean} [includeCurrent] Include current user.
 * @return {Promise.<Array.<{id: string, username: string, email: string}>>|Error} Resolved when the multi level direct reports usernames has been retrieved.
 */
function getMultiLevelUserDetails(ids, includeCurrent) {
  return new Promise((resolve, reject) => {
    const result = [];
    async.forEachOf(ids, (id, key, callback) => {
      jiraUserServices.getJjedsData(id).then((jRes) => {
        const currentUser = jRes && jRes.length && jRes[0];
        if (currentUser) {
          const directReports = currentUser.directReports.map((each) => ({
            id: each._id,
            email: each.emailAddress,
            username: each.emailAddress && each.emailAddress.split('@')[0],
          })) || [];
          if (includeCurrent) {
            result.unshift({
              id: currentUser._id,
              email: currentUser.emailAddress,
              username: currentUser.emailAddress && currentUser.emailAddress.split('@')[0],
            });
          }
          Array.prototype.push.apply(result, directReports);
        }
        return callback();
      }, (jErr) => {
        return callback(jErr);
      });
    }, (err) => {
      if (err) {
        try {
          const errorObj = JSON.parse(err);
          reject(errorObj);
        } catch (e) {
          reject(err);
        }
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * @private
 * @method syncProjectsWithGroup
 * @description If Guest group: JnJ Employees should have guest access to all projects.
 * 
 * @param {Object} opts Group sync options
 * @param {String} opts.name Group name
 * @param {Number} opts.gitlabAccessLevel Gitlab access level, Default: Guest - 10
 * @param {String} opts.alfrescoAccessLevel Gitlab access level, Default: Consumer
 * @return {Promise.<{ code: Number, message: String, body?: Object, error?: Object }>} Resolved when projects is synced with guest group.
 */
function syncProjectsWithGroup(opts) {
  return new Promise((resolve, reject) => {
    // 1. Search for Guest group.
    Group.findOne({ name: opts.name }).then((group) => {
      // 1.a Check if gitlab groupId is linked with the group.
      if (group && group.gitlabId && group.alfrescoId) {
        const { gitlabId, alfrescoId } = group;
        // 2. Search for projects which doesn't have guest group linked.
        const filter = {
          $or: [
            { 'gitlab.groupId': { $ne: gitlabId } },
            { 'alfresco.groupId': { $ne: alfrescoId } },
          ]
        };
        Project.find(filter).then((pRes) => {
          // 2.a IF: Add projects to guest group.
          if (pRes && pRes.length) {
            // 3. Share project with Guest group.
            const gitlabPIds = pRes.map(project => project.gitlab.projectId);
            addProjectsToGitlabGroup(gitlabId, gitlabPIds, opts.gitlabAccessLevel || GITLAB.ACCESS_LEVEL.REPORTER).then((gRes) => {
              // 3.a Project shared with gitlab group.
              const gitlabProjects = gitlabPIds.filter(project => [...gRes.body].includes(project));
              const alfrescoPIds = pRes
                .filter(project => gitlabProjects.includes(project.gitlab.projectId))
                .map(project => project.alfresco.nodeId);
              // 4. Share projects linked with gitlab group with alfresco group.
              addProjectsToAlfrescoGroup(alfrescoId, alfrescoPIds, opts.alfrescoAccessLevel || ALFRESCO.ACCESS_LEVEL.CONSUMER).then(async (aRes) => {
                // 4.a Projects shared with alfresco group.
                const alfrescoProjects = alfrescoPIds.filter(project => [...aRes.body].includes(project));
                const projects = pRes
                  .filter(project => alfrescoProjects.includes(project.alfresco.nodeId))
                  .map(project => project._id);

                const projectFilter = { _id: { $in: projects } };
                const projectUpdate = {
                  $addToSet: {
                    'gitlab.groupId': gitlabId,
                    'alfresco.groupId': alfrescoId,
                  }
                };
                try {
                  const projectRes = await Project.updateMany(projectFilter, projectUpdate, { new: false, strict: true, runValidators: true });
                  // 5.b Project type has been successfully updated to db
                  return resolve({ message: 'Projects synced with group', code: 201, body: projectRes});
                } catch (projectErr) {
                  // 5.a Project type updation in DB failed
                  logger.error(projectErr, 'ERROR_DB_UPDATE');
                  reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE_PROJECTS' });
                }
                
              }).catch((aErr) => {
                // 4.b Failed to add group in alfresco project.
                reject(aErr)
              });
            }).catch((gErr) => {
              // 4.a Failed to share project with group.
              reject(gErr);
            });
          } else {
            // 2.a ELSE: Projects already linked with guest group.
            resolve({ message: 'Projects already linked to guest group.', code: 200 });
          }
        }).catch((pError) => {
          // 2.b Failed to fetch project list.
          logger.error('ERROR_FIND_DB_PROJECTS', pError);
          reject({ message: 'Failed to fetch projects', code: 500, error: 'ERROR_FIND_DB_PROJECTS' });
        })
      } else {
        // 1.b Failed: Gitlab groupId is not linked with scope guest group.
        logger.error('ERROR_FIND_GUEST_GROUP');
        reject({ message: 'Failed to fetch guest group details.', code: 404, error: 'ERROR_FIND_GUEST_GROUP' });
      }
    }).catch((error) => {
      // 1.b Failed to fetch Guest group.
      logger.error('ERROR_FIND_GUEST_GROUP', error);
      reject({ message: 'Failed to fetch guest group', code: 500, error: 'ERROR_FIND_GUEST_GROUP' });
    });
  });
}

/**
 * @private
 * @method unlinkGitlabProjectWithGroup
 * @description If Guest group: JnJ Employees should have guest access to all projects.
 * 
 * @param {Object} opts Group sync options
 * @param {String} opts.name Group name
 * @return {Promise.<{ code: Number, message: String, body?: Object, error?: Object }>} Resolved when projects is synced with guest group.
 */
function unlinkGitlabProjectWithGroup(opts) {
  return new Promise((resolve, reject) => {
    Group.findOne({ name: opts.name }).then((group) => {
      // 1.a Check if gitlab groupId is linked with the group.
      if (group && group.gitlabId) {
        const { gitlabId } = group;
        // 2. Search for projects which doesn't have guest group linked.
        const filter = {
          $or: [
            { 'gitlab.groupId': { $eq: gitlabId } },
          ]
        };
        Project.find(filter).then((pRes) => {
          // 2.a IF: unlink projects to guest group.
          if (pRes && pRes.length) {
            // 3. unlink project with Guest group.
            const gitlabPIds = pRes.map(project => project.gitlab.projectId);
            unlinkProjectsToGitlabGroup(gitlabId, gitlabPIds).then((uGRes) => {
              const gitlabProjects = gitlabPIds.filter(project => [...uGRes.body].includes(project));
              addProjectsToGitlabGroup(gitlabId, gitlabProjects, opts.gitlabAccessLevel || GITLAB.ACCESS_LEVEL.REPORTER).then((gRes) => {
                resolve(gRes);
              }).catch((gErr) => {
                // 4.a Failed to share project with group.
                reject(gErr);
              });
            }).catch((uGErr) => {
              // 4.a Failed to share project with group.
              reject(uGErr);
            });
          } else {
            // 2.a ELSE: Projects already linked with guest group.
            resolve({ message: 'Projects already unlinked to guest group.', code: 200 });
          }
        }).catch((pError) => {
          // 2.b Failed to fetch project list.
          logger.error('ERROR_FIND_DB_PROJECTS', pError);
          reject({ message: 'Failed to fetch projects', code: 500, error: 'ERROR_FIND_DB_PROJECTS' });
        })
      } else {
        // 1.b Failed: Gitlab groupId is not linked with scope guest group.
        logger.error('ERROR_FIND_GUEST_GROUP');
        reject({ message: 'Failed to fetch guest group details.', code: 404, error: 'ERROR_FIND_GUEST_GROUP' });
      }
    }).catch((error) => {
      // 1.b Failed to fetch Guest group.
      logger.error('ERROR_FIND_GUEST_GROUP', error);
      reject({ message: 'Failed to fetch guest group', code: 500, error: 'ERROR_FIND_GUEST_GROUP' });
    });
  });
}

/**
 * @private
 * @method unlinkProjectsToGitlabGroup
 * @description unlink project with gitlab
 * 
 * @param {Array.<string>} gitlabGId The gitlab group ID
 * @param {Array.<string>} data The gitlabProjectId of the project.
 * @return {Promise.<{ body: string[]]}> | Error} Resolved when the project has been unlinked in GitLab
 */
function unlinkProjectsToGitlabGroup(gitlabGId, data) {
  return new Promise((resolve, reject) => {
    const result = [];
    const errors = [];
    async.eachOfLimit(data, REQUEST_THROTTLE_LIMIT, (projectId, key, callback) => {
      gitlabProjectServices.unlinkProjectWithGroup(projectId, gitlabGId).then((gRes) => {
        if (gRes) {
          result.push(projectId);
        }
        callback();
      }, () => {
        errors.push(projectId); // Don't resolve async callback in case of error.
        callback();
      });
    }, (err) => {
      if (err) {
        try {
          const errorObj = JSON.parse(err);
          resolve({
            message: 'Faliled to unlink projects with gitlab group.',
            code: 207,
            gitlabErr: errorObj,
          });
        } catch (e) {
          resolve({
            message: 'Faliled to unlink projects with gitlab group.',
            code: 207,
            gitlabErr: err,
          });
        }
      } else {
        result && result.length ? resolve({
          message: 'Project unlink with groups.',
          code: 200,
          body: result,
        }) : reject({
          message: `Failed to unlink ${errors.join(', ')} projects to gitlab group.`,
          code: 409,
          body: errors
        });
      }
    });
  });
}

/**
 * @private
 * @method addProjectsToGitlabGroup
 * @description Share project with gitlab
 * 
 * @param {Array.<string>} gitlabGId The gitlab group ID
 * @param {Array.<string>} data The gitlabProjectId of the project.
 * @param {number} [accessLevel] Access level of project members
 * @return {Promise.<{ body: string[]]}> | Error} Resolved when the project members has been added in GitLab
 */
function addProjectsToGitlabGroup(gitlabGId, data, accessLevel = GITLAB.ACCESS_LEVEL.REPORTER) {
  return new Promise((resolve, reject) => {
    const result = [];
    const errors = [];
    async.eachOfLimit(data, REQUEST_THROTTLE_LIMIT, (projectId, key, callback) => {
      gitlabProjectServices.shareProjectWithGroup(projectId, gitlabGId, accessLevel).then((gRes) => {
        if (gRes && gRes.body) {
          result.push(projectId);
        }
        callback();
      }, () => {
        errors.push(projectId); // Don't resolve async callback in case of error.
        callback();
      });
    }, (err) => {
      if (err) {
        try {
          const errorObj = JSON.parse(err);
          resolve({
            message: 'Faliled to share projects with gitlab group.',
            code: 207,
            gitlabErr: errorObj,
          });
        } catch (e) {
          resolve({
            message: 'Faliled to share projects with gitlab group.',
            code: 207,
            gitlabErr: err,
          });
        }
      } else {
        result && result.length ? resolve({
          message: 'Project shared with groups.',
          code: 200,
          body: result,
          count: result.length || 0,
        }) : reject({
          message: `Failed to share ${errors.join(', ')} projects to gitlab group.`,
          code: 409,
          body: errors
        });
      }
    });
  });
}

/**
 * @private
 * @method addProjectsToAlfrescoGroup
 * @description Share project with alfresco group.
 * 
 * @param {Array.<string>} alfrescoGId The alfresco group ID
 * @param {Array.<string>} data The gitlabProjectId of the project.
 * @param {number} [accessLevel] Access level of project members
 * @return {Promise.<{ body: string[]]}> | Error} Resolved when the project members has been added in GitLab
 */
function addProjectsToAlfrescoGroup(alfrescoGId, data, accessLevel = ALFRESCO.ACCESS_LEVEL.CONSUMER) {
  return new Promise((resolve, reject) => {
    const result = [];
    const errors = [];
    async.forEachOf(data, (projectId, key, callback) => {
      alfrescoProjectServices.shareProjectWithGroup(projectId, alfrescoGId, accessLevel).then((aRes) => {
        if (aRes && aRes.body) {
          result.push(projectId);
        }
        callback();
      }, () => {
        errors.push(projectId); // Don't resolve async callback in case of error.
        callback();
      });
    }, (err) => {
      if (err) {
        try {
          const errorObj = JSON.parse(err);
          resolve({
            message: 'Failed to share projects with alfresco group.',
            code: 207,
            gitlabErr: errorObj,
          });
        } catch (e) {
          resolve({
            message: 'Failed to share projects with alfresco group.',
            code: 207,
            gitlabErr: err,
          });
        }
      } else {
        result && result.length ? resolve({
          message: 'Project shared with groups.',
          code: 200,
          body: result,
          count: result.length || 0,
        }) : reject({
          message: `Failed to share ${errors.join(', ')} projects to alfresco group.`,
          code: 409,
          body: errors
        });
      }
    });
  });
}

/**
 * Check if user has access to the project
 * @param {{ projectId: string }} opts query params
 * @param {*} user jwt/user details
 * @returns Promise<{ message: string, code: number, success: boolean, data: boolean }>
 */
async function checkProjectAccess(opts, user) {
  try {
    const result = await Project.aggregate([
      { $match: { projectID: opts.projectId } },
       {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },

      // 🔵 NEW: Add SMMC flag
      {
        $addFields: {
          isSMMC: {
            $eq: [{ $toLower: '$category.name' }, 'smmc']
          }
        }
      },
      {
        $lookup: {
          from: 'groups',
          localField: 'collaborators.name',
          foreignField: 'name',
          as: 'groups'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'groups.members._id',
          foreignField: '_id',
          as: 'groupUsers'
        }
      },
      {
        $match: {
          $or: [
            // ✅ If NOT SMMC → use existing access logic
            {
              $and: [
                { isSMMC: false },
                {
                  $or: [
                    { 'lead.userName': { $regex: user.username, $options: 'i' } },
                    { 'collaborators.name': { $regex: user.username, $options: 'i' } },
                    { 'collaborators.userName': { $regex: user.username, $options: 'i' } },
                    { 'groupCollaborators': { $in: [user.username] } },
                  ]
                }
              ]
            },
            // ✅ If SMMC → ONLY leads allowed
            {
              $and: [
                { isSMMC: true },
                {
                  $or: [
                    { 'lead.userName': { $regex: user.username, $options: 'i' } },
                    { 'collaborators.userName': { $regex: user.username, $options: 'i' } },
                    { 'leads.name': { $regex: user.username, $options: 'i' } },
                  ]
                }
              ]
            }

          ]
        }
      }
    ]).allowDiskUse(true);
    return result.length
      ? { canAccess: true, message: 'User can access the project.', success: true, code: 200 }
      : { canAccess: false, message: 'Permission denied.', success: false, code: 403 };

  } catch (error) {
    logger.error('ERROR_FIND_USER_PROJECT_ACCESS', error);
    return { canAccess: false, message: 'Something went wrong', success: false, code: 500 };
  }
}

function updateScopeVersionControlLink(opts, auth) {
  return new Promise(async (resolve, reject) => {
    try {
      let gitlab = {};
      if (opts.payload.type === 'Existing') {
        const isGitRepoLinkIsThereInProjectCollection = await Project.findOne({ "gitlab.sdsForgeImportLink":opts.payload.link}).lean();
        if (isGitRepoLinkIsThereInProjectCollection?.gitlab && Object.keys(isGitRepoLinkIsThereInProjectCollection.gitlab)?.length) {
          gitlab = { ...isGitRepoLinkIsThereInProjectCollection?.gitlab, status: 'Existing' }
        } else {
          let gitNotExist = {
            projectUrl: opts.payload.link,
            projectId: null,
            sdsForgeImportLink: opts.payload.link,
            groupId: null,
            status: 'Existing'
          };
          logger.info('NOTEXIST_REPO_LINK',gitNotExist);
          gitlab = { ...gitNotExist, status: 'Existing' }
        }
      } else if (opts.payload.type === 'New') {
        try {
          const gitlabData = await createVersionControlProjects({ projectID: opts.projectId }, auth);
          if (gitlabData?.data?.gitlab) {
            gitlab = gitlabData?.data?.gitlab;
          } else {
            logger.error('FAILED_TO_CREATE_SCOPE_VERSION_CONTROL_LINK');
            return reject({
              code: 403,
              success: false,
              message: 'Failed to create scope version control link'
            })
          }
        } catch (error) {
          return reject(error)
        }
      } else {
        gitlab = { status: 'None' };
      }
      try {
        const pRes = await Project.findOneAndUpdate({projectID: opts.projectId}, { $set: { gitlab } }, { new: true, strict: true, runValidators: true }).lean();
        return resolve({
          code: 200,
          success: true,
          message: 'Scope Version Control Link Updated Successfully',
          data: pRes,
        });
      } catch (pErr) {
        logger.error('ERROR_FAILED_TO_SCOPE_VERSION_CONTROL_LINK', pErr);
        return reject({
          code: 400,
          success: false,
          message: 'Failed to update scope version control link',
        });
      }
    } catch (error) {
      logger.error('ERROR_FAILED_TO_SCOPE_VERSION_CONTROL_LINK', error);
      return reject({
        code: 400,
        success: false,
        message: 'Failed to update scope version control link',
      });
    }
  })
}

function transferSMMProjectToSMH(opts, auth) {
  return new Promise(async (resolve, reject) => {
    const projectId = opts?.projectId?.split('-')[1];
    try {
      // find the category with the name 'SMH'
      const smhCategory = await Category.findOne({ name: 'SMH' }).lean();
      if (!smhCategory?._id) {
        return {
          code: 400,
          message: 'Category SMH not found.',
          error: 'CATEGORY_NOT_FOUND'
        };
      }
      const smhType = await Type.findOne({ name: 'Case Study', categoryId: smhCategory?._id }).lean();
      if (!smhType?._id) {
        return reject({
          code: 400,
          message: 'Case Study Template not found',
          error: 'CASE_STUDY_TEMPLATE_NOT_FOUND'
        });
      }
      const dbRes = await getProjectDetailsFromDB(projectId)
      let updatedAttr2 = []
      try {
        updatedAttr2 = await mergeAndValidateAttributes(smhType?.attributes, dbRes?.customFields);
      } catch (error) {
        logger.error(error?.message  || 'SMMC Custom Fields not matched with the SMH.');
        return reject({
          code: 400,
          message: error?.message || 'SMMC Custom Fields not matched with the SMH.',
          error: 'SMM_Custom_Fields_NOT_MATCHED_WITH_SMH_TYPE'
        });
      }
      const { name, displayName, description, lead, leads, startDate, endDate, status, priority, collaborators, requestMeta, gitVersionControl, gitRepoLink } = dbRes || {}
      const typeData = {
        id: smhType?._id,
        name: smhType?.name,
      };
      const opts = {
        name: name,
        displayName,
        description,
        lead,
        leads: leads || [],
        categoryId: smhCategory?._id,
        startDate,
        endDate,
        typeData,
        importProjectCustomType: smhType?.name,
        customFields: updatedAttr2,
        status,
        priority,
        collaborators,
        requestMeta,
        gitVersionControl,
        gitRepoLink
      }
      const smhProj = await createProject({ project: opts }, auth);
      return resolve({ code: 200, message: smhProj?.message, projectId: smhProj?.id, success: true });
    } catch (error) {
      logger.error('ERROR_FAILED_TO_CREATE_SMH_PROJECT', error);
      return reject({
        code: 400,
        success: false,
        message: 'Failed to Create the SMH Project',
      });
    }
  })
}

function mergeAndValidateAttributes(sourceAttributes, targetAttributes) {
  return new Promise((resolve, reject) => {
    const mergedAttributes = [];

    for (const sourceAttr of sourceAttributes) {
      const normalizedSourceName = sourceAttr.name.toLowerCase() === 'workplace' 
        ? 'sharepoint/onedrive url (workspace)' 
        : sourceAttr.name.toLowerCase();
      
      const matchingTargetAttr = targetAttributes.find(
        (targetAttr) => targetAttr?.name?.toLowerCase() === normalizedSourceName && targetAttr?.type === sourceAttr?.type
      );

      const mergedAttr = { ...sourceAttr };

      if (matchingTargetAttr) {
        const targetValue = matchingTargetAttr.value;

        // Validate DROPDOWN type
        if (sourceAttr.type === 'DROPDOWN' && !['-', 'N/A', '', ' '].includes(targetValue) && !sourceAttr.values.includes(targetValue)) {
          return reject({
            message: `Validation failed for '${sourceAttr.name}': '${targetValue}' is not an allowed value.`,
          });
        }

        // Validate LIST type
        if (
          sourceAttr.type === 'LIST' &&
          !['-', 'N/A', '', ' '].includes(targetValue) &&
          sourceAttr.values.findIndex((item) => item?.PreferredName?.toLowerCase() === targetValue?.toLowerCase()) === -1
        ) {
          return reject({
            message: `Validation failed for '${sourceAttr.name}': '${targetValue}' is not in the list.`,
          });
        }

        // Validate LISTMANY and DROPDOWNLISTMANY types
        if (
          ['LISTMANY', 'DROPDOWNLISTMANY'].includes(sourceAttr.type) &&
          !['-', 'N/A', '', ' '].includes(targetValue) &&
          !targetValue?.split(', ').every((val) => 
            sourceAttr.values.some((item) => item?.PreferredName?.toLowerCase() === val.toLowerCase())
          )
        ) {
          return reject({
            message: `Validation failed for '${sourceAttr.name}': One or more selected values are not in the allowed list.`,
          });
        }

        mergedAttr.value = targetValue || '';
      }

      mergedAttributes.push(mergedAttr);
    }

    return resolve(mergedAttributes);
  });
}

function addAttachmentsForDRRProjects(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const fileData = await uploadCreateDTRProjectAttachments(opts);
      if (fileData) {
        try {
          await Project.findOneAndUpdate({ displayId: opts.projectId }, { $set: { hasAttachments: true }}, { new: true, strict: true, runValidators: true }).lean();
          return resolve({
            code: 200,
            message: 'Attachments uploaded successfully.'
          })
        } catch (pErr) {
          logger.error(pErr, 'ERROR_IN_UPADING_HAS_ATTACHMENTS_FLAG_IN_PROJECTS');
          return reject({ code: 403, message: 'Attachments updated successfully. Failed to update hasAttachment flag', error: pErr});
        }
      }
    } catch (error) {
      logger.error(error, 'ERROR_IN_UPLOADING_ATTACHMENTS');
      return reject({ code: 403, message: 'Failed to upload Attachments', error});
    }
  })
}

function uploadCreateDTRProjectAttachments(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const s3 = new S3();
      const type = opts?.payload?.type;

      const prefix = process.env.NODE_ENV === 'production' ? 'DTR_Project' : 'DTRrequest_Project';
      const projectPrefix = process.env.NODE_ENV === 'production' ? 'ProjectProduction' : 'ProjectStaging';

      const defaultUploadPath = `${type === 'PROJECT' ? projectPrefix : prefix}/${opts.projectId}/`;

      const files = Array.isArray(opts.payload.files) ? opts.payload.files : [opts.payload.files];

      const uploads = await Promise.all(files.map(async (file, index) => {
        try {
          const content = file.data; // fixed deprecated usage
          const fileName = defaultUploadPath + (file?.name || `attachment-${index}`);

          await s3.upload(fileName, content);
          return true;
        } catch (uploadErr) {
          logger.error(uploadErr, 'Failed to upload File in S3');
          return false;
        }
      }));

      return resolve(uploads);
    } catch (error) {
      logger.error(error, 'ERROR_IN_UPLOADING_DTR_PROJECT_FILES');
      return reject({ code: 403, message: 'Failed to upload dtr project files', error });
    }
  });
}

function getProjectLeadsList(opts) {
  return new Promise(async (resolve, reject) => {
    const pipeline = [
      {
        $match: opts.categoryId ? { categoryId: opts.categoryId } : {},
      },
      {
        $project: {
          leadValue: "$lead.displayName",
          keyValue: {
            $toLower: "$lead.userName"
          },
        },
      },
      {
        $group: {
          _id: null,
          lead: {
            $addToSet: {
              name: "$leadValue",
              key: "$keyValue"
            },
          },
        },
      },
    ];
    try {
      const aggregation = Project.aggregate(pipeline);
      aggregation.options = { allowDiskUse: true };
      const pData = await aggregation.exec();
      return resolve({
        code: 200,
        message: 'Leads Data fetched successfully',
        data: pData
      })
    } catch (findErr) {
      return reject({
        code: 400,
        message: 'Failed to fetch leads data',
        error,
      });
    }
  })
}


function importSBOActionHours(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const content = opts?.file?._data;
      const workbook = new ExcelJS.Workbook();

      try {
        await workbook.xlsx.load(content);
        const result = [];

        const sheet = workbook.getWorksheet(1); // Get the first worksheet

        // Get the header row (Assuming first row contains headers)
        const headers = [];
        sheet.getRow(1).eachCell((cell) => {
          headers.push(cell.value);
        });

        // Iterate through rows starting from the second row to get the data
        for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
          const row = sheet.getRow(rowNumber);
          const rowData = {};

          row.eachCell((cell, colNumber) => {
            const columnName = headers[colNumber - 1]; // Map cell to correct header
            rowData[columnName] = cell.value;
          });
          // Extract email and get user details from LDAP
          const email = rowData['Name']?.text || rowData['Name'];
          if (email) {
            try {
              const lData = await dbFulfillerServices.getUserFromLDAP(email);
              if (lData) {
                result.push({
                  user: {
                    userName: lData.username,
                    displayName: lData.name,
                    wWID: lData.wWID,
                  },
                  q1: rowData['Allocated FTE'],
                  role: rowData['Role'],
                });
              } else {
                logger.error(null, `INVALID_USER_${email}_NOT_FOUND_IN_LDAP`);
                return reject({
                  code: 400,
                  message: `Invalid user ${email} not found in ldap`,
                  error: `INVALID_USER_${email}_NOT_FOUND_IN_LDAP`
                });
              }
            } catch (error) {
              logger.error(error, `INVALID_USER_${email}_NOT_FOUND_IN_LDAP`);
              return reject({
                code: 400,
                message: `Invalid user ${email} not found in ldap`,
                error: `INVALID_USER_${email}_NOT_FOUND_IN_LDAP`
              });
            }
          } else {
            logger.error(null, 'EMAILS_NOT_FOUND_IN_EXCEL');
            return reject({
              code: 400,
              message: 'Emails not found in excel',
              error: 'EMAILS_NOT_FOUND_IN_EXCEL'
            });
          }
        }
        // Check if the project exists
      const existingProject = await Project.findOne({ projectID: opts.projectID }).lean();

      if (!existingProject) {
        return reject({
          code: 404,
          error: "PROJECT_NOT_FOUND",
          message: 'Project not found.',
        });
      }
        // Find the project by key and update the actionHours field
        const project = await Project.findOneAndUpdate(
          { projectID: opts.projectID },
          { $set: { actionHours: result } }, // Replace the entire actionHours array
          // { $push: { actionHours: { $each: result } } }, // Add new actionHours to existing array
        );

        if (project) {
          return resolve({
            code: 200,
            message: "Import Data Successfully",
          });
        } else {
          return reject({
            code: 404,
            message: 'Project not found.',
            error: "PROJECT_NOT_FOUND",
          });
        }
      } catch (error) {
        logger.error(error, 'FAILED_TO_READ_EXCEL_DATA');
        return reject({
          code: 400,
          message: 'Failed to read Excel data.',
          error: "FAILED_TO_READ_EXCEL_DATA",
        });
      }
    } catch (error) {
      logger.error(error, 'FAILED_TO_IMPORT_DATA');
      reject({
        code: 400,
        message: "Failed to import data.",
        error: "FAILED_TO_IMPORT_DATA",
      });
    }
  });
}

  /**
 * Export projects for reports as Excel
 *
 * @method exportProjectsToExcel
 * @param {Object} opts The request options sent to the Jira API.
 * @param {String} opts.auth The JIRA auth details of the requesting user.
 * @param {Array} opts.directReports The requesting user direct reports details.
 * @param {String} opts.perPage The projects limit per page.
 * @param {String} opts.query The search term for searching projects.
 * @param {String} opts.showAll To display all projects or not.
 * @return {Promise} Resolved when the projects for reports has been retrieved.
 */
function exportProjectsToExcel(opts) {
  return new Promise((resolve, reject) => {
      // 1 Get all projects
      getProjectsForReports(opts).then((response) =>{
            // Create a new workbook
          const workbook = new ExcelJS.Workbook();
          const worksheet = workbook.addWorksheet('Sheet 1');

            // Set up columns for the worksheet
            worksheet.columns = response.projectHeader.map(col => ({
              header: col.label,
              key: col.field,
              width: parseInt(col.width) / 10 || 20 // Adjust column width
            }));

            // Apply yellow background fill to the first row (header row)
            worksheet.getRow(1).eachCell((cell) => {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFF00' } // Yellow color
              };
              cell.font = {
                bold: true
              };
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
          // Add rows from the data
          response.projectRows.forEach(row => {
              worksheet.addRow(row);
          });

          // Generate the Excel file as a buffer
          workbook.xlsx.writeBuffer()
          .then((buffer) => {
              // Resolve with buffer
              const base64 = buffer.toString('base64');
              return resolve(`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`);
          })
          .catch((err) => {
              // Reject with error
              return reject(err);
          });
      }).catch((err)=>{
        reject(err);
      });
  });
}

function dropdownMany(obj, dropdownManyArr = []) {
    if (obj.value && typeof obj.value !== 'string' && Object.keys(obj.value).length) {
        dropdownManyArr = [...dropdownManyArr, obj.name];
        const value = dropdownMany(obj.value, dropdownManyArr);
        if (value?.value && typeof value.value === 'string') {
            dropdownManyArr = [...dropdownManyArr, value.name, value.value];
        }
    }
    return dropdownManyArr;
}

//for coolaborator
function convertObjectsToString(collaborators) {
    // Check if collaborators is an array
    if (!Array.isArray(collaborators)) {
    logger.error('Expected an array, but got:', collaborators);
    return '';
  }
  // Map each object to a string in the format "Display Name (name)"
  const result = (collaborators || [])?.map(collaborator => `${collaborator.displayName} (${collaborator?.name || collaborator?.userName})`);

  // Join the resulting strings with a comma
  return result.join(', ');
}

// Function to get the value of a nested property
function getNestedPropertyValue(path, obj) {
  const properties = path.split('.');
  let current = obj;

  for (const prop of properties) {
    if (!current || typeof current !== 'object') return "-";
    if (Array.isArray(current)) {
        const results = [];
        for (const item of current) {
            const value = getNestedPropertyValue(prop, item);
            if (value !== undefined) {
                results.push(value);
            }
        }
        current = results.length === 1 ? results[0] : results.join(', ');
    } else {
        current = current[prop];
    }
  }

  return current !== undefined ? current : "-";
}

/**
 * Export projects for reports as HotSheet
 *
 * @method exportProjectsToHotSheet
 * @param {Object} opts The request options sent to the Jira API.
 * @param {String} opts.auth The JIRA auth details of the requesting user.
 * @param {Array} opts.directReports The requesting user direct reports details.
 * @param {String} opts.perPage The projects limit per page.
 * @param {String} opts.query The search term for searching projects.
 * @param {String} opts.showAll To display all projects or not.
 * @return {Promise} Resolved when the projects for reports has been retrieved.
 */
function exportProjectsToHotSheet(opts) {
  return new Promise((resolve, reject) => {
      let defaultColumns = JSON.parse(JSON.stringify(REPORTS_HEADER)); // deep copy from constants
      let uniqueKeys = new Set(defaultColumns.map(column => column.field)); // Define uniqueKeys outside the forEach loop
      let dropdownManyArrValue = [];
      // 1 Get all projects
      getAllDirectReportsProjects(opts).then(async (response) => {
          response.projects.forEach((p) => {
            uniqueKeys = new Set([
              ...uniqueKeys,
              ...Object.keys(p.customFieldMap)
            ]);
          });

          [...uniqueKeys].forEach((uKey) => {
            const defaultColumnIndex = defaultColumns.findIndex((dCol) => dCol.field === uKey);
            if (defaultColumnIndex === -1) {
              defaultColumns.push({ label: uKey, field: uKey})
            }
          });


          //Fetching All Hotsheet Fields
          const hotSheet = await global.services.reports.hotsheetServices.getHotSheetById(opts?.hotsheetId);
          let defaulthotsheet = hotSheet.fields.map(label => {
            const mapping = defaultColumns.find(m => m.label === label);
            return mapping ? mapping.field : null;
          }).filter(field => field !== null); // Filter out any null values in case of no match

          const projectRows = response.projects.map((p) => {
            const obj = { defaultFields: {},customFields:{} };
            Array.from(defaulthotsheet).forEach((uKeys) => {
              if(p.hasOwnProperty(uKeys)){
                let keyValue =  defaultColumns.find((mapping) => mapping.field === uKeys).label || '';;
                  // obj[`${uKeys}`] = p[`${uKeys}`] ? p[`${uKeys}`] : '-';
                  if(uKeys == "lead"){
                    obj['defaultFields'][`${keyValue}`]=  getNestedPropertyValue("displayName",p.lead);
                  }else if(uKeys == "gitlab"){
                    obj['defaultFields'][`${keyValue}`]=  getNestedPropertyValue("projectUrl",p.gitlab);
                  }else if(uKeys == "collaborators"){

                    obj['defaultFields'][`${keyValue}`]=  convertObjectsToString(p.collaborators);
                  }else if(typeof p[`${uKeys}`] === "object"){
                    // For startdate and enddate fields.
                    obj['defaultFields'][`${keyValue}`] = p[`${uKeys}`] ? moment.utc(p[`${uKeys}`]).format('MM/DD/YYYY') : '-';
                  }else{
                    obj['defaultFields'][`${keyValue}`] = p[`${uKeys}`] ? p[`${uKeys}`] : '-';
                  }
              }else{
                obj['customFields'][`${uKeys}`] = p.customFieldMap[uKeys]?.value || '-';
              }
            });
            
            return { ...obj };
          });


            //Document Children Initialisation
            const children = [
              new Paragraph({
                  children: [
                      new TextRun({
                          text: "Hot Sheet",
                          color: "#002F8C",
                          bold: true,
                          heading: HeadingLevel.HEADING_1,
                          size: 40
                      }),
                  ],
                  alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                children: [
                    new TextRun({
                        text: "",
                        break: 1,
                    }),
                ],
                alignment: AlignmentType.CENTER,
            }),
          ];

          if (projectRows?.length) {
            projectRows.map((rowData, index) => {
                const { defaultFields, customFields } = rowData;

                // Appending Default Fields
                const defaultFieldsList = Object.keys(defaultFields)
                if (defaultFieldsList?.length) {
                    defaultFieldsList.map((field, index1) => {
                        children.push(new Paragraph({
                            children: [
                                new TextRun({
                                    text: index1 == 0 ? index + 1 + ')' : '',
                                    size: 22,
                                    bold: true,
                                }),
                                new TextRun({
                                    text: "\t" + field.charAt(0).toUpperCase() + field.slice(1) + ':',
                                    size: 22,
                                    bold: true
                                }),
                                new TextRun({
                                    children: [new Tab(), "\t" + defaultFields[field]],
                                    size: 22
                                }),
                            ],
                            tabStops: [
                                {
                                    type: TabStopType.LEFT,
                                    position: TabStopPosition.LEFT,
                                },
                                {
                                    type: TabStopType.LEFT,
                                    position: 500,
                                },
                                {
                                    type: TabStopType.LEFT,
                                    position: 2500,
                                },
                            ],
                        }))
                    })
                }

                // Adding customFields
                const customFieldsList = Object.keys(customFields)
                if (customFieldsList?.length) {
                    children.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: '',
                                size: 22,
                                bold: true,
                                break: 1
                            }),
                            new TextRun({
                                text: "\t" + 'CustomFields:',
                                size: 22,
                                bold: true
                            }),
                            new TextRun({
                                text: '',
                                break: 1
                            }),
                        ],
                        tabStops: [
                            {
                                type: TabStopType.LEFT,
                                position: TabStopPosition.LEFT,
                            },
                            {
                                type: TabStopType.LEFT,
                                position: 500,
                            },
                        ],
                    }))

                    //Creating table
                    const rows = [
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({
                                        children: [
                                            new TextRun({
                                                text: "\tName",
                                                bold: true,
                                                size: 22,
                                                allCaps: true
                                            })
                                        ]
                                    })],
                                }),
                                new TableCell({
                                    children: [new Paragraph({
                                        children: [
                                            new TextRun({
                                                text: "\tValue",
                                                bold: true,
                                                size: 22,
                                                allCaps: true
                                            })
                                        ]
                                    })],
                                }),
                            ],
                            tableHeader: true,
                        })
                    ]

                    //Adding Rows to the Table
                    customFieldsList.map((rowData) => {
                        rows.push(new TableRow({
                            children: [
                                new TableCell({
                                    children: [new Paragraph({
                                        children: [
                                            new TextRun({
                                                text: ' ' + ' ',
                                                size: 22
                                            }),
                                            new TextRun({
                                                text: rowData || ' ',
                                                size: 22
                                            })
                                        ]
                                    })],
                                }),
                                new TableCell({
                                    children: [new Paragraph({
                                        children: [
                                            new TextRun({
                                                text: ' ' + ' ',
                                                size: 22
                                            }),
                                            new TextRun({
                                                text: customFields[rowData] || ' ',
                                                size: 22
                                            })
                                        ]
                                    })],
                                }),
                            ],
                        }))
                    })

                    //Creating Table
                    children.push(new Table({
                        rows,
                        width: {
                            size: 9000,
                            type: WidthType.DXA,
                        },
                        indent: {
                            size: 500,
                            type: WidthType.DXA,
                        },
                        height: {
                            value: 1000,
                            rule: HeightRule.ATLEAST
                        }
                    }))
                }

                // Adding Break
                if (defaultFieldsList.length || customFieldsList.length) {
                    children.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: '',
                                break: 1
                            }),
                        ],
                    }))
                }
            })
        }

          //Creating Document
          const doc = new Document({
            sections: [
                {
                    properties: {},
                    children
                },
            ],
        });
        // Used to export the file into a .docx file
        Packer.toBuffer(doc).then((buffer) => {
          const base64 = buffer.toString('base64');
          return resolve(`data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`);
        });
      }).catch((err) => {
        // 1.b If error, reject with error
        return reject(err);
      });
  });
}

/**
 * Get All Default Project Filters For Table
 *
 * @method projectTableFilters
 * @param {Object} opts The request options sent to the Jira API.
 * @param {String} opts.auth The JIRA auth details of the requesting user.
 * @param {String} opts.showAll To display all projects or not.
 * @return {Promise} Resolved when the projects for reports has been retrieved.
 */
function projectTableFilters(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const defaultColumns = JSON.parse(JSON.stringify(REPORTS_HEADER)); // deep copy from constants
      const removeColumns = ['displayId', 'displayName', 'type', 'startDate', 'endDate', 'completedAt', 'gitlab'];
      const filter = await filterProjects(opts);
  
      // Only process if the field is not in removeColumns
      if (!removeColumns.includes(opts.field)) {
        const distinctValues = await Project.distinct(opts.field, filter);
        if (opts.field === 'createdBy') {
          const users = await User.find(
            { _id: { $in: distinctValues } },
            { _id: 1, name: 1 }
          ).exec();
          const labeledValues = users
            .map((value) => ({ label: value.name, key: value._id }))
            .sort((a, b) => a.label.localeCompare(b.label));
          return resolve({ field: opts.field, values: labeledValues, value: [] });
        } else if (opts.field === 'priority') {
          const projectPriorityValues = await Project.aggregate([
            { $unwind: '$customFields' },
            { $match: { 'customFields.name': 'Project Priority' } },
            { $group: { _id: '$customFields.value' } },
            { $project: { _id: 0, projectPriorityValues: '$_id' } },
          ]);
          const labeledValues = [
            ...distinctValues,
            ...projectPriorityValues.map((v) => v.projectPriorityValues),
          ].filter(Boolean).map((value) => ({ label: value, key: value }))
            .sort((a, b) => a.label.localeCompare(b.label));
          return resolve({ field: opts.field, values: labeledValues, value: [] });
        } else if (opts.field === 'collaborators' || opts.field === 'lead' || opts.field === 'leads') {
          const labeledValues = distinctValues.map((value) => ({
            label: value.displayName,
            key: value.userName
              ? value.userName.toLowerCase()
              : value.name.toLowerCase(),
          })).sort((a, b) => a.label.localeCompare(b.label));
          return resolve({ field: opts.field, values: removeDuplicates(labeledValues), value: [] });
        } else if (opts.field === 'status') {
          const labeledValues = distinctValues.map((status) => ({ label: status, key: status }))
            .sort((a, b) => a.label.localeCompare(b.label));
          return resolve({ field: opts.field, values: labeledValues, value: [] });
        } else {
          return resolve({ field: opts.field, values: distinctValues, value: [] });
        }
      }
    } catch (error) {
      return reject(error);
    }
  })
}

function projectTableCustomFilters(opts){
  return new Promise(async (resolve, reject) => {
    try{
      const filter = await filterProjects(opts);
  
      // Get customFields distinct values for each field name
      const distinctValues = await Project.aggregate([
          { $match: filter },
          { $unwind: "$customFields" },
          { $match: { "customFields.name": opts.fieldName } },
          { $group: { _id: "$customFields.value" } },
          { $project: { _id: 0, value: "$_id" } }
      ]);
      const labeledValues = distinctValues.map(value => {
        if (isValidDate(value.value)) {
          // If the value is a valid date, return an object with date format 'label' property
          return { label: moment.utc(value.value).format('MM/DD/YYYY'), key: value.value};
        } else {
          // If the value is not a valid date, return an object with both 'label' and 'key' properties
          return { label: value?.value?.trim(), key: value.value };
        }
      });
  
      if(opts.fieldName === "Tags" || opts.fieldName === "R&D Phase" ){
          // Sort the labeledValues array alphabetically by the 'label' property
          const transformedData = Array.from(
            new Set(
              labeledValues?.flatMap(item => item?.label?.split(', ').map(label => label?.trim()))
            )
          ).sort().map(uniqueLabel => ({
              label: uniqueLabel,
              key: uniqueLabel,
            }));
          return resolve({ field: opts.fieldName, values: transformedData ,value:[]});
      } else {
          // Sort the labeledValues array alphabetically by the 'label' property
          labeledValues.sort((a, b) => a.label.localeCompare(b.label));
          return resolve({ field: opts.fieldName, values: labeledValues ,value:[]});
      }
    } catch(error){
      return reject(error)
    }
  });
}

function getProjectsForTileView(opts) {
  return new Promise((resolve, reject) => {
    if (opts.auth.isSuperAdmin || opts.auth.isAdmin || opts.showAll === 'true') {
      // 1 Get all projects
      getAllDirectReportsProjects(opts).then((response) => {
        // 1.a Resolve the resposne
        const tileViewProject = response.projects.map(project => {
        // Initialize custom field value variable
        let compoundValue = null;
        let projectPriority = null;
        let priorityLabel = 'Priority'
        let sponsor = null;
        let customCategory = null;
        let tags = null;

        // Iterate over customFields array to find the value of the custom field
        Object.keys(project.customFieldMap).forEach((cField) => {
          if (cField === 'Project Priority') {
            projectPriority = project.customFieldMap[cField]?.value;
            priorityLabel = 'Project Priority';
          }
          if (cField === 'Sponsor') {
            sponsor = project.customFieldMap[cField]?.value || '-';
          }
          if(cField === 'Compound Name or Number'){
            compoundValue = project.customFieldMap[cField]?.value || '-';
          }
          if(cField === 'Category'){
            customCategory = project.customFieldMap[cField]?.value || '-';
          }
          if(cField === 'Tags'){
            tags = project.customFieldMap[cField]?.value || '-';
          }
        })
      // Construct the tile view project object with the custom field value
          return {
            _id: project._id,
            displayId: project.displayId,
            name: project.displayName,
            description: project.description,
            categoryId: project.categoryId[0],
            templateName: project?.typeData?.name,
            highLevelTags:tags,
            status: project.status,
            priority: projectPriority !== null ? projectPriority : project.priority,
            priorityLabel,
            lead: project.lead,
            leads: project?.leads || [],
            startDate: project.startDate ? moment.utc(project.startDate).format('MM/DD/YYYY') : '-',
            endDate: project.endDate ? moment.utc(project.endDate).format('MM/DD/YYYY') : '-',
            requestMeta: { ...project.requestMeta, createdAt:project.requestMeta.createdAt ? moment.utc(project.requestMeta.createdAt).format('MM/DD/YYYY') : '-', },
            dtrMeta: { ...project.dtrMeta, createdAt:project.dtrMeta.createdAt ? moment.utc(project.dtrMeta.createdAt).format('MM/DD/YYYY') : '-', },
            compoundName: compoundValue !== null ? compoundValue : "-", 
            sponsor: sponsor !== null ? sponsor : "-",
            customCategory: customCategory !== null ? customCategory : "-",
            // Add more fields if needed
          };

        });
      
        resolve({ projects:tileViewProject ,totalCount:response.totalCount });
      }, (err) => {
        // 1.b If error, reject with error
        reject(err);
      });
    } else {
      const ids = opts.directReports ? opts.directReports.split(',') : [];
      const wWID = (opts.auth.wWID && typeof opts.auth.wWID === 'object' && opts.auth.wWID.wWID) ? opts.auth.wWID.wWID : opts.auth.wWID;
      ids.push(wWID);
      getDirectReportsProjectsByUserId(ids, opts).then((response) => {
        // 2.a Resolve the resposne
        const tileViewProject = response.projects.map(project => {
          // Initialize custom field value variable
          let compoundValue = null;
          let projectPriority = null;
          let sponsor = null;
          let customCategory = null;
          let tags = null;
          // Iterate over customFields array to find the value of the custom field
          Object.keys(project.customFieldMap).forEach((cField) => {
            if (cField === 'Project Priority') {
              projectPriority = project.customFieldMap[cField];
            }
            if (cField === 'Sponsor') {
              sponsor = project.customFieldMap[cField];
            }
            if(cField === 'Compound Name or Number'){
              compoundValue = project.customFieldMap[cField];
            }
            if(cField === 'Category'){
              customCategory = project.customFieldMap[cField];
            }
            if(cField === 'Tags'){
              tags = project.customFieldMap[cField]?.value || '-';
            }
          });
        // Construct the tile view project object with the custom field value
            return {
              _id: project._id,
              displayId: project.displayId,
              name: project.displayName,
              description: project.description,
              templateName: project?.typeData?.name,
              categoryId: project.categoryId[0],
              status: project.status,
              priority: projectPriority !== null ? projectPriority : project.priority,
              lead: project.lead,
              startDate: project.startDate ? moment.utc(project.startDate).format('MM/DD/YYYY') : '-',
              endDate: project.endDate ? moment.utc(project.endDate).format('MM/DD/YYYY') : '-',
              requestMeta: { ...project.requestMeta, createdAt:project.requestMeta.createdAt ? moment.utc(project.requestMeta.createdAt).format('MM/DD/YYYY') : '-', },
              dtrMeta: { ...project.dtrMeta, createdAt:project.dtrMeta.createdAt ? moment.utc(project.dtrMeta.createdAt).format('MM/DD/YYYY') : '-', },
              compoundName: compoundValue !== null ? compoundValue : "-", 
              sponsor: sponsor !== null ? sponsor : "-",
              customCategory : customCategory !== null ? customCategory : "-",
              highLevelTags: tags,
              // Add more fields if needed
            };

          });
        
          resolve({ projects:tileViewProject ,totalCount:response.totalCount });
      }, (err) => {
        // 2.b If error, reject with error
        reject(err);
      });
    }
  });
}

async function updateGitlabDetailsToDB(project, currentUser, group) {
  try {
    // Step 1: Resolve GitLab group
    let gitlabGroup = group;
    if (!gitlabGroup?.gitlabId) {
      gitlabGroup = await Group.findOne({ name: constants.GROUPS.GUEST });
    }

    if (!gitlabGroup?.gitlabId) {
      return Promise.reject({
        code: 404,
        message: 'Guest Group not found',
        error: 'ERROR_FIND_GUEST_GROUP'
      });
    }

    // Step 2: Find project in DB
    const existingProject = await Project.findOne({ projectID: project.projectID }).lean();

    if (!existingProject || !existingProject.displayId) {
      return Promise.reject({
        code: 404,
        message: 'Project not found',
        error: 'PROJECT_NOT_FOUND'
      });
    }
    const { displayId, _id } = existingProject;
    // Step 3: Fetch from GitLab
    const gitlabData = await global.services.gitlab.projectServices.getProjectByName(displayId);

    if (gitlabData?.code !== 200 || !Array.isArray(gitlabData.body) || !gitlabData.body[0]) {
      return Promise.reject({
        code: 404,
        message: 'GitLab project not found',
        error: 'GITLAB_PROJECT_NOT_FOUND'
      });
    }

    const gitlabDetails = gitlabData.body[0];

    const gitlabUpdate = {
      projectUrl: gitlabDetails.web_url,
      projectId: gitlabDetails.id,
      sdsForgeImportLink: gitlabDetails.http_url_to_repo,
      status: 'New',
      groupId: [gitlabGroup.gitlabId],
    };

    const filter = { _id: mongoose.Types.ObjectId(_id) };
    const update = { gitlab: gitlabUpdate };

    const updatedProject = await Project.findOneAndUpdate(filter, update, { new: true });

    return Promise.resolve({
      message: `Project (${updatedProject.displayId}) Created Successfully in Gitlab.`,
      code: 201,
      id: updatedProject.projectID,
      key: updatedProject.key,
      displayId: `${updatedProject.displayId}`,
      data: { ...updatedProject.toObject() }
    });

  } catch (error) {
    console.error("Error in updateGitlabDetailsToDB:", error);
    return Promise.reject({
      code: 500,
      message: 'Internal server error',
      error: error?.message || error
    });
  }
}

/**
 * Get projects import list from DB
 * @return {Promise} Resolved when the project has been retrieved.
 */
function getProjectsImportList(opts) {
  return new Promise(async (resolve, reject) => {
    // Get all direct reports projects from DB
    const limit = opts.perPage;
    const filter = await filterProjects(opts);

    const pipeline = [
      { $match: filter },
      { $project: { projectID:1,displayName: 1, type: '$typeData.name', _id: 1 } },
      { $sort: { updatedAt: -1 } },
    ];

    // TODO: Temporary fix to get project count
    let usePagination = false;
    const countPipeline = _.cloneDeep(pipeline);

    if (opts.queryLanguage !== undefined && opts.queryLanguage.indexOf('&') === -1 && opts.queryLanguage.indexOf('|') === -1 && opts.queryLanguage.indexOf('!') === -1 && opts.queryLanguage.indexOf('(') === -1 && opts.queryLanguage.indexOf(')') === -1 && !opts.type) {
      pipeline.push(...[
        // { $sort: { createdAt: -1 } },
        { $skip: opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0 },
        { $limit: opts.perPage },
      ]);
      usePagination = true;
    } else {
      pipeline.push(...[
        // { $sort: { createdAt: -1 } },
        { $skip: 0 },
      ]);
    }

    const countQuery = [
      { $group: { _id: null, count: { $sum: 1 } } },
      { $project: { _id: 0 } }
    ];

    const totalCountPipeline = [...countPipeline, ...countQuery];
    const countAggregation = Project.aggregate(totalCountPipeline);
    const aggregation = Project.aggregate(pipeline);
    aggregation.options = countAggregation.options = { allowDiskUse: true };
    Promise.allSettled([aggregation.exec(), countAggregation.exec()]).then((aggregationResponses) => {
      const errors = aggregationResponses.filter((res) => res.status === 'rejected');
      if (errors.length) {
        console.error(errors);
        // 1.a If error, reject with error
        logger.error('ERROR_DB_FIND_PROJECTS');
        reject({
          message: 'Internal Server Error',
          code: 500,
          error: 'ERROR_DB_FIND_PROJECTS',
        });
      } else {
        const [pData, pCount] = aggregationResponses.map((pRes) => pRes.value);
        if (pData && pData.length) {
          // Get Here, Please
          // 1.b. Project data found, resolve with data
          const projectsData = pData;
          const totalCount = usePagination ? (Array.isArray(pCount) && pCount.length ? (pCount[0].count || 0) : 0) : (projectsData.length || 0);
          filterProjectByQueryLanguage(projectsData, opts).then((qProjects) =>{
            if (qProjects.length && opts.queryLanguage) {
              const skip = opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0;
              const finalP = qProjects.slice(skip).slice(0, opts.perPage);
              resolve({
                projects: finalP,
                totalCount: finalP.length,
              });
            } else if (!qProjects.length && opts.queryLanguage) {
              resolve({
                projects: [],
                totalCount: 0,
              });
            } else {
              resolve({
                projects: projectsData,
                totalCount: totalCount,
              });
            }
          }).catch((err) => {
            resolve({
              projects: projectsData,
              totalCount: totalCount,
            });
          });
        } else {
          // 1.c Project data empty, resolve it
          resolve({
            projects: [],
            totalCount: 0,
          });
        }
      }
    });
  });
}


function exportSBOActionHours(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const actualHoursPipeline = [
        {
          $match: {
            projectID: opts.projectID
          },
        },
        {
          $project: {
            actionHours: 1,
            _id: 0,
          },
        },
        {
          $project: {
            actionHours: {
              $map: {
                input: "$actionHours",
                as: "hour",
                in: {
                  role: "$$hour.role",
                  allocatedFTE: "$$hour.q1",
                  name: {
                    $concat: [
                      "$$hour.user.userName",
                      "@its.jnj.com",
                    ],
                  },
                },
              },
            },
          },
        },
      ]
      const project = await Project.aggregate(actualHoursPipeline);
      if (!project?.length) {
        return reject({
          code: 404,
          error: "PROJECT_NOT_FOUND",
          message: 'Project not found.',
        });
      }
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet 1');

      worksheet.columns = SBO_ACTION_HOURS.map(col => ({
        header: col.label,
        key: col.key,
        width: parseInt(col.width) / 10 || 20,
      }));

      project[0].actionHours.forEach(row => {
          worksheet.addRow(row);
      });

      workbook.xlsx.writeBuffer().then((buffer) => {
        const base64 = buffer.toString('base64');
        return resolve({
          code: 200,
          message: 'Excel file exported successfully.',
          data: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`
        });
      }).catch((err) => {
        logger.error(err, 'FAILED_TO_CREATE_EXCEL_BUFFER');
        return reject({
          code: 400,
          message: 'Failed to create Excel buffer',
          error: 'FAILED_TO_CREATE_EXCEL_BUFFER'
        });
      });
    } catch (error) {
      logger.error(error, 'FAILED_TO_EXPORT_SBO_ACTUAL_HOURS');
      return reject({
        code: 400,
        message: 'Failed to export SBO Actual Hours',
        error: 'FAILED_TO_EXPORT_SBO_ACTUAL_HOURS',
      })
    }
  });
}

function addSBOQuarter(opts,auth) {
  return new Promise(async (resolve, reject) => {
    try {
      //Get the user's department leads
      const usersDepartmentLead = await jiraGroupServices.groupsByUserID(auth._id);
      if(auth.isAdmin || usersDepartmentLead.includes("SBO")){
          // Step 1: Find projects with the category name 'SBO'
          const sboCategory = await Category.findOne({ name: 'SBO' }).lean();
          if (!sboCategory) {
            return reject({
              code: 400,
              message: 'Category SBO not found.',
              error: 'CATEGORY_NOT_FOUND'
            });
          }
      
          //Step 2: Find projects with the matching categoryId
          const sboProjects = await Project.find({ categoryId: sboCategory._id }).lean();
          if (!sboProjects.length) {
            return reject({
              code: 400,
              message: 'SBO Projects Not Found',
              error: 'SBO_PROJECTS_NOT_FOUND'
            });
          }
      
          //Step 3: Extract project IDs
          const projectIds = sboProjects.map(project => project._id);
      
          // Step 4: Update the quarters field for all projects with the categoryId
          const result = await Project.updateMany(
            {
              _id: { $in: projectIds }, // Use the IDs of the filtered projects
              'quarters.quarter': { $ne: opts.quarter } // Ensure quarter is not already present
            },
            {
              $push: {
                quarters: {
                  quarter: opts.quarter,
                  actualFTE: opts?.actualFTE || '',
                  notes: opts?.notes || '',
                }
              }
            }
          );
          // Check for newer MongoDB driver format
          const modifiedCount = result.modifiedCount !== undefined ? result.modifiedCount : result.nModified;
          if (modifiedCount === 0) {
            logger.error(result.modifiedCount, 'QUARTER_ALREADY_EXISTS');
            return reject({
              code: 400,
              message: 'Quarter already exists.',
              error: 'QUARTER_ALREADY_EXISTS'
            });
          }
      
          return resolve({
            code: 200,
            message: 'Quarter Added successfully.',
          });
      } else {
        logger.error(auth.username,'ACCESS_DENIED');
        return reject({
          code: 400,
          message: 'Access Denied: You do not have the required permissions to access this resource.',
          error: 'ACCESS_DENIED'
        });
      }
    } catch (error) {
      logger.error(error,'ERROR_ADDING_SBO_QUARTER');
      return reject({
        code: 400,
        message: 'Failed adding quarter to SBO projects',
        error: 'ERROR_ADDING_SBO_QUARTER'
      });
    }
  })
}

function isSBOSDSLeadOrSponsor(projectDetails, auth) {
  let SDSLead = [];
  const SDSField = projectDetails?.customFields?.find((cf) => cf?.name?.toLowerCase() === 'sds lead')?.value;
  if (SDSField) {
    SDSLead = extractUserNameFromLDAPManyValue(SDSField);
  }

  let sponsor = [];
  const sponsorField = projectDetails?.customFields?.find((cf) => cf?.name?.toLowerCase() === 'sponsor')?.value;
  if (sponsorField) {
    sponsor = extractUserNameFromLDAPManyValue(sponsorField);
  }
  const { username } = auth;
  return projectDetails?.categoryId?.name === 'SBO' && (sponsor.includes(username.toLowerCase()) || SDSLead.includes(username.toLowerCase()));
}

function updateQuarterInProject(opts,auth) {
  return new Promise(async (resolve, reject) => {
    try {
      //Get the user's department leads
      const res = await getProjectById({ projectIdOrKey: opts.projectID });
      const isLead = auth?.username?.toLowerCase() === res?.lead?.userName.toLowerCase();
      const isCollborator = (res?.collaborators || [])?.findIndex((coll) => (coll?.userName || coll?.name)?.toLowerCase() === auth?.username?.toLowerCase()) > -1;
      const isSDSLeadOrSponsor = isSBOSDSLeadOrSponsor(res, auth);
    
      const usersDepartmentLead = await jiraGroupServices.groupsByUserID(auth._id);
      if(auth.isAdmin || usersDepartmentLead.includes("SBO") || isSDSLeadOrSponsor || isCollborator || isLead){
        const { projectID, quarter, actualFTE, notes } = opts;
        let quarters = res?.quarters || [];
        if (res.quarters?.length) {
          const quarterIndex = quarters.findIndex((q) => q.quarter === quarter);
          if (quarterIndex > -1) {
            quarters[quarterIndex] = {
              notes: notes || '',
              actualFTE: actualFTE || '',
              quarter
            };
          }
        } else {
          quarters = [
            {
              notes: notes || '',
              actualFTE: actualFTE || '',
              quarter
            }
          ]
        }
  
        // Update the specific quarter within the project
        const result = await Project.updateOne(
          {
            projectID: projectID,
          },
          {
            $set: {
              'quarters': quarters,
            }
          }
        );
      
        // Check if any documents were matched and modified
        if (result.matchedCount === 0) {
          logger.error('Project or quarter not found','UPDATE_FAILED');
          return reject({
            code: 400,
            message: 'Project or quarter not found',
            error: 'UPDATE_FAILED'
          });
        }
  
        return resolve({
          code: 200,
          message: 'Quarter updated successfully.',
        });
      } else{
        logger.error(auth.username,'ACCESS_DENIED');
        return reject({
          code: 400,
          message: 'Access Denied: You do not have the required permissions to access this resource.',
          error: 'ACCESS_DENIED'
        });
      }
    } catch (error) {
      logger.error(error,'UPDATE_FAILED');
      return reject({
        code: 400,
        message: 'Error updating quarter in project',
        error: 'UPDATE_FAILED'
      });
    }
  });
}

function getCustomFieldValues(opts) {
  return new Promise(async (resolve, reject) => {
    try{
      const { displayId, field } = opts;
  
      // Query to find project by projectID and custom field name
      const project = await Project.findOne({
        displayId: displayId,
        'customFields.name': field  // Match customField by name in the customFields array
      }, {
        'customFields.$': 1  // Use $ projection to only return the matched customField
      });
  
      if (!project || !project.customFields.length) {
        logger.error('FAILED_GET_CUSTOMFIELD_VALUES');
        return reject({
          code: 400,
          message: `Custom field '${field}' not found in project`,
          error: 'FAILED_GET_CUSTOMFIELD_VALUES'
        });
      }
  
      // Extract the custom field
      const customField = project.customFields[0];
      // Return the value of the custom field
      return resolve({
        code: 200,
        data: customField.values,
      });
    } catch(error){
      logger.error(error,'FAILED_GET_CUSTOMFIELD_VALUES');
      return reject({
        code: 400,
        message: 'Error fetching custom field values',
        error: 'FAILED_GET_CUSTOMFIELD_VALUES'
      });
    }
  });
}

function updateProjectField(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const { displayId, field, value, isCFField } = opts;
      let updateQuery = {};
      const extractAndFetchLDAPDetails = async (inputArray) => {
        try {
          // Extract all values inside parentheses
          const extractedValues = inputArray.map(item => {
            const match = item.match(/\(([^)]+)\)/); // Find the value inside parentheses
            return match ? match[1] : null; // Return the matched value or null if no match
          }).filter(Boolean); // Remove any null values
      
          // Fetch LDAP user details for each extracted value
          const ldapDetailsArray = await Promise.all(
            extractedValues.map(async (value) => await LDAPConfig.findUser(value)) // Fetch user from LDAP
          );
      
          return ldapDetailsArray; // Return only LDAP user details
      
        } catch (error) {
          logger.error("Error fetching LDAP user details:", error);
          return resolve([]);
        }
      };
  
  
      if (isCFField) {
        // If isCF is true, update the custom field
        updateQuery = { $set: { 'customFields.$.value': value } };
  
        // Find and update the custom field in the customFields array
        const project = await Project.findOneAndUpdate(
          { displayId: displayId, 'customFields.name': field }, // Match project and custom field name
          updateQuery, // Update the value of the matched custom field
          { new: true, useFindAndModify: false } // Return the updated document
        );
  
        if (!project) {
          logger.error('Project not found or custom field does not exist', 'FAILED_UPDATE_CUSTOMFIELD_VALUE');
          return reject({
            code: 400,
            message: `Custom field '${field}' not found in project`,
            error: 'FAILED_UPDATE_CUSTOMFIELD_VALUE'
          });
        }
  
        return resolve({
          code: 200,
          message:`${field} updated sucessfully`
        });
      } else {
        if(field === "lead"){
         const leadObj = await LDAPConfig.findUser(value);
         const lead = {
          displayName: leadObj.fullName,  
          userName: leadObj.jnjMSUserName,  
          wWID: leadObj.cn 
        };
         updateQuery = { $set: { lead: lead } };
        } else if(field === "collaborators"){
          let collaboratoruserNames = extractAndFetchLDAPDetails(value);
          let collaborators = [];
          
          for (let i = 0; i < collaboratoruserNames.length; i++) {
            const collaboratorObj = {
              name: collaboratoruserNames[i].jnjMSUserName,
              displayName: collaboratoruserNames[i].fullName,
              type: "user"
            };
            collaborators.push(collaboratorObj);
          }
          updateQuery = { $set: { collaborators: collaborators } };
        } else if(field === "createdBy"){
          let collaboratoruserNames = extractAndFetchLDAPDetails(value);
        } else{
          // If isCF is false, update a root-level field
          updateQuery = { $set: { [field]: value } };
        }

        // Find and update the root-level field
        const project = await Project.findOneAndUpdate(
          { displayId: displayId }, // Match project by displayId
          updateQuery, // Update the root-level field
          { new: true, useFindAndModify: false } // Return the updated document
        );
  
        if (!project) {
          logger.error('Project not found', 'FAILED_UPDATE_ROOT_FIELD');
          return reject({
            code: 400,
            message: `Project with displayId '${displayId}' not found`,
            error: 'FAILED_UPDATE_ROOT_FIELD'
          });
        }
  
        // Return the updated root-level field value
        return resolve({
          code: 200,
          message:`${field} updated sucessfully`
        });
      }
    } catch (error) {
      logger.error(error, 'FAILED_UPDATE_PROJECT_FIELD');
      return reject({
        code: 400,
        message: 'Error updating project field',
        error: 'FAILED_UPDATE_PROJECT_FIELD'
      });
    }
  });
}

function updateCaseStudyProject(opts, auth) {
  return new Promise(async (resolve, reject) => {
    if (opts?.payload?.smhApprovalStatus === SMH_CASE_STUDY_STATUS.REJECTED && !opts?.payload?.caseStudyApprovalRejectionReason) {
      return reject({
        status: 400,
        message: 'Please provide a rejection reason to continue.'
      });
    }
    if (opts?.payload?.smhApprovalStatus === SMH_CASE_STUDY_STATUS.APPROVED) {
      opts.payload.caseStudyApprovedBy = auth?._id;
      if (opts?.payload?.status?.toLowerCase() === 'new') {
        // 1. Search for Guest group.
        const group = await Group.findOne({ name: GROUPS.GUEST });
        // Guest group must be linked with Gitlab group.
        if (!(group && group.gitlabId)) {
          return reject({
            code: 404,
            message: 'Guest Group not found',
            error: 'ERROR_FIND_GUEST_GROUP'
          });
        }
        try {
          await createGitlabProject({projectID: opts.projectID}, auth, group);
        } catch (error) {
          if (error?.code === 409) {
            return updateGitlabDetailsToDB({ projectID: opts.projectID }, auth, group);
          } else {
            return reject({ message: 'Error in updating smh project approval status', code: 403, error: 'ERROR_DB_SAVE' });
          }
        }
      }
    }
    const payload = { ...opts.payload };
    delete payload.status;
    try {
      await Project.findOneAndUpdate({ projectID: opts.projectID }, { $set: { ...payload } }, { new: true, strict: true, runValidators: true });
      const dbRes = await getProjectDetailsFromDB(opts?.projectID);
      return resolve({
        status: 200,
        message: 'Project Approved successfully',
        data: dbRes,
      });
    } catch (rErr) {
      logger.error(rErr, 'ERROR_IN_UPDATING_SMH_PROJECT_APPROVAL_STATUS');
      return reject({ message: 'Error in updating smh project approval status', code: 403, error: 'ERROR_DB_SAVE' });
    }
  });
}


export const jiraProjectServices = {
  getAllProjectCategories,
  getProjectCategoryById,
  createProjectCategory,
  updateProjectCategory,
  deleteProjectCategory,
  updateProjectType,
  getCustomProjectTypes,
  getCustomProjectTypesById,
  createCustomProjectType,
  updateCustomProjectType,
  deleteCustomProjectType,
  validateCustomProjectType,
  validateCustomRequestType,
  uploadHtmlCustomProjectType,
  createProject,
  uploader,
  createGitlabProject,
  createVersionControlProjects,
  createAlfrescoProject,
  getAllProjects,
  getAllDirectReportsProjects,
  filterProjects,
  getProjectById,
  updateProject,
  addCollaboratorsToProject,
  deleteProjectCollaborator,
  updateProjectRequestStatus,
  deleteProject,
  deleteProjectPermanent,
  restoreProject,
  getProjectPermissionSchemes,
  assignPermissionScheme,
  getProjectRoles,
  getProjectRoleDetails,
  getStatuses,
  updateProjectStatus,
  addProjectComment,
  deleteProjectComment,
  getProjectComments,
  getTypes,
  importProjects,
  deleteProjectFromDB,
  getDeletedProjectsFromDB,
  getProjectTemplates,
  getProjectsByUserId,
  getProjectDetailsByUserId,
  getProjectsForReports,
  updateOldProjectsCollaborators,
  getAllDirectReportsTree,
  getAllDirectReportsDetails,
  syncProjectsWithGroup,
  unlinkGitlabProjectWithGroup,
  checkProjectAccess,
  updateScopeVersionControlLink,
  transferSMMProjectToSMH,
  addAttachmentsForDRRProjects,
  getProjectLeadsList,
  exportProjectsToExcel,
  exportProjectsToHotSheet,
  projectTableFilters,
  projectTableCustomFilters,
  getProjectsForTileView,
  getProjectsImportList,
  importSBOActionHours,
  exportSBOActionHours,
  addSBOQuarter,
  updateQuarterInProject,
  getCustomFieldValues,
  updateProjectField,
  updateCaseStudyProject,
}
