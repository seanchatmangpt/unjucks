/**
 * KGEN Performance Benchmarks
 * Comprehensive performance testing and regression detection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KGenEngine } from '../../src/kgen/core/engine.js';
import { TestHelpers } from '../utils/test-helpers.js';
import fs from 'fs-extra';
import { resolve } from 'path';

describe('KGEN Performance Benchmarks', () => {
  let engine;
  let testHelpers;
  let performanceBaseline;

  beforeEach(async () => {
    testHelpers = new TestHelpers();
    engine = new KGenEngine({
      mode: 'test',
      enableDistributedReasoning: false,
      maxConcurrentOperations: 10
    });
    
    await engine.initialize();
    
    // Load performance baseline if exists
    performanceBaseline = await loadPerformanceBaseline();
  });

  afterEach(async () => {
    if (engine && engine.state !== 'shutdown') {
      await engine.shutdown();
    }
    await testHelpers.cleanup();
  });

  async function loadPerformanceBaseline() {
    const baselinePath = resolve(process.cwd(), 'test-results/performance-baseline.json');
    
    try {
      if (await fs.pathExists(baselinePath)) {
        return await fs.readJson(baselinePath);
      }
    } catch (error) {
      console.warn('Could not load performance baseline:', error.message);
    }
    
    return null;
  }

  async function savePerformanceBaseline(results) {
    const baselinePath = resolve(process.cwd(), 'test-results/performance-baseline.json');
    await fs.ensureDir(resolve(process.cwd(), 'test-results'));
    await fs.writeJson(baselinePath, results, { spaces: 2 });
  }

  describe('Ingestion Performance', () => {
    it('should ingest small RDF graphs efficiently', async () => {
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createSampleRDF('person', 'John Doe'),
          format: 'turtle'
        }
      ];

      const operation = () => engine.ingest(sources, { user: 'test-user' });
      const perfStats = await testHelpers.measurePerformance(operation, 10);

      expect(perfStats.successfulIterations).toBe(10);
      expect(perfStats.averageDuration).toBeLessThan(1000); // < 1 second
      expect(perfStats.standardDeviation).toBeLessThan(200); // Consistent performance

      // Check against baseline if available
      if (performanceBaseline?.ingestion?.small) {
        const baseline = performanceBaseline.ingestion.small;
        const regressionThreshold = 1.5; // 50% degradation threshold
        
        expect(perfStats.averageDuration).toBeLessThan(baseline.averageDuration * regressionThreshold);
      }
    });

    it('should handle medium-sized RDF graphs', async () => {
      const sources = Array.from({ length: 10 }, (_, i) => ({
        type: 'rdf',
        content: testHelpers.createSampleRDF('person', `Person ${i + 1}`, {
          department: `Department ${(i % 3) + 1}`,
          level: Math.floor(i / 3) + 1
        }),
        format: 'turtle'
      }));

      const operation = () => engine.ingest(sources, { user: 'test-user' });
      const perfStats = await testHelpers.measurePerformance(operation, 5);

      expect(perfStats.successfulIterations).toBe(5);
      expect(perfStats.averageDuration).toBeLessThan(5000); // < 5 seconds
      expect(perfStats.averageMemoryUsage).toBeLessThan(50 * 1024 * 1024); // < 50MB

      // Memory should not grow excessively between iterations
      const memoryGrowthRate = perfStats.averageMemoryUsage / sources.length;
      expect(memoryGrowthRate).toBeLessThan(1024 * 1024); // < 1MB per source
    });

    it('should scale linearly with input size', async () => {
      const sizes = [1, 5, 10, 20];
      const scalingResults = [];

      for (const size of sizes) {
        const sources = Array.from({ length: size }, (_, i) => ({
          type: 'rdf',
          content: testHelpers.createSampleRDF('organization', `Org ${i + 1}`),
          format: 'turtle'
        }));

        const operation = () => engine.ingest(sources, { user: 'test-user' });
        const perfStats = await testHelpers.measurePerformance(operation, 3);

        scalingResults.push({
          size,
          averageDuration: perfStats.averageDuration,
          averageMemory: perfStats.averageMemoryUsage
        });
      }

      // Verify linear scaling (O(n) complexity)
      for (let i = 1; i < scalingResults.length; i++) {
        const current = scalingResults[i];
        const previous = scalingResults[i - 1];
        
        const durationRatio = current.averageDuration / previous.averageDuration;
        const sizeRatio = current.size / previous.size;
        
        // Duration growth should be roughly proportional to size growth
        // Allow for some overhead (factor of 2)
        expect(durationRatio).toBeLessThan(sizeRatio * 2);
      }
    });

    it('should maintain performance under concurrent load', async () => {
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createComplexRDFGraph(),
          format: 'turtle'
        }
      ];

      const concurrentOperations = Array.from({ length: 5 }, () =>
        engine.ingest(sources, { user: 'test-user' })
      );

      const startTime = process.hrtime.bigint();
      const results = await Promise.all(concurrentOperations);
      const totalDuration = Number(process.hrtime.bigint() - startTime) / 1000000;

      // All operations should succeed
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.entities).toBeDefined();
      });

      // Concurrent execution should be faster than sequential
      const sequentialEstimate = 5000; // Estimated 1 second per operation
      expect(totalDuration).toBeLessThan(sequentialEstimate);
    });
  });

  describe('Reasoning Performance', () => {
    let knowledgeGraph;

    beforeEach(async () => {
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createComplexRDFGraph(),
          format: 'turtle'
        }
      ];
      knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
    });

    it('should perform reasoning efficiently', async () => {
      const rules = [
        {
          name: 'employee-classification',
          condition: '?person ex:worksFor ?org',
          conclusion: '?person a ex:Employee'
        },
        {
          name: 'manager-classification',
          condition: '?person ex:manages ?project',
          conclusion: '?person a ex:Manager'
        },
        {
          name: 'transitivity-rule',
          condition: '?a ex:manages ?b . ?b ex:manages ?c',
          conclusion: '?a ex:indirectlyManages ?c'
        }
      ];

      const operation = () => engine.reason(knowledgeGraph, rules, { user: 'test-user' });
      const perfStats = await testHelpers.measurePerformance(operation, 5);

      expect(perfStats.successfulIterations).toBe(5);
      expect(perfStats.averageDuration).toBeLessThan(2000); // < 2 seconds
      expect(perfStats.standardDeviation).toBeLessThan(500); // Consistent performance
    });

    it('should scale with rule complexity', async () => {
      const simpleRules = [
        { name: 'rule1', condition: '?x a ex:Person', conclusion: '?x a ex:Human' }
      ];

      const complexRules = [
        { name: 'rule1', condition: '?x a ex:Person', conclusion: '?x a ex:Human' },
        { name: 'rule2', condition: '?x ex:worksFor ?y', conclusion: '?x a ex:Employee' },
        { name: 'rule3', condition: '?x ex:manages ?y', conclusion: '?x a ex:Manager' },
        { name: 'rule4', condition: '?x a ex:Manager . ?x ex:worksFor ?y', conclusion: '?x a ex:SeniorEmployee' },
        { name: 'rule5', condition: '?x a ex:SeniorEmployee . ?x ex:hasExperience ?exp', conclusion: '?x a ex:Expert' }
      ];

      const simpleOperation = () => engine.reason(knowledgeGraph, simpleRules, { user: 'test-user' });
      const complexOperation = () => engine.reason(knowledgeGraph, complexRules, { user: 'test-user' });

      const simplePerf = await testHelpers.measurePerformance(simpleOperation, 3);
      const complexPerf = await testHelpers.measurePerformance(complexOperation, 3);

      // Complex reasoning should take longer but not exponentially
      const complexityRatio = complexPerf.averageDuration / simplePerf.averageDuration;
      const ruleRatio = complexRules.length / simpleRules.length;

      expect(complexityRatio).toBeGreaterThan(1);
      expect(complexityRatio).toBeLessThan(ruleRatio * 3); // Reasonable scaling
    });
  });

  describe('Generation Performance', () => {
    let knowledgeGraph;

    beforeEach(async () => {
      const sources = Array.from({ length: 5 }, (_, i) => ({
        type: 'rdf',
        content: testHelpers.createSampleRDF('person', `Developer ${i + 1}`, {
          skill: `JavaScript`,
          experience: i + 1
        }),
        format: 'turtle'
      }));
      
      knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
    });

    it('should generate code artifacts efficiently', async () => {
      const templates = [
        {
          id: 'person-class',
          type: 'class',
          language: 'javascript',
          template: testHelpers.getPersonClassTemplate()
        }
      ];

      const operation = () => engine.generate(knowledgeGraph, templates, { user: 'test-user' });
      const perfStats = await testHelpers.measurePerformance(operation, 5);

      expect(perfStats.successfulIterations).toBe(5);
      expect(perfStats.averageDuration).toBeLessThan(1500); // < 1.5 seconds
    });

    it('should handle multiple templates efficiently', async () => {
      const templates = [
        {
          id: 'person-class',
          type: 'class',
          language: 'javascript',
          template: testHelpers.getPersonClassTemplate()
        },
        {
          id: 'person-api',
          type: 'api',
          language: 'javascript',
          template: testHelpers.getAPIEndpointTemplate()
        },
        {
          id: 'person-test',
          type: 'test',
          language: 'javascript',
          template: `
            const {{ entity.name | capitalize }} = require('./{{ entity.name | lower }}');
            
            describe('{{ entity.name | capitalize }} Tests', () => {
              it('should create instance', () => {
                const instance = new {{ entity.name | capitalize }}();
                expect(instance).toBeDefined();
              });
            });
          `
        }
      ];

      const operation = () => engine.generate(knowledgeGraph, templates, { user: 'test-user' });
      const perfStats = await testHelpers.measurePerformance(operation, 3);

      expect(perfStats.successfulIterations).toBe(3);
      expect(perfStats.averageDuration).toBeLessThan(3000); // < 3 seconds for multiple templates
    });
  });

  describe('Query Performance', () => {
    let knowledgeGraph;

    beforeEach(async () => {
      // Create larger dataset for query performance testing
      const sources = Array.from({ length: 20 }, (_, i) => ({
        type: 'rdf',
        content: testHelpers.createSampleRDF('person', `Employee ${i + 1}`, {
          department: `Dept ${(i % 5) + 1}`,
          level: Math.floor(i / 5) + 1,
          salary: 50000 + (i * 5000)
        }),
        format: 'turtle'
      }));
      
      knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
    });

    it('should execute simple queries efficiently', async () => {
      const query = `
        PREFIX ex: <http://example.org/>
        SELECT ?person ?name WHERE {
          ?person a ex:Person .
          ?person ex:hasName ?name .
        }
      `;

      const operation = () => engine.query(query, { user: 'test-user' });
      const perfStats = await testHelpers.measurePerformance(operation, 10);

      expect(perfStats.successfulIterations).toBe(10);
      expect(perfStats.averageDuration).toBeLessThan(500); // < 0.5 seconds
    });

    it('should handle complex queries', async () => {
      const complexQuery = `
        PREFIX ex: <http://example.org/>
        SELECT ?person ?name ?department ?level ?salary WHERE {
          ?person a ex:Person .
          ?person ex:hasName ?name .
          ?person ex:hasDepartment ?department .
          ?person ex:hasLevel ?level .
          ?person ex:hasSalary ?salary .
          FILTER(?level > 2 && ?salary > 60000)
        }
        ORDER BY DESC(?salary)
        LIMIT 10
      `;

      const operation = () => engine.query(complexQuery, { user: 'test-user' });
      const perfStats = await testHelpers.measurePerformance(operation, 5);

      expect(perfStats.successfulIterations).toBe(5);
      expect(perfStats.averageDuration).toBeLessThan(1000); // < 1 second
    });

    it('should support query result caching', async () => {
      const query = `
        PREFIX ex: <http://example.org/>
        SELECT ?person ?name WHERE {
          ?person a ex:Person .
          ?person ex:hasName ?name .
        }
      `;

      // First execution (cache miss)
      const firstRun = await testHelpers.measurePerformance(
        () => engine.query(query, { user: 'test-user', cache: true }),
        1
      );

      // Second execution (cache hit)
      const secondRun = await testHelpers.measurePerformance(
        () => engine.query(query, { user: 'test-user', cache: true }),
        1
      );

      // Cached query should be significantly faster
      expect(secondRun.averageDuration).toBeLessThan(firstRun.averageDuration * 0.5);
    });
  });

  describe('Memory Management', () => {
    it('should maintain stable memory usage', async () => {
      const memoryReadings = [];
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        const sources = [
          {
            type: 'rdf',
            content: testHelpers.createSampleRDF('temp', `TempEntity${i}`),
            format: 'turtle'
          }
        ];

        await engine.ingest(sources, { user: 'test-user' });
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const memUsage = process.memoryUsage();
        memoryReadings.push(memUsage.heapUsed);
      }

      // Memory usage should not grow unboundedly
      const initialMemory = memoryReadings[0];
      const finalMemory = memoryReadings[memoryReadings.length - 1];
      const memoryGrowth = finalMemory - initialMemory;

      // Allow for some growth but not more than 50MB for this test
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });

    it('should cleanup resources properly', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple operations
      for (let i = 0; i < 5; i++) {
        const sources = [
          {
            type: 'rdf',
            content: testHelpers.createComplexRDFGraph(),
            format: 'turtle'
          }
        ];

        const knowledgeGraph = await engine.ingest(sources, { user: 'test-user' });
        
        const rules = [
          { name: 'test-rule', condition: '?x a ex:Person', conclusion: '?x a ex:Human' }
        ];
        
        await engine.reason(knowledgeGraph, rules, { user: 'test-user' });
      }

      // Force cleanup
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (< 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', async () => {
      const sources = [
        {
          type: 'rdf',
          content: testHelpers.createComplexRDFGraph(),
          format: 'turtle'
        }
      ];

      const operation = () => engine.ingest(sources, { user: 'test-user' });
      const currentPerf = await testHelpers.measurePerformance(operation, 5);

      const performanceReport = {
        timestamp: this.getDeterministicDate().toISOString(),
        version: engine.getVersion(),
        ingestion: {
          complex: {
            averageDuration: currentPerf.averageDuration,
            standardDeviation: currentPerf.standardDeviation,
            averageMemoryUsage: currentPerf.averageMemoryUsage
          }
        }
      };

      // Save baseline for future runs
      await savePerformanceBaseline(performanceReport);

      // Check against existing baseline
      if (performanceBaseline?.ingestion?.complex) {
        const baseline = performanceBaseline.ingestion.complex;
        const regressionThreshold = 1.3; // 30% degradation threshold

        if (currentPerf.averageDuration > baseline.averageDuration * regressionThreshold) {
          console.warn(`Performance regression detected:
            Baseline: ${baseline.averageDuration}ms
            Current: ${currentPerf.averageDuration}ms
            Degradation: ${((currentPerf.averageDuration / baseline.averageDuration - 1) * 100).toFixed(2)}%
          `);
        }

        // Don't fail tests for performance regressions, just warn
        expect(currentPerf.averageDuration).toBeLessThan(baseline.averageDuration * 2); // Fail only on severe regressions
      }
    });
  });

  describe('Stress Testing', () => {
    it('should handle high-frequency operations', async () => {
      const operations = [];
      const operationCount = 20;

      // Create many small operations
      for (let i = 0; i < operationCount; i++) {
        const sources = [
          {
            type: 'rdf',
            content: testHelpers.createSampleRDF('stress', `StressTest${i}`),
            format: 'turtle'
          }
        ];

        operations.push(engine.ingest(sources, { user: 'test-user' }));
      }

      const startTime = process.hrtime.bigint();
      const results = await Promise.all(operations);
      const totalDuration = Number(process.hrtime.bigint() - startTime) / 1000000;

      // All operations should succeed
      expect(results).toHaveLength(operationCount);
      results.forEach(result => {
        expect(result.entities).toBeDefined();
      });

      // Operations should complete in reasonable time
      expect(totalDuration).toBeLessThan(10000); // < 10 seconds

      console.log(`Completed ${operationCount} operations in ${totalDuration.toFixed(2)}ms`);
    });

    it('should maintain stability under sustained load', async () => {
      const duration = 5000; // 5 seconds
      const startTime = this.getDeterministicTimestamp();
      const operations = [];
      let operationCount = 0;

      while (this.getDeterministicTimestamp() - startTime < duration) {
        const sources = [
          {
            type: 'rdf',
            content: testHelpers.createSampleRDF('sustained', `SustainedTest${operationCount}`),
            format: 'turtle'
          }
        ];

        operations.push(engine.ingest(sources, { user: 'test-user' }));
        operationCount++;

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const results = await Promise.all(operations);
      const successRate = results.length / operationCount;

      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      console.log(`Sustained load test: ${operationCount} operations, ${(successRate * 100).toFixed(2)}% success rate`);
    });
  });
});