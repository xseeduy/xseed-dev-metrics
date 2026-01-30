// ============================================
// Secret Masking Utilities
// ============================================

/**
 * Masks a secret string, showing only first/last few characters
 * @param secret - The secret to mask
 * @param visibleChars - Number of characters to show at start and end
 * @returns Masked string
 */
export function maskSecret(secret: string | undefined, visibleChars: number = 4): string {
  if (!secret || typeof secret !== 'string') {
    return '***';
  }

  if (secret.length <= visibleChars * 2) {
    return '*'.repeat(secret.length);
  }

  const start = secret.substring(0, visibleChars);
  const end = secret.substring(secret.length - visibleChars);
  const masked = '*'.repeat(Math.max(8, secret.length - visibleChars * 2));

  return `${start}${masked}${end}`;
}

/**
 * Masks an email address, showing first few chars and domain
 * @param email - The email to mask
 * @returns Masked email
 */
export function maskEmail(email: string | undefined): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '***@***.***';
  }

  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 3 
    ? local.substring(0, 3) + '*'.repeat(Math.max(3, local.length - 3))
    : '*'.repeat(local.length);

  return `${maskedLocal}@${domain}`;
}

/**
 * Masks a URL, hiding auth credentials if present
 * @param url - The URL to mask
 * @returns Masked URL
 */
export function maskUrl(url: string | undefined): string {
  if (!url || typeof url !== 'string') {
    return 'https://***';
  }

  try {
    const parsed = new URL(url);
    // Remove username and password
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Redacts sensitive fields from an object for logging
 * @param obj - Object to redact
 * @param sensitiveFields - Array of field names to redact
 * @returns Redacted object
 */
export function redactSensitiveFields<T extends Record<string, any>>(
  obj: T,
  sensitiveFields: string[] = ['token', 'apiKey', 'password', 'secret', 'key', 'authorization']
): Record<string, any> {
  const redacted: Record<string, any> = { ...obj };

  for (const field of sensitiveFields) {
    if (field in redacted) {
      redacted[field] = maskSecret(redacted[field]);
    }
  }

  return redacted;
}

/**
 * Checks if a string appears to be a secret (API key, token, etc.)
 * @param value - String to check
 * @returns True if appears to be a secret
 */
export function isLikelySecret(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Common patterns for secrets
  const secretPatterns = [
    /^[a-z0-9]{32,}$/i, // Long hex/base64-like strings
    /^sk_[a-z0-9_]+$/i, // Stripe-style keys
    /^lin_[a-z0-9_]+$/i, // Linear API keys
    /^secret_[a-z0-9_]+$/i, // Notion secrets
    /^ghp_[a-z0-9]+$/i, // GitHub personal access tokens
    /^xox[a-z]-[a-z0-9-]+$/i, // Slack tokens
  ];

  return secretPatterns.some(pattern => pattern.test(value));
}

/**
 * Sanitizes a log message by masking likely secrets
 * @param message - Message to sanitize
 * @returns Sanitized message
 */
export function sanitizeLogMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    return message;
  }

  let sanitized = message;

  // Mask common secret patterns
  sanitized = sanitized.replace(
    /[a-f0-9]{32,}/gi,
    (match) => maskSecret(match, 4)
  );

  // Mask JWT tokens
  sanitized = sanitized.replace(
    /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
    'eyJ***.***.***'
  );

  // Mask authorization headers
  sanitized = sanitized.replace(
    /(Bearer|Basic)\s+[A-Za-z0-9+/=_-]+/gi,
    '$1 ***'
  );

  return sanitized;
}
