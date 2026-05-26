import { globalFailAction } from "../../utils/helper.js";
import { jiraCaseStudyApproversServices } from "../../services-bak/jira/case-study-approvers.js";
import { createCaseStudyApproversPayloadSchema, deleteCaseStudyApproversParamsChema, getCaseStudyApproversQuerySchema } from "../../validators/jiraCaseStudyApproversValidators.js";

export const createCaseStudyApprovers = {
  path: '/api/v1/jira/casestudy/approvers',
  method: 'POST',
  config: {
    description: 'Create Case Study Approvers',
    tags: ['api', 'Case study approvers'],
    auth: 'jwt',
    payload: {
      maxBytes: 100000000,
      parse: true,
    },
    validate: {
      payload: createCaseStudyApproversPayloadSchema,
      failAction: globalFailAction
    },
    notes: ['Create Approvers', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = { payload: request.payload };
      const response = await jiraCaseStudyApproversServices.createCaseStudyApprover(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const getCaseStudyApprovers = {
  path: '/api/v1/jira/casestudy/approvers/',
  method: 'GET',
  config: {
    description: 'Get Case Study Approvers',
    tags: ['api', 'Case study approvers'],
    auth: 'jwt',
    validate: {
      query: getCaseStudyApproversQuerySchema,
      failAction: globalFailAction
    },
    notes: ['Get Approvers', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const sort = request.query.sortDirection || '';
      const opts = {
        query: request.query.q,
        perPage: request.query.perPage ? Number(request.query.perPage) : 10,
        page: request.query.page ? Number(request.query.page) : 0,
      };
      const response = await jiraCaseStudyApproversServices.getCaseStudyApprovers(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const deleteCaseStudyApprovers = {
  path: '/api/v1/jira/casestudy/approvers/{value}',
  method: 'DELETE',
  config: {
    description: 'Delete Case Study Approver',
    tags: ['api', 'Case study approvers'],
    auth: 'jwt',
    validate: {
      params: deleteCaseStudyApproversParamsChema,
      failAction: globalFailAction
    },
    notes: ['Delete Approver', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        value: request.params.value,
      };
      const response = await jiraCaseStudyApproversServices.deleteCaseStudyApprovers(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};
