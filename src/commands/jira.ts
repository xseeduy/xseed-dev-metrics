// ============================================
// Jira CLI Command
// ============================================

import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { writeFileSync } from 'fs';
import { format, subMonths } from 'date-fns';
import { getJiraConfig } from '../config/integrations';
import { JiraClient } from '../integrations/jira/client';
import { calculateJiraMetrics } from '../integrations/jira/metrics';
import { JiraMetrics, JiraFilterOptions } from '../integrations/jira/types';

type OutputFormat = 'table' | 'json' | 'csv' | 'markdown';

interface JiraCommandOptions {
  project: string;
  since?: string;
  until?: string;
  format?: OutputFormat;
  output?: string;
}

// Formatters
function formatTable(metrics: JiraMetrics): string {
  let output = chalk.bold.cyan('\n📊 JIRA METRICS\n\n');

  const summaryTable = new Table({
    head: [chalk.cyan('Metric'), chalk.cyan('Value')],
    colWidths: [30, 25],
  });

  summaryTable.push(
    ['Issues Analyzed', metrics.issuesAnalyzed.toString()],
    ['Period', `${metrics.period.since || 'all'} → ${metrics.period.until}`],
  );
  output += summaryTable.toString();

  if (metrics.cycleTime) {
    output += chalk.bold.cyan('\n\n⏱️  CYCLE TIME (In Progress → Done)\n\n');
    const ct = new Table({ head: [chalk.cyan('Metric'), chalk.cyan('Days')], colWidths: [20, 12] });
    ct.push(
      ['Average', chalk.yellow(metrics.cycleTime.avgDays.toString())],
      ['Median', metrics.cycleTime.medianDays.toString()],
      ['P90', metrics.cycleTime.p90Days.toString()],
      ['Min/Max', `${metrics.cycleTime.minDays} / ${metrics.cycleTime.maxDays}`],
    );
    output += ct.toString();
    if (Object.keys(metrics.cycleTime.byIssueType).length) {
      output += chalk.gray('\n  By Type: ');
      output += Object.entries(metrics.cycleTime.byIssueType).map(([t, d]) => `${t}: ${d}d`).join(', ');
    }
  }

  if (metrics.leadTime) {
    output += chalk.bold.cyan('\n\n📅 LEAD TIME (Created → Done)\n\n');
    const lt = new Table({ head: [chalk.cyan('Metric'), chalk.cyan('Days')], colWidths: [20, 12] });
    lt.push(
      ['Average', chalk.yellow(metrics.leadTime.avgDays.toString())],
      ['Median', metrics.leadTime.medianDays.toString()],
      ['P90', metrics.leadTime.p90Days.toString()],
    );
    output += lt.toString();
  }

  output += chalk.bold.cyan('\n\n🔄 WORK IN PROGRESS\n\n');
  const wip = new Table({ head: [chalk.cyan('Metric'), chalk.cyan('Value')], colWidths: [25, 12] });
  wip.push(['Current WIP', chalk.yellow(metrics.wip.current.toString())]);
  output += wip.toString();
  if (Object.keys(metrics.wip.byAssignee).length) {
    output += chalk.gray('\n  By Assignee: ');
    const sorted = Object.entries(metrics.wip.byAssignee).sort((a, b) => b[1] - a[1]).slice(0, 5);
    output += sorted.map(([n, c]) => `${n}: ${c}`).join(', ');
  }

  if (metrics.blockedTime.totalBlockedIssues > 0) {
    output += chalk.bold.cyan('\n\n🚫 BLOCKED TIME\n\n');
    const bt = new Table({ head: [chalk.cyan('Metric'), chalk.cyan('Value')], colWidths: [25, 12] });
    bt.push(
      ['Issues Blocked', metrics.blockedTime.totalBlockedIssues.toString()],
      ['% Blocked', `${metrics.blockedTime.percentageBlocked}%`],
      ['Avg Days Blocked', metrics.blockedTime.avgDays.toString()],
    );
    output += bt.toString();
  }

  if (metrics.throughput) {
    output += chalk.bold.cyan('\n\n📈 THROUGHPUT\n\n');
    const tp = new Table({ head: [chalk.cyan('Metric'), chalk.cyan('Value')], colWidths: [25, 12] });
    tp.push(
      ['Total Completed', chalk.green(metrics.throughput.total.toString())],
      ['Per Week (avg)', metrics.throughput.perWeek.toString()],
    );
    output += tp.toString();
    if (Object.keys(metrics.throughput.byAssignee).length) {
      output += chalk.gray('\n  By Assignee: ');
      const sorted = Object.entries(metrics.throughput.byAssignee).sort((a, b) => b[1] - a[1]).slice(0, 5);
      output += sorted.map(([n, c]) => `${n}: ${c}`).join(', ');
    }
  }

  output += chalk.bold.cyan('\n\n🐛 BUG RATIO\n\n');
  const br = new Table({ head: [chalk.cyan('Metric'), chalk.cyan('Value')], colWidths: [25, 15] });
  const ratioColor = metrics.bugRatio.ratio > 0.3 ? chalk.red : metrics.bugRatio.ratio > 0.15 ? chalk.yellow : chalk.green;
  br.push(
    ['Total Bugs', metrics.bugRatio.totalBugs.toString()],
    ['Bug Ratio', ratioColor(`${Math.round(metrics.bugRatio.ratio * 100)}%`)],
    ['Avg Bug Resolution', `${metrics.bugRatio.bugResolutionTime.avgDays} days`],
  );
  output += br.toString();

  return output;
}

function formatJson(metrics: JiraMetrics): string {
  return JSON.stringify(metrics, null, 2);
}

function formatCsv(metrics: JiraMetrics): string {
  const lines = ['metric,value'];
  lines.push(`issues_analyzed,${metrics.issuesAnalyzed}`);
  lines.push(`period_since,${metrics.period.since}`);
  lines.push(`period_until,${metrics.period.until}`);
  if (metrics.cycleTime) {
    lines.push(`cycle_time_avg,${metrics.cycleTime.avgDays}`);
    lines.push(`cycle_time_median,${metrics.cycleTime.medianDays}`);
    lines.push(`cycle_time_p90,${metrics.cycleTime.p90Days}`);
  }
  if (metrics.leadTime) {
    lines.push(`lead_time_avg,${metrics.leadTime.avgDays}`);
    lines.push(`lead_time_median,${metrics.leadTime.medianDays}`);
  }
  lines.push(`wip_current,${metrics.wip.current}`);
  if (metrics.throughput) {
    lines.push(`throughput_total,${metrics.throughput.total}`);
    lines.push(`throughput_per_week,${metrics.throughput.perWeek}`);
  }
  lines.push(`bug_ratio,${metrics.bugRatio.ratio}`);
  lines.push(`bugs_total,${metrics.bugRatio.totalBugs}`);
  return lines.join('\n');
}

function formatMarkdown(metrics: JiraMetrics): string {
  let md = `# Jira Metrics Report\n\n`;
  md += `**Period:** ${metrics.period.since || 'all'} → ${metrics.period.until}  \n`;
  md += `**Issues Analyzed:** ${metrics.issuesAnalyzed}\n\n`;

  if (metrics.cycleTime) {
    md += `## ⏱️ Cycle Time\n\n| Metric | Days |\n|--------|------|\n`;
    md += `| Average | ${metrics.cycleTime.avgDays} |\n| Median | ${metrics.cycleTime.medianDays} |\n| P90 | ${metrics.cycleTime.p90Days} |\n\n`;
  }
  if (metrics.leadTime) {
    md += `## 📅 Lead Time\n\n| Metric | Days |\n|--------|------|\n`;
    md += `| Average | ${metrics.leadTime.avgDays} |\n| Median | ${metrics.leadTime.medianDays} |\n\n`;
  }
  if (metrics.throughput) {
    md += `## 📈 Throughput\n\n| Metric | Value |\n|--------|-------|\n`;
    md += `| Total | ${metrics.throughput.total} |\n| Per Week | ${metrics.throughput.perWeek} |\n\n`;
  }
  md += `## 🐛 Bug Ratio\n\n| Metric | Value |\n|--------|-------|\n`;
  md += `| Total Bugs | ${metrics.bugRatio.totalBugs} |\n| Ratio | ${Math.round(metrics.bugRatio.ratio * 100)}% |\n`;
  return md;
}

// Command handler
export async function jiraCommand(options: JiraCommandOptions): Promise<void> {
  const config = getJiraConfig();

  if (!config) {
    console.log(chalk.yellow('\n⚠️  Jira is not configured.\n'));
    console.log('Set environment variables:');
    console.log(chalk.gray('  export JIRA_URL=https://yourcompany.atlassian.net'));
    console.log(chalk.gray('  export JIRA_EMAIL=your@email.com'));
    console.log(chalk.gray('  export JIRA_TOKEN=your_api_token\n'));
    console.log('Or run: gdm config --init\n');
    return;
  }

  const spinner = ora('Connecting to Jira...').start();

  try {
    const client = new JiraClient(config);
    const test = await client.testConnection();
    
    if (!test.success) {
      spinner.fail(chalk.red(`Failed to connect: ${test.error}`));
      return;
    }

    spinner.text = `Connected as ${test.user}. Fetching project...`;

    const project = await client.getProject(options.project);
    spinner.text = `Fetching issues from ${project.name}...`;

    const filterOptions: JiraFilterOptions = {
      project: options.project,
      since: options.since || format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
      until: options.until || format(new Date(), 'yyyy-MM-dd'),
      excludeTypes: ['Epic'],
    };

    const issues = await client.getProjectIssues(filterOptions, {
      onProgress: (fetched: number, total: number) => {
        spinner.text = `Fetching issues... ${fetched}/${total}`;
      },
    });

    spinner.text = 'Calculating metrics...';

    const metrics = calculateJiraMetrics(issues, {
      since: filterOptions.since,
      until: filterOptions.until,
    });

    spinner.stop();

    const fmt = options.format || 'table';
    let output: string;
    switch (fmt) {
      case 'json': output = formatJson(metrics); break;
      case 'csv': output = formatCsv(metrics); break;
      case 'markdown': output = formatMarkdown(metrics); break;
      default: output = formatTable(metrics);
    }

    if (options.output) {
      writeFileSync(options.output, output);
      console.log(chalk.green(`✓ Output saved to ${options.output}`));
    } else {
      console.log(output);
    }

  } catch (error: unknown) {
    spinner.fail(chalk.red(`Error: ${(error as Error).message}`));
  }
}
