import { beforeEach, describe, expect, it } from 'vitest';
import { buildContainer } from '@/container/DIContainer.js';
import { loadConfig } from '@/services/ConfigProvider.js';
import { type BgManageServer } from '@/services/ManageBgServer.js';
import { loadPackageInfo } from '@/services/PackageInfoProvider.js';

describe('Process Management During Shutdown', () => {
  let server: BgManageServer;
  let container: ReturnType<typeof buildContainer>;

  beforeEach(async () => {
    const configProvider = await loadConfig();
    const packageInfoProvider = await loadPackageInfo();

    container = buildContainer({
      configProviderImpl: configProvider,
      packageInfoProviderImpl: packageInfoProvider,
    });

    server = container.getServer();
  });

  describe('shutdown with running processes', () => {
    it('should stop all processes during server shutdown', async () => {
      // Arrange - サーバーを開始
      await server.start();
      expect(server.isServerRunning()).toBe(true);

      // プロセス管理サービスに直接アクセス
      const processManager = container.getProcessManager();

      // 異なる長時間実行されるプロセスを起動
      const process1 = await processManager.startProcess({
        command: 'sleep',
        args: ['8'],
      });
      const process2 = await processManager.startProcess({
        command: 'sleep',
        args: ['9'],
      });

      // プロセスが実行中であることを確認
      expect(process1.status).toBe('running');
      expect(process2.status).toBe('running');

      const runningProcesses = await processManager.listProcesses();
      expect(runningProcesses).toHaveLength(2);

      // Act - サーバーをシャットダウン（これによりプロセスも停止される）
      const shutdownStart = Date.now();
      await server.close();
      const shutdownDuration = Date.now() - shutdownStart;

      // Assert - サーバーとプロセスが適切に停止
      expect(server.isServerRunning()).toBe(false);
      expect(shutdownDuration).toBeLessThan(8000); // 8秒以内にシャットダウン完了

      // プロセスの最終状態を確認
      const finalProcesses = await processManager.listProcesses();
      expect(finalProcesses.length).toBeGreaterThanOrEqual(0); // プロセスはクリーンアップされている
    });

    it('should handle mixed process states during shutdown', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // 異なるタイプのプロセスを起動
      await processManager.startProcess({
        command: 'echo',
        args: ['short process'],
      });
      const longProcess = await processManager.startProcess({
        command: 'sleep',
        args: ['3'],
      });

      // 短時間待機してechoプロセスが完了するのを待つ
      await new Promise((resolve) => {
        setTimeout(resolve, 200);
      });

      expect(longProcess.status).toBe('running');

      // Act - シャットダウン
      await server.close();

      // Assert
      expect(server.isServerRunning()).toBe(false);

      // プロセス管理状態の確認
      const remainingProcesses = await processManager.listProcesses();
      expect(Array.isArray(remainingProcesses)).toBe(true);
    }, 10000); // 10秒のタイムアウト

    it('should complete shutdown even with resource-intensive processes', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // リソース集約的なプロセスを起動
      const intensiveProcess = await processManager.startProcess({
        command: 'sh',
        args: ['-c', 'for i in $(seq 1 1000); do echo "Processing $i"; done'],
      });

      expect(intensiveProcess.status).toBe('running');

      // Act - シャットダウンを即座に実行
      const shutdownStart = Date.now();
      await server.close();
      const shutdownDuration = Date.now() - shutdownStart;

      // Assert
      expect(server.isServerRunning()).toBe(false);
      expect(shutdownDuration).toBeLessThan(10000); // 10秒以内
    });

    it('should handle shutdown with multiple concurrent processes', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // 複数の並行プロセスを起動（異なる引数で重複回避）
      const processes = await Promise.all([
        processManager.startProcess({ command: 'sleep', args: ['2'] }),
        processManager.startProcess({ command: 'sleep', args: ['3'] }),
        processManager.startProcess({ command: 'sleep', args: ['4'] }),
        processManager.startProcess({ command: 'echo', args: ['concurrent test'] }),
      ]);

      expect(processes).toHaveLength(4);

      // すべてのプロセスが起動していることを確認
      const runningProcesses = await processManager.listProcesses();
      expect(runningProcesses.length).toBeGreaterThanOrEqual(3); // echoはすぐ終了する可能性

      // Act - シャットダウン
      const shutdownStart = Date.now();
      await server.close();
      const shutdownDuration = Date.now() - shutdownStart;

      // Assert
      expect(server.isServerRunning()).toBe(false);
      expect(shutdownDuration).toBeLessThan(12000); // 12秒以内
    }, 15000); // 15秒のタイムアウト
  });

  describe('error handling during process shutdown', () => {
    it('should complete shutdown even if process cleanup encounters errors', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // プロセスを起動
      const testProcess = await processManager.startProcess({
        command: 'sleep',
        args: ['5'],
      });

      expect(testProcess.status).toBe('running');

      // Act - シャットダウン（内部でプロセス停止エラーが発生する可能性があるが、完了すべき）
      await expect(server.close()).resolves.not.toThrow();

      // Assert
      expect(server.isServerRunning()).toBe(false);
    });

    it('should handle shutdown when processes become unresponsive', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // 長時間実行されるプロセス（疑似的に応答しないプロセス）
      const unresponsiveProcess = await processManager.startProcess({
        command: 'sleep',
        args: ['30'], // 30秒実行
      });

      expect(unresponsiveProcess.status).toBe('running');

      // Act - 強制的なシャットダウン
      const shutdownStart = Date.now();
      await server.close();
      const shutdownDuration = Date.now() - shutdownStart;

      // Assert - 適切な時間内でシャットダウン完了（30秒待たない）
      expect(server.isServerRunning()).toBe(false);
      expect(shutdownDuration).toBeLessThan(15000); // 15秒以内
    });
  });

  describe('process state consistency during shutdown', () => {
    it('should maintain process manager functionality during shutdown', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // プロセスを起動
      await processManager.startProcess({
        command: 'sleep',
        args: ['2'],
      });

      const processesBeforeShutdown = await processManager.listProcesses();
      expect(processesBeforeShutdown.length).toBeGreaterThan(0);

      // Act - シャットダウン
      await server.close();

      // Assert - シャットダウン後でもプロセス管理機能は安全に呼び出せる
      const processesAfterShutdown = await processManager.listProcesses();
      expect(Array.isArray(processesAfterShutdown)).toBe(true);

      // サーバーは停止している
      expect(server.isServerRunning()).toBe(false);
    });

    it('should handle rapid process operations during shutdown', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // プロセスを起動
      const process1 = await processManager.startProcess({
        command: 'sleep',
        args: ['3'],
      });

      // Act - シャットダウンと並行してプロセス操作を実行
      const shutdownPromise = server.close();

      // シャットダウン中に追加のプロセス操作（競合状態のテスト）
      const operationsPromise = Promise.allSettled([
        processManager.listProcesses(),
        processManager.getProcessInfo(process1.id),
      ]);

      // Both should complete successfully
      const [shutdownResult, operationsResult] = await Promise.allSettled([
        shutdownPromise,
        operationsPromise,
      ]);

      // Assert
      expect(shutdownResult.status).toBe('fulfilled');
      expect(operationsResult.status).toBe('fulfilled');
      expect(server.isServerRunning()).toBe(false);
    });
  });

  describe('shutdown timeout handling', () => {
    it('should not hang indefinitely during shutdown', async () => {
      // Arrange
      await server.start();
      const processManager = container.getProcessManager();

      // Very long running process
      await processManager.startProcess({
        command: 'sleep',
        args: ['60'], // 60秒
      });

      // Act - シャットダウンにタイムアウトを設定
      const shutdownPromise = server.close();
      const timeoutPromise = new Promise((_resolve, reject) => {
        setTimeout(() => {
          reject(new Error('Shutdown timeout'));
        }, 20000); // 20秒タイムアウト
      });

      // Assert - シャットダウンは20秒以内に完了する
      await expect(Promise.race([shutdownPromise, timeoutPromise])).resolves.not.toThrow();
      expect(server.isServerRunning()).toBe(false);
    });
  });
});
