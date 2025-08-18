import { describe, it, expect, beforeEach } from 'vitest';
import { BgProcessManagerImpl } from '@/services/BgProcessManager.js';
import { ConfigProviderImpl } from '@/services/ConfigProvider.js';
import { ProcessLogBufferImpl } from '@/services/ProcessLogBuffer.js';
import { StartHandler } from '@/services/tools/StartHandler.js';
import { StopHandler } from '@/services/tools/StopHandler.js';
import { MockProcessController } from '@~test/mocks/MockProcessController.js';

describe('StopHandler', () => {
  let processManager: BgProcessManagerImpl;
  let handler: StopHandler;
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
    handler = new StopHandler(processManager);
    startHandler = new StartHandler(processManager);
  });

  it('should handle stop request for non-existent process', async () => {
    const args = { processId: 'non-existent' };

    const result = await handler.handle(args);

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(false);
    expect(response.error).toContain('Process not found');
  });

  it('should successfully stop existing process', async () => {
    // Start a process first
    const startResult = await startHandler.handle({ command: 'echo', args: ['test'] });
    const startResponse = JSON.parse(startResult.content[0]?.text ?? '{}');
    const processId = startResponse.processId;

    // Now stop it
    const args = { processId };
    const result = await handler.handle(args);

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.processId).toBe(processId);
    expect(response.message).toBe('Process stopped successfully');
  });
});
