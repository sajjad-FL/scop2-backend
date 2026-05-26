import config from '../../config/default.js';
import ldap from 'ldapjs';

const ldapConfig = config.ldap;

/**
 * Perform a generic search for users that match the specified filter.
 * @param {Object} opts The request options sent to the Jira API.
 * @param {String} opts.filters The filters for the search criteria.
 */

export async function findUsers(opts) {
  const LDAPClient = ldap.createClient(ldapConfig);

  const ldapOpts = {
    filter: `(&(objectClass=person)(|(cn=${opts.filters.username}*)(mail=${opts.filters.username}*)(fullName=${opts.filters.username}*)(givenName=${opts.filters.username}*)(sn=${opts.filters.username}*)(preferredName=${opts.filters.username}*)))`,
    scope: 'sub',
    attributes: [
      'cn',
      'mail',
      'sn',
      'givenName',
      'fullName',
      'jnjMSUserName',
      'preferredName',
    ],
    timeLimit: 10,
    attrsOnly: true,
  };

  // Helper to perform search
  const searchLDAP = (base) =>
    new Promise((resolve, reject) => {
      const users = [];

      LDAPClient.search(base, ldapOpts, (err, resp) => {
        if (err) return reject(err);

        resp.on('searchEntry', (entry) => users.push(entry.object));
        resp.on('error', reject);
        resp.on('end', () => resolve(users));
      });
    });

  try {
    const users = await searchLDAP(ldapConfig.ou);
    LDAPClient.destroy();
    if (users.length > 0) {
      return users;
    }
    console.log('No users found in ou, searching in service_ou...');
    return await searchInServiceOU(opts);
  } catch (error) {
    console.error('LDAP search failed:', error);

    try {
      console.log('Falling back to service_ou due to error...');
      return await searchInServiceOU(opts);
    } catch (serviceErr) {
      throw serviceErr;
    }
  } finally {
    LDAPClient.destroy();
  }
}


export async function searchInServiceOU(opts) {
  const LDAPClient = ldap.createClient(ldapConfig);

  const ldapOpts = {
    filter: `(&(objectClass=person)(|(cn=${opts.filters.username}*)(mail=${opts.filters.username}*)(fullName=${opts.filters.username}*)(givenName=${opts.filters.username}*)(sn=${opts.filters.username}*)(preferredName=${opts.filters.username}*)))`,
    scope: 'sub',
    attributes: [
      'cn',
      'mail',
      'sn',
      'givenName',
      'fullName',
      'jnjMSUserName',
      'preferredName',
    ],
    timeLimit: 10,
    attrsOnly: true,
  };

  console.log('Searching in service_ou...', { ldapOpts });

  const searchLDAP = (base) =>
    new Promise((resolve, reject) => {
      const users = [];

      LDAPClient.search(base, ldapOpts, (err, resp) => {
        if (err) return reject(err);

        resp.on('searchEntry', (entry) => users.push(entry.object));
        resp.on('error', reject);
        resp.on('end', () => resolve(users));
      });
    });

  try {
    const users = await searchLDAP(ldapConfig.service_ou);
    console.log(`Found ${users.length} users in service_ou`);
    return users;
  } catch (error) {
    console.error('LDAP search error in service_ou:', error);
    throw error;
  } finally {
    LDAPClient.destroy();
  }
}

export const ldapUserServices = {
  findUsers,
};
