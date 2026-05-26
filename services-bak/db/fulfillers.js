import _ from 'lodash';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs'
import { LDAPConfig } from '../../connectors/ldap.js';
import { logger } from '../../utils/logger.js';
import { Fulfiller } from "../../models/fulfillers.js";
import { Type } from "../../models/type.js";
import { convertStringToArray } from '../../utils/helper.js';

/**
 * Saves the project details in DB
 * @author Aniket
 * @param {Object} data The project properties
 * @returns {Promise}
 */

function saveFulfillerDetails(data) {
  return new Promise(async (resolve, reject) => {
    try {
      const dbRes = await Fulfiller.findOneAndUpdate({ typeId: data.typeId }, data, { new: true, strict: true, runValidators: true }).lean();
      if (!dbRes) {
        try {
          const instance = new Fulfiller(data);
          const newFulfiller = await instance.save();
          // 1.b Project has been successfully saved to db
          return resolve(newFulfiller);
        } catch (saveInstanceErr) {
          // 1.a Project creation in DB failed
          logger.error(saveInstanceErr, 'ERROR_DB_SAVE');
          return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_SAVE' });
        }
      } else {
        return resolve(dbRes);
      }
    } catch (error) {
      logger.error(saveErr, 'ERROR_DB_SAVE');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_SAVE' });
    }
  });
}

function getFulfillerByType(data) {
  return new Promise(async (resolve, reject) => {
    try {
      const dbRes = await Fulfiller.find({ typeId: data.typeId }).lean();
      if (dbRes) {
        // 1.b fulfiller has been successfully saved to db
        return resolve(dbRes);
      }
      return reject({ message: 'Fulfiller details not found', code: 404, error: 'ERROR_FETCH_DB' });
    } catch (dbErr) {
      // 1.a fulfiller creation in DB failed
      logger.error(dbErr, 'ERROR_DB_SAVE');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_SAVE' });
    }
  });
}

function deleteById(data) {
  return new Promise(async (resolve, reject) => {
    try {
      await Fulfiller.deleteOne({ typeId: data.typeId }).lean();
      return resolve({
        message: 'Fulifillers deleted successfully',
        code: 200,
      });
    } catch (err) {
      logger.error(err, 'ERROR_DBPROJECT_DELETE');
      return reject({
        message: 'Failed to delete fulfillers',
        code: 500,
        error: 'ERROR_DBPROJECT_DELETE',
      });
    }
  });
}

/**
 * Assign fulfillers project request by custom fields.
 *
 * @param {Object} data filfiller attribute details
 * @return {Promise.<{ code: Number, error: String, message: String, id: String, key: String, displayId: String }>
 * | Promise.<{ code: Number, error: String, message: String }>} Resolved when the project has been created.
 */
function createFulfiller(data) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Save the fulfiller details in DB
      const dbRes = await saveFulfillerDetails(data);
      // 1.a Project request details successfully saved to scope db.
      return resolve({
        message: 'Fulfiller details saved',
        code: 200,
        data: dbRes,
      });
    } catch (error) {
      // 1.b Failed to save project in alfresco server.
      return reject(error);
    }
  });
}

function exportFulfiller(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const dbRes = await Fulfiller.findOne({ typeId: opts.typeId, categoryId: opts.categoryId })
        .populate('typeId', '_id name attributes')
        .populate('categoryId', '_id name')
        .lean();
      if (dbRes) {
        // ? Fulfiller JSON can be used by any template without cateogry and purpose restriction.
        // const [therapeuticArea] = (dbRes.categoryId && dbRes.categoryId.name && dbRes.categoryId.name.split('-')) || ['N/A'];
        // const [purpose] = (dbRes.typeId && dbRes.typeId.name && dbRes.typeId.name.split('-')) || ['N/A'];
        const template = (dbRes.typeId && dbRes.typeId) || ({ attributes: [] });
        const response = {
          // therapeuticArea: therapeuticArea.trim(),
          // purpose: purpose.trim(),
          availableAttributes: {},
          defaultFulfillers: [],
          attributes: [],
        };

        const attributeFulfillers = {
          primarySP: [],
          primarySDS: [],
          other: [],
        };

        // Template attributes
        if (template && template.attributes && template.attributes.length) {
          template.attributes.forEach((typeAttr) => {
            response.availableAttributes[typeAttr.name] = {
              values: typeAttr.values || [],
              type: typeAttr.type,
            };
          });
        }
        // Default fulfillers
        response.defaultFulfillers = (dbRes && dbRes.fulfillers && dbRes.fulfillers.map((fulfiller) => { return fulfiller.email.toLowerCase(); })) || [];
        // Attribute fulfillers
        if (dbRes?.attributeSet?.length) {
          dbRes.attributeSet.forEach((attr) => {
            const attribute = _.cloneDeep({
              ...attributeFulfillers,
            });
            // Attributes
            if (attr.attributes && attr.attributes.length) {
              attr.attributes.forEach((a) => {
                if (a.type !== 'DROPDOWNMANY') {
                  attribute[a.name] = a.value || '';
                } else {
                  attribute[a.name] = a.value.name.trim().toLowerCase() === 'Other'.toLowerCase() ? `${a.value.name}-${a.value.value}` : (a.value.name || a.value);
                }
              });
            }

            // Fulfillers
            if (attr.fulfillers && attr.fulfillers.length) {
              attr.fulfillers.forEach((user) => {
                if (user.isPrimarySP) {
                  attribute.primarySP.push(user.email.toLowerCase());
                }
                if (user.isPrimarySDS) {
                  attribute.primarySDS.push(user.email.toLowerCase());
                }
                if (!user.isPrimarySP && !user.isPrimarySDS && !user.isTypeFulfiller) {
                  attribute.other.push(user.email.toLowerCase());
                }
              });
            }
            response.attributes.push(attribute);
          });
        }

        if(opts.type === "EXCEL"){
          // Fulfillers Excel 
          const workbook = new ExcelJS.Workbook();
          const worksheet = workbook.addWorksheet('Sheet 1');

          // Adding header row
          worksheet.columns = [
            { header: 'attribute', key: 'attributes', width: 50 },
            { header: 'value', key: 'values', width: 50 }, 
            { header: 'primarySP', key: 'primarySP', width: 30 },
            { header: 'primarySDS', key: 'primarySDS', width: 30 },
            { header: 'otherFulfillers', key: 'other', width: 30 },
            { header: 'defaultFulfillers', key: 'defaultFulfillers', width: 40 }
          ];

          // Adding data rows
          response.attributes.forEach(item => {
            // Extracting dynamic attribute names and values
            const attributes = [];
            const values = [];

            Object.keys(item).forEach(key => {
              if (!['primarySP', 'primarySDS', 'other'].includes(key)) {
                attributes.push(key);            // Collecting dynamic attribute names
                values.push(item[key]);          // Collecting corresponding values
              }
            });

            // Add row to worksheet
            worksheet.addRow({
              attributes: attributes.join('| '),
              values: values.join('| '),   
              primarySP: item.primarySP.join(', '),
              primarySDS: item.primarySDS.join(', '),
              other: item.other.join(', '), 
              defaultFulfillers: response.defaultFulfillers.join(', '),
            });
          });

          // Generate the Excel file as a buffer
          workbook.xlsx.writeBuffer().then((buffer) => {
            // Resolve with buffer
            const base64 = buffer.toString('base64');
            return resolve(`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`);
          }).catch((err) => {
            // Reject with error
            return reject(err);
          });
        } else{
          // Convert JSON object to a string
          const jsonString = JSON.stringify(response);

          // Generate a buffer from the JSON string
          const buffer = Buffer.from(jsonString, 'utf-8');

          // Optional: Convert buffer to base64 (if required)
          const base64 = buffer.toString('base64');
          return resolve(`data:application/json;base64,${base64}`);
        }
      } else {
        resolve({
          message: 'No fulfillers assigned to given TA and Template.',
          code: 404,
          success: true,
        });
      }
    } catch (error) {
      logger.error(error, 'ERROR_EXPORT_FULFILLERS');
      reject({
        error: 'ERROR_EXPORT_FULFILLERS',
        message: 'Something went wrong while data is being exported',
        code: 500,
        success: false,
      });
    }
  });
}

function getUserFromLDAP(email) {
  return new Promise((resolve, reject) => {
    LDAPConfig.findUser(email).then((user) => {
      if (user) {
        const details = {
          username: user.jnjMSUserName.toLowerCase(),
          email,
          wWID: user.cn,
          name: _.capitalize(user.fullName),
        };
        resolve(details);
      } else {
        logger.error(email, 'ERROR_FIND_LDAP_USER');
        resolve('ERROR_FIND_LDAP_USER');
      }
    }).catch((uErr) => {
      logger.error(uErr, 'ERROR_FIND_LDAP_USER');
      reject('ERROR_FIND_LDAP_USER');
    });
  });
}

function importFulfiller(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const fileData = opts.file;

      const buffers = [];

      for await (const chunk of fileData) {
        buffers.push(chunk);
      }

      const fileBuffer = Buffer.concat(buffers);

      const jsonString = fileBuffer.toString('utf-8');
      const content = JSON.parse(jsonString); 
      
      if (!content || !(content.defaultFulfillers || content.attributes)) {
        return reject({
          code: 400,
          error: 'INVALID_REQUEST_PAYLOAD',
          message: 'Invalid JSON content',
          success: false,
        });
      } else {
        const purpose = await Type.findOne({ _id: opts.typeId }).lean();
        if (purpose) {
          // Cache existing users.
          const cacheUsers = {};
          // Helper function to get fulfilled values.
          const getFulfilledValues = (promiseResult = []) => { return promiseResult.filter((res) => { return res.status === 'fulfilled' && !!res.value; }).map((res) => { return res.value; }); };
          // Get default fulfillers
          const getFulfillerDetails = (emails = [], roles = { isPrimarySP: false, isPrimarySDS: false, isTypeFulfiller: false }) => {
            return new Promise(async (res, rej) => {
              try {
                // Fetch user details from ldap server.
                const asyncUsers = emails.map(async (mail) => {
                  const email = mail.trim().toLowerCase();
                  if (!cacheUsers[email]) {
                    try {
                      const user = await dbFulfillersServices.getUserFromLDAP(email);
                      if (user) {
                        cacheUsers[email] = _.cloneDeep(user);
                        return { ...user, ...roles };
                      }
                    } catch (err) {
                      logger.error(err, 'ERROR_FIND_USER_LDAP');
                      return null;
                    }
                  } else {
                    return { ...cacheUsers[email], ...roles };
                  }
                });
                // Filter available users from ldap.
                Promise.allSettled([...asyncUsers]).then((users) => { return res(getFulfilledValues(users)); });
              } catch (error) {
                logger.error(error, 'ERROR_GET_FULFILLERS_DETAILS');
                return rej([]);
              }
            });
          };

          // Get default fulfillers user details.
          const defaultFulfillers = getFulfillerDetails(content.defaultFulfillers, { isPrimarySP: false, isPrimarySDS: false, isTypeFulfiller: true });

          const attributeSet = new Promise(async (res, rej) => {
            try {
              const asyncAttributeSet = content.attributes.map(async (attribute) => {
                const attributes = []; // Attributes per row.
                let fulfillers = [];
                const {
                  other = [], primarySP = [], primarySDS = [], ...rest
                } = attribute;
                const { attributes: typeAttributes } = purpose;
                let attributesAvailable = false;
                for (const [key, value] of Object.entries(rest)) {
                  // Find the attribute from the purpose/template attribute list.
                  const attr = typeAttributes.find((a) => { return a.name.trim().toLowerCase() === key.trim().toLowerCase(); });
                  if (attr) {
                    attributesAvailable = true;
                    const typeAttr = _.cloneDeep(attr);
                    delete typeAttr._id;
                    delete typeAttr.isRequired;
                    typeAttr.default = false; // TODO: Verify default key
                    if (typeAttr.type === 'DROPDOWNMANY') {
                      try {
                        typeAttr.default = true;
                        const val = value.trim().split('-').slice(1).join('-');
                        const [name = 'N/A'] = value.trim().split('-');
                        const type = name.trim().toLowerCase() === 'other' ? 'INPUT' : 'VALUE'; // TODO: Currently only input type is supported.
                        typeAttr.value = {
                          value: val,
                          name,
                          type,
                          values: [], // TODO: Currently only input type is supported.
                        };
                      } catch (drError) {
                        logger.error(drError, 'ERROR_SET_DROPDOWN_MANY');
                      }
                    } else {
                      typeAttr.value = value;
                    }
                    attributes.push(typeAttr);
                  }
                }

                if (attributesAvailable) {
                  // Get user details.
                  const primarySPFulfillers = getFulfillerDetails(primarySP, { isPrimarySP: true, isPrimarySDS: false, isTypeFulfiller: false });
                  const primarySDSFulfillers = getFulfillerDetails(primarySDS, { isPrimarySP: false, isPrimarySDS: true, isTypeFulfiller: false });
                  const typeFulfillers = getFulfillerDetails(other, { isPrimarySP: false, isPrimarySDS: false, isTypeFulfiller: false });

                  // Promise allSettled handles getting users concurrently, So cache might not work as expeced.
                  const ldapUsers = await Promise.allSettled([primarySPFulfillers, primarySDSFulfillers, typeFulfillers]);
                  fulfillers = getFulfilledValues(ldapUsers).flat(1);
                }
                return attributes.length ? { attributes, fulfillers } : null;
              });
              // Attribute Set is using async map, So filter fulfilled response.
              Promise.allSettled([...asyncAttributeSet]).then((attributeSet) => { return res(getFulfilledValues(attributeSet)); });
            } catch (error) {
              logger.error(error, 'ERROR_GET_ATTRIBUTE_SET');
              return rej([]);
            }
          });

          Promise.allSettled([defaultFulfillers, attributeSet]).then((res) => {
            try {
              const [defaultFulfillers = [], attributeSet = []] = getFulfilledValues(res);
              Fulfiller.findOneAndUpdate(
                // Filter
                {
                  typeId: opts.typeId,
                  categoryId: opts.categoryId,
                },
                {
                  fulfillers: defaultFulfillers || [],
                  attributeSet,
                },
                {
                  upsert: true,
                  new: true,
                },
              ).then((updates) => {
                return resolve({
                  message: 'Fulfillers imported successfully',
                  code: 201,
                  success: true,
                  data: updates,
                });
              });
            } catch (error) {
              logger.error('error', 'ERROR_SAVE_IMPORT_FULFILLERS');
              return reject({
                code: 500,
                success: false,
                message: 'ERROR_SAVE_IMPORT_FULFILLERS',
              });
            }
          });
        } else {
          logger.error(error, 'ERROR_FIND_FULFILLER_TEMPLATE');
          return reject({
            error: 'ERROR_FIND_FULFILLER_TEMPLATE',
            message: 'Invalid request template',
            code: 404,
            success: false,
          });
        }
      }
    } catch (error) {
      logger.error(error, 'ERROR_IMPORT_FULFILLERS');
      return reject({
        error: 'ERROR_IMPORT_FULFILLERS',
        message: 'Something went wrong while data is being exported',
        code: 500,
        success: false,
      });
    }
  });
}

function newimportFulfiller(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      let content = opts.file;
      const buffers = [];

      for await (const chunk of content) {
        buffers.push(chunk);
      }

      const fileBuffer = Buffer.concat(buffers);
      const type = opts.type;
      if (type === 'EXCEL') {
        try {
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(fileBuffer);
  
          // Assuming you have only one sheet in the Excel file, if there are multiple sheets, use workbook.getWorksheet to get the desired sheet
          const sheet = workbook.getWorksheet(1);
  
          // Iterate through rows and columns to get the data
          content = [];
          sheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) { // Skip the header row
              const rowData = {};
              row.eachCell((cell, colNumber) => {
                // Assign each cell value to the corresponding column name
                const columnName = sheet.getCell(1, colNumber).value;
                rowData[columnName] = cell.value;
              });
              content.push(rowData);
            }
          });
        } catch (error) {
          logger.error(error);
          return reject({
            code: 400,
            error: "FAILED_TO_READ_EXCEL_DATA",
            message: 'Failed to read excel data.',
            success: false,
          });
        }
      }
      if (!content) {
        return reject({
          code: 400,
          error: "INVALID_REQUEST_PAYLOAD",
          message: `Invalid ${opts.type} content`,
          success: false,
        });
      }
  
      const template = await Type.findById(opts.typeId).lean();
      if (!template) {
        return reject({
          error: 'ERROR_TEMPLATE_NOT_FOUND',
          message: 'Template Not Found',
          code: 400,
          success: false,
        });
      }
  
      let attributeSet = [];
      let fulfillers = [];
      let uniqueEmails = new Set();
  
      for (let i = 0; i < content.length; i++) {
        let attributeSetObj = {
          attributes: [],
          fulfillers: [],
        };
  
        if (type === 'EXCEL') {
          const primarySPs = convertStringToArray(content[i].primarySP);
          const primarySDSs = convertStringToArray(content[i].primarySDS);
          const otherFulfillers = convertStringToArray(content[i].otherFulfillers);
          const defaultFulfillers = [...convertStringToArray(content[i].defaultFulfillers)];
  
          // Helper function to fetch LDAP details and add to fulfillers
          async function fetchAndAddLDAPDetails(values, flag, attribute) {
            for (const value of values) {
              try {
                let ldapDetails = await dbFulfillersServices.getUserFromLDAP(value);
                if (ldapDetails) {
                  let details = {
                    name: ldapDetails.name || '',
                    wWID: ldapDetails.wWID || '',
                    email: ldapDetails.email || '',
                    username: ldapDetails.username || '',
                  };
                  switch (flag) {
                    case "PrimarySP":
                      details.isTypeFulfiller = false;
                      details.isPrimarySDS = false;
                      details.isPrimarySP = true;
                      attributeSetObj.fulfillers.push(details);
                      break;
                    case "PrimarySDS":
                      details.isTypeFulfiller = false;
                      details.isPrimarySDS = true;
                      details.isPrimarySP = false;
                      attributeSetObj.fulfillers.push(details);
                      break;
                    case "Other":
                      details.isTypeFulfiller = false;
                      details.isPrimarySDS = false;
                      details.isPrimarySP = false;
                      attributeSetObj.fulfillers.push(details);
                      break;
                    case "Default":
                      details.isTypeFulfiller = true;
                      details.isPrimarySDS = false;
                      details.isPrimarySP = false;
                      if (!uniqueEmails.has(details.email)) {
                        fulfillers.push(details);
                        uniqueEmails.add(details.email); // for unique default fulfillers set
                      }
                      break;
                    default:
                      details.isTypeFulfiller = false;
                      details.isPrimarySDS = false;
                      details.isPrimarySP = false;
                      attributeSetObj.fulfillers.push(details);
                      break;
                  }
                }
              } catch (error) {
                return reject({
                  error: `INVALID_USER(${value})_NOT_FOUND_IN_LDAP_FOR_THIS_ATTRIBUTE(${attribute.trim()})`,
                  message: `Invalid user(${value}) not found in LDAP for this attribute ${attribute.trim()}`,
                  code: 404,
                  success: false,
                });
              }
            }
          }
  
          if (content[i].attribute) {
            // Fetch and add LDAP details for primarySPs and primarySDSs
            await fetchAndAddLDAPDetails(primarySPs, "PrimarySP", content[i].attribute);
            await fetchAndAddLDAPDetails(primarySDSs, "PrimarySDS", content[i].attribute);
            await fetchAndAddLDAPDetails(otherFulfillers, "Other", content[i].attribute);
            await fetchAndAddLDAPDetails(defaultFulfillers, "Default", content[i].attribute);
  
            const excelAttributes = content[i].attribute.split('|');
            const excelValues = content[i].value.split('|');
  
            // Validate Attributes with template
            excelAttributes.forEach((attr, index) => {
              const templateAttributes = template.attributes.find((tem) => tem.name === attr.trim());
              if (templateAttributes && Object.keys(templateAttributes)?.length) {
                attributeSetObj.attributes.push({
                  name: templateAttributes?.name || '',
                  value: excelValues[index].trim() || '',
                  mode: templateAttributes?.mode || '',
                  type: templateAttributes?.type || '',
                  values: templateAttributes?.values || [],
                });
              } else {
                console.error(`Invalid attribute name ${attr.trim()}`, `INVALID_ATTRIBUTE_NAME ${attr.trim()}`);
                return reject({
                  error: `INVALID_ATTRIBUTE_NAME ${attr.trim()}`,
                  message: `Invalid attribute name ${attr.trim()}`,
                  code: 400,
                  success: false,
                });
              }
            });
            attributeSet.push(attributeSetObj);
          }
        }
      }
  
      // Delete old records
      await Fulfiller.deleteMany({
        typeId: opts.typeId,
        categoryId: opts.categoryId,
      });
  
      // Create and save new Fulfillers document
      const newFulfiller = new Fulfiller({
        typeId: opts?.typeId,
        categoryId: opts?.categoryId,
        fulfillers: fulfillers,
        attributeSet: attributeSet,
      });
  
      await newFulfiller.save();
  
      console.log(`Fulfillers Data Imported Successfully for ${opts.categoryId}, ${opts.typeId}`);
      return resolve({
        message: "Import Data Successfully",
        code: 200,
        success: true,
      });
    } catch (error) {
      console.error(error, 'ERROR_IMPORT_FULFILLERS');
      return reject({
        error: error.error || 'ERROR_IMPORT_FULFILLERS',
        message: error.message || 'Something went wrong while data is being imported',
        code: error.code || 500,
        success: false,
      });
    }
  })
}

export const dbFulfillersServices = {
  exportFulfiller,
  importFulfiller,
  newimportFulfiller,
  createFulfiller,
  getFulfillerByType,
  getUserFromLDAP,
  deleteById,
};
