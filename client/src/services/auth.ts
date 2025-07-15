import { apiService } from './api';
import type { 
  AuthState, 
  LoginCredentials, 
  RegisterData, 
  PasswordResetData, 
  ChangePasswordData, 
  ProfileUpdateData,
  User 
} from '../types';

class AuthService {
  private static instance: AuthService;
  private authState: AuthState = {
    user: null,
    token: localStorage.getItem('auth_token'),
    isAuthenticated: false,
    isLoading: false
  };

  private listeners: ((state: AuthState) => void)[] = [];

  private constructor() {
    // Check if we have a stored token and validate it
    this.validateStoredToken();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Subscribe to auth state changes
  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    listener(this.authState);
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.authState));
  }

  private setAuthState(updates: Partial<AuthState>): void {
    this.authState = { ...this.authState, ...updates };
    this.notifyListeners();
  }

  // Register new user
  async register(data: RegisterData): Promise<{ user: User; token: string }> {
    this.setAuthState({ isLoading: true });

    try {
      const response = await apiService.post<{ success: boolean; data: { user: User; token: string }; error?: any }>('/api/auth/register', data);
      
      if (response.success) {
        const { user, token } = response.data;
        this.setAuthState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false
        });
        
        localStorage.setItem('auth_token', token);
        return { user, token };
      } else {
        throw new Error(response.error?.message || 'Registration failed');
      }
    } catch (error: any) {
      this.setAuthState({ isLoading: false });
      throw new Error(error.message || 'Registration failed');
    }
  }

  // Login user
  async login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
    this.setAuthState({ isLoading: true });

    try {
      const response = await apiService.post<{ success: boolean; data: { user: User; token: string }; error?: any }>('/api/auth/login', credentials);
      
      if (response.success) {
        const { user, token } = response.data;
        this.setAuthState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false
        });
        
        localStorage.setItem('auth_token', token);
        return { user, token };
      } else {
        throw new Error(response.error?.message || 'Login failed');
      }
    } catch (error: any) {
      this.setAuthState({ isLoading: false });
      throw new Error(error.message || 'Login failed');
    }
  }

  // Logout user
  async logout(): Promise<void> {
    try {
      if (this.authState.token) {
        await apiService.post('/api/auth/logout', {}, {
          headers: { Authorization: `Bearer ${this.authState.token}` }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false
      });
      
      localStorage.removeItem('auth_token');
    }
  }

  // Request password reset
  async requestPasswordReset(data: PasswordResetData): Promise<void> {
    try {
      const response = await apiService.post<{ success: boolean; error?: any }>('/api/auth/forgot-password', data);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Password reset request failed');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Password reset request failed');
    }
  }

  // Reset password
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const response = await apiService.post<{ success: boolean; error?: any }>('/api/auth/reset-password', {
        token,
        newPassword
      });
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Password reset failed');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Password reset failed');
    }
  }

  // Change password
  async changePassword(data: ChangePasswordData): Promise<void> {
    try {
      const response = await apiService.post<{ success: boolean; error?: any }>('/api/auth/change-password', data, {
        headers: { Authorization: `Bearer ${this.authState.token}` }
      });
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Password change failed');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Password change failed');
    }
  }

  // Get user profile
  async getProfile(): Promise<User> {
    try {
      const response = await apiService.get<{ success: boolean; data: { profile: User }; error?: any }>('/api/auth/profile', {
        headers: { Authorization: `Bearer ${this.authState.token}` }
      });
      
      if (response.success) {
        const user = response.data.profile;
        this.setAuthState({ user });
        return user;
      } else {
        throw new Error(response.error?.message || 'Failed to get profile');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get profile');
    }
  }

  // Update user profile
  async updateProfile(data: ProfileUpdateData): Promise<User> {
    try {
      const response = await apiService.put<{ success: boolean; data: { profile: User }; error?: any }>('/api/auth/profile', data, {
        headers: { Authorization: `Bearer ${this.authState.token}` }
      });
      
      if (response.success) {
        const user = response.data.profile;
        this.setAuthState({ user });
        return user;
      } else {
        throw new Error(response.error?.message || 'Profile update failed');
      }
    } catch (error: any) {
      throw new Error(error.message || 'Profile update failed');
    }
  }

  // Delete account
  async deleteAccount(password: string): Promise<void> {
    try {
      const response = await apiService.post<{ success: boolean; error?: any }>('/api/auth/account', { password }, {
        headers: { Authorization: `Bearer ${this.authState.token}` }
      });
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Account deletion failed');
      }
      
      await this.logout();
    } catch (error: any) {
      throw new Error(error.message || 'Account deletion failed');
    }
  }

  // Verify email
  async verifyEmail(token: string): Promise<void> {
    try {
      const response = await apiService.post<{ success: boolean; error?: any }>('/api/auth/verify-email', { token });
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Email verification failed');
      }
      
      // Update user verification status
      if (this.authState.user) {
        this.setAuthState({
          user: { ...this.authState.user, is_verified: true }
        });
      }
    } catch (error: any) {
      throw new Error(error.message || 'Email verification failed');
    }
  }

  // Validate stored token
  private async validateStoredToken(): Promise<void> {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      return;
    }

    try {
      const response = await apiService.get<{ success: boolean; data: { user: User }; error?: any }>('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.success) {
        const { user } = response.data;
        this.setAuthState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false
        });
      } else {
        // Token is invalid, clear it
        localStorage.removeItem('auth_token');
        this.setAuthState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false
        });
      }
    } catch (error) {
      // Token is invalid, clear it
      localStorage.removeItem('auth_token');
      this.setAuthState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  }

  // Get current auth state
  getAuthState(): AuthState {
    return this.authState;
  }

  // Get auth token
  getToken(): string | null {
    return this.authState.token;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  // Check if user is verified
  isVerified(): boolean {
    return this.authState.user?.is_verified || false;
  }
}

export const authService = AuthService.getInstance(); 