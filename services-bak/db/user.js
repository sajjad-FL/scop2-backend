import { User } from '../../models/user.js';
import { sendEmail } from '../../utils/email.js';
import { logger } from '../../utils/logger.js';

const parseFilters = (opts) => {
  if (!opts) {
    return null;
  }
  const filters = { isEnabled: true };
  if (opts.username) {
    if (opts.username instanceof Array) {
      filters.username = {
        $in: opts.username,
      };
    } else {
      filters.username = opts.username;
    }
  }
  if (opts.email) {
    if (opts.email instanceof Array) {
      filters.email = {
        $in: opts.email,
      };
    } else {
      filters.email = opts.email;
    }
  }
  if (opts.isEnabled) {
    if (opts.isEnabled === 'all') {
      delete filters.isEnabled;
    } else if (opts.isEnabled === 'false') {
      filters.isEnabled = false;
    }
  }
  return filters;
};

const requestAccess = (opts) => {
  return new Promise((resolve, reject) => {
    User.findOne({ username: process.env.JIRA_ADMIN }).lean().then(async (user) => {
      try {
        const emailData = {
          to: user.email,
          subject: 'Access to Scope',
          html: `Hi ${user.name},
                <br><br>
                Access to scope dashboard has been requested by ${opts.name}. Please see below for the details:
                <br><br>
                <table style="margin-left: 40px;">
                  <tbody>
                    <tr>
                      <td>Name: </td>
                      <td>${opts.name || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td>WWID: </td>
                      <td>${opts.wWID || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td>Email: </td>
                      <td>${opts.email || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td>Username: </td>
                      <td>${opts.username || 'N/A'}</td>
                    </tr>
                  <tbody>
                </table><br><br>
                <br>Sincerely,
                <br>Team Scope.<br><br>`,
        };
        await sendEmail(emailData);
        resolve('success');
      } catch (error) {
        logger.error(error, 'ERROR_SEND_ACCESS_EMAIL');
        reject(error);
      }
    }).catch((error) => {
      logger.error(error, 'ERROR_FETCH_ADMIN');
      reject(error);
    });
  });
};

const searchUsers = (opts) => {
  return new Promise(async (resolve, reject) => {
    try {
      const filters = parseFilters(opts);
      console.log(filters, opts);
      const skip = opts?.startAt ? Number(opts?.startAt) : 0;
      const limit = opts?.maxResults ? Number(opts?.maxResults) : 50;

      let projection = '-meta';
      if (opts.includeMeta === 'true') {
        projection = undefined;
      }
      console.log(limit)
      const users = await User.find(filters).select(projection).limit(limit).skip(skip).lean();
      return resolve(users);
    } catch (error) {
      return reject(error);
    }
  });
};

const search = (opts) => {
  const filters = parseFilters(opts);
  let limit;
  let skip;
  if (opts.maxResults && opts.startAt) {
    limit = Number(opts.maxResults);
    skip = Number(opts.startAt);
  } else {
    limit = 50;
    skip = 0;
  }
  let projection = '-meta';
  if (opts.includeMeta === 'true') {
    projection = undefined;
  }
  User
    .find(filters)
    .select(projection)
    .limit(limit)
    .skip(skip)
    .exec((err, users) => {
      if (err) {
        next(err);
      } else {
        next(null, users);
      }
    });
};

export const dbUserServices = {
  parseFilters,
  requestAccess,
  searchUsers,
  search,
}
