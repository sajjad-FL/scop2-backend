import hapiAuthJwt2 from "hapi-auth-jwt2";
import config from '../config/default.js';
import { loadScheduledJobs } from "../services/cron/index.js";
import { defaultCounter } from "./defaultCounter.js";
import { defaultGroup } from "./defaultGroup.js";
import { defaultHotsheet } from "./defaultHotsheet.js";
import { defaultUser } from "./defaultUser.js";
import inert from "@hapi/inert";
import vision from "@hapi/vision";
import hapiswagger from "hapi-swagger";
import handlebars from "handlebars";
import good from '@hapi/good';
import goodConsole from '@hapi/good-console';
import Pack from '../package.json' assert { type: 'json' };
import { getHapiHost, handleSmtpException } from "./helper.js";
import { logger } from "./logger.js";
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import { User } from "../models/user.js";
import Joi from "joi";
import { initEventHandlers } from "../services-bak/events/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const startServer = async (server) => {
  try {
    defaultUser();
    defaultHotsheet();
    defaultCounter();
    defaultGroup();
    loadScheduledJobs();
    initEventHandlers(server);

    const requiredHapiPlugins = [
      hapiAuthJwt2,
      inert,
      vision,
      {
        plugin: hapiswagger,
        options: {
          info: {
            title: 'API Documentation',
            contact: {
              name: 'Fission Team',
              email: 'pmdashboard@fissionlabs.com',
            },
            version: Pack.version,
          },
          grouping: 'tags',
          schemes: [getHapiHost.protocol],
          host: getHapiHost.host,
          securityDefinitions: {
            Bearer: {
              type: 'apiKey',
              name: 'Authorization',
              in: 'header',
              description: 'Please provide the Bearer token.',
            },
          },
          security: [
            {
              Bearer: [],
            },
          ],
        },
      },
      {
        plugin: good,
        options: {
          reporters: {
            consoleReporter: [
              {
                module: goodConsole,
                args: [{
                  format: 'MMMM Do YYYY h:mm:ss a',
                  utc: false,
                  color: true
                }]
              },
            ]
          }
        }
      },
    ];
    

    // Global Uncaught Exception Handler
    process.on('SMTP_EXCEPTION', async (err) => {
      try {
        await handleSmtpException(err?.error);
      } catch (emailError) {
        logger.error('Failed to send error email:', emailError);
      }
      process.exit(1);
    });

    try {
      await server.register(requiredHapiPlugins);

      server.auth.strategy('jwt', 'jwt', {
        key: config.JWTConfig.secret,
        validate: jwtValidate,
        verifyOptions: { algorithms: ['HS256'] },
      });

      server.views({
        engines: {
          html: handlebars,
        },
        relativeTo: join(__dirname, '..'),
        path: 'views',
      });

      server.route({
        method: 'GET',
        path: '/hapi-view',
        handler: (request, h) => {
          return h.view('home', { name: 'Hapi User' });
        }
      });
      

      server.route({
        method: 'GET',
        path: '/{filename*}',
        handler: {
          directory: {
            path: join(__dirname, '../static'),
            listing: false,
            index: false,
          },
        },
      });

      const loadFilesRecursively = async (dir) => {
        let routes = [];
      
        const entries = await fs.readdir(dir, { withFileTypes: true });
      
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
      
          if (entry.isDirectory()) {
            const subRoutes = await loadFilesRecursively(fullPath);
            routes = routes.concat(subRoutes);
          } else if (entry.isFile() && entry.name.endsWith('.js')) {
            routes.push(fullPath);
          }
        }
      
        return routes;
      };
      
      const loadRoutes = async () => {
        const dirPath = join(__dirname, '../routes-bak');
        const files = await loadFilesRecursively(dirPath);
      
        for (const file of files) {
          const module = await import(pathToFileURL(file).href);
      
          // Register all named exports
          for (const exportKey of Object.keys(module)) {
            const exported = module[exportKey];
            if (Array.isArray(exported)) {
              exported.forEach((route) => server.route(route));
            } else if (typeof exported === 'object' && exported?.method && exported?.path) {
              server.route(exported);
            }
          }
        }
      };

      await loadRoutes();

      server.route({
        method: 'GET',
        path: '/health',
        handler: (request, h) => {
          return { status: 'ok' };
        },
      });

      server.start((startErr) => {
        if (startErr) {
          console.error(startErr);
        } else {
          console.info(`Server started at: ${server.info.uri}`);
        }
      });
    } catch (error) {
      console.log(error);
      logger.error('Error in registering one or more plugins.', 'FAILED_TO_REGISTER_PLUGINS')
      process.exit(0);
    }
  } catch (error) {
    logger.error('FAILED_TO_START_SERVER', error);
  }
}

const jwtValidate = (decoded, request) => {
  return new Promise(async (resolve, reject) => {
    if (decoded && decoded.permissions && Array.isArray(decoded.permissions) && decoded.permissions.includes('project-request')) {
      request.jiraAuth = {
        _id: null,
        username: decoded.username,
        isAdmin: false,
        isSuperAdmin: false,
        wWID: decoded.wWID,
        isSDSEmployee: false,
        email: decoded.email,
        name: decoded.name,
        emailNotification: false,
      };
      return resolve({ isValid: true });
    }
    try {
      const user = await User.findById(decoded?._id).populate('wWID').lean();
      if (user?.isEnabled) {
        request.jiraAuth = {
          _id: user?._id || null,
          username: user?.username || null,
          isAdmin: !!user?.isAdmin,
          isSuperAdmin: !!user?.isSuperAdmin,
          wWID: user?.wWID || decoded?.wWID || null,
          isSDSEmployee: !!user?.wWID || !!user.isAdmin || !!user?.isSuperAdmin,
          email: user?.email || null,
          name: user?.name || null,
          emailNotification: !!user?.emailNotification,
        };
        request.isSuperAdmin = !!decoded?.isSuperAdmin;
        return resolve({ isValid: true });
      }
      return resolve({ isValid: false });
    } catch (error) {
      return resolve({ isValid: false });
    }
  })
}