const documentQueue = require('../queues/documentQueue');
const DocumentService = require('../services/DocumentService');
const ThaiNLPService = require('../services/ThaiNLPService');
const ChunkingService = require('../services/ChunkingService');
const EmbeddingService = require('../services/EmbeddingService');
const { KnowledgeSource, DocumentChunk, PostMortemDetail, sequelize } = require('../models');
const logger = require('../utils/logger');

documentQueue.process(async (job) => {
  const { sourceId, filePath, mimeType, contentType } = job.data;
  logger.info(`Starting asynchronous processing for document job. Source ID: ${sourceId}`);

  // Fetch target record
  const source = await KnowledgeSource.findByPk(sourceId);
  if (!source) {
    throw new Error(`KnowledgeSource not found for ID: ${sourceId}`);
  }

  const transaction = await sequelize.transaction();
  try {
    // 1. Extract raw text from physical document file
    const rawText = await DocumentService.extractText(filePath, mimeType);
    if (!rawText || !rawText.trim()) {
      throw new Error('No text content could be extracted from this document file');
    }

    // 2. Tokenize text using PyThaiNLP sidecar microservice
    const tokenizedText = await ThaiNLPService.tokenize(rawText);

    // 3. Split tokenized text content into overlapping chunks
    const chunkStrings = ChunkingService.chunkText(tokenizedText, 800, 150);

    // 4. For each chunk: generate nomic-embed-text embedding and save in pgvector database
    for (let i = 0; i < chunkStrings.length; i++) {
      const chunkText = chunkStrings[i];
      const vector = await EmbeddingService.embed(chunkText);

      await DocumentChunk.create({
        source_id: sourceId,
        page_number: null, // pdf-parse extracts continuous text block, page mapping can be updated later
        raw_text_content: chunkText,
        vector_embedding: vector
      }, { transaction });
    }

    // 5. If file is POST_MORTEM_ERROR, parse structure and append post_mortem_details
    if (contentType === 'POST_MORTEM_ERROR') {
      // Parse structured sections: symptom, root cause, resolution, prevention
      const symptomMatch = rawText.match(/(?:Symptom|อาการขัดข้อง|ปัญหา):\s*(.*?)(?=(?:Root Cause|สาเหตุ|Resolution|แนวทางแก้ไข|Prevention|การป้องกัน)|$)/si);
      const rootCauseMatch = rawText.match(/(?:Root Cause|สาเหตุของปัญหา|สาเหตุ):\s*(.*?)(?=(?:Symptom|อาการขัดข้อง|Resolution|แนวทางแก้ไข|Prevention|การป้องกัน)|$)/si);
      const resolutionMatch = rawText.match(/(?:Resolution|แนวทางแก้ไข|วิธีแก้ไข):\s*(.*?)(?=(?:Symptom|อาการขัดข้อง|Root Cause|สาเหตุ|Prevention|การป้องกัน)|$)/si);
      const preventionMatch = rawText.match(/(?:Prevention|การป้องกัน|แนวทางป้องกัน):\s*(.*?)(?=(?:Symptom|อาการขัดข้อง|Root Cause|สาเหตุ|Resolution|แนวทางแก้ไข)|$)/si);

      await PostMortemDetail.create({
        source_id: sourceId,
        symptom: symptomMatch ? symptomMatch[1].trim() : 'Unspecified Symptom. Refer to document content.',
        root_cause: rootCauseMatch ? rootCauseMatch[1].trim() : 'Unspecified Root Cause. Refer to document content.',
        resolution: resolutionMatch ? resolutionMatch[1].trim() : 'Unspecified Resolution. Refer to document content.',
        prevention: preventionMatch ? preventionMatch[1].trim() : 'Unspecified Prevention. Refer to document content.'
      }, { transaction });
    }

    // 6. Set status = ACTIVE
    source.status = 'ACTIVE';
    await source.save({ transaction });

    await transaction.commit();
    logger.info(`Successfully completed document worker task. Chunks created: ${chunkStrings.length}. Source ID: ${sourceId}`);
    return { status: 'COMPLETED', chunks: chunkStrings.length };

  } catch (error) {
    await transaction.rollback();
    logger.error(`Error processing document job inside worker: ${error.message}`);
    
    // Set status = DEPRECATED or log failure
    source.status = 'DEPRECATED'; // Update state to reflect error
    await source.save();

    throw error;
  }
});

logger.info('Document Queue Worker registered and listening for jobs...');
