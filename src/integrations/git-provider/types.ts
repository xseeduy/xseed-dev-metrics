// ============================================
// Git Provider Integration — Types
// ============================================

/**
 * Canonical PR/MR stats returned for any provider.
 */
export interface PrStats {
  /** PRs/MRs that are currently open */
  open: number;
  /** PRs/MRs that were merged within the queried period */
  merged: number;
  /** PRs/MRs that were closed without merging within the queried period */
  closedNotMerged: number;
}

export interface PrQueryOptions {
  /** Repository owner/namespace (e.g. "octocat" or "my-org/my-group") */
  owner: string;
  /** Repository name */
  repo: string;
  /** Author username or account ID to filter by */
  author: string;
  /** ISO date string – filter PRs created/merged after this date */
  since?: string;
  /** ISO date string – filter PRs created/merged before this date */
  until?: string;
  /** Full git remote URL (used to auto-derive the provider API base URL) */
  remoteUrl?: string;
}
