import type { GenerateRequest, GenerateResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Fallback flashcard generation when API is unavailable
const generateFallbackFlashcards = (notes: string): GenerateResponse => {
  const sampleFlashcards = [
    {
      question: "What is the main concept from your notes?",
      answer: "Based on your notes, this would be the key concept or definition."
    },
    {
      question: "How would you explain this topic to someone else?",
      answer: "A clear, concise explanation of the main points from your notes."
    },
    {
      question: "What are the key points or steps involved?",
      answer: "The main points, steps, or components described in your notes."
    },
    {
      question: "What is the significance or importance of this topic?",
      answer: "Why this topic matters and its practical applications or implications."
    },
    {
      question: "What are the common misconceptions about this topic?",
      answer: "Important clarifications or corrections about this subject."
    },
    {
      question: "How does this relate to other concepts you've learned?",
      answer: "Connections and relationships with other topics or concepts."
    },
    {
      question: "What are the practical applications of this knowledge?",
      answer: "Real-world uses and applications of this information."
    },
    {
      question: "What questions might someone have about this topic?",
      answer: "Common questions and their answers based on your notes."
    }
  ];

  return {
    flashcards: sampleFlashcards,
    metadata: {
      difficulty: 'beginner',
      format: 'qa',
      count: sampleFlashcards.length,
      estimatedTime: 240, // 4 minutes
      model: 'fallback',
      tokens: 0,
    }
  };
};

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.headers) {
      if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => { headers[key] = value; });
      } else if (typeof options.headers === 'object' && !(options.headers instanceof Headers)) {
        headers = { ...headers, ...options.headers };
      }
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const config: RequestInit = {
      ...options,
      headers,
    };
    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error?.message || errorData.message || `HTTP ${response.status}`,
          errorData.error?.code || errorData.code || 'UNKNOWN_ERROR',
          response.status,
          errorData.error?.details || errorData.details
        );
      }
      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'Network error',
        'NETWORK_ERROR',
        0,
        error
      );
    }
  }

  // General HTTP methods for authentication and other API calls
  async get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', ...options });
  }

  async post<T>(endpoint: string, data?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  async put<T>(endpoint: string, data?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    });
  }

  async delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', ...options });
  }

  async generateFlashcards(request: GenerateRequest, token?: string): Promise<GenerateResponse> {
    try {
      console.log('Attempting to generate flashcards with API...');
      const response = await this.request<{ success: boolean; data: GenerateResponse }>('/api/flashcards/generate', {
        method: 'POST',
        body: JSON.stringify(request),
      }, token);
      if (response.success) {
        console.log('Successfully generated flashcards via API');
        return response.data;
      } else {
        throw new ApiError('API returned unsuccessful response', 'API_ERROR');
      }
    } catch (error) {
      console.error('API error details:', error);
      if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
        console.warn('API unavailable, using fallback flashcards:', error);
        return generateFallbackFlashcards(request.notes);
      }
      throw error;
    }
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      return await this.request<{ status: string; timestamp: string }>('/health');
    } catch (error) {
      return { status: 'unavailable', timestamp: new Date().toISOString() };
    }
  }

  // Retry logic for critical operations
  async generateWithRetry(
    request: GenerateRequest,
    token?: string,
    maxRetries: number = 3
  ): Promise<GenerateResponse> {
    let lastError: ApiError | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries} to generate flashcards...`);
        return await this.generateFlashcards(request, token);
      } catch (error) {
        lastError = error as ApiError;
        console.error(`Attempt ${attempt} failed:`, error);
        if (error instanceof ApiError && 
            (error.code === 'API_ERROR' || error.message.includes('API key'))) {
          console.error('API configuration error, not retrying:', error);
          throw error;
        }
        if (attempt === maxRetries) {
          if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
            console.warn('All retries failed due to network issues, using fallback flashcards');
            return generateFallbackFlashcards(request.notes);
          } else {
            throw lastError;
          }
        }
      }
    }
    throw lastError;
  }
}

export const apiService = new ApiService();
export { ApiError }; 