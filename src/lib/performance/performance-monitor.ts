/**
 * Performance Monitoring and Alerting System
 * 
 * Provides real-time monitoring, alerting, and dashboard capabilities
 * for critical performance metrics in RDF/Turtle processing
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { memoryOptimizer, MemoryMetrics } from './memory-optimizer.js';
import { performanceOptimizer, PerformanceMetrics } from './performance-optimizer.js';

export interface PerformanceThresholds {
  parseTimeMs: number;
  queryTimeMs: number;
  renderTimeMs: number;
  memoryUsageMB: number;
  cacheHitRate: number;
  memoryGrowthRate: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'critical';
  category: 'parse' | 'query' | 'render' | 'memory' | 'cache' | 'system';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  metadata?: any;
}

export interface PerformanceDashboard {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  totalOperations: number;
  averagePerformance: {
    parseTime: number;
    queryTime: number;
    renderTime: number;
  };
  memoryUsage: {
    current: number;
    peak: number;
    efficiency: number;
  };
  cachePerformance: {
    hitRate: number;
    totalHits: number;
    totalMisses: number;
  };
  recentAlerts: PerformanceAlert[];
  trends: {
    parseTime: 'improving' | 'stable' | 'degrading';
    memoryUsage: 'stable' | 'increasing' | 'decreasing';
    cacheEfficiency: 'improving' | 'stable' | 'degrading';
  };
}

export interface PerformanceReport {
  timestamp: number;
  period: string;
  summary: {
    totalOperations: number;
    averagePerformance: any;
    worstPerformance: any;
    bestPerformance: any;
  };
  bottlenecks: Array<{
    category: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    recommendation: string;
  }>;
  trends: any;
  recommendations: string[];
}

/**
 * Performance Monitor Class
 */
export class PerformanceMonitor extends EventEmitter {
  private thresholds: PerformanceThresholds = {
    parseTimeMs: 100,
    queryTimeMs: 50,
    renderTimeMs: 20,
    memoryUsageMB: 500,
    cacheHitRate: 0.7,
    memoryGrowthRate: 0.1
  };

  private alerts: PerformanceAlert[] = [];
  private metrics: PerformanceMetrics[] = [];
  private startTime = Date.now();
  private isMonitoring = false;
  private monitorInterval?: NodeJS.Timeout;
  private alertsEnabled = true;

  private performanceHistory: Array<{
    timestamp: number;
    parseTime: number;
    queryTime: number;
    renderTime: number;
    memoryUsage: number;
    cacheHitRate: number;
  }> = [];

  constructor() {
    super();
    this.setupEventListeners();
  }

  /**
   * Start monitoring with custom thresholds
   */
  startMonitoring(customThresholds?: Partial<PerformanceThresholds>, intervalMs: number = 10000): void {
    if (this.isMonitoring) return;

    if (customThresholds) {
      this.thresholds = { ...this.thresholds, ...customThresholds };
    }

    this.isMonitoring = true;
    memoryOptimizer.startMonitoring(intervalMs / 2);

    this.monitorInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    this.emit('monitoring:started', { thresholds: this.thresholds });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    memoryOptimizer.stopMonitoring();

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }

    this.emit('monitoring:stopped');
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // Keep only recent metrics (last 1000)
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }

    // Check for threshold violations
    this.checkThresholds(metric);

    // Update performance history
    this.updatePerformanceHistory(metric);

    this.emit('metric:recorded', metric);
  }

  /**
   * Generate performance alert
   */
  generateAlert(
    type: 'warning' | 'error' | 'critical',
    category: string,
    message: string,
    value: number,
    threshold: number,
    metadata?: any
  ): PerformanceAlert {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      category: category as any,
      message,
      value,
      threshold,
      timestamp: Date.now(),
      metadata
    };

    this.alerts.push(alert);

    // Keep only recent alerts (last 100)
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    if (this.alertsEnabled) {
      this.emit('alert:generated', alert);
    }

    return alert;
  }

  /**
   * Get current dashboard data
   */
  getDashboard(): PerformanceDashboard {
    const now = Date.now();
    const recentMetrics = this.metrics.slice(-50); // Last 50 operations
    const recentAlerts = this.alerts.slice(-10); // Last 10 alerts

    // Calculate averages
    const totalOps = this.metrics.length;
    const avgParseTime = totalOps > 0 ? 
      this.metrics.reduce((sum, m) => sum + m.parseTime, 0) / totalOps : 0;
    const avgQueryTime = totalOps > 0 ? 
      this.metrics.reduce((sum, m) => sum + m.queryTime, 0) / totalOps : 0;
    const avgRenderTime = totalOps > 0 ? 
      this.metrics.reduce((sum, m) => sum + m.renderTime, 0) / totalOps : 0;

    // Memory info
    const memoryReport = memoryOptimizer.generateOptimizationReport();
    const currentMemoryMB = memoryReport.currentMemory.heapUsed / 1024 / 1024;
    const peakMemoryMB = memoryReport.monitoringReport.peak.heapUsed / 1024 / 1024;

    // Cache performance
    const totalCacheHits = this.metrics.reduce((sum, m) => sum + m.cacheHits, 0);
    const totalCacheMisses = this.metrics.reduce((sum, m) => sum + m.cacheMisses, 0);
    const cacheHitRate = (totalCacheHits + totalCacheMisses) > 0 ? 
      totalCacheHits / (totalCacheHits + totalCacheMisses) : 0;

    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const criticalAlerts = recentAlerts.filter(a => a.type === 'critical');
    const warningAlerts = recentAlerts.filter(a => a.type === 'warning' || a.type === 'error');

    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (warningAlerts.length > 2) {
      status = 'warning';
    }

    // Calculate trends
    const trends = this.calculateTrends();

    return {
      status,
      uptime: now - this.startTime,
      totalOperations: totalOps,
      averagePerformance: {
        parseTime: Math.round(avgParseTime * 100) / 100,
        queryTime: Math.round(avgQueryTime * 100) / 100,
        renderTime: Math.round(avgRenderTime * 100) / 100
      },
      memoryUsage: {
        current: Math.round(currentMemoryMB * 100) / 100,
        peak: Math.round(peakMemoryMB * 100) / 100,
        efficiency: memoryReport.monitoringReport.efficiency
      },
      cachePerformance: {
        hitRate: Math.round(cacheHitRate * 100) / 100,
        totalHits: totalCacheHits,
        totalMisses: totalCacheMisses
      },
      recentAlerts,
      trends
    };
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(periodHours: number = 24): PerformanceReport {
    const now = Date.now();
    const periodStart = now - (periodHours * 60 * 60 * 1000);
    
    const periodMetrics = this.metrics.filter(m => m.timestamp >= periodStart);
    const totalOps = periodMetrics.length;

    if (totalOps === 0) {
      return {
        timestamp: now,
        period: `${periodHours}h`,
        summary: {
          totalOperations: 0,
          averagePerformance: {},
          worstPerformance: {},
          bestPerformance: {}
        },
        bottlenecks: [],
        trends: {},
        recommendations: ['No operations recorded in the specified period']
      };
    }

    // Calculate summary statistics
    const parseTimes = periodMetrics.map(m => m.parseTime).filter(t => t > 0);
    const queryTimes = periodMetrics.map(m => m.queryTime).filter(t => t > 0);
    const renderTimes = periodMetrics.map(m => m.renderTime).filter(t => t > 0);

    const avgPerformance = {
      parseTime: parseTimes.length > 0 ? parseTimes.reduce((a, b) => a + b) / parseTimes.length : 0,
      queryTime: queryTimes.length > 0 ? queryTimes.reduce((a, b) => a + b) / queryTimes.length : 0,
      renderTime: renderTimes.length > 0 ? renderTimes.reduce((a, b) => a + b) / renderTimes.length : 0
    };

    const worstPerformance = {
      parseTime: parseTimes.length > 0 ? Math.max(...parseTimes) : 0,
      queryTime: queryTimes.length > 0 ? Math.max(...queryTimes) : 0,
      renderTime: renderTimes.length > 0 ? Math.max(...renderTimes) : 0
    };

    const bestPerformance = {
      parseTime: parseTimes.length > 0 ? Math.min(...parseTimes) : 0,
      queryTime: queryTimes.length > 0 ? Math.min(...queryTimes) : 0,
      renderTime: renderTimes.length > 0 ? Math.min(...renderTimes) : 0
    };

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(periodMetrics);
    
    // Calculate trends
    const trends = this.calculateTrends();

    // Generate recommendations
    const recommendations = this.generateRecommendations(avgPerformance, bottlenecks, trends);

    return {
      timestamp: now,
      period: `${periodHours}h`,
      summary: {
        totalOperations: totalOps,
        averagePerformance: avgPerformance,
        worstPerformance: worstPerformance,
        bestPerformance: bestPerformance
      },
      bottlenecks,
      trends,
      recommendations
    };
  }

  /**
   * Get recent alerts
   */
  getAlerts(count: number = 20): PerformanceAlert[] {
    return this.alerts.slice(-count);
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
    this.emit('alerts:cleared');
  }

  /**
   * Enable or disable alerts
   */
  setAlertsEnabled(enabled: boolean): void {
    this.alertsEnabled = enabled;
    this.emit('alerts:toggled', { enabled });
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.emit('thresholds:updated', this.thresholds);
  }

  /**
   * Get performance metrics within time range
   */
  getMetrics(startTime?: number, endTime?: number): PerformanceMetrics[] {
    let filtered = this.metrics;
    
    if (startTime) {
      filtered = filtered.filter(m => m.timestamp >= startTime);
    }
    
    if (endTime) {
      filtered = filtered.filter(m => m.timestamp <= endTime);
    }
    
    return filtered;
  }

  // Private methods

  private setupEventListeners(): void {
    this.on('alert:generated', (alert: PerformanceAlert) => {
      console.warn(`🚨 Performance Alert [${alert.type.toUpperCase()}]: ${alert.message}`);
      
      if (alert.type === 'critical') {
        // Trigger automatic optimization for critical alerts
        this.handleCriticalAlert(alert);
      }
    });
  }

  private collectMetrics(): void {
    const optimizerReport = performanceOptimizer.generatePerformanceReport();
    const memoryReport = memoryOptimizer.generateOptimizationReport();
    
    // Record current state snapshot
    const snapshot = {
      timestamp: Date.now(),
      parseTime: optimizerReport.summary.avgParseTime || 0,
      queryTime: optimizerReport.summary.avgQueryTime || 0,
      renderTime: 0, // Would need template optimizer integration
      memoryUsage: memoryReport.currentMemory.heapUsed / 1024 / 1024,
      cacheHitRate: optimizerReport.summary.cacheHitRate / 100 || 0
    };

    this.performanceHistory.push(snapshot);
    
    // Keep only recent history (last 100 snapshots)
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }

    // Check for potential issues
    this.checkSystemHealth(snapshot);
  }

  private checkThresholds(metric: PerformanceMetrics): void {
    if (metric.parseTime > this.thresholds.parseTimeMs) {
      this.generateAlert(
        'warning',
        'parse',
        `Parse time exceeded threshold: ${metric.parseTime.toFixed(2)}ms > ${this.thresholds.parseTimeMs}ms`,
        metric.parseTime,
        this.thresholds.parseTimeMs,
        { operationType: metric.operationType, tripleCount: metric.tripleCount }
      );
    }

    if (metric.queryTime > this.thresholds.queryTimeMs) {
      this.generateAlert(
        'warning',
        'query',
        `Query time exceeded threshold: ${metric.queryTime.toFixed(2)}ms > ${this.thresholds.queryTimeMs}ms`,
        metric.queryTime,
        this.thresholds.queryTimeMs,
        { operationType: metric.operationType }
      );
    }

    if (metric.renderTime > this.thresholds.renderTimeMs) {
      this.generateAlert(
        'warning',
        'render',
        `Render time exceeded threshold: ${metric.renderTime.toFixed(2)}ms > ${this.thresholds.renderTimeMs}ms`,
        metric.renderTime,
        this.thresholds.renderTimeMs,
        { operationType: metric.operationType }
      );
    }

    const memoryUsageMB = (metric.memoryUsage.after - metric.memoryUsage.before) / 1024 / 1024;
    if (memoryUsageMB > this.thresholds.memoryUsageMB) {
      this.generateAlert(
        'error',
        'memory',
        `Memory usage spike: ${memoryUsageMB.toFixed(2)}MB > ${this.thresholds.memoryUsageMB}MB`,
        memoryUsageMB,
        this.thresholds.memoryUsageMB,
        { operationType: metric.operationType }
      );
    }

    const cacheHitRate = metric.cacheHits / (metric.cacheHits + metric.cacheMisses);
    if (!isNaN(cacheHitRate) && cacheHitRate < this.thresholds.cacheHitRate) {
      this.generateAlert(
        'warning',
        'cache',
        `Low cache hit rate: ${(cacheHitRate * 100).toFixed(1)}% < ${(this.thresholds.cacheHitRate * 100).toFixed(1)}%`,
        cacheHitRate,
        this.thresholds.cacheHitRate,
        { hits: metric.cacheHits, misses: metric.cacheMisses }
      );
    }
  }

  private checkSystemHealth(snapshot: any): void {
    // Check for memory leaks
    if (this.performanceHistory.length >= 10) {
      const recent = this.performanceHistory.slice(-10);
      const growthRate = (recent[recent.length - 1].memoryUsage - recent[0].memoryUsage) / recent[0].memoryUsage;
      
      if (growthRate > this.thresholds.memoryGrowthRate) {
        this.generateAlert(
          'critical',
          'memory',
          `Potential memory leak detected: ${(growthRate * 100).toFixed(1)}% growth over last 10 snapshots`,
          growthRate,
          this.thresholds.memoryGrowthRate
        );
      }
    }

    // Check for performance degradation
    if (this.performanceHistory.length >= 20) {
      const recent = this.performanceHistory.slice(-10);
      const older = this.performanceHistory.slice(-20, -10);
      
      const recentAvgParseTime = recent.reduce((sum, s) => sum + s.parseTime, 0) / recent.length;
      const olderAvgParseTime = older.reduce((sum, s) => sum + s.parseTime, 0) / older.length;
      
      if (recentAvgParseTime > olderAvgParseTime * 1.5) {
        this.generateAlert(
          'warning',
          'parse',
          `Parse performance degraded: ${recentAvgParseTime.toFixed(2)}ms vs ${olderAvgParseTime.toFixed(2)}ms`,
          recentAvgParseTime,
          olderAvgParseTime
        );
      }
    }
  }

  private updatePerformanceHistory(metric: PerformanceMetrics): void {
    // Update aggregated performance history
    // This is handled in collectMetrics for now
  }

  private calculateTrends(): any {
    if (this.performanceHistory.length < 10) {
      return {
        parseTime: 'stable',
        memoryUsage: 'stable',
        cacheEfficiency: 'stable'
      };
    }

    const recent = this.performanceHistory.slice(-5);
    const older = this.performanceHistory.slice(-10, -5);

    const recentAvgParse = recent.reduce((sum, s) => sum + s.parseTime, 0) / recent.length;
    const olderAvgParse = older.reduce((sum, s) => sum + s.parseTime, 0) / older.length;

    const recentAvgMemory = recent.reduce((sum, s) => sum + s.memoryUsage, 0) / recent.length;
    const olderAvgMemory = older.reduce((sum, s) => sum + s.memoryUsage, 0) / older.length;

    const recentAvgCache = recent.reduce((sum, s) => sum + s.cacheHitRate, 0) / recent.length;
    const olderAvgCache = older.reduce((sum, s) => sum + s.cacheHitRate, 0) / older.length;

    return {
      parseTime: this.getTrend(recentAvgParse, olderAvgParse, false),
      memoryUsage: this.getTrend(recentAvgMemory, olderAvgMemory, false),
      cacheEfficiency: this.getTrend(recentAvgCache, olderAvgCache, true)
    };
  }

  private getTrend(recent: number, older: number, higherIsBetter: boolean): 'improving' | 'stable' | 'degrading' {
    const threshold = 0.1; // 10% change threshold
    const ratio = recent / older;

    if (ratio > 1 + threshold) {
      return higherIsBetter ? 'improving' : 'degrading';
    } else if (ratio < 1 - threshold) {
      return higherIsBetter ? 'degrading' : 'improving';
    }
    return 'stable';
  }

  private identifyBottlenecks(metrics: PerformanceMetrics[]): Array<{
    category: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    recommendation: string;
  }> {
    const bottlenecks: Array<{
      category: string;
      description: string;
      impact: 'low' | 'medium' | 'high';
      recommendation: string;
    }> = [];

    const avgParseTime = metrics.reduce((sum, m) => sum + m.parseTime, 0) / metrics.length;
    const avgQueryTime = metrics.reduce((sum, m) => sum + m.queryTime, 0) / metrics.length;
    const avgRenderTime = metrics.reduce((sum, m) => sum + m.renderTime, 0) / metrics.length;

    if (avgParseTime > this.thresholds.parseTimeMs * 0.8) {
      bottlenecks.push({
        category: 'parsing',
        description: `Average parse time is ${avgParseTime.toFixed(2)}ms`,
        impact: avgParseTime > this.thresholds.parseTimeMs ? 'high' : 'medium',
        recommendation: 'Consider enabling streaming for large files or improving data format'
      });
    }

    if (avgQueryTime > this.thresholds.queryTimeMs * 0.8) {
      bottlenecks.push({
        category: 'querying',
        description: `Average query time is ${avgQueryTime.toFixed(2)}ms`,
        impact: avgQueryTime > this.thresholds.queryTimeMs ? 'high' : 'medium',
        recommendation: 'Enable query caching and consider adding indexes'
      });
    }

    return bottlenecks;
  }

  private generateRecommendations(avgPerformance: any, bottlenecks: any[], trends: any): string[] {
    const recommendations: string[] = [];

    if (trends.parseTime === 'degrading') {
      recommendations.push('Parse performance is degrading - review recent changes and consider optimizations');
    }

    if (trends.memoryUsage === 'increasing') {
      recommendations.push('Memory usage is increasing - enable periodic cleanup and check for leaks');
    }

    if (trends.cacheEfficiency === 'degrading') {
      recommendations.push('Cache efficiency is declining - review cache size and eviction policies');
    }

    bottlenecks.forEach(bottleneck => {
      if (bottleneck.impact === 'high') {
        recommendations.push(`HIGH PRIORITY: ${bottleneck.recommendation}`);
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('Performance is healthy - continue monitoring');
    }

    return recommendations;
  }

  private async handleCriticalAlert(alert: PerformanceAlert): Promise<void> {
    try {
      if (alert.category === 'memory') {
        console.log('🔧 Auto-triggering memory optimization for critical memory alert...');
        await memoryOptimizer.optimizeMemory('comprehensive');
      }
    } catch (error) {
      console.error('Failed to handle critical alert:', error);
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

export default {
  PerformanceMonitor,
  performanceMonitor
};