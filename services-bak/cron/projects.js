import { logger } from './../../utils/logger.js';
import { Project } from './../../models/project.js';
import moment from 'moment';
import cron from 'cron';

export const projectCronServices = () => {
  const job1 = new cron.CronJob('0 0 0 1 * *', (async () => { // It will run at 12:00AM on the first of every month
    try {
      const projectData = await Project.find({ deleteOn: { $lte: moment().utc().toDate() } }).lean();
      projectData.forEach((item) => {
        const opts = {
          projectIdOrKey: item.projectID,
        };
      });
    } catch (error) {
      logger.error(err, 'ERROR_DBPROJECT_DELETE');
    }
  }), null, false, 'Asia/Kolkata');
  job1.start();
};
