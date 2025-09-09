#!/usr/bin/env node

/**
 * Aggregate Performance Metrics
 * Combines metrics from multiple sources and generates comprehensive reports
 */

const fs = require('fs').promises;
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

class MetricsAggregator {
  constructor(options = {}) {
    this.options = {
      resultsDir: 'performance-results',
      outputFile: 'aggregated-metrics.json',
      includeMemory: true,
      includeLoad: true,
      includeRaw: false,
      ...options
    };

    this.aggregated = {
      metadata: {
        timestamp: new Date().toISOString(),
        sources: [],
        aggregationMethod: 'weighted-average'
      },
      performance: {},
      memory: {},
      quality: {},
      load: {},
      raw: {}
    };
  }

  async scanResultsDirectory() {
    const resultsPath = path.resolve(this.options.resultsDir);
    
    try {
      const entries = await fs.readdir(resultsPath, { withFileTypes: true });
      const resultFiles = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Scan subdirectories for result files
          const subDir = path.join(resultsPath, entry.name);
          const subEntries = await fs.readdir(subDir);
          
          for (const subFile of subEntries) {
            if (subFile.endsWith('.json')) {
              resultFiles.push({
                type: this.detectFileType(entry.name, subFile),
                path: path.join(subDir, subFile),
                source: entry.name,
                filename: subFile
              });
            }
          }
        } else if (entry.name.endsWith('.json')) {
          resultFiles.push({
            type: this.detectFileType('', entry.name),
            path: path.join(resultsPath, entry.name),
            source: 'root',
            filename: entry.name
          });
        }
      }

      return resultFiles;
    } catch (error) {
      console.warn(`Warning: Could not scan results directory ${resultsPath}: ${error.message}`);
      return [];
    }
  }

  detectFileType(directory, filename) {
    // Detect file type based on directory and filename patterns
    if (directory.includes('template-performance') || filename.includes('template-perf')) {
      return 'template-benchmark';
    }
    if (directory.includes('memory-profiling') || filename.includes('memory-analysis')) {
      return 'memory-profile';
    }
    if (directory.includes('load-testing') || filename.includes('load-test')) {
      return 'load-test';
    }
    if (directory.includes('regression-analysis') || filename.includes('regression')) {
      return 'regression-analysis';
    }
    
    // Try to detect from filename
    if (filename.includes('benchmark')) return 'template-benchmark';
    if (filename.includes('memory')) return 'memory-profile';
    if (filename.includes('load')) return 'load-test';
    if (filename.includes('metrics')) return 'general-metrics';
    
    return 'unknown';
  }

  async loadMetricsFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Warning: Could not load metrics file ${filePath}: ${error.message}`);
      return null;
    }
  }

  extractTemplateBenchmarkMetrics(data) {
    if (!data?.metrics?.performance) return null;

    const perf = data.metrics.performance;
    const memory = data.metrics.memory || {};

    return {
      performance: {
        averageLatency: perf.averageTime,
        medianLatency: perf.medianTime,
        p95Latency: perf.p95Time,
        p99Latency: perf.p99Time,
        minLatency: perf.minTime,
        maxLatency: perf.maxTime,
        throughput: perf.throughputPerSecond,
        successRate: perf.successRate,
        concurrency: perf.concurrencyLevel
      },
      memory: {
        heapGrowthRate: memory.heapGrowthRate,
        peakHeapUsed: memory.peakHeapUsed,
        averageHeapUsed: memory.averageHeapUsed,
        memoryEfficiency: memory.memoryEfficiency,
        suspectedLeaks: memory.suspectedLeaks
      },
      quality: {
        errorRate: data.metrics.quality?.errorRate || 0,
        consistency: data.metrics.quality?.consistency?.coefficientOfVariation || 0
      },
      metadata: {
        templateType: data.metadata?.templateType,
        iterations: data.metadata?.iterations,
        concurrency: data.metadata?.concurrency
      }
    };
  }

  extractMemoryProfileMetrics(data) {
    if (!data?.analysis) return null;

    const analysis = data.analysis;
    const memory = analysis.memory || analysis.heap || {};
    const indicators = analysis.indicators || {};

    return {
      memory: {
        heapGrowth: memory.growth,
        heapGrowthRate: memory.growthRate,
        peakUsage: memory.peak,
        averageUsage: memory.average,
        volatility: memory.volatility,
        memoryLeaks: indicators.suspectedLeak ? 1 : 0,
        gcPressure: indicators.gcPressure ? 1 : 0
      },
      quality: {
        memoryHealth: data.summary?.memoryHealth,
        recommendationCount: data.summary?.recommendations?.length || 0
      },
      metadata: {
        duration: data.metadata?.options?.duration,
        samples: data.metadata?.options?.samples
      }
    };
  }

  extractLoadTestMetrics(data) {
    if (!data?.metrics) return null;

    const metrics = data.metrics;
    const requests = metrics.requests || {};
    const latency = metrics.latency || {};
    const throughput = metrics.throughput || {};

    return {
      load: {
        totalRequests: requests.total,
        successfulRequests: requests.successful,
        failedRequests: requests.failed,
        successRate: requests.successRate,
        averageLatency: latency.average,
        medianLatency: latency.median,
        p90Latency: latency.p90,
        p95Latency: latency.p95,
        p99Latency: latency.p99,
        minLatency: latency.min,
        maxLatency: latency.max,
        requestsPerSecond: throughput.requestsPerSecond,
        avgResponseTime: throughput.avgResponseTime
      },
      quality: {
        errorTypes: metrics.errors?.length || 0,
        errorRate: (requests.failed / requests.total) * 100 || 0
      },
      metadata: {
        scenario: data.metadata?.scenario,
        workers: data.metadata?.workers,
        duration: data.metadata?.duration,
        targetRPS: data.metadata?.targetRPS
      }
    };
  }

  async aggregateMetrics() {
    console.log('Scanning for performance result files...');
    const resultFiles = await this.scanResultsDirectory();
    
    if (resultFiles.length === 0) {
      throw new Error(`No result files found in ${this.options.resultsDir}`);
    }

    console.log(`Found ${resultFiles.length} result files`);
    this.aggregated.metadata.sources = resultFiles.map(f => ({
      type: f.type,
      source: f.source,
      filename: f.filename
    }));

    const extractedMetrics = {
      performance: [],
      memory: [],
      load: [],
      quality: []
    };

    // Process each result file
    for (const file of resultFiles) {
      console.log(`Processing ${file.type}: ${file.filename}`);
      const data = await this.loadMetricsFile(file.path);
      
      if (!data) continue;

      let extracted = null;
      
      switch (file.type) {
        case 'template-benchmark':
          extracted = this.extractTemplateBenchmarkMetrics(data);
          break;
        case 'memory-profile':
          extracted = this.extractMemoryProfileMetrics(data);
          break;
        case 'load-test':
          extracted = this.extractLoadTestMetrics(data);
          break;
        default:
          console.warn(`Unknown file type: ${file.type}`);
          continue;
      }

      if (extracted) {
        if (extracted.performance) extractedMetrics.performance.push(extracted.performance);
        if (extracted.memory) extractedMetrics.memory.push(extracted.memory);
        if (extracted.load) extractedMetrics.load.push(extracted.load);
        if (extracted.quality) extractedMetrics.quality.push(extracted.quality);

        // Store raw data if requested
        if (this.options.includeRaw) {
          this.aggregated.raw[`${file.source}_${file.filename}`] = data;
        }
      }
    }

    // Aggregate the extracted metrics
    this.aggregated.performance = this.aggregatePerformanceMetrics(extractedMetrics.performance);
    
    if (this.options.includeMemory) {
      this.aggregated.memory = this.aggregateMemoryMetrics(extractedMetrics.memory);
    }
    
    if (this.options.includeLoad) {
      this.aggregated.load = this.aggregateLoadMetrics(extractedMetrics.load);
    }
    
    this.aggregated.quality = this.aggregateQualityMetrics(extractedMetrics.quality);

    // Calculate composite scores
    this.aggregated.composite = this.calculateCompositeScores();

    return this.aggregated;
  }

  aggregatePerformanceMetrics(performanceData) {
    if (performanceData.length === 0) return {};

    const aggregated = {};
    const metrics = ['averageLatency', 'medianLatency', 'p95Latency', 'p99Latency', 'throughput', 'successRate'];
    
    metrics.forEach(metric => {
      const values = performanceData
        .map(d => d[metric])
        .filter(v => v !== undefined && v !== null && !isNaN(v));
      
      if (values.length > 0) {
        aggregated[metric] = {
          average: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          median: this.calculateMedian(values),
          samples: values.length,
          values: values
        };
      }
    });

    return aggregated;
  }

  aggregateMemoryMetrics(memoryData) {
    if (memoryData.length === 0) return {};

    const aggregated = {};
    const metrics = ['heapGrowthRate', 'peakHeapUsed', 'averageHeapUsed', 'volatility'];
    
    metrics.forEach(metric => {
      const values = memoryData
        .map(d => d[metric])
        .filter(v => v !== undefined && v !== null && !isNaN(v));
      
      if (values.length > 0) {
        aggregated[metric] = {
          average: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          median: this.calculateMedian(values),
          samples: values.length
        };
      }
    });

    // Aggregate boolean indicators
    const booleanMetrics = ['memoryLeaks', 'gcPressure'];
    booleanMetrics.forEach(metric => {
      const values = memoryData
        .map(d => d[metric])
        .filter(v => v !== undefined && v !== null);
      
      if (values.length > 0) {
        aggregated[metric] = {
          positive: values.filter(v => v > 0).length,
          total: values.length,
          percentage: (values.filter(v => v > 0).length / values.length) * 100
        };
      }
    });

    return aggregated;
  }

  aggregateLoadMetrics(loadData) {
    if (loadData.length === 0) return {};

    const aggregated = {};
    const metrics = ['totalRequests', 'successRate', 'averageLatency', 'p95Latency', 'requestsPerSecond'];
    
    metrics.forEach(metric => {
      const values = loadData
        .map(d => d[metric])
        .filter(v => v !== undefined && v !== null && !isNaN(v));
      
      if (values.length > 0) {
        if (metric === 'totalRequests') {
          // Sum total requests
          aggregated[metric] = {
            total: values.reduce((a, b) => a + b, 0),
            average: values.reduce((a, b) => a + b, 0) / values.length,
            samples: values.length
          };
        } else {
          // Average other metrics
          aggregated[metric] = {
            average: values.reduce((a, b) => a + b, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            median: this.calculateMedian(values),
            samples: values.length
          };
        }
      }
    });

    return aggregated;
  }

  aggregateQualityMetrics(qualityData) {
    if (qualityData.length === 0) return {};

    const aggregated = {};
    const metrics = ['errorRate', 'consistency'];
    
    metrics.forEach(metric => {
      const values = qualityData
        .map(d => d[metric])
        .filter(v => v !== undefined && v !== null && !isNaN(v));
      
      if (values.length > 0) {
        aggregated[metric] = {
          average: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          samples: values.length
        };
      }
    });

    return aggregated;
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  calculateCompositeScores() {
    const scores = {};

    // Performance score (0-100, higher is better)
    const perfMetrics = this.aggregated.performance;
    if (perfMetrics.throughput && perfMetrics.averageLatency) {
      const throughputScore = Math.min(100, (perfMetrics.throughput.average / 1000) * 100);
      const latencyScore = Math.max(0, 100 - (perfMetrics.averageLatency.average / 10));
      const successScore = perfMetrics.successRate?.average || 100;
      
      scores.performance = (throughputScore * 0.4 + latencyScore * 0.4 + successScore * 0.2);
    }

    // Memory score (0-100, higher is better)
    const memMetrics = this.aggregated.memory;
    if (memMetrics.heapGrowthRate) {
      const growthScore = Math.max(0, 100 - Math.abs(memMetrics.heapGrowthRate.average / 1024 / 1024)); // MB/s
      const leakScore = memMetrics.memoryLeaks ? (100 - memMetrics.memoryLeaks.percentage) : 100;
      
      scores.memory = (growthScore * 0.6 + leakScore * 0.4);
    }

    // Quality score (0-100, higher is better)
    const qualityMetrics = this.aggregated.quality;
    if (qualityMetrics.errorRate) {
      scores.quality = Math.max(0, 100 - qualityMetrics.errorRate.average);
    }

    // Overall composite score
    const validScores = Object.values(scores).filter(s => !isNaN(s));
    if (validScores.length > 0) {
      scores.overall = validScores.reduce((a, b) => a + b, 0) / validScores.length;
    }

    return scores;
  }

  async saveAggregatedMetrics() {
    const outputPath = path.resolve(this.options.outputFile);
    await fs.writeFile(outputPath, JSON.stringify(this.aggregated, null, 2));
    console.log(`Aggregated metrics saved to: ${outputPath}`);
    return outputPath;
  }

  printSummary() {
    console.log('\n=== Aggregated Metrics Summary ===');
    
    if (this.aggregated.performance.throughput) {
      console.log(`Average Throughput: ${this.aggregated.performance.throughput.average.toFixed(2)} ops/sec`);
    }
    
    if (this.aggregated.performance.averageLatency) {
      console.log(`Average Latency: ${this.aggregated.performance.averageLatency.average.toFixed(2)}ms`);
    }
    
    if (this.aggregated.memory.heapGrowthRate) {
      console.log(`Heap Growth Rate: ${(this.aggregated.memory.heapGrowthRate.average / 1024).toFixed(2)} KB/s`);
    }
    
    if (this.aggregated.quality.errorRate) {
      console.log(`Error Rate: ${this.aggregated.quality.errorRate.average.toFixed(2)}%`);
    }

    if (this.aggregated.composite.overall) {
      console.log(`Overall Score: ${this.aggregated.composite.overall.toFixed(1)}/100`);
    }

    console.log(`\nData Sources: ${this.aggregated.metadata.sources.length}`);
    this.aggregated.metadata.sources.forEach(source => {
      console.log(`  - ${source.type}: ${source.filename}`);
    });
  }
}

// CLI Interface
async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('results-dir', {
      alias: 'r',
      type: 'string',
      default: 'performance-results',
      describe: 'Directory containing performance result files'
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      default: 'aggregated-metrics.json',
      describe: 'Output file for aggregated metrics'
    })
    .option('include-memory', {
      type: 'boolean',
      default: true,
      describe: 'Include memory profiling data'
    })
    .option('include-load', {
      type: 'boolean',
      default: true,
      describe: 'Include load testing data'
    })
    .option('include-raw', {
      type: 'boolean',
      default: false,
      describe: 'Include raw data in output'
    })
    .help()
    .argv;

  try {
    const aggregator = new MetricsAggregator({
      resultsDir: argv.resultsDir,
      outputFile: argv.output,
      includeMemory: argv.includeMemory,
      includeLoad: argv.includeLoad,
      includeRaw: argv.includeRaw
    });

    await aggregator.aggregateMetrics();
    await aggregator.saveAggregatedMetrics();
    aggregator.printSummary();

  } catch (error) {
    console.error('Metrics aggregation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { MetricsAggregator };