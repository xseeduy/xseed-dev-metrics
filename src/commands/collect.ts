// ============================================
// Collect Command - Gather Metrics from Repos
// ============================================

import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import { existsSync, writeFileSync, readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { format, differenceInDays, parseISO } from 'date-fns';
import {
  getConfig,
  getJiraConfig,
  getDataDir,
  saveConfig,
  isInitialized,
} from '../config/integrations';
import { GitMetrics } from '../core/git-metrics';
import { JiraClient } from '../integrations/jira/client';
import { calculateJiraMetrics } from '../integrations/jira/metrics';
import { printCompactHeader, printSuccess, printError, printWarning, printSection } from '../branding';
import { DEFAULTS, TIME_THRESHOLDS } from '../config/constants';

interface CollectedData {
  collectedAt: string;
  fileName?: string;
  period?: {
    since: string | null;
    until: string | null;
    label: string;
  };
  repository: string;
  repoName: string;
  user: { username: string; email: string };
  gitMetrics: {
    summary: unknown;
    userStats: unknown;
    activity: unknown;
    trends: unknown;
  };
  jiraMetrics?: unknown;
}

// ==========================================
// Git Operations
// ==========================================

function gitPull(repoPath: string, branch: string): { success: boolean; message: string } {
  try {
    // Fetch first
    execSync(`git fetch origin`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    // Get current branch
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    
    // If not on main branch, checkout
    if (currentBranch !== branch) {
      try {
        execSync('git stash', { cwd: repoPath, stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (error: unknown) {
        // Stash might fail if there are no changes, which is fine
      }
      
      execSync(`git checkout ${branch}`, {
        cwd: repoPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }
    
    // Pull
    const result = execSync(`git pull origin ${branch}`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    return { success: true, message: result.trim() || 'Already up to date' };
  } catch (error: unknown) {
    return { success: false, message: (error as Error).message };
  }
}

function getRepoName(repoPath: string): string {
  try {
    const remoteUrl = execSync('git remote get-url origin', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    
    const match = remoteUrl.match(/\/([^\/]+?)(\.git)?$/);
    return match ? match[1] : basename(repoPath);
  } catch {
    return basename(repoPath);
  }
}

/** Slug for filenames: "John Doe" -> "John_Doe". */
function authorToSlug(name: string): string {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** Get one email for an author from repo history. */
function getEmailForAuthor(repoPath: string, authorName: string): string {
  try {
    const escaped = authorName.replace(/"/g, '\\"');
    const email = execSync(`git log -1 --format=%ae --author="${escaped}"`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return email || '';
  } catch {
    return '';
  }
}

/** Get all author names in the repo (optionally filtered by since/until). */
function getAuthorsInRepo(
  repoPath: string,
  filterOptions: { since?: string; until?: string }
): string[] {
  try {
    const args: string[] = [];
    if (filterOptions.since) args.push(`--since="${filterOptions.since}"`);
    if (filterOptions.until) args.push(`--until="${filterOptions.until}"`);
    const logArgs = args.join(' ');
    // Windows-compatible: no sort -u, use JavaScript Set for uniqueness
    const raw = execSync(`git log --format='%aN' ${logArgs}`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const authors = raw ? raw.split('\n').filter(Boolean) : [];
    return Array.from(new Set(authors)); // Get unique authors
  } catch {
    return [];
  }
}

// ==========================================
// Period label (human-readable report range)
// ==========================================

function getPeriodLabel(
  total: boolean,
  since: string | undefined,
  until: string | undefined,
  defaultSince: string,
  defaultUntil: string
): { since: string | null; until: string | null; label: string } {
  if (total) {
    return { since: null, until: null, label: 'Total (all time)' };
  }
  const s = since ?? defaultSince;
  const u = until ?? defaultUntil;
  const from = parseISO(s);
  const to = parseISO(u);
  const days = differenceInDays(to, from);
  let label: string;
  if (days <= 7) label = 'Last 7 days';
  else if (days <= 30) label = 'Last 30 days';
  else if (days <= 90 && s === defaultSince && u === defaultUntil) label = 'Last 90 days';
  else label = `${s} → ${u}`;
  return { since: s, until: u, label };
}

// ==========================================
// Collect Metrics
// ==========================================

async function collectRepoMetrics(
  repoPath: string,
  gitConfig: { username: string; email: string; mainBranch: string },
  options: {
    total?: boolean;
    since?: string;
    until?: string;
    jiraProject?: string;
    authorOverride?: string;
  }
): Promise<CollectedData> {
  const metrics = new GitMetrics(repoPath);
  const now = new Date();
  const defaultSince = format(new Date(now.getTime() - DEFAULTS.COLLECTION_DAYS * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const defaultUntil = format(now, 'yyyy-MM-dd');

  const filterOptions =
    options.total
      ? {}
      : {
          since: options.since || defaultSince,
          until: options.until || defaultUntil,
        };
  const since = filterOptions.since ?? defaultSince;
  const until = filterOptions.until ?? defaultUntil;
  const period = getPeriodLabel(
    !!options.total,
    filterOptions.since,
    filterOptions.until,
    defaultSince,
    defaultUntil
  );

  const author = options.authorOverride ?? gitConfig.username;
  const userEmail = options.authorOverride
    ? getEmailForAuthor(repoPath, options.authorOverride)
    : gitConfig.email;

  // Get general summary (repo-wide, no author filter)
  const summary = metrics.getRepoSummary(filterOptions);
  // Get user-specific stats
  const userStats = metrics.getAuthorStats({ ...filterOptions, author });
  // Get activity patterns
  const activity = metrics.getTimeStats({ ...filterOptions, author });
  // Get weekly trends
  const trends = metrics.getStatsByPeriod({ ...filterOptions, author }, 'week');

  const data: CollectedData = {
    collectedAt: now.toISOString(),
    period,
    repository: repoPath,
    repoName: getRepoName(repoPath),
    user: { username: author, email: userEmail },
    gitMetrics: { summary, userStats, activity, trends },
  };

  // Get Jira metrics if configured (use config email for assignee when no override)
  if (options.jiraProject) {
    const jiraConfig = getJiraConfig();
    if (jiraConfig) {
      try {
        const client = new JiraClient(jiraConfig);
        const assigneeEmail = options.authorOverride ? userEmail : gitConfig.email;
        const issues = await client.getProjectIssues({
          project: options.jiraProject,
          since,
          assignee: assigneeEmail,
        });
        data.jiraMetrics = calculateJiraMetrics(issues, { since, until });
      } catch (error: unknown) {
        data.jiraMetrics = { available: false, error: (error as Error).message };
      }
    }
  }

  return data;
}

// ==========================================
// Save Data
// ==========================================

function saveCollectedData(repoName: string, data: CollectedData, authorSlug?: string): string {
  const dataDir = getDataDir();
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const filename = authorSlug
    ? `${repoName}_${authorSlug}_${dateStr}.json`
    : `${repoName}_${dateStr}.json`;
  const filepath = join(dataDir, filename);

  data.fileName = filename;
  writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

// ==========================================
// Load Historical Data
// ==========================================

export function loadHistoricalData(repoName: string, limit: number = 10): CollectedData[] {
  const dataDir = getDataDir();
  const files: CollectedData[] = [];
  
  try {
    const entries = readdirSync(dataDir);
    
    for (const entry of entries) {
      if (entry.startsWith(repoName) && entry.endsWith('.json')) {
        try {
          const content = readFileSync(join(dataDir, entry), 'utf-8');
          files.push(JSON.parse(content));
        } catch (error: unknown) {
          // Failed to parse JSON file, skip it
        }
      }
    }
  } catch (error: unknown) {
    // Failed to read data directory, return empty array
  }
  
  return files
    .sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime())
    .slice(0, limit);
}

// ==========================================
// Collect Command
// ==========================================

/** Parse --usernames: comma-separated list, or "ALL" (case-insensitive). */
function parseUsernamesOption(usernames?: string): { type: 'none' } | { type: 'all' } | { type: 'list'; names: string[] } {
  if (!usernames || !usernames.trim()) return { type: 'none' };
  const trimmed = usernames.trim();
  if (trimmed.toUpperCase() === 'ALL') return { type: 'all' };
  const names = trimmed.split(',').map(n => n.trim()).filter(Boolean);
  return names.length ? { type: 'list', names } : { type: 'none' };
}

export async function collectCommand(options: {
  repo?: string;
  pull?: boolean;
  total?: boolean;
  since?: string;
  until?: string;
  usernames?: string;
  jira?: string;
  all?: boolean;
  quiet?: boolean;
  scheduled?: boolean;
  upload?: boolean;
  noUpload?: boolean;
}): Promise<void> {
  if (!isInitialized()) {
    printError('Not configured. Run `gdm init` first.');
    return;
  }

  const config = getConfig();
  const gitConfig = config.git;

  if (!gitConfig) {
    printError('Git configuration missing. Run `gdm init` to configure.');
    return;
  }

  const usernamesOption = parseUsernamesOption(options.usernames);

  if (!options.quiet) {
    printCompactHeader();
    console.log(chalk.gray('  Collecting developer metrics...\n'));
  }

  // Determine which repos to collect from
  let repos: string[] = [];

  if (options.repo) {
    repos = [options.repo];
  } else if (config.repositories?.length) {
    repos = options.all ? config.repositories : [config.repositories[0]];
  } else {
    // Use current directory
    const cwd = process.cwd();
    try {
      execSync('git rev-parse --git-dir', { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
      repos = [cwd];
    } catch {
      printError('No repositories configured. Run `gdm init` or specify with --repo');
      return;
    }
  }

  const now = new Date();
  const defaultSince = format(new Date(now.getTime() - DEFAULTS.COLLECTION_DAYS * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const defaultUntil = format(now, 'yyyy-MM-dd');
  const filterOptions = options.total
    ? {}
    : {
        since: options.since || defaultSince,
        until: options.until || defaultUntil,
      };

  const results: Array<{ repo: string; success: boolean; files?: string[]; error?: string }> = [];

  for (const repoPath of repos) {
    if (!existsSync(repoPath)) {
      results.push({ repo: repoPath, success: false, error: 'Path not found' });
      continue;
    }

    const repoName = getRepoName(repoPath);

    // Resolve list of users to collect for this repo
    let usersToCollect: string[];
    if (usernamesOption.type === 'none') {
      usersToCollect = [gitConfig.username];
    } else if (usernamesOption.type === 'all') {
      usersToCollect = getAuthorsInRepo(repoPath, filterOptions);
      if (!usersToCollect.length && !options.quiet) {
        printWarning(`No authors found in ${repoName}.`);
        continue;
      }
    } else {
      usersToCollect = usernamesOption.names;
    }

    const singleUser = usersToCollect.length === 1 && usersToCollect[0] === gitConfig.username && usernamesOption.type === 'none';

    // One spinner per repo when multi-user; per user when single
    const spinner = ora({
      text: singleUser ? `Processing ${chalk.bold(repoName)}...` : `Processing ${chalk.bold(repoName)} (${usersToCollect.length} users)...`,
      isSilent: options.quiet,
    }).start();

    try {
      // Git pull if not disabled (once per repo)
      if (options.pull !== false) {
        spinner.text = `Pulling latest from ${gitConfig.mainBranch}...`;
        const pullResult = gitPull(repoPath, gitConfig.mainBranch);

        if (!pullResult.success && !options.quiet) {
          spinner.warn(`Pull warning: ${pullResult.message}`);
          spinner.start();
        }
      }

      const filesSaved: string[] = [];

      for (const username of usersToCollect) {
        if (!singleUser && !options.quiet) {
          spinner.text = `Collecting for ${chalk.bold(username)}...`;
        } else {
          spinner.text = 'Collecting Git metrics...';
        }

        const data = await collectRepoMetrics(repoPath, gitConfig, {
          total: options.total,
          since: options.since,
          until: options.until,
          jiraProject: options.jira,
          authorOverride: singleUser ? undefined : username,
        });

        const authorSlug = singleUser ? undefined : authorToSlug(username);
        const filepath = saveCollectedData(repoName, data, authorSlug);
        filesSaved.push(filepath);
      }

      results.push({ repo: repoName, success: true, files: filesSaved });

      spinner.succeed(
        singleUser
          ? `${chalk.bold(repoName)}: Metrics collected`
          : `${chalk.bold(repoName)}: ${usersToCollect.length} user(s) collected`
      );
    } catch (error: unknown) {
      spinner.fail(`${chalk.bold(repoName)}: Failed`);
      results.push({ repo: repoName, success: false, error: (error as Error).message });
    }
  }
  
  // Update last run (best-effort; don't fail if config is read-only)
  try {
    saveConfig({ lastRun: new Date().toISOString() });
  } catch {
    // ignore
  }
  
  // Summary
  if (!options.quiet) {
    console.log('\n' + chalk.gray('  ' + '─'.repeat(40)));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length) {
      printSuccess(`${successful.length} repository(s) processed`);
      successful.forEach(r => {
        if (r.files?.length) {
          console.log(chalk.gray('  Saved to:'));
          r.files.forEach(f => console.log(chalk.cyan(`    ${f}`)));
        }
      });
    }
    if (failed.length) {
      printError(`${failed.length} failed:`);
      failed.forEach(f => console.log(chalk.gray(`    - ${f.repo}: ${f.error}`)));
    }

    console.log(chalk.gray(`\n  Data directory: ${getDataDir()}\n`));
  }

  // ==========================================
  // Upload to Notion (if configured)
  // ==========================================
  const successful = results.filter(r => r.success);
  if (successful.length === 0) {
    return; // No files to upload
  }

  const { getNotionConfig } = await import('../config/integrations');
  const notionConfig = getNotionConfig();

  // Determine if we should upload
  let shouldUpload = false;

  if (options.noUpload) {
    return; // Explicitly disabled
  }

  if (options.upload) {
    shouldUpload = true; // Explicitly enabled
  } else if (options.scheduled && notionConfig?.autoUploadOnSchedule) {
    shouldUpload = true; // Scheduled run with auto-upload
  } else if (!options.scheduled && !options.quiet && notionConfig?.enabled) {
    // Interactive mode: prompt user
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(chalk.cyan('  ? ') + 'Upload to Notion? ' + chalk.gray('[Y/n]') + ': ', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    });

    shouldUpload = !answer || answer.toLowerCase().startsWith('y');
  }

  if (!shouldUpload) {
    return;
  }

  // Check Notion config
  if (!notionConfig) {
    if (!options.quiet) {
      printWarning('Notion not configured. Add notion config to upload metrics.');
    }
    return;
  }

  // Upload files
  try {
    const { NotionClient } = await import('../integrations/notion');
    const client = new NotionClient(notionConfig);

    if (!options.quiet) {
      console.log(chalk.gray('  Uploading to Notion...'));
    }

    const spinner = ora({
      text: 'Uploading metrics to Notion...',
      isSilent: options.quiet,
    }).start();

    // Prepare files with data
    const filesToUpload: Array<{ path: string; data: CollectedData }> = [];
    for (const result of successful) {
      if (result.files) {
        for (const filePath of result.files) {
          try {
            const fileContent = readFileSync(filePath, 'utf-8');
            const data = JSON.parse(fileContent) as CollectedData;
            filesToUpload.push({ path: filePath, data });
          } catch (error: unknown) {
            // Failed to read or parse file, skip it
          }
        }
      }
    }

    const uploaded = await client.uploadCollectedFiles(filesToUpload);

    if (uploaded > 0) {
      spinner.succeed(`Uploaded ${uploaded} file(s) to Notion`);
    } else {
      spinner.fail('Failed to upload files to Notion');
    }
  } catch (error: unknown) {
    if (!options.quiet) {
      printError(`Notion upload failed: ${(error as Error).message}`);
    }
  }
}

// ==========================================
// Show Command - Display Historical Data
// ==========================================

export async function showCommand(options: {
  repo?: string;
  last?: number;
  format?: 'table' | 'json';
}): Promise<void> {
  if (!isInitialized()) {
    printError('Not configured. Run `gdm init` first.');
    return;
  }
  
  printCompactHeader();
  
  const config = getConfig();
  let repoName: string;
  
  if (options.repo) {
    repoName = getRepoName(options.repo);
  } else if (config.repositories?.length) {
    repoName = getRepoName(config.repositories[0]);
  } else {
    repoName = getRepoName(process.cwd());
  }
  
  const limit = options.last || 5;
  const history = loadHistoricalData(repoName, limit);
  
  if (!history.length) {
    printWarning(`No data found for ${repoName}. Run \`gdm collect\` first.`);
    return;
  }
  
  if (options.format === 'json') {
    console.log(JSON.stringify(history, null, 2));
    return;
  }
  
  printSection(`Metrics History: ${repoName}`);
  
  for (const entry of history) {
    const date = format(new Date(entry.collectedAt), 'yyyy-MM-dd HH:mm');
    console.log(chalk.cyan(`\n  ${date}`));
    if (entry.fileName) console.log(chalk.gray(`  File: ${entry.fileName}`));
    if (entry.period?.label) console.log(chalk.gray(`  Period: ${entry.period.label}`));
    console.log(chalk.gray('  ' + '─'.repeat(35)));
    
    const git = entry.gitMetrics;
    if (git?.summary) {
      const summary = git.summary as { totalCommits: number; totalLinesAdded: number; totalLinesDeleted: number };
      console.log(`    Commits: ${chalk.yellow(summary.totalCommits)}`);
      console.log(`    Lines: ${chalk.green(`+${summary.totalLinesAdded}`)} ${chalk.red(`-${summary.totalLinesDeleted}`)}`);
    }
    
    if (entry.jiraMetrics) {
      const jira = entry.jiraMetrics as { available?: boolean; issuesAnalyzed?: number; cycleTime?: { avgDays: number } };
      if (jira.available !== false) {
        console.log(chalk.gray('\n    Jira:'));
        console.log(`      Issues: ${jira.issuesAnalyzed || 0}`);
        if (jira.cycleTime) {
          console.log(`      Cycle Time: ${jira.cycleTime.avgDays} days avg`);
        }
      }
    }
  }
  
  console.log('');
}
