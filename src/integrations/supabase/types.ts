// ============================================
// Supabase Types & Interfaces
// ============================================

export interface UploadResult {
  success: boolean;
  recordId?: string;
  error?: string;
}

export interface UploadSummary {
  jobRunId: string;
  collectionId: string;
  gitMetricsUploaded: number;
  integrationMetricsUploaded: number;
  errors: string[];
  durationMs: number;
}
