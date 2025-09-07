/**
 * @typedef {import('../lib/types/turtle-types.js').TurtleData} TurtleData
 * @typedef {import('../lib/semantic-validator.js').ValidationError} ValidationError
 * @typedef {import('../lib/semantic-validator.js').PerformanceMetrics} PerformanceMetrics
 */

/**
 * Performance validation thresholds for enterprise RDF processing
 * @typedef {Object} PerformanceThresholds
 * @property {number} maxTriples - Maximum RDF triples (100K+ target)
 * @property {number} maxSubjects - Maximum unique subjects
 * @property {number} maxPredicates - Maximum unique predicates
 * @property {number} maxMemoryMB - Maximum memory usage in MB
 * @property {number} maxDataSizeMB - Maximum raw data size
 * @property {number} maxProcessingTimeMs - Maximum processing time
 * @property {number} maxQueryLatencyMs - Maximum query response time
 * @property {number} maxParsingTimeMs - Maximum parsing time
 * @property {number} minCompleteness - Minimum data completeness percentage
 * @property {number} maxErrorRate - Maximum acceptable error rate
 * @property {number} maxConcurrentQueries - Maximum concurrent query load
 * @property {number} maxTemplateSize - Maximum template size in lines
 */

/**
 * Default enterprise performance thresholds (80/20 rule)
 * @type {PerformanceThresholds}
 */
export const DEFAULT_PERFORMANCE_THRESHOLDS = {
  // 100K+ triple processing capability
  maxTriples: 100000,
  maxSubjects: 25000,
  maxPredicates: 1000,
  
  // Memory constraints (< 2GB target)
  maxMemoryMB: 2048,
  maxDataSizeMB: 500,
  
  // Performance targets
  maxProcessingTimeMs: 5000,    // < 5s processing
  maxQueryLatencyMs: 100,       // < 100ms queries
  maxParsingTimeMs: 2000,       // < 2s parsing
  
  // Quality standards
  minCompleteness: 0.95,        // 95% completeness
  maxErrorRate: 0.01,           // 1% error rate
  
  // Scalability limits
  maxConcurrentQueries: 50,
  maxTemplateSize: 1000
};

/**
 * Performance benchmark categories
 * @typedef {'volume'|'memory'|'latency'|'throughput'|'quality'|'scalability'} BenchmarkCategory
 */

/**
 * Performance benchmark result
 * @typedef {Object} BenchmarkResult
 * @property {BenchmarkCategory} category
 * @property {string} metric
 * @property {number} value
 * @property {number} threshold
 * @property {boolean} passed
 * @property {'error'|'warning'|'info'} severity
 * @property {'high'|'medium'|'low'} impact
 * @property {string} [recommendation]
 */

/**
 * Enterprise Performance Validator
 * Implements 80/20 performance validation for 100K+ triple processing
 */
export class PerformanceValidator {
  /**
   * @param {Partial<PerformanceThresholds>} [customThresholds] - Custom performance thresholds
   */
  constructor(customThresholds) {
    /** @type {PerformanceThresholds} */
    this.thresholds = { ...DEFAULT_PERFORMANCE_THRESHOLDS, ...customThresholds };
    /** @type {number} */
    this.startTime = 0;
    /** @type {Map<string, BenchmarkResult[]>} */
    this.benchmarks = new Map();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring() {
    this.startTime = performance.now();
  }

  /**
   * Validate performance metrics against enterprise thresholds
   * @param {TurtleData} data - Turtle data to validate
   * @param {Object} [options] - Validation options
   * @param {boolean} [options.enableVolumeValidation] - Enable volume validation
   * @param {boolean} [options.enableMemoryValidation] - Enable memory validation
   * @param {boolean} [options.enableLatencyValidation] - Enable latency validation
   * @param {boolean} [options.enableQualityValidation] - Enable quality validation
   * @returns {Object} Validation results
   */
  validatePerformance(data, options = {}) {
    /** @type {ValidationError[]} */
    const violations = [];
    /** @type {BenchmarkResult[]} */
    const benchmarks = [];
    /** @type {string[]} */
    const recommendations = [];

    // Calculate current metrics
    const metrics = this.calculateMetrics(data);

    // 1. Volume Validation (100K+ triple capability)
    if (options.enableVolumeValidation !== false) {
      const volumeBenchmarks = this.validateVolume(data, metrics);
      benchmarks.push(...volumeBenchmarks);
      this.addViolationsFromBenchmarks(volumeBenchmarks, violations);
    }

    // 2. Memory Validation (< 2GB constraint)
    if (options.enableMemoryValidation !== false) {
      const memoryBenchmarks = this.validateMemory(data, metrics);
      benchmarks.push(...memoryBenchmarks);
      this.addViolationsFromBenchmarks(memoryBenchmarks, violations);
    }

    // 3. Latency Validation (< 100ms queries)
    if (options.enableLatencyValidation !== false) {
      const latencyBenchmarks = this.validateLatency(metrics);
      benchmarks.push(...latencyBenchmarks);
      this.addViolationsFromBenchmarks(latencyBenchmarks, violations);
    }

    // 4. Quality Validation
    if (options.enableQualityValidation !== false) {
      const qualityBenchmarks = this.validateQuality(data, metrics);
      benchmarks.push(...qualityBenchmarks);
      this.addViolationsFromBenchmarks(qualityBenchmarks, violations);
    }

    // Generate recommendations based on failures
    recommendations.push(...this.generateRecommendations(benchmarks));

    return {
      metrics,
      violations,
      benchmarks,
      recommendations
    };
  }

  /**
   * Benchmark specific performance aspect
   * @param {BenchmarkCategory} category - Performance category
   * @param {Function} operation - Operation to benchmark
   * @param {number} [expectedThreshold] - Expected threshold
   * @returns {Promise<BenchmarkResult>}
   */
  async benchmark(category, operation, expectedThreshold) {
    const startTime = performance.now();
    let error = null;

    try {
      await operation();
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    const threshold = expectedThreshold || this.getThresholdForCategory(category);
    const passed = !error && duration <= threshold;

    /** @type {BenchmarkResult} */
    const result = {
      category,
      metric: 'execution_time_ms',
      value: duration,
      threshold,
      passed,
      severity: passed ? 'info' : duration > threshold * 2 ? 'error' : 'warning',
      impact: this.calculateImpact(category, duration, threshold),
      recommendation: passed ? undefined : this.getRecommendationForCategory(category)
    };

    if (!this.benchmarks.has(category)) {
      this.benchmarks.set(category, []);
    }
    this.benchmarks.get(category).push(result);

    return result;
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance statistics
   */
  getPerformanceStats() {
    let total = 0;
    let passed = 0;
    /** @type {Record<string, number[]>} */
    const averages = {};

    for (const [category, results] of this.benchmarks) {
      total += results.length;
      passed += results.filter(r => r.passed).length;
      
      averages[category] = results.map(r => r.value);
    }

    /** @type {Record<BenchmarkCategory, number>} */
    const averagePerformance = {};
    for (const [category, values] of Object.entries(averages)) {
      averagePerformance[/** @type {BenchmarkCategory} */ (category)] = 
        values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    return {
      totalBenchmarks: total,
      passedBenchmarks: passed,
      failedBenchmarks: total - passed,
      averagePerformance
    };
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Calculate performance metrics
   * @private
   * @param {TurtleData} data - Turtle data
   * @returns {PerformanceMetrics} Performance metrics
   */
  calculateMetrics(data) {
    const processingTime = this.startTime > 0 ? performance.now() - this.startTime : 0;
    
    // Estimate memory usage (approximation)
    const dataString = JSON.stringify(data);
    const memoryUsage = Math.round((dataString.length * 2) / 1024 / 1024); // Rough MB estimate

    return {
      tripleCount: data.triples?.length || 0,
      memoryUsage,
      processingTime,
      threshold: this.thresholds
    };
  }

  /**
   * Validate volume metrics
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {PerformanceMetrics} metrics - Performance metrics
   * @returns {BenchmarkResult[]} Volume benchmarks
   */
  validateVolume(data, metrics) {
    /** @type {BenchmarkResult[]} */
    const benchmarks = [];

    // Triple count validation
    benchmarks.push({
      category: 'volume',
      metric: 'triple_count',
      value: metrics.tripleCount,
      threshold: this.thresholds.maxTriples,
      passed: metrics.tripleCount <= this.thresholds.maxTriples,
      severity: metrics.tripleCount > this.thresholds.maxTriples ? 'error' : 'info',
      impact: this.calculateVolumeImpact(metrics.tripleCount, this.thresholds.maxTriples),
      recommendation: metrics.tripleCount > this.thresholds.maxTriples 
        ? 'Consider data partitioning or streaming processing for large datasets'
        : undefined
    });

    // Subject count validation
    const subjectCount = Object.keys(data.subjects || {}).length;
    benchmarks.push({
      category: 'volume',
      metric: 'subject_count',
      value: subjectCount,
      threshold: this.thresholds.maxSubjects,
      passed: subjectCount <= this.thresholds.maxSubjects,
      severity: subjectCount > this.thresholds.maxSubjects ? 'warning' : 'info',
      impact: this.calculateVolumeImpact(subjectCount, this.thresholds.maxSubjects)
    });

    // Predicate count validation
    const predicateCount = data.predicates?.size || 0;
    benchmarks.push({
      category: 'volume',
      metric: 'predicate_count',
      value: predicateCount,
      threshold: this.thresholds.maxPredicates,
      passed: predicateCount <= this.thresholds.maxPredicates,
      severity: predicateCount > this.thresholds.maxPredicates ? 'warning' : 'info',
      impact: this.calculateVolumeImpact(predicateCount, this.thresholds.maxPredicates)
    });

    return benchmarks;
  }

  /**
   * Validate memory metrics
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {PerformanceMetrics} metrics - Performance metrics
   * @returns {BenchmarkResult[]} Memory benchmarks
   */
  validateMemory(data, metrics) {
    /** @type {BenchmarkResult[]} */
    const benchmarks = [];

    // Memory usage validation
    benchmarks.push({
      category: 'memory',
      metric: 'memory_usage_mb',
      value: metrics.memoryUsage,
      threshold: this.thresholds.maxMemoryMB,
      passed: metrics.memoryUsage <= this.thresholds.maxMemoryMB,
      severity: metrics.memoryUsage > this.thresholds.maxMemoryMB ? 'error' : 'info',
      impact: this.calculateMemoryImpact(metrics.memoryUsage, this.thresholds.maxMemoryMB),
      recommendation: metrics.memoryUsage > this.thresholds.maxMemoryMB 
        ? 'Optimize data structures or implement memory-efficient processing'
        : undefined
    });

    // Data size validation
    const dataSizeMB = Math.round(JSON.stringify(data).length / 1024 / 1024);
    benchmarks.push({
      category: 'memory',
      metric: 'data_size_mb',
      value: dataSizeMB,
      threshold: this.thresholds.maxDataSizeMB,
      passed: dataSizeMB <= this.thresholds.maxDataSizeMB,
      severity: dataSizeMB > this.thresholds.maxDataSizeMB ? 'warning' : 'info',
      impact: this.calculateMemoryImpact(dataSizeMB, this.thresholds.maxDataSizeMB)
    });

    return benchmarks;
  }

  /**
   * Validate latency metrics
   * @private
   * @param {PerformanceMetrics} metrics - Performance metrics
   * @returns {BenchmarkResult[]} Latency benchmarks
   */
  validateLatency(metrics) {
    /** @type {BenchmarkResult[]} */
    const benchmarks = [];

    // Processing time validation
    benchmarks.push({
      category: 'latency',
      metric: 'processing_time_ms',
      value: metrics.processingTime,
      threshold: this.thresholds.maxProcessingTimeMs,
      passed: metrics.processingTime <= this.thresholds.maxProcessingTimeMs,
      severity: metrics.processingTime > this.thresholds.maxProcessingTimeMs ? 'error' : 'info',
      impact: this.calculateLatencyImpact(metrics.processingTime, this.thresholds.maxProcessingTimeMs),
      recommendation: metrics.processingTime > this.thresholds.maxProcessingTimeMs 
        ? 'Optimize parsing algorithms or implement incremental processing'
        : undefined
    });

    // Query latency (if available)
    if (metrics.queryLatency !== undefined) {
      benchmarks.push({
        category: 'latency',
        metric: 'query_latency_ms',
        value: metrics.queryLatency,
        threshold: this.thresholds.maxQueryLatencyMs,
        passed: metrics.queryLatency <= this.thresholds.maxQueryLatencyMs,
        severity: metrics.queryLatency > this.thresholds.maxQueryLatencyMs ? 'error' : 'info',
        impact: this.calculateLatencyImpact(metrics.queryLatency, this.thresholds.maxQueryLatencyMs),
        recommendation: metrics.queryLatency > this.thresholds.maxQueryLatencyMs 
          ? 'Add query optimization, indexing, or caching mechanisms'
          : undefined
      });
    }

    return benchmarks;
  }

  /**
   * Validate quality metrics
   * @private
   * @param {TurtleData} data - Turtle data
   * @param {PerformanceMetrics} metrics - Performance metrics
   * @returns {BenchmarkResult[]} Quality benchmarks
   */
  validateQuality(data, metrics) {
    /** @type {BenchmarkResult[]} */
    const benchmarks = [];

    // Data completeness validation
    const completeness = this.calculateCompleteness(data);
    benchmarks.push({
      category: 'quality',
      metric: 'data_completeness',
      value: completeness,
      threshold: this.thresholds.minCompleteness,
      passed: completeness >= this.thresholds.minCompleteness,
      severity: completeness < this.thresholds.minCompleteness ? 'warning' : 'info',
      impact: completeness < this.thresholds.minCompleteness ? 'medium' : 'low',
      recommendation: completeness < this.thresholds.minCompleteness 
        ? 'Improve data validation and completeness checks'
        : undefined
    });

    return benchmarks;
  }

  /**
   * Calculate data completeness
   * @private
   * @param {TurtleData} data - Turtle data
   * @returns {number} Completeness ratio (0-1)
   */
  calculateCompleteness(data) {
    if (!data.subjects || Object.keys(data.subjects).length === 0) {
      return 0;
    }

    let totalProperties = 0;
    let filledProperties = 0;

    for (const resource of Object.values(data.subjects)) {
      for (const [predicate, values] of Object.entries(resource.properties)) {
        totalProperties++;
        if (values && values.length > 0 && values[0].value.trim() !== '') {
          filledProperties++;
        }
      }
    }

    return totalProperties > 0 ? filledProperties / totalProperties : 1;
  }

  /**
   * Add violations from benchmarks
   * @private
   * @param {BenchmarkResult[]} benchmarks - Benchmarks to process
   * @param {ValidationError[]} violations - Violations array to populate
   */
  addViolationsFromBenchmarks(benchmarks, violations) {
    for (const benchmark of benchmarks) {
      if (!benchmark.passed) {
        violations.push({
          code: `PERFORMANCE_${benchmark.category.toUpperCase()}_${benchmark.metric.toUpperCase()}`,
          message: `Performance threshold exceeded: ${benchmark.metric} = ${benchmark.value} (threshold: ${benchmark.threshold})`,
          severity: benchmark.severity,
          context: {
            category: benchmark.category,
            metric: benchmark.metric,
            value: benchmark.value,
            threshold: benchmark.threshold,
            impact: benchmark.impact
          }
        });
      }
    }
  }

  /**
   * Generate recommendations from benchmarks
   * @private
   * @param {BenchmarkResult[]} benchmarks - Failed benchmarks
   * @returns {string[]} Recommendations
   */
  generateRecommendations(benchmarks) {
    /** @type {string[]} */
    const recommendations = [];
    const failedBenchmarks = benchmarks.filter(b => !b.passed);

    // Group by category for targeted recommendations
    /** @type {Map<BenchmarkCategory, BenchmarkResult[]>} */
    const categoryFailures = new Map();
    for (const benchmark of failedBenchmarks) {
      if (!categoryFailures.has(benchmark.category)) {
        categoryFailures.set(benchmark.category, []);
      }
      categoryFailures.get(benchmark.category).push(benchmark);
    }

    // Generate category-specific recommendations
    for (const [category, failures] of categoryFailures) {
      switch (category) {
        case 'volume':
          recommendations.push('Consider implementing data partitioning strategies for large datasets');
          recommendations.push('Use streaming processing for datasets exceeding volume limits');
          break;
        case 'memory':
          recommendations.push('Optimize data structures and implement memory-efficient processing');
          recommendations.push('Consider using memory mapping or external sorting for large datasets');
          break;
        case 'latency':
          recommendations.push('Implement query optimization and result caching');
          recommendations.push('Consider parallel processing for compute-intensive operations');
          break;
        case 'quality':
          recommendations.push('Improve data validation and quality assurance processes');
          break;
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Calculate volume impact
   * @private
   * @param {number} value - Current value
   * @param {number} threshold - Threshold value
   * @returns {'high'|'medium'|'low'} Impact level
   */
  calculateVolumeImpact(value, threshold) {
    const ratio = value / threshold;
    if (ratio > 2) return 'high';
    if (ratio > 1.5) return 'medium';
    return 'low';
  }

  /**
   * Calculate memory impact
   * @private
   * @param {number} value - Current value
   * @param {number} threshold - Threshold value
   * @returns {'high'|'medium'|'low'} Impact level
   */
  calculateMemoryImpact(value, threshold) {
    const ratio = value / threshold;
    if (ratio > 1.5) return 'high';
    if (ratio > 1.2) return 'medium';
    return 'low';
  }

  /**
   * Calculate latency impact
   * @private
   * @param {number} value - Current value
   * @param {number} threshold - Threshold value
   * @returns {'high'|'medium'|'low'} Impact level
   */
  calculateLatencyImpact(value, threshold) {
    const ratio = value / threshold;
    if (ratio > 3) return 'high';
    if (ratio > 2) return 'medium';
    return 'low';
  }

  /**
   * Calculate general impact
   * @private
   * @param {BenchmarkCategory} category - Performance category
   * @param {number} value - Current value
   * @param {number} threshold - Threshold value
   * @returns {'high'|'medium'|'low'} Impact level
   */
  calculateImpact(category, value, threshold) {
    switch (category) {
      case 'volume':
        return this.calculateVolumeImpact(value, threshold);
      case 'memory':
        return this.calculateMemoryImpact(value, threshold);
      case 'latency':
        return this.calculateLatencyImpact(value, threshold);
      default:
        return value > threshold * 1.5 ? 'high' : 'medium';
    }
  }

  /**
   * Get threshold for category
   * @private
   * @param {BenchmarkCategory} category - Performance category
   * @returns {number} Threshold value
   */
  getThresholdForCategory(category) {
    switch (category) {
      case 'volume': return this.thresholds.maxTriples;
      case 'memory': return this.thresholds.maxMemoryMB;
      case 'latency': return this.thresholds.maxProcessingTimeMs;
      case 'throughput': return this.thresholds.maxConcurrentQueries;
      case 'quality': return this.thresholds.minCompleteness;
      case 'scalability': return this.thresholds.maxTemplateSize;
      default: return 1000;
    }
  }

  /**
   * Get recommendation for category
   * @private
   * @param {BenchmarkCategory} category - Performance category
   * @returns {string} Recommendation text
   */
  getRecommendationForCategory(category) {
    switch (category) {
      case 'volume': return 'Implement data partitioning or streaming processing';
      case 'memory': return 'Optimize memory usage with efficient data structures';
      case 'latency': return 'Add caching and query optimization';
      case 'throughput': return 'Implement parallel processing capabilities';
      case 'quality': return 'Improve data validation processes';
      case 'scalability': return 'Refactor for better scalability patterns';
      default: return 'Review and optimize performance bottlenecks';
    }
  }
}

/**
 * Export singleton instance with default enterprise thresholds
 */
export const enterprisePerformanceValidator = new PerformanceValidator(DEFAULT_PERFORMANCE_THRESHOLDS);