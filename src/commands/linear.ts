// ============================================
// Linear CLI Command
// ============================================

import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { writeFileSync } from 'fs';
import { format, subMonths } from 'date-fns';
import { getLinearConfig } from '../config/integrations';
import { LinearClient } from '../integrations/linear/client';
import { calculateLinearMetrics } from '../integrations/linear/metrics';
import { LinearMetrics } from '../integrations/linear/types';

type OutputFormat = 'table' | 'json' | 'csv' | 'markdown';

interface LinearCommandOptions {
  team: string;
  since?: string;
  until?: string;
  format?: OutputFormat;
  output?: string;
}

// Formatters
function formatTable(metrics: LinearMetrics): string {
  let output = chalk.bold.cyan('\n📊 LINEAR METRICS\n\n');

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
    output += chalk.bold.cyan('\n\n⏱️  CYCLE TIME (Started → Completed)\n\n');
    const ct = new Table({ head: [chalk.cyan('Metric'), chalk.cyan('Days')], colWidths: [20, 12] });
    ct.push(
      ['Average', chalk.yellow(metrics.cycleTime.avgDays.toString())],
      ['Median', metrics.cycleTime.medianDays.toString()],
      ['P90', metrics.cycleTime.p90Days.toString()],
      ['Min/Max', `${metrics.cycleTime.minDays} / ${metrics.cycleTime.maxDays}`],
    );
    output += ct.toString();
  }

  if (metrics.leadTime) {
    output += chalk.bold.cyan('\n\n📅 LEAD TIME (Created → Completed)\n\n');
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

  if (metrics.throughput) {
    output += chalk.bold.cyan('\n\n📈 THROUGHPUT\n\n');
    const tp = new Table({ head: [chalk.cyan('Metric'), chalk.cyan('Value')], colWidths: [25, 12] });
    tp.push(
      ['Total Completed', chalk.green(metrics.throughput.total.toString())],
      ['Per Week (avg)', metrics.throughput.perWeek.toString()],
    );
    if (metrics.throughput.perCycle !== null) {
      tp.push(['Per Cycle (avg)', metrics.throughput.perCycle.toString()]);
    }
    output += tp.toString();
  }

  if (metrics.cycleCompletion) {
    output += chalk.bold.cyan('\n\n🎯 CYCLE COMPLETION\n\n');
    const cc = new Table({ head: [chalk.cyan('Metric'), chalk.cyan('Value')], colWidths: [25, 12] });
    const rateColor = metrics.cycleCompletion.avgRate >= 80 ? chalk.green : 
                      metrics.cycleCompletion.avgRate >= 60 ? chalk.yellow : chalk.red;
    cc.push(['Avg Completion Rate', rateColor(`${metrics.cycleCompletion.avgRate}%`)]);
    output += cc.toString();
  }

  if (metrics.estimateAccuracy) {
    output += chalk.bold.cyan('\n\n📐 ESTIMATES\n\n');
    const ea = new Table({ head: [chalk.cyan('Metric'), chalk.cyan('Value')], colWidths: [25, 12] });
    ea.push(
      ['Issues w/ Estimates', metrics.estimateAccuracy.issuesWithEstimates.toString()],
      ['Avg Estimate', metrics.estimateAccuracy.avgEstimate.toString()],
      ['Total Points Est.', metrics.estimateAccuracy.totalEstimated.toString()],
      ['Total Completed', metrics.estimateAccuracy.totalCompleted.toString()],
    );
    output += ea.toString();
  }

  return output;
}

function formatJson(metrics: LinearMetrics): string {
  return JSON.stringify(metrics, null, 2);
}

function formatCsv(metrics: LinearMetrics): string {
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
  if (metrics.cycleCompletion) {
    lines.push(`cycle_completion_rate,${metrics.cycleCompletion.avgRate}`);
  }
  return lines.join('\n');
}

function formatMarkdown(metrics: LinearMetrics): string {
  let md = `# Linear Metrics Report\n\n`;
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
  if (metrics.cycleCompletion) {
    md += `## 🎯 Cycle Completion\n\n| Metric | Value |\n|--------|-------|\n`;
    md += `| Avg Rate | ${metrics.cycleCompletion.avgRate}% |\n\n`;
  }
  return md;
}

// Command handler
export async function linearCommand(options: LinearCommandOptions): Promise<void> {
  const config = getLinearConfig();

  if (!config) {
    console.log(chalk.yellow('\n⚠️  Linear is not configured.\n'));
    console.log('Set environment variable:');
    console.log(chalk.gray('  export LINEAR_API_KEY=lin_api_xxxxx\n'));
    console.log('Or run: git-dev-metrics config --init\n');
    return;
  }

  const spinner = ora('Connecting to Linear...').start();

  try {
    const client = new LinearClient(config);
    const test = await client.testConnection();
    
    if (!test.success) {
      spinner.fail(chalk.red(`Failed to connect: ${test.error}`));
      return;
    }

    spinner.text = `Connected as ${test.user}. Finding team...`;

    const team = await client.getTeamByName(options.team);
    if (!team) {
      spinner.fail(chalk.red(`Team not found: ${options.team}`));
      console.log(chalk.gray('\nAvailable teams:'));
      const teams = await client.getTeams();
      teams.forEach(t => console.log(chalk.gray(`  - ${t.name} (${t.key})`)));
      return;
    }

    spinner.text = `Fetching issues from ${team.name}...`;

    const since = options.since || format(subMonths(new Date(), 3), 'yyyy-MM-dd');
    const until = options.until || format(new Date(), 'yyyy-MM-dd');

    const issues = await client.getIssues({
      teamId: team.id,
      since,
      until,
    });

    spinner.text = 'Calculating metrics...';

    const metrics = calculateLinearMetrics(issues, { since, until });

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
