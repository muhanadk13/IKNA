import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, RefreshCw, ArrowLeftCircle } from 'lucide-react';
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
}

interface Deck {
  id: string;
  name: string;
  flashcards: Flashcard[];
  index: number;
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
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) ?? null;
  const flashcards = selectedDeck?.flashcards ?? [];
  const index = selectedDeck?.index ?? 0;
  const currentCard = flashcards[index] ?? null;
  const finished = selectedDeck?.finished ?? false;
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
        })),
        index: 0,
        finished: false,
        ratings: { again: 0, hard: 0, good: 0, easy: 0 },
        ratingHistory: [],
      };

      setDecks((prev) => [...prev, newDeck]);
      setSelectedDeckId(newDeck.id);
      setNotes('');
      setDeckName('');
      setFlipped(false);
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

      const updatedCard = reviewCard(currentCard, rating);
      const updatedFlashcards = [...deck.flashcards];
      updatedFlashcards[deck.index] = updatedCard;

      return {
        ...deck,
        flashcards: updatedFlashcards,
        index: deck.index + 1,
        finished: deck.index + 1 >= deck.flashcards.length,
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
            finished: false,
            ratings: { again: 0, hard: 0, good: 0, easy: 0 },
            ratingHistory: [],
          }
        : deck
    );

    setDecks(resetDecks);
    setFlipped(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-white to-indigo-100 p-8 font-sans text-gray-800 transition-all">
      <div className="max-w-3xl mx-auto space-y-12 animate-fade-in">
        <h1 className="text-6xl font-black text-center mb-8 text-indigo-700 tracking-tight">📚 IKNA</h1>

        {error && <p className="text-red-500 text-center animate-pulse text-lg font-semibold">{error}</p>}

        {!selectedDeck && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              {decks.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold mb-4">Your Decks</h2>
                  <ul className="space-y-4">
                    {decks.map((deck) => (
                      <li key={deck.id} className="flex justify-between items-center p-4 bg-white rounded shadow">
                        <span className="text-lg font-medium">
                          {deck.name} — {deck.finished ? '✅ Completed' : `📄 Card ${deck.index + 1} of ${deck.flashcards.length}`}
                        </span>
                        <button
                          className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600"
                          onClick={() => setSelectedDeckId(deck.id)}
                        >
                          {deck.finished ? 'Review' : 'Continue'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h2 className="text-2xl font-bold mb-4">Create New Deck</h2>
                <input
                  type="text"
                  placeholder="Deck name"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  className="border p-3 w-full mb-4 rounded shadow-sm text-lg"
                />
                <textarea
                  rows={10}
                  placeholder="Paste your notes here..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border p-3 w-full mb-4 rounded shadow-sm text-lg"
                />
                <button
                  onClick={handleGenerate}
                  disabled={loading || !notes.trim() || !deckName.trim()}
                  className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 disabled:opacity-50 text-lg font-semibold"
                >
                  {loading ? 'Generating...' : 'Generate Flashcards'}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {selectedDeck && !finished && currentCard && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div
              onClick={() => setFlipped(!flipped)}
              className="bg-white border rounded-xl p-8 shadow-xl text-center text-2xl font-medium cursor-pointer hover:shadow-2xl transition duration-300 hover:scale-[1.02] min-h-[150px] flex items-center justify-center"
            >
              {flipped ? currentCard.answer : currentCard.question}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(['again', 'hard', 'good', 'easy'] as Rating[]).map((rating) => (
                <button
                  key={rating}
                  onClick={() => handleRating(rating)}
                  className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 py-3 rounded text-lg font-semibold shadow"
                >
                  {rating.charAt(0).toUpperCase() + rating.slice(1)}
                </button>
              ))}
            </div>

            <p className="text-center text-base text-gray-600">
              Card {index + 1} of {flashcards.length}
            </p>
          </motion.div>
        )}

        {selectedDeck && finished && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-center text-green-700 flex items-center justify-center gap-2">
              <CheckCircle className="w-6 h-6" /> Review Complete
            </h2>
            <ul className="list-disc list-inside space-y-1 text-lg">
              {ratingHistory.map((r, i) => (
                <li key={i}>
                  Card {i + 1}: {r.charAt(0).toUpperCase() + r.slice(1)}
                </li>
              ))}
            </ul>
            <p className="text-center text-lg">
              Again: {ratings.again} | Hard: {ratings.hard} | Good: {ratings.good} | Easy: {ratings.easy}
            </p>
            <div className="flex justify-center gap-6">
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 bg-yellow-500 text-white px-5 py-3 rounded hover:bg-yellow-600 text-lg"
              >
                <RefreshCw className="w-5 h-5" /> Restart
              </button>
              <button
                onClick={() => setSelectedDeckId(null)}
                className="flex items-center gap-2 bg-gray-300 px-5 py-3 rounded hover:bg-gray-400 text-lg"
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
