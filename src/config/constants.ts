// ============================================
// Application Constants
// ============================================

// Load environment variables from .env file
import { config } from 'dotenv';
config();

/**
 * Default values for commands and operations
 */
export const DEFAULTS = {
  /** Default commit limit for commands */
  COMMIT_LIMIT: 50,
  /** Default author limit for commands */
  AUTHOR_LIMIT: 20,
  /** Default file limit for commands */
  FILE_LIMIT: 10,
  /** Default number of days to collect metrics for */
  COLLECTION_DAYS: 7,
  /** Default number of entries to show in historical data */
  SHOW_LAST_ENTRIES: 5,
  /** Default top items to show in reports */
  TOP_ITEMS: 10,
  /** Default limit for blame file analysis */
  BLAME_FILE_LIMIT: 100,
} as const;

/**
 * Retry configuration for API calls
 */
export const RETRY = {
  /** Maximum number of retry attempts */
  MAX_ATTEMPTS: 3,
  /** Base delay in milliseconds before first retry */
  BASE_DELAY_MS: 1000,
  /** Maximum delay in milliseconds between retries */
  MAX_DELAY_MS: 10000,
  /** Multiplier for exponential backoff */
  BACKOFF_MULTIPLIER: 2,
} as const;

/**
 * Performance-related constants
 */
export const PERFORMANCE = {
  /** Git command buffer size for large repos (100MB) */
  GIT_BUFFER_SIZE: 100 * 1024 * 1024,
  /** Default pagination size for API calls */
  PAGINATION_SIZE: 100,
  /** Delay between API calls in milliseconds */
  API_DELAY_MS: 100,
} as const;

/**
 * Time thresholds in days
 */
export const TIME_THRESHOLDS = {
  /** Threshold for "new" code in days */
  NEW_CODE_DAYS: 21,
  /** Short period threshold (1 week) */
  SHORT_PERIOD_DAYS: 7,
  /** Medium period threshold (1 month) */
  MEDIUM_PERIOD_DAYS: 30,
  /** Long period threshold (3 months) */
  LONG_PERIOD_DAYS: 90,
  /** Default months for metric lookback */
  DEFAULT_MONTHS: 3,
} as const;

/**
 * Display/formatting constants
 */
export const DISPLAY = {
  /** String repeat count for section separators */
  SEPARATOR_LENGTH: 60,
  /** Number of log lines to show by default */
  LOG_LINES_DEFAULT: 50,
} as const;

/**
 * Color threshold values for metrics
 */
export const THRESHOLDS = {
  /** High bug ratio threshold (red) */
  BUG_RATIO_HIGH: 0.3,
  /** Medium bug ratio threshold (yellow) */
  BUG_RATIO_MEDIUM: 0.15,
  /** High completion rate threshold (green) */
  COMPLETION_RATE_HIGH: 80,
  /** Medium completion rate threshold (yellow) */
  COMPLETION_RATE_MEDIUM: 60,
} as const;

/**
 * Scheduler defaults
 */
export const SCHEDULER = {
  /** Default day of week for weekly schedule (Monday) */
  DEFAULT_DAY: 1,
  /** Default time for scheduled runs */
  DEFAULT_TIME: '09:00',
  /** Daemon check interval in milliseconds (1 hour) */
  DAEMON_CHECK_INTERVAL_MS: 1000 * 60 * 60,
} as const;

/**
 * Configuration file settings
 */
export const CONFIG = {
  /** Configuration file version */
  VERSION: '1.0.0',
  /** File permissions for config file (octal) */
  CONFIG_FILE_PERMISSIONS: 0o600,
  /** Directory permissions for config directory (octal) */
  CONFIG_DIR_PERMISSIONS: 0o700,
} as const;

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  /** Linear GraphQL API endpoint */
  LINEAR_GRAPHQL: 'https://api.linear.app/graphql',
} as const;

/**
 * Built-in Supabase configuration.
 * Loads from environment variables (.env file) or falls back to hardcoded defaults.
 * For internal use - shared credentials across the team.
 */
export const SUPABASE = {
  URL: process.env.SUPABASE_URL || 'https://eqtgrxfjhgmslpxgfwho.supabase.co',
  SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxdGdyeGZqaGdtc2xweGdmd2hvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQwODI2MywiZXhwIjoyMDg1OTg0MjYzfQ.VvvCJsMo3TRgWEFIdOzbnlhTQcrRdtim6iv6igvswy8',
} as const;

/**
 * Built-in Slack configuration.
 * Loads from environment variables (.env file) or falls back to hardcoded defaults.
 * Bot token is shared across the team for notifications.
 */
export const SLACK = {
  BOT_TOKEN: process.env.SLACK_BOT_TOKEN || 'xoxb-137754316583-10428499602439-2u08psbvvpCvCa3ARLvNwOS1',
} as const;

/**
 * File size limits
 */
export const LIMITS = {
  /** Maximum file size for processing */
  MAX_FILE_SIZE_MB: 100,
  /** Maximum number of files to process in batch */
  MAX_BATCH_SIZE: 1000,
} as const;
