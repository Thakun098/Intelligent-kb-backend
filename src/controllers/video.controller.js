const videoQueue = require('../queues/videoQueue');
const { KnowledgeSource } = require('../models');
const logger = require('../utils/logger');

const processVideoCallback = async (req, res, next) => {
  try {
    const { videoUrl, title, required_clearance, content_type, enable_frame_captioning, source_service } = req.body;

    // Create KnowledgeSource record in database
    const source = await KnowledgeSource.create({
      title,
      content_type: content_type || 'VIDEO_TRANSCRIPT',
      file_path: null, // no local file initially
      required_clearance,
      status: 'PENDING_PROCESSING',
      media_type: 'VIDEO'
    });

    // Add job to video queue
    await videoQueue.add({
      sourceId: source.source_id,
      videoUrl,
      enableCaptioning: enable_frame_captioning !== false,
      sourceService: source_service || null
    });

    logger.info(`[VideoController] Queued video from ${source_service || 'unknown'}: "${title}" (sourceId=${source.source_id})`);

    return res.status(202).json({
      message: 'Video processing queued. ETA: 5-15 min per 30 min of video.',
      sourceId: source.source_id,
      status: 'PENDING_PROCESSING'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  processVideoCallback
};
