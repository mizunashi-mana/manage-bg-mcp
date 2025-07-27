import { inject, injectable } from 'inversify';
import { type BgProcessManager, BgProcessManagerTag } from '@/services/BgProcessManager.js';

interface GetLogsToolArgs {
  processId: string;
  lines?: number;
}

@injectable()
export class GetLogsHandler {
  constructor(
    @inject(BgProcessManagerTag) private readonly processManager: BgProcessManager,
  ) {}

  async handle(args: GetLogsToolArgs): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const logs = await this.processManager.getProcessLogs(args.processId, args.lines);

      if (!logs) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                error: `Process not found: ${args.processId}`,
              }, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              processId: args.processId,
              logs: {
                lastUpdated: logs.lastUpdated.toISOString(),
                totalLines: logs.logs.length,
                stdout: logs.logs.filter(entry => entry.type === 'stdout').map(entry => entry.line),
                stderr: logs.logs.filter(entry => entry.type === 'stderr').map(entry => entry.line),
              },
            }, null, 2),
          },
        ],
      };
    }
    catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            }, null, 2),
          },
        ],
      };
    }
  }
}
