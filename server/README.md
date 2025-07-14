# IKNA Backend API

A comprehensive backend API for an AI-powered flashcard application with spaced repetition system (SRS).

## Features

### ✅ Authentication & Security
- **JWT Authentication** with secure token management
- **Password Reset** with email verification
- **Account Lockout** after failed login attempts
- **Session Management** with Redis
- **Input Sanitization** and XSS protection
- **Rate Limiting** with database persistence
- **CORS** configuration for frontend integration

### ✅ Database (PostgreSQL)
- **User Management** with secure password hashing
- **Deck Management** with CRUD operations
- **Flashcard Storage** with SRS metadata
- **Review History** tracking
- **Session Storage** for rate limiting
- **Optimized Indexes** for performance

### ✅ SRS Logic (Spaced Repetition System)
- **SuperMemo 2 Algorithm** implementation
- **Adaptive Intervals** based on performance
- **Ease Factor** calculations
- **Due Date Management**
- **Progress Tracking** and statistics
- **Learning Analytics** with response times

### ✅ Flashcard CRUD APIs
- **Create/Read/Update/Delete** flashcards
- **Bulk Operations** for efficiency
- **Search Functionality** across cards
- **Difficulty Filtering** and sorting
- **Import/Export** capabilities
- **AI Generation** from notes

### ✅ Rate Limits & Security
- **Global Rate Limiting** (1000 req/15min)
- **Endpoint-Specific Limits** (auth: 5/15min)
- **Database-Persistent** rate tracking
- **Brute Force Protection** with slow-down
- **Input Validation** with Joi schemas
- **SQL Injection Protection**

### ✅ Secure OpenAI Proxy
- **API Key Protection** (never exposed to frontend)
- **Request Validation** and sanitization
- **Error Handling** with fallbacks
- **Response Caching** for efficiency
- **Usage Tracking** and monitoring

## Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL 12+
- Redis 6+

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup
```bash
# Create PostgreSQL database
createdb anki_db

# Run migrations
npm run db:migrate
```

### 3. Environment Configuration
Create a `.env` file based on `.env.example`:

```env
# Server Configuration
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=anki_db
DB_USER=postgres
DB_PASSWORD=your-database-password

# Redis Configuration
REDIS_URL=redis://localhost:6379

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7
```

### 4. Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/verify-email` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `DELETE /api/auth/account` - Delete account

### Decks
- `GET /api/decks` - Get user decks
- `POST /api/decks` - Create deck
- `GET /api/decks/:id` - Get specific deck
- `PUT /api/decks/:id` - Update deck
- `DELETE /api/decks/:id` - Delete deck
- `GET /api/decks/:id/stats` - Get deck statistics
- `GET /api/decks/:id/study` - Get study session
- `GET /api/decks/:id/export` - Export deck
- `POST /api/decks/import` - Import deck
- `POST /api/decks/:id/generate` - Generate flashcards

### Flashcards
- `GET /api/flashcards` - Get all flashcards
- `POST /api/flashcards` - Create flashcard
- `GET /api/flashcards/:id` - Get specific flashcard
- `PUT /api/flashcards/:id` - Update flashcard
- `DELETE /api/flashcards/:id` - Delete flashcard
- `POST /api/flashcards/:id/review` - Review flashcard
- `POST /api/flashcards/:id/reset` - Reset flashcard progress
- `GET /api/flashcards/due` - Get due flashcards
- `GET /api/flashcards/difficulty/:level` - Get flashcards by difficulty
- `GET /api/flashcards/search/:term` - Search flashcards
- `GET /api/flashcards/srs/stats` - Get SRS statistics
- `GET /api/flashcards/srs/progress` - Get learning progress

## SRS Algorithm

The backend implements the SuperMemo 2 algorithm for spaced repetition:

### Rating System
- **Again (0)** - Reset interval to 1 day
- **Hard (1)** - Reduce ease factor, reset interval
- **Good (2)** - Normal progression
- **Easy (3)** - Increase ease factor, longer interval

### Interval Calculation
- **First review**: 1 day
- **Second review**: 6 days
- **Subsequent reviews**: interval × ease factor

### Ease Factor
- Starts at 2.5
- Increases with "Easy" ratings
- Decreases with "Hard" ratings
- Minimum: 1.3

## Security Features

### Rate Limiting
- Global: 1000 requests per 15 minutes
- Authentication: 5 attempts per 15 minutes
- Review: 60 reviews per minute
- Database-persistent tracking

### Input Validation
- Joi schema validation
- SQL injection protection
- XSS prevention
- Input sanitization

### Authentication
- JWT tokens with expiration
- Password hashing with bcrypt
- Account lockout after failed attempts
- Session management with Redis

## Database Schema

### Users Table
- UUID primary key
- Email and username (unique)
- Password hash
- Account status and verification
- Failed login tracking

### Decks Table
- UUID primary key
- User relationship
- Name, description, difficulty
- Tags array
- Timestamps

### Flashcards Table
- UUID primary key
- Deck relationship
- Question and answer
- SRS metadata (ease factor, interval, etc.)
- Due date and next review

### Review History Table
- UUID primary key
- Flashcard and user relationships
- Rating and response time
- Review timestamp

## Development

### Scripts
```bash
npm run dev          # Start development server
npm start           # Start production server
npm test            # Run tests
npm run lint        # Run ESLint
npm run db:migrate  # Run database migrations
npm run db:seed     # Seed database with sample data
```

### Testing
```bash
npm test
```

### Database Migrations
```bash
# Create tables
npm run db:migrate

# Drop tables (development only)
npm run db:migrate drop
```

## Production Deployment

### Environment Variables
Ensure all required environment variables are set in production.

### Database
- Use a production PostgreSQL instance
- Set up proper backups
- Configure connection pooling

### Redis
- Use a production Redis instance
- Configure persistence
- Set up monitoring

### Security
- Use strong JWT secrets
- Enable HTTPS
- Configure proper CORS
- Set up monitoring and logging

## Monitoring

The API includes:
- Request logging
- Error tracking
- Performance monitoring
- Health check endpoint
- Database connection monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License 