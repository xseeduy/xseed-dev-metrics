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
 * Configuration for a single client.
 * Each client has its own repositories and integration settings.
 */
export interface ClientConfig {
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
  repositories: string[];
  /** ISO date of last scheduled run */
  lastRun?: string;
}

/**
 * Multi-client configuration structure.
 * Supports multiple clients with separate configurations.
 */
export interface MultiClientConfig {
  /** Configuration version */
  version: string;
  /** Whether initial setup has been completed */
  initialized: boolean;
  /** Currently active client name */
  activeClient?: string;
  /** Map of client names to their configurations */
  clients: Record<string, ClientConfig>;
}

/**
 * @deprecated Legacy single-client configuration (for reference only)
 */
export interface IntegrationConfig {
  version?: string;
  initialized?: boolean;
  clientName?: string;
  git?: GitConfig;
  jira?: JiraConfig;
  linear?: LinearConfig;
  notion?: NotionConfig;
  scheduler?: SchedulerConfig;
  repositories?: string[];
  lastRun?: string;
}

/**
 * Status information for a single client.
 */
export interface ClientStatus {
  /** Client name */
  name: string;
  /** Whether this is the active client */
  active: boolean;
  /** Number of repositories */
  repositories: number;
  /** Git configuration status */
  git: { configured: boolean; username?: string; email?: string; mainBranch?: string };
  /** Jira configuration status */
  jira: { configured: boolean; url?: string; email?: string };
  /** Linear configuration status */
  linear: { configured: boolean };
  /** Notion configuration status */
  notion: { configured: boolean; enabled?: boolean };
  /** Scheduler status */
  scheduler: { enabled: boolean; interval?: string };
}

/**
 * Configuration status information for all clients.
 * Provides a summary of what's configured across all clients.
 */
export interface ConfigStatus {
  /** Whether initial setup has been completed */
  initialized: boolean;
  /** Active client name */
  activeClient?: string;
  /** List of all clients */
  clients: ClientStatus[];
  /** Total number of clients */
  totalClients: number;
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
 * Reads the multi-client configuration file from disk.
 * Returns an initialized empty config if the file doesn't exist or can't be read.
 * 
 * @returns Multi-client configuration object from file
 * @private
 */
function readConfigFile(): MultiClientConfig {
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
  return {
    version: CONFIG.VERSION,
    initialized: false,
    clients: {},
  };
}

/**
 * Reads configuration overrides from environment variables for a client.
 * Environment variables take precedence over file configuration.
 * 
 * @returns Partial client configuration from environment
 * @private
 */
function getEnvConfigOverrides(): Partial<ClientConfig> {
  const config: Partial<ClientConfig> = {};
  
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
 * Gets the full multi-client configuration.
 * 
 * @returns Multi-client configuration object
 */
export function getFullConfig(): MultiClientConfig {
  return readConfigFile();
}

/**
 * Gets the currently active client name.
 * 
 * @returns Active client name or null if none set
 */
export function getActiveClient(): string | null {
  const config = readConfigFile();
  return config.activeClient || null;
}

/**
 * Gets all configured client names.
 * 
 * @returns Array of client names
 */
export function getAllClients(): string[] {
  const config = readConfigFile();
  return Object.keys(config.clients);
}

/**
 * Gets configuration for the active client.
 * Environment variables override file configuration.
 * 
 * @returns Active client's configuration or null if no active client
 */
export function getConfig(): ClientConfig | null {
  const fullConfig = readConfigFile();
  const activeClient = fullConfig.activeClient;
  
  if (!activeClient || !fullConfig.clients[activeClient]) {
    return null;
  }
  
  const clientConfig = fullConfig.clients[activeClient];
  const envOverrides = getEnvConfigOverrides();
  
  return {
    ...clientConfig,
    git: envOverrides.git || clientConfig.git,
    jira: envOverrides.jira || clientConfig.jira,
    linear: envOverrides.linear || clientConfig.linear,
    notion: envOverrides.notion || clientConfig.notion,
  };
}

/**
 * Gets configuration for a specific client.
 * 
 * @param clientName - Name of the client
 * @returns Client configuration or null if client doesn't exist
 */
export function getClientConfig(clientName: string): ClientConfig | null {
  const fullConfig = readConfigFile();
  return fullConfig.clients[clientName] || null;
}

/**
 * Gets Git configuration for active client if properly configured.
 * 
 * @returns Git configuration or null if not properly configured
 */
export function getGitConfig(): GitConfig | null {
  const config = getConfig();
  if (!config) return null;
  return config.git?.username && config.git?.email ? config.git : null;
}

/**
 * Gets Jira configuration for active client if properly configured.
 * 
 * @returns Jira configuration or null if not properly configured
 */
export function getJiraConfig(): JiraConfig | null {
  const config = getConfig();
  if (!config) return null;
  return config.jira?.url && config.jira?.email && config.jira?.token ? config.jira : null;
}

/**
 * Gets Linear configuration for active client if properly configured.
 * 
 * @returns Linear configuration or null if not properly configured
 */
export function getLinearConfig(): LinearConfig | null {
  const config = getConfig();
  if (!config) return null;
  return config.linear?.apiKey ? config.linear : null;
}

/**
 * Gets Notion configuration for active client if properly configured.
 * 
 * @returns Notion configuration or null if not properly configured
 */
export function getNotionConfig(): NotionConfig | null {
  const config = getConfig();
  if (!config) return null;
  return config.notion?.enabled && config.notion?.apiKey && config.notion?.parentPageId ? config.notion : null;
}

/**
 * Checks if the CLI has been initialized with at least one client.
 * 
 * @returns True if initialized, false otherwise
 */
export function isInitialized(): boolean {
  const fullConfig = readConfigFile();
  return fullConfig.initialized === true && Object.keys(fullConfig.clients).length > 0;
}

/**
 * Checks if a specific client exists.
 * 
 * @param clientName - Name of the client to check
 * @returns True if client exists, false otherwise
 */
export function clientExists(clientName: string): boolean {
  const fullConfig = readConfigFile();
  return !!fullConfig.clients[clientName];
}

/**
 * Switches the active client.
 * 
 * @param clientName - Name of the client to switch to
 * @throws Error if client doesn't exist
 */
export function switchClient(clientName: string): void {
  const fullConfig = readConfigFile();
  
  if (!fullConfig.clients[clientName]) {
    throw new Error(`Client '${clientName}' does not exist`);
  }
  
  fullConfig.activeClient = clientName;
  writeConfigFile(fullConfig);
}

/**
 * Adds or updates a client configuration.
 * 
 * @param clientName - Name of the client
 * @param config - Client configuration
 * @param setActive - Whether to set this client as active (default: true)
 */
export function addClient(clientName: string, config: ClientConfig, setActive: boolean = true): void {
  const fullConfig = readConfigFile();
  
  fullConfig.clients[clientName] = config;
  fullConfig.initialized = true;
  
  if (setActive || !fullConfig.activeClient) {
    fullConfig.activeClient = clientName;
  }
  
  writeConfigFile(fullConfig);
}

/**
 * Removes a client from configuration.
 * If removing the active client, switches to another client or clears active client.
 * 
 * @param clientName - Name of the client to remove
 * @returns True if client was removed, false if it didn't exist
 */
export function removeClient(clientName: string): boolean {
  const fullConfig = readConfigFile();
  
  if (!fullConfig.clients[clientName]) {
    return false;
  }
  
  delete fullConfig.clients[clientName];
  
  // If removing active client, switch to another or clear
  if (fullConfig.activeClient === clientName) {
    const remainingClients = Object.keys(fullConfig.clients);
    fullConfig.activeClient = remainingClients.length > 0 ? remainingClients[0] : undefined;
  }
  
  // If no clients left, mark as uninitialized
  if (Object.keys(fullConfig.clients).length === 0) {
    fullConfig.initialized = false;
  }
  
  writeConfigFile(fullConfig);
  return true;
}

/**
 * Gets a detailed status of all clients and their configurations.
 * 
 * @returns Configuration status object with all clients
 */
export function getConfigStatus(): ConfigStatus {
  const fullConfig = readConfigFile();
  const activeClientName = fullConfig.activeClient;
  
  const clients: ClientStatus[] = Object.entries(fullConfig.clients).map(([name, config]) => {
    return {
      name,
      active: name === activeClientName,
      repositories: config.repositories.length,
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
      },
      linear: {
        configured: !!config.linear?.apiKey,
      },
      notion: {
        configured: !!(config.notion?.enabled && config.notion?.apiKey && config.notion?.parentPageId),
        enabled: config.notion?.enabled,
      },
      scheduler: {
        enabled: config.scheduler?.enabled || false,
        interval: config.scheduler?.interval,
      },
    };
  });

  return {
    initialized: fullConfig.initialized,
    activeClient: activeClientName,
    clients,
    totalClients: clients.length,
  };
}

// ==========================================
// Write Configuration
// ==========================================

/**
 * Writes the multi-client configuration file to disk.
 * 
 * @param config - Multi-client configuration to write
 * @private
 */
function writeConfigFile(config: MultiClientConfig): void {
  ensureConfigDirs();
  
  // Write config file
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  
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
 * Validates client configuration before saving
 * @param config - Client configuration to validate
 * @throws Error if validation fails
 * @private
 */
function validateClientConfig(config: Partial<ClientConfig>): void {
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
 * Saves configuration for the active client.
 * Merges with existing client configuration.
 * 
 * @param config - Partial client configuration to save
 * @throws Error if validation fails, no active client, or file cannot be written
 */
export function saveConfig(config: Partial<ClientConfig>): void {
  const fullConfig = readConfigFile();
  const activeClient = fullConfig.activeClient;
  
  if (!activeClient) {
    throw new Error('No active client. Run `gdm init` to create a client first.');
  }
  
  // Validate configuration before saving
  validateClientConfig(config);
  
  // Get existing client config or create new one
  const existingClientConfig = fullConfig.clients[activeClient] || { repositories: [] };
  const newClientConfig: ClientConfig = {
    ...existingClientConfig,
    ...config,
    repositories: config.repositories ?? existingClientConfig.repositories,
  };
  
  fullConfig.clients[activeClient] = newClientConfig;
  writeConfigFile(fullConfig);
}

/**
 * Saves configuration for a specific client.
 * 
 * @param clientName - Name of the client
 * @param config - Partial client configuration to save
 * @throws Error if validation fails or client doesn't exist
 */
export function saveClientConfig(clientName: string, config: Partial<ClientConfig>): void {
  const fullConfig = readConfigFile();
  
  if (!fullConfig.clients[clientName]) {
    throw new Error(`Client '${clientName}' does not exist`);
  }
  
  validateClientConfig(config);
  
  const existingClientConfig = fullConfig.clients[clientName];
  fullConfig.clients[clientName] = {
    ...existingClientConfig,
    ...config,
    repositories: config.repositories ?? existingClientConfig.repositories,
  };
  
  writeConfigFile(fullConfig);
}

/**
 * Sets Git configuration for active client.
 * 
 * @param gitConfig - Git configuration to save
 */
export function setGitConfig(gitConfig: GitConfig): void {
  saveConfig({ git: gitConfig });
}

/**
 * Sets Jira configuration for active client.
 * 
 * @param jiraConfig - Jira configuration to save
 */
export function setJiraConfig(jiraConfig: JiraConfig): void {
  saveConfig({ jira: jiraConfig });
}

/**
 * Sets Linear configuration for active client.
 * 
 * @param linearConfig - Linear configuration to save
 */
export function setLinearConfig(linearConfig: LinearConfig): void {
  saveConfig({ linear: linearConfig });
}

/**
 * Sets Notion configuration for active client.
 * 
 * @param notionConfig - Notion configuration to save
 */
export function setNotionConfig(notionConfig: NotionConfig): void {
  saveConfig({ notion: notionConfig });
}

/**
 * Sets scheduler configuration for active client.
 * 
 * @param schedulerConfig - Scheduler configuration to save
 */
export function setSchedulerConfig(schedulerConfig: SchedulerConfig): void {
  saveConfig({ scheduler: schedulerConfig });
}

/**
 * Adds a repository to the active client's tracked repositories list.
 * Does nothing if the repository is already in the list.
 * 
 * @param repoPath - Path to the repository to add
 */
export function addRepository(repoPath: string): void {
  const config = getConfig();
  if (!config) {
    throw new Error('No active client. Run `gdm init` first.');
  }
  
  const repos = config.repositories || [];
  if (!repos.includes(repoPath)) {
    repos.push(repoPath);
    saveConfig({ repositories: repos });
  }
}

/**
 * Adds a repository to a specific client's tracked repositories list.
 * 
 * @param clientName - Name of the client
 * @param repoPath - Path to the repository to add
 */
export function addRepositoryToClient(clientName: string, repoPath: string): void {
  const clientConfig = getClientConfig(clientName);
  if (!clientConfig) {
    throw new Error(`Client '${clientName}' does not exist`);
  }
  
  const repos = clientConfig.repositories || [];
  if (!repos.includes(repoPath)) {
    repos.push(repoPath);
    saveClientConfig(clientName, { repositories: repos });
  }
}

/**
 * Removes a repository from the active client's tracked repositories list.
 * 
 * @param repoPath - Path to the repository to remove
 */
export function removeRepository(repoPath: string): void {
  const config = getConfig();
  if (!config) {
    throw new Error('No active client');
  }
  
  const repos = config.repositories.filter(r => r !== repoPath);
  saveConfig({ repositories: repos });
}

/**
 * Finds which client(s) a repository belongs to.
 * 
 * @param repoPath - Path to the repository
 * @returns Array of client names that have this repository
 */
export function findRepositoryOwners(repoPath: string): string[] {
  const fullConfig = readConfigFile();
  const owners: string[] = [];
  
  for (const [clientName, config] of Object.entries(fullConfig.clients)) {
    if (config.repositories.includes(repoPath)) {
      owners.push(clientName);
    }
  }
  
  return owners;
}

/**
 * Updates the last run timestamp for the active client.
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
export function getConfigFilePath(): string { 
  return CONFIG_FILE; 
}

/**
 * Gets the configuration directory path.
 * @returns Absolute path to ~/.xseed-metrics/
 */
export function getConfigDir(): string { 
  return CONFIG_DIR; 
}

/**
 * Gets the data directory path for a specific client or active client.
 * Creates the directory if it doesn't exist.
 * 
 * @param clientName - Optional client name (defaults to active client)
 * @returns Absolute path to ~/.xseed-metrics/data/CLIENT_NAME/
 */
export function getDataDir(clientName?: string): string {
  const client = clientName || getActiveClient();
  
  if (!client) {
    // Fallback to root data dir if no client specified/active
    return DATA_DIR;
  }
  
  const clientDataDir = join(DATA_DIR, client);
  
  // Ensure directory exists
  if (!existsSync(clientDataDir)) {
    mkdirSync(clientDataDir, { recursive: true, mode: CONFIG.CONFIG_DIR_PERMISSIONS });
  }
  
  return clientDataDir;
}

/**
 * Gets the logs directory path for a specific client or active client.
 * Creates the directory if it doesn't exist.
 * 
 * @param clientName - Optional client name (defaults to active client)
 * @returns Absolute path to ~/.xseed-metrics/logs/CLIENT_NAME/
 */
export function getLogsDir(clientName?: string): string {
  const client = clientName || getActiveClient();
  
  if (!client) {
    // Fallback to root logs dir if no client specified/active
    return LOGS_DIR;
  }
  
  const clientLogsDir = join(LOGS_DIR, client);
  
  // Ensure directory exists
  if (!existsSync(clientLogsDir)) {
    mkdirSync(clientLogsDir, { recursive: true, mode: CONFIG.CONFIG_DIR_PERMISSIONS });
  }
  
  return clientLogsDir;
}

/**
 * Checks if the configuration file exists.
 * @returns True if config file exists, false otherwise
 */
export function configFileExists(): boolean { 
  return existsSync(CONFIG_FILE); 
}

