/**
 * KGEN SHACL Validation Engine Tests
 * 
 * Comprehensive test suite for SHACL-only validation engine.
 * Tests performance targets, validation correctness, and CLI integration.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { SHACLValidationEngine, SHACLValidationCodes } from '../../../src/kgen/validation/shacl-validation-engine.js';
import { SHACLGates, SHACLGateConfig } from '../../../src/kgen/validation/shacl-gates.js';
import { SHACLPerformanceOptimizer } from '../../../src/kgen/validation/performance-optimizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_SHAPES_DIR = path.join(__dirname, '../../fixtures/shapes');
const TEST_DATA_DIR = path.join(__dirname, '../../fixtures/data');
const TEST_OUTPUT_DIR = path.join(__dirname, '../../output/shacl-tests');

// Sample SHACL shapes for testing
const SAMPLE_SHAPES = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:PersonShape a sh:NodeShape ;
    sh:targetClass ex:Person ;
    sh:property [
        sh:path ex:name ;
        sh:datatype xsd:string ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:message "Person must have exactly one name"@en ;
    ] ;
    sh:property [
        sh:path ex:age ;
        sh:datatype xsd:integer ;
        sh:minInclusive 0 ;
        sh:maxInclusive 150 ;
        sh:maxCount 1 ;
        sh:message "Person age must be between 0 and 150"@en ;
    ] .
`;

// Valid test data
const VALID_DATA = `
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:john a ex:Person ;
    ex:name "John Doe" ;
    ex:age 30 .

ex:jane a ex:Person ;
    ex:name "Jane Smith" ;
    ex:age 25 .
`;

// Invalid test data
const INVALID_DATA = `
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:invalid a ex:Person ;
    ex:age 200 .

ex:duplicate a ex:Person ;
    ex:name "First Name" ;
    ex:name "Second Name" ;
    ex:age -5 .
`;

describe('SHACL Validation Engine', () => {
  let engine;
  let gates;
  let optimizer;

  beforeAll(async () => {
    // Ensure test directories exist
    await fs.ensureDir(TEST_SHAPES_DIR);
    await fs.ensureDir(TEST_DATA_DIR);
    await fs.ensureDir(TEST_OUTPUT_DIR);
    
    // Write test fixtures
    await fs.writeFile(path.join(TEST_SHAPES_DIR, 'sample-shapes.ttl'), SAMPLE_SHAPES);
    await fs.writeFile(path.join(TEST_DATA_DIR, 'valid-data.ttl'), VALID_DATA);
    await fs.writeFile(path.join(TEST_DATA_DIR, 'invalid-data.ttl'), INVALID_DATA);
  });

  beforeEach(async () => {
    engine = new SHACLValidationEngine({
      timeout: 30000,
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }
    });
    
    gates = new SHACLGates({
      reportPath: TEST_OUTPUT_DIR,
      exitOnFailure: false,
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, success: () => {} }
    });
    
    optimizer = new SHACLPerformanceOptimizer({
      logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }
    });
  });

  afterAll(async () => {
    // Cleanup test directories
    await fs.remove(TEST_OUTPUT_DIR);
  });

  describe('Engine Initialization', () => {
    test('should initialize with SHACL shapes', async () => {
      await engine.initialize(SAMPLE_SHAPES);
      expect(engine.engine).toBeDefined();
      expect(engine.shapesGraph).toBeDefined();
    });

    test('should load shapes from file', async () => {
      await engine.loadShapes(path.join(TEST_SHAPES_DIR, 'sample-shapes.ttl'));
      expect(engine.engine).toBeDefined();
    });

    test('should throw error for invalid shapes', async () => {
      await expect(engine.initialize('invalid turtle syntax')).rejects.toThrow();
    });
  });

  describe('Validation Performance', () => {
    beforeEach(async () => {
      await engine.initialize(SAMPLE_SHAPES);
    });

    test('should validate small graphs within 20ms target', async () => {
      const startTime = performance.now();
      const report = await engine.validate(VALID_DATA);
      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(20);
      expect(report.conforms).toBe(true);
      expect(report.summary.performance.validationTime).toMatch(/\d+(\.\d+)?ms/);
    });

    test('should handle large graphs within 100ms target', async () => {
      // Generate large test graph
      let largeData = '@prefix ex: <http://example.org/> .\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n\n';
      for (let i = 0; i < 1000; i++) {
        largeData += `ex:person${i} a ex:Person ; ex:name "Person ${i}" ; ex:age ${Math.floor(Math.random() * 100)} .\n`;
      }
      
      const startTime = performance.now();
      const report = await engine.validate(largeData);
      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(100);
      expect(report.conforms).toBe(true);
      expect(report.summary.graphSize).toBeGreaterThan(3000); // ~3 triples per person
    });

    test('should report validation time under 5ms', async () => {
      const report = await engine.validate(VALID_DATA);
      const reportingTime = parseFloat(report.summary.performance.reportingTime.replace('ms', ''));
      
      expect(reportingTime).toBeLessThan(5);
    });
  });

  describe('Validation Correctness', () => {
    beforeEach(async () => {
      await engine.initialize(SAMPLE_SHAPES);
    });

    test('should validate conforming data successfully', async () => {
      const report = await engine.validate(VALID_DATA);
      
      expect(report.conforms).toBe(true);
      expect(report.violations).toHaveLength(0);
      expect(report.summary.totalViolations).toBe(0);
    });

    test('should detect violations in non-conforming data', async () => {
      const report = await engine.validate(INVALID_DATA);
      
      expect(report.conforms).toBe(false);
      expect(report.violations.length).toBeGreaterThan(0);
      expect(report.summary.totalViolations).toBeGreaterThan(0);
      
      // Check violation details
      const violations = report.violations;
      expect(violations.some(v => v.message.includes('name'))).toBe(true);
      expect(violations.some(v => v.message.includes('age'))).toBe(true);
    });

    test('should provide detailed violation information', async () => {
      const report = await engine.validate(INVALID_DATA, { includeDetails: true });
      
      for (const violation of report.violations) {
        expect(violation).toHaveProperty('focusNode');
        expect(violation).toHaveProperty('severity');
        expect(violation).toHaveProperty('message');
        expect(violation.severity).toMatch(/^(Violation|Warning|Info)$/);
      }
    });

    test('should categorize violations by severity', async () => {
      const report = await engine.validate(INVALID_DATA);
      
      expect(report.summary.violationsBySeverity).toHaveProperty('Violation');
      expect(report.summary.violationsBySeverity).toHaveProperty('Warning');
      expect(report.summary.violationsBySeverity).toHaveProperty('Info');
      expect(report.summary.violationsBySeverity.Violation).toBeGreaterThan(0);
    });
  });

  describe('JSON-Only Reporting', () => {
    beforeEach(async () => {
      await engine.initialize(SAMPLE_SHAPES);
    });

    test('should generate JSON-only validation reports', async () => {
      const report = await engine.validate(VALID_DATA);
      
      // Verify JSON structure
      expect(report).toHaveProperty('conforms');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('violations');
      expect(report).toHaveProperty('summary');
      expect(report.summary).toHaveProperty('performance');
      expect(report.summary).toHaveProperty('violationsBySeverity');
      
      // Ensure no non-JSON data
      expect(() => JSON.stringify(report)).not.toThrow();
    });

    test('should include performance metrics in reports', async () => {
      const report = await engine.validate(VALID_DATA);
      
      expect(report.summary.performance).toHaveProperty('validationTime');
      expect(report.summary.performance).toHaveProperty('reportingTime');
      expect(report.summary.performance).toHaveProperty('graphSize');
      expect(report.summary.performance).toHaveProperty('shapesCount');
      
      expect(typeof report.summary.performance.graphSize).toBe('number');
      expect(typeof report.summary.performance.shapesCount).toBe('number');
    });
  });

  describe('Exit Codes', () => {
    beforeEach(async () => {
      await engine.initialize(SAMPLE_SHAPES);
    });

    test('should return SUCCESS for valid data', async () => {
      const report = await engine.validate(VALID_DATA);
      const exitCode = engine.getExitCode(report);
      
      expect(exitCode).toBe(SHACLValidationCodes.SUCCESS);
    });

    test('should return VIOLATIONS for invalid data', async () => {
      const report = await engine.validate(INVALID_DATA);
      const exitCode = engine.getExitCode(report);
      
      expect(exitCode).toBe(SHACLValidationCodes.VIOLATIONS);
    });

    test('should return ERRORS for validation errors', async () => {
      const errorReport = { error: 'Validation failed' };
      const exitCode = engine.getExitCode(errorReport);
      
      expect(exitCode).toBe(SHACLValidationCodes.ERRORS);
    });
  });

  describe('SHACL Gates', () => {
    beforeEach(async () => {
      await gates.initialize(path.join(TEST_SHAPES_DIR, 'sample-shapes.ttl'));
    });

    test('should run pre-build gate successfully', async () => {
      const result = await gates.runGate('pre-build', VALID_DATA);
      
      expect(result.gateName).toBe('pre-build');
      expect(result.passed).toBe(true);
      expect(result.blocked).toBe(false);
      expect(result.exitCode).toBe(SHACLValidationCodes.SUCCESS);
    });

    test('should block on violations when configured', async () => {
      const result = await gates.runGate('pre-build', INVALID_DATA, {
        blockOnViolations: true
      });
      
      expect(result.blocked).toBe(true);
      expect(result.passed).toBe(false);
      expect(result.exitCode).toBe(SHACLValidationCodes.VIOLATIONS);
    });

    test('should save gate reports', async () => {
      await gates.runGate('pre-build', VALID_DATA);
      
      const reportFiles = await fs.readdir(TEST_OUTPUT_DIR);
      const gateReports = reportFiles.filter(f => f.includes('pre-build'));
      
      expect(gateReports.length).toBeGreaterThan(0);
      
      // Verify report content
      const latestReport = path.join(TEST_OUTPUT_DIR, 'pre-build-latest.json');
      if (await fs.pathExists(latestReport)) {
        const reportData = await fs.readJson(latestReport);
        expect(reportData).toHaveProperty('gate');
        expect(reportData).toHaveProperty('validation');
      }
    });

    test('should run all gates in sequence', async () => {
      const gateData = {
        'pre-build': VALID_DATA,
        'artifact-generation': VALID_DATA,
        'post-build': VALID_DATA
      };
      
      const result = await gates.runAllGates(gateData);
      
      expect(result.passed).toBe(true);
      expect(result.criticalFailure).toBe(false);
      expect(result.exitCode).toBe(SHACLValidationCodes.SUCCESS);
      expect(Object.keys(result.gates)).toContain('pre-build');
      expect(Object.keys(result.gates)).toContain('artifact-generation');
      expect(Object.keys(result.gates)).toContain('post-build');
    });
  });

  describe('Performance Optimization', () => {
    test('should optimize validation function', async () => {
      await engine.initialize(SAMPLE_SHAPES);
      
      const mockValidation = async (data) => {
        return await engine.validate(data);
      };
      
      const optimizedValidation = optimizer.optimizeValidation(mockValidation);
      
      // Run optimized validation
      const result1 = await optimizedValidation(VALID_DATA);
      const result2 = await optimizedValidation(VALID_DATA); // Should use cache
      
      expect(result1.conforms).toBe(true);
      expect(result2.conforms).toBe(true);
      
      const metrics = optimizer.getPerformanceMetrics();
      expect(metrics.totalValidations).toBe(2);
    });

    test('should precompile shapes for performance', async () => {
      const shapesQuads = await engine._parseToQuads(SAMPLE_SHAPES);
      const compiled = await optimizer.precompileShapes(shapesQuads);
      
      expect(compiled).toHaveProperty('hash');
      expect(compiled).toHaveProperty('analysis');
      expect(compiled).toHaveProperty('compilationTime');
      expect(compiled.analysis.nodeShapes).toBeGreaterThan(0);
    });

    test('should provide performance metrics', async () => {
      const metrics = optimizer.getPerformanceMetrics();
      
      expect(metrics).toHaveProperty('cacheHits');
      expect(metrics).toHaveProperty('cacheMisses');
      expect(metrics).toHaveProperty('avgValidationTime');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('cacheSize');
    });
  });

  describe('Batch Validation', () => {
    beforeEach(async () => {
      await engine.initialize(SAMPLE_SHAPES);
    });

    test('should validate multiple graphs in batch', async () => {
      const dataGraphs = [VALID_DATA, INVALID_DATA, VALID_DATA];
      const results = await engine.validateBatch(dataGraphs);
      
      expect(results).toHaveLength(3);
      expect(results[0].conforms).toBe(true);
      expect(results[1].conforms).toBe(false);
      expect(results[2].conforms).toBe(true);
    });

    test('should support early termination on first violation', async () => {
      const dataGraphs = [VALID_DATA, INVALID_DATA, VALID_DATA];
      const results = await engine.validateBatch(dataGraphs, { 
        exitOnFirstViolation: true 
      });
      
      expect(results).toHaveLength(2); // Should stop after invalid data
      expect(results[1].conforms).toBe(false);
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      await engine.initialize(SAMPLE_SHAPES);
    });

    test('should handle memory cleanup', async () => {
      // Generate multiple validations to test memory management
      for (let i = 0; i < 10; i++) {
        await engine.validate(VALID_DATA);
      }
      
      const metrics = engine.getMetrics();
      expect(typeof metrics.validationTime).toBe('number');
      expect(typeof metrics.graphSize).toBe('number');
      
      // Clear cache and verify cleanup
      engine.clearCache();
      expect(engine.validationCache.size).toBe(0);
    });

    test('should enforce validation timeouts', async () => {
      const slowEngine = new SHACLValidationEngine({ timeout: 1 }); // 1ms timeout
      await slowEngine.initialize(SAMPLE_SHAPES);
      
      await expect(slowEngine.validate(VALID_DATA)).rejects.toThrow(/timeout/i);
    });
  });
});

describe('Integration Tests', () => {
  test('should integrate with CLI commands', async () => {
    // This would test the CLI integration module
    // For now, just verify the modules can be imported together
    const { SHACLCLIIntegration } = await import('../../../src/kgen/validation/shacl-cli-integration.js');
    
    const cli = new SHACLCLIIntegration({
      shapesPath: TEST_SHAPES_DIR,
      outputPath: TEST_OUTPUT_DIR
    });
    
    expect(cli).toBeDefined();
    expect(cli.validationEngine).toBeNull(); // Not initialized yet
    
    // Test initialization
    await cli.initialize();
    expect(cli.validationEngine).toBeDefined();
    expect(cli.gates).toBeDefined();
  });

  test('should work with existing KGEN validation infrastructure', async () => {
    // Test backward compatibility with existing validation system
    const { ValidationExitCodes } = await import('../../../packages/kgen-core/src/validation/index.js');
    
    expect(ValidationExitCodes).toEqual(SHACLValidationCodes);
  });
});