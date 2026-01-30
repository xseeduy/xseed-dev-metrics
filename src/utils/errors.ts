// ============================================
// Custom Error Classes
// ============================================

/**
 * Base error class for application errors
 */
export class AppError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error for configuration-related issues
 */
export class ConfigurationError extends AppError {
  constructor(message: string, code?: string) {
    super(message, code || 'CONFIG_ERROR');
    this.name = 'ConfigurationError';
  }
}

/**
 * Error for validation failures
 */
export class ValidationError extends AppError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Error for integration-related issues (Jira, Linear, Notion)
 */
export class IntegrationError extends AppError {
  constructor(
    message: string,
    public readonly integration: string,
    public readonly statusCode?: number
  ) {
    super(message, 'INTEGRATION_ERROR');
    this.name = 'IntegrationError';
  }
}

/**
 * Error for Git-related operations
 */
export class GitError extends AppError {
  constructor(message: string, public readonly command?: string) {
    super(message, 'GIT_ERROR');
    this.name = 'GitError';
  }
}

/**
 * Error for file system operations
 */
export class FileSystemError extends AppError {
  constructor(message: string, public readonly path?: string) {
    super(message, 'FS_ERROR');
    this.name = 'FileSystemError';
  }
}

/**
 * Error for authentication failures
 */
export class AuthenticationError extends AppError {
  constructor(message: string, public readonly integration?: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

/**
 * Error for rate limiting
 */
export class RateLimitError extends AppError {
  constructor(message: string, public readonly retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

/**
 * Error for network/connection issues
 */
export class NetworkError extends AppError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is a ConfigurationError
 */
export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

/**
 * Type guard to check if error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if error is an IntegrationError
 */
export function isIntegrationError(error: unknown): error is IntegrationError {
  return error instanceof IntegrationError;
}

/**
 * Type guard to check if error is a GitError
 */
export function isGitError(error: unknown): error is GitError {
  return error instanceof GitError;
}

/**
 * Type guard to check if error is an AuthenticationError
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

/**
 * Type guard to check if error is a RateLimitError
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}
