import { Preference } from '../../models/preferences.js';
import TablePreferences from '../../models/table-preferences.js';
import { Type } from '../../models/type.js';
import { logger } from './../../utils/logger.js';
import mongoose from 'mongoose';

function updateUserPreference(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const { userId, projectTable: updatedProjectTable } = opts;
  
      // Find the user's preference document
      let preference = await Preference.findOne({ userId }).lean();
      let isInitialValue = false;
  
      // If the preference document doesn't exist, create a new one
      if (!preference) {
        preference = new Preference({ userId, projectTable: [] });
        isInitialValue = true;
      }
  
      // Update the existing preference document
      for (const newProject of updatedProjectTable) {
        const { categoryId, templateId, columns } = newProject;
        let templateName;
        if(templateId === "All"){
          templateName = "All"
        } else{
          // Fetch the template name
          const template = await Type.findById(templateId).select('name').lean();
          templateName = template.name;
        }

        // Find the existing projectTable entry by categoryId and templateName
        const existingEntryIndex = preference.projectTable.findIndex(
          item => item.categoryId.toString() === categoryId.toString() &&
                  item.templateName === templateName
        );
  
        if (existingEntryIndex > -1) {
          // Update the existing entry
          preference.projectTable[existingEntryIndex].columns = columns;
        } else {
          // Push new entry if it does not exist
          preference.projectTable.push({ ...newProject, templateName });
        }
      }
  
      const update = {
        $set: {
          projectTable: preference.projectTable,
        },
      }
      if (isInitialValue) {
        await preference.save();
      } else {
        await Preference.findOneAndUpdate({ userId }, update, { new: true, strict: true, runValidators: true });
      }
  
      return resolve({ message: 'User preference updated successfully' });
    } catch (error) {
      logger.error(error, 'ERROR_UPDATING_USER_PREFERENCE');
      const formattedError = {
        message: 'Error updating user preference',
        code: 500,
        error: 'ERROR_UPDATING_USER_PREFERENCE',
      };
      return reject(formattedError);
    }
  })
}

function getUserPreference(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const query = { userId: new mongoose.Types.ObjectId(opts.userId) };
  
      // Apply optional filters
      if (opts.categoryId) {
        query['projectTable.categoryId'] = opts.categoryId;
      }
      let templateName;
      if (opts.templateId) {
        if(opts.templateId === "All"){
            templateName = "All"
        } else{
            // Fetch the template name using templateId
            const template = await Type.findById(opts.templateId).select('name').lean();
            if (template && template.name) {
                templateName = template.name
            }
        }
        query['projectTable.templateName'] = templateName;
      }

      const matchStage = {
        $match: query
      };

      const projectStage = {
        $project: {
          projectTable: {
            $filter: {
              input: '$projectTable',
              as: 'project',
              cond: {
                $and: [
                  { $eq: ['$$project.categoryId', opts.categoryId ? opts.categoryId : '$$project.categoryId'] },
                  { $eq: ['$$project.templateName', templateName || '$$project.templateName'] }
                ]
              }
            }
          }
        }
      };
  
      const preference = await Preference.aggregate([matchStage, projectStage]);
  
      // If preference not found
      if (!preference?.length) {
        return reject({
          message: 'User preference not found',
          code: 200,
          data: [],
        });
      }    
      return resolve({
        message: 'User preference found',
        code: 200,
        data: preference[0]?.projectTable[0]?.columns || [],
      });
    } catch (error) {
      logger.error(error, 'ERROR_GETTING_USER_PREFERENCE');
      return reject({
        message: 'Error fetching user preference',
        code: 500,
        error: 'ERROR_FETCHING_USER_PREFERENCE',
      });
    }
  })
}

async function updateTableWidth(opts) {
  const { userId, tableName, columns } = opts;
  if (!userId || !tableName || !columns) {
    return reject({
      message: 'Error in updating table column width',
      code: 500,
      error: 'ERROR_IN_UPDATING_USER_COL_WIDTH',
    });
  }
  try {
    const updatedPrefs = await TablePreferences.findOneAndUpdate(
      { userId, tableName },
      { $set: { columns } },
      { upsert: true, new: true }
    );
    return ({
      message: 'table width updated',
      code: 200,
      data: updatedPrefs,
    });
  } catch (error) {
    console.log("error", error)
    return ({
      message: 'Error in updating table column width',
      code: 500,
      error: 'ERROR_IN_UPDATING_USER_COL_WIDTH',
    });
  }
}

async function getTableWidth(opts) {
  const { userId, tableName } = opts || {};
  try {
    const prefs = await TablePreferences.findOne({ userId, tableName });
    return prefs || [];
    // res.json(prefs || {});
  } catch (error) {
    console.log({ error })
    return []
  }
}
   
export const jiraUserPreferenceServices =  {
  updateUserPreference,
  getUserPreference,
  updateTableWidth,
  getTableWidth
};
