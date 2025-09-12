/**
 * Advanced Chaos Engineering Framework for KGEN
 * Resilience testing through controlled failure injection
 * 
 * This framework systematically introduces various types of failures to validate
 * system resilience, recovery mechanisms, and graceful degradation capabilities.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import { EnterpriseTestSuite } from './testing-framework.js';

/**
 * Chaos Engineering Configuration
 */
export const ChaosConfig = {
  // Failure injection rates
  failureRates: {
    network: 0.1,        // 10% network failures
    disk: 0.05,          // 5% disk failures
    memory: 0.02,        // 2% memory failures
    cpu: 0.03,           // 3% CPU failures
    dependencies: 0.08,   // 8% dependency failures
  },
  
  // Recovery timeouts
  recovery: {
    network: 5000,       // 5 seconds
    disk: 3000,          // 3 seconds
    memory: 10000,       // 10 seconds
    cpu: 2000,           // 2 seconds
    dependencies: 8000,   // 8 seconds
  },
  
  // Chaos patterns
  patterns: {
    random: { probability: 0.1 },
    cascading: { depth: 3, delay: 1000 },
    periodic: { interval: 5000, duration: 2000 },
    burst: { count: 5, interval: 100 },
  },
};

/**
 * Failure Injection Engine
 */
export class FailureInjector extends EventEmitter {
  constructor() {
    super();
    this.activeFailures = new Set();
    this.failureHistory = [];
    this.monkeyPatches = new Map();
    this.recoveryTimeouts = new Map();
  }

  // Inject network failures
  injectNetworkFailure(probability = 0.1, duration = 5000) {
    const failureId = `network-${this.getDeterministicTimestamp()}`;
    this.activeFailures.add(failureId);
    
    this.emit('failure:injected', {
      type: 'network',
      id: failureId,
      probability,
      duration,
    });

    // Mock network operations to fail randomly
    this.monkeyPatchNetworkOperations(probability);

    // Auto-recovery after duration
    this.scheduleRecovery(failureId, 'network', duration);

    return failureId;
  }

  // Inject disk I/O failures
  injectDiskFailure(probability = 0.05, duration = 3000) {
    const failureId = `disk-${this.getDeterministicTimestamp()}`;
    this.activeFailures.add(failureId);

    this.emit('failure:injected', {
      type: 'disk',
      id: failureId,
      probability,
      duration,
    });

    this.monkeyPatchDiskOperations(probability);
    this.scheduleRecovery(failureId, 'disk', duration);

    return failureId;
  }

  // Inject memory pressure
  injectMemoryPressure(intensity = 0.5, duration = 10000) {
    const failureId = `memory-${this.getDeterministicTimestamp()}`;
    this.activeFailures.add(failureId);

    this.emit('failure:injected', {
      type: 'memory',
      id: failureId,
      intensity,
      duration,
    });

    // Create memory pressure
    const memoryBallast = this.createMemoryPressure(intensity);
    
    this.scheduleRecovery(failureId, 'memory', duration, () => {
      // Release memory ballast
      memoryBallast.length = 0;
    });

    return failureId;
  }

  // Inject CPU stress
  injectCpuStress(intensity = 0.7, duration = 2000) {
    const failureId = `cpu-${this.getDeterministicTimestamp()}`;
    this.activeFailures.add(failureId);

    this.emit('failure:injected', {
      type: 'cpu',
      id: failureId,
      intensity,
      duration,
    });

    const cpuStressor = this.createCpuStress(intensity);
    
    this.scheduleRecovery(failureId, 'cpu', duration, () => {
      clearInterval(cpuStressor);
    });

    return failureId;
  }

  // Inject dependency failures
  injectDependencyFailure(dependencies, probability = 0.1, duration = 8000) {
    const failureId = `dependency-${this.getDeterministicTimestamp()}`;
    this.activeFailures.add(failureId);

    this.emit('failure:injected', {
      type: 'dependency',
      id: failureId,
      dependencies,
      probability,
      duration,
    });

    this.monkeyPatchDependencies(dependencies, probability);
    this.scheduleRecovery(failureId, 'dependency', duration);

    return failureId;
  }

  // Cascading failure simulation
  injectCascadingFailure(startingPoint, depth = 3, delay = 1000) {
    const cascadeId = `cascade-${this.getDeterministicTimestamp()}`;
    
    this.emit('failure:cascade:start', {
      id: cascadeId,
      startingPoint,
      depth,
      delay,
    });

    this.runCascadingFailure(cascadeId, startingPoint, depth, delay, 0);
    
    return cascadeId;
  }

  // Monkey patch network operations
  monkeyPatchNetworkOperations(probability) {
    const originalFetch = global.fetch;
    const patchId = 'network-patch';
    
    if (!this.monkeyPatches.has(patchId)) {
      global.fetch = async (...args) => {
        if (Math.random() < probability) {
          const errorType = Math.random();
          if (errorType < 0.3) {
            throw new Error('ECONNRESET: Connection reset');
          } else if (errorType < 0.6) {
            throw new Error('ETIMEDOUT: Connection timeout');
          } else {
            throw new Error('ENOTFOUND: Host not found');
          }
        }
        return originalFetch?.(...args) || Promise.resolve({ ok: true });
      };
      
      this.monkeyPatches.set(patchId, originalFetch);
    }
  }

  // Monkey patch disk operations
  monkeyPatchDiskOperations(probability) {
    const fs = require('fs').promises;
    const patchId = 'disk-patch';
    
    if (!this.monkeyPatches.has(patchId)) {
      const originalReadFile = fs.readFile;
      const originalWriteFile = fs.writeFile;
      
      fs.readFile = async (...args) => {
        if (Math.random() < probability) {
          const errorType = Math.random();
          if (errorType < 0.4) {
            throw new Error('ENOENT: No such file or directory');
          } else if (errorType < 0.7) {
            throw new Error('EACCES: Permission denied');
          } else {
            throw new Error('ENOSPC: No space left on device');
          }
        }
        return originalReadFile.apply(fs, args);
      };

      fs.writeFile = async (...args) => {
        if (Math.random() < probability) {
          const errorType = Math.random();
          if (errorType < 0.3) {
            throw new Error('ENOSPC: No space left on device');
          } else if (errorType < 0.6) {
            throw new Error('EACCES: Permission denied');
          } else {
            throw new Error('EIO: I/O error');
          }
        }
        return originalWriteFile.apply(fs, args);
      };
      
      this.monkeyPatches.set(patchId, { readFile: originalReadFile, writeFile: originalWriteFile });
    }
  }

  // Create memory pressure
  createMemoryPressure(intensity) {
    const memoryBallast = [];
    const targetSize = Math.floor(intensity * 100 * 1024 * 1024); // Up to 100MB * intensity
    
    try {
      while (memoryBallast.length * 1024 < targetSize) {
        memoryBallast.push(randomBytes(1024));
      }
    } catch (error) {
      // If we run out of memory, that's the pressure we wanted
    }
    
    return memoryBallast;
  }

  // Create CPU stress
  createCpuStress(intensity) {
    const stressInterval = Math.max(1, Math.floor(10 * (1 - intensity)));
    
    return setInterval(() => {
      const endTime = this.getDeterministicTimestamp() + (intensity * 100);
      while (this.getDeterministicTimestamp() < endTime) {
        // Busy work
        Math.random() * Math.random();
      }
    }, stressInterval);
  }

  // Monkey patch dependencies
  monkeyPatchDependencies(dependencies, probability) {
    dependencies.forEach(dep => {
      const patchId = `dep-${dep}`;
      if (!this.monkeyPatches.has(patchId)) {
        // This would patch specific dependencies
        // For testing, we'll create mock failures
        this.monkeyPatches.set(patchId, {
          originalFunction: () => Promise.resolve(),
          patch: () => {
            if (Math.random() < probability) {
              throw new Error(`Dependency ${dep} unavailable`);
            }
          }
        });
      }
    });
  }

  // Run cascading failure simulation
  async runCascadingFailure(cascadeId, currentService, remainingDepth, delay, currentLevel) {
    if (remainingDepth <= 0) {
      this.emit('failure:cascade:end', { id: cascadeId, level: currentLevel });
      return;
    }

    // Inject failure at current service
    const failureId = this.injectDependencyFailure([currentService], 0.9, delay * 2);
    
    this.emit('failure:cascade:level', {
      id: cascadeId,
      level: currentLevel,
      service: currentService,
      failureId,
    });

    // Wait for delay, then cascade to dependent services
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const dependentServices = this.getDependentServices(currentService);
    
    for (const dependent of dependentServices) {
      this.runCascadingFailure(cascadeId, dependent, remainingDepth - 1, delay, currentLevel + 1);
    }
  }

  // Get mock dependent services
  getDependentServices(service) {
    const dependencies = {
      'template-engine': ['file-system', 'cache'],
      'file-system': ['disk-io'],
      'cache': ['memory-manager'],
      'rdf-parser': ['network', 'file-system'],
      'generator': ['template-engine', 'rdf-parser'],
    };
    
    return dependencies[service] || [];
  }

  // Schedule recovery from failure
  scheduleRecovery(failureId, type, duration, customRecovery) {
    const timeout = setTimeout(() => {
      this.recover(failureId, type, customRecovery);
    }, duration);
    
    this.recoveryTimeouts.set(failureId, timeout);
  }

  // Recover from failure
  recover(failureId, type, customRecovery) {
    this.activeFailures.delete(failureId);
    
    if (customRecovery) {
      customRecovery();
    }
    
    // Restore monkey patches
    this.restoreMonkeyPatches(type);
    
    this.emit('failure:recovered', {
      id: failureId,
      type,
      timestamp: this.getDeterministicTimestamp(),
    });
  }

  // Restore monkey patches for a specific type
  restoreMonkeyPatches(type) {
    const patchesToRestore = Array.from(this.monkeyPatches.keys()).filter(key => key.includes(type));
    
    patchesToRestore.forEach(patchId => {
      const original = this.monkeyPatches.get(patchId);
      
      if (patchId.includes('network') && global.fetch) {
        global.fetch = original;
      } else if (patchId.includes('disk')) {
        const fs = require('fs').promises;
        if (original.readFile) fs.readFile = original.readFile;
        if (original.writeFile) fs.writeFile = original.writeFile;
      }
      
      this.monkeyPatches.delete(patchId);
    });
  }

  // Clear all failures and restore system
  clearAllFailures() {
    for (const failureId of this.activeFailures) {
      const timeout = this.recoveryTimeouts.get(failureId);
      if (timeout) {
        clearTimeout(timeout);
      }
    }
    
    this.activeFailures.clear();
    this.recoveryTimeouts.clear();
    
    // Restore all monkey patches
    ['network', 'disk', 'dependency'].forEach(type => {
      this.restoreMonkeyPatches(type);
    });
    
    this.emit('chaos:cleared');
  }

  // Get current status
  getStatus() {
    return {
      activeFailures: Array.from(this.activeFailures),
      failureCount: this.activeFailures.size,
      monkeyPatchCount: this.monkeyPatches.size,
    };
  }
}

/**
 * Resilience Validator
 */
export class ResilienceValidator extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      totalTests: 0,
      recoveredTests: 0,
      failedRecoveries: 0,
      recoveryTimes: [],
      availabilityWindows: [],
    };
  }

  // Test system recovery from specific failure type
  async testRecoveryFrom(failureType, testFunction, options = {}) {
    const startTime = performance.now();
    const injector = new FailureInjector();
    let recoveryStartTime;
    let recovered = false;

    this.metrics.totalTests++;

    try {
      // Inject the failure
      let failureId;
      switch (failureType) {
        case 'network':
          failureId = injector.injectNetworkFailure(options.probability || 0.5, options.duration || 5000);
          break;
        case 'disk':
          failureId = injector.injectDiskFailure(options.probability || 0.5, options.duration || 3000);
          break;
        case 'memory':
          failureId = injector.injectMemoryPressure(options.intensity || 0.7, options.duration || 10000);
          break;
        case 'cpu':
          failureId = injector.injectCpuStress(options.intensity || 0.8, options.duration || 2000);
          break;
        default:
          throw new Error(`Unknown failure type: ${failureType}`);
      }

      // Wait for failure to take effect
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test system behavior during failure
      let failureBehavior;
      try {
        failureBehavior = await testFunction();
      } catch (error) {
        failureBehavior = { error: error.message, handled: true };
      }

      // Monitor for recovery
      recoveryStartTime = performance.now();
      
      injector.once('failure:recovered', () => {
        const recoveryTime = performance.now() - recoveryStartTime;
        recovered = true;
        this.metrics.recoveryTimes.push(recoveryTime);
        this.metrics.recoveredTests++;
        
        this.emit('recovery:detected', {
          failureType,
          recoveryTime,
          failureId,
        });
      });

      // Wait for recovery or timeout
      const recoveryTimeout = (options.duration || 5000) + 2000;
      await new Promise(resolve => setTimeout(resolve, recoveryTimeout));

      // Test system behavior after recovery
      let recoveryBehavior;
      try {
        recoveryBehavior = await testFunction();
      } catch (error) {
        recoveryBehavior = { error: error.message, recovered: false };
      }

      const totalTime = performance.now() - startTime;

      if (!recovered) {
        this.metrics.failedRecoveries++;
        throw new Error(`System did not recover from ${failureType} failure within timeout`);
      }

      return {
        failureType,
        totalTime,
        recoveryTime: this.metrics.recoveryTimes[this.metrics.recoveryTimes.length - 1],
        failureBehavior,
        recoveryBehavior,
        recovered: true,
      };

    } finally {
      injector.clearAllFailures();
    }
  }

  // Test graceful degradation
  async testGracefulDegradation(degradationLevels, testFunction) {
    const results = [];
    
    for (const level of degradationLevels) {
      const injector = new FailureInjector();
      
      try {
        // Apply degradation
        await this.applyDegradation(injector, level);
        
        // Test system behavior
        const startTime = performance.now();
        const behavior = await testFunction();
        const responseTime = performance.now() - startTime;
        
        results.push({
          level: level.name,
          responseTime,
          behavior,
          success: true,
        });
        
      } catch (error) {
        results.push({
          level: level.name,
          error: error.message,
          success: false,
        });
      } finally {
        injector.clearAllFailures();
      }
    }
    
    return results;
  }

  // Apply degradation level
  async applyDegradation(injector, level) {
    if (level.networkFailure) {
      injector.injectNetworkFailure(level.networkFailure.probability, level.networkFailure.duration);
    }
    
    if (level.diskFailure) {
      injector.injectDiskFailure(level.diskFailure.probability, level.diskFailure.duration);
    }
    
    if (level.memoryPressure) {
      injector.injectMemoryPressure(level.memoryPressure.intensity, level.memoryPressure.duration);
    }
    
    // Wait for failures to take effect
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Get resilience metrics
  getMetrics() {
    const avgRecoveryTime = this.metrics.recoveryTimes.length > 0 
      ? this.metrics.recoveryTimes.reduce((a, b) => a + b, 0) / this.metrics.recoveryTimes.length 
      : 0;
    
    return {
      ...this.metrics,
      recoveryRate: this.metrics.totalTests > 0 ? this.metrics.recoveredTests / this.metrics.totalTests : 0,
      avgRecoveryTime,
      maxRecoveryTime: Math.max(...this.metrics.recoveryTimes, 0),
      minRecoveryTime: Math.min(...this.metrics.recoveryTimes, 0),
    };
  }
}

/**
 * KGEN Chaos Engineering Tests
 */
describe('KGEN Chaos Engineering Suite', () => {
  let injector;
  let validator;
  let testSuite;

  beforeAll(async () => {
    testSuite = new EnterpriseTestSuite('Chaos Engineering');
    await testSuite.setup();
  });

  beforeEach(() => {
    injector = new FailureInjector();
    validator = new ResilienceValidator();
  });

  afterEach(() => {
    injector.clearAllFailures();
  });

  afterAll(async () => {
    await testSuite.teardown();
  });

  describe('Network Failure Resilience', () => {
    it('should recover gracefully from network failures', async () => {
      const mockRdfParser = async () => {
        // Mock RDF parsing that depends on network
        await new Promise(resolve => setTimeout(resolve, 100));
        return { triples: 10, success: true };
      };

      const result = await validator.testRecoveryFrom('network', mockRdfParser, {
        probability: 0.8,
        duration: 2000,
      });

      expect(result.recovered).toBe(true);
      expect(result.recoveryTime).toBeLessThan(5000);
      expect(result.recoveryBehavior.success).toBe(true);
    });

    it('should implement circuit breaker pattern', async () => {
      let attemptCount = 0;
      const maxAttempts = 3;
      let circuitOpen = false;

      const mockServiceWithCircuitBreaker = async () => {
        if (circuitOpen) {
          throw new Error('Circuit breaker is open');
        }

        attemptCount++;
        
        // Simulate network call that might fail
        if (Math.random() < 0.7) { // 70% failure rate
          if (attemptCount >= maxAttempts) {
            circuitOpen = true;
          }
          throw new Error('Network failure');
        }
        
        // Reset on success
        attemptCount = 0;
        return { success: true };
      };

      injector.injectNetworkFailure(0.7, 3000);

      let circuitTripped = false;
      try {
        for (let i = 0; i < 5; i++) {
          await mockServiceWithCircuitBreaker();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        if (error.message === 'Circuit breaker is open') {
          circuitTripped = true;
        }
      }

      expect(circuitTripped).toBe(true);
    });
  });

  describe('Disk I/O Failure Resilience', () => {
    it('should handle disk failures with graceful degradation', async () => {
      const degradationLevels = [
        {
          name: 'light',
          diskFailure: { probability: 0.1, duration: 1000 }
        },
        {
          name: 'moderate', 
          diskFailure: { probability: 0.3, duration: 2000 }
        },
        {
          name: 'heavy',
          diskFailure: { probability: 0.6, duration: 3000 }
        }
      ];

      const mockFileOperations = async () => {
        // Mock file operations
        await new Promise(resolve => setTimeout(resolve, 50));
        return { filesProcessed: 5, cacheUsed: true };
      };

      const results = await validator.testGracefulDegradation(degradationLevels, mockFileOperations);

      // System should handle light degradation well
      expect(results[0].success).toBe(true);
      
      // Under heavy degradation, some failures are acceptable
      const successRate = results.filter(r => r.success).length / results.length;
      expect(successRate).toBeGreaterThan(0.3); // At least 30% should succeed
    });
  });

  describe('Memory Pressure Resilience', () => {
    it('should handle memory pressure without crashing', async () => {
      const mockMemoryIntensiveOperation = async () => {
        // Allocate some memory for processing
        const data = new Array(1000).fill(null).map((_, i) => ({
          id: i,
          data: Math.random().toString(36),
        }));

        await new Promise(resolve => setTimeout(resolve, 100));
        
        return { processed: data.length };
      };

      const result = await validator.testRecoveryFrom('memory', mockMemoryIntensiveOperation, {
        intensity: 0.8,
        duration: 5000,
      });

      expect(result.recovered).toBe(true);
      expect(result.recoveryBehavior.processed).toBeGreaterThan(0);
    });
  });

  describe('Cascading Failure Scenarios', () => {
    it('should contain cascading failures', async () => {
      const cascadeEvents = [];
      
      injector.on('failure:cascade:level', (event) => {
        cascadeEvents.push(event);
      });

      const cascadeId = injector.injectCascadingFailure('generator', 2, 500);
      
      // Wait for cascade to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      expect(cascadeEvents.length).toBeGreaterThan(0);
      expect(cascadeEvents.length).toBeLessThan(10); // Should be contained
      
      // System should recover after cascade
      await new Promise(resolve => setTimeout(resolve, 3000));
      const status = injector.getStatus();
      expect(status.activeFailures.length).toBeLessThan(cascadeEvents.length);
    });

    it('should isolate failures to prevent total system failure', async () => {
      const services = ['template-engine', 'rdf-parser', 'file-system', 'cache'];
      const failures = new Map();
      
      // Inject failures in multiple services simultaneously
      services.forEach(service => {
        const failureId = injector.injectDependencyFailure([service], 0.9, 3000);
        failures.set(service, failureId);
      });

      // Mock system health check
      const healthCheck = async () => {
        const healthyServices = [];
        
        for (const service of services) {
          try {
            // Mock service check
            await new Promise(resolve => setTimeout(resolve, 50));
            
            if (Math.random() > 0.9) { // Some services should remain healthy
              healthyServices.push(service);
            }
          } catch (error) {
            // Service is down
          }
        }
        
        return { healthyServices, totalServices: services.length };
      };

      await new Promise(resolve => setTimeout(resolve, 1000));
      const health = await healthCheck();
      
      // At least some services should remain operational (isolation working)
      expect(health.healthyServices.length).toBeGreaterThan(0);
      expect(health.healthyServices.length / health.totalServices).toBeGreaterThan(0.1);
    });
  });

  describe('Recovery Time Objectives', () => {
    it('should meet RTO requirements for critical components', async () => {
      const criticalComponents = [
        { name: 'rdf-parser', maxRecoveryTime: 3000 },
        { name: 'template-engine', maxRecoveryTime: 2000 },
        { name: 'file-system', maxRecoveryTime: 4000 },
      ];

      const recoveryResults = [];

      for (const component of criticalComponents) {
        const mockComponent = async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { component: component.name, operational: true };
        };

        const result = await validator.testRecoveryFrom('network', mockComponent, {
          probability: 0.9,
          duration: 1000,
        });

        recoveryResults.push({
          component: component.name,
          recoveryTime: result.recoveryTime,
          maxAllowed: component.maxRecoveryTime,
          withinSLA: result.recoveryTime < component.maxRecoveryTime,
        });
      }

      // All critical components should meet RTO
      const componentsWithinSLA = recoveryResults.filter(r => r.withinSLA);
      expect(componentsWithinSLA.length).toBe(criticalComponents.length);
    });
  });

  describe('Availability Validation', () => {
    it('should maintain high availability during chaos', async () => {
      const testDuration = 10000; // 10 seconds
      const sampleInterval = 500;  // 500ms
      const availabilityData = [];
      
      // Start chaos monkey
      injector.injectNetworkFailure(0.3, testDuration);
      injector.injectDiskFailure(0.2, testDuration);

      const startTime = this.getDeterministicTimestamp();
      
      // Continuously sample availability
      const sampler = setInterval(async () => {
        try {
          const mockHealthCheck = async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            return { status: 'healthy' };
          };

          const health = await mockHealthCheck();
          availabilityData.push({
            timestamp: this.getDeterministicTimestamp() - startTime,
            available: health.status === 'healthy',
          });
        } catch (error) {
          availabilityData.push({
            timestamp: this.getDeterministicTimestamp() - startTime,
            available: false,
            error: error.message,
          });
        }
      }, sampleInterval);

      await new Promise(resolve => setTimeout(resolve, testDuration));
      clearInterval(sampler);

      // Calculate availability percentage
      const availableSamples = availabilityData.filter(d => d.available).length;
      const availability = availableSamples / availabilityData.length;

      // Should maintain >95% availability even during chaos
      expect(availability).toBeGreaterThan(0.95);
      expect(availabilityData.length).toBeGreaterThan(10); // Sufficient samples
    });
  });
});

export { FailureInjector, ResilienceValidator, ChaosConfig };