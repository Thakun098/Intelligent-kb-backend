const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const EmbeddingService = require('./EmbeddingService');
const logger = require('../utils/logger');
const { CLEARANCE_RANK } = require('../config/constants');

class RetrievalService {
  /**
   * Retrieves relevant ACTIVE document chunks matching query and user permission constraints
   * @param {string} userQuery Input query
   * @param {string} userClearance Clearance level of the user (e.g. GENERAL_NEWBIE, PERMANENT_STAFF)
   * @param {number} topK Maximum chunks to look up (default: 5)
   * @param {number} threshold Cosine similarity score minimum (default: 0.75)
   * @returns {Promise<Object[]>} Matching chunk rows with score and source details
   */
  async retrieve(userQuery, userClearance, topK = 8, threshold = 0.65) {
    try {
      if (!userQuery) return [];

      // 1. Generate query embedding vector
      const queryEmbedding = await EmbeddingService.embed(userQuery);
      
      // Convert query embedding array format to pgvector compatible string syntax e.g. '[0.1, 0.2, ...]'
      const embeddingString = `[${queryEmbedding.join(',')}]`;
      const userRankValue = CLEARANCE_RANK[userClearance] || 0;

      // 2. Perform raw pgvector similarity distance query using custom ranking projection (1 - cosine distance)
      // Enforces hard filtering on status (ACTIVE) and required clearance ranks
      // Enforces index usage on ivfflat vector_cosine_ops
      const query = `
        SELECT dc.chunk_id, dc.source_id, dc.page_number, dc.raw_text_content,
          dc.timestamp_start, dc.timestamp_end, ks.title, ks.media_type, ks.required_clearance,
          1 - (dc.vector_embedding <=> :embeddingString::vector) AS score
        FROM document_chunks dc
        JOIN knowledge_sources ks ON dc.source_id = ks.source_id
        WHERE ks.status = 'ACTIVE'
          AND (
            CASE ks.required_clearance
              WHEN 'GENERAL_NEWBIE' THEN 1
              WHEN 'PERMANENT_STAFF' THEN 2
              WHEN 'CONFIDENTIAL_ADMIN' THEN 3
              ELSE 999
            END
          ) <= :userRankValue
        ORDER BY dc.vector_embedding <=> :embeddingString::vector
        LIMIT :topK
      `;

      const results = await sequelize.query(query, {
        replacements: {
          embeddingString,
          userRankValue,
          topK
        },
        type: QueryTypes.SELECT
      });

      // Map rows to structure matching Sequelize model associations (knowledgeSource nested object)
      const mappedResults = results.map(row => ({
        chunk_id: row.chunk_id,
        source_id: row.source_id,
        page_number: row.page_number,
        raw_text_content: row.raw_text_content,
        timestamp_start: row.timestamp_start,
        timestamp_end: row.timestamp_end,
        score: row.score,
        knowledgeSource: {
          title: row.title,
          media_type: row.media_type,
          required_clearance: row.required_clearance
        }
      }));

      // 3. Filter using similarity threshold score (>= 0.65)
      const filteredResults = mappedResults.filter(chunk => parseFloat(chunk.score) >= threshold);
      
      logger.info(`RAG Search for "${userQuery}" yielded ${filteredResults.length}/${results.length} chunks (threshold: ${threshold})`);
      
      return filteredResults;
    } catch (error) {
      logger.error(`Vector search retrieval failed: ${error.message}`);
      throw new Error(`Retrieval Service Error: ${error.message}`);
    }
  }
}

module.exports = new RetrievalService();
