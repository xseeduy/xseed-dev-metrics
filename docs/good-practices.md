# Good Practices and Conventions

This document describes coding standards, conventions, and patterns that the project follows or should follow when adding or changing code.

## General

- **Language**: TypeScript; target ES2022 (see `tsconfig.json`). Use strict mode and avoid `any` where a proper type is reasonable.
- **Style**: Use consistent formatting. Consider ESLint/Prettier if not already configured; the project has `npm run lint` (ESLint for `src/**/*.ts`).
- **Comments**: Use brief section comments (e.g. `// ========== Section ==========`) for major blocks. Document non-obvious logic or business rules inline.
- **Documentation**: The codebase uses **JSDoc** comments for all public APIs, classes, interfaces, and functions. Follow the existing JSDoc patterns when adding new code:
  - Document all public functions, classes, and interfaces
  - Include `@param` tags for all parameters with types and descriptions
  - Include `@returns` tags for return values
  - Add `@example` blocks for complex APIs
  - Use `@throws` to document exceptions
  - Mark internal/private functions with `@private`
- **Imports**: Prefer explicit imports; group by: external packages, then internal modules (config, core, integrations, output, utils). Use path aliases only if defined in tsconfig.

## File and Module Layout

- **One main responsibility per file**: e.g. one command file per command or group (like `commands/index.ts` for Git analysis), one class per file in core/integrations.
- **Exports**: Prefer named exports for commands and utilities; use `index.ts` in integrations to re-export public API (types, client, metrics).
- **Naming**:
  - Files: `kebab-case.ts` (e.g. `date-utils.ts`, `git-metrics.ts`).
  - Commands: `commandNameCommand` for the handler (e.g. `authorsCommand`, `collectCommand`).
  - Classes: PascalCase (e.g. `GitMetrics`, `JiraClient`).
  - Functions/variables: camelCase. Constants that are config-like can be UPPER_SNAKE (e.g. `CONFIG_FILE`).

## CLI and Commands

- **Registration**: Define options and pass the handler in `src/index.ts`. Use `.option()`, `.argument()` consistently; document options in the description.
- **Handlers**: Command handlers are async where they do I/O or call integrations. Signature: `(pathOrOptions, options) => Promise<void>` or similar as used today.
- **Common options**: Use the shared `addCommonOptions()` (or equivalent) for Git commands so `--since`, `--until`, `--format`, `--output` behave the same everywhere.
- **Output**: Use chalk for color and emphasis; use ora for spinners during work. On success, print a short confirmation; on error, print a clear message and call `process.exit(1)`.
- **Help**: Keep command descriptions and the global help text in `index.ts` accurate so `gdm --help` and `gdm <command> --help` stay useful.

## Core (GitMetrics and Types)

- **Types**: Define all data shapes in `src/types.ts` (or integration-specific `types.ts`). Use interfaces for options and results (e.g. `FilterOptions`, `AuthorStats`, `RepoSummary`).
- **GitMetrics**: Keep it a pure “Git metrics” layer: input = repo path + `FilterOptions`; output = typed structures. No knowledge of Jira/Linear or CLI; no direct file write except via git.
- **Git execution**: Centralize git calls in `GitMetrics` (e.g. `exec()` helper). Use a reasonable `maxBuffer` for large repos; handle errors and invalid repo by throwing with a clear message.
- **Filtering**: Use `FilterOptions` (since, until, author, branch, includeMerges, paths) consistently; build `git log` args from it in one place (e.g. `buildLogArgs`).

## Config

- **Single source**: All config read/write goes through `src/config/integrations.ts`. Commands and integrations should use getters (`getConfig()`, `getJiraConfig()`, etc.) and setters (`saveConfig()`, etc.), not read `config.json` directly.
- **Env overrides**: Merge env with file config in one place; document env vars in README and docs.
- **Paths**: Use the exported path helpers (`getConfigDir()`, `getDataDir()`, `getLogsDir()`) so that paths are consistent and testable.

## Integrations (Jira, Linear, Future)

- **Structure per integration**: `client.ts` (HTTP, auth, retries), `metrics.ts` (pure computation from API data), `types.ts`, `index.ts`.
- **Client**: Accept config (e.g. `JiraConfig`) in the constructor; do not read config inside the client. Use retries for transient failures; fail fast on 401/403.
- **Metrics**: Keep metrics functions pure: input = raw API responses (or normalized DTOs); output = metric objects. No I/O inside metrics.
- **Errors**: Let the client throw or return a result type; commands should catch and show a user-friendly message (e.g. “Jira: Connection failed” or “Not configured”).

## Output and Formatting

- **Formatters**: In `src/output/formatters.ts`, each formatter takes data + format (table | json | csv | markdown) and returns a string. No side effects (no file write); the command writes to file when `--output` is set.
- **Consistency**: Support the same formats across comparable commands (e.g. table, json, csv, markdown for author stats, commits, etc.). Use the generic `formatOutput<T>` pattern where it reduces duplication.
- **Tables**: Use cli-table3 with consistent column widths and chalk for headers; keep tables readable in a normal terminal width.

## Errors and Exit Codes

- **User-facing errors**: Show a short, clear message (e.g. “Not a git repository”, “Jira not configured”). Use chalk.red or equivalent for errors.
- **Exit code**: Use `process.exit(1)` on failure so scripts can detect errors. Do not exit(0) after a handled error.
- **Validation**: Validate repo path, required options (e.g. `-p` for jira), and config (e.g. `isInitialized()`) before doing heavy work; fail fast with a clear message.

## Daemon and Scheduler

- **Cron**: Daemon “start” should only install a cron job; do not run a long-lived Node process. Cron command should run `gdm collect --all --quiet` and append to the log file.
- **PID file**: Use only to track “did we install cron?” or similar; document that there is no persistent daemon process.
- **Logs**: Write daemon-related messages (e.g. collect runs) to the configured log file; avoid logging secrets.

## Adding New Features

- **New command**: Add handler in `src/commands/` (new file or existing), register in `src/index.ts`, add help text. Follow existing patterns for options and output.
- **New integration**: Add `src/integrations/<name>/` with client, metrics, types, index; extend config and init if needed; add command and optionally report section. See [Architecture](architecture.md#integration-pattern).
- **New metric or format**: Extend types in `types.ts` (or integration types), add or extend formatter, wire in the command. Keep backward compatibility for config and output where possible.

## What to Avoid

- **Business logic in index.ts**: Keep the entry point to registration and delegation only.
- **Scattered config access**: Do not read `config.json` or env in multiple places; use `config/integrations.ts`.
- **Secrets in logs**: Do not log tokens, API keys, or full request/response bodies.
- **Silent failures**: Do not catch errors without at least logging or printing a message and exiting non-zero when appropriate.
- **Unbounded output**: For large repos, support `--limit` or similar where it makes sense (e.g. authors, commits) to avoid huge tables or JSON.

Following these practices keeps the codebase consistent, maintainable, and safe for production and scripting use.
