/**
 * Performance Validation Test Suite
 * 
 * Comprehensive tests for RDF/SPARQL optimization components including
 * graph diff algorithms, compliance processing, streaming, and metrics collection.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { GraphDiffOptimizer } from '../../../src/kgen/provenance/performance/graph-diff-optimizer.js';
import { ComplianceOptimizer } from '../../../src/kgen/provenance/performance/compliance-optimizer.js';
import { GraphProcessingMetricsCollector } from '../../../src/kgen/provenance/performance/metrics-collector.js';
import { RDFStreamProcessor } from '../../../src/kgen/provenance/performance/rdf-stream-processor.js';
import { Store, DataFactory, Parser, Writer } from 'n3';
import { Readable } from 'stream';

const { namedNode, literal, quad } = DataFactory;

describe('Performance Optimization Suite', () => {
  let graphDiffOptimizer;
  let complianceOptimizer;
  let metricsCollector;
  let streamProcessor;

  beforeEach(async () => {
    graphDiffOptimizer = new GraphDiffOptimizer({
      batchSize: 100,
      maxMemoryUsage: 10 * 1024 * 1024, // 10MB for tests
      enableStreaming: true,
      enableIndexing: true
    });

    complianceOptimizer = new ComplianceOptimizer({
      enableParallelProcessing: false, // Disable for tests
      batchSize: 50,
      smartCachingEnabled: true
    });
    
    await complianceOptimizer.initialize();

    metricsCollector = new GraphProcessingMetricsCollector({
      enableRealTimeMetrics: false, // Disable for tests
      aggregationInterval: 0, // Disable periodic aggregation
      exportMetrics: false
    });
    
    await metricsCollector.initialize();

    streamProcessor = new RDFStreamProcessor({
      maxMemoryUsage: 5 * 1024 * 1024, // 5MB for tests
      batchSize: 50,
      enableParallelParsing: false
    });
    
    await streamProcessor.initialize();
  });

  afterEach(async () => {
    if (complianceOptimizer) {
      await complianceOptimizer.shutdown();
    }
    if (metricsCollector) {
      await metricsCollector.shutdown();
    }
    if (streamProcessor) {
      await streamProcessor.shutdown();
    }
  });

  describe('GraphDiffOptimizer', () => {
    it('should compute basic diff correctly', async () => {
      const graphA = new Store([
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p1'), literal('value1')),
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p2'), literal('value2'))
      ]);

      const graphB = new Store([
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p1'), literal('value1')),
        quad(namedNode('http://example.org/s3'), namedNode('http://example.org/p3'), literal('value3'))
      ]);

      const diff = await graphDiffOptimizer.computeGraphDiff(graphA, graphB);

      expect(diff).toBeDefined();
      expect(diff.added).toHaveLength(1);
      expect(diff.removed).toHaveLength(1);
      expect(diff.metadata.strategy).toBeDefined();
    });

    it('should handle large graph diffs with streaming', async () => {
      // Create large graphs for streaming test
      const quadsA = [];
      const quadsB = [];

      for (let i = 0; i < 1000; i++) {
        quadsA.push(quad(
          namedNode(`http://example.org/s${i}`),
          namedNode('http://example.org/p'),
          literal(`value${i}`)
        ));
        
        // Create overlap with some differences
        if (i < 800) {
          quadsB.push(quad(
            namedNode(`http://example.org/s${i}`),
            namedNode('http://example.org/p'),
            literal(`value${i}`)
          ));
        }
        
        if (i >= 700) {
          quadsB.push(quad(
            namedNode(`http://example.org/new${i}`),
            namedNode('http://example.org/p'),
            literal(`newvalue${i}`)
          ));
        }
      }

      const graphA = new Store(quadsA);
      const graphB = new Store(quadsB);

      const startTime = Date.now();
      const diff = await graphDiffOptimizer.computeGraphDiff(graphA, graphB, {
        strategy: 'streaming'
      });
      const executionTime = Date.now() - startTime;

      expect(diff).toBeDefined();
      expect(diff.added.length).toBeGreaterThan(0);
      expect(diff.removed.length).toBeGreaterThan(0);
      expect(diff.metadata.strategy).toBe('streaming');
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Large diff completed in ${executionTime}ms: ${diff.added.length} added, ${diff.removed.length} removed`);
    });

    it('should use caching for repeated diffs', async () => {
      const graphA = new Store([
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p1'), literal('value1'))
      ]);

      const graphB = new Store([
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p2'), literal('value2'))
      ]);

      // First diff
      const diff1 = await graphDiffOptimizer.computeGraphDiff(graphA, graphB);
      
      // Second diff should be faster due to caching
      const startTime = Date.now();
      const diff2 = await graphDiffOptimizer.computeGraphDiff(graphA, graphB);
      const executionTime = Date.now() - startTime;

      expect(diff1).toEqual(diff2);
      expect(executionTime).toBeLessThan(10); // Should be very fast due to cache
    });

    it('should provide performance statistics', () => {
      const stats = graphDiffOptimizer.getPerformanceStats();

      expect(stats).toBeDefined();
      expect(typeof stats.diffsComputed).toBe('number');
      expect(typeof stats.totalQuadsCompared).toBe('number');
      expect(typeof stats.cacheHitRate).toBe('number');
      expect(typeof stats.currentMemoryUsage).toBe('number');
    });
  });

  describe('ComplianceOptimizer', () => {
    const createTestEvents = (count = 100) => {
      const events = [];
      
      for (let i = 0; i < count; i++) {
        events.push({
          id: `event-${i}`,
          type: i % 3 === 0 ? 'data_processing' : 'data_access',
          timestamp: new Date(),
          data: {
            dataTypes: ['personal_data'],
            legalBasis: i % 2 === 0 ? 'consent' : 'legitimate_interest',
            consentId: i % 2 === 0 ? `consent-${i}` : null,
            consentValid: i % 2 === 0 ? i % 4 !== 0 : null // Some invalid consents
          }
        });
      }
      
      return events;
    };

    it('should process GDPR compliance events', async () => {
      const events = createTestEvents(50);
      
      const startTime = Date.now();
      const results = await complianceOptimizer.processComplianceEvents(events, 'GDPR');
      const executionTime = Date.now() - startTime;

      expect(results).toBeDefined();
      expect(results.processed).toBe(50);
      expect(results.violations).toBeDefined();
      expect(results.warnings).toBeDefined();
      expect(results.compliant).toBeDefined();
      expect(results.metadata).toBeDefined();
      expect(results.metadata.framework).toBe('GDPR');

      console.log(`GDPR compliance processing completed in ${executionTime}ms`);
      console.log(`Results: ${results.violations.length} violations, ${results.warnings.length} warnings, ${results.compliant.length} compliant`);
    });

    it('should handle large compliance datasets efficiently', async () => {
      const events = createTestEvents(1000);
      
      const startTime = Date.now();
      const results = await complianceOptimizer.processComplianceEvents(events, 'ALL', {
        strategy: 'batch'
      });
      const executionTime = Date.now() - startTime;

      expect(results.processed).toBe(1000);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Large compliance dataset (1000 events) processed in ${executionTime}ms`);
    });

    it('should use smart caching for repeated patterns', async () => {
      // Create events with repeated patterns
      const events = [];
      for (let i = 0; i < 100; i++) {
        events.push({
          type: 'data_processing',
          data: {
            dataTypes: ['personal_data'],
            legalBasis: 'consent',
            consentId: 'consent-123',
            consentValid: true
          }
        });
      }

      const startTime = Date.now();
      const results = await complianceOptimizer.processComplianceEvents(events, 'GDPR', {
        strategy: 'cached'
      });
      const executionTime = Date.now() - startTime;

      expect(results.processed).toBe(100);
      expect(results.cacheHits).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(1000); // Should be fast due to caching

      console.log(`Cached compliance processing: ${results.cacheHits} cache hits in ${executionTime}ms`);
    });

    it('should provide performance statistics', () => {
      const stats = complianceOptimizer.getPerformanceStats();

      expect(stats).toBeDefined();
      expect(typeof stats.rulesProcessed).toBe('number');
      expect(typeof stats.totalEvents).toBe('number');
      expect(typeof stats.avgProcessingTime).toBe('number');
      expect(typeof stats.violationsDetected).toBe('number');
    });
  });

  describe('GraphProcessingMetricsCollector', () => {
    it('should record SPARQL query metrics', () => {
      const queryData = {
        query: 'SELECT * WHERE { ?s ?p ?o }',
        executionTime: 150,
        resultCount: 42,
        queryType: 'SELECT',
        complexity: { score: 0.3 },
        cacheHit: false,
        error: false
      };

      metricsCollector.recordSPARQLQuery(queryData);
      
      const summary = metricsCollector.getMetricsSummary();
      
      expect(summary.sparqlQueries.total).toBe(1);
      expect(summary.sparqlQueries.averageTime).toBe(150);
      expect(summary.sparqlQueries.errorRate).toBe(0);
    });

    it('should track performance trends over multiple queries', () => {
      // Record multiple queries with varying performance
      for (let i = 0; i < 10; i++) {
        metricsCollector.recordSPARQLQuery({
          query: `SELECT * WHERE { ?s ?p ?o } LIMIT ${i * 100}`,
          executionTime: 100 + i * 50,
          resultCount: i * 100,
          queryType: 'SELECT',
          cacheHit: i % 3 === 0
        });
      }

      const summary = metricsCollector.getMetricsSummary();
      const detailed = metricsCollector.getDetailedMetrics();

      expect(summary.sparqlQueries.total).toBe(10);
      expect(summary.sparqlQueries.averageTime).toBeGreaterThan(100);
      expect(detailed.trends).toBeDefined();

      console.log(`Query metrics: avg ${summary.sparqlQueries.averageTime}ms, cache hit rate ${(summary.sparqlQueries.cacheHitRate * 100).toFixed(1)}%`);
    });

    it('should record graph processing metrics', () => {
      const processingData = {
        graphSize: 1000,
        quadsProcessed: 1000,
        parseTime: 250,
        format: 'turtle',
        error: false
      };

      metricsCollector.recordGraphProcessing(processingData);
      
      const summary = metricsCollector.getMetricsSummary();
      
      expect(summary.graphProcessing.total).toBe(1);
      expect(summary.graphProcessing.averageSize).toBe(1000);
      expect(summary.graphProcessing.averageParseTime).toBe(250);
    });

    it('should track compliance processing metrics', () => {
      const complianceData = {
        eventsProcessed: 100,
        rulesEvaluated: 300,
        violations: [
          { type: 'consent_missing', severity: 'high' },
          { type: 'data_retention', severity: 'medium' }
        ],
        warnings: [],
        framework: 'GDPR',
        executionTime: 500
      };

      metricsCollector.recordComplianceProcessing(complianceData);
      
      const summary = metricsCollector.getMetricsSummary();
      
      expect(summary.compliance.totalEvents).toBe(100);
      expect(summary.compliance.violations).toBe(2);
      expect(summary.compliance.violationRate).toBe(0.02);
    });

    it('should provide comprehensive metrics summary', () => {
      // Record various metrics
      metricsCollector.recordSPARQLQuery({
        executionTime: 200,
        queryType: 'SELECT',
        cacheHit: true
      });

      metricsCollector.recordGraphProcessing({
        graphSize: 500,
        parseTime: 100,
        format: 'turtle'
      });

      const summary = metricsCollector.getMetricsSummary();
      
      expect(summary).toBeDefined();
      expect(summary.timestamp).toBeDefined();
      expect(summary.system).toBeDefined();
      expect(summary.sparqlQueries).toBeDefined();
      expect(summary.graphProcessing).toBeDefined();
    });
  });

  describe('RDFStreamProcessor', () => {
    const createTestTurtleData = (tripleCount = 100) => {
      const prefixes = '@prefix ex: <http://example.org/> .\n\n';
      let data = prefixes;
      
      for (let i = 0; i < tripleCount; i++) {
        data += `ex:subject${i} ex:predicate ex:object${i} .\n`;
      }
      
      return data;
    };

    it('should process RDF stream correctly', async () => {
      const testData = createTestTurtleData(50);
      const inputStream = Readable.from([testData]);
      
      const startTime = Date.now();
      const result = await streamProcessor.processStream(inputStream, {
        format: 'turtle'
      });
      const executionTime = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.quadsProcessed).toBe(50);
      expect(result.parseErrors).toBe(0);
      expect(result.store).toBeInstanceOf(Store);

      console.log(`Stream processing completed in ${executionTime}ms: ${result.quadsProcessed} quads`);
    });

    it('should handle large RDF streams efficiently', async () => {
      const testData = createTestTurtleData(1000);
      const inputStream = Readable.from([testData]);
      
      const startTime = Date.now();
      const result = await streamProcessor.processStream(inputStream, {
        format: 'turtle',
        validate: true
      });
      const executionTime = Date.now() - startTime;

      expect(result.quadsProcessed).toBe(1000);
      expect(result.parseErrors).toBe(0);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Large stream processing: ${result.quadsProcessed} quads in ${executionTime}ms`);
    });

    it('should create parser and writer streams', () => {
      const parserStream = streamProcessor.createParserStream('turtle');
      const writerStream = streamProcessor.createWriterStream('turtle');
      
      expect(parserStream).toBeDefined();
      expect(parserStream._transform).toBeInstanceOf(Function);
      expect(writerStream).toBeDefined();
      expect(writerStream._transform).toBeInstanceOf(Function);
    });

    it('should handle memory pressure gracefully', async () => {
      // Create a large dataset that might trigger memory pressure
      const testData = createTestTurtleData(5000);
      const inputStream = Readable.from([testData]);
      
      let memoryWarningTriggered = false;
      streamProcessor.once('memory-warning', () => {
        memoryWarningTriggered = true;
      });
      
      const result = await streamProcessor.processStream(inputStream, {
        format: 'turtle'
      });

      expect(result.quadsProcessed).toBe(5000);
      // Memory warning may or may not be triggered depending on system
      console.log(`Memory warning triggered: ${memoryWarningTriggered}`);
    });

    it('should provide processing statistics', () => {
      const stats = streamProcessor.getProcessingStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalQuadsProcessed).toBe('number');
      expect(typeof stats.totalFilesProcessed).toBe('number');
      expect(typeof stats.averageProcessingSpeed).toBe('number');
      expect(typeof stats.activeStreams).toBe('number');
    });
  });

  describe('Integration Tests', () => {
    it('should coordinate metrics collection across all components', async () => {
      // Test comprehensive workflow with metrics collection
      const testData = '@prefix ex: <http://example.org/> .\nex:s ex:p ex:o .\n';
      const inputStream = Readable.from([testData]);
      
      // Process stream and collect metrics
      const operationId = 'test-operation-1';
      metricsCollector.startOperation(operationId, 'graph-processing');
      
      const streamResult = await streamProcessor.processStream(inputStream);
      
      const operationData = metricsCollector.endOperation(operationId, {
        quadsProcessed: streamResult.quadsProcessed,
        format: 'turtle'
      });
      
      expect(operationData).toBeDefined();
      expect(operationData.duration).toBeGreaterThan(0);
      
      // Check that metrics were recorded
      const summary = metricsCollector.getMetricsSummary();
      expect(summary.graphProcessing.total).toBeGreaterThan(0);
    });

    it('should handle error scenarios gracefully', async () => {
      // Test with invalid RDF data
      const invalidData = 'invalid rdf data that should cause parse errors';
      const inputStream = Readable.from([invalidData]);
      
      try {
        await streamProcessor.processStream(inputStream, { format: 'turtle' });
      } catch (error) {
        expect(error).toBeDefined();
        console.log(`Expected parse error handled: ${error.message}`);
      }
      
      // Check that error was recorded in stats
      const stats = streamProcessor.getProcessingStats();
      expect(stats.errors).toBeGreaterThan(0);
    });

    it('should maintain performance under load', async () => {
      const testEvents = [];
      
      // Create a realistic compliance workload
      for (let i = 0; i < 500; i++) {
        testEvents.push({
          type: i % 2 === 0 ? 'data_processing' : 'healthcare_access',
          data: {
            dataTypes: ['personal_data', 'phi'],
            legalBasis: 'consent',
            consentValid: i % 10 !== 0, // 10% invalid
            justification: 'medical_treatment'
          }
        });
      }
      
      const startTime = Date.now();
      
      // Process compliance events
      const complianceResults = await complianceOptimizer.processComplianceEvents(
        testEvents, 
        'ALL', 
        { strategy: 'batch' }
      );
      
      const executionTime = Date.now() - startTime;
      
      expect(complianceResults.processed).toBe(500);
      expect(executionTime).toBeLessThan(15000); // Should complete within 15 seconds
      
      console.log(`Load test completed: 500 events processed in ${executionTime}ms`);
      console.log(`Performance: ${(500 / (executionTime / 1000)).toFixed(0)} events/sec`);
      
      // Verify performance is acceptable
      const eventsPerSecond = 500 / (executionTime / 1000);
      expect(eventsPerSecond).toBeGreaterThan(10); // At least 10 events per second
    });
  });
});

/**
 * Performance Benchmarking Utilities
 */
export class PerformanceBenchmark {
  constructor() {
    this.results = [];
  }

  async benchmark(name, fn, iterations = 10) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = process.hrtime.bigint();
      await fn();
      const endTime = process.hrtime.bigint();
      
      times.push(Number(endTime - startTime) / 1000000); // Convert to milliseconds
    }
    
    const result = {
      name,
      iterations,
      totalTime: times.reduce((a, b) => a + b, 0),
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      standardDeviation: this._calculateStandardDeviation(times)
    };
    
    this.results.push(result);
    return result;
  }

  _calculateStandardDeviation(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  generateReport() {
    console.log('\n=== Performance Benchmark Report ===\n');
    
    for (const result of this.results) {
      console.log(`${result.name}:`);
      console.log(`  Iterations: ${result.iterations}`);
      console.log(`  Average: ${result.averageTime.toFixed(2)}ms`);
      console.log(`  Min: ${result.minTime.toFixed(2)}ms`);
      console.log(`  Max: ${result.maxTime.toFixed(2)}ms`);
      console.log(`  Std Dev: ${result.standardDeviation.toFixed(2)}ms`);
      console.log('');
    }
  }
}