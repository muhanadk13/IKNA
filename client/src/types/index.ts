// Core Types
export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  repetitions: number;
  easeFactor: number;
  interval: number;
  dueDate: number;
  easy: boolean;
  createdAt: number;
  lastReviewed?: number;
  tags?: string[];
  source?: string; // The original note or sentence that inspired this card
}

export interface Deck {
  id: string;
  name: string;
  description?: string;
  flashcards: Flashcard[];
  roundOrder: number[];
  index: number;
  round: number;
  roundFinished: boolean;
  finished: boolean;
  ratings: Record<Rating, number>;
  ratingHistory: Rating[];
  createdAt: number;
  lastStudied: number;
  tags?: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  format: 'qa' | 'fill' | 'definition' | 'mcq';
}

export interface User {
  id: string;
  email: string;
  username: string;
  is_verified: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  defaultDifficulty: 'beginner' | 'intermediate' | 'advanced';
  defaultFormat: 'qa' | 'fill' | 'definition' | 'mcq';
  cardsPerDeck: number;
}

export interface StudySession {
  id: string;
  deckId: string;
  startTime: number;
  endTime?: number;
  cardsReviewed: number;
  accuracy: number;
  ratings: Record<Rating, number>;
}

export interface Analytics {
  totalCards: number;
  learnedCards: number;
  dueCards: number;
  totalReviews: number;
  accuracy: number;
  studyStreak: number;
  averageSessionTime: number;
  weeklyProgress: WeeklyProgress[];
}

export interface WeeklyProgress {
  week: string;
  cardsReviewed: number;
  accuracy: number;
  sessions: number;
}

// API Types
export interface GenerateRequest {
  notes: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  count?: number;
  format?: 'qa' | 'fill' | 'definition' | 'mcq';
  tags?: string[];
}

export interface GenerateResponse {
  flashcards: Array<{
    question: string;
    answer: string;
    options?: string[];
  }>;
  metadata: {
    difficulty: string;
    format: string;
    estimatedTime: number;
    count?: number;
    model?: string;
    tokens?: number;
  };
}

export interface ApiError {
  message: string;
  code: string;
  details?: any;
}

// UI Types
export type View = 'home' | 'form' | 'review' | 'edit' | 'stats' | 'settings' | 'profile' | 'study' | 'create';

export interface ModalState {
  isOpen: boolean;
  type: 'edit' | 'delete' | 'export' | 'import' | 'settings' | null;
  data?: any;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
} 

// Authentication types
export interface User {
  id: string;
  email: string;
  username: string;
  is_verified: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
}

export interface PasswordResetData {
  email: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface ProfileUpdateData {
  username?: string;
  email?: string;
} 