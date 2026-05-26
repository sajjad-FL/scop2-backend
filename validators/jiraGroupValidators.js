import Joi from "joi";

export const createGroupPayloadSchema = Joi.object({
  name: Joi.string().required(),
});

export const getGroupQuerySchema = Joi.object({
  internal: Joi.string().allow('').optional(),
});

export const getOneParamsSchema = Joi.object({
  gid: Joi.string().required(),
});

export const getMembersQuerySchema = Joi.object({
  q: Joi.string().allow('').required(),
  page: Joi.string().required(),
  perPage: Joi.string().required(),
});

export const addMemberPayloadSchema = Joi.object({
  id: Joi.string().allow(),
  addMemberAsAdmin: Joi.boolean().required(),
  addMemberAsRequestAdmin: Joi.boolean().required(),
  addMemberAsDtrAdmin: Joi.boolean().required(),
  addTeamMembers: Joi.boolean().allow(),
});

export const removeMemberParamsSchema = Joi.object({
  gid: Joi.string().required(),
  uid: Joi.string().required(),
});

export const removeMemberQuerySchema = Joi.object({
  removeMemberAsAdmin: Joi.string().required(),
});

export const findUsersAndGroupsQuerySchema = Joi.object({
  query: Joi.string().required(),
});

export const searchGroupQuerySchema = Joi.object({
  groupname: Joi.string().required(),
})