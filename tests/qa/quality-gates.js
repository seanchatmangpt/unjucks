#!/usr/bin/env node

/**
 * Quality Gates Framework
 * Automated checks that must pass before code can be merged
 */

import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

class QualityGate {
  constructor(name, description, command, threshold = null) {
    this.name = name;
    this.description = description;
    this.command = command;
    this.threshold = threshold;
    this.result = null;
    this.passed = false;
    this.duration = 0;
  }

  async execute() {
    const startTime = Date.now();
    console.log(`\n🔍 Running ${this.name}...`);
    console.log(`   ${this.description}`);

    try {
      const result = await this.runCommand();
      this.result = result;
      this.duration = Date.now() - startTime;
      
      this.passed = this.validateResult(result);
      
      if (this.passed) {
        console.log(`   ✅ PASSED (${this.duration}ms)`);
      } else {
        console.log(`   ❌ FAILED (${this.duration}ms)`);
        if (this.threshold) {
          console.log(`   📊 Threshold: ${this.threshold}, Actual: ${result.metric}`);
        }
      }
      
      return this.passed;
    } catch (error) {
      this.duration = Date.now() - startTime;
      console.log(`   💥 ERROR: ${error.message}`);
      return false;
    }
  }

  runCommand() {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = this.command.split(' ');
      const process = spawn(cmd, args, { 
        cwd: projectRoot,
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ code, stdout, stderr, metric: this.extractMetric(stdout) });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', reject);
    });
  }

  extractMetric(output) {
    // Extract coverage percentage, test count, etc.
    const coverageMatch = output.match(/([0-9.]+)%.*coverage/i);
    if (coverageMatch) return parseFloat(coverageMatch[1]);
    
    const testMatch = output.match(/([0-9]+)\s+passing/i);
    if (testMatch) return parseInt(testMatch[1]);
    
    return null;
  }

  validateResult(result) {
    if (this.threshold && result.metric !== null) {
      return result.metric >= this.threshold;
    }
    return result.code === 0;
  }
}

// Define quality gates
const qualityGates = [
  new QualityGate(
    'Unit Tests',
    'All unit tests must pass',
    'npm test'
  ),
  
  new QualityGate(
    'Code Coverage',
    'Code coverage must be >= 80%',
    'npm run test:coverage',
    80
  ),
  
  new QualityGate(
    'Linting',
    'Code must pass linting rules',
    'npm run lint'
  ),
  
  new QualityGate(
    'Security Scan',
    'No high or critical security vulnerabilities',
    'npm run security:scan'
  ),
  
  new QualityGate(
    'Build Validation',
    'Project must build successfully',
    'npm run build'
  ),
  
  new QualityGate(
    'CLI Smoke Tests',
    'CLI commands must execute without errors',
    'npm run test:smoke'
  ),
  
  new QualityGate(
    'Integration Tests',
    'Integration tests must pass',
    'npm run test:integration'
  )
];

async function runQualityGates() {
  console.log('🚀 Running Quality Gates\n');
  console.log('=' * 50);
  
  const startTime = Date.now();
  const results = [];
  let failedGates = 0;
  
  for (const gate of qualityGates) {
    const passed = await gate.execute();
    results.push({
      name: gate.name,
      passed,
      duration: gate.duration,
      metric: gate.result?.metric
    });
    
    if (!passed) {
      failedGates++;
    }
  }
  
  const totalTime = Date.now() - startTime;
  
  // Generate report
  console.log('\n📊 Quality Gates Summary');
  console.log('=' * 50);
  
  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    const metric = result.metric ? ` (${result.metric})` : '';
    console.log(`${status} ${result.name}${metric} - ${result.duration}ms`);
  });
  
  console.log(`\n⏱️  Total execution time: ${totalTime}ms`);
  console.log(`📈 Gates passed: ${results.length - failedGates}/${results.length}`);
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    totalGates: results.length,
    passedGates: results.length - failedGates,
    failedGates,
    totalDuration: totalTime,
    gates: results,
    status: failedGates === 0 ? 'PASSED' : 'FAILED'
  };
  
  await fs.ensureDir(path.join(projectRoot, 'tests/reports'));
  await fs.writeJSON(
    path.join(projectRoot, 'tests/reports/quality-gates.json'),
    report,
    { spaces: 2 }
  );
  
  if (failedGates === 0) {
    console.log('\n🎉 All quality gates passed! Code is ready for deployment.');
    process.exit(0);
  } else {
    console.log('\n💥 Quality gates failed. Please fix issues before proceeding.');
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${__filename}`) {
  runQualityGates().catch(error => {
    console.error('Quality gate execution failed:', error);
    process.exit(1);
  });
}

export { QualityGate, runQualityGates };
