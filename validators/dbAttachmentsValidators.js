import Joi from "joi";

export const getAttachmentsByIdParamsSchema = Joi.object({
  id: Joi.string().required(),
});

export const getAttachmentsByIdQuerySchema = Joi.object({
  type: Joi.string().required(),
});

export const getFilesInFileInputCustomFieldQuerySchema = Joi.object({
  fileName: Joi.string(),
  fieldName: Joi.string(),
  type: Joi.string().required(),
});

export const updateFileInFileInputCustomFieldPayloadSchema = Joi.object({
  type: Joi.string().required(),
  fieldName: Joi.string().required(),
  files: Joi.array().required(),
});

export const deleteFileInFileInputCustomFieldQuerySchema = Joi.object({
  fieldName: Joi.string().required(),
  fileName: Joi.string().required(),
  type: Joi.string().required(),
})