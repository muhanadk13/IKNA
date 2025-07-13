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
      if (!apiKey || apiKey === 'sk-your-openai-api-key-here') {
        throw new OpenAIApiError('OpenAI API key not configured. Please set OPENAI_API_KEY in your .env file.');
      }
      
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
      if (error instanceof OpenAIApiError) {
        throw error;
      }

      if (error instanceof OpenAI.APIError) {
        throw new OpenAIApiError('OpenAI API error', error);
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
Turn the following notes into ${count} ${difficulty}-level flashcards in ${format} format.
${formatPrompts[format] || formatPrompts.qa}
${difficultyPrompts[difficulty] || difficultyPrompts.beginner}

Guidelines:
- Questions should be clear, specific, and test understanding
- Answers should be concise but complete and accurate
- Avoid overly complex language for beginner level
- Ensure questions promote active recall rather than simple memorization
- Make sure all information is accurate based on the provided notes
- Vary question types to maintain engagement
- Include practical examples where appropriate

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