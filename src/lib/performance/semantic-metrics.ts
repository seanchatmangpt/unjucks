import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';

export interface SemanticMetrics {
  timestamp: number;
  memoryUsage: NodeJS.MemoryUsage;
  rdfOperations: {
    parsing: { count: number; totalTime: number; avgTime: number };
    querying: { count: number; totalTime: number; avgTime: number };
    indexing: { count: number; totalTime: number; avgTime: number };
  };
  cacheMetrics: {
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
  };
  performanceScores: {
    overall: number;
    memory: number;
    throughput: number;
    latency: number;
  };
  thresholds: {
    memoryWarning: number; // MB
    memoryError: number; // MB
    latencyWarning: number; // ms
    latencyError: number; // ms
  };
  alerts: Array<{
    level: 'warning' | 'error' | 'critical';
    message: string;
    timestamp: number;
    metric: string;
    value: number;
    threshold: number;
  }>;
}

export class SemanticMetricsCollector extends EventEmitter {
  private metrics: SemanticMetrics;
  private performanceObserver: PerformanceObserver;
  private collectionInterval: NodeJS.Timeout | null = null;
  private operationTimings: Map<string, number[]> = new Map();
  private cacheStats = { hits: 0, misses: 0, evictions: 0 };

  constructor() {
    super();
    this.metrics = this.initializeMetrics();
    this.setupPerformanceObserver();
  }

  private initializeMetrics(): SemanticMetrics {
    return {
      timestamp: Date.now(),
      memoryUsage: process.memoryUsage(),
      rdfOperations: {
        parsing: { count: 0, totalTime: 0, avgTime: 0 },
        querying: { count: 0, totalTime: 0, avgTime: 0 },
        indexing: { count: 0, totalTime: 0, avgTime: 0 }
      },
      cacheMetrics: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        evictions: 0
      },
      performanceScores: {
        overall: 100,
        memory: 100,
        throughput: 100,
        latency: 100
      },
      thresholds: {
        memoryWarning: 2048, // 2GB
        memoryError: 8192, // 8GB
        latencyWarning: 100, // 100ms
        latencyError: 1000 // 1s
      },
      alerts: []
    };
  }

  private setupPerformanceObserver(): void {
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        this.processPerformanceEntry(entry);
      });
    });
    
    this.performanceObserver.observe({ type: 'measure' });
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    const operationType = this.getOperationType(entry.name);
    if (!operationType) return;

    if (!this.operationTimings.has(operationType)) {
      this.operationTimings.set(operationType, []);
    }
    
    const timings = this.operationTimings.get(operationType)!;
    timings.push(entry.duration);
    
    // Keep only last 1000 measurements for rolling average
    if (timings.length > 1000) {
      timings.shift();
    }

    this.updateOperationMetrics(operationType, entry.duration);
    this.checkPerformanceThresholds(operationType, entry.duration);
  }

  private getOperationType(entryName: string): string | null {
    if (entryName.includes('parse') || entryName.includes('parsing')) return 'parsing';
    if (entryName.includes('query') || entryName.includes('search')) return 'querying';
    if (entryName.includes('index') || entryName.includes('indexing')) return 'indexing';
    return null;
  }

  private updateOperationMetrics(operationType: string, duration: number): void {
    const operation = this.metrics.rdfOperations[operationType as keyof typeof this.metrics.rdfOperations];
    if (operation) {
      operation.count++;
      operation.totalTime += duration;
      operation.avgTime = operation.totalTime / operation.count;
    }
  }

  private checkPerformanceThresholds(operationType: string, duration: number): void {
    const { latencyWarning, latencyError } = this.metrics.thresholds;
    
    if (duration > latencyError) {
      this.addAlert('error', `${operationType} operation exceeded error threshold`, operationType, duration, latencyError);
    } else if (duration > latencyWarning) {
      this.addAlert('warning', `${operationType} operation exceeded warning threshold`, operationType, duration, latencyWarning);
    }
  }

  private addAlert(level: 'warning' | 'error' | 'critical', message: string, metric: string, value: number, threshold: number): void {
    const alert = {
      level,
      message,
      timestamp: Date.now(),
      metric,
      value,
      threshold
    };
    
    this.metrics.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.metrics.alerts.length > 100) {
      this.metrics.alerts.shift();
    }
    
    this.emit('alert', alert);
  }

  public startCollection(intervalMs: number = 5000): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }
    
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
    
    // Initial collection
    this.collectMetrics();
  }

  public stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
  }

  private collectMetrics(): void {
    this.metrics.timestamp = Date.now();
    this.metrics.memoryUsage = process.memoryUsage();
    
    // Update cache metrics
    this.metrics.cacheMetrics = {
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      hitRate: this.cacheStats.hits + this.cacheStats.misses > 0 
        ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)) * 100 
        : 0,
      evictions: this.cacheStats.evictions
    };
    
    // Calculate performance scores
    this.calculatePerformanceScores();
    
    // Check memory thresholds
    this.checkMemoryThresholds();
    
    this.emit('metrics', this.metrics);
  }

  private calculatePerformanceScores(): void {
    const memoryMB = this.metrics.memoryUsage.heapUsed / (1024 * 1024);
    const { memoryWarning, memoryError, latencyWarning, latencyError } = this.metrics.thresholds;
    
    // Memory score (100 at 0MB, 50 at warning, 0 at error)
    let memoryScore = 100;
    if (memoryMB > memoryError) {
      memoryScore = 0;
    } else if (memoryMB > memoryWarning) {
      memoryScore = 50 - ((memoryMB - memoryWarning) / (memoryError - memoryWarning)) * 50;
    } else {
      memoryScore = Math.max(0, 100 - (memoryMB / memoryWarning) * 50);
    }
    
    // Latency score based on average query time
    const avgQueryTime = this.metrics.rdfOperations.querying.avgTime;
    let latencyScore = 100;
    if (avgQueryTime > latencyError) {
      latencyScore = 0;
    } else if (avgQueryTime > latencyWarning) {
      latencyScore = 50 - ((avgQueryTime - latencyWarning) / (latencyError - latencyWarning)) * 50;
    } else if (avgQueryTime > 0) {
      latencyScore = Math.max(0, 100 - (avgQueryTime / latencyWarning) * 50);
    }
    
    // Throughput score based on operations per second
    const totalOps = this.metrics.rdfOperations.parsing.count + 
                    this.metrics.rdfOperations.querying.count + 
                    this.metrics.rdfOperations.indexing.count;
    const runtimeSeconds = (Date.now() - this.metrics.timestamp) / 1000;
    const opsPerSecond = runtimeSeconds > 0 ? totalOps / runtimeSeconds : 0;
    
    // Scale throughput score (100 at 1000 ops/sec, 50 at 100 ops/sec, 0 at 10 ops/sec)
    let throughputScore = Math.min(100, Math.max(0, (opsPerSecond - 10) / 990 * 100));
    
    // Overall score as weighted average
    const overallScore = (memoryScore * 0.3) + (latencyScore * 0.4) + (throughputScore * 0.3);
    
    this.metrics.performanceScores = {
      overall: Math.round(overallScore),
      memory: Math.round(memoryScore),
      throughput: Math.round(throughputScore),
      latency: Math.round(latencyScore)
    };
  }

  private checkMemoryThresholds(): void {
    const memoryMB = this.metrics.memoryUsage.heapUsed / (1024 * 1024);
    const { memoryWarning, memoryError } = this.metrics.thresholds;
    
    if (memoryMB > memoryError) {
      this.addAlert('critical', `Memory usage exceeded critical threshold`, 'memory', memoryMB, memoryError);
    } else if (memoryMB > memoryWarning) {
      this.addAlert('warning', `Memory usage exceeded warning threshold`, 'memory', memoryMB, memoryWarning);
    }
  }

  public recordCacheHit(): void {
    this.cacheStats.hits++;
  }

  public recordCacheMiss(): void {
    this.cacheStats.misses++;
  }

  public recordCacheEviction(): void {
    this.cacheStats.evictions++;
  }

  public measureOperation<T>(operationType: string, operation: () => Promise<T>): Promise<T> {
    const startMark = `${operationType}-start-${Date.now()}`;
    const endMark = `${operationType}-end-${Date.now()}`;
    const measureName = `${operationType}-${Date.now()}`;
    
    performance.mark(startMark);
    
    return operation().then((result) => {
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);
      return result;
    }).catch((error) => {
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);
      throw error;
    });
  }

  public getMetrics(): SemanticMetrics {
    return { ...this.metrics };
  }

  public getPerformanceSummary(): {
    uptime: number;
    totalOperations: number;
    averageLatency: number;
    memoryUsageMB: number;
    cacheHitRate: number;
    alertCount: number;
  } {
    const totalOps = this.metrics.rdfOperations.parsing.count + 
                    this.metrics.rdfOperations.querying.count + 
                    this.metrics.rdfOperations.indexing.count;
    
    const totalTime = this.metrics.rdfOperations.parsing.totalTime + 
                     this.metrics.rdfOperations.querying.totalTime + 
                     this.metrics.rdfOperations.indexing.totalTime;
    
    return {
      uptime: Date.now() - this.metrics.timestamp,
      totalOperations: totalOps,
      averageLatency: totalOps > 0 ? totalTime / totalOps : 0,
      memoryUsageMB: this.metrics.memoryUsage.heapUsed / (1024 * 1024),
      cacheHitRate: this.metrics.cacheMetrics.hitRate,
      alertCount: this.metrics.alerts.length
    };
  }

  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.operationTimings.clear();
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
    performance.clearMarks();
    performance.clearMeasures();
  }

  public cleanup(): void {
    this.stopCollection();
    this.performanceObserver.disconnect();
    this.resetMetrics();
    this.removeAllListeners();
  }
}

// Singleton instance for global metrics collection
export const semanticMetrics = new SemanticMetricsCollector();

// Utility functions for common metric patterns
export function withMetrics<T>(operationType: string, operation: () => Promise<T>): Promise<T> {
  return semanticMetrics.measureOperation(operationType, operation);
}

export function recordCacheOperation(hit: boolean): void {
  if (hit) {
    semanticMetrics.recordCacheHit();
  } else {
    semanticMetrics.recordCacheMiss();
  }
}

// Performance monitoring decorator
export function MonitorPerformance(operationType: string) {
  return function (target: any, propertyName: string, descriptor: TypedPropertyDescriptor<any>) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return semanticMetrics.measureOperation(operationType, async () => {
        return method.apply(this, args);
      });
    };
    
    return descriptor;
  };
}