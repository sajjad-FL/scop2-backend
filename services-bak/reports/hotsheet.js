import { Hotsheet } from "../../models/hotsheet.js";



/**
 * Get all hotsheetTemplates from DB.
 *
 * @method getHotsheetTemplates
 * @return {Promise} Resolved when all the hotsheet templates has been retrieved.
 */
function getHotsheetTemplates() {
  return new Promise(async (resolve, reject) => {
    // Get all hotsheet templates from DB
    try {
      const res = await Hotsheet.find({}).lean();
      // 1.b. Hotsheet templates found
      return resolve(res);
    } catch (findErr) {
      // 1.a If error, reject with error
      logger.error(findErr, 'ERROR_DB_FIND_HOTSHEET_TEMPLATES');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_HOTSHEET_TEMPLATES',
      });
    }
  });
}

/**
 * Creates hotsheet template for reports.
 *
 * @method createHotsheetTemplate
 * @param {Object} data The hotsheet template data.
 * @param {String} opts.name The hotsheet template nameattribute id.
 * @param {Object} opts.fields The hotsheet template fields .
 * @return {Promise} Resolved when the hotsheet template has been created.
 */
function createHotsheetTemplate(data) {
  return new Promise(async (resolve, reject) => {
    // 1 Create hotsheet template in DB
    try {
      const instance = new Hotsheet(data);
      // 1 Save the hotsheet template in 
      const res= await instance.save();
      return resolve(res);
    } catch (error) {
      // 1.a Hotsheet template creation in DB failed
      logger.error(err, 'ERROR_DB_SAVE');
      if (err.code === 11000) {
        return reject({ message: 'Duplicate: Hotsheet template with same name already exist in system', code: 403, error: 'ERROR_DB_SAVE' });
      } else {
        return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_SAVE' });
      }
    }
  });
}

/**
 * Updates hotsheet template in DB.
 *
 * @method updateHotsheetTemplate
 * @param {Object} opts The hotsheet template properties sent to the DB.
 * @param {String} opts.id The hotsheet template id.
 * @param {Object} opts.data The hotsheet template data .
 * @return {Promise} Resolved when the hotsheet template has been updated.
 */
function updateHotsheetTemplate(opts) {
  return new Promise(async (resolve, reject) => {
    // 1 Updates hotsheet template in DB
    try {
      const filter = {
        _id: opts.id,
      };
      const update = {
        $set: opts.data,
      };
      const res = await Hotsheet.findOneAndUpdate(filter, update, { new: true, strict: true, runValidators: true }).lean();
      // 1.b Hotsheet template has been successfully updated to db
      return resolve(res);
    } catch (err) {
      // 1.a Hotsheet template updation in DB failed
      logger.error(err, 'ERROR_DB_UPDATE_HOTSHEET_TEMPLATE');
      if (err?.code === 11000) {
        return reject({ message: 'Duplicate: Hotsheet template with same name already exist in system', code: 403, error: 'ERROR_DB_UPDATE_HOTSHEET_TEMPLATE' });
      } else {
        return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE_HOTSHEET_TEMPLATE' });
      }
    }
  });
}

/**
 * Deletes hotsheet template from DB.
 *
 * @method deleteHotsheetTemplate
 * @param {String} id The attribute id.
 * @return {Promise} Resolved when the attribute has been removed.
 */
function deleteHotsheetTemplate(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const filter = {
        _id: id,
      };
      // 1 Delete hotsheet template from DB
      // 1.b Hotsheet template successfully deleted from DB
      const res = await Hotsheet.deleteOne(filter).lean()
      return resolve(res);
    } catch (error) {
      // 1.a Hotsheet template deletion in DB failed
      logger.error(err, 'ERROR_DB_DELETE_HOTSHEET_TEMPLATE');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_DELETE_HOTSHEET_TEMPLATE' });
    }
  });
}

function getHotSheetById(hotsheetId) {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await Hotsheet.findById(hotsheetId);
      return resolve(data);
    } catch (err) {
      logger.error(err, 'ERROR_DB_FETCHING_HOTSHEET_TEMPLATE');
      return reject(err);
    }
  })
}

export const reportsHotsheetServices = {
  getHotsheetTemplates,
  createHotsheetTemplate,
  updateHotsheetTemplate,
  deleteHotsheetTemplate,
  getHotSheetById,
};
