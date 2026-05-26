import { dbAttachmentsServices } from "../../services-bak/db/attachments.js";
import { globalFailAction } from "../../utils/helper.js";
import {
  updateFileInFileInputCustomFieldPayloadSchema,
  deleteFileInFileInputCustomFieldQuerySchema,
  getFilesInFileInputCustomFieldQuerySchema,
  getAttachmentsByIdParamsSchema,
  getAttachmentsByIdQuerySchema,
} from "../../validators/dbAttachmentsValidators.js";

export const getAttachmentsById = {
  path: '/api/v1/db/attachments/{id}',
  method: 'GET',
  config: {
    description: 'Get Attachments By Id',
    tags: ['api', 'Attachments'],
    validate: {
      params: getAttachmentsByIdParamsSchema,
      query: getAttachmentsByIdQuerySchema,
      failAction: globalFailAction
    },
    auth: 'jwt',
    notes: ['Get Attachments By Id', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        type: request.query.type,
      };
      const response = await dbAttachmentsServices.getAttachmentsById(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const getFilesInFileInputCustomField = {
  path: '/api/v1/db/attachments/file-input-custom-field/{id}',
  method: 'GET',
  config: {
    description: 'get file input custom field',
    tags: ['api', 'Attachments'],
    auth: 'jwt',
    notes: ['get file input custom field', 'ADMIN ACCESS REQUIRED'],
    validate: {
      query: getFilesInFileInputCustomFieldQuerySchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request?.params?.id || '',
        type: request?.query?.type || '',
        fieldName: request?.query?.fieldName || '',
      }
      const response = await dbAttachmentsServices.getFilesInFileInputCustomField(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  }
};


export const updateFileInFileInputCustomField = {
  path: '/api/v1/db/attachments/update-file-input-custom-field/{id}',
  method: 'PUT',
  config: {
    description: 'update file input custom field',
    tags: ['api', 'Attachments'],
    auth: 'jwt',
    notes: ['update file input custom field', 'ADMIN ACCESS REQUIRED'],
    validate: {
      payload: updateFileInFileInputCustomFieldPayloadSchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request?.params?.id || '',
        type: request?.payload?.type || '',
        fieldName: request?.payload?.fieldName || '',
        files: request?.payload?.files || '',
      };
      const response = await dbAttachmentsServices.updateFileInFileInputCustomField(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  }
};

export const deleteFileInFileInputCustomField = {
  path: '/api/v1/db/attachments/delete-file-input-custom-field/{id}',
  method: 'DELETE',
  config: {
    description: 'delete file input custom field',
    tags: ['api', 'Attachments'],
    auth: 'jwt',
    notes: ['delete file input custom field', 'ADMIN ACCESS REQUIRED'],
    validate: {
      query: deleteFileInFileInputCustomFieldQuerySchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request?.params?.id || '',
        type: request?.query?.type || '',
        fieldName: request?.query?.fieldName || '',
        fileName: request?.query?.fileName || '',
      }
      const response = await dbAttachmentsServices.deleteFileInFileInputCustomField(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  }
};

export const deleteAttachment = {
  path: '/api/v1/db/attachments/delete-attachment/{id}',
  method: 'DELETE',
  config: {
    description: 'delete attachment',
    tags: ['api', 'Attachments'],
    auth: 'jwt',
    notes: ['delete attachment', 'ADMIN ACCESS REQUIRED'],
    validate: {
      query: getFilesInFileInputCustomFieldQuerySchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request?.params?.id || '',
        type: request?.query?.type || '',
        fileName: request?.query?.fileName || '',
      }
      const response = await dbAttachmentsServices.deleteAttachment(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  }
};
