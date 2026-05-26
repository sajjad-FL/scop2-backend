import Joi from 'joi';

export const loginPayloadSchema = Joi.object({
  email: Joi.string().required(),
  password: Joi.string().required(),
});

export const accessPayloadSchema = Joi.object({
  email: Joi.string().max(100).required(),
  username: Joi.string().max(100).required(),
  name: Joi.string().max(100).required(),
  wWID: Joi.string().max(100).required(),
});

export const validatePayloadSchema = Joi.object({
  email: Joi.string().max(100).required(),
});

export const usersQuerySchema = Joi.object({
  username: Joi.string().max(100),
  email: Joi.string().max(100),
  startAt: Joi.number(),
  maxResults: Joi.number(),
  isEnabled: Joi.string(),
  includeMeta: Joi.string(),
});
