require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'kb_user',
    password: process.env.DB_PASSWORD || 'supersecretpassword',
    database: process.env.DB_NAME || 'kb_system',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log
  },
  test: {
    username: process.env.DB_USER || 'kb_user',
    password: process.env.DB_PASSWORD || 'supersecretpassword',
    database: process.env.DB_NAME_TEST || 'kb_system_test',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
};
