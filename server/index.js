import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();
const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

app.post('/generate', async (req, res) => {
  const { notes } = req.body;

  if (!notes || typeof notes !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid notes.' });
  }

  const prompt = `
Turn the following notes into 8 beginner-friendly flashcards.
Each flashcard must be a JSON object with a "question" and an "answer".

NOTES:
${notes}

Return your answer as a valid JSON array only, like this:
[
  { "question": "...", "answer": "..." },
  ...
]
  `.trim();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    let raw = response.choices[0].message.content || '';

    // Remove GPT code block wrappers if present
    raw = raw.replace(/```json|```/g, '').trim();

    const flashcards = JSON.parse(raw);

    if (!Array.isArray(flashcards)) {
      return res.status(500).json({ error: 'GPT did not return a flashcard array.' });
    }

    res.json({ flashcards });
  } catch (err) {
    console.error('❌ GPT Error:', err.message);
    res.status(500).json({ error: 'Failed to generate flashcards from GPT.' });
  }
});

app.listen(4000, () => {
  console.log('✅ Server running at http://localhost:4000');
});
