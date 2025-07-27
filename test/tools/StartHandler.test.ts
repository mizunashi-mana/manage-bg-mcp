import { describe, it, expect, beforeEach } from 'vitest';
import { BgProcessManagerImpl } from '@/services/BgProcessManager.js';
import { ConfigProviderImpl } from '@/services/ConfigProvider.js';
import { ProcessLogBufferImpl } from '@/services/ProcessLogBuffer.js';
import { StartHandler } from '@/services/tools/StartHandler.js';
import { MockProcessController } from '@~test/mocks/MockProcessController.js';

describe('StartHandler', () => {
  let processManager: BgProcessManagerImpl;
  let handler: StartHandler;
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
    handler = new StartHandler(processManager);
  });

  it('should handle valid start request', async () => {
    const args = {
      command: 'echo',
      args: ['hello', 'world'],
    };

    const result = await handler.handle(args);

    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe('text');

    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.processId).toBeDefined();
    expect(response.command).toBe('echo');
    expect(response.args).toEqual(['hello', 'world']);
    expect(response.pid).toBeDefined();
    expect(response.status).toBe('running');
    expect(response.startTime).toBeDefined();
  });

  it('should handle start request with optional parameters', async () => {
    const args = {
      command: 'node',
      args: ['script.js'],
      cwd: '/tmp',
      env: { NODE_ENV: 'test' },
    };

    const result = await handler.handle(args);

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.processId).toBeDefined();
    expect(response.command).toBe('node');
    expect(response.args).toEqual(['script.js']);
    expect(response.cwd).toBe('/tmp');
  });

  it('should handle empty command parameter', async () => {
    const args = { command: '' };

    const result = await handler.handle(args);

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.processId).toBeDefined();
  });

  it('should handle start request without args parameter', async () => {
    const args = { command: 'ls' };

    const result = await handler.handle(args);

    expect(result.content).toHaveLength(1);
    const response = JSON.parse(result.content[0]?.text ?? '{}');
    expect(response.success).toBe(true);
    expect(response.processId).toBeDefined();
    expect(response.command).toBe('ls');
    expect(response.args).toEqual([]);
  });
});
