import { dbCategoriesServices } from "../../services-bak/db/categories.js";

export const scrapeJiraCategories = {
  path: '/api/v1/db/categories/scrape',
  method: 'POST',
  config: {
    description: 'Scrape jira categories',
    tags: ['api', 'Scrape categories'],
    auth: 'jwt',
    notes: [
      'Scrape jira categories',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const response = await dbCategoriesServices.scrapeJiraCategories(request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};