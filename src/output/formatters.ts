// ============================================
// Output Formatters - Table, JSON, CSV, Markdown
// ============================================

import Table from 'cli-table3';
import chalk from 'chalk';
import { 
  AuthorStats, 
  CommitInfo, 
  FileStats, 
  TimeStats, 
  RepoSummary,
  PeriodStats,
  BlameStats
} from '../types';
import { formatDate, formatShortDate, formatDuration } from '../utils/date-utils';

type OutputFormat = 'table' | 'json' | 'csv' | 'markdown';

// ==========================================
// Generic Formatter
// ==========================================

export function formatOutput<T>(
  data: T,
  format: OutputFormat,
  formatter: {
    table: (data: T) => string;
    json: (data: T) => string;
    csv: (data: T) => string;
    markdown: (data: T) => string;
  }
): string {
  switch (format) {
    case 'json': return formatter.json(data);
    case 'csv': return formatter.csv(data);
    case 'markdown': return formatter.markdown(data);
    default: return formatter.table(data);
  }
}

// ==========================================
// Repository Summary
// ==========================================

export function formatRepoSummary(summary: RepoSummary, format: OutputFormat): string {
  return formatOutput(summary, format, {
    table: (s) => {
      const table = new Table({
        head: [chalk.cyan('Metric'), chalk.cyan('Value')],
        colWidths: [25, 40],
      });

      table.push(
        ['Total Commits', chalk.yellow(s.totalCommits.toLocaleString())],
        ['Total Authors', chalk.yellow(s.totalAuthors.toLocaleString())],
        ['Lines Added', chalk.green(`+${s.totalLinesAdded.toLocaleString()}`)],
        ['Lines Deleted', chalk.red(`-${s.totalLinesDeleted.toLocaleString()}`)],
        ['Net Lines', s.totalLinesAdded - s.totalLinesDeleted >= 0 
          ? chalk.green(`+${(s.totalLinesAdded - s.totalLinesDeleted).toLocaleString()}`)
          : chalk.red((s.totalLinesAdded - s.totalLinesDeleted).toLocaleString())
        ],
        ['Files Changed', s.totalFilesChanged.toLocaleString()],
        ['First Commit', formatDate(s.firstCommitDate)],
        ['Last Commit', formatDate(s.lastCommitDate)],
        ['Current Branch', chalk.magenta(s.currentBranch)],
        ['Active Branches', s.activeBranches.toString()],
      );

      if (s.firstCommitDate && s.lastCommitDate) {
        table.push(['Project Age', formatDuration(s.firstCommitDate, s.lastCommitDate)]);
      }

      return table.toString();
    },
    json: (s) => JSON.stringify(s, null, 2),
    csv: (s) => {
      const lines = ['metric,value'];
      lines.push(`total_commits,${s.totalCommits}`);
      lines.push(`total_authors,${s.totalAuthors}`);
      lines.push(`lines_added,${s.totalLinesAdded}`);
      lines.push(`lines_deleted,${s.totalLinesDeleted}`);
      lines.push(`files_changed,${s.totalFilesChanged}`);
      lines.push(`first_commit,${formatShortDate(s.firstCommitDate)}`);
      lines.push(`last_commit,${formatShortDate(s.lastCommitDate)}`);
      return lines.join('\n');
    },
    markdown: (s) => {
      return `## Repository Summary

| Metric | Value |
|--------|-------|
| Total Commits | ${s.totalCommits.toLocaleString()} |
| Total Authors | ${s.totalAuthors} |
| Lines Added | +${s.totalLinesAdded.toLocaleString()} |
| Lines Deleted | -${s.totalLinesDeleted.toLocaleString()} |
| Files Changed | ${s.totalFilesChanged.toLocaleString()} |
| First Commit | ${formatShortDate(s.firstCommitDate)} |
| Last Commit | ${formatShortDate(s.lastCommitDate)} |
| Current Branch | ${s.currentBranch} |
`;
    },
  });
}

// ==========================================
// Author Statistics
// ==========================================

export function formatAuthorStats(stats: AuthorStats[], format: OutputFormat): string {
  return formatOutput(stats, format, {
    table: (data) => {
      const table = new Table({
        head: [
          chalk.cyan('#'),
          chalk.cyan('Author'),
          chalk.cyan('Username'),
          chalk.cyan('Commits'),
          chalk.cyan('Lines +'),
          chalk.cyan('Lines -'),
          chalk.cyan('Net'),
          chalk.cyan('Files'),
          chalk.cyan('Days Active'),
          chalk.cyan('Avg/Day'),
        ],
        colWidths: [4, 25, 18, 10, 12, 12, 12, 8, 12, 10],
      });

      data.forEach((s, i) => {
        table.push([
          (i + 1).toString(),
          s.name.substring(0, 23),
          s.username.substring(0, 16),
          chalk.yellow(s.commits.toLocaleString()),
          chalk.green(`+${s.linesAdded.toLocaleString()}`),
          chalk.red(`-${s.linesDeleted.toLocaleString()}`),
          s.linesNet >= 0 
            ? chalk.green(`+${s.linesNet.toLocaleString()}`)
            : chalk.red(s.linesNet.toLocaleString()),
          s.filesChanged.toLocaleString(),
          s.activeDays.toString(),
          s.avgCommitsPerDay.toFixed(1),
        ]);
      });

      return table.toString();
    },
    json: (data) => JSON.stringify(data, null, 2),
    csv: (data) => {
      const lines = ['rank,author,username,email,commits,lines_added,lines_deleted,lines_net,files_changed,active_days,avg_per_day,first_commit,last_commit'];
      data.forEach((s, i) => {
        lines.push([
          i + 1,
          `"${s.name}"`,
          s.username,
          s.email,
          s.commits,
          s.linesAdded,
          s.linesDeleted,
          s.linesNet,
          s.filesChanged,
          s.activeDays,
          s.avgCommitsPerDay,
          formatShortDate(s.firstCommit),
          formatShortDate(s.lastCommit),
        ].join(','));
      });
      return lines.join('\n');
    },
    markdown: (data) => {
      let md = `## Author Statistics

| # | Author | Username | Commits | Lines + | Lines - | Net | Files | Days |
|---|--------|----------|---------|---------|---------|-----|-------|------|
`;
      data.forEach((s, i) => {
        md += `| ${i + 1} | ${s.name} | ${s.username} | ${s.commits} | +${s.linesAdded} | -${s.linesDeleted} | ${s.linesNet} | ${s.filesChanged} | ${s.activeDays} |\n`;
      });
      return md;
    },
  });
}

// ==========================================
// Commit List
// ==========================================

export function formatCommits(commits: CommitInfo[], format: OutputFormat): string {
  return formatOutput(commits, format, {
    table: (data) => {
      const table = new Table({
        head: [
          chalk.cyan('Hash'),
          chalk.cyan('Author'),
          chalk.cyan('Date'),
          chalk.cyan('+'),
          chalk.cyan('-'),
          chalk.cyan('Message'),
        ],
        colWidths: [10, 20, 20, 8, 8, 50],
      });

      data.forEach((c) => {
        table.push([
          chalk.yellow(c.shortHash),
          c.author.substring(0, 18),
          formatShortDate(c.date),
          chalk.green(`+${c.linesAdded}`),
          chalk.red(`-${c.linesDeleted}`),
          c.message.substring(0, 48),
        ]);
      });

      return table.toString();
    },
    json: (data) => JSON.stringify(data, null, 2),
    csv: (data) => {
      const lines = ['hash,short_hash,author,email,date,lines_added,lines_deleted,files_changed,is_merge,message'];
      data.forEach((c) => {
        lines.push([
          c.hash,
          c.shortHash,
          `"${c.author}"`,
          c.email,
          c.date.toISOString(),
          c.linesAdded,
          c.linesDeleted,
          c.filesChanged,
          c.isMerge,
          `"${c.message.replace(/"/g, '""')}"`,
        ].join(','));
      });
      return lines.join('\n');
    },
    markdown: (data) => {
      let md = `## Recent Commits

| Hash | Author | Date | + | - | Message |
|------|--------|------|---|---|---------|
`;
      data.forEach((c) => {
        md += `| ${c.shortHash} | ${c.author} | ${formatShortDate(c.date)} | +${c.linesAdded} | -${c.linesDeleted} | ${c.message.substring(0, 50)} |\n`;
      });
      return md;
    },
  });
}

// ==========================================
// Time Statistics
// ==========================================

export function formatTimeStats(stats: TimeStats, format: OutputFormat): string {
  return formatOutput(stats, format, {
    table: (data) => {
      let output = '';

      // By Day of Week
      output += chalk.bold.cyan('\n📅 Commits by Day of Week\n');
      const dayTable = new Table({
        head: [chalk.cyan('Day'), chalk.cyan('Commits'), chalk.cyan('Graph')],
        colWidths: [15, 10, 40],
      });

      const maxDay = Math.max(...Object.values(data.byDayOfWeek));
      for (const [day, count] of Object.entries(data.byDayOfWeek)) {
        const bar = '█'.repeat(Math.round((count / maxDay) * 30));
        dayTable.push([day, count.toString(), chalk.green(bar)]);
      }
      output += dayTable.toString();

      // By Hour
      output += chalk.bold.cyan('\n\n🕐 Commits by Hour\n');
      const hourTable = new Table({
        head: [chalk.cyan('Hour'), chalk.cyan('Commits'), chalk.cyan('Graph')],
        colWidths: [8, 10, 40],
      });

      const maxHour = Math.max(...Object.values(data.byHour));
      for (let h = 0; h < 24; h++) {
        const count = data.byHour[h] || 0;
        const bar = '█'.repeat(Math.round((count / maxHour) * 30));
        hourTable.push([`${h.toString().padStart(2, '0')}:00`, count.toString(), chalk.blue(bar)]);
      }
      output += hourTable.toString();

      return output;
    },
    json: (data) => JSON.stringify(data, null, 2),
    csv: (data) => {
      const lines = ['type,key,commits'];
      for (const [day, count] of Object.entries(data.byDayOfWeek)) {
        lines.push(`day_of_week,${day},${count}`);
      }
      for (const [hour, count] of Object.entries(data.byHour)) {
        lines.push(`hour,${hour},${count}`);
      }
      for (const [month, count] of Object.entries(data.byMonth)) {
        lines.push(`month,${month},${count}`);
      }
      return lines.join('\n');
    },
    markdown: (data) => {
      let md = `## Time Statistics

### By Day of Week
| Day | Commits |
|-----|---------|
`;
      for (const [day, count] of Object.entries(data.byDayOfWeek)) {
        md += `| ${day} | ${count} |\n`;
      }
      return md;
    },
  });
}

// ==========================================
// File Statistics
// ==========================================

export function formatFileStats(stats: FileStats[], format: OutputFormat): string {
  return formatOutput(stats, format, {
    table: (data) => {
      const table = new Table({
        head: [
          chalk.cyan('#'),
          chalk.cyan('File'),
          chalk.cyan('Changes'),
          chalk.cyan('Lines +'),
          chalk.cyan('Lines -'),
          chalk.cyan('Authors'),
        ],
        colWidths: [4, 50, 10, 10, 10, 10],
      });

      data.forEach((f, i) => {
        table.push([
          (i + 1).toString(),
          f.path.length > 48 ? '...' + f.path.slice(-45) : f.path,
          chalk.yellow(f.changes.toString()),
          chalk.green(`+${f.linesAdded}`),
          chalk.red(`-${f.linesDeleted}`),
          f.authors.length.toString(),
        ]);
      });

      return table.toString();
    },
    json: (data) => JSON.stringify(data, null, 2),
    csv: (data) => {
      const lines = ['rank,file,changes,lines_added,lines_deleted,author_count,authors'];
      data.forEach((f, i) => {
        lines.push([
          i + 1,
          `"${f.path}"`,
          f.changes,
          f.linesAdded,
          f.linesDeleted,
          f.authors.length,
          `"${f.authors.join(';')}"`,
        ].join(','));
      });
      return lines.join('\n');
    },
    markdown: (data) => {
      let md = `## Most Changed Files

| # | File | Changes | Lines + | Lines - |
|---|------|---------|---------|---------|
`;
      data.forEach((f, i) => {
        md += `| ${i + 1} | ${f.path} | ${f.changes} | +${f.linesAdded} | -${f.linesDeleted} |\n`;
      });
      return md;
    },
  });
}

// ==========================================
// Period Statistics
// ==========================================

export function formatPeriodStats(stats: PeriodStats[], format: OutputFormat): string {
  return formatOutput(stats, format, {
    table: (data) => {
      const table = new Table({
        head: [
          chalk.cyan('Period'),
          chalk.cyan('Commits'),
          chalk.cyan('Lines +'),
          chalk.cyan('Lines -'),
          chalk.cyan('Authors'),
        ],
        colWidths: [15, 10, 12, 12, 10],
      });

      data.forEach((p) => {
        table.push([
          p.period,
          chalk.yellow(p.commits.toString()),
          chalk.green(`+${p.linesAdded.toLocaleString()}`),
          chalk.red(`-${p.linesDeleted.toLocaleString()}`),
          p.authors.toString(),
        ]);
      });

      return table.toString();
    },
    json: (data) => JSON.stringify(data, null, 2),
    csv: (data) => {
      const lines = ['period,commits,lines_added,lines_deleted,authors'];
      data.forEach((p) => {
        lines.push([p.period, p.commits, p.linesAdded, p.linesDeleted, p.authors].join(','));
      });
      return lines.join('\n');
    },
    markdown: (data) => {
      let md = `## Activity by Period

| Period | Commits | Lines + | Lines - | Authors |
|--------|---------|---------|---------|---------|
`;
      data.forEach((p) => {
        md += `| ${p.period} | ${p.commits} | +${p.linesAdded} | -${p.linesDeleted} | ${p.authors} |\n`;
      });
      return md;
    },
  });
}

// ==========================================
// Blame Statistics
// ==========================================

export function formatBlameStats(stats: BlameStats[], format: OutputFormat): string {
  return formatOutput(stats, format, {
    table: (data) => {
      const table = new Table({
        head: [
          chalk.cyan('#'),
          chalk.cyan('Author'),
          chalk.cyan('Lines'),
          chalk.cyan('%'),
          chalk.cyan('Graph'),
        ],
        colWidths: [4, 30, 12, 8, 40],
      });

      data.slice(0, 20).forEach((b, i) => {
        const bar = '█'.repeat(Math.round(b.percentage / 3));
        table.push([
          (i + 1).toString(),
          b.author.substring(0, 28),
          b.lines.toLocaleString(),
          `${b.percentage}%`,
          chalk.cyan(bar),
        ]);
      });

      return table.toString();
    },
    json: (data) => JSON.stringify(data, null, 2),
    csv: (data) => {
      const lines = ['rank,author,email,lines,percentage'];
      data.forEach((b, i) => {
        lines.push([i + 1, `"${b.author}"`, b.email, b.lines, b.percentage].join(','));
      });
      return lines.join('\n');
    },
    markdown: (data) => {
      let md = `## Code Ownership (Git Blame)

| # | Author | Lines | % |
|---|--------|-------|---|
`;
      data.slice(0, 20).forEach((b, i) => {
        md += `| ${i + 1} | ${b.author} | ${b.lines.toLocaleString()} | ${b.percentage}% |\n`;
      });
      return md;
    },
  });
}
