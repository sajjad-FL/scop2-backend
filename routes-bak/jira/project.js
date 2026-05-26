import _ from 'lodash';
import {
  jiraCommonResponse,
  jiraCreateProject,
  jiraCreateProjectCategory,
  jiraGetAllProjectCategories,
  jiraGetAllProjects,
  jiraGetProjectById,
  jiraGetProjectCategoryById,
  jiraGetProjectStatuses,
  jiraGetProjectTypes,
  jiraProjectPermissionSchemes
} from './../../apidocs/project-responses.js';
import { logger } from '../../utils/logger.js';
import { addAttachmentsForDRRProjectsPayloadSchema, addCollaboratorsPayloadSchema, addProjectCommentsPayloadSchema, addSBOQuarterPayloadSchema, assignPermissionPayloadSchema, assignPermissionsParamsSchema, attributeSchema, createGitlabProjectPayloadSchema, createProjectCategoryPayloadSchema, createProjectTypePayloadSchema, customFieldSchema, deleteProjectCollaboratorQuerySchema, deleteProjectCommemtParamsSchema, exportProjectQuerySchema, getCustomFieldsValuesQuerySchema, getHtmlCustomProjectTypePayloadSchema, getProjectDetailsByUserIdParamsSchema, getProjectLeadsListQuerySchema, getProjectRolesDetailsParamsSchema, getProjectsByUserIdPayloadSchema, getProjectsForReportsQuerySchema, getProjectsForTileViewQuerySchema, getProjectsImportListQuerySchema, getProjectsQuerySchema, importSBOActionHoursPayloadSchema, projectCreatePayloadSchema, projectCreateQuerySchema, projectPermissionQuerySchema, projectTableCustomFiltersQuerySchema, projectTableFiltersQuerySchema, updateCaseStudyProjectPayloadSchema, updateProjectFieldPayloadSchema, updateProjectPayloadSchema, updateProjectRequestStatusPayloadSchema, updateProjectStatusPayloadSchema, updateProjectTypePayloadSchema, updateQuarterInProjectPayloadSchema, updateScopeVersionControlLinkPayloadSchema } from '../../validators/jiraProjectValidator.js';
import { jiraProjectServices } from '../../services-bak/jira/project.js';
import { objectIdParamsSchema } from '../../validators/jiraUserValidator.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { globalFailAction } from '../../utils/helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//@Project Routes
export const createProject = {
  path: '/api/v1/jira/projects',
  method: 'POST',
  config: {
    description: 'Create Project',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    payload: {
      maxBytes: 100000000,
      parse: true,
    },
    validate: {
      query: projectCreateQuerySchema,
      payload: projectCreatePayloadSchema,
      failAction: globalFailAction
    },
    notes: [
      'Creates a new project',
      'ADMIN ACCESS REQUIRED',
    ],
    plugins: {
      'hapi-swagger': {
        responses: jiraCreateProject,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        project: request.payload,
        versionControl: request.query.versionControl === 'true', // qs are by default string
      };
      const response = await jiraProjectServices.createProject(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const createGitlabProject = {
  path: '/api/v1/jira/gitlab-project',
  method: 'POST',
  config: {
    description: 'Create Project in Gitlab',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      payload: createGitlabProjectPayloadSchema,
      failAction: globalFailAction
    },
    notes: [
      'Creates a new project in gitlab',
      'ADMIN ACCESS REQUIRED',
    ],
    plugins: {
      'hapi-swagger': {
        responses: jiraCreateProject,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        ...request.payload,
      };
      const response = await jiraProjectServices.createVersionControlProjects(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

//@TODO: Remove this deprecated route
export const createAlfrescoProject = {
  path: '/api/v1/jira/alfresco-project',
  method: 'POST',
  config: {
    description: 'Create Project in Alfresco',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      payload: createGitlabProjectPayloadSchema,
    },
    notes: [
      'Creates a new project in alfresco',
      'ADMIN ACCESS REQUIRED',
    ],
    plugins: {
      'hapi-swagger': {
        responses: jiraCreateProject,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        ...request.payload,
      };
      const response = await jiraProjectServices.createAlfrescoProject(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const getAllProjects = {
  path: '/api/v1/jira/projects',
  method: 'GET',
  config: {
    description: 'Get Projects',
    tags: ['api', 'Projects'],
    auth: {
      strategy: 'jwt',
      mode: 'optional',
    },
    validate: {
      query: getProjectsQuerySchema,
      failAction: globalFailAction
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraGetAllProjects,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const sort = request?.query?.sortDirection || '';
      const opts = {
        query: request.query.q,
        page: request.query.page,
        perPage: request.query.perPage !== 'all' ? Number(request.query.perPage) : request.query.perPage,
        status: request?.query?.status,
        sort: request?.query?.sort,
        startDate: request?.query?.startDate || '',
        endDate: request?.query?.endDate || '',
        department: request?.query?.department || 'All',
        template: request?.query?.template || 'All',
        queryLanguage: decodeURIComponent(request?.query?.qL),
        sortBy: request?.query?.sortBy,
        tableSort: sort === 'asc' ? 1 : sort === 'desc' ? -1 : 0
      };
      if (opts.queryLanguage === 'undefined') {
        opts.queryLanguage = undefined;
      }
      if (request?.query?.page) {
        opts.page = Number(request.query.page);
      }
      if (request.jiraAuth === undefined) {
        reply({ code: 401, error: 'Unauthorized', message: 'Missing authentication' }).code(401);
        return;
      }
      const response = await jiraProjectServices.getAllDirectReportsProjects(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      if (error?.statusCode === 403) {
        return h.response({ message: 'You are unauthorized to perform this action', code: 403 }).code(error.statusCode);
      } else if (error?.statusCode) {
        return h.response(error.body).code(error?.statusCode || 500);
      } else {
        return h.response(error).code(error?.code || 400);
      }
    }
  },
};

export const getProjectById = {
  path: '/api/v1/jira/projects/{id}',
  method: 'GET',
  config: {
    description: 'Get Project by id or key',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      failAction: globalFailAction
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraGetProjectById,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        projectIdOrKey: request.params.id,
      };
      const response = await jiraProjectServices.getProjectById(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateProject = {
  path: '/api/v1/jira/projects/{id}',
  method: 'PUT',
  options: {
    description: 'Update Project',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      payload: updateProjectPayloadSchema,
      failAction: globalFailAction
    },
    notes: [
      'Updates a existing project',
      'ADMIN ACCESS REQUIRED',
    ],
    plugins: {
      'hapi-swagger': {
        responses: jiraGetProjectById,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        projectIdOrKey: request.params.id,
        project: request.payload,
      };
      const response = await jiraProjectServices.updateProject(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateProjectRequestStatus = {
  path: '/api/v1/jira/projects/{id}/status',
  method: 'PUT',
  config: {
    description: 'Update Project Request Status',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateProjectRequestStatusPayloadSchema,
      failAction: globalFailAction
    },
    notes: [
      'Updates a existing project',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        projectID: request.params.id,
        status: request.payload.status,
        note: request.payload.note,
      };
      const response = await jiraProjectServices.updateProjectRequestStatus(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const deleteProject = {
  path: '/api/v1/jira/projects/{id}',
  method: 'DELETE',
  config: {
    description: 'Delete Project',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      failAction: globalFailAction
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraCommonResponse,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        projectIdOrKey: request.params.id,
      };
      let response;
      if (request.query.type === 'permanent') {
        response = await jiraProjectServices.deleteProjectPermanent(opts, request.query.gitlabId);
      } else {
        response = await jiraProjectServices.deleteProject(opts)
      }
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const restoreProject = {
  path: '/api/v1/jira/projects/{id}',
  method: 'PATCH',
  config: {
    description: 'Restore Project',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraCommonResponse,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const response = await jiraProjectServices.restoreProject(request.params.id);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const addCollaboratorsToProject = {
  path: '/api/v1/jira/projects/{id}/collaborator',
  method: 'POST',
  config: {
    description: 'Adds collaborators to a project',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: addCollaboratorsPayloadSchema,
      failAction: globalFailAction
    },
    notes: [
      'Adds collaborators to a project.',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        projectIdOrKey: request.params.id,
        payload: request.payload,
      };
      const response = await jiraProjectServices.addCollaboratorsToProject(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const deleteProjectCollaborator = {
  path: '/api/v1/jira/projects/{id}/collaborator',
  method: 'DELETE',
  config: {
    description: 'Deletes collaborator (users or groups) from a project',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      query: deleteProjectCollaboratorQuerySchema,
      failAction: globalFailAction
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraCommonResponse,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        projectIdOrKey: request.params.id,
        group: request.query.group,
        user: request.query.user,
        gitlabId: request.query.gitlabId,
        alfrescoId: request.query.alfrescoId,
        lead: request.query.lead,
      };
      const response = await jiraProjectServices.deleteProjectCollaborator(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateProjectStatus = {
  path: '/api/v1/jira/projects/{id}/statuses',
  method: 'PUT',
  config: {
    description: 'Updates project status',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateProjectStatusPayloadSchema,
    },
    notes: [
      'In payload status will only take either of the one specified values :-',
      'To Do',
      'In Progress',
      'Completed',
      'Attention',
      'On Hold',
    ],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        status: request.payload.status,
        auth: request.jiraAuth,
      };
      if (request.payload.requestId) {
        opts.requestId = request.payload.requestId;
        opts.endDate = request.payload.endDate;
      }
      const response = await jiraProjectServices.updateProjectStatus(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const getProjectComments = {
  path: '/api/v1/jira/projects/{id}/comments',
  method: 'GET',
  config: {
    description: 'Get Project Comments',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
      };
      const response = await jiraProjectServices.getProjectComments(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const addProjectComment = {
  path: '/api/v1/jira/projects/{id}/comments',
  method: 'POST',
  config: {
    description: 'Adds Comment To Project',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: addProjectCommentsPayloadSchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        comment: request.payload.comments,
      };
      const response = await jiraProjectServices.addProjectComment(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const deleteProjectComment = {
  path: '/api/v1/jira/projects/{id}/comments/{cid}',
  method: 'DELETE',
  config: {
    description: 'Deletes Project Comment',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: deleteProjectCommemtParamsSchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        cid: request.params.cid,
      };
      const response = await jiraProjectServices.deleteProjectComment(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const getDeletedProjects = {
  path: '/api/v1/jira/projects/deleted',
  method: 'GET',
  config: {
    description: 'Get Deleted Projects',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    plugins: {
      'hapi-swagger': {
        responses: jiraGetProjectCategoryById,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const response = await jiraProjectServices.getDeletedProjectsFromDB();
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const getProjectsByUserId = {
  path: '/api/v1/jira/projects/users/{id}',
  method: 'GET',
  config: {
    description: 'Get Projects By User Id',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      query: getProjectsByUserIdPayloadSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const sort = request?.query?.sortDirection || '';
      const opts = {
        query: request.query.q,
        queryLanguage: decodeURIComponent(request.query.qL),
        perPage: request.query.perPage !== 'all' ? Number(request.query.perPage) : request.query.perPage,
        status: request.query.status,
        startDate: request.query.startDate,
        endDate: request.query.endDate,
        department: request.query.department,
        sort: request.query.sort,
        sortBy: request.query.sortBy,
        tableSort: sort === 'asc' ? 1 : sort === 'desc' ? -1 : 0
      };
      if (opts.queryLanguage === 'undefined') {
        opts.queryLanguage = undefined;
      }
      if (request?.query?.page) {
        opts.page = Number(request.query.page);
      }
      const response = await jiraProjectServices.getProjectsByUserId(request.params.id, opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const getProjectDetailsByUserId = {
  path: '/api/v1/jira/projects/{pid}/users/{id}',
  method: 'GET',
  config: {
    description: 'Get Project Details By User Id',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: getProjectDetailsByUserIdParamsSchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const response = await jiraProjectServices.getProjectDetailsByUserId(request.params.pid, request.params.id);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const getProjectsForReports = {
  path: '/api/v1/jira/projects/reports',
  method: 'GET',
  config: {
    description: 'Get Projects For Reports',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      query: getProjectsForReportsQuerySchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const sort = request?.query?.sortDirection || '';
      const opts = {
        auth: request.jiraAuth,
        page: Number(request.query.page),
        perPage: Number(request.query.perPage),
        query: request.query.q,
        showAll: request.query.showAll,
        status: request.query.status,
        department: request.query.department,
        template: request.query.template,
        startDate: request.query.startDate,
        endDate: request.query.endDate,
        completedAt: request.query.completedAt,
        createdAt: request.query.createdAt,
        queryLanguage: decodeURIComponent(request.query.qL),
        sortBy: request.query.sortBy,
        tableSort: sort === 'asc' ? 1 : sort === 'desc' ? -1 : 0
      };
      if (opts.queryLanguage === 'undefined') {
        opts.queryLanguage = undefined;
      }
      if (request.query.filters && request.query.filters !== '') {
        const splitArray = request.query.filters.split('|');
        let splitObjects = splitArray.map((str) => {
          const splitStr = str.split(/:(.+)/);;
          const obj = {};
          const key = splitStr[0];
          const value = splitStr[1];
          obj[key] = value;
          return obj;
        });
        opts.filters = splitObjects;
        const durationObj = splitObjects?.find(item => item.hasOwnProperty('duration'));
        if (durationObj) {
          splitObjects = splitObjects.filter(item => !item.hasOwnProperty('duration'));
          opts['isDurationFilter'] = true;
          opts['duration'] = durationObj.duration;
        }
      }
      const response = await jiraProjectServices.getProjectsForReports(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const getProjectsImportList = {
  path: '/api/v1/jira/projects/import-list',
  method: 'GET',
  config: {
    description: 'Get Projects For Import list',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      query: getProjectsImportListQuerySchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const sort = request?.query?.sortDirection || '';
      const opts = {
        auth: request.jiraAuth,
        // directReports: request.query.directReports,
        page: Number(request.query.page),
        perPage: Number(request.query.perPage),
        query: request.query.q,
        department: request.query.department,
        template: request.query.template,
        queryLanguage: decodeURIComponent(request.query.qL),
      };
      if (opts.queryLanguage === 'undefined') {
        opts.queryLanguage = undefined;
      }
      const response = await jiraProjectServices.getProjectsImportList(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const getProjectsForTileView = {
  path: '/api/v1/jira/projects/tileview',
  method: 'GET',
  config: {
    description: 'Get Projects For Reports',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      query: getProjectsForTileViewQuerySchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const sort = request?.query?.sortDirection || '';
      const opts = {
        auth: request.jiraAuth,
        page: Number(request.query.page),
        perPage: Number(request.query.perPage),
        query: request.query.q,
        showAll: request.query.showAll,
        status: request.query.status,
        department: request.query.department,
        template: request.query.template,
        startDate: request.query.startDate,
        endDate: request.query.endDate,
        queryLanguage: decodeURIComponent(request.query.qL),
        sort: request.query.sort,
        sortBy: request.query.sortBy,
        tableSort: sort === 'asc' ? 1 : sort === 'desc' ? -1 : 0
      };
      if (opts.queryLanguage === 'undefined') {
        opts.queryLanguage = undefined;
      }
      if (opts?.sortBy === "recentlyModified") {
        opts.sortBy = "updatedAt";
      }
      if (request.query.filters && request.query.filters !== '') {
        const splitArray = request.query.filters.split('|');
        const splitObjects = splitArray.map((str) => {
          const splitStr = str.split(/:(.+)/);
          const obj = {};
          const key = splitStr[0];
          const value = splitStr[1];
          obj[key] = value;
          return obj;
        });
        opts.filters = splitObjects;
      }
      const response = await jiraProjectServices.getProjectsForTileView(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const exportProjects = {
  path: '/api/v1/jira/projects/reports/export',
  method: 'GET',
  config: {
    description: 'Export Projects For Reports',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      query: exportProjectQuerySchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        page: Number(request.query.page),
        perPage: Number(request.query.perPage),
        query: request.query.q,
        showAll: request.query.showAll,
        quarter: request.query.quarter,
        department: request.query.department,
        template: request.query.template,
        startDate: request.query.startDate,
        endDate: request.query.endDate,
        createdAt: request.query.createdAt,
        completedAt: request.query.completedAt,
        queryLanguage: decodeURIComponent(request.query.qL),
        selectedProjectIds: request.query.selectedProjectIds,
        type: request.query.type,
        hotsheetId: request.query.hotsheetId,
      };
      if (opts.queryLanguage === 'undefined') {
        opts.queryLanguage = undefined;
      }
      if (request.query.filters && request.query.filters !== '') {
        const splitArray = request.query.filters.split('|');
        const splitObjects = splitArray.map((str) => {
          const splitStr = str.split(/:(.+)/);
          const obj = {};
          const key = splitStr[0];
          const value = splitStr[1];
          obj[key] = value;
          return obj;
        });
        opts.filters = splitObjects;
      }
      let response;
      if (opts.type === 'XLSX') {
        logger.info('EXPORT_XLSX_STARTED');
        response = await jiraProjectServices.exportProjectsToExcel(opts);
      } else if (opts.type === 'HOTSHEET') {
        logger.info('EXPORT_HOTSHEET_STARTED');
        response = await jiraProjectServices.exportProjectsToHotSheet(opts);
      }
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@CHECK
export const importProjects = {
  path: '/api/v1/jira/projects/import',
  method: 'POST',
  config: {
    description: 'Import Projects',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    payload: {
      maxBytes: 1000 * 1000 * 1000,
    },
    notes: [
      'Import Projects',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const response = await jiraProjectServices.importProjects(request.payload);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const projectTableFilters = {
  path: '/api/v1/jira/projects/filters',
  method: 'GET',
  config: {
    description: 'Projects Default Table Filters',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      query: projectTableFiltersQuerySchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        department: request.query.department,
        template: request.query.template,
        field: request.query.fieldName,
        startDate: request.query.startDate,
        endDate: request.query.endDate,
        completedAt: request.query.completedAt,
        queryLanguage: decodeURIComponent(request.query.qL),
      };
  
      if (opts.queryLanguage === 'undefined') {
        opts.queryLanguage = undefined;
      }
      if (request.query.filters && request.query.filters !== '') {
        const splitArray = request.query.filters.split('|');
        const splitObjects = splitArray.map((str) => {
          const splitStr = str.split(/:(.+)/);;
          const obj = {};
          const key = splitStr[0];
          const value = splitStr[1];
          obj[key] = value;
          return obj;
        });
        opts.filters = splitObjects;
      }
      const response = await jiraProjectServices.projectTableFilters(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const projectTableCustomFilters = {
  path: '/api/v1/jira/projects/customfilters',
  method: 'GET',
  config: {
    description: 'Projects Default Custom Table Filters',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      query: projectTableCustomFiltersQuerySchema,
      failAction: globalFailAction,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        department: request.query.department,
        template: request.query.template,
        fieldName: request.query.fieldName,
        startDate: request.query.startDate,
        endDate: request.query.endDate,
        completedAt: request.query.completedAt,
        queryLanguage: decodeURIComponent(request.query.qL),
      };
  
      if (opts.queryLanguage === 'undefined') {
        opts.queryLanguage = undefined;
      }
      if (request.query.filters && request.query.filters !== '') {
        const splitArray = request.query.filters.split('|');
        const splitObjects = splitArray.map((str) => {
          const splitStr = str.split(/:(.+)/);;
          const obj = {};
          const key = splitStr[0];
          const value = splitStr[1];
          obj[key] = value;
          return obj;
        });
        opts.filters = splitObjects;
      }
      const response = await jiraProjectServices.projectTableCustomFilters(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateOldProjectsCollaborators = {
  path: '/api/v1/jira/projects/old/collaborators',
  method: 'GET',
  config: {
    description: 'Update Old Projects Collaborators',
    tags: ['api', 'Projects'],
  },
  handler: async (request, h) => {
    try {
      const response = await jiraProjectServices.updateOldProjectsCollaborators();
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const validateProjectAccess = {
  path: '/api/v1/jira/projects/{id}/access',
  method: 'GET',
  config: {
    description: 'Check if user has access to the project',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      failAction: globalFailAction
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraGetProjectById,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        projectId: request.params.id,
      };
      const response = await jiraProjectServices.checkProjectAccess(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateScopeVersionControlLink = {
  path: '/api/v1/jira/projects/{id}/updatescopeversioncontrollink',
  method: 'PUT',
  config: {
    description: 'Updating Scope Version Control Link',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateScopeVersionControlLinkPayloadSchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        projectId: request.params.id,
        payload: request.payload,
      };
      const response = await jiraProjectServices.updateScopeVersionControlLink(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const transferSMMProjectToSMH = {
  path: '/api/v1/jira/projects/{id}/transfer-smm-project-smh',
  method: 'POST',
  config: {
    description: 'transfer SMMC Project to SMH',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        projectId: request.params.id,
      };
      const response = await jiraProjectServices.transferSMMProjectToSMH(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const addAttachmentsForDRRProjects = {
  path: '/api/v1/jira/projects/{id}/addAttachmentsForDRRProjects',
  method: 'POST',
  options: {
    description: 'Adding Attachments For DRR Projects',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    payload: {
      // output: 'stream',
      parse: true,
      // multipart: true,
      // allow: 'multipart/form-data',
      // maxBytes: 100000000,
      maxBytes: 100000000,
    },
    validate: {
      params: objectIdParamsSchema,
      payload: addAttachmentsForDRRProjectsPayloadSchema,
      failAction: globalFailAction
    },
    notes: ['Adding Attachments For DRR Requests', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        projectId: request.params.id,
        payload: request.payload,
      };
      const response = await jiraProjectServices.addAttachmentsForDRRProjects(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const getProjectLeadsList = {
  path: '/api/v1/jira/projects/leads-list',
  method: 'GET',
  config: {
    description: 'Fetching leads data',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    notes: ['Fetching lead data', 'ADMIN ACCESS REQUIRED'],
    validate: {
      query: getProjectLeadsListQuerySchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        categoryId: request?.query?.categoryId || ''
      }
      const response = await jiraProjectServices.getProjectLeadsList(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  }
};

export const importSBOActionHours = {
  path: '/api/v1/jira/sbo/import-action-hours/{projectID}',
  method: 'POST',
  config: {
    description: 'Import SBO Action Hours',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    payload: {
      output: 'stream',
      parse: true,
      multipart: true,
      allow: 'multipart/form-data',
      maxBytes: 100000000,
    },
    validate: {
      payload: importSBOActionHoursPayloadSchema,
      failAction: globalFailAction
    },
    notes: ['Import SBO Action Hours'],
  },
  handler: async (request, h) => {
    try {
      const opts = { ...request.payload, projectID: request.params.projectID };
      const response = await jiraProjectServices.importSBOActionHours(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const exportSBOActionHours = {
  path: '/api/v1/jira/sbo/export-action-hours/{projectID}',
  method: 'GET',
  config: {
    description: 'Export SBO Action Hours',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    notes: ['Export SBO Action Hours'],
  },
  handler: async (request, h) => {
    try {
      const opts = { projectID: request.params.projectID };
      const response = await jiraProjectServices.exportSBOActionHours(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const addSBOQuarter = {
  path: '/api/v1/jira/sbo/quarter',
  method: 'POST',
  config: {
    description: 'Add SBO Quarter',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    notes: ['Add SBO Quarter'],
    validate: {
      payload: addSBOQuarterPayloadSchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        quarter: request.payload.quarter,
        actualFTE: request.payload.actualFTE,
        notes: request.payload.notes,
      };
      const response = await jiraProjectServices.addSBOQuarter(opts, request.jiraAuth)
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateQuarterInProject = {
  path: '/api/v1/jira/sbo/quarter/{projectID}',
  method: 'POST',
  config: {
    description: 'Update SBO Project Quarter',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    notes: ['Update SBO Project Quarter'],
    validate: {
      payload: updateQuarterInProjectPayloadSchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        projectID: request.params.projectID,
        quarter: request.payload.quarter,
        actualFTE: request.payload.actualFTE,
        notes: request.payload.notes,
      };
      const response = await jiraProjectServices.updateQuarterInProject(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const getCustomFieldValues = {
  path: '/api/v1/jira/customfield-values/{displayId}',
  method: 'GET',
  config: {
    description: 'Get Customfield values',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    notes: ['Get Customfield values'],
    validate: {
      query: getCustomFieldsValuesQuerySchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        displayId: request.params.displayId,
        field: request.query.field,
      };
      const response = await jiraProjectServices.getCustomFieldValues(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateProjectField = {
  path: '/api/v1/jira/customfield-values/{displayId}',
  method: 'PUT',
  config: {
    description: 'Update Customfield values',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    notes: ['Update Customfield values'],
    validate: {
      payload: updateProjectFieldPayloadSchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        displayId: request.params.displayId,
        field: request.payload.field,
        value: request.payload.value,
        isCFField: request.payload.isCFField,
      };
      const response = await jiraProjectServices.updateProjectField(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateCaseStudyProject = {
  path: '/api/v1/jira/update/casestudy/project/{id}',
  method: 'PUT',
  config: {
    description: 'Update Case Study project',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    payload: {
      maxBytes: 100000000,
      parse: true,
    },
    validate: {
      payload: updateCaseStudyProjectPayloadSchema,
      failAction: globalFailAction
    },
    notes: ['Update Approvers', 'ADMIN ACCESS REQUIRED'],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        projectID: request.params.id,
        payload: request.payload,
      };
      const response = await jiraProjectServices.updateCaseStudyProject(opts, request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const getProjectStatus = {
  path: '/api/v1/jira/projects/{id}/statuses',
  method: 'GET',
  config: {
    description: 'Get Project Status by id or key',
    tags: ['api', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      failAction: globalFailAction
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraGetProjectStatuses,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        projectIdOrKey: request.params.id,
      };
      const response = await jiraProjectServices.getStatuses(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      if (error.statusCode) {
        return h.response(error).code(error?.statusCode || 400);
      } else {
        return h.response({ message: 'Error in finding project' }).code(error?.code || 400);
      }
    }
  },
};

//@TODO: Remove this deprecated route
export const getProjectPermissionSchemes = {
  path: '/api/v1/jira/projects/{id}/permissionscheme',
  method: 'GET',
  config: {
    description: 'Get Project Permission Schemes by id or key',
    tags: ['api', 'Jira', 'Projects'],
    auth: 'jwt',
    // cache: {
    //   expiresIn: cacheConfig.expiresIn,
    // },
    validate: {
      params: objectIdParamsSchema,
      query: projectPermissionQuerySchema,
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraProjectPermissionSchemes,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        projectIdOrKey: request.params.id,
        expand: request.query.expand,
      };
      const response = await jiraProjectServices.getProjectPermissionSchemes(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const assignPermissionScheme = {
  path: '/api/v1/jira/projects/{id}/permissionscheme',
  method: 'PUT',
  config: {
    description: 'Assigns a permission scheme with a project.',
    tags: ['api', 'Jira', 'Projects'],
    auth: 'jwt',
    validate: {
      params: assignPermissionsParamsSchema,
      payload: assignPermissionPayloadSchema,
      query: projectPermissionQuerySchema,
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraProjectPermissionSchemes,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        projectIdOrKey: request.params.id,
        project: request.payload,
        expand: request.query.expand,
      };
      const response = await jiraProjectServices.assignPermissionScheme(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const getProjectRoles = {
  path: '/api/v1/jira/projects/{id}/role',
  method: 'GET',
  config: {
    description: 'Get Project Roles by id or key',
    tags: ['api', 'Jira', 'Projects'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        projectIdOrKey: request.params.id,
      };
      const response = await jiraProjectServices.getProjectRoles(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const getProjectRoleDetails = {
  path: '/api/v1/jira/projects/{id}/role/{rid}',
  method: 'GET',
  config: {
    description: 'Get Project Role Details by role id and project id or key',
    tags: ['api', 'Jira', 'Projects'],
    auth: 'jwt',
    validate: {
      params: getProjectRolesDetailsParamsSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        projectIdOrKey: request.params.id,
        roleId: request.params.rid,
      };
      const response = await jiraProjectServices.getProjectRoleDetails(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const getProjectTypes = {
  path: '/api/v1/jira/projects/types',
  method: 'GET',
  config: {
    description: 'Get Project Types',
    tags: ['api', 'Jira', 'Projects'],
    auth: 'jwt',
    plugins: {
      'hapi-swagger': {
        responses: jiraGetProjectTypes,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
      };
      const response = await jiraProjectServices.getTypes(opts);
      return h.response(response).code(response?.code || 200);
    } catch (err) {
      if (err.statusCode && err.statusCode === 403) {
        return h.response({ message: 'You are unauthorized to perform this action', code: 403 }).code(error?.statusCode || 400);
      } else if (err.statusCode) {
        return h.response(err.body).code(err?.statusCode || 400);
      } else {
        return h.response({ message: 'Error in finding project types' }).code(error?.code || 500);
      }
    }
  },
};

//@TODO: Remove this deprecated route
export const getProjectTemplates = {
  path: '/api/v1/jira/projects/templates',
  method: 'GET',
  config: {
    description: 'Get Project Templates',
    tags: ['api', 'Jira', 'Projects'],
    auth: 'jwt',
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
      };
      const response = await jiraProjectServices.getProjectTemplates(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@Template Routes
export const createCustomProjectType = {
  path: '/api/v1/jira/projects/types',
  method: 'POST',
  config: {
    description: 'Create Custom Project Type',
    tags: ['api', 'Templates or types'],
    auth: 'jwt',
    validate: {
      payload: createProjectTypePayloadSchema,
      failAction: globalFailAction,
    },
    notes: [
      'Creates a new custom project type',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const response = await jiraProjectServices.createCustomProjectType(request.payload);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const getCustomProjectTypes = {
  path: '/api/v1/jira/projects/ctypes',
  method: 'GET',
  config: {
    description: 'Get Custom Project Types',
    tags: ['api', 'Templates or types'],
    auth: 'jwt',
  },
  handler: async (request, h) => {
    try {
      const response = await jiraProjectServices.getCustomProjectTypes();
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const getCustomProjectTypesById = {
  path: '/api/v1/jira/projects/ctypes/{id}',
  method: 'GET',
  config: {
    description: 'Get Custom Project Types By Id',
    tags: ['api', 'Templates or types'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        categoryId: request.params.id,
      };
      const response = await jiraProjectServices.getCustomProjectTypesById(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const updateProjectType = {
  path: '/api/v1/jira/projects/{id}/types',
  method: 'PUT',
  config: {
    description: 'Updates project type',
    tags: ['api', 'Templates or types'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateProjectTypePayloadSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        projectIdOrKey: request.params.id,
        typeId: request.payload.typeId,
      };
      const response = await jiraProjectServices.updateProjectType(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateCustomProjectType = {
  path: '/api/v1/jira/projects/types/{id}',
  method: 'PUT',
  config: {
    description: 'Update Custom Project Type',
    tags: ['api', 'Templates or types'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: createProjectTypePayloadSchema,
    },
    notes: [
      'Updates custom project type',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        data: request.payload,
      };
      const response = await jiraProjectServices.updateCustomProjectType(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const deleteCustomProjectType = {
  path: '/api/v1/jira/projects/types/{id}',
  method: 'DELETE',
  config: {
    description: 'Delete Custom Project Type',
    tags: ['api', 'Templates or types'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
    notes: [
      'Deletes a custom project type',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
      };
      const response = await jiraProjectServices.deleteCustomProjectType(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const validateCustomProjectType = {
  path: '/api/v1/jira/projects/types/validate/{id}',
  method: 'GET',
  config: {
    description: 'Validates Custom Project Type',
    tags: ['api', 'Templates or types'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
    notes: [
      'Validates custom project type',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const response = await jiraProjectServices.validateCustomProjectType(request.params.id);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const validateCustomRequestType = {
  path: '/api/v1/jira/requests/types/validate/{id}',
  method: 'GET',
  config: {
    description: 'Validates Custom Request Type',
    tags: ['api', 'Templates or types'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
    notes: [
      'Validates custom project type',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const response = await jiraProjectServices.validateCustomRequestType(request.params.id);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const uploadHtmlCustomProjectType = {
  path: '/api/v1/jira/projects/types/{id}/upload',
  method: 'PUT',
  options: {
    description: 'Upload HTML In Custom Project Type',
    tags: ['api', 'Templates or types'],
    auth: 'jwt',
    payload: {
      output: 'stream',
      parse: true,
      multipart: true,
      allow: 'multipart/form-data',
      maxBytes: 1000 * 1000 * 10,
    },
    notes: [
      'Upload html custom project type',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        file: request.payload.html,
      };
      const response = await jiraProjectServices.uploadHtmlCustomProjectType(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const getHtmlCustomProjectType = {
  path: '/api/v1/jira/projects/types/upload/{fileName}',
  method: 'GET',
  config: {
    description: 'Get Custom Project Type HTML File',
    tags: ['api', 'Projects', 'project-types'],
    auth: 'jwt',
    validate: {
      params: getHtmlCustomProjectTypePayloadSchema,
    },
    notes: [
      'Get custom project type html file',
    ],
  },
  handler: async (request, h) => {
    const fileName = `${request?.params?.fileName}.html`;
    const filePath = join(__dirname, '../../uploads', fileName);
    if (!fs.existsSync(filePath)) {
      return h.response({ message: 'File not found' }).code(404);
    }
    const fileStream = fs.createReadStream(filePath);
    return h.response(fileStream).type('text/html');
  },
};

// Departments Routes
export const createProjectCategory = {
  path: '/api/v1/jira/projects/categories',
  method: 'POST',
  config: {
    description: 'Create Project Category',
    tags: ['api', 'Departments'],
    auth: 'jwt',
    validate: {
      payload: createProjectCategoryPayloadSchema,
    },
    notes: [
      'Creates a new project category',
      'ADMIN ACCESS REQUIRED',
    ],
    plugins: {
      'hapi-swagger': {
        responses: jiraCreateProjectCategory,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        name: request.payload.name,
        description: request.payload.description,
        isTA: request.payload.isTA,
      };
      const response = await jiraProjectServices.createProjectCategory(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }

    // global.services.jira.projectServices.createProjectCategory(opts).then((res) => {
    //   reply(res).code(res.code || 200);
    // }, (err) => {
    //   reply(err).code(err.code || 400);
    // });
  },
};

export const getAllProjectCategories = {
  path: '/api/v1/jira/projects/categories',
  method: 'GET',
  config: {
    description: 'Get Project Categories',
    tags: ['api', 'Departments'],
    auth: 'jwt',
    plugins: {
      'hapi-swagger': {
        responses: jiraGetAllProjectCategories,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        isSDSEmployee: request.jiraAuth.isSDSEmployee,
      };
      const response = await jiraProjectServices.getAllProjectCategories(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateProjectCategory = {
  path: '/api/v1/jira/projects/categories/{id}',
  method: 'PUT',
  config: {
    description: 'Update Project Category',
    tags: ['api', 'Departments'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: createProjectCategoryPayloadSchema,
    },
    notes: [
      'Updates a exsiting project category',
      'ADMIN ACCESS REQUIRED',
    ],
    plugins: {
      'hapi-swagger': {
        responses: jiraCreateProjectCategory,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        data: request.payload,
      };
      const response = await jiraProjectServices.updateProjectCategory(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const deleteProjectCategory = {
  path: '/api/v1/jira/projects/categories/{id}',
  method: 'DELETE',
  config: {
    description: 'Delete Project Category',
    tags: ['api', 'Departments'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
    notes: [
      'Removes a project category',
      'ADMIN ACCESS REQUIRED',
    ],
    plugins: {
      'hapi-swagger': {
        responses: jiraCommonResponse,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
      };
      const response = await jiraProjectServices.deleteProjectCategory(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const getProjectCategoryById = {
  path: '/api/v1/jira/projects/categories/{id}',
  method: 'GET',
  config: {
    description: 'Get Project Category by id',
    tags: ['api', 'Jira', 'Departments'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraGetProjectCategoryById,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        projectCategoryId: request.params.id,
      };
      const response = await jiraUserServices.getProjectCategoryById(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};