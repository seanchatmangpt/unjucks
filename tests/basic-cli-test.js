#!/usr/bin/env node

/**
 * Basic KGEN JSON CLI Test
 * 
 * Tests core functionality of the JSON-only CLI interface
 * without complex schema validation for immediate validation.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Basic CLI functionality test
 */
class BasicCLITest {
  constructor() {
    this.jsonCLIPath = path.resolve(__dirname, '../bin/kgen-json.mjs');
    this.hybridCLIPath = path.resolve(__dirname, '../bin/kgen-hybrid.mjs');
  }

  /**
   * Execute CLI command and capture output
   */
  async executeCommand(command, args = []) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [command, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Test JSON CLI health check
   */
  async testJSONHealth() {
    console.log('Testing JSON CLI health check...');
    
    try {
      const result = await this.executeCommand(this.jsonCLIPath, ['health']);
      
      if (result.code !== 0) {
        console.log('❌ Health check failed with exit code:', result.code);
        console.log('STDERR:', result.stderr);
        return false;
      }

      // Try to parse JSON response
      const response = JSON.parse(result.stdout);
      
      const checks = [
        response.success === true,
        response.operation === 'system:health',
        response.timestamp !== undefined,
        response.metadata !== undefined,
        response.metadata.traceId !== undefined
      ];

      const passed = checks.every(check => check);
      console.log(`${passed ? '✅' : '❌'} JSON CLI health check`);
      
      if (!passed) {
        console.log('Failed checks:', checks);
        console.log('Response:', JSON.stringify(response, null, 2));
      }

      return passed;
      
    } catch (error) {
      console.log('❌ Health check error:', error.message);
      return false;
    }
  }

  /**
   * Test schema information
   */
  async testSchemaInfo() {
    console.log('Testing schema information...');
    
    try {
      const result = await this.executeCommand(this.jsonCLIPath, ['schema', 'list']);
      
      if (result.code !== 0) {
        console.log('❌ Schema list failed with exit code:', result.code);
        return false;
      }

      const response = JSON.parse(result.stdout);
      
      const checks = [
        response.success === true,
        response.operation === 'schema:list',
        Array.isArray(response.schemas),
        response.count >= 0
      ];

      const passed = checks.every(check => check);
      console.log(`${passed ? '✅' : '❌'} Schema list functionality`);
      
      return passed;
      
    } catch (error) {
      console.log('❌ Schema info error:', error.message);
      return false;
    }
  }

  /**
   * Test hybrid CLI auto-detection
   */
  async testHybridAutoDetection() {
    console.log('Testing hybrid CLI auto-detection...');
    
    try {
      // Test JSON format explicitly
      const jsonResult = await this.executeCommand(this.hybridCLIPath, ['--json', 'health']);
      
      if (jsonResult.code !== 0) {
        console.log('❌ Hybrid JSON mode failed');
        return false;
      }

      // Should be valid JSON
      const jsonResponse = JSON.parse(jsonResult.stdout);
      const jsonValid = jsonResponse.success === true && jsonResponse.operation === 'system:health';
      
      console.log(`${jsonValid ? '✅' : '❌'} Hybrid CLI JSON mode`);
      
      return jsonValid;
      
    } catch (error) {
      console.log('❌ Hybrid CLI error:', error.message);
      return false;
    }
  }

  /**
   * Test performance requirements
   */
  async testBasicPerformance() {
    console.log('Testing basic performance requirements...');
    
    try {
      const iterations = 5;
      const measurements = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = this.getDeterministicTimestamp();
        const result = await this.executeCommand(this.jsonCLIPath, ['health']);
        const end = this.getDeterministicTimestamp();
        
        if (result.code === 0) {
          measurements.push(end - start);
        }
      }
      
      if (measurements.length === 0) {
        console.log('❌ No successful health checks for performance test');
        return false;
      }
      
      const avgTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const maxTime = Math.max(...measurements);
      
      // Basic performance check - should be under 1000ms for health check
      const performanceOk = avgTime < 1000 && maxTime < 2000;
      
      console.log(`${performanceOk ? '✅' : '❌'} Basic performance (avg: ${avgTime.toFixed(0)}ms, max: ${maxTime}ms)`);
      
      return performanceOk;
      
    } catch (error) {
      console.log('❌ Performance test error:', error.message);
      return false;
    }
  }

  /**
   * Test exit codes
   */
  async testExitCodes() {
    console.log('Testing exit codes...');
    
    try {
      // Test successful command
      const successResult = await this.executeCommand(this.jsonCLIPath, ['health']);
      const successExitCode = successResult.code === 0;
      
      // Test invalid command
      const errorResult = await this.executeCommand(this.jsonCLIPath, ['nonexistent', 'command']);
      const errorExitCode = errorResult.code !== 0;
      
      const passed = successExitCode && errorExitCode;
      console.log(`${passed ? '✅' : '❌'} Exit codes (success: ${successResult.code}, error: ${errorResult.code})`);
      
      return passed;
      
    } catch (error) {
      console.log('❌ Exit code test error:', error.message);
      return false;
    }
  }

  /**
   * Run all basic tests
   */
  async runAllTests() {
    console.log('🚀 Starting Basic KGEN CLI Tests...\n');
    
    const tests = [
      { name: 'JSON CLI Health Check', fn: () => this.testJSONHealth() },
      { name: 'Schema Information', fn: () => this.testSchemaInfo() },
      { name: 'Hybrid CLI Auto-detection', fn: () => this.testHybridAutoDetection() },
      { name: 'Basic Performance', fn: () => this.testBasicPerformance() },
      { name: 'Exit Codes', fn: () => this.testExitCodes() }
    ];

    const results = [];
    
    for (const test of tests) {
      try {
        const result = await test.fn();
        results.push({ name: test.name, passed: result });
      } catch (error) {
        console.log(`❌ ${test.name} failed with error:`, error.message);
        results.push({ name: test.name, passed: false, error: error.message });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('BASIC CLI TEST RESULTS');
    console.log('='.repeat(50));
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    results.forEach(result => {
      console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log('='.repeat(50));
    console.log(`SUMMARY: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All basic tests passed!');
      return true;
    } else {
      console.log('⚠️  Some tests failed. Check implementation.');
      return false;
    }
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = new BasicCLITest();
  tests.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test execution failed:', error.message);
    process.exit(1);
  });
}

export default BasicCLITest;