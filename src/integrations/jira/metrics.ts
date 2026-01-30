// ============================================
// Jira Metrics Calculator
// ============================================

import {
  JiraIssue, JiraMetrics, CycleTimeMetrics, LeadTimeMetrics,
  WIPMetrics, BlockedTimeMetrics, ThroughputMetrics, BugRatioMetrics,
  JiraStatusMapping, DEFAULT_STATUS_MAPPING,
} from './types';
import { format, differenceInDays, differenceInWeeks, parseISO } from 'date-fns';
import { median, percentile, avg, getWeekKey } from '../../utils/metrics-calculations';

// Status helpers
function isInProgressStatus(status: string, mapping: JiraStatusMapping): boolean {
  return mapping.inProgress.some(s => s.toLowerCase() === status.toLowerCase());
}

function isDoneStatus(status: string, mapping: JiraStatusMapping): boolean {
  return mapping.done.some(s => s.toLowerCase() === status.toLowerCase());
}

function isBlockedStatus(status: string, mapping: JiraStatusMapping): boolean {
  return mapping.blocked.some(s => s.toLowerCase() === status.toLowerCase());
}

// Changelog analysis
function getFirstInProgressDate(issue: JiraIssue, mapping: JiraStatusMapping): Date | null {
  const histories = issue.changelog?.histories || [];
  for (const history of histories) {
    for (const item of history.items) {
      if (item.field === 'status' && item.toString && isInProgressStatus(item.toString, mapping)) {
        return parseISO(history.created);
      }
    }
  }
  return null;
}

function getDoneDate(issue: JiraIssue, mapping: JiraStatusMapping): Date | null {
  if (issue.fields.resolutiondate) {
    return parseISO(issue.fields.resolutiondate);
  }
  const histories = issue.changelog?.histories || [];
  for (let i = histories.length - 1; i >= 0; i--) {
    for (const item of histories[i].items) {
      if (item.field === 'status' && item.toString && isDoneStatus(item.toString, mapping)) {
        return parseISO(histories[i].created);
      }
    }
  }
  return null;
}

function getBlockedTime(issue: JiraIssue, mapping: JiraStatusMapping): number {
  const histories = issue.changelog?.histories || [];
  let totalBlockedDays = 0;
  let blockedStart: Date | null = null;

  const sorted = [...histories].sort((a, b) => 
    new Date(a.created).getTime() - new Date(b.created).getTime()
  );

  for (const history of sorted) {
    for (const item of history.items) {
      if (item.field === 'status') {
        if (item.toString && isBlockedStatus(item.toString, mapping)) {
          blockedStart = parseISO(history.created);
        } else if (blockedStart) {
          totalBlockedDays += differenceInDays(parseISO(history.created), blockedStart);
          blockedStart = null;
        }
      }
    }
  }

  if (blockedStart) {
    totalBlockedDays += differenceInDays(new Date(), blockedStart);
  }

  return totalBlockedDays;
}

// Metric calculators
function calculateCycleTime(issues: JiraIssue[], mapping: JiraStatusMapping): CycleTimeMetrics | null {
  const times: Array<{ days: number; type: string }> = [];

  for (const issue of issues) {
    const startDate = getFirstInProgressDate(issue, mapping);
    const doneDate = getDoneDate(issue, mapping);

    if (startDate && doneDate && doneDate > startDate) {
      times.push({ days: differenceInDays(doneDate, startDate), type: issue.fields.issuetype.name });
    }
  }

  if (!times.length) return null;

  const allDays = times.map(t => t.days);
  const byType: Record<string, number[]> = {};
  for (const t of times) {
    if (!byType[t.type]) byType[t.type] = [];
    byType[t.type].push(t.days);
  }

  return {
    avgDays: Math.round(avg(allDays) * 10) / 10,
    medianDays: Math.round(median(allDays) * 10) / 10,
    minDays: Math.min(...allDays),
    maxDays: Math.max(...allDays),
    p90Days: Math.round(percentile(allDays, 90) * 10) / 10,
    count: times.length,
    byIssueType: Object.fromEntries(
      Object.entries(byType).map(([type, days]) => [type, Math.round(avg(days) * 10) / 10])
    ),
  };
}

function calculateLeadTime(issues: JiraIssue[], mapping: JiraStatusMapping): LeadTimeMetrics | null {
  const times: Array<{ days: number; type: string }> = [];

  for (const issue of issues) {
    const createdDate = parseISO(issue.fields.created);
    const doneDate = getDoneDate(issue, mapping);

    if (doneDate) {
      times.push({ days: differenceInDays(doneDate, createdDate), type: issue.fields.issuetype.name });
    }
  }

  if (!times.length) return null;

  const allDays = times.map(t => t.days);
  const byType: Record<string, number[]> = {};
  for (const t of times) {
    if (!byType[t.type]) byType[t.type] = [];
    byType[t.type].push(t.days);
  }

  return {
    avgDays: Math.round(avg(allDays) * 10) / 10,
    medianDays: Math.round(median(allDays) * 10) / 10,
    minDays: Math.min(...allDays),
    maxDays: Math.max(...allDays),
    p90Days: Math.round(percentile(allDays, 90) * 10) / 10,
    count: times.length,
    byIssueType: Object.fromEntries(
      Object.entries(byType).map(([type, days]) => [type, Math.round(avg(days) * 10) / 10])
    ),
  };
}

function calculateWIP(issues: JiraIssue[], mapping: JiraStatusMapping): WIPMetrics {
  const inProgress = issues.filter(issue => isInProgressStatus(issue.fields.status.name, mapping));
  const byAssignee: Record<string, number> = {};
  const byIssueType: Record<string, number> = {};

  for (const issue of inProgress) {
    const assignee = issue.fields.assignee?.displayName || 'Unassigned';
    const type = issue.fields.issuetype.name;
    byAssignee[assignee] = (byAssignee[assignee] || 0) + 1;
    byIssueType[type] = (byIssueType[type] || 0) + 1;
  }

  return { current: inProgress.length, byAssignee, byIssueType };
}

function calculateBlockedTime(issues: JiraIssue[], mapping: JiraStatusMapping): BlockedTimeMetrics {
  const blockedTimes: number[] = [];

  for (const issue of issues) {
    const blocked = getBlockedTime(issue, mapping);
    if (blocked > 0) blockedTimes.push(blocked);
  }

  return {
    avgDays: blockedTimes.length ? Math.round(avg(blockedTimes) * 10) / 10 : 0,
    totalBlockedIssues: blockedTimes.length,
    percentageBlocked: issues.length ? Math.round((blockedTimes.length / issues.length) * 100) : 0,
  };
}

function calculateThroughput(issues: JiraIssue[], mapping: JiraStatusMapping, periodWeeks: number): ThroughputMetrics | null {
  const completed = issues.filter(issue => isDoneStatus(issue.fields.status.name, mapping));
  if (!completed.length) return null;

  const byWeek: Record<string, number> = {};
  const byAssignee: Record<string, number> = {};
  const byIssueType: Record<string, number> = {};

  for (const issue of completed) {
    const doneDate = getDoneDate(issue, mapping);
    if (doneDate) {
      const weekKey = getWeekKey(doneDate);
      byWeek[weekKey] = (byWeek[weekKey] || 0) + 1;
    }

    const assignee = issue.fields.assignee?.displayName || 'Unassigned';
    byAssignee[assignee] = (byAssignee[assignee] || 0) + 1;

    const type = issue.fields.issuetype.name;
    byIssueType[type] = (byIssueType[type] || 0) + 1;
  }

  const sortedWeeks = Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));

  return {
    total: completed.length,
    perWeek: periodWeeks > 0 ? Math.round((completed.length / periodWeeks) * 10) / 10 : completed.length,
    byWeek: sortedWeeks,
    byAssignee,
    byIssueType,
  };
}

function calculateBugRatio(issues: JiraIssue[], mapping: JiraStatusMapping): BugRatioMetrics {
  const bugs = issues.filter(issue => issue.fields.issuetype.name.toLowerCase() === 'bug');
  const bugsByPriority: Record<string, number> = {};
  const resolutionTimes: number[] = [];

  for (const bug of bugs) {
    const priority = bug.fields.priority?.name || 'None';
    bugsByPriority[priority] = (bugsByPriority[priority] || 0) + 1;

    if (isDoneStatus(bug.fields.status.name, mapping)) {
      const doneDate = getDoneDate(bug, mapping);
      if (doneDate) {
        const created = parseISO(bug.fields.created);
        resolutionTimes.push(differenceInDays(doneDate, created));
      }
    }
  }

  return {
    totalIssues: issues.length,
    totalBugs: bugs.length,
    ratio: issues.length ? Math.round((bugs.length / issues.length) * 100) / 100 : 0,
    bugsByPriority,
    bugResolutionTime: {
      avgDays: resolutionTimes.length ? Math.round(avg(resolutionTimes) * 10) / 10 : 0,
      medianDays: resolutionTimes.length ? Math.round(median(resolutionTimes) * 10) / 10 : 0,
    },
  };
}

// Main calculator
export function calculateJiraMetrics(
  issues: JiraIssue[],
  options: { since?: string; until?: string; statusMapping?: JiraStatusMapping } = {}
): JiraMetrics {
  const mapping = options.statusMapping || DEFAULT_STATUS_MAPPING;
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
      wip: { current: 0, byAssignee: {}, byIssueType: {} },
      blockedTime: { avgDays: 0, totalBlockedIssues: 0, percentageBlocked: 0 },
      throughput: null,
      bugRatio: { totalIssues: 0, totalBugs: 0, ratio: 0, bugsByPriority: {}, bugResolutionTime: { avgDays: 0, medianDays: 0 } },
    };
  }

  const periodWeeks = since ? differenceInWeeks(parseISO(until), parseISO(since)) : 12;

  return {
    available: true,
    issuesAnalyzed: issues.length,
    period: { since, until },
    cycleTime: calculateCycleTime(issues, mapping),
    leadTime: calculateLeadTime(issues, mapping),
    wip: calculateWIP(issues, mapping),
    blockedTime: calculateBlockedTime(issues, mapping),
    throughput: calculateThroughput(issues, mapping, periodWeeks),
    bugRatio: calculateBugRatio(issues, mapping),
  };
}
