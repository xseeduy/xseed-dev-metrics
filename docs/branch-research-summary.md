# Branch Tracking Research - Summary & Implementation

## Research Objective

Understand how to check commits in branches that haven't been merged to main/master, particularly for tracking ongoing work that may span days or months.

## What I've Created for You

### 1. Comprehensive Guide
**File**: `docs/branch-tracking-guide.md`

A detailed 500+ line guide covering:
- ✅ Basic git commands for viewing unmerged commits
- ✅ Identifying unmerged branches
- ✅ Detailed branch comparison techniques
- ✅ Branch age and activity analysis
- ✅ Statistical analysis of branch work
- ✅ Multi-branch comparison strategies
- ✅ Practical use cases for team visibility
- ✅ Git aliases for quick access
- ✅ Best practices and automation ideas

### 2. Quick Reference Card
**File**: `docs/branch-tracking-quickref.md`

A condensed reference with:
- Essential commands you'll use daily
- Usage examples from your actual repository
- How to use the branch tracker script
- Common workflows (standup, merging, reviews)
- Integration ideas for your CLI tool

### 3. Automated Script
**File**: `scripts/check-branch-work.sh`

An executable bash script that:
- ✅ Finds all unmerged branches automatically
- ✅ Shows commits ahead of main
- ✅ Lists authors working on each branch
- ✅ Displays last activity date
- ✅ Shows statistics and file changes (optional)
- ✅ Works with any branch or all branches
- ✅ Colorized output for easy reading

---

## Key Findings from Research

### Core Git Commands

1. **See commits in branch not in main**:
   ```bash
   git log main..feature-branch
   ```

2. **List unmerged branches**:
   ```bash
   git branch --no-merged main
   ```

3. **Count commits ahead**:
   ```bash
   git rev-list --count main..feature-branch
   ```

4. **Show branch age and activity**:
   ```bash
   git for-each-ref --sort=-committerdate refs/remotes/ \
     --format='%(committerdate:short) %(refname:short) - %(authorname)'
   ```

5. **See who's working on a branch**:
   ```bash
   git shortlog -sn main..feature-branch
   ```

### Your Current Repository Status

Based on analysis of your repo:

- **Main branch**: `main` (most recent)
- **Develop branch**: `origin/develop` (8 commits behind)
- **Commits in main not in develop**: 8 commits
- **Changes**: 22 files changed, +2,318 -756 lines

Recent work in main includes:
- Git Mailmap support
- Author filtering refactor
- Multi-client support
- Configuration handling improvements

---

## How to Use the Tools

### Quick Daily Check

```bash
# See all unmerged work across all branches
./scripts/check-branch-work.sh

# Check specific branch with details
./scripts/check-branch-work.sh -b develop -s -d -f
```

### Manual Commands

```bash
# Update remote refs
git fetch --all

# List unmerged branches
git branch -r --no-merged main

# Check what's in develop not in main
git log main..origin/develop

# Check what's in main not in develop
git log origin/develop..main

# See file changes
git diff --stat main...origin/develop

# See who's working on develop
git shortlog -sn main..origin/develop
```

### Using Git Aliases

Add to `~/.gitconfig`:

```ini
[alias]
  unmerged = "!git branch -r --no-merged main | grep -v 'HEAD\\|main\\|master'"
  new = "!git log --oneline main..HEAD"
  ahead = "!git rev-list --count main..HEAD"
  branches = "!git for-each-ref --sort=-committerdate refs/remotes/ \
    --format='%(committerdate:short)|%(refname:short)|%(authorname)' | column -t -s '|'"
```

Then use:
```bash
git unmerged    # Quick list of unmerged branches
git new         # Your commits not in main
git ahead       # Count of commits ahead
git branches    # All branches with dates
```

---

## Integration with Your CLI Tool

Your `xseed-dev-metrics` tool already has the foundation. Consider adding:

### New Commands

```bash
# Branch listing with metrics
gdm branches [--unmerged] [--stale] [--days <n>]

# Branch comparison
gdm branch-compare <branch1> [branch2]

# Branch activity report
gdm branch-activity <branch> [--format csv|json|table]
```

### Existing Command Enhancement

Your tool already supports:
```bash
gdm collect --branch develop  # Collect metrics for specific branch
```

You could enhance this to:
- Automatically detect unmerged branches
- Include branch status in reports
- Add branch-specific metrics to CSV/JSON output

### Data Structure Extension

Add to your types (`src/types.ts`):

```typescript
export interface BranchStats {
  name: string;
  commitsAhead: number;
  commitsBehind: number;
  lastActivity: Date;
  authors: string[];
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  isMerged: boolean;
  daysSinceCreation: number;
  daysSinceLastCommit: number;
}

export interface BranchComparison {
  sourceBranch: string;
  targetBranch: string;
  uniqueCommits: CommitInfo[];
  authors: AuthorStats[];
  files: FileStats[];
  mergeBase: string;
}
```

---

## Practical Workflows

### 1. Daily Team Standup

```bash
# Quick overview of all ongoing work
./scripts/check-branch-work.sh

# Or with git command
git for-each-ref refs/remotes/ --no-merged=main \
  --format='%(authorname): %(refname:short) (%(committerdate:relative))'
```

### 2. Weekly Branch Review

```bash
# Detailed review with stats
./scripts/check-branch-work.sh -s -d

# Find stale branches
git for-each-ref --sort=-committerdate refs/remotes/ \
  --no-merged=main \
  --format='%(committerdate:short) %(refname:short)' | \
  awk -v date="$(date -d '30 days ago' +%Y-%m-%d 2>/dev/null || date -v-30d +%Y-%m-%d)" '$1 < date'
```

### 3. Before Merging

```bash
# Check what will be merged
git log --oneline main..feature-branch
git diff --stat main...feature-branch
git shortlog -sn main..feature-branch

# Or use the script
./scripts/check-branch-work.sh -b feature-branch -s -d -f
```

### 4. Sprint Planning

```bash
# See all unmerged work by author
for branch in $(git branch -r --no-merged main); do
  echo "=== $branch ==="
  git shortlog -sn main..$branch
  echo ""
done
```

---

## Best Practices

Based on research and industry standards:

1. **Fetch Regularly**: Run `git fetch --all` before checking branches
2. **Short-Lived Branches**: Merge branches within 2-3 days when possible
3. **Daily Sync**: Keep feature branches updated with main
4. **Clear Naming**: Use prefixes like `feature/`, `bugfix/`, `hotfix/`
5. **Regular Reviews**: Weekly check for stale branches
6. **Automate Cleanup**: Delete merged branches automatically
7. **Document Long-Running**: Add notes for branches lasting >1 week
8. **Use Draft PRs**: Show work in progress without formal review

---

## Automation Ideas

### Cron Job for Daily Reports

```bash
# Add to crontab: Daily at 9 AM
0 9 * * 1-5 cd /path/to/repo && ./scripts/check-branch-work.sh -s | mail -s "Daily Branch Report" team@example.com
```

### Slack/Teams Integration

```bash
# Post to Slack webhook
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"'"$(./scripts/check-branch-work.sh)"'"}' \
  YOUR_SLACK_WEBHOOK_URL
```

### CI/CD Integration

```yaml
# GitHub Actions example
name: Branch Status Report
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM
jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Generate Report
        run: ./scripts/check-branch-work.sh -s -d
```

---

## Next Steps

### Immediate Actions

1. ✅ Review the comprehensive guide: `docs/branch-tracking-guide.md`
2. ✅ Try the script: `./scripts/check-branch-work.sh --help`
3. ✅ Test with your branches: `./scripts/check-branch-work.sh -b develop -s`
4. ✅ Add git aliases to your `~/.gitconfig`

### Short Term

1. Integrate branch tracking into your daily workflow
2. Set up weekly branch reviews with your team
3. Create cron job or reminder to check stale branches
4. Document your team's branch naming conventions

### Long Term

1. Add branch tracking commands to your CLI tool
2. Include branch metrics in your data collection
3. Build dashboard showing branch activity
4. Automate stale branch notifications
5. Integrate with your Jira/Linear workflow

---

## Resources Created

| File | Purpose | Lines |
|------|---------|-------|
| `docs/branch-tracking-guide.md` | Comprehensive guide | 500+ |
| `docs/branch-tracking-quickref.md` | Quick reference | 300+ |
| `scripts/check-branch-work.sh` | Automation script | 200+ |
| `docs/branch-research-summary.md` | This summary | 400+ |

**Total**: 1,400+ lines of documentation and tooling

---

## Questions Answered

✅ How to check commits in other branches?  
✅ How to see work that's been in progress for days/months?  
✅ How to identify which branches haven't been merged?  
✅ How to track who's working on what?  
✅ How to see branch age and activity?  
✅ How to compare branches?  
✅ How to automate branch tracking?  
✅ How to integrate with existing tools?  

---

## Example Output from Your Repo

When I analyzed your current branches:

```
Branch: origin/develop
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Commits behind main: 8
Last activity: 3 days ago
Last author: Adrian
Files changed: 22 files (+2,318 -756)

Recent work in main not in develop:
- Add Git Mailmap support
- Refactor author filtering (email priority)
- Enhance README for output formats
- Update default metrics period to 7 days
- Update CLI references to 'gdm'
- Add client addition process
- Refactor configuration handling
- Implement multi-client support
```

---

## Conclusion

You now have:

1. **Knowledge**: Comprehensive understanding of git branch tracking
2. **Tools**: Working script to automate branch analysis
3. **Documentation**: Quick reference for daily use
4. **Best Practices**: Industry-standard workflows
5. **Integration Path**: Clear path to enhance your CLI tool

The script and guides are ready to use immediately. Try running:

```bash
./scripts/check-branch-work.sh -b develop -s -d -f
```

This will give you a complete picture of what's happening in your develop branch!

---

*Research completed: February 2, 2026*
*Created by: Cursor AI Assistant*
