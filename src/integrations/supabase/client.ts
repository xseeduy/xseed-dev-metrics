// ============================================
// Supabase Client for CLI
// ============================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

/**
 * Supabase client wrapper for the CLI.
 * Uses service_role key to bypass RLS (backend tool).
 */
export class SupabaseMetricsClient {
  private client: SupabaseClient;
  private url: string;

  constructor(config: SupabaseConfig) {
    this.url = config.url;
    this.client = createClient(config.url, config.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  async testConnection(): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const { error } = await this.client
        .from('clients')
        .select('id')
        .limit(1);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, url: this.url };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Resolves or creates a client record by slug.
   */
  async resolveClientId(clientName: string): Promise<string> {
    const slug = clientName.toLowerCase().replace(/\s+/g, '-');

    const { data: existing } = await this.client
      .from('clients')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) return existing.id;

    const { data: created, error } = await this.client
      .from('clients')
      .insert({ name: clientName, slug })
      .select('id')
      .single();

    if (error || !created) {
      throw new Error(`Failed to resolve client '${clientName}': ${error?.message}`);
    }

    return created.id;
  }

  /**
   * Resolves an engineer by email, creating if needed.
   * Upserts git_username, git_provider and slack_user_id when provided.
   */
  async resolveEngineerId(
    email: string,
    fullName: string,
    extra?: { gitUsername?: string; gitProvider?: string; slackUser?: string }
  ): Promise<string> {
    const { data: existing } = await this.client
      .from('engineers')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      // Update extra fields if provided
      const updates: Record<string, string> = {};
      if (extra?.gitUsername) updates.git_username = extra.gitUsername;
      if (extra?.gitProvider) updates.git_provider = extra.gitProvider;
      if (extra?.slackUser) updates.slack_user_id = extra.slackUser;

      if (Object.keys(updates).length > 0) {
        await this.client
          .from('engineers')
          .update(updates)
          .eq('id', existing.id);
      }

      return existing.id;
    }

    const row: Record<string, string> = { email, full_name: fullName };
    if (extra?.gitUsername) row.git_username = extra.gitUsername;
    if (extra?.gitProvider) row.git_provider = extra.gitProvider;
    if (extra?.slackUser) row.slack_user_id = extra.slackUser;

    const { data: created, error } = await this.client
      .from('engineers')
      .insert(row)
      .select('id')
      .single();

    if (error || !created) {
      throw new Error(`Failed to resolve engineer '${email}': ${error?.message}`);
    }

    return created.id;
  }

  /**
   * Resolves or creates an engineer_client assignment.
   */
  async resolveEngineerClientId(engineerId: string, clientId: string): Promise<string> {
    const { data: existing } = await this.client
      .from('engineer_clients')
      .select('id')
      .eq('engineer_id', engineerId)
      .eq('client_id', clientId)
      .eq('is_active', true)
      .single();

    if (existing) return existing.id;

    const today = new Date().toISOString().split('T')[0];
    const { data: created, error } = await this.client
      .from('engineer_clients')
      .insert({
        engineer_id: engineerId,
        client_id: clientId,
        start_date: today,
      })
      .select('id')
      .single();

    if (error || !created) {
      throw new Error(`Failed to create engineer-client assignment: ${error?.message}`);
    }

    return created.id;
  }
}
