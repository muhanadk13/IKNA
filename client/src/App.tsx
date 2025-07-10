import { useState } from 'react';

type Flashcard = {
  question: string;
  answer: string;
};

function App() {
  const [notes, setNotes] = useState('');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [ratings, setRatings] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setFinished(false);
    setRatings({ again: 0, hard: 0, good: 0, easy: 0 });
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

      setFlashcards(data.flashcards);
      setIndex(0);
      setFlipped(false);
    } catch (err: any) {
      setError(err.message || 'Failed to generate flashcards.');
    } finally {
      setLoading(false);
    }
  };

  const handleRating = (level: keyof typeof ratings) => {
    setRatings((prev) => ({ ...prev, [level]: prev[level] + 1 }));
    setFlipped(false);
    if (index < flashcards.length - 1) {
      setIndex(index + 1);
    } else {
      setFinished(true);
    }
  };

  const handleRestart = () => {
    setNotes('');
    setFlashcards([]);
    setIndex(0);
    setFlipped(false);
    setError('');
    setFinished(false);
    setRatings({ again: 0, hard: 0, good: 0, easy: 0 });
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>🧠 AI Flashcard Generator</h1>

      {error && (
        <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>
      )}

      {flashcards.length === 0 && (
        <>
          <textarea
            rows={8}
            cols={60}
            placeholder="Paste your notes here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <br />
          <button onClick={handleGenerate} disabled={loading || !notes.trim()}>
            {loading ? 'Generating...' : 'Generate Flashcards'}
          </button>
        </>
      )}

      {flashcards.length > 0 && !finished && (
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

      {finished && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Rating Summary</h2>
          <ul>
            <li>Again: {ratings.again}</li>
            <li>Hard: {ratings.hard}</li>
            <li>Good: {ratings.good}</li>
            <li>Easy: {ratings.easy}</li>
          </ul>
          <button onClick={handleRestart}>Start Over</button>
        </div>
      )}
    </div>
  );
}

export default App;
