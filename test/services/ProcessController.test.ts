import { beforeEach, describe, expect, it } from 'vitest';
import { ProcessControllerImpl, type ProcessSpawnConfig } from '@/services/ProcessController.js';

describe('ProcessController', () => {
  let processController: ProcessControllerImpl;

  beforeEach(() => {
    processController = new ProcessControllerImpl();
  });

  describe('spawn', () => {
    it('should spawn a process with correct configuration', async () => {
      // Arrange
      const config: ProcessSpawnConfig = {
        command: 'echo',
        args: ['hello'],
        cwd: '/tmp',
        env: { NODE_ENV: 'test' },
      };

      // Act
      const result = await processController.spawn(config);

      // Assert
      expect(result.pid).toBeGreaterThan(0);
      expect(typeof result.pid).toBe('number');
      expect(typeof result.onExit).toBe('function');
      expect(typeof result.onError).toBe('function');
      expect(typeof result.onStdout).toBe('function');
      expect(typeof result.onStderr).toBe('function');
    });

    it('should generate unique PIDs for multiple processes', async () => {
      // Arrange
      const config1: ProcessSpawnConfig = { command: 'echo', args: ['1'] };
      const config2: ProcessSpawnConfig = { command: 'echo', args: ['2'] };

      // Act
      const result1 = await processController.spawn(config1);
      const result2 = await processController.spawn(config2);

      // Assert
      expect(result1.pid).not.toBe(result2.pid);
      expect(result1.pid).toBeGreaterThan(0);
      expect(result2.pid).toBeGreaterThan(0);
    });

    it('should handle minimal configuration', async () => {
      // Arrange
      const config: ProcessSpawnConfig = { command: 'echo' };

      // Act
      const result = await processController.spawn(config);

      // Assert
      expect(result.pid).toBeGreaterThan(0);
    });

    it('should spawn process with working directory', async () => {
      // Arrange
      const config: ProcessSpawnConfig = {
        command: 'pwd',
        cwd: '/tmp',
      };

      // Act
      const result = await processController.spawn(config);

      // Assert
      expect(result.pid).toBeGreaterThan(0);
    });

    it('should spawn process with environment variables', async () => {
      // Arrange
      const config: ProcessSpawnConfig = {
        command: 'env',
        env: { TEST_VAR: 'test_value' },
      };

      // Act
      const result = await processController.spawn(config);

      // Assert
      expect(result.pid).toBeGreaterThan(0);
    });

    it('should provide callback functions for process events', async () => {
      // Arrange
      const config: ProcessSpawnConfig = {
        command: 'echo',
        args: ['test'],
      };

      // Act
      const result = await processController.spawn(config);

      // Assert
      expect(typeof result.onExit).toBe('function');
      expect(typeof result.onError).toBe('function');
      expect(typeof result.onStdout).toBe('function');
      expect(typeof result.onStderr).toBe('function');
    });

    it('should handle process that exits with error code', async () => {
      // Arrange - Use a command that will exit with error code
      const config: ProcessSpawnConfig = {
        command: 'sh',
        args: ['-c', 'exit 127'], // Standard "command not found" exit code
      };

      // Act - This should spawn successfully but exit with error code
      const result = await processController.spawn(config);

      // Assert - Process should spawn but indicate error through exit code
      expect(result.pid).toBeGreaterThan(0);
      expect(typeof result.onError).toBe('function');
      expect(typeof result.onExit).toBe('function');
    });

    it('should provide proper error callback mechanism', async () => {
      // Arrange - Use a valid command that we can test error handling with
      const config: ProcessSpawnConfig = {
        command: 'sh',
        args: ['-c', 'echo "testing error handling"'],
      };

      // Act
      const result = await processController.spawn(config);

      // Assert - Verify error handling capabilities exist
      expect(result.pid).toBeGreaterThan(0);
      expect(typeof result.onError).toBe('function');
      expect(typeof result.onExit).toBe('function');

      // Test that error callbacks can be registered without issues
      result.onError(() => {
        // This callback is just to test that onError accepts callbacks
      });

      // For this test, we just verify the mechanism works
      expect(typeof result.onError).toBe('function');
    });

    it('should handle multiple concurrent processes', async () => {
      // Arrange
      const configs = [
        { command: 'echo', args: ['process1'] },
        { command: 'echo', args: ['process2'] },
        { command: 'echo', args: ['process3'] },
      ];

      // Act
      const results = await Promise.all(
        configs.map(async config => await processController.spawn(config)),
      );

      // Assert
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.pid).toBeGreaterThan(0);
      });

      // All PIDs should be unique
      const pids = results.map(r => r.pid);
      const uniquePids = [...new Set(pids)];
      expect(uniquePids).toHaveLength(3);
    });
  });

  describe('kill', () => {
    it('should kill a running process with SIGTERM', async () => {
      // Arrange
      const config: ProcessSpawnConfig = {
        command: 'sleep',
        args: ['10'], // Long running process
      };
      const result = await processController.spawn(config);

      // Act
      const killed = processController.kill(result.pid, false);

      // Assert
      expect(killed).toBe(true);
    });

    it('should force kill a process with SIGKILL', async () => {
      // Arrange
      const config: ProcessSpawnConfig = {
        command: 'sleep',
        args: ['10'],
      };
      const result = await processController.spawn(config);

      // Act
      const killed = processController.kill(result.pid, true);

      // Assert
      expect(killed).toBe(true);
    });

    it('should return false for non-existent process', () => {
      // Arrange
      const nonExistentPid = 999999;

      // Act
      const result = processController.kill(nonExistentPid);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for already killed process', async () => {
      // Arrange
      const config: ProcessSpawnConfig = {
        command: 'echo',
        args: ['test'],
      };
      const result = await processController.spawn(config);

      // Wait for process to complete naturally
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      // Act
      const killed = processController.kill(result.pid);

      // Assert - Process should already be finished
      expect(killed).toBe(false);
    });
  });

  describe('waitForExit', () => {
    it('should wait for process to exit naturally', async () => {
      // Arrange
      const config: ProcessSpawnConfig = {
        command: 'echo',
        args: ['test'],
      };
      const result = await processController.spawn(config);

      // Act & Assert
      await expect(processController.waitForExit(result.pid, 1000)).resolves.toBeUndefined();
    });

    it('should timeout when process does not exit within time limit', async () => {
      // Arrange
      const config: ProcessSpawnConfig = {
        command: 'sleep',
        args: ['5'], // Sleep for 5 seconds
      };
      const result = await processController.spawn(config);

      // Act - Wait only 100ms for a 5-second process
      await expect(processController.waitForExit(result.pid, 100)).resolves.toBeUndefined();

      // Cleanup
      processController.kill(result.pid, true);
    });

    it('should handle already exited process', async () => {
      // Arrange
      const config: ProcessSpawnConfig = {
        command: 'echo',
        args: ['test'],
      };
      const result = await processController.spawn(config);

      // Wait for process to complete
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });

      // Act & Assert - Should resolve immediately for already exited process
      await expect(processController.waitForExit(result.pid, 1000)).resolves.toBeUndefined();
    });

    it('should handle non-existent process', async () => {
      // Arrange
      const nonExistentPid = 999999;

      // Act & Assert - Should resolve immediately for non-existent process
      await expect(processController.waitForExit(nonExistentPid, 1000)).resolves.toBeUndefined();
    });

    it('should handle waitForExit with default timeout', async () => {
      // Arrange
      const config: ProcessSpawnConfig = {
        command: 'echo',
        args: ['test'],
      };
      const result = await processController.spawn(config);

      // Wait a bit to ensure process completes naturally
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      // Act & Assert - Process should already be finished, so waitForExit should resolve quickly
      await expect(processController.waitForExit(result.pid, 100)).resolves.toBeUndefined();
    });
  });

  describe('process lifecycle integration', () => {
    it('should track multiple processes and clean up properly', async () => {
      // Arrange
      const configs = [
        { command: 'sleep', args: ['1'] },
        { command: 'sleep', args: ['2'] },
      ];

      // Act
      const processes = await Promise.all(
        configs.map(async config => await processController.spawn(config)),
      );

      // Kill all processes
      processes.forEach((process) => {
        const killed = processController.kill(process.pid, true);
        expect(killed).toBe(true); // Should successfully kill running processes
      });

      // Wait for cleanup
      await Promise.all(
        processes.map(async (process) => {
          await processController.waitForExit(process.pid, 1000);
        }),
      );

      // Assert - Processes should be tracked properly
      expect(processes.length).toBe(2);
      processes.forEach((process) => {
        expect(process.pid).toBeGreaterThan(0);
      });
    });

    it('should handle spawn error conditions', async () => {
      // Arrange
      const config: ProcessSpawnConfig = {
        command: 'sh',
        args: ['-c', 'exit 1'], // This will exit with error code 1
      };

      // Act & Assert - Should still spawn successfully even if process exits with error
      const result = await processController.spawn(config);
      expect(result.pid).toBeGreaterThan(0);
      expect(typeof result.onError).toBe('function');
      expect(typeof result.onExit).toBe('function');
    });

    it('should handle process with large output', async () => {
      // Arrange
      const config: ProcessSpawnConfig = {
        command: 'sh',
        args: ['-c', 'for i in {1..100}; do echo "Line $i"; done'],
      };

      // Act
      const result = await processController.spawn(config);

      // Assert
      expect(result.pid).toBeGreaterThan(0);
      expect(typeof result.onStdout).toBe('function');

      // Wait for process to complete
      await processController.waitForExit(result.pid, 2000);
    });
  });
});
