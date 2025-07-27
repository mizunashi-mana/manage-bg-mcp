import { beforeEach, describe, expect, it } from 'vitest';
import { ConfigProviderImpl } from '@/services/ConfigProvider.js';
import { ProcessLogBufferImpl, type ProcessLogBuffer } from '@/services/ProcessLogBuffer.js';

describe('LogBuffer', () => {
  let logBuffer: ProcessLogBuffer;
  let configProvider: ConfigProviderImpl;

  beforeEach(() => {
    configProvider = new ConfigProviderImpl({
      maxLogLinesPerProcesses: 1000,
      maxConcurrentProcesses: 10,
      processTerminationTimeoutMs: 5000,
    });
    logBuffer = new ProcessLogBufferImpl(configProvider);
  });

  describe('appendStdout', () => {
    it('should append stdout data for a process', () => {
      // Arrange
      const processId = 'test-process-1';
      const data = 'Hello from stdout';

      // Act
      logBuffer.appendStdout(processId, data);

      // Assert
      const logs = logBuffer.getLatestLogs(processId);
      const stdoutLines = logs.logs.filter(entry => entry.type === 'stdout').map(entry => entry.line);
      const stderrLines = logs.logs.filter(entry => entry.type === 'stderr').map(entry => entry.line);
      expect(stdoutLines).toEqual([data]);
      expect(stderrLines).toEqual([]);
    });

    it('should append multiple stdout entries', () => {
      // Arrange
      const processId = 'test-process-1';

      // Act
      logBuffer.appendStdout(processId, 'Line 1');
      logBuffer.appendStdout(processId, 'Line 2');
      logBuffer.appendStdout(processId, 'Line 3');

      // Assert
      const logs = logBuffer.getLatestLogs(processId);
      const stdoutLines = logs.logs.filter(entry => entry.type === 'stdout').map(entry => entry.line);
      expect(stdoutLines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });
  });

  describe('appendStderr', () => {
    it('should append stderr data for a process', () => {
      // Arrange
      const processId = 'test-process-1';
      const data = 'Error from stderr';

      // Act
      logBuffer.appendStderr(processId, data);

      // Assert
      const logs = logBuffer.getLatestLogs(processId);
      const stdoutLines = logs.logs.filter(entry => entry.type === 'stdout').map(entry => entry.line);
      const stderrLines = logs.logs.filter(entry => entry.type === 'stderr').map(entry => entry.line);
      expect(stdoutLines).toEqual([]);
      expect(stderrLines).toEqual([data]);
    });

    it('should append multiple stderr entries', () => {
      // Arrange
      const processId = 'test-process-1';

      // Act
      logBuffer.appendStderr(processId, 'Error 1');
      logBuffer.appendStderr(processId, 'Error 2');

      // Assert
      const logs = logBuffer.getLatestLogs(processId);
      const stderrLines = logs.logs.filter(entry => entry.type === 'stderr').map(entry => entry.line);
      expect(stderrLines).toEqual(['Error 1', 'Error 2']);
    });
  });

  describe('getLatestLogs', () => {
    it('should return empty logs for non-existent process', () => {
      // Act
      const logs = logBuffer.getLatestLogs('non-existent');

      // Assert
      const stdoutLines = logs.logs.filter(entry => entry.type === 'stdout').map(entry => entry.line);
      const stderrLines = logs.logs.filter(entry => entry.type === 'stderr').map(entry => entry.line);
      expect(stdoutLines).toEqual([]);
      expect(stderrLines).toEqual([]);
      expect(logs.lastUpdated).toBeInstanceOf(Date);
    });

    it('should return limited number of lines when specified', () => {
      // Arrange
      const processId = 'test-process-1';

      // Add many lines
      for (let i = 1; i <= 100; i++) {
        logBuffer.appendStdout(processId, `Line ${i}`);
      }

      // Act
      const logs = logBuffer.getLatestLogs(processId, 10);

      // Assert
      const stdoutLines = logs.logs.filter(entry => entry.type === 'stdout').map(entry => entry.line);
      expect(stdoutLines).toHaveLength(10);
      expect(stdoutLines[0]).toBe('Line 91');
      expect(stdoutLines[9]).toBe('Line 100');
    });

    it('should handle mixed stdout and stderr', () => {
      // Arrange
      const processId = 'test-process-1';

      // Act
      logBuffer.appendStdout(processId, 'Output 1');
      logBuffer.appendStderr(processId, 'Error 1');
      logBuffer.appendStdout(processId, 'Output 2');

      // Assert
      const logs = logBuffer.getLatestLogs(processId);
      const stdoutLines = logs.logs.filter(entry => entry.type === 'stdout').map(entry => entry.line);
      const stderrLines = logs.logs.filter(entry => entry.type === 'stderr').map(entry => entry.line);
      expect(stdoutLines).toEqual(['Output 1', 'Output 2']);
      expect(stderrLines).toEqual(['Error 1']);
    });
  });

  describe('clearLogs', () => {
    it('should clear logs for specified process', () => {
      // Arrange
      const processId = 'test-process-1';
      logBuffer.appendStdout(processId, 'Some data');
      logBuffer.appendStderr(processId, 'Some error');

      // Act
      logBuffer.clearLogs(processId);

      // Assert
      const logs = logBuffer.getLatestLogs(processId);
      const stdoutLines = logs.logs.filter(entry => entry.type === 'stdout').map(entry => entry.line);
      const stderrLines = logs.logs.filter(entry => entry.type === 'stderr').map(entry => entry.line);
      expect(stdoutLines).toEqual([]);
      expect(stderrLines).toEqual([]);
    });

    it('should not affect other processes when clearing one', () => {
      // Arrange
      logBuffer.appendStdout('process-1', 'Data 1');
      logBuffer.appendStdout('process-2', 'Data 2');

      // Act
      logBuffer.clearLogs('process-1');

      // Assert
      const logs1 = logBuffer.getLatestLogs('process-1');
      const logs2 = logBuffer.getLatestLogs('process-2');

      const stdout1Lines = logs1.logs.filter(entry => entry.type === 'stdout').map(entry => entry.line);
      const stdout2Lines = logs2.logs.filter(entry => entry.type === 'stdout').map(entry => entry.line);
      expect(stdout1Lines).toEqual([]);
      expect(stdout2Lines).toEqual(['Data 2']);
    });

    it('should handle clearing non-existent process gracefully', () => {
      // Act & Assert
      expect(() => {
        logBuffer.clearLogs('non-existent');
      }).not.toThrow();
    });
  });

  describe('buffer management', () => {
    it('should respect configuration limits', () => {
      // Arrange
      const processId = 'test-process-1';

      // Add data up to the limit
      for (let i = 1; i <= 1500; i++) {
        logBuffer.appendStdout(processId, `Line ${i}`);
      }

      // Act
      const logs = logBuffer.getLatestLogs(processId);

      // Assert - Should respect maxLogLinesPerProcesses limit (1000)
      expect(logs.logs.length).toBeLessThanOrEqual(1000);

      // Should contain the most recent lines
      const stdoutLines = logs.logs.filter(entry => entry.type === 'stdout').map(entry => entry.line);
      const lastLine = stdoutLines[stdoutLines.length - 1];
      expect(lastLine).toBe('Line 1500');
    });

    it('should handle concurrent operations on different processes', () => {
      // Arrange & Act
      logBuffer.appendStdout('process-1', 'P1 Line 1');
      logBuffer.appendStdout('process-2', 'P2 Line 1');
      logBuffer.appendStderr('process-1', 'P1 Error 1');
      logBuffer.appendStdout('process-1', 'P1 Line 2');

      // Assert
      const logs1 = logBuffer.getLatestLogs('process-1');
      const logs2 = logBuffer.getLatestLogs('process-2');

      const stdout1Lines = logs1.logs.filter(entry => entry.type === 'stdout').map(entry => entry.line);
      const stderr1Lines = logs1.logs.filter(entry => entry.type === 'stderr').map(entry => entry.line);
      const stdout2Lines = logs2.logs.filter(entry => entry.type === 'stdout').map(entry => entry.line);
      const stderr2Lines = logs2.logs.filter(entry => entry.type === 'stderr').map(entry => entry.line);
      expect(stdout1Lines).toEqual(['P1 Line 1', 'P1 Line 2']);
      expect(stderr1Lines).toEqual(['P1 Error 1']);
      expect(stdout2Lines).toEqual(['P2 Line 1']);
      expect(stderr2Lines).toEqual([]);
    });
  });
});
