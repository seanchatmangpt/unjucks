#!/usr/bin/env node

/**
 * Comprehensive CLI Validation Test Suite
 * Tests all core CLI commands end-to-end
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CLIValidator {
  constructor() {
    this.results = {
      version: null,
      help: null,
      list: null,
      generate: null,
      errors: null,
      summary: null
    };
    this.errors = [];
    this.successes = [];
  }

  async runCommand(cmd, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        cwd: path.resolve(__dirname, '../..'),
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          code,
          stdout,
          stderr,
          success: code === 0
        });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  async testVersionCommand() {
    console.log('📋 Testing: unjucks --version');
    
    try {
      const result = await this.runCommand('node', ['src/cli/index.js', '--version']);
      
      if (result.success && result.stdout.trim().match(/^\d+\.\d+\.\d+$/)) {
        this.successes.push('✅ --version: Shows valid version number');
        this.results.version = {
          success: true,
          output: result.stdout.trim(),
          message: 'Version command works correctly'
        };
      } else {
        this.errors.push('❌ --version: Invalid version format or failed');
        this.results.version = {
          success: false,
          output: result.stdout + result.stderr,
          message: 'Version command failed'
        };
      }
    } catch (error) {
      this.errors.push(`❌ --version: Command execution failed: ${error.message}`);
      this.results.version = {
        success: false,
        error: error.message,
        message: 'Version command execution failed'
      };
    }
  }

  async testHelpCommand() {
    console.log('📋 Testing: unjucks --help');
    
    try {
      const result = await this.runCommand('node', ['src/cli/index.js', '--help']);
      
      if (result.success && result.stdout.includes('Unjucks CLI') && result.stdout.includes('Usage:')) {
        this.successes.push('✅ --help: Shows help text with usage info');
        this.results.help = {
          success: true,
          message: 'Help command works correctly',
          hasUsage: result.stdout.includes('Usage:'),
          hasCommands: result.stdout.includes('COMMANDS:')
        };
      } else {
        this.errors.push('❌ --help: Missing help text or usage info');
        this.results.help = {
          success: false,
          output: result.stdout + result.stderr,
          message: 'Help command failed'
        };
      }
    } catch (error) {
      this.errors.push(`❌ --help: Command execution failed: ${error.message}`);
      this.results.help = {
        success: false,
        error: error.message,
        message: 'Help command execution failed'
      };
    }
  }

  async testListCommand() {
    console.log('📋 Testing: unjucks list');
    
    try {
      const result = await this.runCommand('node', ['src/cli/index.js', 'list']);
      
      if (result.success && result.stdout.includes('Found') && result.stdout.includes('generators')) {
        this.successes.push('✅ list: Shows available generators');
        this.results.list = {
          success: true,
          message: 'List command works correctly',
          generatorCount: (result.stdout.match(/Found (\d+) generators/) || [])[1]
        };
      } else {
        this.errors.push('❌ list: Failed to list generators');
        this.results.list = {
          success: false,
          output: result.stdout + result.stderr,
          message: 'List command failed'
        };
      }
    } catch (error) {
      this.errors.push(`❌ list: Command execution failed: ${error.message}`);
      this.results.list = {
        success: false,
        error: error.message,
        message: 'List command execution failed'
      };
    }
  }

  async testGenerateCommand() {
    console.log('📋 Testing: unjucks generate with dry run');
    
    try {
      // Test with a simple generator that should exist
      const result = await this.runCommand('node', [
        'src/cli/index.js', 
        'generate', 
        'test', 
        'basic', 
        '--name', 
        'CLITest',
        '--dest', 
        'tests/cli-temp',
        '--dry'
      ]);
      
      if (result.stdout.includes('Dry Run Results') || result.stdout.includes('Analysis completed')) {
        this.successes.push('✅ generate: Dry run works correctly');
        this.results.generate = {
          success: true,
          message: 'Generate command dry run works',
          isDryRun: true,
          createdFiles: result.stdout.includes('Would create')
        };
      } else {
        this.errors.push('❌ generate: Dry run failed');
        this.results.generate = {
          success: false,
          output: result.stdout + result.stderr,
          message: 'Generate command dry run failed'
        };
      }
    } catch (error) {
      this.errors.push(`❌ generate: Command execution failed: ${error.message}`);
      this.results.generate = {
        success: false,
        error: error.message,
        message: 'Generate command execution failed'
      };
    }
  }

  async testErrorHandling() {
    console.log('📋 Testing: Error handling for invalid commands');
    
    try {
      const result = await this.runCommand('node', ['src/cli/index.js', 'invalid-command-test']);
      
      if (!result.success && (result.stderr.includes('Unknown command') || result.stdout.includes('Unknown command'))) {
        this.successes.push('✅ Error handling: Shows appropriate error for invalid commands');
        this.results.errors = {
          success: true,
          message: 'Error handling works correctly',
          showsUnknownCommand: true
        };
      } else {
        this.errors.push('❌ Error handling: Does not show appropriate error for invalid commands');
        this.results.errors = {
          success: false,
          output: result.stdout + result.stderr,
          message: 'Error handling failed'
        };
      }
    } catch (error) {
      this.errors.push(`❌ Error handling: Command execution failed: ${error.message}`);
      this.results.errors = {
        success: false,
        error: error.message,
        message: 'Error handling test failed'
      };
    }
  }

  async validateAll() {
    console.log('🚀 Starting comprehensive CLI validation...\n');
    
    // Run all tests
    await this.testVersionCommand();
    await this.testHelpCommand();
    await this.testListCommand();
    await this.testGenerateCommand();
    await this.testErrorHandling();
    
    // Generate summary
    this.results.summary = {
      totalTests: 5,
      successes: this.successes.length,
      errors: this.errors.length,
      successRate: Math.round((this.successes.length / (this.successes.length + this.errors.length)) * 100),
      timestamp: new Date().toISOString()
    };
    
    // Display results
    this.displayResults();
    
    return this.results;
  }

  displayResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CLI VALIDATION RESULTS');
    console.log('='.repeat(60));
    
    console.log('\n✅ SUCCESSES:');
    if (this.successes.length === 0) {
      console.log('  None');
    } else {
      this.successes.forEach(success => console.log(`  ${success}`));
    }
    
    console.log('\n❌ FAILURES:');
    if (this.errors.length === 0) {
      console.log('  None');
    } else {
      this.errors.forEach(error => console.log(`  ${error}`));
    }
    
    const summary = this.results.summary;
    console.log('\n📈 SUMMARY:');
    console.log(`  Total Tests: ${summary.totalTests}`);
    console.log(`  Successes: ${summary.successes}`);
    console.log(`  Failures: ${summary.errors}`);
    console.log(`  Success Rate: ${summary.successRate}%`);
    
    if (summary.successRate >= 80) {
      console.log('\n🎉 CLI validation PASSED - Core functionality working');
    } else {
      console.log('\n⚠️  CLI validation FAILED - Critical issues found');
    }
    
    console.log('\n' + '='.repeat(60));
  }

  async saveResults() {
    const resultsFile = path.resolve(__dirname, 'validation-results.json');
    await fs.writeFile(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Results saved to: ${resultsFile}`);
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new CLIValidator();
  
  try {
    const results = await validator.validateAll();
    await validator.saveResults();
    
    // Exit with appropriate code
    process.exit(results.summary.successRate >= 80 ? 0 : 1);
  } catch (error) {
    console.error('❌ Validation script failed:', error.message);
    process.exit(1);
  }
}

export { CLIValidator };