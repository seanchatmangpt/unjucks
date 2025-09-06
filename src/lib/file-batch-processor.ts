// @ts-nocheck// High-performance file I/O operations with batching and async optimization
// Reduces file system calls and improves throughput

import fs from "fs-extra";
import path from "node:path";
import { performance } from "node:perf_hooks";

export interface BatchFileOperation {
  type: 'read' | 'write' | 'exists' | 'stat';
  path: string;
  content?: string;
  encoding?: string;
  id: string;
}

export interface BatchResult {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

export interface FileStats {
  totalOperations: number;
  batchedOperations: number;
  totalTime: number;
  averageTime: number;
  cacheHits: number;
}

class FileBatchProcessor {
  private operationQueue: BatchFileOperation[] = [];
  private results = new Map<string, BatchResult>();
  private batchSize = 50; // Process 50 operations at once
  private batchTimeout = 10; // 10ms timeout for batching
  private batchTimer: NodeJS.Timeout | null = null;
  private processing = false;
  private statsCache = new Map<string, any>();
  private stats: FileStats = {
    totalOperations: 0,
    batchedOperations: 0,
    totalTime: 0,
    averageTime: 0,
    cacheHits: 0
  };

  constructor(batchSize: number = 50, batchTimeout: number = 10) {
    this.batchSize = batchSize;
    this.batchTimeout = batchTimeout;
  }

  // Queue an operation for batched processing
  private async queueOperation(operation: BatchFileOperation): Promise<BatchResult> {
    return new Promise((resolve, reject) => {
      this.operationQueue.push(operation);
      
      // Store resolver for this operation
      const checkResult = () => {
        const result = this.results.get(operation.id);
        if (result) {
          this.results.delete(operation.id);
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(result.error));
          }
        } else {
          // Check again after processing
          setTimeout(checkResult, 1);
        }
      };

      // Trigger batch processing
      this.triggerBatchProcessing();
      
      // Check for result
      setTimeout(checkResult, 0);
    });
  }

  private triggerBatchProcessing(): void {
    if (this.processing) return;

    // Clear existing timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    // Process immediately if batch is full, otherwise wait for timeout
    if (this.operationQueue.length >= this.batchSize) {
      this.processBatch();
    } else {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.batchTimeout);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.processing || this.operationQueue.length === 0) return;

    this.processing = true;
    const batch = this.operationQueue.splice(0, this.batchSize);
    const startTime = performance.now();

    try {
      // Group operations by type for optimal processing
      const readOps = batch.filter(op => op.type === 'read');
      const writeOps = batch.filter(op => op.type === 'write');
      const existsOps = batch.filter(op => op.type === 'exists');
      const statOps = batch.filter(op => op.type === 'stat');

      // Process in parallel batches
      await Promise.all([
        this.processReadOperations(readOps),
        this.processWriteOperations(writeOps),
        this.processExistsOperations(existsOps),
        this.processStatOperations(statOps)
      ]);

      // Update stats
      const duration = performance.now() - startTime;
      this.stats.totalOperations += batch.length;
      this.stats.batchedOperations += batch.length;
      this.stats.totalTime += duration;
      this.stats.averageTime = this.stats.totalTime / this.stats.totalOperations;

    } catch (error) {
      // Handle batch processing errors
      console.error('Batch processing error:', error);
    } finally {
      this.processing = false;
      
      // Process next batch if queue has items
      if (this.operationQueue.length > 0) {
        setImmediate(() => this.triggerBatchProcessing());
      }
    }
  }

  private async processReadOperations(operations: BatchFileOperation[]): Promise<void> {
    const promises = operations.map(async (op) => {
      const startTime = performance.now();
      try {
        const data = await fs.readFile(op.path, op.encoding || 'utf8');
        this.results.set(op.id, {
          id: op.id,
          success: true,
          data,
          duration: performance.now() - startTime
        });
      } catch (error) {
        this.results.set(op.id, {
          id: op.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: performance.now() - startTime
        });
      }
    });

    // @ts-ignore - Promise.allSettled type issue
    await Promise.allSettled(promises);
  }

  private async processWriteOperations(operations: BatchFileOperation[]): Promise<void> {
    const promises = operations.map(async (op) => {
      const startTime = performance.now();
      try {
        // Ensure directory exists
        await fs.ensureDir(path.dirname(op.path));
        await fs.writeFile(op.path, op.content || '', op.encoding || 'utf8');
        this.results.set(op.id, {
          id: op.id,
          success: true,
          duration: performance.now() - startTime
        });
      } catch (error) {
        this.results.set(op.id, {
          id: op.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: performance.now() - startTime
        });
      }
    });

    // @ts-ignore - Promise.allSettled type issue
    await Promise.allSettled(promises);
  }

  private async processExistsOperations(operations: BatchFileOperation[]): Promise<void> {
    const promises = operations.map(async (op) => {
      const startTime = performance.now();
      
      // Check cache first
      const cacheKey = `exists:${op.path}`;
      if (this.statsCache.has(cacheKey)) {
        this.stats.cacheHits++;
        this.results.set(op.id, {
          id: op.id,
          success: true,
          data: this.statsCache.get(cacheKey),
          duration: performance.now() - startTime
        });
        return;
      }

      try {
        const exists = await fs.pathExists(op.path);
        this.statsCache.set(cacheKey, exists);
        this.results.set(op.id, {
          id: op.id,
          success: true,
          data: exists,
          duration: performance.now() - startTime
        });
      } catch (error) {
        this.results.set(op.id, {
          id: op.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: performance.now() - startTime
        });
      }
    });

    await Promise.allSettled(promises);
  }

  private async processStatOperations(operations: BatchFileOperation[]): Promise<void> {
    const promises = operations.map(async (op) => {
      const startTime = performance.now();
      
      // Check cache first
      const cacheKey = `stat:${op.path}`;
      if (this.statsCache.has(cacheKey)) {
        this.stats.cacheHits++;
        this.results.set(op.id, {
          id: op.id,
          success: true,
          data: this.statsCache.get(cacheKey),
          duration: performance.now() - startTime
        });
        return;
      }

      try {
        const stat = await fs.stat(op.path);
        this.statsCache.set(cacheKey, stat);
        this.results.set(op.id, {
          id: op.id,
          success: true,
          data: stat,
          duration: performance.now() - startTime
        });
      } catch (error) {
        this.results.set(op.id, {
          id: op.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: performance.now() - startTime
        });
      }
    });

    await Promise.allSettled(promises);
  }

  // Public API methods with batching
  async readFile(filePath: string, encoding: string = 'utf8'): Promise<string> {
    const id = `read:${Date.now()}:${Math.random()}`;
    const result = await this.queueOperation({
      type: 'read',
      path: filePath,
      encoding,
      id
    });
    return result.data;
  }

  async writeFile(filePath: string, content: string, encoding: string = 'utf8'): Promise<void> {
    const id = `write:${Date.now()}:${Math.random()}`;
    await this.queueOperation({
      type: 'write',
      path: filePath,
      content,
      encoding,
      id
    });
  }

  async pathExists(filePath: string): Promise<boolean> {
    const id = `exists:${Date.now()}:${Math.random()}`;
    const result = await this.queueOperation({
      type: 'exists',
      path: filePath,
      id
    });
    return result.data;
  }

  async stat(filePath: string): Promise<fs.Stats> {
    const id = `stat:${Date.now()}:${Math.random()}`;
    const result = await this.queueOperation({
      type: 'stat',
      path: filePath,
      id
    });
    return result.data;
  }

  // Force immediate processing of queued operations
  async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    while (this.operationQueue.length > 0) {
      await this.processBatch();
    }
  }

  // Clear cache and reset stats
  clearCache(): void {
    this.statsCache.clear();
    this.stats.cacheHits = 0;
  }

  // Get performance statistics
  getStats(): FileStats {
    return { ...this.stats };
  }

  // Optimized directory scanning with parallel processing
  async scanDirectory(dirPath: string, maxConcurrency: number = 10): Promise<string[]> {
    const results: string[] = [];
    const queue: string[] = [dirPath];
    const processing = new Set<string>();

    const processDirectory = async (dir: string): Promise<void> => {
      if (processing.has(dir)) return;
      processing.add(dir);

      try {
        const entries = await fs.readdir(dir);
        const entryPaths = entries.map(entry => path.join(dir, entry));
        
        // Batch stat operations for all entries
        const statPromises = entryPaths.map(async (entryPath) => {
          const stat = await this.stat(entryPath);
          return { path: entryPath, stat };
        });

        const statResults = await Promise.all(statPromises);
        
        for (const { path: entryPath, stat } of statResults) {
          if (stat.isDirectory()) {
            queue.push(entryPath);
          } else {
            results.push(entryPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      } finally {
        processing.delete(dir);
      }
    };

    // Process directories with limited concurrency
    while (queue.length > 0 || processing.size > 0) {
      while (queue.length > 0 && processing.size < maxConcurrency) {
        const dir = queue.shift()!;
        processDirectory(dir);
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    return results;
  }
}

// Global file batch processor instance
export const fileBatchProcessor = new FileBatchProcessor();

// Convenience functions that use batching
export async function readFilesBatch(filePaths: string[]): Promise<string[]> {
  const promises = filePaths.map(filePath => 
    fileBatchProcessor.readFile(filePath)
  );
  return Promise.all(promises);
}

export async function writeFilesBatch(files: Array<{ path: string; content: string }>): Promise<void> {
  const promises = files.map(file => 
    fileBatchProcessor.writeFile(file.path, file.content)
  );
  await Promise.all(promises);
  await fileBatchProcessor.flush(); // Ensure all writes complete
}

export async function checkPathsExist(paths: string[]): Promise<boolean[]> {
  const promises = paths.map(path => 
    fileBatchProcessor.pathExists(path)
  );
  return Promise.all(promises);
}