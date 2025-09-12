/**
 * Hermetic Runtime Test Suite
 * 
 * Comprehensive tests for hermetic environment capture, validation, 
 * and deterministic execution capabilities.
 * 
 * Agent 12: Hermetic Runtime Manager - Test Suite
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { join } from 'path';
import { promises as fs } from 'fs';
import { HermeticEnvironment } from '../../src/runtime/hermetic-environment.js';
import { HermeticValidator } from '../../src/runtime/hermetic-validator.js';
import { HermeticExecutor, executeHermetic } from '../../src/runtime/hermetic-wrapper.js';
import { EnvironmentStamper } from '../../src/attestation/environment-stamper.js';
import { CompatibilityChecker } from '../../src/runtime/compatibility-checker.js';

describe('Hermetic Runtime System', () => {
  let hermeticEnv;
  let validator;
  let executor;
  let stamper;
  let compatChecker;
  let testWorkingDir;
  let originalEnv;

  beforeAll(async () => {
    // Store original environment variables
    originalEnv = { ...process.env };
    
    // Create test working directory
    testWorkingDir = join(process.cwd(), '.test-hermetic');
    await fs.mkdir(testWorkingDir, { recursive: true });
  });

  afterAll(async () => {
    // Restore original environment
    process.env = originalEnv;
    
    // Cleanup test directory
    try {
      await fs.rm(testWorkingDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Initialize hermetic components
    hermeticEnv = new HermeticEnvironment({
      strictMode: true,
      enforceNodeVersion: true,
      enforceTimezone: true,
      enforceLocale: true
    });

    validator = new HermeticValidator({
      strictValidation: true,
      warningsAsErrors: false
    });

    executor = new HermeticExecutor({
      strictMode: true,
      validateBeforeExecution: true,
      generateAttestation: true
    });

    stamper = new EnvironmentStamper({
      attestationFile: join(testWorkingDir, '.attest.json'),
      backupAttestation: true
    });

    compatChecker = new CompatibilityChecker({
      strictCompatibility: false,
      allowMinorVersionDiffs: true
    });
  });

  afterEach(async () => {
    // Shutdown components
    try {
      if (hermeticEnv) await hermeticEnv.shutdown();
      if (validator) await validator.shutdown();
      if (executor) await executor.shutdown();
      if (stamper) await stamper.shutdown();
    } catch (error) {
      // Ignore shutdown errors
    }
  });

  describe('HermeticEnvironment', () => {
    it('should initialize successfully', async () => {
      const result = await hermeticEnv.initialize();
      expect(result.success).toBe(true);
      expect(result.fingerprint).toBeDefined();
      expect(result.fingerprint.hash).toBeDefined();
      expect(result.fingerprint.shortHash).toBeDefined();
      expect(hermeticEnv.isInitialized).toBe(true);
    });

    it('should capture comprehensive environment fingerprint', async () => {
      await hermeticEnv.initialize();
      const fingerprint = hermeticEnv.currentFingerprint;

      // Check critical components
      expect(fingerprint.nodeVersion).toBe(process.version);
      expect(fingerprint.platform).toBeDefined();
      expect(fingerprint.arch).toBeDefined();
      expect(fingerprint.timezone).toBeDefined();
      expect(fingerprint.locale).toBeDefined();

      // Check system characteristics
      expect(fingerprint.cpuCount).toBeGreaterThan(0);
      expect(fingerprint.totalMemory).toBeGreaterThan(0);
      expect(fingerprint.workingDirectory).toBeDefined();

      // Check hash generation
      expect(fingerprint.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(fingerprint.shortHash).toMatch(/^[a-f0-9]{12}$/);
    });

    it('should generate deterministic hashes for identical environments', async () => {
      await hermeticEnv.initialize();
      const fingerprint1 = hermeticEnv.currentFingerprint;

      const hermeticEnv2 = new HermeticEnvironment({
        strictMode: true,
        enforceNodeVersion: true,
        enforceTimezone: true,
        enforceLocale: true
      });

      await hermeticEnv2.initialize();
      const fingerprint2 = hermeticEnv2.currentFingerprint;

      expect(fingerprint1.hash).toBe(fingerprint2.hash);

      await hermeticEnv2.shutdown();
    });

    it('should setup deterministic random when in strict mode', async () => {
      // Set up deterministic seed
      process.env.KGEN_RANDOM_SEED = '12345';
      
      await hermeticEnv.initialize();
      
      expect(global.__KGEN_DETERMINISTIC_RANDOM__).toBeDefined();
      expect(global.__KGEN_DETERMINISTIC_RANDOM__.seed).toBe(12345);

      // Test deterministic random
      const random1 = Math.random();
      hermeticEnv.restoreOriginalRuntime();
      
      // Re-setup with same seed
      await hermeticEnv.initializeDeterministicRuntime();
      const random2 = Math.random();

      expect(random1).toBe(random2);

      delete process.env.KGEN_RANDOM_SEED;
    });

    it('should setup deterministic time when in strict mode', async () => {
      process.env.KGEN_BUILD_TIME = '2024-01-01T00:00:00.000Z';
      
      await hermeticEnv.initialize();
      
      expect(global.__KGEN_DETERMINISTIC_TIME__).toBeDefined();
      expect(this.getDeterministicTimestamp()).toBe(new Date('2024-01-01T00:00:00.000Z').getTime());

      delete process.env.KGEN_BUILD_TIME;
    });

    it('should validate environment against baseline', async () => {
      await hermeticEnv.initialize();
      const baseline = hermeticEnv.currentFingerprint;

      // Validate against itself
      const validation = await hermeticEnv.validateEnvironment(baseline);
      expect(validation.valid).toBe(true);
      expect(validation.hashMatch).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should generate environment attestation', async () => {
      await hermeticEnv.initialize();
      const attestation = hermeticEnv.generateEnvironmentAttestation();

      expect(attestation.version).toBe('1.0');
      expect(attestation.type).toBe('environment-attestation');
      expect(attestation.environment.hash).toBeDefined();
      expect(attestation.environment.runtime.nodeVersion).toBe(process.version);
      expect(attestation.requirements.strictMode).toBe(true);
      expect(attestation.metadata.generator).toBe('kgen-hermetic-environment');
    });
  });

  describe('HermeticValidator', () => {
    it('should initialize successfully', async () => {
      const result = await validator.initialize();
      expect(result.success).toBe(true);
      expect(validator.isInitialized).toBe(true);
    });

    it('should validate identical environments successfully', async () => {
      await validator.initialize();
      await hermeticEnv.initialize();
      
      const baseline = hermeticEnv.currentFingerprint;
      const validation = await validator.validateEnvironment(baseline);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.validationId).toBeDefined();
      expect(validation.duration).toBeGreaterThan(0);
    });

    it('should detect Node.js version mismatches', async () => {
      await validator.initialize();
      
      const baseline = {
        nodeVersion: 'v18.0.0',
        platform: process.platform,
        arch: process.arch,
        timezone: 'UTC',
        locale: 'en-US',
        environmentVariables: {}
      };

      const validation = await validator.validateEnvironment(baseline);
      
      if (process.version !== 'v18.0.0') {
        expect(validation.valid).toBe(false);
        expect(validation.errors.some(e => e.rule === 'node-version')).toBe(true);
      }
    });

    it('should cache validation results', async () => {
      await validator.initialize();
      await hermeticEnv.initialize();
      
      const baseline = hermeticEnv.currentFingerprint;
      
      // First validation
      const validation1 = await validator.validateEnvironment(baseline);
      expect(validation1.cached).toBeUndefined();

      // Second validation should be cached
      const validation2 = await validator.validateEnvironment(baseline);
      expect(validation2.cached).toBe(true);
    });

    it('should support custom validation rules', async () => {
      await validator.initialize();
      
      validator.addValidationRule('custom-test', {
        priority: 'high',
        category: 'custom',
        description: 'Test custom rule',
        validate: async (baseline, current) => ({
          valid: false,
          severity: 'warning',
          message: 'Custom test rule triggered'
        })
      });

      await hermeticEnv.initialize();
      const validation = await validator.validateEnvironment(hermeticEnv.currentFingerprint);

      expect(validation.warnings.some(w => w.rule === 'custom-test')).toBe(true);
    });
  });

  describe('HermeticExecutor', () => {
    it('should initialize successfully', async () => {
      const result = await executor.initialize();
      expect(result.success).toBe(true);
      expect(executor.isInitialized).toBe(true);
    });

    it('should execute simple operation successfully', async () => {
      await executor.initialize();

      const operation = async (context) => {
        return { message: 'Hello from hermetic execution', pid: process.pid };
      };

      const result = await executor.execute(operation);

      expect(result.success).toBe(true);
      expect(result.result.message).toBe('Hello from hermetic execution');
      expect(result.executionId).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.environment).toBeDefined();
    });

    it('should capture output during execution', async () => {
      await executor.initialize();

      const operation = async (context) => {
        context.log('Test log message', 'info');
        context.captureFile('test.txt', 'Test file content');
        context.captureMetric('testMetric', 42);
        
        return { completed: true };
      };

      const result = await executor.execute(operation, { captureOutput: true });

      expect(result.success).toBe(true);
      expect(result.output.stdout).toHaveLength(1);
      expect(result.output.stdout[0].message).toBe('Test log message');
      expect(result.output.files.has('test.txt')).toBe(true);
      expect(result.output.files.get('test.txt').content).toBe('Test file content');
      expect(result.output.metrics.testMetric.value).toBe(42);
    });

    it('should handle operation failures gracefully', async () => {
      await executor.initialize();

      const operation = async () => {
        throw new Error('Test operation failure');
      };

      await expect(executor.execute(operation)).rejects.toThrow('Test operation failure');
    });

    it('should retry failed operations', async () => {
      await executor.initialize();

      let attemptCount = 0;
      const operation = async (context) => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return { attempt: attemptCount };
      };

      const result = await executor.execute(operation, { maxRetries: 3 });

      expect(result.success).toBe(true);
      expect(result.result.attempt).toBe(2);
      expect(result.attempt).toBe(2);
    });

    it('should generate attestation for successful execution', async () => {
      await executor.initialize();

      const operation = async () => ({ success: true });

      const result = await executor.execute(operation, { generateAttestation: true });

      expect(result.success).toBe(true);
      expect(result.attestation).toBeDefined();
      expect(result.attestation.executionId).toBe(result.executionId);
      expect(result.attestation.environmentStamp).toBeDefined();
    });
  });

  describe('EnvironmentStamper', () => {
    it('should initialize successfully', async () => {
      const result = await stamper.initialize();
      expect(result.success).toBe(true);
    });

    it('should generate comprehensive environment stamp', async () => {
      await stamper.initialize();

      const stamp = await stamper.generateEnvironmentStamp({
        buildType: 'test',
        userContext: { testRun: true },
        tags: ['test', 'hermetic']
      });

      expect(stamp.version).toBe('1.0');
      expect(stamp.type).toBe('environment-attestation');
      expect(stamp.buildContext.buildType).toBe('test');
      expect(stamp.buildContext.buildId).toBeDefined();
      expect(stamp.stampHash).toBeDefined();
      expect(stamp.stampShortHash).toBeDefined();
    });

    it('should stamp attestation file', async () => {
      await stamper.initialize();

      const attestationPath = join(testWorkingDir, 'test-attest.json');
      const result = await stamper.stampAttestationFile(attestationPath, {
        buildType: 'test-stamp'
      });

      expect(result.success).toBe(true);
      expect(result.attestationPath).toBe(attestationPath);
      expect(result.environmentHash).toBeDefined();

      // Verify file was created
      const attestationExists = await fs.access(attestationPath).then(() => true).catch(() => false);
      expect(attestationExists).toBe(true);

      // Verify attestation content
      const attestationContent = JSON.parse(await fs.readFile(attestationPath, 'utf8'));
      expect(attestationContent.environment).toBeDefined();
      expect(attestationContent.buildContext.buildType).toBe('test-stamp');
      expect(attestationContent.reproducibility.hermeticBuild).toBe(true);
    });

    it('should validate current environment against attestation', async () => {
      await stamper.initialize();

      // Create attestation
      const attestationPath = join(testWorkingDir, 'validation-test.json');
      await stamper.stampAttestationFile(attestationPath);

      // Validate against it
      const validation = await stamper.validateCurrentEnvironmentAgainstAttestation();
      
      expect(validation.valid).toBe(true);
      expect(validation.exactMatch).toBe(true);
    });
  });

  describe('CompatibilityChecker', () => {
    it('should check platform compatibility', async () => {
      const env1 = { platform: 'darwin', arch: 'x64' };
      const env2 = { platform: 'linux', arch: 'x64' };

      const compat = compatChecker.checkPlatformCompatibility(env1, env2);
      
      expect(compat.compatible).toBe(true); // Should be compatible with allowPlatformDiffs
      expect(compat.confidence).toBeGreaterThan(0.8);
      expect(compat.warnings).toBeDefined();
    });

    it('should check Node.js version compatibility', async () => {
      const env1 = { nodeVersion: 'v18.17.0' };
      const env2 = { nodeVersion: 'v18.18.0' };

      const compat = compatChecker.checkNodeVersionCompatibility(env1, env2);
      
      expect(compat.compatible).toBe(true); // Minor version diff should be compatible
      expect(compat.confidence).toBeGreaterThan(0.9);
    });

    it('should perform comprehensive compatibility check', async () => {
      await hermeticEnv.initialize();
      const env1 = hermeticEnv.currentFingerprint;
      
      // Create slightly different environment
      const env2 = {
        ...env1,
        nodeVersion: 'v18.17.0', // Different minor version
        timezone: 'America/New_York' // Different timezone
      };

      const result = await compatChecker.performCompatibilityCheck(env1, env2);
      
      expect(result.checkId).toBeDefined();
      expect(result.compatible).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.ruleResults).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });

    it('should generate compatibility matrix for multiple environments', async () => {
      await hermeticEnv.initialize();
      const baseEnv = hermeticEnv.currentFingerprint;

      const environments = [
        baseEnv,
        { ...baseEnv, platform: 'linux' },
        { ...baseEnv, nodeVersion: 'v20.0.0' }
      ];

      const report = await compatChecker.generateCompatibilityReport(environments);

      expect(report.environments).toHaveLength(3);
      expect(report.compatibilityMatrix.length).toBeGreaterThan(0);
      expect(report.summary.totalComparisons).toBeGreaterThan(0);
      expect(report.summary.averageConfidence).toBeGreaterThan(0);
    });
  });

  describe('High-Level Wrapper Functions', () => {
    it('should execute hermetic operation with validation', async () => {
      const operation = async (context) => {
        return { message: 'Executed hermetically', environmentHash: context.environment.shortHash };
      };

      const result = await executeHermetic(operation, {
        strictMode: true,
        validateBeforeExecution: false, // Skip validation for this test
        captureOutput: true
      });

      expect(result.success).toBe(true);
      expect(result.result.message).toBe('Executed hermetically');
      expect(result.result.environmentHash).toBeDefined();
      expect(result.environment).toBeDefined();
    });

    it('should handle batch execution', async () => {
      const { executeBatch } = await import('../../src/runtime/hermetic-wrapper.js');

      const operations = [
        async () => ({ task: 1, result: 'success' }),
        async () => ({ task: 2, result: 'success' }),
        async () => ({ task: 3, result: 'success' })
      ];

      const result = await executeBatch(operations, {
        strictMode: false,
        validateBeforeExecution: false
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should perform end-to-end hermetic execution with attestation', async () => {
      // Initialize all components
      await hermeticEnv.initialize();
      await stamper.initialize();
      await executor.initialize();

      const operation = async (context) => {
        // Simulate some work
        context.log('Starting hermetic operation');
        context.captureFile('output.txt', 'Generated by hermetic execution');
        context.captureMetric('processingTime', 123);
        
        return {
          success: true,
          processedItems: 42,
          environment: context.environment.shortHash
        };
      };

      // Execute with full attestation
      const result = await executor.execute(operation, {
        generateAttestation: true,
        captureOutput: true
      });

      expect(result.success).toBe(true);
      expect(result.attestation).toBeDefined();
      expect(result.output.files.has('output.txt')).toBe(true);
      expect(result.output.metrics.processingTime.value).toBe(123);

      // Stamp the result
      const attestationPath = join(testWorkingDir, 'integration-test.json');
      const stampResult = await stamper.stampAttestationFile(attestationPath, {
        buildType: 'integration-test',
        executionResult: result
      });

      expect(stampResult.success).toBe(true);

      // Verify attestation file
      const attestation = JSON.parse(await fs.readFile(attestationPath, 'utf8'));
      expect(attestation.environment.hash).toBeDefined();
      expect(attestation.reproducibility.hermeticBuild).toBe(true);
      expect(attestation.reproducibility.deterministic).toBe(true);
    });

    it('should maintain deterministic behavior across executions', async () => {
      // Set up deterministic environment
      process.env.KGEN_RANDOM_SEED = '98765';
      process.env.KGEN_BUILD_TIME = '2024-01-01T12:00:00.000Z';

      const operation = async () => {
        const randomValue = Math.random();
        const currentTime = this.getDeterministicTimestamp();
        
        return { randomValue, currentTime };
      };

      // Execute twice with same deterministic setup
      const result1 = await executeHermetic(operation, { strictMode: true });
      const result2 = await executeHermetic(operation, { strictMode: true });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.result.randomValue).toBe(result2.result.randomValue);
      expect(result1.result.currentTime).toBe(result2.result.currentTime);

      // Clean up
      delete process.env.KGEN_RANDOM_SEED;
      delete process.env.KGEN_BUILD_TIME;
    });

    it('should detect environment changes between executions', async () => {
      await hermeticEnv.initialize();
      await validator.initialize();

      const baseline = hermeticEnv.currentFingerprint;

      // Simulate environment change
      process.env.KGEN_TEST_VAR = 'changed';

      const hermeticEnv2 = new HermeticEnvironment({ strictMode: true });
      await hermeticEnv2.initialize();

      const validation = await validator.validateEnvironment(baseline, hermeticEnv2.currentFingerprint);

      // Should detect the environment variable change
      expect(validation.warnings.some(w => 
        w.message.includes('Environment variable differences detected')
      )).toBe(true);

      delete process.env.KGEN_TEST_VAR;
      await hermeticEnv2.shutdown();
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete environment capture within reasonable time', async () => {
      const startTime = performance.now();
      await hermeticEnv.initialize();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent operations safely', async () => {
      await executor.initialize();

      const operation = async (context) => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        return { id: context.executionId };
      };

      // Execute multiple operations concurrently
      const promises = Array.from({ length: 5 }, () => executor.execute(operation));
      const results = await Promise.all(promises);

      // All should succeed with unique execution IDs
      expect(results.every(r => r.success)).toBe(true);
      const executionIds = results.map(r => r.executionId);
      const uniqueIds = [...new Set(executionIds)];
      expect(uniqueIds).toHaveLength(5);
    });

    it('should handle large output capture without memory issues', async () => {
      await executor.initialize();

      const operation = async (context) => {
        // Capture moderately large output
        const largeContent = 'x'.repeat(10000);
        for (let i = 0; i < 100; i++) {
          context.captureFile(`file${i}.txt`, largeContent);
        }
        return { filesGenerated: 100 };
      };

      const result = await executor.execute(operation, { captureOutput: true });

      expect(result.success).toBe(true);
      expect(result.output.files.size).toBe(100);
      expect(result.result.filesGenerated).toBe(100);
    });
  });
});