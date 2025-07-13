import { ValidationError } from './errorHandler.js';

// Validation schemas
const generateSchema = {
  notes: {
    type: 'string',
    required: true,
    minLength: 10,
    maxLength: 10000,
  },
  difficulty: {
    type: 'string',
    required: false,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner',
  },
  count: {
    type: 'number',
    required: false,
    min: 1,
    max: 50,
    default: 8,
  },
  format: {
    type: 'string',
    required: false,
    enum: ['qa', 'fill', 'definition', 'mcq'],
    default: 'qa',
  },
  tags: {
    type: 'array',
    required: false,
    items: { type: 'string' },
  },
};

// Validation function
function validateObject(obj, schema) {
  const errors = [];

  for (const [key, rules] of Object.entries(schema)) {
    const value = obj[key];

    // Check if required field is missing
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${key} is required`);
      continue;
    }

    // Skip validation if value is undefined and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push(`${key} must be a string`);
    } else if (rules.type === 'number' && typeof value !== 'number') {
      errors.push(`${key} must be a number`);
    } else if (rules.type === 'array' && !Array.isArray(value)) {
      errors.push(`${key} must be an array`);
    }

    // Length validation for strings
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${key} must be at least ${rules.minLength} characters long`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${key} must be no more than ${rules.maxLength} characters long`);
      }
    }

    // Number range validation
    if (rules.type === 'number' && typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${key} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${key} must be no more than ${rules.max}`);
      }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${key} must be one of: ${rules.enum.join(', ')}`);
    }

    // Array validation
    if (rules.type === 'array' && Array.isArray(value) && rules.items) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] !== rules.items.type) {
          errors.push(`${key}[${i}] must be a ${rules.items.type}`);
        }
      }
    }
  }

  return errors;
}

// Middleware factory
export function validate(schema) {
  return (req, res, next) => {
    const errors = validateObject(req.body, schema);
    
    if (errors.length > 0) {
      return next(new ValidationError('Validation failed', { errors }));
    }

    // Apply defaults
    for (const [key, rules] of Object.entries(schema)) {
      if (req.body[key] === undefined && rules.default !== undefined) {
        req.body[key] = rules.default;
      }
    }

    next();
  };
}

// Specific validation middlewares
export const validateGenerate = validate(generateSchema); 