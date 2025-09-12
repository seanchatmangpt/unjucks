#!/usr/bin/env node

/**
 * Store Performance Metrics in Time Series
 * Creates time-series data for historical performance tracking
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

class MetricsStore {
  constructor(options = {}) {
    this.options = {
      outputFile: null,
      maxEntries: 1000,
      ...options
    };

    this.timeSeriesEntry = {
      id: this.generateEntryId(),
      timestamp: this.getDeterministicDate().toISOString(),
      metadata: {},
      performance: {},
      memory: {},
      quality: {},
      load: {},
      environment: this.captureEnvironment()
    };
  }

  generateEntryId() {
    const timestamp = this.getDeterministicTimestamp().toString();
    const random = crypto.randomBytes(4).toString('hex');
    return `${timestamp}-${random}`;
  }

  captureEnvironment() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
      hostname: require('os').hostname(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  async loadMetrics(metricsFile) {
    try {
      const content = await fs.readFile(metricsFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load metrics from ${metricsFile}: ${error.message}`);
    }
  }

  normalizeMetricsData(metrics) {
    const normalized = {
      performance: {},
      memory: {},
      quality: {},
      load: {}
    };

    // Handle aggregated metrics format
    if (metrics.performance) {
      normalized.performance = this.extractPerformanceMetrics(metrics.performance);
    }

    if (metrics.memory) {
      normalized.memory = this.extractMemoryMetrics(metrics.memory);
    }

    if (metrics.quality) {
      normalized.quality = this.extractQualityMetrics(metrics.quality);
    }

    if (metrics.load) {
      normalized.load = this.extractLoadMetrics(metrics.load);
    }

    // Handle direct metrics format (from individual benchmarks)
    if (metrics.metrics) {
      const metricsObj = metrics.metrics;
      
      if (metricsObj.performance) {
        normalized.performance = {
          ...normalized.performance,
          ...this.extractDirectPerformanceMetrics(metricsObj.performance)
        };
      }

      if (metricsObj.memory) {
        normalized.memory = {
          ...normalized.memory,
          ...this.extractDirectMemoryMetrics(metricsObj.memory)
        };
      }

      if (metricsObj.latency && metricsObj.throughput) {
        // Load test metrics
        normalized.load = {
          ...normalized.load,
          averageLatency: metricsObj.latency.average,
          p95Latency: metricsObj.latency.p95,
          throughput: metricsObj.throughput.requestsPerSecond,
          successRate: metricsObj.requests?.successRate || 100
        };
      }
    }

    // Handle analysis format (from memory profiler)
    if (metrics.analysis) {
      if (metrics.analysis.memory || metrics.analysis.heap) {
        normalized.memory = {
          ...normalized.memory,
          ...this.extractAnalysisMemoryMetrics(metrics.analysis)
        };
      }
    }

    return normalized;
  }

  extractPerformanceMetrics(perfData) {
    const extracted = {};

    // Handle aggregated format
    if (perfData.averageLatency) {
      extracted.averageLatency = this.extractValue(perfData.averageLatency);
      extracted.medianLatency = this.extractValue(perfData.medianLatency);
      extracted.p95Latency = this.extractValue(perfData.p95Latency);
      extracted.p99Latency = this.extractValue(perfData.p99Latency);
      extracted.throughput = this.extractValue(perfData.throughput);
      extracted.successRate = this.extractValue(perfData.successRate);
    }

    return extracted;
  }

  extractDirectPerformanceMetrics(perfData) {
    return {
      averageLatency: perfData.averageTime,
      medianLatency: perfData.medianTime,
      p95Latency: perfData.p95Time,
      p99Latency: perfData.p99Time,
      minLatency: perfData.minTime,
      maxLatency: perfData.maxTime,
      throughput: perfData.throughputPerSecond,
      successRate: perfData.successRate,
      totalIterations: perfData.totalIterations
    };
  }

  extractMemoryMetrics(memData) {
    const extracted = {};

    if (memData.heapGrowthRate) {
      extracted.heapGrowthRate = this.extractValue(memData.heapGrowthRate);
      extracted.peakHeapUsed = this.extractValue(memData.peakHeapUsed);
      extracted.averageHeapUsed = this.extractValue(memData.averageHeapUsed);
    }

    if (memData.memoryLeaks) {
      extracted.memoryLeaksDetected = memData.memoryLeaks.positive || 0;
      extracted.memoryLeakPercentage = memData.memoryLeaks.percentage || 0;
    }

    return extracted;
  }

  extractDirectMemoryMetrics(memData) {
    return {
      heapGrowthRate: memData.heapGrowthRate,
      peakHeapUsed: memData.peakHeapUsed,
      averageHeapUsed: memData.averageHeapUsed,
      memoryEfficiency: memData.memoryEfficiency,
      suspectedLeaks: memData.suspectedLeaks || 0
    };
  }

  extractAnalysisMemoryMetrics(analysis) {
    const extracted = {};
    
    if (analysis.memory || analysis.heap) {
      const memData = analysis.memory || analysis.heap;
      extracted.heapGrowth = memData.growth;
      extracted.heapGrowthRate = memData.growthRate;
      extracted.peakUsage = memData.peak;
      extracted.averageUsage = memData.average;
      extracted.volatility = memData.volatility;
    }

    if (analysis.indicators) {
      extracted.suspectedLeaks = analysis.indicators.suspectedLeak ? 1 : 0;
      extracted.gcPressure = analysis.indicators.gcPressure ? 1 : 0;
      extracted.highVolatility = analysis.indicators.highVolatility ? 1 : 0;
    }

    return extracted;
  }

  extractQualityMetrics(qualityData) {
    const extracted = {};

    if (qualityData.errorRate) {
      extracted.errorRate = this.extractValue(qualityData.errorRate);
    }

    if (qualityData.consistency) {
      extracted.consistency = this.extractValue(qualityData.consistency);
    }

    return extracted;
  }

  extractLoadMetrics(loadData) {
    const extracted = {};

    if (loadData.totalRequests) {
      extracted.totalRequests = this.extractValue(loadData.totalRequests);
      extracted.successRate = this.extractValue(loadData.successRate);
      extracted.averageLatency = this.extractValue(loadData.averageLatency);
      extracted.p95Latency = this.extractValue(loadData.p95Latency);
      extracted.requestsPerSecond = this.extractValue(loadData.requestsPerSecond);
    }

    return extracted;
  }

  extractValue(valueObj) {
    if (typeof valueObj === 'number') {
      return valueObj;
    }
    
    if (typeof valueObj === 'object' && valueObj !== null) {
      return valueObj.average || valueObj.mean || valueObj.value || valueObj.total;
    }
    
    return null;
  }

  addMetadata(metadata) {
    this.timeSeriesEntry.metadata = {
      ...this.timeSeriesEntry.metadata,
      ...metadata
    };
  }

  async createTimeSeriesEntry(metricsFile, metadata = {}) {
    console.log(`Processing metrics from: ${metricsFile}`);
    
    const metrics = await this.loadMetrics(metricsFile);
    const normalized = this.normalizeMetricsData(metrics);

    // Set the normalized data
    this.timeSeriesEntry.performance = normalized.performance;
    this.timeSeriesEntry.memory = normalized.memory;
    this.timeSeriesEntry.quality = normalized.quality;
    this.timeSeriesEntry.load = normalized.load;

    // Add metadata
    this.addMetadata(metadata);

    // Add composite scores
    this.timeSeriesEntry.composite = this.calculateCompositeScores();

    // Add data quality indicators
    this.timeSeriesEntry.dataQuality = this.assessDataQuality();

    return this.timeSeriesEntry;
  }

  calculateCompositeScores() {
    const scores = {};

    // Performance composite score
    const perf = this.timeSeriesEntry.performance;
    if (perf.throughput && perf.averageLatency) {
      const throughputScore = Math.min(100, (perf.throughput / 100) * 10); // Scale throughput
      const latencyScore = Math.max(0, 100 - (perf.averageLatency / 10)); // Lower latency is better
      const successScore = perf.successRate || 100;
      
      scores.performance = (throughputScore * 0.4 + latencyScore * 0.4 + successScore * 0.2);
    }

    // Memory composite score
    const mem = this.timeSeriesEntry.memory;
    if (mem.heapGrowthRate !== undefined) {
      const growthScore = Math.max(0, 100 - Math.abs(mem.heapGrowthRate / (1024 * 1024))); // MB/s
      const leakScore = mem.suspectedLeaks ? Math.max(0, 100 - (mem.suspectedLeaks * 20)) : 100;
      
      scores.memory = (growthScore * 0.7 + leakScore * 0.3);
    }

    // Quality composite score
    const quality = this.timeSeriesEntry.quality;
    if (quality.errorRate !== undefined) {
      scores.quality = Math.max(0, 100 - quality.errorRate);
    }

    // Overall composite score
    const validScores = Object.values(scores).filter(s => !isNaN(s) && s !== null);
    if (validScores.length > 0) {
      scores.overall = validScores.reduce((a, b) => a + b, 0) / validScores.length;
    }

    return scores;
  }

  assessDataQuality() {
    const quality = {
      completeness: 0,
      validity: 0,
      consistency: 0,
      issues: []
    };

    // Check completeness
    const expectedFields = [
      'performance.throughput',
      'performance.averageLatency',
      'memory.heapGrowthRate',
      'quality.errorRate'
    ];

    let foundFields = 0;
    expectedFields.forEach(field => {
      const value = this.getNestedValue(this.timeSeriesEntry, field);
      if (value !== undefined && value !== null && !isNaN(value)) {
        foundFields++;
      }
    });

    quality.completeness = (foundFields / expectedFields.length) * 100;

    // Check validity (reasonable ranges)
    if (this.timeSeriesEntry.performance.successRate !== undefined) {
      if (this.timeSeriesEntry.performance.successRate < 0 || this.timeSeriesEntry.performance.successRate > 100) {
        quality.issues.push('Invalid success rate value');
      }
    }

    if (this.timeSeriesEntry.performance.averageLatency !== undefined) {
      if (this.timeSeriesEntry.performance.averageLatency < 0 || this.timeSeriesEntry.performance.averageLatency > 10000) {
        quality.issues.push('Unusual latency value detected');
      }
    }

    quality.validity = quality.issues.length === 0 ? 100 : Math.max(0, 100 - (quality.issues.length * 25));

    // Overall quality score
    quality.score = (quality.completeness + quality.validity) / 2;

    return quality;
  }

  getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  async saveTimeSeriesEntry() {
    if (this.options.outputFile) {
      await fs.writeFile(this.options.outputFile, JSON.stringify(this.timeSeriesEntry, null, 2));
      console.log(`Time series entry saved to: ${this.options.outputFile}`);
      return this.options.outputFile;
    }
    
    return this.timeSeriesEntry;
  }

  printEntrySummary() {
    console.log('\n=== Time Series Entry Summary ===');
    console.log(`Entry ID: ${this.timeSeriesEntry.id}`);
    console.log(`Timestamp: ${this.timeSeriesEntry.timestamp}`);
    
    if (this.timeSeriesEntry.performance.throughput) {
      console.log(`Throughput: ${this.timeSeriesEntry.performance.throughput.toFixed(2)} ops/sec`);
    }
    
    if (this.timeSeriesEntry.performance.averageLatency) {
      console.log(`Average Latency: ${this.timeSeriesEntry.performance.averageLatency.toFixed(2)}ms`);
    }
    
    if (this.timeSeriesEntry.memory.heapGrowthRate !== undefined) {
      console.log(`Heap Growth Rate: ${(this.timeSeriesEntry.memory.heapGrowthRate / 1024).toFixed(2)} KB/s`);
    }
    
    if (this.timeSeriesEntry.composite.overall) {
      console.log(`Overall Score: ${this.timeSeriesEntry.composite.overall.toFixed(1)}/100`);
    }
    
    console.log(`Data Quality: ${this.timeSeriesEntry.dataQuality.score.toFixed(1)}%`);
    
    if (this.timeSeriesEntry.dataQuality.issues.length > 0) {
      console.log('Data Quality Issues:');
      this.timeSeriesEntry.dataQuality.issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    }
  }
}

// CLI Interface
async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('metrics', {
      alias: 'm',
      type: 'string',
      required: true,
      describe: 'Path to metrics file to process'
    })
    .option('timestamp', {
      alias: 't',
      type: 'string',
      describe: 'Override timestamp for the entry'
    })
    .option('commit-sha', {
      type: 'string',
      describe: 'Git commit SHA for this metrics entry'
    })
    .option('branch', {
      alias: 'b',
      type: 'string',
      describe: 'Git branch name'
    })
    .option('output-file', {
      alias: 'o',
      type: 'string',
      describe: 'Output file for time series entry'
    })
    .option('build-number', {
      type: 'string',
      describe: 'CI build number'
    })
    .option('environment', {
      alias: 'e',
      type: 'string',
      default: 'ci',
      describe: 'Environment where metrics were collected'
    })
    .help()
    .argv;

  try {
    const store = new MetricsStore({
      outputFile: argv.outputFile
    });

    const metadata = {
      commitSha: argv.commitSha,
      branch: argv.branch,
      buildNumber: argv.buildNumber,
      environment: argv.environment,
      collectionMethod: 'automated'
    };

    // Override timestamp if provided
    if (argv.timestamp) {
      store.timeSeriesEntry.timestamp = argv.timestamp;
    }

    await store.createTimeSeriesEntry(argv.metrics, metadata);
    await store.saveTimeSeriesEntry();
    store.printEntrySummary();

  } catch (error) {
    console.error('Failed to store metrics:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { MetricsStore };