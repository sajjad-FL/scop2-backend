import cron from 'cron';
import { logger } from '../../utils/logger.js';
import { ProjectRequest } from '../../models/project-request.js';
import { jiraProjectRequestsServices } from '../jira/project-requests.js';
import { DataTransferRequest } from '../../models/data-transfer-request.js';
import { jiraDataTransferRequestServices } from '../jira/data-transfer-request.js';

export const requestMailStatusServices = () => {
  const job1 = new cron.CronJob('0 * * * *', (async () => { // It will run every hour
    try {
      const projectRequestData = await ProjectRequest.find({ emailStatus: false }).lean();
      try {
        await Promise.all(projectRequestData.map((pRequest) => {
          return new Promise(async (resolve, reject) => {
            try {
              await jiraProjectRequestsServices.sendEmailToFulfillers(pRequest, pRequest.fulfillers, pRequest.createdBy);
              await ProjectRequest.findByIdAndUpdate(pRequest._id, { emailStatus: true }, { new: true, strict: true, runValidators: true });
              logger.info({ message: `Email Sent successfully through cron to this project request id: ${pRequest.displayId}`});
              return resolve({ message: 'Email sent successfully from cron fulfillers', code: 200 });
            } catch (error) {
              logger.error({ message: `Failed to to sent email to this project request id: ${pRequest.displayId}`, error});
              return reject({ message: 'Failed to sent email to fulfillers', code: 400 });
            }
          });
        }))
      } catch (pREmailError) {
        logger.error({ message: 'Failed to to sent email to fulfillers', pREmailError });
      }
    } catch (pRErr) {
      logger.error(pRErr, 'FAILED_TO_FIND_PROJECT_REQUEST');
    }

    try {
      const dtrData = await DataTransferRequest.find({ emailStatus: false }).lean();
      try {
        await Promise.all(dtrData.map((dtr) => {
          return new Promise(async (resolve, reject) => {
            try {
              let dMails = [];
              dMails = await jiraDataTransferRequestServices.delegateMails(dtr.customFields);
              await jiraDataTransferRequestServices.sendEmailToApprovers(dtr, dtr?.approversData?.approvers, dtr?.createdBy, 'APPROVERS_MAIL', [{...dtr?.createdBy}, ...dMails]);
              await DataTransferRequest.findByIdAndUpdate(dtr._id, { emailStatus: true }, { new: true, strict: true, runValidators: true });
              logger.info({ message: `Email Sent successfully through cron to this dtrID: ${dtr.displayId}`});
              return resolve({ message: 'Email sent successfully', code: 200 });
            } catch (error) {
              logger.error({ message: `Failed to to sent email to this dtrID: ${dtr.displayId}`, error});
              return reject({ message: 'Failed to sent email to approvers', code: 400 });
            }
          });
        }))
      } catch (dtrEmailError) {
        logger.error({ message: 'Failed to to sent email to approvers', dtrEmailError });
      }
    } catch (dtrError) {
      logger.error(dtrError, 'FAILED_TO_FIND_DTR_PROJECT');
    }
  }), null, false, 'Asia/Kolkata');
  job1.start();
};
