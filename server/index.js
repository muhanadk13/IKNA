import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

import { errorHandler, notFound, asyncHandler } from './middleware/errorHandler.js';
import { validateGenerate } from './middleware/validation.js';
import { openAIService } from './services/openai.js';

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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: {
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

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

// Generate flashcards endpoint
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
    version: '1.0.0',
    description: 'AI-powered flashcard generation API',
    endpoints: {
      'POST /generate': {
        description: 'Generate flashcards from notes using AI',
        body: {
          notes: 'string (required)',
          difficulty: 'beginner|intermediate|advanced (optional)',
          count: 'number 1-50 (optional)',
          format: 'qa|fill|definition|mcq (optional)',
          tags: 'string[] (optional)',
        },
      },
      'GET /health': {
        description: 'Health check endpoint',
      },
    },
  });
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
  console.log(`🔒 Security: Helmet enabled`);
  console.log(`⚡ Compression: Enabled`);
  console.log(`🛡️ Rate limiting: Enabled`);
});
