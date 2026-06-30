const RetrievalService = require('../services/RetrievalService');
const LLMService = require('../services/LLMService');
const AuditService = require('../services/AuditService');
const { ChatSession, ChatMessage } = require('../models');
const { buildSystemPrompt, buildContext } = require('../utils/promptBuilder');
const logger = require('../utils/logger');
const crypto = require('crypto');

// ─── Input Sanitization ─────────────────────────────────────────────────────
/**
 * Strips HTML tags and common prompt-injection patterns from user queries.
 * This is a defense-in-depth measure; the primary protection is the hard-filter
 * at the vector search / RBAC layer (permission-checked chunks only).
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions?/gi,
  /forget\s+(all\s+)?previous\s+instructions?/gi,
  /disregard\s+(all\s+)?previous\s+instructions?/gi,
  /you\s+are\s+now\s+/gi,
  /override\s+(your\s+)?system\s+prompt/gi,
  /act\s+as\s+(if\s+you\s+(are|were)\s+)?/gi,
  /<\/?[^>]+(>|$)/g  // strip HTML tags
];

const sanitizeQuery = (rawQuery) => {
  let sanitized = rawQuery;
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }
  return sanitized.replace(/\s{2,}/g, ' ').trim();
};

// ─── Controller ──────────────────────────────────────────────────────────────

const query = async (req, res, next) => {
  try {
    const { query: userQuery, sessionId } = req.body;
    const user = req.user; // Added by authMiddleware
    logger.info(`Incoming query request: ${JSON.stringify(req.body)}`);

    if (!userQuery || typeof userQuery !== 'string' || !userQuery.trim()) {
      return res.status(400).json({ error: 'Query string must be a non-empty string' });
    }

    // Sanitize against XSS and prompt injection attempts
    const sanitizedQuery = sanitizeQuery(userQuery);
    if (!sanitizedQuery) {
      return res.status(400).json({ error: 'Query is empty after sanitization.' });
    }

    if (sanitizedQuery !== userQuery.trim()) {
      logger.warn(`Possible prompt injection detected from user ${user.username}. Query sanitized.`);
    }

    const similarityThreshold = parseFloat(process.env.VECTOR_SIMILARITY_THRESHOLD || '0.75');
    const topK = parseInt(process.env.VECTOR_TOP_K || '5', 10);
    const topN = parseInt(process.env.CONTEXT_TOP_N || '3', 10);

    // 1. Retrieve chunks applying clearance filter
    const chunks = await RetrievalService.retrieve(
      sanitizedQuery,
      user.clearanceLevel,
      topK,
      similarityThreshold
    );

    // Write SSE headers to stream output
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Tell client to start reading

    // If no context matched threshold, stream fallback message immediately
    if (chunks.length === 0) {
      const fallbackMessage = 'ไม่พบข้อมูลระบบที่เกี่ยวข้องกับคำถามนี้ กรุณาติดต่อผู้รับผิดชอบโดยตรง';
      res.write(`data: ${JSON.stringify({ token: fallbackMessage })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();

      // Log cycle to audit table
      await AuditService.log({
        userId: user.userId,
        userQuery: sanitizedQuery,
        aiOutput: fallbackMessage,
        accessedChunkIds: []
      });

      // Save to chat history if sessionId is provided
      if (sessionId) {
        const now = new Date();
        await ChatMessage.bulkCreate([
          { message_id: crypto.randomUUID(), session_id: sessionId, role: 'user', content: sanitizedQuery, created_at: now },
          { message_id: crypto.randomUUID(), session_id: sessionId, role: 'assistant', content: fallbackMessage, created_at: now }
        ]);
        await ChatSession.update({ updated_at: now }, { where: { session_id: sessionId } });
      }

      return;
    }

    // 2. Select top N chunks for prompt construction
    const topNChunks = chunks.slice(0, topN);
    const contextText = buildContext(topNChunks);  // formatted with index numbers
    const accessedChunkIds = topNChunks.map(c => c.chunk_id);

    logger.info(`Using ${topNChunks.length} chunks for context (scores: ${chunks.slice(0,topN).map(c => parseFloat(c.score).toFixed(3)).join(', ')})`);

    // 3. Build prompts
    const systemPrompt = buildSystemPrompt();

    // 4. Stream chat tokens
    let fullResponse = '';
    const chatStream = LLMService.streamChat(systemPrompt, contextText, sanitizedQuery);

    for await (const token of chatStream) {
      fullResponse += token;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }

    // Mark completion of stream
    res.write('data: [DONE]\n\n');
    res.end();

    // 5. Append immutable audit trail
    await AuditService.log({
      userId: user.userId,
      userQuery: sanitizedQuery,
      aiOutput: fullResponse,
      accessedChunkIds
    });

    // 6. Save to chat history if sessionId is provided
    if (sessionId) {
      const now = new Date();
      await ChatMessage.bulkCreate([
        { message_id: crypto.randomUUID(), session_id: sessionId, role: 'user', content: sanitizedQuery, created_at: now },
        { message_id: crypto.randomUUID(), session_id: sessionId, role: 'assistant', content: fullResponse, created_at: now }
      ]);
      await ChatSession.update({ updated_at: now }, { where: { session_id: sessionId } });
    }

  } catch (error) {
    logger.error(`Query route execution failed: ${error.message}`);
    // If headers already sent, we can't send JSON error, just close connection
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: 'Inference streaming error occurred' })}\n\n`);
      res.end();
    } else {
      next(error);
    }
  }
};

module.exports = {
  query
};
