/**
 * High-Volume RDF Processing Examples
 * Demonstrates processing millions of triples with performance optimization
 */

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { getSemanticConfig } from '../../config/semantic-production';
import { semanticMonitor, trackRDFOperation } from '../../src/lib/semantic-monitoring';
import { TurtleParser } from '../../src/lib/turtle-parser';
import { RdfFilters } from '../../src/lib/rdf-filters';
import { RdfDataLoader } from '../../src/lib/rdf-data-loader';

interface BatchProcessingConfig {
  totalTriples: number;
  batchSize: number;
  concurrency: number;
  compressionEnabled: boolean;
  indexingEnabled: boolean;
  cacheEnabled: boolean;
}

interface ProcessingStats {
  totalTriples: number;
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  totalTime: number;
  avgBatchTime: number;
  throughput: number; // triples per second
  memoryPeak: number;
  memoryAverage: number;
}

interface BatchResult {
  batchId: number;
  triplesProcessed: number;
  processingTime: number;
  memoryUsage: number;
  success: boolean;
  error?: string;
}

class HighVolumeRDFProcessor {
  private config = getSemanticConfig();
  private parser = new TurtleParser();
  private filters = new RdfFilters();
  private loader = new RdfDataLoader();

  /**
   * Process millions of triples using parallel workers
   */
  async processHighVolume(config: BatchProcessingConfig): Promise<ProcessingStats> {
    console.log(`🚀 Starting high-volume processing: ${config.totalTriples.toLocaleString()} triples`);
    console.log(`📊 Configuration: ${config.batchSize} triples/batch, ${config.concurrency} workers`);

    semanticMonitor.startMonitoring(1000); // 1-second monitoring for high-volume

    const startTime = performance.now();
    const memorySnapshots: number[] = [];

    try {
      // Generate batches
      const batches = this.generateBatches(config);
      console.log(`📦 Generated ${batches.length} batches`);

      // Process batches with worker threads
      const results = await this.processBatchesInParallel(batches, config.concurrency);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Calculate statistics
      const stats = this.calculateStats(results, totalTime, config);
      this.displayStats(stats, config);

      // Record final metrics
      semanticMonitor.recordRDFMetrics('high-volume-processing', {
        triplesProcessed: stats.totalTriples,
        parseLatency: stats.avgBatchTime,
        throughput: stats.throughput,
        memoryUsage: stats.memoryPeak,
      });

      return stats;

    } finally {
      semanticMonitor.stopMonitoring();
    }
  }

  /**
   * Process large datasets with streaming and pagination
   */
  async processStreamingData(totalMegabytes: number): Promise<void> {
    console.log(`🌊 Starting streaming processing: ${totalMegabytes}MB of data`);

    const chunkSize = 10; // 10MB chunks
    const chunks = Math.ceil(totalMegabytes / chunkSize);

    semanticMonitor.startMonitoring(2000);

    try {
      for (let chunk = 0; chunk < chunks; chunk++) {
        console.log(`📥 Processing chunk ${chunk + 1}/${chunks}`);

        const chunkData = this.generateLargeDataChunk(chunkSize, chunk);
        
        await trackRDFOperation(`streaming-chunk-${chunk}`, async () => {
          const parseResult = await this.parser.parse(chunkData, `streaming-chunk-${chunk}`);
          
          // Apply memory-efficient filtering
          const filteredTriples = this.filters.filterByPredicate(
            parseResult.triples,
            'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
          );

          // Stream to persistent storage
          await this.loader.loadFromString(chunkData, 'turtle');

          console.log(`   ✓ Processed ${parseResult.triples.length} triples`);

          // Force garbage collection to manage memory
          if (global.gc) {
            global.gc();
          }
        });

        // Add delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ Streaming processing complete: ${chunks} chunks processed`);

    } finally {
      semanticMonitor.stopMonitoring();
    }
  }

  /**
   * Performance benchmark with various data sizes
   */
  async runPerformanceBenchmarks(): Promise<void> {
    console.log('🏁 Running Performance Benchmarks');
    console.log('=================================');

    const benchmarkConfigs = [
      { name: '100K Triples', totalTriples: 100_000, batchSize: 10_000, concurrency: 2 },
      { name: '1M Triples', totalTriples: 1_000_000, batchSize: 50_000, concurrency: 4 },
      { name: '10M Triples', totalTriples: 10_000_000, batchSize: 100_000, concurrency: 8 },
      { name: '50M Triples', totalTriples: 50_000_000, batchSize: 500_000, concurrency: cpus().length },
    ];

    const benchmarkResults: Array<{ config: any; stats: ProcessingStats }> = [];

    for (const benchConfig of benchmarkConfigs) {
      console.log(`\n🧪 Running benchmark: ${benchConfig.name}`);
      
      const fullConfig: BatchProcessingConfig = {
        ...benchConfig,
        compressionEnabled: true,
        indexingEnabled: true,
        cacheEnabled: true,
      };

      try {
        const stats = await this.processHighVolume(fullConfig);
        benchmarkResults.push({ config: benchConfig, stats });
        
        // Wait between benchmarks to let system recover
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`❌ Benchmark failed: ${error.message}`);
      }
    }

    // Display benchmark comparison
    console.log('\n📊 Benchmark Results Comparison');
    console.log('==============================');
    console.log('Config          | Throughput    | Avg Batch Time | Memory Peak');
    console.log('----------------|---------------|----------------|-------------');

    benchmarkResults.forEach(({ config, stats }) => {
      const throughputStr = `${Math.round(stats.throughput).toLocaleString()} t/s`;
      const batchTimeStr = `${Math.round(stats.avgBatchTime)}ms`;
      const memoryStr = `${Math.round(stats.memoryPeak / 1024 / 1024)}MB`;
      
      console.log(
        `${config.name.padEnd(15)} | ${throughputStr.padEnd(13)} | ${batchTimeStr.padEnd(14)} | ${memoryStr}`
      );
    });

    // Calculate performance scaling
    if (benchmarkResults.length >= 2) {
      const first = benchmarkResults[0];
      const last = benchmarkResults[benchmarkResults.length - 1];
      const scalingFactor = last.stats.throughput / first.stats.throughput;
      const dataSizeRatio = last.config.totalTriples / first.config.totalTriples;
      
      console.log(`\n📈 Performance Scaling:`);
      console.log(`   Data size increased: ${dataSizeRatio}x`);
      console.log(`   Throughput improved: ${scalingFactor.toFixed(2)}x`);
      console.log(`   Scaling efficiency: ${((scalingFactor / dataSizeRatio) * 100).toFixed(1)}%`);
    }
  }

  private generateBatches(config: BatchProcessingConfig): string[] {
    const numberOfBatches = Math.ceil(config.totalTriples / config.batchSize);
    const batches: string[] = [];

    for (let batchIndex = 0; batchIndex < numberOfBatches; batchIndex++) {
      const actualBatchSize = Math.min(
        config.batchSize,
        config.totalTriples - (batchIndex * config.batchSize)
      );
      
      batches.push(this.generateBatchData(actualBatchSize, batchIndex));
    }

    return batches;
  }

  private generateBatchData(tripleCount: number, batchId: number): string {
    let turtleData = `
      @prefix ex: <http://example.com/batch${batchId}/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix schema: <https://schema.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    `;

    // Generate entities with realistic enterprise data patterns
    const entitiesPerTripleGroup = 10; // ~10 triples per entity
    const entityCount = Math.ceil(tripleCount / entitiesPerTripleGroup);

    for (let entityIndex = 0; entityIndex < entityCount; entityIndex++) {
      const entityId = batchId * 100000 + entityIndex;
      const entityType = ['Person', 'Organization', 'Product', 'Event', 'Location'][entityIndex % 5];
      
      turtleData += `
        ex:entity${entityId} a schema:${entityType} ;
            schema:identifier "${entityId}"^^xsd:integer ;
            foaf:name "${entityType} ${entityId}" ;
            schema:dateCreated "${new Date().toISOString()}"^^xsd:dateTime ;
            ex:batchId "${batchId}"^^xsd:integer ;
            ex:category ex:category${entityIndex % 100} ;
            ex:value "${(Math.random() * 1000000).toFixed(2)}"^^xsd:decimal ;
            ex:active "true"^^xsd:boolean ;
            ex:score "${(Math.random() * 100).toFixed(1)}"^^xsd:decimal ;
            ex:metadata "batch-${batchId}-entity-${entityIndex}" .
      `;
    }

    return turtleData;
  }

  private async processBatchesInParallel(batches: string[], concurrency: number): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    const workers: Worker[] = [];

    // Create worker pool
    for (let i = 0; i < Math.min(concurrency, cpus().length); i++) {
      workers.push(new Worker(__filename, { workerData: { workerId: i } }));
    }

    // Process batches with worker pool
    const batchPromises = batches.map((batchData, batchId) => 
      this.processBatchWithWorker(batchData, batchId, workers[batchId % workers.length])
    );

    try {
      const allResults = await Promise.all(batchPromises);
      results.push(...allResults);
    } finally {
      // Clean up workers
      await Promise.all(workers.map(worker => worker.terminate()));
    }

    return results;
  }

  private async processBatchWithWorker(batchData: string, batchId: number, worker: Worker): Promise<BatchResult> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      worker.postMessage({
        type: 'process-batch',
        batchId,
        batchData,
      });

      worker.once('message', (message) => {
        if (message.type === 'batch-result') {
          const endTime = performance.now();
          const endMemory = process.memoryUsage().heapUsed;

          resolve({
            batchId,
            triplesProcessed: message.triplesProcessed,
            processingTime: endTime - startTime,
            memoryUsage: endMemory - startMemory,
            success: message.success,
            error: message.error,
          });
        }
      });
    });
  }

  private generateLargeDataChunk(sizeInMB: number, chunkId: number): string {
    const approxTriplesPerMB = 5000; // Rough estimate
    const tripleCount = sizeInMB * approxTriplesPerMB;
    
    return this.generateBatchData(tripleCount, chunkId);
  }

  private calculateStats(results: BatchResult[], totalTime: number, config: BatchProcessingConfig): ProcessingStats {
    const successfulResults = results.filter(r => r.success);
    const totalTriples = successfulResults.reduce((sum, r) => sum + r.triplesProcessed, 0);
    const totalBatchTime = successfulResults.reduce((sum, r) => sum + r.processingTime, 0);
    const memoryUsages = results.map(r => r.memoryUsage);

    return {
      totalTriples,
      totalBatches: results.length,
      successfulBatches: successfulResults.length,
      failedBatches: results.length - successfulResults.length,
      totalTime,
      avgBatchTime: totalBatchTime / successfulResults.length,
      throughput: totalTriples / (totalTime / 1000), // triples per second
      memoryPeak: Math.max(...memoryUsages),
      memoryAverage: memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length,
    };
  }

  private displayStats(stats: ProcessingStats, config: BatchProcessingConfig): void {
    console.log('\n📊 Processing Statistics');
    console.log('=======================');
    console.log(`Total Triples: ${stats.totalTriples.toLocaleString()}`);
    console.log(`Successful Batches: ${stats.successfulBatches}/${stats.totalBatches}`);
    console.log(`Total Time: ${Math.round(stats.totalTime / 1000)}s`);
    console.log(`Average Batch Time: ${Math.round(stats.avgBatchTime)}ms`);
    console.log(`Throughput: ${Math.round(stats.throughput).toLocaleString()} triples/second`);
    console.log(`Memory Peak: ${Math.round(stats.memoryPeak / 1024 / 1024)}MB`);
    console.log(`Memory Average: ${Math.round(stats.memoryAverage / 1024 / 1024)}MB`);
    
    if (stats.failedBatches > 0) {
      console.log(`⚠️  Failed Batches: ${stats.failedBatches}`);
      const errorRate = (stats.failedBatches / stats.totalBatches) * 100;
      console.log(`Error Rate: ${errorRate.toFixed(2)}%`);
    }

    // Performance evaluation
    const expectedThroughput = config.concurrency * 10000; // 10K triples/second per worker
    const performanceRatio = stats.throughput / expectedThroughput;
    
    console.log(`\n🎯 Performance Evaluation:`);
    console.log(`Expected Throughput: ${expectedThroughput.toLocaleString()} triples/second`);
    console.log(`Actual Performance: ${(performanceRatio * 100).toFixed(1)}% of expected`);
    
    if (performanceRatio > 1.2) {
      console.log('✅ Excellent performance - exceeding expectations');
    } else if (performanceRatio > 0.8) {
      console.log('✅ Good performance - meeting expectations');
    } else if (performanceRatio > 0.5) {
      console.log('⚠️  Moderate performance - may need optimization');
    } else {
      console.log('❌ Poor performance - optimization required');
    }
  }
}

// Worker thread processing logic
if (!isMainThread && parentPort) {
  const processor = new HighVolumeRDFProcessor();

  parentPort.on('message', async (message) => {
    if (message.type === 'process-batch') {
      try {
        const parser = new TurtleParser();
        const result = await parser.parse(message.batchData, `worker-batch-${message.batchId}`);
        
        parentPort!.postMessage({
          type: 'batch-result',
          batchId: message.batchId,
          triplesProcessed: result.triples.length,
          success: true,
        });
      } catch (error) {
        parentPort!.postMessage({
          type: 'batch-result',
          batchId: message.batchId,
          triplesProcessed: 0,
          success: false,
          error: error.message,
        });
      }
    }
  });
}

/**
 * Fortune 5 High-Volume Processing Example
 */
export class Fortune5HighVolumeExample {
  private processor = new HighVolumeRDFProcessor();

  async runExample(): Promise<void> {
    console.log('🏢 Fortune 5 High-Volume RDF Processing Example');
    console.log('===============================================');

    // Simulate Fortune 5 scale processing scenarios
    const scenarios = [
      {
        name: 'Customer Data Batch Processing',
        config: {
          totalTriples: 5_000_000, // 5M customer records
          batchSize: 100_000,
          concurrency: 6,
          compressionEnabled: true,
          indexingEnabled: true,
          cacheEnabled: true,
        },
      },
      {
        name: 'Transaction Stream Processing',
        config: {
          totalTriples: 20_000_000, // 20M transactions
          batchSize: 200_000,
          concurrency: 8,
          compressionEnabled: true,
          indexingEnabled: true,
          cacheEnabled: true,
        },
      },
      {
        name: 'IoT Sensor Data Processing',
        config: {
          totalTriples: 100_000_000, // 100M sensor readings
          batchSize: 1_000_000,
          concurrency: cpus().length,
          compressionEnabled: true,
          indexingEnabled: true,
          cacheEnabled: true,
        },
      },
    ];

    for (const scenario of scenarios) {
      console.log(`\n🔄 Running scenario: ${scenario.name}`);
      console.log('=' + '='.repeat(scenario.name.length + 17));

      try {
        const stats = await this.processor.processHighVolume(scenario.config);
        
        // Validate performance meets Fortune 5 requirements
        this.validatePerformance(scenario.name, stats);
        
        // Delay between scenarios
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`❌ Scenario failed: ${error.message}`);
      }
    }

    // Run streaming example
    console.log(`\n🌊 Running Streaming Data Processing`);
    console.log('===================================');
    await this.processor.processStreamingData(500); // 500MB of streaming data

    // Run comprehensive benchmarks
    console.log(`\n🏁 Running Performance Benchmarks`);
    console.log('=================================');
    await this.processor.runPerformanceBenchmarks();
  }

  private validatePerformance(scenarioName: string, stats: ProcessingStats): void {
    const requirements = {
      minThroughput: 50_000, // 50K triples/second minimum
      maxErrorRate: 0.01, // 1% max error rate
      maxAvgLatency: 5000, // 5 seconds max average batch latency
    };

    console.log(`\n🧪 Validating ${scenarioName} Performance:`);
    
    const errorRate = stats.failedBatches / stats.totalBatches;
    
    // Throughput validation
    if (stats.throughput >= requirements.minThroughput) {
      console.log(`   ✅ Throughput: ${Math.round(stats.throughput).toLocaleString()} t/s (>= ${requirements.minThroughput.toLocaleString()} required)`);
    } else {
      console.log(`   ❌ Throughput: ${Math.round(stats.throughput).toLocaleString()} t/s (< ${requirements.minThroughput.toLocaleString()} required)`);
    }

    // Error rate validation
    if (errorRate <= requirements.maxErrorRate) {
      console.log(`   ✅ Error Rate: ${(errorRate * 100).toFixed(2)}% (<= ${(requirements.maxErrorRate * 100)}% required)`);
    } else {
      console.log(`   ❌ Error Rate: ${(errorRate * 100).toFixed(2)}% (> ${(requirements.maxErrorRate * 100)}% required)`);
    }

    // Latency validation
    if (stats.avgBatchTime <= requirements.maxAvgLatency) {
      console.log(`   ✅ Avg Latency: ${Math.round(stats.avgBatchTime)}ms (<= ${requirements.maxAvgLatency}ms required)`);
    } else {
      console.log(`   ❌ Avg Latency: ${Math.round(stats.avgBatchTime)}ms (> ${requirements.maxAvgLatency}ms required)`);
    }

    // Overall assessment
    const passedChecks = [
      stats.throughput >= requirements.minThroughput,
      errorRate <= requirements.maxErrorRate,
      stats.avgBatchTime <= requirements.maxAvgLatency,
    ].filter(Boolean).length;

    if (passedChecks === 3) {
      console.log('   🎉 All performance requirements met - Fortune 5 ready!');
    } else if (passedChecks === 2) {
      console.log('   ⚠️  Most requirements met - minor optimization needed');
    } else {
      console.log('   ⚠️  Significant optimization required for production');
    }
  }
}

// Export for direct execution
if (import.meta.url === `file://${process.argv[1]}` && isMainThread) {
  const example = new Fortune5HighVolumeExample();
  example.runExample().catch(console.error);
}

export {
  HighVolumeRDFProcessor,
  Fortune5HighVolumeExample,
  type BatchProcessingConfig,
  type ProcessingStats,
  type BatchResult,
};