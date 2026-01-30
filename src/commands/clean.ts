// ============================================
// Clean Command - Remove all configuration and data
// ============================================

import chalk from 'chalk';
import { existsSync, readFileSync, unlinkSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import {
  getConfigDir,
  getLogsDir,
  getDataDir,
} from '../config/integrations';
import { printCompactHeader, printSuccess, printError, printSection } from '../branding';

const PID_FILE = join(getConfigDir(), 'daemon.pid');
const SCHEDULER_STATE_FILE = join(getConfigDir(), 'scheduler-state.json');

// ==========================================
// PID Management (for stopping daemon)
// ==========================================

function getPid(): number | null {
  try {
    if (existsSync(PID_FILE)) {
      const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim());
      return isNaN(pid) ? null : pid;
    }
  } catch {}
  return null;
}

function removePid(): void {
  try {
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE);
    }
  } catch {}
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

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

// ==========================================
// Clean Function
// ==========================================

/**
 * Clean all configuration, data, and daemon files.
 * This stops the daemon and removes all stored data.
 */
function cleanAll(): { success: boolean; message: string; details: string[] } {
  const details: string[] = [];
  
  try {
    // 1. Stop daemon if running
    const stopResult = stopDaemon();
    if (stopResult.success && stopResult.message !== 'No daemon running') {
      details.push(stopResult.message);
    }

    const configDir = getConfigDir();
    const dataDir = getDataDir();
    const logsDir = getLogsDir();

    // 2. Delete config file
    const configFile = join(configDir, 'config.json');
    if (existsSync(configFile)) {
      unlinkSync(configFile);
      details.push('Deleted config.json');
    }

    // 3. Delete PID file
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE);
      details.push('Deleted daemon.pid');
    }

    // 4. Delete scheduler state file
    if (existsSync(SCHEDULER_STATE_FILE)) {
      unlinkSync(SCHEDULER_STATE_FILE);
      details.push('Deleted scheduler-state.json');
    }

    // 5. Delete all data files
    if (existsSync(dataDir)) {
      const dataFiles = readdirSync(dataDir);
      if (dataFiles.length > 0) {
        rmSync(dataDir, { recursive: true, force: true });
        details.push(`Deleted ${dataFiles.length} data file(s)`);
      }
    }

    // 6. Delete all log files
    if (existsSync(logsDir)) {
      const logFiles = readdirSync(logsDir);
      if (logFiles.length > 0) {
        rmSync(logsDir, { recursive: true, force: true });
        details.push(`Deleted ${logFiles.length} log file(s)`);
      }
    }

    return {
      success: true,
      message: 'All configuration and data cleaned successfully',
      details,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: `Failed to clean: ${(error as Error).message}`,
      details,
    };
  }
}

// ==========================================
// Clean Command
// ==========================================

export async function cleanCommand(): Promise<void> {
  printCompactHeader();
  printSection('Cleaning Configuration & Data');

  // Show warning
  console.log(chalk.yellow('\n  ⚠️  WARNING: This will permanently delete:'));
  console.log(chalk.gray('     • All configuration (config.json)'));
  console.log(chalk.gray('     • All collected metrics data'));
  console.log(chalk.gray('     • All daemon logs'));
  console.log(chalk.gray('     • Daemon state files\n'));

  // Perform cleanup
  const result = cleanAll();

  if (result.success) {
    printSuccess(result.message);
    if (result.details.length > 0) {
      console.log(chalk.gray('\n  Details:'));
      result.details.forEach(detail => {
        console.log(chalk.gray(`    • ${detail}`));
      });
    }
    console.log(chalk.gray('\n  Run `gdm init` to set up again.\n'));
  } else {
    printError(result.message);
    process.exit(1);
  }
}
