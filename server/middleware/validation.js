import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import pool from '../config/database.js';

// Rate limiting configurations
export const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: {
        message,
        code: 'RATE_LIMIT_EXCEEDED'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          message,
          code: 'RATE_LIMIT_EXCEEDED'
        }
      });
    }
  });
};

// Speed limiting for brute force protection
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 5, // Allow 5 requests per windowMs without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
});

// Database-based rate limiting
export const dbRateLimit = async (req, res, next) => {
  const ip = req.ip;
  const endpoint = req.path;
  const now = new Date();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100;

  try {
    // Clean old entries
    await pool.query(`
      DELETE FROM rate_limits 
      WHERE window_start < NOW() - INTERVAL '15 minutes'
    `);

    // Get current count for this IP and endpoint
    const result = await pool.query(`
      SELECT request_count, window_start 
      FROM rate_limits 
      WHERE ip_address = $1 AND endpoint = $2
    `, [ip, endpoint]);

    if (result.rows.length === 0) {
      // First request for this IP/endpoint combination
      await pool.query(`
        INSERT INTO rate_limits (ip_address, endpoint, request_count, window_start)
        VALUES ($1, $2, 1, NOW())
      `, [ip, endpoint]);
    } else {
      const record = result.rows[0];
      const timeDiff = now.getTime() - new Date(record.window_start).getTime();

      if (timeDiff < windowMs) {
        // Within window, increment count
        if (record.request_count >= maxRequests) {
          return res.status(429).json({
            error: {
              message: 'Too many requests from this IP',
              code: 'RATE_LIMIT_EXCEEDED'
            }
          });
        }

        await pool.query(`
          UPDATE rate_limits 
          SET request_count = request_count + 1
          WHERE ip_address = $1 AND endpoint = $2
        `, [ip, endpoint]);
      } else {
        // Window expired, reset
        await pool.query(`
          UPDATE rate_limits 
          SET request_count = 1, window_start = NOW()
          WHERE ip_address = $1 AND endpoint = $2
        `, [ip, endpoint]);
      }
    }

    next();
  } catch (error) {
    console.error('Rate limit error:', error);
    next(); // Continue on error
  }
};

// Validation schemas
const authSchemas = {
  register: Joi.object({
    email: Joi.string().email().required().max(255),
    username: Joi.string().alphanum().min(3).max(100).required(),
    password: Joi.string().min(8).max(128).required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  })
};

const deckSchemas = {
  create: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(1000).optional(),
    difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
  }),

  update: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    description: Joi.string().max(1000).optional(),
    difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
  })
};

const flashcardSchemas = {
  create: Joi.object({
    question: Joi.string().min(1).max(2000).required(),
    answer: Joi.string().min(1).max(2000).required(),
    source: Joi.string().max(500).optional(),
    difficulty: Joi.string().valid('easy', 'medium', 'hard').optional()
  }),

  update: Joi.object({
    question: Joi.string().min(1).max(2000).optional(),
    answer: Joi.string().min(1).max(2000).optional(),
    source: Joi.string().max(500).optional(),
    difficulty: Joi.string().valid('easy', 'medium', 'hard').optional()
  }),

  review: Joi.object({
    rating: Joi.string().valid('again', 'hard', 'good', 'easy').required(),
    responseTimeMs: Joi.number().integer().min(0).max(300000).optional() // Max 5 minutes
  })
};

const generateSchemas = {
  generate: Joi.object({
    notes: Joi.string().min(10).max(10000).required(),
    difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
    count: Joi.number().integer().min(1).max(50).optional(),
    format: Joi.string().valid('qa', 'fill', 'definition', 'mcq').optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
  })
};

// Validation middleware factory
const createValidator = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors
        }
      });
    }

    req.body = value;
    next();
  };
};

// Export validation middleware
export const validateRegister = createValidator(authSchemas.register);
export const validateLogin = createValidator(authSchemas.login);
export const validateChangePassword = createValidator(authSchemas.changePassword);
export const validateResetPassword = createValidator(authSchemas.resetPassword);
export const validateCreateDeck = createValidator(deckSchemas.create);
export const validateUpdateDeck = createValidator(deckSchemas.update);
export const validateCreateFlashcard = createValidator(flashcardSchemas.create);
export const validateUpdateFlashcard = createValidator(flashcardSchemas.update);
export const validateReview = createValidator(flashcardSchemas.review);
export const validateGenerate = createValidator(generateSchemas.generate);

// Input sanitization middleware
export const sanitizeInput = (req, res, next) => {
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  };

  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// UUID validation middleware
export const validateUUID = (paramName) => {
  return (req, res, next) => {
    const uuid = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuid || !uuidRegex.test(uuid)) {
      return res.status(400).json({
        error: {
          message: `Invalid ${paramName} format`,
          code: 'INVALID_UUID'
        }
      });
    }
    
    next();
  };
};

// Pagination validation middleware
export const validatePagination = (req, res, next) => {
  const { limit = 50, offset = 0, page = 1 } = req.query;
  
  const parsedLimit = parseInt(limit);
  const parsedOffset = parseInt(offset);
  const parsedPage = parseInt(page);
  
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    return res.status(400).json({
      error: {
        message: 'Invalid limit parameter (must be between 1 and 100)',
        code: 'INVALID_LIMIT'
      }
    });
  }
  
  if (isNaN(parsedOffset) || parsedOffset < 0) {
    return res.status(400).json({
      error: {
        message: 'Invalid offset parameter (must be non-negative)',
        code: 'INVALID_OFFSET'
      }
    });
  }
  
  if (isNaN(parsedPage) || parsedPage < 1) {
    return res.status(400).json({
      error: {
        message: 'Invalid page parameter (must be positive)',
        code: 'INVALID_PAGE'
      }
    });
  }
  
  req.query.limit = parsedLimit;
  req.query.offset = parsedOffset;
  req.query.page = parsedPage;
  
  next();
}; 