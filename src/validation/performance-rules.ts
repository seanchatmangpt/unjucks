import type { TurtleData } from '../lib/types/turtle-types.js';
import type { ValidationError, PerformanceMetrics } from '../lib/semantic-validator.js';

/**
 * Performance validation thresholds for enterprise RDF processing
 */
export interface PerformanceThresholds {
  // Volume thresholds
  maxTriples: number;        // Maximum RDF triples (100K+ target)
  maxSubjects: number;       // Maximum unique subjects
  maxPredicates: number;     // Maximum unique predicates
  
  // Memory thresholds
  maxMemoryMB: number;       // Maximum memory usage in MB
  maxDataSizeMB: number;     // Maximum raw data size
  
  // Performance thresholds
  maxProcessingTimeMs: number;  // Maximum processing time
  maxQueryLatencyMs: number;    // Maximum query response time
  maxParsingTimeMs: number;     // Maximum parsing time
  
  // Quality thresholds
  minCompleteness: number;      // Minimum data completeness percentage
  maxErrorRate: number;         // Maximum acceptable error rate
  
  // Scalability thresholds
  maxConcurrentQueries: number; // Maximum concurrent query load
  maxTemplateSize: number;      // Maximum template size in lines
}

/**
 * Default enterprise performance thresholds (80/20 rule)
 */
export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
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
 */
export type BenchmarkCategory = 
  | 'volume'      // Data volume handling
  | 'memory'      // Memory efficiency 
  | 'latency'     // Response time
  | 'throughput'  // Processing throughput
  | 'quality'     // Data quality
  | 'scalability' // Concurrent processing;

/**
 * Performance benchmark result
 */
export interface BenchmarkResult {
  category: BenchmarkCategory;
  metric: string;
  value: number;
  threshold: number;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  impact: 'high' | 'medium' | 'low';
  recommendation?: string;
}

/**
 * Enterprise Performance Validator
 * Implements 80/20 performance validation for 100K+ triple processing
 */
export class PerformanceValidator {
  private thresholds: PerformanceThresholds;
  private startTime: number;
  private benchmarks: Map<string, BenchmarkResult[]>;

  constructor(customThresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = { ...DEFAULT_PERFORMANCE_THRESHOLDS, ...customThresholds };
    this.startTime = 0;
    this.benchmarks = new Map();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    this.startTime = performance.now();
  }

  /**
   * Validate performance metrics against enterprise thresholds
   */
  validatePerformance(
    data: TurtleData,
    options: {
      enableVolumeValidation?: boolean;
      enableMemoryValidation?: boolean;
      enableLatencyValidation?: boolean;
      enableQualityValidation?: boolean;
    } = {}
  ): {
    metrics: PerformanceMetrics;
    violations: ValidationError[];
    benchmarks: BenchmarkResult[];
    recommendations: string[];
  } {
    const violations: ValidationError[] = [];
    const benchmarks: BenchmarkResult[] = [];
    const recommendations: string[] = [];

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
   */
  benchmark(
    category: BenchmarkCategory,
    operation: () => Promise<any> | any,
    expectedThreshold?: number
  ): Promise<BenchmarkResult> {
    return new Promise(async (resolve) => {
      const startTime = performance.now();
      let error: Error | null = null;

      try {
        await operation();
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      
      const threshold = expectedThreshold || this.getThresholdForCategory(category);
      const passed = !error && duration <= threshold;

      const result: BenchmarkResult = {
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
      this.benchmarks.get(category)!.push(result);

      resolve(result);
    });
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    totalBenchmarks: number;
    passedBenchmarks: number;
    failedBenchmarks: number;
    averagePerformance: Record<BenchmarkCategory, number>;
  } {
    let total = 0;
    let passed = 0;
    const averages: Record<string, number[]> = {};

    for (const [category, results] of this.benchmarks) {
      total += results.length;
      passed += results.filter(r => r.passed).length;
      
      averages[category] = results.map(r => r.value);
    }

    const averagePerformance: Record<BenchmarkCategory, number> = {} as any;
    for (const [category, values] of Object.entries(averages)) {
      averagePerformance[category as BenchmarkCategory] = 
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

  private calculateMetrics(data: TurtleData): PerformanceMetrics {
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

  private validateVolume(data: TurtleData, metrics: PerformanceMetrics): BenchmarkResult[] {
    const benchmarks: BenchmarkResult[] = [];

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

  private validateMemory(data: TurtleData, metrics: PerformanceMetrics): BenchmarkResult[] {
    const benchmarks: BenchmarkResult[] = [];

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

  private validateLatency(metrics: PerformanceMetrics): BenchmarkResult[] {
    const benchmarks: BenchmarkResult[] = [];

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

  private validateQuality(data: TurtleData, metrics: PerformanceMetrics): BenchmarkResult[] {
    const benchmarks: BenchmarkResult[] = [];

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

  private calculateCompleteness(data: TurtleData): number {
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

  private addViolationsFromBenchmarks(benchmarks: BenchmarkResult[], violations: ValidationError[]): void {
    for (const benchmark of benchmarks) {
      if (!benchmark.passed) {
        violations.push({
          code: `PERFORMANCE_${benchmark.category.toUpperCase()}_${benchmark.metric.toUpperCase()}`,
          message: `Performance threshold exceeded: ${benchmark.metric} = ${benchmark.value} (threshold: ${benchmark.threshold})`,
          severity: benchmark.severity as 'error' | 'warning' | 'info',
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

  private generateRecommendations(benchmarks: BenchmarkResult[]): string[] {
    const recommendations: string[] = [];
    const failedBenchmarks = benchmarks.filter(b => !b.passed);

    // Group by category for targeted recommendations
    const categoryFailures = new Map<BenchmarkCategory, BenchmarkResult[]>();
    for (const benchmark of failedBenchmarks) {
      if (!categoryFailures.has(benchmark.category)) {
        categoryFailures.set(benchmark.category, []);
      }
      categoryFailures.get(benchmark.category)!.push(benchmark);
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

  private calculateVolumeImpact(value: number, threshold: number): 'high' | 'medium' | 'low' {
    const ratio = value / threshold;
    if (ratio > 2) return 'high';
    if (ratio > 1.5) return 'medium';
    return 'low';
  }

  private calculateMemoryImpact(value: number, threshold: number): 'high' | 'medium' | 'low' {
    const ratio = value / threshold;
    if (ratio > 1.5) return 'high';
    if (ratio > 1.2) return 'medium';
    return 'low';
  }

  private calculateLatencyImpact(value: number, threshold: number): 'high' | 'medium' | 'low' {
    const ratio = value / threshold;
    if (ratio > 3) return 'high';
    if (ratio > 2) return 'medium';
    return 'low';
  }

  private calculateImpact(category: BenchmarkCategory, value: number, threshold: number): 'high' | 'medium' | 'low' {
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

  private getThresholdForCategory(category: BenchmarkCategory): number {
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

  private getRecommendationForCategory(category: BenchmarkCategory): string {
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