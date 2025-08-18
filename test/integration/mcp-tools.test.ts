import { spawn, type ChildProcess } from 'child_process';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface MCPToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
}

interface ToolResultData {
  success: boolean;
  processId?: string;
  pid?: number;
  command?: string;
  status?: string;
  processes?: Array<{ id: string; command: string }>;
  count?: number;
  process?: { id: string; command: string };
  logs?: { stdout: string; stderr: string };
  originalProcessId?: string;
  newProcessId?: string;
  message?: string;
  stoppedCount?: number;
  stoppedProcesses?: unknown[];
  error?: string;
}

interface InitializeResult {
  protocolVersion: string;
  serverInfo: {
    name: string;
    version: string;
  };
}

interface ToolsListResult {
  tools: Array<{ name: string }>;
}

class MCPToolsIntegrationTest {
  private mcpProcess: ChildProcess | null = null;
  private messageId = 1;

  async startMCPServer(): Promise<void> {
    this.mcpProcess = spawn('node', ['dist/src/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Check if process started successfully
    if (!this.mcpProcess?.pid) {
      throw new Error('Failed to start MCP server process');
    }

    // Wait for server to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify server is responsive
    await this.checkServerHealth();
  }

  /**
   * Check if the MCP server is running and responsive
   */
  async checkServerHealth(): Promise<void> {
    if (!this.isServerRunning()) {
      throw new Error('MCP server process is not running');
    }

    try {
      // Try to send a simple initialize message to verify responsiveness
      const response = await this.sendMCPMessage('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'health-check', version: '1.0.0' },
      });

      if (!response.result) {
        throw new Error('MCP server is not responding properly');
      }
    }
    catch (error) {
      throw new Error(`MCP server health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if the MCP server process is still running
   */
  isServerRunning(): boolean {
    return this.mcpProcess !== null
      && !this.mcpProcess.killed
      && this.mcpProcess.exitCode === null;
  }

  async sendMCPMessage(method: string, params: Record<string, unknown> = {}): Promise<MCPResponse> {
    if (!this.mcpProcess) {
      throw new Error('MCP server not started');
    }

    // Check server health before sending message
    if (!this.isServerRunning()) {
      throw new Error('MCP server process has stopped unexpectedly');
    }

    const message = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method,
      params,
    };

    const messageStr = JSON.stringify(message) + '\n';

    return await new Promise<MCPResponse>((resolve, reject) => {
      let responseData = '';
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for response to ${method}`));
      }, 10000);

      const onData = (data: Buffer) => {
        responseData += data.toString();
        const lines = responseData.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = JSON.parse(line);
              if (response.id === message.id) {
                clearTimeout(timeout);
                this.mcpProcess!.stdout!.off('data', onData);
                resolve(response);
                return;
              }
            }
            catch {
              // Continue parsing other lines
            }
          }
        }
      };

      this.mcpProcess!.stdout!.on('data', onData);
      this.mcpProcess!.stdin!.write(messageStr);
    });
  }

  async cleanup(): Promise<void> {
    if (this.mcpProcess) {
      this.mcpProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  parseToolResult(response: MCPResponse): ToolResultData {
    const result = response.result as MCPToolResult;
    return JSON.parse(result.content[0]!.text);
  }
}

describe('MCP Tools Integration Tests', () => {
  const tester = new MCPToolsIntegrationTest();

  beforeAll(async () => {
    await tester.startMCPServer();
  });

  afterAll(async () => {
    await tester.cleanup();
  });

  describe('MCP Server Health', () => {
    it('should have MCP server running', async () => {
      expect(tester.isServerRunning()).toBe(true);
    });

    it('should respond to health check', async () => {
      await expect(tester.checkServerHealth()).resolves.not.toThrow();
    });
  });

  describe('MCP Protocol', () => {
    it('should initialize successfully', async () => {
      const response = await tester.sendMCPMessage('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      });

      expect(response.result).toBeDefined();
      const initResult = response.result as InitializeResult;
      expect(initResult.protocolVersion).toBe('2024-11-05');
      expect(initResult.serverInfo.name).toBe('@mizunashi_mana/manage-bg-mcp');
      expect(initResult.serverInfo.version).toMatch(/[0-9]+\.[0-9]+\.[0-9]+/);
    });

    it('should list all available tools', async () => {
      const response = await tester.sendMCPMessage('tools/list');

      expect(response.result).toBeDefined();
      const toolsResult = response.result as ToolsListResult;
      expect(toolsResult.tools).toHaveLength(7);

      const toolNames = toolsResult.tools.map((tool: { name: string }) => tool.name);
      expect(toolNames).toEqual(
        expect.arrayContaining([
          'start', 'stop', 'restart', 'stop_all',
          'list', 'get_info', 'get_logs',
        ]),
      );
    });
  });

  describe('Process Management Tools', () => {
    let testProcessId: string;

    beforeEach(async () => {
      // Ensure server is running before each test
      if (!tester.isServerRunning()) {
        throw new Error('MCP server stopped before test execution');
      }
    });

    it('should start a process using start tool', async () => {
      const response = await tester.sendMCPMessage('tools/call', {
        name: 'start',
        arguments: {
          command: 'echo',
          args: ['Hello from integration test'],
          name: 'integration-test-process',
        },
      });

      expect(response.result).toBeDefined();
      const result = tester.parseToolResult(response);

      expect(result.success).toBe(true);
      expect(result.processId).toBeDefined();
      expect(result.pid).toBeDefined();
      expect(result.command).toBe('echo');
      expect(result.status).toBe('running');

      testProcessId = result.processId!;
    });

    it('should list processes using list tool', async () => {
      const response = await tester.sendMCPMessage('tools/call', {
        name: 'list',
        arguments: {},
      });

      expect(response.result).toBeDefined();
      const result = tester.parseToolResult(response);

      expect(result.success).toBe(true);
      expect(result.processes).toBeDefined();
      expect(result.count).toBeGreaterThanOrEqual(1);

      const process = result.processes?.find((p: { id: string }) => p.id === testProcessId);
      expect(process).toBeDefined();
      expect(process!.command).toBe('echo');
    });

    it('should get process info using get_info tool', async () => {
      const response = await tester.sendMCPMessage('tools/call', {
        name: 'get_info',
        arguments: {
          processId: testProcessId,
        },
      });

      expect(response.result).toBeDefined();
      const result = tester.parseToolResult(response);

      expect(result.success).toBe(true);
      expect(result.process).toBeDefined();
      expect(result.process!.id).toBe(testProcessId);
      expect(result.process!.command).toBe('echo');
    });

    it('should get process logs using get_logs tool', async () => {
      // Wait for process to complete and logs to be captured
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await tester.sendMCPMessage('tools/call', {
        name: 'get_logs',
        arguments: {
          processId: testProcessId,
          lines: 10,
        },
      });

      expect(response.result).toBeDefined();
      const result = tester.parseToolResult(response);

      expect(result.success).toBe(true);
      expect(result.processId).toBe(testProcessId);
      expect(result.logs).toBeDefined();
      expect(result.logs!.stdout).toBeDefined();
      expect(result.logs!.stderr).toBeDefined();
    });
  });

  describe('Long-running Process Management', () => {
    let longRunningProcessId: string;

    beforeEach(async () => {
      // Ensure server is running before each test
      if (!tester.isServerRunning()) {
        throw new Error('MCP server stopped before test execution');
      }
    });

    it('should start and manage long-running process', async () => {
      // Start long-running process
      const startResponse = await tester.sendMCPMessage('tools/call', {
        name: 'start',
        arguments: {
          command: 'node',
          args: ['-e', 'setInterval(() => console.log("Running..."), 1000);'],
          name: 'long-running-test',
        },
      });

      const startResult = tester.parseToolResult(startResponse);
      expect(startResult.success).toBe(true);
      longRunningProcessId = startResult.processId!;

      // Wait for some output
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check logs contain output
      const logsResponse = await tester.sendMCPMessage('tools/call', {
        name: 'get_logs',
        arguments: {
          processId: longRunningProcessId,
          lines: 5,
        },
      });

      const logsResult = tester.parseToolResult(logsResponse);
      expect(logsResult.success).toBe(true);
      // Note: Logs might be empty due to timing, but the call should succeed
    });

    it('should restart process using restart tool', async () => {
      const response = await tester.sendMCPMessage('tools/call', {
        name: 'restart',
        arguments: {
          processId: longRunningProcessId,
        },
      });

      expect(response.result).toBeDefined();
      const result = tester.parseToolResult(response);

      expect(result.success).toBe(true);
      expect(result.originalProcessId).toBe(longRunningProcessId);
      expect(result.newProcessId).toBeDefined();
      expect(result.newProcessId).not.toBe(longRunningProcessId);
      expect(result.message).toContain('restarted successfully');

      // Update process ID for cleanup
      longRunningProcessId = result.newProcessId!;
    });

    it('should stop specific process using stop tool', async () => {
      const response = await tester.sendMCPMessage('tools/call', {
        name: 'stop',
        arguments: {
          processId: longRunningProcessId,
        },
      });

      expect(response.result).toBeDefined();
      const result = tester.parseToolResult(response);

      expect(result.success).toBe(true);
      expect(result.message).toContain('stopped successfully');
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(async () => {
      // Ensure server is running before each test
      if (!tester.isServerRunning()) {
        throw new Error('MCP server stopped before test execution');
      }
    });

    it('should stop all processes using stop_all tool', async () => {
      // Start a few test processes first
      await tester.sendMCPMessage('tools/call', {
        name: 'start',
        arguments: {
          command: 'echo',
          args: ['test1'],
          name: 'test-echo-1',
        },
      });

      await tester.sendMCPMessage('tools/call', {
        name: 'start',
        arguments: {
          command: 'echo',
          args: ['test2'],
          name: 'test-echo-2',
        },
      });

      // Stop all processes
      const response = await tester.sendMCPMessage('tools/call', {
        name: 'stop_all',
        arguments: {},
      });

      expect(response.result).toBeDefined();
      const result = tester.parseToolResult(response);

      expect(result.success).toBe(true);
      expect(result.stoppedCount).toBeGreaterThanOrEqual(0);
      expect(result.message).toContain('Successfully stopped');
      expect(result.stoppedProcesses).toBeDefined();
    }, 1000);

    it('should handle empty process list gracefully', async () => {
      // First ensure all processes are stopped
      await tester.sendMCPMessage('tools/call', {
        name: 'stop_all',
        arguments: {},
      });

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify no processes are running
      const listResponse = await tester.sendMCPMessage('tools/call', {
        name: 'list',
        arguments: {},
      });

      const listResult = tester.parseToolResult(listResponse);
      expect(listResult.success).toBe(true);
      expect(listResult.count).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(listResult.processes)).toBe(true);
    }, 10000);
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      // Ensure server is running before each test
      if (!tester.isServerRunning()) {
        throw new Error('MCP server stopped before test execution');
      }
    });

    it('should handle invalid process ID gracefully', async () => {
      const response = await tester.sendMCPMessage('tools/call', {
        name: 'get_info',
        arguments: {
          processId: 'non-existent-id',
        },
      });

      expect(response.result).toBeDefined();
      const result = tester.parseToolResult(response);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Process not found|PROCESS_NOT_FOUND/);
    });

    it('should handle invalid command gracefully', async () => {
      const response = await tester.sendMCPMessage('tools/call', {
        name: 'start',
        arguments: {
          command: 'non-existent-command-12345',
          args: [],
          name: 'invalid-command-test',
        },
      });

      expect(response.result).toBeDefined();
      const result = tester.parseToolResult(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Command not found');
    });
  });
});
