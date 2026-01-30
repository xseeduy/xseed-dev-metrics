#!/usr/bin/env node
// ============================================
// Xseed Developer Metrics CLI - Entry Point
// ============================================

import { Command } from 'commander';
import chalk from 'chalk';
import {
  summaryCommand,
  authorsCommand,
  commitsCommand,
  activityCommand,
  filesCommand,
  trendsCommand,
  blameCommand,
  reportCommand,
  fileTypesCommand,
} from './commands';
import { jiraCommand } from './commands/jira';
import { linearCommand } from './commands/linear';
import { configCommand } from './commands/config';
import { initCommand, quickInitCommand } from './commands/init';
import { collectCommand, showCommand } from './commands/collect';
import { daemonCommand } from './commands/daemon';
import { XSEED_LOGO, printBanner, printCompactHeader } from './branding';
import { isInitialized, getConfigStatus } from './config/integrations';

const program = new Command();

// Determine display mode
const args = process.argv.slice(2);
const isSubcommand = args.length > 0 && !args[0].startsWith('-');
const showFullBanner = !isSubcommand || args[0] === 'init';

if (isSubcommand && args[0] !== 'init') {
  printCompactHeader();
}

program
  .name('gdm')
  .description('Xseed Developer Metrics - Track productivity across Git, Jira & Linear')
  .version('1.0.0');

// ==========================================
// Init Command (first-time configuration)
// ==========================================
program
  .command('init')
  .description('Interactive setup wizard for first-time configuration')
  .option('--force', 'Reconfigure even if already set up')
  .option('--client-name <name>', 'Client/organization name, stored in uppercase (non-interactive)')
  .option('--username <name>', 'Git username (non-interactive)')
  .option('--email <email>', 'Git email (non-interactive)')
  .option('--branch <branch>', 'Main branch (non-interactive)')
  .option('--repo <path>', 'Repository path (non-interactive)')
  .option('--jira-url <url>', 'Jira URL (non-interactive)')
  .option('--jira-email <email>', 'Jira email (non-interactive)')
  .option('--jira-token <token>', 'Jira token (non-interactive)')
  .option('--linear-key <key>', 'Linear API key (non-interactive)')
  .action(async (options) => {
    if (options.clientName || options.username || options.email || options.jiraUrl || options.linearKey) {
      await quickInitCommand({
        clientName: options.clientName,
        username: options.username,
        email: options.email,
        branch: options.branch,
        repo: options.repo,
        jiraUrl: options.jiraUrl,
        jiraEmail: options.jiraEmail,
        jiraToken: options.jiraToken,
        linearKey: options.linearKey,
      });
    } else {
      await initCommand({ force: options.force });
    }
  });

// ==========================================
// Collect Command
// ==========================================
program
  .command('collect')
  .description('Collect metrics from configured repositories')
  .option('-r, --repo <path>', 'Specific repository to collect from')
  .option('-a, --all', 'Collect from all configured repositories')
  .option('--no-pull', 'Skip git pull before collecting')
  .option('-t, --total', 'Collect all-time metrics (no date range)')
  .option('-s, --since <date>', 'Start date for metrics (e.g. 2024-01-01)')
  .option('-u, --until <date>', 'End date for metrics (e.g. 2024-12-31)')
  .option('--usernames <list>', 'Collect for specific users (comma-separated) or ALL')
  .option('--jira <project>', 'Include Jira project metrics')
  .option('-q, --quiet', 'Minimal output')
  .option('--scheduled', 'Mark as scheduled run (used by cron)')
  .option('--upload', 'Force upload to Notion')
  .option('--no-upload', 'Skip upload to Notion')
  .action(collectCommand);

// ==========================================
// Show Command
// ==========================================
program
  .command('show')
  .description('Show collected historical metrics')
  .option('-r, --repo <path>', 'Repository to show data for')
  .option('-n, --last <number>', 'Number of entries to show', '5')
  .option('-f, --format <type>', 'Output format: table, json', 'table')
  .action((options) => showCommand({ ...options, last: parseInt(options.last) }));

// ==========================================
// Daemon Command
// ==========================================
program
  .command('daemon [action]')
  .description('Manage background scheduler (start|stop|status|logs|run)')
  .action((action = 'status') => daemonCommand(action));

// ==========================================
// Status Command
// ==========================================
program
  .command('status')
  .description('Show current configuration status')
  .action(() => {
    const status = getConfigStatus();
    
    console.log(chalk.bold('\n  📋 Configuration Status\n'));
    console.log(chalk.gray('  ' + '─'.repeat(40)));
    
    console.log(chalk.cyan('\n  Git:'));
    console.log(`    User: ${status.git.configured ? chalk.green(status.git.username) : chalk.gray('Not configured')}`);
    console.log(`    Email: ${status.git.email || chalk.gray('Not set')}`);
    console.log(`    Branch: ${status.git.mainBranch || chalk.gray('Not set')}`);
    
    console.log(chalk.cyan('\n  Integrations:'));
    console.log(`    Jira: ${status.jira.configured ? chalk.green('✓ Connected') : chalk.gray('✗ Not configured')}`);
    console.log(`    Linear: ${status.linear.configured ? chalk.green('✓ Connected') : chalk.gray('✗ Not configured')}`);
    console.log(`    Notion: ${status.notion.configured ? chalk.green('✓ Connected') : chalk.gray('✗ Not configured')}`);
    
    console.log(chalk.cyan('\n  Scheduler:'));
    console.log(`    Status: ${status.scheduler.enabled ? chalk.green('✓ Enabled') : chalk.gray('✗ Disabled')}`);
    if (status.scheduler.interval) {
      console.log(`    Interval: ${status.scheduler.interval}`);
    }
    
    console.log(`\n    Repositories: ${status.repositories}`);
    console.log('');
    
    if (!status.initialized) {
      console.log(chalk.yellow('  → Run `gdm init` to configure\n'));
    }
  });

// Common options helper
const addCommonOptions = (cmd: Command) => {
  return cmd
    .option('-s, --since <date>', 'Start date (ISO or relative)')
    .option('-u, --until <date>', 'End date (ISO or relative)')
    .option('-a, --author <name>', 'Filter by author name')
    .option('-b, --branch <name>', 'Specific branch to analyze')
    .option('-m, --merges', 'Include merge commits', false)
    .option('-f, --format <type>', 'Output format: table, json, csv, markdown', 'table')
    .option('-o, --output <file>', 'Save output to file');
};

// ==========================================
// Git Analysis Commands
// ==========================================
addCommonOptions(
  program.command('summary').description('Repository summary statistics').argument('[path]', 'Repository path', '.')
).action(summaryCommand);

addCommonOptions(
  program.command('authors').description('Statistics per author').argument('[path]', 'Repository path', '.')
    .option('-l, --limit <n>', 'Limit number of authors', parseInt)
).action(authorsCommand);

addCommonOptions(
  program.command('commits').description('List commits with statistics').argument('[path]', 'Repository path', '.')
    .option('-l, --limit <n>', 'Limit number of commits', parseInt, 50)
).action(commitsCommand);

addCommonOptions(
  program.command('activity').description('Activity patterns (by hour, day)').argument('[path]', 'Repository path', '.')
).action(activityCommand);

addCommonOptions(
  program.command('files').description('Most frequently changed files').argument('[path]', 'Repository path', '.')
    .option('-l, --limit <n>', 'Limit number of files', parseInt, 20)
).action(filesCommand);

addCommonOptions(
  program.command('trends').description('Activity trends over time').argument('[path]', 'Repository path', '.')
    .option('-g, --group-by <period>', 'Group by: day, week, month, year', 'month')
).action(trendsCommand);

program.command('blame').description('Code ownership statistics').argument('[path]', 'Repository path', '.')
  .option('--file <path>', 'Analyze specific file only')
  .option('-f, --format <type>', 'Output format: table, json, csv, markdown', 'table')
  .option('-o, --output <file>', 'Save output to file')
  .action(blameCommand);

addCommonOptions(
  program.command('report').description('Comprehensive report (Git + Jira/Linear)').argument('[path]', 'Repository path', '.')
    .option('--jira <project>', 'Include Jira metrics')
    .option('--linear <team>', 'Include Linear metrics')
).action(reportCommand);

addCommonOptions(
  program.command('types').description('Statistics by file type').argument('[path]', 'Repository path', '.')
).action(fileTypesCommand);

// ==========================================
// Integration Commands
// ==========================================
program.command('jira').description('Jira project metrics')
  .requiredOption('-p, --project <key>', 'Jira project key')
  .option('-s, --since <date>', 'Start date')
  .option('-u, --until <date>', 'End date')
  .option('--subtasks', 'Include subtasks', false)
  .option('-f, --format <type>', 'Output format', 'table')
  .option('-o, --output <file>', 'Save output to file')
  .action(jiraCommand);

program.command('linear').description('Linear team metrics')
  .requiredOption('-t, --team <name>', 'Linear team name')
  .option('-s, --since <date>', 'Start date')
  .option('-u, --until <date>', 'End date')
  .option('-f, --format <type>', 'Output format', 'table')
  .option('-o, --output <file>', 'Save output to file')
  .action(linearCommand);

program.command('config').description('Manage integration configurations')
  .option('--check', 'Check configurations')
  .option('--init', 'Create example config file')
  .option('--test', 'Test connections')
  .action(configCommand);

// ==========================================
// Help Text
// ==========================================
program.addHelpText('after', `
${chalk.bold('Quick Start:')}
  ${chalk.cyan('gdm init')}           Interactive setup wizard
  ${chalk.cyan('gdm collect')}        Collect metrics from repos
  ${chalk.cyan('gdm show')}           View collected metrics
  ${chalk.cyan('gdm daemon start')}   Enable weekly auto-collection

${chalk.bold('Git Analysis:')}
  ${chalk.cyan('gdm summary')}        Repository overview
  ${chalk.cyan('gdm authors')}        Per-author statistics
  ${chalk.cyan('gdm report')}         Full report (Git + Jira)

${chalk.bold('Integrations:')}
  ${chalk.cyan('gdm jira -p KEY')}    Jira project metrics
  ${chalk.cyan('gdm linear -t Team')} Linear team metrics

${chalk.bold('Environment Variables:')}
  GDM_GIT_USERNAME, GDM_GIT_EMAIL, GDM_MAIN_BRANCH
  JIRA_URL, JIRA_EMAIL, JIRA_TOKEN
  LINEAR_API_KEY
`);

// ==========================================
// Default Action (no command)
// ==========================================
if (args.length === 0) {
  printBanner();
  
  if (isInitialized()) {
    const status = getConfigStatus();
    console.log(chalk.gray('  Quick Status:\n'));
    console.log(`    Git: ${status.git.configured ? chalk.green(status.git.username) : chalk.yellow('Not configured')}`);
    console.log(`    Jira: ${status.jira.configured ? chalk.green('Connected') : chalk.gray('Not connected')}`);
    console.log(`    Linear: ${status.linear.configured ? chalk.green('Connected') : chalk.gray('Not connected')}`);
    console.log(`    Repos: ${status.repositories}`);
    console.log('\n  ' + chalk.gray('Run `gdm --help` for available commands\n'));
  } else {
    console.log(chalk.yellow('  → First time? Run `gdm init` to get started\n'));
  }
} else {
  program.parse();
}
