import { describe, it, expect, beforeEach } from 'vitest';
import { buildContainer } from '@/container/DIContainer.js';
import { loadConfig } from '@/services/ConfigProvider.js';
import { type BgManageServer } from '@/services/ManageBgServer.js';
import { loadPackageInfo } from '@/services/PackageInfoProvider.js';

describe('BgManageServer', () => {
  let server: BgManageServer;

  beforeEach(async () => {
    const configProvider = await loadConfig();
    const packageInfoProvider = await loadPackageInfo();

    const container = buildContainer({
      configProviderImpl: configProvider,
      packageInfoProviderImpl: packageInfoProvider,
    });

    server = container.getServer();
  });

  describe('initialization', () => {
    it('should initialize server with correct name and version', () => {
      const info = server.getServerInfo();
      expect(info.name).toBe('@mizunashi_mana/manage-bg-mcp');
      expect(typeof info.version).toBe('string');
    });

    it('should be in stopped state initially', () => {
      expect(server.isServerRunning()).toBe(false);
    });
  });

  describe('server lifecycle', () => {
    it('should be able to close without starting', async () => {
      await expect(server.close()).resolves.not.toThrow();
    });

    it('should handle multiple close calls gracefully', async () => {
      await server.close();
      await expect(server.close()).resolves.not.toThrow();
    });
  });

  describe('server info', () => {
    it('should return server information', () => {
      const info = server.getServerInfo();
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('version');
      expect(typeof info.name).toBe('string');
      expect(typeof info.version).toBe('string');
    });
  });
});
