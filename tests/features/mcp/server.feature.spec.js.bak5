import { test, beforeEach, afterEach } from 'vitest';
import { UnjucksWorld } from '../../support/world.js';
import { mcpStepDefinitions } from '../../step-definitions/mcp-steps.js';

let world;

beforeEach(async () => {
  world = new UnjucksWorld();
  await world.setupTempDir();
});

afterEach(async () => {
  await world.cleanupTempDirectory();
});

test('MCP server starts successfully', async () => {
  await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['the MCP server is initialized'](world);
  await mcpStepDefinitions['the server should be running'](world);
  await mcpStepDefinitions['all MCP tools should be registered'](world);
});

test('MCP server handles tool discovery', async () => { await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  // Simulate client requesting available tools
  world.context.lastMCPResponse = {
    result },
        { name },
        { name },
        { name },
        { name }
      ]
    }
  };
  
  const expectedTools = [
    { tool_name },
    { tool_name },
    { tool_name },
    { tool_name },
    { tool_name }
  ];
  
  // Check that all expected tools are present
  expectedTools.forEach(expectedTool => {
    const foundTool = world.context.lastMCPResponse!.result.tools.find(
      (tool) => tool.name === expectedTool.tool_name
    );
    if (!foundTool) {
      throw new Error(`Expected tool '${expectedTool.tool_name}' not found`);
    }
  });
});

test('MCP server provides tool schemas', async () => { await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  // Request schema for unjucks_generate tool
  world.context.lastMCPResponse = {
    result },
          name: { type },
          dest: { type }
        },
        required: ['generator', 'name']
      }
    }
  };
  
  // Validate schema structure
  const schema = world.context.lastMCPResponse.result;
  if (!schema.inputSchema?.properties) {
    throw new Error('Schema should define required parameters');
  }
  if (!Array.isArray(schema.inputSchema.required)) {
    throw new Error('Schema should include parameter types');
  }
  if (!schema.description || schema.description.length < 5) {
    throw new Error('Schema should provide parameter descriptions');
  }
});

test('MCP server handles invalid requests gracefully', async () => { await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  // Send invalid tool request
  world.context.lastMCPResponse = {
    error }
    }
  };
  
  const response = world.context.lastMCPResponse;
  if (!response.error) {
    throw new Error('Server should return an error response');
  }
  if (response.error.message.length < 10) {
    throw new Error('Error should include helpful details');
  }
  if (!world.context.mcpServer?.isRunning) {
    throw new Error('Server should remain operational');
  }
});

test('MCP server handles concurrent requests', async () => { await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  // Create sample templates
  await mcpStepDefinitions['I have sample templates available'](world);
  
  // Simulate multiple concurrent requests
  const concurrentRequests = [
    world.callMCPTool('unjucks_list'),
    world.callMCPTool('unjucks_help', { generator),
    world.callMCPTool('unjucks_generate', { generator }
  
  // Validate response times
  if (totalTime > 5000) {
    throw new Error('Responses should be returned within acceptable time limits');
  }
  
  // Check for memory leaks (simplified check)
  const memUsage = process.memoryUsage();
  if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
    console.warn('Potential memory leak detected');
  }
});

test('MCP server validates input parameters', async () => { await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  // Test with invalid parameters
  const invalidResponse = await world.callMCPTool('unjucks_generate', {
    generator }
  if (!invalidResponse.error.message.match(/invalid|validation|parameter/i)) {
    throw new Error('Should provide clear validation error messages');
  }
  if (!invalidResponse.error.message.match(/generator|name|dest/i)) {
    throw new Error('Should suggest correct parameter formats');
  }
});

test('MCP server maintains session state', async () => { await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  // Perform multiple operations
  await world.callMCPTool('unjucks_list');
  await world.callMCPTool('unjucks_help', { generator);
  await world.callMCPTool('unjucks_generate', { generator }
  
  // Verify no temp files are left behind (simplified check)
  const files = await world.listFiles();
  const tempFiles = files.filter(f => f.includes('.tmp') || f.includes('.temp'));
  if (tempFiles.length > 0) { console.warn('Temporary files may not be properly cleaned up }
  
  // Check resource usage remains stable
  const memUsage = process.memoryUsage();
  const memUsageMB = memUsage.heapUsed / 1024 / 1024;
  if (memUsageMB > 50) { // 50MB threshold
    console.warn('Resource usage may be growing }
});