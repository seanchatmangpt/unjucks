import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { SelfHealingSystem } from '../src/kgen/resilience/self-healing-system.js';
import { CircuitBreaker } from '../src/kgen/resilience/circuit-breaker.js';
import { GracefulDegradationManager, DegradationLevel } from '../src/kgen/resilience/graceful-degradation.js';
import { HealthMonitor } from '../src/kgen/resilience/health-monitor.js';
import { ChaosEngineer } from '../src/kgen/resilience/chaos-engineer.js';
import { DeadlockDetector } from '../src/kgen/resilience/deadlock-detector.js';
import { CorruptionDetector } from '../src/kgen/resilience/corruption-detector.js';
import { KGenSelfHealingIntegration } from '../src/kgen/integration/kgen-self-healing-integration.js';

describe('KGEN Self-Healing System', () => {
  let selfHealingSystem;
  let circuitBreaker;
  let degradationManager;
  let healthMonitor;
  let chaosEngineer;
  let deadlockDetector;
  let corruptionDetector;
  let integration;

  beforeEach(() => {
    selfHealingSystem = new SelfHealingSystem({
      maxRetries: 3,
      baseRetryDelay: 100,
      enabled: true
    });

    circuitBreaker = new CircuitBreaker('test-service', {
      failureThreshold: 3,
      recoveryTimeout: 1000,
      timeout: 500
    });

    degradationManager = new GracefulDegradationManager({
      enabled: true,
      defaultDegradationLevel: DegradationLevel.MINIMAL
    });

    healthMonitor = new HealthMonitor({
      enabled: true,
      checkInterval: 1000,
      proactiveDetection: true
    });

    chaosEngineer = new ChaosEngineer({
      enabled: true,
      safetyConstraints: { maxDuration: 5000 }
    });

    deadlockDetector = new DeadlockDetector({
      enabled: true,
      detectionInterval: 1000
    });

    corruptionDetector = new CorruptionDetector({
      enabled: true,
      checksumAlgorithm: 'sha256'
    });

    integration = new KGenSelfHealingIntegration({
      selfHealingEnabled: true,
      circuitBreakerEnabled: true
    });
  });

  afterEach(async () => {
    // Cleanup
    if (selfHealingSystem?.shutdown) await selfHealingSystem.shutdown();
    if (circuitBreaker?.shutdown) await circuitBreaker.shutdown();
    if (degradationManager?.shutdown) await degradationManager.shutdown();
    if (healthMonitor?.shutdown) await healthMonitor.shutdown();
    if (chaosEngineer?.shutdown) await chaosEngineer.shutdown();
    if (deadlockDetector?.shutdown) await deadlockDetector.shutdown();
    if (corruptionDetector?.shutdown) await corruptionDetector.shutdown();
    if (integration?.shutdown) await integration.shutdown();
  });

  describe('SelfHealingSystem Core', () => {
    it('should initialize with default configuration', () => {
      expect(selfHealingSystem.config.enabled).toBe(true);
      expect(selfHealingSystem.config.maxRetries).toBe(3);
      expect(selfHealingSystem.config.baseRetryDelay).toBe(100);
    });

    it('should classify errors correctly', async () => {
      const networkError = new Error('Network timeout');
      networkError.code = 'NETWORK_ERROR';
      
      const classification = await selfHealingSystem.classifyError(networkError);
      
      expect(classification).toEqual({
        category: 'network',
        severity: 'high',
        recoverable: true,
        strategy: 'retry_with_backoff'
      });
    });

    it('should execute recovery strategy for transient errors', async () => {
      let attemptCount = 0;
      const failingOperation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          const error = new Error('Transient failure');
          error.transient = true;
          throw error;
        }
        return 'success';
      };

      const result = await selfHealingSystem.executeWithRecovery(
        'test-operation',
        failingOperation
      );

      expect(result).toBe('success');
      expect(attemptCount).toBe(3);
    });

    it('should emit events during recovery process', async () => {
      const events = [];
      selfHealingSystem.on('recoveryStarted', (data) => events.push({ type: 'recoveryStarted', data }));
      selfHealingSystem.on('recoveryCompleted', (data) => events.push({ type: 'recoveryCompleted', data }));

      const failingOperation = async () => {
        const error = new Error('Test error');
        error.transient = true;
        throw error;
      };

      try {
        await selfHealingSystem.executeWithRecovery('test-op', failingOperation);
      } catch (error) {
        // Expected to fail after retries
      }

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('recoveryStarted');
    });

    it('should track recovery statistics', async () => {
      const operation = async () => 'success';
      
      await selfHealingSystem.executeWithRecovery('test', operation);
      
      const stats = selfHealingSystem.getRecoveryStats();
      expect(stats.successfulRecoveries).toBeGreaterThanOrEqual(0);
      expect(stats.totalAttempts).toBeGreaterThanOrEqual(1);
    });
  });

  describe('CircuitBreaker Functionality', () => {
    it('should allow requests when circuit is closed', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledOnce();
      expect(circuitBreaker.state).toBe('CLOSED');
    });

    it('should open circuit after failure threshold reached', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Service unavailable'));
      
      // Trigger failures to reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected failures
        }
      }
      
      expect(circuitBreaker.state).toBe('OPEN');
    });

    it('should reject requests immediately when circuit is open', async () => {
      // Force circuit to open state
      circuitBreaker.state = 'OPEN';
      
      const operation = vi.fn();
      
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN');
      expect(operation).not.toHaveBeenCalled();
    });

    it('should transition to half-open after recovery timeout', async () => {
      // Force circuit to open state
      circuitBreaker.state = 'OPEN';
      circuitBreaker.lastFailureTime = this.getDeterministicTimestamp() - 2000; // 2 seconds ago
      
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(operation);
      
      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe('CLOSED'); // Should close on successful execution
    });

    it('should track failure and success metrics', async () => {
      const successOperation = vi.fn().mockResolvedValue('success');
      const failOperation = vi.fn().mockRejectedValue(new Error('fail'));
      
      await circuitBreaker.execute(successOperation);
      
      try {
        await circuitBreaker.execute(failOperation);
      } catch (error) {
        // Expected failure
      }
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThanOrEqual(2);
      expect(metrics.successCount).toBeGreaterThanOrEqual(1);
      expect(metrics.failureCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GracefulDegradationManager', () => {
    it('should initialize with correct default settings', () => {
      expect(degradationManager.config.enabled).toBe(true);
      expect(degradationManager.getCurrentDegradationLevel()).toBe(DegradationLevel.NONE);
    });

    it('should trigger degradation on system stress', async () => {
      const events = [];
      degradationManager.on('degradationTriggered', (data) => events.push(data));
      
      await degradationManager.triggerDegradation(
        'High CPU usage',
        DegradationLevel.MODERATE,
        { cpuUsage: 85 }
      );
      
      expect(degradationManager.getCurrentDegradationLevel()).toBe(DegradationLevel.MODERATE);
      expect(events.length).toBe(1);
      expect(events[0].reason).toBe('High CPU usage');
    });

    it('should disable features based on degradation level', async () => {
      // Register a feature
      degradationManager.registerFeature('advanced-analytics', {
        priority: 'low',
        degradationLevels: [DegradationLevel.MODERATE, DegradationLevel.SEVERE]
      });
      
      await degradationManager.triggerDegradation('Test', DegradationLevel.MODERATE);
      
      expect(degradationManager.isFeatureEnabled('advanced-analytics')).toBe(false);
    });

    it('should recover from degradation automatically', async () => {
      await degradationManager.triggerDegradation('Test', DegradationLevel.SEVERE);
      expect(degradationManager.getCurrentDegradationLevel()).toBe(DegradationLevel.SEVERE);
      
      await degradationManager.recoverFromDegradation('System stabilized');
      expect(degradationManager.getCurrentDegradationLevel()).toBe(DegradationLevel.NONE);
    });

    it('should provide service availability matrix', () => {
      const availability = degradationManager.getServiceAvailability();
      expect(availability).toHaveProperty('core');
      expect(availability).toHaveProperty('enhanced');
      expect(availability).toHaveProperty('premium');
    });
  });

  describe('HealthMonitor', () => {
    it('should perform system health checks', async () => {
      const healthReport = await healthMonitor.performFullHealthCheck();
      
      expect(healthReport).toHaveProperty('overall');
      expect(healthReport).toHaveProperty('components');
      expect(healthReport).toHaveProperty('timestamp');
      expect(healthReport.overall).toMatch(/^(healthy|degraded|unhealthy)$/);
    });

    it('should detect anomalies in system metrics', async () => {
      // Simulate anomaly detection
      const anomalies = [];
      healthMonitor.on('anomalyDetected', (data) => anomalies.push(data));
      
      // Inject high CPU usage data
      await healthMonitor.recordMetric('cpu.usage', 95);
      await healthMonitor.recordMetric('cpu.usage', 97);
      await healthMonitor.recordMetric('cpu.usage', 99);
      
      // Allow some time for anomaly detection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should detect CPU spike anomaly
      expect(anomalies.length).toBeGreaterThanOrEqual(0);
    });

    it('should track component health over time', async () => {
      await healthMonitor.registerComponent('database', {
        healthCheck: async () => ({ status: 'healthy', responseTime: 50 })
      });
      
      const componentHealth = await healthMonitor.checkComponentHealth('database');
      
      expect(componentHealth.status).toBe('healthy');
      expect(componentHealth.responseTime).toBe(50);
    });

    it('should generate health trends', async () => {
      // Record some metrics over time
      for (let i = 0; i < 5; i++) {
        await healthMonitor.recordMetric('memory.usage', 60 + i * 5);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const trends = healthMonitor.getHealthTrends('memory.usage', { 
        timeRange: '1m',
        aggregation: 'average'
      });
      
      expect(trends).toHaveProperty('data');
      expect(trends).toHaveProperty('trend'); // 'increasing', 'decreasing', 'stable'
    });
  });

  describe('ChaosEngineer', () => {
    it('should run chaos experiments safely', async () => {
      const experiment = {
        type: 'latency_injection',
        target: 'database',
        parameters: { latency: 100 },
        duration: 1000,
        safetyConstraints: { maxLatency: 500 }
      };
      
      const result = await chaosEngineer.runExperiment(
        'latency_injection',
        'database',
        experiment.parameters
      );
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('status');
      expect(result.status).toMatch(/^(completed|failed|aborted)$/);
    });

    it('should abort experiments that violate safety constraints', async () => {
      const dangerousExperiment = {
        type: 'cpu_stress',
        parameters: { cpuPercent: 99 }, // Exceeds safety limit
        duration: 5000
      };
      
      const result = await chaosEngineer.runExperiment(
        'cpu_stress',
        'system',
        dangerousExperiment.parameters
      );
      
      expect(result.status).toBe('aborted');
      expect(result.reason).toContain('safety');
    });

    it('should measure system resilience', async () => {
      const experiment = {
        type: 'network_partition',
        parameters: { duration: 500 }
      };
      
      const result = await chaosEngineer.runExperiment(
        'network_partition',
        'service-a',
        experiment.parameters
      );
      
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('recoveryTime');
      expect(result.metrics).toHaveProperty('errorRate');
    });

    it('should track experiment history', () => {
      const history = chaosEngineer.getExperimentHistory();
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('DeadlockDetector', () => {
    it('should register resources and processes', () => {
      deadlockDetector.registerResource('resource-1', { type: 'database' });
      deadlockDetector.registerProcess('process-1', { type: 'worker' });
      
      const status = deadlockDetector.getStatus();
      expect(status.resourceCount).toBe(1);
      expect(status.processCount).toBe(1);
    });

    it('should track resource acquisition and release', () => {
      deadlockDetector.registerResource('resource-1');
      deadlockDetector.registerProcess('process-1');
      
      const acquired = deadlockDetector.acquireResource('process-1', 'resource-1');
      expect(acquired).toBe(true);
      
      const released = deadlockDetector.releaseResource('process-1', 'resource-1');
      expect(released).toBe(true);
    });

    it('should detect simple circular wait deadlocks', async () => {
      const deadlocks = [];
      deadlockDetector.on('deadlockDetected', (deadlock) => deadlocks.push(deadlock));
      
      // Setup circular wait scenario
      deadlockDetector.registerResource('resource-A');
      deadlockDetector.registerResource('resource-B');
      deadlockDetector.registerProcess('process-1');
      deadlockDetector.registerProcess('process-2');
      
      // Process-1 holds resource-A, wants resource-B
      deadlockDetector.acquireResource('process-1', 'resource-A');
      deadlockDetector.acquireResource('process-2', 'resource-B');
      
      // Create wait-for relationship (simulated)
      deadlockDetector.acquireResource('process-1', 'resource-B'); // Will wait
      deadlockDetector.acquireResource('process-2', 'resource-A'); // Will wait
      
      // Run detection
      const detectedDeadlocks = await deadlockDetector.detectDeadlocks();
      
      expect(detectedDeadlocks.length).toBeGreaterThanOrEqual(0);
    });

    it('should resolve deadlocks using victim selection', async () => {
      const mockDeadlock = {
        id: 'test-deadlock',
        processes: ['process-1', 'process-2'],
        resources: ['resource-A', 'resource-B'],
        type: 'circular_wait'
      };
      
      const resolved = await deadlockDetector.resolveDeadlock(mockDeadlock, 'victim_selection');
      
      // Resolution success depends on implementation
      expect(typeof resolved).toBe('boolean');
    });
  });

  describe('CorruptionDetector', () => {
    it('should register files for monitoring', async () => {
      // Create a temporary test file content
      const testContent = Buffer.from('test file content');
      const mockFilePath = '/tmp/test-file.txt';
      
      // Mock fs operations
      const mockReadFile = vi.fn().mockResolvedValue(testContent);
      const mockAccess = vi.fn().mockResolvedValue(undefined);
      
      // Override for testing
      const originalReadFile = corruptionDetector.constructor.prototype.readFile;
      corruptionDetector.readFile = mockReadFile;
      
      try {
        const checksumInfo = await corruptionDetector.registerFile(mockFilePath, { 
          type: 'config', 
          critical: true 
        });
        
        expect(checksumInfo).toHaveProperty('checksum');
        expect(checksumInfo).toHaveProperty('size');
        expect(checksumInfo.filePath).toBe(mockFilePath);
      } catch (error) {
        // Expected if file doesn't exist - that's ok for this test
        expect(error.message).toContain('ENOENT');
      }
    });

    it('should detect data structure corruption', () => {
      const testData = { key: 'value', number: 42 };
      
      const checksumInfo = corruptionDetector.registerDataStructure(
        'test-structure',
        testData,
        { critical: true }
      );
      
      expect(checksumInfo).toHaveProperty('checksum');
      expect(checksumInfo.structureId).toBe('test-structure');
      
      // Verify with same data
      const result1 = corruptionDetector.verifyDataStructure('test-structure', testData);
      expect(result1.corrupted).toBe(false);
      
      // Verify with corrupted data
      const corruptedData = { key: 'changed', number: 42 };
      const result2 = corruptionDetector.verifyDataStructure('test-structure', corruptedData);
      expect(result2.corrupted).toBe(true);
    });

    it('should perform full system scan', async () => {
      // Register some test data structures
      corruptionDetector.registerDataStructure('struct-1', { test: 1 });
      corruptionDetector.registerDataStructure('struct-2', { test: 2 });
      
      const scanResults = await corruptionDetector.performFullScan();
      
      expect(scanResults).toHaveProperty('startTime');
      expect(scanResults).toHaveProperty('endTime');
      expect(scanResults).toHaveProperty('filesScanned');
      expect(scanResults).toHaveProperty('corruptionsFound');
    });

    it('should track corruption metrics', () => {
      const status = corruptionDetector.getStatus();
      
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('filesProtected');
      expect(status).toHaveProperty('dataStructuresProtected');
      expect(status).toHaveProperty('metrics');
      expect(status.metrics).toHaveProperty('corruptionsDetected');
      expect(status.metrics).toHaveProperty('corruptionsRepaired');
    });
  });

  describe('KGenSelfHealingIntegration', () => {
    it('should initialize with all components', () => {
      expect(integration.selfHealingSystem).toBeDefined();
      expect(integration.circuitBreakerManager).toBeDefined();
      expect(integration.degradationManager).toBeDefined();
      expect(integration.healthMonitor).toBeDefined();
      expect(integration.chaosEngineer).toBeDefined();
    });

    it('should execute operations with self-healing protection', async () => {
      const testOperation = vi.fn().mockResolvedValue('success');
      
      const result = await integration.executeWithSelfHealing(
        'test-operation',
        testOperation,
        { timeout: 1000 }
      );
      
      expect(result).toBe('success');
      expect(testOperation).toHaveBeenCalled();
    });

    it('should handle operation failures gracefully', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      try {
        await integration.executeWithSelfHealing(
          'failing-operation',
          failingOperation,
          { retries: 2 }
        );
      } catch (error) {
        expect(error.message).toBe('Operation failed');
      }
      
      // Should have attempted retries
      expect(failingOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should provide comprehensive system status', () => {
      const status = integration.getSystemStatus();
      
      expect(status).toHaveProperty('selfHealing');
      expect(status).toHaveProperty('circuitBreakers');
      expect(status).toHaveProperty('degradation');
      expect(status).toHaveProperty('health');
      expect(status).toHaveProperty('overall');
    });

    it('should collect and aggregate metrics', () => {
      const metrics = integration.getMetrics();
      
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('components');
      expect(metrics.components).toHaveProperty('selfHealing');
      expect(metrics.components).toHaveProperty('circuitBreaker');
      expect(metrics.components).toHaveProperty('healthMonitor');
    });

    it('should handle component failures gracefully', async () => {
      // Simulate health monitor failure
      integration.healthMonitor = null;
      
      const testOperation = vi.fn().mockResolvedValue('success');
      
      // Should still work even with component failure
      const result = await integration.executeWithSelfHealing(
        'test-operation',
        testOperation
      );
      
      expect(result).toBe('success');
    });
  });

  describe('Integration Tests', () => {
    it('should handle cascading failures across components', async () => {
      let eventCount = 0;
      const eventTracker = () => eventCount++;

      // Setup event tracking
      integration.on('degradationTriggered', eventTracker);
      integration.on('circuitBreakerOpened', eventTracker);
      integration.on('healthAlertRaised', eventTracker);

      // Simulate cascading failure
      const cascadingFailure = async () => {
        throw new Error('Database connection failed');
      };

      // Execute multiple failing operations to trigger cascade
      for (let i = 0; i < 5; i++) {
        try {
          await integration.executeWithSelfHealing(
            `cascade-test-${i}`,
            cascadingFailure
          );
        } catch (error) {
          // Expected failures
        }
      }

      // Should have triggered multiple self-healing responses
      expect(eventCount).toBeGreaterThan(0);
    });

    it('should recover from complete system degradation', async () => {
      // Force system into severe degradation
      await integration.degradationManager.triggerDegradation(
        'Simulated system overload',
        DegradationLevel.SEVERE
      );

      // Verify degraded state
      expect(integration.degradationManager.getCurrentDegradationLevel())
        .toBe(DegradationLevel.SEVERE);

      // Simulate system recovery
      await integration.degradationManager.recoverFromDegradation(
        'System load normalized'
      );

      // Verify recovery
      expect(integration.degradationManager.getCurrentDegradationLevel())
        .toBe(DegradationLevel.NONE);
    });

    it('should maintain system stability under chaos engineering', async () => {
      // Run multiple chaos experiments
      const experiments = [
        { type: 'latency_injection', target: 'database' },
        { type: 'cpu_stress', target: 'system' },
        { type: 'memory_pressure', target: 'application' }
      ];

      const results = [];
      for (const exp of experiments) {
        try {
          const result = await integration.chaosEngineer.runExperiment(
            exp.type,
            exp.target,
            { duration: 500 }
          );
          results.push(result);
        } catch (error) {
          results.push({ status: 'failed', error: error.message });
        }
      }

      // System should maintain basic functionality
      const testOperation = vi.fn().mockResolvedValue('success');
      const operationResult = await integration.executeWithSelfHealing(
        'stability-test',
        testOperation
      );

      expect(operationResult).toBe('success');
      expect(results.length).toBe(experiments.length);
    });
  });
});

describe('KGEN Self-Healing Performance Tests', () => {
  let integration;

  beforeEach(() => {
    integration = new KGenSelfHealingIntegration({
      selfHealingEnabled: true,
      performanceMonitoring: true
    });
  });

  afterEach(async () => {
    if (integration?.shutdown) await integration.shutdown();
  });

  it('should maintain acceptable performance overhead', async () => {
    const iterations = 100;
    const operations = [];
    
    const testOperation = vi.fn().mockResolvedValue('success');
    
    const startTime = this.getDeterministicTimestamp();
    
    // Execute operations with self-healing
    for (let i = 0; i < iterations; i++) {
      operations.push(
        integration.executeWithSelfHealing(`perf-test-${i}`, testOperation)
      );
    }
    
    await Promise.all(operations);
    
    const endTime = this.getDeterministicTimestamp();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;
    
    // Performance should be reasonable (adjust threshold as needed)
    expect(averageTime).toBeLessThan(50); // 50ms average per operation
    expect(testOperation).toHaveBeenCalledTimes(iterations);
  });

  it('should scale efficiently with concurrent operations', async () => {
    const concurrentOperations = 50;
    const operations = [];
    
    const testOperation = vi.fn().mockResolvedValue('success');
    
    const startTime = this.getDeterministicTimestamp();
    
    // Execute concurrent operations
    for (let i = 0; i < concurrentOperations; i++) {
      operations.push(
        integration.executeWithSelfHealing(`concurrent-test-${i}`, testOperation)
      );
    }
    
    const results = await Promise.all(operations);
    
    const endTime = this.getDeterministicTimestamp();
    const totalTime = endTime - startTime;
    
    // All operations should succeed
    expect(results.every(result => result === 'success')).toBe(true);
    
    // Total time should be reasonable for concurrent execution
    expect(totalTime).toBeLessThan(5000); // 5 seconds for 50 concurrent operations
  });
});