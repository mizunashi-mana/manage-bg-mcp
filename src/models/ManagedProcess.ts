/**
 * Process execution status
 */
export type ProcessStatus = 'running' | 'stopped' | 'error';

/**
 * Complete information for a managed process
 */
export interface ManagedProcess {
  /** Unique process ID */
  readonly id: string;
  /** System process ID */
  readonly pid: number;
  /** Execution command */
  readonly command: string;
  /** Command arguments */
  readonly args: string[];
  /** Current directory */
  readonly cwd: string;
  /** Process status */
  readonly status: ProcessStatus;
  /** Process start time */
  readonly startTime: Date;
  /** Process end time (only when terminated) */
  readonly endTime?: Date;
  /** Exit code (only when terminated) */
  readonly exitCode?: number;
}
