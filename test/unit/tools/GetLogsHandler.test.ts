import { describe, it, expect, beforeEach } from 'vitest';
import { BgProcessManagerImpl } from '@/services/BgProcessManager.js';
import { ConfigProviderImpl } from '@/services/ConfigProvider.js';
import { ProcessLogBufferImpl } from '@/services/ProcessLogBuffer.js';
import { GetLogsHandler } from '@/services/tools/GetLogsHandler.js';
import { StartHandler } from '@/services/tools/StartHandler.js';
import { MockProcessController } from '@~test/mocks/MockProcessController.js';

describe('GetLogsHandler', () => {
  let processManager: BgProcessManagerImpl;
  let handler: GetLogsHandler;
  let startHandler: StartHandler;
  let mockProcessController: MockProcessController;

  beforeEach(() => {
    mockProcessController = new MockProcessController();
    const configProvider = new ConfigProviderImpl({
      maxLogLinesPerProcesses: 1000,
      maxConcurrentProcesses: 10,
      processTerminationTimeoutMs: 5000,
    });
    const logBuffer = new ProcessLogBufferImpl(configProvider);

    processManager = new BgProcessManagerImpl(logBuffer, mockProcessController);
    handler = new GetLogsHandler(processManager);
    startHandler = new StartHandler(processManager);
  });

  it('should handle logs request for non-existent process', async () => {
    const args = { processId: 'non-existent' };

    const result = await handler.handle(args);

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(false);
    expect(response.error).toContain('Process not found');
  });

  it('should return logs for existing process', async () => {
    // Start a process first
    const startResult = await startHandler.handle({ command: 'echo', args: ['test output'] });
    const startResponse = JSON.parse(startResult.content[0]?.text ?? '{}');
    const processId = startResponse.processId;

    // Simulate some log output by manually adding to log buffer
    // Note: MockProcessController doesn't generate real output, so this tests the structure
    const result = await handler.handle({ processId });

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.processId).toBe(processId);
    expect(response.logs).toBeDefined();
    expect(response.logs.stdout).toEqual([]);
    expect(response.logs.stderr).toEqual([]);
    expect(response.logs.lastUpdated).toBeDefined();
    expect(response.logs.totalLines).toBe(0);
  });

  it('should handle logs request with lines parameter', async () => {
    // Start a process
    const startResult = await startHandler.handle({ command: 'echo', args: ['test'] });
    const startResponse = JSON.parse(startResult.content[0]?.text ?? '{}');
    const processId = startResponse.processId;

    // Request logs with specific line count
    const result = await handler.handle({ processId, lines: 10 });

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.processId).toBe(processId);
    expect(response.logs).toBeDefined();
  });

  it('should handle logs request for process with minimal configuration', async () => {
    // Start a process with minimal config
    const startResult = await startHandler.handle({ command: 'ls' });
    const startResponse = JSON.parse(startResult.content[0]?.text ?? '{}');
    const processId = startResponse.processId;

    // Get logs
    const result = await handler.handle({ processId });

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.logs.stdout).toEqual([]);
    expect(response.logs.stderr).toEqual([]);
    expect(typeof response.logs.totalLines).toBe('number');
  });

  it('should handle error during logs retrieval', async () => {
    // Test with invalid process ID format
    const result = await handler.handle({ processId: '' });

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });

  it('should return logs with proper timestamp format', async () => {
    // Start a process
    const startResult = await startHandler.handle({ command: 'echo', args: ['timestamp test'] });
    const startResponse = JSON.parse(startResult.content[0]?.text ?? '{}');
    const processId = startResponse.processId;

    const result = await handler.handle({ processId });

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);

    // Check that lastUpdated is a valid ISO string
    expect(response.logs.lastUpdated).toBeDefined();
    expect(() => new Date(response.logs.lastUpdated)).not.toThrow();
    expect(new Date(response.logs.lastUpdated).toISOString()).toBe(response.logs.lastUpdated);
  });
});
