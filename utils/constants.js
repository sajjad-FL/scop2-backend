export const CONSTANTS = {
  ENVIRONMENT: process.env.NODE_ENV || 'development',
  REQUEST_THROTTLE_LIMIT: 10,
  SCOPE: {
    CATEGORY: {
      TMEDS: 'TMEDS',
      DMSDiscovery: 'DMS-Discovery',
      SMMC: 'SMMC'
    },
  },
  ATTRIBUTE: {
    TYPES: ['INPUT', 'NUMBER', 'TEXTAREA', 'CHECKBOX', 'DROPDOWN', 'DROPDOWNMANY', 'DROPDOWNLISTMANY', 'LIST', 'LISTMANY', 'DATE', 'LDAP', 'LDAPMANY', 'HYPERLINK', 'DELEGATELDAP', 'FILEINPUT'],
  },
  MODELS: {
    USER: 'User',
    TYPE: 'Type',
    PROJECT: 'Project',
    PROJECT_REQUEST: 'ProjectRequest',
    JJED: 'Jjed',
    HOTSHEET: 'Hotsheet',
    GROUP: 'Group',
    FULFILLERS: 'Fulfillers',
    COUNTER: 'Counter',
    CLIENT: 'Client',
    CATEGORY: 'Category',
    ATTRIBUTE: 'Attribute',
  },
  DEFAULT_USERS: {
    SCOPE_USER: {
      NAME: 'Scope User',
      USERNAME: process.env.SCOPE_USER,
    },
    REQUEST_ADMIN: {
      NAME: 'Request Admin',
      USERNAME: process.env.REQUEST_ADMIN,
    },
    DTR_ADMIN: {
      NAME: 'Dtr Admin',
      USERNAME: process.env.DTR_ADMIN,
    },
    REQUESTER: {
      NAME: 'Requester',
      USERNAME: process.env.REQUESTER,
    },
  },
  GROUPS: {
    ROOT: 'SDS-SCOPE',
    ADMIN: 'scope-administrators',
    REQUEST_ADMIN: 'request-administrators',
    GUEST: 'Guest',
    DTR_ADMIN: 'dtr-administrators',
    ALFRESCO: {
      ID: {
        ROOT: 'GROUP_SDS_SCOPE',
        GUEST: 'GROUP_SCOPE_GUEST',
      },
    },
    GITLAB: {
      PATH: {
        ROOT: 'sds-scope',
        GUEST: 'scope-guest',
      },
    },
  },
  LDAP: {
    ORGANIZATIONAL_UNIT: {
      EMPLOYEES: 'Employees',
      PARTNERS: 'Partners',
    },
  },
  GITLAB: {
    ACCESS_LEVEL: {
      // * References: [https://docs.gitlab.com/ee/user/permissions.html, https://docs.gitlab.com/ee/api/access_requests.html]
      GUEST: 10,
      REPORTER: 20,
      DEVELOPER: 30,
      MAINTAINER: 40,
    },
  },
  ALFRESCO: {
    ACCESS_LEVEL: {
      // * Reference: [https://docs.alfresco.com/content-services/latest/using/permissions/]
      CONTRIBUTOR: 'Contributor', // Full rights to the content that they own; they cannot edit or delete content created by others.
      COLLABORATOR: 'Collaborator', // Full rights to the content that they own; they have rights to edit but not delete content created by others.
      COORDINATOR: 'Coordinator', // Full rights to all content - what they have created themselves and what others have created.
      EDITOR: 'Editor', // Rights to edit file properties and check files in and out; they cannot create their own content.
      CONSUMER: 'Consumer', // View-only rights; they cannot create their own content.
    },
    MEMBER_TYPE: {
      PERSON: 'PERSON',
      GROUP: 'GROUP',
    },
    ACCESS_STATUS: {
      ALLOWED: 'ALLOWED',
    },
  },
  PROJECT_REQUEST: {
    STATES: {
      RECEIVED: 'RECEIVED',
      REQUESTED: 'REQUESTED',
      INPROGRESS: 'IN PROGRESS',
      COMPLETED: 'COMPLETED',
      REJECTED: 'REJECTED',
    },
  },
  DATA_TRANSFER_REQUEST: {
    STATES: {
      REQUESTED: 'REQUESTED',
      TO_DO: 'TO DO',
      IN_PROGRESS: 'IN PROGRESS',
      TRANSFER_COMPLETED: 'TRANSFER COMPLETED',
      RESULTS_SHARED: 'RESULTS SHARED',
      REJECTED: 'REJECTED',
    },
  },
  PROJECT: {
    STATUS: {
      TO_DO: 'To Do',
      IN_PROGRESS: 'In Progress',
      COMPLETED: 'Completed',
      ATTENTION: 'Attention',
      ON_HOLD: 'On Hold',
      TRANSFER_COMPLETED: 'Transfer Completed',
      RESULTS_SHARED: 'Results Shared',
      RECEIVED: 'Received'
    },
  },
  SBO_PROJECT: {
    STATUS: {
      COMPLETED: 'Completed',
      STARTED: 'Started',
      TWENTY_FIVE_PERCENT: '25%',
      FIFTY_PERCENT: '50%',
      SEVENTY_FIVE: '75%',
      ON_HOLD: 'On Hold',
      CANCELLED: 'Cancelled',
    },
  },
  SMM_PROJECT: {
    STATUS: {
      PLANNED: 'Initiated',
      INITIATION: 'Initiation',
      DEVELOPMENT: 'Development',
      PRE_PRODUCTION: 'Pre-production',
      PRODUCTION: 'Production',
      IN_PROGRESS: 'In Progress',
      COMPLETED: 'Completed',
      ARCHIVING:'Archiving',
    },
  },
  SMH_CASE_STUDY_STATUS: {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  },
  REPORTS_HEADER: [
    {
      label: 'Project ID',
      field: 'displayId',
      sortable: true,
      thClass: "center-text trunc-desc fixed-column fixed-left-1",
      tdClass: "center-text trunc-desc fixed-column fixed-left-1",
      width: "120px",
      fixed: 'left',
      filterOptions: {
        enabled: true,
        trigger: "enter",
        styleClass: "fixed-column fixed-left-1"
      },
      typeDef: {},
    },
    {
      label: 'Name',
      field: 'displayName',
      sortable: true,
      thClass: "center-text trunc-desc fixed-column fixed-left-2",
      tdClass: "center-text trunc-desc fixed-column fixed-left-2",
      width: "150px",
      filterOptions: {
        enabled: true,
        trigger: "enter",
        styleClass: "fixed-column fixed-left-2"
      },
      typeDef: {},
      type : "INPUT",
    },
    {
      label: 'Description',
      field: 'description',
      sortable: true,
      thClass: "center-text trunc-desc",
      tdClass: "center-text trunc-desc",
      width: "150px",
      filterOptions: {
        enabled: true,
        trigger: "enter",
      },
      typeDef: {},
      type : "TEXTAREA",
    },
    {
      label: 'Status',
      field: 'status',
      sortable: true,
      thClass: "center-text trunc-desc fixed-column fixed-left-3",
      tdClass: "center-text trunc-desc fixed-column fixed-left-3",
      width: "120px",
      filterOptions: {
        enabled: true,
        trigger: "enter",
        styleClass: "fixed-column fixed-left-3"
      },
      typeDef: {},
      isLoading:false,
      isRendered:true,
      type : "DROPDOWN",
    },
    {
      label: 'Lead',
      field: 'lead',
      sortable: true,
      thClass: "center-text trunc-desc fixed-column fixed-left-4",
      tdClass: "center-text trunc-desc fixed-column fixed-left-4",
      width: "120px",
      filterOptions: {
        enabled: true,
        trigger: "enter",
        styleClass: "fixed-column fixed-left-4"
      },
      typeDef: {},
      isLoading:false,
      isRendered:true,
      type : "LDAP",
    },
    // {
    //     label: 'Purpose',
    //     field: 'type',
    //     sortable:true,
    //     thClass: "center-text trunc-desc",
    //     tdClass: "center-text trunc-desc",
    //     width: "120px",
    //     filterOptions: {
    //         enabled: true,
    //         trigger:"enter"
    //     },
    //     typeDef: {}
    // },
    {
      label: 'Priority',
      field: 'priority',
      sortable: true,
      thClass: "center-text trunc-desc",
      tdClass: "center-text trunc-desc",
      width: "120px",
      filterOptions: {
        enabled: true,
        trigger: "enter"
      },
      typeDef: {},
      type : "DROPDOWN",
    },
    {
      label: 'Created By',
      field: 'createdBy',
      sortable: true,
      thClass: "center-text trunc-desc",
      tdClass: "center-text trunc-desc",
      width: "120px",
      filterOptions: {
        enabled: true,
        trigger: "enter"
      },
      typeDef: {},
      isLoading:false,
      isRendered:true,
      type : "LDAP",
    },
    {
      label: 'StartDate',
      field: 'startDate',
      sortable: true,
      thClass: "center-text trunc-desc",
      tdClass: "center-text trunc-desc",
      width: "120px",
      filterOptions: {
        enabled: true,
        trigger: "enter"
      },
      typeDef: {},
      type : "DATE",
    },
    {
      label: 'Estimated End Date',
      field: 'endDate',
      sortable: true,
      thClass: "center-text trunc-desc",
      tdClass: "center-text trunc-desc",
      width: "120px",
      filterOptions: {
        enabled: true,
        trigger: "enter"
      },
      typeDef: {},
      type : "DATE",
    },
    {
      label: 'Duration',
      field: 'duration',
      sortable: true,
      thClass: "center-text trunc-desc",
      tdClass: "center-text trunc-desc",
      width: "120px",
      filterOptions: {
        enabled: true,
        trigger: "enter"
      },
      typeDef: {},
      isLoading:false,
      isRendered:true,
      type : "INPUT",
    },
    {
      label: 'Completed At',
      field: 'completedAt',
      sortable: true,
      thClass: "center-text trunc-desc",
      tdClass: "center-text trunc-desc",
      width: "120px",
      filterOptions: {
        enabled: true,
        trigger: "enter"
      },
      typeDef: {},
      type : "DATE",
    },
    {
      label: 'Collaborators',
      field: 'collaborators',
      sortable: true,
      thClass: "center-text trunc-desc",
      tdClass: "center-text trunc-desc",
      width: "120px",
      filterOptions: {
        enabled: true,
        trigger: "enter"
      },
      typeDef: {},
      isLoading:false,
      isRendered:true,
      type : "LDAPMANY",
    },
    {
      label: 'Scope Version Control Import Link',
      field: 'gitlab',
      sortable: false,
      thClass: "center-text trunc-desc",
      tdClass: "center-text trunc-desc",
      width: "120px",
      filterOptions: {
        enabled: true,
        trigger: "enter"
      },
      typeDef: {},
      type : "HYPERLINK",
    },
  ],
  SBO_ACTION_HOURS: [
    {
      key: 'name',
      label: 'Name'
    },
    {
      key: 'allocatedFTE',
      label: 'Allocated FTE'
    },
    {
      key: 'role',
      label: 'Role'
    }
  ]
};
