const express = require('express');
const router = express.Router();
const queryController = require('../controllers/query.controller');
const authMiddleware = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

/**
 * @swagger
 * tags:
 *   name: Query
 *   description: RAG query pipeline — send questions and receive LLM-generated answers (SSE streaming)
 */

/**
 * @swagger
 * /api/query:
 *   post:
 *     summary: Submit a query through the RAG pipeline
 *     description: |
 *       Embeds the query, performs a clearance-filtered vector search, builds a prompt
 *       from the top matching chunks, and streams the LLM response as Server-Sent Events (SSE).
 *
 *       **SSE Stream Format**
 *       ```
 *       data: {"token": "partial answer text"}\n\n
 *       data: [DONE]\n\n
 *       ```
 *       If no relevant chunks are found (or all are above the clearance level), a fallback
 *       message is returned instead of calling the LLM.
 *     tags: [Query]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 maxLength: 2000
 *                 example: วิธีแก้ Error 500 คืออะไร
 *     responses:
 *       200:
 *         description: SSE stream — partial tokens followed by [DONE]
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: "data: {\"token\": \"The error...\"}\n\ndata: [DONE]\n\n"
 *       400:
 *         description: Invalid or missing query
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: "Too many requests — rate limit is 20 requests per minute"
 */
router.post('/', authMiddleware, validate(schemas.querySchema), queryController.query);

module.exports = router;
