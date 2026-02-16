# Slack User ID Validation - Testing Guide

## Overview

The Slack user ID validation feature has been implemented. This guide explains how to test it manually.

## Implementation Summary

### Files Modified

1. **`src/notifications/slack.ts`**
   - Added `validateAndSendWelcome()` method
   - Calls `users.info` API to verify user exists
   - Sends welcome DM with setup information
   - Returns validation result with display name

2. **`src/utils/validation.ts`**
   - Added `validateSlackUserId()` format validator
   - Checks format: U + 8-11 alphanumeric characters
   - Removes @ prefix if present

3. **`src/commands/init.ts`**
   - Updated Slack user ID collection loop
   - Added format validation before API call
   - Added API validation with welcome message
   - Improved retry and skip logic

## Testing Scenarios

### Manual Testing During `gdm init`

#### Test 1: Valid User ID
```bash
$ gdm init

# When prompted for Slack user ID:
adrian@xseed.com (Adrian): U01ABC123

Expected:
✓ Validated! Welcome message sent to adrian
```

**Verify:**
- User receives welcome DM in Slack
- No error messages shown
- User ID saved in config

#### Test 2: Invalid Format
```bash
$ gdm init

# When prompted:
adrian@xseed.com (Adrian): INVALID123

Expected:
❌ User ID must be in format U12345678 (starts with U followed by 8-11 characters)
Please try again or press Enter to skip
```

**Verify:**
- Format error shown immediately
- Prompt asks again
- No API call made

#### Test 3: Non-existent User ID
```bash
$ gdm init

# When prompted:
adrian@xseed.com (Adrian): U99ZZZZZZZ

Expected:
Validating user ID and sending welcome message...
❌ Invalid user ID: User ID not found in workspace. Check the ID and try again.
Please try again or press Enter to skip
```

**Verify:**
- API call made (brief delay)
- User-friendly error message
- Allows retry

#### Test 4: Skip User ID
```bash
$ gdm init

# When prompted:
adrian@xseed.com (Adrian): [Press Enter]

Expected:
⚠ Slack user ID is optional but recommended for notifications.
? Skip this engineer? (Y/n): y
```

**Verify:**
- Warning shown
- Confirmation prompt
- No user ID saved for that engineer

#### Test 5: Bot User ID
```bash
$ gdm init

# When prompted:
adrian@xseed.com (Adrian): USLACKBOT

Expected:
Validating user ID and sending welcome message...
❌ Invalid user ID: Cannot send DM to bot users. Please enter a real user ID.
```

**Verify:**
- Bot rejection message
- Allows retry

## Welcome Message Content

When validation succeeds, the user receives:

```
👋 Welcome to xseed-dev-metrics!

You've been added to receive automatic notifications when developer metrics are collected.

You'll get updates about:
• Successful metric collections (with summary)
• Any errors during collection
• Collection duration and results

Client: [CLIENT_NAME]
Your profile: [FULL_NAME]

Email: [EMAIL] | This is a one-time setup message. Future notifications will arrive after each collection run.
```

## API Calls Made

### 1. users.info
```
GET https://slack.com/api/users.info?user=U01ABC123
Authorization: Bearer xoxb-...
```

**Response (success):**
```json
{
  "ok": true,
  "user": {
    "id": "U01ABC123",
    "name": "adrian",
    "real_name": "Adrian Halaburda",
    "profile": {
      "display_name": "adrian"
    }
  }
}
```

**Response (error):**
```json
{
  "ok": false,
  "error": "user_not_found"
}
```

### 2. chat.postMessage
```
POST https://slack.com/api/chat.postMessage
Authorization: Bearer xoxb-...
Content-Type: application/json

{
  "channel": "U01ABC123",
  "text": "👋 Welcome to xseed-dev-metrics!",
  "blocks": [...]
}
```

## Error Handling

### Format Errors (No API Call)
- Missing user ID
- Wrong prefix (not starting with U)
- Wrong length
- Invalid characters

### API Errors (After API Call)
- `user_not_found` → "User ID not found in workspace"
- `invalid_auth` → "Bot token is invalid. Contact administrator"
- `account_inactive` → "This user account is deactivated"
- `missing_scope` → "Bot needs users:read permission"
- `cannot_dm_bot` → "Cannot send DM to bot users"
- `user_is_restricted` → "Bot doesn't have permission to message this user"

## Configuration Result

After successful validation, the config file contains:

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

Note: The user ID is stored WITHOUT the @ prefix.

## Retry Logic

- **Format validation**: Immediate feedback, no delay
- **API validation**: Shows "Validating..." message, then result
- **Unlimited retries**: User can try as many times as needed
- **Skip option**: Press Enter → confirmation prompt → skip

## Required Bot Scopes

The Slack bot must have:
- ✅ `chat:write` - To send welcome message (already configured)
- ⚠️ `users:read` - To call users.info API (should be added to bot)

If `users:read` is missing, the API will return `missing_scope` error.

## Testing Checklist

- [ ] Test with valid user ID - receives welcome DM
- [ ] Test with invalid format - shows format error
- [ ] Test with non-existent ID - shows not found error
- [ ] Test skip functionality - no ID saved
- [ ] Test with @ prefix - strips and validates
- [ ] Test retry after error - allows re-entry
- [ ] Verify config file has correct format
- [ ] Verify welcome message content
- [ ] Test multiple engineers in sequence
- [ ] Test bot user ID - shows bot error

## Build Verification

```bash
cd /Users/adrian/Dev/xseed/xseed-dev-metrics
npm run build
```

Expected: Build succeeds with no errors

## Next Steps

To test in a real environment:

1. Ensure Slack bot has required scopes
2. Run `gdm init` or `gdm init --force`
3. Follow prompts and test various scenarios
4. Check Slack for welcome messages
5. Verify config file at `~/.config/gdm/config.json`
