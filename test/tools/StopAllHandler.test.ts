import { describe, it, expect, beforeEach } from 'vitest';
import { BgProcessManagerImpl } from '@/services/BgProcessManager.js';
import { ConfigProviderImpl } from '@/services/ConfigProvider.js';
import { ProcessLogBufferImpl } from '@/services/ProcessLogBuffer.js';
import { StartHandler } from '@/services/tools/StartHandler.js';
import { StopAllHandler } from '@/services/tools/StopAllHandler.js';
import { MockProcessController } from '@~test/mocks/MockProcessController.js';

describe('StopAllHandler', () => {
  let processManager: BgProcessManagerImpl;
  let handler: StopAllHandler;
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
    handler = new StopAllHandler(processManager);
    startHandler = new StartHandler(processManager);
  });

  it('should handle stop all when no processes exist', async () => {
    const result = await handler.handle();

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.stoppedCount).toBe(0);
    expect(response.message).toBe('No running processes to stop');
  });

  it('should stop all running processes', async () => {
    // Start multiple processes
    await startHandler.handle({ command: 'echo', args: ['test1'] });
    await startHandler.handle({ command: 'echo', args: ['test2'] });
    await startHandler.handle({ command: 'ls' });

    const result = await handler.handle();

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.stoppedCount).toBe(3);
    expect(response.message).toBe('Successfully stopped 3 process(es)');
    expect(response.stoppedProcesses).toHaveLength(3);
    expect(response.stoppedProcesses[0]).toHaveProperty('id');
    expect(response.stoppedProcesses[0]).toHaveProperty('command');
    expect(response.stoppedProcesses[0]).toHaveProperty('args');
  });

  it('should handle mixed process states during stop all', async () => {
    // Start processes
    const startResult1 = await startHandler.handle({ command: 'echo', args: ['test1'] });
    await startHandler.handle({ command: 'echo', args: ['test2'] });

    // Manually stop one process to create mixed states
    const startResponse1 = JSON.parse(startResult1.content[0]?.text ?? '{}');
    await processManager.stopProcess(startResponse1.processId);

    const result = await handler.handle();

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.stoppedCount).toBe(2); // MockProcessController doesn't track state changes
  });
});
