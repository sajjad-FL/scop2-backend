import { jiraUserServices } from "../../services-bak/jira/users.js";
import {
  jiraCreateUser,
  jiraGetUsers,
  jiraUserMyPermissions,
  jiraSearchUsersWithPermissions,
  jiraGetUserById,
  jiraUDRUserById
} from "../../apidocs/user-responses.js";
import {
  createBulkUsersPayloadSchema,
  createJjedsPayloadSchema,
  createUserPayloadSchema,
  permissionsQuerySchema,
  searchQuerySchema,
  searchUsersPermissionsQuerySchema,
  updateAllProjectsPayloadSchema,
  updateCustomDisplayPayloadSchema,
  updateDefaultGitVersionControlTypePayloadSchema,
  updateDefaultPagePayloadSchema,
  updateDefaultProjectStatusSchema,
  updateDefaultTypePayloadSchema,
  updateDisplayPrConPagePayloadSchema,
  updateEmailNotificationPayloadSchema,
  updateJjedsDataPayloadSchema,
  updateRequestTabsPayloadSchema,
  objectIdParamsSchema
} from "../../validators/jiraUserValidator.js";
import { globalFailAction } from "../../utils/helper.js";

export const createUser = {
  path: '/api/v1/jira/users',
  method: 'POST',
  options: {
    description: 'Create a new user',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      payload: createUserPayloadSchema,
    },
    notes: [
      'Creates a new user',
      'ADMIN ACCESS REQUIRED',
    ],
    plugins: {
      'hapi-swagger': {
        responses: jiraCreateUser,
      },
    },
  },
  handler: async (request, h) => {
    const opts = {
      user: request.payload,
    };
    try {
      const response = await jiraUserServices.createUser(opts);
      return h.response(response).code(200);
    } catch (error) {
      return h.response(error).code(error.code);;
    }
  },
};

export const createBulkUser = {
  path: '/api/v1/jira/users/bulk',
  method: 'POST',
  options: {
    description: 'Create a new user',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      payload: createBulkUsersPayloadSchema,
    },
    notes: [
      'Bulk create new users',
      'ADMIN ACCESS REQUIRED',
    ],
    plugins: {
      'hapi-swagger': {
        responses: jiraCreateUser,
      },
    },
  },
  handler: async (request, h) => {
    const opts = {
      users: request.payload,
    };
    try {
      const response = await jiraUserServices.bulkCreateUsers(opts);
      return h.response(response).code(200);
    } catch (error) {
      return h.response(error).code(error.code);;
    }
  },
};

export const search = {
  path: '/api/v1/jira/users',
  method: 'GET',
  options: {
    description: 'search users by username, name or e-mail address',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      query: searchQuerySchema,
    },
    notes: ['username is required in the query'],
    plugins: {
      'hapi-swagger': {
        responses: jiraGetUsers,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        query: request.query.q,
        page: Number(request.query.page),
        perPage: Number(request.query.perPage),
      };
      const response = await jiraUserServices.search(opts);
      return h.response(response).code(200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const getUserById = {
  path: '/api/v1/jira/users/{id}',
  method: 'GET',
  options: {
    description: 'Get User by username',
    tags: ['api', 'jira', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraGetUserById,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        username: request.params.id,
      };
      const response = await jiraUserServices.getUser(opts);
      return h.response(response).code(200);
    } catch (error) {
      if (error?.statusCode) {
        return h.response(error?.body).code(error?.statusCode || 400);
      }
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const getUserByObjectId = {
  path: '/api/v1/db/users/{id}',
  method: 'GET',
  options: {
    description: 'Get User by Object Id',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraGetUserById,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        id: request.params.id,
      };
      const response = await jiraUserServices.getUserByObjectId(opts);
      return h.response(response).code(200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const deleteUser = {
  path: '/api/v1/jira/users/{id}',
  method: 'DELETE',
  options: {
    description: 'Delete User',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraUDRUserById,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        username: request.params.id,
      };
      let response;
      if (request.query.type === 'permanent') {
        response = await jiraUserServices.deleteUserPermanent(opts);
      } else {
        response = await jiraUserServices.deleteUser(opts);
      }
      return h.response(response).code(200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const editUser = {
  path: '/api/v1/jira/users/{id}',
  method: 'PUT',
  options: {
    description: 'Update User',
    tags: ['api', 'jira', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraUDRUserById,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        username: request.params.id,
        user: request.payload,
      };
      const response = await jiraUserServices.editUser(opts);
      return h.response(response).code(200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const restoreUser = {
  path: '/api/v1/jira/users/{id}',
  method: 'PATCH',
  options: {
    description: 'Restore User',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraUDRUserById,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        username: request.params.id,
      };
      const response = await jiraUserServices.restoreUser(opts);
      return h.response(response).code(200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const myPermissions = {
  path: '/api/v1/jira/users/permissions/my',
  method: 'GET',
  options: {
    description: 'Fetch permissions of the logged in User',
    tags: ['api', 'jira', 'permissions'],
    auth: 'jwt',
    notes: ['Either of projectKey, projectId, issueKey or issueId is required in the query'],
    validate: {
      query: permissionsQuerySchema,
    },
    plugins: {
      'hapi-swagger': {
        responses: jiraUserMyPermissions
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        projectKey: request.query.projectKey,
        projectId: request.query.projectId,
        issueKey: request.query.issueKey,
        issueId: request.query.issueId,
      };
      const response = await jiraUserServices.myPermissions(opts);
      return h.response(response).code(200);
    } catch (error) {
      if (error?.statusCode) {
        return h.response(error).code(error?.statusCode);
      }
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const searchUsersWithPermissions = {
  path: '/api/v1/jira/users/permissions/search',
  method: 'GET',
  options: {
    description: 'Returns a list of active users that match the search string',
    tags: ['api', 'jira', 'permissions'],
    auth: 'jwt',
    validate: {
      query: searchUsersPermissionsQuerySchema,
    },
    notes: [
      'EXPERIMENTAL. This endpoint is not working as of now',
      'Returns a list of active users that match the search string and have all specified permissions for the project or issue',
      'This resource can be accessed by users with ADMINISTER_PROJECT permission for the project or global ADMIN or SYSADMIN rights.',
    ],
    plugins: {
      'hapi-swagger': {
        responses: jiraSearchUsersWithPermissions,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        auth: request.jiraAuth,
        username: request.query.username,
        permissions: request.query.permissions,
        projectKey: request.query.projectKey,
        issueKey: request.query.issueKey,
        startAt: request.query.startAt,
        maxResults: 1000,
      };
      const response = await jiraUserServices.searchPermissions(opts);
      return h.response(response).code(200);
    } catch (error) {
      if (error?.statusCode) {
        return h.response(error).code(error?.statusCode);
      }
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const scrapeJjedsData = {
  path: '/api/v1/users/scrape',
  method: 'GET',
  options: {
    description: 'Scrape JJEDS Users Data',
    tags: ['api', 'jira', 'Users'],
  },
  handler: async (request, h) => {
    try {
      const response = await jiraUserServices.scrapeJjedsData();
      return h.response(response).code(200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const getAllJjedsData = {
  path: '/api/v1/users/jjeds',
  method: 'GET',
  options: {
    description: 'Get All JJEDS Data',
    tags: ['api', 'jira', 'Users'],
    auth: 'jwt',
  },
  handler: async (request, h) => {
    try {
      const response = await jiraUserServices.getAllJjedsData(request.isSuperAdmin, request.query.type);
      return h.response(response).code(200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const createJjedsData = {
  path: '/api/v1/users/jjeds',
  method: 'POST',
  options: {
    description: 'Bulk create JJEDS Data',
    tags: ['api', 'jira', 'Users'],
    auth: 'jwt',
    validate: {
      payload: createJjedsPayloadSchema,
    },
    notes: [
      'Bulk create JJEDS data',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const response = await jiraUserServices.createJjedsData(request.payload, request.isSuperAdmin);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const updateJjedsData = {
  path: '/api/v1/users/jjeds/{id}',
  method: 'PUT',
  options: {
    description: 'Updates JJEDS User Data',
    tags: ['api', 'jira', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateJjedsDataPayloadSchema,
    },
    notes: [
      'Updates jjeds user data',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        data: request.payload,
        superAdmin: request.isSuperAdmin,
      };
      const response = await jiraUserServices.updateJjedsData(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const deleteJjedsData = {
  path: '/api/v1/users/jjeds/{id}',
  method: 'DELETE',
  options: {
    description: 'Delete JJEDS User Data',
    tags: ['api', 'jira', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
    notes: [
      'Deletes jjeds user data',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, h) => {
    try {
      const response = await jiraUserServices.deleteJjedsData(request.params.id, request.isSuperAdmin);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const getJjedsData = {
  path: '/api/v1/users/{id}/jjeds',
  method: 'GET',
  options: {
    description: 'Get JJEDS User Data',
    tags: ['api', 'jira', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const response = await jiraUserServices.getJjedsData(request?.params?.id);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@TODO: Remove this deprecated route
export const uploadJjedsData = {
  path: '/api/v1/users/jjeds/upload',
  method: 'POST',
  options: {
    description: 'Upload JJEDS Data',
    tags: ['api', 'jira', 'Users'],
    auth: 'jwt',
    validate: {
      payload: updateJjedsDataPayloadSchema,
    },
    notes: [
      'Upload JJEDS data',
      'ADMIN ACCESS REQUIRED',
    ],
  },
  handler: async (request, reply) => {
    try {
      const response = await jiraUserServices.uploadJjedsData(request.payload, request.isSuperAdmin);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const superAdminUser = {
  path: '/api/v1/jira/users/{id}/superadmin',
  method: 'PUT',
  options: {
    description: 'Authorize or revoke superamdin permissions',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const response = await jiraUserServices.superAdminUser(request.params.id);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

//@CHECK: the upload profile picture functionality
export const uploadProfileImage = {
  path: '/api/v1/jira/users/upload/profileImage/{id}',
  method: 'POST',
  options: {
    description: 'Upload user profile image',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema
    },
    payload: {
      output: 'stream',
      parse: true,
      allow: 'multipart/form-data',
      maxBytes: 1000 * 1000 * 20,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        profileImage: request.payload.profileImage,
      };
      const response = await jiraUserServices.uploadProfileImage(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateDefaultPage = {
  path: '/api/v1/jira/users/{id}/defaultPage',
  method: 'PUT',
  options: {
    description: 'Updates default page',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateDefaultPagePayloadSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        page: request.payload.page,
      };
      delete opts.page.visible;
      const response = await jiraUserServices.updateDefaultPage(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateDefaultType = {
  path: '/api/v1/jira/users/{id}/defaultType',
  method: 'PUT',
  options: {
    description: 'Updates default project type',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateDefaultTypePayloadSchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        type: request.payload.type,
      };
      const response = await jiraUserServices.updateDefaultType(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateAllProjects = {
  path: '/api/v1/jira/users/{id}/all-projects',
  method: 'PUT',
  options: {
    description: 'Updates default project type',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateAllProjectsPayloadSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        allProjects: request.payload.allProjects,
      };
      const response = await jiraUserServices.updateAllProjects(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateDefaultProjectStatus = {
  path: '/api/v1/jira/users/{id}/default-project-status',
  method: 'PUT',
  options: {
    description: 'Updates default project status',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateDefaultProjectStatusSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        status: request.payload.status,
        department: request.payload.department,
      };
      const response = await jiraUserServices.updateDefaultProjectStatus(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateDefaultGitVersionControlType = {
  path: '/api/v1/jira/users/{id}/git-version-control-type',
  method: 'PUT',
  options: {
    description: 'Updates git version control type',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateDefaultGitVersionControlTypePayloadSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        gitVersionControlType: request.payload.gitVersionControlType,
      };
      const response = await jiraUserServices.updateGitVersionControlType(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateCustomDisplay = {
  path: '/api/v1/jira/users/{id}/update-custom-display',
  method: 'PUT',
  options: {
    description: 'Updates custom display',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateCustomDisplayPayloadSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        customDisplayValues: request.payload.customDisplayValues,
        department: request.payload.department,
      };
      const response = await jiraUserServices.updateUserCustomDisplayValues(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateDisplayPrConPage = {
  path: '/api/v1/jira/users/{id}/displayPrConPage',
  method: 'PUT',
  options: {
    description: 'Updates display of project confirmation page',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateDisplayPrConPagePayloadSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        prConPage: request.payload.prConPage,
      };
      const response = await jiraUserServices.updateDisplayPrConPage(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateRequestTabs = {
  path: '/api/v1/jira/users/{id}/setRequestTabs',
  method: 'PUT',
  options: {
    description: 'Updates request tabs',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateRequestTabsPayloadSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        requestTabs: request.payload.requestTabs,
      };
      const response = await jiraUserServices.updateRequestTabs(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const validateUserOrganizationalUnit = {
  path: '/api/v1/jira/users/organizational/validate',
  method: 'GET',
  options: {
    description: 'Validates Users Organizational Unit',
    tags: ['api', 'Users'],
    auth: 'jwt',
  },
  handler: async (request, h) => {
    try {
      const response = await jiraUserServices.validateUserOrganizationalUnit(request.jiraAuth);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const getJJEmployees = {
  path: '/api/v1/jira/users/jjEmployees',
  method: 'GET',
  options: {
    description: 'Get J&J Employees by username, name or e-mail address',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      query: searchQuerySchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        query: request.query.q,
        page: Number(request.query.page),
        perPage: Number(request.query.perPage),
      };
      const response = await jiraUserServices.getJJEmployees(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};

export const updateEmailNotification = {
  path: '/api/v1/jira/users/{id}/emailNotification',
  method: 'PUT',
  options: {
    description: 'Updates email notification',
    tags: ['api', 'Users'],
    auth: 'jwt',
    validate: {
      params: objectIdParamsSchema,
      payload: updateEmailNotificationPayloadSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        id: request.params.id,
        emailNotification: request.payload.emailNotification,
      };
      const response = await jiraUserServices.updateEmailNotification(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);;
    }
  },
};
