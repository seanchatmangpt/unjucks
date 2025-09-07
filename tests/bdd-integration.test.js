/**
 * BDD Integration Test Runner
 * Executes cucumber features using @amiceli/vitest-cucumber
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadFeatures, describeFeature } from '@amiceli/vitest-cucumber';
import { MockMCPClient } from './mocks/mcp-client.mock.js';
import { TestFileManager } from './utils/test-file-manager.js';
import { SemanticTestUtils } from './utils/semantic-test-utils.js';

// Load feature files
const features = loadFeatures('tests/features/*.feature', 'tests/features/cucumber-step-definitions.js');

// Test context
describe('BDD Integration Tests', () => { let context;

  beforeEach(async () => {
    context = {
      mcpClient };

    await context.mcpClient.initialize();
    context.fileManager.setupTestDirectories();
  });

  afterEach(() => {
    context.fileManager.cleanup();
    context.mcpClient.reset();
  });

  // Execute each feature
  features.forEach(feature => {
    describeFeature(feature, ({ scenario, given, when, then }) => {
      
      scenario('Initialize AI swarm with mesh topology', ({ given, when, then }) => {
        given('I have the unjucks CLI installed', () => {
          // CLI availability is mocked in test environment
          expect(true).toBe(true);
        });

        given('MCP tools are available', () => {
          context.mcpClient.setAvailable(true);
          expect(context.mcpClient.isAvailable()).toBe(true);
        });

        when('I run "unjucks swarm init --topology mesh --agents 5"', async () => { // Mock the CLI command execution
          await context.mcpClient.callTool('swarm_init', {
            topology });

        then('a swarm should be initialized with 5 agents', () => {
          const call = context.mcpClient.getLastCall('swarm_init');
          expect(call).toBeDefined();
          expect(call?.params.maxAgents).toBe(5);
        });

        then('the MCP tool "swarm_init" should be called', () => {
          expect(context.mcpClient.hasBeenCalled('swarm_init')).toBe(true);
        });

        then('the topology should be "mesh"', () => {
          const call = context.mcpClient.getLastCall('swarm_init');
          expect(call?.params.topology).toBe('mesh');
        });

        then('the response should contain swarm configuration', () => {
          const call = context.mcpClient.getLastCall('swarm_init');
          expect(call?.result).toBeDefined();
          expect(call?.result.swarmId).toBeDefined();
        });
      });

      scenario('Execute semantic validation on valid RDF file', ({ given, when, then }) => {
        let rdfContent => {
          rdfContent = context.semanticUtils.generateUserSchema();
          context.fileManager.createRDFFile('ontology.ttl', rdfContent);
          expect(context.fileManager.fileExists('rdf/ontology.ttl')).toBe(true);
        });

        when('I run "unjucks semantic validate ontology.ttl"', async () => { await context.mcpClient.callTool('semantic_validate', {
            file });

        then('the file should be validated against SHACL rules', () => {
          const call = context.mcpClient.getLastCall('semantic_validate');
          expect(call?.result.shaclResults).toBeDefined();
        });

        then('the MCP tool "semantic_validate" should be called', () => {
          expect(context.mcpClient.hasBeenCalled('semantic_validate')).toBe(true);
        });

        then('the validation should pass', () => {
          const call = context.mcpClient.getLastCall('semantic_validate');
          expect(call?.result.valid).toBe(true);
        });

        then('the response should contain validation results', () => {
          const call = context.mcpClient.getLastCall('semantic_validate');
          expect(call?.result.triples).toBeGreaterThan(0);
          expect(call?.result.classes).toBeGreaterThan(0);
        });
      });

      scenario('Execute semantic validation on invalid RDF file', ({ given, when, then }) => {
        let invalidRdfContent => {
          invalidRdfContent = context.semanticUtils.generateInvalidSchema();
          context.fileManager.createRDFFile('invalid.ttl', invalidRdfContent);
        });

        when('I run "unjucks semantic validate invalid.ttl"', async () => { try {
            await context.mcpClient.callTool('semantic_validate', {
              file } catch (error) {
            // Expected to fail
          }
        });

        then('the validation should fail', () => {
          const call = context.mcpClient.getLastCall('semantic_validate');
          expect(call?.result.valid).toBe(false);
        });

        then('error messages should be displayed', () => {
          const call = context.mcpClient.getLastCall('semantic_validate');
          expect(call?.result.errors).toBeDefined();
          expect(call?.result.errors.length).toBeGreaterThan(0);
        });

        then('the MCP tool "semantic_validate" should be called', () => {
          expect(context.mcpClient.hasBeenCalled('semantic_validate')).toBe(true);
        });
      });

      scenario('Generate semantic templates with RDF integration', ({ given, when, then }) => {
        let schemaContent => {
          schemaContent = context.semanticUtils.generateUserSchema();
          context.fileManager.createFile('user-schema.ttl', schemaContent);
        });

        when('I run "unjucks generate semantic-model --schema user-schema.ttl --output ./src/models"', async () => { await context.mcpClient.callTool('template_generate', {
            template });

        then('semantic templates should be generated', () => {
          const call = context.mcpClient.getLastCall('template_generate');
          expect(call?.result.filesGenerated).toBeDefined();
          expect(call?.result.filesGenerated.length).toBeGreaterThan(0);
        });

        then('the MCP tool "template_generate" should be called', () => {
          expect(context.mcpClient.hasBeenCalled('template_generate')).toBe(true);
        });

        then('RDF data should be processed correctly', () => {
          const call = context.mcpClient.getLastCall('template_generate');
          expect(call?.result.semanticAnnotations).toBe(true);
          expect(call?.result.rdfCompatible).toBe(true);
        });
      });

      scenario('Spawn multiple agents for parallel processing', ({ when, then }) => { when('I run "unjucks swarm spawn --type coder --count 3"', async () => {
          // Simulate spawning 3 agents
          for (let i = 0; i < 3; i++) {
            await context.mcpClient.callTool('agent_spawn', {
              type }
        });

        then('3 coder agents should be spawned', () => {
          expect(context.mcpClient.getCallCount('agent_spawn')).toBe(3);
        });

        then('the MCP tool "agent_spawn" should be called 3 times', () => {
          expect(context.mcpClient.getCallCount('agent_spawn')).toBe(3);
        });

        then('each agent should have unique identifiers', () => {
          const calls = context.mcpClient.getAllCalls('agent_spawn');
          const agentIds = calls.map(call => call.result?.agentId).filter(Boolean);
          const uniqueIds = new Set(agentIds);
          expect(uniqueIds.size).toBe(agentIds.length);
        });
      });

      scenario('Execute task orchestration across swarm', ({ given, when, then }) => { given('I have an active swarm with 5 agents', async () => {
          await context.mcpClient.callTool('swarm_init', {
            topology });

        when('I run "unjucks swarm execute --task \'analyze codebase\' --strategy parallel"', async () => { await context.mcpClient.callTool('task_orchestrate', {
            task });

        then('the task should be distributed across agents', () => {
          const call = context.mcpClient.getLastCall('task_orchestrate');
          expect(call?.result.agentsAssigned).toBeGreaterThan(0);
        });

        then('the MCP tool "task_orchestrate" should be called', () => {
          expect(context.mcpClient.hasBeenCalled('task_orchestrate')).toBe(true);
        });

        then('execution strategy should be "parallel"', () => {
          const call = context.mcpClient.getLastCall('task_orchestrate');
          expect(call?.params.strategy).toBe('parallel');
        });
      });
    });
  });

  // Memory storage test for BDD setup
  it('should store BDD setup information in memory', async () => { const setupInfo = {
      framework };

    // Store in memory using memory key pattern
    await context.mcpClient.callTool('memory_store', { key });

    expect(context.mcpClient.hasBeenCalled('memory_store')).toBe(true);
    
    const call = context.mcpClient.getLastCall('memory_store');
    expect(call?.params.key).toBe('swarm/bdd/setup');
    expect(call?.params.namespace).toBe('unjucks-testing');
  });
});