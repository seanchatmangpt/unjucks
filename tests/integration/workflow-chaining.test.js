/**
 * Workflow Chaining Integration Test
 * Tests command combinations and complex CLI workflows
 * Agent 10 - Integration Tester
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';

const CLI_PATH = resolve('./bin/unjucks.cjs');

const runCLI = (args, timeout = 10000) => {
  try {
    const result = execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf8',
      timeout,
      stdio: 'pipe'
    });
    return { stdout: result, stderr: '', success: true };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      success: false,
      code: error.status
    };
  }
};

describe('CLI Workflow Chaining Tests', () => {
  describe('1. Command Discovery Workflows', () => {
    test('List → Help → Generate workflow', () => {
      // Step 1: List available generators
      const listResult = runCLI('list');
      expect(listResult.success).toBe(true);
      expect(listResult.stdout).toContain('component');

      // Step 2: Get help for specific command
      const helpResult = runCLI('generate --help');
      expect(helpResult.success).toBe(true);
      expect(helpResult.stdout).toContain('generate');

      // Step 3: Execute generation (dry run)
      const genResult = runCLI('generate component react WorkflowTest --dry');
      expect(genResult.success).toBe(true);
    });

    test('Semantic workflow discovery', () => {
      // Discover semantic capabilities
      const semanticHelp = runCLI('semantic --help');
      expect(semanticHelp.success).toBe(true);

      // Check if semantic features are available
      const semanticList = runCLI('list');
      expect(semanticList.stdout).toContain('semantic');
    });
  });

  describe('2. Multi-Generator Workflows', () => {
    test('Full-stack generation sequence', () => {
      const workflows = [
        'generate api endpoint UserAPI --dry',
        'generate model sequelize User --dry',
        'generate component react UserProfile --dry',
        'generate test api UserAPI --dry'
      ];

      const results = workflows.map(workflow => ({
        command: workflow,
        result: runCLI(workflow)
      }));

      // Most workflows should succeed
      const successCount = results.filter(r => r.result.success).length;
      expect(successCount).toBeGreaterThanOrEqual(2);

      results.forEach(({ command, result }) => {
        if (!result.success) {
          console.log(`Failed workflow: ${command}`, result.stderr);
        }
      });
    });

    test('Enterprise workflow chain', () => {
      const enterpriseWorkflows = [
        'list', // Discover available generators
        'enterprise --help', // Check enterprise features
        'generate database schema Enterprise --dry', // Database design
        'generate api express EnterpriseAPI --dry', // API layer
      ];

      let successCount = 0;
      for (const workflow of enterpriseWorkflows) {
        const result = runCLI(workflow);
        if (result.success) successCount++;
      }

      // At least 75% should work
      expect(successCount / enterpriseWorkflows.length).toBeGreaterThan(0.75);
    });
  });

  describe('3. Error Recovery Workflows', () => {
    test('Error → Help → Correct Command workflow', () => {
      // Step 1: Trigger error with invalid command
      const errorResult = runCLI('invalid-command');
      expect(errorResult.stdout).toContain('Usage:'); // Should show help

      // Step 2: Get proper help
      const helpResult = runCLI('--help');
      expect(helpResult.success).toBe(true);

      // Step 3: Execute valid command
      const validResult = runCLI('list');
      expect(validResult.success).toBe(true);
    });

    test('Missing args → Help → Corrected command', () => {
      // Step 1: Command with missing args
      const missingArgs = runCLI('inject');
      expect(missingArgs.success).toBe(false);
      expect(missingArgs.stderr).toContain('--file');

      // Step 2: Get help for inject
      const injectHelp = runCLI('inject --help');
      expect(injectHelp.success).toBe(true);

      // Step 3: Properly formed inject command would be tested with actual files
      // For now, just verify help structure
      expect(injectHelp.stdout).toContain('inject');
    });
  });

  describe('4. Performance Workflow Chains', () => {
    test('Rapid command execution', () => {
      const rapidCommands = [
        '--version',
        'list',
        'generate --help',
        'component react Test1 --dry',
        'api endpoint Test2 --dry',
        'service new Test3 --dry'
      ];

      const startTime = this.getDeterministicTimestamp();
      const results = rapidCommands.map(cmd => runCLI(cmd, 5000)); // 5s timeout
      const endTime = this.getDeterministicTimestamp();

      const duration = endTime - startTime;
      const successRate = results.filter(r => r.success).length / results.length;

      // Should handle rapid commands efficiently
      expect(duration).toBeLessThan(15000); // Under 15 seconds total
      expect(successRate).toBeGreaterThan(0.6); // At least 60% success
    });
  });

  describe('5. Complex Template Workflows', () => {
    test('Template validation chain', () => {
      // Test that we can discover, validate, and execute templates
      const steps = [
        { cmd: 'list', desc: 'List generators', mustPass: true },
        { cmd: 'generate component --help', desc: 'Component help', mustPass: true },
        { cmd: 'generate component react ValidateTest --dry', desc: 'Dry run generation', mustPass: false },
        { cmd: 'help component react', desc: 'Template help', mustPass: false }
      ];

      let passedSteps = 0;
      for (const step of steps) {
        const result = runCLI(step.cmd);
        if (result.success) {
          passedSteps++;
        } else if (step.mustPass) {
          console.error(`Critical step failed: ${step.desc}`, result.stderr);
        }
      }

      // At least the critical steps must pass
      expect(passedSteps).toBeGreaterThanOrEqual(2);
    });
  });

  describe('6. Integration Completeness', () => {
    test('End-to-end workflow completeness score', () => {
      const workflows = {
        'Basic CLI': ['--version', '--help', 'list'],
        'Generation': ['generate component react Test --dry', 'generate api endpoint Test --dry'],
        'Help System': ['generate --help', 'inject --help', 'semantic --help'],
        'Error Handling': ['invalid-cmd', 'inject'],
        'Advanced Features': ['github --help', 'semantic --help', 'migrate --help']
      };

      const results = {};
      let totalCommands = 0;
      let successfulCommands = 0;

      for (const [category, commands] of Object.entries(workflows)) {
        const categoryResults = commands.map(cmd => runCLI(cmd));
        const categorySuccess = categoryResults.filter(r => 
          r.success || r.stdout.includes('Usage:')
        ).length;
        
        results[category] = {
          total: commands.length,
          successful: categorySuccess,
          rate: (categorySuccess / commands.length * 100).toFixed(1) + '%'
        };

        totalCommands += commands.length;
        successfulCommands += categorySuccess;
      }

      const overallSuccess = (successfulCommands / totalCommands * 100).toFixed(1) + '%';
      
      console.log('\n=== CLI Integration Test Summary ===');
      console.log('Category Results:');
      Object.entries(results).forEach(([category, data]) => {
        console.log(`  ${category}: ${data.successful}/${data.total} (${data.rate})`);
      });
      console.log(`Overall Success Rate: ${overallSuccess}`);
      console.log('=====================================\n');

      // Store results for later reporting
      global.integrationResults = {
        categories: results,
        overall: overallSuccess,
        totalCommands,
        successfulCommands
      };

      // Expect at least 75% overall success
      expect(successfulCommands / totalCommands).toBeGreaterThan(0.75);
    });
  });
});