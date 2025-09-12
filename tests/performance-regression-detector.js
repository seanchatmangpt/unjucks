/**
 * Performance Regression Detection System
 * Agent DELTA-12: Monitors performance metrics and detects regressions
 */

import { performance } from 'perf_hooks';
import { promises as fs } from 'fs';
import consola from 'consola';
import path from 'path';

export class PerformanceRegressionDetector {
  constructor(config = {}) {
    this.config = {
      baselinePath: config.baselinePath || './tests/performance-baseline.json',
      regressionThreshold: config.regressionThreshold || 0.15, // 15% degradation
      minSamples: config.minSamples || 5,
      enableAlerts: config.enableAlerts !== false,
      enableAutoBaseline: config.enableAutoBaseline || false,
      ...config
    };

    this.logger = consola.withTag('regression-detector');
    this.currentMetrics = new Map();
    this.baseline = null;
    this.alerts = [];
  }

  /**
   * Initialize detector and load baseline
   */
  async initialize() {
    try {
      await this.loadBaseline();
      this.logger.success('Performance regression detector initialized');
    } catch (error) {
      this.logger.warn('No baseline found, will create new one');
      this.baseline = { metrics: {}, created: this.getDeterministicDate().toISOString() };
    }
  }

  /**
   * Load performance baseline from file
   */
  async loadBaseline() {
    try {
      const data = await fs.readFile(this.config.baselinePath, 'utf8');
      this.baseline = JSON.parse(data);
      this.logger.info(`Loaded baseline with ${Object.keys(this.baseline.metrics).length} metrics`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Baseline file not found');
      }
      throw error;
    }
  }

  /**
   * Save performance baseline to file
   */
  async saveBaseline() {
    try {
      await fs.mkdir(path.dirname(this.config.baselinePath), { recursive: true });
      await fs.writeFile(
        this.config.baselinePath, 
        JSON.stringify(this.baseline, null, 2)
      );
      this.logger.success('Performance baseline saved');
    } catch (error) {
      this.logger.error('Failed to save baseline:', error);
      throw error;
    }
  }

  /**
   * Record performance metric
   */
  recordMetric(name, value, metadata = {}) {
    if (!this.currentMetrics.has(name)) {
      this.currentMetrics.set(name, []);
    }

    this.currentMetrics.get(name).push({
      value,
      timestamp: this.getDeterministicTimestamp(),
      metadata
    });

    // Keep only recent samples
    const samples = this.currentMetrics.get(name);
    if (samples.length > this.config.minSamples * 2) {
      samples.splice(0, samples.length - this.config.minSamples * 2);
    }
  }

  /**
   * Run regression analysis
   */
  async analyzeRegressions() {
    if (!this.baseline) {
      this.logger.warn('No baseline available for regression analysis');
      return { regressions: [], summary: { total: 0, regressions: 0 } };
    }

    const regressions = [];
    let totalMetrics = 0;
    let regressionCount = 0;

    for (const [metricName, samples] of this.currentMetrics.entries()) {
      if (samples.length < this.config.minSamples) {
        continue; // Not enough samples
      }

      totalMetrics++;
      const regression = this._analyzeMetricRegression(metricName, samples);
      
      if (regression.isRegression) {
        regressions.push(regression);
        regressionCount++;
        
        if (this.config.enableAlerts) {
          await this._triggerAlert(regression);
        }
      }
    }

    const analysis = {
      regressions,
      summary: {
        total: totalMetrics,
        regressions: regressionCount,
        regressionRate: totalMetrics > 0 ? regressionCount / totalMetrics : 0,
        timestamp: this.getDeterministicDate().toISOString()
      }
    };

    this.logger.info(`Regression analysis: ${regressionCount}/${totalMetrics} metrics regressed`);
    return analysis;
  }

  /**
   * Analyze single metric for regression
   */
  _analyzeMetricRegression(metricName, samples) {
    // Calculate current statistics
    const values = samples.map(s => s.value);
    const currentMean = values.reduce((a, b) => a + b, 0) / values.length;
    const currentP95 = this._calculatePercentile(values, 0.95);
    
    // Get baseline statistics
    const baselineMetric = this.baseline.metrics[metricName];
    
    if (!baselineMetric) {
      return {
        metric: metricName,
        isRegression: false,
        reason: 'no_baseline',
        currentMean,
        baselineMean: null
      };
    }

    const baselineMean = baselineMetric.mean;
    const meanDelta = (currentMean - baselineMean) / baselineMean;
    const isRegression = meanDelta > this.config.regressionThreshold;

    const result = {
      metric: metricName,
      isRegression,
      currentMean,
      currentP95,
      baselineMean,
      baselineP95: baselineMetric.p95,
      meanDelta,
      deltaPercentage: meanDelta * 100,
      severity: this._classifyRegressionSeverity(meanDelta),
      samples: samples.length,
      analysis: this._generateRegressionAnalysis(metricName, meanDelta, samples)
    };

    return result;
  }

  /**
   * Classify regression severity
   */
  _classifyRegressionSeverity(delta) {
    if (delta > 1.0) return 'critical';      // >100% degradation
    if (delta > 0.5) return 'high';          // 50-100% degradation
    if (delta > 0.25) return 'medium';       // 25-50% degradation
    if (delta > 0.15) return 'low';          // 15-25% degradation
    return 'none';
  }

  /**
   * Generate regression analysis and recommendations
   */
  _generateRegressionAnalysis(metricName, delta, samples) {
    const analysis = {
      trend: delta > 0 ? 'degrading' : 'improving',
      possibleCauses: [],
      recommendations: []
    };

    // Analyze based on metric type
    if (metricName.includes('startup')) {
      analysis.possibleCauses = [
        'New heavy dependencies added',
        'Synchronous initialization added',
        'Module loading overhead increased'
      ];
      analysis.recommendations = [
        'Review recent dependency changes',
        'Implement lazy loading for heavy modules',
        'Profile module loading times'
      ];
    } else if (metricName.includes('memory')) {
      analysis.possibleCauses = [
        'Memory leaks introduced',
        'Larger data structures in use',
        'Inefficient garbage collection'
      ];
      analysis.recommendations = [
        'Run memory leak detection',
        'Review object lifecycle management',
        'Enable garbage collection profiling'
      ];
    } else if (metricName.includes('rdf')) {
      analysis.possibleCauses = [
        'Inefficient query patterns',
        'Larger dataset processing',
        'Missing query optimization'
      ];
      analysis.recommendations = [
        'Review SPARQL query efficiency',
        'Implement query result caching',
        'Add RDF indexing for common patterns'
      ];
    }

    // Check for variance in samples
    const values = samples.map(s => s.value);
    const variance = this._calculateVariance(values);
    const coefficient = variance / (values.reduce((a, b) => a + b, 0) / values.length);
    
    if (coefficient > 0.3) {
      analysis.possibleCauses.push('High performance variance detected');
      analysis.recommendations.push('Investigate external factors causing variance');
    }

    return analysis;
  }

  /**
   * Trigger regression alert
   */
  async _triggerAlert(regression) {
    const alert = {
      id: `regression-${this.getDeterministicTimestamp()}`,
      type: 'performance_regression',
      severity: regression.severity,
      metric: regression.metric,
      degradation: `${regression.deltaPercentage.toFixed(1)}%`,
      timestamp: this.getDeterministicDate().toISOString(),
      details: regression
    };

    this.alerts.push(alert);
    
    // Log alert
    const logLevel = regression.severity === 'critical' ? 'error' : 
                     regression.severity === 'high' ? 'warn' : 'info';
    
    this.logger[logLevel](
      `Performance regression detected: ${regression.metric} degraded by ${regression.deltaPercentage.toFixed(1)}%`
    );

    // Could send to external monitoring system
    await this._sendExternalAlert(alert);
  }

  async _sendExternalAlert(alert) {
    // Placeholder for external alerting (Slack, email, etc.)
    if (process.env.PERFORMANCE_WEBHOOK) {
      try {
        // Would implement webhook call here
        this.logger.debug('External alert sent');
      } catch (error) {
        this.logger.error('Failed to send external alert:', error);
      }
    }
  }

  /**
   * Update performance baseline
   */
  async updateBaseline() {
    if (!this.baseline) {
      this.baseline = { metrics: {}, created: this.getDeterministicDate().toISOString() };
    }

    let updatedCount = 0;

    for (const [metricName, samples] of this.currentMetrics.entries()) {
      if (samples.length < this.config.minSamples) {
        continue;
      }

      const values = samples.map(s => s.value);
      const statistics = {
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        median: this._calculatePercentile(values, 0.5),
        p95: this._calculatePercentile(values, 0.95),
        p99: this._calculatePercentile(values, 0.99),
        min: Math.min(...values),
        max: Math.max(...values),
        samples: values.length,
        lastUpdated: this.getDeterministicDate().toISOString()
      };

      this.baseline.metrics[metricName] = statistics;
      updatedCount++;
    }

    this.baseline.lastUpdated = this.getDeterministicDate().toISOString();
    await this.saveBaseline();
    
    this.logger.success(`Updated baseline with ${updatedCount} metrics`);
    return updatedCount;
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      baseline: {
        created: this.baseline?.created,
        lastUpdated: this.baseline?.lastUpdated,
        metricsCount: this.baseline ? Object.keys(this.baseline.metrics).length : 0
      },
      currentSession: {
        metricsRecorded: this.currentMetrics.size,
        totalSamples: Array.from(this.currentMetrics.values()).reduce((acc, samples) => acc + samples.length, 0),
        alertsTriggered: this.alerts.length
      },
      recentAlerts: this.alerts.slice(-10) // Last 10 alerts
    };

    return report;
  }

  /**
   * Clear current session data
   */
  clearSession() {
    this.currentMetrics.clear();
    this.alerts = [];
    this.logger.info('Performance session data cleared');
  }

  // Utility methods

  _calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * percentile);
    return sorted[index] || 0;
  }

  _calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Get current alerts
   */
  getAlerts(severity = null) {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return [...this.alerts];
  }

  /**
   * Check if metric has regression
   */
  hasRegression(metricName) {
    return this.alerts.some(alert => alert.metric === metricName);
  }
}

// Export singleton instance
export const regressionDetector = new PerformanceRegressionDetector();

export default PerformanceRegressionDetector;