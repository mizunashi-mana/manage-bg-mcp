import { inject, injectable } from 'inversify';
import { type BgProcessManager, BgProcessManagerTag } from '@/services/BgProcessManager.js';

interface GetInfoToolArgs {
  processId: string;
}

@injectable()
export class GetInfoHandler {
  constructor(
    @inject(BgProcessManagerTag) private readonly processManager: BgProcessManager,
  ) {}

  async handle(args: GetInfoToolArgs): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const processInfo = await this.processManager.getProcessInfo(args.processId);

      if (!processInfo) {
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
            type: 'text',
            text: JSON.stringify({
              success: true,
              process: {
                id: processInfo.id,
                pid: processInfo.pid,
                command: processInfo.command,
                args: processInfo.args,
                cwd: processInfo.cwd,
                status: processInfo.status,
                startTime: processInfo.startTime,
                endTime: processInfo.endTime,
                exitCode: processInfo.exitCode,
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
            type: 'text',
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
