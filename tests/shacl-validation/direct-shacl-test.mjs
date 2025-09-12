#!/usr/bin/env node

/**
 * DIRECT SHACL VALIDATION TEST - No Wrapper
 * 
 * Tests SHACL validation directly using shacl-engine without any wrapper
 * to verify actual constraint violation detection works.
 * 
 * This test will prove that SHACL validation actually works by showing
 * real constraint violations with exact error messages.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Validator } from 'shacl-engine';
import { Parser } from 'n3';
import rdfExt from 'rdf-ext';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse RDF/Turtle string to dataset
 */
async function parseToDataset(turtle, factory = rdfExt) {
  return new Promise((resolve, reject) => {
    const parser = new Parser();
    const quads = [];
    
    parser.parse(turtle, (error, quad, prefixes) => {
      if (error) {
        reject(error);
      } else if (quad) {
        quads.push(quad);
      } else {
        // End of parsing
        const dataset = factory.dataset(quads);
        resolve(dataset);
      }
    });
  });
}

/**
 * Direct SHACL validation test
 */
async function testDirectSHACLValidation() {
  console.log('🧪 DIRECT SHACL VALIDATION TEST - No Wrappers\n');

  try {
    // Simple SHACL shapes for basic validation
    const simpleShapes = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:PersonShape
    a sh:NodeShape ;
    sh:targetClass ex:Person ;
    sh:property [
        sh:path ex:name ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:message "Person must have exactly one name"
    ] ;
    sh:property [
        sh:path ex:email ;
        sh:maxCount 1 ;
        sh:datatype xsd:string ;
        sh:pattern "^[^@]+@[^@]+\\.[^@]+$" ;
        sh:message "Email must be a valid email address"
    ] ;
    sh:property [
        sh:path ex:age ;
        sh:maxCount 1 ;
        sh:datatype xsd:integer ;
        sh:minInclusive 0 ;
        sh:maxInclusive 150 ;
        sh:message "Age must be between 0 and 150"
    ] .
`;

    // Valid test data
    const validData = `
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:john a ex:Person ;
    ex:name "John Smith" ;
    ex:email "john@example.com" ;
    ex:age "30"^^xsd:integer .

ex:jane a ex:Person ;
    ex:name "Jane Doe" ;
    ex:email "jane@company.org" .
`;

    // Invalid test data - should generate violations
    const invalidData = `
@prefix ex: <http://example.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Missing required name
ex:person1 a ex:Person ;
    ex:email "test@example.com" .

# Invalid email format
ex:person2 a ex:Person ;
    ex:name "Bob Test" ;
    ex:email "invalid-email" .

# Age out of range
ex:person3 a ex:Person ;
    ex:name "Old Person" ;
    ex:age "200"^^xsd:integer .

# Multiple names (violates maxCount 1)
ex:person4 a ex:Person ;
    ex:name "First Name", "Second Name" ;
    ex:email "multi@example.com" .
`;

    console.log('📋 Parsing SHACL shapes...');
    const shapesDataset = await parseToDataset(simpleShapes);
    console.log(`   ✅ Shapes parsed: ${shapesDataset.size} triples`);

    console.log('📋 Parsing valid test data...');
    const validDataDataset = await parseToDataset(validData);
    console.log(`   ✅ Valid data parsed: ${validDataDataset.size} triples`);

    console.log('📋 Parsing invalid test data...');
    const invalidDataDataset = await parseToDataset(invalidData);
    console.log(`   ✅ Invalid data parsed: ${invalidDataDataset.size} triples`);

    console.log('\n🔧 Initializing SHACL validator...');
    const validator = new Validator(shapesDataset, { factory: rdfExt });
    console.log('   ✅ SHACL validator initialized');

    // Test 1: Valid data should pass validation
    console.log('\n🧪 TEST 1: Validating VALID data (should conform)');
    let validReport;
    try {
      validReport = validator.validate(validDataDataset);
      console.log('   Raw report structure:', typeof validReport, validReport ? Object.keys(validReport) : 'null');
    } catch (error) {
      console.log('   ❌ Validation error:', error.message);
      validReport = { conforms: false, results: [], error: error.message };
    }
    
    console.log('📊 VALID DATA RESULTS:');
    console.log(`   Conforms: ${validReport?.conforms}`);
    console.log(`   Violations: ${validReport?.results?.length || 0}`);
    
    if (validReport?.results?.length > 0) {
      console.log('   ⚠️ Unexpected violations in valid data:');
      validReport.results.forEach((result, i) => {
        console.log(`     ${i+1}. Focus: ${result.focusNode?.value}`);
        console.log(`        Path: ${result.resultPath?.value}`);
        console.log(`        Message: ${result.resultMessage?.value}`);
        console.log(`        Severity: ${result.resultSeverity?.value}`);
      });
    }

    // Test 2: Invalid data should generate violations
    console.log('\n🧪 TEST 2: Validating INVALID data (should NOT conform)');
    let invalidReport;
    try {
      invalidReport = validator.validate(invalidDataDataset);
      console.log('   Raw report structure:', typeof invalidReport, invalidReport ? Object.keys(invalidReport) : 'null');
    } catch (error) {
      console.log('   ❌ Validation error:', error.message);
      invalidReport = { conforms: false, results: [], error: error.message };
    }
    
    console.log('📊 INVALID DATA RESULTS:');
    console.log(`   Conforms: ${invalidReport?.conforms}`);
    console.log(`   Violations: ${invalidReport?.results?.length || 0}`);
    
    if (invalidReport?.results?.length > 0) {
      console.log('   🎯 CONSTRAINT VIOLATIONS DETECTED:');
      invalidReport.results.forEach((result, i) => {
        console.log(`     ${i+1}. Focus: ${result.focusNode?.value || 'unknown'}`);
        console.log(`        Path: ${result.resultPath?.value || 'unknown'}`);
        console.log(`        Component: ${result.sourceConstraintComponent?.value?.split('#').pop() || 'unknown'}`);
        console.log(`        Message: ${result.resultMessage?.value || 'No message'}`);
        console.log(`        Severity: ${result.resultSeverity?.value?.split('#').pop() || 'Violation'}`);
        console.log(`        Value: ${result.value?.value || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('   ❌ ERROR: No violations detected in invalid data!');
    }

    // Analysis
    console.log('🔍 VALIDATION ANALYSIS:');
    console.log(`   Valid data conforms: ${validReport.conforms}`);
    console.log(`   Invalid data conforms: ${invalidReport.conforms}`);
    console.log(`   Violations found: ${invalidReport?.results?.length || 0}`);
    
    const constraintTypes = new Set();
    (invalidReport?.results || []).forEach(result => {
      if (result.sourceConstraintComponent) {
        const component = result.sourceConstraintComponent.value.split('#').pop();
        constraintTypes.add(component);
      }
    });
    
    console.log(`   Constraint types tested: ${Array.from(constraintTypes).join(', ')}`);

    // Test success criteria
    const testsPass = [
      validReport?.conforms === true,
      invalidReport?.conforms === false,
      (invalidReport?.results?.length || 0) >= 4, // Should have at least 4 violations
      constraintTypes.size >= 3 // Should test multiple constraint types
    ];

    const overallSuccess = testsPass.every(test => test);
    
    console.log('\n🎯 TEST RESULTS:');
    console.log(`   ✅ Valid data passes: ${testsPass[0]}`);
    console.log(`   ✅ Invalid data fails: ${testsPass[1]}`);
    console.log(`   ✅ Violations detected: ${testsPass[2]} (${invalidReport?.results?.length || 0} >= 4)`);
    console.log(`   ✅ Constraint coverage: ${testsPass[3]} (${constraintTypes.size} >= 3)`);
    console.log(`   🎉 OVERALL SUCCESS: ${overallSuccess}`);

    // Generate detailed report
    const report = {
      timestamp: new Date().toISOString(),
      testName: 'Direct SHACL Validation Test',
      success: overallSuccess,
      results: {
        validData: {
          conforms: validReport?.conforms,
          violations: validReport?.results?.length || 0
        },
        invalidData: {
          conforms: invalidReport?.conforms,
          violations: invalidReport?.results?.length || 0,
          violationDetails: (invalidReport?.results || []).map(r => ({
            focusNode: r.focusNode?.value,
            path: r.resultPath?.value,
            constraintComponent: r.sourceConstraintComponent?.value?.split('#').pop(),
            message: r.resultMessage?.value,
            severity: r.resultSeverity?.value?.split('#').pop(),
            value: r.value?.value
          }))
        },
        analysis: {
          constraintTypes: Array.from(constraintTypes),
          constraintTypesCovered: constraintTypes.size,
          totalViolations: invalidReport?.results?.length || 0
        }
      }
    };

    // Save report
    const reportPath = path.join(__dirname, 'direct-shacl-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📝 Detailed report saved: ${reportPath}`);

    if (overallSuccess) {
      console.log('\n🎉 SHACL VALIDATION WORKS! Constraint detection verified!');
    } else {
      console.log('\n❌ SHACL VALIDATION ISSUES DETECTED');
    }

    return report;

  } catch (error) {
    console.error('\n💥 Direct SHACL test failed:', error);
    
    const errorReport = {
      timestamp: new Date().toISOString(),
      testName: 'Direct SHACL Validation Test',
      success: false,
      error: error.message,
      stack: error.stack
    };

    const reportPath = path.join(__dirname, 'direct-shacl-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(errorReport, null, 2));

    throw error;
  }
}

// Execute test if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDirectSHACLValidation()
    .then(report => {
      console.log('\n=== FINAL VERIFICATION ===');
      console.log(`SUCCESS: ${report.success}`);
      console.log(`VIOLATIONS FOUND: ${report.results?.invalidData?.violations || 0}`);
      console.log(`CONSTRAINT TYPES: ${report.results?.analysis?.constraintTypesCovered || 0}`);
      
      process.exit(report.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Direct SHACL test failed:', error.message);
      process.exit(1);
    });
}

export default testDirectSHACLValidation;