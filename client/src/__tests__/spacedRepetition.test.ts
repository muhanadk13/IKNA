import { describe, it, expect } from 'vitest';
import { reviewCard, isCardDue, calculateStats, createFlashcard } from '../utils/spacedRepetition';
import type { Flashcard, Rating } from '../types';

describe('Spaced Repetition Algorithm', () => {
  const createTestCard = (overrides: Partial<Flashcard> = {}): Flashcard => ({
    id: 'test-1',
    question: 'What is 2+2?',
    answer: '4',
    repetitions: 0,
    easeFactor: 2.5,
    interval: 0,
    dueDate: Date.now(),
    easy: false,
    createdAt: Date.now(),
    ...overrides,
  });

  describe('reviewCard', () => {
    it('should handle "again" rating correctly', () => {
      const card = createTestCard({ repetitions: 5, interval: 10, easeFactor: 2.5 });
      const result = reviewCard(card, 'again');

      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(0);
      expect(result.easeFactor).toBe(2.3);
      expect(result.easy).toBe(false);
    });

    it('should handle "hard" rating correctly', () => {
      const card = createTestCard({ repetitions: 3, interval: 5, easeFactor: 2.5 });
      const result = reviewCard(card, 'hard');

      expect(result.interval).toBe(6); // 5 * 1.2 = 6
      expect(result.repetitions).toBe(3); // unchanged
      expect(result.easeFactor).toBe(2.35);
      expect(result.easy).toBe(false);
    });

    it('should handle "good" rating correctly', () => {
      const card = createTestCard({ repetitions: 2, interval: 3, easeFactor: 2.5 });
      const result = reviewCard(card, 'good');

      expect(result.interval).toBe(8); // 3 * 2.5 = 7.5, rounded to 8
      expect(result.repetitions).toBe(3);
      expect(result.easeFactor).toBe(2.5); // unchanged
      expect(result.easy).toBe(false);
    });

    it('should handle "easy" rating correctly', () => {
      const card = createTestCard({ repetitions: 1, interval: 2, easeFactor: 2.5 });
      const result = reviewCard(card, 'easy');

      expect(result.interval).toBe(8); // 2 * 2.5 * 1.3 = 6.5, rounded to 7, but minimum is 1
      expect(result.repetitions).toBe(2);
      expect(result.easeFactor).toBe(2.65);
      expect(result.easy).toBe(true);
    });

    it('should maintain minimum ease factor', () => {
      const card = createTestCard({ easeFactor: 1.3 });
      const result = reviewCard(card, 'again');

      expect(result.easeFactor).toBe(1.3); // Should not go below minimum
    });

    it('should update due date correctly', () => {
      const now = Date.now();
      const card = createTestCard({ dueDate: now });
      const result = reviewCard(card, 'good');

      expect(result.dueDate).toBeGreaterThan(now);
    });
  });

  describe('isCardDue', () => {
    it('should return true for overdue cards', () => {
      const card = createTestCard({ dueDate: Date.now() - 86400000 }); // 1 day ago
      expect(isCardDue(card)).toBe(true);
    });

    it('should return true for cards due now', () => {
      const card = createTestCard({ dueDate: Date.now() });
      expect(isCardDue(card)).toBe(true);
    });

    it('should return false for future cards', () => {
      const card = createTestCard({ dueDate: Date.now() + 86400000 }); // 1 day from now
      expect(isCardDue(card)).toBe(false);
    });
  });

  describe('calculateStats', () => {
    it('should calculate correct statistics', () => {
      const cards: Flashcard[] = [
        createTestCard({ easy: true, interval: 5 }),
        createTestCard({ easy: false, interval: 3 }),
        createTestCard({ easy: true, interval: 7 }),
        createTestCard({ easy: false, interval: 2 }),
      ];

      const stats = calculateStats(cards);

      expect(stats.total).toBe(4);
      expect(stats.learned).toBe(2);
      expect(stats.learningProgress).toBe(50);
      expect(stats.averageInterval).toBe(4.25);
      expect(stats.averageEaseFactor).toBe(2.5);
    });

    it('should handle empty array', () => {
      const stats = calculateStats([]);

      expect(stats.total).toBe(0);
      expect(stats.learned).toBe(0);
      expect(stats.learningProgress).toBe(0);
      expect(stats.averageInterval).toBe(0);
      expect(stats.averageEaseFactor).toBe(0);
    });
  });

  describe('createFlashcard', () => {
    it('should create flashcard with correct defaults', () => {
      const card = createFlashcard('Test question?', 'Test answer');

      expect(card.question).toBe('Test question?');
      expect(card.answer).toBe('Test answer');
      expect(card.repetitions).toBe(0);
      expect(card.easeFactor).toBe(2.5);
      expect(card.interval).toBe(0);
      expect(card.easy).toBe(false);
      expect(card.id).toBeDefined();
      expect(card.createdAt).toBeDefined();
    });
  });
}); 