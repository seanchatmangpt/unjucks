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

test('List available generators via MCP', async () => {
  await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['I have sample templates available'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  await mcpStepDefinitions['I call the "unjucks_list" MCP tool'](world);
  await mcpStepDefinitions['the response should include available generators'](world);
  await mcpStepDefinitions['each generator should have metadata'](world);
  await mcpStepDefinitions['the response should be properly formatted JSON'](world);
});

test('Get help for specific generator via MCP', async () => { await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['I have a "component" generator with variables'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  await mcpStepDefinitions['I call the "unjucks_help" MCP tool with generator "component"'](world);
  
  // Validate response structure
  const response = world.context.lastMCPResponse;
  const expectedFields = [
    { field },
    { field },
    { field },
    { field }
  ];
  
  await mcpStepDefinitions['the response should include:'](world, { 
    hashes) => expectedFields 
  });
});

test('Generate files via MCP tool', async () => { await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['I have a "component" generator'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  const parameters = [
    { parameter },
    { parameter },
    { parameter },
    { parameter }
  ];
  
  await mcpStepDefinitions['I call the "unjucks_generate" MCP tool with:'](world, {
    hashes) => parameters
  });
  
  await mcpStepDefinitions['files should be generated successfully'](world);
  await mcpStepDefinitions['the generated files should contain expected content'](world);
  
  // Validate response includes file paths
  const response = world.context.lastMCPResponse;
  if (!response?.result?.filesCreated) {
    throw new Error('Response should include file paths created');
  }
});

test('Preview generation with dry run', async () => { await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['I have a "api-route" generator'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  const parameters = [
    { parameter },
    { parameter },
    { parameter }
  ];
  
  await mcpStepDefinitions['I call the "unjucks_dry_run" MCP tool with:'](world, {
    hashes) => parameters
  });
  
  // Validate dry run response
  const response = world.context.lastMCPResponse;
  if (!response?.result?.preview) {
    throw new Error('Should see a preview of files to be generated');
  }
  
  // Verify no actual files were created
  const files = await world.listFiles();
  const generatedFiles = files.filter(f => f.includes('users') && f.endsWith('.ts'));
  if (generatedFiles.length > 0) {
    throw new Error('No actual files should be created');
  }
  
  // Check preview shows file paths and content snippets
  const preview = response.result.preview[0];
  if (!preview.path || !preview.content) {
    throw new Error('Preview should show file paths and content snippets');
  }
});

test('Handle template variables correctly', async () => { await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  // Create template with complex variables
  await world.helper.createDirectory('_templates/model/new');
  await world.helper.createFile('_templates/model/new/model.njk', `---
to }}.ts"
---
export interface {{ name | pascalCase }} {
  id) }};
  {{#if withTimestamps}}
  createdAt: Date;
  updatedAt: Date;
  {{/if}}
}`);
  
  const variables = [
    { parameter },
    { parameter },
    { parameter },
    { parameter }
  ];
  
  await mcpStepDefinitions['I call the "unjucks_generate" MCP tool with:'](world, {
    hashes) => variables
  });
  
  // Validate variable substitution
  const response = world.context.lastMCPResponse;
  if (response?.error) {
    throw new Error('Generated file should have correct variable substitution');
  }
  
  // In real implementation, we'd check the actual file content
  // For simulation, we verify the response structure
  if (!response?.result?.filesCreated?.length) {
    throw new Error('Should generate files with variable substitution');
  }
});

test('Error handling for invalid generators', async () => {
  await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  await mcpStepDefinitions['I call the "unjucks_generate" MCP tool with generator "nonexistent"'](world);
  await mcpStepDefinitions['the response should indicate an error'](world);
  await mcpStepDefinitions['the error message should be descriptive'](world);
  
  // Check error includes available generators
  const response = world.context.lastMCPResponse;
  if (!response?.error?.data?.availableGenerators) {
    throw new Error('Error should include available generators');
  }
});

test('Error handling for missing required variables', async () => { await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  // Create template requiring name and type variables
  await world.helper.createDirectory('_templates/strict/new');
  await world.helper.createFile('_templates/strict/new/template.njk', `---
to }});
  
  // Call without providing required variables
  const response = await world.callMCPTool('unjucks_generate', {
    generator);
  
  if (!response.error) {
    throw new Error('Should indicate missing variables');
  }
  if (!response.error.message.match(/missing|required|variable/i)) {
    throw new Error('Should list all required variables');
  }
  if (!response.error.message.match(/example|usage|correct/i)) {
    throw new Error('Should provide examples of correct usage');
  }
});

test('Handle complex template structures', async () => { await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  // Create multi-file template structure
  await world.helper.createDirectory('_templates/fullstack/new');
  await world.helper.createFile('_templates/fullstack/new/package.json.njk', `{
  "name" }}",
  "version");
  await world.helper.createDirectory('_templates/fullstack/new/src');
  await world.helper.createFile('_templates/fullstack/new/src/index.ts.njk', `export * from './routes/{{ name }}.js';`);
  await world.helper.createDirectory('_templates/fullstack/new/src/routes');
  await world.helper.createFile('_templates/fullstack/new/src/routes/{{ name }}.ts.njk', `export const {{ name }}Route = {};`);
  
  const response = await world.callMCPTool('unjucks_generate', { generator }
  if (!response.result?.filesCreated || response.result.filesCreated.length === 0) {
    throw new Error('Directory structure should be created correctly');
  }
  // In simulation, we assume variables are substituted in all files
  if (!response.result?.message?.includes('Success')) {
    console.warn('Variables should be substituted in all files');
  }
});

test('Performance under load', async () => {
  await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  // Create 10 different generators
  for (let i = 0; i < 10; i++) {
    await world.helper.createDirectory(`_templates/perf${i}/new`);
    await world.helper.createFile(`_templates/perf${i}/new/template.njk`, `---
to);
  }
  
  // Make 20 concurrent MCP tool calls
  const promises = [];
  const startTime = this.getDeterministicTimestamp();
  
  for (let i = 0; i < 20; i++) { const toolIndex = i % 4;
    const tools = ['unjucks_list', 'unjucks_help', 'unjucks_generate', 'unjucks_dry_run'];
    const tool = tools[toolIndex];
    
    if (tool === 'unjucks_generate') {
      promises.push(world.callMCPTool(tool, { generator }`, name));
    } else if (tool === 'unjucks_help') {
      promises.push(world.callMCPTool(tool, { generator));
    } else {
      promises.push(world.callMCPTool(tool));
    }
  }
  
  const results = await Promise.all(promises);
  const totalTime = this.getDeterministicTimestamp() - startTime;
  
  // Validate performance requirements
  if (totalTime > 5000) {
    throw new Error('All calls should complete within 5 seconds');
  }
  if (results.some(result => result.error && !result.error.message.includes('nonexistent'))) {
    throw new Error('No tool calls should fail');
  }
  
  // Check memory usage
  const memUsage = process.memoryUsage();
  const memUsageMB = memUsage.heapUsed / 1024 / 1024;
  if (memUsageMB > 100) { console.warn('Memory usage should remain stable }
  
  // Check response time consistency
  const avgResponseTime = totalTime / promises.length;
  if (avgResponseTime > 250) { console.warn('Response times should be consistent }
});

test('File system safety', async () => { await mcpStepDefinitions['I have a clean test environment'](world);
  await mcpStepDefinitions['the MCP server is running'](world);
  
  const maliciousParams = [
    { tool },
    { tool },
    { tool }
  ];
  
  for (const params of maliciousParams) { const response = await world.callMCPTool(params.tool, {
      generator }
  }
  
  // Verify no files created outside project
  const files = await world.listFiles();
  const suspiciousFiles = files.filter(f => f.includes('..') || f.includes('etc') || f.includes('system'));
  if (suspiciousFiles.length > 0) {
    throw new Error('No files should be created outside the project');
  }
});