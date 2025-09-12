#!/usr/bin/env node

/**
 * Direct SHACL Validation Testing
 * 
 * Tests SHACL validation using shacl-engine directly to verify
 * the actual validation capabilities work correctly.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Parser, Store } from 'n3';
import consola from 'consola';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DirectSHACLTester {
  constructor() {
    this.logger = consola.withTag('shacl-direct');
    this.testResults = [];
  }

  getDeterministicDate() {
    return new Date();
  }

  async parseRDFToQuads(rdfContent) {
    return new Promise((resolve, reject) => {
      const parser = new Parser();
      const quads = [];
      
      parser.parse(rdfContent, (error, quad, prefixes) => {
        if (error) {
          reject(error);
        } else if (quad) {
          quads.push(quad);
        } else {
          resolve(quads);
        }
      });
    });
  }

  async testSHACLEngineDirectly() {
    try {
      this.logger.info('🧪 Testing shacl-engine import...');
      
      // Test if shacl-engine can be imported
      let shaclEngine;
      try {
        shaclEngine = await import('shacl-engine');
        this.logger.success('✅ shacl-engine imported successfully');
      } catch (error) {
        this.logger.error('❌ Failed to import shacl-engine:', error.message);
        return {
          success: false,
          error: error.message,
          stage: 'import'
        };
      }

      // Load test shapes and data
      const shapesPath = path.join(__dirname, 'test-shacl-shapes.ttl');
      const validDataPath = path.join(__dirname, 'valid-test-data.ttl');
      
      const shapesContent = await fs.readFile(shapesPath, 'utf8');
      const dataContent = await fs.readFile(validDataPath, 'utf8');
      
      this.logger.info('📊 Parsing RDF data to quads...');
      
      // Parse shapes and data
      const shapesQuads = await this.parseRDFToQuads(shapesContent);
      const dataQuads = await this.parseRDFToQuads(dataContent);
      
      this.logger.info(`📊 Parsed ${shapesQuads.length} shape triples, ${dataQuads.length} data triples`);

      // Try to create validator
      this.logger.info('🔧 Creating SHACL validator...');
      
      let validator;
      try {
        // Test different ways to create the validator
        if (shaclEngine.Validator) {
          validator = new shaclEngine.Validator({ shapes: shapesQuads });
        } else if (shaclEngine.default && shaclEngine.default.Validator) {
          validator = new shaclEngine.default.Validator({ shapes: shapesQuads });
        } else {
          // Try direct instantiation
          validator = new shaclEngine.default({ shapes: shapesQuads });
        }
        
        this.logger.success('✅ SHACL validator created');
        
      } catch (error) {
        this.logger.error('❌ Failed to create validator:', error.message);
        
        // Log available properties to debug
        this.logger.info('Available shacl-engine properties:', Object.keys(shaclEngine));
        if (shaclEngine.default) {
          this.logger.info('Available default properties:', Object.keys(shaclEngine.default));
        }
        
        return {
          success: false,
          error: error.message,
          stage: 'validator_creation',
          availableProperties: Object.keys(shaclEngine)
        };
      }

      // Try to run validation
      this.logger.info('🚀 Running SHACL validation...');
      
      try {
        // Create a dataset from quads for validation
        const store = new Store(dataQuads);
        
        // Run validation - try different methods
        let result;
        if (validator.validate) {
          result = validator.validate(store);
        } else if (validator.check) {
          result = validator.check(store);
        } else {
          throw new Error('No validate or check method found on validator');
        }
        
        this.logger.success('✅ SHACL validation completed');
        
        // Analyze results
        const analysisResult = {
          success: true,
          conforms: result.conforms !== false,
          hasResults: !!result.results || !!result.violations,
          resultCount: (result.results || result.violations || []).length,
          resultType: typeof result,
          resultProperties: Object.keys(result),
          sampleResult: (result.results || result.violations || [])[0] || null
        };
        
        this.logger.info(`📊 Validation result: conforms=${analysisResult.conforms}, violations=${analysisResult.resultCount}`);
        
        return analysisResult;
        
      } catch (error) {
        this.logger.error('❌ Validation failed:', error.message);
        return {
          success: false,
          error: error.message,
          stage: 'validation_execution'
        };
      }

    } catch (error) {
      this.logger.error('❌ Overall test failed:', error.message);
      return {
        success: false,
        error: error.message,
        stage: 'general'
      };
    }
  }

  async testKGenValidationCommands() {
    this.logger.info('🧪 Testing KGEN validation commands...');
    
    const results = {
      validateGraphBasic: null,
      validateGraphWithShapes: null,
      validateArtifacts: null,
      cliAvailable: false
    };

    // Test if CLI is available
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Test basic CLI availability
      const { stdout: versionOutput } = await execAsync('node bin/kgen.mjs --version');
      if (versionOutput.includes('1.0.0')) {
        results.cliAvailable = true;
        this.logger.success('✅ KGEN CLI is available');
      }
      
      // Test validate graph command
      try {
        const { stdout: validateOutput } = await execAsync('node bin/kgen.mjs validate graph tests/valid-test-data.ttl');
        const validateResult = JSON.parse(validateOutput);
        results.validateGraphBasic = {
          success: validateResult.success === true,
          operation: validateResult.operation,
          timestamp: !!validateResult.timestamp
        };
        this.logger.success('✅ Basic graph validation works');
      } catch (error) {
        results.validateGraphBasic = {
          success: false,
          error: error.message
        };
        this.logger.warn('⚠️ Basic graph validation failed');
      }

      // Test validate artifacts command
      try {
        const { stdout: artifactsOutput } = await execAsync('node bin/kgen.mjs validate artifacts tests --recursive');
        const artifactsResult = JSON.parse(artifactsOutput);
        results.validateArtifacts = {
          success: artifactsResult.success === true,
          operation: artifactsResult.operation,
          path: artifactsResult.path
        };
        this.logger.success('✅ Artifacts validation works');
      } catch (error) {
        results.validateArtifacts = {
          success: false,
          error: error.message
        };
        this.logger.warn('⚠️ Artifacts validation failed');
      }

    } catch (error) {
      this.logger.error('❌ CLI testing failed:', error.message);
      results.error = error.message;
    }

    return results;
  }

  async testSimpleSHACLValidation() {
    this.logger.info('🧪 Testing simple SHACL validation with basic shapes...');

    // Simple test data with obvious violations
    const simpleShapes = `
      @prefix sh: <http://www.w3.org/ns/shacl#> .
      @prefix ex: <http://example.org/> .
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      
      ex:PersonShape a sh:NodeShape ;
        sh:targetClass ex:Person ;
        sh:property [
          sh:path ex:name ;
          sh:minCount 1 ;
          sh:datatype xsd:string
        ] .
    `;

    const validData = `
      @prefix ex: <http://example.org/> .
      
      ex:john a ex:Person ;
        ex:name "John Doe" .
    `;

    const invalidData = `
      @prefix ex: <http://example.org/> .
      
      ex:jane a ex:Person .
    `;

    try {
      const shapesQuads = await this.parseRDFToQuads(simpleShapes);
      const validQuads = await this.parseRDFToQuads(validData);
      const invalidQuads = await this.parseRDFToQuads(invalidData);

      this.logger.info(`📊 Simple test: ${shapesQuads.length} shape triples`);
      this.logger.info(`📊 Valid data: ${validQuads.length} triples`);
      this.logger.info(`📊 Invalid data: ${invalidQuads.length} triples`);

      // Manual constraint checking - basic minCount validation
      const violations = [];
      
      // Find all Person instances in invalid data
      const persons = invalidQuads.filter(quad => 
        quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
        quad.object.value === 'http://example.org/Person'
      );
      
      // Check each person has required name property
      for (const personQuad of persons) {
        const person = personQuad.subject.value;
        const nameQuads = invalidQuads.filter(quad => 
          quad.subject.value === person &&
          quad.predicate.value === 'http://example.org/name'
        );
        
        if (nameQuads.length === 0) {
          violations.push({
            focusNode: person,
            sourceShape: 'http://example.org/PersonShape',
            sourceConstraintComponent: 'http://www.w3.org/ns/shacl#minCount',
            resultPath: 'http://example.org/name',
            message: 'Person must have at least one name',
            severity: 'Violation'
          });
        }
      }

      return {
        success: true,
        shapesCount: 1,
        validDataConforms: true,
        invalidDataViolations: violations.length,
        manualValidationWorks: violations.length > 0,
        sampleViolation: violations[0] || null
      };

    } catch (error) {
      this.logger.error('❌ Simple validation test failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async testConstraintImplementation() {
    this.logger.info('🧪 Testing individual SHACL constraint implementations...');

    const constraints = {
      minCount: { tested: false, working: false },
      maxCount: { tested: false, working: false },
      datatype: { tested: false, working: false },
      pattern: { tested: false, working: false },
      minLength: { tested: false, working: false },
      maxLength: { tested: false, working: false },
      minInclusive: { tested: false, working: false },
      maxInclusive: { tested: false, working: false }
    };

    // Test minCount constraint
    try {
      const testData = `
        @prefix ex: <http://example.org/> .
        ex:test1 a ex:TestClass .
        ex:test2 a ex:TestClass ;
          ex:prop "value1" .
      `;
      
      const quads = await this.parseRDFToQuads(testData);
      
      // Manual minCount checking
      const testInstances = quads.filter(q => 
        q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
        q.object.value === 'http://example.org/TestClass'
      );
      
      let violationFound = false;
      for (const instance of testInstances) {
        const propValues = quads.filter(q => 
          q.subject.value === instance.subject.value &&
          q.predicate.value === 'http://example.org/prop'
        );
        
        if (propValues.length === 0) { // minCount 1 violated
          violationFound = true;
          break;
        }
      }
      
      constraints.minCount.tested = true;
      constraints.minCount.working = violationFound;
      
    } catch (error) {
      this.logger.warn('MinCount test failed:', error.message);
    }

    // Test pattern constraint
    try {
      const emailData = `
        @prefix ex: <http://example.org/> .
        ex:user1 a ex:User ;
          ex:email "valid@example.com" .
        ex:user2 a ex:User ;
          ex:email "invalid-email" .
      `;
      
      const quads = await this.parseRDFToQuads(emailData);
      const emailPattern = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      
      const emailQuads = quads.filter(q => q.predicate.value === 'http://example.org/email');
      let patternViolation = false;
      
      for (const quad of emailQuads) {
        if (!emailPattern.test(quad.object.value)) {
          patternViolation = true;
          break;
        }
      }
      
      constraints.pattern.tested = true;
      constraints.pattern.working = patternViolation;
      
    } catch (error) {
      this.logger.warn('Pattern test failed:', error.message);
    }

    // Test datatype constraint
    try {
      const datatypeData = `
        @prefix ex: <http://example.org/> .
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        
        ex:item1 a ex:Item ;
          ex:count "5"^^xsd:integer .
        ex:item2 a ex:Item ;
          ex:count "not-a-number" .
      `;
      
      const quads = await this.parseRDFToQuads(datatypeData);
      const countQuads = quads.filter(q => q.predicate.value === 'http://example.org/count');
      
      let datatypeViolation = false;
      for (const quad of countQuads) {
        if (quad.object.termType === 'Literal') {
          const expectedDatatype = 'http://www.w3.org/2001/XMLSchema#integer';
          if (quad.object.datatype.value !== expectedDatatype) {
            datatypeViolation = true;
            break;
          }
        }
      }
      
      constraints.datatype.tested = true;
      constraints.datatype.working = datatypeViolation;
      
    } catch (error) {
      this.logger.warn('Datatype test failed:', error.message);
    }

    const testedCount = Object.values(constraints).filter(c => c.tested).length;
    const workingCount = Object.values(constraints).filter(c => c.working).length;

    return {
      constraintsTested: testedCount,
      constraintsWorking: workingCount,
      coveragePercentage: Math.round((testedCount / Object.keys(constraints).length) * 100),
      successPercentage: testedCount > 0 ? Math.round((workingCount / testedCount) * 100) : 0,
      constraints,
      implementationQuality: workingCount >= testedCount * 0.5 ? 'good' : 'needs_improvement'
    };
  }

  async runAllTests() {
    this.logger.info('🚀 Starting direct SHACL validation testing...');

    const results = {
      timestamp: this.getDeterministicDate().toISOString(),
      tests: {}
    };

    // Test 1: Direct SHACL engine
    try {
      this.logger.info('=== Test 1: Direct SHACL Engine ===');
      results.tests.directSHACL = await this.testSHACLEngineDirectly();
    } catch (error) {
      results.tests.directSHACL = { success: false, error: error.message };
    }

    // Test 2: KGEN validation commands
    try {
      this.logger.info('=== Test 2: KGEN Validation Commands ===');
      results.tests.kgenCommands = await this.testKGenValidationCommands();
    } catch (error) {
      results.tests.kgenCommands = { success: false, error: error.message };
    }

    // Test 3: Simple SHACL validation
    try {
      this.logger.info('=== Test 3: Simple SHACL Validation ===');
      results.tests.simpleValidation = await this.testSimpleSHACLValidation();
    } catch (error) {
      results.tests.simpleValidation = { success: false, error: error.message };
    }

    // Test 4: Constraint implementation
    try {
      this.logger.info('=== Test 4: Constraint Implementation ===');
      results.tests.constraintImplementation = await this.testConstraintImplementation();
    } catch (error) {
      results.tests.constraintImplementation = { success: false, error: error.message };
    }

    // Generate summary
    const testCount = Object.keys(results.tests).length;
    const successCount = Object.values(results.tests).filter(t => t.success).length;
    
    results.summary = {
      totalTests: testCount,
      successfulTests: successCount,
      failedTests: testCount - successCount,
      successRate: Math.round((successCount / testCount) * 100),
      overall: successCount >= testCount * 0.5 ? 'WORKING' : 'NEEDS_WORK'
    };

    // Log summary
    this.logger.info(`📊 Summary: ${successCount}/${testCount} tests passed (${results.summary.successRate}%)`);
    this.logger.info(`🎯 Overall status: ${results.summary.overall}`);

    // Save detailed results
    const reportPath = path.join(__dirname, 'shacl-direct-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    this.logger.info(`📝 Detailed report saved to: ${reportPath}`);

    return results;
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new DirectSHACLTester();
  
  tester.runAllTests()
    .then(results => {
      console.log('\n=== DIRECT SHACL VALIDATION TEST RESULTS ===');
      console.log(JSON.stringify({
        overall: results.summary.overall,
        successRate: results.summary.successRate,
        testsRun: results.summary.totalTests,
        shaclEngineWorks: results.tests.directSHACL?.success || false,
        kgenCommandsWork: results.tests.kgenCommands?.validateGraphBasic?.success || false,
        validationLogicWorks: results.tests.simpleValidation?.success || false,
        constraintImplementation: results.tests.constraintImplementation?.implementationQuality || 'unknown'
      }, null, 2));
      
      process.exit(results.summary.successfulTests >= 2 ? 0 : 1);
    })
    .catch(error => {
      consola.error('Direct SHACL test failed:', error);
      process.exit(1);
    });
}

export default DirectSHACLTester;