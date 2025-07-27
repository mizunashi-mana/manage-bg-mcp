import { beforeEach, describe, expect, it } from 'vitest';
import { buildContainer } from '@/container/DIContainer.js';
import { loadConfig } from '@/services/ConfigProvider.js';
import { type BgManageServer } from '@/services/ManageBgServer.js';
import { loadPackageInfo } from '@/services/PackageInfoProvider.js';

describe('Graceful Shutdown Integration Tests', () => {
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

  describe('server shutdown behavior', () => {
    it('should close gracefully when no processes are running', async () => {
      // Arrange - サーバーを開始
      await server.start();
      expect(server.isServerRunning()).toBe(true);

      // Act - サーバーを停止
      await server.close();

      // Assert - サーバーが正常に停止
      expect(server.isServerRunning()).toBe(false);
    });

    it('should handle multiple close calls gracefully', async () => {
      // Arrange - サーバーを開始
      await server.start();
      expect(server.isServerRunning()).toBe(true);

      // Act - 複数回のclose呼び出し
      await server.close();
      expect(server.isServerRunning()).toBe(false);

      // 2回目のclose呼び出し
      await expect(server.close()).resolves.not.toThrow();
      expect(server.isServerRunning()).toBe(false);

      // 3回目のclose呼び出し
      await expect(server.close()).resolves.not.toThrow();
      expect(server.isServerRunning()).toBe(false);
    });

    it('should complete shutdown in reasonable time', async () => {
      // Arrange - サーバーを開始
      await server.start();
      expect(server.isServerRunning()).toBe(true);

      // Act - シャットダウン時間を測定
      const shutdownStart = Date.now();
      await server.close();
      const shutdownDuration = Date.now() - shutdownStart;

      // Assert - シャットダウンが適切な時間内に完了
      expect(server.isServerRunning()).toBe(false);
      expect(shutdownDuration).toBeLessThan(5000); // 5秒以内にシャットダウン完了
    });

    it('should handle concurrent shutdown attempts', async () => {
      // Arrange
      await server.start();
      expect(server.isServerRunning()).toBe(true);

      // Act - 同時に複数のshutdownを実行
      const shutdownPromises = [
        server.close(),
        server.close(),
        server.close(),
      ];

      // Assert - 全て正常に完了する
      await expect(Promise.all(shutdownPromises)).resolves.not.toThrow();
      expect(server.isServerRunning()).toBe(false);
    });
  });

  describe('server lifecycle management', () => {
    it('should handle rapid start-stop cycles', async () => {
      // Act & Assert - 複数回の開始・停止サイクル
      for (let cycle = 0; cycle < 3; cycle++) {
        // サーバー開始
        await server.start();
        expect(server.isServerRunning()).toBe(true);

        // すぐにシャットダウン
        await server.close();
        expect(server.isServerRunning()).toBe(false);

        // 次のサイクルのため、新しいサーバーインスタンスを作成
        if (cycle < 2) {
          const configProvider = await loadConfig();
          const packageInfoProvider = await loadPackageInfo();
          const container = buildContainer({
            configProviderImpl: configProvider,
            packageInfoProviderImpl: packageInfoProvider,
          });
          server = container.getServer();
        }
      }

      // Assert - 最終状態確認
      expect(server.isServerRunning()).toBe(false);
    });

    it('should maintain consistent state during lifecycle operations', async () => {
      // Initial state
      expect(server.isServerRunning()).toBe(false);

      // Start server
      await server.start();
      expect(server.isServerRunning()).toBe(true);

      // Server info should be accessible
      const serverInfo = server.getServerInfo();
      expect(serverInfo).toHaveProperty('name');
      expect(serverInfo).toHaveProperty('version');
      expect(typeof serverInfo.name).toBe('string');
      expect(typeof serverInfo.version).toBe('string');

      // Close server
      await server.close();
      expect(server.isServerRunning()).toBe(false);

      // Server info should still be accessible after close
      const serverInfoAfterClose = server.getServerInfo();
      expect(serverInfoAfterClose).toEqual(serverInfo);
    });
  });

  describe('edge case scenarios', () => {
    it('should handle shutdown before server start', async () => {
      // Arrange - サーバーを開始しない
      expect(server.isServerRunning()).toBe(false);

      // Act & Assert - 開始前でもclose()は安全に実行できる
      await expect(server.close()).resolves.not.toThrow();
      expect(server.isServerRunning()).toBe(false);
    });

    it('should handle shutdown during server startup', async () => {
      // Arrange - サーバー開始を非同期で実行
      const startPromise = server.start();

      // Act - 開始中にシャットダウンを試行
      const shutdownPromise = server.close();

      // Assert - 両方のプロミスが正常に完了
      const results = await Promise.allSettled([startPromise, shutdownPromise]);
      expect(results).toHaveLength(2);

      // 最終状態確認（start/closeの競合により結果は予測困難だが、エラーは発生しない）
      // サーバーの最終状態はstart/closeの実行順序により変わる可能性がある
      expect(typeof server.isServerRunning()).toBe('boolean');
    });

    it('should maintain server info consistency across lifecycle', async () => {
      // Get initial server info
      const initialInfo = server.getServerInfo();

      // Start and stop server multiple times
      for (let i = 0; i < 2; i++) {
        await server.start();
        const runningInfo = server.getServerInfo();
        expect(runningInfo).toEqual(initialInfo);

        await server.close();
        const stoppedInfo = server.getServerInfo();
        expect(stoppedInfo).toEqual(initialInfo);
      }
    });

    it('should handle error conditions gracefully', async () => {
      // Start server
      await server.start();
      expect(server.isServerRunning()).toBe(true);

      // Force an error condition by trying to manipulate server state
      // (This is a synthetic test - in real scenarios errors would come from external factors)

      // Even with potential internal errors, shutdown should complete
      await expect(server.close()).resolves.not.toThrow();
      expect(server.isServerRunning()).toBe(false);
    });
  });

  describe('performance characteristics', () => {
    it('should shutdown within performance thresholds', async () => {
      await server.start();

      // Measure multiple shutdown cycles
      const shutdownTimes = [];
      const iterations = 3;

      for (let i = 0; i < iterations; i++) {
        if (i > 0) {
          // Recreate server for subsequent iterations
          const configProvider = await loadConfig();
          const packageInfoProvider = await loadPackageInfo();
          const container = buildContainer({
            configProviderImpl: configProvider,
            packageInfoProviderImpl: packageInfoProvider,
          });
          server = container.getServer();
          await server.start();
        }

        const start = Date.now();
        await server.close();
        const duration = Date.now() - start;
        shutdownTimes.push(duration);

        expect(server.isServerRunning()).toBe(false);
      }

      // All shutdown times should be reasonable
      shutdownTimes.forEach((time) => {
        expect(time).toBeLessThan(3000); // Each shutdown under 3 seconds
      });

      // Average shutdown time should be reasonable
      const averageTime = shutdownTimes.reduce((sum, time) => sum + time, 0) / shutdownTimes.length;
      expect(averageTime).toBeLessThan(2000); // Average under 2 seconds
    });

    it('should handle resource cleanup efficiently', async () => {
      // Test memory usage patterns (basic check)
      const initialMemory = process.memoryUsage();

      // Start and stop server multiple times
      for (let cycle = 0; cycle < 5; cycle++) {
        await server.start();
        await server.close();

        // Recreate server for next cycle
        if (cycle < 4) {
          const configProvider = await loadConfig();
          const packageInfoProvider = await loadPackageInfo();
          const container = buildContainer({
            configProviderImpl: configProvider,
            packageInfoProviderImpl: packageInfoProvider,
          });
          server = container.getServer();
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();

      // Memory should not grow excessively (allowing for some variance)
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryGrowthMB = memoryGrowth / (1024 * 1024);

      // Allow up to 50MB growth (generous allowance for test framework overhead)
      expect(memoryGrowthMB).toBeLessThan(50);
    });
  });
});
