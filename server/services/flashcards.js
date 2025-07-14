import pool from '../config/database.js';
import { openAIService } from './openai.js';
import { SRSService } from './srs.js';

export class FlashcardService {
  // Create a single flashcard
  static async createFlashcard(userId, deckId, cardData) {
    const { question, answer, source, difficulty } = cardData;
    
    const result = await pool.query(`
      INSERT INTO flashcards (deck_id, question, answer, source, difficulty)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [deckId, question, answer, source, difficulty || 'medium']);

    return result.rows[0];
  }

  // Create multiple flashcards
  static async createFlashcards(userId, deckId, cards) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const createdCards = [];
      
      for (const card of cards) {
        const result = await client.query(`
          INSERT INTO flashcards (deck_id, question, answer, source, difficulty)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [deckId, card.question, card.answer, card.source, card.difficulty || 'medium']);
        
        createdCards.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return createdCards;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Generate flashcards from notes using AI
  static async generateFlashcards(userId, deckId, notes, options = {}) {
    const { count = 10, difficulty = 'medium', format = 'qa' } = options;

    // Generate flashcards using OpenAI
    const generatedCards = await openAIService.generateFlashcards({
      notes,
      count,
      difficulty,
      format
    });

    // Save generated cards to database
    const createdCards = await this.createFlashcards(userId, deckId, generatedCards);

    return createdCards;
  }

  // Get flashcards for a deck
  static async getDeckFlashcards(userId, deckId, options = {}) {
    const { difficulty, status, sortBy = 'created_at', sortOrder = 'ASC', limit = 100, offset = 0 } = options;
    
    let query = `
      SELECT f.* FROM flashcards f
      JOIN decks d ON f.deck_id = d.id
      WHERE d.id = $1 AND d.user_id = $2
    `;
    
    const params = [deckId, userId];
    let paramCount = 2;

    if (difficulty) {
      paramCount++;
      query += ` AND f.difficulty = $${paramCount}`;
      params.push(difficulty);
    }

    if (status) {
      paramCount++;
      if (status === 'new') {
        query += ` AND f.consecutive_correct = 0`;
      } else if (status === 'learning') {
        query += ` AND f.consecutive_correct > 0 AND f.consecutive_correct < 3`;
      } else if (status === 'reviewing') {
        query += ` AND f.consecutive_correct >= 3`;
      }
    }

    query += ` ORDER BY f.${sortBy} ${sortOrder} LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get a specific flashcard
  static async getFlashcard(userId, flashcardId) {
    const result = await pool.query(`
      SELECT f.* FROM flashcards f
      JOIN decks d ON f.deck_id = d.id
      WHERE f.id = $1 AND d.user_id = $2
    `, [flashcardId, userId]);

    if (result.rows.length === 0) {
      throw new Error('Flashcard not found');
    }

    return result.rows[0];
  }

  // Update a flashcard
  static async updateFlashcard(userId, flashcardId, updates) {
    const allowedFields = ['question', 'answer', 'source', 'difficulty'];
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field)) {
        updateFields.push(`${field} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(flashcardId, userId);

    const result = await pool.query(`
      UPDATE flashcards f
      SET ${updateFields.join(', ')}
      FROM decks d
      WHERE f.deck_id = d.id AND f.id = $${paramCount} AND d.user_id = $${paramCount + 1}
      RETURNING f.*
    `, values);

    if (result.rows.length === 0) {
      throw new Error('Flashcard not found');
    }

    return result.rows[0];
  }

  // Delete a flashcard
  static async deleteFlashcard(userId, flashcardId) {
    const result = await pool.query(`
      DELETE FROM flashcards f
      USING decks d
      WHERE f.deck_id = d.id AND f.id = $1 AND d.user_id = $2
      RETURNING f.id
    `, [flashcardId, userId]);

    if (result.rows.length === 0) {
      throw new Error('Flashcard not found');
    }

    return { success: true };
  }

  // Review a flashcard
  static async reviewFlashcard(userId, flashcardId, rating, responseTimeMs = null) {
    // Verify flashcard belongs to user
    const flashcard = await this.getFlashcard(userId, flashcardId);
    
    // Use SRS service to update the card
    const updatedCard = await SRSService.reviewCard(flashcardId, userId, rating, responseTimeMs);
    
    return updatedCard;
  }

  // Reset flashcard progress
  static async resetFlashcard(userId, flashcardId) {
    const flashcard = await this.getFlashcard(userId, flashcardId);
    
    const result = await SRSService.resetCard(flashcardId, userId);
    
    return result;
  }

  // Get flashcards due for review
  static async getDueFlashcards(userId, deckId = null, limit = 50) {
    let query = `
      SELECT f.*, d.name as deck_name 
      FROM flashcards f
      JOIN decks d ON f.deck_id = d.id
      WHERE d.user_id = $1 AND f.next_review <= NOW()
    `;
    
    const params = [userId];
    let paramCount = 1;

    if (deckId) {
      paramCount++;
      query += ` AND d.id = $${paramCount}`;
      params.push(deckId);
    }

    query += ` ORDER BY f.next_review ASC LIMIT $${paramCount + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get flashcards by difficulty
  static async getFlashcardsByDifficulty(userId, difficulty, deckId = null) {
    let query = `
      SELECT f.*, d.name as deck_name 
      FROM flashcards f
      JOIN decks d ON f.deck_id = d.id
      WHERE d.user_id = $1
    `;
    
    const params = [userId];
    let paramCount = 1;

    if (deckId) {
      paramCount++;
      query += ` AND d.id = $${paramCount}`;
      params.push(deckId);
    }

    // Add difficulty filter
    paramCount++;
    if (difficulty === 'new') {
      query += ` AND f.consecutive_correct = 0`;
    } else if (difficulty === 'hard') {
      query += ` AND f.ease_factor < 1.5 AND f.consecutive_correct > 0`;
    } else if (difficulty === 'medium') {
      query += ` AND f.ease_factor BETWEEN 1.5 AND 2.0`;
    } else if (difficulty === 'easy') {
      query += ` AND f.ease_factor > 2.0`;
    }

    query += ` ORDER BY f.next_review ASC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get flashcard statistics
  static async getFlashcardStats(userId, deckId = null) {
    let query = `
      SELECT 
        COUNT(*) as total_cards,
        COUNT(CASE WHEN next_review <= NOW() THEN 1 END) as due_cards,
        COUNT(CASE WHEN consecutive_correct > 0 THEN 1 END) as learned_cards,
        COUNT(CASE WHEN consecutive_correct = 0 THEN 1 END) as new_cards,
        AVG(ease_factor) as avg_ease_factor,
        COUNT(CASE WHEN ease_factor < 1.5 THEN 1 END) as hard_cards,
        COUNT(CASE WHEN ease_factor BETWEEN 1.5 AND 2.0 THEN 1 END) as medium_cards,
        COUNT(CASE WHEN ease_factor > 2.0 THEN 1 END) as easy_cards
      FROM flashcards f
      JOIN decks d ON f.deck_id = d.id
      WHERE d.user_id = $1
    `;
    
    const params = [userId];

    if (deckId) {
      query += ` AND d.id = $2`;
      params.push(deckId);
    }

    const result = await pool.query(query, params);
    const stats = result.rows[0];

    return {
      total_cards: parseInt(stats.total_cards),
      due_cards: parseInt(stats.due_cards),
      learned_cards: parseInt(stats.learned_cards),
      new_cards: parseInt(stats.new_cards),
      avg_ease_factor: parseFloat(stats.avg_ease_factor || 0),
      difficulty_breakdown: {
        hard: parseInt(stats.hard_cards),
        medium: parseInt(stats.medium_cards),
        easy: parseInt(stats.easy_cards)
      }
    };
  }

  // Search flashcards
  static async searchFlashcards(userId, searchTerm, options = {}) {
    const { deckId, limit = 50, offset = 0 } = options;
    
    let query = `
      SELECT f.*, d.name as deck_name 
      FROM flashcards f
      JOIN decks d ON f.deck_id = d.id
      WHERE d.user_id = $1 
        AND (f.question ILIKE $2 OR f.answer ILIKE $2 OR f.source ILIKE $2)
    `;
    
    const params = [userId, `%${searchTerm}%`];

    if (deckId) {
      query += ` AND d.id = $3`;
      params.push(deckId);
    }

    query += ` ORDER BY f.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Bulk update flashcards
  static async bulkUpdateFlashcards(userId, flashcardIds, updates) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const updatedCards = [];
      
      for (const flashcardId of flashcardIds) {
        const result = await this.updateFlashcard(userId, flashcardId, updates);
        updatedCards.push(result);
      }

      await client.query('COMMIT');
      return updatedCards;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Bulk delete flashcards
  static async bulkDeleteFlashcards(userId, flashcardIds) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      let deletedCount = 0;
      
      for (const flashcardId of flashcardIds) {
        await this.deleteFlashcard(userId, flashcardId);
        deletedCount++;
      }

      await client.query('COMMIT');
      return { success: true, deleted_count: deletedCount };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} 