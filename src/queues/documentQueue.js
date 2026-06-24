const Queue = require('bull');
const redisConfig = require('../config/redis');

// Create the document processing queue using the custom Redis connection builder
const documentQueue = new Queue('documentQueue', redisConfig.opts);

module.exports = documentQueue;
