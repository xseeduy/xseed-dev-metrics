// ============================================
// Type Guards Tests
// ============================================

import { describe, it, expect } from 'vitest';
import {
  isError,
  isNodeError,
  getErrorMessage,
  ok,
  err,
  tryCatch,
} from '../../../src/utils/type-guards';

describe('Type Guards', () => {
  describe('isError', () => {
    it('should identify Error objects', () => {
      expect(isError(new Error('test'))).toBe(true);
      expect(isError(new TypeError('test'))).toBe(true);
    });

    it('should reject non-Error values', () => {
      expect(isError('error')).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
      expect(isError({})).toBe(false);
      expect(isError(42)).toBe(false);
    });
  });

  describe('isNodeError', () => {
    it('should identify Node.js errors with code', () => {
      const error: any = new Error('test');
      error.code = 'ENOENT';
      expect(isNodeError(error)).toBe(true);
    });

    it('should reject errors without code', () => {
      expect(isNodeError(new Error('test'))).toBe(false);
    });

    it('should reject non-errors', () => {
      expect(isNodeError({ code: 'ENOENT' })).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from Error objects', () => {
      expect(getErrorMessage(new Error('test message'))).toBe('test message');
    });

    it('should handle string errors', () => {
      expect(getErrorMessage('string error')).toBe('string error');
    });

    it('should handle objects with message property', () => {
      expect(getErrorMessage({ message: 'custom' })).toBe('custom');
    });

    it('should return default message for unknown types', () => {
      expect(getErrorMessage(null)).toBe('Unknown error');
      expect(getErrorMessage(42)).toBe('Unknown error');
    });

    it('should use custom default message', () => {
      expect(getErrorMessage(null, 'Custom default')).toBe('Custom default');
    });
  });

  describe('Result type', () => {
    describe('ok', () => {
      it('should create success result', () => {
        const result = ok(42);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(42);
        }
      });
    });

    describe('err', () => {
      it('should create failure result', () => {
        const error = new Error('failed');
        const result = err(error);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe(error);
        }
      });
    });

    describe('tryCatch', () => {
      it('should return ok result for successful function', () => {
        const result = tryCatch(() => 42);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(42);
        }
      });

      it('should return err result for throwing function', () => {
        const result = tryCatch(() => {
          throw new Error('failed');
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toBe('failed');
        }
      });

      it('should handle non-Error throws', () => {
        const result = tryCatch(() => {
          throw 'string error';
        });
        expect(result.success).toBe(false);
      });
    });
  });
});
