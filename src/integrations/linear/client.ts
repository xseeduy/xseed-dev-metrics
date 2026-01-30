// ============================================
// Linear API Client (GraphQL)
// ============================================

import { LinearConfig } from '../../config/integrations';
import {
  LinearIssue, LinearTeam, LinearCycle, LinearIssueConnection,
  LinearGraphQLResponse, TeamsQueryResponse, IssuesQueryResponse,
  CyclesQueryResponse, LinearFilterOptions,
} from './types';

const LINEAR_API_URL = 'https://api.linear.app/graphql';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class LinearClient {
  private apiKey: string;

  constructor(config: LinearConfig) {
    this.apiKey = config.apiKey;
  }

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const error = new Error(`Linear API error: ${response.status} ${response.statusText}`) as Error & { status: number };
      error.status = response.status;
      throw error;
    }

    const result = await response.json() as LinearGraphQLResponse<T>;
    
    if (result.errors?.length) {
      throw new Error(`Linear GraphQL error: ${result.errors[0].message}`);
    }

    return result.data;
  }

  // ==========================================
  // Teams
  // ==========================================

  async getTeams(): Promise<LinearTeam[]> {
    const query = `
      query {
        teams {
          nodes {
            id
            name
            key
          }
        }
      }
    `;

    const result = await this.graphql<TeamsQueryResponse>(query);
    return result.teams.nodes;
  }

  async getTeamByName(name: string): Promise<LinearTeam | null> {
    const teams = await this.getTeams();
    return teams.find(t => 
      t.name.toLowerCase() === name.toLowerCase() ||
      t.key.toLowerCase() === name.toLowerCase()
    ) || null;
  }

  // ==========================================
  // Issues
  // ==========================================

  async getIssues(options: LinearFilterOptions): Promise<LinearIssue[]> {
    const query = `
      query GetIssues($teamId: String, $after: String, $first: Int, $filter: IssueFilter) {
        issues(teamId: $teamId, after: $after, first: $first, filter: $filter) {
          nodes {
            id
            identifier
            title
            priority
            estimate
            createdAt
            updatedAt
            startedAt
            completedAt
            canceledAt
            state {
              id
              name
              type
            }
            assignee {
              id
              name
              email
              displayName
            }
            team {
              id
              name
              key
            }
            cycle {
              id
              number
              name
              startsAt
              endsAt
            }
            labels {
              nodes {
                id
                name
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    // Build filter
    const filter: Record<string, unknown> = {};
    
    if (options.since) {
      filter.createdAt = { gte: options.since };
    }
    if (options.until) {
      filter.createdAt = { ...filter.createdAt as object, lte: options.until };
    }
    if (options.assigneeId) {
      filter.assignee = { id: { eq: options.assigneeId } };
    }
    if (options.states?.length) {
      filter.state = { name: { in: options.states } };
    }

    const allIssues: LinearIssue[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const variables: Record<string, unknown> = {
        teamId: options.teamId,
        first: 100,
        after: cursor,
      };
      
      if (Object.keys(filter).length) {
        variables.filter = filter;
      }

      const result = await this.graphql<IssuesQueryResponse>(query, variables);
      
      // Transform labels from nodes
      const issues = result.issues.nodes.map(issue => ({
        ...issue,
        labels: (issue.labels as unknown as { nodes: Array<{ id: string; name: string }> })?.nodes || [],
      }));
      
      allIssues.push(...issues);
      
      hasMore = result.issues.pageInfo.hasNextPage;
      cursor = result.issues.pageInfo.endCursor;

      if (hasMore) await sleep(100);
    }

    return allIssues;
  }

  // ==========================================
  // Cycles
  // ==========================================

  async getCycles(teamId: string): Promise<LinearCycle[]> {
    const query = `
      query GetCycles($teamId: String!, $after: String) {
        cycles(teamId: $teamId, after: $after) {
          nodes {
            id
            number
            name
            startsAt
            endsAt
            completedAt
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const allCycles: LinearCycle[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const result = await this.graphql<CyclesQueryResponse>(query, {
        teamId,
        after: cursor,
      });

      allCycles.push(...result.cycles.nodes);
      hasMore = result.cycles.pageInfo.hasNextPage;
      cursor = result.cycles.pageInfo.endCursor;

      if (hasMore) await sleep(100);
    }

    return allCycles;
  }

  // ==========================================
  // Test Connection
  // ==========================================

  async testConnection(): Promise<{ success: boolean; user?: string; error?: string }> {
    try {
      const query = `
        query {
          viewer {
            id
            name
            email
          }
        }
      `;

      const result = await this.graphql<{ viewer: { name: string; email: string } }>(query);
      return { success: true, user: result.viewer.name || result.viewer.email };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ==========================================
  // Convenience Methods
  // ==========================================

  async getTeamIssues(
    teamName: string,
    options: Omit<LinearFilterOptions, 'teamId' | 'teamName'> = {}
  ): Promise<LinearIssue[]> {
    const team = await this.getTeamByName(teamName);
    if (!team) {
      throw new Error(`Team not found: ${teamName}`);
    }

    return this.getIssues({ ...options, teamId: team.id });
  }
}
