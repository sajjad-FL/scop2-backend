import { generalErrorSchema, jiraGroupSchema, jiraUserSchema } from "./schemas.js";

export const createGroup = {
  201: {
    description: 'Success',
    schema: jiraGroupSchema,
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

export const getGroups = {
  200: {
    description: 'Success',
    schema: {
      type: 'object',
      properties: {
        header: { type: 'string' },
        total: { type: 'number' },
        groups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              html: { type: 'string' },
              labels: { type: 'string' },
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
  403: {
    description: 'Forbidden',
    schema: generalErrorSchema,
  },
  500: {
    description: 'Internal Server Error',
    schema: generalErrorSchema,
  },
};

export const removeGroup = {
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

export const getMembers = {
  200: {
    description: 'Success',
    schema: {
      type: 'object',
      properties: {
        self: { type: 'string' },
        expand: { type: 'string' },
        maxResults: { type: 'number' },
        startAt: { type: 'number' },
        total: { type: 'number' },
        isLast: { type: 'boolean' },
        users: {
          type: 'array',
          items: {
            schema: jiraUserSchema,
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

export const addMember = {
  200: {
    description: 'Success',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'group name' },
        self: { type: 'string' },
        expand: { type: 'string' },
        users: {
          type: 'object',
          properties: {
            size: { type: 'number' },
            items: { type: 'array' },
            'max-results': { type: 'number' },
            'start-index': { type: 'number' },
            'end-index': { type: 'number' },
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

export const removeMember = {
  200: {
    description: 'Success',
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
