const { hasAccess } = require('../utils/clearanceHelper');
const logger = require('../utils/logger');

/**
 * Middleware to restrict endpoints based on clearance level
 * @param {string} requiredClearance Clearance level enum required to access this endpoint
 */
const rbacMiddleware = (requiredClearance) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User context not found. Authentication required.' });
      }

      const userClearance = req.user.clearanceLevel;

      if (!hasAccess(userClearance, requiredClearance)) {
        logger.warn(`Access Denied: User ${req.user.username} (clearance: ${userClearance}) tried to access endpoint requiring ${requiredClearance}`);
        return res.status(403).json({ error: 'Access Denied: Insufficient clearance level' });
      }

      next();
    } catch (error) {
      logger.error(`RBAC middleware error: ${error.message}`);
      return res.status(500).json({ error: 'Internal server error during authorization check' });
    }
  };
};

module.exports = rbacMiddleware;
