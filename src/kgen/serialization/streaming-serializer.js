/**
 * Streaming Turtle Serializer
 * 
 * High-performance streaming serialization for massive RDF graphs
 * with memory-efficient processing and real-time output generation.
 */

import { Transform, Readable, Writable } from 'stream';
import { Writer, DataFactory } from 'n3';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import consola from 'consola';

export class StreamingTurtleSerializer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      chunkSize: 10000,
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      enableBackpressure: true,
      compressionLevel: 6,
      outputFormat: 'turtle',
      
      // Streaming-specific settings
      enableProgressReporting: true,
      progressInterval: 5000,
      enableIntegrityCheck: true,
      bufferSize: 64 * 1024,
      
      ...config
    };
    
    this.logger = consola.withTag('streaming-serializer');
    this.statistics = {
      totalQuads: 0,
      chunksProcessed: 0,
      bytesWritten: 0,
      memoryPeak: 0,
      processingTime: 0
    };
    
    this.state = 'ready';
    this.currentChunk = [];
    this.hashStream = crypto.createHash('sha256');
  }

  /**
   * Create a streaming serializer transform
   */
  createSerializerStream(options = {}) {
    const self = this;
    
    return new Transform({
      objectMode: true,
      highWaterMark: this.config.chunkSize,
      
      transform(quad, encoding, callback) {
        self._processQuad(quad, this, callback);
      },
      
      flush(callback) {
        self._flushFinalChunk(this, callback);
      }
    });
  }

  /**
   * Serialize a readable stream of quads
   */
  async serializeStream(inputStream, outputStream, options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = this.getDeterministicTimestamp();
      let totalQuads = 0;
      
      const serializerStream = this.createSerializerStream(options);
      
      // Setup progress reporting
      if (this.config.enableProgressReporting) {
        const progressInterval = setInterval(() => {
          this.emit('progress', {
            quadsProcessed: totalQuads,
            chunksProcessed: this.statistics.chunksProcessed,
            memoryUsage: process.memoryUsage(),
            elapsedTime: this.getDeterministicTimestamp() - startTime
          });
        }, this.config.progressInterval);
        
        serializerStream.on('finish', () => clearInterval(progressInterval));
      }
      
      // Track statistics
      serializerStream.on('data', (chunk) => {
        totalQuads += chunk.quadCount || 0;
        this.statistics.bytesWritten += Buffer.byteLength(chunk, 'utf8');
        
        if (this.config.enableIntegrityCheck) {
          this.hashStream.update(chunk);
        }
      });
      
      // Handle completion
      serializerStream.on('finish', () => {
        const processingTime = this.getDeterministicTimestamp() - startTime;
        
        const result = {
          totalQuads,
          processingTime,
          bytesWritten: this.statistics.bytesWritten,
          chunksProcessed: this.statistics.chunksProcessed,
          integrityHash: this.config.enableIntegrityCheck ? 
            this.hashStream.digest('hex') : null,
          averageQuadsPerSecond: totalQuads / (processingTime / 1000)
        };
        
        this.emit('streaming:complete', result);
        resolve(result);
      });
      
      // Handle errors
      serializerStream.on('error', reject);
      inputStream.on('error', reject);
      outputStream.on('error', reject);
      
      // Setup pipeline
      inputStream
        .pipe(serializerStream)
        .pipe(outputStream);
    });
  }

  /**
   * Create a compressed streaming serializer
   */
  createCompressedStream(compressionType = 'gzip') {
    const zlib = import('zlib');
    
    const compressStream = compressionType === 'gzip' ?
      zlib.createGzip({ level: this.config.compressionLevel }) :
      zlib.createDeflate({ level: this.config.compressionLevel });
    
    const serializerStream = this.createSerializerStream();
    
    return serializerStream.pipe(compressStream);
  }

  // Private methods

  _processQuad(quad, stream, callback) {
    try {
      this.currentChunk.push(quad);
      
      // Check if chunk is full
      if (this.currentChunk.length >= this.config.chunkSize) {
        this._serializeChunk(stream, callback);
      } else {
        callback();
      }
      
    } catch (error) {
      callback(error);
    }
  }

  _serializeChunk(stream, callback) {
    if (this.currentChunk.length === 0) {
      return callback();
    }
    
    try {
      const writer = new Writer({ format: this.config.outputFormat });
      
      writer.addQuads(this.currentChunk);
      writer.end((error, turtleChunk) => {
        if (error) {
          return callback(error);
        }
        
        // Add chunk metadata
        const enrichedChunk = turtleChunk + `\n# Chunk ${this.statistics.chunksProcessed + 1}, ${this.currentChunk.length} quads\n`;
        
        this.statistics.chunksProcessed++;
        this.statistics.totalQuads += this.currentChunk.length;
        
        // Track memory usage
        const memUsage = process.memoryUsage().heapUsed;
        if (memUsage > this.statistics.memoryPeak) {
          this.statistics.memoryPeak = memUsage;
        }
        
        // Clear chunk
        this.currentChunk = [];
        
        // Check memory pressure
        if (this.config.enableBackpressure && memUsage > this.config.maxMemoryUsage) {
          this.emit('backpressure', { memoryUsage: memUsage });
        }
        
        stream.push(enrichedChunk);
        callback();
      });
      
    } catch (error) {
      callback(error);
    }
  }

  _flushFinalChunk(stream, callback) {
    if (this.currentChunk.length > 0) {
      this._serializeChunk(stream, (error) => {
        if (error) return callback(error);
        
        // Add final metadata
        const finalMetadata = `\n# Streaming serialization complete\n# Total chunks: ${this.statistics.chunksProcessed}\n# Total quads: ${this.statistics.totalQuads}\n`;
        stream.push(finalMetadata);
        callback();
      });
    } else {
      callback();
    }
  }

  /**
   * Get streaming statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      state: this.state,
      averageChunkSize: this.statistics.chunksProcessed > 0 ? 
        this.statistics.totalQuads / this.statistics.chunksProcessed : 0
    };
  }
}

export default StreamingTurtleSerializer;