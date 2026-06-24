const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token missing or invalid format' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid access token' });
    }

    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User associated with this token no longer exists' });
    }

    // Attach user profile to request object
    req.user = {
      userId: user.user_id,
      username: user.username,
      clearanceLevel: user.clearance_level,
      department: user.department
    };

    next();
  } catch (error) {
    logger.error(`Authentication middleware error: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

module.exports = authMiddleware;
