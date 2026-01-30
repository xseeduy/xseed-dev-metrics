# Notion Integration - Implementation Summary

## Overview

The Notion integration allows automatic upload of collected Git metrics to Notion, organizing them in a hierarchical page structure for easy tracking and visualization.

## Page Hierarchy

```
Git Metrics (root page)
└── ClientName (configurable, e.g., "Acme Corp" or defaults to repo name)
    └── git username (e.g., "John Doe")
        └── 2025-01-29 (one page per collection date)
            └── JSON metrics (formatted as code block)
```

## Files Created/Modified

### New Files

1. **`src/integrations/notion/client.ts`**
   - Main Notion client implementation
   - Methods:
     - `testConnection()` - Verify Notion API access
     - `ensureGitMetricsPage()` - Create/find "Git Metrics" root page
     - `ensureClientPage()` - Create/find client page
     - `ensureUserPage()` - Create/find user page
     - `createDatePage()` - Create date page with JSON content
     - `uploadCollectedFile()` - Full upload flow for one file
     - `uploadCollectedFiles()` - Batch upload multiple files

2. **`src/integrations/notion/index.ts`**
   - Exports for Notion client

3. **`src/integrations/notion/types.ts`**
   - TypeScript type definitions for Notion integration

### Modified Files

1. **`src/config/integrations.ts`**
   - Added `NotionConfig` interface
   - Added `notion` field to `IntegrationConfig`
   - Added `notion` status to `ConfigStatus`
   - Added `getNotionConfig()` helper
   - Added `setNotionConfig()` helper
   - Added environment variable support for Notion config

2. **`src/commands/collect.ts`**
   - Added `scheduled`, `upload`, `noUpload` options
   - Added upload logic after successful collection
   - Interactive prompt: "Upload to Notion? [Y/n]"
   - Automatic upload for scheduled runs (when `autoUploadOnSchedule` is true)
   - Reads collected files and uploads them with full metadata

3. **`src/index.ts`**
   - Added `--scheduled`, `--upload`, `--no-upload` flags to collect command
   - Added Notion to status command output

4. **`src/commands/daemon.ts`**
   - Updated cron command to include `--scheduled` flag
   - Ensures scheduled runs can auto-upload without prompting

5. **`src/commands/init.ts`**
   - Added Step 6: Notion Integration (Optional)
   - Prompts for:
     - Notion API Key
     - Parent Page ID
     - Client Name (optional)
     - Auto-upload on schedule (yes/no)
   - Tests connection during setup

6. **`src/commands/config.ts`**
   - Added Notion to configuration table
   - Added Notion connection test

7. **`package.json`**
   - Added `@notionhq/client` dependency

8. **`README.md`**
   - Updated to mention Notion integration
   - Added Notion setup instructions
   - Added Notion configuration examples
   - Added environment variables for Notion

## Configuration

### Config File (`~/.xseed-metrics/config.json`)

```json
{
  "notion": {
    "enabled": true,
    "apiKey": "secret_xxxxx",
    "parentPageId": "page_id_xxxxx",
    "clientName": "Acme Corp",
    "autoUploadOnSchedule": true
  }
}
```

### Environment Variables

- `NOTION_API_KEY` - Integration token
- `NOTION_PARENT_PAGE_ID` - Parent page ID
- `NOTION_CLIENT_NAME` - Client/organization name (optional)
- `NOTION_AUTO_UPLOAD` - Auto-upload on schedule (true/false)

## Usage

### Setup

1. Create integration at [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Share a page with the integration
3. Run `gdm init` and configure Notion when prompted

### Commands

```bash
# Interactive collection with prompt
gdm collect

# Force upload
gdm collect --upload

# Skip upload
gdm collect --no-upload

# Scheduled run (auto-upload if configured)
gdm collect --all --quiet --scheduled
```

### Workflow

1. **Interactive**: After `gdm collect`, user is prompted "Upload to Notion? [Y/n]"
2. **Scheduled**: When cron runs `gdm collect --all --quiet --scheduled`, uploads automatically if `autoUploadOnSchedule: true`
3. **Forced**: Use `--upload` to always upload, `--no-upload` to never upload

## Features

- **Hierarchical Organization**: Automatic page hierarchy creation
- **Caching**: Page IDs are cached to avoid duplicate searches
- **Error Handling**: Graceful failure if upload fails (doesn't break collection)
- **Rich Content**: Each date page includes:
  - Heading with repo name and period
  - Collection timestamp
  - User information
  - Full JSON metrics in formatted code block
- **Batch Upload**: Supports uploading multiple files in one operation

## Testing

To test the integration:

1. Set up Notion integration and config
2. Run `gdm config --test` to verify connection
3. Run `gdm collect` to collect and upload
4. Check Notion for the created pages

## Future Enhancements

Potential improvements for future versions:

- Database view with properties for filtering
- File attachments instead of code blocks for large payloads
- Configurable page templates
- Support for uploading to existing databases
- Bulk re-upload of historical data
