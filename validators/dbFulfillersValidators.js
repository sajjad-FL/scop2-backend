import Joi from "joi";

export const customFulfillerSchema = Joi.object({
  name: Joi.string(),
  email: Joi.string(),
  wWID: Joi.string(),
  username: Joi.string(),
  isPrimarySP: Joi.boolean(),
  isPrimarySDS: Joi.boolean(),
  isTypeFulfiller: Joi.boolean(),
});

export const attributeSchema = Joi.object({
  name: Joi.string(),
  value: Joi.any(),
  mode: Joi.string(),
  type: Joi.string(),
  values: Joi.array(),
  default: Joi.boolean(),
});

export const customAttributeSchema = Joi.object({
  attributes: Joi.array().items(attributeSchema),
  fulfillers: Joi.array().items(customFulfillerSchema),
});

export const createFulfillersPayloadSchema = Joi.object({
  categoryId: Joi.string().required(),
  typeId: Joi.string().required(),
  fulfillers: Joi.array().items(customFulfillerSchema),
  attributeSet: Joi.array().items(customAttributeSchema),
});

export const importFulfillersPayloadSchema = Joi.object({
  file: Joi.any().required(),
  categoryId: Joi.string().required(),
  typeId: Joi.string().required(),
  type: Joi.string().valid('EXCEL', 'JSON'),
});

export const exportFulfillersQuerySchema = Joi.object({
  categoryId: Joi.string().required(),
  typeId: Joi.string().required(),
  type: Joi.string().valid('EXCEL', 'JSON'),
});