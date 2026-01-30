// ============================================
// Date Utilities
// ============================================

import { format, parseISO, startOfWeek, getWeek, getYear } from 'date-fns';

/**
 * Parses a date string in ISO format or relative format.
 * Supports relative dates like "today", "yesterday", "2 weeks ago".
 * 
 * @param dateStr - Date string to parse
 * @returns Parsed Date object
 * @example
 * ```typescript
 * parseDate('2024-01-01')    // ISO format
 * parseDate('today')         // Relative
 * parseDate('2 weeks ago')   // Relative
 * ```
 */
export function parseDate(dateStr: string): Date {
  // Handle relative dates
  const relative = parseRelativeDate(dateStr);
  if (relative) return relative;
  
  // Try ISO format
  try {
    return parseISO(dateStr);
  } catch {
    return new Date(dateStr);
  }
}

/**
 * Parses relative date strings like "today", "yesterday", "2 weeks ago".
 * Returns null if the string is not a recognized relative format.
 * 
 * @param dateStr - Relative date string to parse
 * @returns Parsed Date object or null if not a relative date
 * @example
 * ```typescript
 * parseRelativeDate('today')        // Current date
 * parseRelativeDate('yesterday')    // Yesterday
 * parseRelativeDate('2 weeks ago')  // 2 weeks before today
 * ```
 */
export function parseRelativeDate(dateStr: string): Date | null {
  const now = new Date();
  const lower = dateStr.toLowerCase().trim();
  
  // "today", "yesterday"
  if (lower === 'today') return now;
  if (lower === 'yesterday') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }

  // "X days/weeks/months/years ago"
  const match = lower.match(/^(\d+)\s+(day|week|month|year)s?\s+ago$/);
  if (match) {
    const num = parseInt(match[1]);
    const unit = match[2];
    const d = new Date(now);
    
    switch (unit) {
      case 'day': d.setDate(d.getDate() - num); break;
      case 'week': d.setDate(d.getDate() - num * 7); break;
      case 'month': d.setMonth(d.getMonth() - num); break;
      case 'year': d.setFullYear(d.getFullYear() - num); break;
    }
    return d;
  }

  return null;
}

/**
 * Formats a date for use in git commands.
 * 
 * @param date - Date to format
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForGit(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Gets a week key for grouping by week.
 * Week starts on Monday (ISO week).
 * 
 * @param date - Date to get week key for
 * @returns Week key in format YYYY-WNN (e.g., "2024-W01")
 */
export function getWeekKey(date: Date): string {
  const year = getYear(date);
  const week = getWeek(date, { weekStartsOn: 1 });
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Gets a month key for grouping by month.
 * 
 * @param date - Date to get month key for
 * @returns Month key in format YYYY-MM (e.g., "2024-01")
 */
export function getMonthKey(date: Date): string {
  return format(date, 'yyyy-MM');
}

/**
 * Gets the day of week name for a date.
 * 
 * @param date - Date to get day name for
 * @returns Full day name (e.g., "Monday", "Tuesday")
 */
export function getDayOfWeek(date: Date): string {
  return format(date, 'EEEE');
}

/**
 * Formats the duration between two dates in human-readable format.
 * Returns the most appropriate unit (years, months, or days).
 * 
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Formatted duration string (e.g., "2 years", "3 months", "15 days")
 */
export function formatDuration(startDate: Date, endDate: Date): string {
  const diff = endDate.getTime() - startDate.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? 's' : ''}`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''}`;
  return `${days} day${days > 1 ? 's' : ''}`;
}

/**
 * Formats a date with time.
 * 
 * @param date - Date to format (null returns "N/A")
 * @returns Formatted date string in YYYY-MM-DD HH:mm format
 */
export function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  return format(date, 'yyyy-MM-dd HH:mm');
}

/**
 * Formats a date without time.
 * 
 * @param date - Date to format (null returns "N/A")
 * @returns Formatted date string in YYYY-MM-DD format
 */
export function formatShortDate(date: Date | null): string {
  if (!date) return 'N/A';
  return format(date, 'yyyy-MM-dd');
}
