import { describe, it, expect, vi } from 'vitest';
import { ConfigProviderImpl } from '@/services/ConfigProvider.js';
import { LoggingImpl, NoOpLogging } from '@/services/Logging.js';

describe('Logging', () => {
  describe('LoggingImpl', () => {
    it('should be disabled when ConfigProvider returns false', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const consoleErrorSpy = vi.spyOn(console, 'error');
      const consoleWarnSpy = vi.spyOn(console, 'warn');

      const configProvider = new ConfigProviderImpl({
        maxLogLinesPerProcesses: 1000,
        maxConcurrentProcesses: 10,
        processTerminationTimeoutMs: 5000,
        loggingEnabled: false,
      });
      const logging = new LoggingImpl(configProvider);
      logging.debug('test debug', { extra: 'data' });
      logging.info('test info');
      logging.warn('test warn');
      logging.error('test error');

      expect(consoleSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should log when ConfigProvider returns true', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const consoleErrorSpy = vi.spyOn(console, 'error');
      const consoleWarnSpy = vi.spyOn(console, 'warn');

      const configProvider = new ConfigProviderImpl({
        maxLogLinesPerProcesses: 1000,
        maxConcurrentProcesses: 10,
        processTerminationTimeoutMs: 5000,
        loggingEnabled: true,
      });
      const logging = new LoggingImpl(configProvider);
      logging.debug('test debug');
      logging.info('test info');
      logging.warn('test warn');
      logging.error('test error');

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] test debug');
      expect(consoleSpy).toHaveBeenCalledWith('[INFO] test info');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] test warn');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] test error');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should pass additional arguments to debug only', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const consoleErrorSpy = vi.spyOn(console, 'error');

      const configProvider = new ConfigProviderImpl({
        maxLogLinesPerProcesses: 1000,
        maxConcurrentProcesses: 10,
        processTerminationTimeoutMs: 5000,
        loggingEnabled: true,
      });
      const logging = new LoggingImpl(configProvider);
      const extraData = { foo: 'bar' };
      logging.debug('test message', extraData, 42);
      logging.info('info message');
      const err = new Error('test error');
      logging.error('error message', err);

      expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] test message', extraData, 42);
      expect(consoleSpy).toHaveBeenCalledWith('[INFO] info message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] error message', err);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should be disabled in test environment by default', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const consoleSpy = vi.spyOn(console, 'log');
      const configProvider = new ConfigProviderImpl({
        maxLogLinesPerProcesses: 1000,
        maxConcurrentProcesses: 10,
        processTerminationTimeoutMs: 5000,
        // loggingEnabled not specified, should use NODE_ENV
      });
      const logging = new LoggingImpl(configProvider);
      logging.info('test message');

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('NoOpLogging', () => {
    it('should not log anything', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const consoleErrorSpy = vi.spyOn(console, 'error');
      const consoleWarnSpy = vi.spyOn(console, 'warn');

      const logging = new NoOpLogging();
      logging.debug('test debug');
      logging.info('test info');
      logging.warn('test warn');
      logging.error('test error');

      expect(consoleSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });
});
