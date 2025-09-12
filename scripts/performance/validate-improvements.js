#!/usr/bin/env node

/**
 * Validate Performance Improvements
 * Validates that the 2.8-4.4x speed improvements are maintained
 */

const fs = require('fs').promises;
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

class PerformanceValidator {
  constructor(options = {}) {
    this.options = {
      expectedMinImprovement: 2.8,
      expectedMaxImprovement: 4.4,
      metric: 'throughput',
      failOnBelowThreshold: true,
      baselineMultiplier: 1.0, // Reference baseline multiplier
      ...options
    };

    this.validation = {
      passed: false,
      currentImprovement: 0,
      expectedRange: {
        min: this.options.expectedMinImprovement,
        max: this.options.expectedMaxImprovement
      },
      details: {},
      recommendations: []
    };
  }

  async loadTrendsData(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load trends data from ${filePath}: ${error.message}`);
    }
  }

  extractBaselineMetrics(trendsData) {
    // Look for baseline metrics in the trends data
    // This could be the earliest data point or a specific baseline marker
    
    if (trendsData.baseline) {
      return trendsData.baseline;
    }

    if (trendsData.historical && trendsData.historical.length > 0) {
      // Use the oldest entry as baseline
      const sorted = trendsData.historical.sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      return sorted[0];
    }

    if (trendsData.dataPoints && trendsData.dataPoints.length > 0) {
      // Use first data point as baseline
      return trendsData.dataPoints[0];
    }

    throw new Error('No baseline metrics found in trends data');
  }

  extractCurrentMetrics(trendsData) {
    // Get the most recent metrics
    
    if (trendsData.current) {
      return trendsData.current;
    }

    if (trendsData.latest) {
      return trendsData.latest;
    }

    if (trendsData.historical && trendsData.historical.length > 0) {
      // Use the newest entry as current
      const sorted = trendsData.historical.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      return sorted[0];
    }

    if (trendsData.dataPoints && trendsData.dataPoints.length > 0) {
      // Use last data point as current
      return trendsData.dataPoints[trendsData.dataPoints.length - 1];
    }

    throw new Error('No current metrics found in trends data');
  }

  calculateImprovement(baseline, current, metric) {
    let baselineValue, currentValue;

    // Handle different metric structures and naming conventions
    const metricMappings = {
      'throughput': ['throughput', 'throughputPerSecond', 'requestsPerSecond', 'rps'],
      'latency': ['latency', 'averageLatency', 'averageTime', 'responseTime'],
      'memory': ['memoryUsage', 'heapUsed', 'heapGrowthRate'],
      'errorRate': ['errorRate', 'errors', 'failureRate']
    };

    const possibleKeys = metricMappings[metric] || [metric];

    // Find the metric value in baseline
    for (const key of possibleKeys) {
      if (baseline[key] !== undefined) {
        baselineValue = this.extractMetricValue(baseline[key]);
        break;
      }
      if (baseline.metrics && baseline.metrics[key] !== undefined) {
        baselineValue = this.extractMetricValue(baseline.metrics[key]);
        break;
      }
      if (baseline.performance && baseline.performance[key] !== undefined) {
        baselineValue = this.extractMetricValue(baseline.performance[key]);
        break;
      }
    }

    // Find the metric value in current
    for (const key of possibleKeys) {
      if (current[key] !== undefined) {
        currentValue = this.extractMetricValue(current[key]);
        break;
      }
      if (current.metrics && current.metrics[key] !== undefined) {
        currentValue = this.extractMetricValue(current.metrics[key]);
        break;
      }
      if (current.performance && current.performance[key] !== undefined) {
        currentValue = this.extractMetricValue(current.performance[key]);
        break;
      }
    }

    if (baselineValue === undefined || currentValue === undefined) {
      throw new Error(`Could not find ${metric} values in baseline or current metrics`);
    }

    // Calculate improvement ratio
    let improvement;
    if (metric === 'latency' || metric === 'errorRate' || metric === 'memory') {
      // For metrics where lower is better (latency, errors, memory usage)
      improvement = baselineValue / currentValue;
    } else {
      // For metrics where higher is better (throughput)
      improvement = currentValue / baselineValue;
    }

    return {
      baseline: baselineValue,
      current: currentValue,
      improvement,
      direction: metric === 'latency' || metric === 'errorRate' || metric === 'memory' ? 'lower_is_better' : 'higher_is_better'
    };
  }

  extractMetricValue(value) {
    if (typeof value === 'number') {
      return value;
    }
    
    if (typeof value === 'object' && value !== null) {
      // Handle aggregated metrics with average, min, max, etc.
      return value.average || value.mean || value.value || value.current;
    }
    
    return undefined;
  }

  async validateSpeedImprovements(trendsData) {
    console.log('Validating speed improvements...');

    const baseline = this.extractBaselineMetrics(trendsData);
    const current = this.extractCurrentMetrics(trendsData);

    const improvement = this.calculateImprovement(baseline, current, this.options.metric);
    
    this.validation.currentImprovement = improvement.improvement;
    this.validation.details = {
      metric: this.options.metric,
      baseline: improvement.baseline,
      current: improvement.current,
      improvementRatio: improvement.improvement,
      direction: improvement.direction,
      percentageChange: ((improvement.improvement - 1) * 100)
    };

    // Check if improvement meets expectations
    const meetsMinThreshold = improvement.improvement >= this.options.expectedMinImprovement;
    const withinMaxThreshold = improvement.improvement <= this.options.expectedMaxImprovement;
    
    this.validation.passed = meetsMinThreshold && withinMaxThreshold;

    // Generate validation details
    this.validation.thresholdAnalysis = {
      meetsMinimum: meetsMinThreshold,
      withinMaximum: withinMaxThreshold,
      belowMinimum: improvement.improvement < this.options.expectedMinImprovement,
      exceedsMaximum: improvement.improvement > this.options.expectedMaxImprovement
    };

    // Generate recommendations
    this.generateRecommendations();

    return this.validation;
  }

  generateRecommendations() {
    const improvement = this.validation.currentImprovement;
    const { expectedMinImprovement, expectedMaxImprovement } = this.options;

    if (improvement < expectedMinImprovement) {
      this.validation.recommendations.push({
        type: 'performance_regression',
        severity: 'high',
        title: 'Performance Below Expected Threshold',
        description: `Current ${this.options.metric} improvement (${improvement.toFixed(2)}x) is below the expected minimum (${expectedMinImprovement}x)`,
        actions: [
          'Review recent changes that might have impacted performance',
          'Check if caching mechanisms are functioning properly',
          'Analyze performance profiling data for bottlenecks',
          'Verify that optimization features are enabled',
          'Run detailed performance benchmarks to identify regression points'
        ]
      });
    } else if (improvement > expectedMaxImprovement) {
      this.validation.recommendations.push({
        type: 'unexpected_improvement',
        severity: 'info',
        title: 'Performance Exceeds Expected Range',
        description: `Current ${this.options.metric} improvement (${improvement.toFixed(2)}x) exceeds the expected maximum (${expectedMaxImprovement}x)`,
        actions: [
          'Verify the accuracy of performance measurements',
          'Update baseline expectations if the improvement is consistent',
          'Document the optimizations that led to this improvement',
          'Consider if test conditions have changed significantly'
        ]
      });
    } else {
      this.validation.recommendations.push({
        type: 'performance_healthy',
        severity: 'info',
        title: 'Performance Within Expected Range',
        description: `Current ${this.options.metric} improvement (${improvement.toFixed(2)}x) is within the expected range (${expectedMinImprovement}x - ${expectedMaxImprovement}x)`,
        actions: [
          'Continue monitoring for performance regressions',
          'Maintain current optimization strategies',
          'Consider gradual improvements to push towards the upper range'
        ]
      });
    }

    // Additional contextual recommendations
    if (this.validation.details.percentageChange > 300) { // > 300% improvement
      this.validation.recommendations.push({
        type: 'optimization_success',
        severity: 'info',
        title: 'Significant Performance Gains Achieved',
        description: 'The caching and optimization improvements are delivering substantial benefits',
        actions: [
          'Document the successful optimization patterns',
          'Share optimization strategies across similar projects',
          'Monitor cache hit rates and effectiveness',
          'Plan for similar optimizations in related components'
        ]
      });
    }
  }

  generateValidationReport() {
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      validation: this.validation,
      configuration: {
        expectedRange: this.validation.expectedRange,
        metric: this.options.metric,
        failOnBelowThreshold: this.options.failOnBelowThreshold
      }
    };

    return report;
  }

  async saveValidationReport(outputFile) {
    if (outputFile) {
      const report = this.generateValidationReport();
      await fs.writeFile(outputFile, JSON.stringify(report, null, 2));
      console.log(`Validation report saved to: ${outputFile}`);
      return report;
    }
  }

  printValidationSummary() {
    console.log('\n=== Performance Improvement Validation ===');
    console.log(`Metric: ${this.options.metric}`);
    console.log(`Expected Range: ${this.options.expectedMinImprovement}x - ${this.options.expectedMaxImprovement}x`);
    console.log(`Current Improvement: ${this.validation.currentImprovement.toFixed(2)}x`);
    console.log(`Validation: ${this.validation.passed ? 'PASSED' : 'FAILED'}`);

    if (this.validation.details) {
      console.log('\n=== Details ===');
      console.log(`Baseline ${this.options.metric}: ${this.validation.details.baseline}`);
      console.log(`Current ${this.options.metric}: ${this.validation.details.current}`);
      console.log(`Percentage Change: ${this.validation.details.percentageChange.toFixed(1)}%`);
    }

    if (this.validation.thresholdAnalysis) {
      console.log('\n=== Threshold Analysis ===');
      console.log(`Meets Minimum: ${this.validation.thresholdAnalysis.meetsMinimum}`);
      console.log(`Within Maximum: ${this.validation.thresholdAnalysis.withinMaximum}`);
      
      if (this.validation.thresholdAnalysis.belowMinimum) {
        console.log(`⚠️  Performance is below minimum threshold`);
      }
      
      if (this.validation.thresholdAnalysis.exceedsMaximum) {
        console.log(`📈 Performance exceeds maximum expected threshold`);
      }
    }

    if (this.validation.recommendations.length > 0) {
      console.log('\n=== Recommendations ===');
      this.validation.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.severity.toUpperCase()}] ${rec.title}`);
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
    .option('trends', {
      alias: 't',
      type: 'string',
      required: true,
      describe: 'Path to performance trends data file'
    })
    .option('expected-min-improvement', {
      type: 'number',
      default: 2.8,
      describe: 'Minimum expected improvement ratio'
    })
    .option('expected-max-improvement', {
      type: 'number',
      default: 4.4,
      describe: 'Maximum expected improvement ratio'
    })
    .option('metric', {
      alias: 'm',
      type: 'string',
      default: 'throughput',
      choices: ['throughput', 'latency', 'memory', 'errorRate'],
      describe: 'Performance metric to validate'
    })
    .option('fail-on-below-threshold', {
      type: 'boolean',
      default: true,
      describe: 'Exit with error if below minimum threshold'
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      describe: 'Output file for validation report'
    })
    .help()
    .argv;

  try {
    const validator = new PerformanceValidator({
      expectedMinImprovement: argv.expectedMinImprovement,
      expectedMaxImprovement: argv.expectedMaxImprovement,
      metric: argv.metric,
      failOnBelowThreshold: argv.failOnBelowThreshold
    });

    const trendsData = await validator.loadTrendsData(argv.trends);
    await validator.validateSpeedImprovements(trendsData);
    await validator.saveValidationReport(argv.output);
    validator.printValidationSummary();

    // Exit with error if validation failed and configured to do so
    if (!validator.validation.passed && argv.failOnBelowThreshold) {
      console.error('\nPerformance validation failed - exiting with error');
      process.exit(1);
    }

  } catch (error) {
    console.error('Performance validation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { PerformanceValidator };