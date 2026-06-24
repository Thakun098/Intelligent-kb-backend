const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const authMiddleware = require('../middleware/auth');
const rbacMiddleware = require('../middleware/rbac');

/**
 * @swagger
 * tags:
 *   name: Audit
 *   description: Immutable audit log access (Admin — CONFIDENTIAL_ADMIN only)
 */

// All audit trail endpoints require CONFIDENTIAL_ADMIN level clearance
router.use(authMiddleware);
router.use(rbacMiddleware('CONFIDENTIAL_ADMIN'));

/**
 * @swagger
 * /api/audit:
 *   get:
 *     summary: List audit logs (paginated)
 *     description: Returns a paginated list of all query-response audit records. Logs are immutable — no UPDATE or DELETE is ever permitted.
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1-indexed)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Records per page (max 100)
 *     responses:
 *       200:
 *         description: Paginated audit log entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 *       403:
 *         description: Insufficient clearance level
 */
router.get('/', auditController.listAuditLogs);

/**
 * @swagger
 * /api/audit/{logId}:
 *   get:
 *     summary: Get a single audit log entry by ID
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Audit log entry ID
 *     responses:
 *       200:
 *         description: Single audit log detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLog'
 *       404:
 *         description: Audit log not found
 */
router.get('/:id', auditController.getAuditLogDetail);

module.exports = router;
