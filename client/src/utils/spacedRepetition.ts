import type { Flashcard, Rating } from '../types';

// Constants for SM-2 algorithm
const INITIAL_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SuperMemo 2 (SM-2) spaced repetition algorithm
 * Based on the original SuperMemo algorithm by Piotr Wozniak
 * 
 * @param card - The flashcard to review
 * @param rating - User's rating of the card (again, hard, good, easy)
 * @returns Updated flashcard with new interval, ease factor, and due date
 */
export function reviewCard(card: Flashcard, rating: Rating): Flashcard {
  const updated = { ...card };

  switch (rating) {
    case 'again':
      // Reset to beginning, decrease ease factor
      updated.interval = 1;
      updated.repetitions = 0;
      updated.easeFactor = Math.max(MIN_EASE_FACTOR, updated.easeFactor - 0.2);
      break;

    case 'hard':
      // Small interval increase, decrease ease factor
      updated.interval = Math.max(1, Math.round(updated.interval * 1.2));
      updated.easeFactor = Math.max(MIN_EASE_FACTOR, updated.easeFactor - 0.15);
      break;

    case 'good':
      // Normal interval increase, maintain ease factor
      updated.repetitions += 1;
      updated.interval = Math.max(1, Math.round(updated.interval * updated.easeFactor));
      break;

    case 'easy':
      // Large interval increase, increase ease factor
      updated.repetitions += 1;
      updated.easeFactor += 0.15;
      updated.interval = Math.max(1, Math.round(updated.interval * updated.easeFactor * 1.3));
      updated.easy = true;
      break;
  }

  // Calculate new due date
  updated.dueDate = Date.now() + updated.interval * ONE_DAY_MS;
  updated.lastReviewed = Date.now();

  return updated;
}

/**
 * Calculate the next review interval for a card
 * @param card - The flashcard
 * @returns Interval in days
 */
export function getNextInterval(card: Flashcard): number {
  return card.interval;
}

/**
 * Check if a card is due for review
 * @param card - The flashcard
 * @returns True if the card is due
 */
export function isCardDue(card: Flashcard): boolean {
  return card.dueDate <= Date.now();
}

/**
 * Get cards due for review from a deck
 * @param cards - Array of flashcards
 * @returns Array of cards that are due for review
 */
export function getDueCards(cards: Flashcard[]): Flashcard[] {
  return cards.filter(isCardDue);
}

/**
 * Calculate learning statistics for a deck
 * @param cards - Array of flashcards
 * @returns Learning statistics
 */
export function calculateStats(cards: Flashcard[]) {
  const total = cards.length;
  const learned = cards.filter(c => c.easy).length;
  const due = getDueCards(cards).length;
  const averageEaseFactor = cards.reduce((sum, c) => sum + c.easeFactor, 0) / total;
  const averageInterval = cards.reduce((sum, c) => sum + c.interval, 0) / total;

  return {
    total,
    learned,
    due,
    averageEaseFactor,
    averageInterval,
    learningProgress: (learned / total) * 100
  };
}

/**
 * Create a new flashcard with default values
 * @param question - The question text
 * @param answer - The answer text
 * @returns New flashcard
 */
export function createFlashcard(question: string, answer: string): Flashcard {
  return {
    id: crypto.randomUUID(),
    question,
    answer,
    repetitions: 0,
    easeFactor: INITIAL_EASE_FACTOR,
    interval: 0,
    dueDate: Date.now(),
    easy: false,
    createdAt: Date.now(),
  };
} 