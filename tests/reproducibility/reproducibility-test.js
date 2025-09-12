/**
 * Reproducibility Test Suite for KGEN
 * 
 * This test suite validates that KGEN produces byte-identical outputs
 * across multiple runs and different machines.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { getDeterministicEngine, resetDeterministicEngine } from '../../src/reproducibility/deterministic-engine.js';
import { LockFileHardener } from '../../src/reproducibility/lock-file-hardener.js';
import { CodePatcher } from '../../src/reproducibility/code-patcher.js';

export class ReproducibilityTestSuite {
  constructor(options = {}) {
    this.testDir = options.testDir || path.join(process.cwd(), 'tests/reproducibility');
    this.outputDir = path.join(this.testDir, 'outputs');
    this.reportsDir = path.join(this.testDir, 'reports');
    this.enableLogging = options.enableLogging || true;
    
    // Ensure test directories exist
    this.ensureDirectories();
  }

  ensureDirectories() {
    for (const dir of [this.testDir, this.outputDir, this.reportsDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Run complete reproducibility test suite
   */
  async runAllTests() {
    console.log('🧪 Starting KGEN Reproducibility Test Suite...\n');

    const results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0
      }
    };

    // Test 1: Deterministic Engine
    results.tests.push(await this.testDeterministicEngine());

    // Test 2: Lock File Hardening
    results.tests.push(await this.testLockFileHardening());

    // Test 3: Code Patching
    results.tests.push(await this.testCodePatching());

    // Test 4: Multiple Build Runs
    results.tests.push(await this.testMultipleBuildRuns());

    // Test 5: Cross-Machine Reproducibility (simulation)
    results.tests.push(await this.testCrossMachineReproducibility());

    // Test 6: Byte-Identical Validation
    results.tests.push(await this.testByteIdenticalValidation());

    // Calculate summary
    results.summary.total = results.tests.length;
    results.summary.passed = results.tests.filter(t => t.passed).length;
    results.summary.failed = results.summary.total - results.summary.passed;

    // Save results
    const reportPath = path.join(this.reportsDir, 'reproducibility-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

    console.log(`\n📊 Test Results:`);
    console.log(`   Total:  ${results.summary.total}`);
    console.log(`   Passed: ${results.summary.passed}`);
    console.log(`   Failed: ${results.summary.failed}`);
    console.log(`   Report: ${reportPath}\n`);

    return results;
  }

  /**
   * Test 1: Deterministic Engine functionality
   */
  async testDeterministicEngine() {
    console.log('🔧 Testing Deterministic Engine...');
    
    try {
      // Reset engine for clean test
      resetDeterministicEngine();
      
      const engine = getDeterministicEngine({ enableLogging: false });
      
      // Test 1a: Timestamp consistency
      const timestamp1 = engine.getDeterministicTimestamp();
      const timestamp2 = engine.getDeterministicTimestamp();
      const timestampConsistent = timestamp1 === timestamp2;

      // Test 1b: UUID determinism
      const uuid1 = engine.generateDeterministicUUID('test-content');
      const uuid2 = engine.generateDeterministicUUID('test-content');
      const uuidDeterministic = uuid1 === uuid2;

      // Test 1c: Random determinism
      const random1 = engine.generateDeterministicRandom('test-seed');
      const random2 = engine.generateDeterministicRandom('test-seed');
      const randomDeterministic = random1 === random2;

      // Test 1d: Different content produces different results
      const uuidA = engine.generateDeterministicUUID('content-A');
      const uuidB = engine.generateDeterministicUUID('content-B');
      const contentDifferentiation = uuidA !== uuidB;

      const passed = timestampConsistent && uuidDeterministic && randomDeterministic && contentDifferentiation;

      return {
        name: 'Deterministic Engine',
        passed,
        details: {
          timestampConsistent,
          uuidDeterministic,
          randomDeterministic,
          contentDifferentiation,
          sampleTimestamp: timestamp1,
          sampleUUID: uuid1,
          sampleRandom: random1
        }
      };

    } catch (error) {
      return {
        name: 'Deterministic Engine',
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Test 2: Lock File Hardening
   */
  async testLockFileHardening() {
    console.log('🔒 Testing Lock File Hardening...');

    try {
      // Create a test lock file with non-deterministic elements
      const testLockPath = path.join(this.outputDir, 'test.lock.json');
      const testLockContent = {
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        directory: ".",
        files: {
          "test-file.txt": {
            hash: "abc123",
            size: 100,
            modified: new Date().toISOString()
          }
        }
      };

      fs.writeFileSync(testLockPath, JSON.stringify(testLockContent, null, 2));

      // Harden the lock file
      const hardener = new LockFileHardener({ enableLogging: false });
      const hardenResult = hardener.hardenLockFile(testLockPath);

      // Validate the hardened file
      const validation = hardener.validateDeterministicLockFile(testLockPath);

      const passed = hardenResult && validation.isDeterministic;

      return {
        name: 'Lock File Hardening',
        passed,
        details: {
          hardenResult,
          validation
        }
      };

    } catch (error) {
      return {
        name: 'Lock File Hardening',
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Test 3: Code Patching
   */
  async testCodePatching() {
    console.log('🔨 Testing Code Patching...');

    try {
      // Create a test file with non-deterministic code
      const testFilePath = path.join(this.outputDir, 'test-code.js');
      const testCode = `
// Test file with non-deterministic patterns
const timestamp = new Date().toISOString();
const randomValue = Math.random();
const dateNow = Date.now();
const randomId = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

export { timestamp, randomValue, dateNow, randomId };
`;

      fs.writeFileSync(testFilePath, testCode);

      // Patch the file
      const patcher = new CodePatcher({ enableLogging: false, dryRun: false });
      const patchResult = patcher.patchFile(testFilePath);

      // Verify patches were applied
      const patchedContent = fs.readFileSync(testFilePath, 'utf8');
      const containsImport = patchedContent.includes('getDeterministicEngine');
      const noDateNow = !patchedContent.includes('new Date().toISOString()');
      const noMathRandom = !patchedContent.includes('Math.random()');

      const passed = patchResult && patchResult.changed && containsImport && noDateNow && noMathRandom;

      return {
        name: 'Code Patching',
        passed,
        details: {
          patchResult,
          containsImport,
          noDateNow,
          noMathRandom,
          patchedLines: patchedContent.split('\n').length
        }
      };

    } catch (error) {
      return {
        name: 'Code Patching',
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Test 4: Multiple Build Runs
   */
  async testMultipleBuildRuns() {
    console.log('🔄 Testing Multiple Build Runs...');

    try {
      const runs = [];
      const numRuns = 3;

      // Simulate multiple build runs
      for (let i = 0; i < numRuns; i++) {
        resetDeterministicEngine();
        
        const engine = getDeterministicEngine({ enableLogging: false });
        const runOutput = {
          timestamp: engine.getDeterministicTimestamp(),
          uuid: engine.generateDeterministicUUID('test'),
          random: engine.generateDeterministicRandom('test'),
          hex: engine.generateDeterministicHex(16, 'test')
        };

        runs.push({
          runNumber: i + 1,
          output: runOutput,
          hash: crypto.createHash('sha256').update(JSON.stringify(runOutput)).digest('hex')
        });
      }

      // Check if all runs produce identical results
      const baselineHash = runs[0].hash;
      const identical = runs.every(run => run.hash === baselineHash);

      return {
        name: 'Multiple Build Runs',
        passed: identical,
        details: {
          numRuns,
          identical,
          baselineHash,
          runs: runs.map(r => ({ runNumber: r.runNumber, hash: r.hash }))
        }
      };

    } catch (error) {
      return {
        name: 'Multiple Build Runs',
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Test 5: Cross-Machine Reproducibility (Simulation)
   */
  async testCrossMachineReproducibility() {
    console.log('🌐 Testing Cross-Machine Reproducibility...');

    try {
      // Simulate different machine environments
      const machines = [
        { name: 'Machine-A', seed: 'test-seed-a' },
        { name: 'Machine-B', seed: 'test-seed-b' },
        { name: 'Machine-Same', seed: 'same-seed' },
        { name: 'Machine-Same-2', seed: 'same-seed' }
      ];

      const results = [];

      for (const machine of machines) {
        resetDeterministicEngine();
        const engine = getDeterministicEngine({ 
          seed: machine.seed,
          enableLogging: false 
        });

        const output = {
          timestamp: engine.getDeterministicTimestamp(),
          uuid: engine.generateDeterministicUUID('test-content'),
          random: engine.generateDeterministicRandom('test-content')
        };

        results.push({
          machine: machine.name,
          seed: machine.seed,
          outputHash: crypto.createHash('sha256').update(JSON.stringify(output)).digest('hex')
        });
      }

      // Machines with same seed should produce identical results
      const sameSeedResults = results.filter(r => r.seed === 'same-seed');
      const sameSeedIdentical = sameSeedResults.length === 2 && 
                                 sameSeedResults[0].outputHash === sameSeedResults[1].outputHash;

      // Machines with different seeds should produce different results
      const differentSeeds = results.filter(r => r.seed !== 'same-seed');
      const differentSeedsDifferent = new Set(differentSeeds.map(r => r.outputHash)).size === differentSeeds.length;

      const passed = sameSeedIdentical && differentSeedsDifferent;

      return {
        name: 'Cross-Machine Reproducibility',
        passed,
        details: {
          sameSeedIdentical,
          differentSeedsDifferent,
          results
        }
      };

    } catch (error) {
      return {
        name: 'Cross-Machine Reproducibility',
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Test 6: Byte-Identical Validation
   */
  async testByteIdenticalValidation() {
    console.log('📊 Testing Byte-Identical Validation...');

    try {
      // Create identical content with deterministic generation
      resetDeterministicEngine();
      const engine = getDeterministicEngine({ enableLogging: false });

      const content1 = JSON.stringify({
        timestamp: engine.getDeterministicTimestamp(),
        uuid: engine.generateDeterministicUUID('content'),
        data: 'test-data'
      }, null, 2);

      // Reset and recreate
      resetDeterministicEngine();
      const engine2 = getDeterministicEngine({ enableLogging: false });

      const content2 = JSON.stringify({
        timestamp: engine2.getDeterministicTimestamp(),
        uuid: engine2.generateDeterministicUUID('content'),
        data: 'test-data'
      }, null, 2);

      // Hash comparison
      const hash1 = crypto.createHash('sha256').update(content1).digest('hex');
      const hash2 = crypto.createHash('sha256').update(content2).digest('hex');

      const byteIdentical = hash1 === hash2;
      const lengthIdentical = content1.length === content2.length;
      const contentIdentical = content1 === content2;

      const passed = byteIdentical && lengthIdentical && contentIdentical;

      return {
        name: 'Byte-Identical Validation',
        passed,
        details: {
          byteIdentical,
          lengthIdentical,
          contentIdentical,
          hash1,
          hash2,
          length1: content1.length,
          length2: content2.length
        }
      };

    } catch (error) {
      return {
        name: 'Byte-Identical Validation',
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Generate hash of a file or directory
   */
  generateDirectoryHash(directory) {
    const files = [];
    
    const scanRecursive = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isFile()) {
          const content = fs.readFileSync(fullPath);
          files.push({
            path: path.relative(directory, fullPath),
            hash: crypto.createHash('sha256').update(content).digest('hex')
          });
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          scanRecursive(fullPath);
        }
      }
    };

    scanRecursive(directory);
    
    // Sort files for consistent ordering
    files.sort((a, b) => a.path.localeCompare(b.path));
    
    // Create combined hash
    const combined = files.map(f => `${f.path}:${f.hash}`).join('\n');
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Clean up test artifacts
   */
  cleanup() {
    try {
      if (fs.existsSync(this.outputDir)) {
        fs.rmSync(this.outputDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }
}

// Export convenience function
export async function runReproducibilityTests(options = {}) {
  const suite = new ReproducibilityTestSuite(options);
  const results = await suite.runAllTests();
  
  if (!options.keepArtifacts) {
    suite.cleanup();
  }
  
  return results;
}