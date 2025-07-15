<img width="923" height="411" alt="image" src="https://github.com/user-attachments/assets/95c2b189-93c7-4ea9-b596-878ee33ad7d4" />

# IKNA - Smart Flashcard App

I built this because I wanted a better way to study. Traditional flashcard apps were clunky and outdated, so I created a modern web app with AI-powered card generation and spaced repetition algorithms.

## What I Built

- **React frontend** with TypeScrip![Uploading Screenshot 2025-07-14 at 11.34.43 PM.png…]()
t and smooth animations
- **Node.js backend** with JWT authentication
- **SuperMemo 2 algorithm** for optimal learning intervals
- **AI integration** for automatic flashcard generation from notes
- **Docker setup** for easy deployment

## Tech Stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS, Framer Motion
**Backend:** Node.js, Express, JWT, OpenAI API
**Database:** PostgreSQL (planned), Redis caching
**DevOps:** Docker, Docker Compose

## Features

### AI-Powered Card Generation
Takes your notes and automatically creates flashcards using GPT. No more manually typing out cards!

### Spaced Repetition
Implements the SuperMemo 2 algorithm - cards you struggle with appear more often, easy ones less often.

### Modern UI
Clean, responsive design with smooth animations. Works great on desktop and mobile.

### Study Analytics
Track your progress, accuracy, and learning streaks. See which cards need more attention.

## Getting Started

### Prerequisites
- Node.js 18+
- Docker (recommended)
- OpenAI API key

### Quick Start with Docker
```bash
git clone <your-repo>
cd Anki
docker-compose up --build
```
Visit `http://localhost:5173`

### Manual Setup
```bash
# Backend
cd server
npm install
npm run dev

# Frontend (new terminal)
cd client
npm install
npm run dev
```

## How It Works

1. **Create a deck** - Paste your notes, give it a name
2. **AI generates cards** - GPT creates flashcards from your content
3. **Study with SRS** - Rate cards (Again/Hard/Good/Easy) to optimize learning
4. **Track progress** - See your accuracy and learning stats

## Challenges & What I Learned

- **Spaced repetition math** was tricky - had to really understand the SuperMemo algorithm
- **State management** across complex UI flows took several iterations
- **TypeScript generics** - learned a lot about type safety and generic constraints
- **API rate limiting** - OpenAI has strict limits, had to implement proper error handling
- **Docker networking** - getting frontend/backend communication working was a pain

## Current Status

✅ **Working:**
- Full-stack React/Node.js app
- Spaced repetition algorithm
- AI card generation
- Modern UI with animations
- Docker deployment

🔄 **In Progress:**
- Real database integration (currently using localStorage)
- User authentication system
- Comprehensive testing suite

📋 **Planned:**
- PostgreSQL database
- User accounts and data persistence
- Mobile app
- Social features (sharing decks)

## Development

```bash
# Run tests
npm test

# Build for production
npm run build

# Lint code
npm run lint
```

## Contributing

Feel free to open issues or submit PRs! This is a learning project, so I'm open to suggestions and improvements.

## License

MIT License - feel free to use this code for your own projects.

---

*Built with React, Node.js, and a lot of coffee ☕* 
