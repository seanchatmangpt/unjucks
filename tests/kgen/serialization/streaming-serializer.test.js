/**
 * Streaming Turtle Serializer Test Suite
 * 
 * Tests for high-performance streaming serialization including
 * memory efficiency, backpressure handling, and large dataset processing.
 */

import { strict as assert } from 'assert';
import { Readable, Writable } from 'stream';
import { DataFactory } from 'n3';
import { StreamingTurtleSerializer } from '../../../src/kgen/serialization/streaming-serializer.js';

const { namedNode, literal, quad } = DataFactory;

describe('StreamingTurtleSerializer', function() {
  let serializer;
  
  beforeEach(function() {
    serializer = new StreamingTurtleSerializer({
      chunkSize: 100, // Small chunk size for testing
      enableProgressReporting: true,
      enableIntegrityCheck: true
    });
  });

  describe('Stream Creation', function() {
    it('should create serializer stream', function() {
      const stream = serializer.createSerializerStream();
      
      assert(stream);
      assert.equal(stream.constructor.name, 'Transform');
    });
    
    it('should handle object mode correctly', function() {
      const stream = serializer.createSerializerStream();
      
      assert(stream._readableState.objectMode);
    });
  });

  describe('Streaming Serialization', function() {
    it('should serialize stream of quads', async function() {
      const quads = [];
      for (let i = 0; i < 250; i++) {
        quads.push(quad(
          namedNode(`http://example.org/subj${i}`),
          namedNode(`http://example.org/pred${i % 10}`),
          literal(`value${i}`)
        ));
      }
      
      const inputStream = new Readable({
        objectMode: true,
        read() {
          quads.forEach(q => this.push(q));
          this.push(null);
        }
      });
      
      let output = '';
      const outputStream = new Writable({
        write(chunk, encoding, callback) {
          output += chunk.toString();
          callback();
        }
      });
      
      const result = await serializer.serializeStream(inputStream, outputStream);
      
      assert(result.totalQuads >= 250);
      assert(result.chunksProcessed >= 3); // Should be split into chunks
      assert(result.integrityHash);
      assert(output.length > 0);
      assert(output.includes('@prefix'));
    });
    
    it('should handle empty stream', async function() {
      const inputStream = new Readable({
        objectMode: true,
        read() {
          this.push(null);
        }
      });
      
      let output = '';
      const outputStream = new Writable({
        write(chunk, encoding, callback) {
          output += chunk.toString();
          callback();
        }
      });
      
      const result = await serializer.serializeStream(inputStream, outputStream);
      
      assert.equal(result.totalQuads, 0);
      assert(result.chunksProcessed >= 0);
    });
  });

  describe('Progress Reporting', function() {
    it('should emit progress events', function(done) {
      const quads = [];
      for (let i = 0; i < 500; i++) {
        quads.push(quad(
          namedNode(`http://example.org/subj${i}`),
          namedNode(`http://example.org/pred`),
          literal(`value${i}`)
        ));
      }
      
      const inputStream = new Readable({
        objectMode: true,
        read() {
          quads.forEach(q => this.push(q));
          this.push(null);
        }
      });
      
      const outputStream = new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      });
      
      let progressEvents = 0;
      serializer.on('progress', (progress) => {
        progressEvents++;
        assert(typeof progress.quadsProcessed === 'number');
        assert(typeof progress.chunksProcessed === 'number');
        assert(typeof progress.elapsedTime === 'number');
      });
      
      serializer.serializeStream(inputStream, outputStream).then(() => {
        assert(progressEvents > 0);
        done();
      }).catch(done);
    });
  });

  describe('Integrity Checking', function() {
    it('should generate integrity hash', async function() {
      const quads = [
        quad(namedNode('http://example.org/subj'), namedNode('http://example.org/pred'), literal('value'))
      ];
      
      const inputStream = new Readable({
        objectMode: true,
        read() {
          quads.forEach(q => this.push(q));
          this.push(null);
        }
      });
      
      const outputStream = new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      });
      
      const result = await serializer.serializeStream(inputStream, outputStream);
      
      assert(result.integrityHash);
      assert.equal(result.integrityHash.length, 64); // SHA-256 hex length
    });
  });

  describe('Chunk Processing', function() {
    it('should process data in chunks', async function() {
      const quads = [];
      for (let i = 0; i < 300; i++) {
        quads.push(quad(
          namedNode(`http://example.org/subj${i}`),
          namedNode(`http://example.org/pred`),
          literal(`value${i}`)
        ));
      }
      
      const inputStream = new Readable({
        objectMode: true,
        read() {
          quads.forEach(q => this.push(q));
          this.push(null);
        }
      });
      
      const chunks = [];
      const outputStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk.toString());
          callback();
        }
      });
      
      const result = await serializer.serializeStream(inputStream, outputStream);
      
      assert(result.chunksProcessed >= 3); // 300 quads / 100 chunk size
      assert(chunks.length >= 3);
      
      // Each chunk should contain metadata
      chunks.forEach(chunk => {
        if (chunk.includes('Chunk')) {
          assert(chunk.includes('# Chunk'));
          assert(chunk.includes('quads'));
        }
      });
    });
    
    it('should add chunk metadata', async function() {
      const quads = [];
      for (let i = 0; i < 150; i++) {
        quads.push(quad(
          namedNode(`http://example.org/subj${i}`),
          namedNode(`http://example.org/pred`),
          literal(`value${i}`)
        ));
      }
      
      const inputStream = new Readable({
        objectMode: true,
        read() {
          quads.forEach(q => this.push(q));
          this.push(null);
        }
      });
      
      let output = '';
      const outputStream = new Writable({
        write(chunk, encoding, callback) {
          output += chunk.toString();
          callback();
        }
      });
      
      await serializer.serializeStream(inputStream, outputStream);
      
      assert(output.includes('# Chunk'));
      assert(output.includes('# Streaming serialization complete'));
    });
  });

  describe('Error Handling', function() {
    it('should handle stream errors', function(done) {
      const inputStream = new Readable({
        objectMode: true,
        read() {
          this.emit('error', new Error('Stream error'));
        }
      });
      
      const outputStream = new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      });
      
      serializer.serializeStream(inputStream, outputStream)
        .then(() => {
          done(new Error('Should have thrown error'));
        })
        .catch(error => {
          assert(error.message.includes('Stream error'));
          done();
        });
    });
    
    it('should handle processing errors', function(done) {
      const invalidQuad = { invalid: 'quad' };
      
      const inputStream = new Readable({
        objectMode: true,
        read() {
          this.push(invalidQuad);
          this.push(null);
        }
      });
      
      const outputStream = new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      });
      
      serializer.serializeStream(inputStream, outputStream)
        .then(() => {
          done(new Error('Should have thrown error'));
        })
        .catch(error => {
          assert(error instanceof Error);
          done();
        });
    });
  });

  describe('Memory Management', function() {
    it('should track memory usage', async function() {
      const quads = [];
      for (let i = 0; i < 200; i++) {
        quads.push(quad(
          namedNode(`http://example.org/subj${i}`),
          namedNode(`http://example.org/pred`),
          literal(`value${i}`)
        ));
      }
      
      const inputStream = new Readable({
        objectMode: true,
        read() {
          quads.forEach(q => this.push(q));
          this.push(null);
        }
      });
      
      const outputStream = new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      });
      
      const initialMemory = process.memoryUsage().heapUsed;
      await serializer.serializeStream(inputStream, outputStream);
      const finalMemory = process.memoryUsage().heapUsed;
      
      const stats = serializer.getStatistics();
      assert(stats.memoryPeak >= initialMemory);
      assert(stats.totalQuads === 200);
    });
  });

  describe('Performance', function() {
    it('should handle large datasets efficiently', async function() {
      this.timeout(10000); // 10 second timeout for large dataset
      
      const quads = [];
      for (let i = 0; i < 5000; i++) {
        quads.push(quad(
          namedNode(`http://example.org/subj${i}`),
          namedNode(`http://example.org/pred${i % 100}`),
          literal(`value${i}`)
        ));
      }
      
      const inputStream = new Readable({
        objectMode: true,
        read() {
          quads.forEach(q => this.push(q));
          this.push(null);
        }
      });
      
      const outputStream = new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      });
      
      const startTime = this.getDeterministicTimestamp();
      const result = await serializer.serializeStream(inputStream, outputStream);
      const processingTime = this.getDeterministicTimestamp() - startTime;
      
      assert.equal(result.totalQuads, 5000);
      assert(processingTime < 5000); // Should complete within 5 seconds
      assert(result.averageQuadsPerSecond > 1000); // At least 1000 quads/second
    });
  });

  describe('Compression Support', function() {
    it('should create compressed stream', function() {
      const compressedStream = serializer.createCompressedStream('gzip');
      
      assert(compressedStream);
      // Should be a transform stream with compression
    });
  });

  describe('Statistics', function() {
    it('should provide accurate statistics', function() {
      const stats = serializer.getStatistics();
      
      assert(typeof stats.totalQuads === 'number');
      assert(typeof stats.chunksProcessed === 'number');
      assert(typeof stats.bytesWritten === 'number');
      assert(typeof stats.memoryPeak === 'number');
      assert(stats.state === 'ready');
    });
    
    it('should update statistics during processing', async function() {
      const quads = [
        quad(namedNode('http://example.org/subj'), namedNode('http://example.org/pred'), literal('value'))
      ];
      
      const inputStream = new Readable({
        objectMode: true,
        read() {
          quads.forEach(q => this.push(q));
          this.push(null);
        }
      });
      
      const outputStream = new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      });
      
      const initialStats = serializer.getStatistics();
      await serializer.serializeStream(inputStream, outputStream);
      const finalStats = serializer.getStatistics();
      
      assert(finalStats.totalQuads > initialStats.totalQuads);
      assert(finalStats.bytesWritten > initialStats.bytesWritten);
    });
  });

  describe('Configuration', function() {
    it('should respect chunk size configuration', async function() {
      const customSerializer = new StreamingTurtleSerializer({
        chunkSize: 50
      });
      
      const quads = [];
      for (let i = 0; i < 200; i++) {
        quads.push(quad(
          namedNode(`http://example.org/subj${i}`),
          namedNode(`http://example.org/pred`),
          literal(`value${i}`)
        ));
      }
      
      const inputStream = new Readable({
        objectMode: true,
        read() {
          quads.forEach(q => this.push(q));
          this.push(null);
        }
      });
      
      const outputStream = new Writable({
        write(chunk, encoding, callback) {
          callback();
        }
      });
      
      const result = await customSerializer.serializeStream(inputStream, outputStream);
      
      // Should create more chunks with smaller chunk size
      assert(result.chunksProcessed >= 4); // 200 quads / 50 chunk size
    });
  });
});

export default {
  description: 'Streaming Turtle Serializer Tests',
  testCount: 15,
  categories: [
    'stream-creation',
    'streaming-serialization',
    'progress-reporting',
    'integrity-checking',
    'chunk-processing',
    'error-handling',
    'memory-management',
    'performance',
    'compression',
    'statistics'
  ]
};