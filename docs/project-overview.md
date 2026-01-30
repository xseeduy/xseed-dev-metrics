# Project Overview

## What It Is

**Xseed Developer Metrics CLI** (branded as **gdm** / **xseed-metrics**) is a command-line tool that tracks developer productivity metrics across **Git**, **Jira**, and **Linear**. It is designed for staff augmentation companies and teams that need to measure and report on individual developer contributions and correlate them with issue-tracking data.

## Goals

1. **Track individual developer contributions** across one or more Git repositories.
2. **Measure productivity metrics** aligned with the SPACE framework (Satisfaction, Performance, Activity, Communication, Efficiency).
3. **Generate reports** (weekly/monthly) for clients or internal use.
4. **Correlate Git activity** with Jira and Linear issues (cycle time, lead time, throughput, WIP).
5. **Automate collection** via a background scheduler (daemon) so metrics are gathered without manual runs.
6. **Support multiple clients** with separate configurations, repositories, and data isolation.

## Audience

- **Staff augmentation companies** tracking developer output on client repos.
- **Engineering leads** who need Git + Jira/Linear dashboards and reports.
- **Developers** who want local Git analytics (authors, commits, trends, blame, file types).

## Scope

- **In scope**: Git analysis (commits, authors, files, trends, blame, activity), Jira/Linear integrations, config management, scheduled collection, multiple output formats (table, JSON, CSV, markdown).
- **Out of scope**: Real-time dashboards, web UI, non-Git VCS, other issue trackers unless added as new integrations.

## Configuration

- **Config file**: `~/.xseed-metrics/config.json` (multi-client structure, created/updated by `gdm init`).
- **Multi-client support**: Track multiple clients/organizations with separate configurations
  - Active client: One client active at a time
  - Per-client data: `~/.xseed-metrics/data/CLIENT_NAME/`
  - Per-client logs: `~/.xseed-metrics/logs/CLIENT_NAME/`
- **Client management**: Commands to list, switch, and remove clients (`gdm client`, `gdm client:switch`, `gdm client:remove`)
- **Environment variables** override file config: `GDM_GIT_USERNAME`, `GDM_GIT_EMAIL`, `GDM_MAIN_BRANCH`, `JIRA_*`, `LINEAR_API_KEY`.

## Commands Summary

| Category | Commands |
|----------|----------|
| Setup | `init`, `status`, `config` |
| Client Management | `client`, `client:switch`, `client:remove` |
| Collection | `collect`, `show`, `daemon`, `clean` |
| Git analysis | `summary`, `authors`, `commits`, `activity`, `files`, `trends`, `blame`, `types`, `report` |
| Integrations | `jira`, `linear` |

See the root [README.md](../README.md) for full command reference and examples.
