const documentQueue = require('../queues/documentQueue');
const { KnowledgeSource } = require('../models');
const logger = require('../utils/logger');
const fs = require('fs');

const uploadDocument = async (req, res, next) => {
  try {
    const file = req.file;
    const { title, content_type, required_clearance } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'Please upload a file' });
    }
    if (!title || !content_type || !required_clearance) {
      // Clean up uploaded file if validation fails
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'title, content_type, and required_clearance are required fields' });
    }

    // Register metadata record in database
    const source = await KnowledgeSource.create({
      title,
      content_type,
      file_path: file.path,
      required_clearance,
      status: 'PENDING_PROCESSING'
    });

    // Push async processing task to background queue
    await documentQueue.add({
      sourceId: source.source_id,
      filePath: file.path,
      mimeType: file.mimetype,
      contentType: content_type
    });

    logger.info(`Admin uploaded document: "${title}". Job added to Bull queue.`);
    
    return res.status(202).json({
      message: 'Document uploaded successfully. Processing started in background.',
      sourceId: source.source_id,
      status: source.status
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
