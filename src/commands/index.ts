// ============================================
// CLI Commands
// ============================================

import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync } from 'fs';
import { GitMetrics } from '../core/git-metrics';
import { FilterOptions, GroupBy } from '../types';
import {
  formatRepoSummary,
  formatAuthorStats,
  formatCommits,
  formatTimeStats,
  formatFileStats,
  formatPeriodStats,
  formatBlameStats,
} from '../output/formatters';

type OutputFormat = 'table' | 'json' | 'csv' | 'markdown';

interface CommonOptions {
  since?: string;
  until?: string;
  author?: string;
  branch?: string;
  merges?: boolean;
  format?: OutputFormat;
  output?: string;
}

function getMetrics(path: string): GitMetrics {
  return new GitMetrics(path);
}

function buildFilterOptions(options: CommonOptions): FilterOptions {
  return {
    since: options.since,
    until: options.until,
    author: options.author,
    branch: options.branch,
    includeMerges: options.merges ?? false,
  };
}

function outputResult(result: string, outputPath?: string): void {
  if (outputPath) {
    writeFileSync(outputPath, result);
    console.log(chalk.green(`✓ Output saved to ${outputPath}`));
  } else {
    console.log(result);
  }
}

// ==========================================
// Summary Command
// ==========================================

export async function summaryCommand(
  path: string,
  options: CommonOptions
): Promise<void> {
  const spinner = ora('Analyzing repository...').start();

  try {
    const metrics = getMetrics(path);
    const filterOptions = buildFilterOptions(options);
    const summary = metrics.getRepoSummary(filterOptions);
    
    spinner.stop();
    
    console.log(chalk.bold.cyan('\n📊 REPOSITORY SUMMARY\n'));
    const output = formatRepoSummary(summary, options.format || 'table');
    outputResult(output, options.output);
  } catch (error: any) {
    spinner.fail(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// ==========================================
// Authors Command
// ==========================================

export async function authorsCommand(
  path: string,
  options: CommonOptions & { limit?: number }
): Promise<void> {
  const spinner = ora('Calculating author statistics...').start();

  try {
    const metrics = getMetrics(path);
    const filterOptions = buildFilterOptions(options);
    let stats = metrics.getAuthorStats(filterOptions);
    
    if (options.limit) {
      stats = stats.slice(0, options.limit);
    }
    
    spinner.stop();
    
    console.log(chalk.bold.cyan('\n👥 AUTHOR STATISTICS\n'));
    const output = formatAuthorStats(stats, options.format || 'table');
    outputResult(output, options.output);
  } catch (error: any) {
    spinner.fail(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// ==========================================
// Commits Command
// ==========================================

export async function commitsCommand(
  path: string,
  options: CommonOptions & { limit?: number }
): Promise<void> {
  const spinner = ora('Fetching commits...').start();

  try {
    const metrics = getMetrics(path);
    const filterOptions = buildFilterOptions(options);
    const commits = metrics.getCommits(filterOptions, options.limit || 50);
    
    spinner.stop();
    
    console.log(chalk.bold.cyan('\n📝 RECENT COMMITS\n'));
    const output = formatCommits(commits, options.format || 'table');
    outputResult(output, options.output);
  } catch (error: any) {
    spinner.fail(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// ==========================================
// Activity Command (Time Stats)
// ==========================================

export async function activityCommand(
  path: string,
  options: CommonOptions
): Promise<void> {
  const spinner = ora('Analyzing activity patterns...').start();

  try {
    const metrics = getMetrics(path);
    const filterOptions = buildFilterOptions(options);
    const stats = metrics.getTimeStats(filterOptions);
    
    spinner.stop();
    
    console.log(chalk.bold.cyan('\n⏰ ACTIVITY PATTERNS\n'));
    const output = formatTimeStats(stats, options.format || 'table');
    outputResult(output, options.output);
  } catch (error: any) {
    spinner.fail(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// ==========================================
// Files Command
// ==========================================

export async function filesCommand(
  path: string,
  options: CommonOptions & { limit?: number }
): Promise<void> {
  const spinner = ora('Analyzing file changes...').start();

  try {
    const metrics = getMetrics(path);
    const filterOptions = buildFilterOptions(options);
    const stats = metrics.getFileStats(filterOptions, options.limit || 20);
    
    spinner.stop();
    
    console.log(chalk.bold.cyan('\n📁 MOST CHANGED FILES\n'));
    const output = formatFileStats(stats, options.format || 'table');
    outputResult(output, options.output);
  } catch (error: any) {
    spinner.fail(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// ==========================================
// Trends Command (Period Stats)
// ==========================================

export async function trendsCommand(
  path: string,
  options: CommonOptions & { groupBy?: GroupBy }
): Promise<void> {
  const spinner = ora('Calculating trends...').start();

  try {
    const metrics = getMetrics(path);
    const filterOptions = buildFilterOptions(options);
    const stats = metrics.getStatsByPeriod(filterOptions, options.groupBy || 'month');
    
    spinner.stop();
    
    console.log(chalk.bold.cyan(`\n📈 ACTIVITY BY ${(options.groupBy || 'month').toUpperCase()}\n`));
    const output = formatPeriodStats(stats, options.format || 'table');
    outputResult(output, options.output);
  } catch (error: any) {
    spinner.fail(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// ==========================================
// Blame Command (Code Ownership)
// ==========================================

export async function blameCommand(
  path: string,
  options: CommonOptions & { file?: string }
): Promise<void> {
  const spinner = ora('Analyzing code ownership (this may take a while)...').start();

  try {
    const metrics = getMetrics(path);
    const stats = metrics.getBlameStats(options.file);
    
    spinner.stop();
    
    console.log(chalk.bold.cyan('\n🔍 CODE OWNERSHIP\n'));
    const output = formatBlameStats(stats, options.format || 'table');
    outputResult(output, options.output);
  } catch (error: any) {
    spinner.fail(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// ==========================================
// Report Command (Full Report)
// ==========================================

export async function reportCommand(
  path: string,
  options: CommonOptions & { jira?: string; linear?: string }
): Promise<void> {
  const spinner = ora('Generating full report...').start();

  try {
    const metrics = getMetrics(path);
    const filterOptions = buildFilterOptions(options);
    const format = options.format || 'table';
    
    // Get Jira metrics if requested
    let jiraMetrics: any = null;
    if (options.jira) {
      spinner.text = 'Fetching Jira metrics...';
      jiraMetrics = await getJiraMetricsForReport(options.jira, filterOptions.since, filterOptions.until);
    }
    
    let output = '';
    const isMarkdown = format === 'markdown';
    const isJson = format === 'json';

    if (isJson) {
      // JSON: single object with all data
      const report: any = {
        repository: path,
        period: { since: filterOptions.since || 'all time', until: filterOptions.until || 'now' },
        git_metrics: {
          summary: metrics.getRepoSummary(filterOptions),
          authors: metrics.getAuthorStats(filterOptions),
          activity: metrics.getTimeStats(filterOptions),
          files: metrics.getFileStats(filterOptions, 20),
          trends: metrics.getStatsByPeriod(filterOptions, 'month'),
        },
        jira_metrics: jiraMetrics || { available: false, reason: 'Not requested or not configured' },
        linear_metrics: { available: false, reason: 'Not implemented yet' },
      };
      output = JSON.stringify(report, null, 2);
    } else {
      // Table or Markdown
      const summary = metrics.getRepoSummary(filterOptions);
      const authors = metrics.getAuthorStats(filterOptions);
      const activity = metrics.getTimeStats(filterOptions);
      const files = metrics.getFileStats(filterOptions, 20);
      const trends = metrics.getStatsByPeriod(filterOptions, 'month');

      if (isMarkdown) {
        output = `# Git Repository Report\n\n`;
        output += `Generated: ${new Date().toISOString()}\n\n`;
      } else {
        output = chalk.bold.magenta('\n' + '═'.repeat(60) + '\n');
        output += chalk.bold.magenta('           DEVELOPER METRICS REPORT\n');
        output += chalk.bold.magenta('═'.repeat(60) + '\n');
      }

      output += '\n' + (isMarkdown ? '## 📊 Git Summary\n\n' : chalk.bold.cyan('📊 GIT SUMMARY\n\n'));
      output += formatRepoSummary(summary, format);

      output += '\n\n' + (isMarkdown ? '## 👥 Top Authors\n\n' : chalk.bold.cyan('👥 TOP AUTHORS\n\n'));
      output += formatAuthorStats(authors.slice(0, 10), format);

      output += '\n\n' + (isMarkdown ? '## 📈 Monthly Trends\n\n' : chalk.bold.cyan('📈 MONTHLY TRENDS\n\n'));
      output += formatPeriodStats(trends.slice(-12), format);

      output += '\n\n' + (isMarkdown ? '## 📁 Hot Files\n\n' : chalk.bold.cyan('📁 HOT FILES\n\n'));
      output += formatFileStats(files.slice(0, 10), format);

      // Add Jira section if available
      if (jiraMetrics && jiraMetrics.available) {
        output += '\n\n' + (isMarkdown ? '## 🎫 Jira Metrics\n\n' : chalk.bold.cyan('🎫 JIRA METRICS\n\n'));
        output += formatJiraMetricsSection(jiraMetrics, format, isMarkdown);
      } else if (options.jira) {
        const reason = jiraMetrics?.reason || 'Jira not configured';
        output += '\n\n' + (isMarkdown ? `## 🎫 Jira Metrics\n\n_${reason}_\n` : chalk.yellow(`\n⚠️  Jira: ${reason}\n`));
      }

      if (!isMarkdown) {
        output += '\n' + chalk.bold.magenta('═'.repeat(60) + '\n');
      }
    }

    spinner.stop();
    outputResult(output, options.output);
  } catch (error: any) {
    spinner.fail(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// Helper to get Jira metrics for report
async function getJiraMetricsForReport(projectKey: string, since?: string, until?: string): Promise<any> {
  try {
    const { getJiraConfig } = await import('../config/integrations');
    const { JiraClient } = await import('../integrations/jira/client');
    const { calculateJiraMetrics } = await import('../integrations/jira/metrics');
    const { format, subMonths } = await import('date-fns');
    
    const config = getJiraConfig();
    if (!config) {
      return { available: false, reason: 'Jira not configured (set JIRA_URL, JIRA_EMAIL, JIRA_TOKEN)' };
    }
    
    const client = new JiraClient(config);
    const test = await client.testConnection();
    if (!test.success) {
      return { available: false, reason: `Connection failed: ${test.error}` };
    }
    
    const issues = await client.getProjectIssues({
      project: projectKey,
      since: since || format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
      until: until || format(new Date(), 'yyyy-MM-dd'),
      excludeTypes: ['Epic'],
    });
    
    return calculateJiraMetrics(issues, { since, until });
  } catch (error: any) {
    return { available: false, reason: error.message };
  }
}

// Format Jira metrics for table/markdown
function formatJiraMetricsSection(metrics: any, format: string, isMarkdown: boolean): string {
  if (format === 'json') return JSON.stringify(metrics, null, 2);
  
  let output = '';
  
  if (isMarkdown) {
    output += `| Metric | Value |\n|--------|-------|\n`;
    output += `| Issues Analyzed | ${metrics.issuesAnalyzed} |\n`;
    if (metrics.cycleTime) {
      output += `| Cycle Time (avg) | ${metrics.cycleTime.avgDays} days |\n`;
      output += `| Cycle Time (p90) | ${metrics.cycleTime.p90Days} days |\n`;
    }
    if (metrics.leadTime) {
      output += `| Lead Time (avg) | ${metrics.leadTime.avgDays} days |\n`;
    }
    output += `| WIP (current) | ${metrics.wip.current} |\n`;
    if (metrics.throughput) {
      output += `| Throughput (total) | ${metrics.throughput.total} |\n`;
      output += `| Throughput (per week) | ${metrics.throughput.perWeek} |\n`;
    }
    output += `| Bug Ratio | ${Math.round(metrics.bugRatio.ratio * 100)}% |\n`;
  } else {
    const Table = require('cli-table3');
    const table = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      colWidths: [25, 20],
    });
    
    table.push(['Issues Analyzed', metrics.issuesAnalyzed.toString()]);
    if (metrics.cycleTime) {
      table.push(['Cycle Time (avg)', chalk.yellow(`${metrics.cycleTime.avgDays} days`)]);
      table.push(['Cycle Time (p90)', `${metrics.cycleTime.p90Days} days`]);
    }
    if (metrics.leadTime) {
      table.push(['Lead Time (avg)', `${metrics.leadTime.avgDays} days`]);
    }
    table.push(['WIP (current)', metrics.wip.current.toString()]);
    if (metrics.throughput) {
      table.push(['Throughput (total)', chalk.green(metrics.throughput.total.toString())]);
      table.push(['Throughput/week', metrics.throughput.perWeek.toString()]);
    }
    const ratioColor = metrics.bugRatio.ratio > 0.3 ? chalk.red : metrics.bugRatio.ratio > 0.15 ? chalk.yellow : chalk.green;
    table.push(['Bug Ratio', ratioColor(`${Math.round(metrics.bugRatio.ratio * 100)}%`)]);
    
    output = table.toString();
  }
  
  return output;
}

// ==========================================
// File Types Command
// ==========================================

export async function fileTypesCommand(
  path: string,
  options: CommonOptions
): Promise<void> {
  const spinner = ora('Analyzing file types...').start();

  try {
    const metrics = getMetrics(path);
    const filterOptions = buildFilterOptions(options);
    const stats = metrics.getFileTypeStats(filterOptions);
    const format = options.format || 'table';

    spinner.stop();
    
    console.log(chalk.bold.cyan('\n📊 FILE TYPE STATISTICS\n'));

    if (format === 'json') {
      outputResult(JSON.stringify(stats, null, 2), options.output);
    } else if (format === 'csv') {
      const lines = ['extension,files,lines'];
      for (const [ext, data] of Object.entries(stats)) {
        lines.push(`${ext},${data.files},${data.lines}`);
      }
      outputResult(lines.join('\n'), options.output);
    } else {
      const Table = require('cli-table3');
      const table = new Table({
        head: [chalk.cyan('Extension'), chalk.cyan('Files'), chalk.cyan('Lines Changed')],
        colWidths: [15, 12, 15],
      });

      const sorted = Object.entries(stats)
        .sort((a, b) => b[1].files - a[1].files)
        .slice(0, 20);

      for (const [ext, data] of sorted) {
        table.push([ext, data.files.toLocaleString(), data.lines.toLocaleString()]);
      }
      
      outputResult(table.toString(), options.output);
    }
  } catch (error: any) {
    spinner.fail(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}
