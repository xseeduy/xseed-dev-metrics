// ============================================
// Clean Command - Remove all configuration and data
// ============================================

import chalk from 'chalk';
import * as readline from 'readline';
import { existsSync, readFileSync, unlinkSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import {
  getConfigDir,
  getLogsDir,
  getDataDir,
  getActiveClient,
  getAllClients,
  removeClient,
  clientExists,
} from '../config/integrations';
import { printCompactHeader, printSuccess, printError, printSection, printWarning } from '../branding';

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
  } catch (error: unknown) {
    // Failed to read PID file, return null
  }
  return null;
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
// Clean Helper Functions
// ==========================================

interface CleanResult {
  success: boolean;
  message: string;
  details: string[];
}

/**
 * Cleans data for a specific client or all clients.
 */
function cleanData(clientName?: string): CleanResult {
  const details: string[] = [];
  
  try {
    if (clientName) {
      // Clean specific client's data
      const clientDataDir = getDataDir(clientName);
      if (existsSync(clientDataDir)) {
        const files = readdirSync(clientDataDir);
        rmSync(clientDataDir, { recursive: true, force: true });
        details.push(`Deleted ${files.length} data file(s) for client '${clientName}'`);
      } else {
        details.push(`No data found for client '${clientName}'`);
      }
    } else {
      // Clean all data
      const dataDir = join(getConfigDir(), 'data');
      if (existsSync(dataDir)) {
        const clients = readdirSync(dataDir);
        let totalFiles = 0;
        for (const client of clients) {
          const clientPath = join(dataDir, client);
          if (existsSync(clientPath)) {
            const files = readdirSync(clientPath);
            totalFiles += files.length;
          }
        }
        rmSync(dataDir, { recursive: true, force: true });
        details.push(`Deleted ${totalFiles} data file(s) from all clients`);
      }
    }
    
    return { success: true, message: 'Data cleaned successfully', details };
  } catch (error: unknown) {
    return {
      success: false,
      message: `Failed to clean data: ${(error as Error).message}`,
      details,
    };
  }
}

/**
 * Cleans logs for a specific client or all clients.
 */
function cleanLogs(clientName?: string): CleanResult {
  const details: string[] = [];
  
  try {
    if (clientName) {
      // Clean specific client's logs
      const clientLogsDir = getLogsDir(clientName);
      if (existsSync(clientLogsDir)) {
        const files = readdirSync(clientLogsDir);
        rmSync(clientLogsDir, { recursive: true, force: true });
        details.push(`Deleted ${files.length} log file(s) for client '${clientName}'`);
      } else {
        details.push(`No logs found for client '${clientName}'`);
      }
    } else {
      // Clean all logs
      const logsDir = join(getConfigDir(), 'logs');
      if (existsSync(logsDir)) {
        const clients = readdirSync(logsDir);
        let totalFiles = 0;
        for (const client of clients) {
          const clientPath = join(logsDir, client);
          if (existsSync(clientPath)) {
            const files = readdirSync(clientPath);
            totalFiles += files.length;
          }
        }
        rmSync(logsDir, { recursive: true, force: true });
        details.push(`Deleted ${totalFiles} log file(s) from all clients`);
      }
    }
    
    return { success: true, message: 'Logs cleaned successfully', details };
  } catch (error: unknown) {
    return {
      success: false,
      message: `Failed to clean logs: ${(error as Error).message}`,
      details,
    };
  }
}

/**
 * Cleans configuration for a specific client or all config.
 */
function cleanConfig(clientName?: string): CleanResult {
  const details: string[] = [];
  
  try {
    if (clientName) {
      // Remove specific client from configuration
      const removed = removeClient(clientName);
      if (removed) {
        details.push(`Removed client '${clientName}' from configuration`);
      } else {
        details.push(`Client '${clientName}' not found in configuration`);
      }
    } else {
      // Remove entire config file
      const configFile = join(getConfigDir(), 'config.json');
      if (existsSync(configFile)) {
        unlinkSync(configFile);
        details.push('Deleted config.json');
      }
      
      // Remove daemon files
      if (existsSync(PID_FILE)) {
        unlinkSync(PID_FILE);
        details.push('Deleted daemon.pid');
      }
      
      if (existsSync(SCHEDULER_STATE_FILE)) {
        unlinkSync(SCHEDULER_STATE_FILE);
        details.push('Deleted scheduler-state.json');
      }
    }
    
    return { success: true, message: 'Configuration cleaned successfully', details };
  } catch (error: unknown) {
    return {
      success: false,
      message: `Failed to clean config: ${(error as Error).message}`,
      details,
    };
  }
}

/**
 * Cleans everything for a specific client.
 */
function cleanClientAll(clientName: string): CleanResult {
  const details: string[] = [];
  
  try {
    // Clean data
    const dataResult = cleanData(clientName);
    details.push(...dataResult.details);
    
    // Clean logs
    const logsResult = cleanLogs(clientName);
    details.push(...logsResult.details);
    
    // Clean config
    const configResult = cleanConfig(clientName);
    details.push(...configResult.details);
    
    return {
      success: true,
      message: `All data for client '${clientName}' cleaned successfully`,
      details,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: `Failed to clean client: ${(error as Error).message}`,
      details,
    };
  }
}

/**
 * Cleans everything (all clients, all data, all config).
 */
function cleanAll(): CleanResult {
  const details: string[] = [];
  
  try {
    // Stop daemon if running
    const stopResult = stopDaemon();
    if (stopResult.success && stopResult.message !== 'No daemon running') {
      details.push(stopResult.message);
    }
    
    // Clean all data
    const dataResult = cleanData();
    details.push(...dataResult.details);
    
    // Clean all logs
    const logsResult = cleanLogs();
    details.push(...logsResult.details);
    
    // Clean all config
    const configResult = cleanConfig();
    details.push(...configResult.details);
    
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

/**
 * Helper to ask for yes/no confirmation.
 */
async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(chalk.cyan('  ? ') + question + chalk.gray(' [y/N]') + ': ', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase().startsWith('y'));
    });
  });
}

export async function cleanCommand(options: {
  data?: boolean;
  config?: boolean;
  logs?: boolean;
  client?: string;
  all?: boolean;
  yes?: boolean;
} = {}): Promise<void> {
  printCompactHeader();
  printSection('Cleaning Configuration & Data');

  // Determine what to clean
  const clientName = options.client || getActiveClient();
  const cleanSpecific = options.data || options.config || options.logs;
  
  // Validate client exists if specified
  if (options.client && !clientExists(options.client)) {
    printError(`Client '${options.client}' not found.`);
    console.log(chalk.gray(`\n  Run ${chalk.cyan('gdm client')} to see available clients.\n`));
    return;
  }

  // Build list of what will be deleted
  const itemsToDelete: string[] = [];
  
  if (options.all) {
    itemsToDelete.push('All client configurations');
    itemsToDelete.push('All collected metrics data');
    itemsToDelete.push('All daemon logs');
    itemsToDelete.push('Daemon state files');
  } else if (cleanSpecific) {
    const target = clientName ? `for client '${clientName}'` : 'for all clients';
    
    if (options.data) {
      itemsToDelete.push(`Collected metrics data ${target}`);
    }
    if (options.logs) {
      itemsToDelete.push(`Log files ${target}`);
    }
    if (options.config) {
      if (clientName) {
        itemsToDelete.push(`Configuration for client '${clientName}'`);
      } else {
        itemsToDelete.push('All configuration files');
      }
    }
  } else if (clientName) {
    // Default: clean active client's data
    itemsToDelete.push(`Data for client '${clientName}'`);
  } else {
    // No client and no specific flags - interactive mode
    printWarning('No client selected and no specific flags provided.');
    console.log(chalk.gray('\n  Usage examples:'));
    console.log(chalk.gray(`    ${chalk.cyan('gdm clean --data')}                    Clean data for active client`));
    console.log(chalk.gray(`    ${chalk.cyan('gdm clean --data --client CLIENT_A')}  Clean data for CLIENT_A`));
    console.log(chalk.gray(`    ${chalk.cyan('gdm clean --config')}                  Remove active client config`));
    console.log(chalk.gray(`    ${chalk.cyan('gdm clean --logs')}                    Clean logs for active client`));
    console.log(chalk.gray(`    ${chalk.cyan('gdm clean --all')}                     Clean everything\n`));
    return;
  }

  // Show warning
  console.log(chalk.yellow('\n  ⚠️  WARNING: This will permanently delete:\n'));
  itemsToDelete.forEach(item => {
    console.log(chalk.gray(`     • ${item}`));
  });
  console.log('');

  // Ask for confirmation unless --yes flag is provided
  if (!options.yes) {
    const confirmed = await askConfirmation('Are you sure you want to continue?');
    if (!confirmed) {
      console.log(chalk.gray('\n  Cleanup cancelled.\n'));
      return;
    }
  }

  // Perform cleanup
  let result: CleanResult;
  
  if (options.all) {
    result = cleanAll();
  } else if (cleanSpecific) {
    const details: string[] = [];
    let allSuccess = true;
    let errorMessage = '';
    
    if (options.data) {
      const dataResult = cleanData(clientName || undefined);
      details.push(...dataResult.details);
      allSuccess = allSuccess && dataResult.success;
      if (!dataResult.success) errorMessage += dataResult.message + '; ';
    }
    
    if (options.logs) {
      const logsResult = cleanLogs(clientName || undefined);
      details.push(...logsResult.details);
      allSuccess = allSuccess && logsResult.success;
      if (!logsResult.success) errorMessage += logsResult.message + '; ';
    }
    
    if (options.config) {
      const configResult = cleanConfig(clientName || undefined);
      details.push(...configResult.details);
      allSuccess = allSuccess && configResult.success;
      if (!configResult.success) errorMessage += configResult.message + '; ';
    }
    
    result = {
      success: allSuccess,
      message: allSuccess ? 'Cleanup completed successfully' : errorMessage.trim(),
      details,
    };
  } else if (clientName) {
    // Default: clean active client's data only
    result = cleanData(clientName);
  } else {
    result = { success: false, message: 'No cleanup action specified', details: [] };
  }

  // Display results
  if (result.success) {
    printSuccess(result.message);
    if (result.details.length > 0) {
      console.log(chalk.gray('\n  Details:'));
      result.details.forEach(detail => {
        console.log(chalk.gray(`    • ${detail}`));
      });
    }
    
    if (options.all || options.config) {
      console.log(chalk.gray('\n  Run `gdm init` to set up again.\n'));
    } else {
      console.log('');
    }
  } else {
    printError(result.message);
    if (result.details.length > 0) {
      console.log(chalk.gray('\n  Details:'));
      result.details.forEach(detail => {
        console.log(chalk.gray(`    • ${detail}`));
      });
    }
    console.log('');
    process.exit(1);
  }
}
