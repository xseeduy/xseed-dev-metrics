// ============================================
// Daemon Command - Background Scheduler
// Windows-compatible using node-cron
// ============================================

import chalk from 'chalk';
import { spawn } from 'child_process';
import { existsSync, writeFileSync, readFileSync, unlinkSync, appendFileSync } from 'fs';
import { join } from 'path';
import {
  getConfig,
  getConfigDir,
  getLogsDir,
  isInitialized,
} from '../config/integrations';
import { printCompactHeader, printSuccess, printError, printWarning, printSection } from '../branding';
import { CrossPlatformScheduler } from '../scheduler/cron-manager';

const PID_FILE = join(getConfigDir(), 'daemon.pid');
const LOG_FILE = join(getLogsDir(), 'daemon.log');
const SCHEDULER_STATE_FILE = join(getConfigDir(), 'scheduler-state.json');

// ==========================================
// PID Management
// ==========================================

function getPid(): number | null {
  try {
    if (existsSync(PID_FILE)) {
      const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim());
      return isNaN(pid) ? null : pid;
    }
  } catch (error: unknown) {
    // Failed to read PID file, return null
  }
  return null;
}

function savePid(pid: number): void {
  writeFileSync(PID_FILE, pid.toString());
}

function removePid(): void {
  try {
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE);
    }
  } catch (error: unknown) {
    // Failed to remove PID file, but continue anyway
  }
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ==========================================
// Scheduler Setup (Windows-compatible)
// ==========================================

/**
 * Start the background scheduler daemon process.
 * Spawns a detached Node.js process that runs the scheduler.
 */
function startDaemon(): { success: boolean; message: string; pid?: number } {
  try {
    const config = getConfig();
    const scheduler = config.scheduler;

    if (!scheduler?.enabled) {
      return { success: false, message: 'Scheduler not enabled' };
    }

    // Check if already running
    const existingPid = getPid();
    if (existingPid && isRunning(existingPid)) {
      return { success: false, message: `Daemon already running (PID: ${existingPid})` };
    }

    // Get cron expression
    const cronExpr = CrossPlatformScheduler.getCronExpression(
      scheduler.interval,
      scheduler.dayOfWeek,
      scheduler.time
    );

    // Spawn detached daemon process
    const child = spawn(process.execPath, [__filename, '--daemon-mode', cronExpr], {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
    });

    child.unref();
    savePid(child.pid!);

    return { success: true, message: `Scheduler started (PID: ${child.pid})`, pid: child.pid! };
  } catch (error: unknown) {
    return { success: false, message: (error as Error).message };
  }
}

/**
 * Stop the scheduler daemon.
 */
function stopDaemon(): { success: boolean; message: string } {
  try {
    const pid = getPid();

    if (!pid) {
      return { success: true, message: 'No daemon running' };
    }

    if (!isRunning(pid)) {
      removePid();
      return { success: true, message: 'Daemon was not running (cleaned up PID file)' };
    }

    // Kill the daemon process
    try {
      process.kill(pid, 'SIGTERM');
      removePid();
      return { success: true, message: `Daemon stopped (PID: ${pid})` };
    } catch (error) {
      return { success: false, message: `Failed to stop daemon: ${(error as Error).message}` };
    }
  } catch (error: unknown) {
    return { success: false, message: (error as Error).message };
  }
}

/**
 * Run the scheduler in daemon mode (called by spawned process).
 * This is the actual scheduler loop that runs in the background.
 */
async function runDaemonMode(cronExpression: string): Promise<void> {
  const scheduler = new CrossPlatformScheduler(SCHEDULER_STATE_FILE);

  // Log startup
  const logMessage = `[${new Date().toISOString()}] Scheduler daemon started with expression: ${cronExpression}\n`;
  try {
    appendFileSync(LOG_FILE, logMessage);
  } catch (error: unknown) {
    // Failed to write to log file, continue anyway
  }

  // Start the scheduler
  const started = scheduler.start(cronExpression, async () => {
    const timestamp = new Date().toISOString();
    try {
      appendFileSync(LOG_FILE, `[${timestamp}] Running scheduled collection...\n`);
    } catch (error: unknown) {
      // Failed to write to log file
    }

    // Run collection
    try {
      const { collectCommand } = await import('./collect');
      await collectCommand({ all: true, pull: true, quiet: true, scheduled: true });
      
      try {
        appendFileSync(LOG_FILE, `[${timestamp}] Collection completed successfully\n`);
      } catch (error: unknown) {
        // Failed to write to log file
      }
    } catch (error) {
      const errorMsg = `[${timestamp}] Collection failed: ${(error as Error).message}\n`;
      try {
        appendFileSync(LOG_FILE, errorMsg);
      } catch (logError: unknown) {
        // Failed to write error to log file
      }
    }
  });

  if (!started) {
    console.error('Failed to start scheduler: invalid cron expression');
    process.exit(1);
  }

  // Keep the process alive
  process.on('SIGTERM', () => {
    scheduler.stop();
    const shutdownMsg = `[${new Date().toISOString()}] Scheduler daemon stopped\n`;
    try {
      appendFileSync(LOG_FILE, shutdownMsg);
    } catch (error: unknown) {
      // Failed to write to log file
    }
    process.exit(0);
  });

  // Prevent process from exiting
  setInterval(() => {}, 1000 * 60 * 60); // Check every hour
}

// ==========================================
// Daemon Commands
// ==========================================

export async function daemonCommand(action: string): Promise<void> {
  // Special daemon mode - run the scheduler loop
  if (action === '--daemon-mode' && process.argv.length > 3) {
    const cronExpression = process.argv[3];
    await runDaemonMode(cronExpression);
    return;
  }

  if (!isInitialized()) {
    printError('Not configured. Run `gdm init` first.');
    return;
  }

  printCompactHeader();

  const config = getConfig();

  switch (action) {
    case 'start': {
      printSection('Starting Scheduler');

      if (!config.scheduler?.enabled) {
        printWarning('Scheduler not enabled in config.');
        console.log(chalk.gray('  Run `gdm init` to enable the scheduler.\n'));
        return;
      }

      const result = startDaemon();

      if (result.success) {
        printSuccess('Scheduler started');
        console.log(chalk.gray(`  Schedule: ${config.scheduler.interval}`));
        console.log(chalk.gray(`  PID: ${result.pid}`));
        console.log(chalk.gray(`  Log file: ${LOG_FILE}\n`));
      } else {
        printError(`Failed to start: ${result.message}`);
      }
      break;
    }

    case 'stop': {
      printSection('Stopping Scheduler');

      const result = stopDaemon();

      if (result.success) {
        printSuccess('Scheduler stopped');
      } else {
        printError(`Failed to stop: ${result.message}`);
      }
      break;
    }

    case 'status': {
      printSection('Scheduler Status');

      // Check if daemon is running
      const pid = getPid();
      const isActive = pid ? isRunning(pid) : false;

      // Get scheduler state
      const scheduler = new CrossPlatformScheduler(SCHEDULER_STATE_FILE);
      const state = scheduler.getState();

      console.log(`  Scheduler: ${config.scheduler?.enabled ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
      console.log(`  Daemon: ${isActive ? chalk.green(`Running (PID: ${pid})`) : chalk.gray('Not running')}`);
      console.log(`  Interval: ${config.scheduler?.interval || 'Not set'}`);
      console.log(`  Last Run: ${state?.lastRun || config.lastRun || 'Never'}`);
      console.log(`  Log File: ${LOG_FILE}\n`);
      break;
    }

    case 'logs': {
      printSection('Recent Logs');

      if (existsSync(LOG_FILE)) {
        try {
          const logs = readFileSync(LOG_FILE, 'utf-8');
          const lines = logs.split('\n').slice(-50);
          console.log(chalk.gray(lines.join('\n')));
        } catch {
          printWarning('Could not read log file');
        }
      } else {
        console.log(chalk.gray('  No logs yet.\n'));
      }
      break;
    }

    case 'run': {
      // Run collection immediately
      console.log(chalk.gray('  Running collection now...\n'));

      // Import and run collect command
      const { collectCommand } = await import('./collect');
      await collectCommand({ all: true });
      break;
    }

    default:
      console.log(chalk.gray(`
  Usage: gdm daemon <action>

  Actions:
    start   - Start the scheduler daemon (cross-platform)
    stop    - Stop the scheduler daemon
    status  - Show scheduler status
    logs    - Show recent logs
    run     - Run collection immediately

  The scheduler automatically pulls from the main branch
  and collects metrics at the configured interval.
  
  Note: Uses node-cron for Windows compatibility.
`));
  }
}

// ==========================================
// Export for cron execution
// ==========================================

export async function runScheduledCollection(): Promise<void> {
  const { collectCommand } = await import('./collect');
  await collectCommand({ all: true, pull: true, quiet: true });
}
