import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Hapi from '@hapi/hapi';
import config from './config/default.js';
import { startServer } from './utils/serverInit.js';

const server = new Hapi.Server({
  ...config.serverConfig,
  state: {
    strictHeader: false,
  },
});


function connectDB() {
  mongoose.set('strictQuery', false);
  mongoose.connect(config.database.uri);
}

connectDB();


if (!['production', 'staging'].includes(process.env.NODE_ENV)) {
  mongoose.set('debug', true);
}

const db = mongoose.connection;

db.on('error', () => {
  console.error('Connection to db failed!');
  process.exit(0);
});

db.on('connected', () => {
  if (!['production', 'staging'].includes(process.env.NODE_ENV)) {
    console.info(`MongoDB::Connected at ${config.database.uri}`);
  } else {
    console.info('Successfully connected to DB');
  }
  try {
    startServer(server);
  } catch (error) {
    console.log(error)
  }
});

db.on('disconnected', (err) => {
  console.error('Connection terminated to db', err);
  process.exit(0);
});

export default server;
