import {
  createGroup,
  getGroups,
  removeGroup,
  getMembers,
  addMember,
  removeMember,
} from "../../apidocs/group-responses.js";
import { jiraGroupServices } from "../../services-bak/jira/group.js";
import { CONSTANTS } from "../../utils/constants.js";
import { globalFailAction } from "../../utils/helper.js";
import { logger } from "../../utils/logger.js";
import {
  addMemberPayloadSchema,
  createGroupPayloadSchema,
  findUsersAndGroupsQuerySchema,
  getGroupQuerySchema,
  getMembersQuerySchema,
  getOneParamsSchema,
  removeMemberParamsSchema,
  removeMemberQuerySchema,
  searchGroupQuerySchema,
} from "../../validators/jiraGroupValidators.js";

const { GROUPS } = CONSTANTS;

export const create = {
  path: '/api/v1/jira/groups',
  method: 'POST',
  config: {
    description: 'Creates a group by given group parameter',
    tags: ['api', 'groups'],
    auth: 'jwt',
    notes: ['Returns REST representation for the requested group'],
    plugins: {
      'hapi-swagger': {
        responses: createGroup,
      },
    },
    validate: {
      payload: createGroupPayloadSchema,
      failAction: globalFailAction
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        group: request.payload,
      };
      const response = await jiraGroupServices.createGroup(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const get = {
  path: '/api/v1/jira/groups',
  method: 'GET',
  config: {
    description: 'Returns groups',
    tags: ['api', 'groups'],
    auth: 'jwt',
    validate: {
      query: getGroupQuerySchema,
    },
    notes: [
      'Returns all groups.',
    ],
    plugins: {
      'hapi-swagger': {
        responses: getGroups,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        internal: Boolean(request.query &&
          request.query.internal === 'true' &&
          request.jiraAuth.isSuperAdmin),
        };
      const response = await jiraGroupServices.findGroups(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const syncGroup = {
  path: '/api/v1/jira/groups/sync-group',
  method: 'GET',
  config: {
    description: 'Returns groups',
    tags: ['api', 'groups'],
    auth: 'jwt',
    notes: [
      'Updates gitlab guest permission to reporter',
    ],
  },
  handler: async (request, h) => {
    try {
      let response;
      if (request && request.jiraAuth && request.jiraAuth.isSuperAdmin) {
        response = await jiraGroupServices.unlinkGitlabProjectWithGroup({ name: GROUPS.GUEST });
        logger.info('PROJECTS_SYNC_SUCCESS', response);
        return h.response(response).code(response?.code || 200);
      }
      return h.response({ message: 'You are not authorized to access this resource', error: 'Insufficient permission', code: 'UNAUTHORIZED' }).code(response?.code || 200);
    } catch (error) {
      logger.error('ERROR_PROJECTS_SYNC', error);
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const getOne = {
  path: '/api/v1/jira/groups/{gid}',
  method: 'GET',
  config: {
    description: 'Returns groups',
    tags: ['api', 'groups'],
    auth: 'jwt',
    validate: {
      params: getOneParamsSchema,
    },
    notes: [
      'Returns single groups.',
    ],
    plugins: {
      'hapi-swagger': {
        responses: getGroups,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        gid: request.params.gid,
      };
      const response = await jiraGroupServices.findGroup(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const remove = {
  path: '/api/v1/jira/groups/{gid}',
  method: 'DELETE',
  config: {
    description: 'Removes a group.',
    tags: ['api', 'groups'],
    auth: 'jwt',
    notes: ['Group Id must be provided in the path'],
    plugins: {
      'hapi-swagger': {
        responses: removeGroup,
      },
    },
    validate: {
      params: getOneParamsSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        gid: request.params.gid,
      };
      const response = await jiraGroupServices.removeGroup(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const getMembersAPI = {
  path: '/api/v1/jira/groups/{gid}/members',
  method: 'GET',
  config: {
    description: 'Get users from a group',
    tags: ['api', 'groups'],
    auth: 'jwt',
    notes: ['Group Id must be provided in the path'],
    plugins: {
      'hapi-swagger': {
        responses: getMembers,
      },
    },
    validate: {
      params: getOneParamsSchema,
      query: getMembersQuerySchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        gid: request.params.gid,
        query: request.query.q,
        page: Number(request.query.page),
        perPage: Number(request.query.perPage),
      };
      const response = await jiraGroupServices.getMembers(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const addMemberAPI = {
  path: '/api/v1/jira/groups/{gid}/members',
  method: 'POST',
  config: {
    description: 'Add user to a group',
    tags: ['api', 'groups'],
    auth: 'jwt',
    notes: [
      'Group Id must be provided in the path',
      'Id must be provided in the body',
    ],
    plugins: {
      'hapi-swagger': {
        responses: addMember,
      },
    },
    validate: {
      params: getOneParamsSchema,
      payload: addMemberPayloadSchema,
      failAction: globalFailAction,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        gid: request.params.gid,
        id: request.payload.id,
        addTeamMembers: request.payload.addTeamMembers,
        addMemberAsAdmin: request.payload.addMemberAsAdmin,
        addMemberAsRequestAdmin: request.payload.addMemberAsRequestAdmin,
        addMemberAsDtrAdmin: request.payload.addMemberAsDtrAdmin,
      };
      let response;
      if (opts.addMemberAsAdmin || opts.addMemberAsRequestAdmin || opts.addMemberAsDtrAdmin) {
        response = await jiraGroupServices.addUserToScopeAdminGroup(opts);
      } else {
        response = await jiraGroupServices.addUserToGroup(opts);
      }
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const removeMemberAPI = {
  path: '/api/v1/jira/groups/{gid}/members/{uid}',
  method: 'DELETE',
  config: {
    description: 'Remove user from a group',
    tags: ['api', 'groups'],
    auth: 'jwt',
    notes: [
      'Group ID must be provided in the path',
      'User ID must be provided in the path',
    ],
    plugins: {
      'hapi-swagger': {
        responses: removeMember,
      },
    },
    validate: {
      params: removeMemberParamsSchema,
      query: removeMemberQuerySchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        gid: request.params.gid,
        uid: request.params.uid,
        removeMemberAsAdmin: request.query.removeMemberAsAdmin,
      };
      const response = await jiraGroupServices.removeUserFromGroup(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const findUsersAndGroups = {
  path: '/api/v1/jira/groupuserpicker',
  method: 'GET',
  config: {
    description: 'Get users and groups ',
    tags: ['api', 'groups'],
    auth: 'jwt',
    validate: {
      query: findUsersAndGroupsQuerySchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        query: request.query.query,
      };
      const response = await jiraGroupServices.findUsersAndGroups(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const searchGroup = {
  path: '/api/v1/jira/groups/search',
  method: 'GET',
  config: {
    description: 'Returns groups by search value',
    tags: ['api', 'groups'],
    auth: 'jwt',
    validate: {
      query: searchGroupQuerySchema,
    },
    notes: [
      'Returns groups.',
    ],
    plugins: {
      'hapi-swagger': {
        responses: getGroups,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        searchElement: request.query.groupname,
      };
      const response = await jiraGroupServices.searchGroup(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};
