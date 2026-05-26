import { CaseStudyApprover } from "../../models/case-study-approvers.js";
import { logger } from "../../utils/logger.js";

function createCaseStudyApprover(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      const caseStudyApprovers = await CaseStudyApprover.findOne({ value: opts?.payload?.value }).lean();
      if (caseStudyApprovers) {
        const updateCaseStudyAprovers = await CaseStudyApprover.findOneAndUpdate({ _id: caseStudyApprovers?._id }, { $set: { ...opts.payload }}, { new: true, strict: true, runValidators: true }).lean();
        return resolve({
          status: 200,
          message: 'Approvers Data added successfully',
          data: updateCaseStudyAprovers || []
        });
      } else {
        const instance = new CaseStudyApprover(opts.payload);
        const data = await instance.save();
        return resolve({
          status: 200,
          message: 'Approvers Data added successfully',
          data
        });
      }
    } catch (error) {
      logger.error(error, 'FAILED_TO_ADD_OR_UPDATE_CASE_STUDY_APPROVERS');
      return reject({
        status: 400,
        message: 'Failed to add or update case study approvers',
      });
    }
  });
}

function getCaseStudyApprovers(opts) {
  return new Promise(async (resolve, reject) => {
    const { page, perPage } = opts;
    const skip = page && perPage ? (page - 1) * perPage : 0;
    const limit = perPage || 10;
    try {
      const result = await CaseStudyApprover.aggregate([
        {
          $facet: {
            metadata: [
              { $count: "totalRecords" }
            ],
            data: [
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  value: 1,
                  approvers: 1,
                  _id: 0
                }
              }
            ]
          }
        }
      ]);
      const totalRecords = result[0].metadata.length > 0 ? result[0].metadata[0].totalRecords : 0;
      const data = result[0].data;
      return resolve({
        status: 200,
        message: 'Approvers fetched successfully by template ID',
        data: data || [],
        totalRecords,
      });
    } catch (err) {
      logger.error(err, 'ERROR_IN_FIND_APPROVERS');
      return reject({
        message: 'Failed to fetch case study approvers',
        status: 400,
      });
    }
  })
}

function deleteCaseStudyApprovers(opts) {
  return new Promise(async (resolve, reject) => {
    try {
      if (opts.auth?.isSuperAdmin || opts?.auth.isAdmin) {
        await CaseStudyApprover.deleteOne({ value: opts?.value });
        return resolve({
          status: 200,
          message: 'Approver deleted successfully',
        });
      }
      logger.error(error, 'ACCESS_DENIED_ONLY_ADMINS_CAN_DELETETHE CASE_STUDY_APPROVERS');
      return reject({
        status: 400,
        message: 'Access Denied: Only Admins can delete the case study approvers',
      })
    } catch(error) {
      logger.error(error, 'FAILED_TO_DELETE_CASE_STUDY_APPROVERS');
      return reject({
        status: 400,
        message: 'Failed to delete case study approvers',
      });
    }
  })
}

export const jiraCaseStudyApproversServices = {
  createCaseStudyApprover,
  getCaseStudyApprovers,
  deleteCaseStudyApprovers,
};