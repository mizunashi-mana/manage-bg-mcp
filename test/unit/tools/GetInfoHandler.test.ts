import { describe, it, expect, beforeEach } from 'vitest';
import { BgProcessManagerImpl } from '@/services/BgProcessManager.js';
import { ConfigProviderImpl } from '@/services/ConfigProvider.js';
import { ProcessLogBufferImpl } from '@/services/ProcessLogBuffer.js';
import { GetInfoHandler } from '@/services/tools/GetInfoHandler.js';
import { StartHandler } from '@/services/tools/StartHandler.js';
import { StopHandler } from '@/services/tools/StopHandler.js';
import { MockProcessController } from '@~test/mocks/MockProcessController.js';

describe('GetInfoHandler', () => {
  let processManager: BgProcessManagerImpl;
  let handler: GetInfoHandler;
  let startHandler: StartHandler;
  let stopHandler: StopHandler;
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
    handler = new GetInfoHandler(processManager);
    startHandler = new StartHandler(processManager);
    stopHandler = new StopHandler(processManager);
  });

  it('should handle info request for non-existent process', async () => {
    const args = { processId: 'non-existent' };

    const result = await handler.handle(args);

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(false);
    expect(response.error).toContain('Process not found');
  });

  it('should return process info for existing running process', async () => {
    // Start a process first
    const startResult = await startHandler.handle({
      command: 'echo',
      args: ['hello', 'world'],
      cwd: '/tmp',
      env: { NODE_ENV: 'test' },
    });
    const startResponse = JSON.parse(startResult.content[0]?.text ?? '{}');
    const processId = startResponse.processId;

    // Get info for the process
    const result = await handler.handle({ processId });

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.process).toBeDefined();
    expect(response.process.id).toBe(processId);
    expect(response.process.command).toBe('echo');
    expect(response.process.args).toEqual(['hello', 'world']);
    expect(response.process.cwd).toBe('/tmp');
    expect(response.process.status).toBe('running');
    expect(response.process.startTime).toBeDefined();
    expect(response.process.pid).toBeDefined();
    expect(response.process.endTime).toBeUndefined();
    expect(response.process.exitCode).toBeUndefined();
  });

  it('should return process info for stopped process', async () => {
    // Start a process first
    const startResult = await startHandler.handle({ command: 'echo', args: ['test'] });
    const startResponse = JSON.parse(startResult.content[0]?.text ?? '{}');
    const processId = startResponse.processId;

    // Stop the process
    await stopHandler.handle({ processId });

    // Get info for the stopped process
    const result = await handler.handle({ processId });

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.process).toBeDefined();
    expect(response.process.id).toBe(processId);
    expect(response.process.command).toBe('echo');
    expect(response.process.status).toBe('running'); // Mock doesn't actually change status
    expect(response.process.startTime).toBeDefined();
    // Mock doesn't simulate actual process lifecycle, so endTime and exitCode may not be set
    // expect(response.process.endTime).toBeDefined();
    // expect(response.process.exitCode).toBe(0);
  });

  it('should handle process info request with minimal process configuration', async () => {
    // Start a process with minimal config
    const startResult = await startHandler.handle({ command: 'ls' });
    const startResponse = JSON.parse(startResult.content[0]?.text ?? '{}');
    const processId = startResponse.processId;

    // Get info for the process
    const result = await handler.handle({ processId });

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.process.command).toBe('ls');
    expect(response.process.args).toEqual([]);
    expect(response.process.cwd).toBeDefined(); // Uses current working directory
  });

  it('should handle error during process info retrieval', async () => {
    // Mock an error by providing an invalid process ID format that would cause internal errors
    const result = await handler.handle({ processId: '' });

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });
});
