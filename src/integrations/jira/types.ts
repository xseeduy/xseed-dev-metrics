// ============================================
// Jira Types & Interfaces
// ============================================

// API Response Types
export interface JiraUser {
  accountId: string;
  emailAddress?: string;
  displayName: string;
  active: boolean;
}

export interface JiraIssueType {
  id: string;
  name: string;
  subtask: boolean;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: { id: number; key: string; name: string };
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate?: string;
  endDate?: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    issuetype: JiraIssueType;
    status: JiraStatus;
    priority?: { id: string; name: string };
    assignee?: JiraUser;
    reporter?: JiraUser;
    created: string;
    updated: string;
    resolutiondate?: string;
    labels?: string[];
    [key: string]: unknown;
  };
  changelog?: { histories: JiraChangelogHistory[] };
}

export interface JiraChangelogHistory {
  id: string;
  created: string;
  author: JiraUser;
  items: Array<{
    field: string;
    fromString: string | null;
    toString: string | null;
  }>;
}

export interface JiraSearchResult {
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

export interface JiraSprintResult {
  maxResults: number;
  startAt: number;
  values: JiraSprint[];
}

export interface JiraBoardResult {
  maxResults: number;
  startAt: number;
  values: Array<{ id: number; name: string; type: string }>;
}

// Filter Options
export interface JiraFilterOptions {
  project: string;
  since?: string;
  until?: string;
  assignee?: string;
  issueTypes?: string[];
  excludeTypes?: string[];
  includeSubtasks?: boolean;
}

// Calculated Metrics
export interface JiraMetrics {
  available: boolean;
  reason?: string;
  issuesAnalyzed: number;
  period: { since: string; until: string };
  cycleTime: CycleTimeMetrics | null;
  leadTime: LeadTimeMetrics | null;
  wip: WIPMetrics;
  blockedTime: BlockedTimeMetrics;
  throughput: ThroughputMetrics | null;
  bugRatio: BugRatioMetrics;
}

export interface CycleTimeMetrics {
  avgDays: number;
  medianDays: number;
  minDays: number;
  maxDays: number;
  p90Days: number;
  count: number;
  byIssueType: Record<string, number>;
}

export interface LeadTimeMetrics {
  avgDays: number;
  medianDays: number;
  minDays: number;
  maxDays: number;
  p90Days: number;
  count: number;
  byIssueType: Record<string, number>;
}

export interface WIPMetrics {
  current: number;
  byAssignee: Record<string, number>;
  byIssueType: Record<string, number>;
}

export interface BlockedTimeMetrics {
  avgDays: number;
  totalBlockedIssues: number;
  percentageBlocked: number;
}

export interface ThroughputMetrics {
  total: number;
  perWeek: number;
  byWeek: Array<{ week: string; count: number }>;
  byAssignee: Record<string, number>;
  byIssueType: Record<string, number>;
}

export interface BugRatioMetrics {
  totalIssues: number;
  totalBugs: number;
  ratio: number;
  bugsByPriority: Record<string, number>;
  bugResolutionTime: { avgDays: number; medianDays: number };
}

// Status Mapping
export interface JiraStatusMapping {
  todo: string[];
  inProgress: string[];
  blocked: string[];
  done: string[];
}

export const DEFAULT_STATUS_MAPPING: JiraStatusMapping = {
  todo: ['To Do', 'Open', 'Backlog', 'New'],
  inProgress: ['In Progress', 'In Development', 'In Review', 'Code Review', 'Testing', 'QA'],
  blocked: ['Blocked', 'On Hold', 'Waiting', 'Impediment'],
  done: ['Done', 'Closed', 'Resolved', 'Complete', 'Deployed'],
};
