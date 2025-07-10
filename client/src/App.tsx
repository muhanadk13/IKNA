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

  const handleGenerate = async () => {
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

      setFlashcards(data.flashcards);
      setIndex(0);
      setFlipped(false);
    } catch (err: any) {
      setError(err.message || 'Failed to generate flashcards.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setFlipped(false);
    if (index < flashcards.length - 1) {
      setIndex(index + 1);
    }
  };

  const handleRestart = () => {
    setNotes('');
    setFlashcards([]);
    setIndex(0);
    setFlipped(false);
    setError('');
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

      {flashcards.length > 0 && (
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

          {index < flashcards.length - 1 ? (
            <button onClick={handleNext}>Next Card</button>
          ) : (
            <button onClick={handleRestart}>Start Over</button>
          )}

          <p style={{ marginTop: '1rem' }}>
            Card {index + 1} of {flashcards.length}
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
