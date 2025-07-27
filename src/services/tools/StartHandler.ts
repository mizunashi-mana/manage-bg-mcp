import { inject, injectable } from 'inversify';
import { type BgProcessManager, BgProcessManagerTag } from '@/services/BgProcessManager.js';

interface StartToolArgs {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

@injectable()
export class StartHandler {
  constructor(
    @inject(BgProcessManagerTag) private readonly processManager: BgProcessManager,
  ) {}

  async handle(args: StartToolArgs): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const config = {
        command: args.command,
        args: args.args ?? [],
        cwd: args.cwd,
        env: args.env,
      };

      const process = await this.processManager.startProcess(config);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              processId: process.id,
              pid: process.pid,
              command: process.command,
              args: process.args,
              cwd: process.cwd,
              status: process.status,
              startTime: process.startTime,
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
