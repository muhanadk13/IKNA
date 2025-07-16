import { OpenAI } from 'openai';

// Custom error classes
export class AppError extends Error {
  constructor(message, statusCode, code = 'UNKNOWN_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class OpenAIApiError extends AppError {
  constructor(message, originalError) {
    super(message, 500, 'OPENAI_API_ERROR');
    this.originalError = originalError;
  }
}

// Error handler middleware
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('❌ ERROR DETAILS:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  // OpenAI API errors
  if (err instanceof OpenAI.APIError) {
    const message = 'OpenAI API error occurred';
    error = new OpenAIApiError(message, err);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const message = 'Validation Error';
    error = new ValidationError(message, err.details);
  }

  // JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    const message = 'Invalid JSON in request body';
    error = new ValidationError(message);
  }

  // Default error
  if (!error.statusCode) {
    error.statusCode = 500;
    error.message = 'Internal Server Error';
  }

  res.status(error.statusCode).json({
    success: false,
    error: {
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      ...(error.details && { details: error.details }),
    },
  });
};

// Async error wrapper
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler
export const notFound = (req, res, next) => {
  const error = new AppError(`Not Found - ${req.originalUrl}`, 404, 'NOT_FOUND');
  next(error);
}; 