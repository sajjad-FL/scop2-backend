import * as msal from '@azure/msal-node';

const msalConfig = {
  auth: {
    clientId: process.env.ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}`,
    clientSecret: process.env.ENTRA_CLIENT_SECRET,
  },
};

export const cca = new msal.ConfidentialClientApplication(msalConfig);
export const REDIRECT_URI = process.env.ENTRA_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/sso/callback';
export const SCOPES = ['openid', 'profile', 'email', 'User.Read'];
