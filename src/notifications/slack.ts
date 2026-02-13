// ============================================
// Slack Notification Client
// ============================================

import { SlackConfig } from '../config/integrations';

const SLACK_API_URL = 'https://slack.com/api';

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
}
