# 📚 IKNA - Intelligent Knowledge with Neural Assistance

A smart flashcard app that uses AI to generate flashcards from notes and implements spaced repetition for optimal learning.

## ✨ Features

### 🧠 AI-Powered Flashcard Generation
- Convert raw notes into high-quality flashcards using GPT
- Multiple difficulty levels (beginner, intermediate, advanced)
- Various formats: Q&A, fill-in-the-blank, definitions, multiple choice
- Customizable number of cards per deck

### 📊 Spaced Repetition System
- Implements SuperMemo 2 (SM-2) algorithm
- Smart scheduling based on performance
- Four rating options: Again, Hard, Good, Easy
- Automatic interval adjustment for optimal retention

### 🎯 Deck Management
- Create, edit, and organize multiple decks
- Import/export decks as JSON files
- Manual editing of generated flashcards
- Progress tracking and statistics

### 📈 Learning Analytics
- Real-time progress dashboard
- Accuracy tracking
- Cards learned vs. total cards
- Due cards counter
- Round-based learning system

### 🎨 Modern UI/UX
- Clean, responsive design
- Smooth animations with Framer Motion
- Dark theme optimized for study sessions
- Intuitive navigation and controls

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Anki
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # In the server directory
   echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
   ```

4. **Start the development servers**
   ```bash
   # Start the backend server (from server directory)
   npm start

   # Start the frontend (from client directory)
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173` to use the app

## 🛠️ Tech Stack

### Frontend
- **React 19** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Smooth animations
- **Lucide React** - Beautiful icons

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **OpenAI API** - GPT-powered flashcard generation
- **CORS** - Cross-origin resource sharing

### Data Storage
- **localStorage** - Client-side persistence
- **JSON** - Import/export format

## 📖 How to Use

### Creating a New Deck
1. Click "Create New Deck" on the home screen
2. Enter a deck name
3. Paste your notes in the text area
4. Click "Generate Flashcards"
5. Review and edit cards if needed

### Studying
1. Select a deck from the home screen
2. Click "Continue" or "Review"
3. Click the flashcard to reveal the answer
4. Rate your performance: Again, Hard, Good, or Easy
5. Continue until the round is complete

### Managing Decks
- **Edit**: Modify individual cards in the edit view
- **Export**: Download deck as JSON file
- **Import**: Upload previously exported decks
- **Delete**: Remove decks you no longer need
- **Stats**: View learning progress and analytics

## 🧮 Spaced Repetition Algorithm

The app uses the SuperMemo 2 (SM-2) algorithm:

- **Again**: Interval = 1 day, ease factor decreases
- **Hard**: Interval = previous interval × 1.2, ease factor decreases
- **Good**: Interval = previous interval × ease factor, repetitions increase
- **Easy**: Interval = previous interval × ease factor × 1.3, ease factor increases

## 🔧 API Endpoints

### POST /generate
Generates flashcards from notes using GPT.

**Request Body:**
```json
{
  "notes": "Your study notes here...",
  "difficulty": "beginner|intermediate|advanced",
  "count": 8,
  "format": "qa|fill|definition|mcq"
}
```

**Response:**
```json
{
  "flashcards": [
    {
      "question": "What is...?",
      "answer": "The answer is..."
    }
  ]
}
```

### GET /health
Health check endpoint.

## 🎯 Project Goals

This project demonstrates:
- **AI Integration** - Seamless GPT-powered content generation
- **Full-Stack Development** - React frontend + Node.js backend
- **Modern Web Technologies** - TypeScript, Tailwind, Vite
- **User Experience** - Intuitive, responsive design
- **Learning Science** - Evidence-based spaced repetition
- **Data Management** - Import/export, localStorage persistence

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **SuperMemo** - For the SM-2 spaced repetition algorithm
- **Anki** - For inspiration in flashcard design
- **OpenAI** - For GPT-powered content generation
- **Framer Motion** - For smooth animations
- **Tailwind CSS** - For beautiful, responsive design

---

Built with ❤️ for better learning experiences. 