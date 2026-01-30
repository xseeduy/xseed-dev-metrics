// ============================================
// Notion Client - Upload Metrics to Notion
// ============================================

import { Client } from '@notionhq/client';
import { readFileSync } from 'fs';
import { format } from 'date-fns';
import { NotionConfig } from '../../config/integrations';

interface CollectedData {
  collectedAt: string;
  fileName?: string;
  period?: {
    since: string | null;
    until: string | null;
    label: string;
  };
  repository: string;
  repoName: string;
  user: { username: string; email: string };
  gitMetrics: unknown;
  jiraMetrics?: unknown;
}

export class NotionClient {
  private client: Client;
  private config: NotionConfig;
  private pageCache: Map<string, string> = new Map();

  constructor(config: NotionConfig) {
    this.config = config;
    this.client = new Client({ auth: config.apiKey });
  }

  /**
   * Test Notion connection
   */
  async testConnection(): Promise<{ success: boolean; user?: string; error?: string }> {
    try {
      const response = await this.client.users.me({});
      const user = (response as any).name || (response as any).bot?.owner?.user?.name || 'Bot';
      return { success: true, user };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Ensure "Git Metrics" root page exists under parent
   */
  private async ensureGitMetricsPage(): Promise<string> {
    const cacheKey = `git-metrics:${this.config.parentPageId}`;
    if (this.pageCache.has(cacheKey)) {
      return this.pageCache.get(cacheKey)!;
    }

    // Search for existing "Git Metrics" page
    try {
      const searchResults = await this.client.search({
        query: 'Git Metrics',
        filter: { property: 'object', value: 'page' },
      });

      for (const result of searchResults.results) {
        if (result.object === 'page' && 'parent' in result) {
          const parent = result.parent as any;
          if (parent.type === 'page_id' && parent.page_id === this.config.parentPageId) {
            const pageId = result.id;
            this.pageCache.set(cacheKey, pageId);
            return pageId;
          }
        }
      }
    } catch {}

    // Create new "Git Metrics" page
    const response = await this.client.pages.create({
      parent: { page_id: this.config.parentPageId },
      properties: {
        title: {
          title: [{ text: { content: 'Git Metrics' } }],
        },
      },
    });

    const pageId = response.id;
    this.pageCache.set(cacheKey, pageId);
    return pageId;
  }

  /**
   * Ensure ClientName page exists under Git Metrics
   */
  private async ensureClientPage(gitMetricsPageId: string, clientName: string): Promise<string> {
    const cacheKey = `client:${gitMetricsPageId}:${clientName}`;
    if (this.pageCache.has(cacheKey)) {
      return this.pageCache.get(cacheKey)!;
    }

    // Search for existing client page
    try {
      const response = await this.client.blocks.children.list({
        block_id: gitMetricsPageId,
      });

      for (const block of response.results) {
        if ('type' in block && block.type === 'child_page' && 'child_page' in block) {
          const title = (block as any).child_page?.title;
          if (title === clientName) {
            const pageId = block.id;
            this.pageCache.set(cacheKey, pageId);
            return pageId;
          }
        }
      }
    } catch {}

    // Create new client page
    const response = await this.client.pages.create({
      parent: { page_id: gitMetricsPageId },
      properties: {
        title: {
          title: [{ text: { content: clientName } }],
        },
      },
    });

    const pageId = response.id;
    this.pageCache.set(cacheKey, pageId);
    return pageId;
  }

  /**
   * Ensure user page exists under ClientName
   */
  private async ensureUserPage(clientPageId: string, username: string): Promise<string> {
    const cacheKey = `user:${clientPageId}:${username}`;
    if (this.pageCache.has(cacheKey)) {
      return this.pageCache.get(cacheKey)!;
    }

    // Search for existing user page
    try {
      const response = await this.client.blocks.children.list({
        block_id: clientPageId,
      });

      for (const block of response.results) {
        if ('type' in block && block.type === 'child_page' && 'child_page' in block) {
          const title = (block as any).child_page?.title;
          if (title === username) {
            const pageId = block.id;
            this.pageCache.set(cacheKey, pageId);
            return pageId;
          }
        }
      }
    } catch {}

    // Create new user page
    const response = await this.client.pages.create({
      parent: { page_id: clientPageId },
      properties: {
        title: {
          title: [{ text: { content: username } }],
        },
      },
    });

    const pageId = response.id;
    this.pageCache.set(cacheKey, pageId);
    return pageId;
  }

  /**
   * Create a date page with JSON content
   */
  private async createDatePage(
    userPageId: string,
    dateStr: string,
    data: CollectedData,
    filePath: string
  ): Promise<string> {
    // Read JSON file
    const jsonContent = readFileSync(filePath, 'utf-8');
    
    // Create page with date as title
    const response = await this.client.pages.create({
      parent: { page_id: userPageId },
      properties: {
        title: {
          title: [{ text: { content: dateStr } }],
        },
      },
      children: [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [
              {
                type: 'text',
                text: { content: `${data.repoName} - ${data.period?.label || 'Metrics'}` },
              },
            ],
          },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: { content: `Collected: ${format(new Date(data.collectedAt), 'yyyy-MM-dd HH:mm:ss')}` },
              },
            ],
          },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: { content: `User: ${data.user.username} (${data.user.email})` },
              },
            ],
          },
        },
        {
          object: 'block',
          type: 'divider',
          divider: {},
        },
        {
          object: 'block',
          type: 'code',
          code: {
            rich_text: [
              {
                type: 'text',
                text: { content: jsonContent.length > 2000 ? jsonContent.substring(0, 2000) + '\n\n... (truncated)' : jsonContent },
              },
            ],
            language: 'json',
          },
        },
      ],
    });

    return response.id;
  }

  /**
   * Upload a collected metrics file to Notion
   */
  async uploadCollectedFile(filePath: string, data: CollectedData): Promise<void> {
    // Determine client name
    const clientName = this.config.clientName || data.repoName;

    // Get date string
    const dateStr = format(new Date(data.collectedAt), 'yyyy-MM-dd');

    // Ensure hierarchy exists
    const gitMetricsPageId = await this.ensureGitMetricsPage();
    const clientPageId = await this.ensureClientPage(gitMetricsPageId, clientName);
    const userPageId = await this.ensureUserPage(clientPageId, data.user.username);

    // Create date page
    await this.createDatePage(userPageId, dateStr, data, filePath);
  }

  /**
   * Upload multiple collected files
   */
  async uploadCollectedFiles(files: Array<{ path: string; data: CollectedData }>): Promise<number> {
    let uploaded = 0;
    for (const file of files) {
      try {
        await this.uploadCollectedFile(file.path, file.data);
        uploaded++;
      } catch (error: unknown) {
        console.error(`Failed to upload ${file.path}:`, (error as Error).message);
      }
    }
    return uploaded;
  }
}
