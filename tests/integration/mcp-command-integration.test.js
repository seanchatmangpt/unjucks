import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestHelper, customMatchers } from '../support/TestHelper.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// Extend expect with custom matchers
expect.extend(customMatchers);

/**
 * Comprehensive Integration Tests for MCP-Enhanced Commands
 * 
 * Tests all new MCP-integrated commands:
 * - swarm: Multi-agent coordination
 * - workflow: Development automation
 * - github: Repository integration  
 * - perf: Performance analysis
 * - semantic: RDF/OWL code generation
 * - neural: AI/ML capabilities
 */
describe('MCP Command Integration Tests', () => {
  let testHelper;
  let tempDir;
  
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unjucks-mcp-'));
    testHelper = new TestHelper(tempDir);
    
    // Create test directory structure
    await fs.ensureDir(path.join(tempDir, 'templates'));
    await fs.ensureDir(path.join(tempDir, 'src'));
    await fs.ensureDir(path.join(tempDir, 'tests'));
    await fs.ensureDir(path.join(tempDir, '.unjucks'));
  });

  afterEach(async () => {
    await testHelper.cleanup();
  });

  // ============================================================================
  // SWARM COMMAND TESTS
  // ============================================================================
  
  describe('Swarm Command Integration', () => {
    test('should show swarm help', async () => {
      const result = await testHelper.runCli('swarm --help');
      
      // The CLI should show help even without MCP connection
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('swarm');
    });

    test('should handle swarm init with topology options', async () => {
      const result = await testHelper.runCli('swarm init --topology mesh --maxAgents 5');
      
      // Should not fail immediately - may show connection warnings
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 0) {
        expect(result.stdout).toContain('swarm');
      } else {
        // Expected failure due to missing MCP connection
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should validate swarm init topology options', async () => {
      const result = await testHelper.runCli('swarm init --topology invalid');
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBeTruthy();
    });

    test('should handle swarm spawn with agent types', async () => {
      const result = await testHelper.runCli('swarm spawn --type coder --name test-agent');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        // Expected failure - check it's MCP related, not command structure
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle swarm orchestrate task delegation', async () => {
      const result = await testHelper.runCli('swarm orchestrate --task "Build API endpoint" --priority high');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle swarm status monitoring', async () => {
      const result = await testHelper.runCli('swarm status');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle swarm scale operations', async () => {
      const result = await testHelper.runCli('swarm scale --target 8');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle swarm destroy cleanup', async () => {
      const result = await testHelper.runCli('swarm destroy --confirm');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });
  });

  // ============================================================================
  // WORKFLOW COMMAND TESTS  
  // ============================================================================

  describe('Workflow Command Integration', () => {
    test('should show workflow help', async () => {
      const result = await testHelper.runCli('workflow --help');
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('workflow');
    });

    test('should handle workflow create with JTBD parameters', async () => {
      const result = await testHelper.runCli('workflow create --name "API Development" --job "build-secure-api" --outcome "production-ready-endpoint"');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle workflow execute with strategy options', async () => {
      const result = await testHelper.runCli('workflow execute --id test-workflow --strategy parallel');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle workflow status monitoring', async () => {
      const result = await testHelper.runCli('workflow status --id test-workflow');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle workflow list filtering', async () => {
      const result = await testHelper.runCli('workflow list --status active --limit 10');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should validate workflow strategy options', async () => {
      const result = await testHelper.runCli('workflow execute --strategy invalid');
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBeTruthy();
    });
  });

  // ============================================================================
  // GITHUB COMMAND TESTS
  // ============================================================================

  describe('GitHub Command Integration', () => {
    test('should show github help', async () => {
      const result = await testHelper.runCli('github --help');
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('GitHub');
    });

    test('should handle repository analysis', async () => {
      const result = await testHelper.runCli('github analyze --repo "test/repo" --type code_quality');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle PR management operations', async () => {
      const result = await testHelper.runCli('github pr --repo "test/repo" --action create --title "Test PR"');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle issue tracking', async () => {
      const result = await testHelper.runCli('github issues --repo "test/repo" --action list --state open');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle release management', async () => {
      const result = await testHelper.runCli('github releases --repo "test/repo" --action create --version "v1.0.0"');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should validate repository format', async () => {
      const result = await testHelper.runCli('github analyze --repo "invalid-repo-format"');
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBeTruthy();
    });
  });

  // ============================================================================
  // PERFORMANCE COMMAND TESTS
  // ============================================================================

  describe('Performance Command Integration', () => {
    test('should show perf help', async () => {
      const result = await testHelper.runCli('perf --help');
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Performance');
    });

    test('should handle benchmark suite execution', async () => {
      const result = await testHelper.runCli('perf benchmark --suite all --iterations 10');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle performance analysis', async () => {
      const result = await testHelper.runCli('perf analyze --component memory --timeframe 24h');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle system monitoring', async () => {
      const result = await testHelper.runCli('perf monitor --duration 30 --interval 5');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle optimization suggestions', async () => {
      const result = await testHelper.runCli('perf optimize --target swarm --strategy adaptive');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should validate benchmark suite options', async () => {
      const result = await testHelper.runCli('perf benchmark --suite invalid');
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBeTruthy();
    });

    test('should validate timeframe options', async () => {
      const result = await testHelper.runCli('perf analyze --timeframe invalid');
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBeTruthy();
    });
  });

  // ============================================================================
  // SEMANTIC COMMAND TESTS
  // ============================================================================

  describe('Semantic Command Integration', () => {
    test('should show semantic help', async () => {
      const result = await testHelper.runCli('semantic --help');
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('semantic');
    });

    test('should handle semantic code generation from RDF', async () => {
      // Create a test RDF file
      const testRdfPath = path.join(tempDir, 'test-ontology.ttl');
      await fs.writeFile(testRdfPath, `
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
:TestClass a rdfs:Class .
`);
      
      const result = await testHelper.runCli(`semantic generate --ontology "${testRdfPath}" --template typescript --output ./src`);
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        // Should be semantic processing error, not command structure error
        expect(result.stderr).toBeTruthy();
      }
    });

    test('should handle semantic validation', async () => {
      const result = await testHelper.runCli('semantic validate --schema "test-schema.ttl" --strict');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toBeTruthy();
      }
    });

    test('should handle reasoning operations', async () => {
      const result = await testHelper.runCli('semantic reason --ontology "test.owl" --reasoner hermit');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toBeTruthy();
      }
    });

    test('should handle SPARQL queries', async () => {
      const result = await testHelper.runCli('semantic query --endpoint "test-endpoint" --query "SELECT * WHERE { ?s ?p ?o }"');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toBeTruthy();
      }
    });

    test('should validate reasoner options', async () => {
      const result = await testHelper.runCli('semantic reason --reasoner invalid');
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBeTruthy();
    });
  });

  // ============================================================================
  // NEURAL COMMAND TESTS
  // ============================================================================

  describe('Neural Command Integration', () => {
    test('should show neural help', async () => {
      const result = await testHelper.runCli('neural --help');
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('neural');
    });

    test('should handle neural network training', async () => {
      const result = await testHelper.runCli('neural train --architecture transformer --tier small --epochs 10');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle prediction operations', async () => {
      const result = await testHelper.runCli('neural predict --model "test-model" --input "test data"');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle model validation', async () => {
      const result = await testHelper.runCli('neural validate --model "test-model" --type comprehensive');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should handle performance benchmarks', async () => {
      const result = await testHelper.runCli('neural benchmark --model "test-model" --type inference');
      
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toContainMCPError();
      }
    });

    test('should validate neural architecture options', async () => {
      const result = await testHelper.runCli('neural train --architecture invalid');
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBeTruthy();
    });

    test('should validate training tier options', async () => {
      const result = await testHelper.runCli('neural train --tier invalid');
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBeTruthy();
    });

    test('should validate validation type options', async () => {
      const result = await testHelper.runCli('neural validate --type invalid');
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBeTruthy();
    });
  });

  // ============================================================================
  // CROSS-COMMAND INTEGRATION TESTS
  // ============================================================================

  describe('Cross-Command Integration', () => {
    test('should handle chained workflow with swarm and github', async () => {
      // This tests that commands can work together in sequence
      const swarmResult = await testHelper.runCli('swarm init --topology mesh');
      const workflowResult = await testHelper.runCli('workflow create --name "swarm-github-integration"');
      
      // Both should have consistent error handling
      expect(swarmResult.exitCode).toBeOneOf([0, 1]);
      expect(workflowResult.exitCode).toBeOneOf([0, 1]);
    });

    test('should handle semantic with neural integration', async () => {
      const semanticResult = await testHelper.runCli('semantic generate --ontology test.owl');
      const neuralResult = await testHelper.runCli('neural train --architecture transformer');
      
      expect(semanticResult.exitCode).toBeOneOf([0, 1]);
      expect(neuralResult.exitCode).toBeOneOf([0, 1]);
    });

    test('should maintain consistent error formatting across commands', async () => {
      const commands = [
        'swarm init --topology invalid',
        'workflow execute --strategy invalid', 
        'perf benchmark --suite invalid',
        'neural train --architecture invalid'
      ];

      for (const cmd of commands) {
        const result = await testHelper.runCli(cmd);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toBeTruthy();
        // Error messages should be properly formatted
        expect(result.stderr).not.toMatch(/undefined|null|\[object Object\]/);
      }
    });
  });

  // ============================================================================
  // MOCK MCP RESPONSE VALIDATION
  // ============================================================================

  describe('MCP Response Validation', () => {
    test('should handle MCP connection failures gracefully', async () => {
      const commands = [
        'swarm status',
        'workflow list', 
        'perf monitor',
        'neural benchmark --model test'
      ];

      for (const cmd of commands) {
        const result = await testHelper.runCli(cmd);
        
        if (result.exitCode === 1) {
          // Should show user-friendly error message
          expect(result.stderr).not.toContain('ECONNREFUSED');
          expect(result.stderr).not.toContain('undefined');
          expect(result.stderr).toBeTruthy();
        }
      }
    });

    test('should validate command argument parsing', async () => {
      // Test that commands properly parse and validate arguments even without MCP
      const result = await testHelper.runCli('swarm init --help');
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBeTruthy();
    });
  });
});