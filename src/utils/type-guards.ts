// ============================================
// Type Guards for Runtime Type Checking
// ============================================

/**
 * Type guard to check if value is an Error
 * @param error - Value to check
 * @returns True if value is an Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard to check if value is a Node.js system error
 * @param error - Value to check
 * @returns True if value is a NodeJS.ErrnoException
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return (
    isError(error) &&
    'code' in error &&
    typeof (error as any).code === 'string'
  );
}

/**
 * Type guard to check if value is an HTTP error with status
 * @param error - Value to check
 * @returns True if value has HTTP error properties
 */
export function isHttpError(error: unknown): error is Error & { status?: number; statusCode?: number } {
  return (
    isError(error) &&
    ('status' in error || 'statusCode' in error)
  );
}

/**
 * Type guard to check if error has a retry-after property
 * @param error - Value to check
 * @returns True if value has retryAfter property
 */
export function hasRetryAfter(error: unknown): error is { retryAfter?: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'retryAfter' in error
  );
}

/**
 * Gets HTTP status code from an error if available
 * @param error - Error to extract status from
 * @returns Status code or undefined
 */
export function getStatusCode(error: unknown): number | undefined {
  if (isHttpError(error)) {
    return (error as any).status || (error as any).statusCode;
  }
  return undefined;
}

/**
 * Gets error message from unknown error type
 * @param error - Error to extract message from
 * @param defaultMessage - Default message if extraction fails
 * @returns Error message
 */
export function getErrorMessage(error: unknown, defaultMessage: string = 'Unknown error'): string {
  if (isError(error)) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as any).message);
  }
  
  return defaultMessage;
}

/**
 * Creates a standardized error object from unknown error
 * @param error - Error to standardize
 * @param context - Additional context
 * @returns Standardized error
 */
export function standardizeError(error: unknown, context?: string): Error {
  if (isError(error)) {
    if (context) {
      error.message = `${context}: ${error.message}`;
    }
    return error;
  }
  
  const message = getErrorMessage(error);
  return new Error(context ? `${context}: ${message}` : message);
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Creates a successful result
 * @param data - Data to wrap
 * @returns Success result
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Creates a failure result
 * @param error - Error to wrap
 * @returns Failure result
 */
export function err<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Wraps a function that may throw into a Result
 * @param fn - Function to wrap
 * @returns Result with function return value or error
 */
export function tryCatch<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn());
  } catch (error: unknown) {
    return err(standardizeError(error));
  }
}

/**
 * Wraps an async function that may throw into a Result
 * @param fn - Async function to wrap
 * @returns Promise of Result with function return value or error
 */
export async function tryCatchAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error: unknown) {
    return err(standardizeError(error));
  }
}
