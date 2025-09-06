// Performance monitoring and optimization utilities
// Provides real-time performance tracking without impacting CLI speed

import fs from "fs-extra";
import path from "node:path";

export interface PerformanceEntry {
  command: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  success: boolean;
  errors?: string[];
}

export interface PerformanceStats {
  totalCommands: number;
  averageDuration: number;
  successRate: number;
  memoryTrend: number[];
  bottlenecks: string[];
}

class PerformanceMonitor {
  private entries: PerformanceEntry[] = [];
  private currentCommand: string | null = null;
  private startTime: number = 0;
  private errors: string[] = [];
  private maxEntries = 100; // Keep last 100 commands
  private metricsFile: string;

  constructor() {
    this.metricsFile = path.join(process.cwd(), '.unjucks-cache', 'performance.json');
    this.loadMetrics();
  }

  startCommand(command: string): void {
    this.currentCommand = command;
    this.startTime = performance.now();
    this.errors = [];
  }

  endCommand(success: boolean = true): void {
    if (!this.currentCommand) return;

    const endTime = performance.now();
    const entry: PerformanceEntry = {
      command: this.currentCommand,
      startTime: this.startTime,
      endTime,
      duration: endTime - this.startTime,
      memoryUsage: process.memoryUsage(),
      success,
      errors: this.errors.length > 0 ? [...this.errors] : undefined
    };

    this.entries.push(entry);
    
    // Keep only recent entries to prevent memory bloat
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Async save to avoid blocking CLI
    this.saveMetricsAsync();

    this.currentCommand = null;
    this.errors = [];
  }

  logError(error: string): void {
    this.errors.push(error);
  }

  getStats(): PerformanceStats {
    if (this.entries.length === 0) {
      return {
        totalCommands: 0,
        averageDuration: 0,
        successRate: 100,
        memoryTrend: [],
        bottlenecks: []
      };
    }

    const totalDuration = this.entries.reduce((sum, entry) => sum + entry.duration, 0);
    const successCount = this.entries.filter(entry => entry.success).length;
    const memoryTrend = this.entries
      .slice(-10) // Last 10 commands
      .map(entry => entry.memoryUsage.heapUsed / 1024 / 1024); // MB

    // Identify bottlenecks (commands taking longer than 2x average)
    const avgDuration = totalDuration / this.entries.length;
    const slowCommands = this.entries
      .filter(entry => entry.duration > avgDuration * 2)
      .map(entry => entry.command);
    
    const bottlenecks = [...new Set(slowCommands)]; // Remove duplicates

    return {
      totalCommands: this.entries.length,
      averageDuration: avgDuration,
      successRate: (successCount / this.entries.length) * 100,
      memoryTrend,
      bottlenecks
    };
  }

  getRecentEntries(count: number = 10): PerformanceEntry[] {
    return this.entries.slice(-count);
  }

  private async loadMetrics(): Promise<void> {
    try {
      if (await fs.pathExists(this.metricsFile)) {
        const data = await fs.readJSON(this.metricsFile);
        this.entries = data.entries || [];
        // Keep only recent entries
        if (this.entries.length > this.maxEntries) {
          this.entries = this.entries.slice(-this.maxEntries);
        }
      }
    } catch (error) {
      // Ignore load errors, start fresh
      this.entries = [];
    }
  }

  private saveMetricsAsync(): void {
    // Use setImmediate to avoid blocking the CLI
    setImmediate(async () => {
      try {
        await fs.ensureDir(path.dirname(this.metricsFile));
        await fs.writeJSON(this.metricsFile, {
          entries: this.entries,
          lastUpdated: Date.now()
        }, { spaces: 0 });
      } catch (error) {
        // Ignore save errors to prevent CLI disruption
      }
    });
  }

  // Optimize based on performance data
  getOptimizationSuggestions(): string[] {
    const stats = this.getStats();
    const suggestions: string[] = [];

    // Check for slow commands
    if (stats.bottlenecks.length > 0) {
      suggestions.push(`Slow commands detected: ${stats.bottlenecks.join(', ')}`);
    }

    // Check memory usage trend
    if (stats.memoryTrend.length > 5) {
      const trend = stats.memoryTrend;
      const recentAvg = trend.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const olderAvg = trend.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      
      if (recentAvg > olderAvg * 1.5) {
        suggestions.push('Memory usage increasing - consider clearing caches');
      }
    }

    // Check success rate
    if (stats.successRate < 95) {
      suggestions.push(`Success rate low (${stats.successRate.toFixed(1)}%) - check error handling`);
    }

    return suggestions;
  }

  // Clear old metrics for cleanup
  async clearMetrics(): Promise<void> {
    this.entries = [];
    try {
      await fs.remove(this.metricsFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Utility function to wrap commands with performance monitoring
export function withPerformanceMonitoring<T extends any[], R>(
  commandName: string,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    performanceMonitor.startCommand(commandName);
    
    try {
      const result = await fn(...args);
      performanceMonitor.endCommand(true);
      return result;
    } catch (error) {
      performanceMonitor.logError(error instanceof Error ? error.message : String(error));
      performanceMonitor.endCommand(false);
      throw error;
    }
  };
}

// Middleware for error-free performance tracking
export function trackPerformance(command: string): {
  start: () => void;
  end: (success?: boolean) => void;
  error: (error: string) => void;
} {
  let hasStarted = false;
  
  return {
    start: () => {
      if (!hasStarted) {
        performanceMonitor.startCommand(command);
        hasStarted = true;
      }
    },
    end: (success = true) => {
      if (hasStarted) {
        performanceMonitor.endCommand(success);
        hasStarted = false;
      }
    },
    error: (error: string) => {
      performanceMonitor.logError(error);
    }
  };
}