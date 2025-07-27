import * as fs from 'fs';
import { inject, injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { ErrorType, ProcessError } from '@/models/errors.js';
import { type ManagedProcess, type ProcessStatus } from '@/models/ManagedProcess.js';
import { type ProcessController, ProcessControllerTag, type ProcessSpawnResult } from '@/services/ProcessController.js';
import { type ProcessLogBuffer, ProcessLogBufferTag } from '@/services/ProcessLogBuffer.js';

export const BgProcessManagerTag = Symbol.for('BgProcessManager');

export interface BgProcessManager {
  startProcess: (config: {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
  }) => Promise<ManagedProcess>;
  stopProcess: (processId: string) => Promise<void>;
  listProcesses: () => Promise<ManagedProcess[]>;
  getProcessInfo: (processId: string) => Promise<ManagedProcess | undefined>;
  restartProcess: (processId: string) => Promise<string>; // Returns new process ID
  stopAllProcesses: () => Promise<void>;
  getProcessLogs: (processId: string, lines?: number) => Promise<{ logs: Array<{ type: 'stdout' | 'stderr'; line: string; timestamp: Date }>; lastUpdated: Date } | undefined>;
}

interface ProcessRecord {
  managedProcess: ManagedProcess;
  spawnResult: ProcessSpawnResult;
}

/**
 * Process management service
 * Manages, monitors, and saves logs for processes
 */
@injectable()
export class BgProcessManagerImpl implements BgProcessManager {
  private readonly processes = new Map<string, ProcessRecord>();

  constructor(
    @inject(ProcessLogBufferTag) private readonly logBuffer: ProcessLogBuffer,
    @inject(ProcessControllerTag) private readonly processController: ProcessController,
  ) {}

  /**
   * Start a process
   * @param config Process configuration
   * @returns Managed process
   */
  async startProcess(config: {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
  }): Promise<ManagedProcess> {
    const args = config.args ?? [];
    const cwd = config.cwd ?? process.cwd();

    // Validate directory
    if (!(await this.validateDirectory(cwd))) {
      throw new ProcessError(
        ErrorType.DIRECTORY_NOT_FOUND,
        `Directory not found: ${cwd}`,
      );
    }

    const processId = this.generateProcessId();

    try {
      const spawnResult = await this.processController.spawn({
        command: config.command,
        args,
        cwd,
        env: config.env,
      });

      const managedProcess: ManagedProcess = {
        id: processId,
        pid: spawnResult.pid,
        command: config.command,
        args,
        cwd,
        status: 'running',
        startTime: new Date(),
      };

      this.processes.set(processId, {
        managedProcess,
        spawnResult,
      });

      this.setupEventHandlers(processId, spawnResult);

      return managedProcess;
    }
    catch (error) {
      throw new ProcessError(
        ErrorType.SPAWN_FAILED,
        `Failed to spawn process: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Set up event handlers
   * @param processId Process ID
   * @param spawnResult Process spawn result
   */
  private setupEventHandlers(processId: string, spawnResult: ProcessSpawnResult): void {
    spawnResult.onStdout((data) => {
      this.logBuffer.appendStdout(processId, data.toString());
    });

    spawnResult.onStderr((data) => {
      this.logBuffer.appendStderr(processId, data.toString());
    });

    spawnResult.onExit((code) => {
      const status: ProcessStatus = code === 0 ? 'stopped' : 'error';
      this.updateProcessStatus(processId, status, code ?? undefined);
    });

    spawnResult.onError((error) => {
      this.logBuffer.appendStderr(processId, `Process error: ${error.message}\n`);
      this.updateProcessStatus(processId, 'error');
    });
  }

  /**
   * Update process status
   * @param processId Process ID
   * @param status New status
   * @param exitCode Exit code (optional)
   */
  private updateProcessStatus(processId: string, status: ProcessStatus, exitCode?: number): void {
    const record = this.processes.get(processId);
    if (!record) {
      return;
    }

    record.managedProcess = {
      ...record.managedProcess,
      status,
      exitCode,
      endTime: status !== 'running' ? new Date() : undefined,
    };
  }

  /**
   * Validate directory
   * @param dirPath Directory path
   * @returns Whether it is valid
   */
  private async validateDirectory(dirPath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(dirPath)) {
        return false;
      }

      const stats = fs.statSync(dirPath);
      return stats.isDirectory();
    }
    catch {
      return false;
    }
  }

  /**
   * Stop a process
   * @param processId Process ID
   */
  async stopProcess(processId: string): Promise<void> {
    const record = this.processes.get(processId);
    if (!record) {
      throw new ProcessError(
        ErrorType.PROCESS_NOT_FOUND,
        `Process not found: ${processId}`,
      );
    }

    if (record.managedProcess.status !== 'running') {
      return; // Already stopped
    }

    try {
      const killed = this.processController.kill(record.managedProcess.pid);
      if (!killed) {
        // Try SIGKILL if SIGTERM fails
        this.processController.kill(record.managedProcess.pid, true);
      }

      // Wait for process to exit
      await this.processController.waitForExit(record.managedProcess.pid);
    }
    catch (error) {
      this.updateProcessStatus(processId, 'error');
      throw new ProcessError(
        ErrorType.TERMINATION_FAILED,
        `Failed to stop process: ${error instanceof Error ? error.message : String(error)}`,
        processId,
      );
    }
  }

  /**
   * Restart a process
   * @param processId Process ID
   * @returns New process ID
   */
  async restartProcess(processId: string): Promise<string> {
    const record = this.processes.get(processId);
    if (!record) {
      throw new ProcessError(
        ErrorType.PROCESS_NOT_FOUND,
        `Process not found: ${processId}`,
      );
    }

    // Save original process configuration
    const config = {
      command: record.managedProcess.command,
      args: record.managedProcess.args,
      cwd: record.managedProcess.cwd,
    };

    // Stop process (skip if already stopped)
    if (record.managedProcess.status === 'running') {
      await this.stopProcess(processId);
    }

    this.processes.delete(processId);
    this.logBuffer.clearLogs(processId);

    const newProcess = await this.startProcess(config);
    return newProcess.id;
  }

  /**
   * Stop all processes
   */
  async stopAllProcesses(): Promise<void> {
    const runningProcesses = Array.from(this.processes.values())
      .filter(r => r.managedProcess.status === 'running')
      .map(r => r.managedProcess.id);

    const stopPromises = runningProcesses.map(async (id) => {
      await this.stopProcess(id);
    });
    await Promise.allSettled(stopPromises);
  }

  /**
   * Get process list
   * @returns Array of managed processes
   */
  async listProcesses(): Promise<ManagedProcess[]> {
    return Array.from(this.processes.values()).map(r => r.managedProcess);
  }

  /**
   * Get process information
   * @param processId Process ID
   * @returns Managed process (undefined if not found)
   */
  async getProcessInfo(processId: string): Promise<ManagedProcess | undefined> {
    const record = this.processes.get(processId);
    return record?.managedProcess;
  }

  /**
   * Get process logs
   * @param processId Process ID
   * @param lines Number of lines to retrieve (all if omitted)
   * @returns Log data (undefined if process not found)
   */
  async getProcessLogs(processId: string, lines?: number): Promise<{ logs: Array<{ type: 'stdout' | 'stderr'; line: string; timestamp: Date }>; lastUpdated: Date } | undefined> {
    const record = this.processes.get(processId);
    if (!record) {
      return undefined;
    }

    const logData = this.logBuffer.getLatestLogs(processId, lines);
    return {
      logs: logData.logs,
      lastUpdated: logData.lastUpdated,
    };
  }

  /**
   * Generate process ID
   * @returns Unique process ID
   */
  private generateProcessId(): string {
    return uuidv4();
  }
}
