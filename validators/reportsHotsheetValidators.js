import Joi from "joi";

export const createHotsheetTemplatePayloadSchema = Joi.object({
  name: Joi.string().required(),
  fields: Joi.array().required(),
});