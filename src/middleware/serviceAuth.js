const logger = require('../utils/logger');

const serviceAuth = (req, res, next) => {
  const key = process.env.INTERNAL_SERVICE_API_KEY;
  if (!key) {
    logger.error('[ServiceAuth] INTERNAL_SERVICE_API_KEY environment variable is not configured');
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }

  const clientKey = req.headers['x-service-api-key'];
  if (!clientKey || clientKey !== key) {
    logger.warn(`[ServiceAuth] Unauthorized service access attempt from IP: ${req.ip}`);
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }

  logger.info(`[ServiceAuth] Authorized service access from IP: ${req.ip}`);
  next();
};

module.exports = serviceAuth;
