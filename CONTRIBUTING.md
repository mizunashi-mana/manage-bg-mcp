# Contributing to Background Process Management MCP Server

Thank you for your interest in contributing to the Background Process Management MCP Server! This guide will help you get started with development and understand the project's architecture and conventions.

## Getting Started

### Prerequisites

- Node.js 20.0.0 or higher
- npm 9.0.0 or higher
- Git for version control
- TypeScript knowledge
- Familiarity with Model Context Protocol (MCP)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd manage-bg-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

## Development Workflow

### Available Scripts

```bash
# Development
npm run dev          # Build in watch mode
npm run build        # Production build
npm run clean        # Clean build artifacts

# Testing
npm test             # Run unit tests
npm run test:all     # Run all test suites
npm run test:integration  # Integration tests
npm run test:performance  # Performance tests

# Code Quality
npm run lint         # ESLint with auto-fix
npm run typecheck    # TypeScript type checking
```

### Project Architecture

#### Core Concepts

1. **Dependency Injection**: Uses Inversify for clean service management
2. **Unified Logging**: Time-series log entries combining stdout/stderr
3. **Type Safety**: Full TypeScript with Zod schema validation
4. **MCP Compliance**: Implements Model Context Protocol specification
5. **Service-Oriented**: Clear separation of concerns between services

#### Directory Structure

```
src/
├── index.ts                  # Entry point
├── container/
│   └── DIContainer.ts        # Inversify DI container setup
├── services/
│   ├── BgProcessManager.ts   # Process lifecycle management
│   ├── ProcessController.ts  # Low-level process control
│   ├── ProcessLogBuffer.ts   # Unified log management
│   ├── ManageBgServer.ts     # MCP server implementation
│   ├── ConfigProvider.ts     # Configuration management
│   ├── Logging.ts           # Logging service
│   └── tools/               # MCP tool handlers
├── models/
│   ├── ManagedProcess.ts    # Process data models
│   ├── LogData.ts           # Log data structures
│   └── errors.ts            # Error definitions
└── test/                    # Test files mirror src structure
```

#### Key Services

1. **BgProcessManager**: High-level process management, orchestrates other services
2. **ProcessController**: Low-level process spawning and termination
3. **ProcessLogBuffer**: Unified time-series log storage and retrieval
4. **ManageBgServer**: MCP protocol implementation and tool registration
5. **ConfigProvider**: Centralized configuration with environment awareness
6. **Logging**: Environment-aware logging service

#### Tool Architecture

Each MCP tool is implemented as a separate handler class in `src/services/tools/`:

- `StartHandler`: Process creation
- `StopHandler`: Process termination
- `RestartHandler`: Process restart logic
- `ListHandler`: Process enumeration
- `GetInfoHandler`: Process information retrieval
- `GetLogsHandler`: Log retrieval with filtering
- `StopAllHandler`: Bulk process termination

## Development Guidelines

### Code Style

- **TypeScript**: Use strict mode with full type annotations
- **ESLint**: Follow project ESLint configuration
- **Formatting**: Use function properties instead of method shorthand in interfaces
- **Comments**: Only add comments that provide valuable context, avoid obvious statements

### Dependency Injection Patterns

```typescript
// Service definition
@injectable()
export class MyService {
  constructor(
    @inject(DependencyTag) private readonly dependency: Dependency,
  ) {}
}

// Registration in DIContainer
container.bind<MyService>(MyServiceTag).to(MyService).inSingletonScope();
```

### Error Handling

- Use the structured `ProcessManagementError` class
- Provide user-friendly error messages and recovery suggestions
- Include relevant context in error details

```typescript
throw new ProcessManagementError(
  ProcessManagementErrorType.PROCESS_NOT_FOUND,
  `Process with ID ${processId} not found`,
  { processId, availableProcesses: this.getProcessIds() }
);
```

### Log Management

- Logs are stored as unified time-series arrays
- Each entry includes type ('stdout' | 'stderr'), content, and timestamp
- Chronological ordering is preserved across streams

```typescript
interface LogEntry {
  type: 'stdout' | 'stderr';
  line: string;
  timestamp: Date;
}
```

### Configuration Management

- Use ConfigProvider for all configuration needs
- Support environment-specific settings
- Default to safe values with explicit overrides

```typescript
// Getting configuration
const isLoggingEnabled = configProvider.isLoggingEnabled();
const maxProcesses = configProvider.getMaxConcurrentProcesses();
```

## Testing

### Test Structure

Tests are organized to mirror the source structure:

```
test/
├── services/           # Service unit tests
├── tools/             # Tool handler tests  
├── integration/       # Integration tests
├── performance/       # Performance tests
└── mocks/            # Mock implementations
```

### Test Patterns

1. **Unit Tests**: Test individual services in isolation
2. **Integration Tests**: Test service interactions
3. **Mock Usage**: Use MockProcessController for predictable testing
4. **Environment**: Tests run with NODE_ENV=test (logging disabled)

### Writing Tests

```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: MockDependency;

  beforeEach(() => {
    mockDependency = new MockDependency();
    const configProvider = new ConfigProviderImpl({
      // test configuration
    });
    service = new ServiceName(mockDependency, configProvider);
  });

  it('should handle specific case', async () => {
    // Arrange
    const input = { /* test data */ };
    
    // Act
    const result = await service.method(input);
    
    // Assert
    expect(result).toMatchObject({
      success: true,
      // expected properties
    });
  });
});
```

## Contributing Process

### Before You Start

1. **Check existing issues**: Look for related issues or discussions
2. **Discuss major changes**: Open an issue for significant modifications
3. **Fork the repository**: Create your own fork for development

### Making Changes

1. **Create a branch**: Use descriptive branch names
   ```bash
   git checkout -b feature/add-process-metrics
   git checkout -b fix/log-buffer-memory-leak
   ```

2. **Make atomic commits**: Each commit should represent one logical change
   ```bash
   git commit -m "Add process memory usage tracking"
   ```

3. **Follow commit conventions**: Use clear, descriptive commit messages

### Code Quality Requirements

Before submitting a PR, ensure:

```bash
# All tests pass
npm test

# Code builds without errors
npm run build

# Linting passes
npm run lint

# Type checking passes  
npm run typecheck
```

### Pull Request Process

1. **Update documentation**: Include relevant documentation updates
2. **Add tests**: Ensure new functionality is properly tested
3. **Update CHANGELOG**: Document user-facing changes
4. **Write clear PR description**: Explain what, why, and how

### PR Template

```markdown
## What
Brief description of changes

## Why
Motivation and context

## How
Implementation approach

## Testing
How the changes were tested

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Build passes
- [ ] Linting passes
```

## Common Development Tasks

### Adding a New MCP Tool

1. Create handler class in `src/services/tools/`
2. Implement the tool interface
3. Add Zod schema for input validation
4. Register in `ManageBgServer`
5. Add to DI container
6. Write comprehensive tests

### Adding a New Service

1. Define interface and implementation
2. Add to DI container with proper ordering
3. Update dependent services
4. Add comprehensive unit tests
5. Update integration tests if needed

### Modifying Log Structure

1. Update `LogData.ts` models
2. Modify `ProcessLogBuffer` implementation
3. Update all consumers of log data
4. Update tests to match new structure
5. Consider backward compatibility

## Architecture Decisions

### Why Dependency Injection?

- **Testability**: Easy mocking and testing
- **Modularity**: Clear service boundaries
- **Flexibility**: Easy to swap implementations
- **Maintainability**: Explicit dependencies

### Why Unified Log Storage?

- **Chronological Accuracy**: Events in true time order
- **Simplified Management**: Single buffer per process
- **Flexible Retrieval**: Can filter by type when needed
- **Memory Efficiency**: Single threshold for all log types

### Why Separate Tool Handlers?

- **Single Responsibility**: Each handler focuses on one tool
- **Testability**: Independent testing of tool logic
- **Maintainability**: Clear separation of concerns
- **Extensibility**: Easy to add new tools

## Performance Considerations

### Log Buffer Management

- Automatic trimming prevents memory leaks
- Configurable limits for different environments
- Efficient time-series data structures

### Process Management

- Lazy process creation
- Proper cleanup on termination
- Resource limit enforcement

### Testing Performance

- Mock implementations for predictable tests
- Isolated test environments
- Performance regression testing

## Security Considerations

- Input validation using Zod schemas
- Process isolation and sandboxing
- Resource limit enforcement
- Secure error handling (no information leakage)

## Getting Help

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Code Review**: Learn from PR feedback
- **Documentation**: Study existing code patterns

## Recognition

Contributors will be recognized in:
- CHANGELOG.md for their contributions
- GitHub contributor statistics
- Release notes for significant contributions

Thank you for contributing to make this project better!