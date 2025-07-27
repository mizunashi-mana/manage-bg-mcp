# Background Process Management MCP Server

A Model Context Protocol (MCP) server for managing background processes with AI agents.

## Overview

This MCP server enables AI agents to efficiently manage and monitor background processes. It provides comprehensive functionality for process startup, termination, log retrieval, and resource management with a unified time-series log system.

## Features

- **Process Management**: Start, stop, and restart background processes
- **Unified Log Management**: Real-time log capture with chronological ordering across stdout/stderr
- **Resource Management**: Configurable limits for concurrent processes and log storage
- **MCP Compliant**: Full Model Context Protocol implementation
- **Type Safety**: Complete TypeScript support with Zod schema validation
- **Production Ready**: Designed for reliability and performance

## Quick Start

### Using with npx (Recommended)

```bash
# Run the MCP server directly
npx @mizunashi_mana/manage-bg-mcp

# With options
npx @mizunashi_mana/manage-bg-mcp --help
npx @mizunashi_mana/manage-bg-mcp --version
```

### MCP Client Configuration

#### Claude Desktop

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "background-process-manager": {
      "command": "npx",
      "args": ["@mizunashi_mana/manage-bg-mcp"]
    }
  }
}
```

#### Other MCP Clients

For any MCP client that supports stdio transport:

```bash
# Command: npx
# Args: ["@mizunashi_mana/manage-bg-mcp"]
# Transport: stdio
```

#### Programmatic Usage

```javascript
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['@mizunashi_mana/manage-bg-mcp']
});
```

### Installation for Development

```bash
# Clone and install for development
git clone <repository-url>
cd manage-bg-mcp
npm install
npm run build
```

### Environment Variables

- `NODE_ENV`: Execution environment (production, development, test)
- `LOG_LEVEL`: Logging level (error, warn, info, debug)

## MCP Tools

### Available Tools

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `start` | Start a background process | `command`, `args?`, `name?`, `cwd?`, `env?` |
| `stop` | Stop a running process | `processId` |
| `restart` | Restart an existing process | `processId` |
| `list` | List all managed processes | - |
| `get_info` | Get detailed process information | `processId` |
| `get_logs` | Retrieve process logs | `processId`, `lines?` |
| `stop_all` | Stop all running processes | - |

### Usage Examples

Once configured with your MCP client, you can use these tools:

```javascript
// Start a Node.js server
const startResult = await client.callTool('start', {
  command: 'node',
  args: ['server.js'],
  cwd: '/path/to/project',
  name: 'web-server'
});

// List all processes
const processes = await client.callTool('list', {});

// Get recent logs (last 50 lines)
const logs = await client.callTool('get_logs', {
  processId: 'process-uuid',
  lines: 50
});

// Stop a specific process
await client.callTool('stop', {
  processId: 'process-uuid'
});
```

### Log Response Format

The `get_logs` tool returns unified chronological logs:

```json
{
  "success": true,
  "processId": "process-uuid",
  "logs": {
    "stdout": ["Output line 1", "Output line 2"],
    "stderr": ["Error line 1"],
    "lastUpdated": "2024-01-01T12:00:00.000Z",
    "totalLines": 3
  }
}
```

## Resource Limits

Default resource limits:

- **Maximum concurrent processes**: 20
- **Maximum log lines per process**: 200
- **Process termination timeout**: 5 seconds

## Architecture

The server uses a modern dependency injection architecture with unified log management:

- **Unified Log Management**: Time-series log storage combining stdout/stderr chronologically
- **Dependency Injection**: Inversify-based service container for clean separation of concerns
- **Type Safety**: Full TypeScript with Zod schema validation
- **MCP Compliance**: Complete implementation of Model Context Protocol
- **Configurable Logging**: Environment-aware logging with test mode support

## Performance

- **Response time**: Less than 50ms for typical operations
- **Concurrent processing**: Manage up to 20 processes simultaneously
- **Memory efficiency**: Automatic log buffer trimming
- **Scalability**: Handles large workloads efficiently

## Troubleshooting

### Common Issues

**Command not found**
```bash
# Make sure npx is available
npx --version

# Or install globally
npm install -g @mizunashi_mana/manage-bg-mcp
manage-bg-mcp
```

**Permission errors**
```bash
# Run with explicit npm registry
npx --registry https://registry.npmjs.org @mizunashi_mana/manage-bg-mcp
```

**Process limits**
The server enforces default limits:
- Maximum 20 concurrent processes
- 200 log lines per process
- 5 second termination timeout

### Debugging

Enable debug logging:
```bash
NODE_ENV=development npx @mizunashi_mana/manage-bg-mcp
```

## Contributing

Pull requests and issue reports are welcome. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

This project is licensed under Apache-2.0 OR MPL-2.0 dual license. You may choose either license that best suits your needs.

## Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/username/manage-bg-mcp/issues)
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/username/manage-bg-mcp/discussions)
- **MCP Documentation**: [Model Context Protocol specification](https://github.com/anthropics/mcp)

## Related Projects

- [Model Context Protocol](https://github.com/anthropics/mcp) - Official MCP specification
- [@modelcontextprotocol/sdk](https://github.com/anthropics/mcp-sdk) - TypeScript/JavaScript MCP SDK
- [Claude Desktop](https://claude.ai/download) - AI assistant with MCP support
