// ============================================
// Client Management Commands
// ============================================

import chalk from 'chalk';
import {
  getAllClients,
  getActiveClient,
  switchClient,
  removeClient,
  getClientConfig,
  getConfigStatus,
} from '../config/integrations';
import { printCompactHeader, printSuccess, printError, printWarning, printSection } from '../branding';

// ==========================================
// List Clients Command
// ==========================================

/**
 * Lists all configured clients and shows which is active.
 */
export async function listClientsCommand(): Promise<void> {
  printSection('Configured Clients');

  const status = getConfigStatus();

  if (status.totalClients === 0) {
    printWarning('No clients configured.');
    console.log(chalk.gray(`\n  Run ${chalk.cyan('gdm init')} to create your first client.\n`));
    return;
  }

  console.log(chalk.gray(`\n  Total: ${status.totalClients} client(s)\n`));

  for (const client of status.clients) {
    const activeMarker = client.active ? chalk.green(' ★ (active)') : '';
    console.log(chalk.bold(`  ${client.name}${activeMarker}`));
    console.log(chalk.gray(`    Repositories: ${client.repositories}`));
    
    const integrations: string[] = [];
    if (client.git.configured) integrations.push('Git');
    if (client.jira.configured) integrations.push('Jira');
    if (client.linear.configured) integrations.push('Linear');
    if (client.notion.configured) integrations.push('Notion');
    
    console.log(chalk.gray(`    Integrations: ${integrations.length > 0 ? integrations.join(', ') : 'None'}`));
    
    if (client.scheduler.enabled) {
      console.log(chalk.gray(`    Scheduler: ${chalk.green('Enabled')} (${client.scheduler.interval})`));
    }
    
    console.log('');
  }

  console.log(chalk.gray('  Commands:'));
  console.log(chalk.gray(`    ${chalk.cyan('gdm client:switch <name>')}  Switch active client`));
  console.log(chalk.gray(`    ${chalk.cyan('gdm client:remove <name>')}  Remove a client`));
  console.log(chalk.gray(`    ${chalk.cyan('gdm init --force')}          Add/update a client\n`));
}

// ==========================================
// Switch Client Command
// ==========================================

/**
 * Switches the active client.
 * 
 * @param clientName - Name of the client to switch to
 */
export async function switchClientCommand(clientName: string): Promise<void> {
  if (!clientName) {
    printError('Client name is required.');
    console.log(chalk.gray(`\n  Usage: ${chalk.cyan('gdm client:switch <name>')}\n`));
    return;
  }

  try {
    const previousClient = getActiveClient();
    switchClient(clientName);
    
    if (previousClient) {
      printSuccess(`Switched from '${previousClient}' to '${clientName}'`);
    } else {
      printSuccess(`Activated client '${clientName}'`);
    }
    
    // Show client info
    const config = getClientConfig(clientName);
    if (config) {
      console.log(chalk.gray('\n  Client details:'));
      console.log(chalk.gray(`    Repositories: ${config.repositories.length}`));
      
      const integrations: string[] = [];
      if (config.git) integrations.push('Git');
      if (config.jira) integrations.push('Jira');
      if (config.linear) integrations.push('Linear');
      if (config.notion) integrations.push('Notion');
      
      console.log(chalk.gray(`    Integrations: ${integrations.join(', ') || 'None'}\n`));
    }
  } catch (error) {
    printError((error as Error).message);
    console.log(chalk.gray(`\n  Run ${chalk.cyan('gdm client')} to see available clients.\n`));
  }
}

// ==========================================
// Remove Client Command
// ==========================================

/**
 * Removes a client from configuration.
 * 
 * @param clientName - Name of the client to remove
 * @param options - Command options
 * @param options.force - Skip confirmation prompt
 */
export async function removeClientCommand(clientName: string, options: { force?: boolean } = {}): Promise<void> {
  if (!clientName) {
    printError('Client name is required.');
    console.log(chalk.gray(`\n  Usage: ${chalk.cyan('gdm client:remove <name>')}\n`));
    return;
  }

  const config = getClientConfig(clientName);
  
  if (!config) {
    printError(`Client '${clientName}' not found.`);
    console.log(chalk.gray(`\n  Run ${chalk.cyan('gdm client')} to see available clients.\n`));
    return;
  }

  const isActive = getActiveClient() === clientName;

  // Show warning
  console.log(chalk.yellow(`\n  ⚠️  This will remove client '${clientName}' from configuration.`));
  console.log(chalk.gray(`\n  • Repositories: ${config.repositories.length}`));
  
  if (isActive) {
    const allClients = getAllClients();
    const otherClients = allClients.filter(c => c !== clientName);
    
    if (otherClients.length > 0) {
      console.log(chalk.yellow(`  • This is the active client. Will switch to '${otherClients[0]}'`));
    } else {
      console.log(chalk.yellow('  • This is the only client. No active client will remain.'));
    }
  }
  
  console.log(chalk.gray(`\n  Note: This does NOT delete collected data or logs.`));
  console.log(chalk.gray(`  Use ${chalk.cyan('gdm clean --config --client ' + clientName)} to remove data too.\n`));

  // Ask for confirmation unless --force
  if (!options.force) {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(chalk.cyan('  ? ') + 'Are you sure?' + chalk.gray(' [y/N]') + ': ', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    });

    if (!answer || !answer.toLowerCase().startsWith('y')) {
      console.log(chalk.gray('\n  Removal cancelled.\n'));
      return;
    }
  }

  // Remove the client
  const removed = removeClient(clientName);

  if (removed) {
    printSuccess(`Client '${clientName}' removed from configuration`);
    
    const newActive = getActiveClient();
    if (newActive && newActive !== clientName) {
      console.log(chalk.gray(`\n  Active client is now: ${chalk.cyan(newActive)}\n`));
    } else if (!newActive) {
      console.log(chalk.gray(`\n  No active client. Run ${chalk.cyan('gdm init')} to create a client.\n`));
    }
  } else {
    printError('Failed to remove client');
  }
}
