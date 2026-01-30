// ============================================
// Metrics Calculations Tests
// ============================================

import { describe, it, expect } from 'vitest';
import {
  median,
  percentile,
  avg,
  sum,
  min,
  max,
  standardDeviation,
  round,
  percentage,
  percentageChange,
  filterOutliers,
} from '../../../src/utils/metrics-calculations';

describe('Metrics Calculations', () => {
  describe('median', () => {
    it('should calculate median for odd-length arrays', () => {
      expect(median([1, 2, 3, 4, 5])).toBe(3);
      expect(median([5, 1, 3])).toBe(3);
    });

    it('should calculate median for even-length arrays', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
      expect(median([10, 20])).toBe(15);
    });

    it('should return 0 for empty array', () => {
      expect(median([])).toBe(0);
    });

    it('should handle single element', () => {
      expect(median([42])).toBe(42);
    });
  });

  describe('percentile', () => {
    it('should calculate percentiles correctly', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(percentile(data, 50)).toBe(5);
      expect(percentile(data, 90)).toBe(9);
      expect(percentile(data, 10)).toBe(1);
    });

    it('should return 0 for empty array', () => {
      expect(percentile([], 50)).toBe(0);
    });
  });

  describe('avg', () => {
    it('should calculate average correctly', () => {
      expect(avg([1, 2, 3, 4, 5])).toBe(3);
      expect(avg([10, 20])).toBe(15);
    });

    it('should return 0 for empty array', () => {
      expect(avg([])).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(avg([-1, 0, 1])).toBe(0);
    });
  });

  describe('sum', () => {
    it('should sum numbers correctly', () => {
      expect(sum([1, 2, 3, 4, 5])).toBe(15);
      expect(sum([10])).toBe(10);
    });

    it('should return 0 for empty array', () => {
      expect(sum([])).toBe(0);
    });
  });

  describe('min', () => {
    it('should find minimum value', () => {
      expect(min([3, 1, 4, 1, 5])).toBe(1);
      expect(min([10])).toBe(10);
    });

    it('should return 0 for empty array', () => {
      expect(min([])).toBe(0);
    });
  });

  describe('max', () => {
    it('should find maximum value', () => {
      expect(max([3, 1, 4, 1, 5])).toBe(5);
      expect(max([10])).toBe(10);
    });

    it('should return 0 for empty array', () => {
      expect(max([])).toBe(0);
    });
  });

  describe('standardDeviation', () => {
    it('should calculate standard deviation', () => {
      const result = standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(result).toBeCloseTo(2.138, 2);
    });

    it('should return 0 for empty array', () => {
      expect(standardDeviation([])).toBe(0);
    });

    it('should return 0 for single element', () => {
      expect(standardDeviation([5])).toBe(0);
    });
  });

  describe('round', () => {
    it('should round to specified decimal places', () => {
      expect(round(3.14159, 2)).toBe(3.14);
      expect(round(3.14159, 4)).toBe(3.1416);
    });

    it('should default to 2 decimal places', () => {
      expect(round(3.14159)).toBe(3.14);
    });

    it('should handle integers', () => {
      expect(round(5, 2)).toBe(5);
    });
  });

  describe('percentage', () => {
    it('should calculate percentage correctly', () => {
      expect(percentage(50, 100)).toBe(50);
      expect(percentage(25, 200)).toBe(12.5);
    });

    it('should return 0 when total is 0', () => {
      expect(percentage(50, 0)).toBe(0);
    });

    it('should handle 0 part', () => {
      expect(percentage(0, 100)).toBe(0);
    });
  });

  describe('percentageChange', () => {
    it('should calculate percentage change correctly', () => {
      expect(percentageChange(150, 100)).toBe(50);
      expect(percentageChange(75, 100)).toBe(-25);
    });

    it('should handle zero previous value', () => {
      expect(percentageChange(100, 0)).toBe(100);
      expect(percentageChange(0, 0)).toBe(0);
    });

    it('should handle negative values', () => {
      expect(percentageChange(-50, -100)).toBe(50);
    });
  });

  describe('filterOutliers', () => {
    it('should filter outliers using IQR method', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
      const filtered = filterOutliers(data);
      expect(filtered).not.toContain(100);
      expect(filtered.length).toBeLessThan(data.length);
    });

    it('should return all values for small datasets', () => {
      const data = [1, 2, 3];
      expect(filterOutliers(data)).toEqual(data);
    });

    it('should handle empty array', () => {
      expect(filterOutliers([])).toEqual([]);
    });
  });
});
