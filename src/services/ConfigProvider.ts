export const ConfigProviderTag = Symbol.for('ConfigProvider');

export interface ConfigProvider {
  getMaxLogLinesPerProcesses: () => number;
  getMaxConcurrentProcesses: () => number;
  getProcessTerminationTimeoutMs: () => number;
  isLoggingEnabled: () => boolean;
}

export type Config = {
  maxLogLinesPerProcesses: number;
  maxConcurrentProcesses: number;
  processTerminationTimeoutMs: number;
  loggingEnabled?: boolean;
};

export class ConfigProviderImpl implements ConfigProvider {
  constructor(private readonly config: Config) {}

  getMaxLogLinesPerProcesses(): number {
    return this.config.maxLogLinesPerProcesses;
  }

  getMaxConcurrentProcesses(): number {
    return this.config.maxConcurrentProcesses;
  }

  getProcessTerminationTimeoutMs(): number {
    return this.config.processTerminationTimeoutMs;
  }

  isLoggingEnabled(): boolean {
    // Default to true if not specified, but disable in test environment
    if (this.config.loggingEnabled !== undefined) {
      return this.config.loggingEnabled;
    }
    return process.env.NODE_ENV !== 'test';
  }
}

export async function loadConfig(): Promise<ConfigProvider> {
  return new ConfigProviderImpl({
    maxConcurrentProcesses: 20,
    maxLogLinesPerProcesses: 200,
    processTerminationTimeoutMs: 5000,
  });
}
