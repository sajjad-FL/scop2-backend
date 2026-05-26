import server from "../../server.js";

export const initEventHandlers = () => {
  server.event('clear-cache');
  server.events.on('clear-cache', (data) => {
    switch (data) {
      case 'jira-users':
        console.log('User deleted event', data); // eslint-disable-line
        // server.methods.jira.users.search.cache.drop()
        break;
      default:
        console.log(`Unhandled clear-cache for data ${data}`); // eslint-disable-line
    }
  });
};
