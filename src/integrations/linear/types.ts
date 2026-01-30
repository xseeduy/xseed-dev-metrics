// ============================================
// Linear Types & Interfaces
// ============================================

// API Response Types
export interface LinearUser {
  id: string;
  name: string;
  email: string;
  displayName: string;
  active: boolean;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearWorkflowState {
  id: string;
  name: string;
  type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  position: number;
}

export interface LinearCycle {
  id: string;
  number: number;
  name?: string;
  startsAt: string;
  endsAt: string;
  completedAt?: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;  // e.g., "ENG-123"
  title: string;
  description?: string;
  priority: number;    // 0=none, 1=urgent, 2=high, 3=normal, 4=low
  estimate?: number;   // Story points
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  canceledAt?: string;
  state: LinearWorkflowState;
  assignee?: LinearUser;
  creator?: LinearUser;
  team: LinearTeam;
  cycle?: LinearCycle;
  labels: Array<{ id: string; name: string }>;
}

export interface LinearIssueConnection {
  nodes: LinearIssue[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
}

// Filter Options
export interface LinearFilterOptions {
  teamId?: string;
  teamName?: string;
  since?: string;
  until?: string;
  assigneeId?: string;
  states?: string[];
  cycleId?: string;
}

// Calculated Metrics
export interface LinearMetrics {
  available: boolean;
  reason?: string;
  issuesAnalyzed: number;
  period: { since: string; until: string };
  cycleTime: CycleTimeMetrics | null;
  leadTime: LeadTimeMetrics | null;
  wip: WIPMetrics;
  throughput: ThroughputMetrics | null;
  cycleCompletion: CycleCompletionMetrics | null;
  estimateAccuracy: EstimateAccuracyMetrics | null;
}

export interface CycleTimeMetrics {
  avgDays: number;
  medianDays: number;
  minDays: number;
  maxDays: number;
  p90Days: number;
  count: number;
}

export interface LeadTimeMetrics {
  avgDays: number;
  medianDays: number;
  minDays: number;
  maxDays: number;
  p90Days: number;
  count: number;
}

export interface WIPMetrics {
  current: number;
  byAssignee: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface ThroughputMetrics {
  total: number;
  perWeek: number;
  perCycle: number | null;
  byWeek: Array<{ week: string; count: number }>;
  byAssignee: Record<string, number>;
}

export interface CycleCompletionMetrics {
  avgRate: number;
  cycles: Array<{
    name: string;
    planned: number;
    completed: number;
    rate: number;
  }>;
}

export interface EstimateAccuracyMetrics {
  issuesWithEstimates: number;
  avgEstimate: number;
  totalEstimated: number;
  totalCompleted: number;
}

// GraphQL Query Response Types
export interface LinearGraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

export interface TeamsQueryResponse {
  teams: {
    nodes: LinearTeam[];
  };
}

export interface IssuesQueryResponse {
  issues: LinearIssueConnection;
}

export interface CyclesQueryResponse {
  cycles: {
    nodes: LinearCycle[];
    pageInfo: { hasNextPage: boolean; endCursor?: string };
  };
}
