// ============================================
// Supabase Client Tests
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create chainable mock helpers
function createChain(finalResult: any) {
  const chain: any = {};
  const methods = ['select', 'insert', 'eq', 'single', 'limit'];
  for (const method of methods) {
    chain[method] = vi.fn((..._args: any[]) => {
      // .single() and .limit() return a promise (terminal)
      if (method === 'single' || method === 'limit') {
        return Promise.resolve(finalResult);
      }
      return chain;
    });
  }
  return chain;
}

const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { SupabaseMetricsClient } from '../../../../src/integrations/supabase/client';

describe('SupabaseMetricsClient', () => {
  let client: SupabaseMetricsClient;

  beforeEach(() => {
    vi.clearAllMocks();

    client = new SupabaseMetricsClient({
      url: 'https://test.supabase.co',
      serviceRoleKey: 'test-service-role-key',
    });
  });

  describe('constructor', () => {
    it('should create client with config', () => {
      expect(client).toBeDefined();
      expect(client.getClient()).toBeDefined();
    });
  });

  describe('testConnection', () => {
    it('should return success when connection works', async () => {
      const chain = createChain({ data: [{ id: 'test' }], error: null });
      mockFrom.mockReturnValue(chain);

      const result = await client.testConnection();
      expect(result.success).toBe(true);
      expect(result.url).toBe('https://test.supabase.co');
      expect(mockFrom).toHaveBeenCalledWith('clients');
    });

    it('should return error when connection fails', async () => {
      const chain = createChain({ data: null, error: { message: 'Connection refused' } });
      mockFrom.mockReturnValue(chain);

      const result = await client.testConnection();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('resolveClientId', () => {
    it('should return existing client id', async () => {
      const chain = createChain({ data: { id: 'existing-id' }, error: null });
      mockFrom.mockReturnValue(chain);

      const id = await client.resolveClientId('TEST');
      expect(id).toBe('existing-id');
    });

    it('should create client if not found', async () => {
      // First call (select): not found
      const selectChain = createChain({ data: null, error: { code: 'PGRST116' } });
      mockFrom.mockReturnValueOnce(selectChain);

      // Second call (insert): created
      const insertChain = createChain({ data: { id: 'new-id' }, error: null });
      mockFrom.mockReturnValueOnce(insertChain);

      const id = await client.resolveClientId('NEW_CLIENT');
      expect(id).toBe('new-id');
    });
  });

  describe('resolveEngineerId', () => {
    it('should return existing engineer id', async () => {
      const chain = createChain({ data: { id: 'eng-123' }, error: null });
      mockFrom.mockReturnValue(chain);

      const id = await client.resolveEngineerId('dev@test.com', 'Developer');
      expect(id).toBe('eng-123');
    });

    it('should create engineer if not found', async () => {
      const selectChain = createChain({ data: null, error: { code: 'PGRST116' } });
      mockFrom.mockReturnValueOnce(selectChain);

      const insertChain = createChain({ data: { id: 'new-eng-id' }, error: null });
      mockFrom.mockReturnValueOnce(insertChain);

      const id = await client.resolveEngineerId('new@test.com', 'New Dev');
      expect(id).toBe('new-eng-id');
    });
  });

  describe('resolveEngineerClientId', () => {
    it('should return existing engineer-client id', async () => {
      const chain = createChain({ data: { id: 'ec-123' }, error: null });
      mockFrom.mockReturnValue(chain);

      const id = await client.resolveEngineerClientId('eng-1', 'client-1');
      expect(id).toBe('ec-123');
    });
  });
});
