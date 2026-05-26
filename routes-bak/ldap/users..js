import Auth from "../../connectors/auth.js";
import { ldapUserServices } from "../../services-bak/ldap/user.js";
import { authenticateUserPayloadSchema } from "../../validators/jiraUserValidator.js";

export const findUsers = {
  path: '/api/v1/ldap/users',
  method: 'GET',
  config: {
    description: 'Perform a generic search for users that match the specified filter',
    tags: ['api', 'Ldap users'],
    auth: 'jwt',
  },
  handler: async (request, h) => {
    try {
      const opts = {
        filters: request.query,
      };
      const response = await ldapUserServices.findUsers(opts);
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};

export const authenticateUser = {
  path: '/api/v1/ldap/authenticate',
  method: 'POST',
  config: {
    description: 'Authenticates a user using J&J LDAP system',
    tags: ['api', 'Ldap users'],
    validate: {
      payload: authenticateUserPayloadSchema,
    },
  },
  handler: async (request, h) => {
    try {
      const authInstance = new Auth(request.payload.email, request.payload.password);
      const response = await authInstance.loginLDAP();
      return h.response(response).code(response?.code || 200);
    } catch (error) {
      return h.response(error).code(error?.code || 400);
    }
  },
};
