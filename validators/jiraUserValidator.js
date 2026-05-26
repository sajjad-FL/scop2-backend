import Joi from 'joi';

export const jjedsSchema = Joi.object({
  _id: Joi.string(),
  wWID: Joi.string().required(),
  commonName: Joi.string().required(),
  emailAddress: Joi.string().allow('').required(),
  supervisor: Joi.string().required(),
  directReports: Joi.array(),
  superName: Joi.string().allow(''),
  superEmail: Joi.string().allow(''),
  companyName: Joi.string().allow(''),
  preferredGivenName: Joi.string().allow(''),
  Title: Joi.string().allow(''),
  organizationalUnit: Joi.string().allow(''),
});

export const createUserPayloadSchema = Joi.object({
  email: Joi.string().max(100).required(),
  name: Joi.string().allow('').max(100),
});

export const createBulkUsersPayloadSchema = Joi.array().items(createUserPayloadSchema)

export const searchQuerySchema = Joi.object({
  q: Joi.string().allow('').required(),
  page: Joi.string().required(),
  perPage: Joi.string().required(),
});

export const objectIdParamsSchema = Joi.object({
  id: Joi.string().max(100).required(),
});

export const permissionsQuerySchema = Joi.object({
  projectKey: Joi.string().max(10),
  projectId: Joi.string().max(30),
  issueKey: Joi.string().max(10),
  issueId: Joi.string().max(30),
});

export const searchUsersPermissionsQuerySchema = Joi.object({
  username: Joi.string().max(10),
  permissions: Joi.string(),
  projectKey: Joi.string().max(10),
  issueKey: Joi.string().max(10),
  startAt: Joi.string().max(3),
});

export const createJjedsPayloadSchema = Joi.array().items(jjedsSchema);

export const updateDefaultPagePayloadSchema = Joi.object({
  page: {
    link: Joi.string().required(),
    index: Joi.number().required(),
    name: Joi.string().required(),
    visible: Joi.boolean().optional(),
  },
});

export const updateDefaultTypePayloadSchema = Joi.object({
  type: {
    categoryId: Joi.string().required().allow(''),
    typeId: Joi.string().required().allow(''),
    skipTemplateSelection: Joi.alternatives().try(
      Joi.boolean(),
      Joi.string(),
    )
  },
});

export const updateJjedsDataPayloadSchema = Joi.object({
  commonName: Joi.string(),
  supervisor: Joi.string(),
  type: Joi.string(),
  directReports: Joi.array(),
});

export const updateAllProjectsPayloadSchema = Joi.object({
  allProjects: Joi.boolean().required(),
});

export const updateDefaultProjectStatusSchema = Joi.object({
  status: Joi.array(),
  department: Joi.string().allow(''),
});

export const updateDefaultGitVersionControlTypePayloadSchema = Joi.object({
  gitVersionControlType: Joi.string().required(),
});

export const updateCustomDisplayPayloadSchema = Joi.object({
  customDisplayValues: Joi.array(),
  department: Joi.string().allow(''),
});

export const updateDisplayPrConPagePayloadSchema = Joi.object({
  prConPage: Joi.any(),
});

export const updateRequestTabsPayloadSchema = Joi.object({
  requestTabs: Joi.boolean(),
});

export const updateEmailNotificationPayloadSchema = Joi.object({
  emailNotification: Joi.boolean(),
});

export const authenticateUserPayloadSchema = Joi.object({
  email: Joi.string().required(),
  password: Joi.string().required(),
});
