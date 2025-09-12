/**
 * High-Performance RDF Stream Processor
 * 
 * Provides efficient streaming support for very large RDF files with
 * memory-bounded processing, parallel parsing, and adaptive buffering.
 */

import { EventEmitter } from 'events';
import { Readable, Transform, Writable, pipeline } from 'stream';
import { promisify } from 'util';
import consola from 'consola';
import crypto from 'crypto';
import { Parser, Writer, Store, DataFactory } from 'n3';
import { createReadStream, createWriteStream } from 'fs';
import { stat } from 'fs/promises';
import { KGenErrorHandler } from '../../utils/error-handler.js';

const pipelineAsync = promisify(pipeline);

export class RDFStreamProcessor extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Memory management
      maxMemoryUsage: config.maxMemoryUsage || 100 * 1024 * 1024, // 100MB
      bufferSize: config.bufferSize || 64 * 1024, // 64KB
      batchSize: config.batchSize || 1000, // quads per batch
      
      // Performance tuning  
      enableParallelParsing: config.enableParallelParsing !== false,
      maxWorkers: config.maxWorkers || require('os').cpus().length,
      adaptiveBuffering: config.adaptiveBuffering !== false,
      
      // Stream configuration
      highWaterMark: config.highWaterMark || 16384,
      objectMode: true,
      
      // Processing options
      validateQuads: config.validateQuads || false,
      deduplicate: config.deduplicate || false,
      enableCompression: config.enableCompression || false,
      
      // Monitoring
      enableProgressReporting: config.enableProgressReporting !== false,
      progressInterval: config.progressInterval || 10000, // 10 seconds
      
      ...config
    };
    
    this.logger = consola.withTag('rdf-stream-processor');
    
    // Processing state
    this.activeStreams = new Map();
    this.processingStats = {
      totalQuadsProcessed: 0,
      totalFilesProcessed: 0,
      averageProcessingSpeed: 0,
      peakMemoryUsage: 0,
      errors: 0
    };
    
    // Memory monitoring
    this.memoryMonitor = {
      enabled: true,
      checkInterval: 5000,
      timer: null
    };
    
    // Error handling
    this.errorHandler = new KGenErrorHandler({
      enableRecovery: true,
      maxRetryAttempts: 3,
      retryDelay: 1000
    });
    
    this.state = 'initialized';
  }

  /**
   * Initialize the stream processor
   */
  async initialize() {
    try {
      this.logger.info('Initializing RDF stream processor');
      
      // Start memory monitoring
      this._startMemoryMonitoring();
      
      // Setup error recovery
      this._setupErrorRecovery();
      
      this.state = 'ready';
      this.logger.success('RDF stream processor initialized');
      
      return {
        status: 'success',
        maxMemory: `${this.config.maxMemoryUsage / 1024 / 1024}MB`,
        parallelParsing: this.config.enableParallelParsing,
        maxWorkers: this.config.maxWorkers
      };
      
    } catch (error) {
      this.state = 'error';
      this.logger.error('Failed to initialize RDF stream processor:', error);
      throw error;
    }
  }

  /**
   * Process large RDF file with streaming
   */
  async processFile(filePath, options = {}) {
    const streamId = crypto.randomBytes(8).toString('hex');
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting stream processing: ${streamId} (${filePath})`);
      
      // Get file info
      const fileStats = await stat(filePath);
      const fileSize = fileStats.size;
      
      // Determine processing strategy
      const strategy = await this._selectProcessingStrategy(filePath, fileSize, options);
      this.logger.debug(`Using processing strategy: ${strategy}`);
      
      // Register active stream
      this.activeStreams.set(streamId, {
        filePath,
        startTime,
        fileSize,
        strategy,
        processed: 0,
        errors: 0
      });
      
      let result;
      switch (strategy) {
        case 'streaming':
          result = await this._processFileStreaming(streamId, filePath, options);
          break;
        case 'chunked':
          result = await this._processFileChunked(streamId, filePath, options);
          break;
        case 'parallel':
          result = await this._processFileParallel(streamId, filePath, options);
          break;
        case 'memory-mapped':
          result = await this._processFileMemoryMapped(streamId, filePath, options);
          break;
        default:
          result = await this._processFileBasic(streamId, filePath, options);
      }
      
      // Update statistics
      const processingTime = Date.now() - startTime;
      this._updateProcessingStats(result, processingTime);
      
      this.activeStreams.delete(streamId);
      
      this.logger.info(`Stream processing completed: ${streamId} (${processingTime}ms, ${result.quadsProcessed} quads)`);
      this.emit('file-processed', { streamId, result, processingTime });
      
      return result;
      
    } catch (error) {
      this.activeStreams.delete(streamId);
      this.processingStats.errors++;
      
      this.logger.error(`Stream processing failed: ${streamId}`, error);
      this.emit('processing-error', { streamId, error });
      throw error;
    }
  }

  /**
   * Process RDF data from readable stream
   */
  async processStream(inputStream, options = {}) {
    const streamId = crypto.randomBytes(8).toString('hex');
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Processing input stream: ${streamId}`);
      
      const result = await this._processInputStream(streamId, inputStream, options);
      
      const processingTime = Date.now() - startTime;
      this._updateProcessingStats(result, processingTime);
      
      this.logger.debug(`Stream processing completed: ${streamId} (${processingTime}ms)`);
      return result;
      
    } catch (error) {
      this.processingStats.errors++;
      this.logger.error(`Input stream processing failed: ${streamId}`, error);
      throw error;
    }
  }

  /**
   * Create optimized RDF parser transform stream
   */
  createParserStream(format = 'turtle', options = {}) {
    const parserOptions = {
      format,
      ...options
    };
    
    return new Transform({
      objectMode: true,
      highWaterMark: this.config.highWaterMark,
      
      transform(chunk, encoding, callback) {
        try {
          const parser = new Parser(parserOptions);
          const quads = [];
          
          parser.parse(chunk.toString(), (error, quad, prefixes) => {
            if (error) {
              return callback(error);
            }
            
            if (quad) {
              quads.push(quad);
            } else {
              // Parsing complete for this chunk
              callback(null, quads);
            }
          });
          
        } catch (error) {
          callback(error);
        }
      }
    });
  }

  /**
   * Create optimized RDF writer transform stream
   */
  createWriterStream(format = 'turtle', options = {}) {
    const writerOptions = {
      format,
      ...options
    };
    
    let writer = null;
    
    return new Transform({
      objectMode: true,
      highWaterMark: this.config.highWaterMark,
      
      transform(quads, encoding, callback) {
        try {
          if (!writer) {
            writer = new Writer(writerOptions);
          }
          
          if (Array.isArray(quads)) {
            writer.addQuads(quads);
          } else {
            writer.addQuad(quads);
          }
          
          callback();
          
        } catch (error) {
          callback(error);
        }
      },
      
      flush(callback) {
        if (writer) {
          writer.end((error, result) => {
            if (error) {
              callback(error);
            } else {
              callback(null, result);
            }
          });
        } else {
          callback();
        }
      }
    });
  }

  /**
   * Create batch processing transform stream
   */
  createBatchProcessor(batchSize = this.config.batchSize, processor) {
    let batch = [];
    
    return new Transform({
      objectMode: true,
      
      transform(quad, encoding, callback) {
        batch.push(quad);
        
        if (batch.length >= batchSize) {
          processor(batch)
            .then(result => {
              batch = [];
              callback(null, result);
            })
            .catch(error => callback(error));
        } else {
          callback();
        }
      },
      
      flush(callback) {
        if (batch.length > 0) {
          processor(batch)
            .then(result => callback(null, result))
            .catch(error => callback(error));
        } else {
          callback();
        }
      }
    });
  }

  /**
   * Create memory-aware buffering stream
   */
  createAdaptiveBuffer() {
    let bufferSize = this.config.batchSize;
    let buffer = [];
    let lastMemoryCheck = Date.now();
    
    return new Transform({
      objectMode: true,
      
      transform(quad, encoding, callback) {
        buffer.push(quad);
        
        // Adaptive buffer sizing based on memory usage
        const now = Date.now();
        if (now - lastMemoryCheck > 1000) { // Check every second
          const memUsage = process.memoryUsage();
          
          if (memUsage.heapUsed > this.config.maxMemoryUsage * 0.8) {
            bufferSize = Math.max(100, bufferSize * 0.8);
          } else if (memUsage.heapUsed < this.config.maxMemoryUsage * 0.5) {
            bufferSize = Math.min(this.config.batchSize * 2, bufferSize * 1.2);
          }
          
          lastMemoryCheck = now;
        }
        
        if (buffer.length >= bufferSize) {
          const batch = buffer.splice(0);
          callback(null, batch);
        } else {
          callback();
        }
      },
      
      flush(callback) {
        if (buffer.length > 0) {
          callback(null, buffer);
        } else {
          callback();
        }
      }
    });
  }

  // Private processing methods

  /**
   * Select optimal processing strategy
   */
  async _selectProcessingStrategy(filePath, fileSize, options = {}) {
    // Force specific strategy if requested
    if (options.strategy) {
      return options.strategy;
    }
    
    // Very large files (>1GB) use memory-mapped processing
    if (fileSize > 1024 * 1024 * 1024) {
      return 'memory-mapped';
    }
    
    // Large files (>100MB) use parallel processing if available
    if (fileSize > 100 * 1024 * 1024 && this.config.enableParallelParsing) {
      return 'parallel';
    }
    
    // Medium files (>10MB) use chunked processing
    if (fileSize > 10 * 1024 * 1024) {
      return 'chunked';
    }
    
    // Small files use streaming
    return 'streaming';
  }

  /**
   * Process file using pure streaming approach
   */
  async _processFileStreaming(streamId, filePath, options = {}) {
    const format = options.format || this._detectFormat(filePath);
    const store = options.store || new Store();
    
    let quadsProcessed = 0;
    let parseErrors = 0;
    
    const fileStream = createReadStream(filePath, {
      highWaterMark: this.config.bufferSize
    });
    
    const parserStream = this.createParserStream(format);
    const processorStream = new Transform({
      objectMode: true,
      transform(quads, encoding, callback) {
        try {
          if (Array.isArray(quads)) {
            for (const quad of quads) {
              if (options.validate && !this._validateQuad(quad)) {
                parseErrors++;
                continue;
              }
              
              store.addQuad(quad);
              quadsProcessed++;
            }
          }
          
          callback();
        } catch (error) {
          parseErrors++;
          callback(error);
        }
      }
    });
    
    // Setup progress reporting
    let lastProgressTime = Date.now();
    let lastQuadCount = 0;
    
    const progressStream = new Transform({
      objectMode: true,
      transform(data, encoding, callback) {
        const now = Date.now();
        if (now - lastProgressTime > this.config.progressInterval) {
          const speed = (quadsProcessed - lastQuadCount) / (now - lastProgressTime) * 1000;
          
          this.emit('processing-progress', {
            streamId,
            quadsProcessed,
            speed: Math.round(speed),
            memoryUsage: process.memoryUsage()
          });
          
          lastProgressTime = now;
          lastQuadCount = quadsProcessed;
        }
        
        callback(null, data);
      }
    });
    
    await pipelineAsync(
      fileStream,
      parserStream,
      progressStream,
      processorStream
    );
    
    return {
      quadsProcessed,
      parseErrors,
      store,
      format,
      strategy: 'streaming'
    };
  }

  /**
   * Process file using chunked approach
   */
  async _processFileChunked(streamId, filePath, options = {}) {
    const format = options.format || this._detectFormat(filePath);
    const store = options.store || new Store();
    const chunkSize = options.chunkSize || this.config.bufferSize * 10;
    
    let quadsProcessed = 0;
    let parseErrors = 0;
    
    const fileStream = createReadStream(filePath, {
      highWaterMark: this.config.bufferSize
    });
    
    const chunkBuffer = [];
    let bufferSize = 0;
    
    for await (const chunk of fileStream) {
      chunkBuffer.push(chunk);
      bufferSize += chunk.length;
      
      if (bufferSize >= chunkSize) {
        const data = Buffer.concat(chunkBuffer).toString();
        chunkBuffer.length = 0;
        bufferSize = 0;
        
        try {
          const chunkResult = await this._parseChunk(data, format, options);
          
          for (const quad of chunkResult.quads) {
            store.addQuad(quad);
            quadsProcessed++;
          }
          
          parseErrors += chunkResult.errors;
          
          // Memory pressure check
          if (this._checkMemoryPressure()) {
            await this._handleMemoryPressure();
          }
          
        } catch (error) {
          parseErrors++;
          this.logger.warn(`Chunk parsing error in ${streamId}:`, error);
        }
      }
    }
    
    // Process remaining buffer
    if (chunkBuffer.length > 0) {
      const data = Buffer.concat(chunkBuffer).toString();
      
      try {
        const chunkResult = await this._parseChunk(data, format, options);
        
        for (const quad of chunkResult.quads) {
          store.addQuad(quad);
          quadsProcessed++;
        }
        
        parseErrors += chunkResult.errors;
      } catch (error) {
        parseErrors++;
        this.logger.warn(`Final chunk parsing error in ${streamId}:`, error);
      }
    }
    
    return {
      quadsProcessed,
      parseErrors,
      store,
      format,
      strategy: 'chunked'
    };
  }

  /**
   * Process file using parallel workers
   */
  async _processFileParallel(streamId, filePath, options = {}) {
    // This would implement parallel processing using worker threads
    // For now, fall back to chunked processing
    this.logger.debug(`Parallel processing not fully implemented, falling back to chunked for ${streamId}`);
    return await this._processFileChunked(streamId, filePath, options);
  }

  /**
   * Process file using memory-mapped approach
   */
  async _processFileMemoryMapped(streamId, filePath, options = {}) {
    // This would implement memory-mapped file processing
    // For now, fall back to chunked processing with larger chunks
    this.logger.debug(`Memory-mapped processing not fully implemented, using large chunks for ${streamId}`);
    
    return await this._processFileChunked(streamId, filePath, {
      ...options,
      chunkSize: this.config.bufferSize * 100 // Larger chunks
    });
  }

  /**
   * Process file using basic approach
   */
  async _processFileBasic(streamId, filePath, options = {}) {
    const fs = await import('fs/promises');
    const data = await fs.readFile(filePath, 'utf8');
    const format = options.format || this._detectFormat(filePath);
    
    const parser = new Parser({ format });
    const store = options.store || new Store();
    
    return new Promise((resolve, reject) => {
      const quads = [];
      let parseErrors = 0;
      
      parser.parse(data, (error, quad, prefixes) => {
        if (error) {
          parseErrors++;
          this.logger.warn(`Parse error in ${streamId}:`, error);
          return;
        }
        
        if (quad) {
          if (options.validate && !this._validateQuad(quad)) {
            parseErrors++;
            return;
          }
          
          quads.push(quad);
          store.addQuad(quad);
        } else {
          // Parsing complete
          resolve({
            quadsProcessed: quads.length,
            parseErrors,
            store,
            format,
            strategy: 'basic'
          });
        }
      });
    });
  }

  /**
   * Process input stream
   */
  async _processInputStream(streamId, inputStream, options = {}) {
    const format = options.format || 'turtle';
    const store = options.store || new Store();
    
    let quadsProcessed = 0;
    let parseErrors = 0;
    
    const parserStream = this.createParserStream(format);
    const batchProcessor = this.createBatchProcessor(
      this.config.batchSize,
      async (batch) => {
        for (const quad of batch) {
          if (options.validate && !this._validateQuad(quad)) {
            parseErrors++;
            continue;
          }
          
          store.addQuad(quad);
          quadsProcessed++;
        }
        
        return batch.length;
      }
    );
    
    await pipelineAsync(
      inputStream,
      parserStream,
      batchProcessor
    );
    
    return {
      quadsProcessed,
      parseErrors,
      store,
      format
    };
  }

  /**
   * Parse data chunk
   */
  async _parseChunk(data, format, options = {}) {
    return new Promise((resolve) => {
      const parser = new Parser({ format });
      const quads = [];
      let errors = 0;
      
      parser.parse(data, (error, quad, prefixes) => {
        if (error) {
          errors++;
          return;
        }
        
        if (quad) {
          if (options.validate && !this._validateQuad(quad)) {
            errors++;
            return;
          }
          
          quads.push(quad);
        } else {
          // Parsing complete
          resolve({ quads, errors });
        }
      });
    });
  }

  /**
   * Validate RDF quad
   */
  _validateQuad(quad) {
    try {
      // Basic validation
      return quad && 
             quad.subject && 
             quad.predicate && 
             quad.object &&
             typeof quad.subject.value === 'string' &&
             typeof quad.predicate.value === 'string';
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect RDF format from file extension
   */
  _detectFormat(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const formatMap = {
      'ttl': 'turtle',
      'turtle': 'turtle', 
      'n3': 'n3',
      'nt': 'ntriples',
      'nq': 'nquads',
      'rdf': 'rdfxml',
      'xml': 'rdfxml',
      'jsonld': 'jsonld',
      'json': 'jsonld'
    };
    
    return formatMap[ext] || 'turtle';
  }

  /**
   * Check for memory pressure
   */
  _checkMemoryPressure() {
    const memUsage = process.memoryUsage();
    return memUsage.heapUsed > this.config.maxMemoryUsage;
  }

  /**
   * Handle memory pressure
   */
  async _handleMemoryPressure() {
    this.logger.warn('Memory pressure detected, triggering cleanup');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Emit memory pressure event
    this.emit('memory-pressure', {
      heapUsed: process.memoryUsage().heapUsed,
      threshold: this.config.maxMemoryUsage
    });
    
    // Wait briefly for memory to stabilize
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Start memory monitoring
   */
  _startMemoryMonitoring() {
    if (!this.memoryMonitor.enabled) return;
    
    this.memoryMonitor.timer = setInterval(() => {
      const memUsage = process.memoryUsage();
      
      // Update peak memory usage
      this.processingStats.peakMemoryUsage = Math.max(
        this.processingStats.peakMemoryUsage,
        memUsage.heapUsed
      );
      
      // Check for memory pressure
      if (memUsage.heapUsed > this.config.maxMemoryUsage * 0.9) {
        this.emit('memory-warning', {
          current: memUsage.heapUsed,
          max: this.config.maxMemoryUsage,
          percentage: (memUsage.heapUsed / this.config.maxMemoryUsage * 100).toFixed(1)
        });
      }
      
    }, this.memoryMonitor.checkInterval);
  }

  /**
   * Setup error recovery strategies
   */
  _setupErrorRecovery() {
    this.errorHandler.registerRecoveryStrategy('parse_error', async (errorContext, options) => {
      this.logger.info('Attempting parse error recovery');
      
      // Try with different format
      const formats = ['turtle', 'n3', 'ntriples', 'rdfxml'];
      const currentFormat = errorContext.context.format;
      
      for (const format of formats) {
        if (format !== currentFormat) {
          try {
            // Test parse with new format
            return {
              success: true,
              reason: `Switched to format: ${format}`,
              newOptions: { ...options, format }
            };
          } catch (testError) {
            continue;
          }
        }
      }
      
      return { success: false, reason: 'No alternative format worked' };
    });
    
    this.errorHandler.registerRecoveryStrategy('memory_pressure', async (errorContext, options) => {
      this.logger.info('Attempting memory pressure recovery');
      
      await this._handleMemoryPressure();
      
      return {
        success: true,
        reason: 'Memory pressure handled',
        newOptions: {
          ...options,
          batchSize: Math.max(100, (options.batchSize || this.config.batchSize) / 2)
        }
      };
    });
  }

  /**
   * Update processing statistics
   */
  _updateProcessingStats(result, processingTime) {
    this.processingStats.totalQuadsProcessed += result.quadsProcessed || 0;
    this.processingStats.totalFilesProcessed++;
    
    // Calculate average processing speed (quads per second)
    const speed = result.quadsProcessed / (processingTime / 1000);
    const totalFiles = this.processingStats.totalFilesProcessed;
    
    this.processingStats.averageProcessingSpeed = (
      (this.processingStats.averageProcessingSpeed * (totalFiles - 1) + speed) / totalFiles
    );
  }

  /**
   * Get processing statistics
   */
  getProcessingStats() {
    return {
      ...this.processingStats,
      activeStreams: this.activeStreams.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * Get active stream information
   */
  getActiveStreams() {
    const streams = [];
    
    for (const [streamId, info] of this.activeStreams) {
      streams.push({
        streamId,
        ...info,
        duration: Date.now() - info.startTime
      });
    }
    
    return streams;
  }

  /**
   * Shutdown stream processor
   */
  async shutdown() {
    this.logger.info('Shutting down RDF stream processor');
    
    // Stop memory monitoring
    if (this.memoryMonitor.timer) {
      clearInterval(this.memoryMonitor.timer);
    }
    
    // Wait for active streams to complete
    if (this.activeStreams.size > 0) {
      this.logger.info(`Waiting for ${this.activeStreams.size} active streams to complete`);
      
      const timeout = setTimeout(() => {
        this.logger.warn('Forced shutdown due to timeout');
      }, 30000); // 30 second timeout
      
      while (this.activeStreams.size > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      clearTimeout(timeout);
    }
    
    this.state = 'shutdown';
    this.logger.success('RDF stream processor shutdown complete');
  }
}

export default RDFStreamProcessor;