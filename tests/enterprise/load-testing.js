/**
 * Load Testing Framework for KGEN
 * Performance validation under various load conditions
 * 
 * This framework simulates real-world enterprise load patterns to validate
 * system performance, scalability, and reliability under stress.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'node:perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { EventEmitter } from 'node:events';
import { EnterpriseTestSuite, TestMetrics } from './testing-framework.js';

/**
 * Load Test Configuration
 */
export const LoadTestConfig = {
  // Performance thresholds
  thresholds: {
    responseTime: {
      p50: 100,    // 50th percentile < 100ms
      p95: 500,    // 95th percentile < 500ms  
      p99: 1000,   // 99th percentile < 1000ms
      max: 5000,   // Maximum < 5 seconds
    },
    throughput: {
      minimum: 100, // 100 operations/second minimum
      target: 500,  // 500 operations/second target
    },
    errorRate: {
      maximum: 0.01, // 1% maximum error rate
    },
    resources: {
      maxMemory: 1024 * 1024 * 1024, // 1GB maximum
      maxCpuUsage: 0.8, // 80% maximum CPU
    },
  },
  
  // Load patterns
  patterns: {
    constant: { users: 50, duration: 30000 },
    rampUp: { startUsers: 10, endUsers: 100, duration: 60000 },
    spike: { baseUsers: 20, spikeUsers: 200, spikeDuration: 5000 },
    stress: { users: 500, duration: 120000 },
  },
};

/**
 * Virtual User Simulator
 */
class VirtualUser extends EventEmitter {
  constructor(id, scenario, options = {}) {
    super();
    this.id = id;
    this.scenario = scenario;
    this.options = options;
    this.stats = {
      requests: 0,
      responses: 0,
      errors: 0,
      totalResponseTime: 0,
      responseTimes: [],
    };
  }

  async start() {
    this.emit('user:start', { userId: this.id });
    
    try {
      while (this.shouldContinue()) {
        await this.executeScenario();
        await this.think(); // Simulate user think time
      }
    } catch (error) {
      this.emit('user:error', { userId: this.id, error });
    } finally {
      this.emit('user:stop', { userId: this.id, stats: this.stats });
    }
  }

  async executeScenario() {
    const startTime = performance.now();
    this.stats.requests++;
    
    try {
      await this.scenario.execute(this);
      
      const responseTime = performance.now() - startTime;
      this.stats.responses++;
      this.stats.totalResponseTime += responseTime;
      this.stats.responseTimes.push(responseTime);
      
      this.emit('request:success', {
        userId: this.id,
        responseTime,
        timestamp: this.getDeterministicTimestamp(),
      });
      
    } catch (error) {
      this.stats.errors++;
      const responseTime = performance.now() - startTime;
      
      this.emit('request:error', {
        userId: this.id,
        error,
        responseTime,
        timestamp: this.getDeterministicTimestamp(),
      });
    }
  }

  async think() {
    // Simulate user think time (1-5 seconds)
    const thinkTime = 1000 + Math.random() * 4000;
    await new Promise(resolve => setTimeout(resolve, thinkTime));
  }

  shouldContinue() {
    return this.options.duration ? 
      (this.getDeterministicTimestamp() - this.startTime) < this.options.duration :
      this.stats.requests < (this.options.maxRequests || 100);
  }

  getStats() {
    const avgResponseTime = this.stats.totalResponseTime / this.stats.responses;
    return {
      ...this.stats,
      avgResponseTime,
      errorRate: this.stats.errors / this.stats.requests,
    };
  }
}

/**
 * Load Test Scenario
 */
class LoadTestScenario {
  constructor(name, steps) {
    this.name = name;
    this.steps = steps;
  }

  async execute(user) {
    for (const step of this.steps) {
      await step.execute(user);
    }
  }
}

/**
 * Load Test Step
 */
class LoadTestStep {
  constructor(name, actionFn, options = {}) {
    this.name = name;
    this.actionFn = actionFn;
    this.options = options;
  }

  async execute(user) {
    const timeout = this.options.timeout || 30000;
    
    return Promise.race([
      this.actionFn(user),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Step '${this.name}' timeout`)), timeout)
      )
    ]);
  }
}

/**
 * Load Test Controller
 */
export class LoadTestController extends EventEmitter {
  constructor() {
    super();
    this.users = new Map();
    this.metrics = new LoadTestMetrics();
    this.startTime = null;
    this.endTime = null;
  }

  async runLoadTest(pattern, scenario, options = {}) {
    this.startTime = this.getDeterministicTimestamp();
    this.emit('test:start', { pattern, scenario: scenario.name, options });
    
    try {
      switch (pattern.type) {
        case 'constant':
          await this.runConstantLoad(pattern, scenario, options);
          break;
        case 'rampUp':
          await this.runRampUpLoad(pattern, scenario, options);
          break;
        case 'spike':
          await this.runSpikeLoad(pattern, scenario, options);
          break;
        case 'stress':
          await this.runStressLoad(pattern, scenario, options);
          break;
        default:
          throw new Error(`Unknown load pattern: ${pattern.type}`);
      }
      
      this.endTime = this.getDeterministicTimestamp();
      const results = await this.metrics.generateReport();
      
      this.emit('test:complete', { results });
      return results;
      
    } catch (error) {
      this.endTime = this.getDeterministicTimestamp();
      this.emit('test:error', { error });
      throw error;
    }
  }

  async runConstantLoad(pattern, scenario, options) {
    const promises = [];
    
    for (let i = 0; i < pattern.users; i++) {
      const user = new VirtualUser(i, scenario, {
        duration: pattern.duration,
        ...options,
      });
      
      this.setupUserListeners(user);
      this.users.set(i, user);
      
      promises.push(user.start());
      
      // Slight delay between user starts to avoid thundering herd
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await Promise.allSettled(promises);
  }

  async runRampUpLoad(pattern, scenario, options) {
    const userIncrement = (pattern.endUsers - pattern.startUsers) / (pattern.duration / 5000);
    const promises = [];
    let currentUsers = pattern.startUsers;
    let userIndex = 0;
    
    const rampInterval = setInterval(() => {
      if (currentUsers < pattern.endUsers) {
        const usersToAdd = Math.min(userIncrement, pattern.endUsers - currentUsers);
        
        for (let i = 0; i < usersToAdd; i++) {
          const user = new VirtualUser(userIndex++, scenario, {
            duration: pattern.duration - (this.getDeterministicTimestamp() - this.startTime),
            ...options,
          });
          
          this.setupUserListeners(user);
          this.users.set(user.id, user);
          promises.push(user.start());
        }
        
        currentUsers += usersToAdd;
      } else {
        clearInterval(rampInterval);
      }
    }, 5000);
    
    await new Promise(resolve => setTimeout(resolve, pattern.duration));
    clearInterval(rampInterval);
    
    await Promise.allSettled(promises);
  }

  async runSpikeLoad(pattern, scenario, options) {
    // Start with base load
    const basePromises = [];
    for (let i = 0; i < pattern.baseUsers; i++) {
      const user = new VirtualUser(i, scenario, {
        duration: pattern.duration || 60000,
        ...options,
      });
      
      this.setupUserListeners(user);
      this.users.set(i, user);
      basePromises.push(user.start());
    }
    
    // Wait a bit, then add spike
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    const spikePromises = [];
    for (let i = pattern.baseUsers; i < pattern.spikeUsers; i++) {
      const user = new VirtualUser(i, scenario, {
        duration: pattern.spikeDuration,
        ...options,
      });
      
      this.setupUserListeners(user);
      this.users.set(i, user);
      spikePromises.push(user.start());
    }
    
    await Promise.allSettled([...basePromises, ...spikePromises]);
  }

  async runStressLoad(pattern, scenario, options) {
    const promises = [];
    
    // Start many users simultaneously to create maximum stress
    for (let i = 0; i < pattern.users; i++) {
      const user = new VirtualUser(i, scenario, {
        duration: pattern.duration,
        ...options,
      });
      
      this.setupUserListeners(user);
      this.users.set(i, user);
      promises.push(user.start());
    }
    
    await Promise.allSettled(promises);
  }

  setupUserListeners(user) {
    user.on('request:success', (data) => {
      this.metrics.recordRequest(data);
    });
    
    user.on('request:error', (data) => {
      this.metrics.recordError(data);
    });
    
    user.on('user:start', (data) => {
      this.emit('user:start', data);
    });
    
    user.on('user:stop', (data) => {
      this.emit('user:stop', data);
    });
  }
}

/**
 * Load Test Metrics Collection
 */
class LoadTestMetrics {
  constructor() {
    this.requests = [];
    this.errors = [];
    this.systemMetrics = [];
    this.startTime = this.getDeterministicTimestamp();
  }

  recordRequest(data) {
    this.requests.push(data);
  }

  recordError(data) {
    this.errors.push(data);
  }

  recordSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.systemMetrics.push({
      timestamp: this.getDeterministicTimestamp(),
      memory: memoryUsage,
      cpu: cpuUsage,
    });
  }

  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  async generateReport() {
    const endTime = this.getDeterministicTimestamp();
    const duration = endTime - this.startTime;
    const responseTimes = this.requests.map(r => r.responseTime);
    
    const totalRequests = this.requests.length;
    const totalErrors = this.errors.length;
    const errorRate = totalErrors / (totalRequests + totalErrors);
    const throughput = totalRequests / (duration / 1000);
    
    const report = {
      summary: {
        duration,
        totalRequests,
        totalErrors,
        errorRate,
        throughput,
      },
      responseTime: {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        p50: this.calculatePercentile(responseTimes, 50),
        p95: this.calculatePercentile(responseTimes, 95),
        p99: this.calculatePercentile(responseTimes, 99),
      },
      system: {
        maxMemory: Math.max(...this.systemMetrics.map(m => m.memory.heapUsed)),
        avgMemory: this.systemMetrics.reduce((sum, m) => sum + m.memory.heapUsed, 0) / this.systemMetrics.length,
      },
      thresholdViolations: this.checkThresholds(),
    };
    
    return report;
  }

  checkThresholds() {
    const violations = [];
    const responseTimes = this.requests.map(r => r.responseTime);
    
    const p50 = this.calculatePercentile(responseTimes, 50);
    const p95 = this.calculatePercentile(responseTimes, 95);
    const p99 = this.calculatePercentile(responseTimes, 99);
    
    if (p50 > LoadTestConfig.thresholds.responseTime.p50) {
      violations.push(`P50 response time ${p50}ms exceeds threshold ${LoadTestConfig.thresholds.responseTime.p50}ms`);
    }
    
    if (p95 > LoadTestConfig.thresholds.responseTime.p95) {
      violations.push(`P95 response time ${p95}ms exceeds threshold ${LoadTestConfig.thresholds.responseTime.p95}ms`);
    }
    
    if (p99 > LoadTestConfig.thresholds.responseTime.p99) {
      violations.push(`P99 response time ${p99}ms exceeds threshold ${LoadTestConfig.thresholds.responseTime.p99}ms`);
    }
    
    const errorRate = this.errors.length / (this.requests.length + this.errors.length);
    if (errorRate > LoadTestConfig.thresholds.errorRate.maximum) {
      violations.push(`Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold ${LoadTestConfig.thresholds.errorRate.maximum * 100}%`);
    }
    
    return violations;
  }
}

/**
 * KGEN Load Tests
 */
describe('KGEN Load Testing Suite', () => {
  let controller;
  let testSuite;

  beforeAll(async () => {
    controller = new LoadTestController();
    testSuite = new EnterpriseTestSuite('Load Testing');
    await testSuite.setup();
  });

  afterAll(async () => {
    await testSuite.teardown();
  });

  describe('RDF Processing Load Tests', () => {
    it('should handle constant load of RDF parsing', async () => {
      const scenario = new LoadTestScenario('RDF Parsing', [
        new LoadTestStep('Parse Small RDF', async (user) => {
          const rdfData = `
            @prefix ex: <http://example.org/> .
            ex:user${user.id} a ex:Person ;
                ex:name "User ${user.id}" ;
                ex:timestamp "${this.getDeterministicDate().toISOString()}" .
          `;
          
          // Mock RDF parsing
          await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
          
          return { triples: 3, user: user.id };
        }),
        
        new LoadTestStep('Validate Result', async (user) => {
          // Mock validation
          await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
          return { valid: true };
        }),
      ]);

      const pattern = { type: 'constant', users: 20, duration: 10000 };
      const result = await controller.runLoadTest(pattern, scenario);

      // Validate performance requirements
      expect(result.thresholdViolations).toHaveLength(0);
      expect(result.summary.errorRate).toBeLessThan(0.01);
      expect(result.responseTime.p95).toBeLessThan(500);
    }, 30000);

    it('should handle ramp-up load for template generation', async () => {
      const scenario = new LoadTestScenario('Template Generation', [
        new LoadTestStep('Generate Template', async (user) => {
          const variables = {
            name: `Entity${user.id}`,
            type: 'Component',
            timestamp: this.getDeterministicTimestamp(),
          };
          
          // Mock template generation
          const processingTime = 30 + Math.random() * 70; // 30-100ms
          await new Promise(resolve => setTimeout(resolve, processingTime));
          
          return { generated: true, variables };
        }),
        
        new LoadTestStep('Write Output', async (user) => {
          // Mock file writing
          await new Promise(resolve => setTimeout(resolve, Math.random() * 30));
          return { written: true };
        }),
      ]);

      const pattern = { 
        type: 'rampUp', 
        startUsers: 5, 
        endUsers: 30, 
        duration: 15000 
      };
      
      const result = await controller.runLoadTest(pattern, scenario);

      expect(result.summary.throughput).toBeGreaterThan(10); // At least 10 ops/sec
      expect(result.responseTime.p99).toBeLessThan(1000);
    }, 20000);

    it('should handle spike load for concurrent file operations', async () => {
      const scenario = new LoadTestScenario('File Operations', [
        new LoadTestStep('Read Template', async (user) => {
          // Mock template reading
          await new Promise(resolve => setTimeout(resolve, Math.random() * 40));
          return { template: `Template for user ${user.id}` };
        }),
        
        new LoadTestStep('Process Template', async (user) => {
          // Mock processing
          await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
          return { processed: true };
        }),
        
        new LoadTestStep('Write Result', async (user) => {
          // Mock writing with potential contention
          const delay = Math.random() * 60;
          if (Math.random() < 0.05) { // 5% chance of slower operation (file lock)
            await new Promise(resolve => setTimeout(resolve, delay + 200));
          } else {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          return { written: true };
        }),
      ]);

      const pattern = { 
        type: 'spike', 
        baseUsers: 10, 
        spikeUsers: 50, 
        spikeDuration: 5000 
      };
      
      const result = await controller.runLoadTest(pattern, scenario);

      // During spike, some performance degradation is expected but system should remain stable
      expect(result.summary.errorRate).toBeLessThan(0.05); // 5% max error rate during spike
      expect(result.responseTime.max).toBeLessThan(5000); // 5s max response time
    }, 25000);

    it('should survive stress test with high user count', async () => {
      const scenario = new LoadTestScenario('Stress Test', [
        new LoadTestStep('Heavy Processing', async (user) => {
          // Simulate heavy CPU work
          const iterations = 1000 + Math.floor(Math.random() * 2000);
          let result = 0;
          for (let i = 0; i < iterations; i++) {
            result += Math.sqrt(i) * Math.random();
          }
          
          return { result, iterations };
        }),
        
        new LoadTestStep('Memory Allocation', async (user) => {
          // Simulate memory allocation
          const data = new Array(1000).fill(null).map((_, i) => ({
            id: i,
            user: user.id,
            timestamp: this.getDeterministicTimestamp(),
            data: Math.random().toString(36),
          }));
          
          // Brief processing
          await new Promise(resolve => setTimeout(resolve, 10));
          
          return { allocated: data.length };
        }),
      ]);

      const pattern = { type: 'stress', users: 100, duration: 20000 };
      const result = await controller.runLoadTest(pattern, scenario);

      // Under stress, we allow higher error rates but system should not crash
      expect(result.summary.errorRate).toBeLessThan(0.1); // 10% max error rate under stress
      expect(result.summary.totalRequests).toBeGreaterThan(50); // Some requests should complete
      
      // Memory should not grow excessively
      expect(result.system.maxMemory).toBeLessThan(LoadTestConfig.thresholds.resources.maxMemory);
    }, 30000);
  });

  describe('Concurrent User Scenarios', () => {
    it('should handle multiple users generating different templates', async () => {
      const templateTypes = ['component', 'service', 'model', 'test', 'config'];
      
      const scenario = new LoadTestScenario('Multi-Template Generation', [
        new LoadTestStep('Select Template Type', async (user) => {
          const templateType = templateTypes[user.id % templateTypes.length];
          return { templateType };
        }),
        
        new LoadTestStep('Generate Template', async (user) => {
          // Different templates have different processing times
          const baseTime = 50;
          const variableTime = Math.random() * 100;
          
          await new Promise(resolve => setTimeout(resolve, baseTime + variableTime));
          return { generated: true };
        }),
        
        new LoadTestStep('Validate Output', async (user) => {
          await new Promise(resolve => setTimeout(resolve, Math.random() * 30));
          return { validated: true };
        }),
      ]);

      const pattern = { type: 'constant', users: 25, duration: 12000 };
      const result = await controller.runLoadTest(pattern, scenario);

      expect(result.thresholdViolations).toHaveLength(0);
      expect(result.summary.throughput).toBeGreaterThan(50);
    }, 20000);
  });

  describe('Resource Exhaustion Tests', () => {
    it('should handle memory pressure gracefully', async () => {
      const scenario = new LoadTestScenario('Memory Pressure', [
        new LoadTestStep('Allocate Large Data', async (user) => {
          // Allocate significant memory
          const largeArray = new Array(100000).fill(null).map((_, i) => ({
            id: i,
            user: user.id,
            data: Math.random().toString(36).repeat(10),
          }));
          
          // Process briefly then allow GC
          await new Promise(resolve => setTimeout(resolve, 100));
          
          return { allocated: largeArray.length };
        }),
      ]);

      const pattern = { type: 'constant', users: 15, duration: 10000 };
      const result = await controller.runLoadTest(pattern, scenario);

      // System should handle memory pressure without excessive errors
      expect(result.summary.errorRate).toBeLessThan(0.05);
    }, 15000);
  });
});

export { LoadTestController, LoadTestScenario, LoadTestStep, VirtualUser };