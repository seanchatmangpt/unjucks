import { Transform, Readable, Writable } from 'stream';
import { Store, Parser, Writer, Quad, DataFactory } from 'n3';
import { EventEmitter } from 'events';

interface StreamingConfig {
  batchSize: number;
  maxMemoryMB: number;
  backpressureThreshold: number;
  poolSize: number;
  enableCompression: boolean;
}

interface StreamingMetrics {
  processedQuads: number;
  batchesProcessed: number;
  averageBatchTime: number;
  memoryPeakMB: number;
  backpressureEvents: number;
  poolUtilization: number;
  compressionRatio?: number;
}

class MemoryPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset?: (item: T) => void;
  private maxSize: number;

  constructor(factory: () => T, maxSize: number = 100, reset?: (item: T) => void) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.reset = reset;
  }

  acquire(): T {
    const item = this.pool.pop();
    if (item) {
      return item;
    }
    return this.factory();
  }

  release(item: T): void {
    if (this.pool.length < this.maxSize) {
      if (this.reset) {
        this.reset(item);
      }
      this.pool.push(item);
    }
  }

  get utilization(): number {
    return this.pool.length / this.maxSize;
  }

  clear(): void {
    this.pool = [];
  }
}

class BatchProcessor extends Transform {
  private batch: Quad[] = [];
  private batchSize: number;
  private store: Store;
  private processedCount = 0;
  private batchTimes: number[] = [];
  private pool: MemoryPool<Quad[]>;

  constructor(store: Store, batchSize: number) {
    super({ objectMode: true });
    this.batchSize = batchSize;
    this.store = store;
    this.pool = new MemoryPool(
      () => [],
      50, // Pool size
      (arr) => arr.length = 0 // Reset function
    );
  }

  _transform(quad: Quad, encoding: string, callback: Function): void {
    this.batch.push(quad);
    
    if (this.batch.length >= this.batchSize) {
      this.processBatch();
    }
    
    callback();
  }

  _flush(callback: Function): void {
    if (this.batch.length > 0) {
      this.processBatch();
    }
    callback();
  }

  private processBatch(): void {
    const startTime = Date.now();
    
    // Use pooled array for processing
    const processingBatch = this.pool.acquire();
    processingBatch.push(...this.batch);
    
    // Add quads to store
    for (const quad of processingBatch) {
      this.store.addQuad(quad);
    }
    
    // Track metrics
    this.processedCount += processingBatch.length;
    const batchTime = Date.now() - startTime;
    this.batchTimes.push(batchTime);
    
    // Keep only last 100 batch times for rolling average
    if (this.batchTimes.length > 100) {
      this.batchTimes.shift();
    }
    
    // Emit batch processed event
    this.emit('batch-processed', {
      count: processingBatch.length,
      totalProcessed: this.processedCount,
      batchTime,
      averageBatchTime: this.batchTimes.reduce((a, b) => a + b, 0) / this.batchTimes.length
    });
    
    // Return batch array to pool and reset current batch
    this.pool.release(processingBatch);
    this.batch = [];
  }

  getMetrics(): { processedCount: number; averageBatchTime: number; poolUtilization: number } {
    return {
      processedCount: this.processedCount,
      averageBatchTime: this.batchTimes.length > 0 
        ? this.batchTimes.reduce((a, b) => a + b, 0) / this.batchTimes.length 
        : 0,
      poolUtilization: this.pool.utilization
    };
  }
}

class MemoryMonitoringStream extends Transform {
  private maxMemoryMB: number;
  private backpressureThreshold: number;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private peakMemoryMB = 0;
  private backpressureCount = 0;
  private isBackpressureActive = false;

  constructor(maxMemoryMB: number, backpressureThreshold: number = 0.8) {
    super({ objectMode: true, highWaterMark: 16 });
    this.maxMemoryMB = maxMemoryMB;
    this.backpressureThreshold = backpressureThreshold;
    
    this.startMemoryMonitoring();
  }

  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const currentMemoryMB = memoryUsage.heapUsed / (1024 * 1024);
      
      this.peakMemoryMB = Math.max(this.peakMemoryMB, currentMemoryMB);
      
      const memoryPressure = currentMemoryMB / this.maxMemoryMB;
      
      if (memoryPressure > this.backpressureThreshold && !this.isBackpressureActive) {
        this.activateBackpressure();
      } else if (memoryPressure < (this.backpressureThreshold * 0.7) && this.isBackpressureActive) {
        this.deactivateBackpressure();
      }
    }, 100); // Check every 100ms
  }

  private activateBackpressure(): void {
    this.isBackpressureActive = true;
    this.backpressureCount++;
    
    // Reduce buffer size to apply backpressure
    (this as any)._writableState.highWaterMark = 1;
    
    this.emit('backpressure-activated', {
      memoryMB: process.memoryUsage().heapUsed / (1024 * 1024),
      threshold: this.maxMemoryMB * this.backpressureThreshold
    });
  }

  private deactivateBackpressure(): void {
    this.isBackpressureActive = false;
    
    // Restore normal buffer size
    (this as any)._writableState.highWaterMark = 16;
    
    this.emit('backpressure-deactivated');
  }

  _transform(chunk: any, encoding: string, callback: Function): void {
    if (this.isBackpressureActive) {
      // Add small delay during backpressure
      setTimeout(() => {
        this.push(chunk);
        callback();
      }, 1);
    } else {
      this.push(chunk);
      callback();
    }
  }

  getMemoryMetrics(): { peakMemoryMB: number; backpressureCount: number; isActive: boolean } {
    return {
      peakMemoryMB: this.peakMemoryMB,
      backpressureCount: this.backpressureCount,
      isActive: this.isBackpressureActive
    };
  }

  cleanup(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }
}

class CompressionStream extends Transform {
  private compressionEnabled: boolean;
  private originalSize = 0;
  private compressedSize = 0;

  constructor(enableCompression: boolean = true) {
    super({ objectMode: true });
    this.compressionEnabled = enableCompression;
  }

  _transform(data: any, encoding: string, callback: Function): void {
    if (this.compressionEnabled && typeof data === 'string') {
      const original = Buffer.from(data, 'utf8');
      this.originalSize += original.length;
      
      // Simple compression simulation (in practice, use gzip or similar)
      const compressed = this.simpleCompress(data);
      this.compressedSize += Buffer.from(compressed, 'utf8').length;
      
      this.push(compressed);
    } else {
      this.push(data);
    }
    
    callback();
  }

  private simpleCompress(data: string): string {
    // Simple run-length encoding simulation
    // In production, use proper compression libraries
    return data.replace(/(.)\1+/g, (match, char) => {
      return match.length > 3 ? `${char}*${match.length}` : match;
    });
  }

  getCompressionRatio(): number {
    return this.originalSize > 0 ? this.compressedSize / this.originalSize : 1;
  }
}

export class StreamingOptimizer extends EventEmitter {
  private config: StreamingConfig;
  private metrics: StreamingMetrics;
  private store: Store;
  private isProcessing = false;

  constructor(config: Partial<StreamingConfig> = {}) {
    super();
    
    this.config = {
      batchSize: 1000,
      maxMemoryMB: 2048, // 2GB default
      backpressureThreshold: 0.8,
      poolSize: 100,
      enableCompression: false,
      ...config
    };

    this.metrics = {
      processedQuads: 0,
      batchesProcessed: 0,
      averageBatchTime: 0,
      memoryPeakMB: 0,
      backpressureEvents: 0,
      poolUtilization: 0
    };

    this.store = new Store();
  }

  async processRDFStream(input: Readable): Promise<StreamingMetrics> {
    if (this.isProcessing) {
      throw new Error('Already processing a stream');
    }

    this.isProcessing = true;
    this.resetMetrics();

    const startTime = Date.now();

    try {
      const parser = new Parser();
      const batchProcessor = new BatchProcessor(this.store, this.config.batchSize);
      const memoryMonitor = new MemoryMonitoringStream(this.config.maxMemoryMB, this.config.backpressureThreshold);
      const compressionStream = new CompressionStream(this.config.enableCompression);

      // Set up event listeners
      batchProcessor.on('batch-processed', (batchInfo) => {
        this.metrics.batchesProcessed++;
        this.metrics.processedQuads = batchInfo.totalProcessed;
        this.metrics.averageBatchTime = batchInfo.averageBatchTime;
        this.emit('batch-processed', batchInfo);
      });

      memoryMonitor.on('backpressure-activated', (info) => {
        this.metrics.backpressureEvents++;
        this.emit('backpressure-activated', info);
      });

      memoryMonitor.on('backpressure-deactivated', () => {
        this.emit('backpressure-deactivated');
      });

      // Create processing pipeline
      const pipeline = input
        .pipe(compressionStream)
        .pipe(memoryMonitor)
        .pipe(batchProcessor);

      // Process RDF data through parser
      await new Promise((resolve, reject) => {
        let buffer = '';
        
        input.on('data', (chunk) => {
          buffer += chunk.toString();
          
          // Process complete triples
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line
          
          for (const line of lines) {
            if (line.trim() && !line.startsWith('#')) {
              try {
                const quads = parser.parse(line + '\n');
                quads.forEach(quad => pipeline.write(quad));
              } catch (error) {
                // Skip invalid lines
                console.warn(`Skipping invalid RDF line: ${line}`);
              }
            }
          }
        });

        input.on('end', () => {
          // Process remaining buffer
          if (buffer.trim()) {
            try {
              const quads = parser.parse(buffer);
              quads.forEach(quad => pipeline.write(quad));
            } catch (error) {
              console.warn(`Skipping invalid final RDF: ${buffer}`);
            }
          }
          
          pipeline.end();
          resolve(null);
        });

        input.on('error', reject);
        pipeline.on('error', reject);
      });

      // Collect final metrics
      const batchMetrics = batchProcessor.getMetrics();
      const memoryMetrics = memoryMonitor.getMemoryMetrics();
      
      this.metrics.processedQuads = batchMetrics.processedCount;
      this.metrics.averageBatchTime = batchMetrics.averageBatchTime;
      this.metrics.poolUtilization = batchMetrics.poolUtilization;
      this.metrics.memoryPeakMB = memoryMetrics.peakMemoryMB;
      this.metrics.backpressureEvents = memoryMetrics.backpressureCount;
      
      if (this.config.enableCompression) {
        this.metrics.compressionRatio = compressionStream.getCompressionRatio();
      }

      // Cleanup
      memoryMonitor.cleanup();

    } finally {
      this.isProcessing = false;
    }

    const totalTime = Date.now() - startTime;
    this.emit('processing-complete', {
      ...this.metrics,
      totalTimeMs: totalTime,
      throughput: (this.metrics.processedQuads / totalTime) * 1000 // quads per second
    });

    return this.metrics;
  }

  async processLargeDataset(data: string): Promise<StreamingMetrics> {
    const readable = Readable.from([data]);
    return this.processRDFStream(readable);
  }

  async processFileStream(filePath: string): Promise<StreamingMetrics> {
    const fs = await import('fs');
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    return this.processRDFStream(fileStream);
  }

  optimizeForMemoryConstrained(maxMemoryMB: number): void {
    this.config.maxMemoryMB = maxMemoryMB;
    this.config.batchSize = Math.min(this.config.batchSize, 100);
    this.config.backpressureThreshold = 0.6; // More aggressive backpressure
    this.config.poolSize = Math.min(this.config.poolSize, 20);
  }

  optimizeForThroughput(): void {
    this.config.batchSize = 5000;
    this.config.backpressureThreshold = 0.9; // Less aggressive backpressure
    this.config.poolSize = 200;
    this.config.enableCompression = false; // Disable compression for speed
  }

  optimizeForLowLatency(): void {
    this.config.batchSize = 100;
    this.config.poolSize = 50;
    this.config.backpressureThreshold = 0.7;
  }

  getStore(): Store {
    return this.store;
  }

  getMetrics(): StreamingMetrics {
    return { ...this.metrics };
  }

  getConfiguration(): StreamingConfig {
    return { ...this.config };
  }

  private resetMetrics(): void {
    this.metrics = {
      processedQuads: 0,
      batchesProcessed: 0,
      averageBatchTime: 0,
      memoryPeakMB: 0,
      backpressureEvents: 0,
      poolUtilization: 0
    };
  }

  reset(): void {
    if (this.isProcessing) {
      throw new Error('Cannot reset while processing');
    }
    
    this.store = new Store();
    this.resetMetrics();
  }

  // Utility method for testing different optimization strategies
  async benchmarkOptimizationStrategies(data: string): Promise<{
    memoryConstrained: StreamingMetrics & { totalTimeMs: number };
    throughputOptimized: StreamingMetrics & { totalTimeMs: number };
    latencyOptimized: StreamingMetrics & { totalTimeMs: number };
    default: StreamingMetrics & { totalTimeMs: number };
  }> {
    const originalConfig = { ...this.config };
    const results: any = {};

    // Test memory constrained
    this.reset();
    this.optimizeForMemoryConstrained(512); // 512MB limit
    const memoryStartTime = Date.now();
    const memoryMetrics = await this.processLargeDataset(data);
    results.memoryConstrained = { ...memoryMetrics, totalTimeMs: Date.now() - memoryStartTime };

    // Test throughput optimized
    this.reset();
    this.optimizeForThroughput();
    const throughputStartTime = Date.now();
    const throughputMetrics = await this.processLargeDataset(data);
    results.throughputOptimized = { ...throughputMetrics, totalTimeMs: Date.now() - throughputStartTime };

    // Test latency optimized
    this.reset();
    this.optimizeForLowLatency();
    const latencyStartTime = Date.now();
    const latencyMetrics = await this.processLargeDataset(data);
    results.latencyOptimized = { ...latencyMetrics, totalTimeMs: Date.now() - latencyStartTime };

    // Test default configuration
    this.reset();
    this.config = originalConfig;
    const defaultStartTime = Date.now();
    const defaultMetrics = await this.processLargeDataset(data);
    results.default = { ...defaultMetrics, totalTimeMs: Date.now() - defaultStartTime };

    return results;
  }
}

// Factory functions for common use cases
export function createMemoryOptimizedStreamer(maxMemoryMB: number = 1024): StreamingOptimizer {
  const optimizer = new StreamingOptimizer();
  optimizer.optimizeForMemoryConstrained(maxMemoryMB);
  return optimizer;
}

export function createThroughputOptimizedStreamer(): StreamingOptimizer {
  const optimizer = new StreamingOptimizer();
  optimizer.optimizeForThroughput();
  return optimizer;
}

export function createLatencyOptimizedStreamer(): StreamingOptimizer {
  const optimizer = new StreamingOptimizer();
  optimizer.optimizeForLowLatency();
  return optimizer;
}

// Utility function to create a readable stream from RDF string
export function createRDFReadableStream(rdfData: string): Readable {
  return Readable.from([rdfData]);
}

// Utility function to estimate memory usage for RDF data
export function estimateRDFMemoryUsage(rdfData: string): {
  estimatedTriples: number;
  estimatedMemoryMB: number;
  recommendedBatchSize: number;
} {
  const lines = rdfData.split('\n').filter(line => 
    line.trim() && !line.startsWith('#') && !line.startsWith('@')
  );
  
  const estimatedTriples = lines.length;
  // Rough estimate: each triple takes about 200-400 bytes in memory
  const estimatedMemoryMB = (estimatedTriples * 300) / (1024 * 1024);
  
  // Recommend batch size based on memory requirements
  let recommendedBatchSize = 1000;
  if (estimatedMemoryMB > 1024) { // > 1GB
    recommendedBatchSize = 100;
  } else if (estimatedMemoryMB > 512) { // > 512MB
    recommendedBatchSize = 500;
  }

  return {
    estimatedTriples,
    estimatedMemoryMB,
    recommendedBatchSize
  };
}