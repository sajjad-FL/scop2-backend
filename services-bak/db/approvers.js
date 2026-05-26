import exceljs from 'exceljs';
import { logger } from '../../utils/logger.js';
import { Approver } from "../../models/approvers.js";
import { DTRTemplate } from "../../models/dtr-template.js";
import { convertStringToArray, extractEmailFromArray } from '../../utils/helper.js';
import { approverValidatorSchema } from '../../validators/dbApproversValidator.js';
import { dbFulfillersServices } from './fulfillers.js';

function exportApprover(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const approverQuery = {
        typeId: opts.typeId,
        $expr: { $gt: [{ $size: "$attributeSet" }, 0] },
      };
      const defaultApproverQuery = {
        typeId: opts.typeId,
        attributeSet: { $size: 0 },
      };
      const approverData = await Approver.find(approverQuery).select("-_id -createdAt -updatedAt -typeId -__v").lean();
      const defaultAprrover = await Approver.findOne(defaultApproverQuery).select("-_id -createdAt -updatedAt -typeId -__v").lean();
      if (opts.type !== "EXCEL" && defaultAprrover) {
        approverData.push(defaultAprrover);
      }

      let defaultApproverData;
      if (defaultAprrover) {
        const emails = extractEmailFromArray(defaultAprrover.defaultApprovers, "email");
        defaultApproverData = emails?.length ? emails.join(', ') : '-'
      } else {
        defaultApproverData = '-'
      }

      // Extract 'email' from collaborators, lead, and approvers arrays
      approverData.forEach((doc) => {
        if (doc) {
          if (opts.type === "EXCEL") {
            doc.attributes = extractEmailFromArray(doc.attributeSet, "name").join("|");
            doc.values = extractEmailFromArray(doc.attributeSet, "value").join("|");
            doc.collaborators = extractEmailFromArray(doc.collaborators, "email")?.length
              ? extractEmailFromArray(doc.collaborators, "email").join(", ")
              : "-";
            doc.lead = extractEmailFromArray(doc.lead, "email")?.length
              ? extractEmailFromArray(doc.lead, "email").join(", ")
              : "-";
            doc.approvers = extractEmailFromArray(doc.approvers, "email")
              ?.length
              ? extractEmailFromArray(doc.approvers, "email").join(", ")
              : "-";
            doc.defaultApprovers = defaultApproverData;
            delete doc.attributeSet;
          } else {
            doc.collaborators = extractEmailFromArray(doc.collaborators, "email");
            doc.lead = extractEmailFromArray(doc.lead, "email");
            doc.approvers = extractEmailFromArray(doc.approvers, "email");
            doc.defaultApprovers = extractEmailFromArray(doc.defaultApprovers, "email");
            doc.attributeSet = doc.attributeSet.map((attr) => ({ name: attr.name, value: attr.value }));
          }
        }
      });

      if (approverData) {
        return resolve({
          data: approverData,
          code: 200,
          message: "Approvers exported successfully",
          success: true,
        });
      } else {
        logger.error("No Approvers assigned to given template");
        return resolve({
          message: "No Approvers assigned to given Template.",
          code: 404,
          success: true,
        });
      }
    } catch (error) {
      logger.error(error, "ERROR_EXPORT_APPROVERS");
      return reject({
        error: "ERROR_EXPORT_APPROVERS",
        message: "Failed to export approvers data.",
        code: 500,
        success: false,
      });
    }
  });
}

function importApprover(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      let content = opts.file;
      const type = opts.type;
      const buffers = [];

      for await (const chunk of content) {
        buffers.push(chunk);
      }

      const fileBuffer = Buffer.concat(buffers);
      if (type === 'JSON') {
        const jsonString = fileBuffer.toString('utf-8'); // convert buffer to string
        content = JSON.parse(jsonString); 
      }
      if (type === 'EXCEL') {
        try {
          const workbook = new exceljs.Workbook();
          await workbook.xlsx.load(fileBuffer);
          const result = [];

          // Assuming you have only one sheet in the Excel file, if there are multiple sheets, use workbook.getWorksheet to get the desired sheet
          const sheet = workbook.getWorksheet(1);

          // Iterate through rows and columns to get the data
          sheet.eachRow((row, rowNumber) => {
            const rowData = {};
            row.eachCell((cell, colNumber) => {
              // Assign each cell value to the corresponding column name
              const columnName = sheet.getCell(1, colNumber).value;
              rowData[columnName] = cell.value;
            });

            // Skip the header row
            if (rowNumber > 1) {
              result.push(rowData);
            }
          });

          // Display the JSON data
          content = JSON.parse(JSON.stringify(result, null, 2));
        } catch (error) {
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
      } else {
        const template = await DTRTemplate.findById(opts.typeId).lean();
        if (template) {
          const responseData = [];
          let defaultApprovers = [];
          for (let i = 0; i < content.length; i++) {
            if (type === 'EXCEL') {
              content[i].approvers = convertStringToArray(content[i].approvers);
              content[i].lead = convertStringToArray(content[i].lead);
              content[i].collaborators = convertStringToArray(content[i].collaborators);
              defaultApprovers = [...convertStringToArray(content[i].defaultApprovers)];
              const excelAttributes = content[i].attributes.split('|');
              const excelValues = content[i].values.split('|');
              content[i].attributeSet = [];
              excelAttributes.forEach((attr, index) => {
                const templateAttributes = template.attributes.find((tem) => tem.name === attr.trim());
                if (templateAttributes && Object.keys(templateAttributes)?.length) {
                  content[i].attributeSet.push({
                    name: templateAttributes?.name || '',
                    value: excelValues[index].trim() || '',
                    mode: templateAttributes?.mode || '',
                    type: templateAttributes?.type || '',
                    values: templateAttributes?.values || [],
                  });
                } else {
                  return reject({
                    error: `INVALID_ATTRIBUTE_NAME_${attr.trim()}`,
                    message: `Invalid attribute name ${attr.trim()}`,
                    code: 404,
                    success: false,
                  });
                }
              });
              delete content[i].attributes;
              delete content[i].values;
              delete content[i].defaultApprovers;
            }
            if (opts.type === 'JSON') {
              const contentAttributes = _.cloneDeep(content[i].attributeSet);
              content[i].attributeSet = [];
              contentAttributes.forEach((attr) => {
                const templateAttributes = template.attributes.find((tem) => tem.name === attr.name.trim());
                if (templateAttributes && Object.keys(templateAttributes)?.length) {
                  content[i].attributeSet.push({
                    name: templateAttributes?.name || '',
                    value: attr.value.trim() || '',
                    mode: templateAttributes?.mode || '',
                    type: templateAttributes?.type || '',
                    values: templateAttributes?.values || [],
                  })
                } else {
                  return reject({
                    error: `INVALID_ATTRIBUTE_NAME_${attr.name.trim()}`,
                    message: `Invalid attribute name ${attr.name.trim()}`,
                    code: 404,
                    success: false,
                  });
                }
              }) || [];
            }
            const validationResult = approverValidatorSchema.validate(content[i]);
            if (validationResult.error) {
              return reject({
                status: 400,
                message: "Invalid JSON format",
                error: validationResult.error,
              });
            }
            const validatingAttributeData = content[i].attributeSet.filter(async (attr) => {
              const templateAttributes = template.attributes.find((tem) => tem.name === attr.name && tem.type === attr.type);
              if (['DROPDOWN', 'LIST', 'LISTMANY'].includes(attr.type)) {
                if (templateAttributes && Object.keys(templateAttributes)?.length && templateAttributes.values.includes(attr.value)) {
                  return true;
                }
                return reject({
                  error: `INVALID_VALUE(${attr.value})FOR_THIS_ATTRIBUTE(${attr.name.trim()})`,
                  message: `Invalid Value(${attr.value})for this attribute ${attr.name.trim()}`,
                  code: 404,
                  success: false,
                });
              } else if (attr.type === 'LDAP') {
                try {
                  const data = await dbFulfillersServices.getUserFromLDAP(attr.value);
                  return data && Object.keys(data)?.length;
                } catch (error) {
                  return reject({
                    error: `INVALID_USER(${attr.value})_NOT_FOUND_IN_LDAP_FOR_THIS_ATTRIBUTE(${attr.name.trim()})`,
                    message: `Invalid user(${attr.value})not found in LDAP for this attribute ${attr.name.trim()}`,
                    code: 404,
                    success: false,
                  });
                }
              } else if (attr.type === 'LDAPMANY') {
                let dEmail = ''
                try {
                  const excelLdapManyData = attr.value.split(', ');
                  const ldapManyData = await Promise.all(excelLdapManyData.map(async (email) => {
                    try {
                      const lData = await dbFulfillersServices.getUserFromLDAP(
                        email.split('(')[1].split(')')[0]
                      );
                      return lData;
                    } catch (error) {
                      dEmail = email;
                      throw error;
                    }
                  }))
                  return ldapManyData?.length === excelLdapManyData?.length;
                } catch (error) {
                  return reject({
                    error: `INVALID_USER(${dEmail})_NOT_FOUND_IN_LDAP_FOR_THIS_ATTRIBUTE(${attr.name.trim()})`,
                    message: `Invalid user(${dEmail})not found in LDAP for this attribute ${attr.name.trim()}`,
                    code: 404,
                    success: false,
                  });
                }
              } else {
                return templateAttributes && Object.keys(templateAttributes)?.length;
              }
            });
            if (validatingAttributeData?.length !== content[i].attributeSet?.length) {
              return reject({
                status: 400,
                message: "Invalid attributes and values",
              });
            }
            const keyArr = Object.keys(content[i]);
            const approverData = {};
            for (let j = 0; j < keyArr.length; j++) {
              if (!['attributeSet', 'isDeleted'].includes(keyArr[j])) {
                let dEmail = '';
                try {
                  const emailData = await Promise.all(
                    content[i][`${keyArr[j]}`].map(async (email) => {
                      try {
                        const data =
                          await dbFulfillersServices.getUserFromLDAP(
                            email
                          );
                        return data;
                      } catch (error) {
                        dEmail = email;
                        throw error;
                      }
                    })
                  );
                  approverData[`${keyArr[j]}`] = emailData;
                } catch (error) {
                  return reject({
                    error: `${dEmail.toUpperCase()}_NOT_FOUND_IN_LDAP`,
                    message: `${dEmail} not found in LDAP`,
                    code: 404,
                    success: false,
                  });
                }
                
              } else {
                approverData[`${keyArr[j]}`] = content[i][`${keyArr[j]}`];
              }
            }
            responseData.push({
              ...approverData,
              typeId: opts.typeId,
            });
          }
          let defaultEmailData = [];
          if (defaultApprovers?.length && type === 'EXCEL') {
            let defaultEmail = '';
            try {
              defaultEmailData = await Promise.all(
                defaultApprovers.map(async (email) => {
                  try {
                    const data =
                    await dbFulfillersServices.getUserFromLDAP(email);
                    return data;
                  } catch (error) {
                    defaultEmail = email;
                    throw error;
                  }
                })
              );
            } catch (error) {
              return reject({
                error: `${defaultEmail.toUpperCase()}_NOT_FOUND_IN_LDAP`,
                message: `${defaultEmail} not found in LDAP`,
                code: 404,
                success: false,
              });
            }
          }
          if (responseData?.length === content.length) {
            await Approver.deleteMany({ typeId: opts.typeId });
            if (defaultEmailData?.length) {
              const instance = new Approver({
                defaultApprovers: [...defaultEmailData],
                typeId: opts.typeId,
              });
              await instance.save();
            }
            await Approver.insertMany(responseData);
            return resolve({
              message: "Import Data Successfully",
              code: 200,
              success: true,
            });
          } else {
            logger.error( "FAILED_TO_APPROVER_DATA");
            return reject({
              error: "FAILED_TO_APPROVER_DATA",
              message: "Failed to import approver data.",
              code: 404,
              success: false,
            });
          }
        } else {
          logger.error("ERROR_FIND_APPROVER_TEMPLATE");
          return reject({
            error: "ERROR_FIND_APPROVER_TEMPLATE",
            message: "Invalid DTR template",
            code: 404,
            success: false,
          });
        }
      }
    } catch (error) {
      logger.error(error, "FAILED_TO_APPROVER_DATA");
      reject({
        error: "FAILED_TO_APPROVER_DATA",
        message: "Failed to import approver data.",
        code: 500,
        success: false,
      });
    }
  });
}

export const dbApproversServices = {
  exportApprover,
  importApprover,
};
