import _ from 'lodash';
import {
  createProjectRequestPayloadSchema,
  getAllProjectRequestsQuerySchema,
  updateProjectRequestPayloadSchema,
  getProjectsForReportsQuerySchema,
  idParamsSchema,
} from '../../validators/jiraProjectRequestsValidators.js';
import { jiraProjectRequestsServices } from '../../services-bak/jira/project-requests.js';
import { globalFailAction } from '../../utils/helper.js';


export const createProjectRequest = {
  method: 'POST',
  path: '/api/v1/jira/project-requests',
  options: {
    description: 'Create Project Request',
    tags: ['api', 'Post-HOC requests'],
    auth: 'jwt',
    payload: {
      maxBytes: 120000000,
      parse: true,
    },
    validate: {
      payload: createProjectRequestPayloadSchema,
    },
    notes: ['Create Project Request', 'ADMIN ACCESS REQUIRED'],
    handler: async (request, h) => {
      try {
        const opts = { project: request.payload };
        const result = await jiraProjectRequestsServices.createProjectRequest(opts, request.jiraAuth);
        return h.response(result).code(200);
      } catch (error) {
        return h.response(error).code(500);
      }
    },
  },
};

export const getAllProjectRequests = {
  method: 'GET',
  path: '/api/v1/jira/project-requests',
  options: {
    description: 'Get Projects',
    tags: ['api', 'Post-HOC requests'],
    auth: {
      strategy: 'jwt',
      mode: 'optional',
    },
    validate: {
      query: getAllProjectRequestsQuerySchema,
      failAction: globalFailAction,
    },
    handler: async (request, h) => {
      try {
        const { sortDirection = '', perPage = 10, page, sortBy, q } = request.query;

        if (!request.jiraAuth) {
          return h.response({ code: 401, error: 'Unauthorized', message: 'Missing authentication' }).code(401);
        }

        const opts = {
          query: q,
          perPage: Number(perPage),
          page: page === 'all' ? 'all' : Number(page) || 0,
          sortBy,
          sort: sortDirection === 'asc' ? 1 : sortDirection === 'desc' ? -1 : 0,
        };

        const result = await jiraProjectRequestsServices.jiraGetAllProjectRequests(opts);
        return h.response(result).code(200);
      } catch (error) {
        return h.response(error).code(500);
      }
    },
  },
};

export const updateProjectRequest = {
  method: 'PUT',
  path: '/api/v1/jira/project-requests/{id}',
  options: {
    description: 'Update Project Request',
    tags: ['api', 'Post-HOC requests'],
    auth: 'jwt',
    validate: {
      payload: updateProjectRequestPayloadSchema,
    },
    notes: ['Updates a existing project request', 'ADMIN ACCESS REQUIRED'],
    handler: async (request, h) => {
      try {
        const opts = {
          requestID: request.params.id,
          payload: request.payload,
        };
        const result = await jiraProjectRequestsServices.updateProjectRequest(opts, request.jiraAuth);
        return h.response(result).code(200);
      } catch (error) {
        return h.response(error).code(error.code || 400);
      }
    },
  },
};

export const getProjectsForReports = {
  method: 'GET',
  path: '/api/v1/jira/project-requests/reports',
  options: {
    description: 'Get Projects For Reports',
    tags: ['api', 'Post-HOC requests'],
    auth: 'jwt',
    validate: {
      query: getProjectsForReportsQuerySchema,
      failAction: globalFailAction
    },
    handler: async (request, h) => {
      try {
        const q = request.query;
        const opts = {
          auth: request.jiraAuth,
          page: Number(q.page),
          perPage: Number(q.perPage),
          query: q.q,
          showAll: q.showAll,
          quarter: q.quarter,
          category: `${q.category}-TA`,
          template: q.template,
          startDate: q.startDate,
          endDate: q.endDate,
          startDateR1: q.startDateR1,
          startDateR2: q.startDateR2,
          endDateR1: q.endDateR1,
          endDateR2: q.endDateR2,
          endDateOr: q.endDateOr,
          queryLanguage: q.qL,
        };

        if (q.filters) {
          opts.filters = q.filters.split(',').map(str => {
            const [key, val] = str.split(':');
            return { [_.camelCase(key)]: val };
          });
        }

        const result = await jiraProjectRequestsServices.getProjectRequests(opts);
        return h.response(result).code(result.code || 200);
      } catch (error) {
        return h.response(error).code(error.code || 400);
      }
    },
  },
};

export const getProjectRequestById = {
  method: 'GET',
  path: '/api/v1/jira/project-requests/{id}',
  options: {
    description: 'Get Project request by id or key',
    tags: ['api', 'Post-HOC requests'],
    auth: 'jwt',
    validate: {
      params: idParamsSchema,
    },
    handler: async (request, h) => {
      try {
        const opts = { requestId: request.params.id };
        const result = await jiraProjectRequestsServices.getProjectRequestById(opts, request.jiraAuth);
        return h.response(result).code(200);
      } catch (error) {
        return h.response(error).code(error.code || 400);
      }
    },
  },
};

export const deleteProjectRequest = {
  method: 'DELETE',
  path: '/api/v1/jira/project-requests/{id}',
  options: {
    description: 'Delete Project',
    tags: ['api', 'Post-HOC requests'],
    auth: 'jwt',
    validate: {
      params: idParamsSchema,
    },
    handler: async (request, h) => {
      try {
        const opts = {
          auth: request.jiraAuth,
          requestId: request.params.id,
        };
        const result = await jiraProjectRequestsServices.deleteProjectRequest(opts);
        return h.response(result).code(result.code || 200);
      } catch (error) {
        return h.response(error).code(error.code || 400);
      }
    },
  },
};

export const resendEmailToFulfillers = {
  method: 'GET',
  path: '/api/v1/jira/project-requests/resend-email/{id}',
  options: {
    description: 'Resend the email to Project Request Fulfillers',
    tags: ['api', 'Post-HOC requests'],
    auth: 'jwt',
    notes: ['Resend Project Request Email', 'ADMIN ACCESS REQUIRED'],
    handler: async (request, h) => {
      try {
        const opts = { requestID: request.params.id };
        const result = await jiraProjectRequestsServices.resendEmailToFulfillers(opts, request.jiraAuth);
        return h.response(result).code(result.code || 200);
      } catch (error) {
        return h.response(error).code(error.code || 400);
      }
    },
  },
};

export const getClinicalPrograms = {
  path: '/api/v1/db/categories/clinical-program',
  method: 'GET',
  config: {
    description: 'Get clinical program by theraputic area',
    tags: ['api', 'Post HOC requests'],
    auth: 'jwt',
    notes: [
      'Get clinical program by theraputic area',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        therapeuticArea: request.query.therapeuticArea || '',
      };
      const response = await jiraProjectRequestsServices.getClinicalPrograms(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
}; 