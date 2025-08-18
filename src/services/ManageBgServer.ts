import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { inject, injectable } from 'inversify';
import { z } from 'zod';
import { type BgProcessManager, BgProcessManagerTag } from '@/services/BgProcessManager.js';
import { type Logging, LoggingTag } from '@/services/Logging.js';
import { type PackageInfoProvider, PackageInfoProviderTag } from '@/services/PackageInfoProvider.js';
import { GetInfoHandler } from '@/services/tools/GetInfoHandler.js';
import { GetLogsHandler } from '@/services/tools/GetLogsHandler.js';
import { ListHandler } from '@/services/tools/ListHandler.js';
import { RestartHandler } from '@/services/tools/RestartHandler.js';
import { StartHandler } from '@/services/tools/StartHandler.js';
import { StopAllHandler } from '@/services/tools/StopAllHandler.js';
import { StopHandler } from '@/services/tools/StopHandler.js';

// Tool input schemas
const StartToolSchema = z.object({
  command: z.string().describe('Command to run'),
  args: z.array(z.string()).optional().describe('Command arguments'),
  name: z.string().optional().describe('Optional name for the process'),
  cwd: z.string().optional().describe('Working directory'),
  env: z.record(z.string()).optional().describe('Environment variables'),
});

const StopToolSchema = z.object({
  processId: z.string().describe('Process ID to stop'),
});

const RestartToolSchema = z.object({
  processId: z.string().describe('Process ID to restart'),
});

const StopAllToolSchema = z.object({});

const ListToolSchema = z.object({});

const GetInfoToolSchema = z.object({
  processId: z.string().describe('Process ID to get info for'),
});

const GetLogsToolSchema = z.object({
  processId: z.string().describe('Process ID to get logs for'),
  lines: z.number().optional().describe('Number of lines to retrieve (optional)'),
});

@injectable()
export class BgManageServer {
  private readonly server: McpServer;
  private isRunning = false;
  private isClosing = false;

  // eslint-disable-next-line @typescript-eslint/max-params -- MCP server requires multiple handlers
  constructor(
    @inject(BgProcessManagerTag) private readonly processManager: BgProcessManager,
    @inject(PackageInfoProviderTag) private readonly packageInfoProvider: PackageInfoProvider,
    @inject(LoggingTag) private readonly logging: Logging,
    @inject(StartHandler) private readonly startHandler: StartHandler,
    @inject(StopHandler) private readonly stopHandler: StopHandler,
    @inject(RestartHandler) private readonly restartHandler: RestartHandler,
    @inject(StopAllHandler) private readonly stopAllHandler: StopAllHandler,
    @inject(ListHandler) private readonly listHandler: ListHandler,
    @inject(GetInfoHandler) private readonly getInfoHandler: GetInfoHandler,
    @inject(GetLogsHandler) private readonly getLogsHandler: GetLogsHandler,
  ) {
    this.server = new McpServer({
      name: this.packageInfoProvider.getName(),
      version: this.packageInfoProvider.getVersion(),
    });

    this.setupHandlers();
  }

  /**
   * Setup MCP server tools
   */
  private setupHandlers(): void {
    this.server.registerTool('start', {
      description: 'Start a background process',
      inputSchema: StartToolSchema.shape,
    }, async (args) => {
      const result = await this.startHandler.handle(args);
      return result;
    });

    this.server.registerTool('stop', {
      description: 'Stop a background process',
      inputSchema: StopToolSchema.shape,
    }, async (args) => {
      const result = await this.stopHandler.handle(args);
      return result;
    });

    this.server.registerTool('restart', {
      description: 'Restart a background process',
      inputSchema: RestartToolSchema.shape,
    }, async (args) => {
      const result = await this.restartHandler.handle(args);
      return result;
    });

    this.server.registerTool('stop_all', {
      description: 'Stop all background processes',
      inputSchema: StopAllToolSchema.shape,
    }, async () => {
      const result = await this.stopAllHandler.handle();
      return result || { content: [{ type: 'text' as const, text: JSON.stringify({ success: true }) }] };
    });

    this.server.registerTool('list', {
      description: 'List all background processes',
      inputSchema: ListToolSchema.shape,
    }, async () => {
      return await this.listHandler.handle();
    });

    this.server.registerTool('get_info', {
      description: 'Get information about a specific process',
      inputSchema: GetInfoToolSchema.shape,
    }, async (args) => {
      const result = await this.getInfoHandler.handle(args);
      return result || { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'No data returned' }) }] };
    });

    this.server.registerTool('get_logs', {
      description: 'Get logs from a specific process',
      inputSchema: GetLogsToolSchema.shape,
    }, async (args) => {
      const result = await this.getLogsHandler.handle(args);
      return result || { content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: 'No data returned' }) }] };
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.isRunning = true;

    this.logging.info('Server running on stdio');
  }

  /**
   * Stop the server
   */
  async close(): Promise<void> {
    if (!this.isRunning || this.isClosing) {
      return;
    }
    this.isClosing = true;

    try {
      await this.processManager.stopAllProcesses();
    }
    catch (error) {
      this.logging.error('Error stopping processes during server shutdown:', error);
    }

    await this.server.close();
    this.isRunning = false;
  }

  /**
   * Check if server is running
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get server info (for testing)
   */
  getServerInfo(): { name: string; version: string } {
    return {
      name: this.packageInfoProvider.getName(),
      version: this.packageInfoProvider.getVersion(),
    };
  }
}
