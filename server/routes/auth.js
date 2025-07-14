import express from 'express';
import { AuthService } from '../services/auth.js';
import { authenticateToken } from '../middleware/auth.js';
import { 
  validateRegister, 
  validateLogin, 
  validateChangePassword, 
  validateResetPassword,
  sanitizeInput,
  createRateLimit,
  speedLimiter
} from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = createRateLimit(15 * 60 * 1000, 5, 'Too many authentication attempts');
const registerLimiter = createRateLimit(60 * 60 * 1000, 3, 'Too many registration attempts');

// Register new user
router.post('/register', 
  registerLimiter,
  speedLimiter,
  sanitizeInput,
  validateRegister,
  asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;
    
    const result = await AuthService.register({ email, username, password });
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
      data: {
        user: result.user,
        verification_token: result.verification_token
      }
    });
  })
);

// Login user
router.post('/login',
  authLimiter,
  speedLimiter,
  sanitizeInput,
  validateLogin,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    const result = await AuthService.login({ email, password });
    
    res.json({
      success: true,
      message: 'Login successful',
      data: result
    });
  })
);

// Logout user
router.post('/logout',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    await AuthService.logout(req.user.id, token);
    
    res.json({
      success: true,
      message: 'Logout successful'
    });
  })
);

// Verify email
router.post('/verify-email',
  sanitizeInput,
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    
    const user = await AuthService.verifyEmail(token);
    
    res.json({
      success: true,
      message: 'Email verified successfully',
      data: { user }
    });
  })
);

// Request password reset
router.post('/forgot-password',
  authLimiter,
  sanitizeInput,
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        error: {
          message: 'Email is required',
          code: 'EMAIL_REQUIRED'
        }
      });
    }
    
    const result = await AuthService.requestPasswordReset(email);
    
    res.json({
      success: true,
      message: 'Password reset email sent',
      data: {
        user: result.user,
        reset_token: result.reset_token
      }
    });
  })
);

// Reset password
router.post('/reset-password',
  authLimiter,
  sanitizeInput,
  validateResetPassword,
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    
    const user = await AuthService.resetPassword(token, newPassword);
    
    res.json({
      success: true,
      message: 'Password reset successfully',
      data: { user }
    });
  })
);

// Change password
router.post('/change-password',
  authenticateToken,
  sanitizeInput,
  validateChangePassword,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    await AuthService.changePassword(req.user.id, currentPassword, newPassword);
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  })
);

// Refresh token
router.post('/refresh',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const result = await AuthService.refreshToken(req.user.id);
    
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: result
    });
  })
);

// Get user profile
router.get('/profile',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const profile = await AuthService.getUserProfile(req.user.id);
    
    res.json({
      success: true,
      data: { profile }
    });
  })
);

// Update user profile
router.put('/profile',
  authenticateToken,
  sanitizeInput,
  asyncHandler(async (req, res) => {
    const profile = await AuthService.updateUserProfile(req.user.id, req.body);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { profile }
    });
  })
);

// Delete account
router.delete('/account',
  authenticateToken,
  sanitizeInput,
  asyncHandler(async (req, res) => {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        error: {
          message: 'Password is required to delete account',
          code: 'PASSWORD_REQUIRED'
        }
      });
    }
    
    await AuthService.deleteAccount(req.user.id, password);
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  })
);

// Check authentication status
router.get('/me',
  authenticateToken,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          username: req.user.username,
          is_verified: req.user.is_verified
        }
      }
    });
  })
);

export default router; 