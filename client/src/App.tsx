import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, RefreshCw, ArrowLeftCircle, Trash2 } from 'lucide-react';
import './App.css';

// Types

type Rating = 'again' | 'hard' | 'good' | 'easy';

interface Flashcard {
  question: string;
  answer: string;
  repetitions: number;
  easeFactor: number;
  interval: number;
  dueDate: number;
  easy: boolean;
}

interface Deck {
  id: string;
  name: string;
  flashcards: Flashcard[];
  index: number;
  round: number;
  roundFinished: boolean;
  finished: boolean;
  ratings: Record<Rating, number>;
  ratingHistory: Rating[];
}

export default function App() {
  const [notes, setNotes] = useState('');
  const [deckName, setDeckName] = useState('');
  const [decks, setDecks] = useState<Deck[]>(() => {
    try {
      const saved = localStorage.getItem('decks');
      const parsed = saved ? JSON.parse(saved) : [];
      return parsed.map((d: any) => ({
        ...d,
        round: d.round ?? 1,
        roundFinished: false,
        flashcards: d.flashcards.map((c: any) => ({ ...c, easy: c.easy ?? false })),
      }));
    } catch {
      return [];
    }
  });

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'form'>('home');
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) ?? null;
  const flashcards = selectedDeck?.flashcards ?? [];
  const activeCards = flashcards.filter((c) => !c.easy);
  const index = selectedDeck?.index ?? 0;
  const currentCard = activeCards[index] ?? null;
  const finished = selectedDeck?.finished ?? false;
  const roundFinished = selectedDeck?.roundFinished ?? false;
  const ratings = selectedDeck?.ratings ?? { again: 0, hard: 0, good: 0, easy: 0 };
  const ratingHistory = selectedDeck?.ratingHistory ?? [];

  useEffect(() => {
    localStorage.setItem('decks', JSON.stringify(decks));
  }, [decks]);

  const reviewCard = (card: Flashcard, rating: Rating): Flashcard => {
    const updated = { ...card };

    if (rating === 'again') {
      updated.interval = 1;
      updated.repetitions = 0;
      updated.easeFactor = Math.max(1.3, updated.easeFactor - 0.2);
    } else if (rating === 'hard') {
      updated.interval = Math.max(1, Math.round(updated.interval * 1.2));
      updated.easeFactor = Math.max(1.3, updated.easeFactor - 0.15);
    } else if (rating === 'good') {
      updated.repetitions += 1;
      updated.interval = Math.max(1, Math.round(updated.interval * updated.easeFactor));
    } else if (rating === 'easy') {
      updated.repetitions += 1;
      updated.easeFactor += 0.15;
      updated.interval = Math.max(
        1,
        Math.round(updated.interval * updated.easeFactor * 1.3)
      );
    }

    updated.dueDate = Date.now() + updated.interval * 24 * 60 * 60 * 1000;
    return updated;
  };

  const handleGenerate = async () => {
    if (!notes.trim() || !deckName.trim()) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:4000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      const data = await response.json();

      if (!response.ok || !data.flashcards) {
        throw new Error(data.error || 'Failed to generate flashcards.');
      }

      const newDeck: Deck = {
        id: Date.now().toString(),
        name: deckName.trim(),
        flashcards: data.flashcards.map((card: { question: string; answer: string }) => ({
          ...card,
          repetitions: 0,
          easeFactor: 2.5,
          interval: 0,
          dueDate: Date.now(),
          easy: false,
        })),
        index: 0,
        round: 1,
        roundFinished: false,
        finished: false,
        ratings: { again: 0, hard: 0, good: 0, easy: 0 },
        ratingHistory: [],
      };

      setDecks((prev) => [...prev, newDeck]);
      setNotes('');
      setDeckName('');
      setFlipped(false);
      setView('home');
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleRating = (rating: Rating) => {
    if (!selectedDeck || !currentCard) return;

    const updatedDecks = decks.map((deck) => {
      if (deck.id !== selectedDeck.id) return deck;

      const activeCards = deck.flashcards.filter((c) => !c.easy);
      const activeCard = activeCards[deck.index];
      const cardIdx = deck.flashcards.findIndex((c) => c === activeCard);

      const updatedCard = reviewCard(activeCard, rating);
      if (rating === 'easy') {
        updatedCard.easy = true;
      }

      const updatedFlashcards = [...deck.flashcards];
      updatedFlashcards[cardIdx] = updatedCard;

      const remaining = updatedFlashcards.filter((c) => !c.easy);
      const nextIndex = deck.index + 1;

      return {
        ...deck,
        flashcards: updatedFlashcards,
        index: nextIndex,
        roundFinished: nextIndex >= remaining.length,
        finished: remaining.length === 0,
        ratingHistory: [...deck.ratingHistory, rating],
        ratings: {
          ...deck.ratings,
          [rating]: deck.ratings[rating] + 1,
        },
      };
    });

    setDecks(updatedDecks);
    setFlipped(false);
  };

  const handleRestart = () => {
    if (!selectedDeckId) return;

    const resetDecks = decks.map((deck) =>
      deck.id === selectedDeckId
        ? {
            ...deck,
            index: 0,
            round: 1,
            roundFinished: false,
            flashcards: deck.flashcards.map((c) => ({ ...c, easy: false })),
            finished: false,
            ratings: { again: 0, hard: 0, good: 0, easy: 0 },
            ratingHistory: [],
          }
        : deck
    );

    setDecks(resetDecks);
    setFlipped(false);
  };

  const handleNextRound = () => {
    if (!selectedDeckId) return;
    const next = decks.map((deck) =>
      deck.id === selectedDeckId
        ? { ...deck, round: deck.round + 1, roundFinished: false, index: 0 }
        : deck
    );
    setDecks(next);
    setFlipped(false);
  };

  const handleDeleteDeck = (id: string) => {
    const filtered = decks.filter((d) => d.id !== id);
    setDecks(filtered);
    if (selectedDeckId === id) {
      setSelectedDeckId(null);
    }
  };

  useEffect(() => {
    if (!selectedDeck) return;
    const remaining = selectedDeck.flashcards.filter((c) => !c.easy);
    if (remaining.length && selectedDeck.index >= remaining.length) {
      setDecks((prev) =>
        prev.map((d) =>
          d.id === selectedDeck.id
            ? { ...d, index: 0, roundFinished: false }
            : d
        )
      );
    }
  }, [selectedDeckId]);
  return (
    <div className="min-h-screen bg-zinc-900 text-white px-6 py-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-16">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-5xl font-extrabold text-center">📚 IKNA</h1>
          <p className="text-sm text-gray-400 font-medium tracking-wide">Intelligent Knowledge with Neural Assistance</p>
        </div>
  
        {error && <p className="text-red-400 text-center text-lg animate-pulse">{error}</p>}
  
        {!selectedDeck && view === 'home' && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <div className="flex justify-start">
                <button
                  onClick={() => setView('form')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded"
                >
                  Enter Notes
                </button>
              </div>
              <h2 className="text-2xl font-bold">Your Decks</h2>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
                {decks.map((deck) => {
                  const remaining = deck.flashcards.filter((c) => !c.easy).length;
                  return (
                    <div
                      key={deck.id}
                      className="bg-white text-black rounded shadow p-6 flex flex-col justify-between w-[300px] h-[300px]"
                    >
                      <div>
                        <h3 className="text-xl font-semibold">{deck.name}</h3>
                        <p className="text-sm mt-1">
                          {deck.finished ? '✅ Completed' : `Round ${deck.round} — ${remaining} left`}
                        </p>
                      </div>
                      <div className="flex justify-between items-center mt-4">
                        <button
                          className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded"
                          onClick={() => setSelectedDeckId(deck.id)}
                        >
                          {deck.finished ? 'Review' : 'Continue'}
                        </button>
                        <button
                          onClick={() => handleDeleteDeck(deck.id)}
                          className="text-red-600 flex items-center gap-1"
                        >
                          <Trash2 className="w-5 h-5" /> Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {!selectedDeck && view === 'form' && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <div className="flex justify-start">
                <button
                  onClick={() => setView('home')}
                  className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded"
                >
                  Back
                </button>
              </div>
              <h2 className="text-2xl font-bold">Create New Deck</h2>
              <div className="flex flex-col space-y-4">
                <input
                  type="text"
                  placeholder="Deck name"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  className="bg-zinc-800 p-3 rounded border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <textarea
                  rows={8}
                  placeholder="Paste your notes here..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-zinc-800 p-3 rounded border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleGenerate}
                  disabled={loading || !notes.trim() || !deckName.trim()}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded"
                >
                  {loading ? 'Generating...' : 'Generate Flashcards'}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
  
        {/* Review View */}
        {selectedDeck && !finished && !roundFinished && currentCard && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            <h2 className="text-center text-xl font-bold">Round {selectedDeck.round}</h2>
            <div
              onClick={() => setFlipped(!flipped)}
              className="bg-zinc-800 p-10 rounded-lg shadow-lg text-2xl leading-relaxed font-medium text-center cursor-pointer hover:scale-[1.02] transition min-h-[160px] flex items-center justify-center"
            >
              {flipped ? currentCard.answer : currentCard.question}
            </div>
  
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(['again', 'hard', 'good', 'easy'] as Rating[]).map((rating) => (
                <button
                  key={rating}
                  onClick={() => handleRating(rating)}
                  className="bg-indigo-700 hover:bg-indigo-600 py-3 rounded text-white text-lg font-semibold"
                >
                  {rating.charAt(0).toUpperCase() + rating.slice(1)}
                </button>
              ))}
            </div>
  
            <p className="text-center text-sm text-gray-400">
              Card {index + 1} of {activeCards.length}
            </p>
          </motion.div>
        )}
  
        {/* Round Recap */}
        {selectedDeck && roundFinished && !finished && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            <h2 className="text-2xl font-bold text-center">
              Round {selectedDeck.round} Complete
            </h2>
            <p className="text-center text-md text-gray-300">
              Cards remaining: {selectedDeck.flashcards.filter((c) => !c.easy).length}
            </p>
            <div className="flex justify-center">
              <button
                onClick={handleNextRound}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded text-lg"
              >
                Next Round
              </button>
            </div>
          </motion.div>
        )}

        {/* Completion View */}
        {selectedDeck && finished && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            <h2 className="text-2xl font-bold text-center text-green-500 flex items-center justify-center gap-2">
              <CheckCircle className="w-6 h-6" /> Review Complete
            </h2>
  
            <div className="bg-zinc-800 p-6 rounded-lg shadow space-y-2">
              {ratingHistory.map((r, i) => (
                <div key={i} className="text-lg">
                  <span className="text-gray-400">Card {i + 1}:</span> {r.charAt(0).toUpperCase() + r.slice(1)}
                </div>
              ))}
            </div>
  
            <p className="text-center text-md text-gray-300">
              Again: {ratings.again} | Hard: {ratings.hard} | Good: {ratings.good} | Easy: {ratings.easy}
            </p>
  
            <div className="flex justify-center gap-4">
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-white px-5 py-3 rounded text-lg"
              >
                <RefreshCw className="w-5 h-5" /> Restart
              </button>
              <button
                onClick={() => setSelectedDeckId(null)}
                className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 px-5 py-3 rounded text-white text-lg"
              >
                <ArrowLeftCircle className="w-5 h-5" /> Back to Decks
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
  
  
}
