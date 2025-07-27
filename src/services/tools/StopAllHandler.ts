import { inject, injectable } from 'inversify';
import { type BgProcessManager, BgProcessManagerTag } from '@/services/BgProcessManager.js';

@injectable()
export class StopAllHandler {
  constructor(
    @inject(BgProcessManagerTag) private readonly processManager: BgProcessManager,
  ) {}

  async handle(): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      // Get list of processes before stopping them for reporting
      const processes = await this.processManager.listProcesses();
      const runningProcesses = processes.filter(p => p.status === 'running');
      const runningCount = runningProcesses.length;

      if (runningCount === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                message: 'No running processes to stop',
                stoppedCount: 0,
              }, null, 2),
            },
          ],
        };
      }

      await this.processManager.stopAllProcesses();

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `Successfully stopped ${runningCount} process(es)`,
              stoppedCount: runningCount,
              stoppedProcesses: runningProcesses.map(p => ({
                id: p.id,
                command: p.command,
                args: p.args,
              })),
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
