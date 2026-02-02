// ============================================
// Types & Interfaces for Git Dev Metrics CLI
// ============================================

/**
 * Statistics for a single author/developer in a repository.
 * Includes commit counts, lines of code, and activity patterns.
 */
export interface AuthorStats {
  /** Full name of the author */
  name: string;
  /** Username (typically extracted from email) */
  username: string;
  /** Email address of the author */
  email: string;
  /** Total number of commits */
  commits: number;
  /** Total lines added across all commits */
  linesAdded: number;
  /** Total lines deleted across all commits */
  linesDeleted: number;
  /** Net lines (added - deleted) */
  linesNet: number;
  /** Number of unique files changed */
  filesChanged: number;
  /** Date of the author's first commit */
  firstCommit: Date | null;
  /** Date of the author's most recent commit */
  lastCommit: Date | null;
  /** Number of days with at least one commit */
  activeDays: number;
  /** Average commits per active day */
  avgCommitsPerDay: number;
  /** Number of merge commits */
  mergeCommits: number;
}

/**
 * Information about a single commit.
 * Contains metadata and statistics for the commit.
 */
export interface CommitInfo {
  /** Full commit hash */
  hash: string;
  /** Short commit hash (abbreviated) */
  shortHash: string;
  /** Author name */
  author: string;
  /** Author email */
  email: string;
  /** Commit date */
  date: Date;
  /** Commit message */
  message: string;
  /** Lines added in this commit */
  linesAdded: number;
  /** Lines deleted in this commit */
  linesDeleted: number;
  /** Number of files changed */
  filesChanged: number;
  /** Whether this is a merge commit */
  isMerge: boolean;
}

/**
 * Statistics for a specific file.
 * Tracks changes, lines, and contributors.
 */
export interface FileStats {
  /** File path relative to repository root */
  path: string;
  /** Number of times this file was changed */
  changes: number;
  /** Total lines added to this file */
  linesAdded: number;
  /** Total lines deleted from this file */
  linesDeleted: number;
  /** List of authors who modified this file */
  authors: string[];
}

/**
 * Time-based statistics for commit patterns.
 * Breaks down activity by different time dimensions.
 */
export interface TimeStats {
  /** Commits by hour of day (0-23) */
  byHour: Record<number, number>;
  /** Commits by day of week */
  byDayOfWeek: Record<string, number>;
  /** Commits by month (YYYY-MM) */
  byMonth: Record<string, number>;
  /** Commits by week (YYYY-WW) */
  byWeek: Record<string, number>;
}

/**
 * Summary statistics for a repository.
 * Provides an overview of the entire repository's activity.
 */
export interface RepoSummary {
  /** Total number of commits */
  totalCommits: number;
  /** Total number of unique authors */
  totalAuthors: number;
  /** Total lines added across all commits */
  totalLinesAdded: number;
  /** Total lines deleted across all commits */
  totalLinesDeleted: number;
  /** Total number of unique files changed */
  totalFilesChanged: number;
  /** Date of the first commit */
  firstCommitDate: Date | null;
  /** Date of the most recent commit */
  lastCommitDate: Date | null;
  /** Number of active branches */
  activeBranches: number;
  /** Name of the current branch */
  currentBranch: string;
}

/**
 * Date range for filtering.
 * Used to specify time boundaries for queries.
 */
export interface DateRange {
  /** Start date (ISO format or relative like "2 weeks ago") */
  since?: string;
  /** End date (ISO format or relative) */
  until?: string;
}

/**
 * Options for filtering git operations.
 * Extends DateRange with additional filter criteria.
 */
export interface FilterOptions extends DateRange {
  /** Filter by author name (prefer using email for more accurate matching) */
  author?: string;
  /** Filter by author email (more reliable than author name) */
  email?: string;
  /** List of authors to exclude */
  excludeAuthors?: string[];
  /** Filter by branch name */
  branch?: string;
  /** Whether to include merge commits */
  includeMerges?: boolean;
  /** Filter by specific file paths */
  paths?: string[];
}

/**
 * Options for output formatting.
 * Controls how data is displayed or saved.
 */
export interface OutputOptions {
  /** Output format */
  format: 'table' | 'json' | 'csv' | 'markdown';
  /** Optional file path to save output */
  output?: string;
  /** Enable verbose output */
  verbose?: boolean;
}

/**
 * Git blame statistics for code ownership.
 * Shows which author wrote which lines of code.
 */
export interface BlameStats {
  /** Author name */
  author: string;
  /** Author email */
  email: string;
  /** Number of lines attributed to this author */
  lines: number;
  /** Percentage of total lines (0-100) */
  percentage: number;
}

/**
 * Code churn metrics for an author.
 * Measures code stability and refactoring patterns.
 */
export interface CodeChurn {
  /** Author name */
  author: string;
  /** Lines in recent commits (< 21 days old) that were modified */
  newCode: number;
  /** Lines rewritten within 21 days */
  churnedCode: number;
  /** Churn rate (churnedCode / totalCode) */
  churnRate: number;
}

/**
 * Statistics aggregated by time period.
 * Used for trend analysis over time.
 */
export interface PeriodStats {
  /** Period identifier (e.g., "2024-01", "2024-W01") */
  period: string;
  /** Number of commits in this period */
  commits: number;
  /** Lines added in this period */
  linesAdded: number;
  /** Lines deleted in this period */
  linesDeleted: number;
  /** Number of unique authors in this period */
  authors: number;
}

/**
 * Time period grouping options.
 * Determines how to aggregate statistics by time.
 */
export type GroupBy = 'day' | 'week' | 'month' | 'year';

/**
 * Comparison between two time periods for an author.
 * Used for tracking changes in productivity metrics.
 */
export interface ComparisonStats {
  /** Author name */
  author: string;
  /** Statistics for the current period */
  currentPeriod: Partial<AuthorStats>;
  /** Statistics for the previous period */
  previousPeriod: Partial<AuthorStats>;
  /** Changes between periods */
  change: {
    /** Absolute change in commits */
    commits: number;
    /** Percentage change in commits */
    commitsPercent: number;
    /** Absolute change in lines added */
    linesAdded: number;
    /** Percentage change in lines added */
    linesAddedPercent: number;
  };
}
