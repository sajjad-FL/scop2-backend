import Joi from "joi";

export const customApproversPayloadSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().required(),
  wWID: Joi.string().required(),
  username: Joi.string().required(),
});

export const createCaseStudyApproversPayloadSchema = Joi.object({
  value: Joi.string(),
  approvers: Joi.array().items(customApproversPayloadSchema),
});

export const getCaseStudyApproversQuerySchema = Joi.object({
  q: Joi.string().allow(''),
  page: Joi.string().allow(''),
  perPage: Joi.string().allow('')
});

export const deleteCaseStudyApproversParamsChema = Joi.object({
  value: Joi.string().max(100).required(),
})