import { inject, injectable } from 'inversify';
import { type ConfigProvider, ConfigProviderTag } from '@/services/ConfigProvider.js';

export const LoggingTag = Symbol('Logging');

export interface Logging {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string, error?: unknown) => void;
}

@injectable()
export class LoggingImpl implements Logging {
  private readonly enabled: boolean;

  constructor(
    @inject(ConfigProviderTag) configProvider: ConfigProvider,
  ) {
    this.enabled = configProvider.isLoggingEnabled();
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string): void {
    if (this.enabled) {
      console.log(`[INFO] ${message}`);
    }
  }

  warn(message: string): void {
    if (this.enabled) {
      console.warn(`[WARN] ${message}`);
    }
  }

  error(message: string, error?: unknown): void {
    if (this.enabled) {
      if (error !== undefined) {
        console.error(`[ERROR] ${message}`, error);
      }
      else {
        console.error(`[ERROR] ${message}`);
      }
    }
  }
}

@injectable()
export class NoOpLogging implements Logging {
  debug(_message: string, ..._args: unknown[]): void {
    // No-op
  }

  info(_message: string): void {
    // No-op
  }

  warn(_message: string): void {
    // No-op
  }

  error(_message: string, _error?: unknown): void {
    // No-op
  }
}
