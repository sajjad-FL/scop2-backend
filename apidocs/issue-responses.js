const {
  generalErrorSchema,
} = require('./schemas');

const jiraCreateIssue = {
  201: {
    description: 'Task Created Successfully',
    schema: {
      type: 'object',
      properties: {
        self: {
          type: 'string',
          description: 'URL of the task',
        },
        id: {
          type: 'string',
          description: 'ID to uniquely identify the task',
        },
        key: {
          type: 'string',
          description: 'Key to uniquely identify the task',
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

module.exports = {
  jira: {
    createIssue: jiraCreateIssue,
  },
};
