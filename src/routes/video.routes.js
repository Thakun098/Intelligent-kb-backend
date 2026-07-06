const express = require('express');
const router = express.Router();
const videoController = require('../controllers/video.controller');
const serviceAuth = require('../middleware/serviceAuth');
const { validate, schemas } = require('../middleware/validate');

/**
 * @swagger
 * tags:
 *   name: Videos
 *   description: Video processing endpoints for internal sidecar services
 */

/**
 * @swagger
 * /api/videos/process:
 *   post:
 *     summary: Request asynchronous video processing from internal services
 *     description: |
 *       Triggers the video processing pipeline by passing a video URL and metadata.
 *       Only accessible by internal services using the Authorization Bearer Token.
 *     tags: [Videos]
 *     security:
 *       - serviceApiKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [videoUrl, title, required_clearance]
 *             properties:
 *               videoUrl:
 *                 type: string
 *                 format: uri
 *                 example: http://storage-service:9000/uploads/meeting-q3.mp4
 *               title:
 *                 type: string
 *                 example: Meeting Recording Q3 2025
 *               required_clearance:
 *                 type: string
 *                 enum: [GENERAL_NEWBIE, PERMANENT_STAFF, CONFIDENTIAL_ADMIN]
 *               content_type:
 *                 type: string
 *                 enum: [ONBOARDING_GUIDE, POST_MORTEM_ERROR, VIDEO_TRANSCRIPT]
 *                 default: VIDEO_TRANSCRIPT
 *               enable_frame_captioning:
 *                 type: boolean
 *                 default: true
 *               source_service:
 *                 type: string
 *                 example: video-upload-service
 *     responses:
 *       202:
 *         description: Video processing accepted and queued
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
 *         description: Validation error (URL invalid, missing required fields)
 *       401:
 *         description: Invalid or missing API key
 *       503:
 *         description: Service not configured (INTERNAL_SERVICE_API_KEY missing in env)
 */
router.post(
  '/process',
  serviceAuth,
  validate(schemas.processVideoSchema),
  videoController.processVideoCallback
);

module.exports = router;
