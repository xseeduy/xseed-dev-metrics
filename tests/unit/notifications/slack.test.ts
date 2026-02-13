// ============================================
// Slack Notifier Tests
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlackNotifier } from '../../../src/notifications/slack';

const mockFetch = vi.fn();

describe('SlackNotifier', () => {
  let notifier: SlackNotifier;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    notifier = new SlackNotifier({
      botToken: 'xoxb-test-token',
      defaultChannel: '#metrics',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('testConnection', () => {
    it('should return success when auth.test succeeds', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: true, user: 'metrics-bot' }),
      });

      const result = await notifier.testConnection();
      expect(result.success).toBe(true);
      expect(result.botName).toBe('metrics-bot');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/auth.test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer xoxb-test-token',
          }),
        })
      );
    });

    it('should return error when auth.test fails', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: false, error: 'invalid_auth' }),
      });

      const result = await notifier.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_auth');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await notifier.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: true, ts: '1234567890.123' }),
      });

      const result = await notifier.sendMessage('#general', 'Hello!');
      expect(result.success).toBe(true);
      expect(result.ts).toBe('1234567890.123');
    });

    it('should include blocks when provided', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: true, ts: '1234567890.123' }),
      });

      const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'test' } }];
      await notifier.sendMessage('#general', 'Hello!', blocks);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.blocks).toEqual(blocks);
    });
  });

  describe('sendCollectionSummary', () => {
    it('should send a success summary', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: true, ts: '123' }),
      });

      const result = await notifier.sendCollectionSummary(undefined, {
        clientName: 'XSEED',
        reposProcessed: 3,
        usersCollected: 5,
        uploadedToSupabase: true,
        errors: [],
        trigger: 'manual',
      });

      expect(result.success).toBe(true);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.channel).toBe('#metrics');
      expect(callBody.blocks).toBeDefined();
      expect(callBody.blocks.length).toBeGreaterThan(0);
    });

    it('should include errors in the summary', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: true, ts: '123' }),
      });

      await notifier.sendCollectionSummary(undefined, {
        clientName: 'XSEED',
        reposProcessed: 2,
        usersCollected: 3,
        uploadedToSupabase: false,
        errors: ['repo1: timeout', 'repo2: auth failed'],
        trigger: 'scheduled',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.blocks.length).toBe(4); // header + stats + upload status + errors
    });

    it('should fail when no channel is specified', async () => {
      const noChannelNotifier = new SlackNotifier({ botToken: 'xoxb-test' });

      const result = await noChannelNotifier.sendCollectionSummary(undefined, {
        clientName: 'TEST',
        reposProcessed: 1,
        usersCollected: 1,
        uploadedToSupabase: false,
        errors: [],
        trigger: 'manual',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No channel');
    });
  });
});
