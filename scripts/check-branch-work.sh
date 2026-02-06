#!/bin/bash

# ============================================
# Branch Work Tracker Script
# ============================================
# Quick script to check what work is happening in branches
# that haven't been merged to main yet

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
MAIN_BRANCH="main"
SHOW_STATS=false
SHOW_DETAILS=false
SHOW_FILES=false
SPECIFIC_BRANCH=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -b|--branch)
      SPECIFIC_BRANCH="$2"
      shift 2
      ;;
    -m|--main)
      MAIN_BRANCH="$2"
      shift 2
      ;;
    -s|--stats)
      SHOW_STATS=true
      shift
      ;;
    -d|--details)
      SHOW_DETAILS=true
      shift
      ;;
    -f|--files)
      SHOW_FILES=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  -b, --branch <name>   Check specific branch"
      echo "  -m, --main <name>     Main branch to compare against (default: main)"
      echo "  -s, --stats           Show detailed statistics"
      echo "  -d, --details         Show commit details"
      echo "  -f, --files           Show changed files"
      echo "  -h, --help            Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                           # Check all unmerged branches"
      echo "  $0 -b develop                # Check develop branch"
      echo "  $0 -b feature/new-ui -s -d   # Check feature branch with stats and details"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use -h or --help for usage information"
      exit 1
      ;;
  esac
done

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}   Branch Work Tracker${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Fetch latest changes
echo -e "${YELLOW}Fetching latest changes...${NC}"
git fetch --all --quiet 2>/dev/null || echo -e "${RED}Warning: Could not fetch from remote${NC}"
echo ""

# Function to analyze a single branch
analyze_branch() {
  local branch=$1
  local branch_name=${branch#origin/}
  
  # Skip HEAD and main branches
  if [[ "$branch_name" == "HEAD" ]] || [[ "$branch_name" == "$MAIN_BRANCH" ]] || [[ "$branch_name" == "master" ]]; then
    return
  fi
  
  # Count commits
  local commit_count=$(git rev-list --count $MAIN_BRANCH..$branch 2>/dev/null || echo "0")
  
  # Skip if no commits
  if [[ "$commit_count" == "0" ]]; then
    return
  fi
  
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}Branch: ${CYAN}$branch_name${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  
  # Last commit info
  local last_commit_date=$(git log $branch -1 --format="%ar" 2>/dev/null)
  local last_commit_author=$(git log $branch -1 --format="%an" 2>/dev/null)
  local last_commit_msg=$(git log $branch -1 --format="%s" 2>/dev/null)
  
  echo -e "  ${YELLOW}Commits ahead:${NC} $commit_count"
  echo -e "  ${YELLOW}Last activity:${NC} $last_commit_date"
  echo -e "  ${YELLOW}Last author:${NC} $last_commit_author"
  echo -e "  ${YELLOW}Last commit:${NC} $last_commit_msg"
  
  # Show authors working on this branch
  echo ""
  echo -e "  ${BLUE}Authors on this branch:${NC}"
  git shortlog -sn $MAIN_BRANCH..$branch | while read -r line; do
    echo "    $line"
  done
  
  # Show commit details if requested
  if [[ "$SHOW_DETAILS" == true ]]; then
    echo ""
    echo -e "  ${BLUE}Recent commits:${NC}"
    git log --oneline $MAIN_BRANCH..$branch | head -10 | while read -r line; do
      echo "    $line"
    done
  fi
  
  # Show statistics if requested
  if [[ "$SHOW_STATS" == true ]]; then
    echo ""
    echo -e "  ${BLUE}Changes:${NC}"
    git diff --shortstat $MAIN_BRANCH...$branch | sed 's/^/    /'
  fi
  
  # Show files if requested
  if [[ "$SHOW_FILES" == true ]]; then
    echo ""
    echo -e "  ${BLUE}Modified files (top 10):${NC}"
    git diff --name-only $MAIN_BRANCH...$branch | head -10 | while read -r file; do
      echo "    - $file"
    done
  fi
  
  echo ""
}

# Check specific branch or all unmerged branches
if [[ -n "$SPECIFIC_BRANCH" ]]; then
  # Add origin/ prefix if not present
  if [[ "$SPECIFIC_BRANCH" != origin/* ]]; then
    SPECIFIC_BRANCH="origin/$SPECIFIC_BRANCH"
  fi
  
  echo -e "${YELLOW}Analyzing branch: $SPECIFIC_BRANCH${NC}"
  echo ""
  
  # Check if branch exists
  if ! git rev-parse --verify $SPECIFIC_BRANCH >/dev/null 2>&1; then
    echo -e "${RED}Error: Branch '$SPECIFIC_BRANCH' not found${NC}"
    exit 1
  fi
  
  analyze_branch "$SPECIFIC_BRANCH"
else
  echo -e "${YELLOW}Finding unmerged branches...${NC}"
  echo ""
  
  # Get all unmerged remote branches
  unmerged_branches=$(git branch -r --no-merged $MAIN_BRANCH 2>/dev/null | grep -v 'HEAD' || true)
  
  if [[ -z "$unmerged_branches" ]]; then
    echo -e "${GREEN}✓ No unmerged branches found!${NC}"
    echo -e "  All remote branches are up to date with $MAIN_BRANCH"
    exit 0
  fi
  
  # Count unmerged branches
  branch_count=$(echo "$unmerged_branches" | wc -l | tr -d ' ')
  echo -e "${CYAN}Found $branch_count unmerged branch(es)${NC}"
  echo ""
  
  # Analyze each branch
  echo "$unmerged_branches" | while read -r branch; do
    branch=$(echo $branch | xargs) # trim whitespace
    analyze_branch "$branch"
  done
fi

echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}✓ Analysis complete${NC}"
echo -e "${CYAN}========================================${NC}"
