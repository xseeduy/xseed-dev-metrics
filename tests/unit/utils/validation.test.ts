// ============================================
// Validation Utilities Tests
// ============================================

import { describe, it, expect } from 'vitest';
import {
  validateUrl,
  validateEmail,
  validateApiKey,
  validateBranchName,
  validateFilePath,
  validateTimeFormat,
  validateDayOfWeek,
} from '../../../src/utils/validation';

describe('Validation Utilities', () => {
  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      expect(validateUrl('https://example.com')).toEqual({ valid: true });
      expect(validateUrl('http://localhost:3000')).toEqual({ valid: true });
    });

    it('should reject invalid URLs', () => {
      const result = validateUrl('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject non-http(s) protocols', () => {
      const result = validateUrl('ftp://example.com');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('http or https');
    });

    it('should reject empty strings', () => {
      const result = validateUrl('');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toEqual({ valid: true });
      expect(validateEmail('user.name+tag@domain.co.uk')).toEqual({ valid: true });
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('notanemail').valid).toBe(false);
      expect(validateEmail('@example.com').valid).toBe(false);
      expect(validateEmail('test@').valid).toBe(false);
      expect(validateEmail('').valid).toBe(false);
    });
  });

  describe('validateApiKey', () => {
    it('should validate API keys with sufficient length', () => {
      expect(validateApiKey('abcdefghij')).toEqual({ valid: true });
      expect(validateApiKey('very-long-api-key-string')).toEqual({ valid: true });
    });

    it('should reject short API keys', () => {
      const result = validateApiKey('short');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least');
    });

    it('should reject empty strings', () => {
      expect(validateApiKey('').valid).toBe(false);
    });

    it('should respect custom minimum length', () => {
      expect(validateApiKey('abc', 3)).toEqual({ valid: true });
      expect(validateApiKey('ab', 3).valid).toBe(false);
    });
  });

  describe('validateBranchName', () => {
    it('should validate correct branch names', () => {
      expect(validateBranchName('main')).toEqual({ valid: true });
      expect(validateBranchName('feature/my-feature')).toEqual({ valid: true });
      expect(validateBranchName('release-1.0.0')).toEqual({ valid: true });
    });

    it('should reject branches starting with . or /', () => {
      expect(validateBranchName('.hidden').valid).toBe(false);
      expect(validateBranchName('/absolute').valid).toBe(false);
    });

    it('should reject branches with spaces', () => {
      expect(validateBranchName('my branch').valid).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(validateBranchName('').valid).toBe(false);
    });
  });

  describe('validateFilePath', () => {
    it('should validate non-empty paths', () => {
      expect(validateFilePath('/path/to/file')).toEqual({ valid: true });
      expect(validateFilePath('relative/path')).toEqual({ valid: true });
    });

    it('should reject empty paths', () => {
      expect(validateFilePath('').valid).toBe(false);
      expect(validateFilePath('   ').valid).toBe(false);
    });
  });

  describe('validateTimeFormat', () => {
    it('should validate correct time formats', () => {
      expect(validateTimeFormat('09:00')).toEqual({ valid: true });
      expect(validateTimeFormat('23:59')).toEqual({ valid: true });
      expect(validateTimeFormat('00:00')).toEqual({ valid: true });
    });

    it('should reject invalid time formats', () => {
      expect(validateTimeFormat('9:00').valid).toBe(false);  // Single digit hour
      expect(validateTimeFormat('25:00').valid).toBe(false); // Invalid hour
      expect(validateTimeFormat('12:60').valid).toBe(false); // Invalid minute
      expect(validateTimeFormat('not-a-time').valid).toBe(false);
    });
  });

  describe('validateDayOfWeek', () => {
    it('should validate days 0-6', () => {
      for (let i = 0; i <= 6; i++) {
        expect(validateDayOfWeek(i)).toEqual({ valid: true });
      }
    });

    it('should reject invalid day numbers', () => {
      expect(validateDayOfWeek(-1).valid).toBe(false);
      expect(validateDayOfWeek(7).valid).toBe(false);
      expect(validateDayOfWeek(10).valid).toBe(false);
    });

    it('should reject non-numbers', () => {
      expect(validateDayOfWeek('monday' as any).valid).toBe(false);
    });
  });
});
