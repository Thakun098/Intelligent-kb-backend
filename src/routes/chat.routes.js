const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all chat routes
router.use(authMiddleware);

router.post('/sessions', chatController.createSession);
router.get('/sessions', chatController.getUserSessions);
router.get('/sessions/:sessionId/messages', chatController.getSessionMessages);
router.delete('/sessions/:sessionId', chatController.deleteSession);

module.exports = router;
