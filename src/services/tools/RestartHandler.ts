import { inject, injectable } from 'inversify';
import { type BgProcessManager, BgProcessManagerTag } from '@/services/BgProcessManager.js';

interface RestartToolArgs {
  processId: string;
}

@injectable()
export class RestartHandler {
  constructor(
    @inject(BgProcessManagerTag) private readonly processManager: BgProcessManager,
  ) {}

  async handle(args: RestartToolArgs): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const newProcessId = await this.processManager.restartProcess(args.processId);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              originalProcessId: args.processId,
              newProcessId,
              message: 'Process restarted successfully',
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
