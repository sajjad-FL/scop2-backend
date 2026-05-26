import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename); // Fixed: removed extra asterisks

function getDBUri() {
  const dbName = process.env.DB_NAME;
  let userPass = '';
  if (process.env.DB_USER) {
    userPass = process.env.DB_USER;
    if (process.env.DB_PASS) {
      userPass = `${process.env.DB_USER}:${process.env.DB_PASS}@`;
    }
  }

  let uri = `mongodb://${userPass}${process.env.DB_HOST}:${process.env.DB_PORT}/${dbName}`;
  if (process.env.NODE_ENV === 'production') {
    uri += '?authSource=admin';
  }
  return uri;
}

const hapiServerSettings = () => {
  const connectionSettings = {
    host: '0.0.0.0',
    port: process.env.PORT,
    routes: {
      cors: {
        origin: ['*'],
        credentials: true,
        additionalHeaders: ['Permissions'],
      },
      log: {
        collect: true,
      },
    },
    state: {
      strictHeader: false,
    },
  };

  if (['production', 'staging'].includes(process.env.NODE_ENV)) {
    const tls = {
      key: fs.readFileSync(join(__dirname, '../scope_jnj_com.key')),
      cert: fs.readFileSync(join(__dirname, '../scope_jnj_com.crt')),
    }; // Fixed: added missing semicolon and closing brace
    connectionSettings.tls = tls;
  }

  return connectionSettings;
};

export default {
  server: {
    host: '0.0.0.0',
    port: process.env.PORT,
    maxBytes: 104857600,
  },
  httpsServer: {
    host: '0.0.0.0',
    port: process.env.HTTPS_PORT,
    maxBytes: 104857600,
  },
  JWTConfig: {
    secret: process.env.JWT_SECRET,
  },
  database: {
    uri: getDBUri(),
  },
  ldap: {
    url: process.env.LDAP_SERVER_URL,
    ou: process.env.LDAP_ORG_UNIT,
    service_ou: process.env.LDAP_ORG_SERVICE_UNIT,
    bd: process.env.LDAP_BASE_DN,
  },
  jira: {
    host: process.env.JIRA_HOST,
    protocol: process.env.JIRA_PROTOCOL,
    port: process.env.JIRA_PORT,
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    user: process.env.AWS_USER,
    bucketName: process.env.AWS_BUCKET,
  },
  entra: {
    clientId: process.env.ENTRA_CLIENT_ID,
    clientSecret: process.env.ENTRA_CLIENT_SECRET,
    tenantId: process.env.ENTRA_TENANT_ID,
    redirectUri: process.env.ENTRA_REDIRECT_URI,
  },
  serverConfig: hapiServerSettings(),
  clientHost: process.env.UI_HOST,
  backendPort: process.env.PORT,
};