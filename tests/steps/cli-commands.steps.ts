import { Given, When, Then, Before, After } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { MockMCPClient } from '../mocks/mcp-client.mock';
import { TestFileManager } from '../utils/test-file-manager';
import { SemanticTestUtils } from '../utils/semantic-test-utils';

// Test state management
interface TestContext {
  lastCommand?: string;
  lastOutput?: string;
  lastError?: string;
  exitCode?: number;
  mcpClient: MockMCPClient;
  fileManager: TestFileManager;
  semanticUtils: SemanticTestUtils;
  createdFiles: string[];
  swarmConfig?: any;
}

let context: TestContext;

Before(async function() {
  context = {
    mcpClient: new MockMCPClient(),
    fileManager: new TestFileManager(),
    semanticUtils: new SemanticTestUtils(),
    createdFiles: []
  };
  
  // Initialize MCP client mocks
  await context.mcpClient.initialize();
  
  // Setup test directories
  context.fileManager.setupTestDirectories();
});

After(async function() {
  // Cleanup created files
  context.createdFiles.forEach(file => {
    if (existsSync(file)) {
      unlinkSync(file);
    }
  });
  
  // Cleanup test directories
  context.fileManager.cleanup();
  
  // Reset MCP mocks
  context.mcpClient.reset();
});

Given('I have the unjucks CLI installed', function() {
  // Verify CLI is available
  try {
    execSync('node dist/cli.js --version', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('unjucks CLI is not available. Run npm run build first.');
  }
});

Given('MCP tools are available', function() {
  // Setup MCP tool availability
  context.mcpClient.setAvailable(true);
});

Given('I have an RDF file {string} with valid content', function(filename: string) {
  const validRDF = `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Person rdf:type rdfs:Class .
ex:name rdf:type rdf:Property .
ex:age rdf:type rdf:Property .

ex:john rdf:type ex:Person ;
        ex:name "John Doe" ;
        ex:age 30 .
  `.trim();
  
  const filePath = join(process.cwd(), filename);
  writeFileSync(filePath, validRDF);
  context.createdFiles.push(filePath);
});

Given('I have an RDF file {string} with syntax errors', function(filename: string) {
  const invalidRDF = `
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .

ex:Person rdf:type rdfs:Class # Missing dot
ex:name rdf:type rdf:Property ;; # Double semicolon error
ex:john ex:name "John Doe" # Missing rdf:type
  `.trim();
  
  const filePath = join(process.cwd(), filename);
  writeFileSync(filePath, invalidRDF);
  context.createdFiles.push(filePath);
});

Given('I have a semantic schema {string}', function(filename: string) {
  const schema = context.semanticUtils.generateUserSchema();
  const filePath = join(process.cwd(), filename);
  writeFileSync(filePath, schema);
  context.createdFiles.push(filePath);
});

Given('I have an active swarm with {int} agents', function(agentCount: number) {
  context.swarmConfig = {
    topology: 'mesh',
    agents: agentCount,
    status: 'active',
    id: 'test-swarm-001'
  };
  
  context.mcpClient.mockResponse('swarm_status', {
    success: true,
    data: context.swarmConfig
  });
});

Given('I have a template {string} with semantic annotations', function(templateName: string) {
  const semanticTemplate = `
---
to: src/models/{{ className | kebabCase }}.ts
semantic:
  rdf_type: "http://example.org/{{ className }}"
  properties:
    - name: "http://example.org/name"
    - email: "http://example.org/email"
inject: true
skipIf: "class {{ className }}"
---
/**
 * {{ className }} model with semantic RDF annotations
 * @rdf:type http://example.org/{{ className }}
 */
export class {{ className }} {
  /**
   * @rdf:property http://example.org/name
   */
  public name: string;
  
  /**
   * @rdf:property http://example.org/email
   */
  public email: string;
  
  constructor(name: string, email: string) {
    this.name = name;
    this.email = email;
  }
}
  `.trim();
  
  const templateDir = join(process.cwd(), 'templates');
  if (!existsSync(templateDir)) {
    mkdirSync(templateDir, { recursive: true });
  }
  
  const filePath = join(templateDir, templateName);
  writeFileSync(filePath, semanticTemplate);
  context.createdFiles.push(filePath);
});

Given('I have multiple templates in {string}', function(templateDir: string) {
  const templatesDir = join(process.cwd(), templateDir);
  mkdirSync(templatesDir, { recursive: true });
  
  const templates = [
    'component.njk',
    'service.njk',
    'model.njk'
  ];
  
  templates.forEach(template => {
    const content = `---
to: src/{{ template.replace('.njk', '') }}/{{ name | kebabCase }}.ts
---
// Generated {{ template }} for {{ name }}
export class {{ name | pascalCase }} {
  // Implementation here
}`;
    
    const filePath = join(templatesDir, template);
    writeFileSync(filePath, content);
    context.createdFiles.push(filePath);
  });
});

Given('I have an active swarm configuration', function() {
  context.swarmConfig = {
    id: 'test-swarm-001',
    topology: 'mesh',
    agents: [
      { id: 'agent-001', type: 'coder', status: 'active' },
      { id: 'agent-002', type: 'tester', status: 'active' },
      { id: 'agent-003', type: 'reviewer', status: 'active' }
    ],
    created: new Date().toISOString(),
    version: '1.0.0'
  };
});

Given('I have a swarm configuration file {string}', function(filename: string) {
  const config = {
    id: 'imported-swarm-001',
    topology: 'hierarchical',
    agents: [
      { id: 'agent-001', type: 'coordinator', status: 'pending' },
      { id: 'agent-002', type: 'coder', status: 'pending' }
    ]
  };
  
  const filePath = join(process.cwd(), filename);
  writeFileSync(filePath, JSON.stringify(config, null, 2));
  context.createdFiles.push(filePath);
});

When('I run {string}', function(command: string) {
  context.lastCommand = command;
  
  try {
    // Replace unjucks with the actual CLI path
    const actualCommand = command.replace('unjucks', 'node dist/cli.js');
    
    context.lastOutput = execSync(actualCommand, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    context.exitCode = 0;
  } catch (error: any) {
    context.lastError = error.message;
    context.lastOutput = error.stdout || '';
    context.exitCode = error.status || 1;
  }
});

Then('a swarm should be initialized with {int} agents', function(agentCount: number) {
  expect(context.exitCode).toBe(0);
  expect(context.lastOutput).toContain(`${agentCount} agents`);
  
  // Verify MCP call was made
  const mcpCall = context.mcpClient.getLastCall('swarm_init');
  expect(mcpCall).toBeDefined();
  expect(mcpCall.params.maxAgents).toBe(agentCount);
});

Then('the MCP tool {string} should be called', function(toolName: string) {
  const mcpCall = context.mcpClient.getLastCall(toolName);
  expect(mcpCall).toBeDefined();
  expect(mcpCall.called).toBe(true);
});

Then('the topology should be {string}', function(topology: string) {
  const mcpCall = context.mcpClient.getLastCall('swarm_init');
  expect(mcpCall.params.topology).toBe(topology);
});

Then('the response should contain swarm configuration', function() {
  expect(context.lastOutput).toContain('swarm');
  expect(context.lastOutput).toContain('configuration');
});

Then('the file should be validated against SHACL rules', function() {
  expect(context.exitCode).toBe(0);
  expect(context.lastOutput).toContain('validation');
});

Then('the validation should pass', function() {
  expect(context.exitCode).toBe(0);
  expect(context.lastOutput).toContain('valid') || expect(context.lastOutput).toContain('passed');
});

Then('the validation should fail', function() {
  expect(context.exitCode).toBe(1);
});

Then('error messages should be displayed', function() {
  expect(context.lastError || context.lastOutput).toContain('error');
});

Then('the response should contain validation results', function() {
  expect(context.lastOutput).toContain('validation') || expect(context.lastOutput).toContain('result');
});

Then('semantic templates should be generated', function() {
  expect(context.exitCode).toBe(0);
  expect(context.lastOutput).toContain('generated');
});

Then('RDF data should be processed correctly', function() {
  const mcpCall = context.mcpClient.getLastCall('template_generate');
  expect(mcpCall.params.schema).toBeDefined();
});

Then('I should see a list of available generators', function() {
  expect(context.exitCode).toBe(0);
  expect(context.lastOutput).toContain('available') || expect(context.lastOutput).toContain('generators');
});

Then('MCP-enhanced capabilities should be highlighted', function() {
  expect(context.lastOutput).toContain('enhanced') || expect(context.lastOutput).toContain('MCP');
});

Then('semantic generators should be included', function() {
  expect(context.lastOutput).toContain('semantic');
});

Then('{int} coder agents should be spawned', function(count: number) {
  expect(context.exitCode).toBe(0);
  expect(context.lastOutput).toContain(`${count}`);
  expect(context.lastOutput).toContain('coder');
});

Then('the MCP tool {string} should be called {int} times', function(toolName: string, count: number) {
  const calls = context.mcpClient.getCallCount(toolName);
  expect(calls).toBe(count);
});

Then('each agent should have unique identifiers', function() {
  const calls = context.mcpClient.getAllCalls('agent_spawn');
  const ids = calls.map(call => call.result?.id).filter(Boolean);
  const uniqueIds = new Set(ids);
  expect(uniqueIds.size).toBe(ids.length);
});

Then('the task should be distributed across agents', function() {
  expect(context.exitCode).toBe(0);
  expect(context.lastOutput).toContain('distributed') || expect(context.lastOutput).toContain('task');
});

Then('execution strategy should be {string}', function(strategy: string) {
  const mcpCall = context.mcpClient.getLastCall('task_orchestrate');
  expect(mcpCall.params.strategy).toBe(strategy);
});

Then('I should see detailed swarm information', function() {
  expect(context.exitCode).toBe(0);
  expect(context.lastOutput).toContain('swarm') && expect(context.lastOutput).toContain('agents');
});

Then('agent metrics should be displayed', function() {
  expect(context.lastOutput).toContain('metrics') || expect(context.lastOutput).toContain('performance');
});

Then('semantic constraints should be validated', function() {
  expect(context.exitCode).toBe(0);
  expect(context.lastOutput).toContain('semantic') && expect(context.lastOutput).toContain('valid');
});

Then('RDF compatibility should be checked', function() {
  expect(context.lastOutput).toContain('RDF') || expect(context.lastOutput).toContain('compatible');
});

Then('AI-assisted code generation should be triggered', function() {
  expect(context.exitCode).toBe(0);
  expect(context.lastOutput).toContain('AI') || expect(context.lastOutput).toContain('enhanced');
});

Then('enhanced templates should be used', function() {
  const mcpCall = context.mcpClient.getLastCall('ai_generate');
  expect(mcpCall.params.enhanced).toBe(true);
});

Then('all templates should be processed in parallel', function() {
  expect(context.exitCode).toBe(0);
  expect(context.lastOutput).toContain('parallel') || expect(context.lastOutput).toContain('batch');
});

Then('results should be aggregated', function() {
  expect(context.lastOutput).toContain('results') || expect(context.lastOutput).toContain('completed');
});

Then('the swarm configuration should be exported', function() {
  expect(context.exitCode).toBe(0);
  expect(context.lastOutput).toContain('exported');
});

Then('the file should be created in JSON format', function() {
  expect(existsSync('swarm-config.json')).toBe(true);
  context.createdFiles.push(join(process.cwd(), 'swarm-config.json'));
});

Then('all agent configurations should be included', function() {
  const configPath = join(process.cwd(), 'swarm-config.json');
  const config = JSON.parse(require('fs').readFileSync(configPath, 'utf-8'));
  expect(config.agents).toBeDefined();
  expect(Array.isArray(config.agents)).toBe(true);
});

Then('the swarm should be restored from configuration', function() {
  expect(context.exitCode).toBe(0);
  expect(context.lastOutput).toContain('restored') || expect(context.lastOutput).toContain('imported');
});

Then('all agents should be recreated', function() {
  const mcpCall = context.mcpClient.getLastCall('swarm_restore');
  expect(mcpCall.params.agents).toBeDefined();
});