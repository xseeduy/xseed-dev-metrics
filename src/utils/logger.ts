// ============================================
// Centralized Logging Service
// ============================================

import chalk from 'chalk';
import { sanitizeLogMessage } from './secrets';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  enableColors: boolean;
  enableTimestamps: boolean;
  sanitizeSecrets: boolean;
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
  level: LogLevel.INFO,
  enableColors: true,
  enableTimestamps: false,
  sanitizeSecrets: true,
};

/**
 * Current logger configuration
 */
let currentConfig: LoggerConfig = { ...defaultConfig };

/**
 * Configures the logger
 * @param config - Partial logger configuration
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Resets logger to default configuration
 */
export function resetLogger(): void {
  currentConfig = { ...defaultConfig };
}

/**
 * Formats a log message with optional timestamp
 * @param level - Log level
 * @param message - Message to format
 * @returns Formatted message
 * @private
 */
function formatMessage(level: string, message: string): string {
  const sanitized = currentConfig.sanitizeSecrets ? sanitizeLogMessage(message) : message;
  
  if (currentConfig.enableTimestamps) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${sanitized}`;
  }
  
  return sanitized;
}

/**
 * Logs a debug message
 * @param message - Message to log
 * @param context - Optional context object
 */
export function debug(message: string, context?: Record<string, any>): void {
  if (currentConfig.level <= LogLevel.DEBUG) {
    const formatted = formatMessage('DEBUG', message);
    if (currentConfig.enableColors) {
      console.debug(chalk.gray(formatted));
    } else {
      console.debug(formatted);
    }
    
    if (context) {
      console.debug(chalk.gray(JSON.stringify(context, null, 2)));
    }
  }
}

/**
 * Logs an info message
 * @param message - Message to log
 * @param context - Optional context object
 */
export function info(message: string, context?: Record<string, any>): void {
  if (currentConfig.level <= LogLevel.INFO) {
    const formatted = formatMessage('INFO', message);
    if (currentConfig.enableColors) {
      console.info(chalk.blue(formatted));
    } else {
      console.info(formatted);
    }
    
    if (context) {
      console.info(JSON.stringify(context, null, 2));
    }
  }
}

/**
 * Logs a success message
 * @param message - Message to log
 */
export function success(message: string): void {
  if (currentConfig.level <= LogLevel.INFO) {
    const formatted = formatMessage('SUCCESS', message);
    if (currentConfig.enableColors) {
      console.info(chalk.green(formatted));
    } else {
      console.info(formatted);
    }
  }
}

/**
 * Logs a warning message
 * @param message - Message to log
 * @param context - Optional context object
 */
export function warn(message: string, context?: Record<string, any>): void {
  if (currentConfig.level <= LogLevel.WARN) {
    const formatted = formatMessage('WARN', message);
    if (currentConfig.enableColors) {
      console.warn(chalk.yellow(formatted));
    } else {
      console.warn(formatted);
    }
    
    if (context) {
      console.warn(JSON.stringify(context, null, 2));
    }
  }
}

/**
 * Logs an error message
 * @param message - Message to log
 * @param error - Optional error object
 * @param context - Optional context object
 */
export function error(message: string, error?: unknown, context?: Record<string, any>): void {
  if (currentConfig.level <= LogLevel.ERROR) {
    const formatted = formatMessage('ERROR', message);
    if (currentConfig.enableColors) {
      console.error(chalk.red(formatted));
    } else {
      console.error(formatted);
    }
    
    if (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`  ${error.message}`));
        if (error.stack) {
          console.error(chalk.gray(error.stack));
        }
      } else {
        console.error(chalk.red(`  ${String(error)}`));
      }
    }
    
    if (context) {
      console.error(JSON.stringify(context, null, 2));
    }
  }
}

/**
 * Creates a child logger with additional context
 * @param contextName - Name for this context (e.g., "GitMetrics", "JiraClient")
 * @returns Logger functions with context
 */
export function createContextLogger(contextName: string) {
  return {
    debug: (message: string, context?: Record<string, any>) => 
      debug(`[${contextName}] ${message}`, context),
    info: (message: string, context?: Record<string, any>) => 
      info(`[${contextName}] ${message}`, context),
    success: (message: string) => 
      success(`[${contextName}] ${message}`),
    warn: (message: string, context?: Record<string, any>) => 
      warn(`[${contextName}] ${message}`, context),
    error: (message: string, err?: unknown, context?: Record<string, any>) => 
      error(`[${contextName}] ${message}`, err, context),
  };
}

/**
 * Logger instance (backwards compatibility with existing code)
 */
export const logger = {
  debug,
  info,
  success,
  warn,
  error,
  createContext: createContextLogger,
  configure: configureLogger,
  reset: resetLogger,
};

export default logger;
