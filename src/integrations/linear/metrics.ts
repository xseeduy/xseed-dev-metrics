// ============================================
// Linear Metrics Calculator
// ============================================

import {
  LinearIssue, LinearMetrics, CycleTimeMetrics, LeadTimeMetrics,
  WIPMetrics, ThroughputMetrics, CycleCompletionMetrics, EstimateAccuracyMetrics,
} from './types';
import { format, differenceInDays, differenceInWeeks, parseISO } from 'date-fns';
import { median, percentile, avg, getWeekKey } from '../../utils/metrics-calculations';

// Priority mapping
const PRIORITY_NAMES: Record<number, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Normal',
  4: 'Low',
};

// Metric calculators
function calculateCycleTime(issues: LinearIssue[]): CycleTimeMetrics | null {
  const times: number[] = [];

  for (const issue of issues) {
    if (issue.startedAt && issue.completedAt) {
      const started = parseISO(issue.startedAt);
      const completed = parseISO(issue.completedAt);
      if (completed > started) {
        times.push(differenceInDays(completed, started));
      }
    }
  }

  if (!times.length) return null;

  return {
    avgDays: Math.round(avg(times) * 10) / 10,
    medianDays: Math.round(median(times) * 10) / 10,
    minDays: Math.min(...times),
    maxDays: Math.max(...times),
    p90Days: Math.round(percentile(times, 90) * 10) / 10,
    count: times.length,
  };
}

function calculateLeadTime(issues: LinearIssue[]): LeadTimeMetrics | null {
  const times: number[] = [];

  for (const issue of issues) {
    if (issue.completedAt) {
      const created = parseISO(issue.createdAt);
      const completed = parseISO(issue.completedAt);
      times.push(differenceInDays(completed, created));
    }
  }

  if (!times.length) return null;

  return {
    avgDays: Math.round(avg(times) * 10) / 10,
    medianDays: Math.round(median(times) * 10) / 10,
    minDays: Math.min(...times),
    maxDays: Math.max(...times),
    p90Days: Math.round(percentile(times, 90) * 10) / 10,
    count: times.length,
  };
}

function calculateWIP(issues: LinearIssue[]): WIPMetrics {
  const inProgress = issues.filter(issue => issue.state.type === 'started');
  const byAssignee: Record<string, number> = {};
  const byPriority: Record<string, number> = {};

  for (const issue of inProgress) {
    const assignee = issue.assignee?.displayName || issue.assignee?.name || 'Unassigned';
    const priority = PRIORITY_NAMES[issue.priority] || 'Unknown';
    byAssignee[assignee] = (byAssignee[assignee] || 0) + 1;
    byPriority[priority] = (byPriority[priority] || 0) + 1;
  }

  return { current: inProgress.length, byAssignee, byPriority };
}

function calculateThroughput(issues: LinearIssue[], periodWeeks: number): ThroughputMetrics | null {
  const completed = issues.filter(issue => issue.state.type === 'completed');
  if (!completed.length) return null;

  const byWeek: Record<string, number> = {};
  const byAssignee: Record<string, number> = {};

  for (const issue of completed) {
    if (issue.completedAt) {
      const weekKey = getWeekKey(parseISO(issue.completedAt));
      byWeek[weekKey] = (byWeek[weekKey] || 0) + 1;
    }

    const assignee = issue.assignee?.displayName || issue.assignee?.name || 'Unassigned';
    byAssignee[assignee] = (byAssignee[assignee] || 0) + 1;
  }

  const sortedWeeks = Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));

  // Calculate per-cycle if issues have cycle info
  const cycleIds = new Set(completed.filter(i => i.cycle).map(i => i.cycle!.id));
  const perCycle = cycleIds.size > 0 ? Math.round((completed.length / cycleIds.size) * 10) / 10 : null;

  return {
    total: completed.length,
    perWeek: periodWeeks > 0 ? Math.round((completed.length / periodWeeks) * 10) / 10 : completed.length,
    perCycle,
    byWeek: sortedWeeks,
    byAssignee,
  };
}

function calculateCycleCompletion(issues: LinearIssue[]): CycleCompletionMetrics | null {
  // Group issues by cycle
  const byCycle = new Map<string, { name: string; planned: number; completed: number }>();

  for (const issue of issues) {
    if (!issue.cycle) continue;

    const cycleId = issue.cycle.id;
    if (!byCycle.has(cycleId)) {
      byCycle.set(cycleId, {
        name: issue.cycle.name || `Cycle ${issue.cycle.number}`,
        planned: 0,
        completed: 0,
      });
    }

    const cycle = byCycle.get(cycleId)!;
    cycle.planned++;
    if (issue.state.type === 'completed') {
      cycle.completed++;
    }
  }

  if (byCycle.size === 0) return null;

  const cycles = Array.from(byCycle.values()).map(c => ({
    ...c,
    rate: c.planned > 0 ? Math.round((c.completed / c.planned) * 100) : 0,
  }));

  const avgRate = Math.round(avg(cycles.map(c => c.rate)));

  return { avgRate, cycles };
}

function calculateEstimateAccuracy(issues: LinearIssue[]): EstimateAccuracyMetrics | null {
  const withEstimates = issues.filter(i => i.estimate && i.estimate > 0);
  if (!withEstimates.length) return null;

  const completed = withEstimates.filter(i => i.state.type === 'completed');

  return {
    issuesWithEstimates: withEstimates.length,
    avgEstimate: Math.round(avg(withEstimates.map(i => i.estimate!)) * 10) / 10,
    totalEstimated: withEstimates.reduce((sum, i) => sum + (i.estimate || 0), 0),
    totalCompleted: completed.reduce((sum, i) => sum + (i.estimate || 0), 0),
  };
}

// Main calculator
export function calculateLinearMetrics(
  issues: LinearIssue[],
  options: { since?: string; until?: string } = {}
): LinearMetrics {
  const since = options.since || '';
  const until = options.until || format(new Date(), 'yyyy-MM-dd');

  if (!issues.length) {
    return {
      available: true,
      reason: 'No issues found in the specified period',
      issuesAnalyzed: 0,
      period: { since, until },
      cycleTime: null,
      leadTime: null,
      wip: { current: 0, byAssignee: {}, byPriority: {} },
      throughput: null,
      cycleCompletion: null,
      estimateAccuracy: null,
    };
  }

  const periodWeeks = since ? differenceInWeeks(parseISO(until), parseISO(since)) : 12;

  return {
    available: true,
    issuesAnalyzed: issues.length,
    period: { since, until },
    cycleTime: calculateCycleTime(issues),
    leadTime: calculateLeadTime(issues),
    wip: calculateWIP(issues),
    throughput: calculateThroughput(issues, periodWeeks),
    cycleCompletion: calculateCycleCompletion(issues),
    estimateAccuracy: calculateEstimateAccuracy(issues),
  };
}
