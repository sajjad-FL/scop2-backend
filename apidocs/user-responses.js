import {
  generalErrorSchema,
  userSchema,
  jiraUserSchema,
  jiraUserPermissionSchema,
} from './schemas.js';

export const loginResponses = {
  200: {
    description: 'Success',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the login was successful or not',
        },
        token: {
          type: 'string',
          description: 'Authentication token assigned to the user',
        },
        user: userSchema,
      },
    },
  },
  400: {
    description: 'Bad Request',
    schema: generalErrorSchema,
  },
  404: {
    description: 'User not found',
    schema: generalErrorSchema,
  },
  500: {
    description: 'Internal Server Error',
    schema: generalErrorSchema,
  },
};

export const dbGetUsers = {
  200: {
    description: 'Success',
    schema: {
      type: 'array',
      items: {
        schema: userSchema,
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

export const jiraGetUsers = {
  200: {
    description: 'Success',
    schema: {
      type: 'array',
      items: {
        schema: jiraUserSchema,
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

export const jiraCreateUser = {
  200: {
    description: 'User already exists in system',
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Authentication token assigned to the user',
        },
        user: userSchema,
        code: {
          type: 'number',
          description: 'Status code of the response',
        },
      },
    },
  },
  201: {
    description: 'User created successfully',
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Authentication token assigned to the user',
        },
        user: userSchema,
        code: {
          type: 'number',
          description: 'Status code of the response',
        },
      },
    },
  },
  400: {
    description: 'Bad Request / User account is disabled',
    schema: generalErrorSchema,
  },
  403: {
    description: 'Forbidden',
    schema: generalErrorSchema,
  },
  404: {
    description: 'User not found in LDAP',
    schema: generalErrorSchema,
  },
  500: {
    description: 'Internal Server Error',
    schema: generalErrorSchema,
  },
};

export const jiraGetUserById = {
  200: {
    description: 'Success',
    schema: {
      type: 'object',
      schema: jiraUserSchema,
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

export const jiraUDRUserById = {
  200: {
    description: 'Success',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
        },
        code: {
          type: 'number',
        },
        user: {
          type: 'object',
          schema: userSchema,
        },
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

export const jiraUserMyPermissions = {
  200: {
    description: 'Success',
    schema: {
      type: 'array',
      items: {
        schema: jiraUserPermissionSchema,
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

export const jiraSearchUsersWithPermissions = {
  200: {
    description: 'Success',
    schema: {
      type: 'array',
      items: {
        schema: jiraUserSchema,
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
