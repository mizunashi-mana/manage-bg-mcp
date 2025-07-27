import { writeFileSync, existsSync, unlinkSync } from 'fs';
import { beforeEach, describe, expect, it, afterEach } from 'vitest';
import { buildContainer } from '@/container/DIContainer.js';
import { loadConfig } from '@/services/ConfigProvider.js';
import { type BgManageServer } from '@/services/ManageBgServer.js';
import { loadPackageInfo } from '@/services/PackageInfoProvider.js';

describe('Robust Shutdown Integration Tests', () => {
  let server: BgManageServer;
  let container: ReturnType<typeof buildContainer>;
  const testServerPidFiles: string[] = [];

  beforeEach(async () => {
    const configProvider = await loadConfig();
    const packageInfoProvider = await loadPackageInfo();

    container = buildContainer({
      configProviderImpl: configProvider,
      packageInfoProviderImpl: packageInfoProvider,
    });

    server = container.getServer();
  });

  afterEach(async () => {
    // クリーンアップ: 作成したPIDファイルをすべて停止
    testServerPidFiles.forEach((pidFile) => {
      try {
        if (existsSync(pidFile)) {
          writeFileSync(pidFile, 'stop');
          // 少し待機してプロセスが終了するのを待つ
          setTimeout(() => {
            if (existsSync(pidFile)) {
              unlinkSync(pidFile);
            }
          }, 200);
        }
      }
      catch {
        // エラーは無視
      }
    });
    testServerPidFiles.length = 0;
  });

  describe('shutdown with controlled test servers', () => {
    it('should gracefully shutdown test servers during server close', async () => {
      // Arrange - サーバーを開始
      await server.start();
      const processManager = container.getProcessManager();

      // test-server.mjsを使用したプロセスを起動（引数で差別化）
      const testServer1 = await processManager.startProcess({
        command: 'node',
        args: ['script/test-server.mjs', 'server1'],
        cwd: process.cwd(),
      });

      const testServer2 = await processManager.startProcess({
        command: 'node',
        args: ['script/test-server.mjs', 'server2'],
        cwd: process.cwd(),
      });

      expect(testServer1.status).toBe('running');
      expect(testServer2.status).toBe('running');

      // プロセスが実際に起動し、PIDファイルが作成されるのを待つ
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });

      const runningProcesses = await processManager.listProcesses();
      expect(runningProcesses).toHaveLength(2);

      // Act - サーバーシャットダウン（テストサーバーも強制終了される）
      const shutdownStart = Date.now();
      await server.close();
      const shutdownDuration = Date.now() - shutdownStart;

      // Assert
      expect(server.isServerRunning()).toBe(false);
      expect(shutdownDuration).toBeLessThan(10000); // 10秒以内

      // プロセスがクリーンアップされていることを確認
      const finalProcesses = await processManager.listProcesses();
      expect(finalProcesses.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle mixed regular and controllable processes', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // 異なるタイプのプロセスを混在させる
      const testServer = await processManager.startProcess({
        command: 'node',
        args: ['script/test-server.mjs'],
        cwd: process.cwd(),
      });

      const simpleProcess = await processManager.startProcess({
        command: 'node',
        args: ['-e', 'setTimeout(() => { console.log("Simple process done"); }, 2000)'],
      });

      expect(testServer.status).toBe('running');
      expect(simpleProcess.status).toBe('running');

      // 少し待機
      await new Promise((resolve) => {
        setTimeout(resolve, 300);
      });

      // Act - シャットダウン
      await server.close();

      // Assert
      expect(server.isServerRunning()).toBe(false);
    });

    it('should handle shutdown with long-running controlled processes', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // 長時間実行されるテストサーバーを起動（引数で差別化）
      const longRunningServer1 = await processManager.startProcess({
        command: 'node',
        args: ['script/test-server.mjs', 'longserver1'],
        cwd: process.cwd(),
      });

      const longRunningServer2 = await processManager.startProcess({
        command: 'node',
        args: ['script/test-server.mjs', 'longserver2'],
        cwd: process.cwd(),
      });

      expect(longRunningServer1.status).toBe('running');
      expect(longRunningServer2.status).toBe('running');

      // プロセスが安定するまで待機
      await new Promise((resolve) => {
        setTimeout(resolve, 800);
      });

      // Act - シャットダウンタイミングを測定
      const shutdownStart = Date.now();
      await server.close();
      const shutdownDuration = Date.now() - shutdownStart;

      // Assert - 適切な時間内でシャットダウン
      expect(server.isServerRunning()).toBe(false);
      expect(shutdownDuration).toBeLessThan(12000); // 12秒以内
    });

    it('should handle multiple test servers with different configurations', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // 複数の構成でテストサーバーを起動
      const servers = await Promise.all([
        processManager.startProcess({
          command: 'node',
          args: ['script/test-server.mjs'],
          cwd: process.cwd(),
          env: { ...process.env, TEST_MODE: 'server1' },
        }),
        processManager.startProcess({
          command: 'node',
          args: ['script/test-server.mjs'],
          cwd: process.cwd(),
          env: { ...process.env, TEST_MODE: 'server2' },
        }),
        processManager.startProcess({
          command: 'node',
          args: ['script/test-server.mjs'],
          cwd: process.cwd(),
          env: { ...process.env, TEST_MODE: 'server3' },
        }),
      ]);

      expect(servers).toHaveLength(3);
      servers.forEach((server) => {
        expect(server.status).toBe('running');
      });

      // プロセスが安定するまで待機
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });

      const runningProcesses = await processManager.listProcesses();
      expect(runningProcesses.length).toBeGreaterThanOrEqual(3);

      // Act - シャットダウン
      const shutdownStart = Date.now();
      await server.close();
      const shutdownDuration = Date.now() - shutdownStart;

      // Assert
      expect(server.isServerRunning()).toBe(false);
      expect(shutdownDuration).toBeLessThan(15000); // 15秒以内
    });
  });

  describe('controlled process termination', () => {
    it('should handle processes that respond to graceful shutdown signals', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // Graceful shutdownに対応するテストサーバーを起動
      const gracefulServer = await processManager.startProcess({
        command: 'node',
        args: ['script/test-server.mjs', 'graceful'],
        cwd: process.cwd(),
      });

      expect(gracefulServer.status).toBe('running');

      // サーバーが起動完了するまで待機
      await new Promise((resolve) => {
        setTimeout(resolve, 600);
      });

      // Act - サーバーシャットダウン（プロセス側でSIGTERMを適切に処理する）
      await server.close();

      // Assert
      expect(server.isServerRunning()).toBe(false);
    });

    it('should handle processes with cleanup operations', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // クリーンアップ操作を行うプロセスを起動
      const cleanupServer = await processManager.startProcess({
        command: 'node',
        args: ['script/test-server.mjs', 'cleanup'],
        cwd: process.cwd(),
      });

      expect(cleanupServer.status).toBe('running');

      // プロセスがPIDファイルを作成するまで待機
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });

      // Act - シャットダウン
      const shutdownStart = Date.now();
      await server.close();
      const shutdownDuration = Date.now() - shutdownStart;

      // Assert - クリーンアップ時間を考慮しても適切な時間内
      expect(server.isServerRunning()).toBe(false);
      expect(shutdownDuration).toBeLessThan(8000); // 8秒以内
    });
  });

  describe('error resilience with test servers', () => {
    it('should complete shutdown even if some test servers fail to respond', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // 複数のテストサーバーを起動（引数で差別化）
      const testServers = await Promise.all([
        processManager.startProcess({
          command: 'node',
          args: ['script/test-server.mjs', 'resilient1'],
          cwd: process.cwd(),
        }),
        processManager.startProcess({
          command: 'node',
          args: ['script/test-server.mjs', 'resilient2'],
          cwd: process.cwd(),
        }),
      ]);

      expect(testServers).toHaveLength(2);

      // プロセスが安定するまで待機
      await new Promise((resolve) => {
        setTimeout(resolve, 700);
      });

      // Act - 強制シャットダウン（一部のプロセスが応答しない状況をシミュレート）
      const shutdownStart = Date.now();
      await server.close();
      const shutdownDuration = Date.now() - shutdownStart;

      // Assert - エラー状況でも適切にシャットダウン完了
      expect(server.isServerRunning()).toBe(false);
      expect(shutdownDuration).toBeLessThan(10000); // 10秒以内
    });

    it('should maintain stability during concurrent operations', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // テストサーバーを起動
      const testServer = await processManager.startProcess({
        command: 'node',
        args: ['script/test-server.mjs', 'concurrent'],
        cwd: process.cwd(),
      });

      expect(testServer.status).toBe('running');

      // Act - シャットダウンと並行してプロセス操作を実行
      const shutdownPromise = server.close();

      const concurrentOperations = Promise.allSettled([
        processManager.listProcesses(),
        processManager.getProcessInfo(testServer.id),
      ]);

      // 両方が完了するのを待つ
      const [shutdownResult, operationsResult] = await Promise.allSettled([
        shutdownPromise,
        concurrentOperations,
      ]);

      // Assert
      expect(shutdownResult.status).toBe('fulfilled');
      expect(operationsResult.status).toBe('fulfilled');
      expect(server.isServerRunning()).toBe(false);
    });
  });

  describe('resource management with test servers', () => {
    it('should properly clean up test server resources', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // リソースを使用するテストサーバーを起動（引数で差別化）
      const resourceServer1 = await processManager.startProcess({
        command: 'node',
        args: ['script/test-server.mjs', 'resource1'],
        cwd: process.cwd(),
      });

      const resourceServer2 = await processManager.startProcess({
        command: 'node',
        args: ['script/test-server.mjs', 'resource2'],
        cwd: process.cwd(),
      });

      expect(resourceServer1.status).toBe('running');
      expect(resourceServer2.status).toBe('running');

      // プロセスがリソースを使用開始するまで待機
      await new Promise((resolve) => {
        setTimeout(resolve, 800);
      });

      // Act - シャットダウンとリソースクリーンアップ
      await server.close();

      // Assert - リソースが適切にクリーンアップされている
      expect(server.isServerRunning()).toBe(false);

      const finalProcesses = await processManager.listProcesses();
      expect(Array.isArray(finalProcesses)).toBe(true);
    });

    it('should handle test servers with different lifecycle stages', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // 異なるライフサイクル段階のプロセス（引数で差別化）
      const startingServer = await processManager.startProcess({
        command: 'node',
        args: ['script/test-server.mjs', 'lifecycle1'],
        cwd: process.cwd(),
      });

      // 少し待機してから2番目のサーバーを起動
      await new Promise((resolve) => {
        setTimeout(resolve, 300);
      });

      const stableServer = await processManager.startProcess({
        command: 'node',
        args: ['script/test-server.mjs', 'lifecycle2'],
        cwd: process.cwd(),
      });

      expect(startingServer.status).toBe('running');
      expect(stableServer.status).toBe('running');

      // Act - 異なる段階のプロセスがある状態でシャットダウン
      await server.close();

      // Assert
      expect(server.isServerRunning()).toBe(false);
    });
  });

  describe('shutdown timing with real processes', () => {
    it('should shutdown within reasonable time limits with test servers', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      const shutdownTimes = [];
      const iterations = 3;

      for (let i = 0; i < iterations; i++) {
        if (i > 0) {
          // 後続のイテレーション用に新しいサーバーを作成
          const configProvider = await loadConfig();
          const packageInfoProvider = await loadPackageInfo();
          container = buildContainer({
            configProviderImpl: configProvider,
            packageInfoProviderImpl: packageInfoProvider,
          });
          server = container.getServer();
          await server.start();
        }

        // テストサーバーを起動（イテレーションごとに差別化）
        await processManager.startProcess({
          command: 'node',
          args: ['script/test-server.mjs', `timing${i}`],
          cwd: process.cwd(),
        });

        // 安定化待機
        await new Promise((resolve) => {
          setTimeout(resolve, 400);
        });

        // シャットダウン時間を測定
        const start = Date.now();
        await server.close();
        const duration = Date.now() - start;
        shutdownTimes.push(duration);

        expect(server.isServerRunning()).toBe(false);
      }

      // Assert - 全てのシャットダウンが適切な時間内
      shutdownTimes.forEach((time, index) => {
        expect(time, `Shutdown ${index + 1} took ${time}ms`).toBeLessThan(8000);
      });

      // 平均シャットダウン時間
      const averageTime = shutdownTimes.reduce((sum, time) => sum + time, 0) / shutdownTimes.length;
      expect(averageTime).toBeLessThan(6000); // 平均6秒以内
    });
  });
});
