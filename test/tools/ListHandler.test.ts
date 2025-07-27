import { describe, it, expect, beforeEach } from 'vitest';
import { BgProcessManagerImpl } from '@/services/BgProcessManager.js';
import { ConfigProviderImpl } from '@/services/ConfigProvider.js';
import { ProcessLogBufferImpl } from '@/services/ProcessLogBuffer.js';
import { ListHandler } from '@/services/tools/ListHandler.js';
import { StartHandler } from '@/services/tools/StartHandler.js';
import { MockProcessController } from '@~test/mocks/MockProcessController.js';

describe('ListHandler', () => {
  let processManager: BgProcessManagerImpl;
  let handler: ListHandler;
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
    handler = new ListHandler(processManager);
    startHandler = new StartHandler(processManager);
  });

  it('should return empty list when no processes exist', async () => {
    const result = await handler.handle();

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.processes).toEqual([]);
    expect(response.count).toBe(0);
    expect(response.message).toBe('No processes currently running');
  });

  it('should return list of running processes', async () => {
    // Start multiple processes
    await startHandler.handle({ command: 'echo', args: ['test1'] });
    await startHandler.handle({ command: 'echo', args: ['test2'] });
    await startHandler.handle({ command: 'ls' });

    const result = await handler.handle();

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.processes).toHaveLength(3);
    expect(response.count).toBe(3);
    expect(response.processes[0]).toHaveProperty('id');
    expect(response.processes[0]).toHaveProperty('command');
    expect(response.processes[0]).toHaveProperty('status');
  });
});
