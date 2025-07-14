import pool from '../config/database.js';
import { SRSService } from './srs.js';

export class DeckService {
  // Create a new deck
  static async createDeck(userId, deckData) {
    const { name, description, difficulty, tags } = deckData;
    
    const result = await pool.query(`
      INSERT INTO decks (user_id, name, description, difficulty, tags)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, description, difficulty, tags, created_at, updated_at
    `, [userId, name, description, difficulty || 'beginner', tags || []]);

    return result.rows[0];
  }

  // Get all decks for a user
  static async getUserDecks(userId, options = {}) {
    const { search, difficulty, sortBy = 'created_at', sortOrder = 'DESC', limit = 50, offset = 0 } = options;
    
    let query = `
      SELECT d.*, 
             COUNT(f.id) as total_cards,
             COUNT(CASE WHEN f.next_review <= NOW() THEN 1 END) as due_cards,
             COUNT(CASE WHEN f.consecutive_correct > 0 THEN 1 END) as learned_cards
      FROM decks d
      LEFT JOIN flashcards f ON d.id = f.deck_id
      WHERE d.user_id = $1
    `;
    
    const params = [userId];
    let paramCount = 1;

    if (search) {
      paramCount++;
      query += ` AND (d.name ILIKE $${paramCount} OR d.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (difficulty) {
      paramCount++;
      query += ` AND d.difficulty = $${paramCount}`;
      params.push(difficulty);
    }

    query += ` GROUP BY d.id ORDER BY d.${sortBy} ${sortOrder} LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get a specific deck with its cards
  static async getDeck(userId, deckId) {
    const deckResult = await pool.query(`
      SELECT * FROM decks WHERE id = $1 AND user_id = $2
    `, [deckId, userId]);

    if (deckResult.rows.length === 0) {
      throw new Error('Deck not found');
    }

    const deck = deckResult.rows[0];

    // Get flashcards for this deck
    const cardsResult = await pool.query(`
      SELECT * FROM flashcards WHERE deck_id = $1 ORDER BY created_at ASC
    `, [deckId]);

    return {
      ...deck,
      flashcards: cardsResult.rows
    };
  }

  // Update a deck
  static async updateDeck(userId, deckId, updates) {
    const allowedFields = ['name', 'description', 'difficulty', 'tags'];
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
    values.push(deckId, userId);

    const result = await pool.query(`
      UPDATE decks 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      throw new Error('Deck not found');
    }

    return result.rows[0];
  }

  // Delete a deck
  static async deleteDeck(userId, deckId) {
    const result = await pool.query(`
      DELETE FROM decks WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [deckId, userId]);

    if (result.rows.length === 0) {
      throw new Error('Deck not found');
    }

    return { success: true };
  }

  // Get deck statistics
  static async getDeckStats(userId, deckId) {
    const statsResult = await pool.query(`
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
      WHERE d.id = $1 AND d.user_id = $2
    `, [deckId, userId]);

    if (statsResult.rows.length === 0) {
      throw new Error('Deck not found');
    }

    const stats = statsResult.rows[0];

    // Get review history for this deck
    const reviewResult = await pool.query(`
      SELECT 
        rating,
        COUNT(*) as count,
        AVG(response_time_ms) as avg_response_time
      FROM review_history rh
      JOIN flashcards f ON rh.flashcard_id = f.id
      WHERE f.deck_id = $1
      GROUP BY rating
    `, [deckId]);

    const reviewStats = reviewResult.rows.reduce((acc, row) => {
      acc[row.rating] = {
        count: parseInt(row.count),
        avg_response_time: row.avg_response_time ? Math.round(row.avg_response_time) : null
      };
      return acc;
    }, {});

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
      },
      review_stats: reviewStats
    };
  }

  // Get study session for a deck
  static async getStudySession(userId, deckId, options = {}) {
    const { limit = 20, includeNew = true, includeDue = true } = options;

    let query = `
      SELECT f.*, d.name as deck_name
      FROM flashcards f
      JOIN decks d ON f.deck_id = d.id
      WHERE d.id = $1 AND d.user_id = $2
    `;

    const conditions = [];
    const params = [deckId, userId];

    if (includeDue) {
      conditions.push('f.next_review <= NOW()');
    }

    if (includeNew) {
      conditions.push('f.consecutive_correct = 0');
    }

    if (conditions.length > 0) {
      query += ` AND (${conditions.join(' OR ')})`;
    }

    query += ` ORDER BY f.next_review ASC LIMIT $3`;

    const result = await pool.query(query, [...params, limit]);
    return result.rows;
  }

  // Export deck
  static async exportDeck(userId, deckId) {
    const deck = await this.getDeck(userId, deckId);
    
    return {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      difficulty: deck.difficulty,
      tags: deck.tags,
      created_at: deck.created_at,
      flashcards: deck.flashcards.map(card => ({
        question: card.question,
        answer: card.answer,
        source: card.source,
        difficulty: card.difficulty
      }))
    };
  }

  // Import deck
  static async importDeck(userId, deckData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create deck
      const deckResult = await client.query(`
        INSERT INTO decks (user_id, name, description, difficulty, tags)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [userId, deckData.name, deckData.description, deckData.difficulty || 'beginner', deckData.tags || []]);

      const deckId = deckResult.rows[0].id;

      // Create flashcards
      if (deckData.flashcards && deckData.flashcards.length > 0) {
        for (const card of deckData.flashcards) {
          await client.query(`
            INSERT INTO flashcards (deck_id, question, answer, source, difficulty)
            VALUES ($1, $2, $3, $4, $5)
          `, [deckId, card.question, card.answer, card.source, card.difficulty || 'medium']);
        }
      }

      await client.query('COMMIT');
      return await this.getDeck(userId, deckId);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get user's study statistics across all decks
  static async getUserStudyStats(userId) {
    const stats = await SRSService.getStudyStats(userId);
    
    // Get deck count
    const deckCountResult = await pool.query(`
      SELECT COUNT(*) as total_decks FROM decks WHERE user_id = $1
    `, [userId]);

    return {
      ...stats,
      total_decks: parseInt(deckCountResult.rows[0].total_decks)
    };
  }
} 