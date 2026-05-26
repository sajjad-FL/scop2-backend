import Auth from '../../connectors/auth.js';
import { loginResponses, dbGetUsers } from '../../apidocs/user-responses.js';
import { accessPayloadSchema, loginPayloadSchema, usersQuerySchema, validatePayloadSchema } from '../../validators/authValidator.js';
import { dbUserServices } from '../../services-bak/db/user.js';

export const login = {
  path: '/api/v1/auth/login',
  method: 'POST',
  options: {
    auth: false,
    description: 'Login',
    tags: ['api', 'Login'],
    validate: {
      payload: loginPayloadSchema,
    },
    cors: true,
    notes: ['Authenticates a user and returrns the user data and token'],
    plugins: {
      'hapi-swagger': {
        responses: loginResponses,
      },
    },
  },
  handler: async (request, h) => {
    const authInstance = new Auth(request.payload.email.toLowerCase(), request.payload.password);
    try {
      const response = await authInstance.login();
      return h.response(response).code(200);
    } catch (error) {
      return h.response(error).code(error.code);;
    }
  },
};

export const validate = {
  path: '/api/v1/auth/validate',
  method: 'POST',
  options: {
    description: 'Login',
    tags: ['api', 'Login'],
    validate: {
      payload: validatePayloadSchema,
    },
    notes: ['Authenticates a user and returrns the user data'],
    plugins: {
      'hapi-swagger': {
        responses: loginResponses,
      },
    },
  },
  handler: async (request, h) => {
    const authInstance = new Auth(request.payload.email.toLowerCase());
    try {
      const response = await authInstance.validate();
      return h.response(response).code(200);
    } catch (error) {
      return h.response(error).code(error.code);;
    }
  },
};

export const access = {
  path: '/api/v1/auth/access',
  method: 'POST',
  options: {
    description: 'Access to Scope',
    tags: ['api', 'Login', 'users'],
    validate: {
      payload: accessPayloadSchema,
    },
    notes: ['Authenticates a user and returrns the user data'],
    plugins: {
      'hapi-swagger': {
        responses: loginResponses,
      },
    },
  },
  handler: async (request, h) => {
    try {
      const response = await dbUserServices.requestAccess(request.payload);
      return h.response(response).code(200);
    } catch (error) {
      return h.response(error).code(error.code);;
    }
  },
};

export const getUsers = {
  path: '/api/v1/my/users',
  method: 'GET',
  options: {
    description: 'search users by username, name or e-mail address',
    tags: ['api', 'users'],
    auth: 'jwt',
    notes: [
      'Search a user in the our own DB. If nothing is passed, returns all users.',
      'Defaults: startAt: 0, maxResults: 50, includeMeta: false, isEnabled: true',
      'isEnabled can have values: all, false, true',
    ],
    plugins: {
      'hapi-swagger': {
        responses: dbGetUsers,
      },
    },
    validate: {
      query: usersQuerySchema,
    },
  },
  handler: async (request, h) => {
    try {
      const opts = {
        username: request.query.username,
        email: request.query.email,
        startAt: request.query.startAt,
        maxResults: request.query.maxResults,
        isEnabled: request.query.isEnabled,
        includeMeta: request.query.includeMeta,
      };
      const users = await dbUserServices.searchUsers(opts);
      return h.response(users).code(200);
    } catch (error) {
      return h.response(error).code(500);
    }
  },
};
