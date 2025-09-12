#!/usr/bin/env node

/**
 * KGEN JSON CLI Performance Tests
 * 
 * Tests JSON serialization performance, schema validation speed,
 * and overall CLI response times to meet Charter requirements.
 * 
 * Performance Requirements:
 * - JSON serialization ≤2ms per response
 * - Schema validation ≤1ms per output
 * - Support for streaming large responses
 */

import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { validator } from '../src/lib/json-schema-validator.js';
import { formatter } from '../src/lib/cli-response-formatter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Performance Test Suite for JSON CLI
 */
class JSONCLIPerformanceTests {
  constructor() {
    this.results = {};
    this.testData = {
      small: this.generateTestData(100),
      medium: this.generateTestData(1000),
      large: this.generateTestData(10000),
      xlarge: this.generateTestData(100000)
    };
  }

  /**
   * Generate test data of specified size
   */
  generateTestData(triples) {
    const subjects = Array.from({ length: Math.ceil(triples / 10) }, (_, i) => 
      `<http://example.org/subject${i}>`
    );
    const predicates = Array.from({ length: 50 }, (_, i) => 
      `<http://example.org/predicate${i}>`
    );
    const objects = Array.from({ length: Math.ceil(triples / 5) }, (_, i) => 
      `<http://example.org/object${i}>`
    );

    return {
      file: `/tmp/test-${triples}.ttl`,
      triples,
      subjects: subjects.length,
      predicates: predicates.length,
      objects: objects.length,
      hash: 'a'.repeat(64), // Mock hash
      size: triples * 100, // Approximate size
      format: 'turtle',
      index: {
        subjects: subjects.slice(0, 10),
        predicates: predicates.slice(0, 10),
        objects: objects.slice(0, 5)
      },
      statistics: {
        literals: Math.floor(triples * 0.3),
        uris: Math.floor(triples * 0.6),
        blankNodes: Math.floor(triples * 0.1)
      }
    };
  }

  /**
   * Test JSON serialization performance
   */
  async testJSONSerialization() {
    console.log('Testing JSON Serialization Performance...');
    const results = {};

    for (const [size, data] of Object.entries(this.testData)) {
      const measurements = [];
      
      // Run multiple iterations for accuracy
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const jsonString = JSON.stringify(data, null, 2);
        const end = performance.now();
        
        measurements.push(end - start);
        
        // Verify serialization didn't fail
        if (!jsonString || jsonString.length < 10) {
          throw new Error(`JSON serialization failed for ${size} data`);
        }
      }
      
      const avgTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const maxTime = Math.max(...measurements);
      const minTime = Math.min(...measurements);
      
      results[size] = {
        avgTime: Math.round(avgTime * 1000) / 1000, // Round to 3 decimals
        maxTime: Math.round(maxTime * 1000) / 1000,
        minTime: Math.round(minTime * 1000) / 1000,
        dataSize: data.triples,
        jsonSize: JSON.stringify(data).length,
        passesRequirement: avgTime <= 2.0 // ≤2ms requirement
      };
      
      console.log(`  ${size}: ${avgTime.toFixed(2)}ms avg, ${maxTime.toFixed(2)}ms max (${results[size].passesRequirement ? '✅' : '❌'})`);
    }

    this.results.jsonSerialization = results;
    return results;
  }

  /**
   * Test schema validation performance
   */
  async testSchemaValidation() {
    console.log('\nTesting Schema Validation Performance...');
    
    // Initialize validator
    await validator.initialize();
    
    const results = {};
    const operations = ['graph:hash', 'graph:index', 'artifact:generate', 'templates:ls'];

    for (const operation of operations) {
      console.log(`  Testing ${operation}...`);
      const operationResults = {};

      for (const [size, data] of Object.entries(this.testData)) {
        const measurements = [];
        
        // Adapt data to match operation schema
        const testResponse = this.createMockResponse(operation, data);
        
        // Run multiple validation iterations
        for (let i = 0; i < 10; i++) {
          const start = performance.now();
          const validation = await validator.validate(operation, testResponse);
          const end = performance.now();
          
          measurements.push(end - start);
          
          // Verify validation worked
          if (validation === undefined) {
            throw new Error(`Schema validation failed for ${operation}`);
          }
        }
        
        const avgTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
        const maxTime = Math.max(...measurements);
        
        operationResults[size] = {
          avgTime: Math.round(avgTime * 1000) / 1000,
          maxTime: Math.round(maxTime * 1000) / 1000,
          passesRequirement: avgTime <= 1.0 // ≤1ms requirement
        };
      }
      
      results[operation] = operationResults;
      
      // Show summary for this operation
      const avgAcrossSizes = Object.values(operationResults)
        .reduce((sum, result) => sum + result.avgTime, 0) / Object.keys(operationResults).length;
      const allPass = Object.values(operationResults).every(r => r.passesRequirement);
      
      console.log(`    Average: ${avgAcrossSizes.toFixed(2)}ms (${allPass ? '✅' : '❌'})`);
    }

    this.results.schemaValidation = results;
    return results;
  }

  /**
   * Test CLI response formatter performance
   */
  async testCLIFormatterPerformance() {
    console.log('\nTesting CLI Response Formatter Performance...');
    
    const results = {};
    const operations = ['graph:hash', 'graph:diff', 'artifact:generate'];

    for (const operation of operations) {
      const operationResults = {};

      for (const [size, data] of Object.entries(this.testData)) {
        const measurements = [];
        const testResponse = this.createMockResponse(operation, data);
        
        // Test formatter with trace ID generation and metadata
        for (let i = 0; i < 10; i++) {
          const traceId = formatter.generateTraceId();
          formatter.startOperation(traceId);
          
          const start = performance.now();
          await formatter.formatSuccess(operation, testResponse, traceId);
          const end = performance.now();
          
          measurements.push(end - start);
        }
        
        const avgTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
        const maxTime = Math.max(...measurements);
        
        operationResults[size] = {
          avgTime: Math.round(avgTime * 1000) / 1000,
          maxTime: Math.round(maxTime * 1000) / 1000,
          passesRequirement: avgTime <= 5.0 // Overall CLI response ≤5ms
        };
      }
      
      results[operation] = operationResults;
      
      const avgAcrossSizes = Object.values(operationResults)
        .reduce((sum, result) => sum + result.avgTime, 0) / Object.keys(operationResults).length;
      const allPass = Object.values(operationResults).every(r => r.passesRequirement);
      
      console.log(`  ${operation}: ${avgAcrossSizes.toFixed(2)}ms avg (${allPass ? '✅' : '❌'})`);
    }

    this.results.cliFormatter = results;
    return results;
  }

  /**
   * Test memory usage for large responses
   */
  async testMemoryUsage() {
    console.log('\nTesting Memory Usage...');
    
    const initialMemory = process.memoryUsage();
    console.log(`  Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);

    // Test with extra large dataset
    const xlargeData = this.generateTestData(1000000); // 1M triples
    const mockResponse = this.createMockResponse('graph:index', xlargeData);

    // JSON serialization memory test
    const beforeJSON = process.memoryUsage();
    const jsonString = JSON.stringify(mockResponse, null, 2);
    const afterJSON = process.memoryUsage();
    
    const jsonMemoryDelta = afterJSON.heapUsed - beforeJSON.heapUsed;
    console.log(`  JSON serialization: +${Math.round(jsonMemoryDelta / 1024 / 1024)}MB`);

    // Schema validation memory test
    await validator.initialize();
    const beforeValidation = process.memoryUsage();
    await validator.validate('graph:index', mockResponse);
    const afterValidation = process.memoryUsage();
    
    const validationMemoryDelta = afterValidation.heapUsed - beforeValidation.heapUsed;
    console.log(`  Schema validation: +${Math.round(validationMemoryDelta / 1024 / 1024)}MB`);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage();
    console.log(`  Final memory: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);

    this.results.memoryUsage = {
      initial: Math.round(initialMemory.heapUsed / 1024 / 1024),
      jsonDelta: Math.round(jsonMemoryDelta / 1024 / 1024),
      validationDelta: Math.round(validationMemoryDelta / 1024 / 1024),
      final: Math.round(finalMemory.heapUsed / 1024 / 1024),
      jsonString: {
        size: Math.round(jsonString.length / 1024 / 1024),
        compressed: Math.round(Buffer.from(jsonString).length / 1024 / 1024)
      }
    };
    
    return this.results.memoryUsage;
  }

  /**
   * Test streaming large responses
   */
  async testStreaming() {
    console.log('\nTesting Streaming Large Responses...');
    
    // Simulate streaming by chunking large responses
    const xlargeData = this.generateTestData(500000);
    const mockResponse = this.createMockResponse('graph:index', xlargeData);
    
    const start = performance.now();
    
    // Simulate streaming JSON output in chunks
    const jsonString = JSON.stringify(mockResponse);
    const chunkSize = 64 * 1024; // 64KB chunks
    const chunks = [];
    
    for (let i = 0; i < jsonString.length; i += chunkSize) {
      const chunk = jsonString.slice(i, i + chunkSize);
      chunks.push(chunk);
    }
    
    const end = performance.now();
    const streamTime = end - start;
    
    console.log(`  Streaming ${chunks.length} chunks: ${streamTime.toFixed(2)}ms`);
    console.log(`  Average chunk size: ${Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length / 1024)}KB`);
    
    this.results.streaming = {
      totalTime: Math.round(streamTime * 1000) / 1000,
      chunks: chunks.length,
      avgChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length),
      totalSize: jsonString.length,
      passesRequirement: streamTime <= 100 // ≤100ms for large responses
    };
    
    return this.results.streaming;
  }

  /**
   * Create mock response for testing
   */
  createMockResponse(operation, data) {
    const baseResponse = {
      success: true,
      operation,
      timestamp: this.getDeterministicDate().toISOString(),
      metadata: {
        traceId: 'test-trace-' + Math.random().toString(36).substr(2, 9),
        version: '1.0.0',
        executionTime: 1.5,
        nodeVersion: process.version
      }
    };

    switch (operation) {
      case 'graph:hash':
        return { ...baseResponse, ...data };
      
      case 'graph:index':
        return { ...baseResponse, ...data };
      
      case 'graph:diff':
        return {
          ...baseResponse,
          graph1: '/tmp/graph1.ttl',
          graph2: '/tmp/graph2.ttl',
          identical: false,
          summary: {
            added: Math.floor(data.triples * 0.1),
            removed: Math.floor(data.triples * 0.1),
            modified: Math.floor(data.subjects * 0.05)
          },
          changes: Array.from({ length: Math.min(100, data.triples) }, (_, i) => ({
            type: i % 2 === 0 ? 'added' : 'removed',
            triple: {
              subject: `<http://example.org/subject${i}>`,
              predicate: `<http://example.org/predicate${i % 10}>`,
              object: `<http://example.org/object${i}>`
            }
          })),
          impactScore: 0.3,
          riskLevel: 'medium',
          blastRadius: 5,
          recommendations: ['Review changes carefully', 'Run tests before deployment']
        };
      
      case 'artifact:generate':
        return {
          ...baseResponse,
          template: 'test-template',
          templatePath: '/tmp/template.njk',
          outputPath: '/tmp/generated-artifact.js',
          contentHash: 'b'.repeat(64),
          attestationPath: '/tmp/generated-artifact.js.attest.json',
          context: ['graph', 'config', 'metadata'],
          cached: false,
          deterministic: true
        };
      
      case 'templates:ls':
        return {
          ...baseResponse,
          templatesDir: '/tmp/templates',
          templates: Array.from({ length: Math.min(50, Math.floor(data.triples / 1000)) }, (_, i) => ({
            name: `template-${i}`,
            path: `/tmp/templates/template-${i}.njk`,
            size: 1024 + i * 100,
            modified: this.getDeterministicDate().toISOString(),
            variables: [`var${i}`, `config${i}`, `data${i}`]
          })),
          count: Math.min(50, Math.floor(data.triples / 1000))
        };
      
      default:
        return baseResponse;
    }
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('KGEN JSON CLI Performance Test Results');
    console.log('='.repeat(60));

    // JSON Serialization Results
    console.log('\n📊 JSON Serialization Performance:');
    console.log('Requirement: ≤2ms per response');
    
    let allSerializationPass = true;
    for (const [size, result] of Object.entries(this.results.jsonSerialization)) {
      const status = result.passesRequirement ? '✅' : '❌';
      console.log(`  ${size.padEnd(8)}: ${result.avgTime.toString().padEnd(6)}ms avg (${status})`);
      if (!result.passesRequirement) allSerializationPass = false;
    }
    console.log(`  Overall: ${allSerializationPass ? '✅ PASS' : '❌ FAIL'}`);

    // Schema Validation Results
    console.log('\n🔍 Schema Validation Performance:');
    console.log('Requirement: ≤1ms per output');
    
    let allValidationPass = true;
    const validationOps = Object.keys(this.results.schemaValidation);
    
    for (const operation of validationOps) {
      const results = this.results.schemaValidation[operation];
      const avgTime = Object.values(results).reduce((sum, r) => sum + r.avgTime, 0) / Object.keys(results).length;
      const allPass = Object.values(results).every(r => r.passesRequirement);
      
      console.log(`  ${operation.padEnd(20)}: ${avgTime.toFixed(2)}ms avg (${allPass ? '✅' : '❌'})`);
      if (!allPass) allValidationPass = false;
    }
    console.log(`  Overall: ${allValidationPass ? '✅ PASS' : '❌ FAIL'}`);

    // CLI Formatter Results
    console.log('\n⚡ CLI Response Formatter Performance:');
    console.log('Requirement: ≤5ms total response time');
    
    let allFormatterPass = true;
    const formatterOps = Object.keys(this.results.cliFormatter);
    
    for (const operation of formatterOps) {
      const results = this.results.cliFormatter[operation];
      const avgTime = Object.values(results).reduce((sum, r) => sum + r.avgTime, 0) / Object.keys(results).length;
      const allPass = Object.values(results).every(r => r.passesRequirement);
      
      console.log(`  ${operation.padEnd(20)}: ${avgTime.toFixed(2)}ms avg (${allPass ? '✅' : '❌'})`);
      if (!allPass) allFormatterPass = false;
    }
    console.log(`  Overall: ${allFormatterPass ? '✅ PASS' : '❌ FAIL'}`);

    // Memory Usage Results
    console.log('\n💾 Memory Usage:');
    const mem = this.results.memoryUsage;
    console.log(`  Initial: ${mem.initial}MB`);
    console.log(`  JSON serialization: +${mem.jsonDelta}MB`);
    console.log(`  Schema validation: +${mem.validationDelta}MB`);
    console.log(`  Final: ${mem.final}MB`);
    console.log(`  JSON output size: ${mem.jsonString.size}MB`);

    // Streaming Results
    console.log('\n🌊 Streaming Performance:');
    const stream = this.results.streaming;
    console.log(`  Large response (500K triples): ${stream.totalTime}ms`);
    console.log(`  Chunks: ${stream.chunks} (avg ${Math.round(stream.avgChunkSize / 1024)}KB each)`);
    console.log(`  Total size: ${Math.round(stream.totalSize / 1024 / 1024)}MB`);
    console.log(`  Status: ${stream.passesRequirement ? '✅ PASS' : '❌ FAIL'}`);

    // Overall Summary
    const overallPass = allSerializationPass && allValidationPass && allFormatterPass && stream.passesRequirement;
    
    console.log('\n' + '='.repeat(60));
    console.log(`OVERALL PERFORMANCE: ${overallPass ? '✅ ALL REQUIREMENTS MET' : '❌ SOME REQUIREMENTS FAILED'}`);
    console.log('='.repeat(60));

    return {
      overall: overallPass,
      jsonSerialization: allSerializationPass,
      schemaValidation: allValidationPass,
      cliFormatter: allFormatterPass,
      streaming: stream.passesRequirement,
      results: this.results
    };
  }

  /**
   * Run all performance tests
   */
  async runAllTests() {
    console.log('🚀 Starting KGEN JSON CLI Performance Tests...\n');
    
    try {
      await this.testJSONSerialization();
      await this.testSchemaValidation();
      await this.testCLIFormatterPerformance();
      await this.testMemoryUsage();
      await this.testStreaming();
      
      const report = this.generateReport();
      
      // Save results to file
      const resultsPath = path.join(__dirname, '../.kgen/performance-results.json');
      await fs.mkdir(path.dirname(resultsPath), { recursive: true });
      await fs.writeFile(resultsPath, JSON.stringify(report.results, null, 2));
      
      console.log(`\n📝 Detailed results saved to: ${resultsPath}`);
      
      // Exit with appropriate code
      process.exit(report.overall ? 0 : 1);
      
    } catch (error) {
      console.error('\n❌ Performance tests failed:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}

// Run performance tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = new JSONCLIPerformanceTests();
  tests.runAllTests();
}

export default JSONCLIPerformanceTests;