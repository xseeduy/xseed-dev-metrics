// ============================================
// Shared Metrics Calculation Utilities
// ============================================

import { getWeek, getYear } from 'date-fns';

/**
 * Calculates the median of an array of numbers
 * @param values - Array of numbers
 * @returns Median value
 */
export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculates a percentile of an array of numbers
 * @param values - Array of numbers
 * @param p - Percentile (0-100)
 * @returns Percentile value
 */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculates the average (mean) of an array of numbers
 * @param values - Array of numbers
 * @returns Average value
 */
export function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculates the sum of an array of numbers
 * @param values - Array of numbers
 * @returns Sum of values
 */
export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/**
 * Calculates the minimum value in an array
 * @param values - Array of numbers
 * @returns Minimum value or 0 if empty
 */
export function min(values: number[]): number {
  if (!values.length) return 0;
  return Math.min(...values);
}

/**
 * Calculates the maximum value in an array
 * @param values - Array of numbers
 * @returns Maximum value or 0 if empty
 */
export function max(values: number[]): number {
  if (!values.length) return 0;
  return Math.max(...values);
}

/**
 * Calculates the standard deviation of an array of numbers
 * @param values - Array of numbers
 * @returns Standard deviation
 */
export function standardDeviation(values: number[]): number {
  if (!values.length) return 0;
  const mean = avg(values);
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
  return Math.sqrt(avg(squaredDiffs));
}

/**
 * Gets a week key in format YYYY-Www (e.g., "2024-W01")
 * @param date - Date to get week key for
 * @returns Week key string
 */
export function getWeekKey(date: Date): string {
  return `${getYear(date)}-W${String(getWeek(date)).padStart(2, '0')}`;
}

/**
 * Gets a month key in format YYYY-MM (e.g., "2024-01")
 * @param date - Date to get month key for
 * @returns Month key string
 */
export function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Gets a day key in format YYYY-MM-DD (e.g., "2024-01-15")
 * @param date - Date to get day key for
 * @returns Day key string
 */
export function getDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Groups items by a key function
 * @param items - Items to group
 * @param keyFn - Function to extract key from item
 * @returns Map of key to array of items
 */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }
  
  return groups;
}

/**
 * Counts occurrences of items by a key function
 * @param items - Items to count
 * @param keyFn - Function to extract key from item
 * @returns Map of key to count
 */
export function countBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, number> {
  const counts = new Map<K, number>();
  
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  
  return counts;
}

/**
 * Rounds a number to specified decimal places
 * @param value - Number to round
 * @param decimals - Number of decimal places
 * @returns Rounded number
 */
export function round(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Calculates percentage
 * @param part - Part value
 * @param total - Total value
 * @returns Percentage (0-100)
 */
export function percentage(part: number, total: number): number {
  if (total === 0) return 0;
  return round((part / total) * 100, 2);
}

/**
 * Calculates change percentage between two values
 * @param current - Current value
 * @param previous - Previous value
 * @returns Percentage change
 */
export function percentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return round(((current - previous) / previous) * 100, 2);
}

/**
 * Filters outliers from an array using IQR method
 * @param values - Array of numbers
 * @param multiplier - IQR multiplier (default 1.5)
 * @returns Array without outliers
 */
export function filterOutliers(values: number[], multiplier: number = 1.5): number[] {
  if (values.length < 4) return values;
  
  const q1 = percentile(values, 25);
  const q3 = percentile(values, 75);
  const iqr = q3 - q1;
  const lowerBound = q1 - (multiplier * iqr);
  const upperBound = q3 + (multiplier * iqr);
  
  return values.filter(v => v >= lowerBound && v <= upperBound);
}
