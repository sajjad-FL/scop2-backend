import Joi from 'joi';

export const attributeSchema = Joi.object({
  name: Joi.string(),
  type: Joi.string(),
  value: Joi.alternatives().try(Joi.string(), Joi.boolean(), Joi.object()),
  values: Joi.array(),
  isRequired: Joi.boolean(),
  mode: Joi.string(),
});

export const customFieldSchema = Joi.object({
  _id: Joi.any(),
  name: Joi.string(),
  type: Joi.string(),
  value: Joi.alternatives().try(
    Joi.string().allow(''),
    Joi.object(),
    Joi.boolean(),
    Joi.allow(null),
  ),
  mode: Joi.string(), // TODO: Cleanup UI payload
  values: Joi.array(),
  isRequired: Joi.boolean(),
  mode: Joi.string(),
});

export const createProjectCategoryPayloadSchema = Joi.object({
  name: Joi.string().max(100).required(),
  description: Joi.string().required(),
  isTA: Joi.boolean().allow('').default(false),
});

export const updateProjectTypePayloadSchema = Joi.object({
  typeId: Joi.string().required(),
});

export const createProjectTypePayloadSchema = Joi.object({
  name: Joi.string(),
  categoryId: Joi.string().allow(''),
  attributes: Joi.array().items(attributeSchema),
  isTA: Joi.boolean().allow('').default(false),
  isDTR: Joi.boolean().allow().default(false),
  isRequest: Joi.boolean().allow('').default(false),
  automateRequest: Joi.boolean().allow(),
  isEnabled: Joi.boolean(),
  previousTypeId: Joi.string(),
  templateHelp: Joi.string(),
  isDeleted: Joi.boolean().allow('').default(false),
  helpLink: Joi.string().optional().allow(''),
  messageBoxTextContent: Joi.string().optional().allow(''),
  messageBoxTitle: Joi.string().optional().allow(''),
});

export const getHtmlCustomProjectTypePayloadSchema = Joi.object({
  fileName: Joi.string().required(),
});

export const projectCreateQuerySchema = Joi.object({
  versionControl: Joi.allow('').default('true'),
});

export const projectCreatePayloadSchema = Joi.object({
  name: Joi.string().required(),
  displayName: Joi.string().required(),
  description: Joi.string(),
  lead: Joi.object().required(),
  leads: Joi.array(),
  categoryId: Joi.string().allow('').max(100),
  startDate: Joi.string().required(),
  endDate: Joi.string(),
  typeData: Joi.object().required(),
  importProjectCustomType: Joi.string(),
  customFields: Joi.array().items(customFieldSchema),
  status: Joi.string(),
  priority: Joi.string().max(100).allow(''),
  collaborators: Joi.array(),
  requestMeta: Joi.object(),
  gitVersionControl: Joi.boolean(),
  gitRepoLink: Joi.string(),
  files: Joi.array(),
});

export const createGitlabProjectPayloadSchema = Joi.object({
  projectID: Joi.string().required(),
});

export const getProjectsQuerySchema = Joi.object({
  q: Joi.string().allow(''),
  qL: Joi.string().allow(''),
  page: Joi.string(),
  perPage: Joi.string(),
  status: Joi.string(),
  startDate: Joi.string().allow(''),
  endDate: Joi.string().allow(''),
  department: Joi.string(),
  template: Joi.string(),
  sort: Joi.boolean(),
  sortBy: Joi.string().allow(''),
  sortDirection: Joi.string().allow(''),
});

export const updateProjectPayloadSchema = Joi.object({
  name: Joi.string(),
  displayName: Joi.string(),
  description: Joi.string(),
  status: Joi.string(),
  lead: Joi.object(),
  leads: Joi.array(),
  categoryId: Joi.string().allow('').max(100),
  collaborators: Joi.object(),
  startDate: Joi.string(),
  endDate: Joi.string(),
  customFields: Joi.array().items(customFieldSchema),
  priority: Joi.string().max(100).allow(''),
  updateType: Joi.string().max(100).allow(''),
  gitlabId: Joi.string().allow(''),
  alfrescoId: Joi.string().allow(''),
  oldLead: Joi.string().allow(''),
  isRequestProject: Joi.boolean().allow('').optional(),
  actionHours: Joi.array().optional(),
  riskNotes: Joi.object().optional(),
});

export const updateProjectRequestStatusPayloadSchema = Joi.object({
  note: Joi.string(),
  status: Joi.string(),
});

export const projectPermissionQuerySchema = Joi.object({
  expand: Joi.string(),
});

export const assignPermissionsParamsSchema = Joi.object({
  id: Joi.string().max(100).required().description('Project ID'),
});

export const assignPermissionPayloadSchema = Joi.object({
  id: Joi.string().max(100).required().description('Permission Scheme ID'),
});

export const addCollaboratorsPayloadSchema = Joi.object({
  group: Joi.array(),
  user: Joi.array(),
  collaborators: Joi.array(),
  gitlabId: Joi.string().allow(''),
  alfrescoId: Joi.string().allow(''),
  lead: Joi.string().allow(''),
});

export const getProjectRolesDetailsParamsSchema = Joi.object({
  id: Joi.string().max(100).required(),
  rid: Joi.string().max(100).required(),
});

export const deleteProjectCollaboratorQuerySchema = Joi.object({
  group: Joi.string(),
  user: Joi.string(),
  gitlabId: Joi.string().allow(''),
  alfrescoId: Joi.string().allow(''),
  lead: Joi.string(),
});

export const updateProjectStatusPayloadSchema = Joi.object({
  status: Joi.string().required(),
  requestId: Joi.string(),
  endDate: Joi.string(),
});

export const addProjectCommentsPayloadSchema = Joi.object({
  comments: Joi.object({
    author: Joi.any(),
    comment: Joi.string(),
  }),
});

export const deleteProjectCommemtParamsSchema = Joi.object({
  id: Joi.string().max(100).required(),
  cid: Joi.string().max(100).required(),
});

export const getProjectsByUserIdPayloadSchema = Joi.object({
  q: Joi.string().allow(''),
  qL: Joi.string().allow(''),
  page: Joi.string().allow(''),
  perPage: Joi.string(),
  status: Joi.string(),
  startDate: Joi.string().allow(''),
  endDate: Joi.string().allow(''),
  department: Joi.string(),
  sort: Joi.boolean(),
  sortBy: Joi.string().allow(''),
  sortDirection: Joi.string().allow(''),
});

export const getProjectDetailsByUserIdParamsSchema = Joi.object({
  pid: Joi.string().max(100).required(),
  id: Joi.string().max(100).required(),
});

export const getProjectsForReportsQuerySchema = Joi.object({
  showAll: Joi.string().required(),
  page: Joi.string(),
  perPage: Joi.string(),
  department: Joi.string(),
  template: Joi.string(),
  startDate: Joi.string().allow(''),
  endDate: Joi.string().allow(''),
  completedAt: Joi.string().allow(''),
  createdAt: Joi.string().allow(''),
  q: Joi.string().allow(''),
  qL: Joi.string().allow(''),
  filters: Joi.string().allow(''),
  sort: Joi.boolean(),
  sortBy: Joi.string().allow(''),
  sortDirection: Joi.string().allow(''),
});

export const getProjectsImportListQuerySchema = Joi.object({
  page: Joi.string(),
  perPage: Joi.string(),
  department: Joi.string(),
  template: Joi.string(),
  q: Joi.string().allow(''),
  qL: Joi.string().allow(''),
});

export const getProjectsForTileViewQuerySchema = Joi.object({
  showAll: Joi.string().required(),
  page: Joi.string(),
  perPage: Joi.string(),
  status: Joi.string().allow(''),
  department: Joi.string(),
  template: Joi.string(),
  startDate: Joi.string().allow(''),
  endDate: Joi.string().allow(''),
  q: Joi.string().allow(''),
  qL: Joi.string().allow(''),
  filters: Joi.string().allow(''),
  sort: Joi.boolean(),
  sortBy: Joi.string().allow(''),
  sortDirection: Joi.string().allow(''),
});

export const exportProjectQuerySchema = Joi.object({
  showAll: Joi.string().required(),
  page: Joi.string(),
  perPage: Joi.string(),
  quarter: Joi.string().allow(''),
  department: Joi.string(),
  template: Joi.string(),
  startDate: Joi.string().allow(''),
  endDate: Joi.string().allow(''),
  completedAt: Joi.string().allow(''),
  createdAt: Joi.string().allow(''),
  q: Joi.string().allow(''),
  qL: Joi.string().allow(''),
  filters: Joi.string().allow(''),
  selectedProjectIds: Joi.string().allow(''),
  type: Joi.string().valid('XLSX', 'HOTSHEET'),
  hotsheetId: Joi.string(),
});

export const projectTableFiltersQuerySchema = Joi.object({
  department: Joi.string(),
  template: Joi.string(),
  fieldName: Joi.string(),
  startDate: Joi.string().allow(''),
  endDate: Joi.string().allow(''),
  completedAt: Joi.string().allow(''),
  q: Joi.string().allow(''),
  qL: Joi.string().allow(''),
  filters: Joi.string().allow(''),
});

export const projectTableCustomFiltersQuerySchema = Joi.object({
  department: Joi.string(),
  template: Joi.string(),
  fieldName: Joi.string().required(),
  startDate: Joi.string().allow(''),
  endDate: Joi.string().allow(''),
  completedAt: Joi.string().allow(''),
  q: Joi.string().allow(''),
  qL: Joi.string().allow(''),
  filters: Joi.string().allow(''),
});

export const updateScopeVersionControlLinkPayloadSchema = Joi.object({
  type: Joi.string().required(),
  link: Joi.string(),
});

export const addAttachmentsForDRRProjectsPayloadSchema = Joi.object({
  files: Joi.any().required(),
  type: Joi.string(),
});

export const getProjectLeadsListQuerySchema = Joi.object({
  categoryId: Joi.string(),
});

export const importSBOActionHoursPayloadSchema = Joi.object({
  file: Joi.alternatives().try(
    Joi.binary().encoding('base64'),
    Joi.any()
  ).required(),
});

export const addSBOQuarterPayloadSchema = Joi.object({
  quarter: Joi.string().required(),
  actualFTE: Joi.string().allow(''),
  notes: Joi.string().allow(''),
});

export const updateQuarterInProjectPayloadSchema = Joi.object({
  quarter: Joi.string().required(),
  actualFTE: Joi.string().allow(''),
  notes: Joi.string().allow(''),
});

export const getCustomFieldsValuesQuerySchema = Joi.object({
  field: Joi.string().required(),
});

export const updateProjectFieldPayloadSchema = Joi.object({
  field: Joi.string().required(),
  value: Joi.alternatives().try(
    Joi.string(),                // Accept string
    Joi.object(),                // Accept single object
    Joi.array().items(Joi.object())  // Accept array of objects
  ).required(),  // Make the value required
  isCFField: Joi.boolean().required(),
});

export const updateCaseStudyProjectPayloadSchema = Joi.object({
  smhApprovalStatus: Joi.string(),
  caseStudyApprovalRejectionReason: Joi.string(),
  status: Joi.string(),
});