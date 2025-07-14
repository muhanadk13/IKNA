import pool from '../config/database.js';

// SuperMemo 2 Algorithm Implementation
class SRSAlgorithm {
  static calculateNextReview(flashcard, rating) {
    const { ease_factor, interval, repetitions, consecutive_correct } = flashcard;
    
    let new_ease_factor = ease_factor;
    let new_interval = interval;
    let new_repetitions = repetitions;
    let new_consecutive_correct = consecutive_correct;

    // Quality rating: 0=again, 1=hard, 2=good, 3=easy
    const quality = rating === 'again' ? 0 : 
                   rating === 'hard' ? 1 : 
                   rating === 'good' ? 2 : 3;

    if (quality < 3) {
      // Failed or hard - reset
      new_repetitions = 0;
      new_interval = 1;
      new_consecutive_correct = 0;
    } else {
      // Passed
      new_repetitions += 1;
      new_consecutive_correct += 1;
      
      if (new_repetitions === 1) {
        new_interval = 1;
      } else if (new_repetitions === 2) {
        new_interval = 6;
      } else {
        new_interval = Math.round(new_interval * ease_factor);
      }
    }

    // Update ease factor
    new_ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    new_ease_factor = Math.max(1.3, new_ease_factor); // Minimum ease factor

    // Calculate next review date
    const now = new Date();
    const next_review = new Date(now.getTime() + (new_interval * 24 * 60 * 60 * 1000));

    return {
      ease_factor: new_ease_factor,
      interval: new_interval,
      repetitions: new_repetitions,
      consecutive_correct: new_consecutive_correct,
      next_review: next_review,
      due_date: next_review
    };
  }

  static getDifficultyLevel(flashcard) {
    const { ease_factor, consecutive_correct } = flashcard;
    
    if (consecutive_correct === 0) return 'new';
    if (ease_factor < 1.5) return 'hard';
    if (ease_factor < 2.0) return 'medium';
    return 'easy';
  }
}

export class SRSService {
  // Get due cards for a user
  static async getDueCards(userId, limit = 50) {
    const query = `
      SELECT f.*, d.name as deck_name 
      FROM flashcards f
      JOIN decks d ON f.deck_id = d.id
      WHERE d.user_id = $1 
        AND f.next_review <= NOW()
        AND f.deck_id IN (
          SELECT id FROM decks WHERE user_id = $1
        )
      ORDER BY f.next_review ASC
      LIMIT $2
    `;
    
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  }

  // Get cards due today
  static async getCardsDueToday(userId) {
    const query = `
      SELECT f.*, d.name as deck_name 
      FROM flashcards f
      JOIN decks d ON f.deck_id = d.id
      WHERE d.user_id = $1 
        AND f.next_review <= NOW()
        AND f.deck_id IN (
          SELECT id FROM decks WHERE user_id = $1
        )
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  // Review a card
  static async reviewCard(flashcardId, userId, rating, responseTimeMs = null) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get the flashcard
      const flashcardResult = await client.query(
        'SELECT * FROM flashcards WHERE id = $1',
        [flashcardId]
      );

      if (flashcardResult.rows.length === 0) {
        throw new Error('Flashcard not found');
      }

      const flashcard = flashcardResult.rows[0];

      // Calculate new SRS values
      const newValues = SRSAlgorithm.calculateNextReview(flashcard, rating);

      // Update flashcard
      await client.query(`
        UPDATE flashcards 
        SET ease_factor = $1, interval = $2, repetitions = $3, 
            consecutive_correct = $4, next_review = $5, due_date = $6,
            last_reviewed = NOW(), updated_at = NOW()
        WHERE id = $7
      `, [
        newValues.ease_factor,
        newValues.interval,
        newValues.repetitions,
        newValues.consecutive_correct,
        newValues.next_review,
        newValues.due_date,
        flashcardId
      ]);

      // Record review history
      await client.query(`
        INSERT INTO review_history (flashcard_id, user_id, rating, response_time_ms)
        VALUES ($1, $2, $3, $4)
      `, [flashcardId, userId, rating, responseTimeMs]);

      await client.query('COMMIT');

      return {
        ...flashcard,
        ...newValues,
        rating,
        response_time_ms: responseTimeMs
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get study statistics
  static async getStudyStats(userId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_cards,
        COUNT(CASE WHEN next_review <= NOW() THEN 1 END) as due_cards,
        COUNT(CASE WHEN consecutive_correct > 0 THEN 1 END) as learned_cards,
        AVG(ease_factor) as avg_ease_factor,
        COUNT(CASE WHEN consecutive_correct = 0 THEN 1 END) as new_cards
      FROM flashcards f
      JOIN decks d ON f.deck_id = d.id
      WHERE d.user_id = $1
    `;

    const reviewStatsQuery = `
      SELECT 
        rating,
        COUNT(*) as count,
        AVG(response_time_ms) as avg_response_time
      FROM review_history rh
      JOIN flashcards f ON rh.flashcard_id = f.id
      JOIN decks d ON f.deck_id = d.id
      WHERE d.user_id = $1
      GROUP BY rating
    `;

    const [statsResult, reviewResult] = await Promise.all([
      pool.query(statsQuery, [userId]),
      pool.query(reviewStatsQuery, [userId])
    ]);

    const stats = statsResult.rows[0];
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
      review_stats: reviewStats
    };
  }

  // Get learning progress
  static async getLearningProgress(userId, days = 30) {
    const query = `
      SELECT 
        DATE(rh.reviewed_at) as date,
        COUNT(*) as reviews,
        COUNT(CASE WHEN rh.rating IN ('good', 'easy') THEN 1 END) as correct,
        AVG(rh.response_time_ms) as avg_response_time
      FROM review_history rh
      JOIN flashcards f ON rh.flashcard_id = f.id
      JOIN decks d ON f.deck_id = d.id
      WHERE d.user_id = $1 
        AND rh.reviewed_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(rh.reviewed_at)
      ORDER BY date
    `;

    const result = await pool.query(query, [userId]);
    return result.rows.map(row => ({
      date: row.date,
      reviews: parseInt(row.reviews),
      correct: parseInt(row.correct),
      accuracy: row.reviews > 0 ? Math.round((row.correct / row.reviews) * 100) : 0,
      avg_response_time: row.avg_response_time ? Math.round(row.avg_response_time) : null
    }));
  }

  // Reset card progress
  static async resetCard(flashcardId, userId) {
    const result = await pool.query(`
      UPDATE flashcards 
      SET ease_factor = 2.5, interval = 0, repetitions = 0, 
          consecutive_correct = 0, next_review = NOW(), due_date = NOW(),
          last_reviewed = NULL, updated_at = NOW()
      WHERE id = $1 AND deck_id IN (
        SELECT id FROM decks WHERE user_id = $2
      )
      RETURNING *
    `, [flashcardId, userId]);

    return result.rows[0];
  }

  // Get cards by difficulty
  static async getCardsByDifficulty(userId, difficulty) {
    const query = `
      SELECT f.*, d.name as deck_name 
      FROM flashcards f
      JOIN decks d ON f.deck_id = d.id
      WHERE d.user_id = $1 
        AND CASE 
          WHEN $2 = 'new' THEN f.consecutive_correct = 0
          WHEN $2 = 'hard' THEN f.ease_factor < 1.5 AND f.consecutive_correct > 0
          WHEN $2 = 'medium' THEN f.ease_factor BETWEEN 1.5 AND 2.0
          WHEN $2 = 'easy' THEN f.ease_factor > 2.0
          ELSE true
        END
      ORDER BY f.next_review ASC
    `;
    
    const result = await pool.query(query, [userId, difficulty]);
    return result.rows;
  }
} 