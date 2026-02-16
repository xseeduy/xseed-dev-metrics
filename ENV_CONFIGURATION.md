# Environment Variables Configuration

## Overview

The CLI supports loading sensitive credentials from a `.env` file instead of hardcoding them. This provides better security and flexibility for different environments.

## Setup

### 1. Create `.env` File

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

### 2. Configure Your Credentials

Edit `.env` with your actual values:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
```

### 3. Verify Setup

The CLI will automatically load these values when it runs. To verify:

```bash
gdm collect
# Should work without any additional configuration
```

## Environment Variables

### Required Variables

#### `SUPABASE_URL`
- **Description**: Your Supabase project URL
- **Format**: `https://your-project.supabase.co`
- **Where to find**: Supabase Dashboard → Settings → API
- **Example**: `https://eqtgrxfjhgmslpxgfwho.supabase.co`

#### `SUPABASE_SERVICE_ROLE_KEY`
- **Description**: Supabase service role key (admin access)
- **Format**: JWT token starting with `eyJ...`
- **Where to find**: Supabase Dashboard → Settings → API → service_role key
- **Security**: ⚠️ **Never commit this to git** - has full database access

#### `SLACK_BOT_TOKEN`
- **Description**: Slack bot token for sending notifications
- **Format**: Starts with `xoxb-`
- **Where to find**: Slack App Dashboard → OAuth & Permissions → Bot User OAuth Token
- **Required scopes**: `chat:write`, `users:read`
- **Example**: `xoxb-123456789-123456789-abcdefghijklmnop`

## Fallback Behavior

The CLI includes fallback values for convenience:

```typescript
// If .env doesn't exist or variable is missing,
// it will use the default internal credentials
SUPABASE_URL = process.env.SUPABASE_URL || 'default-url'
```

This means:
- ✅ Works out-of-the-box for internal teams (using shared credentials)
- ✅ Can be customized per environment (dev/staging/prod)
- ✅ Each developer can use their own tokens if needed

## Security Best Practices

### DO ✅

- Keep `.env` file in `.gitignore` (already configured)
- Use separate credentials for dev/staging/prod
- Rotate tokens regularly
- Store production secrets in a secure vault
- Share credentials via secure channels (1Password, LastPass, etc.)

### DON'T ❌

- Never commit `.env` to git
- Don't share tokens in plain text via email/Slack
- Don't use production tokens in development
- Don't log environment variables

## Team Setup

For internal teams using shared credentials:

1. **Option A: No `.env` file** (default)
   - Works out-of-the-box with built-in credentials
   - Easiest for quick setup

2. **Option B: Use `.env` file** (recommended)
   - Copy `.env.example` to `.env`
   - Get credentials from team lead
   - More secure, keeps secrets out of codebase

## Troubleshooting

### Variables Not Loading

**Problem**: CLI still uses old hardcoded values

**Solution**:
```bash
# Verify .env file exists
ls -la .env

# Check file contents
cat .env

# Rebuild the project
npm run build

# Try again
gdm collect
```

### Missing Variables

**Problem**: Error about missing credentials

**Solution**:
```bash
# Check which variables are set
node -e "require('dotenv').config(); console.log(process.env.SUPABASE_URL)"

# Verify .env file format (no spaces around =)
# Correct:   SUPABASE_URL=https://...
# Incorrect: SUPABASE_URL = https://...
```

### File Not Found

**Problem**: `.env` file not in the right location

**Solution**:
```bash
# .env should be in project root
cd /path/to/xseed-dev-metrics
ls -la .env  # Should show the file

# NOT in src/ or any subdirectory
```

## Development vs Production

### Development
```bash
# .env.development (create if needed)
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=dev-key-here
SLACK_BOT_TOKEN=xoxb-dev-token
```

### Production
```bash
# .env.production
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=prod-key-here
SLACK_BOT_TOKEN=xoxb-prod-token
```

Then use:
```bash
# Load specific environment
NODE_ENV=development gdm collect
NODE_ENV=production gdm collect
```

## CI/CD Integration

For automated deployments:

### GitHub Actions
```yaml
env:
  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
  SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

### Docker
```dockerfile
# Pass as build args
ARG SUPABASE_URL
ARG SUPABASE_SERVICE_ROLE_KEY
ARG SLACK_BOT_TOKEN

ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV SLACK_BOT_TOKEN=$SLACK_BOT_TOKEN
```

### Heroku
```bash
heroku config:set SUPABASE_URL=https://...
heroku config:set SUPABASE_SERVICE_ROLE_KEY=eyJ...
heroku config:set SLACK_BOT_TOKEN=xoxb-...
```

## Related Documentation

- [`.env.example`](.env.example) - Template with all variables
- [`SLACK_NOTIFICATIONS.md`](SLACK_NOTIFICATIONS.md) - Slack setup guide
- [Supabase Docs](https://supabase.com/docs) - Getting your credentials

## Questions?

If you need help:
1. Check `.env.example` for the correct format
2. Verify your credentials in the respective dashboards
3. Contact your team lead for shared credentials
