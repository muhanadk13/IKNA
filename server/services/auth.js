import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import redisClient from '../config/redis.js';

export class AuthService {
  // Register new user
  static async register(userData) {
    const { email, username, password } = userData;
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [email, username]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User already exists');
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const result = await client.query(`
        INSERT INTO users (email, username, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, email, username, created_at
      `, [email, username, passwordHash]);

      const user = result.rows[0];

      // Generate verification token
      const verificationToken = uuidv4();
      await client.query(`
        UPDATE users 
        SET reset_token = $1, reset_token_expires = NOW() + INTERVAL '24 hours'
        WHERE id = $2
      `, [verificationToken, user.id]);

      await client.query('COMMIT');

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          created_at: user.created_at
        },
        verification_token: verificationToken
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Login user
  static async login(credentials) {
    const { email, password } = credentials;
    
    const client = await pool.connect();
    
    try {
      // Get user
      const result = await client.query(`
        SELECT id, email, username, password_hash, is_active, is_verified, 
               failed_login_attempts, locked_until
        FROM users WHERE email = $1
      `, [email]);

      if (result.rows.length === 0) {
        throw new Error('Invalid credentials');
      }

      const user = result.rows[0];

      // Check if account is locked
      if (user.locked_until && new Date() < user.locked_until) {
        throw new Error('Account is temporarily locked');
      }

      if (!user.is_active) {
        throw new Error('Account is deactivated');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        // Increment failed login attempts
        await client.query(`
          UPDATE users 
          SET failed_login_attempts = failed_login_attempts + 1,
              locked_until = CASE 
                WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL '15 minutes'
                ELSE locked_until
              END
          WHERE id = $1
        `, [user.id]);

        throw new Error('Invalid credentials');
      }

      // Reset failed login attempts on successful login
      await client.query(`
        UPDATE users 
        SET failed_login_attempts = 0, locked_until = NULL
        WHERE id = $1
      `, [user.id]);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Store session in Redis
      const sessionKey = `session:${user.id}`;
      await redisClient.setEx(sessionKey, 7 * 24 * 60 * 60, JSON.stringify({
        userId: user.id,
        email: user.email,
        username: user.username
      }));

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          is_verified: user.is_verified
        },
        token
      };

    } finally {
      client.release();
    }
  }

  // Logout user
  static async logout(userId, token) {
    // Blacklist token in Redis
    await redisClient.setEx(`blacklist:${token}`, 7 * 24 * 60 * 60, 'true');
    
    // Remove session from Redis
    await redisClient.del(`session:${userId}`);
    
    return { success: true };
  }

  // Verify email
  static async verifyEmail(token) {
    const result = await pool.query(`
      UPDATE users 
      SET is_verified = true, reset_token = NULL, reset_token_expires = NULL
      WHERE reset_token = $1 AND reset_token_expires > NOW()
      RETURNING id, email, username
    `, [token]);

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired verification token');
    }

    return result.rows[0];
  }

  // Request password reset
  static async requestPasswordReset(email) {
    const resetToken = uuidv4();
    
    const result = await pool.query(`
      UPDATE users 
      SET reset_token = $1, reset_token_expires = NOW() + INTERVAL '1 hour'
      WHERE email = $2
      RETURNING id, email, username
    `, [resetToken, email]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return {
      user: result.rows[0],
      reset_token: resetToken
    };
  }

  // Reset password
  static async resetPassword(token, newPassword) {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    const result = await pool.query(`
      UPDATE users 
      SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL
      WHERE reset_token = $2 AND reset_token_expires > NOW()
      RETURNING id, email, username
    `, [passwordHash, token]);

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired reset token');
    }

    return result.rows[0];
  }

  // Change password
  static async changePassword(userId, currentPassword, newPassword) {
    // Get current password hash
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.query(`
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `, [passwordHash, userId]);

    return { success: true };
  }

  // Refresh token
  static async refreshToken(userId) {
    const userResult = await pool.query(`
      SELECT id, email, username, is_active, is_verified
      FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Generate new token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        is_verified: user.is_verified
      },
      token
    };
  }

  // Get user profile
  static async getUserProfile(userId) {
    const result = await pool.query(`
      SELECT id, email, username, is_verified, created_at, updated_at
      FROM users WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  }

  // Update user profile
  static async updateUserProfile(userId, updates) {
    const allowedFields = ['username', 'email'];
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
    values.push(userId);

    const result = await pool.query(`
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, username, is_verified, created_at, updated_at
    `, values);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  }

  // Delete user account
  static async deleteAccount(userId, password) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify password
      const userResult = await client.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);
      if (!isValidPassword) {
        throw new Error('Password is incorrect');
      }

      // Delete user (cascade will handle related data)
      await client.query('DELETE FROM users WHERE id = $1', [userId]);

      await client.query('COMMIT');
      return { success: true };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} 