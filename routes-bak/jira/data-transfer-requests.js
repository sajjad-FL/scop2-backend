/* eslint-disable max-len */
// const joi = require('joi');
import joi from 'joi';
import { createApproversPayloadSchema, createDTRRequestPayloadSchema, dtrTemplatePayloadSchema, getAllDTRQuerySchema, getApproversByTemplateIdQuerySchema, gtDTRByIdParamsSchema, updateApproversPayloadSchema, updateDTRPayloadSchema } from "../../validators/jiraDTRValidator.js";
import { globalFailAction } from '../../utils/helper.js';
import { objectIdParamsSchema } from '../../validators/jiraUserValidator.js';
import { jiraDataTransferRequestServices } from '../../services-bak/jira/data-transfer-request.js';

export const createDTRTemplate = {
  path: '/api/v1/jira/dtr-template',
  method: 'POST',
  config: {
    description: 'Create Data Transfer Template',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    payload: {
      maxBytes: 100000000,
      parse: true,
    },
    validate: {
      payload: dtrTemplatePayloadSchema,
      failAction: globalFailAction
    },
    notes: ['Create Data Transfer Template', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = { payload: request.payload };
      const response = await jiraDataTransferRequestServices.createDTRTemplate(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const uploadHTMLDTRTemplate = {
  path: '/api/v1/jira/dtr-template/{id}/upload',
  method: 'PUT',
  config: {
    description: 'Upload HTML in Data Transfer Template',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    payload: {
      output: 'stream',
      parse: true,
      multipart: true,
      allow: 'multipart/form-data',
      maxBytes: 1000 * 1000 * 10,
    },
    notes: ['Upload HTML in Data Transfer Template', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        file: request.payload.html,
      };
      const response = await jiraDataTransferRequestServices.uploadHTMLDTRTemplate(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const validateDTRTemplate = {
  path: '/api/v1/jira/dtr-template/validate/{id}',
  method: 'GET',
  config: {
    description: 'Validate data transfer request template',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      failAction: globalFailAction
    },
    notes: [
      'Validates data transfer request template',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const response = await jiraDataTransferRequestServices.validateDTRTemplate(request.params.id);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const updateDTRTemplate = {
  path: '/api/v1/jira/dtr-template/{id}',
  method: 'PUT',
  config: {
    description: 'Update Data Transfer Template',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    payload: {
      maxBytes: 100000000,
      parse: true,
    },
    validate: {
      payload: dtrTemplatePayloadSchema,
    },
    notes: ['Update Data Transfer Template', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        templateID: request.params.id,
        payload: request.payload,
      };
      const response = await jiraDataTransferRequestServices.updateDTRTemplate(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const deleteDTRTemplate = {
  path: '/api/v1/jira/dtr-template/{id}',
  method: 'DELETE',
  config: {
    description: 'Delete Data Transfer Template',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      failAction: globalFailAction
    },
    notes: ['Delete Data Transfer Template', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        templateID: request.params.id,
      };
      const response = await jiraDataTransferRequestServices.deleteDTRTemplate(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const getAllDTRTemplates = {
  path: '/api/v1/jira/dtr-templates',
  method: 'GET',
  config: {
    description: 'Get All Data Transfer Template',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    notes: ['Get All Data Transfer Template', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = { payload: request.payload };
      const response = await jiraDataTransferRequestServices.getAllDTRTemplates(request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const getDTRTemplateById = {
  path: '/api/v1/jira/dtr-template/{id}',
  method: 'GET',
  config: {
    description: 'Get Data Transfer Template By Id',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    notes: ['Get Data Transfer Template By Id', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = { templateID: request.params.id };
      const response = await jiraDataTransferRequestServices.getDTRTemplateById(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const createApprovers = {
  path: '/api/v1/jira/dtr/approvers',
  method: 'POST',
  config: {
    description: 'Create Approvers',
    tags: ['api', 'DRR approvers'],
    auth: 'jwt',
    payload: {
      maxBytes: 100000000,
      parse: true,
    },
    validate: {
      payload: createApproversPayloadSchema,
      failAction: globalFailAction
    },
    notes: ['Create Approvers', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = { payload: request.payload };
      const response = await jiraDataTransferRequestServices.createApprover(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const updateApprovers = {
  path: '/api/v1/jira/dtr/approvers/{id}',
  method: 'PUT',
  config: {
    description: 'Update Approvers',
    tags: ['api', 'DRR approvers'],
    auth: 'jwt',
    payload: {
      maxBytes: 100000000,
      parse: true,
    },
    validate: {
      payload: updateApproversPayloadSchema,
      failAction: globalFailAction
    },
    notes: ['Update Approvers', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        approverID: request.params.id,
        payload: request.payload,
      };
      const response = await jiraDataTransferRequestServices.updateApprover(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

const getSMHApproversByTemplateId = {
  path: '/api/v1/jira/smh/approvers/{id}',
  method: 'GET',
  config: {
    description: 'Get Approvers',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    validate: {
      query: {
        q: joi.string().allow(''),
        page: joi.string().allow(''),
        perPage: joi.string().allow('')
      },
    },
    notes: ['Get Approvers', 'ADMIN ACCESS REQUIRED'],
  },
  handler: (request, reply) => {
    const sort = request.query.sortDirection || '';
    const opts = {
      query: request.query.q,
      perPage: request.query.perPage ? Number(request.query.perPage) : 10,
      page: request.query.page ? Number(request.query.page) : 0,
      templateID: request.params.id,
    };
    global.services.jira.dataTransferRequestServices.getSMHApproversByTemplateId(opts).then((res) => {
      reply(res).code(res.code || 200);
    }).catch((err) => {
      reply(err).code(err.code || 400);
    });
  },
};

export const getApproversByTemplateId = {
  path: '/api/v1/jira/dtr/approvers/{id}',
  method: 'GET',
  config: {
    description: 'Get Approvers',
    tags: ['api', 'DRR approvers'],
    auth: 'jwt',
    validate: {
      query: getApproversByTemplateIdQuerySchema,
      failAction: globalFailAction,
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
        templateID: request.params.id,
      };
      const response = await jiraDataTransferRequestServices.getApproversByTemplateId(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const getApproversReportsByTemplateId = {
  path: '/api/v1/jira/dtr/approvers/reports/{id}',
  method: 'GET',
  config: {
    description: 'Get Approvers',
    tags: ['api', 'DRR approvers'],
    auth: 'jwt',
    validate: {
      query: getApproversByTemplateIdQuerySchema,
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
        templateID: request.params.id,
      };
      const response = await jiraDataTransferRequestServices.getApproversReportsByTemplateId(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const deleteApprover = {
  path: '/api/v1/jira/data-transfer-request-approvers/{id}',
  method: 'DELETE',
  config: {
    description: 'Delete Approvers',
    tags: ['api', 'DRR approvers'],
    auth: 'jwt',
    notes: ['Delete Approvers', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        approverID: request.params.id,
      };
      const response = await jiraDataTransferRequestServices.deleteApprover(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const createDataTransferRequest = {
  path: '/api/v1/jira/data-transfer-requests',
  method: 'POST',
  config: {
    description: 'Create Data Transfer Request',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    payload: {
      maxBytes: 100000000,
      parse: true,
    },
    validate: {
      payload: createDTRRequestPayloadSchema,
      failAction: globalFailAction,
    },
    notes: ['Create Data Transfer Request', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = { dtr: request.payload };
      const response = await jiraDataTransferRequestServices.createDataTransferRequest(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const getAllDataTransferRequests = {
  path: '/api/v1/jira/data-transfer-requests',
  method: 'GET',
  config: {
    description: 'Get All Data Transfer Requests',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    validate: {
      query: getAllDTRQuerySchema,
      failAction: globalFailAction
    },
    notes: ['Get All Data Transfer Requests', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const sort = request.query.sortDirection || '';
      const opts = {
        query: request.query.q,
        perPage: request.query.perPage ? Number(request.query.perPage) : 10,
        page: request.query.page ? Number(request.query.page) : 0,
        sortBy: request.query.sortBy,
        // eslint-disable-next-line no-nested-ternary
        sort: sort === 'asc' ? 1 : sort === 'desc' ? -1 : 0,
      };
      const response = await jiraDataTransferRequestServices.getAllDataTransferRequests(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const getDataTransferRequestById = {
  path: '/api/v1/jira/data-transfer-request/{id}',
  method: 'GET',
  config: {
    description: 'Get Data Transfer Request By Id',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    validate: {
      params: gtDTRByIdParamsSchema,
      failAction: globalFailAction
    },
    notes: ['Get Data Transfer Request By Id', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        dtrID: request.params.id,
      };
      const response = await jiraDataTransferRequestServices.getDataTransferRequestById(opts, request.jiraAuth);
      const data = response;
      data.typeData.name = response.typeName;
      // delete res.typeName;
      return h.response(data).code(data?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const updateDataTransferRequestById = {
  path: '/api/v1/jira/data-transfer-request/{id}',
  method: 'PUT',
  config: {
    description: 'Update Data Transfer Request By Id',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    payload: {
      maxBytes: 100000000,
      parse: true,
    },
    validate: {
      params: gtDTRByIdParamsSchema,
      payload: updateDTRPayloadSchema,
      failAction: globalFailAction
    },
    notes: ['Update Data Transfer Request By Id', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        dtrID: request.params.id,
        payload: request.payload,
      };
      const response = await jiraDataTransferRequestServices.updateDataTransferRequestById(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const deleteDataTransferRequestById = {
  path: '/api/v1/jira/data-transfer-request/{id}',
  method: 'DELETE',
  config: {
    description: 'Delete Data Transfer Request By Id',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    notes: ['Delete Data Transfer Request By Id', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        dtrID: request.params.id,
      };
      const response = await jiraDataTransferRequestServices.deleteDataTransferRequestById(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const approvedDataTranferRequest = {
  path: '/api/v1/jira/data-transfer-requests/approved/{id}',
  method: 'GET',
  config: {
    description: 'Approved Data Transfer Request',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    notes: ['Approved Data Transfer Request', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = { dtrID: request.params.id };
      const response = await jiraDataTransferRequestServices.approvedDataTranferRequest(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const resendEmailToApprovers = {
  path: '/api/v1/jira/data-transfer-requests/resend-email/{id}',
  method: 'GET',
  config: {
    description: 'Resend the email to DRR Approvers',
    tags: ['api', 'Data reuse requests'],
    auth: 'jwt',
    notes: ['Resend DRR Email', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = { dtrID: request.params.id };
      const response = await jiraDataTransferRequestServices.resendEmailToApprovers(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};
