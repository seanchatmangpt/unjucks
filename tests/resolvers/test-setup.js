/**
 * Test Setup for URI Resolver Test Suite
 * 
 * Global test setup and utilities for Charter compliance testing
 */

import { vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { tmpdir } from 'os';

// Global test environment setup
globalThis.__TEST_ENV__ = 'resolver-testing';
globalThis.__REPRODUCIBILITY_TARGET__ = 99.9;
globalThis.__PERFORMANCE_STRICT__ = true;

// Fixed timestamp for deterministic testing
const FIXED_TIMESTAMP = '2024-01-01T00:00:00.000Z';
const FIXED_DATE = new Date(FIXED_TIMESTAMP);

// Override Date for deterministic results in tests
const OriginalDate = global.Date;

global.Date = class extends OriginalDate {
  constructor(...args) {
    if (args.length === 0 && process.env.NODE_ENV === 'test') {
      super(FIXED_TIMESTAMP);
    } else {
      super(...args);
    }
  }
  
  static now() {
    if (process.env.NODE_ENV === 'test' && process.env.DETERMINISTIC_TESTS === 'true') {
      return FIXED_DATE.getTime();
    }
    return Originalthis.getDeterministicTimestamp();
  }
};

// Mock crypto.randomBytes for deterministic testing when needed
const originalRandomBytes = require('crypto').randomBytes;
let deterministicMode = false;
let deterministicSeed = 'test-seed';

require('crypto').randomBytes = function(size) {
  if (deterministicMode && process.env.NODE_ENV === 'test') {
    // Generate deterministic "random" bytes based on seed
    const hash = require('crypto').createHash('sha256').update(deterministicSeed).digest();
    const result = Buffer.alloc(size);
    for (let i = 0; i < size; i++) {
      result[i] = hash[i % hash.length];
    }
    return result;
  }
  return originalRandomBytes(size);
};

// Global test utilities
globalThis.testUtils = {
  // Enable/disable deterministic mode
  setDeterministicMode(enabled, seed = 'test-seed') {
    deterministicMode = enabled;
    deterministicSeed = seed;
    process.env.DETERMINISTIC_TESTS = enabled ? 'true' : 'false';
  },
  
  // Create temporary test directory
  async createTestDir(prefix = 'resolver-test-') {
    const testDir = path.join(tmpdir(), prefix + this.getDeterministicTimestamp());
    await fs.ensureDir(testDir);
    return testDir;
  },
  
  // Clean up test directory
  async cleanupTestDir(testDir) {
    if (testDir && await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  },
  
  // Generate deterministic test content
  generateTestContent(size, seed = 'test-content') {
    const basePattern = `${seed}-pattern-`;
    const repetitions = Math.ceil(size / basePattern.length);
    return basePattern.repeat(repetitions).substring(0, size);
  },
  
  // Create deterministic hash
  createDeterministicHash(content, algorithm = 'sha256') {
    return require('crypto').createHash(algorithm).update(content).digest('hex');
  },
  
  // Measure function performance
  async measurePerformance(fn, iterations = 1) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    
    return {
      times,
      average: times.reduce((sum, time) => sum + time, 0) / times.length,
      minimum: Math.min(...times),
      maximum: Math.max(...times),
      p95: times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)]
    };
  },
  
  // Wait for specified duration
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // Check if running in CI environment
  isCI() {
    return !!(process.env.CI || process.env.CONTINUOUS_INTEGRATION);
  },
  
  // Get test environment configuration
  getTestEnv() {
    return {
      isCI: this.isCI(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      deterministicMode,
      fixedTimestamp: FIXED_TIMESTAMP
    };
  },
  
  // Validate Charter requirements
  validateCharterCompliance(results) {
    const compliance = {
      uriSchemes: 0,
      performanceTargets: 0,
      reproducibility: false,
      offlineOperation: false,
      security: false,
      jsonSchema: false,
      overallScore: 0
    };
    
    // URI Schemes (7 total: content, git, attest, drift, policy, doc, audit)
    const supportedSchemes = ['content', 'git', 'attest', 'drift', 'policy'];
    compliance.uriSchemes = supportedSchemes.length;
    
    // Performance Targets (based on Charter requirements)
    const performanceTargets = [
      results.contentResolutionAvg < 50,
      results.contentResolutionMax < 100,
      results.gitOperationsAvg < 200,
      results.attestationVerificationAvg < 100,
      results.driftPatchApplicationAvg < 150,
      results.memoryUsage < 100 * 1024 * 1024 // 100MB
    ];
    compliance.performanceTargets = performanceTargets.filter(Boolean).length;
    
    // Reproducibility (99.9% target)
    compliance.reproducibility = results.reproducibilityRate >= 99.9;
    
    // Offline Operation
    compliance.offlineOperation = results.offlineCapable === true;
    
    // Security
    compliance.security = results.securityTestsPassed === true;
    
    // JSON Schema Compliance
    compliance.jsonSchema = results.jsonSchemaCompliant === true;
    
    // Calculate overall compliance score
    const maxPoints = 7 + 6 + 1 + 1 + 1 + 1; // 17 total points
    const earnedPoints = compliance.uriSchemes +
                        compliance.performanceTargets +
                        (compliance.reproducibility ? 1 : 0) +
                        (compliance.offlineOperation ? 1 : 0) +
                        (compliance.security ? 1 : 0) +
                        (compliance.jsonSchema ? 1 : 0);
    
    compliance.overallScore = (earnedPoints / maxPoints) * 100;
    
    return compliance;
  },
  
  // Create mock implementations
  createMockResolver(type, methods = {}) {
    const baseMethods = {
      initialize: vi.fn().mockResolvedValue({ success: true }),
      clearCache: vi.fn().mockReturnValue({ success: true, cleared: true }),
      getStats: vi.fn().mockReturnValue({ operations: 0, errors: 0 })
    };
    
    switch (type) {
      case 'content':
        return {
          ...baseMethods,
          store: vi.fn().mockResolvedValue({ uri: 'content://sha256/test', stored: true }),
          resolve: vi.fn().mockResolvedValue({ uri: 'content://sha256/test', path: '/tmp/test' }),
          validateContentURI: vi.fn().mockReturnValue({ valid: true }),
          exists: vi.fn().mockResolvedValue(true),
          ...methods
        };
        
      case 'git':
        return {
          ...baseMethods,
          validateGitUri: vi.fn().mockReturnValue({ valid: true }),
          createGitUri: vi.fn().mockReturnValue('git://test@abc123/file.js'),
          attachAttestation: vi.fn().mockResolvedValue({ success: true }),
          getAttestations: vi.fn().mockResolvedValue({ found: true, attestations: [] }),
          ...methods
        };
        
      case 'attest':
        return {
          ...baseMethods,
          parseAttestURI: vi.fn().mockReturnValue({ algorithm: 'sha256', hash: 'test' }),
          createAttestation: vi.fn().mockResolvedValue({ version: '1.0', subject: 'test' }),
          store: vi.fn().mockResolvedValue('attest://sha256/test'),
          resolve: vi.fn().mockResolvedValue({ attestation: {}, verified: true }),
          verifyAttestation: vi.fn().mockResolvedValue({ valid: true }),
          ...methods
        };
        
      case 'drift':
        return {
          ...baseMethods,
          parseDriftURI: vi.fn().mockReturnValue({ scheme: 'hash', id: 'test' }),
          storePatch: vi.fn().mockResolvedValue({ uri: 'drift://hash/test', patch: {} }),
          retrievePatch: vi.fn().mockResolvedValue({ patch: {}, metadata: {} }),
          applyPatch: vi.fn().mockResolvedValue({ result: {}, metadata: {} }),
          ...methods
        };
        
      case 'policy':
        return {
          ...baseMethods,
          parsePolicyURI: vi.fn().mockReturnValue({ valid: true, ruleId: 'test', expectedVerdict: 'pass' }),
          resolvePolicyURI: vi.fn().mockResolvedValue({ passed: true, actualVerdict: 'pass' }),
          getVerdictStatistics: vi.fn().mockReturnValue({ totalResolutions: 0 }),
          ...methods
        };
        
      default:
        return { ...baseMethods, ...methods };
    }
  }
};

// Console logging utilities for test debugging
globalThis.testLogger = {
  debug: process.env.ENABLE_DEBUG_LOGGING === 'true' ? console.log : () => {},
  info: console.log,
  warn: console.warn,
  error: console.error,
  
  logTestStart(testName) {
    this.info(`🧪 Starting test: ${testName}`);
  },
  
  logTestEnd(testName, duration, result) {
    const status = result === 'pass' ? '✅' : '❌';
    this.info(`${status} Completed test: ${testName} (${duration}ms)`);
  },
  
  logPerformance(operation, timing) {
    this.debug(`⚡ Performance: ${operation} - ${timing.average.toFixed(2)}ms avg (${timing.minimum.toFixed(2)}-${timing.maximum.toFixed(2)}ms range)`);
  },
  
  logCharter(compliance) {
    this.info(`📋 Charter Compliance: ${compliance.overallScore.toFixed(1)}%`);
    this.info(`   URI Schemes: ${compliance.uriSchemes}/7`);
    this.info(`   Performance: ${compliance.performanceTargets}/6`);
    this.info(`   Reproducibility: ${compliance.reproducibility ? '✅' : '❌'}`);
    this.info(`   Offline: ${compliance.offlineOperation ? '✅' : '❌'}`);
    this.info(`   Security: ${compliance.security ? '✅' : '❌'}`);
    this.info(`   JSON Schema: ${compliance.jsonSchema ? '✅' : '❌'}`);
  }
};

// Performance monitoring
let performanceData = {};

globalThis.performanceMonitor = {
  start(label) {
    performanceData[label] = { startTime: performance.now() };
  },
  
  end(label) {
    if (performanceData[label]) {
      performanceData[label].endTime = performance.now();
      performanceData[label].duration = performanceData[label].endTime - performanceData[label].startTime;
      return performanceData[label].duration;
    }
    return 0;
  },
  
  get(label) {
    return performanceData[label];
  },
  
  clear() {
    performanceData = {};
  },
  
  getAll() {
    return { ...performanceData };
  }
};

// Memory monitoring
globalThis.memoryMonitor = {
  getUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
      externalMB: Math.round(usage.external / 1024 / 1024),
      rssMB: Math.round(usage.rss / 1024 / 1024)
    };
  },
  
  checkMemoryLeak(baseline, current, threshold = 50) {
    const increase = current.heapUsedMB - baseline.heapUsedMB;
    return {
      leaked: increase > threshold,
      increaseMB: increase,
      threshold
    };
  },
  
  forceGC() {
    if (global.gc) {
      global.gc();
    }
  }
};

export default {
  testUtils: globalThis.testUtils,
  testLogger: globalThis.testLogger,
  performanceMonitor: globalThis.performanceMonitor,
  memoryMonitor: globalThis.memoryMonitor,
  FIXED_TIMESTAMP
};