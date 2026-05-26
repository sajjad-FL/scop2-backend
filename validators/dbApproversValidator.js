import Joi from "joi";

export const attributeSetApproversSchema = Joi.array().items(
  Joi.object({
    name: Joi.string().required(),
    type: Joi.string().required(),
    mode: Joi.string().required(),
    values: Joi.array().items(Joi.any()).default([]),
    value: Joi.string().default(""),
})).default([]);

export const approverValidatorSchema = Joi.object({
  isDeleted: Joi.boolean(),
  collaborators: Joi.array().items(Joi.string()).default([]),
  lead: Joi.array().items(Joi.string()).default([]),
  approvers: Joi.array().items(Joi.string()).default([]),
  attributeSet: attributeSetApproversSchema,
  defaultApprovers: Joi.array().items(Joi.string()).default([]),
});

export const importApproversPayloadSchema = Joi.object({
  file: Joi.any().required(),
  type: Joi.string().valid('EXCEL', 'JSON').required(),
});

export const exportApproversQuerySchema = Joi.object({
  typeId: Joi.string().required(),
  type: Joi.string().required(),
});
