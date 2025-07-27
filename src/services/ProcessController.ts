import { spawn, type ChildProcess } from 'child_process';
import { injectable } from 'inversify';

export type ProcessStatus = 'running' | 'stopped' | 'error';

export type ProcessSpawnResult = {
  pid: number;
  onExit: (callback: (code: number | null) => void) => void;
  onError: (callback: (error: Error) => void) => void;
  onStdout: (callback: (data: Buffer) => void) => void;
  onStderr: (callback: (data: Buffer) => void) => void;
};

export type ProcessSpawnConfig = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
};

export const ProcessControllerTag = Symbol.for('ProcessController');

/**
 * ProcessController interface
 * Functions as a wrapper for child_process, responsible only for starting and stopping processes
 */
export interface ProcessController {
  spawn: (config: ProcessSpawnConfig) => Promise<ProcessSpawnResult>;
  kill: (pid: number, force?: boolean) => boolean;
  waitForExit: (pid: number, timeoutMs?: number) => Promise<void>;
}

/**
 * Process control service
 * Functions as a wrapper for child_process
 */
@injectable()
export class ProcessControllerImpl implements ProcessController {
  private readonly processes = new Map<number, ChildProcess>();

  /**
   * Start a process
   * @param config Process configuration
   * @returns Process spawn result
   */
  async spawn(config: ProcessSpawnConfig): Promise<ProcessSpawnResult> {
    return await new Promise((resolve, reject) => {
      let childProcess: ChildProcess;

      try {
        childProcess = spawn(config.command, config.args ?? [], {
          cwd: config.cwd,
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: config.env ? { ...process.env, ...config.env } : undefined,
        });
      }
      catch (error) {
        reject(new Error(`Failed to spawn process: ${error instanceof Error ? error.message : String(error)}`));
        return;
      }

      const pid = childProcess.pid;
      if (!pid) {
        reject(new Error('Failed to get process PID'));
        return;
      }

      this.processes.set(pid, childProcess);

      // Set up error handler (catch errors immediately after startup)
      const errorHandler = (error: Error) => {
        this.processes.delete(pid);
        reject(new Error(`Process spawn error: ${error.message}`));
      };
      childProcess.once('error', errorHandler);

      // Wait a bit before treating as success
      setTimeout(() => {
        childProcess.removeListener('error', errorHandler);

        childProcess.once('exit', () => {
          this.processes.delete(pid);
        });

        resolve({
          pid,
          onExit: (callback) => {
            childProcess.on('exit', callback);
          },
          onError: (callback) => {
            childProcess.on('error', callback);
          },
          onStdout: (callback) => {
            childProcess.stdout?.on('data', callback);
          },
          onStderr: (callback) => {
            childProcess.stderr?.on('data', callback);
          },
        });
      }, 10);
    });
  }

  /**
   * Terminate a process
   * @param pid Process ID
   * @param force Force termination flag
   * @returns Whether the termination signal was successfully sent
   */
  kill(pid: number, force = false): boolean {
    const childProcess = this.processes.get(pid);
    if (!childProcess) {
      return false;
    }

    const signal = force ? 'SIGKILL' : 'SIGTERM';
    return childProcess.kill(signal);
  }

  /**
   * Wait for process to exit
   * @param pid Process ID
   * @param timeoutMs Timeout in milliseconds
   */
  async waitForExit(pid: number, timeoutMs = 5000): Promise<void> {
    const childProcess = this.processes.get(pid);
    if (!childProcess) {
      await Promise.resolve();
      return; // Already exited
    }

    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(undefined);
      }, timeoutMs);

      childProcess.once('exit', () => {
        clearTimeout(timeout);
        resolve(undefined);
      });

      // If the process has already exited
      if (childProcess.killed) {
        clearTimeout(timeout);
        resolve(undefined);
      }
    });
  }
}
