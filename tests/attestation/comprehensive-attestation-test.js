/**
 * Comprehensive Attestation System Tests
 * 
 * This test suite validates the end-to-end cryptographic attestation generation
 * and verification workflow, including real cryptographic signatures and 
 * external verification capability.
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { execSync } from 'child_process';

// Import the attestation system components
import { AttestationGenerator } from '../../packages/kgen-core/src/provenance/attestation/generator.js';
import { AttestationVerifier } from '../../packages/kgen-core/src/attestation/verifier.js';
import { CryptoManager } from '../../packages/kgen-core/src/provenance/crypto/manager.js';

describe('Comprehensive Attestation System Validation', () => {
  let tempDir;
  let attestationGenerator;
  let attestationVerifier;
  let cryptoManager;
  let testArtifacts = [];

  beforeAll(async () => {
    // Create temporary directory for test artifacts
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'attestation-test-'));
    
    // Initialize crypto manager with test configuration
    cryptoManager = new CryptoManager({
      keyPath: path.join(tempDir, 'test-private.pem'),
      publicKeyPath: path.join(tempDir, 'test-public.pem'),
      keySize: 2048, // Start with standard key size
      autoGenerateKeys: true,
      keyPassphrase: 'test-passphrase-secure-12345'
    });
    
    await cryptoManager.initialize();
    
    // Initialize attestation components
    attestationGenerator = new AttestationGenerator({
      enableCryptographicSigning: true,
      cryptoManager: cryptoManager,
      hashAlgorithm: 'sha256',
      includeSystemInfo: true,
      includeEnvironment: true
    });
    
    await attestationGenerator.initialize();
    
    attestationVerifier = new AttestationVerifier({
      hashAlgorithm: 'sha256',
      enableParallelVerification: true,
      cacheVerificationResults: false // Disable cache for testing
    });
    
    console.log(`✅ Test setup completed in: ${tempDir}`);
  });

  afterAll(async () => {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`✅ Cleaned up test directory: ${tempDir}`);
    } catch (error) {
      console.warn(`⚠️ Failed to cleanup test directory: ${error.message}`);
    }
  });

  describe('1. End-to-End Attestation Workflow', () => {
    it('should generate real cryptographic attestations for artifacts', async () => {
      // Create test artifacts
      const artifacts = [
        {
          name: 'test-component.js',
          content: `// Test JavaScript component
export class TestComponent {
  constructor(name) {
    this.name = name;
  }
  
  greet() {
    return \`Hello, \${this.name}!\`;
  }
}
`
        },
        {
          name: 'test-config.json',
          content: JSON.stringify({
            name: 'test-project',
            version: '1.0.0',
            description: 'Test configuration for attestation validation'
          }, null, 2)
        },
        {
          name: 'test-readme.md',
          content: `# Test Project

This is a test project for validating cryptographic attestations.

## Features

- Real cryptographic signatures
- W3C PROV-O compliance
- External verification support
`
        }
      ];

      const attestations = [];

      for (const artifact of artifacts) {
        // Write artifact to disk
        const artifactPath = path.join(tempDir, artifact.name);
        await fs.writeFile(artifactPath, artifact.content, 'utf8');
        
        // Calculate file stats
        const stats = await fs.stat(artifactPath);
        const hash = crypto.createHash('sha256').update(artifact.content).digest('hex');
        
        // Create operation context
        const context = {
          operationId: crypto.randomUUID(),
          type: 'generation',
          startTime: new Date(Date.now() - 1000),
          endTime: new Date(),
          templateId: 'test-template-001',
          templateVersion: '1.0.0',
          templatePath: `/templates/${artifact.name}.njk`,
          agent: {
            id: 'test-agent-001',
            type: 'software',
            name: 'Test Generator Agent',
            version: '1.0.0'
          },
          engineVersion: '1.0.0',
          configuration: {
            mode: 'test',
            validateOutput: true,
            enableSigning: true
          },
          parameters: {
            projectName: 'test-project',
            author: 'Test Suite'
          },
          integrityHash: hash,
          chainIndex: attestations.length
        };
        
        const artifactInfo = {
          id: crypto.randomUUID(),
          path: artifactPath,
          size: stats.size,
          hash: hash,
          type: path.extname(artifact.name).substring(1) || 'text',
          createdAt: stats.birthtime
        };

        // Generate attestation
        const attestation = await attestationGenerator.generateAttestation(context, artifactInfo);
        
        // Validate attestation structure
        expect(attestation).toBeDefined();
        expect(attestation.attestationId).toBeDefined();
        expect(attestation.artifact).toBeDefined();
        expect(attestation.provenance).toBeDefined();
        expect(attestation.integrity).toBeDefined();
        expect(attestation.signature).toBeDefined();
        
        // Validate cryptographic signature
        expect(attestation.signature.signature).toBeDefined();
        expect(attestation.signature.algorithm).toBe('RSA-SHA256');
        expect(attestation.signature.keyFingerprint).toBeDefined();
        expect(attestation.signature.signedAt).toBeDefined();
        
        // Write attestation sidecar
        const sidecarPath = await attestationGenerator.writeAttestationSidecar(artifactPath, attestation);
        expect(await fs.access(sidecarPath).then(() => true).catch(() => false)).toBe(true);
        
        attestations.push(attestation);
        testArtifacts.push({
          artifactPath,
          sidecarPath,
          attestation,
          originalContent: artifact.content
        });
      }

      expect(attestations).toHaveLength(3);
      console.log(`✅ Generated ${attestations.length} real cryptographic attestations`);
    });

    it('should verify attestations with cryptographic signatures', async () => {
      expect(testArtifacts).toHaveLength(3);
      
      for (const testArtifact of testArtifacts) {
        // Verify attestation signature
        const signatureValid = await cryptoManager.verifyAttestation(testArtifact.attestation);
        expect(signatureValid).toBe(true);
        
        // Verify using attestation verifier
        const verificationResult = await attestationVerifier.fastVerify(testArtifact.artifactPath);
        
        expect(verificationResult.verified).toBe(true);
        expect(verificationResult.details.hash.verified).toBe(true);
        expect(verificationResult.details.structure.verified).toBe(true);
        
        console.log(`✅ Verified attestation for: ${path.basename(testArtifact.artifactPath)}`);
      }
    });

    it('should detect tampering in artifacts', async () => {
      // Tamper with first artifact
      const tamperedArtifact = testArtifacts[0];
      const originalContent = await fs.readFile(tamperedArtifact.artifactPath, 'utf8');
      const tamperedContent = originalContent + '\n// This line was added to tamper with the file';
      
      await fs.writeFile(tamperedArtifact.artifactPath, tamperedContent, 'utf8');
      
      // Verification should fail
      const verificationResult = await attestationVerifier.fastVerify(tamperedArtifact.artifactPath);
      
      expect(verificationResult.verified).toBe(false);
      expect(verificationResult.details.hash.verified).toBe(false);
      expect(verificationResult.details.hash.reason).toContain('Hash mismatch');
      
      // Restore original content
      await fs.writeFile(tamperedArtifact.artifactPath, originalContent, 'utf8');
      
      console.log(`✅ Successfully detected tampering in artifact`);
    });
  });

  describe('2. W3C PROV-O Compliance Validation', () => {
    it('should generate PROV-O compliant provenance metadata', async () => {
      const attestation = testArtifacts[0].attestation;
      const provenance = attestation.provenance;
      
      // Check PROV-O context
      expect(provenance['@context']).toBeDefined();
      expect(provenance['@context']['prov']).toBe('http://www.w3.org/ns/prov#');
      expect(provenance['@context']['kgen']).toBe('http://kgen.enterprise/provenance/');
      
      // Check PROV-O activity
      expect(provenance.activity).toBeDefined();
      expect(provenance.activity['@type']).toBe('prov:Activity');
      expect(provenance.activity['prov:startedAtTime']).toBeDefined();
      expect(provenance.activity['prov:endedAtTime']).toBeDefined();
      expect(provenance.activity['prov:wasAssociatedWith']).toBeDefined();
      
      // Check PROV-O agent
      expect(provenance.agent).toBeDefined();
      expect(provenance.agent['@type']).toBe('prov:SoftwareAgent');
      expect(provenance.agent['foaf:name']).toBeDefined();
      
      console.log(`✅ Validated W3C PROV-O compliance`);
    });

    it('should include canonical graph hash', async () => {
      const attestation = testArtifacts[0].attestation;
      const provenance = attestation.provenance;
      
      expect(provenance.graphHash).toBeDefined();
      expect(provenance.canonicalizationMethod).toBe('c14n-rdf');
      expect(typeof provenance.graphHash).toBe('string');
      expect(provenance.graphHash).toMatch(/^[a-f0-9]{64}$/i); // SHA-256 hex format
      
      console.log(`✅ Validated canonical graph hash: ${provenance.graphHash.substring(0, 16)}...`);
    });
  });

  describe('3. JWS/JWT Format Testing', () => {
    it('should generate JWT-compatible signatures', async () => {
      const attestation = testArtifacts[0].attestation;
      const signature = attestation.signature;
      
      // Check signature format
      expect(signature.algorithm).toBe('RSA-SHA256');
      expect(signature.signature).toBeDefined();
      expect(signature.keyFingerprint).toBeDefined();
      expect(signature.signedAt).toBeDefined();
      
      // Validate signature is base64 encoded
      const signatureBuffer = Buffer.from(signature.signature, 'base64');
      expect(signatureBuffer.length).toBeGreaterThan(0);
      
      console.log(`✅ Validated JWT-compatible signature format`);
    });

    it('should be verifiable with external OpenSSL tools', async () => {
      // Skip if OpenSSL not available
      try {
        execSync('openssl version', { stdio: 'ignore' });
      } catch (error) {
        console.log('⏭️ OpenSSL not available, skipping external verification test');
        return;
      }
      
      const attestation = testArtifacts[0].attestation;
      const signature = attestation.signature;
      
      // Extract public key in OpenSSL format
      const publicKeyPath = path.join(tempDir, 'openssl-public.pem');
      await fs.writeFile(publicKeyPath, cryptoManager.publicKey);
      
      // Create signature data file
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
      
      const dataPath = path.join(tempDir, 'signing-data.json');
      await fs.writeFile(dataPath, JSON.stringify(signingData, null, 0));
      
      // Create signature file
      const signaturePath = path.join(tempDir, 'signature.bin');
      const signatureBuffer = Buffer.from(signature.signature, 'base64');
      await fs.writeFile(signaturePath, signatureBuffer);
      
      // Verify with OpenSSL
      try {
        execSync(`openssl dgst -sha256 -verify "${publicKeyPath}" -signature "${signaturePath}" "${dataPath}"`, {
          stdio: 'pipe'
        });
        console.log(`✅ External OpenSSL verification successful`);
      } catch (error) {
        console.error('❌ OpenSSL verification failed:', error.message);
        throw error;
      }
    });
  });

  describe('4. Performance Testing', () => {
    const keySizes = [1024, 2048, 4096];
    const performanceResults = [];

    for (const keySize of keySizes) {
      it(`should perform efficiently with ${keySize}-bit keys`, async () => {
        // Create crypto manager with specific key size
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
        
        // Create attestation generator with performance crypto manager
        const perfAttestationGenerator = new AttestationGenerator({
          enableCryptographicSigning: true,
          cryptoManager: perfCryptoManager
        });
        
        await perfAttestationGenerator.initialize();
        
        // Create test artifact
        const testContent = 'a'.repeat(10000); // 10KB test file
        const testPath = path.join(tempDir, `perf-test-${keySize}.txt`);
        await fs.writeFile(testPath, testContent);
        
        const stats = await fs.stat(testPath);
        const hash = crypto.createHash('sha256').update(testContent).digest('hex');
        
        const context = {
          operationId: crypto.randomUUID(),
          type: 'performance-test',
          startTime: new Date(Date.now() - 100),
          endTime: new Date(),
          agent: {
            id: 'perf-test-agent',
            type: 'software',
            name: 'Performance Test Agent'
          }
        };
        
        const artifactInfo = {
          id: crypto.randomUUID(),
          path: testPath,
          size: stats.size,
          hash: hash
        };
        
        // Measure attestation generation time
        const attGenStart = performance.now();
        const attestation = await perfAttestationGenerator.generateAttestation(context, artifactInfo);
        const attGenTime = performance.now() - attGenStart;
        
        // Measure verification time
        const verifyStart = performance.now();
        const verified = await perfCryptoManager.verifyAttestation(attestation);
        const verifyTime = performance.now() - verifyStart;
        
        const result = {
          keySize,
          keyGenTime: Math.round(keyGenTime),
          attestationGenTime: Math.round(attGenTime),
          verificationTime: Math.round(verifyTime),
          totalTime: Math.round(keyGenTime + attGenTime + verifyTime),
          signatureSize: Buffer.from(attestation.signature.signature, 'base64').length
        };
        
        performanceResults.push(result);
        
        // Performance assertions
        expect(verified).toBe(true);
        expect(attGenTime).toBeLessThan(10000); // Less than 10 seconds
        expect(verifyTime).toBeLessThan(5000);  // Less than 5 seconds
        
        console.log(`✅ Performance test ${keySize}-bit: Gen ${result.attestationGenTime}ms, Verify ${result.verificationTime}ms`);
      });
    }

    it('should provide performance comparison report', () => {
      expect(performanceResults).toHaveLength(3);
      
      console.log('\n📊 Performance Comparison Report:');
      console.log('Key Size | Key Gen | Att Gen | Verify | Total | Sig Size');
      console.log('---------|---------|---------|--------|---------|---------');
      
      for (const result of performanceResults) {
        console.log(`${result.keySize.toString().padEnd(8)} | ${result.keyGenTime.toString().padStart(7)} | ${result.attestationGenTime.toString().padStart(7)} | ${result.verificationTime.toString().padStart(6)} | ${result.totalTime.toString().padStart(7)} | ${result.signatureSize.toString().padStart(7)}`);
      }
      
      // Performance expectations
      const maxGenTime = Math.max(...performanceResults.map(r => r.attestationGenTime));
      const maxVerifyTime = Math.max(...performanceResults.map(r => r.verificationTime));
      
      expect(maxGenTime).toBeLessThan(15000); // Max 15 seconds for any key size
      expect(maxVerifyTime).toBeLessThan(8000); // Max 8 seconds for verification
    });
  });

  describe('5. Memory Usage Validation', () => {
    it('should maintain reasonable memory usage during attestation generation', async () => {
      const initialMemory = process.memoryUsage();
      const attestations = [];
      
      // Generate many attestations to test memory usage
      for (let i = 0; i < 50; i++) {
        const testContent = `Test content ${i} - ${'x'.repeat(1000)}`;
        const testPath = path.join(tempDir, `memory-test-${i}.txt`);
        await fs.writeFile(testPath, testContent);
        
        const stats = await fs.stat(testPath);
        const hash = crypto.createHash('sha256').update(testContent).digest('hex');
        
        const context = {
          operationId: crypto.randomUUID(),
          type: 'memory-test',
          startTime: new Date(Date.now() - 50),
          endTime: new Date(),
          agent: {
            id: 'memory-test-agent',
            type: 'software',
            name: 'Memory Test Agent'
          }
        };
        
        const artifactInfo = {
          id: crypto.randomUUID(),
          path: testPath,
          size: stats.size,
          hash: hash
        };
        
        const attestation = await attestationGenerator.generateAttestation(context, artifactInfo);
        attestations.push(attestation);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePerAttestation = memoryIncrease / attestations.length;
      
      console.log(`📊 Memory Usage Report:`);
      console.log(`Initial heap: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`Final heap: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`Increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      console.log(`Per attestation: ${Math.round(memoryIncreasePerAttestation / 1024)}KB`);
      
      // Memory usage assertions
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB total
      expect(memoryIncreasePerAttestation).toBeLessThan(2 * 1024 * 1024); // Less than 2MB per attestation
      
      expect(attestations).toHaveLength(50);
      console.log(`✅ Memory usage validation passed for ${attestations.length} attestations`);
    });
  });

  describe('6. External Verification Capability', () => {
    it('should export attestations in a format verifiable by external tools', async () => {
      const attestation = testArtifacts[0].attestation;
      
      // Create verification bundle
      const verificationBundle = {
        attestation: attestation,
        publicKey: cryptoManager.publicKey,
        verificationInstructions: {
          algorithm: 'RSA-SHA256',
          steps: [
            'Extract the signing data (all fields except signature)',
            'Canonicalize the JSON (no spaces, sorted keys)',
            'Verify signature using RSA-SHA256 with provided public key'
          ]
        },
        artifact: {
          path: testArtifacts[0].artifactPath,
          expectedHash: attestation.artifact.hash
        }
      };
      
      const bundlePath = path.join(tempDir, 'verification-bundle.json');
      await fs.writeFile(bundlePath, JSON.stringify(verificationBundle, null, 2));
      
      // Verify the bundle is readable and contains required data
      const loadedBundle = JSON.parse(await fs.readFile(bundlePath, 'utf8'));
      
      expect(loadedBundle.attestation).toBeDefined();
      expect(loadedBundle.publicKey).toBeDefined();
      expect(loadedBundle.verificationInstructions).toBeDefined();
      expect(loadedBundle.artifact).toBeDefined();
      
      console.log(`✅ Exported verification bundle to: ${bundlePath}`);
      console.log(`   Bundle size: ${(await fs.stat(bundlePath)).size} bytes`);
      
      // Test external verification simulation
      const signingData = {
        attestationId: loadedBundle.attestation.attestationId,
        artifactId: loadedBundle.attestation.artifactId,
        artifact: loadedBundle.attestation.artifact,
        generation: loadedBundle.attestation.generation,
        provenance: loadedBundle.attestation.provenance,
        system: loadedBundle.attestation.system,
        integrity: loadedBundle.attestation.integrity,
        timestamps: loadedBundle.attestation.timestamps
      };
      
      const canonicalJson = JSON.stringify(signingData, Object.keys(signingData).sort());
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(canonicalJson, 'utf8');
      
      const isValid = verify.verify(
        loadedBundle.publicKey,
        loadedBundle.attestation.signature.signature,
        'base64'
      );
      
      expect(isValid).toBe(true);
      console.log(`✅ External verification simulation successful`);
    });
  });

  describe('7. Chain Verification', () => {
    it('should verify attestation chains correctly', async () => {
      const chainAttestations = testArtifacts.map(ta => ta.attestation);
      
      // Update chain indices for proper chain verification
      chainAttestations.forEach((attestation, index) => {
        attestation.integrity.chainIndex = index;
        if (index > 0) {
          attestation.integrity.previousHash = chainAttestations[index - 1].integrity.artifactHash;
        }
      });
      
      const chainVerification = await attestationVerifier.verifyChain(chainAttestations);
      
      expect(chainVerification.verified).toBe(true);
      expect(chainVerification.chainLength).toBe(3);
      expect(chainVerification.validLinks).toBe(2); // 3 items = 2 links
      expect(chainVerification.brokenLinks).toHaveLength(0);
      
      console.log(`✅ Chain verification passed: ${chainVerification.validLinks}/${chainVerification.chainLength - 1} valid links`);
    });
  });

  describe('8. Batch Operations', () => {
    it('should handle batch verification efficiently', async () => {
      const artifactPaths = testArtifacts.map(ta => ta.artifactPath);
      
      const batchStart = performance.now();
      const batchResult = await attestationVerifier.batchVerify(artifactPaths);
      const batchTime = performance.now() - batchStart;
      
      expect(batchResult.success).toBe(true);
      expect(batchResult.totalArtifacts).toBe(3);
      expect(batchResult.analysis.verified).toBe(3);
      expect(batchResult.analysis.failed).toBe(0);
      expect(batchResult.analysis.successRate).toBe(1);
      
      console.log(`✅ Batch verification: ${batchResult.analysis.verified}/${batchResult.totalArtifacts} verified in ${Math.round(batchTime)}ms`);
      console.log(`   Average time per artifact: ${Math.round(batchResult.analysis.avgVerificationTime)}ms`);
    });
  });
});