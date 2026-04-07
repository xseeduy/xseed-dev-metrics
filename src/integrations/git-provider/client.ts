// ============================================
// Git Provider Client — GitHub / GitLab / Bitbucket
// ============================================

import { GitIntegrationConfig } from '../../config/integrations';
import { PrStats, PrQueryOptions } from './types';

// ==========================================
// Shared HTTP helper
// ==========================================

async function httpGet(url: string, headers: Record<string, string>): Promise<any> {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}\n${body}`);
  }
  return res.json();
}

// ==========================================
// Base URL helpers (derived from remote URL)
// ==========================================

/**
 * Derives the GitHub API base URL from the remote URL.
 * Supports github.com and GitHub Enterprise (e.g. https://github.myco.com → https://github.myco.com/api/v3).
 */
function githubApiBase(remoteUrl?: string): string {
  if (remoteUrl) {
    const httpsMatch = remoteUrl.match(/https?:\/\/([^/]+)\//);
    const sshMatch = remoteUrl.match(/git@([^:]+):/);
    const host = httpsMatch?.[1] ?? sshMatch?.[1];
    if (host && host !== 'github.com') {
      return `https://${host}/api/v3`;
    }
  }
  return 'https://api.github.com';
}

/**
 * Derives the GitLab API base URL from the remote URL.
 * Supports gitlab.com and self-managed instances.
 */
function gitlabApiBase(remoteUrl?: string): string {
  if (remoteUrl) {
    const httpsMatch = remoteUrl.match(/https?:\/\/([^/]+)\//);
    const sshMatch = remoteUrl.match(/git@([^:]+):/);
    const host = httpsMatch?.[1] ?? sshMatch?.[1];
    if (host && host !== 'gitlab.com') {
      return `https://${host}`;
    }
  }
  return 'https://gitlab.com';
}

/**
 * Derives the Bitbucket API base URL from the remote URL.
 * Supports bitbucket.org and Bitbucket Server (self-hosted).
 */
function bitbucketApiBase(remoteUrl?: string): string {
  if (remoteUrl) {
    const httpsMatch = remoteUrl.match(/https?:\/\/([^/]+)\//);
    const sshMatch = remoteUrl.match(/git@([^:]+):/);
    const host = httpsMatch?.[1] ?? sshMatch?.[1];
    if (host && host !== 'bitbucket.org') {
      // Bitbucket Server uses /rest/api/1.0
      return `https://${host}/rest/api/1.0`;
    }
  }
  return 'https://api.bitbucket.org/2.0';
}

// ==========================================
// GitHub
// ==========================================

async function fetchGitHubPrStats(
  config: GitIntegrationConfig,
  opts: PrQueryOptions
): Promise<PrStats> {
  const base = githubApiBase(opts.remoteUrl);
  const headers = {
    Authorization: `Bearer ${config.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const stats: PrStats = { open: 0, merged: 0, closedNotMerged: 0 };

  // GitHub Search API: PRs by author in the given repo
  const repoFilter = `repo:${opts.owner}/${opts.repo}`;
  const authorFilter = `author:${opts.author}`;
  const dateFilter = opts.since ? `+created:>=${opts.since.split('T')[0]}` : '';

  for (const state of ['open', 'closed'] as const) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url =
        `${base}/search/issues?q=is:pr+${repoFilter}+${authorFilter}+is:${state}${dateFilter}` +
        `&per_page=100&page=${page}`;

      const data = await httpGet(url, headers);
      const items: any[] = data.items ?? [];

      for (const pr of items) {
        // Apply until filter client-side
        if (opts.until) {
          const created = new Date(pr.created_at).getTime();
          if (created > new Date(opts.until).getTime()) continue;
        }

        if (state === 'open') {
          stats.open++;
        } else {
          // closed: check pull_request.merged_at via individual PR (or use pull_request.merged_at in search)
          if (pr.pull_request?.merged_at) {
            stats.merged++;
          } else {
            stats.closedNotMerged++;
          }
        }
      }

      hasMore = items.length === 100;
      page++;
    }
  }

  return stats;
}

// ==========================================
// GitLab
// ==========================================

async function fetchGitLabPrStats(
  config: GitIntegrationConfig,
  opts: PrQueryOptions
): Promise<PrStats> {
  const base = gitlabApiBase(opts.remoteUrl).replace(/\/$/, '');
  const headers = { 'PRIVATE-TOKEN': config.token };

  const stats: PrStats = { open: 0, merged: 0, closedNotMerged: 0 };

  // GitLab uses "merge requests" (MRs). Namespace = owner/repo encoded
  const projectPath = encodeURIComponent(`${opts.owner}/${opts.repo}`);

  const stateMap: Array<{ glState: string; target: keyof PrStats }> = [
    { glState: 'opened', target: 'open' },
    { glState: 'merged', target: 'merged' },
    { glState: 'closed', target: 'closedNotMerged' },
  ];

  for (const { glState, target } of stateMap) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      let url =
        `${base}/api/v4/projects/${projectPath}/merge_requests` +
        `?author_username=${encodeURIComponent(opts.author)}&state=${glState}&per_page=100&page=${page}`;

      if (opts.since) url += `&created_after=${opts.since}`;
      if (opts.until) url += `&created_before=${opts.until}`;

      const items: any[] = await httpGet(url, headers);

      stats[target] += items.length;
      hasMore = items.length === 100;
      page++;
    }
  }

  return stats;
}

// ==========================================
// Bitbucket
// ==========================================

async function fetchBitbucketPrStats(
  config: GitIntegrationConfig,
  opts: PrQueryOptions
): Promise<PrStats> {
  const base = bitbucketApiBase(opts.remoteUrl).replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${config.token}` };

  const stats: PrStats = { open: 0, merged: 0, closedNotMerged: 0 };

  const stateMap: Array<{ bbState: string; target: keyof PrStats }> = [
    { bbState: 'OPEN', target: 'open' },
    { bbState: 'MERGED', target: 'merged' },
    { bbState: 'DECLINED', target: 'closedNotMerged' },
  ];

  for (const { bbState, target } of stateMap) {
    let url: string | null =
      `${base}/repositories/${opts.owner}/${opts.repo}/pullrequests` +
      `?state=${bbState}&pagelen=50`;

    // Bitbucket doesn't support author filter in query string, filter client-side
    while (url) {
      const data = await httpGet(url, headers);
      const items: any[] = data.values ?? [];

      for (const pr of items) {
        const authorNick: string = pr.author?.nickname ?? pr.author?.account_id ?? '';
        if (authorNick.toLowerCase() !== opts.author.toLowerCase()) continue;

        // Date filters (client-side)
        const created = new Date(pr.created_on).getTime();
        if (opts.since && created < new Date(opts.since).getTime()) continue;
        if (opts.until && created > new Date(opts.until).getTime()) continue;

        stats[target]++;
      }

      url = data.next ?? null;
    }
  }

  return stats;
}

// ==========================================
// Public entry-point
// ==========================================

/**
 * Fetches PR/MR stats from the configured git provider's API.
 * Returns zeros (and a warning) when provider config is absent.
 */
export async function fetchProviderPrStats(
  gitIntegration: GitIntegrationConfig | null,
  opts: PrQueryOptions
): Promise<{ stats: PrStats; warning?: string }> {
  if (!gitIntegration) {
    return {
      stats: { open: 0, merged: 0, closedNotMerged: 0 },
      warning: 'No git provider token configured — PR metrics skipped. Run `metrix init` to set one up.',
    };
  }

  try {
    let stats: PrStats;
    switch (gitIntegration.provider) {
      case 'github':
        stats = await fetchGitHubPrStats(gitIntegration, opts);
        break;
      case 'gitlab':
        stats = await fetchGitLabPrStats(gitIntegration, opts);
        break;
      case 'bitbucket':
        stats = await fetchBitbucketPrStats(gitIntegration, opts);
        break;
      default:
        return {
          stats: { open: 0, merged: 0, closedNotMerged: 0 },
          warning: `Unsupported git provider: ${(gitIntegration as any).provider}`,
        };
    }
    return { stats };
  } catch (err) {
    return {
      stats: { open: 0, merged: 0, closedNotMerged: 0 },
      warning: `PR fetch failed (${gitIntegration.provider}): ${(err as Error).message}`,
    };
  }
}

/**
 * Extracts owner and repo from a git remote URL.
 * Supports HTTPS and SSH formats from GitHub, GitLab, Bitbucket.
 * Returns null if the URL cannot be parsed.
 */
export function parseOwnerRepo(remoteUrl: string): { owner: string; repo: string } | null {
  // HTTPS: https://github.com/owner/repo.git  or  https://gitlab.com/group/sub/repo.git
  // SSH:   git@github.com:owner/repo.git
  const httpsMatch = remoteUrl.match(/https?:\/\/[^/]+\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    const parts = httpsMatch[1].split('/');
    if (parts.length >= 2) {
      const repo = parts[parts.length - 1];
      // For GitLab nested groups, owner = everything before the last segment
      const owner = parts.slice(0, parts.length - 1).join('/');
      return { owner, repo };
    }
  }

  const sshMatch = remoteUrl.match(/git@[^:]+:(.+?)(?:\.git)?$/);
  if (sshMatch) {
    const parts = sshMatch[1].split('/');
    if (parts.length >= 2) {
      const repo = parts[parts.length - 1];
      const owner = parts.slice(0, parts.length - 1).join('/');
      return { owner, repo };
    }
  }

  return null;
}
