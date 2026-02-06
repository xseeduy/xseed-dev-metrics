# Branch Tracking & Unmerged Commits Guide

## Overview

This guide covers how to track and analyze commits in branches that haven't been merged to main/master yet. This is essential for understanding ongoing work across your team, especially for long-lived feature branches.

---

## 1. Basic Commands: View Commits in Branch Not in Main

### Show commits in a branch that aren't in main

```bash
# Most common approach - two-dot syntax
git log main..feature-branch

# Alternative using caret (^) notation
git log --no-merges feature-branch ^main

# Using --not syntax
git log feature-branch --not main

# One-line format for quick overview
git log --oneline main..feature-branch

# With graph visualization
git log --oneline --graph --decorate main..feature-branch
```

### For current branch (if you're already on it)

```bash
# Compare current branch with its upstream (e.g., origin/main)
git log @{u}..HEAD

# More verbose
git log --oneline --decorate --graph origin/main..HEAD
```

### Count commits without listing them

```bash
# Just get the number
git rev-list --count main..feature-branch

# For current branch vs upstream
git rev-list --count @{u}..HEAD
```

---

## 2. Identifying Unmerged Branches

### List all branches that haven't been merged to main

```bash
# Local branches not merged to main
git branch --no-merged main

# Include remote branches
git branch -a --no-merged main

# All branches not merged to current branch
git branch --no-merged
```

### Show branches that HAVE been merged (for cleanup)

```bash
# Local branches already merged
git branch --merged main

# Remote branches already merged
git branch -r --merged main
```

---

## 3. Detailed Branch Comparison

### Show detailed commit info between branches

```bash
# Full commit details (hash, author, date, message)
git log main..feature-branch --pretty=format:"%h - %an, %ar : %s"

# With stats (lines changed per commit)
git log main..feature-branch --stat

# With patch/diff for each commit
git log main..feature-branch -p

# Show only merge commits
git log main..feature-branch --merges

# Show non-merge commits only
git log main..feature-branch --no-merges
```

### See what commits are unique to each branch

```bash
# See commits in both directions
git log --left-right --oneline main...feature-branch

# Output shows:
# < commits only in main
# > commits only in feature-branch
```

### Cherry-pick style view (which commits differ)

```bash
# Show commits not yet merged from feature-branch to main
git cherry -v main feature-branch

# Output format: 
# + commit-hash commit-message  (not merged)
# - commit-hash commit-message  (already merged)
```

---

## 4. Branch Age & Activity Analysis

### Find when a branch was created

```bash
# Show first commit in branch (divergence point)
git log main..feature-branch --oneline | tail -1

# More detailed: find merge base (common ancestor)
git merge-base main feature-branch

# Show the merge base commit details
git show $(git merge-base main feature-branch)

# Calculate days since branch creation
git log $(git merge-base main feature-branch)..feature-branch --oneline | wc -l
```

### Show branch activity timeline

```bash
# Commits by date in branch
git log main..feature-branch --pretty=format:"%h %ad %s" --date=short

# Group by author
git shortlog main..feature-branch

# Show last commit date on branch
git log feature-branch -1 --format="%ar - %ad" --date=short
```

### Check all remote branches and their ages

```bash
# Update remote tracking branches first
git fetch --all

# Show all branches with last commit date
git for-each-ref --sort=-committerdate refs/remotes/ \
  --format='%(committerdate:short) %(refname:short) - %(authorname)'

# Show only unmerged branches with dates
git for-each-ref --sort=-committerdate refs/remotes/ \
  --no-merged=main \
  --format='%(committerdate:short) %(refname:short) - %(authorname) - %(subject)'
```

---

## 5. Statistical Analysis of Branch Work

### Total lines changed in branch

```bash
# Lines added/deleted in branch vs main
git diff --stat main...feature-branch

# More detailed with file-by-file breakdown
git diff --numstat main...feature-branch

# Total insertions and deletions
git diff --shortstat main...feature-branch
```

### Authors working on branch

```bash
# List all authors who committed to branch
git log main..feature-branch --format="%an" | sort | uniq

# With commit counts per author
git shortlog -sn main..feature-branch

# Detailed contributions per author
git log main..feature-branch --pretty=format:"%an" | \
  sort | uniq -c | sort -rn
```

### Files changed in branch

```bash
# List all files changed
git diff --name-only main...feature-branch

# With change statistics
git diff --stat main...feature-branch

# Files with number of changes
git log main..feature-branch --name-only --pretty=format: | \
  sort | uniq -c | sort -rn
```

---

## 6. Advanced: Multi-Branch Comparison

### Compare multiple feature branches

```bash
# See what's in feature-A but not in feature-B
git log feature-B..feature-A

# See unique commits in each of 3 branches
git log --oneline --graph main feature-A feature-B

# Find branches containing a specific commit
git branch --contains <commit-hash>
```

### Find stale branches (no activity for X days)

```bash
# Branches with no commits in last 30 days
git for-each-ref --sort=-committerdate refs/heads/ \
  --format='%(committerdate:iso) %(refname:short)' | \
  awk -v date="$(date -d '30 days ago' +%Y-%m-%d)" '$1 < date'

# Remote branches inactive for 60 days
git for-each-ref --sort=-committerdate refs/remotes/ \
  --format='%(committerdate:relative) %(refname:short)' | \
  grep -E '\b([2-9][0-9]|[1-9][0-9]{2,}) (days|weeks|months) ago'
```

---

## 7. Practical Use Cases for Team Visibility

### Daily standup: What's each person working on?

```bash
# Show all unmerged branches with last commit by author
git for-each-ref refs/remotes/ --no-merged=main \
  --format='%(authorname): %(refname:short) - %(subject) (%(committerdate:relative))' | \
  sort
```

### Weekly review: Long-running branches

```bash
# Branches older than 1 week not merged to main
git for-each-ref refs/remotes/ --no-merged=main \
  --format='%(committerdate:short) %(refname:short) - %(authorname)' | \
  awk -v date="$(date -d '7 days ago' +%Y-%m-%d)" '$1 < date'
```

### Sprint planning: What's in progress?

```bash
# For each unmerged branch, show commit count and authors
for branch in $(git branch -r --no-merged main); do
  echo "=== $branch ==="
  git log --oneline main..$branch | wc -l
  git shortlog -sn main..$branch
  echo ""
done
```

### Code review prep: What changed in PR branch?

```bash
# Summary of changes
git diff --stat main...feature-branch

# List of commits with descriptions
git log main..feature-branch --oneline

# Full diff for review
git diff main...feature-branch > review.patch
```

---

## 8. Integration with Your Metrics Tool

### Potential New Commands

Your CLI tool could add these commands:

#### `gdm branches` - List branch statistics

```bash
gdm branches --unmerged  # Show unmerged branches
gdm branches --stale     # Show branches with no activity > 30 days
gdm branches --author <name>  # Branches by specific author
```

#### `gdm branch-compare` - Compare branches

```bash
gdm branch-compare feature-branch  # Compare to main
gdm branch-compare branch-A branch-B  # Compare two branches
```

#### `gdm branch-activity` - Branch activity report

```bash
gdm branch-activity feature-branch  # Show commits, authors, files
gdm branch-activity --all-unmerged  # Report for all unmerged branches
```

---

## 9. Git Aliases for Quick Access

Add these to your `~/.gitconfig`:

```ini
[alias]
  # Show branches not merged to main
  unmerged = "!git branch -r --no-merged main | grep -v 'HEAD\\|main\\|master'"
  
  # Show commits in current branch not in main
  new = "!git log --oneline main..HEAD"
  
  # Count commits ahead of main
  ahead = "!git rev-list --count main..HEAD"
  
  # Show branch age and stats
  branch-age = "!f() { \
    git for-each-ref --sort=-committerdate refs/remotes/ \
    --format='%(committerdate:short)|%(refname:short)|%(authorname)|%(subject)' | \
    column -t -s '|'; \
  }; f"
  
  # Compare branches
  compare = "!f() { \
    git log --oneline --graph --left-right $1...$2; \
  }; f"
  
  # Show stale branches
  stale = "!git for-each-ref --sort=-committerdate refs/remotes/ \
    --format='%(committerdate:relative)|%(refname:short)' | \
    grep -E '([2-9][0-9]|[1-9][0-9]{2,}) (days|weeks|months)' | \
    column -t -s '|'"
```

Usage:
```bash
git unmerged          # List unmerged remote branches
git new               # Show new commits in current branch
git ahead             # Count commits ahead
git branch-age        # See all branches with dates
git compare main develop  # Compare two branches
git stale             # Find branches inactive > 60 days
```

---

## 10. Best Practices

### Regular Branch Hygiene

1. **Fetch regularly**: `git fetch --all --prune` to update remote tracking
2. **Review unmerged branches weekly**: Identify stale work
3. **Archive/delete merged branches**: Keep repo clean
4. **Set branch naming conventions**: e.g., `feature/`, `bugfix/`, `hotfix/`

### Communication

1. **Share branch status in standups**: "Working on `feature/user-auth`, 5 commits, ready for review"
2. **Document long-running branches**: Add README or wiki entry explaining purpose
3. **Set up branch protection**: Require reviews before merging to main
4. **Use draft PRs**: Show work in progress without formal review request

### Automation Ideas

1. **Daily reports**: Script to email unmerged branch summary
2. **Slack/Teams integration**: Bot that posts stale branches
3. **CI/CD checks**: Warn if branch diverges too far from main
4. **Auto-cleanup**: Delete merged branches after X days

---

## Summary of Key Commands

| Purpose | Command |
|---------|---------|
| Commits in branch not in main | `git log main..branch` |
| List unmerged branches | `git branch --no-merged main` |
| Count commits ahead | `git rev-list --count main..branch` |
| Branch age | `git log $(git merge-base main branch)..branch` |
| Diff statistics | `git diff --stat main...branch` |
| Authors on branch | `git shortlog -sn main..branch` |
| Files changed | `git diff --name-only main...branch` |
| Branch last activity | `git log branch -1 --date=short` |
| All branches with dates | `git for-each-ref --sort=-committerdate refs/remotes/` |

---

## Additional Resources

- **Git Documentation**: https://git-scm.com/docs/git-log
- **Pro Git Book**: https://git-scm.com/book/en/v2
- **GitHub Flow**: https://docs.github.com/en/get-started/quickstart/github-flow
- **Atlassian Git Tutorials**: https://www.atlassian.com/git/tutorials

---

## Next Steps for Your Project

Consider adding branch tracking features to your `xseed-dev-metrics` CLI:

1. **Branch Analysis Module**: Create `src/git/branches.ts` for branch operations
2. **New Commands**: Add `branches`, `branch-compare`, `branch-activity` commands
3. **CSV Export**: Include branch metrics in your data collection
4. **Dashboard Integration**: Show branch activity in reports
5. **Alerting**: Notify about stale branches or branches diverging significantly

Would you like me to implement any of these features in your CLI tool?
