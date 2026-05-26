import { dbFulfillersServices } from "../../services-bak/db/fulfillers.js";
import { globalFailAction } from "../../utils/helper.js";
import { objectIdParamsSchema } from "../../validators/jiraUserValidator.js";
import { createFulfillersPayloadSchema, exportFulfillersQuerySchema, importFulfillersPayloadSchema } from "../../validators/dbFulfillersValidators.js";

export const createFulfiller = {
  path: '/api/v1/db/fulfillers',
  method: 'POST',
  config: {
    description: 'Create Fulfiller for templates',
    tags: ['api', 'Post hoc requests fulfillers'],
    auth: 'jwt',
    validate: {
      payload: createFulfillersPayloadSchema,
      failAction: globalFailAction
    },
    notes: ['Create Fulfillers', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = { ...request.payload };
      const response = await dbFulfillersServices.createFulfiller(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const importFulfiller = {
  path: '/api/v1/db/fulfillers/import',
  method: 'POST',
  config: {
    description: 'Create Fulfiller for templates',
    tags: ['api', 'Post hoc requests fulfillers'],
    auth: 'jwt',
    payload: {
      output: 'stream',
      parse: true,
      multipart: true,
      allow: 'multipart/form-data',
      maxBytes: 1000 * 1000 * 10,
    },
    validate: {
      payload: importFulfillersPayloadSchema,
      failAction: globalFailAction
    },
    notes: ['Import Fulfillers', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = { ...request.payload };
      let response;
      if (opts.type === "EXCEL") {
        response = await dbFulfillersServices.newimportFulfiller(opts, request.jiraAuth);
      } else {
        response = await dbFulfillersServices.importFulfiller(opts, request.jiraAuth);
      }
      
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
    
  },
};

export const exportFulfiller = {
  path: '/api/v1/db/fulfillers/export',
  method: 'GET',
  config: {
    description: 'Create Fulfiller for templates',
    tags: ['api', 'Post hoc requests fulfillers'],
    auth: 'jwt',
    validate: {
      query: exportFulfillersQuerySchema,
      failAction: globalFailAction
    },
    notes: ['Export Fulfillers', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = { ...request.query };
      const response = await dbFulfillersServices.exportFulfiller(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const getFulfillerByType = {
  path: '/api/v1/db/fulfillers/types/{id}',
  method: 'GET',
  config: {
    description: 'Create Fulfiller for templates',
    tags: ['api', 'Post hoc requests fulfillers'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      failAction: globalFailAction
    },
    notes: ['Create Fulfillers', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        typeId: request.params.id,
      };
      const response = await dbFulfillersServices.getFulfillerByType(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

// @CHECK
export const deleteById = {
  path: '/api/v1/db/fulfillers/{id}',
  method: 'delete',
  config: {
    description: 'Delete From typeId',
    tags: ['api', 'Post hoc requests fulfillers'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      failAction: globalFailAction
    },
    notes: ['Delete Attribute', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        typeId: request.params.id,
      };
      const response = await dbFulfillersServices.deleteById(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};
