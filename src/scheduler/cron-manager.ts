// ============================================
// Cross-Platform Scheduler using node-cron
// ============================================

import cron from 'node-cron';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface ScheduleState {
  enabled: boolean;
  expression: string;
  lastRun?: string;
  nextRun?: string;
}

/**
 * Cross-platform scheduler using node-cron.
 * Replaces Unix crontab for Windows compatibility.
 */
export class CrossPlatformScheduler {
  private task?: cron.ScheduledTask;
  private stateFile: string;

  constructor(stateFile: string) {
    this.stateFile = stateFile;
  }

  /**
   * Start the scheduler with the given cron expression.
   * 
   * @param expression - Cron expression (e.g., "0 9 * * 1" for Monday 9am)
   * @param callback - Function to execute on schedule
   * @returns true if started successfully, false otherwise
   */
  start(expression: string, callback: () => void | Promise<void>): boolean {
    // Stop existing task if any
    if (this.task) {
      this.task.stop();
    }

    // Validate cron expression
    if (!cron.validate(expression)) {
      return false;
    }

    // Create and start the scheduled task
    this.task = cron.schedule(expression, async () => {
      try {
        await callback();
        this.updateLastRun();
      } catch (error) {
        console.error('Scheduled task failed:', error);
      }
    }, {
      scheduled: false,
      timezone: undefined, // Use system timezone
    });

    this.task.start();
    this.saveState({ enabled: true, expression });
    return true;
  }

  /**
   * Stop the scheduler.
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task.destroy();
      this.task = undefined;
    }
    this.saveState({ enabled: false, expression: '' });
  }

  /**
   * Check if the scheduler is currently running.
   */
  isRunning(): boolean {
    return this.task !== undefined;
  }

  /**
   * Get the current schedule state.
   */
  getState(): ScheduleState | null {
    try {
      if (existsSync(this.stateFile)) {
        const content = readFileSync(this.stateFile, 'utf-8');
        return JSON.parse(content);
      }
    } catch {}
    return null;
  }

  /**
   * Save the schedule state to file.
   * 
   * @private
   */
  private saveState(state: Partial<ScheduleState>): void {
    const existing = this.getState() || { enabled: false, expression: '' };
    const newState = { ...existing, ...state };
    
    try {
      writeFileSync(this.stateFile, JSON.stringify(newState, null, 2));
    } catch (error) {
      console.error('Failed to save scheduler state:', error);
    }
  }

  /**
   * Update the last run timestamp.
   * 
   * @private
   */
  private updateLastRun(): void {
    const state = this.getState();
    if (state) {
      this.saveState({ lastRun: new Date().toISOString() });
    }
  }

  /**
   * Convert interval string to cron expression.
   * 
   * @param interval - 'daily', 'weekly', or 'monthly'
   * @param dayOfWeek - Day of week for weekly (0-6, Monday=1)
   * @param time - Time in HH:MM format
   * @returns Cron expression string
   */
  static getCronExpression(interval: string, dayOfWeek?: number, time?: string): string {
    const [hour, minute] = (time || '09:00').split(':').map(Number);

    switch (interval) {
      case 'daily':
        return `${minute} ${hour} * * *`;
      case 'weekly':
        return `${minute} ${hour} * * ${dayOfWeek ?? 1}`;
      case 'monthly':
        return `${minute} ${hour} 1 * *`;
      default:
        return `${minute} ${hour} * * 1`; // Default: weekly on Monday
    }
  }

  /**
   * Validate a cron expression.
   * 
   * @param expression - Cron expression to validate
   * @returns true if valid, false otherwise
   */
  static isValidExpression(expression: string): boolean {
    return cron.validate(expression);
  }
}
