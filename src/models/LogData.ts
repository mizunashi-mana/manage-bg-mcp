export type LogEntry = {
  /** Log type */
  type: 'stdout' | 'stderr';
  /** Log content */
  line: string;
  /** Timestamp */
  timestamp: Date;
};

export type ProcessLogs = LogEntry[];

export type LogData = {
  /** All log entries for the process (in chronological order) */
  logs: ProcessLogs;
  /** Last updated time */
  lastUpdated: Date;
};
