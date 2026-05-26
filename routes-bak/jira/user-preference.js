import { globalFailAction } from "../../utils/helper.js";
import { jiraUserPreferenceServices } from "../../services-bak/jira/user-preference.js";
import { getUserPreferenceQuerySchema, updateTablePayloadSchema, updateUserPreferenecesPayloadSchema } from "../../validators/jiraUserPreferencesValidators.js";

export const updateUserPreference = {
  path: '/api/v1/jira/user/preference',
  method: 'PUT',
  config: {
    description: 'Update User Preference',
    tags: ['api', 'User preference'],
    auth: 'jwt',
    validate: {
      payload: updateUserPreferenecesPayloadSchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        userId: request.jiraAuth._id,
        projectTable: request?.payload?.projectTable,
      };
      const response = await jiraUserPreferenceServices.updateUserPreference(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const updateTableWidth = {
  path: '/api/v1/jira/user/table-width',
  method: 'PUT',
  config: {
    description: 'Update Table Width',
    tags: ['api', 'User preference'],
    auth: 'jwt',
    validate: {
      payload: updateTablePayloadSchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        userId: request.jiraAuth._id,
        tableName: request?.payload?.tableName,
        columns: request?.payload?.columns,
      };
      const response = await jiraUserPreferenceServices.updateTableWidth(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const getUserPreference = {
  path: '/api/v1/jira/user/preference',
  method: 'GET',
  config: {
    description: 'Get User Preference',
    tags: ['api', 'User preference'],
    auth: 'jwt',
    validate: {
      query: getUserPreferenceQuerySchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        userId: request.jiraAuth._id,
        categoryId:request.query.categoryId,
        templateId:request.query.templateId,
      };
      const response = await jiraUserPreferenceServices.getUserPreference(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};
