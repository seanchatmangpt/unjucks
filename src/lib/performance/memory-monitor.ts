import { EventEmitter } from 'events';

export interface MemorySnapshot {
  timestamp: number;
  usage: NodeJS.MemoryUsage;
  pressureLevel: 'normal' | 'warning' | 'critical';
  availableHeap: number;
  heapUtilization: number;
  gcStats?: {
    lastGC: number;
    gcCount: number;
    gcTime: number;
  };
}

export interface MemoryLeak {
  detected: boolean;
  growthRate: number; // MB/minute
  confidence: number; // 0-1
  recommendation: string;
}

export interface MemoryThresholds {
  warningThreshold: number; // MB
  criticalThreshold: number; // MB
  maxHeapSize: number; // MB
  gcPressureThreshold: number; // %
}

export class MemoryMonitor extends EventEmitter {
  private snapshots: MemorySnapshot[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private gcStats = { lastGC: 0, gcCount: 0, gcTime: 0 };
  private thresholds: MemoryThresholds;
  private readonly maxSnapshots = 1000; // Keep last 1000 snapshots for analysis

  constructor(thresholds?: Partial<MemoryThresholds>) {
    super();
    
    this.thresholds = {
      warningThreshold: 2048, // 2GB
      criticalThreshold: 6144, // 6GB
      maxHeapSize: 8192, // 8GB (typical Node.js limit)
      gcPressureThreshold: 80, // 80% heap utilization
      ...thresholds
    };

    // Set up GC monitoring if available
    this.setupGCMonitoring();
  }

  private setupGCMonitoring(): void {
    // Enable GC monitoring if available (requires --expose-gc flag)
    if (global.gc && process.env.NODE_ENV !== 'production') {
      const originalGC = global.gc;
      global.gc = () => {
        const startTime = Date.now();
        originalGC();
        const endTime = Date.now();
        
        this.gcStats.lastGC = endTime;
        this.gcStats.gcCount++;
        this.gcStats.gcTime += (endTime - startTime);
        
        this.emit('gc-completed', {
          timestamp: endTime,
          duration: endTime - startTime,
          totalGCTime: this.gcStats.gcTime,
          gcCount: this.gcStats.gcCount
        });
      };
    }
  }

  public startMonitoring(intervalMs: number = 5000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    // Take initial snapshot
    this.takeSnapshot();

    this.monitoringInterval = setInterval(() => {
      this.takeSnapshot();
    }, intervalMs);

    console.log(`Memory monitoring started with ${intervalMs}ms interval`);
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Memory monitoring stopped');
    }
  }

  private takeSnapshot(): void {
    const usage = process.memoryUsage();
    const heapUtilization = (usage.heapUsed / usage.heapTotal) * 100;
    const availableHeap = this.thresholds.maxHeapSize * 1024 * 1024 - usage.heapUsed;
    
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      usage,
      pressureLevel: this.calculatePressureLevel(usage),
      availableHeap,
      heapUtilization,
      gcStats: this.gcStats.gcCount > 0 ? { ...this.gcStats } : undefined
    };

    this.snapshots.push(snapshot);

    // Maintain snapshot history limit
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    // Check for alerts
    this.checkMemoryAlerts(snapshot);

    // Emit snapshot for real-time monitoring
    this.emit('snapshot', snapshot);

    // Periodic leak detection (every 10 snapshots)
    if (this.snapshots.length % 10 === 0 && this.snapshots.length >= 20) {
      const leakAnalysis = this.detectMemoryLeak();
      if (leakAnalysis.detected) {
        this.emit('memory-leak', leakAnalysis);
      }
    }
  }

  private calculatePressureLevel(usage: NodeJS.MemoryUsage): 'normal' | 'warning' | 'critical' {
    const heapUsedMB = usage.heapUsed / (1024 * 1024);
    
    if (heapUsedMB > this.thresholds.criticalThreshold) {
      return 'critical';
    } else if (heapUsedMB > this.thresholds.warningThreshold) {
      return 'warning';
    }
    
    return 'normal';
  }

  private checkMemoryAlerts(snapshot: MemorySnapshot): void {
    const heapUsedMB = snapshot.usage.heapUsed / (1024 * 1024);
    
    if (snapshot.pressureLevel === 'critical') {
      this.emit('memory-alert', {
        level: 'critical',
        message: `Critical memory usage: ${heapUsedMB.toFixed(2)}MB`,
        threshold: this.thresholds.criticalThreshold,
        current: heapUsedMB,
        recommendation: 'Immediate action required. Consider triggering GC or reducing memory usage.'
      });
    } else if (snapshot.pressureLevel === 'warning') {
      this.emit('memory-alert', {
        level: 'warning',
        message: `High memory usage: ${heapUsedMB.toFixed(2)}MB`,
        threshold: this.thresholds.warningThreshold,
        current: heapUsedMB,
        recommendation: 'Monitor closely. Consider optimizing memory usage.'
      });
    }

    // GC pressure check
    if (snapshot.heapUtilization > this.thresholds.gcPressureThreshold) {
      this.emit('gc-pressure', {
        utilization: snapshot.heapUtilization,
        threshold: this.thresholds.gcPressureThreshold,
        recommendation: 'High heap utilization detected. Consider manual GC or memory optimization.'
      });
    }
  }

  public detectMemoryLeak(): MemoryLeak {
    if (this.snapshots.length < 20) {
      return {
        detected: false,
        growthRate: 0,
        confidence: 0,
        recommendation: 'Insufficient data for leak detection'
      };
    }

    // Analyze memory growth over time
    const recentSnapshots = this.snapshots.slice(-20); // Last 20 snapshots
    const timeSpan = recentSnapshots[recentSnapshots.length - 1].timestamp - recentSnapshots[0].timestamp;
    const timeSpanMinutes = timeSpan / (1000 * 60);

    const memoryGrowth = recentSnapshots[recentSnapshots.length - 1].usage.heapUsed - recentSnapshots[0].usage.heapUsed;
    const growthRateMB = (memoryGrowth / (1024 * 1024)) / timeSpanMinutes;

    // Calculate trend confidence using linear regression
    const confidence = this.calculateTrendConfidence(recentSnapshots);

    // Leak detection criteria
    const significantGrowth = growthRateMB > 5; // More than 5MB/minute growth
    const highConfidence = confidence > 0.7; // Strong upward trend
    const sustainedGrowth = this.checkSustainedGrowth(recentSnapshots);

    const detected = significantGrowth && highConfidence && sustainedGrowth;

    let recommendation = 'Memory usage appears stable';
    if (detected) {
      recommendation = `Potential memory leak detected. Growth rate: ${growthRateMB.toFixed(2)}MB/min. ` +
                      'Investigate object retention, event listeners, and cache management.';
    } else if (significantGrowth) {
      recommendation = `Memory growth detected but may be normal. Rate: ${growthRateMB.toFixed(2)}MB/min. Monitor trend.`;
    }

    return {
      detected,
      growthRate: growthRateMB,
      confidence,
      recommendation
    };
  }

  private calculateTrendConfidence(snapshots: MemorySnapshot[]): number {
    // Simple linear regression to calculate R²
    const n = snapshots.length;
    const x = snapshots.map((_, i) => i); // Time index
    const y = snapshots.map(s => s.usage.heapUsed / (1024 * 1024)); // Memory in MB

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const yMean = sumY / n;
    const totalVariation = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const explainedVariation = x.reduce((sum, xi, i) => {
      const predicted = slope * xi + intercept;
      return sum + Math.pow(predicted - yMean, 2);
    }, 0);

    const rSquared = totalVariation > 0 ? explainedVariation / totalVariation : 0;
    return Math.min(1, Math.max(0, rSquared)); // Clamp between 0 and 1
  }

  private checkSustainedGrowth(snapshots: MemorySnapshot[]): boolean {
    // Check if memory has grown in at least 70% of intervals
    let growthIntervals = 0;
    for (let i = 1; i < snapshots.length; i++) {
      if (snapshots[i].usage.heapUsed > snapshots[i - 1].usage.heapUsed) {
        growthIntervals++;
      }
    }
    
    return (growthIntervals / (snapshots.length - 1)) > 0.7;
  }

  public getMemoryReport(): {
    current: MemorySnapshot;
    trends: {
      memoryGrowthRate: number;
      leakDetection: MemoryLeak;
      averageUtilization: number;
      peakUsage: number;
    };
    recommendations: string[];
  } {
    const current = this.snapshots[this.snapshots.length - 1] || this.createEmptySnapshot();
    const leakDetection = this.detectMemoryLeak();
    
    // Calculate trends
    const recentSnapshots = this.snapshots.slice(-50); // Last 50 snapshots
    const averageUtilization = recentSnapshots.length > 0 
      ? recentSnapshots.reduce((sum, s) => sum + s.heapUtilization, 0) / recentSnapshots.length
      : 0;
    
    const peakUsage = Math.max(...this.snapshots.map(s => s.usage.heapUsed / (1024 * 1024)));

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (current.pressureLevel === 'critical') {
      recommendations.push('CRITICAL: Reduce memory usage immediately or restart application');
    }
    
    if (leakDetection.detected) {
      recommendations.push(`Memory leak detected: ${leakDetection.recommendation}`);
    }
    
    if (averageUtilization > 80) {
      recommendations.push('High average heap utilization. Consider increasing heap size or optimizing memory usage');
    }
    
    if (current.gcStats && current.gcStats.gcCount > 100) {
      recommendations.push('Frequent garbage collection detected. Review object creation patterns');
    }

    if (recommendations.length === 0) {
      recommendations.push('Memory usage appears healthy');
    }

    return {
      current,
      trends: {
        memoryGrowthRate: leakDetection.growthRate,
        leakDetection,
        averageUtilization,
        peakUsage
      },
      recommendations
    };
  }

  private createEmptySnapshot(): MemorySnapshot {
    return {
      timestamp: Date.now(),
      usage: process.memoryUsage(),
      pressureLevel: 'normal',
      availableHeap: this.thresholds.maxHeapSize * 1024 * 1024,
      heapUtilization: 0
    };
  }

  public forceGarbageCollection(): boolean {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  }

  public getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  public clearHistory(): void {
    this.snapshots = [];
    this.gcStats = { lastGC: 0, gcCount: 0, gcTime: 0 };
  }

  public updateThresholds(newThresholds: Partial<MemoryThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('Memory monitor thresholds updated:', this.thresholds);
  }

  public cleanup(): void {
    this.stopMonitoring();
    this.clearHistory();
    this.removeAllListeners();
  }
}

// Global memory monitor instance
export const memoryMonitor = new MemoryMonitor();

// Utility function to get current memory status
export function getMemoryStatus(): {
  usage: NodeJS.MemoryUsage;
  usageMB: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  pressureLevel: 'normal' | 'warning' | 'critical';
} {
  const usage = process.memoryUsage();
  const usageMB = {
    rss: usage.rss / (1024 * 1024),
    heapUsed: usage.heapUsed / (1024 * 1024),
    heapTotal: usage.heapTotal / (1024 * 1024),
    external: usage.external / (1024 * 1024)
  };

  let pressureLevel: 'normal' | 'warning' | 'critical' = 'normal';
  if (usageMB.heapUsed > 6144) {
    pressureLevel = 'critical';
  } else if (usageMB.heapUsed > 2048) {
    pressureLevel = 'warning';
  }

  return { usage, usageMB, pressureLevel };
}

// Memory pressure decorator for automatic monitoring
export function MonitorMemory(threshold?: number) {
  return function (target: any, propertyName: string, descriptor: TypedPropertyDescriptor<any>) {
    const method = descriptor.value;
    const memThreshold = threshold || 2048; // Default 2GB threshold
    
    descriptor.value = async function (...args: any[]) {
      const beforeMemory = process.memoryUsage();
      const result = await method.apply(this, args);
      const afterMemory = process.memoryUsage();
      
      const memoryDelta = (afterMemory.heapUsed - beforeMemory.heapUsed) / (1024 * 1024);
      
      if (memoryDelta > memThreshold * 0.1) { // Alert if operation used more than 10% of threshold
        console.warn(`High memory usage in ${propertyName}: ${memoryDelta.toFixed(2)}MB`);
      }
      
      return result;
    };
    
    return descriptor;
  };
}