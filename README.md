# Xseed Developer Metrics CLI

```
    ██╗  ██╗███████╗███████╗███████╗██████╗ 
    ╚██╗██╔╝██╔════╝██╔════╝██╔════╝██╔══██╗
     ╚███╔╝ ███████╗█████╗  █████╗  ██║  ██║
     ██╔██╗ ╚════██║██╔══╝  ██╔══╝  ██║  ██║
    ██╔╝ ██╗███████║███████╗███████╗██████╔╝
    ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═════╝ 
```

Track developer productivity metrics across **Git**, **Jira** & **Linear**.

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
metrix --version
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
- Always use **Git Bash** terminal when running `metrix` commands on Windows
- Alternatively, use **WSL (Windows Subsystem for Linux)** for native Linux compatibility
- The scheduler daemon uses node-cron (cross-platform) instead of system cron

**Troubleshooting:**
- If you see "command not found", ensure Git for Windows is installed and you're using Git Bash
- If Git commands fail, verify Git is in your PATH: `git --version`
- For scheduler issues, ensure the daemon process has permission to run in the background

### First-Time Setup

Run the interactive setup wizard:

```bash
metrix init
```

This will guide you through:
1. **Git Configuration** - Your username, email, and main branch
2. **Repository** - Path to the repository to track
3. **Jira Integration** (Optional) - Connect to Atlassian Jira
4. **Linear Integration** (Optional) - Connect to Linear
5. **Scheduler** - Enable weekly automatic collection

### Non-Interactive Setup

For CI/CD or scripted environments:

```bash
# Using command line options
metrix init --username "John Doe" --email "john@company.com" --branch main --repo /path/to/repo

# Using environment variables
export GDM_GIT_USERNAME="John Doe"
export GDM_GIT_EMAIL="john@company.com"
export GDM_MAIN_BRANCH="main"
export JIRA_URL="https://company.atlassian.net"
export JIRA_EMAIL="john@company.com"
export JIRA_TOKEN="your_api_token"
export LINEAR_API_KEY="lin_api_xxxxx"
```

## 📊 Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `metrix init` | Interactive setup wizard (add/update client) |
| `metrix init --force` | Add a new client (when already configured) |
| `metrix collect` | Collect metrics from repositories (CSV format, last 7 days) |
| `metrix show` | View collected historical metrics |
| `metrix status` | Show configuration status |
| `metrix daemon start` | Enable automatic weekly collection |
| `metrix clean` | Delete configuration and/or data |

### Client Management Commands

| Command | Description |
|---------|-------------|
| `metrix client` | List all configured clients |
| `metrix client:switch <name>` | Switch active client |
| `metrix client:remove <name>` | Remove a client |

## 👥 Managing Multiple Clients

The CLI supports managing multiple clients (organizations/projects) with separate configurations, repositories, and data.

### Adding a New Client

**First time setup:**

```bash
metrix init
```

**Adding another client (when already configured):**

If you navigate to a different repository and want to add a new client, use the `--force` flag:

```bash
cd /path/to/different/repository
metrix init --force
```

The wizard will guide you through:
1. **Client Name** - Enter a NEW name (e.g., "GIVEFINITY" instead of "XSEED")
2. **Git Configuration** - Your Git username and email
3. **Repository** - The current directory will be detected
4. **Integrations** - Optional Jira, Linear setup

If a client with that name already exists, you'll be asked if you want to reconfigure it or create a new client.

### Switching Between Clients

Set which client is active (used for collect, status, etc.):

```bash
metrix client:switch CLIENT_B
```

### Listing All Clients

View all configured clients and their status:

```bash
metrix client
```

Output example:
```
★ CLIENT_A (active)
    Repositories: 3
    Git: ✓ john.doe
    Integrations: Git, Jira
    
  CLIENT_B
    Repositories: 1
    Git: ✓ jane.smith
    Integrations: Git, Linear
```

### Collecting for a Specific Client

By default, `metrix collect` uses the active client. To collect for a different client:

```bash
metrix collect --client CLIENT_B
```

### Repository Ownership

When you run `metrix collect` in an unconfigured repository, you'll be prompted:

```
Repository not configured: /path/to/repo
? Add to client 'CLIENT_A'? [Y/n]
```

Repositories can belong to multiple clients if needed (useful for shared libraries).

**What `metrix collect` does:** pulls the latest from the repo, gathers Git metrics (commits, lines, activity, trends) for the configured user, optionally Jira metrics, and saves a snapshot to `~/.xseed-metrics/data/`. By default it collects **from 7 days ago until today** (last week) and saves in **CSV format**. You can change the range and format:

```bash
metrix collect                    # Last 7 days, CSV format (default)
metrix collect --format json      # Output as JSON instead of CSV
metrix collect -t                 # All time (--total)
metrix collect --since="30 days ago" # Last 30 days
metrix collect --since=2024-01-01 # From a start date until today
metrix collect -s 2024-01-01 -u 2024-12-31  # Custom range (--since / --until)
```

**Output Formats:**
- **CSV** (default): Structured format with columns: `metric_type`, `metric_name`, `value`, `unit`, `details`. Perfect for Excel, Google Sheets, or data analysis tools.
- **JSON**: Full structured data, useful for programmatic access.

**Collect per user (separate files):** use `--usernames` to collect metrics for specific authors or all authors. Each user gets a separate file (e.g. `repo_John_Doe_2024-01-15.csv`).

```bash
metrix collect --usernames="John Doe,Jane Doe"           # Specific users
metrix collect --usernames=ALL                           # All authors in the repo
metrix collect --usernames="John Doe,Jane Doe" --since=2024-01-01  # With date range
```

### Git Analysis

| Command | Description |
|---------|-------------|
| `metrix summary [path]` | Repository summary statistics |
| `metrix authors [path]` | Per-author statistics |
| `metrix commits [path]` | List commits with statistics |
| `metrix activity [path]` | Activity patterns (by hour, day) |
| `metrix files [path]` | Most frequently changed files |
| `metrix trends [path]` | Activity trends over time |
| `metrix blame [path]` | Code ownership statistics |
| `metrix types [path]` | Statistics by file type |
| `metrix report [path]` | Comprehensive report |

### Integrations

| Command | Description |
|---------|-------------|
| `metrix jira -p PROJECT` | Jira project metrics |
| `metrix linear -t TEAM` | Linear team metrics |
| `metrix config --test` | Test integration connections |

## ⏰ Automatic Collection

The daemon runs in the background and automatically:
1. Pulls the latest from the main branch
2. Collects Git metrics for the configured user
3. Optionally fetches Jira/Linear metrics
4. Saves data for historical tracking

```bash
# Start automatic collection (weekly on Monday at 9am)
metrix daemon start

# Check scheduler status
metrix daemon status

# View logs
metrix daemon logs

# Stop scheduler
metrix daemon stop

# Run collection immediately
metrix daemon run
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

### Git Mailmap Support

Xseed Metrics automatically respects Git's `.mailmap` file to consolidate multiple email addresses into a single identity. This is useful when developers use different emails across commits.

**Example `.mailmap` file:**

```
# Consolidate personal and work emails
Adrian <ahalaburda@xseed.com.uy> Adrian <adh761@gmail.com>
John Doe <john@company.com> Jon Doe <john@company.com>
```

**Benefits:**
- ✅ Unified author statistics across all email addresses
- ✅ Accurate commit counts and line metrics
- ✅ Automatic consolidation in all reports
- ✅ Standard Git feature (works with all Git tools)

**Quick setup:**

```bash
# Create .mailmap in your repository root
cat > .mailmap << 'EOF'
Canonical Name <canonical@email.com> Commit Name <commit@email.com>
EOF

# Verify it works
git log --use-mailmap --format='%aN <%aE>' | sort -u
```

📖 **[Full Mailmap Guide](docs/mailmap-guide.md)** - Learn more about configuring and using mailmap

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

The `metrix clean` command supports selective cleaning of specific resources:

#### Clean Data Only

Remove collected metrics while keeping configuration:

```bash
metrix clean --data                      # Clean active client's data
metrix clean --data --client CLIENT_A    # Clean specific client's data
```

#### Clean Logs Only

Remove log files:

```bash
metrix clean --logs                      # Clean active client's logs
metrix clean --logs --client CLIENT_B    # Clean specific client's logs
```

#### Clean Configuration Only

Remove client configuration (keeps data and logs):

```bash
metrix clean --config                    # Remove active client config
metrix clean --config --client CLIENT_A  # Remove specific client config
```

#### Clean Everything

Remove all configuration, data, and logs:

```bash
metrix clean --all                       # Requires confirmation
metrix clean --all --yes                 # Skip confirmation
```

#### Combined Cleaning

Mix flags for custom cleanup:

```bash
metrix clean --data --logs               # Clean data and logs for active client
metrix clean --data --config --client CLIENT_A  # Remove CLIENT_A entirely
```

#### Removing a Client

To completely remove a client and all its data:

```bash
metrix client:remove CLIENT_A            # Removes config only (prompts for confirmation)
metrix clean --config --data --logs --client CLIENT_A  # Removes everything
```

⚠️ **Warning**: Cleaning operations are permanent and cannot be undone. The command will prompt for confirmation unless `--yes` is used.

## 🔄 Workflow Example

```bash
# 1. Initial setup
metrix init

# 2. Collect metrics now
metrix collect

# 3. View your stats
metrix show

# 4. Generate a report
metrix report -f markdown -o weekly-report.md

# 5. Enable weekly auto-collection
metrix daemon start

# 6. Check scheduler status
metrix daemon status
```

## 📋 Output Formats

All commands support multiple output formats:

```bash
# Table (default, for terminal)
metrix authors

# JSON (for processing)
metrix authors -f json

# CSV (for spreadsheets)
metrix authors -f csv -o authors.csv

# Markdown (for documentation)
metrix report -f markdown -o report.md
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
