# MCP Validation Testing

## Overview

MCP (Model Context Protocol) validation testing ensures reliable communication between the Unjucks CLI and MCP servers for template generation, workflow coordination, and system integration.

## MCP Testing Strategy

### Test Categories

#### 1. Connection Validation
- Server availability and handshake
- Authentication and authorization
- Protocol version compatibility
- Connection stability and reconnection

#### 2. Tool Invocation Testing
- Parameter validation and serialization
- Response handling and deserialization
- Error propagation and handling
- Timeout and retry mechanisms

#### 3. Resource Management
- Template resource discovery
- File system resource access
- Memory and state management
- Cleanup and garbage collection

#### 4. Integration Workflows
- End-to-end template generation
- Multi-step workflow coordination
- Agent coordination patterns
- Performance under load

## Test Implementation

### Connection Tests

```typescript
// tests/integration/mcp/connection.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MCPClient } from '../../../src/lib/mcp-client'

describe('MCP Connection Validation', () => {
  let client: MCPClient
  
  beforeAll(async () => {
    client = new MCPClient({
      serverCommand: 'npx',
      serverArgs: ['claude-flow@alpha', 'mcp', 'start'],
      timeout: 30000
    })
  })

  afterAll(async () => {
    await client.disconnect()
  })

  it('should establish MCP connection', async () => {
    const connected = await client.connect()
    expect(connected).toBe(true)
    expect(client.isConnected()).toBe(true)
  })

  it('should validate server capabilities', async () => {
    const capabilities = await client.getCapabilities()
    expect(capabilities).toHaveProperty('tools')
    expect(capabilities).toHaveProperty('resources')
    expect(capabilities.tools).toBeInstanceOf(Array)
  })

  it('should handle connection failures gracefully', async () => {
    const badClient = new MCPClient({
      serverCommand: 'nonexistent-command',
      timeout: 1000
    })
    
    await expect(badClient.connect()).rejects.toThrow()
  })

  it('should reconnect after connection loss', async () => {
    // Simulate connection loss
    await client.disconnect()
    expect(client.isConnected()).toBe(false)
    
    // Reconnect should work
    const reconnected = await client.connect()
    expect(reconnected).toBe(true)
  }, 10000)
})
```

### Tool Invocation Tests

```typescript
// tests/integration/mcp/tools.test.ts
describe('MCP Tool Invocation', () => {
  let client: MCPClient

  beforeEach(async () => {
    client = new MCPClient()
    await client.connect()
  })

  it('should list available templates', async () => {
    const result = await client.invokeTool('list_templates', {})
    
    expect(result).toHaveProperty('success', true)
    expect(result.data).toBeInstanceOf(Array)
    expect(result.data.length).toBeGreaterThan(0)
  })

  it('should generate template with valid parameters', async () => {
    const params = {
      template: 'command',
      generator: 'citty',
      variables: {
        commandName: 'TestCommand',
        withSubcommands: true
      },
      dryRun: true
    }

    const result = await client.invokeTool('generate_template', params)
    
    expect(result.success).toBe(true)
    expect(result.data).toHaveProperty('files')
    expect(result.data.files).toBeInstanceOf(Array)
  })

  it('should validate required parameters', async () => {
    const invalidParams = {
      template: 'command'
      // Missing generator and variables
    }

    await expect(
      client.invokeTool('generate_template', invalidParams)
    ).rejects.toThrow(/required parameter/i)
  })

  it('should handle tool timeouts', async () => {
    const slowParams = {
      template: 'large-dataset',
      timeout: 100 // Very short timeout
    }

    await expect(
      client.invokeTool('process_large_template', slowParams)
    ).rejects.toThrow(/timeout/i)
  }, 15000)
})
```

### Resource Management Tests

```typescript
// tests/integration/mcp/resources.test.ts
describe('MCP Resource Management', () => {
  it('should discover template resources', async () => {
    const resources = await client.listResources()
    
    const templateResources = resources.filter(r => 
      r.uri.startsWith('template://')
    )
    
    expect(templateResources.length).toBeGreaterThan(0)
    
    templateResources.forEach(resource => {
      expect(resource).toHaveProperty('uri')
      expect(resource).toHaveProperty('name')
      expect(resource).toHaveProperty('mimeType')
    })
  })

  it('should read template content', async () => {
    const resources = await client.listResources()
    const templateResource = resources.find(r => 
      r.uri.includes('command/citty')
    )
    
    expect(templateResource).toBeDefined()
    
    const content = await client.readResource(templateResource.uri)
    expect(content).toHaveProperty('contents')
    expect(typeof content.contents).toBe('string')
    expect(content.contents.length).toBeGreaterThan(0)
  })

  it('should handle missing resources gracefully', async () => {
    const fakeUri = 'template://nonexistent/generator'
    
    await expect(
      client.readResource(fakeUri)
    ).rejects.toThrow(/not found/i)
  })
})
```

## Live Server Testing

### Configuration

```typescript
// tests/config/mcp-test-config.ts
export const mcpTestConfig = {
  // Test against live MCP servers when available
  liveServers: [
    {
      name: 'claude-flow',
      command: 'npx',
      args: ['claude-flow@alpha', 'mcp', 'start'],
      timeout: 30000,
      required: false // Don't fail if unavailable
    },
    {
      name: 'flow-nexus',
      command: 'npx', 
      args: ['flow-nexus', 'mcp', 'start'],
      timeout: 30000,
      required: false
    }
  ],
  
  // Mock server for isolated testing
  mockServer: {
    enabled: true,
    responses: {
      'list_templates': mockTemplateList,
      'generate_template': mockGenerateResponse
    }
  },
  
  // Test data
  fixtures: {
    templates: './tests/fixtures/templates',
    expected: './tests/fixtures/expected',
    configs: './tests/fixtures/config'
  }
}
```

### Server Health Checks

```typescript
// tests/integration/mcp/health.test.ts
describe('MCP Server Health', () => {
  it('should validate server health endpoints', async () => {
    for (const server of mcpTestConfig.liveServers) {
      try {
        const client = new MCPClient(server)
        await client.connect()
        
        // Basic health check
        const capabilities = await client.getCapabilities()
        expect(capabilities).toBeDefined()
        
        // Tool availability
        const tools = await client.listTools()
        expect(tools.length).toBeGreaterThan(0)
        
        await client.disconnect()
      } catch (error) {
        if (server.required) {
          throw error
        } else {
          console.warn(`Optional server ${server.name} unavailable:`, error.message)
        }
      }
    }
  })

  it('should measure response times', async () => {
    const client = new MCPClient()
    await client.connect()
    
    const start = performance.now()
    await client.invokeTool('list_templates', {})
    const duration = performance.now() - start
    
    expect(duration).toBeLessThan(5000) // 5 second max
    console.log(`MCP response time: ${duration.toFixed(2)}ms`)
  })
})
```

## Mock Server Testing

### Mock Implementation

```typescript
// tests/mocks/mcp-mock-server.ts
export class MCPMockServer {
  private responses = new Map<string, any>()
  private delays = new Map<string, number>()
  
  constructor(config: MockServerConfig) {
    this.setupResponses(config.responses)
    this.setupDelays(config.delays || {})
  }

  async invokeTool(name: string, params: any) {
    // Simulate network delay
    const delay = this.delays.get(name) || 0
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    // Return mocked response
    const response = this.responses.get(name)
    if (!response) {
      throw new Error(`Unknown tool: ${name}`)
    }
    
    return typeof response === 'function' 
      ? response(params)
      : response
  }

  setupErrorScenario(toolName: string, error: Error) {
    this.responses.set(toolName, () => { throw error })
  }

  setupTimeoutScenario(toolName: string, timeoutMs: number) {
    this.delays.set(toolName, timeoutMs + 1000) // Longer than timeout
  }
}
```

### Mock-based Tests

```typescript
// tests/unit/mcp/mock-validation.test.ts
describe('MCP Mock Validation', () => {
  let mockServer: MCPMockServer
  let client: MCPClient

  beforeEach(() => {
    mockServer = new MCPMockServer({
      responses: {
        'list_templates': [
          { name: 'command', generator: 'citty' },
          { name: 'api', generator: 'fastify' }
        ],
        'generate_template': (params) => ({
          success: true,
          files: [`${params.template}-${params.generator}.ts`]
        })
      }
    })
    
    client = new MCPClient({ mockServer })
  })

  it('should work with mocked responses', async () => {
    const templates = await client.invokeTool('list_templates', {})
    expect(templates).toHaveLength(2)
    
    const result = await client.invokeTool('generate_template', {
      template: 'command',
      generator: 'citty'
    })
    
    expect(result.success).toBe(true)
    expect(result.files).toContain('command-citty.ts')
  })

  it('should simulate error conditions', async () => {
    mockServer.setupErrorScenario('list_templates', 
      new Error('Server temporarily unavailable'))
    
    await expect(
      client.invokeTool('list_templates', {})
    ).rejects.toThrow('Server temporarily unavailable')
  })
})
```

## Performance Testing

### Load Testing

```typescript
// tests/performance/mcp/load.test.ts
describe('MCP Load Testing', () => {
  it('should handle concurrent requests', async () => {
    const client = new MCPClient()
    await client.connect()
    
    const concurrentRequests = 10
    const promises = Array(concurrentRequests).fill(null).map(() =>
      client.invokeTool('list_templates', {})
    )
    
    const results = await Promise.all(promises)
    
    expect(results).toHaveLength(concurrentRequests)
    results.forEach(result => {
      expect(result).toBeDefined()
    })
  })

  it('should maintain performance under sustained load', async () => {
    const client = new MCPClient()
    await client.connect()
    
    const iterations = 100
    const startTime = performance.now()
    
    for (let i = 0; i < iterations; i++) {
      await client.invokeTool('list_templates', {})
    }
    
    const duration = performance.now() - startTime
    const avgRequestTime = duration / iterations
    
    expect(avgRequestTime).toBeLessThan(100) // <100ms per request
  }, 30000)
})
```

## Error Handling Validation

```typescript
// tests/integration/mcp/error-handling.test.ts
describe('MCP Error Handling', () => {
  it('should handle network errors', async () => {
    const client = new MCPClient({
      serverCommand: 'nc', // netcat - will fail
      serverArgs: ['localhost', '99999'],
      timeout: 1000
    })
    
    await expect(client.connect()).rejects.toThrow()
  })

  it('should handle malformed responses', async () => {
    const mockServer = new MCPMockServer({
      responses: {
        'bad_response': 'invalid-json-{'
      }
    })
    
    const client = new MCPClient({ mockServer })
    
    await expect(
      client.invokeTool('bad_response', {})
    ).rejects.toThrow(/parse/i)
  })

  it('should retry on temporary failures', async () => {
    let attemptCount = 0
    const mockServer = new MCPMockServer({
      responses: {
        'flaky_tool': () => {
          attemptCount++
          if (attemptCount < 3) {
            throw new Error('Temporary failure')
          }
          return { success: true, attempt: attemptCount }
        }
      }
    })
    
    const client = new MCPClient({ 
      mockServer,
      retryAttempts: 3
    })
    
    const result = await client.invokeTool('flaky_tool', {})
    expect(result.success).toBe(true)
    expect(result.attempt).toBe(3)
  })
})
```

## Running MCP Tests

### Test Commands

```bash
# Run all MCP validation tests
npm run test:mcp

# Run only connection tests
npm run test:mcp:connection

# Run with live servers
npm run test:mcp:live

# Run with mocks only
npm run test:mcp:mock

# Performance testing
npm run test:mcp:performance
```

### CI/CD Integration

```yaml
# .github/workflows/mcp-validation.yml
name: MCP Validation

on: [push, pull_request]

jobs:
  mcp-tests:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18, 20]
        
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          
      - run: npm ci
      
      # Test with mocks (always pass)
      - run: npm run test:mcp:mock
      
      # Test with live servers (may fail)
      - run: npm run test:mcp:live || echo "Live server tests failed"
        continue-on-error: true
        
      # Performance benchmarks
      - run: npm run test:mcp:performance
```

### Configuration Files

```typescript
// vitest.config.mcp.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*mcp*.test.ts'],
    timeout: 30000,
    setupFiles: ['./tests/setup/mcp-setup.ts'],
    env: {
      MCP_TEST_MODE: 'integration'
    }
  }
})
```

## Best Practices

### Test Isolation
- Use fresh client instances for each test
- Clean up connections in afterEach/afterAll
- Avoid shared state between tests
- Mock external dependencies for unit tests

### Error Testing
- Test all error conditions explicitly
- Verify error messages and types
- Test timeout and retry scenarios
- Validate graceful degradation

### Performance Awareness
- Set reasonable timeouts for tests
- Monitor test execution times
- Use parallel execution where possible
- Profile slow tests and optimize

### Mock vs Live Testing
- Use mocks for unit and fast integration tests
- Use live servers for full end-to-end validation
- Make live server tests optional in CI
- Document server requirements clearly

This comprehensive MCP validation approach ensures reliable communication and robust error handling in the Unjucks CLI system.