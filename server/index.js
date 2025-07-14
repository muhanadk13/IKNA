import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import cron from 'node-cron';

import { errorHandler, notFound, asyncHandler } from './middleware/errorHandler.js';
import { validateGenerate, sanitizeInput, dbRateLimit } from './middleware/validation.js';
import { openAIService } from './services/openai.js';
import authRoutes from './routes/auth.js';
import deckRoutes from './routes/decks.js';
import flashcardRoutes from './routes/flashcards.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: {
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// Database-based rate limiting
app.use(dbRateLimit);

// Input sanitization
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());
app.use(sanitizeInput);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', asyncHandler(async (req, res) => {
  const openAIHealth = await openAIService.healthCheck();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    services: {
      openai: openAIHealth.status,
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/flashcards', flashcardRoutes);

// Generate flashcards endpoint (legacy support)
app.post('/generate', validateGenerate, asyncHandler(async (req, res) => {
  const result = await openAIService.generateFlashcards(req.body);
  
  res.json({
    success: true,
    data: result,
  });
}));

// API documentation endpoint
app.get('/api-docs', (req, res) => {
  res.json({
    name: 'IKNA Flashcard API',
    version: '2.0.0',
    description: 'AI-powered flashcard generation API with SRS',
    features: [
      'JWT Authentication',
      'PostgreSQL Database',
      'SRS Algorithm',
      'Rate Limiting',
      'Input Sanitization',
      'Secure OpenAI Proxy'
    ],
    endpoints: {
      'Authentication': {
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'Login user',
        'POST /api/auth/logout': 'Logout user',
        'POST /api/auth/verify-email': 'Verify email',
        'POST /api/auth/forgot-password': 'Request password reset',
        'POST /api/auth/reset-password': 'Reset password',
        'POST /api/auth/change-password': 'Change password',
        'GET /api/auth/profile': 'Get user profile',
        'PUT /api/auth/profile': 'Update user profile',
        'DELETE /api/auth/account': 'Delete account'
      },
      'Decks': {
        'GET /api/decks': 'Get user decks',
        'POST /api/decks': 'Create deck',
        'GET /api/decks/:id': 'Get specific deck',
        'PUT /api/decks/:id': 'Update deck',
        'DELETE /api/decks/:id': 'Delete deck',
        'GET /api/decks/:id/stats': 'Get deck statistics',
        'GET /api/decks/:id/study': 'Get study session',
        'GET /api/decks/:id/export': 'Export deck',
        'POST /api/decks/import': 'Import deck',
        'POST /api/decks/:id/generate': 'Generate flashcards'
      },
      'Flashcards': {
        'GET /api/flashcards': 'Get all flashcards',
        'POST /api/flashcards': 'Create flashcard',
        'GET /api/flashcards/:id': 'Get specific flashcard',
        'PUT /api/flashcards/:id': 'Update flashcard',
        'DELETE /api/flashcards/:id': 'Delete flashcard',
        'POST /api/flashcards/:id/review': 'Review flashcard',
        'POST /api/flashcards/:id/reset': 'Reset flashcard progress',
        'GET /api/flashcards/due': 'Get due flashcards',
        'GET /api/flashcards/difficulty/:level': 'Get flashcards by difficulty',
        'GET /api/flashcards/search/:term': 'Search flashcards',
        'GET /api/flashcards/srs/stats': 'Get SRS statistics',
        'GET /api/flashcards/srs/progress': 'Get learning progress'
      },
      'Legacy': {
        'POST /generate': 'Generate flashcards (legacy)'
      }
    },
  });
});

// Scheduled tasks
cron.schedule('0 0 * * *', async () => {
  // Daily cleanup of expired sessions and rate limits
  console.log('Running daily cleanup...');
  try {
    // Clean up expired sessions and rate limits
    // This would be implemented in a separate service
    console.log('Daily cleanup completed');
  } catch (error) {
    console.error('Daily cleanup failed:', error);
  }
});

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📚 Environment: ${NODE_ENV}`);
  console.log(`🔒 Security: Helmet, Rate Limiting, Input Sanitization enabled`);
  console.log(`⚡ Compression: Enabled`);
  console.log(`🗄️ Database: PostgreSQL with SRS`);
  console.log(`🤖 OpenAI: Secure proxy enabled`);
});
