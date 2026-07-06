const Queue = require('bull');
const redisConfig = require('../config/redis');
const logger = require('../utils/logger');

const videoQueue = new Queue('videoQueue', {
  ...redisConfig.opts, // ดึงค่า createClient มาใส่ในนี้
  defaultJobOptions: {
    attempts:  3,
    backoff: {
      type:  'exponential',
      delay: 30000
    },
    timeout:          3600000, // 60 นาทีทำงานได้จริงแล้ว
    removeOnComplete: true,
    removeOnFail:     false
  }
});

videoQueue.on('active',    (job)      => logger.info(`[VideoQueue] Job ${job.id} started`));
videoQueue.on('completed', (job, res) => logger.info(`[VideoQueue] Job ${job.id} done — ${res.chunks} chunks`));
videoQueue.on('failed',    (job, err) => logger.error(`[VideoQueue] Job ${job.id} failed: ${err.message}`));

module.exports = videoQueue;
