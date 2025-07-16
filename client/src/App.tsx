import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, 
  ArrowLeftCircle, 
  Trash2, 
  Download, 
  Upload, 
  Edit3, 
  BarChart3, 
  Plus,
  BookOpen,
  Target,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Home,
  Search,
  Settings,
  User,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Star,
  Calendar,
  Zap,
  Brain,
  Award,
  Timer,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  X,
  Save,
  FileText,
  Lightbulb,
  Bookmark,
  Share2,
  LogOut
} from 'lucide-react';
import type { Rating, Deck, Flashcard, View, AuthState } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { apiService } from './services/api';
import { authService } from './services/auth';
import { reviewCard, calculateStats, createFlashcard } from './utils/spacedRepetition';
import AuthContainer from './components/AuthContainer';
import Profile from './components/Profile';

// Constants
const INITIAL_RATINGS: Record<Rating, number> = { again: 0, hard: 0, good: 0, easy: 0 };
const INITIAL_EASE_FACTOR = 2.5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const fakeUser = {
  id: "dev-user",
  email: "dev@example.com",
  username: "devuser",
  is_verified: true,
};

export default function App() {
  // Authentication state
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('auth_token'),
    isAuthenticated: false,
    isLoading: false
  });

  const [notes, setNotes] = useState<string>('');
  const [deckName, setDeckName] = useState<string>('');
  const [decks, setDecks] = useLocalStorage<Deck[]>('decks', []);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');
  const [flipped, setFlipped] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [editingCard, setEditingCard] = useState<{ deckId: string; cardIndex: number } | null>(null);
  const [editForm, setEditForm] = useState<{ question: string; answer: string }>({ question: '', answer: '' });
  // Restore showCreateModal state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [studyMode, setStudyMode] = useState<'learn' | 'review'>('learn');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    return localStorage.getItem('ikna_onboarded') !== 'true';
  });
  const onboardingRef = useRef<HTMLDivElement>(null);
  const [searchValue, setSearchValue] = useState('');

  // Derived state
  const selectedDeck = decks.find((d) => d.id === selectedDeckId) ?? null;
  const flashcards = selectedDeck?.flashcards ?? [];
  const roundOrder = selectedDeck?.roundOrder ?? [];
  const index = selectedDeck?.index ?? 0;
  const currentCard = roundOrder[index] !== undefined ? flashcards[roundOrder[index]] : null;
  const finished = selectedDeck?.finished ?? false;
  const roundFinished = selectedDeck?.roundFinished ?? false;

  // Filter decks based on search
  const filteredDecks = decks.filter(deck => 
    deck.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate statistics
  const getDeckStats = (deck: Deck) => {
    const totalCards = deck.flashcards.length;
    const learnedCards = deck.flashcards.filter(c => c.easy).length;
    const dueCards = deck.flashcards.filter(c => c.dueDate <= Date.now()).length;
    const totalReviews = deck.ratingHistory.length;
    const accuracy = totalReviews > 0 
      ? Math.round(((deck.ratings.good + deck.ratings.easy) / totalReviews) * 100)
      : 0;
    
    return { totalCards, learnedCards, dueCards, totalReviews, accuracy };
  };

  // Subscribe to authentication state changes
  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setAuthState(state);
    });

    return unsubscribe;
  }, []);

  // Reset index when round is finished
  useEffect(() => {
    if (selectedDeck && selectedDeck.index >= selectedDeck.roundOrder.length) {
      setDecks((prev) =>
        prev.map((d) =>
          d.id === selectedDeck.id ? { ...d, index: 0, roundFinished: true } : d
        )
      );
    }
  }, [selectedDeck, setDecks]);

  // Subscribe to authentication state changes
  useEffect(() => {
    const unsubscribe = authService.subscribe((state) => {
      setAuthState(state);
    });

    return unsubscribe;
  }, []);

  // Authentication handlers
  const handleAuthSuccess = () => {
    setView('home');
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      setView('home');
      setDecks([]);
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false
      });
      setView('home');
      setDecks([]);
    }
  };

  // Generate new deck from notes
  const handleGenerate = async () => {
    if (!notes.trim() || !deckName.trim()) {
      setError('Please enter both notes and a deck name.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    // Clear error and success messages after a delay
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 5000);

    try {
      const response = await apiService.generateWithRetry({ notes }, authState.token || undefined);
      
      const newDeck: Deck = {
        id: crypto.randomUUID(),
        name: deckName.trim(),
        flashcards: response.flashcards.map((card: any): Flashcard => ({
          ...card, // Use all fields from the API (question, answer, source, etc.)
          id: crypto.randomUUID(),
          repetitions: 0,
          easeFactor: INITIAL_EASE_FACTOR,
          interval: 0,
          dueDate: Date.now(),
          easy: false,
          createdAt: Date.now(),
          lastReviewed: Date.now(),
        })),
        roundOrder: response.flashcards.map((_: any, idx: number) => idx),
        index: 0,
        round: 1,
        roundFinished: false,
        finished: false,
        ratings: INITIAL_RATINGS,
        ratingHistory: [],
        createdAt: Date.now(),
        lastStudied: Date.now(),
        difficulty: 'beginner',
        format: 'qa',
      };

      setDecks((prev) => [...prev, newDeck]);
      setNotes('');
      setDeckName('');
      setView('home');
      setSuccess('Deck created successfully! 🎉');
    } catch (err: any) {
      setError(err.message || 'Failed to generate flashcards. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle card rating
  const handleRating = (rating: Rating) => {
    if (!selectedDeck || !currentCard) return;

    setDecks((prev) =>
      prev.map((deck) => {
        if (deck.id !== selectedDeck.id) return deck;

        const cardIdx = deck.roundOrder[deck.index];
        if (cardIdx === undefined) return deck;

        if (!deck.flashcards[cardIdx]) return deck;
        const updatedCard = reviewCard(deck.flashcards[cardIdx], rating);
        const updatedFlashcards = [...deck.flashcards];
        updatedFlashcards[cardIdx] = updatedCard;

        const nextIndex = deck.index + 1;
        const finished = updatedFlashcards.every((c) => c.easy);

        return {
          ...deck,
          flashcards: updatedFlashcards,
          index: nextIndex,
          roundFinished: nextIndex >= deck.roundOrder.length,
          finished,
          ratingHistory: [...deck.ratingHistory, rating],
          ratings: {
            ...deck.ratings,
            [rating]: deck.ratings[rating] + 1,
          },
          lastStudied: Date.now(),
        };
      })
    );
    setFlipped(false);
    setShowAnswer(false);
  };

  // Restart deck
  const handleRestart = () => {
    if (!selectedDeckId) return;

    setDecks((prev) =>
      prev.map((deck) =>
        deck.id === selectedDeckId
          ? {
              ...deck,
              index: 0,
              round: 1,
              roundFinished: false,
              roundOrder: deck.flashcards.map((_, idx) => idx),
              flashcards: deck.flashcards.map((c) => ({ ...c, easy: false })),
              finished: false,
              ratings: INITIAL_RATINGS,
              ratingHistory: [],
            }
          : deck
      )
    );
    setFlipped(false);
    setShowAnswer(false);
    setSuccess('Deck restarted successfully! 🔄');
  };

  // Start next round
  const handleNextRound = () => {
    if (!selectedDeckId) return;

    setDecks((prev) =>
      prev.map((deck) => {
        if (deck.id !== selectedDeckId) return deck;
        
        // Get cards that are not easy (not finished)
        const unfinishedCards = deck.flashcards.reduce<number[]>((arr, c, idx) => {
          if (!c.easy) arr.push(idx);
          return arr;
        }, []);
        
        // If all cards are finished, reset them all to unfinished for a new round
        const order = unfinishedCards.length > 0 ? unfinishedCards : deck.flashcards.map((_, idx) => idx);
        
        return {
          ...deck,
          index: 0,
          round: deck.round + 1,
          roundFinished: false,
          roundOrder: order,
          // Reset all cards to unfinished if they were all finished
          flashcards: unfinishedCards.length === 0 ? deck.flashcards.map(c => ({ ...c, easy: false })) : deck.flashcards,
          finished: false,
        };
      })
    );
    setFlipped(false);
    setShowAnswer(false);
  };

  // Delete deck
  const handleDeleteDeck = (id: string) => {
    setDecks((prev) => prev.filter((deck) => deck.id !== id));
    if (selectedDeckId === id) {
      setSelectedDeckId(null);
      setView('home');
    }
    setSuccess('Deck deleted successfully! 🗑️');
  };

  // Export deck
  const handleExportDeck = (deck: Deck) => {
    const dataStr = JSON.stringify(deck, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${deck.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSuccess('Deck exported successfully! 📤');
  };

  // Import deck
  const handleImportDeck = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const deck = JSON.parse(e.target?.result as string);
        setDecks((prev) => [...prev, deck]);
        setSuccess('Deck imported successfully! 📥');
      } catch (error) {
        setError('Invalid deck file. Please try again.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Edit card
  const handleEditCard = (deckId: string, cardIndex: number) => {
    const deck = decks.find(d => d.id === deckId);
    if (!deck || !deck.flashcards[cardIndex]) return;
    
    const card = deck.flashcards[cardIndex];
    setEditingCard({ deckId, cardIndex });
    setEditForm({ question: card.question, answer: card.answer });
  };

  // Save edit
  const handleSaveEdit = () => {
    if (!editingCard) return;

    setDecks((prev) =>
      prev.map((deck) => {
        if (deck.id !== editingCard.deckId) return deck;
        const updatedFlashcards = [...deck.flashcards];
        const existingCard = updatedFlashcards[editingCard.cardIndex];
        if (existingCard) {
          updatedFlashcards[editingCard.cardIndex] = {
            ...existingCard,
            question: editForm.question,
            answer: editForm.answer,
          };
        }
        return { ...deck, flashcards: updatedFlashcards };
      })
    );

    setEditingCard(null);
    setEditForm({ question: '', answer: '' });
    setSuccess('Card updated successfully! ✏️');
  };

  // Navigation
  const goHome = () => {
    setView('home');
    setSelectedDeckId(null);
    setFlipped(false);
    setShowAnswer(false);
  };

  const startStudy = (deckId: string) => {
    setSelectedDeckId(deckId);
    setView('study');
    setFlipped(false);
    setShowAnswer(false);
  };

  const viewStats = (deckId: string) => {
    setSelectedDeckId(deckId);
    setView('stats');
  };

  // Clear messages after 3 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const handleImportSampleDeck = () => {
    const sampleDeck: Deck = {
      id: crypto.randomUUID(),
      name: 'Sample: World Capitals',
      flashcards: [
        { id: crypto.randomUUID(), question: 'What is the capital of France?', answer: 'Paris', repetitions: 0, easeFactor: 2.5, interval: 0, dueDate: Date.now(), easy: false, createdAt: Date.now() },
        { id: crypto.randomUUID(), question: 'What is the capital of Japan?', answer: 'Tokyo', repetitions: 0, easeFactor: 2.5, interval: 0, dueDate: Date.now(), easy: false, createdAt: Date.now() },
        { id: crypto.randomUUID(), question: 'What is the capital of Brazil?', answer: 'Brasília', repetitions: 0, easeFactor: 2.5, interval: 0, dueDate: Date.now(), easy: false, createdAt: Date.now() },
      ],
      roundOrder: [0, 1, 2],
      index: 0,
      round: 1,
      roundFinished: false,
      finished: false,
      ratings: { again: 0, hard: 0, good: 0, easy: 0 },
      ratingHistory: [],
      createdAt: Date.now(),
      lastStudied: Date.now(),
      difficulty: 'beginner',
      format: 'qa',
    };
    setDecks((prev) => [...prev, sampleDeck]);
    setSuccess('Sample deck imported!');
  };

  // Prevent scrolling on flashcard (study) screen
  useEffect(() => {
    if (view === 'study') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [view]);

  return (
    <div className="min-h-screen text-text-primary font-sans p-2 sm:p-4 md:p-6 overflow-x-hidden pb-[100px]" style={{ background: 'linear-gradient(135deg, #1C1F2E 0%, #12131C 100%)' }}>
      {/* Sticky Top Bar */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="sticky top-0 z-50 bg-surface/95 backdrop-blur-md shadow-xl"
      >
        <div className="flex items-center justify-between h-20 mx-5 relative">
          <div className="flex items-center space-x-4">
            <img src="/dist/assets/logo.png" alt="Logo" className="h-[100px] w-[100px] object-contain ml-[40px]" />
          </div>
          
          {/* Authentication Status */}
          {authState.isAuthenticated && (
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setView('profile')}
                className="btn-ghost p-2 rounded-lg hover:bg-surface/50 transition-colors mr-5"
                title="Profile"
                aria-label="Open profile"
              >
                <User className="h-5 w-5" />
              </button>
            </div>
          )}
          
        </div>
      </motion.header>

      {/* Main Content Wrapper with 20px margins */}
      <div className="mx-5">
        <main className="py-8" role="main">
        <AnimatePresence mode="wait">
          {/* Loading State */}
          {authState.isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center min-h-[60vh]"
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-text-secondary">Loading...</p>
              </div>
            </motion.div>
          )}

          {/* Authentication Views */}
          {!authState.isAuthenticated && !authState.isLoading && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AuthContainer onAuthSuccess={handleAuthSuccess} />
            </motion.div>
          )}

          {/* Profile View */}
          {authState.isAuthenticated && view === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Profile onLogout={handleLogout} onBack={() => setView('home')} />
            </motion.div>
          )}

          {/* Main App Views (only show when authenticated) */}
          {authState.isAuthenticated && view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              {/* Contextual Header */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-center space-y-2"
              >
                {decks.length === 0 ? (
                  <>
                    <h2 className="text-3xl md:text-4xl font-bold gradient-text mb-1">Let's get started!</h2>
                    <p className="text-text-secondary text-lg max-w-2xl mx-auto">Create your first deck or try a sample to see how IKNA works.</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-3xl md:text-4xl font-bold gradient-text mb-1">Welcome, {authState.user?.username || 'User'}!</h2>
                    <p className="text-text-secondary text-lg max-w-2xl mx-auto">Keep up the great work! Review your stats and keep learning.</p>
                  </>
                )}
              </motion.div>

                {/* Create Deck Form */}
              <motion.div
                  key="create-deck-form"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-[1300px] mx-auto mb-10 p-2 sm:p-4 md:p-6 rounded-2xl"
                >
                  <div className="card p-8 rounded-xl shadow-2xl border border-border/50 bg-surface px-4">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold">Create New Deck</h2>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium mb-2 my-[10px]">Deck Name</label>
                        <input
                          type="text"
                          value={deckName}
                          onChange={(e) => setDeckName(e.target.value)}
                          placeholder="Enter deck name..."
                          className="input-field w-[1200px]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 my-[10px]">Notes</label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Paste your notes here to generate flashcards..."
                          rows={8}
                          className="input-field resize-none w-[1200px]"
                        />
                      </div>
                      <div className="flex items-center justify-end">
                        <button
                          onClick={handleGenerate}
                          disabled={loading || !notes.trim() || !deckName.trim()}
                          className="btn-primary flex items-center space-x-2 mt-[30px]"
                        >
                          {loading ? (
                            <>
                              <div className="loading-spinner" />
                              <span>Generating...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              <span>Generate Flashcards</span>
                            </>
                          )}
                        </button>
                  </div>
                    </div>
                  </div>
              </motion.div>

              {/* Decks Grid or Motivational Empty State */}
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-2xl md:text-3xl font-bold ml-[30px]">Decks</h3>
                    <label htmlFor="import-deck" className="flex items-center space-x-2 text-base font-semibold cursor-pointer mr-[15px]" aria-label="Import deck">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportDeck}
                      className="hidden"
                      id="import-deck"
                    />
                    <Upload className="h-4 w-4" />
                    <span>Import</span>
                  </label>
                </div>

                  <div className="max-w-6xl mx-auto w-full px-6">
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: {},
                      visible: { transition: { staggerChildren: 0.08 } },
                    }}
                      className="flex flex-wrap justify-evenly gap-6 gap-y-[40px] p-2 sm:p-4 md:p-6 mb-10 w-full"
                  >
                    {filteredDecks.map((deck) => {
                      const stats = getDeckStats(deck);
                      return (
                        <motion.div
                          key={deck.id}
                          variants={{
                            hidden: { opacity: 0, y: 20 },
                            visible: { opacity: 1, y: 0 },
                          }}
                            className="card rounded-xl shadow-lg bg-surface border border-border flex flex-col justify-between transition-all duration-200 h-[150px] p-4 w-[375px]"
                        >
                            <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                                <h4 className="text-lg font-semibold mb-1 truncate mb-[10px]">{deck.name}</h4>
                                <div className="flex items-center space-x-3 text-xs text-text-secondary mb-[10px]">
                                <span>{stats.totalCards} cards</span>
                                <span>•</span>
                                <span>{stats.learnedCards} learned</span>
                                <span>•</span>
                                <span>{stats.dueCards} due</span>
                              </div>
                            </div>
                              <div className="flex items-center space-x-1">
                              <motion.button
                                onClick={() => viewStats(deck.id)}
                                  className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
                              >
                                <BarChart3 className="h-4 w-4" />
                              </motion.button>
                              <motion.button
                                onClick={() => handleDeleteDeck(deck.id)}
                                  className="p-1.5 text-text-secondary hover:text-error transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </motion.button>
                            </div>
                          </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-text-secondary mb-[10px]">Progress</span>
                              <span className="font-medium">{stats.accuracy}%</span>
                            </div>
                              <div className="w-full bg-border rounded-full h-1.5">
                              <div
                                  className="bg-primary h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${stats.accuracy}%` }}
                              />
                            </div>
                            <div className="flex space-x-2">
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => startStudy(deck.id)}
                                  className="btn-primary flex-1 flex items-center justify-center space-x-1 text-sm py-2"
                                  aria-label="Study deck"
                              >
                                  <Play className="h-3 w-3" />
                                <span>Study</span>
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => handleExportDeck(deck)}
                                  className="btn-ghost p-1.5"
                                  aria-label="Export deck"
                              >
                                  <Download className="h-3 w-3" />
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                  </div>
              </div>

              {/* Small Stats Section */}
              {decks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-8"
                >
                  <h3 className="text-2xl md:text-3xl font-bold mb-4 text-center">Progress Overview</h3>
                  <div className="flex flex-wrap justify-evenly gap-6">
                    <div className="card text-center py-3 px-2 rounded-lg shadow-sm bg-gradient-to-br from-primary/20 to-surface border border-primary flex flex-col items-center justify-center px-4 w-[200px] h-[100px]">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <div className="text-lg font-bold mt-1 my-[9px]">{decks.length}</div>
                      <div className="text-text-secondary text-xs">Decks</div>
                    </div>
                    <div className="card text-center py-3 px-2 rounded-lg shadow-sm bg-gradient-to-br from-success/20 to-surface border border-success flex flex-col items-center justify-center px-4 w-[200px] h-[100px]">
                      <Target className="h-5 w-5 text-success" />
                      <div className="text-2xl font-extrabold mt-1 my-[9px]">{decks.reduce((acc, deck) => acc + deck.flashcards.length, 0)}</div>
                      <div className="text-text-secondary text-xs">Cards</div>
                    </div>
                    <div className="card text-center py-3 px-2 rounded-lg shadow-sm bg-gradient-to-br from-secondary/20 to-surface border border-secondary flex flex-col items-center justify-center px-4 w-[200px] h-[100px]">
                      <TrendingUp className="h-5 w-5 text-secondary" />
                      <div className="text-2xl font-extrabold mt-1 my-[9px]">{decks.reduce((acc, deck) => acc + deck.ratingHistory.length, 0)}</div>
                      <div className="text-text-secondary text-xs">Reviews</div>
                    </div>
                    <div className="card text-center py-3 px-2 rounded-lg shadow-sm bg-gradient-to-br from-yellow-400/20 to-surface border border-yellow-400 flex flex-col items-center justify-center px-4 w-[200px] h-[100px]">
                      <Award className="h-5 w-5 text-yellow-400" />
                      <div className="text-2xl font-extrabold mt-1 my-[9px]">
                        {decks.length > 0 ?
                          Math.round(decks.reduce((acc, deck) => {
                            const stats = getDeckStats(deck);
                            return acc + stats.accuracy;
                          }, 0) / decks.length) : 0
                        }%
                      </div>
                      <div className="text-text-secondary text-xs">Accuracy</div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Onboarding Tooltip/Modal */}
              <AnimatePresence>
                {showOnboarding && (
                  <motion.div
                    ref={onboardingRef}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed bottom-8 right-8 bg-surface border border-primary rounded-xl shadow-2xl p-6 max-w-xs z-50"
                  >
                    <div className="flex items-center mb-3">
                      <Sparkles className="h-6 w-6 text-primary mr-2" />
                      <span className="font-bold text-lg">Welcome to IKNA!</span>
                    </div>
                    <ol className="list-decimal list-inside text-text-secondary text-sm mb-4 space-y-1">
                      <li>Create or import your first deck</li>
                      <li>Start studying and rate your answers</li>
                      <li>Track your progress and keep learning!</li>
                    </ol>
                    <button
                      className="btn-primary w-full mt-2"
                      onClick={() => {
                        setShowOnboarding(false);
                        localStorage.setItem('ikna_onboarded', 'true');
                      }}
                      aria-label="Close onboarding modal"
                    >
                      Got it!
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}



          {authState.isAuthenticated && view === 'study' && selectedDeck && (
            <motion.div
              key="study"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="mx-2.5"
            >
              {/* Study Header */}
              <div className="flex flex-col items-center justify-center mb-8 w-full max-w-2xl mx-auto">
                <button
                  onClick={goHome}
                  className="btn-ghost flex items-center space-x-2 self-start ml-[30px] border border-gray-200 rounded-xl shadow-md shadow-gray-200/40 mt-[100px]"
                  style={{ boxShadow: '0 2px 12px 0 rgba(180,180,180,0.13)' }}
                >
                  <ArrowLeftCircle className="h-5 w-5" />
                  <span>Back to Decks</span>
                </button>
                <div className="text-center w-full -mt-5 pb-5">
                  <h2 className="text-2xl font-bold mb-2">{selectedDeck.name}</h2>
                  <div className="flex flex-col items-center justify-center text-text-secondary">
                    <span className="text-lg font-semibold">Card {index + 1} of {roundOrder.length} &middot; Round {selectedDeck.round}</span>
                  </div>
                </div>
              </div>
              {/* Removed progress label and percent as requested */}
              <div className="mb-8">
                <div className="w-full bg-border rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((index + 1) / roundOrder.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Round Finished Overlay */}
              {roundFinished && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
                  style={{ backdropFilter: 'blur(2px)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                >
                  <div className="card w-full max-w-2xl mx-4 flex flex-col items-center justify-center text-center p-16 rounded-3xl shadow-2xl bg-surface" style={{ transform: 'translate(-50%, -50%)', position: 'absolute', top: '50%', left: '50%' }}>
                    <Award className="h-20 w-20 text-yellow-400 mx-auto mb-6" />
                    <h3 className="text-4xl font-bold mb-4">Round Complete!</h3>
                    <p className="text-text-secondary mb-6">Great job! You've completed this round of study.</p>
                    <div className="flex items-center justify-center space-x-3 mt-8 w-full">
                      <button
                        onClick={handleNextRound}
                        className="btn-primary flex items-center space-x-2 px-8 py-3 text-xl rounded-xl mx-auto"
                      >
                        <SkipForward className="h-5 w-5" />
                        <span>Next Round</span>
                      </button>
                      <button
                        onClick={handleRestart}
                        className="btn-ghost flex items-center space-x-2 px-8 py-3 text-xl rounded-xl mx-auto"
                      >
                        <RotateCcw className="h-5 w-5" />
                        <span>Restart</span>
                      </button>
                      <button
                        onClick={goHome}
                        className="btn-ghost flex items-center space-x-2 px-8 py-3 text-xl rounded-xl mx-auto"
                      >
                        <Home className="h-5 w-5" />
                        <span>Return Home</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Card */}
              {!roundFinished && currentCard ? (
                <div className="space-y-6">
                  <motion.div
                    className="card min-h-[400px] flex flex-col justify-center items-center text-center p-8"
                    layout
                  >
                    <div className="w-full max-w-2xl">
                      <div className="mb-8">
                        <h3 className="text-xl font-semibold mb-4">Question</h3>
                        <p className="text-lg leading-relaxed mb-[30px]">{currentCard.question}</p>
                        {currentCard.source && (
                          <div className="text-xs text-text-secondary mt-2 italic">
                            Source: {currentCard.source}
                          </div>
                        )}
                      </div>
                      <AnimatePresence>
                        {showAnswer && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-t border-border pt-6"
                          >
                            <h4 className="text-xl font-semibold mb-4">Answer</h4>
                            <p className="text-lg leading-relaxed">{currentCard.answer}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>

                  {/* Study Controls */}
                  <div className="flex items-center justify-center space-x-4 mt-[13px]">
                    {!showAnswer ? (
                      <button
                        onClick={() => setShowAnswer(true)}
                        className="btn-primary flex items-center space-x-2"
                        aria-label="Show answer"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Show Answer</span>
                      </button>
                    ) : (
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => handleRating('again')}
                          className="btn-danger flex items-center space-x-2"
                          aria-label="Rate Again"
                        >
                          <AlertCircle className="h-4 w-4" />
                          <span>Again</span>
                        </button>
                        <button
                          onClick={() => handleRating('hard')}
                          className="btn-secondary flex items-center space-x-2"
                          aria-label="Rate Hard"
                        >
                          <Clock className="h-4 w-4" />
                          <span>Hard</span>
                        </button>
                        <button
                          onClick={() => handleRating('good')}
                          className="btn-primary flex items-center space-x-2"
                          aria-label="Rate Good"
                        >
                          <CheckCircle className="h-4 w-4" />
                          <span>Good</span>
                        </button>
                        <button
                          onClick={() => handleRating('easy')}
                          className="btn-success flex items-center space-x-2"
                          aria-label="Rate Easy"
                        >
                          <Star className="h-4 w-4" />
                          <span>Easy</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}

          {authState.isAuthenticated && view === 'stats' && selectedDeck && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mx-2.5"
            >
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={goHome}
                  className="btn-ghost flex items-center space-x-2"
                >
                  <ArrowLeftCircle className="h-5 w-5" />
                  <span>Back to Decks</span>
                </button>
                <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">{selectedDeck.name} - Statistics</h2>
                <p className="text-text-secondary">Track your learning progress</p>
                </div>
                <div className="w-32"></div> {/* Spacer for centering */}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {(() => {
                  const stats = getDeckStats(selectedDeck);
                  return (
                    <>
                      <div className="card text-center px-4">
                        <Target className="h-8 w-8 text-primary mx-auto mb-2" />
                        <h3 className="text-2xl font-bold">{stats.totalCards}</h3>
                        <p className="text-text-secondary">Total Cards</p>
                      </div>
                      <div className="card text-center px-4">
                        <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
                        <h3 className="text-2xl font-bold">{stats.learnedCards}</h3>
                        <p className="text-text-secondary">Learned</p>
                      </div>
                      <div className="card text-center px-4">
                        <Clock className="h-8 w-8 text-secondary mx-auto mb-2" />
                        <h3 className="text-2xl font-bold">{stats.dueCards}</h3>
                        <p className="text-text-secondary">Due Today</p>
                      </div>
                      <div className="card text-center px-4">
                        <TrendingUp className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
                        <h3 className="text-2xl font-bold">{stats.accuracy}%</h3>
                        <p className="text-text-secondary">Accuracy</p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Rating Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(selectedDeck.ratings).map(([rating, count]) => (
                    <div key={rating} className="flex items-center justify-between">
                      <span className="capitalize">{rating}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-border rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full"
                            style={{ 
                              width: `${selectedDeck.ratingHistory.length > 0 
                                ? (count / selectedDeck.ratingHistory.length) * 100 
                                : 0}%` 
                            }}
                          />
                        </div>
                        <span className="text-sm text-text-secondary w-8 text-right">
                          {count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
              </div>

      {/* Edit Card Modal */}
      <AnimatePresence>
        {editingCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setEditingCard(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card max-w-2xl w-full rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Edit Card</h2>
                <button
                  onClick={() => setEditingCard(null)}
                  className="p-2 text-text-secondary hover:text-text-primary transition-colors"
                  aria-label="Close edit card modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Question</label>
                  <textarea
                    value={editForm.question}
                    onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                    rows={3}
                    className="input-field w-full resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Answer</label>
                  <textarea
                    value={editForm.answer}
                    onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                    rows={3}
                    className="input-field w-full resize-none"
                  />
                </div>

                <div className="flex items-center justify-end space-x-4">
                  <button
                    onClick={() => setEditingCard(null)}
                    className="btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editForm.question.trim() || !editForm.answer.trim()}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 right-4 bg-error text-white px-6 py-3 rounded-lg shadow-lg z-50"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 right-4 bg-success text-white px-6 py-3 rounded-lg shadow-lg z-50"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span>{success}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}