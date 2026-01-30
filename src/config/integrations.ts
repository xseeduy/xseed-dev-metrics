// ============================================
// Integration Configuration Manager
// ============================================

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ==========================================
// Types
// ==========================================

export interface JiraConfig {
  url: string;
  email: string;
  token: string;
}

export interface LinearConfig {
  apiKey: string;
}

export interface NotionConfig {
  enabled: boolean;
  apiKey: string;
  parentPageId: string;
  clientName?: string;
  autoUploadOnSchedule?: boolean;
}

export interface GitConfig {
  username: string;
  email: string;
  mainBranch: string;  // 'main' or 'master'
}

export interface SchedulerConfig {
  enabled: boolean;
  interval: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;  // 0-6 for weekly
  time?: string;       // HH:MM format
}

export interface IntegrationConfig {
  version?: string;
  initialized?: boolean;
  clientName?: string;      // Client/organization name (stored in uppercase)
  git?: GitConfig;
  jira?: JiraConfig;
  linear?: LinearConfig;
  notion?: NotionConfig;
  scheduler?: SchedulerConfig;
  repositories?: string[];  // List of repo paths to track
  lastRun?: string;         // ISO date of last scheduled run
}

export interface ConfigStatus {
  initialized: boolean;
  clientName?: string;
  git: { configured: boolean; username?: string; email?: string; mainBranch?: string };
  jira: { configured: boolean; url?: string; email?: string; source?: 'env' | 'file' };
  linear: { configured: boolean; source?: 'env' | 'file' };
  notion: { configured: boolean; enabled?: boolean; source?: 'env' | 'file' };
  scheduler: { enabled: boolean; interval?: string };
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

export function ensureConfigDirs(): void {
  [CONFIG_DIR, DATA_DIR, LOGS_DIR].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
}

// ==========================================
// Read Configuration
// ==========================================

function readConfigFile(): IntegrationConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

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

export function getGitConfig(): GitConfig | null {
  const config = getConfig();
  return config.git?.username && config.git?.email ? config.git : null;
}

export function getJiraConfig(): JiraConfig | null {
  const config = getConfig();
  return config.jira?.url && config.jira?.email && config.jira?.token ? config.jira : null;
}

export function getLinearConfig(): LinearConfig | null {
  const config = getConfig();
  return config.linear?.apiKey ? config.linear : null;
}

export function getNotionConfig(): NotionConfig | null {
  const config = getConfig();
  return config.notion?.enabled && config.notion?.apiKey && config.notion?.parentPageId ? config.notion : null;
}

export function isInitialized(): boolean {
  const config = getConfig();
  return config.initialized === true;
}

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

export function saveConfig(config: Partial<IntegrationConfig>): void {
  ensureConfigDirs();
  const existing = readConfigFile();
  const newConfig = { ...existing, ...config, version: '1.0.0' };
  writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
}

export function setGitConfig(gitConfig: GitConfig): void {
  saveConfig({ git: gitConfig });
}

export function setJiraConfig(jiraConfig: JiraConfig): void {
  saveConfig({ jira: jiraConfig });
}

export function setLinearConfig(linearConfig: LinearConfig): void {
  saveConfig({ linear: linearConfig });
}

export function setNotionConfig(notionConfig: NotionConfig): void {
  saveConfig({ notion: notionConfig });
}

export function setSchedulerConfig(schedulerConfig: SchedulerConfig): void {
  saveConfig({ scheduler: schedulerConfig });
}

export function addRepository(repoPath: string): void {
  const config = getConfig();
  const repos = config.repositories || [];
  if (!repos.includes(repoPath)) {
    repos.push(repoPath);
    saveConfig({ repositories: repos });
  }
}

export function removeRepository(repoPath: string): void {
  const config = getConfig();
  const repos = (config.repositories || []).filter(r => r !== repoPath);
  saveConfig({ repositories: repos });
}

export function markInitialized(): void {
  saveConfig({ initialized: true });
}

export function updateLastRun(): void {
  saveConfig({ lastRun: new Date().toISOString() });
}

// ==========================================
// Paths
// ==========================================

export function getConfigFilePath(): string { return CONFIG_FILE; }
export function getConfigDir(): string { return CONFIG_DIR; }
export function getDataDir(): string { return DATA_DIR; }
export function getLogsDir(): string { return LOGS_DIR; }
export function configFileExists(): boolean { return existsSync(CONFIG_FILE); }

