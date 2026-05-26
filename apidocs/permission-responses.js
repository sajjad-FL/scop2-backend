const {
  jiraPermissionSchema,
  jiraPermissionSchemeSchema,
  jiracreatePermissionSchemeSchema,
  jiraPermissionGrantSchema,
  generalErrorSchema,
} = require('./schemas');

const getAll = {
  200: {
    description: 'Success',
    schema: {
      type: 'array',
      items: {
        schema: jiraPermissionSchema,
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

const getAllPermissionSchemes = {
  200: {
    description: 'Success',
    schema: {
      type: 'array',
      items: {
        schema: jiraPermissionSchemeSchema,
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

const createPermissionScheme = {
  200: {
    description: 'Success',
    schema: jiracreatePermissionSchemeSchema,
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

const getById = {
  200: {
    description: 'Success',
    schema: jiraPermissionSchemeSchema,
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

const removePermissionScheme = {
  200: {
    description: 'Success',
  },
  400: {
    description: 'Bad Request',
    schema: generalErrorSchema,
  },
  403: {
    description: 'Forbidden',
    schema: generalErrorSchema,
  },
  404: {
    description: 'Permission Scheme not found',
    schema: generalErrorSchema,
  },
  500: {
    description: 'Internal Server Error',
    schema: generalErrorSchema,
  },
};

const getPermissionGrant = {
  200: {
    description: 'Success',
    schema: jiraPermissionGrantSchema,
  },
  400: {
    description: 'Bad Request',
    schema: generalErrorSchema,
  },
  403: {
    description: 'Forbidden',
    schema: generalErrorSchema,
  },
  404: {
    description: 'Permission Scheme not found',
    schema: generalErrorSchema,
  },
  500: {
    description: 'Internal Server Error',
    schema: generalErrorSchema,
  },
};

const getPermissionGrants = {
  200: {
    description: 'Success',
    schema: {
      type: 'array',
      items: {
        schema: jiraPermissionGrantSchema,
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
  404: {
    description: 'Permission Scheme not found',
    schema: generalErrorSchema,
  },
  500: {
    description: 'Internal Server Error',
    schema: generalErrorSchema,
  },
};

module.exports = {
  getAll,
  getAllPermissionSchemes,
  createPermissionScheme,
  getById,
  removePermissionScheme,
  getPermissionGrant,
  getPermissionGrants,
};
