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
  getActiveClient,
  getClientConfig,
  switchClient,
  addRepository,
  findRepositoryOwners,
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
    // Use --use-mailmap to respect .mailmap file for consolidating author identities
    const email = execSync(`git log --use-mailmap -1 --format=%ae --author="${escaped}"`, {
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
    // Use --use-mailmap to respect .mailmap file for consolidating author identities
    const raw = execSync(`git log --use-mailmap --format='%aN' ${logArgs}`, {
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

/** Get all authors with their emails and names for flexible matching. */
function getAuthorsWithDetails(
  repoPath: string,
  filterOptions: { since?: string; until?: string }
): Array<{ name: string; email: string }> {
  try {
    const args: string[] = [];
    if (filterOptions.since) args.push(`--since="${filterOptions.since}"`);
    if (filterOptions.until) args.push(`--until="${filterOptions.until}"`);
    const logArgs = args.join(' ');
    // Get both name and email using format: "Name|Email"
    const raw = execSync(`git log --use-mailmap --format='%aN|%ae' ${logArgs}`, {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    
    if (!raw) return [];
    
    const lines = raw.split('\n').filter(Boolean);
    const authorsMap = new Map<string, { name: string; email: string }>();
    
    for (const line of lines) {
      const [name, email] = line.split('|');
      if (name && email) {
        // Use email as key to avoid duplicates
        authorsMap.set(email, { name, email });
      }
    }
    
    return Array.from(authorsMap.values());
  } catch {
    return [];
  }
}

/**
 * Find an author by flexible matching (name, email, or username).
 * Returns the canonical author name if found, or null if not found.
 */
function findAuthorByFlexibleMatch(
  searchTerm: string,
  authors: Array<{ name: string; email: string }>
): string | null {
  const lowerSearch = searchTerm.toLowerCase().trim();
  
  for (const author of authors) {
    // Match full name (case-insensitive)
    if (author.name.toLowerCase() === lowerSearch) {
      return author.name;
    }
    
    // Match email (case-insensitive)
    if (author.email.toLowerCase() === lowerSearch) {
      return author.name;
    }
    
    // Match username part of email (before @)
    const emailUsername = author.email.split('@')[0].toLowerCase();
    if (emailUsername === lowerSearch) {
      return author.name;
    }
    
    // Match first part of name (useful for "Adrian" matching "Adrian Halaburda")
    const firstName = author.name.split(' ')[0].toLowerCase();
    if (firstName === lowerSearch) {
      return author.name;
    }
  }
  
  return null;
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

  // Discover all active branches (main + unmerged branches)
  const mainBranch = gitConfig.mainBranch;
  const unmergedBranches = metrics.getUnmergedBranches(mainBranch);
  const allBranches = [mainBranch, ...unmergedBranches];
  
  // Add branches to filter options for multi-branch collection
  const multiBranchOptions = { ...filterOptions, branches: allBranches };

  // Get general summary (repo-wide, no author filter) - from all branches
  const summary = metrics.getRepoSummary(multiBranchOptions);
  // Get user-specific stats (filter by email for accuracy) - from all branches
  // getAuthorStats returns an array, so we take the first element (should only be one when filtering by email)
  const userStatsArray = metrics.getAuthorStats({ ...multiBranchOptions, email: userEmail });
  const userStats = userStatsArray.length > 0 ? userStatsArray[0] : null;
  // Get activity patterns (filter by email for accuracy) - from all branches
  const activity = metrics.getTimeStats({ ...multiBranchOptions, email: userEmail });
  // Get weekly trends (filter by email for accuracy) - from all branches
  const trends = metrics.getStatsByPeriod({ ...multiBranchOptions, email: userEmail }, 'week');

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

function convertToCSV(data: CollectedData): string {
  const lines: string[] = [];
  
  // Header row
  lines.push('metric_type,metric_name,value,unit,details');
  
  // Metadata
  lines.push(`metadata,collected_at,${data.collectedAt},timestamp,`);
  lines.push(`metadata,repository,${data.repoName},text,`);
  lines.push(`metadata,user_name,${data.user.username},text,`);
  lines.push(`metadata,user_email,${data.user.email},email,`);
  lines.push(`metadata,period,${data.period?.label || 'N/A'},text,`);
  
  // Git Metrics - Summary
  const summary = data.gitMetrics.summary as any;
  if (summary) {
    lines.push(`git_summary,total_commits,${summary.totalCommits || 0},count,`);
    lines.push(`git_summary,total_authors,${summary.totalAuthors || 0},count,`);
    lines.push(`git_summary,lines_added,${summary.totalLinesAdded || 0},count,`);
    lines.push(`git_summary,lines_deleted,${summary.totalLinesDeleted || 0},count,`);
    lines.push(`git_summary,net_lines,${(summary.totalLinesAdded || 0) - (summary.totalLinesDeleted || 0)},count,`);
    lines.push(`git_summary,files_changed,${summary.totalFilesChanged || 0},count,`);
    lines.push(`git_summary,active_branches,${summary.activeBranches || 0},count,`);
    lines.push(`git_summary,current_branch,${summary.currentBranch || 'N/A'},text,`);
    
    // Branch metadata (for multi-branch collection)
    if (summary.branchesAnalyzed && Array.isArray(summary.branchesAnalyzed)) {
      lines.push(`git_summary,branches_analyzed,${summary.branchesAnalyzed.length},count,`);
      lines.push(`git_summary,branch_list,"${summary.branchesAnalyzed.join(', ')}",text,`);
    }
    
    if (summary.firstCommitDate) {
      lines.push(`git_summary,first_commit,${summary.firstCommitDate},date,`);
    }
    if (summary.lastCommitDate) {
      lines.push(`git_summary,last_commit,${summary.lastCommitDate},date,`);
    }
  }
  
  // Git Metrics - User Stats
  const userStats = data.gitMetrics.userStats as any;
  if (userStats) {
    lines.push(`git_user,commits,${userStats.commits || 0},count,`);
    lines.push(`git_user,lines_added,${userStats.linesAdded || 0},count,`);
    lines.push(`git_user,lines_deleted,${userStats.linesDeleted || 0},count,`);
    lines.push(`git_user,lines_net,${userStats.linesNet || 0},count,`);
    lines.push(`git_user,files_changed,${userStats.filesChanged || 0},count,`);
    lines.push(`git_user,active_days,${userStats.activeDays || 0},count,`);
    lines.push(`git_user,avg_commits_per_day,${userStats.avgCommitsPerDay || 0},rate,`);
    if (userStats.firstCommit) {
      lines.push(`git_user,first_commit,${userStats.firstCommit},date,`);
    }
    if (userStats.lastCommit) {
      lines.push(`git_user,last_commit,${userStats.lastCommit},date,`);
    }
  }
  
  // Git Metrics - Activity by Day of Week
  const activity = data.gitMetrics.activity as any;
  if (activity?.byDayOfWeek) {
    for (const [day, count] of Object.entries(activity.byDayOfWeek)) {
      lines.push(`git_activity_day,${day},${count},count,`);
    }
  }
  
  // Git Metrics - Activity by Hour
  if (activity?.byHour) {
    for (const [hour, count] of Object.entries(activity.byHour)) {
      lines.push(`git_activity_hour,hour_${hour},${count},count,`);
    }
  }
  
  // Git Metrics - Weekly Trends
  const trends = data.gitMetrics.trends as any;
  if (Array.isArray(trends)) {
    trends.forEach((trend: any) => {
      lines.push(`git_trend,${trend.period},${trend.commits || 0},commits,"lines_added:${trend.linesAdded || 0}|lines_deleted:${trend.linesDeleted || 0}|authors:${trend.authors || 0}"`);
    });
  }
  
  // Jira Metrics
  if (data.jiraMetrics && typeof data.jiraMetrics === 'object') {
    const jira = data.jiraMetrics as any;
    if (jira.available !== false) {
      lines.push(`jira,issues_analyzed,${jira.issuesAnalyzed || 0},count,`);
      lines.push(`jira,issues_created,${jira.created || 0},count,`);
      lines.push(`jira,issues_in_progress,${jira.inProgress || 0},count,`);
      lines.push(`jira,issues_completed,${jira.completed || 0},count,`);
      
      if (jira.cycleTime) {
        lines.push(`jira,cycle_time_avg_days,${jira.cycleTime.avgDays || 0},days,`);
        lines.push(`jira,cycle_time_median_days,${jira.cycleTime.medianDays || 0},days,`);
      }
      
      if (jira.leadTime) {
        lines.push(`jira,lead_time_avg_days,${jira.leadTime.avgDays || 0},days,`);
        lines.push(`jira,lead_time_median_days,${jira.leadTime.medianDays || 0},days,`);
      }
      
      if (jira.velocity) {
        lines.push(`jira,velocity_story_points,${jira.velocity.storyPoints || 0},points,`);
        lines.push(`jira,velocity_issues_per_week,${jira.velocity.issuesPerWeek || 0},rate,`);
      }
    }
  }
  
  return lines.join('\n');
}

function saveCollectedData(
  repoName: string, 
  data: CollectedData, 
  authorSlug?: string, 
  clientName?: string, 
  outputFormat: 'json' | 'csv' = 'csv'
): string {
  const dataDir = getDataDir(clientName);
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const extension = outputFormat === 'json' ? 'json' : 'csv';
  const filename = authorSlug
    ? `${repoName}_${authorSlug}_${dateStr}.${extension}`
    : `${repoName}_${dateStr}.${extension}`;
  const filepath = join(dataDir, filename);

  data.fileName = filename;
  
  if (outputFormat === 'json') {
    writeFileSync(filepath, JSON.stringify(data, null, 2));
  } else {
    writeFileSync(filepath, convertToCSV(data));
  }
  
  return filepath;
}

// ==========================================
// Load Historical Data
// ==========================================

export function loadHistoricalData(repoName: string, limit: number = 10, clientName?: string): CollectedData[] {
  const dataDir = getDataDir(clientName);
  const files: CollectedData[] = [];
  
  try {
    const entries = readdirSync(dataDir);
    
    for (const entry of entries) {
      // Support both JSON and CSV files
      if (entry.startsWith(repoName) && (entry.endsWith('.json') || entry.endsWith('.csv'))) {
        try {
          if (entry.endsWith('.json')) {
            // Load JSON files directly
            const content = readFileSync(join(dataDir, entry), 'utf-8');
            files.push(JSON.parse(content));
          } else if (entry.endsWith('.csv')) {
            // Parse CSV files back to CollectedData format
            const content = readFileSync(join(dataDir, entry), 'utf-8');
            const parsed = parseCSVToCollectedData(content);
            if (parsed) files.push(parsed);
          }
        } catch (error: unknown) {
          // Failed to parse file, skip it
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

/**
 * Parse CSV content back to CollectedData format for display
 */
function parseCSVToCollectedData(csvContent: string): CollectedData | null {
  try {
    const lines = csvContent.split('\n');
    const data: any = {
      collectedAt: '',
      repository: '',
      repoName: '',
      user: { username: '', email: '' },
      gitMetrics: {
        summary: {},
        userStats: {},
        activity: { byDayOfWeek: {}, byHour: {}, byMonth: {} },
        trends: []
      }
    };
    
    // Parse CSV line by line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',');
      if (parts.length < 3) continue;
      
      const [metricType, metricName, value] = parts;
      
      // Metadata
      if (metricType === 'metadata') {
        if (metricName === 'collected_at') data.collectedAt = value;
        else if (metricName === 'repository') data.repoName = value;
        else if (metricName === 'user_name') data.user.username = value;
        else if (metricName === 'user_email') data.user.email = value;
        else if (metricName === 'period') {
          data.period = { since: null, until: null, label: value };
        }
      }
      // Git Summary
      else if (metricType === 'git_summary') {
        if (metricName === 'total_commits') data.gitMetrics.summary.totalCommits = parseInt(value) || 0;
        else if (metricName === 'lines_added') data.gitMetrics.summary.totalLinesAdded = parseInt(value) || 0;
        else if (metricName === 'lines_deleted') data.gitMetrics.summary.totalLinesDeleted = parseInt(value) || 0;
      }
      // Git User
      else if (metricType === 'git_user') {
        if (metricName === 'commits') data.gitMetrics.userStats.commits = parseInt(value) || 0;
        else if (metricName === 'lines_added') data.gitMetrics.userStats.linesAdded = parseInt(value) || 0;
        else if (metricName === 'lines_deleted') data.gitMetrics.userStats.linesDeleted = parseInt(value) || 0;
      }
    }
    
    return data as CollectedData;
  } catch (error) {
    return null;
  }
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
  client?: string;
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
  format?: 'json' | 'csv';
}): Promise<void> {
  // Detect common mistake: using -authors instead of --usernames
  const args = process.argv.slice(2);
  const authorsFlag = args.find(arg => arg.startsWith('-authors') || arg.startsWith('--authors'));
  if (authorsFlag) {
    printError(`Invalid parameter: '${authorsFlag}'`);
    console.log(chalk.yellow(`  Did you mean: ${chalk.cyan('--usernames')}?\n`));
    console.log(chalk.gray('  Examples:'));
    console.log(chalk.gray(`    gdm collect --usernames=user1,user2`));
    console.log(chalk.gray(`    gdm collect --usernames=ALL\n`));
    return;
  }

  if (!isInitialized()) {
    printError('Not configured. Run `gdm init` first.');
    return;
  }

  // Determine which client to use
  let clientName = options.client || getActiveClient();
  
  if (!clientName) {
    printError('No active client. Run `gdm init` to create a client or use --client <name>.');
    return;
  }

  // If client specified explicitly, switch to it temporarily
  const originalClient = getActiveClient();
  if (options.client && options.client !== originalClient) {
    try {
      switchClient(options.client);
      clientName = options.client;
    } catch (error) {
      printError(`Client '${options.client}' not found. Run 'gdm client' to see available clients.`);
      return;
    }
  }

  const config = getConfig();
  
  if (!config) {
    printError(`Configuration for client '${clientName}' not found.`);
    return;
  }
  
  const gitConfig = config.git;

  if (!gitConfig) {
    printError(`Git configuration missing for client '${clientName}'. Run 'gdm init' to configure.`);
    return;
  }

  const usernamesOption = parseUsernamesOption(options.usernames);

  if (!options.quiet) {
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
      
      // Check if this repo is configured for any client
      const owners = findRepositoryOwners(cwd);
      
      if (owners.length === 0) {
        // Repository not configured - ask to add it
        if (!options.quiet) {
          console.log(chalk.yellow(`\n  Repository not configured: ${cwd}\n`));
          
          const readline = await import('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          
          const answer = await new Promise<string>((resolve) => {
            rl.question(chalk.cyan('  ? ') + `Add to client '${clientName}'? ` + chalk.gray('[Y/n]') + ': ', (ans) => {
              rl.close();
              resolve(ans.trim());
            });
          });
          
          if (!answer || answer.toLowerCase().startsWith('y')) {
            addRepository(cwd);
            console.log(chalk.green(`  ✓ Repository added to '${clientName}'\n`));
          } else {
            printError('Repository not configured. Use --repo to specify a different path.');
            return;
          }
        }
      } else if (!owners.includes(clientName)) {
        // Repository belongs to different client(s)
        printWarning(`Repository belongs to: ${owners.join(', ')}`);
        printError(`Use --client ${owners[0]} or add it to '${clientName}' first.`);
        return;
      }
      
      repos = [cwd];
    } catch {
      printError('Not a git repository. Run `gdm init` or specify with --repo');
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

  const results: Array<{ 
    repo: string; 
    success: boolean; 
    files?: string[]; 
    uploadData?: Array<{ path: string; data: CollectedData }>; 
    error?: string 
  }> = [];

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
      // Validate that requested users exist in the repository (check entire history, not just the filtered period)
      const authorsWithDetails = getAuthorsWithDetails(repoPath, {});
      const allAuthorsNames = authorsWithDetails.map(a => a.name);
      usersToCollect = [];
      const missingUsers: string[] = [];
      
      for (const requestedUser of usernamesOption.names) {
        // Try flexible matching: by name, email, or username
        const matchedAuthor = findAuthorByFlexibleMatch(requestedUser, authorsWithDetails);
        
        if (matchedAuthor) {
          usersToCollect.push(matchedAuthor);
        } else {
          missingUsers.push(requestedUser);
        }
      }
      
      // Report missing users
      if (missingUsers.length > 0 && !options.quiet) {
        for (const user of missingUsers) {
          // Show available authors with their emails for better debugging
          const availableList = authorsWithDetails
            .map(a => `${a.name} (${a.email})`)
            .join(', ');
          printError(`User '${user}' not found in ${repoName}`);
          console.log(chalk.gray(`  Available authors: ${availableList}`));
        }
      }
      
      // If no valid users remain, skip this repo
      if (usersToCollect.length === 0) {
        continue;
      }
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
      const collectedDataForUpload: Array<{ path: string; data: CollectedData }> = [];

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
        const outputFormat = options.format || 'csv';
        const filepath = saveCollectedData(repoName, data, authorSlug, clientName, outputFormat);
        filesSaved.push(filepath);
        
        // Store data for potential Notion upload (always needs JSON format)
        collectedDataForUpload.push({ path: filepath, data });
      }

      results.push({ 
        repo: repoName, 
        success: true, 
        files: filesSaved,
        uploadData: collectedDataForUpload 
      });

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

    console.log(chalk.gray(`\n  Data directory: ${getDataDir(clientName)}\n`));
  }

  // Restore original client if we switched
  if (options.client && originalClient && options.client !== originalClient) {
    try {
      switchClient(originalClient);
    } catch {
      // Ignore errors when restoring
    }
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

    // Prepare files with data (use in-memory data since files might be CSV)
    const filesToUpload: Array<{ path: string; data: CollectedData }> = [];
    for (const result of successful) {
      if (result.uploadData) {
        filesToUpload.push(...result.uploadData);
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
  client?: string;
  last?: number;
  format?: 'table' | 'json';
}): Promise<void> {
  if (!isInitialized()) {
    printError('Not configured. Run `gdm init` first.');
    return;
  }
  
  const clientName = options.client || getActiveClient();
  if (!clientName) {
    printError('No active client. Use --client <name> or run `gdm init`.');
    return;
  }
  
  const config = options.client ? getClientConfig(options.client) : getConfig();
  if (!config) {
    printError(`Client '${clientName}' not found.`);
    return;
  }
  
  let repoName: string;
  
  if (options.repo) {
    repoName = getRepoName(options.repo);
  } else if (config.repositories?.length) {
    repoName = getRepoName(config.repositories[0]);
  } else {
    repoName = getRepoName(process.cwd());
  }
  
  const limit = options.last || 5;
  const history = loadHistoricalData(repoName, limit, clientName);
  
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
