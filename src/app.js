const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth.routes');
const queryRoutes = require('./routes/query.routes');
const documentsRoutes = require('./routes/documents.routes');
const usersRoutes = require('./routes/users.routes');
const auditRoutes = require('./routes/audit.routes');
const chatRoutes = require('./routes/chat.routes');

const app = express();

// Security middlewares
app.use(helmet());

// CORS configuration (allow local dev environments)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiter for API Query endpoint (max 20 req/min per IP/User as specified)
const queryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Too many queries. Please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/query', queryLimiter, queryRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/chat', chatRoutes);

// API Documentation (Swagger UI)
// Uses contentSecurityPolicy: false to allow Swagger UI JS/CSS to load
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'KB Assistant API Docs',
  swaggerOptions: { persistAuthorization: true }
}));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Default status endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
