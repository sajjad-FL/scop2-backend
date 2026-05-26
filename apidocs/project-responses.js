import {
  generalErrorSchema, jiraProjectSchema, jiraProjectDetailsSchema, jiraProjectTypesSchema,
  jiraProjectCategorySchema, jiraProjectStatusesSchema, jiraPermissionSchemeSchema,
} from './schemas.js';

export const jiraCreateProject = {
  201: {
    description: 'Project Created Successfully',
    schema: {
      type: 'object',
      properties: {
        self: {
          type: 'string',
          description: 'URL of the project',
        },
        id: {
          type: 'string',
          description: 'ID to uniquely identify the project',
        },
        key: {
          type: 'string',
          description: 'Key to uniquely identify the project',
        },
        code: {
          type: 'number',
          description: 'Status code of the response',
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

export const jiraGetAllProjects = {
  200: {
    description: 'Success',
    schema: {
      type: 'array',
      items: {
        schema: jiraProjectSchema,
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

export const jiraGetProjectById = {
  200: {
    description: 'Success',
    schema: {
      type: 'object',
      schema: jiraProjectDetailsSchema,
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

export const jiraGetProjectStatuses = {
  200: {
    description: 'Success',
    schema: {
      type: 'array',
      items: {
        schema: jiraProjectStatusesSchema,
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

export const jiraGetProjectTypes = {
  200: {
    description: 'Success',
    schema: {
      type: 'array',
      items: {
        schema: jiraProjectTypesSchema,
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

export const jiraCreateProjectCategory = {
  201: {
    description: 'Project Department Created Successfully',
    schema: {
      type: 'object',
      properties: {
        self: {
          type: 'string',
          description: 'URL of the project department',
        },
        id: {
          type: 'string',
          description: 'ID to uniquely identify the project department',
        },
        name: {
          type: 'string',
          description: 'Display Name of the project department',
        },
        description: {
          type: 'string',
          description: 'Description of the project department',
        },
        code: {
          type: 'number',
          description: 'Status code of the response',
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

export const jiraGetAllProjectCategories = {
  200: {
    description: 'Success',
    schema: {
      type: 'array',
      items: {
        schema: jiraProjectCategorySchema,
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

export const jiraGetProjectCategoryById = {
  200: {
    description: 'Success',
    schema: {
      type: 'object',
      schema: jiraProjectCategorySchema,
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

export const jiraCommonResponse = {
  201: {
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

export const jiraProjectPermissionSchemes = {
  200: {
    description: 'Success',
    schema: {
      type: 'object',
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


