# Code Documentation

This document describes the documentation standards and conventions used in the codebase.

## JSDoc Documentation

The entire codebase is documented using **JSDoc** comments. JSDoc provides inline documentation that can be used by IDEs for IntelliSense and can be extracted to generate API documentation.

### Documentation Coverage

All of the following are documented with JSDoc:

- **Classes**: All classes have class-level documentation explaining their purpose and usage
- **Methods**: All public methods include:
  - Description of what the method does
  - `@param` tags for all parameters
  - `@returns` tags for return values
  - `@throws` tags for exceptions
  - `@example` blocks for complex APIs
- **Functions**: All exported functions are documented similarly to methods
- **Interfaces**: All interfaces and their properties are documented
- **Types**: Type aliases and enums include descriptions
- **Constants**: Important constants are documented with their purpose

### JSDoc Style Guide

#### Basic Structure

```typescript
/**
 * Brief one-line description.
 * 
 * More detailed explanation if needed, which can span
 * multiple lines.
 * 
 * @param paramName - Description of the parameter
 * @param optionalParam - Optional parameter description
 * @returns Description of what is returned
 * @throws {ErrorType} When this error occurs
 * @example
 * ```typescript
 * const result = myFunction('example');
 * console.log(result);
 * ```
 */
```

#### Classes

```typescript
/**
 * Brief description of the class.
 * More detailed explanation of what the class does.
 * 
 * @example
 * ```typescript
 * const metrics = new GitMetrics('/path/to/repo');
 * const summary = metrics.getRepoSummary();
 * ```
 */
export class GitMetrics {
  /**
   * Creates a new GitMetrics instance.
   * 
   * @param repoPath - Path to the git repository
   * @throws {Error} If the path is not a valid git repository
   */
  constructor(repoPath: string) {
    // ...
  }
}
```

#### Interfaces

```typescript
/**
 * Statistics for a single author/developer in a repository.
 * Includes commit counts, lines of code, and activity patterns.
 */
export interface AuthorStats {
  /** Full name of the author */
  name: string;
  /** Email address of the author */
  email: string;
  /** Total number of commits */
  commits: number;
}
```

#### Functions

```typescript
/**
 * Parses a date string in ISO format or relative format.
 * Supports relative dates like "today", "yesterday", "2 weeks ago".
 * 
 * @param dateStr - Date string to parse
 * @returns Parsed Date object
 * @example
 * ```typescript
 * parseDate('2024-01-01')    // ISO format
 * parseDate('today')         // Relative
 * parseDate('2 weeks ago')   // Relative
 * ```
 */
export function parseDate(dateStr: string): Date {
  // ...
}
```

#### Private Functions

Mark private/internal functions with `@private`:

```typescript
/**
 * Internal helper function.
 * 
 * @param value - Input value
 * @returns Processed value
 * @private
 */
function internalHelper(value: string): string {
  // ...
}
```

## Key Documentation Locations

### Core Files

- **`src/types.ts`**: All type definitions and interfaces are fully documented
- **`src/core/git-metrics.ts`**: The GitMetrics class and all its methods
- **`src/branding.ts`**: Branding utilities and print functions

### Configuration

- **`src/config/integrations.ts`**: Configuration management interfaces and functions

### Integrations

- **`src/integrations/jira/client.ts`**: Jira API client
- **`src/integrations/linear/client.ts`**: Linear API client
- **`src/integrations/notion/client.ts`**: Notion API client

### Commands

- **`src/commands/init.ts`**: Interactive setup wizard
- **`src/commands/collect.ts`**: Metrics collection command
- **`src/commands/daemon.ts`**: Scheduler daemon

### Utilities

- **`src/utils/date-utils.ts`**: Date parsing and formatting utilities
- **`src/scheduler/cron-manager.ts`**: Cross-platform scheduler

## IDE Support

Modern IDEs like VS Code, WebStorm, and others will automatically show JSDoc documentation:

- **Hover**: Hover over any function, class, or type to see its documentation
- **IntelliSense**: JSDoc provides better autocomplete suggestions
- **Parameter Hints**: See parameter descriptions while typing function calls
- **Type Information**: JSDoc enhances TypeScript's type information

## Generating Documentation

While the project doesn't currently generate HTML documentation, the JSDoc comments can be used to generate documentation using tools like:

- **TypeDoc**: `npm install --save-dev typedoc`
- **JSDoc**: `npm install --save-dev jsdoc`

To generate documentation with TypeDoc:

```bash
npx typedoc --out docs/api src/index.ts
```

## Best Practices

1. **Keep it Concise**: Be clear and brief in descriptions
2. **Use Examples**: Add examples for complex APIs
3. **Document Edge Cases**: Mention special behaviors or edge cases
4. **Update with Code**: Keep documentation in sync with code changes
5. **Link Related Items**: Use `@see` to reference related functions or types
6. **Explain Why**: Document not just what the code does, but why it does it
7. **Type Safety**: Leverage TypeScript types in conjunction with JSDoc

## Contributing

When adding new code:

1. Add JSDoc comments to all public APIs
2. Follow the existing documentation style
3. Include examples for non-trivial functions
4. Document all parameters and return values
5. Mark private functions with `@private`
6. Add `@throws` tags for functions that can throw errors
