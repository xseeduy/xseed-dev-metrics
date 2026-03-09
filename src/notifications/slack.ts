// ============================================
// Slack Notification Client
// ============================================

import { SlackConfig } from '../config/integrations';

const SLACK_API_URL = 'https://slack.com/api';

export interface CollectionSummary {
  clientName: string;
  reposProcessed: number;
  usersCollected: number;
  durationMs: number;
  uploadedToSupabase: boolean;
  trigger: 'manual' | 'scheduled';
  timestamp: string;
}

export interface CollectionError {
  clientName: string;
  phase: string;
  error: string;
  repoPath?: string;
  trigger: 'manual' | 'scheduled';
}

/**
 * Sends DM or channel messages via Slack Bot Token.
 * Uses chat.postMessage with Bot Token (xoxb-).
 */
export class SlackNotifier {
  private botToken: string;
  private defaultChannel?: string;

  constructor(config: SlackConfig) {
    this.botToken = config.botToken;
    this.defaultChannel = config.defaultChannel;
  }

  async testConnection(): Promise<{ success: boolean; botName?: string; error?: string }> {
    try {
      const response = await fetch(`${SLACK_API_URL}/auth.test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json() as { ok: boolean; user?: string; error?: string };

      if (data.ok) {
        return { success: true, botName: data.user };
      }
      return { success: false, error: data.error || 'Unknown error' };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Validates a Slack user ID and sends a welcome message.
   * This method verifies the user exists and has permission to receive messages.
   */
  async validateAndSendWelcome(
    userId: string,
    engineerName: string,
    engineerEmail: string,
    clientName: string
  ): Promise<{ success: boolean; error?: string; displayName?: string }> {
    try {
      // First, verify the user exists with users.info API
      const infoResponse = await fetch(`${SLACK_API_URL}/users.info?user=${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json',
        },
      });

      const infoData = await infoResponse.json() as {
        ok: boolean;
        user?: {
          id: string;
          name: string;
          real_name?: string;
          profile?: {
            display_name?: string;
            real_name?: string;
          };
          is_bot?: boolean;
          deleted?: boolean;
        };
        error?: string;
      };

      if (!infoData.ok) {
        // Map Slack errors to user-friendly messages
        const errorMessages: Record<string, string> = {
          'user_not_found': 'User ID not found in workspace. Check the ID and try again.',
          'invalid_auth': 'Bot token is invalid. Contact administrator.',
          'account_inactive': 'This user account is deactivated.',
          'missing_scope': 'Bot needs users:read permission.',
        };
        return {
          success: false,
          error: errorMessages[infoData.error || ''] || infoData.error || 'Unknown error',
        };
      }

      const user = infoData.user!;

      // Check if user is a bot
      if (user.is_bot) {
        return {
          success: false,
          error: 'Cannot send DM to bot users. Please enter a real user ID.',
        };
      }

      // Check if user is deleted/deactivated
      if (user.deleted) {
        return {
          success: false,
          error: 'This user has been deactivated.',
        };
      }

      // Get display name (prefer display_name, fallback to real_name, then username)
      const displayName = user.profile?.display_name || user.profile?.real_name || user.real_name || user.name;

      // Send welcome message
      const welcomeText = `👋 Welcome to xseed-dev-metrics!`;
      const blocks = [
        {
          type: 'header',
          text: { type: 'plain_text', text: '👋 Welcome to xseed-dev-metrics!' },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: "You've been added to receive automatic notifications when developer metrics are collected.",
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: "*You'll get updates about:*\n• Successful metric collections (with summary)\n• Any errors during collection\n• Collection duration and results",
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Client:*\n${clientName}` },
            { type: 'mrkdwn', text: `*Your profile:*\n${engineerName}` },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Email: ${engineerEmail} | This is a one-time setup message. Future notifications will arrive after each collection run.`,
            },
          ],
        },
      ];

      const messageResult = await this.sendMessage(userId, welcomeText, blocks);

      if (!messageResult.success) {
        // Map message sending errors
        const errorMessages: Record<string, string> = {
          'channel_not_found': 'User not found.',
          'cannot_dm_bot': 'Cannot send DM to bot users.',
          'user_is_restricted': "Bot doesn't have permission to message this user.",
          'restricted_action': "Bot doesn't have permission to message this user.",
        };
        return {
          success: false,
          error: errorMessages[messageResult.error || ''] || messageResult.error || 'Failed to send message',
        };
      }

      return {
        success: true,
        displayName,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: `Network error: ${(error as Error).message}`,
      };
    }
  }

  async sendMessage(
    channel: string,
    text: string,
    blocks?: any[]
  ): Promise<{ success: boolean; ts?: string; error?: string }> {
    try {
      const body: any = { channel, text };
      if (blocks) body.blocks = blocks;

      const response = await fetch(`${SLACK_API_URL}/chat.postMessage`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json() as { ok: boolean; ts?: string; error?: string };

      if (data.ok) {
        return { success: true, ts: data.ts };
      }
      return { success: false, error: data.error || 'Failed to send message' };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  }

  async sendCollectionSummary(
    channel: string | undefined,
    summary: {
      clientName: string;
      reposProcessed: number;
      usersCollected: number;
      uploadedToSupabase: boolean;
      errors: string[];
      trigger: 'manual' | 'scheduled';
    }
  ): Promise<{ success: boolean; error?: string }> {
    const targetChannel = channel || this.defaultChannel;
    if (!targetChannel) {
      return { success: false, error: 'No channel specified and no default channel configured' };
    }

    const hasErrors = summary.errors.length > 0;
    const status = hasErrors ? 'Partial (with errors)' : 'Success';
    const statusEmoji = hasErrors ? ':warning:' : ':white_check_mark:';
    const triggerLabel = summary.trigger === 'scheduled' ? 'Scheduled' : 'Manual';

    const text = `Metrics collection ${status.toLowerCase()} for ${summary.clientName}`;

    const blocks: any[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${statusEmoji} Metrics Collection ${status}` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Client:*\n${summary.clientName}` },
          { type: 'mrkdwn', text: `*Trigger:*\n${triggerLabel}` },
          { type: 'mrkdwn', text: `*Repos:*\n${summary.reposProcessed}` },
          { type: 'mrkdwn', text: `*Users:*\n${summary.usersCollected}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: summary.uploadedToSupabase
            ? ':cloud: Uploaded to Supabase'
            : ':file_folder: Saved locally only',
        },
      },
    ];

    if (hasErrors) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Errors:*\n${summary.errors.map(e => `- ${e}`).join('\n')}`,
        },
      });
    }

    return this.sendMessage(targetChannel, text, blocks);
  }

  /**
   * Send a success notification to a specific user after metrics collection.
   */
  async sendSuccessNotification(
    userId: string,
    summary: CollectionSummary
  ): Promise<{ success: boolean; error?: string }> {
    const durationSeconds = Math.round(summary.durationMs / 1000);
    const triggerLabel = summary.trigger === 'scheduled' ? 'Scheduled' : 'Manual';
    
    const text = `✅ Metrics collection complete for ${summary.clientName}`;
    
    const blocks: any[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '✅ Metrics Collection Complete' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Client:*\n${summary.clientName}` },
          { type: 'mrkdwn', text: `*Duration:*\n${durationSeconds}s` },
          { type: 'mrkdwn', text: `*Trigger:*\n${triggerLabel}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📊 *Summary:*\n• ${summary.reposProcessed} repositories processed\n• ${summary.usersCollected} users collected\n• ${summary.uploadedToSupabase ? 'Uploaded to Supabase' : 'Saved locally'}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Collected at: ${summary.timestamp}`,
          },
        ],
      },
    ];

    return this.sendMessage(userId, text, blocks);
  }

  /**
   * Send an error notification to a specific user when metrics collection fails.
   */
  async sendErrorNotification(
    userId: string,
    error: CollectionError
  ): Promise<{ success: boolean; error?: string }> {
    const triggerLabel = error.trigger === 'scheduled' ? 'Scheduled' : 'Manual';
    
    const text = `⚠️ Metrics collection failed for ${error.clientName}`;
    
    const blocks: any[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '⚠️ Metrics Collection Failed' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Client:*\n${error.clientName}` },
          { type: 'mrkdwn', text: `*Phase:*\n${error.phase}` },
          { type: 'mrkdwn', text: `*Trigger:*\n${triggerLabel}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `❌ *Error:*\n${error.error}`,
        },
      },
    ];

    if (error.repoPath) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Repository: \`${error.repoPath}\``,
          },
        ],
      });
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '💡 *Suggestion:*\nRun `metrix collect` manually to retry or check repository permissions.',
      },
    });

    return this.sendMessage(userId, text, blocks);
  }
}
