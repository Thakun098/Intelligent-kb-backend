const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

// Create reusable redis connections for Bull client / subscriber
const client = new Redis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

const subscriber = new Redis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

client.on('connect', () => {
  logger.info(`Redis client connected to redis://${redisHost}:${redisPort}`);
});

client.on('error', (err) => {
  logger.error(`Redis client connection error: ${err.message}`);
});

subscriber.on('connect', () => {
  logger.info(`Redis subscriber connected to redis://${redisHost}:${redisPort}`);
});

subscriber.on('error', (err) => {
  logger.error(`Redis subscriber connection error: ${err.message}`);
});

module.exports = {
  client,
  subscriber,
  opts: {
    createClient: (type) => {
      switch (type) {
        case 'client':
          return client;
        case 'subscriber':
          return subscriber;
        default:
          return new Redis({
            host: redisHost,
            port: redisPort,
            maxRetriesPerRequest: null,
            enableReadyCheck: false
          });
      }
    }
  }
};
