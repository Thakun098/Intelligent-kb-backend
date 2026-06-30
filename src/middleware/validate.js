const Joi = require('joi');
const { CLEARANCE_LEVELS, CONTENT_TYPES } = require('../config/constants');

// ─── Schemas ────────────────────────────────────────────────────────────────

const loginSchema = Joi.object({
  username: Joi.string().min(3).max(50).pattern(/^[a-zA-Z0-9_]+$/).required()
    .messages({ 'string.pattern.base': '"username" must only contain alphanumeric characters and underscores' }),
  password: Joi.string().min(6).max(128).required()
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const querySchema = Joi.object({
  query: Joi.string().min(1).max(2000).required().trim(),
  sessionId: Joi.string().uuid().optional()
});

const createUserSchema = Joi.object({
  username: Joi.string().min(3).max(50).pattern(/^[a-zA-Z0-9_]+$/).required()
    .messages({ 'string.pattern.base': '"username" must only contain alphanumeric characters and underscores' }),
  password: Joi.string().min(8).max(128)
    .pattern(/[A-Z]/, 'uppercase')
    .pattern(/[a-z]/, 'lowercase')
    .pattern(/[0-9]/, 'digit')
    .pattern(/[@$!%*?&]/, 'special character')
    .required()
    .messages({
      'string.pattern.name': 'Password must include at least one {{#name}}'
    }),
  clearance_level: Joi.string().valid(...Object.values(CLEARANCE_LEVELS)).required(),
  department: Joi.string().min(1).max(100).required()
});

const updateUserSchema = Joi.object({
  clearance_level: Joi.string().valid(...Object.values(CLEARANCE_LEVELS)),
  department: Joi.string().min(1).max(100)
}).min(1); // At least one field required

const uploadDocumentSchema = Joi.object({
  title: Joi.string().min(1).max(255).required().trim(),
  content_type: Joi.string().valid(...Object.values(CONTENT_TYPES)).optional(),
  required_clearance: Joi.string().valid(...Object.values(CLEARANCE_LEVELS)).required()
});

const updateDocumentSchema = Joi.object({
  title: Joi.string().min(1).max(255).trim(),
  required_clearance: Joi.string().valid(...Object.values(CLEARANCE_LEVELS)),
  status: Joi.string().valid('ACTIVE', 'ARCHIVED', 'DEPRECATED', 'PENDING_PROCESSING')
}).min(1);

// ─── Middleware factory ──────────────────────────────────────────────────────

/**
 * Creates an Express middleware that validates req.body against the given Joi schema.
 * Returns 400 with structured error details on validation failure.
 */
const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,   // collect all errors, not just the first
    stripUnknown: true   // silently drop unknown keys
  });

  if (error) {
    const details = error.details.map((d) => d.message);
    return res.status(400).json({ error: 'Validation failed', details });
  }

  req.body = value; // use sanitized/stripped version
  return next();
};

module.exports = {
  validate,
  schemas: {
    loginSchema,
    refreshSchema,
    querySchema,
    createUserSchema,
    updateUserSchema,
    uploadDocumentSchema,
    updateDocumentSchema
  }
};
