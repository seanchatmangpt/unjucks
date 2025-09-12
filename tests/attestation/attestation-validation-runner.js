/**
 * Attestation System Validation Runner
 * 
 * This runner validates the end-to-end cryptographic attestation generation
 * and verification workflow without test framework dependencies.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { performance } from 'perf_hooks';

// Import the attestation system components
import { AttestationGenerator } from '../../packages/kgen-core/src/provenance/attestation/generator.js';
import { AttestationVerifier } from '../../packages/kgen-core/src/attestation/verifier.js';
import { CryptoManager } from '../../packages/kgen-core/src/provenance/crypto/manager.js';

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };
  }
  
  test(name, testFn) {
    this.tests.push({ name, testFn });
  }
  
  async run() {
    console.log('🚀 Starting Attestation System Validation\n');
    
    for (const test of this.tests) {
      this.results.total++;
      const startTime = performance.now();
      
      try {
        await test.testFn();
        const duration = Math.round(performance.now() - startTime);
        console.log(`✅ ${test.name} (${duration}ms)`);
        this.results.passed++;
      } catch (error) {
        const duration = Math.round(performance.now() - startTime);
        console.log(`❌ ${test.name} (${duration}ms)`);
        console.log(`   Error: ${error.message}`);
        this.results.failed++;
        this.results.errors.push({ test: test.name, error: error.message, stack: error.stack });
      }
    }
    
    this.printSummary();
  }
  
  printSummary() {
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`Total tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Success rate: ${Math.round((this.results.passed / this.results.total) * 100)}%`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      for (const error of this.results.errors) {
        console.log(`  - ${error.test}: ${error.error}`);
      }
    }
    
    console.log(`\n${this.results.failed === 0 ? '✅ All tests passed!' : '❌ Some tests failed'}`);
  }
}

// Helper function to assert
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertDefined(value, message) {
  if (value === undefined || value === null) {
    throw new Error(message || 'Value should be defined');
  }
}

// Main validation function
async function runAttestationValidation() {
  const runner = new TestRunner();
  let tempDir;
  let attestationGenerator;
  let attestationVerifier;
  let cryptoManager;
  let testArtifacts = [];

  // Setup
  runner.test('Setup: Initialize attestation system', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'attestation-validation-'));
    
    cryptoManager = new CryptoManager({
      keyPath: path.join(tempDir, 'test-private.pem'),
      publicKeyPath: path.join(tempDir, 'test-public.pem'),
      keySize: 2048,
      autoGenerateKeys: true,
      keyPassphrase: 'test-secure-passphrase-123'
    });
    
    await cryptoManager.initialize();
    
    attestationGenerator = new AttestationGenerator({
      enableCryptographicSigning: true,
      cryptoManager: cryptoManager,  // Pass the shared instance
      hashAlgorithm: 'sha256',
      includeSystemInfo: true
    });
    
    // Don't call initialize() as it will create a new crypto manager
    
    attestationVerifier = new AttestationVerifier({
      hashAlgorithm: 'sha256',
      cacheVerificationResults: false
    });
    
    assertEqual(cryptoManager.state, 'ready', 'CryptoManager should be ready');
    console.log(`   Setup completed in: ${tempDir}`);
  });

  // Test 1: Generate Real Cryptographic Attestations
  runner.test('Test 1: Generate real cryptographic attestations', async () => {
    const testContent = `// Test JavaScript component
export class TestComponent {
  constructor(name) {
    this.name = name;
  }
  
  greet() {
    return \`Hello, \${this.name}!\`;
  }
}`;
    
    const testPath = path.join(tempDir, 'test-component.js');
    await fs.writeFile(testPath, testContent, 'utf8');
    
    const stats = await fs.stat(testPath);
    const hash = crypto.createHash('sha256').update(testContent).digest('hex');
    
    const context = {
      operationId: crypto.randomUUID(),
      type: 'generation',
      startTime: new Date(Date.now() - 1000),
      endTime: new Date(),
      templateId: 'test-template-001',
      agent: {
        id: 'test-agent-001',
        type: 'software',
        name: 'Test Generator Agent'
      },
      configuration: { mode: 'test' },
      integrityHash: hash
    };
    
    const artifactInfo = {
      id: crypto.randomUUID(),
      path: testPath,
      size: stats.size,
      hash: hash,
      type: 'javascript'
    };

    const attestation = await attestationGenerator.generateAttestation(context, artifactInfo);
    
    // Validate attestation structure
    assertDefined(attestation.attestationId, 'Attestation ID should be defined');
    assertDefined(attestation.artifact, 'Artifact metadata should be defined');
    assertDefined(attestation.provenance, 'Provenance should be defined');
    assertDefined(attestation.signature, 'Signature should be defined');
    assertDefined(attestation.signature.signature, 'Cryptographic signature should be defined');
    assertEqual(attestation.signature.algorithm, 'RSA-SHA256', 'Should use RSA-SHA256');
    
    // Write sidecar file
    const sidecarPath = await attestationGenerator.writeAttestationSidecar(testPath, attestation);
    assert(await fs.access(sidecarPath).then(() => true).catch(() => false), 'Sidecar file should exist');
    
    testArtifacts.push({
      artifactPath: testPath,
      sidecarPath,
      attestation,
      originalContent: testContent
    });
    
    console.log('   Generated attestation with real cryptographic signature');
  });

  // Test 2: Verify Cryptographic Signatures
  runner.test('Test 2: Verify cryptographic signatures', async () => {
    assert(testArtifacts.length > 0, 'Should have test artifacts');
    
    const testArtifact = testArtifacts[0];
    
    // Verify signature using crypto manager
    const signatureValid = await cryptoManager.verifyAttestation(testArtifact.attestation);
    assert(signatureValid, 'Cryptographic signature should be valid');
    
    // Verify using attestation verifier
    const verificationResult = await attestationVerifier.fastVerify(testArtifact.artifactPath);
    assert(verificationResult.verified, 'Attestation should be verified');
    assert(verificationResult.details.hash.verified, 'Hash verification should pass');
    
    console.log('   Cryptographic signature verification successful');
  });

  // Test 3: W3C PROV-O Compliance
  runner.test('Test 3: Validate W3C PROV-O compliance', async () => {
    const attestation = testArtifacts[0].attestation;
    const provenance = attestation.provenance;
    
    // Check PROV-O context
    assertDefined(provenance['@context'], 'PROV-O context should be defined');
    assertEqual(provenance['@context']['prov'], 'http://www.w3.org/ns/prov#', 'PROV namespace should be correct');
    
    // Check PROV-O activity
    assertDefined(provenance.activity, 'PROV-O activity should be defined');
    assertEqual(provenance.activity['@type'], 'prov:Activity', 'Should be PROV Activity');
    assertDefined(provenance.activity['prov:startedAtTime'], 'Start time should be defined');
    assertDefined(provenance.activity['prov:wasAssociatedWith'], 'Agent association should be defined');
    
    // Check PROV-O agent
    assertDefined(provenance.agent, 'PROV-O agent should be defined');
    assertEqual(provenance.agent['@type'], 'prov:SoftwareAgent', 'Should be SoftwareAgent');
    
    // Check canonical graph hash
    assertDefined(provenance.graphHash, 'Canonical graph hash should be defined');
    assertEqual(provenance.canonicalizationMethod, 'c14n-rdf', 'Should use RDF canonicalization');
    assert(provenance.graphHash.match(/^[a-f0-9]{64}$/i), 'Graph hash should be valid SHA-256');
    
    console.log('   W3C PROV-O compliance validated');
  });

  // Test 4: Tampering Detection
  runner.test('Test 4: Detect artifact tampering', async () => {
    const testArtifact = testArtifacts[0];
    const originalContent = await fs.readFile(testArtifact.artifactPath, 'utf8');
    
    // Tamper with the file
    const tamperedContent = originalContent + '\n// This is tampering';
    await fs.writeFile(testArtifact.artifactPath, tamperedContent);
    
    // Verification should fail
    const verificationResult = await attestationVerifier.fastVerify(testArtifact.artifactPath);
    assert(!verificationResult.verified, 'Verification should fail for tampered file');
    assert(!verificationResult.details.hash.verified, 'Hash verification should fail');
    assert(verificationResult.details.hash.reason.includes('mismatch'), 'Should detect hash mismatch');
    
    // Restore original content
    await fs.writeFile(testArtifact.artifactPath, originalContent);
    
    // Verification should pass again
    const restoredVerification = await attestationVerifier.fastVerify(testArtifact.artifactPath);
    assert(restoredVerification.verified, 'Verification should pass after restoration');
    
    console.log('   Successfully detected and handled tampering');
  });

  // Test 5: Performance with Different Key Sizes
  runner.test('Test 5: Performance test with multiple key sizes', async () => {
    const keySizes = [1024, 2048];
    const performanceResults = [];
    
    for (const keySize of keySizes) {
      const perfCryptoManager = new CryptoManager({
        keyPath: path.join(tempDir, `perf-private-${keySize}.pem`),
        publicKeyPath: path.join(tempDir, `perf-public-${keySize}.pem`),
        keySize: keySize,
        autoGenerateKeys: true,
        keyPassphrase: 'perf-test-passphrase'
      });
      
      const keyGenStart = performance.now();
      await perfCryptoManager.initialize();
      const keyGenTime = performance.now() - keyGenStart;
      
      const perfAttestationGenerator = new AttestationGenerator({
        enableCryptographicSigning: true,
        cryptoManager: perfCryptoManager  // Use the shared instance
      });
      // Don't call initialize() as it will create a new crypto manager
      
      // Create test content
      const testContent = 'a'.repeat(1000); // 1KB test
      const testPath = path.join(tempDir, `perf-test-${keySize}.txt`);
      await fs.writeFile(testPath, testContent);
      
      const context = {
        operationId: crypto.randomUUID(),
        type: 'performance-test',
        startTime: new Date(Date.now() - 100),
        endTime: new Date(),
        agent: { id: 'perf-agent', type: 'software', name: 'Perf Agent' }
      };
      
      const artifactInfo = {
        id: crypto.randomUUID(),
        path: testPath,
        size: testContent.length,
        hash: crypto.createHash('sha256').update(testContent).digest('hex')
      };
      
      // Measure attestation generation
      const attGenStart = performance.now();
      const attestation = await perfAttestationGenerator.generateAttestation(context, artifactInfo);
      const attGenTime = performance.now() - attGenStart;
      
      // Measure verification
      const verifyStart = performance.now();
      const verified = await perfCryptoManager.verifyAttestation(attestation);
      const verifyTime = performance.now() - verifyStart;
      
      assert(verified, `Verification should pass for ${keySize}-bit key`);
      assert(attGenTime < 10000, `Generation time should be reasonable for ${keySize}-bit key`);
      assert(verifyTime < 5000, `Verification time should be reasonable for ${keySize}-bit key`);
      
      performanceResults.push({
        keySize,
        keyGenTime: Math.round(keyGenTime),
        attGenTime: Math.round(attGenTime),
        verifyTime: Math.round(verifyTime)
      });
    }
    
    console.log('   Performance Results:');
    for (const result of performanceResults) {
      console.log(`     ${result.keySize}-bit: KeyGen ${result.keyGenTime}ms, AttGen ${result.attGenTime}ms, Verify ${result.verifyTime}ms`);
    }
  });

  // Test 6: External Verification Format
  runner.test('Test 6: Validate external verification capability', async () => {
    const attestation = testArtifacts[0].attestation;
    
    // Create verification bundle
    const verificationBundle = {
      attestation: attestation,
      publicKey: cryptoManager.publicKey,
      instructions: {
        algorithm: 'RSA-SHA256',
        description: 'Verify signature using RSA-SHA256 with provided public key'
      },
      artifact: {
        path: testArtifacts[0].artifactPath,
        expectedHash: attestation.artifact.hash
      }
    };
    
    const bundlePath = path.join(tempDir, 'verification-bundle.json');
    await fs.writeFile(bundlePath, JSON.stringify(verificationBundle, null, 2));
    
    // Test external verification simulation
    const signingData = {
      attestationId: attestation.attestationId,
      artifactId: attestation.artifactId,
      artifact: attestation.artifact,
      generation: attestation.generation,
      provenance: attestation.provenance,
      system: attestation.system,
      integrity: attestation.integrity,
      timestamps: attestation.timestamps
    };
    
    const canonicalJson = JSON.stringify(signingData, Object.keys(signingData).sort());
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(canonicalJson, 'utf8');
    
    const isValid = verify.verify(
      verificationBundle.publicKey,
      attestation.signature.signature,
      'base64'
    );
    
    assert(isValid, 'External verification should succeed');
    
    const bundleStats = await fs.stat(bundlePath);
    console.log(`   Verification bundle created: ${bundleStats.size} bytes`);
  });

  // Test 7: Memory Usage Validation
  runner.test('Test 7: Memory usage validation', async () => {
    const initialMemory = process.memoryUsage();
    const attestations = [];
    
    // Generate multiple attestations
    for (let i = 0; i < 10; i++) {
      const content = `Test content ${i} - ${'x'.repeat(500)}`;
      const filePath = path.join(tempDir, `memory-test-${i}.txt`);
      await fs.writeFile(filePath, content);
      
      const context = {
        operationId: crypto.randomUUID(),
        type: 'memory-test',
        startTime: new Date(),
        endTime: new Date(),
        agent: { id: 'memory-agent', type: 'software', name: 'Memory Test' }
      };
      
      const artifactInfo = {
        id: crypto.randomUUID(),
        path: filePath,
        size: content.length,
        hash: crypto.createHash('sha256').update(content).digest('hex')
      };
      
      const attestation = await attestationGenerator.generateAttestation(context, artifactInfo);
      attestations.push(attestation);
      
      // Force garbage collection if available
      if (global.gc) global.gc();
    }
    
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryPerAttestation = memoryIncrease / attestations.length;
    
    assert(memoryIncrease < 50 * 1024 * 1024, 'Memory increase should be reasonable (< 50MB)');
    assert(memoryPerAttestation < 1024 * 1024, 'Memory per attestation should be reasonable (< 1MB)');
    
    console.log(`   Memory usage: ${Math.round(memoryIncrease / 1024 / 1024)}MB total, ${Math.round(memoryPerAttestation / 1024)}KB per attestation`);
  });

  // Cleanup
  runner.test('Cleanup: Remove test directory', async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`   Cleaned up: ${tempDir}`);
    } catch (error) {
      console.log(`   Warning: Failed to cleanup ${tempDir}: ${error.message}`);
    }
  });

  // Run all tests
  await runner.run();
  
  // Exit with appropriate code
  process.exit(runner.results.failed === 0 ? 0 : 1);
}

// Check if we can find the required modules
async function checkDependencies() {
  const requiredModules = [
    '../../packages/kgen-core/src/provenance/attestation/generator.js',
    '../../packages/kgen-core/src/attestation/verifier.js',
    '../../packages/kgen-core/src/provenance/crypto/manager.js'
  ];
  
  for (const module of requiredModules) {
    try {
      const modulePath = path.resolve(path.dirname(new URL(import.meta.url).pathname), module);
      await fs.access(modulePath);
    } catch (error) {
      console.error(`❌ Required module not found: ${module}`);
      console.error(`   This test requires the attestation system implementation to be present.`);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  try {
    console.log('🔍 Checking dependencies...');
    await checkDependencies();
    console.log('✅ Dependencies found, starting validation...\n');
    
    await runAttestationValidation();
  } catch (error) {
    console.error('❌ Fatal error during validation:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runAttestationValidation };