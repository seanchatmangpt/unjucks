#!/usr/bin/env node
/**
 * Comprehensive CLI Test Runner for @seanchatmangpt/unjucks
 * Tests all CLI commands in clean room environment
 */

import { execSync, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class UnjucksCliTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
    this.testDir = path.join(os.tmpdir(), 'unjucks-cli-test-' + Date.now());
    this.originalDir = process.cwd();
  }

  async setup() {
    console.log('🧪 Setting up clean room testing environment...');
    fs.mkdirSync(this.testDir, { recursive: true });
    process.chdir(this.testDir);
    console.log(`📁 Testing in: ${this.testDir}`);
  }

  async cleanup() {
    process.chdir(this.originalDir);
    try {
      fs.rmSync(this.testDir, { recursive: true, force: true });
    } catch (e) {
      console.warn(`⚠️ Could not cleanup test directory: ${e.message}`);
    }
  }

  runCommand(command, expectSuccess = true) {
    try {
      const result = execSync(command, { 
        encoding: 'utf8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return {
        success: true,
        stdout: result,
        stderr: '',
        exitCode: 0
      };
    } catch (error) {
      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.status || 1
      };
    }
  }

  testCommand(name, command, expectations = {}) {
    console.log(`🧪 Testing: ${name}`);
    console.log(`   Command: ${command}`);
    
    const result = this.runCommand(command);
    const test = {
      name,
      command,
      passed: false,
      result,
      expectations,
      timestamp: new Date().toISOString()
    };

    // Check expectations
    let passed = true;
    let reasons = [];

    if (expectations.shouldSucceed !== undefined) {
      if (expectations.shouldSucceed !== result.success) {
        passed = false;
        reasons.push(`Expected ${expectations.shouldSucceed ? 'success' : 'failure'}, got ${result.success ? 'success' : 'failure'}`);
      }
    }

    if (expectations.containsOutput && result.stdout) {
      const contains = expectations.containsOutput.every(text => 
        result.stdout.toLowerCase().includes(text.toLowerCase())
      );
      if (!contains) {
        passed = false;
        reasons.push(`Output missing expected text: ${expectations.containsOutput.join(', ')}`);
      }
    }

    if (expectations.exitCode !== undefined) {
      if (result.exitCode !== expectations.exitCode) {
        passed = false;
        reasons.push(`Expected exit code ${expectations.exitCode}, got ${result.exitCode}`);
      }
    }

    test.passed = passed;
    test.reasons = reasons;

    if (passed) {
      console.log('   ✅ PASSED');
      this.results.passed++;
    } else {
      console.log('   ❌ FAILED');
      reasons.forEach(reason => console.log(`      - ${reason}`));
      this.results.failed++;
    }

    this.results.tests.push(test);
    console.log('');
  }

  async runCoreCommandTests() {
    console.log('🚀 Testing Core Commands...\n');

    this.testCommand(
      'Version command (--version)',
      'unjucks --version',
      {
        shouldSucceed: true,
        containsOutput: ['2025'],
        exitCode: 0
      }
    );

    this.testCommand(
      'Version command (version)',
      'unjucks version',
      {
        shouldSucceed: true,
        containsOutput: ['2025'],
        exitCode: 0
      }
    );

    this.testCommand(
      'Help command (--help)',
      'unjucks --help',
      {
        shouldSucceed: true,
        containsOutput: ['usage', 'commands'],
        exitCode: 0
      }
    );

    this.testCommand(
      'Help command (help)',
      'unjucks help',
      {
        shouldSucceed: true,
        containsOutput: ['usage', 'commands'],
        exitCode: 0
      }
    );

    this.testCommand(
      'List command (empty directory)',
      'unjucks list',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );

    this.testCommand(
      'Init command',
      'unjucks init',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );

    // Test with templates directory
    fs.mkdirSync('_templates', { recursive: true });
    fs.mkdirSync('_templates/component', { recursive: true });
    fs.mkdirSync('_templates/component/new', { recursive: true });
    fs.writeFileSync('_templates/component/new/component.js.ejs', 'console.log("test");');

    this.testCommand(
      'List command (with templates)',
      'unjucks list',
      {
        shouldSucceed: true,
        containsOutput: ['component'],
        exitCode: 0
      }
    );
  }

  async runGeneratorCommandTests() {
    console.log('🔧 Testing Generator Commands...\n');

    // Setup test template
    const templateContent = `---
to: src/components/<%= name %>.js
---
export const <%= name %> = () => {
  return '<%= name %> component';
};
`;
    fs.writeFileSync('_templates/component/new/component.js.ejs', templateContent);

    this.testCommand(
      'Generate command (help)',
      'unjucks generate --help',
      {
        shouldSucceed: true,
        containsOutput: ['generate'],
        exitCode: 0
      }
    );

    this.testCommand(
      'Generate command (list generators)',
      'unjucks generate',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );

    this.testCommand(
      'Generate command (with template)',
      'unjucks generate component new --name TestComponent',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );

    this.testCommand(
      'New command (help)',
      'unjucks new --help',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );

    this.testCommand(
      'Preview command (dry run)',
      'unjucks preview component new --name PreviewComponent',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );

    // Test file injection
    fs.mkdirSync('src', { recursive: true });
    fs.writeFileSync('src/index.js', '// Main file\n');

    this.testCommand(
      'Inject command (help)',
      'unjucks inject --help',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );
  }

  async runAdvancedCommandTests() {
    console.log('🧠 Testing Advanced Commands...\n');

    this.testCommand(
      'Semantic command (help)',
      'unjucks semantic --help',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );

    this.testCommand(
      'Swarm command (help)',
      'unjucks swarm --help',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );

    this.testCommand(
      'Workflow command (help)',
      'unjucks workflow --help',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );

    this.testCommand(
      'Perf command (help)',
      'unjucks perf --help',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );
  }

  async runGitHubCommandTests() {
    console.log('🐙 Testing GitHub Integration Commands...\n');

    this.testCommand(
      'GitHub command (help)',
      'unjucks github --help',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );

    this.testCommand(
      'GitHub sync command',
      'unjucks github sync --help',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );
  }

  async runKnowledgeAndNeuralTests() {
    console.log('🧠 Testing Knowledge and Neural Commands...\n');

    this.testCommand(
      'Knowledge command (help)',
      'unjucks knowledge --help',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );

    this.testCommand(
      'Neural command (help)',
      'unjucks neural --help',
      {
        shouldSucceed: true,
        exitCode: 0
      }
    );
  }

  async runErrorHandlingTests() {
    console.log('⚠️ Testing Error Handling...\n');

    this.testCommand(
      'Invalid command',
      'unjucks nonexistent',
      {
        shouldSucceed: false,
        exitCode: 1
      }
    );

    this.testCommand(
      'Invalid generator',
      'unjucks generate nonexistent template',
      {
        shouldSucceed: false,
        exitCode: 1
      }
    );

    this.testCommand(
      'Generate without template',
      'unjucks generate component nonexistent',
      {
        shouldSucceed: false,
        exitCode: 1
      }
    );
  }

  generateReport() {
    const report = {
      summary: {
        total: this.results.tests.length,
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: this.results.skipped,
        success_rate: ((this.results.passed / this.results.tests.length) * 100).toFixed(2)
      },
      timestamp: new Date().toISOString(),
      environment: {
        node_version: process.version,
        platform: process.platform,
        test_directory: this.testDir
      },
      tests: this.results.tests
    };

    fs.writeFileSync('cli-test-report.json', JSON.stringify(report, null, 2));
    
    console.log('📊 TEST SUMMARY');
    console.log('================');
    console.log(`Total Tests: ${report.summary.total}`);
    console.log(`Passed: ${report.summary.passed} ✅`);
    console.log(`Failed: ${report.summary.failed} ❌`);
    console.log(`Success Rate: ${report.summary.success_rate}%`);
    console.log(`\nDetailed report saved to: cli-test-report.json`);

    return report;
  }

  async runAllTests() {
    try {
      await this.setup();
      
      await this.runCoreCommandTests();
      await this.runGeneratorCommandTests();
      await this.runAdvancedCommandTests();
      await this.runGitHubCommandTests();
      await this.runKnowledgeAndNeuralTests();
      await this.runErrorHandlingTests();

      const report = this.generateReport();
      
      await this.cleanup();
      
      return report;
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      await this.cleanup();
      throw error;
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new UnjucksCliTester();
  tester.runAllTests()
    .then(report => {
      process.exit(report.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default UnjucksCliTester;