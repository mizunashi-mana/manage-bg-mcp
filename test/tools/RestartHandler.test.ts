import { describe, it, expect, beforeEach } from 'vitest';
import { BgProcessManagerImpl } from '@/services/BgProcessManager.js';
import { ConfigProviderImpl } from '@/services/ConfigProvider.js';
import { ProcessLogBufferImpl } from '@/services/ProcessLogBuffer.js';
import { RestartHandler } from '@/services/tools/RestartHandler.js';
import { StartHandler } from '@/services/tools/StartHandler.js';
import { MockProcessController } from '@~test/mocks/MockProcessController.js';

describe('RestartHandler', () => {
  let processManager: BgProcessManagerImpl;
  let handler: RestartHandler;
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
    handler = new RestartHandler(processManager);
    startHandler = new StartHandler(processManager);
  });

  it('should handle restart request for non-existent process', async () => {
    const args = { processId: 'non-existent' };

    const result = await handler.handle(args);

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(false);
    expect(response.error).toContain('Process not found');
  });

  it('should successfully restart existing process', async () => {
    // Start a process first
    const startResult = await startHandler.handle({ command: 'echo', args: ['test'] });
    const startResponse = JSON.parse(startResult.content[0]?.text ?? '{}');
    const originalProcessId = startResponse.processId;

    // Restart the process
    const result = await handler.handle({ processId: originalProcessId });

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.originalProcessId).toBe(originalProcessId);
    expect(response.newProcessId).toBeDefined();
    expect(response.newProcessId).not.toBe(originalProcessId);
    expect(response.message).toBe('Process restarted successfully');
  });
});
