# Slack Notifications Implementation

## Overview

The CLI now sends Slack DM notifications to engineers after metric collection completes. Notifications are sent automatically to each engineer's Slack user ID configured during the init wizard.

## Features

✅ **Hardcoded Bot Token** - No setup required, works out of the box  
✅ **Per-User DMs** - Each engineer receives individual notifications  
✅ **Success Messages** - Summary of collected metrics, duration, client  
✅ **Error Messages** - Details about failures with retry suggestions  
✅ **Best-Effort** - Notifications don't block or fail the collect command  

## Configuration

### 1. Hardcoded Slack Bot Token

**File**: `src/config/constants.ts`

```typescript
export const SLACK = {
  BOT_TOKEN: 'xoxb-137754316583-10428499602439-2u08psbvvpCvCa3ARLvNwOS1',
} as const;
```

The token is automatically used by `getSlackConfig()` in `src/config/integrations.ts`.

### 2. Engineer Slack User IDs

During `gdm init`, engineers are discovered from git history and the wizard prompts for each engineer's Slack user ID:

```bash
$ gdm init

# ... other setup steps ...

For each engineer, enter their Slack User ID:
💡 To get a Slack User ID: Click their profile → ⋮ (More) → Copy member ID
Format: U12345 or @username (will be converted to user ID)

adrian@xseed.com (Adrian Halaburda): U01ABC123
```

**Slack user IDs are optional** - engineers can press Enter to skip.

### 3. Stored Configuration

Engineer Slack IDs are stored in `~/.config/gdm/config.json`:

```json
{
  "clients": {
    "XSEED": {
      "engineers": [
        {
          "email": "adrian@xseed.com",
          "fullName": "Adrian Halaburda",
          "gitUsername": "adrian",
          "slackUser": "U01ABC123"
        }
      ]
    }
  }
}
```

## Notification Flow

### Success Notification

Sent when `gdm collect` completes successfully:

```
✅ Metrics Collection Complete

Client: XSEED
Duration: 45s
Trigger: Scheduled

📊 Summary:
  • 3 repositories processed
  • 5 users collected
  • Uploaded to Supabase

Collected at: 2026-02-16T09:00:00Z
```

### Error Notification

Sent when collection fails:

```
⚠️ Metrics Collection Failed

Client: XSEED
Phase: Repository processing
Trigger: Manual

❌ Error:
Failed to connect to repository: /path/to/repo
Repository not accessible or not a git directory

Repository: `/path/to/repo`

💡 Suggestion:
Run `gdm collect` manually to retry or check repository permissions.
```

## Implementation Details

### Modified Files

1. **`src/config/constants.ts`**
   - Added `SLACK` constant with hardcoded bot token

2. **`src/config/integrations.ts`**
   - Updated `getSlackConfig()` to return hardcoded token
   - Imported `SLACK` from constants

3. **`src/notifications/slack.ts`**
   - Added `CollectionSummary` and `CollectionError` interfaces
   - Added `sendSuccessNotification()` method
   - Added `sendErrorNotification()` method
   - Both methods use Slack's `chat.postMessage` API

4. **`src/commands/collect.ts`**
   - Replaced channel-based notification with per-user DM logic
   - Iterates through `config.engineers` and sends to each `slackUser`
   - Handles both success and error scenarios
   - Best-effort: failures don't block collection

5. **`src/commands/init.ts`**
   - Enhanced Slack user ID prompt with better guidance
   - Made Slack user ID optional (can skip)
   - Added instructions on how to get user IDs

6. **`src/notifications/index.ts`**
   - Exported new types: `CollectionSummary`, `CollectionError`

## Usage

### Manual Collection
```bash
gdm collect
# Sends Slack DMs to all configured engineers
```

### Scheduled Collection
```bash
gdm daemon start
# Automatic collections will send notifications with trigger: 'scheduled'
```

## Bot Requirements

The Slack bot needs these OAuth scopes:
- `chat:write` - To send messages to users
- `users:read` - To lookup user information (optional)

## Security Notes

⚠️ **Important**: The bot token is hardcoded in the repository.

- Keep the `xseed-dev-metrics` repository **private**
- Do not publish to public npm registry
- If token is compromised, regenerate in Slack App settings

## Testing

To test notifications manually:

```typescript
import { SlackNotifier } from './src/notifications/slack';
import { SLACK } from './src/config/constants';

const notifier = new SlackNotifier({ botToken: SLACK.BOT_TOKEN });

// Test success notification
await notifier.sendSuccessNotification('U01ABC123', {
  clientName: 'TEST',
  reposProcessed: 1,
  usersCollected: 1,
  durationMs: 5000,
  uploadedToSupabase: true,
  trigger: 'manual',
  timestamp: new Date().toISOString(),
});

// Test error notification
await notifier.sendErrorNotification('U01ABC123', {
  clientName: 'TEST',
  phase: 'Test phase',
  error: 'Test error message',
  trigger: 'manual',
});
```

## Troubleshooting

### Notifications not received?

1. **Check Slack user ID format**: Should be `U12345`, not `@username`
2. **Verify bot is installed**: Bot must be installed in your Slack workspace
3. **Check bot permissions**: Ensure bot has `chat:write` scope
4. **Test bot token**: Run `gdm init` and test connection

### Engineer not getting notifications?

- Verify their `slackUser` is configured in `~/.config/gdm/config.json`
- Re-run `gdm init` to update Slack user IDs
- Check Slack app has permission to DM the user

### Format timestamp for readability?

The timestamp is in ISO 8601 format. To make it more readable, you can format it with `date-fns`:

```typescript
import { format } from 'date-fns';
timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
```
