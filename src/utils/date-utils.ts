// ============================================
// Date Utilities
// ============================================

import { format, parseISO, startOfWeek, getWeek, getYear } from 'date-fns';

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

export function formatDateForGit(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function getWeekKey(date: Date): string {
  const year = getYear(date);
  const week = getWeek(date, { weekStartsOn: 1 });
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

export function getMonthKey(date: Date): string {
  return format(date, 'yyyy-MM');
}

export function getDayOfWeek(date: Date): string {
  return format(date, 'EEEE');
}

export function formatDuration(startDate: Date, endDate: Date): string {
  const diff = endDate.getTime() - startDate.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? 's' : ''}`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''}`;
  return `${days} day${days > 1 ? 's' : ''}`;
}

export function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  return format(date, 'yyyy-MM-dd HH:mm');
}

export function formatShortDate(date: Date | null): string {
  if (!date) return 'N/A';
  return format(date, 'yyyy-MM-dd');
}
