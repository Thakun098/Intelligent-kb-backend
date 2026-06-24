const { ChatSession, ChatMessage } = require('../models');
const logger = require('../utils/logger');

/**
 * Creates a new chat session for the current user
 */
const createSession = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { title } = req.body;

    const session = await ChatSession.create({
      user_id: userId,
      title: title || 'New Chat'
    });

    res.status(201).json(session);
  } catch (error) {
    logger.error(`Error creating chat session: ${error.message}`);
    next(error);
  }
};

/**
 * Retrieves all chat sessions for the current user
 */
const getUserSessions = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const sessions = await ChatSession.findAll({
      where: { user_id: userId },
      order: [['updated_at', 'DESC']]
    });

    res.status(200).json(sessions);
  } catch (error) {
    logger.error(`Error retrieving chat sessions: ${error.message}`);
    next(error);
  }
};

/**
 * Retrieves all messages for a specific session
 */
const getSessionMessages = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    // Verify session belongs to user
    const session = await ChatSession.findOne({
      where: { session_id: sessionId, user_id: userId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Chat session not found or access denied.' });
    }

    const messages = await ChatMessage.findAll({
      where: { session_id: sessionId },
      order: [['created_at', 'ASC']]
    });

    res.status(200).json(messages);
  } catch (error) {
    logger.error(`Error retrieving chat messages: ${error.message}`);
    next(error);
  }
};

/**
 * Deletes a chat session
 */
const deleteSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.userId;

    const session = await ChatSession.findOne({
      where: { session_id: sessionId, user_id: userId }
    });

    if (!session) {
      return res.status(404).json({ error: 'Chat session not found or access denied.' });
    }

    await session.destroy();

    res.status(204).send();
  } catch (error) {
    logger.error(`Error deleting chat session: ${error.message}`);
    next(error);
  }
};

module.exports = {
  createSession,
  getUserSessions,
  getSessionMessages,
  deleteSession
};
