// ============================================
// Jira API Client
// ============================================

import { JiraConfig } from '../../config/integrations';
import { JiraIssue, JiraSearchResult, JiraSprint, JiraSprintResult, JiraBoardResult, JiraFilterOptions } from './types';

/**
 * Sleeps for a specified duration.
 * 
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 * @private
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes a function with retry logic for handling transient failures.
 * Automatically retries on rate limits (429) and transient errors.
 * 
 * @template T
 * @param fn - Function to execute
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @returns Promise resolving to the function's return value
 * @throws {Error} If max retries exceeded or authentication fails
 * @private
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error as Error;
      const err = error as { status?: number; retryAfter?: number };
      if (err.status === 401 || err.status === 403) throw error;
      if (err.status === 429) {
        await sleep(err.retryAfter || baseDelay * Math.pow(2, attempt));
        continue;
      }
      if (attempt < maxRetries - 1) await sleep(baseDelay * Math.pow(2, attempt));
    }
  }
  throw lastError || new Error('Max retries exceeded');
}

/**
 * Jira API client for interacting with Atlassian Jira.
 * Supports issue search, project queries, sprint data, and board information.
 * Includes automatic retry logic and rate limit handling.
 * 
 * @example
 * ```typescript
 * const client = new JiraClient({ url, email, token });
 * const issues = await client.getProjectIssues({ project: 'MYPROJ' });
 * ```
 */
export class JiraClient {
  private baseUrl: string;
  private auth: string;

  /**
   * Creates a new Jira API client.
   * 
   * @param config - Jira configuration containing URL, email, and API token
   */
  constructor(config: JiraConfig) {
    this.baseUrl = config.url.replace(/\/$/, '');
    this.auth = Buffer.from(`${config.email}:${config.token}`).toString('base64');
  }

  /**
   * Makes an HTTP request to the Jira API.
   * 
   * @template T
   * @param endpoint - API endpoint path
   * @param options - Request options
   * @param options.method - HTTP method (default: GET)
   * @param options.body - Request body for POST/PUT requests
   * @param options.params - Query parameters
   * @returns Promise resolving to the API response
   * @throws {Error} If the request fails or returns a non-2xx status
   * @private
   */
  private async request<T>(
    endpoint: string,
    options: { method?: string; body?: unknown; params?: Record<string, string | number> } = {}
  ): Promise<T> {
    const { method = 'GET', body, params } = options;

    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) searchParams.append(key, String(value));
      }
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Basic ${this.auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    };
    if (body) fetchOptions.body = JSON.stringify(body);

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const error = new Error(`Jira API error: ${response.status} ${response.statusText}`) as Error & { status: number; retryAfter?: number };
      error.status = response.status;
      if (response.status === 429) {
        error.retryAfter = parseInt(response.headers.get('Retry-After') || '60') * 1000;
      }
      throw error;
    }

    const text = await response.text();
    return text ? JSON.parse(text) as T : ({} as T);
  }

  /**
   * Searches for issues using JQL (Jira Query Language).
   * 
   * @param jql - JQL query string
   * @param options - Search options
   * @param options.startAt - Pagination offset (default: 0)
   * @param options.maxResults - Maximum results per page (default: 100)
   * @param options.fields - Fields to include in response
   * @param options.expand - Relations to expand (e.g., 'changelog')
   * @returns Promise resolving to search results
   * @example
   * ```typescript
   * const results = await client.searchIssues('project = MYPROJ AND status = Done');
   * ```
   */
  async searchIssues(
    jql: string,
    options: { startAt?: number; maxResults?: number; fields?: string[]; expand?: string[] } = {}
  ): Promise<JiraSearchResult> {
    const {
      startAt = 0, maxResults = 100,
      fields = ['summary', 'status', 'issuetype', 'assignee', 'reporter', 'created', 'updated', 'resolutiondate', 'priority', 'labels'],
      expand = ['changelog'],
    } = options;

    return withRetry(() =>
      this.request<JiraSearchResult>('/rest/api/3/search', {
        method: 'POST',
        body: { jql, startAt, maxResults, fields, expand },
      })
    );
  }

  async searchAllIssues(
    jql: string,
    options: { onProgress?: (fetched: number, total: number) => void } = {}
  ): Promise<JiraIssue[]> {
    const allIssues: JiraIssue[] = [];
    let startAt = 0;
    let total = 0;

    do {
      const result = await this.searchIssues(jql, { startAt, maxResults: 100 });
      allIssues.push(...result.issues);
      total = result.total;
      startAt += result.issues.length;
      options.onProgress?.(allIssues.length, total);
      if (startAt < total) await sleep(100);
    } while (startAt < total);

    return allIssues;
  }

  async getBoards(projectKey?: string): Promise<JiraBoardResult> {
    const params: Record<string, string | number> = { maxResults: 50 };
    if (projectKey) params.projectKeyOrId = projectKey;
    return withRetry(() => this.request<JiraBoardResult>('/rest/agile/1.0/board', { params }));
  }

  async getSprints(boardId: number, options: { state?: string; startAt?: number } = {}): Promise<JiraSprintResult> {
    const params: Record<string, string | number> = { maxResults: 50, startAt: options.startAt || 0 };
    if (options.state) params.state = options.state;
    return withRetry(() => this.request<JiraSprintResult>(`/rest/agile/1.0/board/${boardId}/sprint`, { params }));
  }

  async getAllSprints(boardId: number): Promise<JiraSprint[]> {
    const all: JiraSprint[] = [];
    let startAt = 0;
    let hasMore = true;
    while (hasMore) {
      const result = await this.getSprints(boardId, { startAt });
      all.push(...result.values);
      hasMore = result.values.length === 50;
      startAt += result.values.length;
      if (hasMore) await sleep(100);
    }
    return all;
  }

  buildJQL(options: JiraFilterOptions): string {
    const conditions: string[] = [`project = "${options.project}"`];
    if (options.since) conditions.push(`created >= "${options.since}"`);
    if (options.until) conditions.push(`created <= "${options.until}"`);
    if (options.assignee) conditions.push(`assignee = "${options.assignee}"`);
    if (options.issueTypes?.length) conditions.push(`issuetype IN (${options.issueTypes.map(t => `"${t}"`).join(', ')})`);
    if (options.excludeTypes?.length) conditions.push(`issuetype NOT IN (${options.excludeTypes.map(t => `"${t}"`).join(', ')})`);
    if (!options.includeSubtasks) conditions.push('issuetype != Sub-task');
    return conditions.join(' AND ') + ' ORDER BY created DESC';
  }

  async getProjectIssues(
    options: JiraFilterOptions,
    callbacks?: { onProgress?: (fetched: number, total: number) => void }
  ): Promise<JiraIssue[]> {
    return this.searchAllIssues(this.buildJQL(options), { onProgress: callbacks?.onProgress });
  }

  async testConnection(): Promise<{ success: boolean; user?: string; error?: string }> {
    try {
      const result = await this.request<{ displayName: string; emailAddress: string }>('/rest/api/3/myself');
      return { success: true, user: result.displayName || result.emailAddress };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  }

  async getProject(projectKey: string): Promise<{ key: string; name: string; id: string }> {
    return withRetry(() => this.request<{ key: string; name: string; id: string }>(`/rest/api/3/project/${projectKey}`));
  }
}
