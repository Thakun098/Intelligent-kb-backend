const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(`${err.name || 'Error'}: ${err.message}\nStack: ${err.stack}`);

  // Joi schema validation errors
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.details.map(d => d.message)
    });
  }

  // Multer errors (file upload)
  if (err.code && err.code.startsWith('LIMIT_')) {
    return res.status(400).json({
      error: 'Upload Limit Reached',
      details: err.message
    });
  }

  // Sequelize / Database errors
  if (err.name && err.name.startsWith('Sequelize')) {
    // Hide details for security in production
    const message = process.env.NODE_ENV === 'production' 
      ? 'Database operation failed' 
      : err.message;
    return res.status(500).json({ error: 'Database Error', details: message });
  }

  // Default error
  const response = {
    error: 'Internal Server Error'
  };

  if (process.env.NODE_ENV === 'development') {
    response.details = err.message;
    response.stack = err.stack;
  }

  return res.status(err.status || 500).json(response);
};

module.exports = errorHandler;
