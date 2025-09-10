/**
 * Unjucks Performance Monitor
 * 
 * Advanced performance monitoring and analytics system for tracking
 * application performance, memory usage, and operation metrics.
 */

import { performance } from 'perf_hooks';
import { CONSTANTS } from './constants.js';

/**
 * Performance monitoring and analytics system
 * 
 * @class PerformanceMonitor
 */
export class PerformanceMonitor {
  /**
   * Initialize the performance monitor
   * @param {Object} options - Monitor configuration
   * @param {boolean} [options.enabled=true] - Enable monitoring
   * @param {number} [options.sampleRate=1.0] - Sampling rate (0.0-1.0)
   * @param {number} [options.maxEntries=1000] - Maximum entries to store
   */
  constructor(options = {}) {
    this.config = {
      enabled: options.enabled !== false,
      sampleRate: options.sampleRate || 1.0,
      maxEntries: options.maxEntries || 1000,
      ...options
    };

    // Performance data storage
    this.metrics = {
      operations: new Map(),
      memory: [],
      timing: [],
      errors: []
    };

    // Active timers
    this.activeTimers = new Map();
    
    // Statistics
    this.stats = {
      totalOperations: 0,
      totalErrors: 0,
      startTime: Date.now(),
      lastReset: Date.now()
    };

    // Periodic memory monitoring
    if (this.config.enabled) {
      this.startMemoryMonitoring();
    }
  }

  /**
   * Start monitoring memory usage at regular intervals
   * @private
   */
  startMemoryMonitoring() {
    const interval = 30000; // 30 seconds
    
    this.memoryTimer = setInterval(() => {
      this.recordMemoryUsage();
    }, interval);

    // Clean up on process exit
    process.on('exit', () => {
      if (this.memoryTimer) {
        clearInterval(this.memoryTimer);
      }
    });
  }

  /**
   * Record current memory usage
   * @private
   */
  recordMemoryUsage() {
    if (!this.config.enabled) return;

    const usage = process.memoryUsage();
    const timestamp = Date.now();

    const memoryRecord = {
      timestamp,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      uptime: process.uptime()
    };

    this.metrics.memory.push(memoryRecord);

    // Limit memory records to prevent unbounded growth
    if (this.metrics.memory.length > this.config.maxEntries) {
      this.metrics.memory = this.metrics.memory.slice(-this.config.maxEntries);
    }
  }

  /**
   * Start timing an operation
   * @param {string} operationId - Unique operation identifier
   * @param {Object} [metadata] - Additional operation metadata
   * @returns {string} Timer ID for ending the operation
   */
  startOperation(operationId, metadata = {}) {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) {
      return null;
    }

    const timerId = `${operationId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const timer = {
      id: timerId,
      operationId,
      startTime: performance.now(),
      startMemory: process.memoryUsage(),
      metadata: { ...metadata }
    };

    this.activeTimers.set(timerId, timer);
    return timerId;
  }

  /**
   * End timing an operation and record metrics
   * @param {string} timerId - Timer ID from startOperation
   * @param {Object} [metadata] - Additional completion metadata
   * @returns {Object|null} Operation metrics or null if timer not found
   */
  endOperation(timerId, metadata = {}) {
    if (!timerId || !this.activeTimers.has(timerId)) {
      return null;
    }

    const timer = this.activeTimers.get(timerId);
    this.activeTimers.delete(timerId);

    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - timer.startTime;

    const operationMetrics = {
      operationId: timer.operationId,
      timerId,
      duration,
      startTime: timer.startTime,
      endTime,
      memoryDelta: {
        heapUsed: endMemory.heapUsed - timer.startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - timer.startMemory.heapTotal,
        external: endMemory.external - timer.startMemory.external,
        rss: endMemory.rss - timer.startMemory.rss
      },
      metadata: { ...timer.metadata, ...metadata },
      timestamp: Date.now()
    };

    this.recordOperation(timer.operationId, duration, operationMetrics);
    return operationMetrics;
  }

  /**
   * Record operation metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} [metadata] - Additional metadata
   */
  recordOperation(operation, duration, metadata = {}) {
    if (!this.config.enabled) return;

    // Update operation statistics
    const existing = this.metrics.operations.get(operation) || {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      p95Duration: 0,
      p99Duration: 0,
      durations: [],
      errors: 0,
      lastExecution: null
    };

    existing.count++;
    existing.totalDuration += duration;
    existing.avgDuration = existing.totalDuration / existing.count;
    existing.minDuration = Math.min(existing.minDuration, duration);
    existing.maxDuration = Math.max(existing.maxDuration, duration);
    existing.lastExecution = Date.now();

    // Track individual durations for percentile calculations
    existing.durations.push(duration);
    if (existing.durations.length > 1000) {
      // Keep only the most recent 1000 durations
      existing.durations = existing.durations.slice(-1000);
    }

    // Calculate percentiles
    const sortedDurations = [...existing.durations].sort((a, b) => a - b);
    existing.p95Duration = this.calculatePercentile(sortedDurations, 95);
    existing.p99Duration = this.calculatePercentile(sortedDurations, 99);

    this.metrics.operations.set(operation, existing);
    this.stats.totalOperations++;

    // Record detailed timing data
    this.metrics.timing.push({
      operation,
      duration,
      timestamp: Date.now(),
      metadata
    });

    // Limit timing records
    if (this.metrics.timing.length > this.config.maxEntries) {
      this.metrics.timing = this.metrics.timing.slice(-this.config.maxEntries);
    }

    // Check for performance thresholds
    this.checkPerformanceThresholds(operation, duration);
  }

  /**
   * Calculate percentile from sorted array
   * @param {number[]} sortedArray - Sorted array of values
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} Percentile value
   * @private
   */
  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Check if operation exceeded performance thresholds
   * @param {string} operation - Operation name
   * @param {number} duration - Operation duration
   * @private
   */
  checkPerformanceThresholds(operation, duration) {
    const thresholds = CONSTANTS.PERFORMANCE_THRESHOLDS;
    let threshold;

    // Determine appropriate threshold
    if (operation.includes('template')) {
      threshold = thresholds.TEMPLATE_PROCESSING;
    } else if (operation.includes('rdf')) {
      threshold = thresholds.RDF_PARSING;
    } else if (operation.includes('file')) {
      threshold = thresholds.FILE_OPERATIONS;
    } else if (operation.includes('validation')) {
      threshold = thresholds.SEMANTIC_VALIDATION;
    }

    if (threshold && duration > threshold) {
      this.recordError(operation, 'PERFORMANCE_THRESHOLD_EXCEEDED', {
        duration,
        threshold,
        exceedBy: duration - threshold
      });
    }
  }

  /**
   * Record an error or performance issue
   * @param {string} operation - Operation that had the error
   * @param {string} errorType - Type of error
   * @param {Object} [details] - Error details
   */
  recordError(operation, errorType, details = {}) {
    if (!this.config.enabled) return;

    const errorRecord = {
      operation,
      errorType,
      timestamp: Date.now(),
      details
    };

    this.metrics.errors.push(errorRecord);
    this.stats.totalErrors++;

    // Update operation error count
    const operationStats = this.metrics.operations.get(operation);
    if (operationStats) {
      operationStats.errors++;
    }

    // Limit error records
    if (this.metrics.errors.length > this.config.maxEntries) {
      this.metrics.errors = this.metrics.errors.slice(-this.config.maxEntries);
    }
  }

  /**
   * Generate comprehensive performance report
   * @returns {Object} Performance report
   */
  generateReport() {
    const now = Date.now();
    const uptime = now - this.stats.startTime;
    const currentMemory = process.memoryUsage();

    return {
      summary: {
        uptime: uptime,
        totalOperations: this.stats.totalOperations,
        totalErrors: this.stats.totalErrors,
        errorRate: this.stats.totalOperations > 0 
          ? (this.stats.totalErrors / this.stats.totalOperations * 100).toFixed(2) + '%'
          : '0%',
        averageOperationsPerSecond: this.stats.totalOperations / (uptime / 1000),
        memoryUsage: {
          current: {
            heapUsed: `${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
            heapTotal: `${(currentMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`,
            external: `${(currentMemory.external / 1024 / 1024).toFixed(2)}MB`,
            rss: `${(currentMemory.rss / 1024 / 1024).toFixed(2)}MB`
          }
        }
      },
      operations: this.getOperationsSummary(),
      memory: this.getMemorySummary(),
      errors: this.getErrorsSummary(),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        cpuUsage: process.cpuUsage(),
        resourceUsage: process.resourceUsage ? process.resourceUsage() : null
      },
      config: this.config
    };
  }

  /**
   * Get operations performance summary
   * @returns {Object} Operations summary
   * @private
   */
  getOperationsSummary() {
    const summary = {};
    
    for (const [operation, stats] of this.metrics.operations) {
      summary[operation] = {
        count: stats.count,
        avgDuration: `${stats.avgDuration.toFixed(2)}ms`,
        minDuration: `${stats.minDuration.toFixed(2)}ms`,
        maxDuration: `${stats.maxDuration.toFixed(2)}ms`,
        p95Duration: `${stats.p95Duration.toFixed(2)}ms`,
        p99Duration: `${stats.p99Duration.toFixed(2)}ms`,
        totalDuration: `${stats.totalDuration.toFixed(2)}ms`,
        errors: stats.errors,
        errorRate: stats.count > 0 
          ? `${(stats.errors / stats.count * 100).toFixed(2)}%`
          : '0%',
        lastExecution: stats.lastExecution ? new Date(stats.lastExecution).toISOString() : null
      };
    }

    return summary;
  }

  /**
   * Get memory usage summary
   * @returns {Object} Memory summary
   * @private
   */
  getMemorySummary() {
    if (this.metrics.memory.length === 0) {
      return { records: 0, trend: 'no data' };
    }

    const recent = this.metrics.memory.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];

    const heapTrend = newest.heapUsed > oldest.heapUsed ? 'increasing' : 'decreasing';
    const heapChange = newest.heapUsed - oldest.heapUsed;

    return {
      records: this.metrics.memory.length,
      trend: heapTrend,
      heapChange: `${(heapChange / 1024 / 1024).toFixed(2)}MB`,
      peakHeapUsed: Math.max(...this.metrics.memory.map(m => m.heapUsed)),
      avgHeapUsed: this.metrics.memory.reduce((sum, m) => sum + m.heapUsed, 0) / this.metrics.memory.length
    };
  }

  /**
   * Get errors summary
   * @returns {Object} Errors summary
   * @private
   */
  getErrorsSummary() {
    const errorsByType = {};
    const errorsByOperation = {};

    for (const error of this.metrics.errors) {
      errorsByType[error.errorType] = (errorsByType[error.errorType] || 0) + 1;
      errorsByOperation[error.operation] = (errorsByOperation[error.operation] || 0) + 1;
    }

    return {
      total: this.metrics.errors.length,
      byType: errorsByType,
      byOperation: errorsByOperation,
      recent: this.metrics.errors.slice(-5)
    };
  }

  /**
   * Reset all performance metrics
   */
  reset() {
    this.metrics = {
      operations: new Map(),
      memory: [],
      timing: [],
      errors: []
    };

    this.activeTimers.clear();
    
    this.stats = {
      totalOperations: 0,
      totalErrors: 0,
      startTime: Date.now(),
      lastReset: Date.now()
    };
  }

  /**
   * Get current active operations count
   * @returns {number} Number of active operations
   */
  getActiveOperationsCount() {
    return this.activeTimers.size;
  }

  /**
   * Get performance insights and recommendations
   * @returns {Object} Performance insights
   */
  getInsights() {
    const report = this.generateReport();
    const insights = {
      recommendations: [],
      warnings: [],
      highlights: []
    };

    // Memory insights
    if (report.summary.memoryUsage.current.heapUsed > '256MB') {
      insights.warnings.push('High memory usage detected. Consider optimizing data structures.');
    }

    // Error rate insights
    const errorRate = parseFloat(report.summary.errorRate);
    if (errorRate > 5) {
      insights.warnings.push('High error rate detected. Review failing operations.');
    } else if (errorRate < 1) {
      insights.highlights.push('Excellent error rate - system is performing well.');
    }

    // Performance insights
    for (const [operation, stats] of Object.entries(report.operations)) {
      const avgDuration = parseFloat(stats.avgDuration);
      
      if (avgDuration > 1000) {
        insights.recommendations.push(
          `Consider optimizing ${operation} - average duration is ${stats.avgDuration}`
        );
      }
    }

    return insights;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.memoryTimer) {
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
    }
    
    this.activeTimers.clear();
  }
}