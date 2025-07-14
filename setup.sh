#!/bin/bash

# IKNA Backend Setup Script
# This script sets up the complete backend with PostgreSQL, Redis, and all dependencies

set -e

echo "🚀 Starting IKNA Backend Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking system requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check Docker (optional)
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed. You'll need to install PostgreSQL and Redis manually."
    else
        print_success "Docker found"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_warning "Docker Compose is not installed. You'll need to install PostgreSQL and Redis manually."
    else
        print_success "Docker Compose found"
    fi
    
    print_success "System requirements check completed"
}

# Install server dependencies
install_server_deps() {
    print_status "Installing server dependencies..."
    
    cd server
    
    if [ ! -f "package.json" ]; then
        print_error "package.json not found in server directory"
        exit 1
    fi
    
    npm install
    
    print_success "Server dependencies installed"
    cd ..
}

# Setup environment file
setup_env() {
    print_status "Setting up environment configuration..."
    
    cd server
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Created .env file from template"
        else
            print_warning "No .env.example found. Creating basic .env file..."
            cat > .env << EOF
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
DB_PASSWORD=password

# Redis Configuration
REDIS_URL=redis://localhost:6379

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7
EOF
            print_success "Created basic .env file"
        fi
    else
        print_warning ".env file already exists"
    fi
    
    cd ..
}

# Setup database with Docker
setup_database_docker() {
    print_status "Setting up database with Docker..."
    
    if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
        # Start PostgreSQL and Redis
        docker-compose up -d postgres redis
        
        # Wait for PostgreSQL to be ready
        print_status "Waiting for PostgreSQL to be ready..."
        sleep 10
        
        # Run database migrations
        cd server
        npm run db:migrate
        cd ..
        
        print_success "Database setup completed with Docker"
    else
        print_error "Docker not available. Please install PostgreSQL and Redis manually."
        print_status "Manual setup instructions:"
        echo "1. Install PostgreSQL 12+"
        echo "2. Create database: createdb anki_db"
        echo "3. Install Redis 6+"
        echo "4. Run: cd server && npm run db:migrate"
    fi
}

# Setup database manually
setup_database_manual() {
    print_status "Setting up database manually..."
    
    # Check if PostgreSQL is running
    if ! pg_isready -h localhost -p 5432 &> /dev/null; then
        print_error "PostgreSQL is not running. Please start PostgreSQL first."
        exit 1
    fi
    
    # Create database if it doesn't exist
    if ! psql -h localhost -U postgres -lqt | cut -d \| -f 1 | grep -qw anki_db; then
        print_status "Creating database..."
        createdb -h localhost -U postgres anki_db
        print_success "Database created"
    else
        print_warning "Database already exists"
    fi
    
    # Run migrations
    cd server
    npm run db:migrate
    cd ..
    
    print_success "Database setup completed manually"
}

# Test the setup
test_setup() {
    print_status "Testing the setup..."
    
    cd server
    
    # Test database connection
    if node -e "
    const pool = require('./config/database.js').default;
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('Database connection failed:', err.message);
            process.exit(1);
        }
        console.log('Database connection successful');
        process.exit(0);
    });
    " 2>/dev/null; then
        print_success "Database connection test passed"
    else
        print_error "Database connection test failed"
        exit 1
    fi
    
    cd ..
}

# Main setup function
main() {
    echo "=========================================="
    echo "IKNA Backend Setup Script"
    echo "=========================================="
    echo ""
    
    check_requirements
    install_server_deps
    setup_env
    
    # Choose database setup method
    if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
        echo ""
        echo "Docker detected. Choose setup method:"
        echo "1. Docker (recommended)"
        echo "2. Manual setup"
        read -p "Enter your choice (1 or 2): " choice
        
        case $choice in
            1)
                setup_database_docker
                ;;
            2)
                setup_database_manual
                ;;
            *)
                print_error "Invalid choice"
                exit 1
                ;;
        esac
    else
        setup_database_manual
    fi
    
    test_setup
    
    echo ""
    echo "=========================================="
    print_success "Setup completed successfully!"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "1. Update server/.env with your OpenAI API key"
    echo "2. Start the server: cd server && npm run dev"
    echo "3. Start the client: cd client && npm run dev"
    echo ""
    echo "API will be available at: http://localhost:4000"
    echo "Health check: http://localhost:4000/health"
    echo "API docs: http://localhost:4000/api-docs"
    echo ""
}

# Run main function
main "$@" 