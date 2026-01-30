// ============================================
// Init Command - Interactive Setup Wizard
// ============================================

import chalk from 'chalk';
import * as readline from 'readline';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import {
  saveConfig,
  isInitialized,
  getConfigStatus,
  ensureConfigDirs,
  getConfigFilePath,
  GitConfig,
  JiraConfig,
  LinearConfig,
} from '../config/integrations';
import { printWelcome, printSuccess, printError, printWarning, printSection } from '../branding';
import { JiraClient } from '../integrations/jira/client';
import { LinearClient } from '../integrations/linear/client';

// ==========================================
// Readline Helper
// ==========================================

function createRL(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function ask(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {
  const defaultHint = defaultValue ? chalk.gray(` [${defaultValue}]`) : '';
  const prompt = chalk.cyan('  ? ') + question + defaultHint + ': ';
  
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

async function askYesNo(rl: readline.Interface, question: string, defaultYes: boolean = true): Promise<boolean> {
  const hint = defaultYes ? chalk.gray(' [Y/n]') : chalk.gray(' [y/N]');
  const answer = await ask(rl, question + hint);
  
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

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

function detectGitUser(): { username: string; email: string } {
  let username = '';
  let email = '';
  
  try {
    username = execSync('git config --global user.name', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {}
  
  try {
    email = execSync('git config --global user.email', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {}
  
  return { username, email };
}

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

export async function initCommand(options: { force?: boolean } = {}): Promise<void> {
  ensureConfigDirs();
  
  // Check if already initialized
  if (isInitialized() && !options.force) {
    const status = getConfigStatus();
    
    console.log(chalk.yellow('\n  Already configured!\n'));
    console.log(chalk.gray('  Current settings:'));
    console.log(`    Client: ${status.clientName}`);
    console.log(`    Git User: ${status.git.username || 'Not set'} <${status.git.email || 'Not set'}>`);
    console.log(`    Main Branch: ${status.git.mainBranch || 'Not set'}`);
    console.log(`    Jira: ${status.jira.configured ? chalk.green('✓ Connected') : chalk.gray('Not configured')}`);
    console.log(`    Linear: ${status.linear.configured ? chalk.green('✓ Connected') : chalk.gray('Not configured')}`);
    console.log(`    Repositories: ${status.repositories}`);
    console.log(`\n  Run ${chalk.cyan('gdm init --force')} to reconfigure.\n`);
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
    while (!clientName) {
      printSection('Step 1: Client Name');
      console.log(chalk.gray('  Name of the client or organization (e.g. Pr1or Art, Remax, Givefinity).\n'));
      const clientNameRaw = await ask(rl, 'Client name');
      clientName = clientNameRaw ? clientNameRaw.trim().toUpperCase() : '';
      if (!clientName) {
        printWarning('Client name is required.');
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
    
    saveConfig({
      initialized: true,
      version: '1.0.0',
      clientName,
      git: gitConfig,
      jira: jiraConfig,
      linear: linearConfig,
      notion: notionConfig,
      repositories: repoPath ? [repoPath] : [],
      scheduler: {
        enabled: enableScheduler,
        interval: 'weekly',
        dayOfWeek: 1, // Monday
        time: '09:00',
      },
    });
    
    printSuccess('Configuration saved!');
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
  const clientName = options.clientName?.trim();
  if (!clientName) {
    printError('Client name is required. Use --client-name <name>.');
    return;
  }

  ensureConfigDirs();
  
  const detected = detectGitUser();
  
  const config: Record<string, unknown> = {
    initialized: true,
    version: '1.0.0',
    clientName: clientName.toUpperCase(),
    git: {
      username: options.username || detected.username || '',
      email: options.email || detected.email || '',
      mainBranch: options.branch || 'main',
    },
  };
  
  if (options.repo) {
    const fullPath = resolve(options.repo);
    if (existsSync(fullPath) && isGitRepo(fullPath)) {
      config.repositories = [fullPath];
    }
  }
  
  if (options.jiraUrl && options.jiraEmail && options.jiraToken) {
    config.jira = {
      url: options.jiraUrl,
      email: options.jiraEmail,
      token: options.jiraToken,
    };
  }
  
  if (options.linearKey) {
    config.linear = { apiKey: options.linearKey };
  }
  
  saveConfig(config);
  printSuccess('Configuration saved!');
}
