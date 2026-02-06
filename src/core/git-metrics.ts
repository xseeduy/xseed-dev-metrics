// ============================================
// Git Metrics Core - Extract metrics from Git
// ============================================

import { execSync } from 'child_process';
import { 
  AuthorStats, 
  CommitInfo, 
  FileStats, 
  TimeStats, 
  RepoSummary,
  FilterOptions,
  BlameStats,
  PeriodStats,
  GroupBy
} from '../types';
import { 
  parseDate, 
  formatDateForGit, 
  getWeekKey, 
  getMonthKey,
  getDayOfWeek 
} from '../utils/date-utils';

/**
 * Core class for extracting metrics and statistics from Git repositories.
 * Provides methods for analyzing commits, authors, files, time patterns, and more.
 * 
 * @example
 * ```typescript
 * const metrics = new GitMetrics('/path/to/repo');
 * const summary = metrics.getRepoSummary();
 * const authors = metrics.getAuthorStats();
 * ```
 */
export class GitMetrics {
  private repoPath: string;

  /**
   * Creates a new GitMetrics instance for the specified repository.
   * 
   * @param repoPath - Path to the git repository (defaults to current directory)
   * @throws {Error} If the specified path is not a valid git repository
   */
  constructor(repoPath: string = '.') {
    this.repoPath = repoPath;
    this.validateRepo();
  }

  /**
   * Validates that the specified path is a valid git repository.
   * 
   * @throws {Error} If the path is not a git repository
   * @private
   */
  private validateRepo(): void {
    try {
      this.exec('git rev-parse --git-dir');
    } catch {
      throw new Error(`Not a git repository: ${this.repoPath}`);
    }
  }

  /**
   * Executes a shell command in the repository directory.
   * 
   * @param command - The command to execute
   * @returns The trimmed output of the command
   * @throws {Error} If the command fails
   * @private
   */
  private exec(command: string): string {
    return execSync(command, {
      cwd: this.repoPath,
      encoding: 'utf-8',
      maxBuffer: 100 * 1024 * 1024, // 100MB buffer for large repos
    }).trim();
  }

  /**
   * Builds git log command arguments from filter options.
   * 
   * @param options - Filter options for the git log command
   * @returns A string of command-line arguments
   * @private
   */
  private buildLogArgs(options: FilterOptions): string {
    const args: string[] = [];
    
    if (options.since) args.push(`--since="${options.since}"`);
    if (options.until) args.push(`--until="${options.until}"`);
    
    // Prefer email for filtering (more reliable than author name)
    // Git's --author flag matches against both name and email
    if (options.email) {
      args.push(`--author="${options.email}"`);
    } else if (options.author) {
      args.push(`--author="${options.author}"`);
    }
    
    if (!options.includeMerges) args.push('--no-merges');
    
    // Handle branch filtering - support both single and multiple branches
    if (options.branches?.length) {
      // Multiple branches - use --all with branch restriction
      args.push('--all');
    } else if (options.branch) {
      // Single branch (legacy)
      args.push(options.branch);
    }
    
    if (options.paths?.length) args.push('--', ...options.paths);
    
    return args.join(' ');
  }

  // ==========================================
  // Branch Operations
  // ==========================================

  /**
   * Gets all branches that haven't been merged to the main branch.
   * These branches contain work that is not yet in the main branch.
   * 
   * @param mainBranch - The main branch to compare against (default: 'main')
   * @returns Array of unmerged branch names (e.g., ['origin/develop', 'origin/feature-auth'])
   * @example
   * ```typescript
   * const unmerged = metrics.getUnmergedBranches('main');
   * console.log(`Found ${unmerged.length} unmerged branches`);
   * ```
   */
  getUnmergedBranches(mainBranch: string = 'main'): string[] {
    try {
      // Get all remote branches that are not merged to main
      const raw = this.exec(`git branch -r --no-merged ${mainBranch}`);
      
      if (!raw) return [];
      
      const branches = raw
        .split('\n')
        .map(b => b.trim())
        .filter(b => {
          // Filter out empty lines, HEAD, and main/master branches
          if (!b) return false;
          if (b.includes('HEAD')) return false;
          if (b === `origin/${mainBranch}`) return false;
          if (b === 'origin/main' || b === 'origin/master') return false;
          return true;
        });
      
      return branches;
    } catch (error: unknown) {
      // If the command fails (e.g., no remote branches), return empty array
      return [];
    }
  }

  /**
   * Gets all active branches including the main branch and unmerged branches.
   * This provides a complete list of branches to analyze for metrics.
   * 
   * @param mainBranch - The main branch name (default: 'main')
   * @returns Array of all active branch names
   * @example
   * ```typescript
   * const allBranches = metrics.getAllActiveBranches('main');
   * // Returns: ['main', 'origin/develop', 'origin/feature-auth', ...]
   * ```
   */
  getAllActiveBranches(mainBranch: string = 'main'): string[] {
    const unmerged = this.getUnmergedBranches(mainBranch);
    return [mainBranch, ...unmerged];
  }

  /**
   * Collects commits from multiple branches and deduplicates them by commit hash.
   * This ensures each commit is only counted once, even if it appears in multiple branches.
   * 
   * @param branches - Array of branch names to collect from
   * @param options - Filter options to narrow down the commits
   * @param limit - Maximum number of commits to return (optional)
   * @returns Array of unique commit information objects
   * @example
   * ```typescript
   * const branches = ['main', 'origin/develop', 'origin/feature-auth'];
   * const commits = metrics.getCommitsFromMultipleBranches(branches, { since: '2024-01-01' });
   * console.log(`Found ${commits.length} unique commits across ${branches.length} branches`);
   * ```
   */
  getCommitsFromMultipleBranches(
    branches: string[],
    options: FilterOptions = {},
    limit?: number
  ): CommitInfo[] {
    if (!branches || branches.length === 0) {
      return this.getCommits(options, limit);
    }

    // Use a Map to deduplicate commits by hash
    const commitMap = new Map<string, CommitInfo>();

    // Collect commits from each branch
    for (const branch of branches) {
      try {
        const branchOptions = { ...options, branch, branches: undefined };
        const branchCommits = this.getCommits(branchOptions, limit);
        
        // Add commits to the map (hash is unique identifier)
        for (const commit of branchCommits) {
          if (!commitMap.has(commit.hash)) {
            commitMap.set(commit.hash, commit);
          }
        }
      } catch (error: unknown) {
        // If a branch fails, continue with others
        continue;
      }
    }

    // Convert map to array and sort by date (most recent first)
    const uniqueCommits = Array.from(commitMap.values());
    uniqueCommits.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Apply limit if specified
    return limit ? uniqueCommits.slice(0, limit) : uniqueCommits;
  }

  // ==========================================
  // Parsing Utilities (Windows-compatible)
  // ==========================================

  /**
   * Parses git log --numstat output and sums lines added/deleted.
   * Replaces Unix utilities like awk.
   * 
   * @param output - Raw output from git log --numstat
   * @returns Object with total added and deleted lines
   * @private
   */
  private parseNumstat(output: string): { added: number; deleted: number } {
    let added = 0;
    let deleted = 0;
    
    output.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      const parts = trimmed.split('\t');
      if (parts.length >= 2) {
        // Handle binary files (marked as '-')
        const addedVal = parts[0] === '-' ? 0 : parseInt(parts[0]);
        const deletedVal = parts[1] === '-' ? 0 : parseInt(parts[1]);
        
        if (!isNaN(addedVal)) added += addedVal;
        if (!isNaN(deletedVal)) deleted += deletedVal;
      }
    });
    
    return { added, deleted };
  }

  /**
   * Gets unique values from an array of strings.
   * Replaces Unix utilities like sort -u.
   * 
   * @param values - Array of strings
   * @returns Array of unique strings
   * @private
   */
  private getUniqueValues(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean)));
  }

  /**
   * Counts unique lines in output.
   * Replaces Unix utilities like sort -u | wc -l.
   * 
   * @param output - Raw output string
   * @returns Count of unique non-empty lines
   * @private
   */
  private countUniqueLines(output: string): number {
    const lines = output.split('\n').filter(Boolean);
    return new Set(lines).size;
  }

  /**
   * Parses file list with occurrence counts.
   * Replaces Unix utilities like sort | uniq -c.
   * 
   * @param output - Raw output with one file per line
   * @returns Array of {file, count} objects sorted by count descending
   * @private
   */
  private parseFileOccurrences(output: string): Array<{ file: string; count: number }> {
    const counts = new Map<string, number>();
    
    output.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed) {
        counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
      }
    });
    
    return Array.from(counts.entries())
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Parses file statistics by extension.
   * Replaces awk-based file type analysis.
   * 
   * @param numstatOutput - Raw output from git log --numstat
   * @returns Object mapping extensions to {files, lines} counts
   * @private
   */
  private parseFileTypeStats(numstatOutput: string): Record<string, { files: number; lines: number }> {
    const stats: Record<string, { files: Set<string>; lines: number }> = {};
    
    numstatOutput.split('\n').forEach(line => {
      const parts = line.trim().split('\t');
      if (parts.length >= 3) {
        const added = parseInt(parts[0]) || 0;
        const deleted = parseInt(parts[1]) || 0;
        const filepath = parts[2];
        
        // Extract extension
        const match = filepath.match(/\.([^./]+)$/);
        const ext = match ? match[1] : 'no-ext';
        
        if (!stats[ext]) {
          stats[ext] = { files: new Set(), lines: 0 };
        }
        
        stats[ext].files.add(filepath);
        stats[ext].lines += added + deleted;
      }
    });
    
    // Convert Sets to counts
    const result: Record<string, { files: number; lines: number }> = {};
    for (const [ext, data] of Object.entries(stats)) {
      result[ext] = {
        files: data.files.size,
        lines: data.lines,
      };
    }
    
    return result;
  }

  // ==========================================
  // Repository Summary
  // ==========================================

  /**
   * Gets a comprehensive summary of the repository including commits, authors, lines changed, and branches.
   * 
   * @param options - Filter options to narrow down the analysis
   * @returns Repository summary with aggregate statistics
   * @example
   * ```typescript
   * const summary = metrics.getRepoSummary({ since: '2024-01-01' });
   * console.log(`Total commits: ${summary.totalCommits}`);
   * ```
   */
  getRepoSummary(options: FilterOptions = {}): RepoSummary {
    // If multiple branches specified, use multi-branch collection
    if (options.branches && options.branches.length > 0) {
      return this.getRepoSummaryFromMultipleBranches(options);
    }

    const logArgs = this.buildLogArgs(options);
    
    const totalCommits = parseInt(
      this.exec(`git rev-list --count HEAD ${logArgs}`) || '0'
    );

    // Get unique authors (Windows-compatible)
    // Use --use-mailmap to respect .mailmap file for consolidating author identities
    const authorsRaw = this.exec(`git log --use-mailmap --format='%aN' ${logArgs}`);
    const totalAuthors = this.countUniqueLines(authorsRaw);

    // Lines added/deleted (Windows-compatible: no awk)
    const statsRaw = this.exec(`git log --pretty=tformat: --numstat ${logArgs}`);
    const { added, deleted } = this.parseNumstat(statsRaw);

    // First and last commit (Windows-compatible: no head)
    let firstCommitDate: Date | null = null;
    let lastCommitDate: Date | null = null;

    try {
      const firstRaw = this.exec(`git log --reverse --format='%aI' ${logArgs}`);
      const first = firstRaw.split('\n')[0]; // First line instead of head -1
      const last = this.exec(`git log --format='%aI' -1 ${logArgs}`);
      if (first) firstCommitDate = new Date(first);
      if (last) lastCommitDate = new Date(last);
    } catch (error: unknown) {
      // Log error but continue - dates will remain null
    }

    // Branches
    const branchesRaw = this.exec('git branch -a');
    const activeBranches = branchesRaw.split('\n').filter(Boolean).length;

    const currentBranch = this.exec('git branch --show-current') || 'HEAD';

    // Files changed (unique) (Windows-compatible: no sort, wc)
    const filesRaw = this.exec(`git log --pretty=tformat: --name-only ${logArgs}`);
    const totalFilesChanged = this.countUniqueLines(filesRaw);

    return {
      totalCommits,
      totalAuthors,
      totalLinesAdded: added,
      totalLinesDeleted: deleted,
      totalFilesChanged,
      firstCommitDate,
      lastCommitDate,
      activeBranches,
      currentBranch,
    };
  }

  /**
   * Gets repository summary by collecting and deduplicating commits from multiple branches.
   * This ensures accurate metrics when analyzing work across multiple active branches.
   * 
   * @param options - Filter options including branches array
   * @returns Repository summary with branch metadata
   * @private
   */
  private getRepoSummaryFromMultipleBranches(options: FilterOptions): RepoSummary {
    const branches = options.branches || [];
    
    // Get unique commits across all branches
    const commits = this.getCommitsFromMultipleBranches(branches, options);
    
    // Calculate totals from unique commits
    const totalCommits = commits.length;
    
    // Get unique authors
    const uniqueAuthors = new Set(commits.map(c => c.author));
    const totalAuthors = uniqueAuthors.size;
    
    // Sum lines from unique commits
    let totalLinesAdded = 0;
    let totalLinesDeleted = 0;
    for (const commit of commits) {
      totalLinesAdded += commit.linesAdded;
      totalLinesDeleted += commit.linesDeleted;
    }
    
    // Get unique files
    const uniqueFiles = new Set<string>();
    for (const branch of branches) {
      try {
        const branchOptions = { ...options, branch, branches: undefined };
        const filesRaw = this.exec(`git log --pretty=tformat: --name-only ${this.buildLogArgs(branchOptions)}`);
        filesRaw.split('\n').filter(Boolean).forEach(file => uniqueFiles.add(file));
      } catch {
        continue;
      }
    }
    const totalFilesChanged = uniqueFiles.size;
    
    // Get first and last commit dates
    let firstCommitDate: Date | null = null;
    let lastCommitDate: Date | null = null;
    
    if (commits.length > 0) {
      const sortedByDate = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());
      firstCommitDate = sortedByDate[0].date;
      lastCommitDate = sortedByDate[sortedByDate.length - 1].date;
    }
    
    // Get branch info
    const branchesRaw = this.exec('git branch -a');
    const activeBranches = branchesRaw.split('\n').filter(Boolean).length;
    const currentBranch = this.exec('git branch --show-current') || 'HEAD';
    
    return {
      totalCommits,
      totalAuthors,
      totalLinesAdded,
      totalLinesDeleted,
      totalFilesChanged,
      firstCommitDate,
      lastCommitDate,
      activeBranches,
      currentBranch,
      branchesAnalyzed: branches,
    };
  }

  // ==========================================
  // Author Statistics
  // ==========================================

  /**
   * Gets detailed statistics for each author in the repository.
   * Includes commits, lines added/deleted, files changed, and activity patterns.
   * 
   * @param options - Filter options to narrow down the analysis
   * @returns Array of author statistics sorted by commit count (descending)
   * @example
   * ```typescript
   * const authors = metrics.getAuthorStats({ since: '2024-01-01' });
   * authors.forEach(author => {
   *   console.log(`${author.name}: ${author.commits} commits`);
   * });
   * ```
   */
  getAuthorStats(options: FilterOptions = {}): AuthorStats[] {
    // If multiple branches specified, use multi-branch collection
    if (options.branches && options.branches.length > 0) {
      return this.getAuthorStatsFromMultipleBranches(options);
    }

    const logArgs = this.buildLogArgs({ ...options, includeMerges: true });
    
    // Get all authors (Windows-compatible: no sort -u)
    // Use --use-mailmap to respect .mailmap file for consolidating author identities
    const authorsRaw = this.exec(`git log --use-mailmap --format='%aN|%aE' ${logArgs}`);
    const authorEmails = new Map<string, string>();
    
    authorsRaw.split('\n').filter(Boolean).forEach(line => {
      const [name, email] = line.split('|');
      if (name && email) authorEmails.set(name, email);
    });

    const stats: AuthorStats[] = [];

    for (const [author, email] of authorEmails) {
      // Use email for filtering (more reliable than author name)
      const authorArgs = this.buildLogArgs({ ...options, email, includeMerges: false });
      const authorArgsWithMerges = this.buildLogArgs({ ...options, email, includeMerges: true });

      // Commit count (without merges)
      const commits = parseInt(
        this.exec(`git rev-list --count HEAD ${authorArgs}`) || '0'
      );

      // Merge commits
      const totalWithMerges = parseInt(
        this.exec(`git rev-list --count HEAD ${authorArgsWithMerges}`) || '0'
      );
      const mergeCommits = totalWithMerges - commits;

      // Lines added/deleted - use email for filtering
      const linesRaw = this.exec(
        `git log --author="${email}" --pretty=tformat: --numstat ${authorArgs}`
      );
      const { added: linesAdded, deleted: linesDeleted } = this.parseNumstat(linesRaw);

      // Files changed - use email for filtering
      const filesRaw = this.exec(
        `git log --author="${email}" --pretty=tformat: --name-only ${authorArgs}`
      );
      const filesChanged = this.countUniqueLines(filesRaw);

      // First and last commit dates - use email for filtering
      let firstCommit: Date | null = null;
      let lastCommit: Date | null = null;

      try {
        const firstRaw = this.exec(
          `git log --author="${email}" --reverse --format='%aI' ${authorArgs}`
        );
        const first = firstRaw.split('\n')[0]; // First line instead of head -1
        const last = this.exec(
          `git log --author="${email}" --format='%aI' -1 ${authorArgs}`
        );
        if (first) firstCommit = new Date(first);
        if (last) lastCommit = new Date(last);
      } catch {}

      // Active days - use email for filtering
      const daysRaw = this.exec(
        `git log --author="${email}" --format='%ad' --date='format:%Y-%m-%d' ${authorArgs}`
      );
      const activeDays = this.countUniqueLines(daysRaw);

      const avgCommitsPerDay = activeDays > 0 ? commits / activeDays : 0;

      const username = email.includes('@') ? email.split('@')[0] : email || author;
      stats.push({
        name: author,
        username,
        email,
        commits,
        linesAdded,
        linesDeleted,
        linesNet: linesAdded - linesDeleted,
        filesChanged,
        firstCommit,
        lastCommit,
        activeDays,
        avgCommitsPerDay: Math.round(avgCommitsPerDay * 100) / 100,
        mergeCommits,
      });
    }

    // Sort by commits descending
    return stats.sort((a, b) => b.commits - a.commits);
  }

  /**
   * Gets author statistics by collecting and deduplicating commits from multiple branches.
   * This ensures accurate per-author metrics when analyzing work across multiple active branches.
   * 
   * @param options - Filter options including branches array
   * @returns Array of author statistics sorted by commit count (descending)
   * @private
   */
  private getAuthorStatsFromMultipleBranches(options: FilterOptions): AuthorStats[] {
    const branches = options.branches || [];
    
    // Get unique commits across all branches (including merge commits for accurate counting)
    const allCommits = this.getCommitsFromMultipleBranches(branches, { ...options, includeMerges: true });
    const nonMergeCommits = this.getCommitsFromMultipleBranches(branches, { ...options, includeMerges: false });
    
    // Group commits by author email (more reliable than name)
    const authorMap = new Map<string, {
      name: string;
      email: string;
      commits: CommitInfo[];
      mergeCommits: CommitInfo[];
    }>();
    
    // Add all commits to author map
    for (const commit of allCommits) {
      const key = commit.email;
      if (!authorMap.has(key)) {
        authorMap.set(key, {
          name: commit.author,
          email: commit.email,
          commits: [],
          mergeCommits: [],
        });
      }
      
      const authorData = authorMap.get(key)!;
      if (commit.isMerge) {
        authorData.mergeCommits.push(commit);
      }
    }
    
    // Add non-merge commits
    for (const commit of nonMergeCommits) {
      const key = commit.email;
      const authorData = authorMap.get(key);
      if (authorData) {
        authorData.commits.push(commit);
      }
    }
    
    // Calculate stats for each author
    const stats: AuthorStats[] = [];
    
    for (const [email, data] of authorMap) {
      const commits = data.commits.length;
      const mergeCommits = data.mergeCommits.length;
      
      // Calculate lines and files from non-merge commits
      let linesAdded = 0;
      let linesDeleted = 0;
      const uniqueFiles = new Set<string>();
      const uniqueDates = new Set<string>();
      
      for (const commit of data.commits) {
        linesAdded += commit.linesAdded;
        linesDeleted += commit.linesDeleted;
        
        // Track unique dates for active days
        const dateStr = commit.date.toISOString().split('T')[0];
        uniqueDates.add(dateStr);
      }
      
      // Get unique files for this author across all branches
      for (const branch of branches) {
        try {
          const branchOptions = { ...options, branch, branches: undefined, email };
          const filesRaw = this.exec(`git log --author="${email}" --pretty=tformat: --name-only ${this.buildLogArgs(branchOptions)}`);
          filesRaw.split('\n').filter(Boolean).forEach(file => uniqueFiles.add(file));
        } catch {
          continue;
        }
      }
      
      const filesChanged = uniqueFiles.size;
      const activeDays = uniqueDates.size;
      
      // Get first and last commit dates
      let firstCommit: Date | null = null;
      let lastCommit: Date | null = null;
      
      if (data.commits.length > 0) {
        const sortedByDate = [...data.commits].sort((a, b) => a.date.getTime() - b.date.getTime());
        firstCommit = sortedByDate[0].date;
        lastCommit = sortedByDate[sortedByDate.length - 1].date;
      }
      
      const avgCommitsPerDay = activeDays > 0 ? commits / activeDays : 0;
      const username = email.includes('@') ? email.split('@')[0] : email || data.name;
      
      stats.push({
        name: data.name,
        username,
        email,
        commits,
        linesAdded,
        linesDeleted,
        linesNet: linesAdded - linesDeleted,
        filesChanged,
        firstCommit,
        lastCommit,
        activeDays,
        avgCommitsPerDay: Math.round(avgCommitsPerDay * 100) / 100,
        mergeCommits,
      });
    }
    
    // Sort by commits descending
    return stats.sort((a, b) => b.commits - a.commits);
  }

  // ==========================================
  // Commit List
  // ==========================================

  /**
   * Gets a list of commits with detailed information including hash, author, date, and changes.
   * 
   * @param options - Filter options to narrow down the commits
   * @param limit - Maximum number of commits to return (optional)
   * @returns Array of commit information objects
   * @example
   * ```typescript
   * const recentCommits = metrics.getCommits({}, 10);
   * const authorCommits = metrics.getCommits({ author: 'John Doe' });
   * ```
   */
  getCommits(options: FilterOptions = {}, limit?: number): CommitInfo[] {
    const logArgs = this.buildLogArgs(options);
    const limitArg = limit ? `-n ${limit}` : '';

    // Format: hash|shortHash|author|email|date|message|isMerge
    const format = '%H|%h|%aN|%aE|%aI|%s|%P';
    
    // Use --use-mailmap to respect .mailmap file for consolidating author identities
    const raw = this.exec(`git log --use-mailmap --format='${format}' ${limitArg} ${logArgs}`);
    const commits: CommitInfo[] = [];

    for (const line of raw.split('\n').filter(Boolean)) {
      const [hash, shortHash, author, email, dateStr, message, parents] = line.split('|');
      const isMerge = parents?.includes(' ') || false;

      // Get stats for this commit
      let linesAdded = 0;
      let linesDeleted = 0;
      let filesChanged = 0;

      try {
        const statsRaw = this.exec(`git show --stat --format='' ${hash}`);
        // Get last non-empty line (cross-platform replacement for tail -1)
        const lines = statsRaw.split('\n').filter(line => line.trim());
        const lastLine = lines[lines.length - 1] || '';
        
        const match = lastLine.match(/(\d+) files? changed(?:, (\d+) insertions?[^,]*)?(?:, (\d+) deletions?)?/);
        if (match) {
          filesChanged = parseInt(match[1]) || 0;
          linesAdded = parseInt(match[2]) || 0;
          linesDeleted = parseInt(match[3]) || 0;
        }
      } catch (error: unknown) {
        // Log error but continue with zero stats
      }

      commits.push({
        hash,
        shortHash,
        author,
        email,
        date: new Date(dateStr),
        message,
        linesAdded,
        linesDeleted,
        filesChanged,
        isMerge,
      });
    }

    return commits;
  }

  // ==========================================
  // Time-based Statistics
  // ==========================================

  /**
   * Analyzes commit patterns across different time dimensions.
   * Provides breakdowns by hour of day, day of week, month, and week.
   * 
   * @param options - Filter options to narrow down the analysis
   * @returns Time-based statistics including hourly, daily, weekly, and monthly patterns
   * @example
   * ```typescript
   * const timeStats = metrics.getTimeStats();
   * console.log(`Most active hour: ${Object.entries(timeStats.byHour).sort((a, b) => b[1] - a[1])[0]}`);
   * ```
   */
  getTimeStats(options: FilterOptions = {}): TimeStats {
    // If multiple branches specified, use multi-branch collection
    if (options.branches && options.branches.length > 0) {
      return this.getTimeStatsFromMultipleBranches(options);
    }

    const logArgs = this.buildLogArgs(options);

    // By hour (0-23)
    const byHour: Record<number, number> = {};
    for (let i = 0; i < 24; i++) byHour[i] = 0;

    // Use --use-mailmap to respect .mailmap file for consolidating author identities
    const hourRaw = this.exec(
      `git log --use-mailmap --format='%ad' --date='format:%H' ${logArgs}`
    );
    hourRaw.split('\n').filter(Boolean).forEach(h => {
      const hour = parseInt(h);
      byHour[hour] = (byHour[hour] || 0) + 1;
    });

    // By day of week
    const byDayOfWeek: Record<string, number> = {
      'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0,
      'Friday': 0, 'Saturday': 0, 'Sunday': 0
    };

    const dayRaw = this.exec(
      `git log --use-mailmap --format='%ad' --date='format:%A' ${logArgs}`
    );
    dayRaw.split('\n').filter(Boolean).forEach(d => {
      byDayOfWeek[d] = (byDayOfWeek[d] || 0) + 1;
    });

    // By month (YYYY-MM)
    const byMonth: Record<string, number> = {};
    const monthRaw = this.exec(
      `git log --use-mailmap --format='%ad' --date='format:%Y-%m' ${logArgs}`
    );
    monthRaw.split('\n').filter(Boolean).forEach(m => {
      byMonth[m] = (byMonth[m] || 0) + 1;
    });

    // By week (YYYY-WW)
    const byWeek: Record<string, number> = {};
    const weekRaw = this.exec(
      `git log --use-mailmap --format='%ad' --date='format:%Y-%V' ${logArgs}`
    );
    weekRaw.split('\n').filter(Boolean).forEach(w => {
      byWeek[w] = (byWeek[w] || 0) + 1;
    });

    return { byHour, byDayOfWeek, byMonth, byWeek };
  }

  /**
   * Gets time statistics by collecting and deduplicating commits from multiple branches.
   * 
   * @param options - Filter options including branches array
   * @returns Time-based statistics
   * @private
   */
  private getTimeStatsFromMultipleBranches(options: FilterOptions): TimeStats {
    const branches = options.branches || [];
    
    // Get unique commits across all branches
    const commits = this.getCommitsFromMultipleBranches(branches, options);
    
    // Initialize counters
    const byHour: Record<number, number> = {};
    for (let i = 0; i < 24; i++) byHour[i] = 0;
    
    const byDayOfWeek: Record<string, number> = {
      'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0,
      'Friday': 0, 'Saturday': 0, 'Sunday': 0
    };
    
    const byMonth: Record<string, number> = {};
    const byWeek: Record<string, number> = {};
    
    // Count commits by time dimensions
    for (const commit of commits) {
      const date = commit.date;
      
      // By hour
      const hour = date.getHours();
      byHour[hour] = (byHour[hour] || 0) + 1;
      
      // By day of week
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[date.getDay()];
      byDayOfWeek[dayName] = (byDayOfWeek[dayName] || 0) + 1;
      
      // By month (YYYY-MM)
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      byMonth[month] = (byMonth[month] || 0) + 1;
      
      // By week (approximate - YYYY-WW)
      const week = getWeekKey(date);
      byWeek[week] = (byWeek[week] || 0) + 1;
    }
    
    return { byHour, byDayOfWeek, byMonth, byWeek };
  }

  // ==========================================
  // File Statistics
  // ==========================================

  /**
   * Gets statistics for the most frequently changed files in the repository.
   * Includes change count, lines added/deleted, and contributing authors.
   * 
   * @param options - Filter options to narrow down the analysis
   * @param limit - Maximum number of files to return (default: 20)
   * @returns Array of file statistics sorted by change frequency
   * @example
   * ```typescript
   * const topFiles = metrics.getFileStats({}, 10);
   * topFiles.forEach(file => {
   *   console.log(`${file.path}: ${file.changes} changes by ${file.authors.length} authors`);
   * });
   * ```
   */
  getFileStats(options: FilterOptions = {}, limit: number = 20): FileStats[] {
    const logArgs = this.buildLogArgs(options);

    // Get most changed files (Windows-compatible: no sed, sort, uniq, head)
    const raw = this.exec(`git log --pretty=format: --name-only ${logArgs}`);
    const fileOccurrences = this.parseFileOccurrences(raw);
    const topFiles = fileOccurrences.slice(0, limit);

    const stats: FileStats[] = [];

    for (const { file: path, count: changes } of topFiles) {
      // Get lines added/deleted for this file (Windows-compatible: no awk)
      let linesAdded = 0;
      let linesDeleted = 0;

      try {
        const statsRaw = this.exec(`git log --pretty=tformat: --numstat ${logArgs} -- "${path}"`);
        const { added, deleted } = this.parseNumstat(statsRaw);
        linesAdded = added;
        linesDeleted = deleted;
      } catch {}

      // Get authors who touched this file (Windows-compatible: no sort -u)
      // Use --use-mailmap to respect .mailmap file for consolidating author identities
      const authorsRaw = this.exec(`git log --use-mailmap --format='%aN' ${logArgs} -- "${path}"`);
      const authors = this.getUniqueValues(authorsRaw.split('\n'));

      stats.push({
        path,
        changes,
        linesAdded,
        linesDeleted,
        authors,
      });
    }

    return stats;
  }

  // ==========================================
  // Git Blame Statistics
  // ==========================================

  /**
   * Analyzes code ownership using git blame to determine which authors wrote which lines.
   * Can analyze a specific file or all tracked files in the repository (limited to 100 files).
   * 
   * @param filePath - Optional specific file to analyze (if omitted, analyzes all tracked files)
   * @returns Array of blame statistics sorted by line count (descending)
   * @example
   * ```typescript
   * const ownership = metrics.getBlameStats('src/index.ts');
   * const repoOwnership = metrics.getBlameStats();
   * ```
   */
  getBlameStats(filePath?: string): BlameStats[] {
    const statsMap = new Map<string, { lines: number; email: string }>();
    
    let files: string[];
    if (filePath) {
      files = [filePath];
    } else {
      // Get all tracked files (limit to avoid timeout) (Windows-compatible: no head)
      const filesRaw = this.exec('git ls-files');
      files = filesRaw.split('\n').filter(Boolean).slice(0, 100);
    }

    let totalLines = 0;

    for (const file of files) {
      try {
        // Get blame output without error redirection or grep (Windows-compatible)
        const blameRaw = this.exec(`git blame -w --line-porcelain -- "${file}"`);

        let currentAuthor = '';
        // Parse all lines and filter in JavaScript instead of using grep
        for (const line of blameRaw.split('\n')) {
          if (line.startsWith('author ')) {
            currentAuthor = line.substring(7); // Replace 'author ' prefix
          } else if (line.startsWith('author-mail ')) {
            const email = line.substring(12).replace(/[<>]/g, ''); // Replace 'author-mail ' prefix
            if (currentAuthor) {
              const existing = statsMap.get(currentAuthor) || { lines: 0, email };
              existing.lines++;
              statsMap.set(currentAuthor, existing);
              totalLines++;
            }
          }
        }
      } catch {
        // Skip files that can't be blamed (binary, etc)
      }
    }

    const stats: BlameStats[] = [];
    for (const [author, data] of statsMap) {
      stats.push({
        author,
        email: data.email,
        lines: data.lines,
        percentage: totalLines > 0 ? Math.round((data.lines / totalLines) * 10000) / 100 : 0,
      });
    }

    return stats.sort((a, b) => b.lines - a.lines);
  }

  // ==========================================
  // Period Aggregation
  // ==========================================

  /**
   * Aggregates commit statistics by time period (day, week, month, or year).
   * Provides counts of commits, lines changed, and active authors for each period.
   * 
   * @param options - Filter options to narrow down the analysis
   * @param groupBy - Time period to group by ('day', 'week', 'month', or 'year')
   * @returns Array of period statistics sorted chronologically
   * @example
   * ```typescript
   * const monthlyStats = metrics.getStatsByPeriod({}, 'month');
   * const weeklyStats = metrics.getStatsByPeriod({ author: 'John' }, 'week');
   * ```
   */
  getStatsByPeriod(options: FilterOptions = {}, groupBy: GroupBy = 'month'): PeriodStats[] {
    // If multiple branches specified, use multi-branch collection
    if (options.branches && options.branches.length > 0) {
      return this.getStatsByPeriodFromMultipleBranches(options, groupBy);
    }

    const logArgs = this.buildLogArgs(options);
    
    let dateFormat: string;
    switch (groupBy) {
      case 'day': dateFormat = '%Y-%m-%d'; break;
      case 'week': dateFormat = '%Y-W%V'; break;
      case 'month': dateFormat = '%Y-%m'; break;
      case 'year': dateFormat = '%Y'; break;
    }

    // Get commits with stats grouped by period
    // Use --use-mailmap to respect .mailmap file for consolidating author identities
    const raw = this.exec(`
      git log --use-mailmap --format='%ad|%aN' --date='format:${dateFormat}' --numstat ${logArgs}
    `);

    const periodMap = new Map<string, {
      commits: Set<string>;
      authors: Set<string>;
      linesAdded: number;
      linesDeleted: number;
    }>();

    let currentPeriod = '';
    let currentAuthor = '';
    let commitId = 0;

    for (const line of raw.split('\n')) {
      if (line.includes('|')) {
        const [period, author] = line.split('|');
        currentPeriod = period;
        currentAuthor = author;
        commitId++;

        if (!periodMap.has(currentPeriod)) {
          periodMap.set(currentPeriod, {
            commits: new Set(),
            authors: new Set(),
            linesAdded: 0,
            linesDeleted: 0,
          });
        }
        periodMap.get(currentPeriod)!.commits.add(`${commitId}`);
        periodMap.get(currentPeriod)!.authors.add(currentAuthor);
      } else if (line.trim() && currentPeriod) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const added = parseInt(parts[0]) || 0;
          const deleted = parseInt(parts[1]) || 0;
          const data = periodMap.get(currentPeriod)!;
          data.linesAdded += added;
          data.linesDeleted += deleted;
        }
      }
    }

    const stats: PeriodStats[] = [];
    for (const [period, data] of periodMap) {
      stats.push({
        period,
        commits: data.commits.size,
        linesAdded: data.linesAdded,
        linesDeleted: data.linesDeleted,
        authors: data.authors.size,
      });
    }

    return stats.sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Gets period statistics by collecting and deduplicating commits from multiple branches.
   * 
   * @param options - Filter options including branches array
   * @param groupBy - Time period to group by
   * @returns Array of period statistics sorted chronologically
   * @private
   */
  private getStatsByPeriodFromMultipleBranches(options: FilterOptions, groupBy: GroupBy): PeriodStats[] {
    const branches = options.branches || [];
    
    // Get unique commits across all branches
    const commits = this.getCommitsFromMultipleBranches(branches, options);
    
    // Group commits by period
    const periodMap = new Map<string, {
      commits: Set<string>;
      authors: Set<string>;
      linesAdded: number;
      linesDeleted: number;
    }>();
    
    for (const commit of commits) {
      // Determine period key based on groupBy
      let period: string;
      const date = commit.date;
      
      switch (groupBy) {
        case 'day':
          period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          break;
        case 'week':
          period = getWeekKey(date);
          break;
        case 'month':
          period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          period = `${date.getFullYear()}`;
          break;
      }
      
      if (!periodMap.has(period)) {
        periodMap.set(period, {
          commits: new Set(),
          authors: new Set(),
          linesAdded: 0,
          linesDeleted: 0,
        });
      }
      
      const data = periodMap.get(period)!;
      data.commits.add(commit.hash);
      data.authors.add(commit.author);
      data.linesAdded += commit.linesAdded;
      data.linesDeleted += commit.linesDeleted;
    }
    
    // Convert to array
    const stats: PeriodStats[] = [];
    for (const [period, data] of periodMap) {
      stats.push({
        period,
        commits: data.commits.size,
        linesAdded: data.linesAdded,
        linesDeleted: data.linesDeleted,
        authors: data.authors.size,
      });
    }
    
    return stats.sort((a, b) => a.period.localeCompare(b.period));
  }

  // ==========================================
  // File Type Statistics
  // ==========================================

  /**
   * Analyzes statistics by file type/extension.
   * Counts the number of files and total lines changed for each file extension.
   * 
   * @param options - Filter options to narrow down the analysis
   * @returns Object mapping file extensions to their statistics
   * @example
   * ```typescript
   * const typeStats = metrics.getFileTypeStats();
   * console.log(`TypeScript files: ${typeStats['ts'].files} files, ${typeStats['ts'].lines} lines`);
   * ```
   */
  getFileTypeStats(options: FilterOptions = {}): Record<string, { files: number; lines: number }> {
    const logArgs = this.buildLogArgs(options);

    // Get numstat output (Windows-compatible: no awk, sort)
    const raw = this.exec(`git log --pretty=tformat: --numstat ${logArgs}`);
    
    // Parse using helper method instead of awk
    return this.parseFileTypeStats(raw);
  }
}
