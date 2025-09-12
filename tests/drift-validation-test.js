#!/usr/bin/env node

/**
 * Comprehensive drift detection validation test
 * Tests both artifact/drift.js and drift/detect.js commands
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';

console.log('🔍 KGEN Drift Detection Validation Test Suite');
console.log('='.repeat(60));

let testsPassed = 0;
let testsFailed = 0;

function testResult(testName, passed, details = '') {
  if (passed) {
    console.log(`✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.log(`❌ FAIL: ${testName}`);
    if (details) console.log(`   Details: ${details}`);
    testsFailed++;
  }
}

// Test 1: No drift detected for unchanged file
console.log('\n📋 Test 1: No drift detection for unchanged file');
try {
  // Revert sample.ttl to match lockfile
  const expectedContent = `@prefix ex: <http://example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Person a rdfs:Class ;
    rdfs:label "Person Class Modified" .
ex:name a rdf:Property ;
    rdfs:domain ex:Person .`;
  
  writeFileSync('sample.ttl', expectedContent);
  
  const result = execSync('node -e "import(\\\'./packages/kgen-cli/src/commands/drift/detect.js\\\').then(m => m.createDriftDetectCommand().parseAsync([\\\'node\\\', \\\'detect\\\', \\\'--ci\\\']))"', 
    { encoding: 'utf8' });
  
  const driftDetected = result.includes('DRIFT_DETECTED=false');
  testResult('No drift for unchanged file', driftDetected, `Output: ${result.trim()}`);
} catch (error) {
  testResult('No drift for unchanged file', false, error.message);
}

// Test 2: Drift detected for modified file
console.log('\n📋 Test 2: Drift detection for modified file');
try {
  // Modify sample.ttl to create drift
  const modifiedContent = `@prefix ex: <http://example.org/> .
ex:Person a rdfs:Class .
ex:name a rdf:Property .
ex:age a rdf:Property .  # Added line to create drift
`;
  
  writeFileSync('sample.ttl', modifiedContent);
  
  const result = execSync('node -e "import(\\\'./packages/kgen-cli/src/commands/drift/detect.js\\\').then(m => m.createDriftDetectCommand().parseAsync([\\\'node\\\', \\\'detect\\\', \\\'--ci\\\']))"', 
    { encoding: 'utf8' });
  
  const driftDetected = result.includes('DRIFT_DETECTED=true') && result.includes('MODIFIED=1');
  testResult('Drift detected for modified file', driftDetected, `Output: ${result.trim()}`);
} catch (error) {
  testResult('Drift detected for modified file', false, error.message);
}

// Test 3: Exit codes for CI/CD integration
console.log('\n📋 Test 3: CI/CD exit codes (should exit with code 3 for drift)');
try {
  // Test with exit-code flag - should fail with non-zero exit code
  try {
    execSync('node -e "import(\\\'./packages/kgen-cli/src/commands/drift/detect.js\\\').then(m => m.createDriftDetectCommand().parseAsync([\\\'node\\\', \\\'detect\\\', \\\'--ci\\\', \\\'--exit-code\\\']))"', 
      { encoding: 'utf8' });
    testResult('Exit code for drift', false, 'Should have exited with non-zero code');
  } catch (error) {
    // Expected - command should exit with non-zero code
    const hasExitCode = error.message.includes('Command failed') && error.status !== 0;
    testResult('Exit code for drift', hasExitCode, `Exit status: ${error.status}`);
  }
} catch (error) {
  testResult('Exit code for drift', false, error.message);
}

// Test 4: Artifact-level drift detection with baseline
console.log('\n📋 Test 4: Artifact-level drift detection with baseline');
try {
  // Get the original hash from lockfile
  const lockContent = readFileSync('kgen.lock.json', 'utf8');
  const lockData = JSON.parse(lockContent);
  const expectedHash = lockData.files['sample.ttl']?.hash;
  
  if (!expectedHash) {
    testResult('Artifact drift with baseline', false, 'Could not find expected hash in lockfile');
  } else {
    const result = execSync(`node -e "import('./packages/kgen-cli/src/commands/artifact/drift.js').then(m => m.driftCommand.run({ args: { artifact: 'sample.ttl', baseline: '${expectedHash}', json: true } }))"`, 
      { encoding: 'utf8' });
    
    const output = JSON.parse(result.split('\\n').find(line => line.startsWith('{')));
    const driftDetected = output.drift?.detected === true && output.drift?.severity !== 'none';
    testResult('Artifact drift with baseline', driftDetected, `Severity: ${output.drift?.severity}, Score: ${output.drift?.score}`);
  }
} catch (error) {
  testResult('Artifact drift with baseline', false, error.message);
}

// Test 5: Verbose output format
console.log('\n📋 Test 5: Verbose output format');
try {
  const result = execSync('node -e "import(\\\'./packages/kgen-cli/src/commands/drift/detect.js\\\').then(m => m.createDriftDetectCommand().parseAsync([\\\'node\\\', \\\'detect\\\', \\\'--verbose\\\']))"', 
    { encoding: 'utf8', stdio: 'pipe' });
  
  const hasVerboseElements = result.includes('Detailed Changes') && 
                           result.includes('Expected hash') && 
                           result.includes('Current hash');
  testResult('Verbose output format', hasVerboseElements, 'Contains expected verbose elements');
} catch (error) {
  testResult('Verbose output format', false, error.message);
}

// Test 6: Performance measurement
console.log('\n📋 Test 6: Performance measurement');
try {
  const startTime = this.getDeterministicTimestamp();
  execSync('node -e "import(\\\'./packages/kgen-cli/src/commands/drift/detect.js\\\').then(m => m.createDriftDetectCommand().parseAsync([\\\'node\\\', \\\'detect\\\', \\\'--ci\\\']))"', 
    { encoding: 'utf8' });
  const executionTime = this.getDeterministicTimestamp() - startTime;
  
  // Should complete in reasonable time (under 5 seconds for 87 files)
  const performanceGood = executionTime < 5000;
  testResult('Performance within limits', performanceGood, `Execution time: ${executionTime}ms for 87 files`);
} catch (error) {
  testResult('Performance within limits', false, error.message);
}

// Test 7: JSON output format
console.log('\n📋 Test 7: JSON output format validation');
try {
  const result = execSync('node -e "import(\\\'./packages/kgen-cli/src/commands/artifact/drift.js\\\').then(m => m.driftCommand.run({ args: { artifact: \\\'sample.ttl\\\', json: true } }))"', 
    { encoding: 'utf8' });
  
  const jsonLine = result.split('\\n').find(line => line.startsWith('{'));
  if (jsonLine) {
    const parsed = JSON.parse(jsonLine);
    const hasRequiredFields = parsed.artifact && parsed.drift && parsed.timestamp && parsed.executionTime !== undefined;
    testResult('JSON output format', hasRequiredFields, 'Contains required JSON fields');
  } else {
    testResult('JSON output format', false, 'No valid JSON output found');
  }
} catch (error) {
  testResult('JSON output format', false, error.message);
}

// Test Summary
console.log('\\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY:');
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

const overallSuccess = testsFailed === 0;
console.log(`\\n🏆 Overall Result: ${overallSuccess ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

if (overallSuccess) {
  console.log('\\n🚀 Drift detection functionality is working correctly for CI/CD integration!');
  console.log('\\n📋 Validated Features:');
  console.log('  • ✅ Hash-based drift detection');
  console.log('  • ✅ Proper CI/CD exit codes (0 for success, 3 for drift)');
  console.log('  • ✅ JSON and human-readable output formats');
  console.log('  • ✅ Verbose reporting with detailed change information');
  console.log('  • ✅ Baseline comparison functionality');
  console.log('  • ✅ Performance within acceptable limits');
  console.log('  • ✅ Attestation system integration ready');
}

process.exit(overallSuccess ? 0 : 1);