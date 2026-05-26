import Joi from "joi";

export const updateUserPreferenecesPayloadSchema = Joi.object({
  projectTable: Joi.array().items(Joi.object({
    categoryId: Joi.string().optional(),
    templateId: Joi.string().optional(),
    columns: Joi.array().items(Joi.object({
      name: Joi.string().optional(),
      order: Joi.number().optional(),
    })).optional(),
  })).optional(),
})

export const updateTablePayloadSchema = Joi.object({
    tableName: Joi.string().optional(),
    columns: Joi.array().items(Joi.object({
      name: Joi.string().optional(),
      width: Joi.string().optional(),
    })).optional(),
})

export const getUserPreferenceQuerySchema = Joi.object({
  categoryId: Joi.string().optional(),
  templateId: Joi.string().optional(),
})