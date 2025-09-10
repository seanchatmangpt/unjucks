/**
 * Tests for PerformanceMonitor utility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor } from '../../src/utils/performance-monitor.js';

describe('PerformanceMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({ enabled: true });
  });

  afterEach(() => {
    monitor.cleanup();
  });

  it('should initialize with default config', () => {
    const defaultMonitor = new PerformanceMonitor();
    expect(defaultMonitor.config.enabled).toBe(true);
    expect(defaultMonitor.config.sampleRate).toBe(1.0);
    expect(defaultMonitor.config.maxEntries).toBe(1000);
    defaultMonitor.cleanup();
  });

  it('should start and end operations', () => {
    const timerId = monitor.startOperation('test-op');
    expect(timerId).toBeTruthy();
    expect(monitor.getActiveOperationsCount()).toBe(1);

    const metrics = monitor.endOperation(timerId);
    expect(metrics).toBeTruthy();
    expect(metrics.operationId).toBe('test-op');
    expect(metrics.duration).toBeGreaterThanOrEqual(0);
    expect(monitor.getActiveOperationsCount()).toBe(0);
  });

  it('should record operation metrics', () => {
    monitor.recordOperation('test-op', 100);
    
    const report = monitor.generateReport();
    expect(report.operations['test-op']).toBeTruthy();
    expect(report.operations['test-op'].count).toBe(1);
    expect(report.operations['test-op'].totalDuration).toBe('100.00ms');
  });

  it('should generate comprehensive reports', () => {
    monitor.recordOperation('op1', 50);
    monitor.recordOperation('op2', 100);
    monitor.recordError('op1', 'TEST_ERROR');
    
    const report = monitor.generateReport();
    
    expect(report.summary).toBeTruthy();
    expect(report.operations).toBeTruthy();
    expect(report.errors).toBeTruthy();
    expect(report.system).toBeTruthy();
    
    expect(report.summary.totalOperations).toBe(2);
    expect(report.summary.totalErrors).toBe(1);
  });

  it('should calculate percentiles correctly', () => {
    // Record multiple operations to test percentile calculation
    const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    durations.forEach(duration => {
      monitor.recordOperation('test-op', duration);
    });
    
    const report = monitor.generateReport();
    const opStats = report.operations['test-op'];
    
    expect(parseFloat(opStats.p95Duration)).toBeGreaterThan(80);
    expect(parseFloat(opStats.p99Duration)).toBeGreaterThan(90);
  });

  it('should provide performance insights', () => {
    monitor.recordOperation('slow-op', 2000); // Slow operation
    monitor.recordError('failing-op', 'ERROR');
    
    const insights = monitor.getInsights();
    
    expect(insights.recommendations).toBeTruthy();
    expect(insights.warnings).toBeTruthy();
    expect(insights.highlights).toBeTruthy();
  });

  it('should handle memory monitoring', () => {
    monitor.recordMemoryUsage();
    
    const report = monitor.generateReport();
    expect(report.summary.memoryUsage.current).toBeTruthy();
  });

  it('should reset metrics', () => {
    monitor.recordOperation('test-op', 100);
    monitor.reset();
    
    const report = monitor.generateReport();
    expect(report.summary.totalOperations).toBe(0);
    expect(Object.keys(report.operations)).toHaveLength(0);
  });
});