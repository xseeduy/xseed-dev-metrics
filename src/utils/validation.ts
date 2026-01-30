// ============================================
// Validation Utilities
// ============================================

/**
 * Validation result for operations that can fail
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates URL format
 * @param url - URL string to validate
 * @returns Validation result with error message if invalid
 */
export function validateUrl(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validates email format
 * @param email - Email string to validate
 * @returns Validation result with error message if invalid
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

/**
 * Validates API key format (non-empty string with minimum length)
 * @param apiKey - API key to validate
 * @param minLength - Minimum length (default: 10)
 * @returns Validation result with error message if invalid
 */
export function validateApiKey(apiKey: string, minLength: number = 10): ValidationResult {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: 'API key is required' };
  }

  if (apiKey.length < minLength) {
    return { valid: false, error: `API key must be at least ${minLength} characters` };
  }

  return { valid: true };
}

/**
 * Validates branch name format
 * @param branch - Branch name to validate
 * @returns Validation result with error message if invalid
 */
export function validateBranchName(branch: string): ValidationResult {
  if (!branch || typeof branch !== 'string') {
    return { valid: false, error: 'Branch name is required' };
  }

  // Git branch name rules: no spaces, no special chars except / - _ .
  const branchRegex = /^[a-zA-Z0-9/_.-]+$/;
  if (!branchRegex.test(branch)) {
    return { valid: false, error: 'Invalid branch name format' };
  }

  // Cannot start with . or /
  if (branch.startsWith('.') || branch.startsWith('/')) {
    return { valid: false, error: 'Branch name cannot start with . or /' };
  }

  return { valid: true };
}

/**
 * Validates file path (checks if non-empty string)
 * @param path - File path to validate
 * @returns Validation result with error message if invalid
 */
export function validateFilePath(path: string): ValidationResult {
  if (!path || typeof path !== 'string') {
    return { valid: false, error: 'File path is required' };
  }

  if (path.trim().length === 0) {
    return { valid: false, error: 'File path cannot be empty' };
  }

  return { valid: true };
}

/**
 * Validates project key format (alphanumeric with optional hyphens/underscores)
 * @param key - Project key to validate
 * @returns Validation result with error message if invalid
 */
export function validateProjectKey(key: string): ValidationResult {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Project key is required' };
  }

  const keyRegex = /^[A-Z0-9_-]+$/;
  if (!keyRegex.test(key)) {
    return { valid: false, error: 'Project key must contain only uppercase letters, numbers, hyphens, and underscores' };
  }

  return { valid: true };
}

/**
 * Validates that a string is non-empty
 * @param value - String value to validate
 * @param fieldName - Name of field for error message
 * @returns Validation result with error message if invalid
 */
export function validateNonEmpty(value: string, fieldName: string = 'Field'): ValidationResult {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    return { valid: false, error: `${fieldName} is required and cannot be empty` };
  }

  return { valid: true };
}

/**
 * Validates cron time format (HH:MM)
 * @param time - Time string to validate
 * @returns Validation result with error message if invalid
 */
export function validateTimeFormat(time: string): ValidationResult {
  if (!time || typeof time !== 'string') {
    return { valid: false, error: 'Time is required' };
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(time)) {
    return { valid: false, error: 'Time must be in HH:MM format (e.g., 09:00)' };
  }

  return { valid: true };
}

/**
 * Validates day of week (0-6)
 * @param day - Day number to validate
 * @returns Validation result with error message if invalid
 */
export function validateDayOfWeek(day: number): ValidationResult {
  if (typeof day !== 'number' || day < 0 || day > 6) {
    return { valid: false, error: 'Day of week must be a number between 0 (Sunday) and 6 (Saturday)' };
  }

  return { valid: true };
}
