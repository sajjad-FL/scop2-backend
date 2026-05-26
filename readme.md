# Scope 2.0 - API #

API Server for Scope 2.0

### Prerequisites

| Prerequisite                                | Version |
| ------------------------------------------- | ------- |
| [MongoDB Community Server](https://docs.mongodb.com/manual/administration/install-community/) | `~ ^3`  |
| [Node.js](http://nodejs.org)                | `~ ^8.9.3`  |
| npm (comes with Node)                       | `~ ^5`  |

### How do I get set up? ###

* Clone the repo to your local machine.
* Open terminal, run 'npm install'
* Create .env file with the required values. (See Creating .env file)
* TODO How to run tests
* TODO Deployment instructions

### Creating .env file ###

This project uses "dotenv" npm package to store and use enviroment variables.
Create a .env file in the root folder. Inside this file, the following variables must be declared:

* NODE_ENV        : 'production', 'development', 'test' or 'staging'.
* PORT            : port on which to run the API server.
* DB_NAME         : Name of the database you want to connect to.
* DB_USER         : username with which to connect to the DB.
* DB_PASS         : password of the above given user.
* DB_HOST         : hostname of the server where the DB is located.
* DB_PORT         : port of the DB service.
* MONGOCACHE_URL  : URL of the caching mongodb.
* JWT_SECRET      : The secret key with which to sign your JWT Tokens.
* LDAP_SERVER_URL : The url to the ldap server.
* LDAP_ADMIN_USER : Username of the admin.
* LDAP_ADMIN_PASS : Password.
* LDAP_ORG_UNIT   : LDAP org unit.
* LDAP_BASE_DN    : LDAP base domain.
* JIRA_HOST       : The url of the jira server.
* JIRA_PROTOCOL   : http/https
* JIRA_PORT       : port running the jira service.
* JIRA_ADMIN      : username of the JIRA Admin account.
* JIRA_ADMIN_PASS : password of the JIRA Admin account.

** Please ask the development team for the values in case you are not provived with them.

### Linting ###

You should have [ESLint running in your editor](http://eslint.org/docs/user-guide/integrations.html), and it will highlight anything doesn't conform to this project's style guide. This project uses the base Airbnb JS style guide.

> Please do not ignore any linting errors, as they are meant to **help** you and to ensure a clean and simple code base.

To use linting, please ensure that you have all the dev-dependencies installed for this project.
* VS Code - Install the ESLint plugin by Dirk Baeumer.
* Sublime Text 3 - https://github.com/roadhump/SublimeLinter-eslint
* Manually - run the command "node node_modules/eslint/bin/eslint --ext .js server.js config models routes".

### Contribution guidelines ###

* General guidelines
  1. Never push to master branch.
  2. Run tests and ensure your code passes all the tests before pushing.
  3. Please use ESLint to ensure your code conforms to the standards.
  4. Indent code with 2 spaces.

* Code review
* Other guidelines

### Who do I talk to? ###

* pmdashboard@fissionlabs.com
* aniket.gupta@fissionlabs.in
* Other community or team contact