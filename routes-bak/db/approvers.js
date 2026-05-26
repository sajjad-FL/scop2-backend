import { dbApproversServices } from "../../services-bak/db/approvers.js";
import { globalFailAction } from "../../utils/helper.js";
import { exportApproversQuerySchema, importApproversPayloadSchema } from "../../validators/dbApproversValidator.js";

export const importApprover = {
  path: '/api/v1/db/approvers/import/{typeId}',
  method: 'POST',
  config: {
    description: 'Create Approvers for templates',
    tags: ['api', 'Drr approvers'],
    auth: 'jwt',
    payload: {
      output: 'stream',
      parse: true,
      multipart: true,
      allow: 'multipart/form-data',
      maxBytes: 1000 * 1000 * 10,
    },
    validate: {
      payload: importApproversPayloadSchema,
      failAction: globalFailAction
    },
    notes: ['Import Approvers', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = { ...request.payload, typeId: request.params.typeId }
      const response = await dbApproversServices.importApprover(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};
  
export const exportApprover = {
  path: '/api/v1/db/approvers/export',
  method: 'GET',
  config: {
    description: 'Create Approvers for templates',
    tags: ['api', 'Drr approvers'],
    auth: 'jwt',
    validate: {
      query: exportApproversQuerySchema,
      failAction: globalFailAction
    },
    notes: ['Export Approvers', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        typeId: request.query.typeId,
        type: request.query.type
      };
      const response = await dbApproversServices.exportApprover(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};
