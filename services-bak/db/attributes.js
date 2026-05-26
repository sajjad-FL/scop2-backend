import { logger } from "../../utils/logger.js";
import { Type } from "../../models/type.js";
import { Attribute } from "../../models/attribute.js";

/**
 * Get all  attribute from DB.
 *
 * @method getAttributes
 * @return {Promise} Resolved when the attributes has been retrieved.
 */
function getAttributes() {
  return new Promise(async (resolve, reject) => {
    try {
      // Get all attributes from DB
      const res = await Attribute.find({}).lean();
      // 1.b. Attributes found
      return resolve(res);
    } catch (findErr) {
      // 1.a If error, reject with error
      logger.error(findErr, 'ERROR_DB_FIND_ATTRIBUTES');
      return reject({
        message: 'Internal Server Error',
        code: 500,
        error: 'ERROR_DB_FIND_ATTRIBUTES',
      });
    }
  });
}

/**
 * Creates attributess in DB.
 *
 * @method createAttributes
 * @param {Array} data The attributes data.
 * @return {Promise} Resolved when the attributes has been created.
 */
function createAttributes(data) {
  return new Promise((resolve, reject) => {
    const attributePromises = Object.values(data).map((item) => {
      const instance = new Attribute(item);
      return instance.save().catch((err) => {
        if (err.code === 11000) {
          // Duplicate key error (e.g., attribute already exists)
          return { duplicate: true };
        } else {
          // Other errors
          throw {
            message: 'Internal Server Error',
            code: 500,
            error: 'ERROR_DB_SAVE_ATTRIBUTE',
            original: err,
          };
        }
      });
    });
  
    return Promise.all(attributePromises).then((results) => {
        const hasDuplicates = results.some((result) => result && result.duplicate);
        if (hasDuplicates) {
          return resolve({
            message: 'Attributes creation process completed. Some of the attributes may not have been created due to duplication in attribute name.',
            code: 200,
          });
        }
        return resolve({
          message: 'All attributes created successfully',
          code: 200,
        });
    }).catch((err) => {
      logger.error(err, 'ERROR_DB_SAVE');
      return reject(err);
    });
  })
}

/**
 * Updates attribute in DB.
 *
 * @method updateAttribute
 * @param {Object} opts The attribute properties sent to the DB.
 * @param {String} opts.id The attribute id.
 * @param {Object} opts.data The attribute data .
 * @return {Promise} Resolved when the attribute has been updated.
 */
function updateAttribute(opts) {
  return new Promise(async (resolve, reject) => {
    // 1 Update attribute in DB
    try {
      const filter = {
        _id: opts.id,
      };
      const update = {
        $set: opts.data,
      };
      const res = await Attribute.findOneAndUpdate(filter, update,{ new: true, strict: true, runValidators: true }).lean();
      if (res) {
        // 1.b Attribute has been successfully updated to db
        // 2 Update attribute data in Type
        const typeFilter = {
          'attributes.name': opts.data.name,
          'attributes.mode': 'global',
        };
        const typeUpdate = {
          $set: {
            'attributes.$.name': opts.data.name,
            'attributes.$.type': opts.data.type,
            'attributes.$.value': opts.data.value,
            'attributes.$.values': opts.data.values,
          },
        };
        try {
          await Type.updateMany(typeFilter, typeUpdate, { new: true, strict: true, runValidators: true });
          const result = await Type.find(typeFilter).lean();
          // 2.b Project type has been successfully updated to db
          return resolve(res);
        } catch (err) {
          // 2.a Project type updation in DB failed
          logger.error(err, 'ERROR_DB_UPDATE');
          return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE_Type' });
        }
      }
      return reject({
        message: 'Attribute not found to update',
        error: 'ERROR_TO_UPDATE_ATTRIBUTE',
        code: 204
      })
    } catch (err) {
      // 1.a Attribute updation in DB failed
      logger.error(err, 'ERROR_DB_UPDATE_ATTRIBUTE');
      if (err.code === 11000) {
        return reject({ message: 'Duplicate: Attribute with same name already exist in system', code: 403, error: 'ERROR_DB_UPDATE_ATTRIBUTE' });
      } else {
        return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_UPDATE_ATTRIBUTE' });
      }
    }
  });
}

/**
 * Deletes attributes from DB.
 *
 * @method deleteAttribute
 * @param {String} id The attribute id.
 * @return {Promise} Resolved when the attribute has been removed.
 */
function deleteAttribute(id) {
  return new Promise(async (resolve, reject) => {
    const filter = {
      _id: id,
    };
    try {
      const res = await Attribute.deleteOne(filter).lean();
      // 1.b Attribute successfully deleted from DB
      return resolve(res);
    } catch (err) {
      // 1.a Attribute deletion in DB failed
      logger.error(err, 'ERROR_DB_DELETE_ATTRIBUTE');
      return reject({ message: 'Internal Server Error', code: 500, error: 'ERROR_DB_DELETE_ATTRIBUTE' });
    }
  });
}

export const dbAttributesServices = {
  getAttributes,
  createAttributes,
  updateAttribute,
  deleteAttribute,
};