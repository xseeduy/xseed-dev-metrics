// ============================================
// Init Command - Interactive Setup Wizard
// ============================================

import chalk from 'chalk';
import * as readline from 'readline';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import {
  addClient,
  clientExists,
  findRepositoryOwners,
  isInitialized,
  getConfigStatus,
  ensureConfigDirs,
  getConfigFilePath,
  getActiveClient,
  switchClient,
  getClientConfig,
  GitConfig,
  JiraConfig,
  LinearConfig,
  ClientConfig,
} from '../config/integrations';
import { printWelcome, printSuccess, printError, printWarning, printSection } from '../branding';
import { JiraClient } from '../integrations/jira/client';
import { LinearClient } from '../integrations/linear/client';

// ==========================================
// Readline Helper
// ==========================================

/**
 * Creates a readline interface for interactive user input.
 * 
 * @returns Readline interface
 * @private
 */
function createRL(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompts the user for input with an optional default value.
 * 
 * @param rl - Readline interface
 * @param question - Question to ask the user
 * @param defaultValue - Optional default value
 * @returns Promise resolving to user's answer
 * @private
 */
async function ask(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {
  const defaultHint = defaultValue ? chalk.gray(` [${defaultValue}]`) : '';
  const prompt = chalk.cyan('  ? ') + question + defaultHint + ': ';
  
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/**
 * Prompts the user for a yes/no question.
 * 
 * @param rl - Readline interface
 * @param question - Question to ask
 * @param defaultYes - Whether the default is yes (true) or no (false)
 * @returns Promise resolving to user's boolean answer
 * @private
 */
async function askYesNo(rl: readline.Interface, question: string, defaultYes: boolean = true): Promise<boolean> {
  const hint = defaultYes ? chalk.gray(' [Y/n]') : chalk.gray(' [y/N]');
  const answer = await ask(rl, question + hint);
  
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

/**
 * Prompts the user for password input.
 * Note: In current implementation, input is visible (not hidden).
 * 
 * @param rl - Readline interface
 * @param question - Question to ask
 * @returns Promise resolving to user's password input
 * @private
 */
async function askPassword(rl: readline.Interface, question: string): Promise<string> {
  const prompt = chalk.cyan('  ? ') + question + ': ';
  
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    
    // Note: In a real implementation, we'd hide input. For now, show it.
    rl.question('', (answer) => {
      resolve(answer.trim());
    });
  });
}

// ==========================================
// Auto-detection helpers
// ==========================================

/**
 * Detects Git user information from global git config.
 * 
 * @returns Object with username and email
 * @private
 */
function detectGitUser(): { username: string; email: string } {
  let username = '';
  let email = '';
  
  try {
    username = execSync('git config --global user.name', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error: unknown) {
    // Git username not configured globally, will prompt user
  }
  
  try {
    email = execSync('git config --global user.email', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error: unknown) {
    // Git email not configured globally, will prompt user
  }
  
  return { username, email };
}

/**
 * Detects the main branch name for a repository.
 * Checks for 'main' first, then 'master', defaults to 'main'.
 * 
 * @param repoPath - Optional repository path (defaults to current directory)
 * @returns Main branch name ('main' or 'master')
 * @private
 */
function detectMainBranch(repoPath?: string): string {
  try {
    const workDir = repoPath || process.cwd();
    execSync('git rev-parse --verify main', { cwd: workDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return 'main';
  } catch {
    try {
      const workDir = repoPath || process.cwd();
      execSync('git rev-parse --verify master', { cwd: workDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      return 'master';
    } catch {
      return 'main';
    }
  }
}

/**
 * Checks if a directory is a valid git repository.
 * 
 * @param path - Path to check
 * @returns True if it's a git repository, false otherwise
 * @private
 */
function isGitRepo(path: string): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd: path, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

// ==========================================
// Init Command
// ==========================================

/**
 * Interactive setup wizard for first-time configuration.
 * Guides the user through configuring Git, repositories, and integrations.
 * 
 * @param options - Command options
 * @param options.force - Force reconfiguration even if already initialized
 */
export async function initCommand(options: { force?: boolean } = {}): Promise<void> {
  ensureConfigDirs();
  
  // Check if already initialized
  if (isInitialized() && !options.force) {
    const status = getConfigStatus();
    
    console.log(chalk.yellow('\n  Already configured!\n'));
    console.log(chalk.gray('  Configured clients:'));
    
    for (const client of status.clients) {
      const activeMarker = client.active ? chalk.green(' (active)') : '';
      console.log(`\n    ${chalk.bold(client.name)}${activeMarker}`);
      console.log(`      Repositories: ${client.repositories}`);
      console.log(`      Git: ${client.git.configured ? chalk.green('✓') : chalk.gray('✗')} ${client.git.username || 'Not set'}`);
      console.log(`      Jira: ${client.jira.configured ? chalk.green('✓ Connected') : chalk.gray('Not configured')}`);
      console.log(`      Linear: ${client.linear.configured ? chalk.green('✓ Connected') : chalk.gray('Not configured')}`);
    }
    
    console.log(`\n  Run ${chalk.cyan('gdm init --force')} to add/update a client.`);
    console.log(`  Run ${chalk.cyan('gdm client')} to manage clients.\n`);
    return;
  }
  
  // Show welcome
  printWelcome();
  
  const rl = createRL();
  
  try {
    // ==========================================
    // Step 1: Client Name (required)
    // ==========================================
    let clientName = '';
    let isExistingClient = false;
    let shouldReconfigure = false;
    
    while (!clientName) {
      printSection('Step 1: Client Name');
      console.log(chalk.gray('  Name of the client or organization (e.g. Pr1or Art, Remax, Givefinity).\n'));
      const clientNameRaw = await ask(rl, 'Client name');
      clientName = clientNameRaw ? clientNameRaw.trim().toUpperCase() : '';
      
      if (!clientName) {
        printWarning('Client name is required.');
        continue;
      }
      
      // Check if client already exists
      if (clientExists(clientName)) {
        isExistingClient = true;
        const reconfigure = await askYesNo(rl, `Client '${clientName}' already exists. Reconfigure?`, false);
        
        if (!reconfigure) {
          const createNew = await askYesNo(rl, 'Create a different client?', true);
          if (createNew) {
            clientName = '';
            continue;
          } else {
            console.log(chalk.gray('\n  Setup cancelled.\n'));
            rl.close();
            return;
          }
        }
        
        shouldReconfigure = true;
      }
    }
    
    // ==========================================
    // Step 2: Git Configuration
    // ==========================================
    printSection('Step 2: Git Configuration');
    console.log(chalk.gray('  Your Git identity for tracking contributions.\n'));
    
    const detected = detectGitUser();
    const detectedBranch = detectMainBranch();
    
    const gitUsername = await ask(rl, 'Git Username', detected.username);
    const gitEmail = await ask(rl, 'Git Email', detected.email);
    const mainBranch = await ask(rl, 'Main Branch (main/master)', detectedBranch);
    
    const gitConfig: GitConfig = {
      username: gitUsername,
      email: gitEmail,
      mainBranch: mainBranch,
    };
    
    // ==========================================
    // Step 3: Repository
    // ==========================================
    printSection('Step 3: Repository');
    console.log(chalk.gray('  Path to the Git repository to track.\n'));
    
    let repoPath = await ask(rl, 'Repository path', process.cwd());
    repoPath = resolve(repoPath);
    
    if (!existsSync(repoPath)) {
      printWarning(`Path not found: ${repoPath}`);
      repoPath = '';
    } else if (!isGitRepo(repoPath)) {
      printWarning(`Not a Git repository: ${repoPath}`);
      repoPath = '';
    } else {
      // Check if repository belongs to another client
      const owners = findRepositoryOwners(repoPath);
      const otherOwners = owners.filter(owner => owner !== clientName);
      
      if (otherOwners.length > 0) {
        printWarning(`This repository is already tracked by: ${otherOwners.join(', ')}`);
        const addAnyway = await askYesNo(rl, 'Add to this client anyway?', false);
        if (!addAnyway) {
          repoPath = '';
        }
      }
    }
    
    // ==========================================
    // Step 4: Jira Integration (Optional)
    // ==========================================
    printSection('Step 4: Jira Integration (Optional)');
    console.log(chalk.gray('  Connect to Atlassian Jira for additional metrics.\n'));
    
    const configureJira = await askYesNo(rl, 'Configure Jira integration?', false);
    
    let jiraConfig: JiraConfig | undefined;
    if (configureJira) {
      console.log(chalk.gray('\n  Get your API token at: https://id.atlassian.com/manage-profile/security/api-tokens\n'));
      
      const jiraUrl = await ask(rl, 'Jira URL (e.g., https://company.atlassian.net)');
      const jiraEmail = await ask(rl, 'Jira Email', gitEmail);
      const jiraToken = await askPassword(rl, 'Jira API Token');
      
      if (jiraUrl && jiraEmail && jiraToken) {
        jiraConfig = { url: jiraUrl, email: jiraEmail, token: jiraToken };
        
        // Test connection
        console.log(chalk.gray('\n  Testing Jira connection...'));
        try {
          const client = new JiraClient(jiraConfig);
          const result = await client.testConnection();
          if (result.success) {
            printSuccess(`Connected to Jira as ${result.user}`);
          } else {
            printError(`Connection failed: ${result.error}`);
            const saveAnyway = await askYesNo(rl, 'Save configuration anyway?', false);
            if (!saveAnyway) jiraConfig = undefined;
          }
        } catch (error: unknown) {
          printError(`Error: ${(error as Error).message}`);
        }
      }
    }
    
    // ==========================================
    // Step 5: Linear Integration (Optional)
    // ==========================================
    printSection('Step 5: Linear Integration (Optional)');
    console.log(chalk.gray('  Connect to Linear for issue tracking metrics.\n'));
    
    const configureLinear = await askYesNo(rl, 'Configure Linear integration?', false);
    
    let linearConfig: LinearConfig | undefined;
    if (configureLinear) {
      console.log(chalk.gray('\n  Get your API key at: https://linear.app/settings/api\n'));
      
      const linearKey = await askPassword(rl, 'Linear API Key');
      
      if (linearKey) {
        linearConfig = { apiKey: linearKey };
        
        // Test connection
        console.log(chalk.gray('\n  Testing Linear connection...'));
        try {
          const client = new LinearClient(linearConfig);
          const result = await client.testConnection();
          if (result.success) {
            printSuccess(`Connected to Linear as ${result.user}`);
          } else {
            printError(`Connection failed: ${result.error}`);
            const saveAnyway = await askYesNo(rl, 'Save configuration anyway?', false);
            if (!saveAnyway) linearConfig = undefined;
          }
        } catch (error: unknown) {
          printError(`Error: ${(error as Error).message}`);
        }
      }
    }
    
    // ==========================================
    // Step 6: Notion Integration (Optional)
    // ==========================================
    printSection('Step 6: Notion Integration (Optional)');
    console.log(chalk.gray('  Upload metrics to Notion for easy tracking.\n'));
    
    const configureNotion = await askYesNo(rl, 'Configure Notion integration?', false);
    
    let notionConfig: { enabled: boolean; apiKey: string; parentPageId: string; clientName?: string; autoUploadOnSchedule?: boolean } | undefined;
    if (configureNotion) {
      console.log(chalk.gray('\n  Setup:'));
      console.log(chalk.gray('  1. Create integration: https://notion.so/my-integrations'));
      console.log(chalk.gray('  2. Copy the Internal Integration Secret'));
      console.log(chalk.gray('  3. Share a page with the integration\n'));
      
      const notionApiKey = await askPassword(rl, 'Notion API Key');
      const notionParentPageId = await ask(rl, 'Parent Page ID');
      const notionClientName = await ask(rl, 'Client Name (optional, defaults to repo name)');
      const autoUpload = await askYesNo(rl, 'Auto-upload when scheduled collection runs?', true);
      
      if (notionApiKey && notionParentPageId) {
        notionConfig = {
          enabled: true,
          apiKey: notionApiKey,
          parentPageId: notionParentPageId,
          clientName: notionClientName || undefined,
          autoUploadOnSchedule: autoUpload,
        };
        
        // Test connection
        console.log(chalk.gray('\n  Testing Notion connection...'));
        try {
          const { NotionClient } = await import('../integrations/notion');
          const client = new NotionClient(notionConfig);
          const result = await client.testConnection();
          if (result.success) {
            printSuccess(`Connected to Notion as ${result.user}`);
          } else {
            printError(`Connection failed: ${result.error}`);
            const saveAnyway = await askYesNo(rl, 'Save configuration anyway?', false);
            if (!saveAnyway) notionConfig = undefined;
          }
        } catch (error: unknown) {
          printError(`Error: ${(error as Error).message}`);
        }
      }
    }
    
    // ==========================================
    // Step 7: Scheduler (Optional)
    // ==========================================
    printSection('Step 7: Automatic Collection (Optional)');
    console.log(chalk.gray('  Schedule automatic metric collection.\n'));
    
    const enableScheduler = await askYesNo(rl, 'Enable weekly automatic collection?', true);
    
    // ==========================================
    // Save Configuration
    // ==========================================
    printSection('Saving Configuration');
    
    // Get existing repositories if reconfiguring
    const existingRepos = isExistingClient && shouldReconfigure 
      ? (getClientConfig(clientName)?.repositories || [])
      : [];
    
    // Merge with new repository if provided
    const repositories = repoPath 
      ? [...new Set([...existingRepos, repoPath])]
      : existingRepos;
    
    const clientConfig: ClientConfig = {
      git: gitConfig,
      jira: jiraConfig,
      linear: linearConfig,
      notion: notionConfig,
      repositories,
      scheduler: {
        enabled: enableScheduler,
        interval: 'weekly',
        dayOfWeek: 1, // Monday
        time: '09:00',
      },
    };
    
    addClient(clientName, clientConfig, true);
    
    printSuccess(`Client '${clientName}' configured and activated!`);
    console.log(chalk.gray(`\n  Config file: ${getConfigFilePath()}\n`));
    
    // ==========================================
    // Next Steps
    // ==========================================
    printSection('Next Steps');
    console.log(chalk.white('  Run these commands to get started:\n'));
    console.log(`    ${chalk.cyan('gdm collect')}     - Collect metrics now`);
    console.log(`    ${chalk.cyan('gdm report')}      - Generate a report`);
    console.log(`    ${chalk.cyan('gdm status')}      - Show configuration status`);
    
    if (enableScheduler) {
      console.log(`\n  ${chalk.gray('Scheduler enabled - metrics will be collected weekly.')}`);
      console.log(`  ${chalk.gray('Run')} ${chalk.cyan('gdm daemon start')} ${chalk.gray('to start the background service.')}`);
    }
    
    console.log('');
    
  } catch (error: unknown) {
    printError((error as Error).message);
  } finally {
    rl.close();
  }
}

// ==========================================
// Quick Init (non-interactive)
// ==========================================

/**
 * Non-interactive setup using command-line options.
 * Useful for CI/CD environments or scripted setups.
 * 
 * @param options - Configuration options
 * @param options.clientName - Client/organization name (required)
 * @param options.username - Git username
 * @param options.email - Git email
 * @param options.branch - Main branch name
 * @param options.repo - Repository path
 * @param options.jiraUrl - Jira instance URL
 * @param options.jiraEmail - Jira account email
 * @param options.jiraToken - Jira API token
 * @param options.linearKey - Linear API key
 */
export async function quickInitCommand(options: {
  clientName?: string;
  username?: string;
  email?: string;
  branch?: string;
  repo?: string;
  jiraUrl?: string;
  jiraEmail?: string;
  jiraToken?: string;
  linearKey?: string;
}): Promise<void> {
  const clientName = options.clientName?.trim().toUpperCase();
  if (!clientName) {
    printError('Client name is required. Use --client-name <name>.');
    return;
  }

  ensureConfigDirs();
  
  const detected = detectGitUser();
  
  const clientConfig: ClientConfig = {
    git: {
      username: options.username || detected.username || '',
      email: options.email || detected.email || '',
      mainBranch: options.branch || 'main',
    },
    repositories: [],
  };
  
  if (options.repo) {
    const fullPath = resolve(options.repo);
    if (existsSync(fullPath) && isGitRepo(fullPath)) {
      clientConfig.repositories = [fullPath];
    }
  }
  
  if (options.jiraUrl && options.jiraEmail && options.jiraToken) {
    clientConfig.jira = {
      url: options.jiraUrl,
      email: options.jiraEmail,
      token: options.jiraToken,
    };
  }
  
  if (options.linearKey) {
    clientConfig.linear = { apiKey: options.linearKey };
  }
  
  addClient(clientName, clientConfig, true);
  printSuccess(`Client '${clientName}' configured and activated!`);
}
