import { useState, useEffect } from 'react';

type Rating = 'again' | 'hard' | 'good' | 'easy';

type Flashcard = {
  question: string;
  answer: string;
  repetitions: number;
  easeFactor: number;
  interval: number;
  dueDate: number;
};

type Deck = {
  id: string;
  name: string;
  flashcards: Flashcard[];
  index: number;
  finished: boolean;
  ratings: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
  ratingHistory: Rating[];
};

function App() {
  const [notes, setNotes] = useState('');
  const [deckName, setDeckName] = useState('');
  const [decks, setDecks] = useState<Deck[]>(() => {
    const saved = localStorage.getItem('decks');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) || null;
  const flashcards = selectedDeck ? selectedDeck.flashcards : [];
  const index = selectedDeck ? selectedDeck.index : 0;
  const finished = selectedDeck ? selectedDeck.finished : false;
  const ratings = selectedDeck ? selectedDeck.ratings : { again: 0, hard: 0, good: 0, easy: 0 };
  const ratingHistory = selectedDeck ? selectedDeck.ratingHistory : [];

  useEffect(() => {
    localStorage.setItem('decks', JSON.stringify(decks));
  }, [decks]);

  const handleGenerate = async () => {
    if (!deckName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:4000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      const data = await res.json();

      if (!res.ok || !data.flashcards) {
        throw new Error(data.error || 'Something went wrong.');
      }

      const newDeck: Deck = {
        id: Date.now().toString(),
        name: deckName.trim(),
        flashcards: data.flashcards.map(
          (c: { question: string; answer: string }) => ({
            ...c,
            repetitions: 0,
            easeFactor: 2.5,
            interval: 0,
            dueDate: Date.now(),
          })
        ),
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
      setError(err.message || 'Failed to generate flashcards.');
    } finally {
      setLoading(false);
    }
  };

  const reviewCard = (card: Flashcard, rating: Rating) => {
    if (rating === 'again') {
      card.interval = 1;
      card.repetitions = 0;
      card.easeFactor = Math.max(1.3, card.easeFactor - 0.2);
    } else if (rating === 'hard') {
      card.interval = Math.max(1, Math.round(card.interval * 1.2));
      card.easeFactor = Math.max(1.3, card.easeFactor - 0.15);
    } else if (rating === 'good') {
      card.repetitions += 1;
      card.interval = Math.max(1, Math.round(card.interval * card.easeFactor));
    } else {
      card.repetitions += 1;
      card.easeFactor += 0.15;
      card.interval = Math.max(
        1,
        Math.round(card.interval * card.easeFactor * 1.3)
      );
    }
    card.dueDate = Date.now() + card.interval * 24 * 60 * 60 * 1000;
  };

  const handleRating = (level: Rating) => {
    if (!selectedDeckId) return;
    setDecks((prev) =>
      prev.map((deck) => {
        if (deck.id !== selectedDeckId) return deck;
        const updated = { ...deck };
        updated.ratings[level] += 1;
        updated.ratingHistory = [...updated.ratingHistory, level];
        const card = { ...updated.flashcards[updated.index] };
        reviewCard(card, level);
        updated.flashcards[updated.index] = card;
        if (updated.index < updated.flashcards.length - 1) {
          updated.index += 1;
        } else {
          updated.finished = true;
        }
        return updated;
      })
    );
    setFlipped(false);
  };

  const handleRestart = () => {
    if (!selectedDeckId) return;
    setDecks((prev) =>
      prev.map((deck) =>
        deck.id === selectedDeckId
          ? {
              ...deck,
              index: 0,
              finished: false,
              ratings: { again: 0, hard: 0, good: 0, easy: 0 },
              ratingHistory: [],
            }
          : deck
      )
    );
    setFlipped(false);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>🧠 AI Flashcard Generator</h1>

      {error && (
        <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>
      )}

      {!selectedDeck && (
        <>
          {decks.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h2>Your Decks</h2>
              <ul>
                {decks.map((d) => (
                  <li key={d.id} style={{ marginBottom: '0.5rem' }}>
                    {d.name} -{' '}
                    {d.finished
                      ? 'Completed'
                      : `Card ${d.index + 1} of ${d.flashcards.length}`}
                    <button
                      onClick={() => setSelectedDeckId(d.id)}
                      style={{ marginLeft: '0.5rem' }}
                    >
                      {d.finished ? 'Review' : 'Continue'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h2>Create New Deck</h2>
          <input
            type="text"
            placeholder="Deck name"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
          />
          <br />
          <textarea
            rows={8}
            cols={60}
            placeholder="Paste your notes here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <br />
          <button
            onClick={handleGenerate}
            disabled={loading || !notes.trim() || !deckName.trim()}
          >
            {loading ? 'Generating...' : 'Generate Flashcards'}
          </button>
        </>
      )}

      {selectedDeck && flashcards.length > 0 && !finished && (
        <div style={{ marginTop: '2rem' }}>
          <div
            onClick={() => setFlipped(!flipped)}
            style={{
              padding: '2rem',
              border: '1px solid #ccc',
              borderRadius: '10px',
              width: '400px',
              cursor: 'pointer',
              marginBottom: '1rem',
              backgroundColor: '#f9f9f9',
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ color: '#111', fontSize: '1.2rem' }}>
            {flashcards[index] &&
  (flipped
    ? flashcards[index].answer
    : flashcards[index].question)}

            </h3>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <button onClick={() => handleRating('again')}>Again</button>
            <button onClick={() => handleRating('hard')}>Hard</button>
            <button onClick={() => handleRating('good')}>Good</button>
            <button onClick={() => handleRating('easy')}>Easy</button>
          </div>

          <p style={{ marginTop: '1rem' }}>
            Card {index + 1} of {flashcards.length}
          </p>
        </div>
      )}

      {selectedDeck && finished && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Rating Summary</h2>
          <ul>
            {ratingHistory.map((r, i) => (
              <li key={i}>
                Card {i + 1}: {r.charAt(0).toUpperCase() + r.slice(1)}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: '1rem' }}>
            Again: {ratings.again} | Hard: {ratings.hard} | Good: {ratings.good}
            {' '}
            | Easy: {ratings.easy}
          </p>
          <button onClick={handleRestart}>Start Over</button>
          <button
            onClick={() => setSelectedDeckId(null)}
            style={{ marginLeft: '0.5rem' }}
          >
            Back to Decks
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
