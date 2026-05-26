import { reportsDashboardServices } from "../../services-bak/reports/dashboard.js";

export const getAllData = {
  path: '/api/v1/dashboard/data',
  method: 'GET',
  config: {
    description: 'Get Dashboard Data',
    tags: ['api', 'Dashboard'],
    auth: 'jwt',
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        perPage: request.query.perPage !== 'all' ? Number(request.query.perPage) : request.query.perPage,
        query: '',
        quarter: request.query.quarter,
        sort: request.query.sort,
        forReport: true,
      };
      if (request?.query?.page) {
        opts.page = Number(request.query.page);
      }
      const response = await reportsDashboardServices.getAllData(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};
