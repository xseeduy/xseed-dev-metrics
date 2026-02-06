# Branch Tracking - Quick Reference

A quick reference guide for the most common branch tracking commands.

---

## Essential Commands

### 1. List Unmerged Branches

```bash
# Local branches not merged to main
git branch --no-merged main

# Remote branches not merged to main
git branch -r --no-merged main

# All branches (local + remote)
git branch -a --no-merged main
```

### 2. See Commits in Branch Not in Main

```bash
# Show commits
git log main..feature-branch

# One-line format
git log --oneline main..feature-branch

# Count commits
git rev-list --count main..feature-branch
```

### 3. Compare Two Branches

```bash
# See differences (main vs feature)
git log --oneline --left-right main...feature-branch

# Show statistics (lines changed)
git diff --stat main...feature-branch

# Show file names only
git diff --name-only main...feature-branch
```

### 4. Branch Activity & Age

```bash
# Show all branches with last commit date
git for-each-ref --sort=-committerdate refs/remotes/ \
  --format='%(committerdate:short) %(refname:short) - %(authorname)'

# Show last commit on a branch
git log branch-name -1 --format="%ar - %an - %s"

# Find when branch was created (merge base)
git merge-base main feature-branch
```

### 5. See Who's Working on a Branch

```bash
# List all authors
git log main..feature-branch --format="%an" | sort | uniq

# Count commits per author
git shortlog -sn main..feature-branch

# Detailed view
git shortlog main..feature-branch
```

### 6. Files Changed in Branch

```bash
# List all files changed
git diff --name-only main...feature-branch

# With statistics
git diff --stat main...feature-branch

# Count of file changes
git log main..feature-branch --name-only --format= | sort | uniq -c | sort -rn
```

---

## Using the Branch Tracker Script

We've included a handy script in `scripts/check-branch-work.sh` that automates branch analysis:

### Basic Usage

```bash
# Check all unmerged branches
./scripts/check-branch-work.sh

# Check specific branch
./scripts/check-branch-work.sh -b develop

# Check with detailed stats
./scripts/check-branch-work.sh -b feature/new-ui -s -d -f
```

### Options

| Option | Description |
|--------|-------------|
| `-b, --branch <name>` | Check specific branch |
| `-m, --main <name>` | Main branch to compare (default: main) |
| `-s, --stats` | Show detailed statistics |
| `-d, --details` | Show commit details |
| `-f, --files` | Show changed files |
| `-h, --help` | Show help message |

### Examples

```bash
# Quick check of all unmerged work
./scripts/check-branch-work.sh

# Detailed analysis of develop branch
./scripts/check-branch-work.sh -b develop -s -d -f

# Check feature branch against develop
./scripts/check-branch-work.sh -b feature/auth -m develop -s
```

---

## Useful Git Aliases

Add these to your `~/.gitconfig`:

```ini
[alias]
  # Show branches not merged to main
  unmerged = "!git branch -r --no-merged main | grep -v 'HEAD\\|main\\|master'"
  
  # Show commits in current branch not in main
  new = "!git log --oneline main..HEAD"
  
  # Count commits ahead of main
  ahead = "!git rev-list --count main..HEAD"
  
  # Show all branches with dates
  branches = "!git for-each-ref --sort=-committerdate refs/remotes/ \
    --format='%(committerdate:short)|%(refname:short)|%(authorname)' | column -t -s '|'"
  
  # Show stale branches (>60 days inactive)
  stale = "!git for-each-ref --sort=-committerdate refs/remotes/ \
    --format='%(committerdate:relative)|%(refname:short)' | \
    grep -E '([2-9][0-9]|[1-9][0-9]{2,}) (days|weeks|months)' | column -t -s '|'"
```

Then use them like:

```bash
git unmerged          # List unmerged branches
git new               # Show your new commits
git ahead             # Count commits ahead
git branches          # See all branches with dates
git stale             # Find stale branches
```

---

## Common Workflows

### Daily Team Standup

```bash
# See what everyone is working on
git for-each-ref refs/remotes/ --no-merged=main \
  --format='%(authorname): %(refname:short) - %(subject) (%(committerdate:relative))' | \
  sort
```

### Before Merging a Branch

```bash
# Check what's different
git log --oneline main..feature-branch
git diff --stat main...feature-branch

# See who reviewed
git shortlog -sn main..feature-branch
```

### Finding Stale Work

```bash
# Branches with no activity for 30+ days
git for-each-ref --sort=-committerdate refs/remotes/ \
  --format='%(committerdate:short) %(refname:short)' | \
  awk -v date="$(date -d '30 days ago' +%Y-%m-%d 2>/dev/null || date -v-30d +%Y-%m-%d)" '$1 < date'
```

### Weekly Branch Review

```bash
# Run the tracker script
./scripts/check-branch-work.sh -s -d

# Or manually check each unmerged branch
for branch in $(git branch -r --no-merged main); do
  echo "=== $branch ==="
  git log --oneline main..$branch | wc -l
  git log $branch -1 --format="Last: %ar by %an"
  echo ""
done
```

---

## Integration with Your CLI Tool

Your `xseed-dev-metrics` CLI could be enhanced with branch tracking:

### Proposed Commands

```bash
# List branch statistics
gdm branches                    # All branches
gdm branches --unmerged         # Only unmerged
gdm branches --stale --days 30  # Stale branches

# Compare branches
gdm branch-compare develop      # Compare develop to main
gdm branch-compare feat1 feat2  # Compare two branches

# Branch activity report
gdm branch-activity develop     # Activity for one branch
gdm branch-activity --all       # All unmerged branches

# Collect metrics for specific branch
gdm collect --branch develop    # Already supported!
```

---

## Real Example from Your Repository

```bash
# Check what's in main but not in develop
git log origin/develop..main --oneline

# Output (as of Feb 2, 2026):
# 3c13670 Add Git Mailmap support
# 116694d Refactor author filtering (email priority)
# 7c015a5 Enhance README for output formats
# dbb14d9 Update default metrics period to 7 days
# 599e43d Update CLI references to 'gdm'
# 293a0a9 Add client addition process
# fd03e84 Refactor configuration handling
# 07e1ef0 Implement multi-client support

# Statistics
git diff --stat origin/develop...main
# Result: 22 files changed, 2318 insertions(+), 756 deletions(-)
```

---

## Tips & Best Practices

1. **Fetch regularly**: Run `git fetch --all` before checking branches
2. **Use three-dot syntax** (`...`) for diffs to see changes from common ancestor
3. **Use two-dot syntax** (`..`) for logs to see commits in range
4. **Set up tracking**: `git push -u origin branch-name` for new branches
5. **Clean up merged branches**: `git branch --merged main | xargs git branch -d`
6. **Automate reports**: Set up weekly cron jobs to email branch status
7. **Use the script**: The `check-branch-work.sh` script automates most common tasks

---

## Need More Details?

For comprehensive documentation, see:
- **Full Guide**: `docs/branch-tracking-guide.md`
- **Your Script**: `scripts/check-branch-work.sh --help`
- **Git Docs**: https://git-scm.com/docs/git-log

---

*Last updated: February 2, 2026*
