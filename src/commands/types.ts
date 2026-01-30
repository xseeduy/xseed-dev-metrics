// ============================================
// Command-specific Types
// ============================================

import { RepoSummary, AuthorStats, FileStats, PeriodStats } from '../types';
import { JiraMetrics } from '../integrations/jira/types';
import { LinearMetrics } from '../integrations/linear/types';

/**
 * Report structure for JSON output
 */
export interface Report {
  repository: string;
  period: {
    since: string;
    until: string;
  };
  git_metrics: {
    summary: RepoSummary;
    authors: AuthorStats[];
    file_stats: FileStats[];
    period_stats: PeriodStats[];
  };
  jira_metrics?: JiraMetrics | null;
  linear_metrics?: LinearMetrics | null;
}

/**
 * Common command options
 */
export interface CommonOptions {
  since?: string;
  until?: string;
  author?: string;
  branch?: string;
  merges?: boolean;
  format?: 'table' | 'json' | 'csv' | 'markdown';
  output?: string;
}
