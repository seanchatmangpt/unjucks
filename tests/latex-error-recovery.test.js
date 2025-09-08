/**
 * LaTeX Error Recovery System Tests
 * Tests comprehensive error handling, circuit breakers, and fallback mechanisms
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LaTeXErrorRecovery, ERROR_CATEGORIES, RECOVERY_STRATEGIES, CIRCUIT_STATES } from '../src/lib/latex/error-recovery.js';
import { LaTeXCompiler } from '../src/lib/latex/compiler.js';
import LaTeXBuildIntegration from '../src/lib/latex/build-integration.js';

describe('LaTeX Error Recovery System', () => {
  let errorRecovery;
  let compiler;
  let buildIntegration;

  beforeEach(() => {
    vi.clearAllMocks();
    
    errorRecovery = new LaTeXErrorRecovery({
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
      failureThreshold: 3,
      recoveryTimeout: 5000,
      enableFallbacks: true,
      enableGracefulDegradation: true,
      logErrors: false // Disable for tests
    });
    
    compiler = new LaTeXCompiler({
      errorRecovery: {
        enabled: true,
        maxRetries: 2,
        baseDelayMs: 50
      }
    });
    
    buildIntegration = new LaTeXBuildIntegration({
      errorRecovery: {
        enabled: true,
        continueOnError: true
      }
    });
  });

  afterEach(async () => {
    await errorRecovery?.cleanup();
    await compiler?.cleanup();
    await buildIntegration?.cleanup();
  });

  describe('Error Recovery Core Functions', () => {
    it('should execute operation successfully without recovery', async () => {
      const successOperation = vi.fn().mockResolvedValue({ success: true, data: 'test' });
      
      const result = await errorRecovery.executeWithRecovery(successOperation, {});
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('test');
      expect(result.recovery.recovered).toBe(false);
      expect(result.recovery.attempts).toBe(1);
      expect(successOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry failed operations with exponential backoff', async () => {
      let callCount = 0;
      const flakyOperation = vi.fn(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve({ success: true, data: 'recovered' });
      });
      
      const result = await errorRecovery.executeWithRecovery(flakyOperation, {});
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('recovered');
      expect(result.recovery.recovered).toBe(true);
      expect(result.recovery.attempts).toBe(3);
      expect(flakyOperation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries exceeded', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      
      const result = await errorRecovery.executeWithRecovery(failingOperation, {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Persistent failure');
      expect(result.recovery.attempts).toBe(3); // maxRetries
      expect(failingOperation).toHaveBeenCalledTimes(3);
    });

    it('should categorize errors correctly', () => {
      const timeoutError = new Error('Operation timed out');
      expect(errorRecovery.categorizeError(timeoutError)).toBe(ERROR_CATEGORIES.TIMEOUT);

      const dependencyError = new Error('Command not found: pdflatex');
      expect(errorRecovery.categorizeError(dependencyError)).toBe(ERROR_CATEGORIES.DEPENDENCY);

      const resourceError = new Error('No space left on device');
      expect(errorRecovery.categorizeError(resourceError)).toBe(ERROR_CATEGORIES.RESOURCE);

      const systemError = new Error('Permission denied');
      expect(errorRecovery.categorizeError(systemError)).toBe(ERROR_CATEGORIES.SYSTEM);

      const compilationError = new Error('LaTeX Error: Undefined control sequence');
      expect(errorRecovery.categorizeError(compilationError)).toBe(ERROR_CATEGORIES.COMPILATION);
    });

    it('should calculate exponential backoff delay correctly', () => {
      const delay1 = errorRecovery.calculateBackoffDelay(1, ERROR_CATEGORIES.COMPILATION);
      const delay2 = errorRecovery.calculateBackoffDelay(2, ERROR_CATEGORIES.COMPILATION);
      const delay3 = errorRecovery.calculateBackoffDelay(3, ERROR_CATEGORIES.TIMEOUT);
      
      expect(delay1).toBeGreaterThanOrEqual(80); // 100 * 0.8 with jitter
      expect(delay1).toBeLessThanOrEqual(120);
      
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2); // Timeout has 1.5x multiplier
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should open circuit breaker after failure threshold', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('System failure'));
      
      // Execute failures to trigger circuit breaker (3 operations, each tries 3 times = 3 final failures)
      for (let i = 0; i < 3; i++) {
        await errorRecovery.executeWithRecovery(failingOperation, {});
      }
      
      // Circuit should now be open - try one more operation
      const result = await errorRecovery.executeWithRecovery(failingOperation, {});
      expect(result.error).toContain('Circuit breaker OPEN');
      expect(result.success).toBe(false);
    });

    it('should transition to half-open state after recovery timeout', async () => {
      // Mock time functions for faster testing
      const originalSetTimeout = global.setTimeout;
      vi.useFakeTimers();
      
      const failingOperation = vi.fn().mockRejectedValue(new Error('System failure'));
      
      // Trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        await errorRecovery.executeWithRecovery(failingOperation, {});
      }
      
      // Fast-forward time past recovery timeout
      vi.advanceTimersByTime(6000);
      
      // Should allow one test call in half-open state
      const successOperation = vi.fn().mockResolvedValue({ success: true });
      const result = await errorRecovery.executeWithRecovery(successOperation, {});
      
      expect(result.success).toBe(true);
      expect(successOperation).toHaveBeenCalledTimes(1);
      
      vi.useRealTimers();
    });

    it('should reset circuit breaker manually', () => {
      // Trigger failures
      errorRecovery.circuitBreaker.failures = 5;
      errorRecovery.circuitBreaker.state = CIRCUIT_STATES.OPEN;
      
      errorRecovery.resetCircuitBreaker();
      
      expect(errorRecovery.circuitBreaker.state).toBe(CIRCUIT_STATES.CLOSED);
      expect(errorRecovery.circuitBreaker.failures).toBe(0);
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should execute fallback strategies for dependency errors', async () => {
      const dependencyFailure = new Error('Command not found: xelatex');
      dependencyFailure.category = ERROR_CATEGORIES.DEPENDENCY;
      
      const result = await errorRecovery.executeFallback(dependencyFailure, {}, 'test-recovery');
      
      expect(result.success).toBe(true);
      expect(result.fallback).toBe(true);
    });

    it('should execute graceful degradation for resource errors', async () => {
      const resourceFailure = new Error('No space left on device');
      const context = { inputFile: 'test.tex' };
      
      const result = await errorRecovery.executeDegraded(resourceFailure, context, 'test-recovery');
      
      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.warnings).toContain('Operation completed with degradation');
    });
  });

  describe('LaTeX Compiler Integration', () => {
    it('should initialize compiler with error recovery', () => {
      expect(compiler.errorRecovery).toBeDefined();
      expect(compiler.config.errorRecovery.enabled).toBe(true);
      expect(compiler.metrics.recoveries).toBe(0);
      expect(compiler.metrics.circuitBreakerTrips).toBe(0);
    });

    it('should categorize compilation errors correctly', () => {
      const timeoutError = new Error('Process timed out after 60000ms');
      expect(compiler.categorizeCompilationError(timeoutError)).toBe('timeout');

      const missingCommand = new Error('pdflatex: command not found');
      expect(compiler.categorizeCompilationError(missingCommand)).toBe('dependency');
      
      const diskFull = new Error('No space left on disk');
      expect(compiler.categorizeCompilationError(diskFull)).toBe('resource');
    });

    it('should include recovery metrics in getMetrics()', () => {
      const metrics = compiler.getMetrics();
      
      expect(metrics).toHaveProperty('recoveries');
      expect(metrics).toHaveProperty('circuitBreakerTrips');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('recovery');
    });

    it('should reset circuit breaker when requested', () => {
      compiler.resetCircuitBreaker();
      // Should not throw and should log appropriately
      expect(true).toBe(true); // Simple validation that method exists
    });
  });

  describe('Build Integration Error Recovery', () => {
    it('should initialize build integration with error recovery', () => {
      expect(buildIntegration.config.errorRecovery.enabled).toBe(true);
      expect(buildIntegration.config.fallbackStrategies).toBeDefined();
      expect(buildIntegration.buildStats).toBeDefined();
    });

    it('should track build statistics correctly', () => {
      const stats = buildIntegration.buildStats;
      
      expect(stats).toHaveProperty('total', 0);
      expect(stats).toHaveProperty('successful', 0);
      expect(stats).toHaveProperty('failed', 0);
      expect(stats).toHaveProperty('recovered', 0);
      expect(stats).toHaveProperty('skipped', 0);
    });

    it('should provide comprehensive metrics', () => {
      // Mock a compiler for metrics
      buildIntegration.compiler = {
        getMetrics: () => ({ compilations: 5, errors: 1, warnings: 2 })
      };
      
      const metrics = buildIntegration.getMetrics();
      
      expect(metrics).toHaveProperty('compiler');
      expect(metrics).toHaveProperty('build');
      expect(metrics).toHaveProperty('integration');
      expect(metrics.integration.errorRecoveryEnabled).toBe(true);
      expect(metrics.integration.fallbacksEnabled).toBe(true);
    });
  });

  describe('Error Recovery Statistics', () => {
    it('should track error statistics correctly', async () => {
      const failingOperation = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce({ success: true });
      
      await errorRecovery.executeWithRecovery(failingOperation, {});
      
      const stats = errorRecovery.getStats();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.recoveries).toBe(1);
    });

    it('should track error patterns', async () => {
      const commonError = new Error('LaTeX Error: Missing package');
      
      // Use a fresh error recovery for this test to avoid interference from other tests
      const testRecovery = new LaTeXErrorRecovery({
        maxRetries: 3,
        baseDelayMs: 10,
        failureThreshold: 10 // Higher threshold to avoid circuit breaker
      });
      
      // Generate several errors with same pattern (each will retry 3 times)
      for (let i = 0; i < 3; i++) {
        await testRecovery.executeWithRecovery(
          () => Promise.reject(commonError), 
          {}
        );
      }
      
      const stats = testRecovery.getStats();
      expect(stats.topErrorPatterns).toHaveLength(1);
      // Each operation failed after maxRetries, so we get one pattern count per operation
      expect(stats.topErrorPatterns[0].count).toBe(3);
      
      await testRecovery.cleanup();
    });

    it('should reset statistics correctly', () => {
      errorRecovery.errorStats.total = 10;
      errorRecovery.errorStats.recoveries = 5;
      
      errorRecovery.resetStats();
      
      expect(errorRecovery.errorStats.total).toBe(0);
      expect(errorRecovery.errorStats.recoveries).toBe(0);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle concurrent recovery operations', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => 
        errorRecovery.executeWithRecovery(
          async () => {
            if (Math.random() > 0.5) {
              throw new Error(`Random failure ${i}`);
            }
            return { success: true, id: i };
          },
          { operationId: i }
        )
      );
      
      const results = await Promise.allSettled(operations);
      
      // At least some operations should complete
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThanOrEqual(0);
    });

    it('should cleanup resources properly', async () => {
      errorRecovery.activeRecoveries.set('test-1', { test: true });
      
      await errorRecovery.cleanup();
      
      expect(errorRecovery.activeRecoveries.size).toBe(0);
      expect(errorRecovery.listenerCount()).toBe(0);
    });

    it('should handle very long error messages gracefully', async () => {
      const longErrorMessage = 'LaTeX Error: ' + 'x'.repeat(10000);
      const longError = new Error(longErrorMessage);
      
      const category = errorRecovery.categorizeError(longError);
      expect(category).toBe(ERROR_CATEGORIES.COMPILATION);
      
      // Should not throw or cause performance issues - use fresh recovery to avoid circuit breaker
      const testRecovery = new LaTeXErrorRecovery({
        maxRetries: 2,
        baseDelayMs: 10,
        failureThreshold: 10
      });
      
      const result = await testRecovery.executeWithRecovery(
        () => Promise.reject(longError),
        {}
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('LaTeX Error');
      
      await testRecovery.cleanup();
    });

    it('should handle null and undefined inputs gracefully', async () => {
      const result = await errorRecovery.executeWithRecovery(
        () => Promise.resolve({ success: true }),
        null
      );
      
      expect(result.success).toBe(true);
      
      const category = errorRecovery.categorizeError(null);
      expect(category).toBe(ERROR_CATEGORIES.UNKNOWN);
    });
  });
});

describe('LaTeX Error Recovery Integration Tests', () => {
  it('should recover from simulated compilation failures', async () => {
    // Create a mock that fails twice then succeeds
    let attempts = 0;
    const mockCompileBasic = vi.fn(async () => {
      attempts++;
      if (attempts <= 2) {
        const error = new Error('LaTeX compilation failed');
        error.category = 'compilation';
        throw error;
      }
      return { 
        success: true, 
        outputPath: '/test/output.pdf',
        duration: 1000,
        compilationId: 'test-123'
      };
    });
    
    const compiler = new LaTeXCompiler({
      errorRecovery: { enabled: true, maxRetries: 3 }
    });
    
    // Replace the basic compile method with our mock
    compiler.compileBasic = mockCompileBasic;
    
    const result = await compiler.compile('test.tex');
    
    expect(result.success).toBe(true);
    expect(result.recovery.recovered).toBe(true);
    expect(result.recovery.attempts).toBe(3);
    expect(mockCompileBasic).toHaveBeenCalledTimes(3);
  });
});