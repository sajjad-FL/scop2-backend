import Joi from "joi";

export const attributeSchemaPayloadSchema = Joi.object({
  name: Joi.string(),
  type: Joi.string(),
  value: Joi.alternatives().try(Joi.string(), Joi.boolean(), Joi.object()),
  values: Joi.array(),
});

export const createAttributePayloadSchema = Joi.array().items(attributeSchemaPayloadSchema);

export const updateAttributePayloadSchema = Joi.object({
  name: Joi.string(),
  type: Joi.string(),
  value: Joi.alternatives().try(Joi.string().allow(''), Joi.boolean(), Joi.object()),
  values: Joi.array(),
})