import express from 'express';
import { FlashcardService } from '../services/flashcards.js';
import { SRSService } from '../services/srs.js';
import { authenticateToken, requireVerified } from '../middleware/auth.js';
import { 
  validateCreateFlashcard, 
  validateUpdateFlashcard,
  validateReview,
  validateUUID,
  validatePagination,
  sanitizeInput,
  createRateLimit
} from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Rate limiting for flashcard operations
const flashcardLimiter = createRateLimit(15 * 60 * 1000, 200, 'Too many flashcard operations');
const reviewLimiter = createRateLimit(60 * 1000, 60, 'Too many review operations'); // 60 reviews per minute

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireVerified);

// Get all flashcards for user
router.get('/',
  flashcardLimiter,
  validatePagination,
  asyncHandler(async (req, res) => {
    const { difficulty, status, sortBy, sortOrder, limit, offset } = req.query;
    
    const cards = await FlashcardService.getDeckFlashcards(req.user.id, null, {
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

// Get flashcards by difficulty
router.get('/difficulty/:difficulty',
  flashcardLimiter,
  validatePagination,
  asyncHandler(async (req, res) => {
    const { difficulty } = req.params;
    const { deckId, limit, offset } = req.query;
    
    const cards = await FlashcardService.getFlashcardsByDifficulty(req.user.id, difficulty, deckId);
    
    res.json({
      success: true,
      data: { cards }
    });
  })
);

// Get due flashcards
router.get('/due',
  flashcardLimiter,
  validatePagination,
  asyncHandler(async (req, res) => {
    const { deckId, limit } = req.query;
    
    const cards = await FlashcardService.getDueFlashcards(req.user.id, deckId, limit);
    
    res.json({
      success: true,
      data: { cards }
    });
  })
);

// Get specific flashcard
router.get('/:flashcardId',
  flashcardLimiter,
  validateUUID('flashcardId'),
  asyncHandler(async (req, res) => {
    const card = await FlashcardService.getFlashcard(req.user.id, req.params.flashcardId);
    
    res.json({
      success: true,
      data: { card }
    });
  })
);

// Create flashcard
router.post('/',
  flashcardLimiter,
  sanitizeInput,
  validateCreateFlashcard,
  asyncHandler(async (req, res) => {
    const { deckId, ...cardData } = req.body;
    
    if (!deckId) {
      return res.status(400).json({
        error: {
          message: 'Deck ID is required',
          code: 'DECK_ID_REQUIRED'
        }
      });
    }
    
    const card = await FlashcardService.createFlashcard(req.user.id, deckId, cardData);
    
    res.status(201).json({
      success: true,
      message: 'Flashcard created successfully',
      data: { card }
    });
  })
);

// Update flashcard
router.put('/:flashcardId',
  flashcardLimiter,
  sanitizeInput,
  validateUUID('flashcardId'),
  validateUpdateFlashcard,
  asyncHandler(async (req, res) => {
    const card = await FlashcardService.updateFlashcard(req.user.id, req.params.flashcardId, req.body);
    
    res.json({
      success: true,
      message: 'Flashcard updated successfully',
      data: { card }
    });
  })
);

// Delete flashcard
router.delete('/:flashcardId',
  flashcardLimiter,
  validateUUID('flashcardId'),
  asyncHandler(async (req, res) => {
    await FlashcardService.deleteFlashcard(req.user.id, req.params.flashcardId);
    
    res.json({
      success: true,
      message: 'Flashcard deleted successfully'
    });
  })
);

// Review flashcard
router.post('/:flashcardId/review',
  reviewLimiter,
  sanitizeInput,
  validateUUID('flashcardId'),
  validateReview,
  asyncHandler(async (req, res) => {
    const { rating, responseTimeMs } = req.body;
    
    const updatedCard = await FlashcardService.reviewFlashcard(
      req.user.id, 
      req.params.flashcardId, 
      rating, 
      responseTimeMs
    );
    
    res.json({
      success: true,
      message: 'Review recorded successfully',
      data: { card: updatedCard }
    });
  })
);

// Reset flashcard progress
router.post('/:flashcardId/reset',
  flashcardLimiter,
  validateUUID('flashcardId'),
  asyncHandler(async (req, res) => {
    const card = await FlashcardService.resetFlashcard(req.user.id, req.params.flashcardId);
    
    res.json({
      success: true,
      message: 'Flashcard progress reset successfully',
      data: { card }
    });
  })
);

// Get flashcard statistics
router.get('/stats/overview',
  flashcardLimiter,
  asyncHandler(async (req, res) => {
    const { deckId } = req.query;
    
    const stats = await FlashcardService.getFlashcardStats(req.user.id, deckId);
    
    res.json({
      success: true,
      data: { stats }
    });
  })
);

// Search flashcards
router.get('/search/:term',
  flashcardLimiter,
  validatePagination,
  asyncHandler(async (req, res) => {
    const { term } = req.params;
    const { deckId, limit, offset } = req.query;
    
    const cards = await FlashcardService.searchFlashcards(req.user.id, term, {
      deckId,
      limit,
      offset
    });
    
    res.json({
      success: true,
      data: { cards }
    });
  })
);

// Bulk update flashcards
router.put('/bulk/update',
  flashcardLimiter,
  sanitizeInput,
  asyncHandler(async (req, res) => {
    const { flashcardIds, updates } = req.body;
    
    if (!Array.isArray(flashcardIds) || flashcardIds.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Flashcard IDs array is required and must not be empty',
          code: 'INVALID_FLASHCARD_IDS'
        }
      });
    }
    
    const updatedCards = await FlashcardService.bulkUpdateFlashcards(req.user.id, flashcardIds, updates);
    
    res.json({
      success: true,
      message: `${updatedCards.length} flashcards updated successfully`,
      data: { cards: updatedCards }
    });
  })
);

// Bulk delete flashcards
router.delete('/bulk/delete',
  flashcardLimiter,
  sanitizeInput,
  asyncHandler(async (req, res) => {
    const { flashcardIds } = req.body;
    
    if (!Array.isArray(flashcardIds) || flashcardIds.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Flashcard IDs array is required and must not be empty',
          code: 'INVALID_FLASHCARD_IDS'
        }
      });
    }
    
    const result = await FlashcardService.bulkDeleteFlashcards(req.user.id, flashcardIds);
    
    res.json({
      success: true,
      message: `${result.deleted_count} flashcards deleted successfully`,
      data: result
    });
  })
);

// Get SRS study statistics
router.get('/srs/stats',
  flashcardLimiter,
  asyncHandler(async (req, res) => {
    const stats = await SRSService.getStudyStats(req.user.id);
    
    res.json({
      success: true,
      data: { stats }
    });
  })
);

// Get learning progress
router.get('/srs/progress',
  flashcardLimiter,
  asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    
    const progress = await SRSService.getLearningProgress(req.user.id, parseInt(days));
    
    res.json({
      success: true,
      data: { progress }
    });
  })
);

// Get cards due today
router.get('/srs/due-today',
  flashcardLimiter,
  asyncHandler(async (req, res) => {
    const cards = await SRSService.getCardsDueToday(req.user.id);
    
    res.json({
      success: true,
      data: { cards }
    });
  })
);

export default router; 