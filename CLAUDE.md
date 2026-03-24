# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Run directly with ts-node (no build needed)
npm run build        # Compile TypeScript to dist/

# Testing
npm test             # Run all tests (vitest)
npm run test:watch   # Watch mode
npm run test:coverage # With coverage

# Linting
npm run lint         # ESLint on src/**/*.ts

# CLI (after build or via ts-node)
npm run dev -- <command>   # e.g., npm run dev -- authors --help
```

## Architecture

This is a CLI tool (`metrix` / `xseed-metrics` binary) for tracking developer productivity metrics across Git, Jira, and Linear. Data is stored locally at `~/.xseed-metrics/`.

### Layer Model

```
CLI Entry (src/index.ts via Commander.js)
    ↓
Commands (src/commands/*.ts)          ← one file per command group
    ↓
Core / Integrations
    ├── src/core/git-metrics.ts       ← GitMetrics class, all git analysis
    ├── src/integrations/jira/        ← REST client + pure metric calculations
    ├── src/integrations/linear/      ← GraphQL client + pure metric calculations
    └── src/integrations/supabase/    ← optional data upload
    ↓
Output (src/output/formatters.ts)     ← table | json | csv | markdown
```

### Key Concepts

**Multi-client config** — `~/.xseed-metrics/config.json` holds an `activeClient` key and a `clients` map. Each client has its own git repos, Jira/Linear credentials, and isolated data/log directories. Commands in `src/commands/client.ts` and `src/config/integrations.ts` manage this.

**collect workflow** — `src/commands/collect.ts` is the central command: pulls repos, runs `GitMetrics`, calls Jira/Linear clients, writes JSON snapshots to `~/.xseed-metrics/data/{CLIENT}/`, and optionally uploads to Supabase.

**Integration pattern** — each integration under `src/integrations/{name}/` follows the same three-file layout:
- `types.ts` — API response types and metric result types
- `client.ts` — HTTP/GraphQL client with retry logic
- `metrics.ts` — pure functions that compute metrics from raw API data

**Daemon** — `src/scheduler/cron-manager.ts` installs a system cron job that runs `metrix collect --all --quiet`. Managed via `metrix daemon start|stop|status`.

### Configuration & Constants

`src/config/constants.ts` holds hardcoded Supabase and Slack credentials (intentional for internal tool use), git buffer sizes (100 MB for large repos), retry config, and SPACE framework thresholds.

`src/types.ts` is the single source of truth for core interfaces (`AuthorStats`, `CommitInfo`, `FilterOptions`, `MetricsConfig`, etc.).
