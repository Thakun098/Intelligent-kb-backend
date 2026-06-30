require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const db = require('./src/models');
const logger = require('./src/utils/logger');

// Initialize background queue workers
require('./src/workers/documentWorker');
require('./src/workers/videoWorker');

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Authenticate database connection
    await db.sequelize.authenticate();
    logger.info('Database connection established successfully.');

    const server = http.createServer(app);
    server.timeout = 1800000; // 30 minutes
    server.listen(PORT, () => {
      logger.info(`Backend API server running on port ${PORT} in ${process.env.NODE_ENV} mode.`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

startServer();
