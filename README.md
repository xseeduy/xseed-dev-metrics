# Xseed Developer Metrics CLI

```
    ██╗  ██╗███████╗███████╗███████╗██████╗ 
    ╚██╗██╔╝██╔════╝██╔════╝██╔════╝██╔══██╗
     ╚███╔╝ ███████╗█████╗  █████╗  ██║  ██║
     ██╔██╗ ╚════██║██╔══╝  ██╔══╝  ██║  ██║
    ██╔╝ ██╗███████║███████╗███████╗██████╔╝
    ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═════╝ 
```

Track developer productivity metrics across **Git**, **Jira**, **Linear**, and **Notion**.

## 🚀 Quick Start

### Installation

```bash
# Clone or extract the project
cd xseed-dev-metrics

# Install dependencies
npm install

# Build
npm run build

# Link globally
npm link

# Verify installation
gdm --version
```

### Windows Installation

**Requirements:**
- **Git for Windows** (includes Git Bash) - [Download here](https://git-scm.com/download/win)
- Node.js 18+ - [Download here](https://nodejs.org/)

**Installation Steps:**

1. Install Git for Windows (if not already installed)
2. Open **Git Bash** (not Command Prompt or PowerShell)
3. Follow the standard installation steps above

**Important Notes:**
- Always use **Git Bash** terminal when running `gdm` commands on Windows
- Alternatively, use **WSL (Windows Subsystem for Linux)** for native Linux compatibility
- The scheduler daemon uses node-cron (cross-platform) instead of system cron

**Troubleshooting:**
- If you see "command not found", ensure Git for Windows is installed and you're using Git Bash
- If Git commands fail, verify Git is in your PATH: `git --version`
- For scheduler issues, ensure the daemon process has permission to run in the background

### First-Time Setup

Run the interactive setup wizard:

```bash
gdm init
```

This will guide you through:
1. **Git Configuration** - Your username, email, and main branch
2. **Repository** - Path to the repository to track
3. **Jira Integration** (Optional) - Connect to Atlassian Jira
4. **Linear Integration** (Optional) - Connect to Linear
5. **Notion Integration** (Optional) - Upload metrics to Notion
6. **Scheduler** - Enable weekly automatic collection

### Non-Interactive Setup

For CI/CD or scripted environments:

```bash
# Using command line options
gdm init --username "John Doe" --email "john@company.com" --branch main --repo /path/to/repo

# Using environment variables
export GDM_GIT_USERNAME="John Doe"
export GDM_GIT_EMAIL="john@company.com"
export GDM_MAIN_BRANCH="main"
export JIRA_URL="https://company.atlassian.net"
export JIRA_EMAIL="john@company.com"
export JIRA_TOKEN="your_api_token"
export LINEAR_API_KEY="lin_api_xxxxx"
export NOTION_API_KEY="secret_xxxxx"
export NOTION_PARENT_PAGE_ID="page_id_xxxxx"
export NOTION_CLIENT_NAME="Acme Corp"
export NOTION_AUTO_UPLOAD="true"
```

## 📊 Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `gdm init` | Interactive setup wizard (add/update client) |
| `gdm collect` | Collect metrics from repositories |
| `gdm show` | View collected historical metrics |
| `gdm status` | Show configuration status |
| `gdm daemon start` | Enable automatic weekly collection |
| `gdm clean` | Delete configuration and/or data |

### Client Management Commands

| Command | Description |
|---------|-------------|
| `gdm client` | List all configured clients |
| `gdm client:switch <name>` | Switch active client |
| `gdm client:remove <name>` | Remove a client |

## 👥 Managing Multiple Clients

The CLI supports managing multiple clients (organizations/projects) with separate configurations, repositories, and data.

### Adding a New Client

Run `gdm init` to create or update a client:

```bash
gdm init
```

If a client with that name already exists, you'll be asked if you want to reconfigure it or create a new client.

### Switching Between Clients

Set which client is active (used for collect, status, etc.):

```bash
gdm client:switch CLIENT_B
```

### Listing All Clients

View all configured clients and their status:

```bash
gdm client
```

Output example:
```
★ CLIENT_A (active)
    Repositories: 3
    Git: ✓ john.doe
    Integrations: Git, Jira, Notion
    
  CLIENT_B
    Repositories: 1
    Git: ✓ jane.smith
    Integrations: Git, Linear
```

### Collecting for a Specific Client

By default, `gdm collect` uses the active client. To collect for a different client:

```bash
gdm collect --client CLIENT_B
```

### Repository Ownership

When you run `gdm collect` in an unconfigured repository, you'll be prompted:

```
Repository not configured: /path/to/repo
? Add to client 'CLIENT_A'? [Y/n]
```

Repositories can belong to multiple clients if needed (useful for shared libraries).

**What `gdm collect` does:** pulls the latest from the repo, gathers Git metrics (commits, lines, activity, trends) for the configured user, optionally Jira metrics, and saves a snapshot to `~/.xseed-metrics/data/`. By default it collects **from 90 days ago until today**. You can change the range:

```bash
gdm collect                    # Last 90 days (default)
gdm collect -t                 # All time (--total)
gdm collect --since=2024-01-01 # From a start date until today
gdm collect -s 2024-01-01 -u 2024-12-31  # Custom range (--since / --until)
```

**Collect per user (separate files):** use `--usernames` to collect metrics for specific authors or all authors. Each user gets a separate JSON file (e.g. `repo_John_Doe_2024-01-15.json`).

```bash
gdm collect --usernames="John Doe,Jane Doe"           # Specific users
gdm collect --usernames=ALL                           # All authors in the repo
gdm collect --usernames="John Doe,Jane Doe" --since=2024-01-01  # With date range
```

### Git Analysis

| Command | Description |
|---------|-------------|
| `gdm summary [path]` | Repository summary statistics |
| `gdm authors [path]` | Per-author statistics |
| `gdm commits [path]` | List commits with statistics |
| `gdm activity [path]` | Activity patterns (by hour, day) |
| `gdm files [path]` | Most frequently changed files |
| `gdm trends [path]` | Activity trends over time |
| `gdm blame [path]` | Code ownership statistics |
| `gdm types [path]` | Statistics by file type |
| `gdm report [path]` | Comprehensive report |

### Integrations

| Command | Description |
|---------|-------------|
| `gdm jira -p PROJECT` | Jira project metrics |
| `gdm linear -t TEAM` | Linear team metrics |
| `gdm config --test` | Test integration connections |

## ⏰ Automatic Collection

The daemon runs in the background and automatically:
1. Pulls the latest from the main branch
2. Collects Git metrics for the configured user
3. Optionally fetches Jira/Linear metrics
4. Saves data for historical tracking
5. Uploads to Notion (if configured with `autoUploadOnSchedule`)

```bash
# Start automatic collection (weekly on Monday at 9am)
gdm daemon start

# Check scheduler status
gdm daemon status

# View logs
gdm daemon logs

# Stop scheduler
gdm daemon stop

# Run collection immediately
gdm daemon run
```

## 🔧 Configuration

Configuration is stored in `~/.xseed-metrics/config.json`:

```json
{
  "version": "2.0.0",
  "initialized": true,
  "activeClient": "CLIENT_A",
  "clients": {
    "CLIENT_A": {
      "git": {
        "username": "John Doe",
        "email": "john@company.com",
        "mainBranch": "main"
      },
      "repositories": ["/path/to/repo1"],
      "jira": {
        "url": "https://company.atlassian.net",
        "email": "john@company.com",
        "token": "your_api_token"
      },
      "notion": {
        "enabled": true,
        "apiKey": "secret_xxxxx",
        "parentPageId": "page_id_xxxxx",
        "clientName": "Acme Corp",
        "autoUploadOnSchedule": true
      },
      "scheduler": {
        "enabled": true,
        "interval": "weekly",
        "dayOfWeek": 1,
        "time": "09:00"
      }
    },
    "CLIENT_B": {
      "git": {
        "username": "Jane Smith",
        "email": "jane@example.com",
        "mainBranch": "main"
      },
      "repositories": ["/path/to/repo2"],
      "linear": {
        "apiKey": "lin_api_xxxxx"
      }
    }
  }
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GDM_GIT_USERNAME` | Git username for filtering |
| `GDM_GIT_EMAIL` | Git email for filtering |
| `GDM_MAIN_BRANCH` | Default branch (main/master) |
| `JIRA_URL` | Jira instance URL |
| `JIRA_EMAIL` | Jira account email |
| `JIRA_TOKEN` | Jira API token |
| `LINEAR_API_KEY` | Linear API key |
| `NOTION_API_KEY` | Notion integration token |
| `NOTION_PARENT_PAGE_ID` | Notion parent page ID |
| `NOTION_CLIENT_NAME` | Client/organization name (optional) |
| `NOTION_AUTO_UPLOAD` | Auto-upload on scheduled runs (true/false) |

## 📈 Metrics Collected

### Git Metrics
- Commits count and frequency
- Lines added/deleted
- Files changed
- Activity patterns (by hour, day of week)
- Weekly/monthly trends
- Code ownership (blame analysis)

### Jira Metrics (Optional)
- **Cycle Time** - Time from "In Progress" to "Done"
- **Lead Time** - Time from "Created" to "Done"
- **WIP** - Work in Progress count
- **Throughput** - Issues completed per week
- **Bug Ratio** - Percentage of bug issues
- **Blocked Time** - Time spent in blocked status

### Linear Metrics (Optional)
- Cycle Time
- Lead Time
- WIP by assignee and priority
- Throughput per cycle
- Cycle completion rates
- Estimate accuracy

## 📝 Notion Integration

Upload your collected metrics to Notion for easy tracking and visualization. The integration automatically organizes data in a hierarchical structure:

```
Git Metrics (root page)
└── ClientName (e.g. "Acme Corp" or repo name)
    └── git username (e.g. "John Doe")
        └── 2025-01-29 (one page per collection date)
            └── JSON metrics (formatted code block)
```

### Setup

1. **Create Notion Integration**
   - Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
   - Click "New integration"
   - Copy the "Internal Integration Secret"

2. **Share a Page**
   - Create or open a page in Notion (e.g., "My Workspace")
   - Click "Share" → "Invite" → Add your integration
   - Copy the page ID from the URL (`notion.so/workspace/PAGE_ID`)

3. **Configure in GDM**
   ```bash
   gdm init  # Select "Configure Notion integration" during setup
   ```
   
   Or manually add to `~/.xseed-metrics/config.json`:
   ```json
   "notion": {
     "enabled": true,
     "apiKey": "secret_xxxxx",
     "parentPageId": "page_id_xxxxx",
     "clientName": "Acme Corp",
     "autoUploadOnSchedule": true
   }
   ```

### Usage

**Interactive Upload:**
```bash
gdm collect
# After collection, you'll be prompted: "Upload to Notion? [Y/n]"
```

**Force Upload:**
```bash
gdm collect --upload
```

**Skip Upload:**
```bash
gdm collect --no-upload
```

**Automatic Upload (Scheduled):**
When `autoUploadOnSchedule: true`, the weekly cron job automatically uploads without prompting.

## 📁 Data Storage

Collected metrics are stored per-client in `~/.xseed-metrics/`:

```
~/.xseed-metrics/
├── config.json          # Multi-client configuration
├── data/
│   ├── CLIENT_A/
│   │   ├── repo-name_2025-01-29.json
│   │   ├── repo-name_2025-01-22.json
│   │   └── ...
│   └── CLIENT_B/
│       ├── repo-name_2025-01-30.json
│       └── ...
└── logs/
    ├── CLIENT_A/
    │   └── daemon.log
    └── CLIENT_B/
        └── daemon.log
```

Each client has its own isolated data and logs directories.

### Selective Cleaning

The `gdm clean` command supports selective cleaning of specific resources:

#### Clean Data Only

Remove collected metrics while keeping configuration:

```bash
gdm clean --data                      # Clean active client's data
gdm clean --data --client CLIENT_A    # Clean specific client's data
```

#### Clean Logs Only

Remove log files:

```bash
gdm clean --logs                      # Clean active client's logs
gdm clean --logs --client CLIENT_B    # Clean specific client's logs
```

#### Clean Configuration Only

Remove client configuration (keeps data and logs):

```bash
gdm clean --config                    # Remove active client config
gdm clean --config --client CLIENT_A  # Remove specific client config
```

#### Clean Everything

Remove all configuration, data, and logs:

```bash
gdm clean --all                       # Requires confirmation
gdm clean --all --yes                 # Skip confirmation
```

#### Combined Cleaning

Mix flags for custom cleanup:

```bash
gdm clean --data --logs               # Clean data and logs for active client
gdm clean --data --config --client CLIENT_A  # Remove CLIENT_A entirely
```

#### Removing a Client

To completely remove a client and all its data:

```bash
gdm client:remove CLIENT_A            # Removes config only (prompts for confirmation)
gdm clean --config --data --logs --client CLIENT_A  # Removes everything
```

⚠️ **Warning**: Cleaning operations are permanent and cannot be undone. The command will prompt for confirmation unless `--yes` is used.

## 🔄 Workflow Example

```bash
# 1. Initial setup
gdm init

# 2. Collect metrics now
gdm collect

# 3. View your stats
gdm show

# 4. Generate a report
gdm report -f markdown -o weekly-report.md

# 5. Enable weekly auto-collection
gdm daemon start

# 6. Check scheduler status
gdm daemon status
```

## 📋 Output Formats

All commands support multiple output formats:

```bash
# Table (default, for terminal)
gdm authors

# JSON (for processing)
gdm authors -f json

# CSV (for spreadsheets)
gdm authors -f csv -o authors.csv

# Markdown (for documentation)
gdm report -f markdown -o report.md
```

## 🏢 For Staff Augmentation

This tool is designed for staff augmentation companies to:

1. **Track individual developer contributions** across client repositories
2. **Measure productivity metrics** aligned with SPACE framework
3. **Generate weekly/monthly reports** for clients
4. **Correlate Git activity with Jira/Linear issues**
5. **Automate metric collection** for multiple developers

## 🪟 Windows Compatibility

This CLI is **fully compatible with Windows** when using Git Bash or WSL:

**What's Different on Windows:**
- Uses **node-cron** for scheduling instead of system crontab
- Scheduler runs as a Node.js daemon process (cross-platform)
- All Git operations use pure Git commands with JavaScript parsing
- No reliance on Unix utilities (awk, sed, grep, etc.)

**System Requirements:**
- Git for Windows (includes Git Bash)
- Node.js 18+
- Windows 10/11 or Windows Server 2019+

**Tested on:**
- ✅ Windows 10/11 with Git Bash
- ✅ Windows Subsystem for Linux (WSL)
- ✅ Linux (Ubuntu, Debian, Fedora)
- ✅ macOS (Intel & Apple Silicon)

## License

MIT - Xseed Solutions
