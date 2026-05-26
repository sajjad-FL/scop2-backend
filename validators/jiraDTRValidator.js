import Joi from 'joi';

export const userSchema = Joi.object({
  name: Joi.string(),
  username: Joi.string(),
  wWID: Joi.string(),
  email: Joi.string(),
  groupId: Joi.string(),
  type: Joi.string(),
});

export const customFieldPayloadSchema = Joi.object({
  _id: Joi.any(),
  mode: Joi.string(),
  name: Joi.string(),
  type: Joi.string(),
  value: Joi.alternatives().try(
    Joi.string().allow(''),
    Joi.boolean(),
    Joi.object()
  ),
  values: Joi.array(),
  isRequired: Joi.boolean(),
});

export const customApproversPayloadSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().required(),
  wWID: Joi.string().required(),
  username: Joi.string().required(),
});

export const customGroupPayloadSchema = Joi.object({
  name: Joi.string().required(),
  groupId: Joi.string().required(),
  type: Joi.string().required(),
});

export const attributeSchema = Joi.object({
  name: Joi.string(),
  type: Joi.string(),
  values: Joi.array(),
  isRequired: Joi.boolean(),
  mode: Joi.string(),
  value: Joi.alternatives().try(
    Joi.string().allow(''),
    Joi.boolean(),
    Joi.object()
  ),
  default: Joi.boolean(),
});

export const dtrTemplatePayloadSchema = Joi.object({
  name: Joi.string(),
  categoryId: Joi.string().allow(''),
  attributes: Joi.array().items(attributeSchema),
  isEnabled: Joi.boolean(),
  isDeleted: Joi.boolean(),
  previousTypeId: Joi.string().allow(''),
  templateHelp: Joi.string(),
  helpLink: Joi.string().optional().allow(''),
  messageBoxTextContent: Joi.string().optional().allow(''),
  messageBoxTitle: Joi.string().optional().allow(''),
});

export const createApproversPayloadSchema = Joi.object({
  typeId: Joi.string().required(),
  defaultApprovers: Joi.array().items(customApproversPayloadSchema),
  attributeSet: Joi.array().items(attributeSchema),
  approvers: Joi.array().items(Joi.alternatives().try(customApproversPayloadSchema, customGroupPayloadSchema)),
  lead: Joi.array().items(customApproversPayloadSchema),
  collaborators: Joi.array().items(Joi.alternatives().try(customApproversPayloadSchema, customGroupPayloadSchema)),
  isDeleted: Joi.boolean(),
  previousApproverId: Joi.string(),
});

export const updateApproversPayloadSchema = Joi.object({
  typeId: Joi.string(),
  defaultApprovers: Joi.array().items(Joi.alternatives().try(customApproversPayloadSchema, customGroupPayloadSchema)),
  attributeSet: Joi.array().items(attributeSchema),
  approvers: Joi.array().items(Joi.alternatives().try(customApproversPayloadSchema, customGroupPayloadSchema)),
  lead: Joi.array().items(customApproversPayloadSchema),
  collaborators: Joi.array().items(Joi.alternatives().try(customApproversPayloadSchema, customGroupPayloadSchema)),
  isDeleted: Joi.boolean(),
  previousApproverId: Joi.string(),
});

export const getApproversByTemplateIdQuerySchema = Joi.object({
  q: Joi.string().allow(''),
  page: Joi.string().allow(''),
  perPage: Joi.string().allow('')
});

export const createDTRRequestPayloadSchema = Joi.object({
  name: Joi.string().required(),
  displayName: Joi.string().required(),
  categoryId: Joi.string().allow('').max(100),
  typeData: Joi.object().required(),
  importProjectCustomType: Joi.string(),
  customFields: Joi.array().items(customFieldPayloadSchema),
  priority: Joi.string().max(100).allow(''),
  files: Joi.array().required(),
  requestedBy: Joi.string().required(),
});

export const getAllDTRQuerySchema = Joi.object({
  q: Joi.string().allow(''),
  page: Joi.string().allow(''),
  perPage: Joi.string().allow(''),
  sortBy: Joi.string().allow(''),
  sortDirection: Joi.string().allow(''),
});

export const gtDTRByIdParamsSchema = Joi.object({
  id: Joi.string().required().description('The ID of the Data Transfer Request'),
});

export const updateDTRPayloadSchema = Joi.object({
  name: Joi.string(),
  displayName: Joi.string(),
  categoryId: Joi.string().allow('').max(100),
  typeData: Joi.object(),
  importProjectCustomType: Joi.string(),
  customFields: Joi.array().items(customFieldPayloadSchema),
  priority: Joi.string().max(100).allow(''),
  files: Joi.array(),
  requestedBy: Joi.string(),
  reason: Joi.string(),
});