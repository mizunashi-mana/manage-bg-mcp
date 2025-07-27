import { inject, injectable } from 'inversify';
import { type LogData, type LogEntry, type ProcessLogs } from '@/models/LogData.js';
import { type ConfigProvider, ConfigProviderTag } from '@/services/ConfigProvider.js';

export const ProcessLogBufferTag = Symbol.for('ProcessLogBuffer');

export interface ProcessLogBuffer {
  appendStdout: (processId: string, data: string) => void;
  appendStderr: (processId: string, data: string) => void;
  getLatestLogs: (processId: string, lines?: number) => LogData;
  clearLogs: (processId: string) => void;
}

type LogBufferElement = {
  logs: ProcessLogs;
  lastUpdated: Date;
};

/**
 * Buffer-based log management service
 * Manages integrated log entries chronologically for each process
 */
@injectable()
export class ProcessLogBufferImpl implements ProcessLogBuffer {
  private readonly buffers = new Map<string, LogBufferElement>();
  private readonly maxLines: number;

  constructor(@inject(ConfigProviderTag) private readonly configService: ConfigProvider) {
    this.maxLines = configService.getMaxLogLinesPerProcesses();
  }

  /**
   * Append stdout data
   * @param processId Process ID
   * @param data Data to append (including newlines)
   */
  appendStdout(processId: string, data: string): void {
    const buffer = this.getOrCreateBuffer(processId);
    const lines = this.parseLines(data);

    if (lines.length > 0) {
      const timestamp = new Date();
      const entries: LogEntry[] = lines.map(line => ({
        type: 'stdout' as const,
        line,
        timestamp,
      }));

      buffer.logs.push(...entries);
      this.enforceBufferLimits(buffer);
      buffer.lastUpdated = timestamp;
    }
  }

  /**
   * Append stderr data
   * @param processId Process ID
   * @param data Data to append (including newlines)
   */
  appendStderr(processId: string, data: string): void {
    const buffer = this.getOrCreateBuffer(processId);
    const lines = this.parseLines(data);

    if (lines.length > 0) {
      const timestamp = new Date();
      const entries: LogEntry[] = lines.map(line => ({
        type: 'stderr' as const,
        line,
        timestamp,
      }));

      buffer.logs.push(...entries);
      this.enforceBufferLimits(buffer);
      buffer.lastUpdated = timestamp;
    }
  }

  /**
   * Get latest log data
   * @param processId Process ID
   * @param lines Number of lines to retrieve (all if omitted)
   * @returns Log data
   */
  getLatestLogs(processId: string, lines?: number): LogData {
    const buffer = this.buffers.get(processId);

    if (!buffer) {
      return {
        logs: [],
        lastUpdated: new Date(),
      };
    }

    let logs = buffer.logs;

    if (lines !== undefined && lines > 0) {
      // Get the latest 'lines' entries (preserving chronological order)
      logs = buffer.logs.slice(-lines);
    }

    return {
      logs,
      lastUpdated: buffer.lastUpdated,
    };
  }

  /**
   * Clear process logs
   * @param processId Process ID
   */
  clearLogs(processId: string): void {
    this.buffers.delete(processId);
  }

  /**
   * @param processId Process ID
   * @returns Process log buffer
   */
  private getOrCreateBuffer(processId: string): LogBufferElement {
    let buffer = this.buffers.get(processId);
    if (!buffer) {
      buffer = {
        logs: [],
        lastUpdated: new Date(),
      };
      this.buffers.set(processId, buffer);
    }
    return buffer;
  }

  /**
   * Enforce buffer limits
   * @param buffer Process log buffer
   */
  private enforceBufferLimits(buffer: LogBufferElement): void {
    if (buffer.logs.length > this.maxLines) {
      // Keep only the latest maxLines entries (preserving chronological order)
      buffer.logs = buffer.logs.slice(-this.maxLines);
    }
  }

  /**
   * Split string into lines
   * @param data String data
   * @returns Array of lines
   */
  private parseLines(data: string): string[] {
    if (!data) return [];

    // Split by newlines and remove empty lines
    return data
      .split(/\r?\n/)
      .filter(line => line.length > 0);
  }
}
