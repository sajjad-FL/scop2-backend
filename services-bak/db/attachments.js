import fs from "fs";
import path from "path";
import S3 from "../../utils/S3.js";
import { logger } from "./../../utils/logger.js";
import { Project } from "../../models/project.js";
import { uploadCustomFieldsAttachments } from "../../utils/helper.js";
import { DataTransferRequest } from "../../models/data-transfer-request.js";
import { ProjectRequest } from "../../models/project-request.js";


function getAttachmentsById(opts) {
  return new Promise((resolve, reject) => {
    try {
      const s3 = new S3();
      const prefix = process.env.NODE_ENV === 'production' ? 'Requests' : 'ProjectRequest';
      const dtrPrefix = process.env.NODE_ENV === 'production' ? 'DTR' : 'DTRrequest';
      const projectPrefix = process.env.NODE_ENV === 'production' ? 'ProjectProduction' : 'ProjectStaging';
      const dtrProjectPrefix = process.env.NODE_ENV === 'production' ? 'DTR_Project' : 'DTRrequest_Project';
      const folderPath = `${opts?.type === 'PROJECT' ? projectPrefix : opts?.type === 'DTR_PROJECT' ? dtrPrefix : (opts?.type === 'CREATE_DTR_PROJECT' ? dtrProjectPrefix  : prefix) }/${opts.id}/`;
      s3.fetchFilesByFolder(folderPath).then((files) => {
        Promise.allSettled(files)
          .then((pRes) => {
            const files = pRes.filter((fRes) => { return fRes.status === 'fulfilled'; }).map((fRes) => { return fRes.value; });
            return resolve(files);
          })
          .catch((fError) => {
            return reject({
              message: 'Error in finding attachments',
              code: 500,
              error: 'ERROR_IN_FINDING_ATTACHMENTS',
              stackTrace: fError,
            });
          });
      }).catch((error) => {
        return reject({
          message: 'Error in finding attachments',
          code: 500,
          error: 'ERROR_IN_FINDING_ATTACHMENTS',
          stackTrace: error,
        });
      });
    } catch (error) {
      logger.error(error, 'ERROR_IN_FINDING_ATTACHMENTS');
      return reject({
        message: 'Error in finding attachments',
        code: 500,
        error: 'ERROR_IN_FINDING_ATTACHMENTS',
      });
    }
  });
}

function getFilesInFileInputCustomField(opts) {
  return new Promise(async (resolve, reject) => {
    const model = opts.type === 'PROJECT' ? Project : (opts.type === 'REQUEST_PROJECT' ? ProjectRequest : DataTransferRequest);
    const matchElement = opts.type === 'PROJECT' ? { projectID: opts.id } : (opts.type === 'REQUEST_PROJECT' ? { requestID: opts.id } : { dtrID: opts.id });
    try {
      const pRes= await model.findOne(matchElement).lean();
      if (pRes) {
        const data = JSON.parse(JSON.stringify(pRes));
        const s3 = new S3();
        const fileInputIndex = data.customFields.findIndex((cfField) => cfField.name === opts.fieldName && cfField.type === 'FILEINPUT' && cfField?.values?.length);
        if (fileInputIndex > -1) {
          s3.fetchFilesByFolder(data.customFields[fileInputIndex].values[0].link).then((s3Files) => {
            return Promise.allSettled(s3Files)
                .then((pRes) => {
                  const files = pRes.filter((fRes) => { return fRes.status === 'fulfilled'; }).map((fRes) => { return fRes.value; });
                  return resolve({
                    code: 200,
                    message: 'Files fetched successfully',
                    data: files,
                  });
                })
                .catch((fError) => {
                  return reject({
                    code: 400,
                    message: 'Failed to fetch custom files data',
                    error: 'FAILED_TO_FETCH_CUSTOM_FILES_DATA'
                  });
                });
          }).catch((error) => {
            logger.error(error, 'Failed to load data');
            return reject({
              code: 400,
              message: error || error?.message || 'Failed to load data',
            });
          });
        } else {
          return resolve({
            code: 200,
            message: 'No Attachments'
          })
        }
      }
    } catch (pErr) {
      return reject({
        code: 400,
        message: `Error in fetching ${opts.type.toLowerCase()} data`,
        error: `ERROR_IN_FETCHING_${opts.type}_DATA`,
      })
    }
  });
}

function updateFileInFileInputCustomField(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const model = opts.type === 'PROJECT' ? Project : (opts.type === 'REQUEST_PROJECT' ? ProjectRequest : DataTransferRequest);
      const matchElement = opts.type === 'PROJECT' ? { projectID: opts.id } : (opts.type === 'REQUEST_PROJECT' ? { requestID: opts.id } : { dtrID: opts.id });
      const s3FolderNames = opts.type === 'PROJECT' ? 'projects' : (opts.type === 'REQUEST_PROJECT' ? 'requests' : 'drrRequests');
      try {
        const pRes = await model.findOne(matchElement).lean();
        if (pRes) {
          const data = JSON.parse(JSON.stringify(pRes));
          const customFields = [ ...data.customFields ];
          const cfIndex = customFields.findIndex((cField) => cField.name === opts.fieldName && cField.type === 'FILEINPUT');
          if (cfIndex > -1) {
            const existingFilesInputValues = customFields[cfIndex].values;
            const existingFileNames = existingFilesInputValues.map((val) => val.name);
            const newFiles = opts.files.filter((file) => !existingFileNames.includes(file.name));
            try {
              const uploadedData = await uploadCustomFieldsAttachments(s3FolderNames, newFiles, opts.id, customFields[cfIndex].name);
              if (uploadedData?.length) {
                newFiles.forEach((file) => {
                  customFields[cfIndex].values.push({
                    name: file.name,
                    link: `${process.env.NODE_ENV === 'production' ? 'production' : 'staging'}/${s3FolderNames}/${opts.id}/${customFields[cfIndex].name}`
                  });
                });
                const projectData = await model.findOneAndUpdate(matchElement, { customFields }, { new: true, strict: true, runValidators: true });
                return resolve({
                  code: 200,
                  message: 'File Uploaded successfully',
                  data: projectData
                })
              }
            } catch (error) {
              return reject({
                code: 400,
                message: 'Failed to upload attachments in custom fields'
              })
            }
          } else {
            return reject({
              code: 400,
              message: 'Invalid field name',
              error: 'INVALID_FIELD_NAME',
            });
          }
        }
        return reject({
          code: 400,
          message: 'Failed to Update File Input Custom Field',
          error: 'FAILED_TO_UPDATE_FILE_INPUT_CUSTOM_FIELD'
        });
      } catch (pErr) {
        return reject({
          code: 400,
          message: `Error in fetching ${opts.type.toLowerCase()} data`,
          error: `ERROR_IN_FETCHING_${opts.type}_DATA`,
        })
      }
    } catch (error) {
      return reject({
        code: 400,
        message: 'Failed to update attachment',
        error: 'FAILED_TO_UPDATE_ATTACHMENT',
      })
    }
  });
}

function deleteFileInFileInputCustomField(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const model = opts.type === 'PROJECT' ? Project : (opts.type === 'REQUEST_PROJECT' ? ProjectRequest : DataTransferRequest);
      const matchElement = opts.type === 'PROJECT' ? { projectID: opts.id } : (opts.type === 'REQUEST_PROJECT' ? { requestID: opts.id } : { dtrID: opts.id });
      const pRes = await model.findOne(matchElement).lean();
      if (pRes) {
        const data = JSON.parse(JSON.stringify(pRes));
        const customFields = [ ...data.customFields ];
        const s3 = new S3();
        const cfIndex = customFields.findIndex((cField) => cField.name === opts.fieldName && cField.type === 'FILEINPUT');
        if (cfIndex > -1) {
          const valueIndex = customFields[cfIndex].values.findIndex((val) => val.name === opts.fileName);
          if (valueIndex > -1) {
            try {
              const fileName = customFields[cfIndex].values[valueIndex].link + '/' + customFields[cfIndex].values[valueIndex].name;
              await s3.deleteFile(fileName);
              customFields[cfIndex].values.splice(valueIndex, 1);
              const projectData = await model.findOneAndUpdate(matchElement, { customFields }, { new: true, strict: true, runValidators: true });
              return resolve({
                code: 200,
                message: 'File deleted successfully',
                data: projectData,
              });
            } catch (error) {
              return reject({
                code: 400,
                message: 'Failed to delete attachment',
                error: 'FAILED_TO_DELETE_ATTACHMENT'
              });
            }
          } else {
            return reject({
              code: 400,
              message: 'Invalid file name',
              error: 'INVALID_FILE_NAME',
            });
          }
        } else {
          return reject({
            code: 400,
            message: 'Invalid field name',
            error: 'INVALID_FIELD_NAME',
          });
        }
      }
      return reject({
        code: 400,
        message: 'Failed to delete file input custom field',
        error: 'FAILED_TO_DELETE_FILE_INPUT_CUSTOM_FIELD'
      });
    } catch (error) {
      return reject({
        code: 400,
        message: `Error in fetching ${opts.type.toLowerCase()} data`,
        error: `ERROR_IN_FETCHING_${opts.type}_DATA`,
      });
    }
  });
}

function deleteAttachment(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const model = opts.type === 'PROJECT' ? Project : (opts.type === 'REQUEST_PROJECT' ? ProjectRequest : DataTransferRequest);
      const matchElement = opts.type === 'PROJECT' ? { projectID: opts.id?.split('-')?.[1] } : (opts.type === 'REQUEST_PROJECT' ? { requestID: opts.id?.split('-')?.[1] } : { dtrID: opts.id });
      const fileName = opts?.fileName;
      const pRes = await model.findOne(matchElement).lean();
      if (pRes) {
        try {
          const s3 = new S3();
          const prefix = process.env.NODE_ENV === 'production' ? 'Requests' : 'ProjectRequest';
          const dtrPrefix = process.env.NODE_ENV === 'production' ? 'DTR' : 'DTRrequest';
          const dtrProjectPrefix = process.env.NODE_ENV === 'production' ? 'DTR_Project' : 'DTRrequest_Project';
          const ProjectPrefix = process.env.NODE_ENV === 'production' ? 'ProjectProduction' : 'ProjectStaging';
          const folderPath = `${ opts?.type === 'PROJECT' ? ProjectPrefix : opts?.type === 'DTR_PROJECT' ? dtrPrefix : (opts?.type === 'CREATE_DTR_PROJECT' ? dtrProjectPrefix  : prefix) }/${opts.id}/`;
          await s3.deleteAttchmentFile(fileName, folderPath);
          return resolve({
            code: 200,
            message: 'File deleted successfully',
          });
        } catch (error) {
          console.log({ error });
          return reject({
            code: 400,
            message: 'Failed to delete attachment',
            error: 'FAILED_TO_DELETE_ATTACHMENT'
          });
        }
      } else {
        return reject({
          code: 400,
          message: 'Failed to delete attachment',
          error: 'FAILED_TO_DELETE_ATTACHMENT',
        });
      }
    } catch (error) {
      return reject({
        code: 400,
        message: `Error in fetching ${opts.type.toLowerCase()} data`,
        error: `ERROR_IN_FETCHING_${opts.type}_DATA`,
      });
    }
  });
}

export const dbAttachmentsServices = {
  getAttachmentsById,
  getFilesInFileInputCustomField,
  updateFileInFileInputCustomField,
  deleteFileInFileInputCustomField,
  deleteAttachment,
};
