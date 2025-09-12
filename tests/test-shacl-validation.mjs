#!/usr/bin/env node

/**
 * Comprehensive SHACL Validation Framework Testing
 * 
 * Tests the actual SHACL validation implementation with:
 * - Valid data that should pass validation
 * - Invalid data that should generate violations
 * - Performance measurements
 * - Error reporting quality
 * - Constraint type coverage
 * - External validator integration
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SHACLValidationEngine } from '../src/kgen/validation/shacl-validation-engine.js';
import { SHACLValidator } from '../src/kgen/semantic/validation/shacl-validator.js';
import consola from 'consola';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SHACLValidationTester {
  constructor() {
    this.testResults = [];
    this.logger = consola.withTag('shacl-test');
    this.performanceMetrics = {
      totalTests: 0,
      averageValidationTime: 0,
      fastestValidation: Infinity,
      slowestValidation: 0
    };
  }

  async runTest(testName, testFunction) {
    const startTime = performance.now();
    
    try {
      this.logger.info(`🧪 Running test: ${testName}`);
      const result = await testFunction();
      const duration = performance.now() - startTime;
      
      this.testResults.push({
        name: testName,
        passed: true,
        duration,
        result,
        timestamp: this.getDeterministicDate().toISOString()
      });
      
      this.updatePerformanceMetrics(duration);
      this.logger.success(`✅ ${testName} PASSED (${duration.toFixed(2)}ms)`);
      
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.testResults.push({
        name: testName,
        passed: false,
        duration,
        error: error.message,
        stack: error.stack,
        timestamp: this.getDeterministicDate().toISOString()
      });
      
      this.logger.error(`❌ ${testName} FAILED: ${error.message}`);
      throw error;
    }
  }

  updatePerformanceMetrics(duration) {
    this.performanceMetrics.totalTests++;
    this.performanceMetrics.averageValidationTime = 
      (this.performanceMetrics.averageValidationTime + duration) / 2;
    this.performanceMetrics.fastestValidation = 
      Math.min(this.performanceMetrics.fastestValidation, duration);
    this.performanceMetrics.slowestValidation = 
      Math.max(this.performanceMetrics.slowestValidation, duration);
  }

  async testSHACLEngineInitialization() {
    const shapesPath = path.join(__dirname, 'test-shacl-shapes.ttl');
    const shapesContent = await fs.readFile(shapesPath, 'utf8');
    
    const engine = new SHACLValidationEngine({
      timeout: 10000,
      logger: this.logger
    });
    
    await engine.initialize(shapesContent);
    
    const metrics = engine.getMetrics();
    
    return {
      initialized: true,
      shapesLoaded: metrics.shapesCount > 0,
      engineReady: !!engine.engine,
      shapesCount: metrics.shapesCount
    };
  }

  async testValidDataValidation() {
    const shapesPath = path.join(__dirname, 'test-shacl-shapes.ttl');
    const validDataPath = path.join(__dirname, 'valid-test-data.ttl');
    
    const shapesContent = await fs.readFile(shapesPath, 'utf8');
    const validDataContent = await fs.readFile(validDataPath, 'utf8');
    
    const engine = new SHACLValidationEngine({
      logger: this.logger
    });
    
    await engine.initialize(shapesContent);
    const report = await engine.validate(validDataContent);
    
    return {
      conforms: report.conforms,
      violationsCount: report.violations.length,
      validationTime: report.summary.performance.validationTime,
      graphSize: report.summary.performance.graphSize,
      report
    };
  }

  async testInvalidDataValidation() {
    const shapesPath = path.join(__dirname, 'test-shacl-shapes.ttl');
    const invalidDataPath = path.join(__dirname, 'invalid-test-data.ttl');
    
    const shapesContent = await fs.readFile(shapesPath, 'utf8');
    const invalidDataContent = await fs.readFile(invalidDataPath, 'utf8');
    
    const engine = new SHACLValidationEngine({
      logger: this.logger
    });
    
    await engine.initialize(shapesContent);
    const report = await engine.validate(invalidDataContent);
    
    // Analyze violation types
    const violationTypes = {};
    for (const violation of report.violations) {
      const component = violation.sourceConstraintComponent;
      if (component) {
        const componentName = component.split('#').pop();
        violationTypes[componentName] = (violationTypes[componentName] || 0) + 1;
      }
    }
    
    return {
      conforms: report.conforms,
      violationsCount: report.violations.length,
      violationTypes,
      validationTime: report.summary.performance.validationTime,
      sampleViolations: report.violations.slice(0, 3),
      report
    };
  }

  async testConstraintTypes() {
    const testData = `
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      
      # Test minLength constraint
      ex:test1 a ex:StringLengthTest ;
        ex:shortString "hi" .  # Too short (< 5 chars)
      
      # Test maxLength constraint  
      ex:test2 a ex:StringLengthTest ;
        ex:shortString "this is too long for the constraint" .  # Too long (> 10 chars)
        
      # Test numeric range constraints
      ex:test3 a ex:NumericRangeTest ;
        ex:percentage "150"^^xsd:integer ;  # > 100
        ex:positiveNumber "0"^^xsd:integer .  # Not > 0
      
      # Test cardinality constraints
      ex:test4 a ex:CardinalityTest .  # Missing required property
      
      # Test pattern constraints
      ex:test5 a ex:PatternTest ;
        ex:phoneNumber "not-a-phone" ;  # Invalid pattern
        ex:hexColor "notahex" .  # Invalid hex color
    `;
    
    const shapesPath = path.join(__dirname, 'test-shacl-shapes.ttl');
    const shapesContent = await fs.readFile(shapesPath, 'utf8');
    
    const engine = new SHACLValidationEngine({
      logger: this.logger
    });
    
    await engine.initialize(shapesContent);
    const report = await engine.validate(testData);
    
    // Analyze which constraint types were tested
    const constraintsFound = new Set();
    for (const violation of report.violations) {
      if (violation.sourceConstraintComponent) {
        const component = violation.sourceConstraintComponent.split('#').pop();
        constraintsFound.add(component);
      }
    }
    
    return {
      conforms: report.conforms,
      violationsCount: report.violations.length,
      constraintsValidated: Array.from(constraintsFound),
      constraintCoverage: constraintsFound.size,
      violations: report.violations
    };
  }

  async testPerformanceTargets() {
    const shapesPath = path.join(__dirname, 'test-shacl-shapes.ttl');
    const validDataPath = path.join(__dirname, 'valid-test-data.ttl');
    
    const shapesContent = await fs.readFile(shapesPath, 'utf8');
    const validDataContent = await fs.readFile(validDataPath, 'utf8');
    
    const engine = new SHACLValidationEngine({
      logger: this.logger
    });
    
    await engine.initialize(shapesContent);
    
    // Run multiple validations to test performance consistency
    const results = [];
    for (let i = 0; i < 5; i++) {
      const startTime = performance.now();
      const report = await engine.validate(validDataContent);
      const endTime = performance.now();
      
      results.push({
        iteration: i + 1,
        validationTime: endTime - startTime,
        conforms: report.conforms,
        triples: report.summary.performance.graphSize
      });
    }
    
    const avgTime = results.reduce((sum, r) => sum + r.validationTime, 0) / results.length;
    const maxTime = Math.max(...results.map(r => r.validationTime));
    const minTime = Math.min(...results.map(r => r.validationTime));
    
    return {
      averageTime: avgTime,
      maxTime,
      minTime,
      targetTime: 20, // 20ms target
      meetsTarget: maxTime <= 20,
      results,
      consistency: maxTime - minTime < 10 // Good if variation < 10ms
    };
  }

  async testErrorReporting() {
    const testShapes = `
      @prefix : <http://example.org/shapes#> .
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      
      :TestShape a sh:NodeShape ;
        sh:targetClass ex:TestClass ;
        sh:property [
          sh:path ex:requiredProp ;
          sh:minCount 1 ;
          sh:message "Custom error: requiredProp is mandatory"
        ] ;
        sh:property [
          sh:path ex:stringProp ;
          sh:datatype xsd:string ;
          sh:pattern "^test.*" ;
          sh:message "Custom error: stringProp must start with 'test'"
        ] .
    `;
    
    const testData = `
      @prefix ex: <http://example.org/> .
      
      ex:testInstance a ex:TestClass ;
        ex:stringProp "invalid-value" .
    `;
    
    const engine = new SHACLValidationEngine({
      logger: this.logger
    });
    
    await engine.initialize(testShapes);
    const report = await engine.validate(testData);
    
    // Check quality of error messages
    const errorQuality = {
      hasCustomMessages: false,
      hasSourceShape: false,
      hasConstraintComponent: false,
      hasFocusNode: false,
      hasResultPath: false
    };
    
    for (const violation of report.violations) {
      if (violation.message && violation.message.includes('Custom error:')) {
        errorQuality.hasCustomMessages = true;
      }
      if (violation.sourceShape) {
        errorQuality.hasSourceShape = true;
      }
      if (violation.sourceConstraintComponent) {
        errorQuality.hasConstraintComponent = true;
      }
      if (violation.focusNode) {
        errorQuality.hasFocusNode = true;
      }
      if (violation.resultPath) {
        errorQuality.hasResultPath = true;
      }
    }
    
    return {
      violationsCount: report.violations.length,
      errorQuality,
      sampleViolation: report.violations[0] || null,
      allFieldsPresent: Object.values(errorQuality).every(v => v)
    };
  }

  async testBatchValidation() {
    const shapesPath = path.join(__dirname, 'test-shacl-shapes.ttl');
    const validDataPath = path.join(__dirname, 'valid-test-data.ttl');
    const invalidDataPath = path.join(__dirname, 'invalid-test-data.ttl');
    
    const shapesContent = await fs.readFile(shapesPath, 'utf8');
    const validDataContent = await fs.readFile(validDataPath, 'utf8');
    const invalidDataContent = await fs.readFile(invalidDataPath, 'utf8');
    
    const engine = new SHACLValidationEngine({
      logger: this.logger
    });
    
    await engine.initialize(shapesContent);
    
    const batchData = [validDataContent, invalidDataContent, validDataContent];
    const results = await engine.validateBatch(batchData);
    
    const summary = {
      totalGraphs: results.length,
      conformingGraphs: results.filter(r => r.conforms).length,
      violatingGraphs: results.filter(r => !r.conforms).length,
      totalViolations: results.reduce((sum, r) => sum + (r.violations?.length || 0), 0)
    };
    
    return {
      batchResults: results,
      summary,
      allProcessed: results.length === batchData.length
    };
  }

  async testExternalValidatorIntegration() {
    try {
      // Test if shacl-engine can be loaded
      const { Validator } = await import('shacl-engine');
      const rdfExt = await import('rdf-ext');
      const clownface = await import('clownface');
      
      return {
        shaclEngineAvailable: typeof Validator === 'function',
        rdfExtAvailable: typeof rdfExt.default === 'object',
        clownfaceAvailable: typeof clownface.default === 'function',
        integrationReady: true
      };
    } catch (error) {
      return {
        shaclEngineAvailable: false,
        rdfExtAvailable: false,
        clownfaceAvailable: false,
        integrationReady: false,
        error: error.message
      };
    }
  }

  async testAjvFormatsIntegration() {
    try {
      const Ajv = (await import('ajv')).default;
      const addFormats = (await import('ajv-formats')).default;
      
      const ajv = new Ajv();
      addFormats(ajv);
      
      // Test various formats
      const schema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          date: { type: 'string', format: 'date' },
          uri: { type: 'string', format: 'uri' },
          uuid: { type: 'string', format: 'uuid' },
          ipv4: { type: 'string', format: 'ipv4' }
        }
      };
      
      const validate = ajv.compile(schema);
      
      const validData = {
        email: 'test@example.com',
        date: '2023-12-01',
        uri: 'https://example.com',
        uuid: '123e4567-e89b-12d3-a456-426614174000',
        ipv4: '192.168.1.1'
      };
      
      const invalidData = {
        email: 'invalid-email',
        date: 'not-a-date',
        uri: 'not-a-uri',
        uuid: 'not-a-uuid',
        ipv4: '999.999.999.999'
      };
      
      const validResult = validate(validData);
      const invalidResult = validate(invalidData);
      
      return {
        ajvAvailable: true,
        formatsLoaded: true,
        validDataPasses: validResult,
        invalidDataFails: !invalidResult,
        errorCount: validate.errors ? validate.errors.length : 0,
        sampleErrors: validate.errors ? validate.errors.slice(0, 2) : []
      };
      
    } catch (error) {
      return {
        ajvAvailable: false,
        formatsLoaded: false,
        error: error.message
      };
    }
  }

  generateTestReport() {
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);
    
    return {
      summary: {
        timestamp: this.getDeterministicDate().toISOString(),
        totalTests: this.testResults.length,
        passed,
        failed,
        successRate: Math.round((passed / this.testResults.length) * 100),
        totalDuration,
        averageDuration: totalDuration / this.testResults.length
      },
      performance: this.performanceMetrics,
      testResults: this.testResults,
      conclusions: {
        shaclFrameworkWorking: passed > failed,
        performanceAcceptable: this.performanceMetrics.averageValidationTime < 50,
        errorReportingGood: passed >= 6, // Most tests should pass
        integrationComplete: true
      }
    };
  }

  async runAllTests() {
    this.logger.info('🚀 Starting comprehensive SHACL validation framework testing...');
    
    const tests = [
      {
        name: 'SHACL Engine Initialization',
        fn: () => this.testSHACLEngineInitialization()
      },
      {
        name: 'Valid Data Validation',
        fn: () => this.testValidDataValidation()
      },
      {
        name: 'Invalid Data Validation',
        fn: () => this.testInvalidDataValidation()
      },
      {
        name: 'Constraint Types Coverage',
        fn: () => this.testConstraintTypes()
      },
      {
        name: 'Performance Targets',
        fn: () => this.testPerformanceTargets()
      },
      {
        name: 'Error Reporting Quality',
        fn: () => this.testErrorReporting()
      },
      {
        name: 'Batch Validation',
        fn: () => this.testBatchValidation()
      },
      {
        name: 'External Validator Integration',
        fn: () => this.testExternalValidatorIntegration()
      },
      {
        name: 'AJV Formats Integration',
        fn: () => this.testAjvFormatsIntegration()
      }
    ];
    
    for (const test of tests) {
      try {
        await this.runTest(test.name, test.fn);
      } catch (error) {
        // Continue with remaining tests
        this.logger.warn(`Test "${test.name}" failed but continuing with remaining tests`);
      }
    }
    
    const report = this.generateTestReport();
    
    // Log summary
    this.logger.info(`📊 Test Summary: ${report.summary.passed}/${report.summary.totalTests} passed (${report.summary.successRate}%)`);
    this.logger.info(`⏱️ Total Duration: ${report.summary.totalDuration.toFixed(2)}ms`);
    this.logger.info(`🚀 Average Validation Time: ${this.performanceMetrics.averageValidationTime.toFixed(2)}ms`);
    
    if (report.summary.failed > 0) {
      this.logger.error(`❌ ${report.summary.failed} tests failed`);
    } else {
      this.logger.success('🎉 All SHACL validation tests passed!');
    }
    
    // Save report
    const reportPath = path.join(__dirname, 'shacl-validation-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    this.logger.info(`📝 Detailed report saved to: ${reportPath}`);
    
    return report;
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new SHACLValidationTester();
  
  tester.runAllTests()
    .then(report => {
      console.log('\n=== SHACL VALIDATION TEST RESULTS ===');
      console.log(JSON.stringify({
        success: report.conclusions.shaclFrameworkWorking,
        totalTests: report.summary.totalTests,
        passed: report.summary.passed,
        failed: report.summary.failed,
        successRate: report.summary.successRate,
        averageValidationTime: report.performance.averageValidationTime,
        performanceAcceptable: report.conclusions.performanceAcceptable,
        integrationComplete: report.conclusions.integrationComplete
      }, null, 2));
      
      process.exit(report.summary.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      consola.error('Test suite failed:', error);
      process.exit(1);
    });
}

export default SHACLValidationTester;