# MCP Integration Test Suite

This directory contains comprehensive test scenarios that directly trigger MCP (Model Context Protocol) tools from vitest tests. These tests validate real MCP protocol communication, performance, and integration with the Unjucks project.

## Test Structure

### Core Test Suites

1. **mcp-server-lifecycle.test.ts**
   - MCP server spawning and shutdown
   - Process management and cleanup
   - Health checks and availability

2. **semantic-mcp-validation.test.ts** 
   - RDF/Turtle data processing via MCP
   - SPARQL query execution
   - Semantic reasoning and validation
   - Template generation from ontologies

3. **swarm-coordination.test.ts**
   - Multi-agent swarm initialization
   - Topology validation (mesh, hierarchical, ring, star)
   - Agent spawning and management
   - Task orchestration across swarms

4. **workflow-orchestration.test.ts**
   - Complex workflow creation and execution
   - Step dependency management
   - Agent assignment and coordination
   - Audit trail and metrics collection

5. **performance-benchmarks.test.ts**
   - Operation timing and throughput measurement
   - Memory usage tracking
   - Scalability testing
   - SLA compliance validation

6. **protocol-communication.test.ts**
   - JSON-RPC 2.0 compliance testing
   - Transport layer validation (stdio/socket)
   - Message correlation and batching
   - Error handling and recovery

7. **error-handling-resilience.test.ts**
   - Fault injection and recovery
   - Circuit breaker patterns
   - Resource exhaustion handling
   - System stability under load

8. **unjucks-mcp-integration.test.ts**
   - Unjucks-specific MCP tool testing
   - Template generation via MCP
   - File injection and conflict resolution
   - Variable substitution and validation

## Key Features

### Real MCP Protocol Communication
- Direct JSON-RPC 2.0 message exchange
- Proper request/response correlation  
- Transport layer abstraction (stdio/socket)
- Protocol compliance validation

### Performance Testing
- Benchmarking of MCP operations
- Throughput and latency measurement
- Memory usage profiling
- Concurrent request handling

### Fault Tolerance
- Network delay simulation
- Connection drop recovery
- Resource pressure testing
- Cascading failure scenarios

### Integration Validation
- End-to-end workflow execution
- Cross-tool interaction testing
- State management verification
- Data consistency checks

## Running the Tests

### Individual Test Suites
```bash
# Run MCP server lifecycle tests
npm run test tests/mcp-integration/mcp-server-lifecycle.test.ts

# Run semantic validation tests  
npm run test tests/mcp-integration/semantic-mcp-validation.test.ts

# Run performance benchmarks
npm run test tests/mcp-integration/performance-benchmarks.test.ts
```

### All MCP Integration Tests
```bash
npm run test tests/mcp-integration/
```

### With Extended Timeout (for performance tests)
```bash
npm run test tests/mcp-integration/ -- --testTimeout=300000
```

## Test Configuration

### Environment Variables
- `NODE_ENV=test` - Test environment
- `ENABLE_MCP_TOOLS=true` - Enable MCP tools
- `ENABLE_SEMANTIC=true` - Enable semantic features
- `LOG_LEVEL=error` - Reduce logging noise

### Prerequisites
- claude-flow@alpha package installed
- Node.js 18+ for proper MCP support
- Sufficient system resources for performance tests

### Test Data
Test fixtures and templates are created dynamically in `/tests/temp/` during test execution and cleaned up automatically.

## Performance Expectations

### Response Time SLAs
- Status queries: < 1 second
- Agent spawning: < 3 seconds  
- Simple generation: < 2 seconds
- Complex workflows: < 30 seconds

### Success Rate SLAs
- Basic operations: > 99%
- Complex operations: > 95% 
- Under load: > 80%

### Resource Limits
- Memory increase: < 500MB during intensive operations
- CPU spike tolerance: Operations continue during 90%+ CPU
- Recovery time: < 15 seconds from faults

## Architecture

### Transport Abstraction
```typescript
interface McpTransport {
  send(message: McpRequest): Promise<McpResponse>
  close(): Promise<void>
  isConnected(): boolean
}
```

### Test Utilities
- `StdioMcpTransport` - stdio-based communication
- `SocketMcpTransport` - TCP socket communication  
- `McpPerformanceBenchmarker` - performance testing
- `McpResilienceTest` - fault injection and recovery

### Error Scenarios
- Invalid tool names
- Malformed parameters
- Resource exhaustion
- Network failures
- Concurrent access conflicts

## Contributing

### Adding New Tests
1. Create test file in `/tests/mcp-integration/`
2. Follow existing patterns for MCP communication
3. Include proper cleanup in `afterAll` hooks
4. Add performance assertions where relevant
5. Document expected behavior and edge cases

### Test Standards
- Use real MCP protocol communication (no mocks)
- Include both positive and negative test cases
- Validate performance and resource usage
- Implement proper error handling
- Clean up resources after test completion

## Dependencies

### Required Packages
- `vitest` - Test framework
- `claude-flow@alpha` - MCP server implementation
- Node.js built-in modules for process management

### Optional Features
- Socket transport requires network configuration
- Semantic tests require RDF/Turtle test data
- Performance tests benefit from dedicated test environment

## Troubleshooting

### Common Issues
1. **MCP Server Timeout** - Increase initialization timeout
2. **Resource Exhaustion** - Run tests sequentially 
3. **Port Conflicts** - Use different ports for socket tests
4. **Permission Errors** - Ensure write access to temp directories

### Debug Information
Tests include verbose logging and metrics collection for troubleshooting performance and connectivity issues.