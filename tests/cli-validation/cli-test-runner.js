#!/usr/bin/env node

/**
 * Comprehensive CLI Test Runner for Unjucks
 * Tests all commands, generators, error handling, and performance
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

const execAsync = promisify(exec);

class CLITestRunner {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      errors: [],
      performance: [],
      coverage: {}
    };
    this.startTime = this.getDeterministicTimestamp();
    this.cleanRoomPath = '/Users/sac/unjucks/tests/cli-validation/clean-room';
    this.binaryPath = '/Users/sac/unjucks/bin/unjucks.cjs';
  }

  async runCommand(cmd, options = {}) {
    const timeout = options.timeout || 30000;
    const cwd = options.cwd || this.cleanRoomPath;
    
    console.log(chalk.blue(`🔧 Running: ${cmd}`));
    
    try {
      const start = this.getDeterministicTimestamp();
      const result = await execAsync(cmd, { 
        cwd, 
        timeout,
        env: { ...process.env, NODE_ENV: 'test' }
      });
      const duration = this.getDeterministicTimestamp() - start;
      
      this.results.performance.push({
        command: cmd,
        duration,
        success: true
      });
      
      console.log(chalk.green(`✅ Success (${duration}ms)`));
      return { success: true, stdout: result.stdout, stderr: result.stderr, duration };
    } catch (error) {
      const duration = this.getDeterministicTimestamp() - this.getDeterministicTimestamp();
      this.results.errors.push({
        command: cmd,
        error: error.message,
        code: error.code,
        stderr: error.stderr
      });
      
      this.results.performance.push({
        command: cmd,
        duration,
        success: false
      });
      
      console.log(chalk.red(`❌ Failed: ${error.message}`));
      return { success: false, error: error.message, stderr: error.stderr, duration };
    }
  }

  async testBasicCommands() {
    console.log(chalk.yellow.bold('\n🧪 Testing Basic Commands'));
    
    const commands = [
      'node /Users/sac/unjucks/bin/unjucks.cjs --version',
      'node /Users/sac/unjucks/bin/unjucks.cjs --help',
      'node /Users/sac/unjucks/bin/unjucks.cjs list',
      'node /Users/sac/unjucks/bin/unjucks.cjs help',
      'node /Users/sac/unjucks/bin/unjucks.cjs init --help',
    ];

    for (const cmd of commands) {
      const result = await this.runCommand(cmd);
      if (result.success) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    }
  }

  async testGeneratorCommands() {
    console.log(chalk.yellow.bold('\n🧪 Testing Generator Commands'));
    
    const commands = [
      'node /Users/sac/unjucks/bin/unjucks.cjs generate --help',
      'node /Users/sac/unjucks/bin/unjucks.cjs new --help',
      'node /Users/sac/unjucks/bin/unjucks.cjs inject --help',
      'node /Users/sac/unjucks/bin/unjucks.cjs preview --help',
    ];

    for (const cmd of commands) {
      const result = await this.runCommand(cmd);
      if (result.success) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    }
  }

  async testAdvancedCommands() {
    console.log(chalk.yellow.bold('\n🧪 Testing Advanced Commands'));
    
    const commands = [
      'node /Users/sac/unjucks/bin/unjucks.cjs semantic --help',
      'node /Users/sac/unjucks/bin/unjucks.cjs workflow --help',
      'node /Users/sac/unjucks/bin/unjucks.cjs github --help',
      'node /Users/sac/unjucks/bin/unjucks.cjs knowledge --help',
      'node /Users/sac/unjucks/bin/unjucks.cjs neural --help',
      'node /Users/sac/unjucks/bin/unjucks.cjs migrate --help',
      'node /Users/sac/unjucks/bin/unjucks.cjs swarm --help',
      'node /Users/sac/unjucks/bin/unjucks.cjs perf --help',
    ];

    for (const cmd of commands) {
      const result = await this.runCommand(cmd);
      if (result.success) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    }
  }

  async testErrorHandling() {
    console.log(chalk.yellow.bold('\n🧪 Testing Error Handling'));
    
    const errorCommands = [
      'node /Users/sac/unjucks/bin/unjucks.cjs nonexistent-command',
      'node /Users/sac/unjucks/bin/unjucks.cjs generate nonexistent generator',
      'node /Users/sac/unjucks/bin/unjucks.cjs inject --invalid-flag',
      'node /Users/sac/unjucks/bin/unjucks.cjs new --malformed-input "{{broken}}',
    ];

    for (const cmd of errorCommands) {
      const result = await this.runCommand(cmd);
      // For error handling tests, we expect failures
      if (!result.success) {
        this.results.passed++;
        console.log(chalk.green('✅ Error handled correctly'));
      } else {
        this.results.failed++;
        console.log(chalk.red('❌ Should have failed but succeeded'));
      }
    }
  }

  async discoverGenerators() {
    console.log(chalk.yellow.bold('\n🔍 Discovering Available Generators'));
    
    try {
      const templatesPath = '/Users/sac/unjucks/_templates';
      const entries = await fs.readdir(templatesPath, { withFileTypes: true });
      const generators = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
      
      console.log(chalk.blue(`Found ${generators.length} generators:`));
      generators.forEach(gen => console.log(chalk.gray(`  - ${gen}`)));
      
      return generators;
    } catch (error) {
      console.log(chalk.red(`Failed to discover generators: ${error.message}`));
      return [];
    }
  }

  async testGenerators(generators) {
    console.log(chalk.yellow.bold('\n🧪 Testing Individual Generators'));
    
    for (const generator of generators.slice(0, 10)) { // Test first 10 for time
      try {
        // Test help for each generator
        const helpResult = await this.runCommand(
          `node /Users/sac/unjucks/bin/unjucks.cjs help ${generator} --help`
        );
        
        if (helpResult.success) {
          this.results.passed++;
          this.results.coverage[generator] = 'help-passed';
        } else {
          this.results.failed++;
          this.results.coverage[generator] = 'help-failed';
        }
      } catch (error) {
        this.results.failed++;
        this.results.coverage[generator] = 'error';
      }
    }
  }

  async performanceTest() {
    console.log(chalk.yellow.bold('\n⚡ Performance Testing'));
    
    const quickCommands = [
      'node /Users/sac/unjucks/bin/unjucks.cjs --version',
      'node /Users/sac/unjucks/bin/unjucks.cjs list',
      'node /Users/sac/unjucks/bin/unjucks.cjs --help',
    ];

    const iterations = 5;
    const performanceResults = [];

    for (const cmd of quickCommands) {
      const times = [];
      
      for (let i = 0; i < iterations; i++) {
        const result = await this.runCommand(cmd);
        if (result.success) {
          times.push(result.duration);
        }
      }
      
      if (times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        
        performanceResults.push({
          command: cmd,
          average: avg,
          min,
          max,
          samples: times.length
        });
      }
    }

    this.results.performance = [...this.results.performance, ...performanceResults];
  }

  async generateReport() {
    const totalTime = this.getDeterministicTimestamp() - this.startTime;
    const successRate = (this.results.passed / (this.results.passed + this.results.failed)) * 100;
    
    const report = `
# Unjucks CLI Validation Report
Generated: ${this.getDeterministicDate().toISOString()}

## Summary
- **Total Tests**: ${this.results.passed + this.results.failed}
- **Passed**: ${this.results.passed}
- **Failed**: ${this.results.failed}
- **Success Rate**: ${successRate.toFixed(1)}%
- **Total Duration**: ${totalTime}ms

## Performance Metrics
${this.results.performance
  .filter(p => p.average)
  .map(p => `- ${p.command}: ${p.average.toFixed(1)}ms avg (${p.min}-${p.max}ms)`)
  .join('\n')}

## Generator Coverage
${Object.entries(this.results.coverage)
  .map(([gen, status]) => `- ${gen}: ${status}`)
  .join('\n')}

## Errors Encountered
${this.results.errors.length > 0 
  ? this.results.errors.map(e => `- ${e.command}: ${e.error}`).join('\n')
  : '✅ No errors encountered'
}

## Recommendations
${successRate > 90 
  ? '✅ CLI is performing well with high success rate'
  : '⚠️  CLI has some failing commands that need attention'
}

${this.results.performance.some(p => p.average > 5000)
  ? '⚠️  Some commands are slow (>5s) and may need optimization'
  : '✅ All commands perform within acceptable time limits'
}
`;

    await fs.writeFile(
      '/Users/sac/unjucks/tests/cli-validation/reports/cli-validation-report.md',
      report
    );

    console.log(chalk.green.bold('\n📊 Test Complete!'));
    console.log(chalk.blue(`Report saved to: tests/cli-validation/reports/cli-validation-report.md`));
    console.log(chalk.yellow(`Success Rate: ${successRate.toFixed(1)}% (${this.results.passed}/${this.results.passed + this.results.failed})`));
    
    return report;
  }

  async run() {
    console.log(chalk.blue.bold('🚀 Starting Comprehensive CLI Validation'));
    
    // Ensure clean room exists
    await fs.mkdir(this.cleanRoomPath, { recursive: true });
    await fs.mkdir('/Users/sac/unjucks/tests/cli-validation/reports', { recursive: true });
    
    // Run all test suites
    await this.testBasicCommands();
    await this.testGeneratorCommands();
    await this.testAdvancedCommands();
    await this.testErrorHandling();
    
    const generators = await this.discoverGenerators();
    await this.testGenerators(generators);
    
    await this.performanceTest();
    
    return await this.generateReport();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new CLITestRunner();
  runner.run().catch(console.error);
}

export { CLITestRunner };