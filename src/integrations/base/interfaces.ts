// ============================================
// Base Integration Interfaces
// ============================================

/**
 * Connection test result
 */
export interface ConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
  user?: string;
}

/**
 * Generic fetch options for integration clients
 */
export interface FetchOptions {
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Base interface for all integration clients
 */
export interface IIntegrationClient {
  /**
   * Tests the connection to the integration service
   * @returns Promise with connection result
   */
  testConnection(): Promise<ConnectionResult>;
}

/**
 * Base interface for issue tracking integrations (Jira, Linear)
 */
export interface IIssueTrackingClient extends IIntegrationClient {
  /**
   * Fetches issues from the integration
   * @param options - Fetch options (filters, pagination)
   * @returns Promise with array of issues
   */
  fetchIssues(options: FetchOptions): Promise<any[]>;
}

/**
 * Retry strategy configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Whether to retry on specific HTTP status codes */
  retryOnStatus?: number[];
}

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  /** Base URL for API */
  baseUrl: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** Custom headers */
  headers?: Record<string, string>;
}
