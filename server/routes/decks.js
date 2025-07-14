import express from 'express';
import { DeckService } from '../services/decks.js';
import { FlashcardService } from '../services/flashcards.js';
import { authenticateToken, requireVerified } from '../middleware/auth.js';
import { 
  validateCreateDeck, 
  validateUpdateDeck,
  validateGenerate,
  validateUUID,
  validatePagination,
  sanitizeInput,
  createRateLimit
} from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Rate limiting for deck operations
const deckLimiter = createRateLimit(15 * 60 * 1000, 100, 'Too many deck operations');

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireVerified);

// Get all decks for user
router.get('/',
  deckLimiter,
  validatePagination,
  asyncHandler(async (req, res) => {
    const { search, difficulty, sortBy, sortOrder, limit, offset } = req.query;
    
    const decks = await DeckService.getUserDecks(req.user.id, {
      search,
      difficulty,
      sortBy,
      sortOrder,
      limit,
      offset
    });
    
    res.json({
      success: true,
      data: { decks }
    });
  })
);

// Create new deck
router.post('/',
  deckLimiter,
  sanitizeInput,
  validateCreateDeck,
  asyncHandler(async (req, res) => {
    const deck = await DeckService.createDeck(req.user.id, req.body);
    
    res.status(201).json({
      success: true,
      message: 'Deck created successfully',
      data: { deck }
    });
  })
);

// Get specific deck with flashcards
router.get('/:deckId',
  deckLimiter,
  validateUUID('deckId'),
  asyncHandler(async (req, res) => {
    const deck = await DeckService.getDeck(req.user.id, req.params.deckId);
    
    res.json({
      success: true,
      data: { deck }
    });
  })
);

// Update deck
router.put('/:deckId',
  deckLimiter,
  sanitizeInput,
  validateUUID('deckId'),
  validateUpdateDeck,
  asyncHandler(async (req, res) => {
    const deck = await DeckService.updateDeck(req.user.id, req.params.deckId, req.body);
    
    res.json({
      success: true,
      message: 'Deck updated successfully',
      data: { deck }
    });
  })
);

// Delete deck
router.delete('/:deckId',
  deckLimiter,
  validateUUID('deckId'),
  asyncHandler(async (req, res) => {
    await DeckService.deleteDeck(req.user.id, req.params.deckId);
    
    res.json({
      success: true,
      message: 'Deck deleted successfully'
    });
  })
);

// Get deck statistics
router.get('/:deckId/stats',
  deckLimiter,
  validateUUID('deckId'),
  asyncHandler(async (req, res) => {
    const stats = await DeckService.getDeckStats(req.user.id, req.params.deckId);
    
    res.json({
      success: true,
      data: { stats }
    });
  })
);

// Get study session for deck
router.get('/:deckId/study',
  deckLimiter,
  validateUUID('deckId'),
  asyncHandler(async (req, res) => {
    const { limit, includeNew, includeDue } = req.query;
    
    const cards = await DeckService.getStudySession(req.user.id, req.params.deckId, {
      limit: parseInt(limit) || 20,
      includeNew: includeNew !== 'false',
      includeDue: includeDue !== 'false'
    });
    
    res.json({
      success: true,
      data: { cards }
    });
  })
);

// Export deck
router.get('/:deckId/export',
  deckLimiter,
  validateUUID('deckId'),
  asyncHandler(async (req, res) => {
    const deckData = await DeckService.exportDeck(req.user.id, req.params.deckId);
    
    res.json({
      success: true,
      data: { deck: deckData }
    });
  })
);

// Import deck
router.post('/import',
  deckLimiter,
  sanitizeInput,
  asyncHandler(async (req, res) => {
    const deck = await DeckService.importDeck(req.user.id, req.body);
    
    res.status(201).json({
      success: true,
      message: 'Deck imported successfully',
      data: { deck }
    });
  })
);

// Generate flashcards for deck
router.post('/:deckId/generate',
  deckLimiter,
  sanitizeInput,
  validateUUID('deckId'),
  validateGenerate,
  asyncHandler(async (req, res) => {
    const { notes, count, difficulty, format, tags } = req.body;
    
    const cards = await FlashcardService.generateFlashcards(req.user.id, req.params.deckId, notes, {
      count,
      difficulty,
      format
    });
    
    res.status(201).json({
      success: true,
      message: `${cards.length} flashcards generated successfully`,
      data: { cards }
    });
  })
);

// Get flashcards for deck
router.get('/:deckId/flashcards',
  deckLimiter,
  validateUUID('deckId'),
  validatePagination,
  asyncHandler(async (req, res) => {
    const { difficulty, status, sortBy, sortOrder, limit, offset } = req.query;
    
    const cards = await FlashcardService.getDeckFlashcards(req.user.id, req.params.deckId, {
      difficulty,
      status,
      sortBy,
      sortOrder,
      limit,
      offset
    });
    
    res.json({
      success: true,
      data: { cards }
    });
  })
);

// Create flashcard in deck
router.post('/:deckId/flashcards',
  deckLimiter,
  sanitizeInput,
  validateUUID('deckId'),
  asyncHandler(async (req, res) => {
    const card = await FlashcardService.createFlashcard(req.user.id, req.params.deckId, req.body);
    
    res.status(201).json({
      success: true,
      message: 'Flashcard created successfully',
      data: { card }
    });
  })
);

// Bulk create flashcards
router.post('/:deckId/flashcards/bulk',
  deckLimiter,
  sanitizeInput,
  validateUUID('deckId'),
  asyncHandler(async (req, res) => {
    const { cards } = req.body;
    
    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Cards array is required and must not be empty',
          code: 'INVALID_CARDS_ARRAY'
        }
      });
    }
    
    const createdCards = await FlashcardService.createFlashcards(req.user.id, req.params.deckId, cards);
    
    res.status(201).json({
      success: true,
      message: `${createdCards.length} flashcards created successfully`,
      data: { cards: createdCards }
    });
  })
);

// Get user's overall study statistics
router.get('/stats/overview',
  deckLimiter,
  asyncHandler(async (req, res) => {
    const stats = await DeckService.getUserStudyStats(req.user.id);
    
    res.json({
      success: true,
      data: { stats }
    });
  })
);

// Search decks
router.get('/search/:term',
  deckLimiter,
  validatePagination,
  asyncHandler(async (req, res) => {
    const { term } = req.params;
    const { limit, offset } = req.query;
    
    const decks = await DeckService.getUserDecks(req.user.id, {
      search: term,
      limit,
      offset
    });
    
    res.json({
      success: true,
      data: { decks }
    });
  })
);

export default router; 