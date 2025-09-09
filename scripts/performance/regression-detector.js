#!/usr/bin/env node

/**
 * Regression Detection & Baseline Comparison
 * Analyzes performance metrics against baseline to detect regressions
 */

const fs = require('fs').promises;
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

class RegressionDetector {
  constructor(options = {}) {
    this.options = {
      threshold: 15, // Percentage regression threshold
      failOnRegression: false,
      metricWeights: {
        averageTime: 1.0,
        p95Time: 0.8,
        throughputPerSecond: 1.2,
        successRate: 1.5,
        memoryUsage: 0.7,
        errorRate: 1.3
      },
      ...options
    };

    this.regression = {
      detected: false,
      severity: 'none',
      details: [],
      score: 0,
      recommendations: []
    };
  }

  async loadMetrics(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load metrics from ${filePath}: ${error.message}`);
    }
  }

  normalizeMetrics(metrics) {
    // Handle different metric structures from various sources
    const normalized = {
      performance: {},
      memory: {},
      quality: {}
    };

    // Template benchmarks
    if (metrics.metrics?.performance) {
      normalized.performance = {
        averageTime: metrics.metrics.performance.averageTime,
        p95Time: metrics.metrics.performance.p95Time,
        p99Time: metrics.metrics.performance.p99Time,
        throughputPerSecond: metrics.metrics.performance.throughputPerSecond,
        successRate: metrics.metrics.performance.successRate
      };
    }

    // Load testing results
    if (metrics.metrics?.latency && metrics.metrics?.throughput) {
      normalized.performance = {
        averageTime: metrics.metrics.latency.average,
        p95Time: metrics.metrics.latency.p95,
        p99Time: metrics.metrics.latency.p99,
        throughputPerSecond: metrics.metrics.throughput.requestsPerSecond,
        successRate: metrics.metrics.requests?.successRate || 100
      };
    }

    // Memory profiling
    if (metrics.analysis?.memory || metrics.metrics?.memory) {
      const memData = metrics.analysis?.memory || metrics.metrics.memory;
      normalized.memory = {
        heapGrowthRate: memData.heapGrowthRate,
        peakHeapUsed: memData.peakHeapUsed,
        averageHeapUsed: memData.averageHeapUsed,
        memoryEfficiency: memData.memoryEfficiency
      };
    }

    // Quality metrics
    if (metrics.metrics?.quality || metrics.analysis?.indicators) {
      const qualityData = metrics.metrics?.quality || {};
      const indicators = metrics.analysis?.indicators || {};
      
      normalized.quality = {
        errorRate: qualityData.errorRate || 0,
        memoryLeaks: indicators.suspectedLeak ? 1 : 0,
        consistency: qualityData.consistency?.coefficientOfVariation || 0
      };
    }

    // Aggregated metrics (from multiple sources)
    if (metrics.aggregated) {
      return this.mergeNormalizedMetrics(normalized, metrics.aggregated);
    }

    return normalized;
  }

  mergeNormalizedMetrics(base, aggregated) {
    const merged = { ...base };

    // Merge performance metrics
    if (aggregated.performance) {
      merged.performance = {
        ...merged.performance,
        ...aggregated.performance
      };
    }

    // Merge memory metrics
    if (aggregated.memory) {
      merged.memory = {
        ...merged.memory,
        ...aggregated.memory
      };
    }

    // Merge quality metrics
    if (aggregated.quality) {
      merged.quality = {
        ...merged.quality,
        ...aggregated.quality
      };
    }

    return merged;
  }

  calculateRegressionScore(baselineValue, currentValue, metricName, direction = 'lower_is_better') {
    if (baselineValue === 0 || baselineValue === undefined || currentValue === undefined) {
      return { score: 0, change: 0, isRegression: false };
    }

    const change = ((currentValue - baselineValue) / baselineValue) * 100;
    let isRegression = false;

    // Determine if this is a regression based on metric direction
    if (direction === 'lower_is_better') {
      // For metrics like latency, error rate, memory usage - lower is better
      isRegression = change > this.options.threshold;
    } else if (direction === 'higher_is_better') {
      // For metrics like throughput, success rate - higher is better
      isRegression = change < -this.options.threshold;
    }

    // Calculate weighted score
    const weight = this.options.metricWeights[metricName] || 1.0;
    const score = isRegression ? Math.abs(change) * weight : 0;

    return {
      score,
      change,
      isRegression,
      severity: this.calculateSeverity(Math.abs(change)),
      weight
    };
  }

  calculateSeverity(changePercentage) {
    if (changePercentage >= 50) return 'critical';
    if (changePercentage >= 30) return 'high';
    if (changePercentage >= 15) return 'medium';
    if (changePercentage >= 5) return 'low';
    return 'none';
  }

  analyzeMetricGroup(baseline, current, groupName) {
    const results = [];
    let totalScore = 0;

    const metricDirections = {
      averageTime: 'lower_is_better',
      p95Time: 'lower_is_better',
      p99Time: 'lower_is_better',
      throughputPerSecond: 'higher_is_better',
      successRate: 'higher_is_better',
      heapGrowthRate: 'lower_is_better',
      peakHeapUsed: 'lower_is_better',
      averageHeapUsed: 'lower_is_better',
      memoryEfficiency: 'higher_is_better',
      errorRate: 'lower_is_better',
      memoryLeaks: 'lower_is_better',
      consistency: 'lower_is_better'
    };

    for (const [metricName, currentValue] of Object.entries(current)) {
      const baselineValue = baseline[metricName];
      if (baselineValue === undefined) continue;

      const direction = metricDirections[metricName] || 'lower_is_better';
      const analysis = this.calculateRegressionScore(baselineValue, currentValue, metricName, direction);

      if (analysis.isRegression) {
        results.push({
          group: groupName,
          metric: metricName,
          baseline: baselineValue,
          current: currentValue,
          change: analysis.change,
          severity: analysis.severity,
          weight: analysis.weight,
          score: analysis.score
        });

        totalScore += analysis.score;
      }
    }

    return { results, totalScore };
  }

  async compareMetrics(currentMetrics, baselineMetrics) {
    console.log('Comparing metrics against baseline...');

    const normalizedCurrent = this.normalizeMetrics(currentMetrics);
    const normalizedBaseline = this.normalizeMetrics(baselineMetrics);

    let totalRegressionScore = 0;
    const allRegressions = [];

    // Analyze performance metrics
    const perfAnalysis = this.analyzeMetricGroup(
      normalizedBaseline.performance,
      normalizedCurrent.performance,
      'performance'
    );
    allRegressions.push(...perfAnalysis.results);
    totalRegressionScore += perfAnalysis.totalScore;

    // Analyze memory metrics
    const memoryAnalysis = this.analyzeMetricGroup(
      normalizedBaseline.memory,
      normalizedCurrent.memory,
      'memory'
    );
    allRegressions.push(...memoryAnalysis.results);
    totalRegressionScore += memoryAnalysis.totalScore;

    // Analyze quality metrics
    const qualityAnalysis = this.analyzeMetricGroup(
      normalizedBaseline.quality,
      normalizedCurrent.quality,
      'quality'
    );
    allRegressions.push(...qualityAnalysis.results);
    totalRegressionScore += qualityAnalysis.totalScore;

    // Sort regressions by severity and score
    allRegressions.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.score - a.score;
    });

    this.regression = {
      detected: allRegressions.length > 0,
      severity: this.calculateOverallSeverity(allRegressions),
      details: allRegressions,
      score: totalRegressionScore,
      recommendations: this.generateRecommendations(allRegressions),
      summary: this.generateSummary(allRegressions, normalizedCurrent, normalizedBaseline)
    };

    return this.regression;
  }

  calculateOverallSeverity(regressions) {
    if (regressions.length === 0) return 'none';

    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
    const maxSeverity = Math.max(...regressions.map(r => severityOrder[r.severity]));

    const severityNames = { 4: 'critical', 3: 'high', 2: 'medium', 1: 'low', 0: 'none' };
    return severityNames[maxSeverity];
  }

  generateRecommendations(regressions) {
    const recommendations = [];
    const groupedRegressions = this.groupRegressionsByType(regressions);

    // Performance recommendations
    if (groupedRegressions.performance.length > 0) {
      const perfRegressions = groupedRegressions.performance;
      
      if (perfRegressions.some(r => r.metric.includes('Time'))) {
        recommendations.push({
          type: 'performance',
          priority: 'high',
          title: 'Latency Regression Detected',
          description: 'Template rendering times have increased significantly',
          actions: [
            'Review recent changes to template compilation logic',
            'Check for inefficient filter implementations',
            'Profile template parsing and rendering pipeline',
            'Consider implementing or improving template caching'
          ]
        });
      }

      if (perfRegressions.some(r => r.metric === 'throughputPerSecond')) {
        recommendations.push({
          type: 'performance',
          priority: 'high',
          title: 'Throughput Regression Detected',
          description: 'Template rendering throughput has decreased',
          actions: [
            'Analyze concurrency and parallelization opportunities',
            'Review resource allocation and worker pool sizing',
            'Check for blocking operations in the rendering pipeline',
            'Optimize critical path execution'
          ]
        });
      }
    }

    // Memory recommendations
    if (groupedRegressions.memory.length > 0) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        title: 'Memory Usage Regression',
        description: 'Memory consumption patterns have degraded',
        actions: [
          'Investigate potential memory leaks in template caching',
          'Review object lifecycle management',
          'Check for excessive object allocation during rendering',
          'Consider implementing memory pooling for frequently used objects'
        ]
      });
    }

    // Quality recommendations
    if (groupedRegressions.quality.length > 0) {
      const qualityRegressions = groupedRegressions.quality;
      
      if (qualityRegressions.some(r => r.metric === 'errorRate')) {
        recommendations.push({
          type: 'quality',
          priority: 'critical',
          title: 'Error Rate Increase',
          description: 'Template rendering errors have increased',
          actions: [
            'Review recent changes for error handling regressions',
            'Analyze error logs for common failure patterns',
            'Improve input validation and error recovery',
            'Add more comprehensive test coverage'
          ]
        });
      }
    }

    return recommendations;
  }

  groupRegressionsByType(regressions) {
    const grouped = {
      performance: [],
      memory: [],
      quality: []
    };

    regressions.forEach(regression => {
      grouped[regression.group].push(regression);
    });

    return grouped;
  }

  generateSummary(regressions, current, baseline) {
    const summary = {
      totalRegressions: regressions.length,
      severityBreakdown: {},
      worstRegressions: regressions.slice(0, 5),
      improvementAreas: []
    };

    // Count by severity
    regressions.forEach(regression => {
      summary.severityBreakdown[regression.severity] = 
        (summary.severityBreakdown[regression.severity] || 0) + 1;
    });

    // Identify areas that improved
    const allMetrics = ['averageTime', 'p95Time', 'throughputPerSecond', 'successRate'];
    allMetrics.forEach(metric => {
      const currentValue = current.performance?.[metric];
      const baselineValue = baseline.performance?.[metric];
      
      if (currentValue !== undefined && baselineValue !== undefined) {
        const change = ((currentValue - baselineValue) / baselineValue) * 100;
        
        // Check for improvements (opposite of regression logic)
        const isImprovement = 
          (metric.includes('Time') && change < -5) || // Latency decreased
          (['throughputPerSecond', 'successRate'].includes(metric) && change > 5); // Throughput/success increased
        
        if (isImprovement) {
          summary.improvementAreas.push({
            metric,
            improvement: Math.abs(change),
            current: currentValue,
            baseline: baselineValue
          });
        }
      }
    });

    return summary;
  }

  async generateReport(outputFile) {
    const report = {
      timestamp: new Date().toISOString(),
      regression: this.regression,
      configuration: {
        threshold: this.options.threshold,
        metricWeights: this.options.metricWeights
      }
    };

    if (outputFile) {
      await fs.writeFile(outputFile, JSON.stringify(report, null, 2));
      console.log(`Regression report saved to: ${outputFile}`);
    }

    return report;
  }

  printSummary() {
    console.log('\n=== Regression Detection Summary ===');
    console.log(`Regressions Detected: ${this.regression.detected ? 'YES' : 'NO'}`);
    console.log(`Overall Severity: ${this.regression.severity.toUpperCase()}`);
    console.log(`Total Regression Score: ${this.regression.score.toFixed(2)}`);

    if (this.regression.details.length > 0) {
      console.log('\n=== Detected Regressions ===');
      this.regression.details.forEach((regression, index) => {
        console.log(`${index + 1}. ${regression.metric} (${regression.group})`);
        console.log(`   Severity: ${regression.severity.toUpperCase()}`);
        console.log(`   Change: ${regression.change.toFixed(2)}%`);
        console.log(`   Baseline: ${regression.baseline}`);
        console.log(`   Current: ${regression.current}`);
        console.log('');
      });
    }

    if (this.regression.summary?.improvementAreas?.length > 0) {
      console.log('=== Performance Improvements ===');
      this.regression.summary.improvementAreas.forEach(improvement => {
        console.log(`${improvement.metric}: ${improvement.improvement.toFixed(2)}% improvement`);
      });
    }

    if (this.regression.recommendations.length > 0) {
      console.log('\n=== Recommendations ===');
      this.regression.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
        console.log(`   ${rec.description}`);
        rec.actions.forEach(action => {
          console.log(`   • ${action}`);
        });
        console.log('');
      });
    }
  }
}

// CLI Interface
async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('current', {
      alias: 'c',
      type: 'string',
      required: true,
      describe: 'Path to current metrics file'
    })
    .option('baseline', {
      alias: 'b',
      type: 'string',
      required: true,
      describe: 'Path to baseline metrics file'
    })
    .option('threshold', {
      alias: 't',
      type: 'number',
      default: 15,
      describe: 'Regression threshold percentage'
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      describe: 'Output file for regression report'
    })
    .option('fail-on-regression', {
      type: 'boolean',
      default: false,
      describe: 'Exit with error code if regressions detected'
    })
    .help()
    .argv;

  try {
    const detector = new RegressionDetector({
      threshold: argv.threshold,
      failOnRegression: argv.failOnRegression
    });

    const currentMetrics = await detector.loadMetrics(argv.current);
    const baselineMetrics = await detector.loadMetrics(argv.baseline);

    await detector.compareMetrics(currentMetrics, baselineMetrics);
    await detector.generateReport(argv.output);
    detector.printSummary();

    if (argv.failOnRegression && detector.regression.detected) {
      console.error('\nRegressions detected - failing build');
      process.exit(1);
    }

  } catch (error) {
    console.error('Regression detection failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { RegressionDetector };