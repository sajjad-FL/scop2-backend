import Joi from 'joi';

export const customFieldSchema = Joi.object({
  _id: Joi.any(),
  mode: Joi.string(),
  name: Joi.string(),
  type: Joi.string(),
  value: Joi.alternatives().try(
    Joi.string().allow(''),
    Joi.object(),
    Joi.boolean()
  ),
  values: Joi.array(),
  isRequired: Joi.boolean(),
});

export const createProjectRequestPayloadSchema = Joi.object({
  name: Joi.string().required(),
  displayName: Joi.string().required(),
  categoryId: Joi.string().allow('').max(100),
  typeData: Joi.object().required(),
  importProjectCustomType: Joi.string(),
  customFields: Joi.array().items(customFieldSchema),
  priority: Joi.string().max(100).allow(''),
  files: Joi.array().required(),
  requestedBy: Joi.string().required(),
});

export const getAllProjectRequestsQuerySchema = Joi.object({
  q: Joi.string().allow(''),
  page: Joi.string().allow(''),
  perPage: Joi.string().allow(''),
  sortBy: Joi.string().allow(''),
  sortDirection: Joi.string().allow(''),
});

export const updateProjectRequestPayloadSchema = Joi.object({
  name: Joi.string(),
  displayName: Joi.string(),
  categoryId: Joi.string().allow('').max(100),
  typeData: Joi.object(),
  state: Joi.string(),
  importProjectCustomType: Joi.string(),
  customFields: Joi.array().items(customFieldSchema),
  priority: Joi.string().max(100).allow(''),
  updateType: Joi.string().max(100).allow(''),
  requestId: Joi.string().allow(''),
  notes: Joi.string(),
});

export const getProjectsForReportsQuerySchema = Joi.object({
  showAll: Joi.string().required(),
  page: Joi.string(),
  perPage: Joi.string(),
  quarter: Joi.string(),
  category: Joi.string(),
  template: Joi.string(),
  startDate: Joi.string().allow(''),
  endDate: Joi.string().allow(''),
  startDateR1: Joi.string().allow(''),
  startDateR2: Joi.string().allow(''),
  endDateR1: Joi.string().allow(''),
  endDateR2: Joi.string().allow(''),
  endDateOr: Joi.string(),
  q: Joi.string().allow(''),
  qL: Joi.string().allow(''),
  filters: Joi.string().allow(''),
});

export const idParamsSchema = Joi.object({
  id: Joi.string().max(100).required(),
});