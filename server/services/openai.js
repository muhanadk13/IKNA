import { OpenAI } from 'openai';
import { OpenAIApiError } from '../middleware/errorHandler.js';

class OpenAIService {
  constructor() {
    this.openai = null;
    this.rateLimit = {
      requests: 0,
      resetTime: Date.now() + 60000, // 1 minute window
      maxRequests: 10, // Max requests per minute
    };
  }

  // Lazy initialization of OpenAI client
  getClient() {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      console.log('Checking OpenAI API key configuration...');
      
      if (!apiKey) {
        throw new OpenAIApiError('OpenAI API key not configured. Please set OPENAI_API_KEY in your .env file.');
      }
      
      if (apiKey === 'sk-your-openai-api-key-here' || apiKey.includes('your-openai-api-key')) {
        throw new OpenAIApiError('OpenAI API key is set to default value. Please set a valid OPENAI_API_KEY in your .env file.');
      }
      
      console.log('OpenAI API key configured successfully');
      this.openai = new OpenAI({ 
        apiKey,
        maxRetries: 3,
      });
    }
    return this.openai;
  }

  // Rate limiting
  checkRateLimit() {
    const now = Date.now();
    
    if (now > this.rateLimit.resetTime) {
      this.rateLimit.requests = 0;
      this.rateLimit.resetTime = now + 60000;
    }

    if (this.rateLimit.requests >= this.rateLimit.maxRequests) {
      throw new OpenAIApiError('Rate limit exceeded. Please try again later.');
    }

    this.rateLimit.requests++;
  }

  // Generate flashcards with comprehensive error handling
  async generateFlashcards(request) {
    try {
      this.checkRateLimit();

      const {
        notes,
        difficulty = 'beginner',
        count = 8,
        format = 'qa',
        tags = []
      } = request;

      const prompt = this.buildPrompt(notes, difficulty, count, format, tags);
      
      const response = await this.getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational content creator specializing in creating high-quality flashcards for spaced repetition learning.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) {
        throw new OpenAIApiError('No response from OpenAI API');
      }
      console.log('RAW OPENAI RESPONSE:', raw);

      const flashcards = this.parseResponse(raw);
      const validatedFlashcards = this.validateFlashcards(flashcards);

      return {
        flashcards: validatedFlashcards,
        metadata: {
          difficulty,
          format,
          count: validatedFlashcards.length,
          estimatedTime: this.estimateStudyTime(validatedFlashcards, difficulty),
          model: 'gpt-4o-mini',
          tokens: response.usage?.total_tokens || 0,
        }
      };

    } catch (error) {
      console.error('Error generating flashcards:', error);
      
      if (error instanceof OpenAIApiError) {
        throw error;
      }

      if (error instanceof OpenAI.APIError) {
        // Handle specific OpenAI API errors
        if (error.status === 401) {
          throw new OpenAIApiError('Invalid OpenAI API key. Please check your API key configuration.');
        } else if (error.status === 429) {
          throw new OpenAIApiError('OpenAI API rate limit exceeded. Please try again later.');
        } else if (error.status === 500) {
          throw new OpenAIApiError('OpenAI API server error. Please try again later.');
        } else {
          throw new OpenAIApiError(`OpenAI API error: ${error.message}`, error);
        }
      }

      // Handle other errors
      if (error.code === 'ENOTFOUND') {
        throw new OpenAIApiError('Unable to connect to OpenAI API. Please check your internet connection.');
      }

      throw new OpenAIApiError('Failed to generate flashcards', error);
    }
  }

  buildPrompt(notes, difficulty, count, format, tags) {
    const formatPrompts = {
      qa: 'Each flashcard must be a JSON object with a "question" and an "answer".',
      fill: 'Each flashcard must be a JSON object with a "question" (fill-in-the-blank) and an "answer".',
      definition: 'Each flashcard must be a JSON object with a "question" (term/concept) and an "answer" (definition/explanation).',
      mcq: 'Each flashcard must be a JSON object with a "question" (multiple choice question), "answer" (correct answer), and "options" (array of 4 choices including the correct answer).'
    };

    const difficultyPrompts = {
      beginner: 'Create beginner-friendly flashcards with simple, clear language and basic concepts.',
      intermediate: 'Create intermediate-level flashcards with more detailed explanations and moderate complexity.',
      advanced: 'Create advanced flashcards with complex concepts, detailed explanations, and sophisticated terminology.'
    };

    const tagContext = tags.length > 0 ? `\nContext/Tags: ${tags.join(', ')}` : '';

    return `
For each non-empty line in the notes below, create exactly one flashcard. Do not combine lines. Each line should become its own notecard. 
- If a line is a question, use it as the question and provide a concise answer.
- If a line is a statement or just a phrase, use it as the question and make the answer: "This is a note: [repeat the line]".
Use the ${format} format.

${formatPrompts[format] || formatPrompts.qa}
${difficultyPrompts[difficulty] || difficultyPrompts.beginner}

Guidelines:
- Each notecard should correspond to one line from the notes
- Do not merge or split lines
- If a line is a question, use it as the question and provide a concise answer
- If a line is a statement or phrase, use it as the question and make the answer: "This is a note: [repeat the line]"
- Return a valid JSON array, one object per line

NOTES:
${notes}${tagContext}

Return your answer as a valid JSON array only, like this:
[
  { "question": "...", "answer": "..." },
  ...
]
`.trim();
  }

  parseResponse(raw) {
    try {
      // Remove GPT code block wrappers if present
      const cleaned = raw.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (error) {
      throw new OpenAIApiError('Failed to parse OpenAI response as JSON');
    }
  }

  validateFlashcards(flashcards) {
    if (!Array.isArray(flashcards)) {
      throw new OpenAIApiError('OpenAI did not return a flashcard array');
    }

    const validFlashcards = flashcards.filter(card => 
      card && 
      typeof card.question === 'string' && 
      typeof card.answer === 'string' &&
      card.question.trim().length > 0 &&
      card.answer.trim().length > 0
    );

    if (validFlashcards.length === 0) {
      throw new OpenAIApiError('No valid flashcards generated');
    }

    return validFlashcards;
  }

  estimateStudyTime(flashcards, difficulty) {
    const baseTimePerCard = {
      beginner: 30,
      intermediate: 45,
      advanced: 60
    };

    const timePerCard = baseTimePerCard[difficulty] || 30;
    return flashcards.length * timePerCard; // seconds
  }

  // Health check for OpenAI API
  async healthCheck() {
    try {
      await this.getClient().models.list();
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message,
        timestamp: new Date().toISOString() 
      };
    }
  }
}

export const openAIService = new OpenAIService(); 