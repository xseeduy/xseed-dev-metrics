// ============================================
// Base HTTP Client with Retry Logic
// ============================================

import { HttpClientConfig, RetryConfig } from './interfaces';
import { RETRY } from '../../config/constants';
import { NetworkError, RateLimitError, AuthenticationError } from '../../utils/errors';
import { isHttpError, getStatusCode, getErrorMessage } from '../../utils/type-guards';
import logger from '../../utils/logger';

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: RETRY.MAX_ATTEMPTS,
  baseDelay: RETRY.BASE_DELAY_MS,
  maxDelay: RETRY.MAX_DELAY_MS,
  backoffMultiplier: RETRY.BACKOFF_MULTIPLIER,
  retryOnStatus: [429, 500, 502, 503, 504],
};

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Base HTTP client with retry and error handling
 */
export class BaseHttpClient {
  protected readonly baseUrl: string;
  protected readonly timeout: number;
  protected readonly retryConfig: RetryConfig;
  protected readonly headers: Record<string, string>;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || 30000;
    this.headers = config.headers || {};
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...config.retry,
    };
  }

  /**
   * Makes an HTTP request with retry logic
   * @param url - URL to request
   * @param options - Fetch options
   * @returns Response data
   * @protected
   */
  protected async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    };

    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      try {
        logger.debug(`HTTP ${options.method || 'GET'} ${fullUrl} (attempt ${attempt + 1}/${this.retryConfig.maxAttempts})`);
        
        const response = await this.fetchWithTimeout(fullUrl, requestOptions);
        
        // Handle specific status codes
        if (!response.ok) {
          await this.handleErrorResponse(response, attempt);
        }
        
        // Parse response
        const text = await response.text();
        return text ? JSON.parse(text) as T : ({} as T);
        
      } catch (error: unknown) {
        lastError = this.standardizeError(error);
        
        // Don't retry on authentication errors
        if (lastError instanceof AuthenticationError) {
          throw lastError;
        }
        
        // Don't retry if this is the last attempt
        if (attempt === this.retryConfig.maxAttempts - 1) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
          this.retryConfig.maxDelay
        );
        
        logger.warn(`Request failed (attempt ${attempt + 1}), retrying in ${delay}ms...`, {
          error: getErrorMessage(error),
        });
        
        await sleep(delay);
      }
    }
    
    // All retries exhausted
    throw lastError || new NetworkError('Request failed after all retries');
  }

  /**
   * Fetch with timeout
   * @param url - URL to fetch
   * @param options - Fetch options
   * @returns Response
   * @private
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handles error responses
   * @param response - HTTP response
   * @param attempt - Current attempt number
   * @throws Error based on status code
   * @private
   */
  private async handleErrorResponse(response: Response, attempt: number): Promise<void> {
    const status = response.status;
    
    // Authentication errors (don't retry)
    if (status === 401 || status === 403) {
      throw new AuthenticationError(
        `Authentication failed: ${response.statusText}`,
        this.baseUrl
      );
    }
    
    // Rate limiting
    if (status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      throw new RateLimitError(
        `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
        retryAfter
      );
    }
    
    // Server errors (retry if configured)
    if (status >= 500 && this.retryConfig.retryOnStatus?.includes(status)) {
      throw new NetworkError(`Server error: ${status} ${response.statusText}`);
    }
    
    // Other errors (don't retry)
    let errorMessage = `HTTP ${status}: ${response.statusText}`;
    try {
      const errorBody = await response.json() as { message?: string };
      if (errorBody.message) {
        errorMessage += ` - ${errorBody.message}`;
      }
    } catch {
      // Ignore JSON parse errors
    }
    
    throw new NetworkError(errorMessage);
  }

  /**
   * Standardizes errors into known error types
   * @param error - Unknown error
   * @returns Standardized error
   * @private
   */
  private standardizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    
    if (typeof error === 'string') {
      return new NetworkError(error);
    }
    
    return new NetworkError('Unknown error occurred');
  }

  /**
   * GET request
   * @param url - URL to request
   * @param headers - Optional additional headers
   * @returns Response data
   */
  protected async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(url, {
      method: 'GET',
      headers,
    });
  }

  /**
   * POST request
   * @param url - URL to request
   * @param body - Request body
   * @param headers - Optional additional headers
   * @returns Response data
   */
  protected async post<T>(
    url: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * PUT request
   * @param url - URL to request
   * @param body - Request body
   * @param headers - Optional additional headers
   * @returns Response data
   */
  protected async put<T>(
    url: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * DELETE request
   * @param url - URL to request
   * @param headers - Optional additional headers
   * @returns Response data
   */
  protected async delete<T>(url: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(url, {
      method: 'DELETE',
      headers,
    });
  }
}
