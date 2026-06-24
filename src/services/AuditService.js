const { AuditLog } = require('../models');
const logger = require('../utils/logger');

class AuditService {
  /**
   * Write an immutable audit log entry into the database
   * @param {Object} logData Entry information
   * @param {number} logData.userId ID of the user executing the query
   * @param {string} logData.userQuery Raw string entered by the user
   * @param {string} logData.aiOutput Raw text streamed from the LLM
   * @param {string[]} logData.accessedChunkIds Array of UUID strings pointing to retrieved chunks
   * @returns {Promise<Object>} Created Sequelize record
   */
  async log({ userId, userQuery, aiOutput, accessedChunkIds = [] }) {
    try {
      if (!userId) {
        throw new Error('user_id is required to register an audit log entry');
      }
      if (!userQuery) {
        throw new Error('user_query is required to register an audit log entry');
      }

      const auditEntry = await AuditLog.create({
        user_id: userId,
        user_query: userQuery,
        ai_output: aiOutput || '',
        accessed_chunk_ids: accessedChunkIds,
        timestamp: new Date()
      });

      logger.info(`Audit logged: User ID ${userId} queried system. Log ID: ${auditEntry.log_id}`);
      return auditEntry;
    } catch (error) {
      // Log errors but do not crash system if audit logging fails to maintain service availability,
      // though key constraint 9 states ALWAYS log every query-response cycle, so we log as critical error.
      logger.error(`CRITICAL: Audit trail logging failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new AuditService();
