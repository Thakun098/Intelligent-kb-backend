const express = require('express');
const router = express.Router();
const documentsController = require('../controllers/documents.controller');
const uploadMiddleware = require('../middleware/upload');
const authMiddleware = require('../middleware/auth');
const rbacMiddleware = require('../middleware/rbac');
const { validate, schemas } = require('../middleware/validate');

/**
 * @swagger
 * tags:
 *   name: Documents
 *   description: Knowledge source management (Admin — CONFIDENTIAL_ADMIN only)
 */

// All document management routes require CONFIDENTIAL_ADMIN level clearance
router.use(authMiddleware);
router.use(rbacMiddleware('CONFIDENTIAL_ADMIN'));

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: List all knowledge sources
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of knowledge sources
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/KnowledgeSource'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient clearance level
 */
router.get('/', documentsController.listDocuments);

/**
 * @swagger
 * /api/documents/upload:
 *   post:
 *     summary: Upload a new document for processing
 *     description: |
 *       Uploads a PDF/DOCX/TXT file. The file is stored and a background Bull queue job is
 *       created to extract text, tokenize (Thai NLP), chunk, embed, and index into pgvector.
 *       The knowledge source status starts as PENDING_PROCESSING and transitions to ACTIVE on completion.
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, title, content_type, required_clearance]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF, DOCX, or TXT file (max 50 MB)
 *               title:
 *                 type: string
 *                 example: Server Incident Post-Mortem 2024-01
 *               content_type:
 *                 type: string
 *                 enum: [ONBOARDING_GUIDE, POST_MORTEM_ERROR]
 *               required_clearance:
 *                 type: string
 *                 enum: [GENERAL_NEWBIE, PERMANENT_STAFF, CONFIDENTIAL_ADMIN]
 *     responses:
 *       202:
 *         description: Document accepted, processing started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 sourceId:
 *                   type: integer
 *                 status:
 *                   type: string
 *                   example: PENDING_PROCESSING
 *       400:
 *         description: Missing file or invalid fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient clearance level
 */
router.post('/upload', uploadMiddleware.single('file'), validate(schemas.uploadDocumentSchema), documentsController.uploadDocument);

/**
 * @swagger
 * /api/documents/{id}:
 *   put:
 *     summary: Update document metadata
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Knowledge source ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               required_clearance:
 *                 type: string
 *                 enum: [GENERAL_NEWBIE, PERMANENT_STAFF, CONFIDENTIAL_ADMIN]
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, ARCHIVED, DEPRECATED, PENDING_PROCESSING]
 *     responses:
 *       200:
 *         description: Document updated successfully
 *       404:
 *         description: Document not found
 *   delete:
 *     summary: Deprecate a document (soft delete — sets status to DEPRECATED)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Document deprecated successfully
 *       404:
 *         description: Document not found
 */
router.put('/:id', validate(schemas.updateDocumentSchema), documentsController.updateDocument);
router.delete('/:id', documentsController.deprecateDocument);

module.exports = router;
