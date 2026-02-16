// ============================================
// Supabase Upload Tests
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();

const mockClient = {
  getClient: () => ({
    from: vi.fn((table: string) => ({
      insert: mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle,
        }),
      }),
      upsert: mockUpsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle,
        }),
      }),
      update: mockUpdate.mockReturnValue({
        eq: mockEq.mockResolvedValue({ error: null }),
      }),
    })),
  }),
};

vi.mock('../../../../src/integrations/supabase/client', () => ({
  SupabaseMetricsClient: vi.fn(() => mockClient),
}));

import { uploadGitMetrics, createJobRun, updateJobRun } from '../../../../src/integrations/supabase/upload';
import { SupabaseMetricsClient } from '../../../../src/integrations/supabase/client';

describe('Supabase Upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { id: 'new-record-id' }, error: null });
  });

  describe('uploadGitMetrics', () => {
    it('should upload git metrics successfully', async () => {
      const result = await uploadGitMetrics(mockClient as unknown as SupabaseMetricsClient, {
        engineerClientId: 'ec-123',
        repoName: 'test-repo',
        periodStart: '2025-01-01',
        periodEnd: '2025-01-07',
        collectionId: 'col-123',
        gitMetrics: {
          summary: { totalCommits: 10, totalLinesAdded: 500 },
          userStats: { commits: 5, linesAdded: 250, linesDeleted: 50 },
          activity: { byHour: { '9': 3 }, byDayOfWeek: { monday: 2 } },
          trends: [{ period: 'week-1', commits: 5 }],
        },
      });

      expect(result.id).toBe('new-record-id');
      expect(mockUpsert).toHaveBeenCalled();
    });

    it('should throw on upsert error', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

      await expect(
        uploadGitMetrics(mockClient as unknown as SupabaseMetricsClient, {
          engineerClientId: 'ec-123',
          repoName: 'test-repo',
          periodStart: '2025-01-01',
          periodEnd: '2025-01-07',
          collectionId: 'col-123',
          gitMetrics: { summary: {}, userStats: {}, activity: {}, trends: {} },
        })
      ).rejects.toThrow('Failed to upload git metrics');
    });
  });

  describe('createJobRun', () => {
    it('should create a job run with running status', async () => {
      const result = await createJobRun(mockClient as unknown as SupabaseMetricsClient, {
        jobType: 'collect',
        triggeredBy: 'cli',
        metadata: { clientName: 'TEST' },
      });

      expect(result.id).toBe('new-record-id');
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('updateJobRun', () => {
    it('should update job run to success', async () => {
      await updateJobRun(mockClient as unknown as SupabaseMetricsClient, 'job-123', {
        status: 'success',
        recordsProcessed: 5,
      });

      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
