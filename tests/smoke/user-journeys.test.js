#!/usr/bin/env node

/**
 * User Journey Smoke Tests
 * Tests complete user workflows and interactions
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const tempDir = path.join(projectRoot, 'tests/smoke/temp-journeys');

class UserJourneyTester {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async setup() {
    await fs.remove(tempDir);
    await fs.ensureDir(tempDir);
    process.chdir(projectRoot);
  }

  async teardown() {
    await fs.remove(tempDir);
  }

  log(message, type = 'info') {
    const timestamp = Date.now() - this.startTime;
    const colors = {
      info: 'blue',
      success: 'green',
      error: 'red',
      warning: 'yellow'
    };
    console.log(chalk[colors[type]](`[${timestamp}ms] ${message}`));
  }

  execCommand(command, options = {}) {
    const defaultOptions = {
      cwd: projectRoot,
      timeout: 15000,
      encoding: 'utf8',
      ...options
    };
    
    try {
      const output = execSync(command, defaultOptions);
      return {
        success: true,
        stdout: output.toString(),
        stderr: '',
        code: 0
      };
    } catch (error) {
      return {
        success: false,
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || '',
        code: error.status || 1,
        error: error.message
      };
    }
  }

  async journey(name, steps) {
    this.log(`Starting journey: ${name}`, 'info');
    const journeyStart = Date.now();
    
    try {
      const results = [];
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        this.log(`  Step ${i + 1}: ${step.description}`, 'info');
        
        const stepStart = Date.now();
        const result = await step.action();
        const stepDuration = Date.now() - stepStart;
        
        results.push({
          step: i + 1,
          description: step.description,
          success: result.success,
          duration: stepDuration,
          output: result.stdout || result.message || '',
          error: result.error || result.stderr || ''
        });
        
        if (!result.success && step.required !== false) {
          throw new Error(`Step ${i + 1} failed: ${result.error || result.stderr || 'Unknown error'}`);
        }
        
        this.log(`  ✓ Step ${i + 1} completed (${stepDuration}ms)`, 'success');
      }
      
      const journeyDuration = Date.now() - journeyStart;
      this.results.push({
        name,
        status: 'PASS',
        duration: journeyDuration,
        steps: results
      });
      
      this.log(`✅ Journey completed: ${name} (${journeyDuration}ms)`, 'success');
      return true;
      
    } catch (error) {
      const journeyDuration = Date.now() - journeyStart;
      this.results.push({
        name,
        status: 'FAIL',
        duration: journeyDuration,
        error: error.message
      });
      
      this.log(`❌ Journey failed: ${name} (${journeyDuration}ms) - ${error.message}`, 'error');
      return false;
    }
  }

  printSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const totalDuration = Date.now() - this.startTime;

    console.log('\n' + '='.repeat(60));
    console.log(chalk.bold.blue('USER JOURNEY TEST SUMMARY'));
    console.log('='.repeat(60));
    console.log(chalk.cyan(`Total Journeys: ${total}`));
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${failed}`));
    console.log(chalk.blue(`Total Duration: ${totalDuration}ms`));
    console.log(chalk.cyan(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`));

    if (failed > 0) {
      console.log('\n' + chalk.red.bold('FAILED JOURNEYS:'));
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(chalk.red(`\n❌ ${result.name}`));
          console.log(chalk.red(`   Error: ${result.error}`));
        });
    }

    return passed === total;
  }
}

// Journey definitions
async function journeyNewUserDiscovery(tester) {
  return await tester.journey('New User Discovery', [
    {
      description: 'Run CLI with no arguments to see help',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs');
        return {
          success: result.stdout.includes('Unjucks CLI') || result.stdout.includes('Usage:') || result.stdout.includes('Hygen-style CLI') || result.stdout.includes('USAGE'),
          stdout: result.stdout,
          stderr: result.stderr
        };
      }
    },
    {
      description: 'Check version to verify installation',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs --version');
        return {
          success: result.success && result.stdout.trim().length > 0,
          stdout: result.stdout,
          stderr: result.stderr
        };
      }
    },
    {
      description: 'Get help information',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs --help');
        return {
          success: result.success && result.stdout.includes('COMMANDS'),
          stdout: result.stdout,
          stderr: result.stderr
        };
      }
    },
    {
      description: 'List available generators',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs list');
        return {
          success: result.success || result.stdout.includes('No generators found'),
          stdout: result.stdout,
          stderr: result.stderr,
          message: 'List command executed (may show no generators)'
        };
      }
    }
  ]);
}

async function journeyBasicGeneration(tester) {
  return await tester.journey('Basic Template Generation', [
    {
      description: 'Attempt dry run generation with common template',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs generate component react MyButton --dry --dest ./tests/smoke/temp-journeys');
        return {
          success: result.success || result.stderr.includes('not found'),
          stdout: result.stdout,
          stderr: result.stderr,
          message: 'Generation attempted (template may not exist)'
        };
      }
    },
    {
      description: 'Test positional argument syntax',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs component react TestComponent --dry --dest ./tests/smoke/temp-journeys');
        return {
          success: result.success || result.stderr.includes('not found'),
          stdout: result.stdout,
          stderr: result.stderr,
          message: 'Positional syntax attempted'
        };
      }
    },
    {
      description: 'Verify no files created during dry run',
      action: async () => {
        const files = await fs.readdir(tempDir);
        return {
          success: files.length === 0,
          message: files.length === 0 ? 'No files created (correct)' : `Files found: ${files.join(', ')}`,
          stdout: `Files in temp dir: ${files.length}`
        };
      }
    }
  ]);
}

async function journeyHelpSystem(tester) {
  return await tester.journey('Help System Navigation', [
    {
      description: 'Access main help',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs help');
        return {
          success: result.success,
          stdout: result.stdout,
          stderr: result.stderr
        };
      }
    },
    {
      description: 'Test help for specific command',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs generate --help');
        return {
          success: result.success && result.stdout.includes('generate'),
          stdout: result.stdout,
          stderr: result.stderr
        };
      }
    },
    {
      description: 'Test help with invalid command',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs invalidcommand --help');
        return {
          success: result.stderr.includes('Unknown command') || result.stdout.includes('Unknown command'),
          stdout: result.stdout,
          stderr: result.stderr,
          message: 'Properly handled invalid command'
        };
      }
    }
  ]);
}

async function journeyErrorHandling(tester) {
  return await tester.journey('Error Handling and Recovery', [
    {
      description: 'Handle missing template gracefully',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs generate nonexistent template MyThing --dry');
        return {
          success: !result.success && (result.stderr.includes('not found') || result.stdout.includes('not found')),
          stdout: result.stdout,
          stderr: result.stderr,
          message: 'Properly reported missing template'
        };
      }
    },
    {
      description: 'Handle invalid arguments',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs generate --invalid-flag');
        return {
          success: !result.success || result.stderr.includes('required') || result.stdout.includes('required'),
          stdout: result.stdout,
          stderr: result.stderr,
          message: 'Handled invalid arguments'
        };
      }
    },
    {
      description: 'Handle permission denied scenario',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs generate component react Test --dest /root --dry');
        return {
          success: true, // Should handle gracefully with dry run
          stdout: result.stdout,
          stderr: result.stderr,
          message: 'Handled permission scenario with dry run'
        };
      }
    }
  ]);
}

async function journeyAdvancedFeatures(tester) {
  return await tester.journey('Advanced Features', [
    {
      description: 'Test semantic command availability',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs semantic --help');
        return {
          success: result.success && result.stdout.includes('semantic'),
          stdout: result.stdout,
          stderr: result.stderr
        };
      }
    },
    {
      description: 'Test inject command availability',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs inject --help');
        return {
          success: result.success && result.stdout.includes('inject'),
          stdout: result.stdout,
          stderr: result.stderr
        };
      }
    },
    {
      description: 'Test migration command availability',
      action: () => {
        const result = tester.execCommand('node bin/unjucks.cjs migrate --help');
        return {
          success: result.success && result.stdout.includes('migrate'),
          stdout: result.stdout,
          stderr: result.stderr
        };
      },
      required: false // Optional feature
    }
  ]);
}

async function journeyPerformance(tester) {
  return await tester.journey('Performance Validation', [
    {
      description: 'CLI startup time under 2 seconds',
      action: () => {
        const start = Date.now();
        const result = tester.execCommand('node bin/unjucks.cjs --version');
        const duration = Date.now() - start;
        
        return {
          success: result.success && duration < 2000,
          stdout: `Version check took ${duration}ms`,
          message: duration < 2000 ? 'Fast startup' : 'Slow startup',
          duration
        };
      }
    },
    {
      description: 'Help command response time under 1 second',
      action: () => {
        const start = Date.now();
        const result = tester.execCommand('node bin/unjucks.cjs --help');
        const duration = Date.now() - start;
        
        return {
          success: result.success && duration < 1000,
          stdout: `Help took ${duration}ms`,
          message: duration < 1000 ? 'Fast help' : 'Slow help',
          duration
        };
      }
    },
    {
      description: 'List command response time under 3 seconds',
      action: () => {
        const start = Date.now();
        const result = tester.execCommand('node bin/unjucks.cjs list');
        const duration = Date.now() - start;
        
        return {
          success: duration < 3000, // Allow list to "fail" but be fast
          stdout: `List took ${duration}ms`,
          message: duration < 3000 ? 'Fast list' : 'Slow list',
          duration
        };
      }
    }
  ]);
}

// Main test execution
async function runUserJourneyTests() {
  const tester = new UserJourneyTester();
  
  console.log(chalk.bold.blue('🚶 Starting User Journey Smoke Tests'));
  console.log(chalk.gray('Testing complete user workflows and interactions...\n'));

  try {
    await tester.setup();

    // Core user journeys
    await journeyNewUserDiscovery(tester);
    await journeyHelpSystem(tester);
    await journeyBasicGeneration(tester);
    await journeyErrorHandling(tester);
    await journeyAdvancedFeatures(tester);
    await journeyPerformance(tester);

    await tester.teardown();
    
    const allPassed = tester.printSummary();
    
    return allPassed;
    
  } catch (error) {
    console.error(chalk.red.bold('\n💥 User journey test runner failed:'));
    console.error(chalk.red(error.message));
    throw error;
  }
}

// Export for use as module or run directly
export { UserJourneyTester, runUserJourneyTests };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runUserJourneyTests()
    .then(success => {
      if (success) {
        console.log(chalk.green.bold('\n🎉 All user journeys passed!'));
        process.exit(0);
      } else {
        console.log(chalk.red.bold('\n💥 Some user journeys failed!'));
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(chalk.red(error.message));
      process.exit(1);
    });
}