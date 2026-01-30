// ============================================
// Multi-Client Configuration Tests
// ============================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  addClient,
  removeClient,
  getActiveClient,
  switchClient,
  getAllClients,
  getClientConfig,
  clientExists,
  getFullConfig,
  findRepositoryOwners,
} from '../../../src/config/integrations';

const TEST_CONFIG_DIR = join(__dirname, '.test-config');
const TEST_CONFIG_FILE = join(TEST_CONFIG_DIR, 'config.json');

describe('Multi-Client Configuration', () => {
  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    
    // Mock the config directory (would need dependency injection in real implementation)
    // For now, these tests demonstrate the expected behavior
  });

  afterEach(() => {
    // Clean up
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }
  });

  describe('Client Management', () => {
    it('should add a new client', () => {
      const clientConfig = {
        git: { username: 'john', email: 'john@example.com', mainBranch: 'main' },
        repositories: ['/path/to/repo1'],
      };

      addClient('CLIENT_A', clientConfig);

      expect(clientExists('CLIENT_A')).toBe(true);
      expect(getActiveClient()).toBe('CLIENT_A');
    });

    it('should switch between clients', () => {
      addClient('CLIENT_A', { repositories: ['/repo1'] });
      addClient('CLIENT_B', { repositories: ['/repo2'] }, false);

      expect(getActiveClient()).toBe('CLIENT_A');

      switchClient('CLIENT_B');
      expect(getActiveClient()).toBe('CLIENT_B');
    });

    it('should list all clients', () => {
      addClient('CLIENT_A', { repositories: [] });
      addClient('CLIENT_B', { repositories: [] }, false);
      addClient('CLIENT_C', { repositories: [] }, false);

      const clients = getAllClients();
      expect(clients).toHaveLength(3);
      expect(clients).toContain('CLIENT_A');
      expect(clients).toContain('CLIENT_B');
      expect(clients).toContain('CLIENT_C');
    });

    it('should remove a client', () => {
      addClient('CLIENT_A', { repositories: [] });
      addClient('CLIENT_B', { repositories: [] });

      const removed = removeClient('CLIENT_A');
      expect(removed).toBe(true);
      expect(clientExists('CLIENT_A')).toBe(false);
      expect(getActiveClient()).toBe('CLIENT_B'); // Should switch to remaining client
    });

    it('should switch to another client when removing active client', () => {
      addClient('CLIENT_A', { repositories: [] });
      addClient('CLIENT_B', { repositories: [] }, false);

      expect(getActiveClient()).toBe('CLIENT_A');

      removeClient('CLIENT_A');
      expect(getActiveClient()).toBe('CLIENT_B');
    });

    it('should have no active client when removing the last client', () => {
      addClient('CLIENT_A', { repositories: [] });

      removeClient('CLIENT_A');
      expect(getActiveClient()).toBeNull();
    });
  });

  describe('Repository Ownership', () => {
    it('should find repository owners', () => {
      addClient('CLIENT_A', { repositories: ['/repo1', '/repo2'] });
      addClient('CLIENT_B', { repositories: ['/repo2', '/repo3'] }, false);

      const ownersRepo1 = findRepositoryOwners('/repo1');
      expect(ownersRepo1).toEqual(['CLIENT_A']);

      const ownersRepo2 = findRepositoryOwners('/repo2');
      expect(ownersRepo2).toHaveLength(2);
      expect(ownersRepo2).toContain('CLIENT_A');
      expect(ownersRepo2).toContain('CLIENT_B');

      const ownersRepo4 = findRepositoryOwners('/repo4');
      expect(ownersRepo4).toEqual([]);
    });
  });

  describe('Client Configuration', () => {
    it('should get specific client configuration', () => {
      const config = {
        git: { username: 'john', email: 'john@example.com', mainBranch: 'main' },
        repositories: ['/repo1'],
      };

      addClient('CLIENT_A', config);

      const retrieved = getClientConfig('CLIENT_A');
      expect(retrieved).toBeDefined();
      expect(retrieved?.git?.username).toBe('john');
      expect(retrieved?.repositories).toEqual(['/repo1']);
    });

    it('should return null for non-existent client', () => {
      const config = getClientConfig('NONEXISTENT');
      expect(config).toBeNull();
    });

    it('should get full multi-client configuration', () => {
      addClient('CLIENT_A', { repositories: ['/repo1'] });
      addClient('CLIENT_B', { repositories: ['/repo2'] }, false);

      const fullConfig = getFullConfig();
      expect(fullConfig.clients).toBeDefined();
      expect(Object.keys(fullConfig.clients)).toHaveLength(2);
      expect(fullConfig.activeClient).toBe('CLIENT_A');
    });
  });

  describe('Client Existence', () => {
    it('should check if client exists', () => {
      addClient('CLIENT_A', { repositories: [] });

      expect(clientExists('CLIENT_A')).toBe(true);
      expect(clientExists('CLIENT_B')).toBe(false);
    });
  });
});
