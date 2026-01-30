// ============================================
// Integration Configuration Manager
// ============================================

import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { CONFIG } from './constants';
import {
  validateUrl,
  validateEmail,
  validateApiKey,
  validateBranchName,
  validateFilePath,
  validateTimeFormat,
  validateDayOfWeek,
} from '../utils/validation';

// ==========================================
// Types
// ==========================================

/**
 * Jira integration configuration.
 * Required for connecting to Atlassian Jira for issue tracking metrics.
 */
export interface JiraConfig {
  /** Jira instance URL (e.g., https://company.atlassian.net) */
  url: string;
  /** Jira account email */
  email: string;
  /** Jira API token */
  token: string;
}

/**
 * Linear integration configuration.
 * Required for connecting to Linear for issue tracking metrics.
 */
export interface LinearConfig {
  /** Linear API key */
  apiKey: string;
}

/**
 * Notion integration configuration.
 * Required for uploading metrics to Notion workspace.
 */
export interface NotionConfig {
  /** Whether Notion integration is enabled */
  enabled: boolean;
  /** Notion API key (integration secret) */
  apiKey: string;
  /** Parent page ID where metrics will be uploaded */
  parentPageId: string;
  /** Optional client/organization name */
  clientName?: string;
  /** Whether to automatically upload on scheduled collection runs */
  autoUploadOnSchedule?: boolean;
}

/**
 * Git configuration for filtering commits.
 * Defines which developer's commits to track.
 */
export interface GitConfig {
  /** Git username for filtering commits */
  username: string;
  /** Git email for filtering commits */
  email: string;
  /** Main branch name ('main' or 'master') */
  mainBranch: string;
}

/**
 * Scheduler configuration for automatic collection.
 * Defines when and how often to run automatic metric collection.
 */
export interface SchedulerConfig {
  /** Whether scheduler is enabled */
  enabled: boolean;
  /** Collection interval */
  interval: 'daily' | 'weekly' | 'monthly';
  /** Day of week for weekly schedule (0-6, Monday=1) */
  dayOfWeek?: number;
  /** Time of day in HH:MM format */
  time?: string;
}

/**
 * Complete integration configuration.
 * Combines all configuration options for the CLI.
 */
export interface IntegrationConfig {
  /** Configuration version */
  version?: string;
  /** Whether initial setup has been completed */
  initialized?: boolean;
  /** Client/organization name (stored in uppercase) */
  clientName?: string;
  /** Git configuration */
  git?: GitConfig;
  /** Jira configuration */
  jira?: JiraConfig;
  /** Linear configuration */
  linear?: LinearConfig;
  /** Notion configuration */
  notion?: NotionConfig;
  /** Scheduler configuration */
  scheduler?: SchedulerConfig;
  /** List of repository paths to track */
  repositories?: string[];
  /** ISO date of last scheduled run */
  lastRun?: string;
}

/**
 * Configuration status information.
 * Provides a summary of what's configured and from where.
 */
export interface ConfigStatus {
  /** Whether initial setup has been completed */
  initialized: boolean;
  /** Client/organization name */
  clientName?: string;
  /** Git configuration status */
  git: { configured: boolean; username?: string; email?: string; mainBranch?: string };
  /** Jira configuration status */
  jira: { configured: boolean; url?: string; email?: string; source?: 'env' | 'file' };
  /** Linear configuration status */
  linear: { configured: boolean; source?: 'env' | 'file' };
  /** Notion configuration status */
  notion: { configured: boolean; enabled?: boolean; source?: 'env' | 'file' };
  /** Scheduler status */
  scheduler: { enabled: boolean; interval?: string };
  /** Number of configured repositories */
  repositories: number;
}

// ==========================================
// Config Paths
// ==========================================

const CONFIG_DIR = join(homedir(), '.xseed-metrics');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const DATA_DIR = join(CONFIG_DIR, 'data');
const LOGS_DIR = join(CONFIG_DIR, 'logs');

// ==========================================
// Ensure directories exist
// ==========================================

/**
 * Ensures that all required configuration directories exist.
 * Creates directories if they don't exist and sets appropriate permissions.
 */
export function ensureConfigDirs(): void {
  [CONFIG_DIR, DATA_DIR, LOGS_DIR].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: CONFIG.CONFIG_DIR_PERMISSIONS });
    }
    // Ensure permissions are set even if directory already exists
    try {
      chmodSync(dir, CONFIG.CONFIG_DIR_PERMISSIONS);
    } catch {
      // Permission change might fail on some systems, but we continue
    }
  });
}

// ==========================================
// Read Configuration
// ==========================================

/**
 * Reads the configuration file from disk.
 * Returns an empty object if the file doesn't exist or can't be read.
 * 
 * @returns Configuration object from file
 * @private
 */
function readConfigFile(): IntegrationConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      const content = readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error: unknown) {
    // Log error but don't crash - return empty config
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to read config file: ${errorMessage}`);
  }
  return {};
}

/**
 * Reads configuration from environment variables.
 * Environment variables take precedence over file configuration.
 * 
 * @returns Partial configuration from environment
 * @private
 */
function getEnvConfig(): Partial<IntegrationConfig> {
  const config: Partial<IntegrationConfig> = {};
  
  // Git from env
  if (process.env.GDM_GIT_USERNAME || process.env.GDM_GIT_EMAIL) {
    config.git = {
      username: process.env.GDM_GIT_USERNAME || '',
      email: process.env.GDM_GIT_EMAIL || '',
      mainBranch: process.env.GDM_MAIN_BRANCH || 'main',
    };
  }

  // Jira from env
  if (process.env.JIRA_URL && process.env.JIRA_EMAIL && process.env.JIRA_TOKEN) {
    config.jira = {
      url: process.env.JIRA_URL,
      email: process.env.JIRA_EMAIL,
      token: process.env.JIRA_TOKEN,
    };
  }

  // Linear from env
  if (process.env.LINEAR_API_KEY) {
    config.linear = { apiKey: process.env.LINEAR_API_KEY };
  }

  // Notion from env
  if (process.env.NOTION_API_KEY && process.env.NOTION_PARENT_PAGE_ID) {
    config.notion = {
      enabled: true,
      apiKey: process.env.NOTION_API_KEY,
      parentPageId: process.env.NOTION_PARENT_PAGE_ID,
      clientName: process.env.NOTION_CLIENT_NAME,
      autoUploadOnSchedule: process.env.NOTION_AUTO_UPLOAD === 'true',
    };
  }

  return config;
}

/**
 * Gets the complete configuration by merging file and environment sources.
 * Environment variables take precedence over file configuration.
 * 
 * @returns Complete configuration object
 */
export function getConfig(): IntegrationConfig {
  const fileConfig = readConfigFile();
  const envConfig = getEnvConfig();
  return {
    ...fileConfig,
    git: envConfig.git || fileConfig.git,
    jira: envConfig.jira || fileConfig.jira,
    linear: envConfig.linear || fileConfig.linear,
    notion: envConfig.notion || fileConfig.notion,
  };
}

/**
 * Gets Git configuration if properly configured.
 * 
 * @returns Git configuration or null if not properly configured
 */
export function getGitConfig(): GitConfig | null {
  const config = getConfig();
  return config.git?.username && config.git?.email ? config.git : null;
}

/**
 * Gets Jira configuration if properly configured.
 * 
 * @returns Jira configuration or null if not properly configured
 */
export function getJiraConfig(): JiraConfig | null {
  const config = getConfig();
  return config.jira?.url && config.jira?.email && config.jira?.token ? config.jira : null;
}

/**
 * Gets Linear configuration if properly configured.
 * 
 * @returns Linear configuration or null if not properly configured
 */
export function getLinearConfig(): LinearConfig | null {
  const config = getConfig();
  return config.linear?.apiKey ? config.linear : null;
}

/**
 * Gets Notion configuration if properly configured.
 * 
 * @returns Notion configuration or null if not properly configured
 */
export function getNotionConfig(): NotionConfig | null {
  const config = getConfig();
  return config.notion?.enabled && config.notion?.apiKey && config.notion?.parentPageId ? config.notion : null;
}

/**
 * Checks if the CLI has been initialized with basic configuration.
 * 
 * @returns True if initialized, false otherwise
 */
export function isInitialized(): boolean {
  const config = getConfig();
  return config.initialized === true;
}

/**
 * Gets a detailed status of all configuration options.
 * Shows which integrations are configured and their sources.
 * 
 * @returns Configuration status object
 */
export function getConfigStatus(): ConfigStatus {
  const fileConfig = readConfigFile();
  const envConfig = getEnvConfig();
  const config = getConfig();

  return {
    initialized: config.initialized === true,
    clientName: config.clientName,
    git: {
      configured: !!(config.git?.username && config.git?.email),
      username: config.git?.username,
      email: config.git?.email,
      mainBranch: config.git?.mainBranch,
    },
    jira: {
      configured: !!(config.jira?.url && config.jira?.token),
      url: config.jira?.url,
      email: config.jira?.email,
      source: envConfig.jira ? 'env' : fileConfig.jira ? 'file' : undefined,
    },
    linear: {
      configured: !!config.linear?.apiKey,
      source: envConfig.linear ? 'env' : fileConfig.linear ? 'file' : undefined,
    },
    notion: {
      configured: !!(config.notion?.enabled && config.notion?.apiKey && config.notion?.parentPageId),
      enabled: config.notion?.enabled,
      source: envConfig.notion ? 'env' : fileConfig.notion ? 'file' : undefined,
    },
    scheduler: {
      enabled: config.scheduler?.enabled || false,
      interval: config.scheduler?.interval,
    },
    repositories: config.repositories?.length || 0,
  };
}

// ==========================================
// Write Configuration
// ==========================================

/**
 * Validates configuration before saving
 * @param config - Configuration to validate
 * @throws Error if validation fails
 * @private
 */
function validateConfig(config: Partial<IntegrationConfig>): void {
  // Validate Jira config
  if (config.jira) {
    const urlResult = validateUrl(config.jira.url);
    if (!urlResult.valid) {
      throw new Error(`Invalid Jira URL: ${urlResult.error}`);
    }

    const emailResult = validateEmail(config.jira.email);
    if (!emailResult.valid) {
      throw new Error(`Invalid Jira email: ${emailResult.error}`);
    }

    const tokenResult = validateApiKey(config.jira.token);
    if (!tokenResult.valid) {
      throw new Error(`Invalid Jira token: ${tokenResult.error}`);
    }
  }

  // Validate Linear config
  if (config.linear) {
    const apiKeyResult = validateApiKey(config.linear.apiKey);
    if (!apiKeyResult.valid) {
      throw new Error(`Invalid Linear API key: ${apiKeyResult.error}`);
    }
  }

  // Validate Notion config
  if (config.notion) {
    const apiKeyResult = validateApiKey(config.notion.apiKey);
    if (!apiKeyResult.valid) {
      throw new Error(`Invalid Notion API key: ${apiKeyResult.error}`);
    }

    // ParentPageId should be non-empty
    if (!config.notion.parentPageId || config.notion.parentPageId.trim().length === 0) {
      throw new Error('Notion parent page ID is required');
    }
  }

  // Validate Git config
  if (config.git) {
    if (config.git.email) {
      const emailResult = validateEmail(config.git.email);
      if (!emailResult.valid) {
        throw new Error(`Invalid Git email: ${emailResult.error}`);
      }
    }

    if (config.git.mainBranch) {
      const branchResult = validateBranchName(config.git.mainBranch);
      if (!branchResult.valid) {
        throw new Error(`Invalid Git branch name: ${branchResult.error}`);
      }
    }
  }

  // Validate Scheduler config
  if (config.scheduler) {
    if (config.scheduler.time) {
      const timeResult = validateTimeFormat(config.scheduler.time);
      if (!timeResult.valid) {
        throw new Error(`Invalid scheduler time: ${timeResult.error}`);
      }
    }

    if (config.scheduler.dayOfWeek !== undefined) {
      const dayResult = validateDayOfWeek(config.scheduler.dayOfWeek);
      if (!dayResult.valid) {
        throw new Error(`Invalid scheduler day of week: ${dayResult.error}`);
      }
    }
  }

  // Validate repositories
  if (config.repositories) {
    for (const repo of config.repositories) {
      const pathResult = validateFilePath(repo);
      if (!pathResult.valid) {
        throw new Error(`Invalid repository path: ${pathResult.error}`);
      }
    }
  }
}

/**
 * Saves configuration to disk.
 * Merges with existing configuration, validates, and sets file permissions.
 * 
 * @param config - Partial configuration to save
 * @throws Error if validation fails or file cannot be written
 */
export function saveConfig(config: Partial<IntegrationConfig>): void {
  // Validate configuration before saving
  validateConfig(config);

  ensureConfigDirs();
  const existing = readConfigFile();
  const newConfig = { ...existing, ...config, version: CONFIG.VERSION };
  
  // Write config file
  writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
  
  // Set restrictive file permissions (user read/write only)
  try {
    chmodSync(CONFIG_FILE, CONFIG.CONFIG_FILE_PERMISSIONS);
  } catch (error: unknown) {
    // Log warning but don't fail if permissions can't be set
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`Warning: Could not set config file permissions: ${errorMessage}`);
  }
}

/**
 * Sets Git configuration.
 * 
 * @param gitConfig - Git configuration to save
 */
export function setGitConfig(gitConfig: GitConfig): void {
  saveConfig({ git: gitConfig });
}

/**
 * Sets Jira configuration.
 * 
 * @param jiraConfig - Jira configuration to save
 */
export function setJiraConfig(jiraConfig: JiraConfig): void {
  saveConfig({ jira: jiraConfig });
}

/**
 * Sets Linear configuration.
 * 
 * @param linearConfig - Linear configuration to save
 */
export function setLinearConfig(linearConfig: LinearConfig): void {
  saveConfig({ linear: linearConfig });
}

/**
 * Sets Notion configuration.
 * 
 * @param notionConfig - Notion configuration to save
 */
export function setNotionConfig(notionConfig: NotionConfig): void {
  saveConfig({ notion: notionConfig });
}

/**
 * Sets scheduler configuration.
 * 
 * @param schedulerConfig - Scheduler configuration to save
 */
export function setSchedulerConfig(schedulerConfig: SchedulerConfig): void {
  saveConfig({ scheduler: schedulerConfig });
}

/**
 * Adds a repository to the tracked repositories list.
 * Does nothing if the repository is already in the list.
 * 
 * @param repoPath - Path to the repository to add
 */
export function addRepository(repoPath: string): void {
  const config = getConfig();
  const repos = config.repositories || [];
  if (!repos.includes(repoPath)) {
    repos.push(repoPath);
    saveConfig({ repositories: repos });
  }
}

/**
 * Removes a repository from the tracked repositories list.
 * 
 * @param repoPath - Path to the repository to remove
 */
export function removeRepository(repoPath: string): void {
  const config = getConfig();
  const repos = (config.repositories || []).filter(r => r !== repoPath);
  saveConfig({ repositories: repos });
}

/**
 * Marks the configuration as initialized.
 * Called after the initial setup wizard completes.
 */
export function markInitialized(): void {
  saveConfig({ initialized: true });
}

/**
 * Updates the last run timestamp to the current time.
 * Called after each scheduled collection.
 */
export function updateLastRun(): void {
  saveConfig({ lastRun: new Date().toISOString() });
}

// ==========================================
// Paths
// ==========================================

/**
 * Gets the path to the configuration file.
 * @returns Absolute path to config.json
 */
export function getConfigFilePath(): string { return CONFIG_FILE; }

/**
 * Gets the configuration directory path.
 * @returns Absolute path to ~/.xseed-metrics/
 */
export function getConfigDir(): string { return CONFIG_DIR; }

/**
 * Gets the data directory path.
 * @returns Absolute path to ~/.xseed-metrics/data/
 */
export function getDataDir(): string { return DATA_DIR; }

/**
 * Gets the logs directory path.
 * @returns Absolute path to ~/.xseed-metrics/logs/
 */
export function getLogsDir(): string { return LOGS_DIR; }

/**
 * Checks if the configuration file exists.
 * @returns True if config file exists, false otherwise
 */
export function configFileExists(): boolean { return existsSync(CONFIG_FILE); }

