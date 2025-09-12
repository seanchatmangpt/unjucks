#!/usr/bin/env node

/**
 * KGEN Smoke Test 01: CLI Import & Help Command
 * 
 * Tests:
 * - Can import CLI binary without runtime errors
 * - Can execute `kgen --help` successfully
 * - Basic CLI infrastructure is functional
 */

import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
const kgenBinary = join(projectRoot, 'bin/kgen.mjs');

class CLIImportTest {
  constructor() {
    this.testName = 'CLI Import & Help Command';
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  log(message) {
    console.log(`[CLI-IMPORT] ${message}`);
  }

  error(message, error) {
    console.error(`[CLI-IMPORT] ❌ ${message}`);
    if (error) {
      console.error(`   Error: ${error.message || error}`);
    }
    this.errors.push({ message, error: error?.message || error });
    this.failed++;
  }

  success(message) {
    console.log(`[CLI-IMPORT] ✅ ${message}`);
    this.passed++;
  }

  async testBinaryExists() {
    try {
      const fs = await import('fs');
      if (!fs.existsSync(kgenBinary)) {
        this.error('KGEN binary does not exist', new Error(`File not found: ${kgenBinary}`));
        return false;
      }
      
      const stats = fs.statSync(kgenBinary);
      if (!stats.isFile()) {
        this.error('KGEN binary is not a file', new Error('Path exists but is not a file'));
        return false;
      }

      // Check if executable
      try {
        fs.accessSync(kgenBinary, fs.constants.X_OK);
        this.success('KGEN binary exists and is executable');
        return true;
      } catch (err) {
        this.error('KGEN binary is not executable', err);
        return false;
      }
    } catch (err) {
      this.error('Failed to check binary existence', err);
      return false;
    }
  }

  async testBasicImport() {
    try {
      this.log('Testing basic Node.js import...');
      
      // Test if we can spawn the process without immediate crash
      const child = spawn('node', [kgenBinary, '--version'], {
        stdio: 'pipe',
        timeout: 5000
      });

      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const exitCode = await new Promise((resolve) => {
        child.on('close', resolve);
        child.on('error', () => resolve(-1));
      });

      if (exitCode === 0) {
        this.success('Basic import successful (--version worked)');
        if (stdout.trim()) {
          this.log(`Version output: ${stdout.trim()}`);
        }
        return true;
      } else {
        this.error('Basic import failed', new Error(`Exit code: ${exitCode}, stderr: ${stderr}`));
        return false;
      }
    } catch (err) {
      this.error('Exception during basic import test', err);
      return false;
    }
  }

  async testHelpCommand() {
    try {
      this.log('Testing --help command...');
      
      const child = spawn('node', [kgenBinary, '--help'], {
        stdio: 'pipe',
        timeout: 5000
      });

      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const exitCode = await new Promise((resolve) => {
        child.on('close', resolve);
        child.on('error', () => resolve(-1));
      });

      if (exitCode === 0 && stdout.includes('KGEN')) {
        this.success('Help command successful');
        this.log(`Help output preview: ${stdout.substring(0, 100)}...`);
        return true;
      } else {
        this.error('Help command failed', new Error(`Exit code: ${exitCode}, stderr: ${stderr}`));
        return false;
      }
    } catch (err) {
      this.error('Exception during help command test', err);
      return false;
    }
  }

  async testListCommand() {
    try {
      this.log('Testing list command (should not crash)...');
      
      const child = spawn('node', [kgenBinary, 'list'], {
        stdio: 'pipe',
        timeout: 5000
      });

      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const exitCode = await new Promise((resolve) => {
        child.on('close', resolve);
        child.on('error', () => resolve(-1));
      });

      // Accept any exit code as long as it doesn't crash with import errors
      if (stderr.includes('Cannot find module') || stderr.includes('Error: Cannot resolve module')) {
        this.error('List command has import/module resolution errors', new Error(stderr));
        return false;
      } else {
        this.success(`List command executed without import errors (exit code: ${exitCode})`);
        if (stdout) {
          this.log(`List output: ${stdout.substring(0, 200)}...`);
        }
        return true;
      }
    } catch (err) {
      this.error('Exception during list command test', err);
      return false;
    }
  }

  async runTests() {
    console.log('🚀 Starting KGEN CLI Import Smoke Tests...\n');
    
    const binaryExists = await this.testBinaryExists();
    if (!binaryExists) {
      return this.generateReport();
    }
    
    await this.testBasicImport();
    await this.testHelpCommand();
    await this.testListCommand();
    
    return this.generateReport();
  }

  generateReport() {
    console.log('\n📊 CLI Import Test Results:');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%`);
    
    if (this.errors.length > 0) {
      console.log('\n🚨 Errors Found:');
      this.errors.forEach((err, i) => {
        console.log(`${i + 1}. ${err.message}`);
        if (err.error) {
          console.log(`   ${err.error}`);
        }
      });
    }
    
    const success = this.failed === 0;
    console.log(`\n${success ? '🎉 All CLI import tests passed!' : '⚠️ Some CLI import tests failed'}`);
    
    return {
      testName: this.testName,
      passed: this.passed,
      failed: this.failed,
      success,
      errors: this.errors
    };
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new CLIImportTest();
  const result = await tester.runTests();
  process.exit(result.success ? 0 : 1);
}

export default CLIImportTest;