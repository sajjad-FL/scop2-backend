const {
  jiraRoleSchema,
  generalErrorSchema,
} = require('./schemas');

const create = {
  201: {
    description: 'Success',
    schema: jiraRoleSchema,
  },
  400: {
    description: 'Bad Request',
    schema: generalErrorSchema,
  },
  403: {
    description: 'Forbidden',
    schema: generalErrorSchema,
  },
  500: {
    description: 'Internal Server Error',
    schema: generalErrorSchema,
  },
};

const getRoles = {
  200: {
    description: 'Success',
    schema: {
      type: 'array',
      items: {
        schema: jiraRoleSchema,
      },
    },
  },
  400: {
    description: 'Bad Request',
    schema: generalErrorSchema,
  },
  403: {
    description: 'Forbidden',
    schema: generalErrorSchema,
  },
  500: {
    description: 'Internal Server Error',
    schema: generalErrorSchema,
  },
};

const getRoleById = {
  200: {
    description: 'Success',
    schema: jiraRoleSchema,
  },
  400: {
    description: 'Bad Request',
    schema: generalErrorSchema,
  },
  401: {
    description: 'Returned if the current user is not authenticated.',
    schema: generalErrorSchema,
  },
  403: {
    description: 'Forbidden',
    schema: generalErrorSchema,
  },
  404: {
    description: 'Returned if the requested role was not found.',
    schema: generalErrorSchema,
  },
  500: {
    description: 'Internal Server Error',
    schema: generalErrorSchema,
  },
};

const updateRole = {
  200: {
    description: 'Success',
    schema: jiraRoleSchema,
  },
  400: {
    description: 'Bad Request',
    schema: generalErrorSchema,
  },
  401: {
    description: 'Returned if the current user is not authenticated.',
    schema: generalErrorSchema,
  },
  403: {
    description: 'Forbidden',
    schema: generalErrorSchema,
  },
  404: {
    description: 'Returned if the requested role was not found.',
    schema: generalErrorSchema,
  },
  500: {
    description: 'Internal Server Error',
    schema: generalErrorSchema,
  },
};

const deleteRole = {
  200: {
    description: 'Success',
  },
  400: {
    description: 'Returned if user requested an group that does not exist.',
    schema: generalErrorSchema,
  },
  401: {
    description: 'Returned if the current user is not authenticated.',
    schema: generalErrorSchema,
  },
  403: {
    description: 'Forbidden',
    schema: generalErrorSchema,
  },
  404: {
    description: 'Returned if the requested group was not found.',
    schema: generalErrorSchema,
  },
  500: {
    description: 'Internal Server Error',
    schema: generalErrorSchema,
  },
};

const getActors = {
  200: {
    description: 'Success',
    schema: {
      type: 'object',
      properties: {
        actors: {
          type: 'array',
          items: {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                displayName: { type: 'string' },
                type: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  400: {
    description: 'Bad Request',
    schema: generalErrorSchema,
  },
  401: {
    description: 'Returned if the current user is not authenticated.',
    schema: generalErrorSchema,
  },
  403: {
    description: 'Forbidden',
    schema: generalErrorSchema,
  },
  404: {
    description: 'Returned if the requested role was not found.',
    schema: generalErrorSchema,
  },
  500: {
    description: 'Internal Server Error',
    schema: generalErrorSchema,
  },
};

const addActors = {
  200: {
    description: 'Success',
    schema: {
      type: 'object',
      properties: {
        actors: {
          type: 'array',
          items: {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                displayName: { type: 'string' },
                type: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  400: {
    description: 'Returned if the user does not exist.',
    schema: generalErrorSchema,
  },
  401: {
    description: 'Returned if the current user is not authenticated.',
    schema: generalErrorSchema,
  },
  403: {
    description: 'Forbidden',
    schema: generalErrorSchema,
  },
  404: {
    description: 'Returned if the requested group was not found.',
    schema: generalErrorSchema,
  },
  500: {
    description: 'Internal Server Error',
    schema: generalErrorSchema,
  },
};

const removeActor = {
  200: {
    description: 'Success',
    schema: {
      type: 'object',
      properties: {
        actors: {
          type: 'array',
          items: {
            schema: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                displayName: { type: 'string' },
                type: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  400: {
    description: 'Returned if the user does not exist.',
    schema: generalErrorSchema,
  },
  401: {
    description: 'Returned if the current user is not authenticated.',
    schema: generalErrorSchema,
  },
  403: {
    description: 'Forbidden',
    schema: generalErrorSchema,
  },
  404: {
    description: 'Returned if the requested group was not found.',
    schema: generalErrorSchema,
  },
  500: {
    description: 'Internal Server Error',
    schema: generalErrorSchema,
  },
};

module.exports = {
  create,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
  getActors,
  addActors,
  removeActor,
};
