const Queue = require('bull');
const redisConfig = require('../config/redis');
const logger = require('../utils/logger');

const videoQueue = new Queue('videoQueue', redisConfig.opts, {
  defaultJobOptions: {
    attempts:  3,                  // retry สูงสุด 3 ครั้ง
    backoff: {
      type:  'exponential',
      delay: 30000                 // 30s, 60s, 120s
    },
    timeout:          3600000,     // 60 นาที / job (วิดีโอยาวสุดที่รองรับ)
    removeOnComplete: true,
    removeOnFail:     false        // เก็บ failed jobs ไว้ debug
  }
});

videoQueue.on('active',    (job)      => logger.info(`[VideoQueue] Job ${job.id} started`));
videoQueue.on('completed', (job, res) => logger.info(`[VideoQueue] Job ${job.id} done — ${res.chunks} chunks`));
videoQueue.on('failed',    (job, err) => logger.error(`[VideoQueue] Job ${job.id} failed: ${err.message}`));

module.exports = videoQueue;
