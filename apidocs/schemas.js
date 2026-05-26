export const generalErrorSchema = {
  type: 'object',
  properties: {
    message: {
      type: 'string',
    },
    error: {
      type: 'string',
      description: 'A keyword stating what may have cause the error',
    },
    code: {
      type: 'number',
      description: 'The status code of the response',
    },
  },
};

export const userSchema = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
    },
    name: {
      type: 'string',
    },
    username: {
      type: 'string',
    },
    isEnabled: {
      type: 'boolean',
    },
    isAdmin: {
      type: 'boolean',
    },
    profilePic: {
      type: 'string',
    },
    meta: {
      type: 'object',
      description: 'Meta data about the user',
    },
  },
};

export const jiraUserSchema = {
  type: 'object',
  properties: {
    self: {
      type: 'string',
      description: 'URL to the user\'s profile',
    },
    key: {
      type: 'string',
      description: 'Key to uniquely identify the user',
    },
    name: {
      type: 'string',
      description: 'username to uniquely identify the user',
    },
    avatarUrls: {
      type: 'object',
      description: 'A set of keys pointing to avatar pics',
    },
    displayName: {
      type: 'string',
      description: 'Display Name of the user',
    },
    active: {
      type: 'boolean',
      description: 'User active status',
    },
  },
};
// ----------------------------------------------------------------------------------- //
export const jiraProjectSchema = {
  type: 'object',
  properties: {
    self: {
      type: 'string',
      description: 'URL to the project\'s profile',
    },
    key: {
      type: 'string',
      description: 'Key to uniquely identify the project',
    },
    id: {
      type: 'string',
      description: 'ID to uniquely identify the project',
    },
    name: {
      type: 'string',
      description: 'Display Name of the project',
    },
    avatarUrls: {
      type: 'object',
      description: 'A set of keys pointing to avatar pics',
    },
    projectCategory: {
      type: 'object',
      description: 'A set of keys pointing to project categories',
    },
    simplified: {
      type: 'string',
      description: 'Boolean value',
    },
  },
};

export const jiraProjectDetailsSchema = {
  type: 'object',
  properties: {
    self: {
      type: 'string',
      description: 'URL to the project\'s profile',
    },
    id: {
      type: 'string',
      description: 'ID to uniquely identify the project',
    },
    key: {
      type: 'string',
      description: 'Key to uniquely identify the project',
    },
    description: {
      type: 'string',
      description: 'Description of the project',
    },
    lead: {
      type: 'object',
      description: 'A set of keys pointing to project lead details',
    },
    components: {
      type: 'array',
      description: 'A set of objects pointing to project components',
    },
    issueTypes: {
      type: 'array',
      description: 'A set of objects pointing to project issues',
    },
    url: {
      type: 'string',
      description: 'URL of the project',
    },
    email: {
      type: 'string',
      description: 'Email of the project',
    },
    assigneeType: {
      type: 'string',
      description: 'Assignee Type of the project',
    },
    versions: {
      type: 'array',
      description: 'A set of objects pointing to project versions',
    },
    name: {
      type: 'string',
      description: 'Display Name of the project',
    },
    roles: {
      type: 'object',
      description: 'A set of keys pointing to project roles',
    },
    avatarUrls: {
      type: 'object',
      description: 'A set of keys pointing to avatar pics',
    },
    projectCategory: {
      type: 'object',
      description: 'A set of keys pointing to project categories',
    },
    simplified: {
      type: 'string',
      description: 'Boolean value',
    },
  },
};

export const jiraProjectStatusesSchema = {
  type: 'object',
  properties: {
    self: {
      type: 'string',
      description: 'URL of the project issue type associated with a specified project',
    },
    id: {
      type: 'string',
      description: 'ID to uniquely identify the project status',
    },
    name: {
      type: 'string',
      description: 'Display Name of the project task',
    },
    subtask: {
      type: 'boolean',
      description: 'Check if it has subtask or not',
    },
    statuses: {
      type: 'array',
      description: 'A set of objects pointing to status of project issues',
    },
  },
};

export const jiraProjectTypesSchema = {
  type: 'object',
  properties: {
    key: {
      type: 'string',
      description: 'Key to uniquely identify the project',
    },
    formattedKey: {
      type: 'string',
      description: 'Display Name of the project key',
    },
    descriptionI18nKey: {
      type: 'string',
      description: 'Description of the project',
    },
    icon: {
      type: 'string',
      description: 'Icon of the project type',
    },
    color: {
      type: 'string',
      description: 'Color of the project type',
    },
  },
};

export const jiraProjectCategorySchema = {
  type: 'object',
  properties: {
    self: {
      type: 'string',
      description: 'URL of the project category',
    },
    id: {
      type: 'string',
      description: 'ID to uniquely identify the project category',
    },
    name: {
      type: 'string',
      description: 'Display Name of the project category',
    },
    description: {
      type: 'string',
      description: 'Description of the project category',
    },
  },
};
// ----------------------------------------------------------------------------------- //
export const jiraUserPermissionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    key: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string' },
    description: { type: 'string' },
    havePermission: { type: 'boolean' },
  },
};

export const jiraPermissionSchema = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string' },
    description: { type: 'string' },
  },
};
// ----------------------------------------------------------------------------------- //
export const jiraPermissionSchemeSchema = {
  type: 'object',
  properties: {
    expand: { type: 'string', description: 'permissions,user,group,projectRole,field,all' },
    id: { type: 'string' },
    self: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
  },
};

export const crPermissionGrantSchema = {
  type: 'object',
  properties: {
    holder: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'group, projectRole, etc' },
        parameter: { type: 'string', description: 'groupName or projectRole id' },
      },
    },
    permission: { type: 'string', description: 'example: ADMINISTER_PROJECTS' },
  },
};

export const jiraPermissionGrantSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    self: { type: 'string' },
    holder: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'group, projectRole, etc' },
        parameter: { type: 'string', description: 'groupName or projectRole id' },
      },
    },
    permission: { type: 'string', description: 'example: ADMINISTER_PROJECTS' },
  },
};

export const jiracreatePermissionSchemeSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    self: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    permissions: {
      type: 'array',
      items: {
        schema: crPermissionGrantSchema,
      },
    },
  },
};
// ----------------------------------------------------------------------------------- //
export const jiraGroupSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    self: { type: 'string' },
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
    expand: { type: 'string' },
  },
};
// ----------------------------------------------------------------------------------- //
export const jiraRoleSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    id: { type: 'string' },
    description: { type: 'string' },
    self: { type: 'string' },
  },
};
