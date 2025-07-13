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
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.message || `HTTP ${response.status}`,
          errorData.code || 'UNKNOWN_ERROR',
          response.status,
          errorData.details
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

  async generateFlashcards(request: GenerateRequest): Promise<GenerateResponse> {
    try {
      const response = await this.request<{ success: boolean; data: GenerateResponse }>('/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
      
      if (response.success) {
        return response.data;
      } else {
        throw new ApiError('API returned unsuccessful response', 'API_ERROR');
      }
    } catch (error) {
      // If API is unavailable, use fallback
      console.warn('API unavailable, using fallback flashcards:', error);
      return generateFallbackFlashcards(request.notes);
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
    maxRetries: number = 3
  ): Promise<GenerateResponse> {
    let lastError: ApiError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateFlashcards(request);
      } catch (error) {
        lastError = error as ApiError;
        
        if (attempt === maxRetries) {
          // On final attempt, use fallback instead of throwing
          console.warn('All retries failed, using fallback flashcards');
          return generateFallbackFlashcards(request.notes);
        }

        // Exponential backoff
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }

    // This should never be reached due to fallback above, but just in case
    return generateFallbackFlashcards(request.notes);
  }
}

export const apiService = new ApiService();
export { ApiError }; 