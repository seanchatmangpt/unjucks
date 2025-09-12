#!/usr/bin/env node

/**
 * KGEN Integration Orchestrator - End-to-End System Test
 * 
 * Tests the complete workflow:
 * 1. Graph → Template → Artifact → Attestation → Drift detection
 * 2. Validates all components work together in production mode
 * 3. Verifies dark-matter principles and URI schemes
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

console.log('🚀 KGEN Integration Orchestrator - End-to-End Test');
console.log('===================================================');

// Test configuration
const testGraph = join(projectRoot, 'test-graph.ttl');
const testTemplate = 'api-service';
const testDir = join(projectRoot, 'test-e2e-integration');

// Results tracker
const results = {
  tests: 0,
  passed: 0,
  failed: 0,
  errors: []
};

function runTest(name, command, expectedFields = []) {
  results.tests++;
  console.log(`\n📋 Testing: ${name}`);
  console.log(`   Command: ${command}`);
  
  try {
    const output = execSync(command, { 
      cwd: projectRoot, 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Parse JSON output
    let result;
    try {
      // Extract last JSON object from output
      const lines = output.split('\n').filter(line => line.trim());
      const jsonLine = lines[lines.length - 1];
      result = JSON.parse(jsonLine);
    } catch (parseError) {
      throw new Error(`Failed to parse JSON output: ${parseError.message}`);
    }
    
    // Validate success
    if (!result.success) {
      throw new Error(`Command failed: ${result.error || 'Unknown error'}`);
    }
    
    // Validate expected fields
    for (const field of expectedFields) {
      if (!(field in result)) {
        throw new Error(`Missing expected field: ${field}`);
      }
    }
    
    console.log(`   ✅ SUCCESS: ${result.operation || 'completed'}`);
    if (result.hash) console.log(`   📄 Hash: ${result.hash.slice(0, 16)}...`);
    if (result.outputPath) console.log(`   📁 Output: ${result.outputPath}`);
    if (result.contentHash) console.log(`   🔐 Content: ${result.contentHash.slice(0, 16)}...`);
    
    results.passed++;
    return result;
    
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    results.errors.push({ test: name, error: error.message, command });
    results.failed++;
    return null;
  }
}

function validateURISchemes(results) {
  console.log('\n🔗 Validating URI Schemes Integration');
  
  let uriTests = 0;
  let uriPassed = 0;
  
  // Check content:// URI scheme
  for (const result of results) {
    if (result && result.contentUri) {
      uriTests++;
      if (result.contentUri.startsWith('content://sha256/')) {
        console.log(`   ✅ Content URI valid: ${result.contentUri.slice(0, 32)}...`);
        uriPassed++;
      } else {
        console.log(`   ❌ Invalid content URI: ${result.contentUri}`);
      }
    }
  }
  
  console.log(`   📊 URI Schemes: ${uriPassed}/${uriTests} valid`);
  return uriPassed === uriTests;
}

function validateDarkMatter(results) {
  console.log('\n🌌 Validating Dark-Matter Principles');
  
  const principles = {
    deterministic: 0,
    contentAddressable: 0,
    reproducible: 0,
    attested: 0
  };
  
  let total = 0;
  
  for (const result of results) {
    if (result) {
      total++;
      
      // Check deterministic
      if (result.deterministic === true) {
        principles.deterministic++;
        console.log(`   ✅ Deterministic: ${result.operation}`);
      }
      
      // Check content-addressable
      if (result.contentHash || result.hash) {
        principles.contentAddressable++;
        console.log(`   ✅ Content-addressable: ${result.operation}`);
      }
      
      // Check reproducible
      if (result.verification?.reproducible === true) {
        principles.reproducible++;
        console.log(`   ✅ Reproducible: ${result.operation}`);
      }
      
      // Check attested
      if (result.attestationPath) {
        principles.attested++;
        console.log(`   ✅ Attested: ${result.operation}`);
      }
    }
  }
  
  console.log(`   📊 Dark-Matter Compliance:`);
  console.log(`      Deterministic: ${principles.deterministic}/${total}`);
  console.log(`      Content-addressable: ${principles.contentAddressable}/${total}`);
  console.log(`      Reproducible: ${principles.reproducible}/${total}`);
  console.log(`      Attested: ${principles.attested}/${total}`);
  
  return (principles.deterministic + principles.contentAddressable + 
          principles.reproducible + principles.attested) >= (total * 2);
}

// Execute the complete workflow
console.log('\n🧪 Running End-to-End Integration Tests');

const testResults = [];

// Step 1: Graph hashing with semantic processing
testResults.push(runTest(
  'Graph Hash with Semantic Processing',
  `node bin/kgen.mjs graph hash ${testGraph}`,
  ['success', 'hash', 'contentUri', 'algorithm', 'deterministic']
));

// Step 2: Graph indexing
testResults.push(runTest(
  'Graph Index with Triple Processing',
  `node bin/kgen.mjs graph index ${testGraph}`,
  ['success', 'triples', 'subjects', 'predicates', 'objects']
));

// Step 3: Artifact generation
testResults.push(runTest(
  'Deterministic Artifact Generation',
  `node bin/kgen.mjs artifact generate --graph ${testGraph} --template ${testTemplate}`,
  ['success', 'outputPath', 'contentHash', 'attestationPath']
));

// Step 4: Drift detection
testResults.push(runTest(
  'Artifact Drift Detection',
  `node bin/kgen.mjs artifact drift .`,
  ['success', 'driftDetected', 'summary']
));

// Step 5: Project attestation
testResults.push(runTest(
  'Project-wide Cryptographic Attestation',
  `node bin/kgen.mjs project attest .`,
  ['success', 'attestationPath', 'summary']
));

// Step 6: Template discovery
testResults.push(runTest(
  'Template Discovery System',
  `node bin/kgen.mjs templates ls`,
  ['success', 'templates', 'count']
));

// Step 7: Rules discovery
testResults.push(runTest(
  'Reasoning Rules Discovery',
  `node bin/kgen.mjs rules ls`,
  ['success', 'rules', 'count']
));

// Step 8: Graph comparison
testResults.push(runTest(
  'Semantic Graph Comparison',
  `node bin/kgen.mjs graph diff ${testGraph} ${join(projectRoot, 'sample.ttl')}`,
  ['success', 'summary', 'impactScore', 'riskLevel']
));

// Validation phase
console.log('\n🔍 Validation Phase');

const uriValid = validateURISchemes(testResults);
const darkMatterValid = validateDarkMatter(testResults);

// Performance validation
console.log('\n⚡ Performance Validation');
const perfResult = runTest(
  'Performance Status Check',
  'node bin/kgen.mjs perf status',
  ['success', 'coldStart']
);

if (perfResult && perfResult.coldStart) {
  const coldStart = perfResult.coldStart;
  console.log(`   🚀 Cold Start: ${coldStart.elapsed}ms (target: ${coldStart.target}ms)`);
  console.log(`   📊 Status: ${coldStart.status}`);
}

// Final report
console.log('\n📋 FINAL INTEGRATION REPORT');
console.log('============================');
console.log(`✅ Tests Passed: ${results.passed}`);
console.log(`❌ Tests Failed: ${results.failed}`);
console.log(`📊 Total Tests: ${results.tests}`);
console.log(`🔗 URI Schemes Valid: ${uriValid ? 'YES' : 'NO'}`);
console.log(`🌌 Dark-Matter Principles: ${darkMatterValid ? 'COMPLIANT' : 'NON-COMPLIANT'}`);

if (results.errors.length > 0) {
  console.log('\n❌ ERRORS ENCOUNTERED:');
  results.errors.forEach(error => {
    console.log(`   - ${error.test}: ${error.error}`);
  });
}

// Production readiness assessment
const productionReady = (
  results.failed === 0 && 
  uriValid && 
  darkMatterValid && 
  results.passed >= 8
);

console.log(`\n🚀 PRODUCTION READY: ${productionReady ? 'YES' : 'NO'}`);

if (productionReady) {
  console.log('\n🎉 ALL SYSTEMS OPERATIONAL');
  console.log('   ✅ Graph processing with semantic validation');
  console.log('   ✅ Deterministic artifact generation');
  console.log('   ✅ Cryptographic attestation and provenance');
  console.log('   ✅ Drift detection and monitoring');
  console.log('   ✅ URI schemes and content addressing');
  console.log('   ✅ Dark-matter compliance');
  console.log('   ✅ Template and rules management');
  console.log('   ✅ End-to-end workflow integration');
} else {
  console.log('\n⚠️  SYSTEM NOT READY FOR PRODUCTION');
  process.exit(1);
}

// Write detailed report
const report = {
  timestamp: this.getDeterministicDate().toISOString(),
  summary: {
    testsRun: results.tests,
    testsPassed: results.passed,
    testsFailed: results.failed,
    productionReady: productionReady
  },
  validation: {
    uriSchemes: uriValid,
    darkMatterPrinciples: darkMatterValid
  },
  testResults: testResults.filter(r => r !== null),
  errors: results.errors
};

writeFileSync(
  join(projectRoot, 'integration-test-report.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n📄 Detailed report saved to: integration-test-report.json');
console.log('\n🎯 Integration Orchestrator Complete');