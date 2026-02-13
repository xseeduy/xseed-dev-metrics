// ============================================
// Supabase Upload Functions
// ============================================

import { SupabaseMetricsClient } from './client';

/**
 * Uploads git metrics to Supabase.
 */
export async function uploadGitMetrics(
  client: SupabaseMetricsClient,
  data: {
    engineerClientId: string;
    repoName: string;
    periodStart: string | null;
    periodEnd: string | null;
    collectionId: string;
    gitMetrics: {
      summary: any;
      userStats: any;
      activity: any;
      trends: any;
    };
  }
): Promise<{ id: string }> {
  const summary = data.gitMetrics.summary || {};
  const userStats = data.gitMetrics.userStats || {};
  const activity = data.gitMetrics.activity || {};

  const { data: result, error } = await client.getClient()
    .from('git_metrics')
    .insert({
      engineer_client_id: data.engineerClientId,
      repo_name: data.repoName,
      period_start: data.periodStart || new Date().toISOString().split('T')[0],
      period_end: data.periodEnd || new Date().toISOString().split('T')[0],
      commits: userStats.commits || 0,
      lines_added: userStats.linesAdded || 0,
      lines_deleted: userStats.linesDeleted || 0,
      files_changed: userStats.filesChanged || 0,
      active_days: userStats.activeDays || 0,
      avg_commits_per_day: userStats.avgCommitsPerDay || 0,
      prs_opened: summary.prsOpened || 0,
      prs_merged: summary.prsMerged || 0,
      activity_by_hour: activity.byHour || {},
      activity_by_day: activity.byDayOfWeek || {},
      weekly_trends: data.gitMetrics.trends || {},
      collection_id: data.collectionId,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to upload git metrics: ${error.message}`);
  }

  return { id: result!.id };
}

/**
 * Uploads integration metrics (Jira/Linear) to Supabase.
 */
export async function uploadIntegrationMetrics(
  client: SupabaseMetricsClient,
  data: {
    engineerClientId: string;
    source: 'jira' | 'linear';
    metrics: Record<string, any>;
    periodStart: string | null;
    periodEnd: string | null;
  }
): Promise<{ id: string }[]> {
  const rows: any[] = [];

  for (const [key, value] of Object.entries(data.metrics)) {
    if (typeof value === 'number') {
      rows.push({
        engineer_client_id: data.engineerClientId,
        source: data.source,
        metric_type: 'summary',
        metric_name: key,
        value,
        period_start: data.periodStart,
        period_end: data.periodEnd,
      });
    } else if (typeof value === 'object' && value !== null) {
      for (const [subKey, subValue] of Object.entries(value)) {
        if (typeof subValue === 'number') {
          rows.push({
            engineer_client_id: data.engineerClientId,
            source: data.source,
            metric_type: key,
            metric_name: subKey,
            value: subValue,
            period_start: data.periodStart,
            period_end: data.periodEnd,
            metadata: { parent: key },
          });
        }
      }
    }
  }

  if (rows.length === 0) return [];

  const { data: result, error } = await client.getClient()
    .from('integration_metrics')
    .insert(rows)
    .select('id');

  if (error) {
    throw new Error(`Failed to upload ${data.source} metrics: ${error.message}`);
  }

  return result || [];
}

/**
 * Creates a job_run record at the start of a collection.
 */
export async function createJobRun(
  client: SupabaseMetricsClient,
  data: {
    jobType: string;
    triggeredBy: string;
    metadata?: Record<string, any>;
  }
): Promise<{ id: string }> {
  const { data: result, error } = await client.getClient()
    .from('job_runs')
    .insert({
      job_type: data.jobType,
      status: 'running',
      triggered_by: data.triggeredBy,
      metadata: data.metadata || {},
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create job run: ${error.message}`);
  }

  return { id: result!.id };
}

/**
 * Updates a job_run record when collection completes or fails.
 */
export async function updateJobRun(
  client: SupabaseMetricsClient,
  jobRunId: string,
  update: {
    status: 'success' | 'error';
    recordsProcessed?: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const { error } = await client.getClient()
    .from('job_runs')
    .update({
      status: update.status,
      finished_at: new Date().toISOString(),
      records_processed: update.recordsProcessed || 0,
      error_message: update.errorMessage,
      metadata: update.metadata || {},
    })
    .eq('id', jobRunId);

  if (error) {
    throw new Error(`Failed to update job run: ${error.message}`);
  }
}
