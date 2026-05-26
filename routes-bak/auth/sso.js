import { cca, REDIRECT_URI, SCOPES } from '../../connectors/msal.js';
import Auth from '../../connectors/auth.js';
import { logger } from '../../utils/logger.js';
import jwt from 'jsonwebtoken';
import config from '../../config/default.js';
import _ from 'lodash';
import { jiraGroupServices } from '../../services-bak/jira/group.js';
import { sendEmail } from '../../utils/email.js';
import { User } from '../../models/user.js';
import { gitlabUserServices } from '../../services-bak/gitlab/users.js';
import { gitlabGroupServices } from '../../services-bak/gitlab/group.js';

const COOKIE_OPTIONS = {
  isHttpOnly: true,
  isSecure: ['production', 'staging'].includes(process.env.NODE_ENV),
  isSameSite: 'Lax',
  path: '/',
};

function createTokens(user) {
  // Keep JWT payload minimal - just core identification fields
  const payload = _.pick(user, ['_id', 'email', 'username', 'name', 'isEnabled', 'isAdmin', 'isSuperAdmin', 'wWID']);
  const token = jwt.sign(payload, config.JWTConfig.secret, { expiresIn: '1h' });
  const refreshToken = jwt.sign(payload, config.JWTConfig.secret, { expiresIn: '1d' });
  return { token, refreshToken };
}

function setCookies(h, token, refreshToken) {
  return h
    .state('token', token, { ...COOKIE_OPTIONS, ttl: 60 * 60 * 1000 })
    .state('refreshtoken', refreshToken, { ...COOKIE_OPTIONS, ttl: 24 * 60 * 60 * 1000 });
}

// GET /api/v1/auth/sso/login — redirect to Microsoft login
export const ssoLogin = {
  path: '/api/v1/auth/sso/login',
  method: 'GET',
  options: {
    auth: false,
    description: 'Redirect to Microsoft Entra ID login',
    tags: ['api', 'SSO'],
    cors: true,
  },
  handler: async (request, h) => {
    try {
      logger.info('SSO_LOGIN_INITIATED');
      logger.info({ scopes: SCOPES, redirectUri: REDIRECT_URI }, 'SSO_CONFIG');
      const authUrl = await cca.getAuthCodeUrl({
        scopes: SCOPES,
        redirectUri: REDIRECT_URI,
        state: request.query.relay || '',
      });
      logger.info({ authUrl }, 'SSO_REDIRECT_URL_GENERATED');
      return h.redirect(authUrl);
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'ERROR_SSO_LOGIN_REDIRECT');
      return h.response({ message: 'Failed to initiate SSO login', code: 500 }).code(500);
    }
  },
};

// GET /api/v1/auth/sso/callback — Microsoft redirects here with auth code
export const ssoCallback = {
  path: '/api/v1/auth/sso/callback',
  method: 'GET',
  options: {
    auth: false,
    description: 'SSO callback — exchanges auth code for tokens',
    tags: ['api', 'SSO'],
    cors: true,
  },
  handler: async (request, h) => {
    try {
      logger.info({ query: request.query }, 'SSO_CALLBACK_RECEIVED');
      const { code, state } = request.query;
      if (!code) {
        logger.warn('SSO_CALLBACK_NO_CODE');
        return h.redirect(`${config.clientHost || '/'}`);
      }

      logger.info({ code: code.substring(0, 10) + '...', scopes: SCOPES }, 'SSO_EXCHANGING_CODE_FOR_TOKEN');
      // Exchange auth code for access token
      const tokenResponse = await cca.acquireTokenByCode({
        code,
        scopes: SCOPES,
        redirectUri: REDIRECT_URI,
      });
      logger.info({ hasAccessToken: !!tokenResponse.accessToken, tokenType: tokenResponse.tokenType }, 'SSO_TOKEN_ACQUIRED');

      // Fetch user profile from Microsoft Graph with all needed fields
      const graphUrl = process.env.ENTRA_USER_INFO_URL || 'https://graph.microsoft.com/v1.0/me?$select=displayName,givenName,surname,mail,userPrincipalName,employeeId,onPremisesImmutableId';
      logger.info({ graphUrl }, 'SSO_CALLING_GRAPH_API');
      const graphResponse = await fetch(
        graphUrl,
        { headers: { Authorization: `Bearer ${tokenResponse.accessToken}` } },
      );

      logger.info({ status: graphResponse.status, statusText: graphResponse.statusText }, 'SSO_GRAPH_API_RESPONSE');
      if (!graphResponse.ok) {
        const errorText = await graphResponse.text();
        logger.error({ status: graphResponse.status, error: errorText }, 'ERROR_SSO_GRAPH_API_FAILED');
        return h.redirect(`${config.clientHost || '/'}`);
      }

      const profile = await graphResponse.json();
      logger.info({ 
        profile,
        hasMail: !!profile.mail,
        hasUserPrincipalName: !!profile.userPrincipalName,
        hasEmployeeId: !!profile.employeeId,
        hasOnPremisesImmutableId: !!profile.onPremisesImmutableId
      }, 'SSO_GRAPH_PROFILE_RECEIVED');
      const email = (profile.mail || profile.userPrincipalName || '').toLowerCase();
      const username = email.split('@')[0];
      const wWID = profile.employeeId || profile.onPremisesImmutableId || username;
      
      logger.info({ email, username, wWID, emailSource: profile.mail ? 'mail' : 'userPrincipalName' }, 'SSO_USER_INFO_EXTRACTED');
      
      if (!email) {
        logger.error({ profile }, 'ERROR_MISSING_EMAIL_FROM_GRAPH');
        return h.redirect(`${config.clientHost || '/'}`);
      }

      // Create user object from Graph API data (no LDAP needed)
      const graphUser = {
        jnjMSUserName: username,
        fullName: profile.displayName,
        givenName: profile.givenName,
        mail: email,
        cn: wWID,
      };

      logger.info({ graphUser }, 'SSO_GRAPH_USER_DATA');

      // Save/update user in MongoDB
      let response;
      try {
        logger.info({ username: graphUser.jnjMSUserName, email: graphUser.mail }, 'SSO_CHECKING_USER_IN_DB');
        response = await Auth.checkUserAndSave(graphUser, true);
        logger.info({ isNew: response.isNew, userId: response.user._id, username: response.user.username }, 'SSO_USER_CHECK_COMPLETE');

        // Provision GitLab user and add to Guest group for new users
        if (response.isNew) {
          const gitlabPayload = {
            "email": response.user.email,
            "name": response.user.name,
            "username": response.user.username,
            "reset_password": true,
            "skip_confirmation": true
          };
          gitlabUserServices.createUser(gitlabPayload).then(() => {
            //Adding scope code user to GUEST Group for read acess to all repositories 
            // GUEST GROUP ID: 96, access_level: 20
            gitlabGroupServices.addGroupMember('96', response.user.username, '20').then(() => {
              logger.info({ username: response.user.username }, 'SSO_GITLAB_USER_CREATED_AND_ADDED_TO_GUEST_GROUP');
            }).catch((err) => {
              logger.error(err, 'ERROR_GITLAB_ADDING_USER_TO_GROUP');
            });
          }).catch((err) => {
            logger.error(err, 'ERROR_GITLAB_CREATE_USER');
          });
        }
      } catch (error) {
        logger.error({ error: error.message, stack: error.stack, graphUser }, 'ERROR_CHECK_USER_AND_SAVE');
        // If JJEDS or group check fails, still allow login with basic user data
        // Try to at least save the user to DB
        let user = await User.findOne({ username: graphUser.jnjMSUserName.toLowerCase() }).lean();
        
        if (!user) {
          // Create new user with basic info
          const doc = {
            email: graphUser.mail.toLowerCase(),
            name: graphUser.fullName || graphUser.givenName,
            username: graphUser.jnjMSUserName.toLowerCase(),
            meta: { graph: graphUser },
            wWID: graphUser.cn,
          };
          const instance = new User(doc);
          user = await instance.save();
        }
        
        response = {
          isNew: false,
          user,
          isSDSEmployee: false,
          isRequestAdmin: false,
          isDTRAdmin: false,
          directReports: [],
        };
      }

      if (!response.user.isEnabled) {
        logger.warn({ username: response.user.username, email: response.user.email, isNew: response.isNew }, 'SSO_USER_NOT_ENABLED_REDIRECT_TO_REQUESTS');
        
        // Send email notification to admin for new users
        if (response.isNew) {
          try {
            const adminUser = await User.findOne({ username: process.env.JIRA_ADMIN }).lean();
            if (adminUser) {
              const emailData = {
                to: adminUser.email,
                subject: 'Access to Scope',
                html: `Hi ${adminUser.name},
                <br><br>
                Access to scope dashboard has been requested by ${response.user.name || 'N/A'}. Please see below for the details:
                <br><br>
                <table style="margin-left: 40px;">
                  <tbody>
                    <tr>
                      <td>Name: </td>
                      <td>${response.user.name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td>WWID: </td>
                      <td>${response.user.wWID || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td>Email: </td>
                      <td>${response.user.email || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td>Username: </td>
                      <td>${response.user.username || 'N/A'}</td>
                    </tr>
                  <tbody>
                </table><br><br>
                <br>Sincerely,
                <br>Team Scope.<br><br>`,
              };
              await sendEmail(emailData);
            }
          } catch (emailError) {
            logger.error(emailError, 'ERROR_SEND_NEW_USER_EMAIL');
          }
        }
        
        // User is disabled - create request-only token and redirect directly to project requests page
        const requestPayload = {
          username: response.user.username,
          name: response.user.name,
          email: response.user.email,
          wWID: response.user.wWID,
          permissions: ['project-request'],
        };
        const requestToken = jwt.sign(requestPayload, config.JWTConfig.secret, { expiresIn: '8h' });
        
        const uiHost = config.clientHost || '';
        const res = h.redirect(`${uiHost}/dashboard/requests/`);
        res.state('requesttoken', requestToken, { ...COOKIE_OPTIONS, ttl: 8 * 60 * 60 * 1000 });
        return res;
      }

      const user = response.user;
      
      // Enrich user with all computed fields (same as original SSO flow)
      const groupDepartmentLeads = await jiraGroupServices.groupsByUserID(user._id);
      user.groupDepartmentLeads = groupDepartmentLeads || [];
      user.isSDSEmployee = response.isSDSEmployee || user.isAdmin || user.isSuperAdmin;
      user.isRequestAdmin = response.isRequestAdmin;
      user.isDTRAdmin = response.isDTRAdmin;
      user.isScopeUser = true;
      user.isSBOLead = (groupDepartmentLeads || []).includes('SBO');
      if (response.directReports && response.directReports.length) {
        const [{ _doc: jJEDData }] = response.directReports;
        user.organizationalUnit = jJEDData && jJEDData.organizationalUnit;
      }

      const { token, refreshToken } = createTokens(user);

      // Set httpOnly cookies and redirect to UI's SSO callback page
      const uiHost = config.clientHost || '';
      const redirectTo = state || `${uiHost}/sso/callback`;
      logger.info({ 
        redirectTo, 
        userId: user._id, 
        username: user.username,
        email: user.email,
        isEnabled: user.isEnabled,
        isAdmin: user.isAdmin
      }, 'SSO_CALLBACK_SUCCESS_REDIRECTING');
      const res = h.redirect(redirectTo);
      setCookies(res, token, refreshToken);
      return res;
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack, query: request.query }, 'ERROR_SSO_CALLBACK');
      return h.redirect(`${config.clientHost || '/'}`);
    }
  },
};

// GET /api/v1/auth/sso/me — returns user details from cookie JWT
export const ssoMe = {
  path: '/api/v1/auth/sso/me',
  method: 'GET',
  options: {
    auth: false,
    description: 'Get current SSO user details from cookie',
    tags: ['api', 'SSO'],
    cors: {
      origin: [config.clientHost || '*'],
      credentials: true,
    },
  },
  handler: async (request, h) => {
    try {
      const token = request.state?.token;
      if (!token) {
        return h.response({ message: 'Not authenticated', code: 401 }).code(401);
      }

      let decoded;
      try {
        decoded = jwt.verify(token, config.JWTConfig.secret);
      } catch (err) {
        // Try refresh token
        const refreshToken = request.state?.refreshtoken;
        if (!refreshToken) {
          return h.response({ message: 'Session expired', code: 401 }).code(401);
        }
        try {
          decoded = jwt.verify(refreshToken, config.JWTConfig.secret);
        } catch {
          return h.response({ message: 'Session expired', code: 401 }).code(401);
        }
      }

      const user = await User.findById(decoded._id).lean();
      if (!user || !user.isEnabled) {
        return h.response({ message: 'User not found or disabled', code: 401 }).code(401);
      }

      // Enrich user with all the same fields as the original SSO flow
      const { jiraUserServices } = await import('../../services-bak/jira/users.js');
      const { CONSTANTS } = await import('../../utils/constants.js');
      const { GROUPS } = CONSTANTS;

      // Get JJEDS data for direct reports and SDS employee status
      let directReports = [];
      let isSDSEmployee = false;
      let organizationalUnit = null;
      try {
        const jjedsData = await jiraUserServices.getJjedsData(user.wWID);
        if (jjedsData && Array.isArray(jjedsData) && jjedsData.length) {
          isSDSEmployee = true;
          directReports = jjedsData[0]?.directReports || [];
          organizationalUnit = jjedsData[0]?.organizationalUnit;
        }
      } catch (err) {
        logger.error(err, 'ERROR_FETCH_JJEDS_DATA');
      }

      // Check if user is in special groups
      let isRequestAdmin = false;
      let isDTRAdmin = false;
      try {
        const requestAdminCheck = await jiraUserServices.findMemberInGroupByGroupName(GROUPS.REQUEST_ADMIN, user._id);
        isRequestAdmin = !!requestAdminCheck;
        const dtrAdminCheck = await jiraUserServices.findMemberInGroupByGroupName(GROUPS.DTR_ADMIN, user._id);
        isDTRAdmin = !!dtrAdminCheck;
      } catch (err) {
        logger.error(err, 'ERROR_CHECK_GROUP_MEMBERSHIP');
      }

      // Get group department leads
      const groupDepartmentLeads = await jiraGroupServices.groupsByUserID(user._id);
      
      // Enrich user object with all computed fields
      user.groupDepartmentLeads = groupDepartmentLeads || [];
      user.isSDSEmployee = isSDSEmployee || user.isAdmin || user.isSuperAdmin;
      user.isRequestAdmin = isRequestAdmin;
      user.isDTRAdmin = isDTRAdmin;
      user.isScopeUser = true;
      user.isSBOLead = (groupDepartmentLeads || []).includes('SBO');
      if (organizationalUnit) {
        user.organizationalUnit = organizationalUnit;
      }

      // Refresh tokens
      const newTokens = createTokens(user);
      const res = h.response({ 
        user, 
        token: newTokens.token, 
        directReports,
        permissions: [],
        code: 200 
      }).code(200);
      setCookies(res, newTokens.token, newTokens.refreshToken);
      return res;
    } catch (error) {
      logger.error(error, 'ERROR_SSO_ME');
      return h.response({ message: 'Internal server error', code: 500 }).code(500);
    }
  },
};

// POST /api/v1/auth/sso/logout
export const ssoLogout = {
  path: '/api/v1/auth/sso/logout',
  method: 'POST',
  options: {
    auth: false,
    description: 'Clear SSO session cookies',
    tags: ['api', 'SSO'],
    cors: {
      origin: [config.clientHost || '*'],
      credentials: true,
    },
  },
  handler: (request, h) => {
    return h.response({ message: 'Logged out', code: 200 })
      .unstate('token')
      .unstate('refreshtoken')
      .code(200);
  },
};

// GET /api/v1/auth/request/me — returns request user details from requesttoken cookie
export const requestMe = {
  path: '/api/v1/auth/request/me',
  method: 'GET',
  options: {
    auth: false,
    description: 'Get request-only user details from cookie',
    tags: ['api', 'SSO'],
    cors: {
      origin: [config.clientHost || '*'],
      credentials: true,
    },
  },
  handler: async (request, h) => {
    try {
      const requestToken = request.state?.requesttoken;
      if (!requestToken) {
        return h.response({ message: 'Not authenticated', code: 401 }).code(401);
      }

      let decoded;
      try {
        decoded = jwt.verify(requestToken, config.JWTConfig.secret);
      } catch (err) {
        return h.response({ message: 'Invalid token', code: 401 }).code(401);
      }

      return h.response({ 
        requestToken,
        user: {
          username: decoded.username,
          name: decoded.name,
          email: decoded.email,
          wWID: decoded.wWID,
        },
        permissions: decoded.permissions || [],
        code: 200 
      }).code(200);
    } catch (error) {
      logger.error(error, 'ERROR_REQUEST_ME');
      return h.response({ message: 'Internal server error', code: 500 }).code(500);
    }
  },
};
