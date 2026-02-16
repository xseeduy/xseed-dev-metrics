// ============================================
// Command-specific Types
// ============================================

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
