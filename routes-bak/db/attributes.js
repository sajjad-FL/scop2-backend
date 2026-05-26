import { globalFailAction } from "../../utils/helper.js";
import { dbAttributesServices } from "../../services-bak/db/attributes.js";
import { objectIdParamsSchema } from "../../validators/jiraUserValidator.js";
import { createAttributePayloadSchema, updateAttributePayloadSchema } from "../../validators/dbAttributesValidators.js";

export const getAttributes = {
  path: '/api/v1/db/attributes',
  method: 'GET',
  config: {
    description: 'Get Attributes',
    tags: ['api', 'Attributes'],
    auth: 'jwt',
  },
  handler: async (request, h) => {
    try {
      const response = await dbAttributesServices.getAttributes();
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const createAttributes = {
  path: '/api/v1/db/attributes',
  method: 'POST',
  config: {
    description: 'Create Attributes',
    tags: ['api', 'Attributes'],
    auth: 'jwt',
    validate: {
      payload: createAttributePayloadSchema,
      failAction: globalFailAction
    },
    notes: [
      'Creates new attributes',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const response = await dbAttributesServices.createAttributes(request.payload);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const updateAttribute = {
  path: '/api/v1/db/attributes/{id}',
  method: 'PUT',
  config: {
    description: 'Updates Attribute',
    tags: ['api', 'Attributes'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateAttributePayloadSchema,
      failAction: globalFailAction
    },
    notes: [
      'Updates a attribute',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        data: request.payload,
      };
      const response = await dbAttributesServices.updateAttribute(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const deleteAttribute = {
  path: '/api/v1/db/attributes/{id}',
  method: 'DELETE',
  config: {
    description: 'Deletes Attribute',
    tags: ['api', 'Attributes'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      failAction: globalFailAction
    },
    notes: [
      'Delete a attributes',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const opts = { payload: request.payload };
      const response = await dbAttributesServices.deleteAttribute(request.params.id);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};
