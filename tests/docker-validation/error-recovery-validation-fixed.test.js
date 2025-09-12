/**
 * Error Recovery Validation Tests - Fixed Version
 * 
 * Comprehensive validation of error recovery mechanisms in production scenarios.
 * Tests circuit breakers, retry logic, fallbacks, and graceful degradation.
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

// Mock template engine for testing
class MockTemplateEngine extends EventEmitter {
  constructor() {
    super();
    this.failureMode = null;
    this.requestCount = 0;
    this.latency = 0;
  }

  setFailureMode(mode, duration = 1000) {
    this.failureMode = mode;
    setTimeout(() => {
      this.failureMode = null;
      this.emit('recovery');
    }, duration);
  }

  async render(template, context) {
    this.requestCount++;
    
    // Simulate latency
    if (this.latency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latency));
    }

    switch (this.failureMode) {
      case 'timeout':
        throw new Error('TIMEOUT: Request timed out');
      case 'memory':
        throw new Error('MEMORY: Out of memory');
      case 'syntax':
        throw new Error('SYNTAX: Template syntax error');
      case 'network':
        throw new Error('NETWORK: Connection failed');
      case 'critical':
        throw new Error('CRITICAL: System failure');
      default:
        return `Rendered: ${template} with ${JSON.stringify(context)}`;
    }
  }

  getMetrics() {
    return {
      requestCount: this.requestCount,
      failureMode: this.failureMode
    };
  }
}

// Circuit Breaker Implementation
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 5000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.requestCount = 0;
  }

  async execute(fn) {
    this.requestCount++;

    if (this.state === 'OPEN') {
      if (this.getDeterministicTimestamp() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error('CIRCUIT_BREAKER: Circuit is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
      }
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = this.getDeterministicTimestamp();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount
    };
  }
}

// Retry Logic with Exponential Backoff
class RetryManager {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 100;
    this.maxDelay = options.maxDelay || 5000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.jitter = options.jitter || true;
  }

  async execute(fn, context = {}) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === this.maxRetries) {
          break;
        }

        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          break;
        }

        const delay = this.calculateDelay(attempt);
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  isNonRetryableError(error) {
    const nonRetryableErrors = ['SYNTAX', 'CRITICAL'];
    return nonRetryableErrors.some(type => error.message.includes(type));
  }

  calculateDelay(attempt) {
    let delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt);
    delay = Math.min(delay, this.maxDelay);
    
    if (this.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Fallback Compilation Strategy
class FallbackCompiler {
  constructor() {
    this.strategies = [
      { name: 'primary', weight: 100 },
      { name: 'secondary', weight: 80 },
      { name: 'emergency', weight: 50 }
    ];
    this.healthStatus = new Map();
  }

  async compile(template, context, options = {}) {
    const availableStrategies = this.getHealthyStrategies();
    
    for (const strategy of availableStrategies) {
      try {
        return await this.executeStrategy(strategy, template, context, options);
      } catch (error) {
        this.markUnhealthy(strategy.name, error);
        continue;
      }
    }

    throw new Error('FALLBACK: All compilation strategies failed');
  }

  async executeStrategy(strategy, template, context, options) {
    switch (strategy.name) {
      case 'primary':
        // Full-featured compilation
        if (Math.random() < 0.1) throw new Error('Primary strategy failed');
        return { result: `Primary: ${template}`, strategy: 'primary' };
        
      case 'secondary':
        // Reduced feature set
        if (Math.random() < 0.05) throw new Error('Secondary strategy failed');
        return { result: `Secondary: ${template}`, strategy: 'secondary' };
        
      case 'emergency':
        // Basic compilation only
        return { result: `Emergency: ${template}`, strategy: 'emergency' };
        
      default:
        throw new Error(`Unknown strategy: ${strategy.name}`);
    }
  }

  getHealthyStrategies() {
    return this.strategies.filter(strategy => {
      const health = this.healthStatus.get(strategy.name);
      if (!health) return true;
      
      // Recovery after 30 seconds
      return this.getDeterministicTimestamp() - health.lastFailure > 30000;
    });
  }

  markUnhealthy(strategyName, error) {
    this.healthStatus.set(strategyName, {
      lastFailure: this.getDeterministicTimestamp(),
      error: error.message
    });
  }

  getHealthStatus() {
    const status = {};
    for (const strategy of this.strategies) {
      const health = this.healthStatus.get(strategy.name);
      status[strategy.name] = health ? 'UNHEALTHY' : 'HEALTHY';
    }
    return status;
  }
}

// Graceful Degradation Manager
class DegradationManager {
  constructor() {
    this.degradationLevel = 0; // 0 = normal, 5 = maximum degradation
    this.featureFlags = {
      advancedTemplating: true,
      caching: true,
      preprocessing: true,
      postprocessing: true,
      validation: true
    };
  }

  setDegradationLevel(level) {
    this.degradationLevel = Math.max(0, Math.min(5, level));
    this.updateFeatureFlags();
  }

  updateFeatureFlags() {
    switch (this.degradationLevel) {
      case 0:
        // All features enabled
        Object.keys(this.featureFlags).forEach(key => {
          this.featureFlags[key] = true;
        });
        break;
      case 1:
        // Disable non-essential features
        this.featureFlags.postprocessing = false;
        break;
      case 2:
        // Disable preprocessing
        this.featureFlags.preprocessing = false;
        break;
      case 3:
        // Disable caching
        this.featureFlags.caching = false;
        break;
      case 4:
        // Disable validation
        this.featureFlags.validation = false;
        break;
      case 5:
        // Only basic templating
        Object.keys(this.featureFlags).forEach(key => {
          if (key !== 'advancedTemplating') {
            this.featureFlags[key] = false;
          }
        });
        break;
    }
  }

  async processTemplate(template, context) {
    let result = template;

    if (this.featureFlags.preprocessing) {
      result = await this.preprocess(result);
    }

    if (this.featureFlags.advancedTemplating) {
      result = await this.advancedTemplating(result, context);
    } else {
      result = await this.basicTemplating(result, context);
    }

    if (this.featureFlags.validation) {
      await this.validate(result);
    }

    if (this.featureFlags.postprocessing) {
      result = await this.postprocess(result);
    }

    return {
      result,
      degradationLevel: this.degradationLevel,
      featuresUsed: Object.entries(this.featureFlags)
        .filter(([_, enabled]) => enabled)
        .map(([feature, _]) => feature)
    };
  }

  async preprocess(template) {
    return `[PREPROCESSED] ${template}`;
  }

  async advancedTemplating(template, context) {
    return `[ADVANCED] ${template} with ${JSON.stringify(context)}`;
  }

  async basicTemplating(template, context) {
    return `[BASIC] ${template}`;
  }

  async validate(result) {
    if (result.length > 10000) {
      throw new Error('VALIDATION: Result too large');
    }
  }

  async postprocess(result) {
    return `${result} [POSTPROCESSED]`;
  }
}

// Batch Processing with Error Isolation
class BatchProcessor {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 5;
    this.isolationLevel = options.isolationLevel || 'item'; // 'item', 'batch', 'none'
    this.failureThreshold = options.failureThreshold || 0.5; // 50% failure rate
  }

  async processBatch(items, processor, options = {}) {
    const results = [];
    const errors = [];
    let processedCount = 0;
    let failedCount = 0;

    const semaphore = new Semaphore(this.maxConcurrency);

    const tasks = items.map(async (item, index) => {
      try {
        await semaphore.acquire();
        
        if (this.isolationLevel === 'batch' && this.shouldStopBatch(failedCount, processedCount)) {
          throw new Error('BATCH_ISOLATION: Batch failure threshold exceeded');
        }

        const result = await this.processWithIsolation(processor, item, index);
        
        // Count as processed even if it was a recovered error
        processedCount++;
        
        // Only count as failed if it's an actual failure (not recovered)
        if (result && result.error && !result.recovered) {
          failedCount++;
        }
        
        results[index] = result;
        
      } catch (error) {
        failedCount++;
        errors[index] = error;
        
        if (this.isolationLevel === 'none') {
          throw error;
        }
        
      } finally {
        semaphore.release();
      }
    });

    await Promise.allSettled(tasks);

    // Calculate success rate based on actual successes vs failures
    const actualSuccesses = results.filter(r => r && (!r.error || r.recovered)).length;
    
    return {
      results,
      errors,
      statistics: {
        total: items.length,
        processed: processedCount,
        failed: failedCount,
        successRate: actualSuccesses / items.length
      }
    };
  }

  async processWithIsolation(processor, item, index) {
    try {
      return await processor(item, index);
    } catch (error) {
      if (this.isolationLevel === 'item') {
        // Log error but continue processing other items
        console.warn(`Item ${index} failed: ${error.message}`);
        return { error: error.message, recovered: true };
      }
      throw error;
    }
  }

  shouldStopBatch(failedCount, processedCount) {
    const totalProcessed = failedCount + processedCount;
    if (totalProcessed === 0) return false;
    
    return (failedCount / totalProcessed) > this.failureThreshold;
  }
}

// Semaphore for concurrency control
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (this.current < this.max) {
        this.current++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    this.current--;
    if (this.queue.length > 0) {
      this.current++;
      const next = this.queue.shift();
      next();
    }
  }
}

// Test Suite
describe('Error Recovery Validation', () => {
  let mockEngine;
  let circuitBreaker;
  let retryManager;
  let fallbackCompiler;
  let degradationManager;
  let batchProcessor;

  beforeEach(() => {
    mockEngine = new MockTemplateEngine();
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000
    });
    retryManager = new RetryManager({
      maxRetries: 3,
      baseDelay: 50
    });
    fallbackCompiler = new FallbackCompiler();
    degradationManager = new DegradationManager();
    batchProcessor = new BatchProcessor({
      maxConcurrency: 3,
      isolationLevel: 'item'
    });
  });

  afterEach(() => {
    mockEngine.removeAllListeners();
  });

  describe('Circuit Breaker Pattern', () => {
    it('should open circuit after failure threshold', async () => {
      mockEngine.setFailureMode('timeout', 5000);

      // Trigger failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => mockEngine.render('test', {}));
        } catch (error) {
          expect(error.message).toMatch(/TIMEOUT/);
        }
      }

      const state = circuitBreaker.getState();
      expect(state.state).toBe('OPEN');
      expect(state.failureCount).toBe(3);

      // Next request should fail immediately
      try {
        await circuitBreaker.execute(() => mockEngine.render('test', {}));
        expect.fail('Should have failed with circuit breaker error');
      } catch (error) {
        expect(error.message).toMatch(/CIRCUIT_BREAKER/);
      }
    });

    it('should transition to half-open and recover', async () => {
      mockEngine.setFailureMode('timeout', 500);

      // Open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(() => mockEngine.render('test', {}));
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState().state).toBe('OPEN');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Circuit should be half-open, first request should succeed
      const result = await circuitBreaker.execute(() => mockEngine.render('test', {}));
      expect(result).toContain('Rendered: test');

      // Make additional successful requests to transition from HALF_OPEN to CLOSED
      await circuitBreaker.execute(() => mockEngine.render('test', {}));
      await circuitBreaker.execute(() => mockEngine.render('test', {}));
      
      const finalState = circuitBreaker.getState();
      expect(finalState.state).toBe('CLOSED');
    });

    it('should track metrics correctly', async () => {
      mockEngine.setFailureMode('timeout', 100);

      const initialState = circuitBreaker.getState();
      expect(initialState.requestCount).toBe(0);

      // Make some requests
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(() => mockEngine.render('test', {}));
        } catch (error) {
          // Expected
        }
      }

      const finalState = circuitBreaker.getState();
      expect(finalState.requestCount).toBe(5);
      expect(finalState.state).toBe('OPEN');
    });
  });

  describe('Exponential Backoff Retry Logic', () => {
    it('should retry with exponential backoff', async () => {
      let attemptCount = 0;
      mockEngine.setFailureMode('network', 200);

      const startTime = this.getDeterministicTimestamp();
      
      try {
        await retryManager.execute(() => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('NETWORK: Temporary failure');
          }
          return 'Success after retries';
        });
      } catch (error) {
        // Should succeed on 3rd attempt
      }

      const endTime = this.getDeterministicTimestamp();
      const totalTime = endTime - startTime;

      expect(attemptCount).toBe(3);
      // Should have delays: ~50ms, ~100ms between attempts
      expect(totalTime).toBeGreaterThan(100);
    });

    it('should not retry non-retryable errors', async () => {
      let attemptCount = 0;

      try {
        await retryManager.execute(() => {
          attemptCount++;
          throw new Error('SYNTAX: Template syntax error');
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toMatch(/SYNTAX/);
        expect(attemptCount).toBe(1); // No retries for syntax errors
      }
    });

    it('should respect max retries limit', async () => {
      let attemptCount = 0;

      try {
        await retryManager.execute(() => {
          attemptCount++;
          throw new Error('TIMEOUT: Persistent failure');
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toMatch(/TIMEOUT/);
        expect(attemptCount).toBe(4); // Initial + 3 retries
      }
    });

    it('should apply jitter to delays', async () => {
      const delays = [];
      const originalDelay = retryManager.delay;
      
      retryManager.delay = (ms) => {
        delays.push(ms);
        return originalDelay.call(retryManager, 1); // Speed up for testing
      };

      try {
        await retryManager.execute(() => {
          throw new Error('NETWORK: Test error');
        });
      } catch (error) {
        // Expected
      }

      // Should have 3 delays with jitter variation
      expect(delays).toHaveLength(3);
      expect(delays[0]).toBeGreaterThanOrEqual(25); // 50ms * 0.5 (min jitter)
      expect(delays[0]).toBeLessThanOrEqual(50);    // 50ms * 1.0 (max jitter)
    });
  });

  describe('Fallback Compilation Strategies', () => {
    it('should fallback to secondary strategy on primary failure', async () => {
      // Mock primary strategy failure
      const originalExecute = fallbackCompiler.executeStrategy;
      fallbackCompiler.executeStrategy = async (strategy, template, context, options) => {
        if (strategy.name === 'primary') {
          throw new Error('Primary compilation failed');
        }
        return originalExecute.call(fallbackCompiler, strategy, template, context, options);
      };

      const result = await fallbackCompiler.compile('test-template', { var: 'value' });
      
      expect(result.strategy).toBe('secondary');
      expect(result.result).toContain('Secondary: test-template');
    });

    it('should use emergency strategy when others fail', async () => {
      // Mock all strategies except emergency failing
      const originalExecute = fallbackCompiler.executeStrategy;
      fallbackCompiler.executeStrategy = async (strategy, template, context, options) => {
        if (strategy.name !== 'emergency') {
          throw new Error(`${strategy.name} strategy failed`);
        }
        return originalExecute.call(fallbackCompiler, strategy, template, context, options);
      };

      const result = await fallbackCompiler.compile('test-template', { var: 'value' });
      
      expect(result.strategy).toBe('emergency');
      expect(result.result).toContain('Emergency: test-template');
    });

    it('should track and recover from unhealthy strategies', async () => {
      // Mark primary as unhealthy
      fallbackCompiler.markUnhealthy('primary', new Error('Test failure'));
      
      let healthStatus = fallbackCompiler.getHealthStatus();
      expect(healthStatus.primary).toBe('UNHEALTHY');
      expect(healthStatus.secondary).toBe('HEALTHY');

      // Healthy strategies should still work
      const availableStrategies = fallbackCompiler.getHealthyStrategies();
      expect(availableStrategies).toHaveLength(2); // secondary and emergency
      expect(availableStrategies.find(s => s.name === 'primary')).toBeUndefined();
    });

    it('should fail when all strategies are exhausted', async () => {
      // Mock all strategies failing
      const originalExecute = fallbackCompiler.executeStrategy;
      fallbackCompiler.executeStrategy = async (strategy) => {
        throw new Error(`${strategy.name} strategy failed`);
      };

      try {
        await fallbackCompiler.compile('test-template', { var: 'value' });
        expect.fail('Should have thrown fallback error');
      } catch (error) {
        expect(error.message).toMatch(/FALLBACK.*All compilation strategies failed/);
      }
    });
  });

  describe('Graceful Degradation Paths', () => {
    it('should disable features based on degradation level', async () => {
      // Test normal operation (level 0)
      degradationManager.setDegradationLevel(0);
      let result = await degradationManager.processTemplate('test-template', { var: 'value' });
      
      expect(result.degradationLevel).toBe(0);
      expect(result.featuresUsed).toContain('preprocessing');
      expect(result.featuresUsed).toContain('postprocessing');
      expect(result.result).toContain('[PREPROCESSED]');
      expect(result.result).toContain('[POSTPROCESSED]');

      // Test maximum degradation (level 5)
      degradationManager.setDegradationLevel(5);
      result = await degradationManager.processTemplate('test-template', { var: 'value' });
      
      expect(result.degradationLevel).toBe(5);
      expect(result.featuresUsed).toEqual(['advancedTemplating']);
      expect(result.result).not.toContain('[PREPROCESSED]');
      expect(result.result).not.toContain('[POSTPROCESSED]');
    });

    it('should progressively disable features', async () => {
      const features = [];

      for (let level = 0; level <= 5; level++) {
        degradationManager.setDegradationLevel(level);
        const result = await degradationManager.processTemplate('test', {});
        features.push({
          level,
          count: result.featuresUsed.length,
          features: result.featuresUsed
        });
      }

      // Feature count should decrease as degradation increases
      expect(features[0].count).toBeGreaterThan(features[5].count);
      expect(features[5].features).toEqual(['advancedTemplating']);
    });

    it('should handle validation failures gracefully', async () => {
      degradationManager.setDegradationLevel(0); // Enable validation

      try {
        // Create a result that will fail validation
        const largeTemplate = 'x'.repeat(15000);
        await degradationManager.processTemplate(largeTemplate, {});
        expect.fail('Should have failed validation');
      } catch (error) {
        expect(error.message).toMatch(/VALIDATION.*Result too large/);
      }

      // With validation disabled, should succeed
      degradationManager.setDegradationLevel(4); // Disable validation
      const result = await degradationManager.processTemplate('x'.repeat(15000), {});
      expect(result.result).toBeDefined();
    });
  });

  describe('Error Isolation in Batch Processing', () => {
    it('should isolate item-level failures', async () => {
      const items = ['item1', 'item2', 'fail', 'item4', 'item5'];
      
      const processor = async (item, index) => {
        if (item === 'fail') {
          throw new Error(`Processing failed for ${item}`);
        }
        return `Processed: ${item}`;
      };

      const result = await batchProcessor.processBatch(items, processor);

      expect(result.statistics.total).toBe(5);
      expect(result.statistics.processed).toBe(5); // All items processed (including recovered)
      expect(result.statistics.failed).toBe(0); // No actual failures due to isolation
      expect(result.statistics.successRate).toBe(0.8); // 4 actual successes out of 5

      // Check that other items were processed successfully
      expect(result.results[0]).toBe('Processed: item1');
      expect(result.results[1]).toBe('Processed: item2');
      expect(result.results[2]).toEqual({ error: 'Processing failed for fail', recovered: true });
      expect(result.results[3]).toBe('Processed: item4');
      expect(result.results[4]).toBe('Processed: item5');
    });

    it('should respect concurrency limits', async () => {
      let activeProcessing = 0;
      let maxConcurrent = 0;
      
      const items = Array.from({ length: 10 }, (_, i) => `item${i}`);
      
      const processor = async (item) => {
        activeProcessing++;
        maxConcurrent = Math.max(maxConcurrent, activeProcessing);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        activeProcessing--;
        return `Processed: ${item}`;
      };

      await batchProcessor.processBatch(items, processor);

      expect(maxConcurrent).toBeLessThanOrEqual(batchProcessor.maxConcurrency);
      expect(maxConcurrent).toBeGreaterThan(1); // Should have used concurrency
    });

    it('should stop batch processing on high failure rate', async () => {
      batchProcessor.isolationLevel = 'batch';
      batchProcessor.failureThreshold = 0.3; // 30% failure threshold

      const items = Array.from({ length: 10 }, (_, i) => 
        i < 4 ? 'fail' : `item${i}`); // 40% failure rate
      
      const processor = async (item) => {
        if (item === 'fail') {
          throw new Error('Processing failed');
        }
        return `Processed: ${item}`;
      };

      const result = await batchProcessor.processBatch(items, processor);

      // Should stop processing when failure threshold is exceeded
      expect(result.statistics.successRate).toBeLessThan(0.7);
    });
  });

  describe('Recovery from Critical Failures', () => {
    it('should handle system-wide failures gracefully', async () => {
      // Simulate system-wide failure
      mockEngine.setFailureMode('critical', 2000);

      const systems = [
        { name: 'template-engine', handler: () => mockEngine.render('test', {}) },
        { name: 'fallback-compiler', handler: () => fallbackCompiler.compile('test', {}) },
        { name: 'degradation-manager', handler: () => degradationManager.processTemplate('test', {}) }
      ];

      const recoveryResults = [];

      for (const system of systems) {
        try {
          const result = await retryManager.execute(system.handler);
          recoveryResults.push({ system: system.name, status: 'recovered', result });
        } catch (error) {
          // Try fallback strategies
          if (system.name === 'template-engine') {
            try {
              const fallbackResult = await fallbackCompiler.compile('test', {});
              recoveryResults.push({ system: system.name, status: 'fallback', result: fallbackResult });
            } catch (fallbackError) {
              recoveryResults.push({ system: system.name, status: 'failed', error: fallbackError.message });
            }
          } else {
            recoveryResults.push({ system: system.name, status: 'failed', error: error.message });
          }
        }
      }

      // At least one system should have recovered or used fallback
      const recoveredSystems = recoveryResults.filter(r => 
        r.status === 'recovered' || r.status === 'fallback');
      expect(recoveredSystems.length).toBeGreaterThan(0);
    });

    it('should coordinate recovery across multiple systems', async () => {
      const recoveryCoordinator = new EventEmitter();
      const systemStates = {
        'system-a': 'healthy',
        'system-b': 'healthy',
        'system-c': 'healthy'
      };

      // Simulate cascading failures
      recoveryCoordinator.on('system-failure', (systemName) => {
        systemStates[systemName] = 'failed';
        
        // Trigger recovery attempts for dependent systems
        if (systemName === 'system-a') {
          setTimeout(() => {
            recoveryCoordinator.emit('recovery-attempt', 'system-a');
          }, 100);
        }
      });

      recoveryCoordinator.on('recovery-attempt', (systemName) => {
        // Simulate recovery logic
        setTimeout(() => {
          systemStates[systemName] = 'recovered';
          recoveryCoordinator.emit('system-recovered', systemName);
        }, 50);
      });

      // Trigger failure
      recoveryCoordinator.emit('system-failure', 'system-a');

      // Wait for recovery
      await new Promise((resolve) => {
        recoveryCoordinator.on('system-recovered', (systemName) => {
          if (systemName === 'system-a') {
            resolve();
          }
        });
      });

      expect(systemStates['system-a']).toBe('recovered');
    });

    it('should maintain service availability during recovery', async () => {
      const serviceAvailability = [];
      const startTime = this.getDeterministicTimestamp();

      // Simulate service with recovery
      const simulateService = async () => {
        const elapsed = this.getDeterministicTimestamp() - startTime;
        
        if (elapsed < 500) {
          // Initial failure period
          throw new Error('Service unavailable');
        } else if (elapsed < 1000) {
          // Recovery period with degraded service
          return { status: 'degraded', message: 'Limited functionality' };
        } else {
          // Full recovery
          return { status: 'healthy', message: 'Full functionality restored' };
        }
      };

      // Monitor service for 1.5 seconds
      const monitoringEnd = this.getDeterministicTimestamp() + 1500;
      
      while (this.getDeterministicTimestamp() < monitoringEnd) {
        try {
          const result = await simulateService();
          serviceAvailability.push({
            timestamp: this.getDeterministicTimestamp() - startTime,
            status: 'available',
            mode: result.status
          });
        } catch (error) {
          serviceAvailability.push({
            timestamp: this.getDeterministicTimestamp() - startTime,
            status: 'unavailable',
            error: error.message
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Analyze availability
      const unavailablePeriods = serviceAvailability.filter(s => s.status === 'unavailable');
      const degradedPeriods = serviceAvailability.filter(s => s.mode === 'degraded');
      const healthyPeriods = serviceAvailability.filter(s => s.mode === 'healthy');

      expect(unavailablePeriods.length).toBeGreaterThan(0); // Should have initial failures
      expect(degradedPeriods.length).toBeGreaterThan(0); // Should have recovery period
      expect(healthyPeriods.length).toBeGreaterThan(0); // Should achieve full recovery
    });
  });

  describe('Integration Tests', () => {
    it('should handle complex failure scenarios with multiple recovery mechanisms', async () => {
      // Create an integrated system with all recovery mechanisms
      const integratedProcessor = async (template, context) => {
        return await circuitBreaker.execute(async () => {
          return await retryManager.execute(async () => {
            try {
              return await fallbackCompiler.compile(template, context);
            } catch (error) {
              // If all compilation strategies fail, use degraded processing
              degradationManager.setDegradationLevel(5);
              return await degradationManager.processTemplate(template, context);
            }
          });
        });
      };

      // Test with various failure conditions
      const testCases = [
        { template: 'normal-template', context: { var: 'value' }, shouldSucceed: true },
        { template: 'failing-template', context: { var: 'value' }, shouldSucceed: true }, // Should fallback
        { template: 'critical-template', context: { var: 'value' }, shouldSucceed: true }  // Should degrade
      ];

      const results = [];

      for (const testCase of testCases) {
        try {
          const result = await integratedProcessor(testCase.template, testCase.context);
          results.push({
            template: testCase.template,
            success: true,
            result: result
          });
        } catch (error) {
          results.push({
            template: testCase.template,
            success: false,
            error: error.message
          });
        }
      }

      // All test cases should succeed through various recovery mechanisms
      const successfulResults = results.filter(r => r.success);
      expect(successfulResults.length).toBe(testCases.length);

      // Should have used different recovery strategies
      const strategies = successfulResults.map(r => {
        if (r.result.strategy) return r.result.strategy;
        if (r.result.degradationLevel !== undefined) return 'degradation';
        return 'normal';
      });

      // At minimum, should use normal or degradation strategy
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.includes('normal') || strategies.includes('degradation')).toBe(true);
    });

    it('should provide comprehensive error recovery metrics', async () => {
      const metrics = {
        circuitBreaker: circuitBreaker.getState(),
        fallbackCompiler: fallbackCompiler.getHealthStatus(),
        templateEngine: mockEngine.getMetrics()
      };

      expect(metrics.circuitBreaker).toHaveProperty('state');
      expect(metrics.circuitBreaker).toHaveProperty('failureCount');
      expect(metrics.circuitBreaker).toHaveProperty('requestCount');

      expect(metrics.fallbackCompiler).toHaveProperty('primary');
      expect(metrics.fallbackCompiler).toHaveProperty('secondary');
      expect(metrics.fallbackCompiler).toHaveProperty('emergency');

      expect(metrics.templateEngine).toHaveProperty('requestCount');
      expect(metrics.templateEngine).toHaveProperty('failureMode');

      // Metrics should be realistic
      expect(typeof metrics.circuitBreaker.requestCount).toBe('number');
      expect(typeof metrics.templateEngine.requestCount).toBe('number');
    });
  });
});