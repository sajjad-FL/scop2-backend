import { DTRTemplate } from "../../models/dtr-template.js";
import { DataTransferRequest } from "../../models/data-transfer-request.js";
import { Approver } from "../../models/approvers.js";
import { Counter } from "../../models/counter.js";
import { Category } from "../../models/category.js";
import { CONSTANTS } from "../../utils/constants.js";
import { jiraProjectServices } from "./project.js";
import { logger } from "../../utils/logger.js";
import fs from 'fs';
import _ from 'lodash';
import mongoose from "mongoose";
import S3 from "../../utils/S3.js";
import { sendEmail } from "../../utils/email.js";
import { dtrMailContent, inviteMessage, therapeuticAreaNameConversion } from "../../utils/helper.js";
import { findUsers, ldapUserServices } from "../ldap/user.js";
import { createRandomString } from "../../utils/randomString.js";
import moment from "moment";
import { jiraProjectRequestsServices } from "./project-requests.js";
import { Type } from "../../models/type.js";


const { DATA_TRANSFER_REQUEST: { STATES }, PROJECT } = CONSTANTS;
const ObjectId = new mongoose.Types.ObjectId;

function createDTRTemplate(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const instance = new DTRTemplate(opts.payload);
      const rData = await instance.save();
      if (rData._id && rData.previousTypeId) {
        try {
          const fRes = await Approver.find({ typeId: rData.previousTypeId }).lean();
          if (fRes.length) {
            const fulData = JSON.parse(JSON.stringify(fRes));
            if (fulData.length) {
              const promises = fulData.map((data) => {
                return new Promise(async (resolve, reject) => {
                  const attributeSet = data.attributeSet.filter((aSet) => {
                    const newAttributeNames = rData.attributes.map((nAttr) => nAttr.name);
                    return newAttributeNames.includes(aSet.name);
                  });
                  if (attributeSet.length) {
                    const newApproverData = {
                      typeId: rData._id,
                      attributeSet,
                      lead: data?.lead || [],
                      collaborators: data?.collaborators || [],
                      approvers: data?.approvers || [],
                      defaultApprovers: data?.defaultApprovers || [],
                      previousApproverId: data?._id,
                    };
                    try {
                      const approverInstance = new Approver(newApproverData);
                      const apData = await approverInstance.save();
                      if (apData) {
                        try {
                          await Approver.findOneAndUpdate({ typeId: data.typeId }, { isDeleted: true }).lean();
                          return resolve({
                            message: 'Approvers Data Updated Successfully',
                            data: rData,
                          });
                        } catch (fuErr) {
                          logger.error(fuErr, 'ERROR_IN_FIND_AND_UPDATE_APPROVERS');
                          return reject({
                            message: 'Failed to Update Approvers Data',
                            data: rData,
                          });
                        }
                      } else {
                        return resolve({
                          message: 'Approvers Data Updated Successfully',
                          data: rData,
                        });
                      }
                    } catch (apErr) {
                      logger.error(fErr, 'ERROR_IN_CREATED_APPROVERS_DATA');
                      return reject({
                        message: 'Failed to create Approvers Data',
                        data: rData,
                      });
                    }
                    
                  } else {
                    deleteApprover({ approverID: data._id }).then((res) => {
                      resolve(res);
                    }).catch((err) => {
                      resolve(err);
                    });
                  }
                });
              });
              Promise.allSettled(promises).then((reCheck) => {
                // Add a logger to check which types are updated and which are not
                reCheck.forEach((pRes) => {
                  if (pRes.status === 'rejected') {
                    logger.error('ERROR_IN_UPDATING APPROVERS_DATA');
                    return resolve({
                      message: 'Data Transfer Request Template created successfully',
                      data: rData,
                    });
                  } else {
                    return resolve({
                      message: 'Data Transfer Request Template created successfully',
                      data: rData,
                    });
                  }
                });
              });
            } else {
              return resolve({
                message: 'Data Transfer Request Template created successfully',
                data: rData,
              });
            }
          } else {
            return resolve({
              message: 'Data Transfer Request Template created successfully',
              data: rData,
            });
          }
        } catch (fErr) {
          logger.error(fErr, 'ERROR_IN_FIND_APPROVERS');
          return resolve({
            message: 'Data Transfer Request Template created successfully',
            data: rData,
          });
        }
      } else {
        return resolve({
          message: 'Data Transfer Request Template created successfully',
          data: rData,
        });
      }
    } catch (rErr) {
      logger.error(rErr, 'ERROR_IN_CREATE_DTR_TEMPLATE');
      if (rErr.code === 11000) {
        return reject({ message: 'Duplicate: Data transfer request template with same name already exist in system', code: 403, error: 'ERROR_DB_SAVE' });
      } else {
        return reject({ message: 'Failed to create data transfer request template', code: 403, error: 'ERROR_DB_SAVE' });
      }
    }
    const instance = new DTRTemplate(opts.payload);
    instance.save((rErr, rData) => {
      if (rErr) {
        logger.error(rErr, 'ERROR_IN_CREATE_DTR_TEMPLATE');
        if (rErr.code === 11000) {
          reject({ message: 'Duplicate: Data transfer request template with same name already exist in system', code: 403, error: 'ERROR_DB_SAVE' });
        } else {
          reject({ message: 'Failed to create data transfer request template', code: 403, error: 'ERROR_DB_SAVE' });
        }
      } else {
        if (rData._id && rData.previousTypeId) {
          Approver.find({ typeId: rData.previousTypeId },(fErr, fRes) => {
            if (fErr) {
              logger.error(fErr, 'ERROR_IN_FIND_APPROVERS');
              resolve({
                message: 'Data Transfer Request Template created successfully',
                data: rData,
              });
            } else if (fRes.length) {
              const fulData = JSON.parse(JSON.stringify(fRes));
              if (fulData.length) {
                const promises = fulData.map((data) => {
                  return new Promise((resolve, reject) => {
                    const attributeSet = data.attributeSet.filter((aSet) => {
                      const newAttributeNames = rData.attributes.map((nAttr) => nAttr.name);
                      return newAttributeNames.includes(aSet.name);
                    });
                    if (attributeSet.length) {
                      const newApproverData = {
                        typeId: rData._id,
                        attributeSet,
                        lead: data?.lead || [],
                        collaborators: data?.collaborators || [],
                        approvers: data?.approvers || [],
                        defaultApprovers: data?.defaultApprovers || [],
                        previousApproverId: data?._id,
                      };
                      const approverInstance = new Approver(newApproverData);
                      approverInstance.save((apErr, apData) => {
                        if (apErr) {
                          logger.error(fErr, 'ERROR_IN_CREATED_APPROVERS_DATA');
                          reject({
                            message: 'Failed to create Approvers Data',
                            data: rData,
                          });
                        }
                        if (apData) {
                          Approver.findOneAndUpdate({ typeId: data.typeId }, { isDeleted: true }, (fuErr, fuRes) => {
                            if (fuErr) {
                              logger.error(fErr, 'ERROR_IN_FIND_AND_UPDATE_APPROVERS');
                              reject({
                                message: 'Failed to Update Approvers Data',
                                data: rData,
                              });
                            } else {
                              resolve({
                                message: 'Approvers Data Updated Successfully',
                                data: rData,
                              });
                            }
                          })
                        } else {
                          resolve({
                            message: 'Approvers Data Updated Successfully',
                            data: rData,
                          });
                        }
                      })
                      
                    } else {
                      deleteApprover({ approverID: data._id }).then((res) => {
                        resolve(res);
                      }).catch((err) => {
                        resolve(err);
                      });
                    }
                  });
                });
                Promise.allSettled(promises).then((reCheck) => {
                  // Add a logger to check which types are updated and which are not
                  reCheck.forEach((pRes) => {
                    if (pRes.status === 'rejected') {
                      logger.error('ERROR_IN_UPDATING APPROVERS_DATA');
                      resolve({
                        message: 'Data Transfer Request Template created successfully',
                        data: rData,
                      });
                    } else {
                      resolve({
                        message: 'Data Transfer Request Template created successfully',
                        data: rData,
                      });
                    }
                  });
                });
              } else {
                resolve({
                  message: 'Data Transfer Request Template created successfully',
                  data: rData,
                });
              }
            } else {
              resolve({
                message: 'Data Transfer Request Template created successfully',
                data: rData,
              });
            }
          });
        } else {
          resolve({
            message: 'Data Transfer Request Template created successfully',
            data: rData,
          });
        }
      }
    });
  });
}

function updateDTRTemplate(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const rData = await DTRTemplate.findOneAndUpdate({ _id: opts.templateID }, { $set: { ...opts.payload } }, { new: true, strict: true, runValidators: true }).lean();
      if ( rData && !opts?.payload?.previousTypeId) {
        try {
          const aRes = await Approver.find({ typeId: opts?.templateID}).lean();
          if (aRes.length) {
            const fulData = JSON.parse(JSON.stringify(aRes));
            if (fulData.length) {
              const promises = fulData.map((data) => {
                return new Promise(async (resolve, reject) => {
                  const attributeSet = data.attributeSet.filter((aSet) => {
                    const newAttributeNames = rData.attributes.map((nAttr) => nAttr.name);
                    return newAttributeNames.includes(aSet.name);
                  });
                  if (attributeSet.length) {
                    try {
                      await Approver.findOneAndUpdate({ typeId: rData._id }, { attributeSet });
                      return resolve({
                        message: 'Approvers Data Updated Successfully',
                        data: rData,
                      });
                    } catch (fuErr) {
                      logger.error(fuErr, 'ERROR_IN_FIND_AND_UPDATE_APPROVERS');
                      return reject({
                        message: 'Failed to Update Approvers Data',
                        data: rData,
                      });
                    }
                  } else {
                    deleteApprover({ approverID: data._id }).then((res) => {
                      return resolve(res);
                    }).catch((err) => {
                      return resolve(err);
                    });
                  }
                });
              });
              Promise.allSettled(promises).then((reCheck) => {
                // Add a logger to check which types are updated and which are not
                reCheck.forEach((pRes) => {
                  if (pRes.status === 'rejected') {
                    logger.error('ERROR_IN_UPDATING APPROVERS_DATA');
                    return resolve({
                      message: 'Data Transfer Request Template created successfully',
                      data: rData,
                    });
                  } else {
                    return resolve({
                      message: 'Data Transfer Request Template created successfully',
                      data: rData,
                    });
                  }
                });
              });
            } else {
              return resolve({
                message: 'Data Transfer Request Template updated successfully',
                data: rData
              });
            }
          } else {
            return resolve({
              message: 'Data Transfer Request Template updated successfully',
              data: rData
            });
          }
        } catch (aErr) {
          logger.error(aErr, 'ERROR_IN_FIND_APPROVER_DATA_BY_TYPEID');
          return reject({
            message: "Data Transfer Request Template updated successfully, Failed to update approvers data",
            data: rData,
          });
        }
      } else {
        return resolve({
          message: 'Data Transfer Request Template updated successfully',
          data: rData
        });
      }
    } catch (rErr) {
      logger.error(rErr, 'ERROR_IN_UPDATE_DTR_TEMPLATE');
      if (rErr.code === 11000) {
        reject({ message: 'Duplicate: Data transfer request template with same name already exist in system', code: 403, error: 'ERROR_DB_SAVE' });
      } else {
        reject({ message: 'Failed to update data transfer request template', code: 403, error: 'ERROR_DB_SAVE' });
      }
    }
  });
}

function uploadHTMLDTRTemplate(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const templates = await DTRTemplate.findOne({ 'htmlFile.originalName': opts.file.hapi.filename }).lean();
      if (templates && templates.htmlFile) {
        const data = {
          templateID: opts.id,
          payload: {
            htmlFile: templates.htmlFile,
          },
        };
        updateDTRTemplate(data).then((result) => {
          resolve(result);
        }, (err) => {
          logger.error(err, 'ERROR_IN_UPDATING_DTR_TEMPLATE');
          reject(err);
        });
      } else {
        const UPLOAD_PATH = 'uploads';
        const fileOptions = { dest: `${UPLOAD_PATH}/` };
        if (!fs.existsSync(UPLOAD_PATH)) {
          try {
            fs.mkdirSync(UPLOAD_PATH, { recursive: true });

            jiraProjectServices.uploader(opts.file, fileOptions).then((uploadRes) => {
              // save data to database
              const data = {
                templateID: opts.id,
                payload: {
                  htmlFile: uploadRes,
                },
              };
              updateDTRTemplate(data).then((result) => {
                return resolve(result);
              }).catch((err) => {
                logger.error(err, 'ERROR_IN_UPDATING_DTR_TEMPLATE');
                return reject(err);
              });
            }).catch((uploadErr) => {
              return reject(uploadErr);
            });
          } catch (dirErr) {
            return reject(dirErr);
          }
        } else {
          // save the file
          jiraProjectServices.uploader(opts.file, fileOptions).then((uploadRes) => {
            // save data to database
            const data = {
              templateID: opts.id,
              payload: {
                htmlFile: uploadRes,
              },
            };
            updateDTRTemplate(data).then((result) => {
              return resolve(result);
            }, (err) => {
              logger.error(err, 'ERROR_IN_UPDATING_DTR_TEMPLATE');
              return reject(err);
            });
          }).catch((uploadErr) => { 
            logger.error(uploadErr, 'ERROR_IN_UPLOADING_DTR_HTML_FILE');
            return reject(uploadErr);
          });
        }
      }
    } catch (findErr) {
      // 1.a If error, reject with error
      logger.error(findErr, 'ERROR_DB_FIND_DTR_TEMPLATES');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_DTR_TEMPLATES',
      });
    }
  });
}

async function getAllDTRTemplates() {
  try {
    const rData = await DTRTemplate.find({})
      .populate('categoryId', '_id name helpLink messageBoxTextContent messageBoxTitle')
      .populate('previousTypeId', '_id name helpLink messageBoxTextContent messageBoxTitle')
      .lean()
      .exec();

    return rData;
  } catch (eErr) {
    logger.error(eErr, 'ERROR_IN_FIND_ALL_DTR_TEMPLATES');
    throw { message: 'Failed to find all data transfer request templates', code: 403, error: 'ERROR_DB_SAVE' };
  }
}

function validateDTRTemplate(typeId) {
  return new Promise(async (resolve, reject) => {
    // 1 Find matching projects with typeId received from client
    try {
      const pData = await DataTransferRequest.findOne({ 'typeData.id': typeId}).lean();
      if (pData) {
        // 1.b If found, reject with error
        return resolve({
          message: `DTRTemplate is associated with Data transfer request (${pData.displayName}).`,
          code: 403,
        });
      } else {
        // 1.c resolve with success
        return resolve('success');
      }
    } catch (pErr) {
      // 1.a If error, reject with error
      logger.error(pErr, 'ERROR_DB_FIND_DTR_TEMPLATE');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_DTR_TEMPLATE',
      });
    }
  });
}

function deleteDTRTemplate(opts) {
  return new Promise((resolve, reject) => {
    validateDTRTemplate(opts.templateID).then(async (res) => {
      if (res === 'success') {
        await findAndDeleteApproversData(opts.templateID);
        try {
          const rData = await DTRTemplate.deleteOne({ _id: opts.templateID }).lean();
          return resolve({
            code: 200,
            message: 'Data Transfer Request Template deleted successfully',
            data: rData,
          });
        } catch (rErr) {
          logger.error(rErr, 'ERROR_IN_DELETE_DTR_TEMPLATE');
          return reject({ message: 'Failed to delete data transfer request template', code: 403, error: 'ERROR_DB_SAVE' });
        }
      } else {
        try {
          const rData = await DTRTemplate.findOneAndUpdate({ _id: opts.templateID }, { $set: { isDeleted: true } }).lean();
          return resolve({
            code: 200,
            message: 'Data Reuse Request Template deleted successfully',
            data: rData,
          });
        } catch (rErr) {
          logger.error(rErr, 'ERROR_IN_DELETE_DRR_TEMPLATE');
          return reject({ message: 'Failed to delete data reuse request template', code: 403, error: 'ERROR_DB_SAVE' });
        }
      }
    }).catch((error) => {
      return reject({
        code: 403,
        message: 'Failed to delete data transfer request template',
        error
      });
    })
  });
}

function findAndDeleteApproversData(templateID) {
  return new Promise(async (resolve, reject) => {
    try {
      await Approver.deleteMany({ typeId: templateID }).lean();
      return resolve('success');
    } catch (aErr) {
      logger.error(aErr, 'ERROR_IN_FIND_APPROVER_BY_TYPEID');
      return reject({ message: 'Failed to find approver by typeid', code: 403, error: 'ERROR_DB_SAVE' });
    }
  })
}

function deleteApprover(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const rData = await Approver.deleteOne({ _id: opts.approverID }).lean();
      return resolve({
        message: 'Approvers deleted successfully',
        data: rData,
      });
    } catch (rErr) {
      logger.error(rErr, 'ERROR_IN_DELETE_APPROVER_DETAILS');
      return reject({ message: 'Failed to delete approver details', code: 403, error: 'ERROR_DB_SAVE' });
    }
  });
}

function createApprover(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const instance = new Approver(opts.payload);
      const rData = await instance.save();
      return resolve({
        message: 'Approver data created successfully',
        data: rData,
      });
    } catch (rErr) {
      logger.error(rErr, 'ERROR_IN_CREATE_APPROVER');
      return reject({ message: 'Error in creating approver', code: 403, error: 'ERROR_DB_SAVE' });
    }
  });
}

function updateApprover(opts) {
  return new Promise(async (resolve, reject) => {
    // eslint-disable-next-line max-len
    try {
      const rData = await Approver.findOneAndUpdate({ _id: opts.approverID }, { $set: { ...opts.payload } }, { new: true, strict: true, runValidators: true }).lean();
      return resolve({
        message: 'Approvers data updated successfully',
        data: rData,
      });
    } catch (rErr) {
      logger.error(rErr, 'ERROR_IN_UPDATE_APPROVER_DETAILS');
      return reject({ message: 'Error in updating approver details', code: 403, error: 'ERROR_DB_SAVE' });
    }
  });
}

function getApproversByTemplateId(opts) {
  return new Promise(async (resolve, reject) => { 
    try {
      const { templateID, page, perPage } = opts;
      const skip = page && perPage ? (page - 1) * perPage : 0; 
      const data = await Approver.aggregate([
        // Perform aggregation using $facet to execute multiple pipelines
        {
          $facet: {
            // Pipeline to fetch approvers with non-empty 'attributeSet'
            approvers: [
              {
                $match: {
                  typeId: new mongoose.Types.ObjectId(templateID),
                  $expr: { $gt: [{ $size: "$attributeSet" }, 0] } // Check for non-empty 'attributeSet'
                }
              },
              { $skip: skip }, // Pagination: skip documents based on page number
              { $limit: perPage || 10 } // Pagination: limit number of documents per page
            ],
            // Pipeline to fetch defaultApprovers with empty 'attributeSet'
            defaultApprovers: [
              {
                $match: {
                  typeId: new mongoose.Types.ObjectId(templateID),
                  attributeSet: { $size: 0 } // Check for empty 'attributeSet'
                }
              },
              { $skip: 0 }, // No pagination needed
              { $limit: 1 } // Fetch only one document
            ],
            // Pipeline to count documents with non-empty 'attributeSet'
            countWithAttributeSet: [
              {
                $match: {
                  typeId: new mongoose.Types.ObjectId(templateID),
                  $expr: { $gt: [{ $size: "$attributeSet" }, 0] } // Check for non-empty 'attributeSet'
                }
              },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 }
                }
              }
            ]
          }
        },
        {
          $unwind: {
            path: "$countWithAttributeSet",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          // Project the output to include counts and data
          $project: {
            approversCount: "$countWithAttributeSet.count", // Total count of approvers with non-empty 'attributeSet'
            approvers: 1, // Array of approvers with non-empty 'attributeSet'
            defaultApprovers: 1 // Array of defaultApprovers with empty 'attributeSet'
          }
        }
      ]).exec();
      // Resolve with fetched data
      return resolve({
        message: 'Approvers fetched successfully by template ID',
        data: data.length > 0 ? data[0] : [], // If data is available, return first element, otherwise return an empty array
      });
    } catch (err) {
      logger.error(err, 'ERROR_IN_FIND_APPROVERS');
      return reject({ message: 'Error in finding approvers', code: 403, error: 'ERROR_DB_SAVE' });
    }
  });
}

function getSMHApproversByTemplateId(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const { templateID, page, perPage } = opts;
      const skip = page && perPage ? (page - 1) * perPage : 0; // Calculate the number of documents to skip
      const type = await Type.findById(templateID).lean();
      return resolve({
        message: 'Approvers fetched successfully by template ID',
        type
      });
    } catch (error) {
      return reject({ message: 'Error in finding approvers', code: 403, error: 'ERROR_DB_SAVE' });
    }
  })
}
  
function getApproversReportsByTemplateId(opts) {
  return new Promise(async (resolve, reject) => {
    const promise1 = Approver.aggregate([
      {
        $match: {
          typeId: new mongoose.Types.ObjectId(opts.templateID),
          defaultApprovers: []
        },
      },
      {
        $addFields: {
          lead: {
            $reduce: {
              input: "$lead",
              initialValue: "",
              in: {
                $concat: [
                  "$$value",
                  "$$this.name",
                  " [",
                  "$$this.email",
                  "]",
                ],
              },
            },
          },
          approvers: {
            $reduce: {
              input: "$approvers",
              initialValue: "",
              in: {
                $concat: [
                  "$$value",
                  "$$this.name",
                  " [",
                  "$$this.email",
                  "]",
                ],
              },
            },
          },
          collaborators: {
            $reduce: {
              input: "$collaborators",
              initialValue: "",
              in: {
                $concat: [
                  "$$value",
                  "$$this.name",
                  " [",
                  "$$this.email",
                  "]",
                ],
              },
            },
          },
        },
      },
      {
        $unwind: {
          path: "$attributeSet",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $skip:  opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0,
      },
      {
        $limit: opts.perPage
      }
    ]);
    const promise2 = Approver.aggregate([
      {
        $match: {
          typeId:  new mongoose.Types.ObjectId(opts.templateID),
        },
      },
      { $unwind: "$attributeSet" },
      {
        $group: {
          _id: "$attributeSet.name",
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          fields: { $push: "$_id" },
        },
      },
      {
        $project: {
          _id: 0,
          fields: 1,
        },
      },
    ]);
    const promise3 = Approver.aggregate([
      {
        $match: {
          typeId: new mongoose.Types.ObjectId(opts.templateID),
          $expr: {
            $gte: [
              {
                $size: "$defaultApprovers",
              },
              1,
            ],
          },
        },
      },
      {
        $addFields: {
          defaultApprovers: {
            $reduce: {
              input: "$defaultApprovers",
              initialValue: "",
              in: {
                $concat: [
                  "$$value",
                  "$$this.name",
                  " [",
                  "$$this.email",
                  "]",
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          defaultApprovers: 1,
        },
      },
    ])

    const promise4 = Approver.aggregate([
      {
        $match: {
          typeId:  new mongoose.Types.ObjectId(opts.templateID),
          defaultApprovers: []
        },
      },
      {
        $unwind: {
          path: "$attributeSet",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $count: "count",
      },
    ])
    Promise.allSettled([ promise1.exec(), promise2.exec(), promise3.exec(), promise4.exec() ]).then((res) => {
      return resolve({
        code: 200,
        message: 'Fetch approvers reports success',
        data: {
          approvers: res[0]?.value || [],
          fields: (res[1].value?.length && res[1].value[0]?.fields) || [],
          defaultApprovers: (res[2].value?.length && res[2].value[0]?.defaultApprovers) || '-',
          count: (res[3].value?.length && res[3].value[0]?.count) || 0,
        },
      });
    }).catch((error) => {
      logger.error(error, 'FAILED_TO_FETCH_APPROVERS_REPORTS');
      return resolve({ code: 400, message: 'Failed to fetch approvers reports' });
    });
  })
}

function getDTRTemplateById(opts) {
  return new Promise((resolve, reject) => {
    try {
      const rData = DTRTemplate.findById(opts.templateID).exec();
      resolve(rData);
    } catch (rErr) {
      logger.error(rErr, 'ERROR_IN_FIND_DTR_TEMPLATE_BY_ID');
      return reject({ message: 'Failed to find data transfer request', code: 403, error: 'ERROR_DB_SAVE' });
    }
  });
}

function getApproversObjectByTemplateId(project) {
  return new Promise(async (resolve, reject) => {
    try {
      const approverResponse = await Approver.find({ typeId: project.typeData.id }).lean();
      const output = {
        approvers: [],
        lead: [],
        collaborators: [],
        defaultApprovers: [],
      };
      approverResponse.forEach((approver) => {
        let count = 0;
        approver.attributeSet.forEach((attr) => {
          const isCustomFieldExists = project.customFields.filter((cF) => {
            if (typeof cF.value === 'string') {
              return cF.name === attr.name && cF.value.toLowerCase().trim() === attr.value.toLowerCase().trim()
            }
            return cF.name === attr.name && cF.value === attr.value;
          }).length;
          if (isCustomFieldExists) {
            count = count + 1;
          }
        });
        if (count  === approver.attributeSet.length) {
          output.approvers = [...output.approvers, ...approver.approvers];
          output.lead = [...output.lead, ...approver.lead];
          output.collaborators = [...output.collaborators, ...approver.collaborators];
        }
        if (approver && approver.defaultApprovers && approver.defaultApprovers.length) {
          output.defaultApprovers = [...output.defaultApprovers, ...approver.defaultApprovers];
        }
      });
      if (!output.approvers.length) {
        output.approvers = [...output.defaultApprovers];
      }
      return resolve(output); // Return the Approvers document
    } catch (error) {
      logger.error(error, 'ERROR_IN_FIND_APPROVER_BY_CATEGORYID');
      return reject({ code: 500, message: 'Approvers Not Found', error });
    }
  })
}

function uploadDTRAttchments(files, requestId) {
  try {
    const s3 = new S3();
    const prefix = process.env.NODE_ENV === 'production' ? 'DTR' : 'DTRrequest';
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
    logger.error(error, 'ERROR_IN_UPLOADING_DTR_FILES');
    return Promise.reject({ code: 403, message: 'Failed to upload dtr files', error });
  }
}

function sendEmailToApprovers(dtrRequest, recipients, currentUser, type, carbonCopyMails) {
  return new Promise(async (resolve, reject) => {
    try {
      let approvers = [];
      for (let i = 0; i < recipients.length; i++) {
        if(recipients[i].type === 'groups-list') {
          const groupPipeline = [
            {
              $match: { _id: ObjectId(recipients[i].groupId) }
            },
            {
              $lookup: {
                from: "users",
                localField: "members._id",
                foreignField: "_id",
                as: "members",
              },
            },
          ];
          const groupResult = await Group.aggregate(groupPipeline);
          if (groupResult) {
            approvers = [...approvers, ...groupResult[0].members.map((result) => ({ username: result.username, name: result.name, wWID: result.wWID, email: result.email}))];
          }
        } else {
          approvers = [...approvers, { ...recipients[i], username: recipients[i].username.toLowerCase(), email: recipients[i].email.toLowerCase() }]
        }
      }
      approvers = _.uniqBy(approvers, 'email');
      let cc = _.uniqBy(carbonCopyMails, 'email').filter((em) => !approvers.some((app) => app.email.includes(em.email)));
      const hasAttachments = dtrRequest.files && dtrRequest.files.length;

      const BYTE_TO_MB = (bytes) => { return bytes / 1000000; };

      const attachmentSize = hasAttachments ? dtrRequest.files.reduce((acc, f) => { return acc + (f?.size || 0); }, 0) : 0;

      const shouldIncludeAttachment = BYTE_TO_MB(attachmentSize) < 20;

      const attachments = (shouldIncludeAttachment && hasAttachments) ? dtrRequest.files.reduce((attachment, file) => {
        attachment.push({ filename: file.name, content: file.data.split(',')[1], encoding: 'base64' });
        return attachment;
      }, []) : [];
      const isValidEmail = (email) => typeof email === 'string' && email.includes('@');
      const toEmails = approvers.map((recipient) => recipient.email).filter(isValidEmail);
      const ccEmails = cc?.map((recipient) => recipient.email).filter(isValidEmail) || [];
      // const toEmails = approvers.map((recipient) => { return recipient.email; });
      // const ccEmails = cc?.length && cc.map((ccEmail) => ccEmail.email) || [];
      const link = `${process.env.UI_HOST}/dashboard/dtr/view-data-transfer-request-${dtrRequest.dtrID}`;
      // eslint-disable-next-line max-len
      const invitees = inviteMessage(approvers);
      const data = dtrMailContent(dtrRequest, currentUser, type, invitees, link, shouldIncludeAttachment)
      if(toEmails?.length) {
        const emailData = {
          to: toEmails,
          cc: ccEmails,
          bcc: 'spiotrow@its.jnj.com',
          subject: data.subject,
          attachments,
          html: data.html,
        };
        try {
          await sendEmail(emailData);
          return resolve(emailData);
        } catch (error) {
          logger.error(error, 'FAILED_TO_SEND_EMAIL');
          return reject({
            code: 400,
            message: 'Failed to send email',
            error: 'FAILED_TO_SEND_EMAIL'
          });
        }
      } else {
        return resolve({ message: 'No Approvers available for this template', code: 404 });
      }
    } catch (error) {
      logger.error('ERROR_SEND_EMAIL', error);
      return resolve({ message: 'Failed to send email to approvers', code: 404 });
    }
  });
}

export async function getLDAPData(username) {
  try {
    const result = await findUsers({ filters: { username } });
    if (!result || result.length === 0) {
      throw new Error('No user found');
    }
    return result;
  } catch (error) {
    console.error('Error fetching LDAP data:', error.message);
    throw new Error(`Failed to fetch LDAP data: ${error.message}`);
  }
}

function saveDataTransferRequestDetails(data) {
  return new Promise(async (resolve, reject) => {
    try {
      const instance = new DataTransferRequest(data);
      const newRequest = await instance.save();
      // 1.b Data Transfer Request has been successfully saved to db
      return resolve(JSON.parse(JSON.stringify(newRequest)));
    } catch (saveErr) {
      // 1.a Project creation in DB failed
      logger.error(saveErr, 'ERROR_DB_SAVE');
      if (saveErr.code === 11000) {
        return reject({ message: 'Duplicate: Project with same name already exist in system', code: 403, error: 'ERROR_DB_SAVE' });
      } else {
        return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_SAVE' });
      }
    }
  });
}

function delegateMails(customFields) {
  return new Promise(async (resolve, reject) => {
    try {
      let data = [];
      const delegateLDAPValues = customFields.filter((cFields) => cFields.type === 'DELEGATELDAP' && (cFields.value || cFields.value !== 'N/A')).map((val) => {
        return val.value.split(', ').map((iVal) => iVal.split('(')[1].split(')')[0]);
      }).flat(1);
      for (let i = 0; i < delegateLDAPValues.length; i++) {
        try {
          const result = await getLDAPData(delegateLDAPValues[i]);
          if (result?.length) {
          data.push({ email: result[0].mail.toLowerCase() })
        }
        } catch (error) {
          console.log("delegateMailsError", error)
        }
      }
      return resolve(data);
    } catch (error) {
      return reject(error);
    }
  })
}

function createScopeDataTransferRequest(project, currentUser) {
  return new Promise(async (resolve, reject) => {
    try {
      // Defaults
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
      // eslint-disable-next-line no-param-reassign
      project.displayId = `${moment().format('YYYY')}-${project.dtrID}`;
      const approversDetails = await getApproversObjectByTemplateId(project);
      if (approversDetails && approversDetails.approvers && approversDetails.approvers.length) {
        project.approversData = {...approversDetails};
      } else {
        return reject({
          code: 400,
          message: 'Unable to find approvers, please add approvers.',
          success: false,
        })
      }

      if (approversDetails && approversDetails.lead && !approversDetails.lead.length) {
        return reject({
          code: 400,
          message: 'Unable to find lead, please add lead.',
          success: false,
        })
      }
      // 1. Save the project details in DB
      // const _request = await saveProjectRequestDetails(project);

      // 1.a Send email to fulfillers
      // 1.b Project request details successfully saved to scope db.
      let dMails = [];
      try {
        dMails = await delegateMails(project.customFields);
      } catch (error) {
        logger.error(error);
      }
      const requestDetails = await saveDataTransferRequestDetails(project);
      if (project.files.length) {
        try {
          const files = [...project.files];
          const fileData = await uploadDTRAttchments(files, requestDetails.displayId);
          if (fileData) {
            // eslint-disable-next-line no-param-reassign
            const opts = {
              dtrID: requestDetails.dtrID,
              payload: {
                hasAttachments: true,
              },
            };
            await updateDataTransferRequestById(opts, currentUser, true);
          }
        } catch (error) {
          logger.error(error, 'ERROR_IN_UPLOADING_FILES');
          return reject({
            message: 'Data transfer request created, Failed to upload files',
            code: 203,
            id: project.dtrID,
            key: project.key,
            displayId: `${project.displayId}`,
          });
        } finally {
          try {
            await sendEmailToApprovers(project, approversDetails.approvers, currentUser, 'APPROVERS_MAIL', [{...currentUser}, ...dMails]);
            const opts = {
              dtrID: requestDetails.dtrID,
              payload: {
                emailStatus: true,
              },
            };
            await updateDataTransferRequestById(opts, currentUser, true);
          } catch (error) {
            return reject({
              message: 'Data transfer request created, Failed to send an email to approvers',
              code: 203,
              id: project.dtrID,
              key: project.key,
              displayId: `${project.displayId}`,
            });
          }
        }
      } else {
        try {
          if (!currentUser?.username) {
            return reject({
              code: 203,
              message: 'Please Logined in again, to approve the data transfer request',
              success: false,
            });
          }
          await sendEmailToApprovers(project, approversDetails.approvers, currentUser, 'APPROVERS_MAIL', [{...currentUser}, ...dMails]);
          const opts = {
            dtrID: requestDetails.dtrID,
            payload: {
              emailStatus: true,
            },
          };
          await updateDataTransferRequestById(opts, currentUser, true);
        } catch (error) {
          return reject({
            message: 'Data transfer request created, Failed to send an email to approvers',
            code: 203,
            id: project.dtrID,
            key: project.key,
            displayId: `${project.displayId}`,
          });
        }
      }
      return resolve({
        message: `Data Transfer Request (${project.displayId}) Created Successfully in Scope.`,
        code: 207,
        id: project.dtrID,
        key: project.key,
        displayId: `${project.displayId}`,
      });
    } catch (error) {
      logger.error(error, 'ERROR_CREATE_REQUEST');
      // 1.b Failed to save project in alfresco server.
      return reject({ code: 400, message: 'Failed to create data transfer request', error });
    }
  });
}

function createDataTransferRequest(opts, currentUser) {
  return new Promise(async (resolve, reject) => {
    // Create random key using function createRandomString.
    const key = createRandomString('', 4);
    try {
      const counterData = await Counter.findOneAndUpdate(
        { type: 'dtrID' },
        { $inc: { dtrCount: +1 } },
        { new: true, strict: true, runValidators: true, upsert: true }).lean();
        if (counterData) {
          try {
            // 1.b Counter has been successfully updated in db
            const dtrID = counterData.dtrCount.toString();
            const originalData = opts.dtr;
            originalData.key = `D${key.toUpperCase()}`;
            originalData.dtrID = dtrID;
            // Project Request Requester details
            originalData.createdBy = {
              name: currentUser.name,
              username: currentUser.username,
              wWID: currentUser.wWID,
              email: currentUser.email,
            };
            const fileInputFields = originalData.customFields.filter((cf) => cf.type === 'FILEINPUT' && cf.values.length);
            for (let i = 0; i < fileInputFields.length; i++) {
              const fileInputIndex = originalData.customFields.findIndex((cf) => cf.type === 'FILEINPUT' && cf.values.length);
              if (fileInputIndex > -1) {
                const fileData = originalData.customFields[fileInputIndex];
                try {
                  const fileInputData = await uploadCustomFieldsAttachments('drrRequests', fileData.values, originalData.dtrID, fileData.name);
                  if (fileInputData?.length) {
                    originalData.customFields[fileInputIndex].values = originalData.customFields[fileInputIndex].values.map((data) => ({
                      name: data.name,
                      link: `${process.env.NODE_ENV === 'production' ? 'production' : 'staging'}/drrRequests/${originalData.dtrID}/${fileData.name}`
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
            // 2. If version control is disabled, Create project only in scope.
            try {
              // * Create a Request Entry
              const dbRes = await createScopeDataTransferRequest(originalData, currentUser);
              // if (isAutomateRequest) {
              //   const project = await syncProjectRequest(dbRes.request, currentUser);
              //   return resolve({ ...dbRes, project });
              // }
              // 2.a Request created successfully in scope.
              return resolve({ ...dbRes });
            } catch (error) {
              // 2.b Failed to create project in scope.
              return reject(error);
            }
          } catch (gErr) {
            // 3.b Failed to create project in Gitlab.
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
      }
      return reject({ message: 'Error in updating Project ID count', code: 500, error: 'ERROR_DB_COUNTER_UPDATE' });
    }
  });
}

function getAllDataTransferRequests(opts) {
  return new Promise(async (resolve, reject) => {
    const dataLookupAndSortQuery  = [
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
        $unwind: {
          path: '$categoryId',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'dtrtemplates',
          localField: 'typeData.id',
          foreignField: '_id',
          as: 'typeData',
        },
      },
      {
        $unwind: {
          path: '$typeData',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          therapeuticArea: '$categoryId.name',
        },
      },
      // {
      //   $sort: {
      //     createdAt: -1,
      //   },
      // }
    ];
    let searchQuery = [];
    if (opts.query) {
      searchQuery = [
        {
          $match: {
            $or: [
              { displayName: { $regex: opts.query, $options: 'i' } },
              { "categoryId.name": { $regex: opts.query, $options: 'i' } },
              { "typeData.name": { $regex: opts.query, $options: 'i' } },
              { displayId: { $regex: opts.query, $options: 'i' } },
              { dtrID: { $regex: opts.query, $options: 'i' } },
              { displayName: { $regex: opts.query, $options: 'i' } },
              { "customFields.value": { $regex: opts.query.replace('(', '\\(').replace(')', '\\)'), $options: 'i' } },
              {
                $expr: {
                  $eq: [
                    {
                      $dateToString: {
                        format: "%Y-%m-%d",
                        date: "$createdAt",
                      },
                    },
                    moment(opts.query).format('YYYY-MM-DD'),
                  ],
                }
              },
              { state: { $regex: opts.query, $options: 'i' } },
            ],
          },
        },
      ];
    }

    let sortStage = {
      $sort: {
        createdAt: -1,  // Default sort
      },
    };
    if (opts.sortBy) {
      if(opts.sortBy === "typeData"){
        opts.sortBy = "typeData.name"
      }
      sortStage = {
        $sort: {
          [opts.sortBy]: opts.sort,
        },
      };
    }
    const paginationAndCountQuery = [
      {
        $facet:
          {
            count: [
              {
                $group: {
                  _id: null,
                  count: {
                    $sum: 1,
                  },
                },
              },
            ],
            data: [
              {
                $skip: opts.page > 0 ? ((opts.page - 1) * opts.perPage) : 0,
              },
              {
                $limit: opts.perPage,
              },
            ],
          },
      },
      {
        $unwind: {
          path: '$count',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project:
          {
            count: '$count.count',
            data: 1,
          },
      },
    ]
    const dataTransferRequestPipeline = [
      ...dataLookupAndSortQuery ,
      sortStage,
      ...searchQuery,
      ...paginationAndCountQuery
    ];
    try {
      const rData = await DataTransferRequest.aggregate(dataTransferRequestPipeline).exec();
      return resolve(rData);
    } catch (rErr) {
      logger.error(rErr, 'ERROR_IN_FIND_ALL_DATA_TRANFER_REQUESTS');
      return reject({ message: 'Failed to find all data transfer request details', code: 500, error: 'ERROR_DB_SAVE' });
    }
  });
}
  
function getDataTransferRequestById(opts) {
  return new Promise(async (resolve, reject) => {
    const dtrPipeline = [
      {
        $match: {
          $or: [
            {dtrID: `${opts.dtrID}`},
            {displayId: `${opts.dtrID}`}
          ]
        },
      },
      {
        $addFields: {
          typeName: "$typeData.name",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryId",
        },
      },
      {
        $unwind: {
          path: "$categoryId",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "dtrtemplates",
          localField: "typeData.id",
          foreignField: "_id",
          as: "typeData",
        },
      },
      {
        $unwind: {
          path: "$typeData",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
    try {
      const rData = await DataTransferRequest.aggregate(dtrPipeline).exec();
      const data = rData[0];
      return resolve(data);
    } catch (rErr) {
      logger.error(rErr, 'ERROR_IN_FIND_DATA_TRANFER_REQUEST_BY_ID');
      return reject({ message: 'Failed to find data transfer request', code: 500, error: 'ERROR_DB_SAVE' });
    }
  });
}

function updateDataTransferRequestById(opts, currentUser, isRequired) {
  return new Promise(async (resolve, reject) => {
    // eslint-disable-next-line max-len
    const data = { ...opts.payload };
    let dMails = [];
    if (data?.customFields) {
      try {
        dMails = await delegateMails(data.customFields);
      } catch (error) {
        logger.error(error);
      }
    }
    if (data.reason) {
      data.state = STATES.REJECTED;
    } else if (!isRequired) {
      const approversDetails = await getApproversObjectByTemplateId(data);
      data.approversData = { ...approversDetails };
    }
    if (data?.approversData?.approvers?.length || isRequired || data.reason) {
      try {
        const rData = await DataTransferRequest.findOneAndUpdate({ dtrID: opts.dtrID }, { $set: { ...data } }, { new: true, strict: true, runValidators: true }).lean();
        const responseData = JSON.parse(JSON.stringify(rData));
        if (responseData.state === STATES.REJECTED) {
          try {
            await sendEmailToApprovers(responseData, [...responseData.approversData.approvers, ...responseData.approversData.lead, ...responseData.approversData.collaborators, {...responseData.createdBy}], currentUser, 'REJECTED_MAIL', [{...currentUser}, ...dMails]);
          } catch (error) {
            console.error(error);
          }
        } else if (!isRequired) {
          await sendEmailToApprovers(responseData, responseData.approversData.approvers, currentUser, 'APPROVERS_MAIL', [{...currentUser}, ...dMails]);
        }
        return resolve(data);
      } catch (error) {
        return reject(rErr);
      }
    } else {
      return reject({
        message: 'Unable to find approvers. Failed to update data transfer request details.',
        code: 403,
      })
    }
  });
}

function deleteDataTransferRequestById(opts) {
  return new Promise(async (resolve, reject) => {
    // 1 Delete project request from DB
    try {
      const dRes = await DataTransferRequest.findOne({ dtrID: opts.dtrID }).lean();
      if (dRes?.projectId) {
        try {
          const res = await Project.deleteOne({ _id: ObjectId(dRes?.projectId) }).lean();
          if (res) {
            try {
              await DataTransferRequest.deleteOne({ dtrID: opts.dtrID }).lean();
              return resolve({
                message: 'Data reuse request deleted successfully',
                code: 200,
              });
            } catch (dtrErr) {
              logger.error(dtrErr, 'LINKED_PROJECT_DELETED_SUCCESSFULLY_FAILED_TO_DELETE_DRR');
              return reject({
                message: 'The linked project was deleted successfully, but the data reuse request deletion failed',
                code: 400,
                error: 'LINKED_PROJECT_DELETED_SUCCESSFULLY_FAILED_TO_DELETE_DRR',
              });
            }
          } else {
            return reject({
              message: 'Linked Project not found',
              code: 500,
              error: 'ERROR_PROJECT_NOT_FOUND',
            })
          }
        } catch (err) {
          logger.error(err, 'ERROR_DB_DELETE_LINKED_PROJECT');
          return reject({
            message: 'Failed to delete linked project',
            code: 500,
            error: 'ERROR_DB_DELETE_LINKED_PROJECT',
          });
        }
      } else {
        try {
          await DataTransferRequest.deleteOne({ dtrID: opts.dtrID }).lean();
          return resolve({
            message: 'Data reuse request deleted successfully',
            code: 200,
          });
        } catch (err) {
          logger.error(err, 'FAILED_TO_DELETE_DRR');
          return reject({
            message: 'Failed to delete Data reuse request',
            code: 500,
            error: 'FAILED_TO_DELETE_DRR',
          });
        }
      }
    } catch (pErr) {
      logger.error(pErr, 'ERROR_TO_FIND_DATA_REUSE_REQUEST')
      return reject({
        message: 'Failed to find Data Reuse request',
        code: 500,
        error: 'ERROR_TO_FIND_DATA_REUSE_REQUEST',
      });
    }
    
  });
}

function approvedDataTranferRequest(opts, currentUser) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!currentUser?._id || !currentUser?.username) {
        reject({
          code: 203,
          message: 'Failed to approve the data transfer request, please try again',
          success: false,
        });
      }
      const dtrData = await getDataTransferRequestById(opts);
      const [categoryName] = dtrData.categoryId.name.split('-TA');
      const category = await Category.findOne({ isTA: false, name: { $regex: categoryName, $options: 'i' } }).lean();
      if (dtrData?.approversData?.lead?.length) {
        if (category) {
          const type = await Type.findOne({ name: therapeuticAreaNameConversion(dtrData.typeData.name), categoryId: category._id, isDTR: true, isRequest: false, isTA: false }).lean();
          if (type) {
            const project = {
              name: dtrData?.name,
              displayName: dtrData?.displayName,
              categoryId: category?._id,
              typeData: {
                name: type?.name,
                id: type?._id,
              },
              importProjectCustomType: type?.name,
              status: PROJECT?.STATUS?.TO_DO,
              dtrMeta: {
                dtrId: dtrData?._id,
                typeId: dtrData?.typeData?._id,
                categoryId: dtrData?.categoryId._id,
                displayId: dtrData?.displayId,
              },
              startDate: dtrData?.createdAt,
              customFields: [],
              collaborators: [...dtrData.approversData.collaborators].map((collaborator) => {
                return {
                  name: collaborator?.username?.toLowerCase() || '',
                  displayName: collaborator?.name || '',
                  type: 'user',
                  wWID: collaborator?.wWID || '',
                };
              }),
              lead: {
                userName: dtrData.approversData.lead[0]?.username,
                displayName: dtrData.approversData.lead[0]?.name,
                wWID: dtrData.approversData.lead[0]?.wWID,
              },
              notes: '',
              isAutomateRequest: true,
            };
            try {
              const dataTransferRequestCustomFields = dtrData?.customFields?.length ? _.cloneDeep(dtrData.customFields) : [];
              // Assign default values to project custom fields
              const projectCustomFields = jiraProjectRequestsServices.sanitizeCustomFields(type?.attributes || []);
              // Merge Request and Project custom fields and create a unique array of custom fields
              // ? Custom Fields are of type mongoose object, So parse it be an array.
              const mergedCustomFields = JSON.parse(JSON.stringify(_.uniqBy(dataTransferRequestCustomFields.concat(projectCustomFields), 'name')));
              const requestPriorityIndex = mergedCustomFields.findIndex((cf) => { return cf.name === 'Request Priority'; });
              // Replace RequestPriority with Project Priority
              if (requestPriorityIndex > -1 && mergedCustomFields[requestPriorityIndex] && mergedCustomFields[requestPriorityIndex]?.name) {
                const projectPriority = mergedCustomFields[requestPriorityIndex];
                projectPriority.name = 'Project Priority';
                mergedCustomFields[requestPriorityIndex] = projectPriority;
              }
              project.customFields = mergedCustomFields;
            } catch (error) {
              logger.error(error, 'ERROR_ASSIGN_PROJECT_CUSOM_FIELDS');
              reject({
                code: 203,
                message: 'Failed to approve data transfer request.',
                success: true,
                data: dtrData,
              });
            }
            const projectOpts = {
              project,
              isRequestProject: true,
              versionControl: true,
            };
            try {
              const projectData = await jiraProjectServices.createProject(projectOpts, currentUser);
              if (projectData) {
                const utc = moment.utc().valueOf();
                let dMails = [];
                if (projectData?.data?.customFields) {
                  try {
                    dMails = await delegateMails(projectData?.data?.customFields);
                  } catch (error) {
                    logger.error(error);
                  }
                }
                const updatedData = {
                  projectId: projectData?.data?._id,
                  projectKey: projectData?.data?.projectID,
                  state: STATES.TO_DO,
                  approvedBy: projectData?.data?.createdBy,
                  approvedAt: moment.utc(utc).toDate(),
                };
                if (!updatedData?.approvedBy) {
                  reject({
                    code: 203,
                    message: 'Failed to approve the data transfer request, please try again',
                    success: false,
                  });
                }
                try {
                  const dtrOpts = {
                    dtrID: dtrData.dtrID,
                    payload: updatedData,
                  };
                  await updateDataTransferRequestById(dtrOpts, currentUser, true);
                  try {
                    await sendEmailToApprovers(dtrData, [...dtrData.approversData.approvers, ...dtrData.approversData.lead, ...dtrData.approversData.collaborators], currentUser, 'ACCEPTED_MAIL', [{...dtrData.createdBy}, ...dMails]);
                    return resolve({
                      code: 200,
                      message: 'Approved data transfer request successfully',
                      success: true,
                    });
                  } catch (error) {
                    logger.error(error, 'ERROR_IN_SEND_EMAIL');
                    resolve({
                      code: 200,  
                      message: 'Project succesfully created. failed to send email to the lead and collaborators',
                      success: true,
                    });
                  }
                } catch (error) {
                  logger.error(error, 'ERROR_IN_SEND_EMAIL');
                  resolve({
                    code: 200,  
                    message: 'Project succesfully created. failed to update project details in data transfer request',
                    success: true,
                  });
                }
              } else {
                reject({
                  code: 203,
                  message: 'Failed to approve the data transfer request',
                  success: false,
                });
              }
            } catch (error) {
              logger.error(error, 'ERROR_IN_CREATE_PROJECT');
              reject({
                code: 203,
                message: 'Failed to approve the data transfer request',
                success: false,
              });
            }
          } else {
            logger.error('ERROR_IN_FIND_PROJECT_TYPE');
            reject({
              code: 203,
              message: 'Unable to find type data.Failed to approve data transfer request',
              success: true,
              data: dtrData,
            });
          }
        } else {
          logger.error('ERROR_IN_FIND_PROJECT_DEPARTMENT');
          reject({
            code: 203,
            message: 'Unable to find department data. Failed to approve data transfer request',
            success: true,
            data: dtrData,
          });
        }
      } else {
        logger.error('ERROR_IN_FIND_DTR');
        reject({
          code: 203,
          message: 'Failed to approve the data transfer request. Add lead in approvers table',
          success: false,
        });
      }
    } catch (error) {
      logger.error(error, 'ERROR_IN_FETCHING_DATA_TRANSFER_REQUEST_DETAILS');
      reject({ message: 'Error in fetching data transfer request details' });
    }
  });
}

function resendEmailToApprovers(opts, currentUser) {
  return new Promise(async (resolve, reject) => {
    if (currentUser.isAdmin || currentUser.isSuperAdmin) {
      const dataTransferRequest = await DataTransferRequest.findOne({ dtrID: opts?.dtrID }).lean();
      if (dataTransferRequest) {
        let dMails = [];
        try {
          dMails = await delegateMails(dataTransferRequest.customFields);
        } catch (error) {
          logger.error(error, 'FAILED_TO_DELIGATE_EMAIL');
          return reject({
            status: 400,
            message: 'Failed to find delegate email',
            code: "FAILED_TO_DELIGATE_EMAIL"
          });
        }
        try {
          await sendEmailToApprovers(dataTransferRequest, dataTransferRequest?.approversData?.approvers || [], currentUser, 'APPROVERS_MAIL', [{...dataTransferRequest.createdBy}, ...dMails])
          return resolve({
            code: 200,
            message: 'Email has been successfully resent.',
          });
        } catch (error) {
          logger.error(error, 'FAILED_TO_SEND_EMAIL_TO_APPROVERS');
          return reject({
            code: 400,
            message: 'Failed to send emails to approvers',
            message: 'FAILED_TO_SEND_EMAIL_TO_APPROVERS'
          });
        }
      } else {
        logger.error(error, 'ERROR_IN_FETCHING_DATA_TRANSFER_REQUEST_DETAILS');
        return reject({
          code: 400,
          message: 'Data Reuse request not found',
          error: 'DATA_REUSE_REQUEST_NOT_FOUND'
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

  export const jiraDataTransferRequestServices = {
    createDTRTemplate,
    updateDTRTemplate,
    deleteDTRTemplate,
    validateDTRTemplate,
    uploadHTMLDTRTemplate,
    getAllDTRTemplates,
    createApprover,
    updateApprover,
    getApproversByTemplateId,
    getSMHApproversByTemplateId,
    getApproversReportsByTemplateId,
    deleteApprover,
    getDTRTemplateById,
    createDataTransferRequest,
    getAllDataTransferRequests,
    getDataTransferRequestById,
    updateDataTransferRequestById,
    deleteDataTransferRequestById,
    approvedDataTranferRequest,
    getLDAPData,
    sendEmailToApprovers,
    delegateMails,
    resendEmailToApprovers,
  };