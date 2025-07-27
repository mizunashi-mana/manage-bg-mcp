import type { ProcessController, ProcessSpawnConfig, ProcessSpawnResult } from '@/services/ProcessController.js';

export class MockProcessController implements ProcessController {
  private readonly processes = new Map<number, { config: ProcessSpawnConfig; exitCode?: number }>();
  private nextPid = 1000;

  async spawn(config: ProcessSpawnConfig): Promise<ProcessSpawnResult> {
    const pid = this.nextPid++;
    this.processes.set(pid, { config });

    return {
      pid,
      onExit: (_callback: (code: number | null) => void) => {
        // Mock implementation - does nothing
      },
      onError: (_callback: (error: Error) => void) => {
        // Mock implementation - does nothing
      },
      onStdout: (_callback: (data: Buffer) => void) => {
        // Mock implementation - does nothing
      },
      onStderr: (_callback: (data: Buffer) => void) => {
        // Mock implementation - does nothing
      },
    };
  }

  kill(pid: number, force = false): boolean {
    const process = this.processes.get(pid);
    if (!process) {
      return false;
    }

    process.exitCode = force ? 9 : 0;
    return true;
  }

  async waitForExit(pid: number, _timeoutMs = 5000): Promise<void> {
    const process = this.processes.get(pid);
    if (!process) {
      throw new Error(`Process ${pid} not found`);
    }

    // Simulate process exit
    await new Promise(resolve => setTimeout(resolve, 10));
    process.exitCode = 0;
  }

  // Test helper methods
  getProcess(pid: number) {
    return this.processes.get(pid);
  }

  getAllProcesses() {
    return Array.from(this.processes.entries());
  }

  clear() {
    this.processes.clear();
  }
}
