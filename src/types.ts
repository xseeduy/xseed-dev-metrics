// ============================================
// Types & Interfaces for Git Dev Metrics CLI
// ============================================

export interface AuthorStats {
  name: string;
  username: string;
  email: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  linesNet: number;
  filesChanged: number;
  firstCommit: Date | null;
  lastCommit: Date | null;
  activeDays: number;
  avgCommitsPerDay: number;
  mergeCommits: number;
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;
  isMerge: boolean;
}

export interface FileStats {
  path: string;
  changes: number;
  linesAdded: number;
  linesDeleted: number;
  authors: string[];
}

export interface TimeStats {
  byHour: Record<number, number>;
  byDayOfWeek: Record<string, number>;
  byMonth: Record<string, number>;
  byWeek: Record<string, number>;
}

export interface RepoSummary {
  totalCommits: number;
  totalAuthors: number;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  totalFilesChanged: number;
  firstCommitDate: Date | null;
  lastCommitDate: Date | null;
  activeBranches: number;
  currentBranch: string;
}

export interface DateRange {
  since?: string;
  until?: string;
}

export interface FilterOptions extends DateRange {
  author?: string;
  excludeAuthors?: string[];
  branch?: string;
  includeMerges?: boolean;
  paths?: string[];
}

export interface OutputOptions {
  format: 'table' | 'json' | 'csv' | 'markdown';
  output?: string; // file path
  verbose?: boolean;
}

export interface BlameStats {
  author: string;
  email: string;
  lines: number;
  percentage: number;
}

export interface CodeChurn {
  author: string;
  newCode: number;      // Lines in commits < 21 days old that were modified
  churnedCode: number;  // Lines rewritten within 21 days
  churnRate: number;    // churnedCode / totalCode
}

export interface PeriodStats {
  period: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  authors: number;
}

export type GroupBy = 'day' | 'week' | 'month' | 'year';

export interface ComparisonStats {
  author: string;
  currentPeriod: Partial<AuthorStats>;
  previousPeriod: Partial<AuthorStats>;
  change: {
    commits: number;
    commitsPercent: number;
    linesAdded: number;
    linesAddedPercent: number;
  };
}
