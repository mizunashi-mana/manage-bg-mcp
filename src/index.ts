import { parseArgs } from 'node:util';
import { buildContainer } from '@/container/DIContainer.js';
import { loadConfig } from '@/services/ConfigProvider.js';
import { type BgManageServer } from '@/services/ManageBgServer.js';
import { loadPackageInfo } from '@/services/PackageInfoProvider.js';

/**
 * Main execution function
 */
async function main() {
  try {
    const configProvider = await loadConfig();
    const packageInfoProvider = await loadPackageInfo();

    const container = buildContainer({
      configProviderImpl: configProvider,
      packageInfoProviderImpl: packageInfoProvider,
    });

    const server = container.getServer();

    setupGracefulShutdown(server);

    await server.start();
  }
  catch (error) {
    process.stderr.write(`Failed to start MCP server: ${String(error)}\n`);
    process.exit(1);
  }
}

/**
 * Set up graceful shutdown handler
 */
function setupGracefulShutdown(server: BgManageServer): void {
  const gracefulShutdown = async (signal: string) => {
    process.stderr.write(`Received ${signal}, shutting down gracefully...\n`);

    try {
      await server.close();
      process.stderr.write('Server closed successfully\n');
    }
    catch (error) {
      process.stderr.write(`Error during server shutdown: ${String(error)}\n`);
      process.exit(1);
    }

    process.exit(0);
  };

  process.on('SIGINT', () => {
    void gracefulShutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void gracefulShutdown('SIGTERM');
  });
  process.on('SIGQUIT', () => {
    void gracefulShutdown('SIGQUIT');
  });

  process.on('uncaughtException', (error) => {
    process.stderr.write(`Uncaught Exception: ${String(error)}\n`);
    void gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, _promise) => {
    process.stderr.write(`Unhandled Rejection at: [Promise] reason: ${String(reason)}\n`);
    void gracefulShutdown('unhandledRejection');
  });
}

// Show version information
async function showVersion() {
  const packageInfoProvider = await loadPackageInfo();
  process.stdout.write(`${packageInfoProvider.getName()} v${packageInfoProvider.getVersion()}\n`);
}

// Show help information
async function showHelp() {
  const packageInfoProvider = await loadPackageInfo();
  process.stdout.write(`
${packageInfoProvider.getName()} v${packageInfoProvider.getVersion()}

DESCRIPTION:
  ${packageInfoProvider.getDescription()}

USAGE:
  ${packageInfoProvider.getName()} [options]

OPTIONS:
  --version, -v    Show version information
  --help, -h       Show this help message

EXAMPLES:
  # Start the MCP server
  ${packageInfoProvider.getName()}

  # Show version
  ${packageInfoProvider.getName()} --version

ENVIRONMENT VARIABLES:
  NODE_ENV         Set to 'production' for production mode
  LOG_LEVEL        Set logging level (error, warn, info, debug)

For more information, visit: ${packageInfoProvider.getHomepage()}
`);
}

// Process command line arguments and execute main function
async function handleCliAndRun() {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        version: {
          type: 'boolean',
          short: 'v',
          default: false,
        },
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
      },
      allowPositionals: false,
    });

    if (values.version) {
      await showVersion();
      return;
    }

    if (values.help) {
      await showHelp();
      return;
    }

    await main();
  }
  catch (error) {
    if (error instanceof Error && (
      error.message.includes('Unknown option')
      || error.message.includes('Unexpected argument')
    )) {
      process.stderr.write(`Error: ${error.message}\n`);
      process.stderr.write('Use --help for usage information\n');
      process.exit(1);
    }
    throw error;
  }
}

// ES module main check
// Execute only if this is the main module
void handleCliAndRun().catch((error: unknown) => {
  process.stderr.write(`Fatal error: ${String(error)}\n`);
  process.exit(1);
});
