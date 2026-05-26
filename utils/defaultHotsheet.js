import { Hotsheet } from '../models/hotsheet.js';
import { logger } from './logger.js';

export const defaultHotsheet = async () => {
  try {
    const count = await Hotsheet.countDocuments().lean();
    if (count > 0) {
      return;
    }
    const doc = {
      name: 'Default',
      fields: [
        'Name',
        'Description',
        'Department',
        'Lead',
        'Status',
        'Function',
        'Start Date',
        'Estimated End Date',
        'Collaborators',
      ],
    };
    const instance = new Hotsheet(doc);
    const res = await instance.save();
    logger.info(res, 'ADDED_DEFAULT_HOTSHEET');
  } catch (error) {
    logger.error(error, 'ERROR_DB_SAVE');
  }
}
