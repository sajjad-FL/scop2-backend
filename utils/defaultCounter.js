import { Counter } from '../models/counter.js'
import { logger } from './logger.js'

export const defaultCounter = async () => {
  // PROJECT TYPE
  try {
    const count = await Counter.countDocuments({ type: 'projectID' }).lean();
    if (count > 0) {
      return;
    }
    const doc = {
      type: 'projectID',
      count: 1000000,
    };
    const instance = new Counter(doc);
    const res = await instance.save();
    logger.info(res, 'ADDED_PROJECT_COUNT');
  } catch (error) {
    logger.error(error, 'FAILED_TO_SAVE_OR_GET_PROJECT_COUNT');
  }

  //REQUEST TYPE
  try {
    const count = await Counter.countDocuments({ type: 'requestID' }).lean();
    if (count > 0) {
      return;
    }
    const doc = {
      type: 'requestID',
      count: 1,
    };
    const instance = new Counter(doc);
    const res = await instance.save();
    logger.info(res, 'ADDED_PHR_COUNT');
  } catch (error) {
    logger.error(error, 'FAILED_TO_SAVE_OR_GET_PHR_COUNT');
  }

  // DTR TYPE
  try {
    const count = await Counter.countDocuments({ type: 'dtrID' }).lean();
    if (count > 0) {
      return;
    }
    const doc = {
      type: 'dtrID',
      count: 1,
    };
    const instance = new Counter(doc);
    const res = await instance.save();
    logger.info(res, 'ADDED_DTR_COUNT');
  } catch (error) {
    logger.error(error, 'FAILED_TO_SAVE_OR_GET_DTR_COUNT');
  }
}
