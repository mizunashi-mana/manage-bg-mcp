/**
 * Process management error type enumeration
 */
export enum ErrorType {
  INVALID_COMMAND = 'INVALID_COMMAND',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  PROCESS_NOT_FOUND = 'PROCESS_NOT_FOUND',
  SPAWN_FAILED = 'SPAWN_FAILED',
  TERMINATION_FAILED = 'TERMINATION_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONCURRENT_ACCESS = 'CONCURRENT_ACCESS',
}

/**
 * Process management specific error class
 */
export class ProcessError extends Error {
  constructor(
    public readonly type: ErrorType,
    public readonly details: string,
    public readonly processId?: string,
  ) {
    super(`${type}: ${details}`);
    this.name = 'ProcessError';

    // Adjust stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProcessError);
    }
  }

  /**
   * Convert error to JSON format with detailed information
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      details: this.details,
      processId: this.processId,
    };
  }

  /**
   * Generate user-friendly error messages
   */
  getUserMessage(): string {
    switch (this.type) {
      case ErrorType.INVALID_COMMAND:
        return `Invalid command: ${this.details}`;
      case ErrorType.DIRECTORY_NOT_FOUND:
        return `Specified directory does not exist: ${this.details}`;
      case ErrorType.PROCESS_NOT_FOUND:
        return `Process not found: ${this.details}`;
      case ErrorType.SPAWN_FAILED:
        return `Failed to start process: ${this.details}`;
      case ErrorType.TERMINATION_FAILED:
        return `Failed to terminate process: ${this.details}`;
      case ErrorType.PERMISSION_DENIED:
        return `Insufficient permissions: ${this.details}`;
      case ErrorType.VALIDATION_ERROR:
        return `Invalid input value: ${this.details}`;
      case ErrorType.TIMEOUT_ERROR:
        return `Operation timed out: ${this.details}`;
      case ErrorType.RESOURCE_EXHAUSTED:
        return `Resources exhausted: ${this.details}`;
      case ErrorType.INTERNAL_ERROR:
        return `Internal error occurred: ${this.details}`;
      case ErrorType.CONCURRENT_ACCESS:
        return `Concurrent access error occurred: ${this.details}`;
    }
  }

  /**
   * Generate recovery suggestion message
   */
  getRecoveryMessage(): string {
    switch (this.type) {
      case ErrorType.INVALID_COMMAND:
        return 'Please specify a valid command name. Dangerous commands or special characters cannot be used.';
      case ErrorType.DIRECTORY_NOT_FOUND:
        return 'Please check the directory path and specify an existing directory.';
      case ErrorType.PROCESS_NOT_FOUND:
        return 'Please check the process list and specify an existing process ID.';
      case ErrorType.SPAWN_FAILED:
        return 'Please verify that the command is correctly installed and the path is set.';
      case ErrorType.TERMINATION_FAILED:
        return 'Try the force termination option or check if the process has already exited.';
      case ErrorType.PERMISSION_DENIED:
        return 'Please check that you have the necessary permissions and run with administrator privileges.';
      case ErrorType.VALIDATION_ERROR:
        return 'Please check the format and values of input parameters.';
      case ErrorType.TIMEOUT_ERROR:
        return 'Please wait a while and retry, or use the force termination option.';
      case ErrorType.RESOURCE_EXHAUSTED:
        return 'Please check system resources, stop unnecessary processes, and then retry.';
      case ErrorType.INTERNAL_ERROR:
        return 'Please check system logs and restart the service if necessary.';
      case ErrorType.CONCURRENT_ACCESS:
        return 'Please wait a while and retry.';
    }
  }
}
