const documentQueue = require('../queues/documentQueue');
const videoQueue = require('../queues/videoQueue');
const { KnowledgeSource } = require('../models');
const logger = require('../utils/logger');
const fs = require('fs');

const VIDEO_MIME_TYPES = [
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/x-m4a', 'audio/m4a', 'audio/x-aac', 'audio/aac'
];

const uploadDocument = async (req, res, next) => {
  try {
    const file = req.file;
    const { title, content_type, required_clearance } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'Please upload a file' });
    }
    if (!title || !required_clearance) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'title and required_clearance are required' });
    }

    const isVideo = VIDEO_MIME_TYPES.includes(file.mimetype);
    const finalType = isVideo ? 'VIDEO_TRANSCRIPT' : content_type;
    const mediaType = isVideo ? 'VIDEO' : 'DOCUMENT';

    if (!isVideo && !content_type) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'content_type is required for documents' });
    }

    // Register metadata record in database
    const source = await KnowledgeSource.create({
      title,
      content_type: finalType,
      file_path: file.path,
      required_clearance,
      status: 'PENDING_PROCESSING',
      media_type: mediaType
    });

    if (isVideo) {
      await videoQueue.add({ sourceId: source.source_id, filePath: file.path });
      logger.info(`[Upload] Video queued: "${title}" (sourceId=${source.source_id})`);
    } else {
      await documentQueue.add({
        sourceId: source.source_id,
        filePath: file.path,
        mimeType: file.mimetype,
        contentType: content_type
      });
      logger.info(`[Upload] Document queued: "${title}" (sourceId=${source.source_id})`);
    }

    return res.status(202).json({
      message: isVideo
        ? 'Video uploaded. Transcription queued — may take 5–15 min for 30-min video.'
        : 'Document uploaded successfully. Processing started in background.',
      sourceId: source.source_id,
      mediaType,
      status: 'PENDING_PROCESSING'
    });
  } catch (error) {
    next(error);
  }
};

const listDocuments = async (req, res, next) => {
  try {
    const documents = await KnowledgeSource.findAll({
      order: [['created_at', 'DESC']]
    });
    return res.status(200).json(documents);
  } catch (error) {
    next(error);
  }
};

const updateDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, required_clearance, status } = req.body;

    const source = await KnowledgeSource.findByPk(id);
    if (!source) {
      return res.status(404).json({ error: 'Knowledge source not found' });
    }

    if (title) source.title = title;
    if (required_clearance) source.required_clearance = required_clearance;
    if (status) source.status = status;

    await source.save();
    return res.status(200).json({ message: 'Metadata updated successfully', source });
  } catch (error) {
    next(error);
  }
};

const deprecateDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const source = await KnowledgeSource.findByPk(id);
    if (!source) {
      return res.status(404).json({ error: 'Knowledge source not found' });
    }

    source.status = 'DEPRECATED';
    await source.save();

    logger.info(`Knowledge source ID ${id} deprecation flags updated.`);
    return res.status(200).json({ message: 'Document status set to DEPRECATED', source });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadDocument,
  listDocuments,
  updateDocument,
  deprecateDocument
};
