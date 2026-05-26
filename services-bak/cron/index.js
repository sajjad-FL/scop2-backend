import { logger } from "../../utils/logger.js";
import { projectCronServices } from "../../services-bak/cron/projects.js";
import { requestMailStatusServices } from "../../services-bak/cron/request-mail-status.js";

export const loadScheduledJobs = () => {
  try {
    projectCronServices();
    requestMailStatusServices();
  } catch (error) {
    logger.error('FAILED_TO_LOAD_SCHEDULED_JOBS');
  }
}
