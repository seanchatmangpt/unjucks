/**
 * Comprehensive Test Suite for kgen-core Provenance System
 * 
 * Tests the production-grade JOSE/JWS attestation system including:
 * - Key generation and management
 * - JWS token creation and verification
 * - External tool compatibility
 * - SLSA compliance features
 * - W3C PROV-O metadata
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { tmpdir } from 'os';

import {
  createProvenanceSystem,
  AttestationGenerator,
  AttestationVerifier,
  KeyManager,
  JOSEOperations,
  SidecarGenerator,
  quickAttest,
  quickVerify,
  VERSION,
  SUPPORTED_ALGORITHMS
} from '../src/provenance/index.js';

// Test configuration
const TEST_CONFIG = {
  keys: {
    keyStorePath: path.join(tmpdir(), 'kgen-test-keys-' + Date.now()),
    enableAutoRotation: false
  },
  attestation: {
    issuer: 'urn:test:kgen-provenance',
    audience: ['urn:test:verifiers']
  },
  verifier: {
    enableCache: false // Disable caching for predictable tests
  }
};

// Test helpers
async function createTestArtifact() {
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'kgen-test-'));
  const artifactPath = path.join(tempDir, 'test-artifact.js');
  const content = 'console.log("Hello from kgen!");';
  
  await fs.writeFile(artifactPath, content);
  
  return {
    path: artifactPath,
    content,
    contentHash: crypto.createHash('sha256').update(content).digest('hex'),
    size: Buffer.from(content).length,
    type: 'javascript'
  };
}

async function cleanupTestFiles(paths) {
  for (const p of paths) {
    try {
      const stat = await fs.stat(p);
      if (stat.isDirectory()) {
        await fs.rm(p, { recursive: true, force: true });
      } else {
        await fs.unlink(p);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

describe('kgen-core Provenance System', () => {
  
  test('exports correct version and metadata', () => {
    assert.equal(VERSION, '2.0.0');
    assert.ok(Array.isArray(SUPPORTED_ALGORITHMS));
    assert.ok(SUPPORTED_ALGORITHMS.includes('EdDSA'));
    assert.ok(SUPPORTED_ALGORITHMS.includes('RS256'));
    assert.ok(SUPPORTED_ALGORITHMS.includes('RS512'));
  });
  
  describe('KeyManager', () => {
    let keyManager;
    let cleanup = [];
    
    test('initializes with default configuration', async () => {
      keyManager = new KeyManager(TEST_CONFIG.keys);
      cleanup.push(TEST_CONFIG.keys.keyStorePath);
      
      await keyManager.initialize();
      
      const status = keyManager.getStatus();
      assert.equal(status.initialized, true);
      assert.ok(status.keyStats.total >= 3); // Should have keys for all supported algorithms
    });
    
    test('generates Ed25519 key pair', async () => {
      const keyData = await keyManager.generateKeyPair('EdDSA');
      
      assert.ok(keyData.keyId);
      assert.equal(keyData.algorithm, 'EdDSA');
      assert.equal(keyData.keySize, 256);
      assert.ok(keyData.fingerprint);
      assert.ok(keyData.publicJWK);
      assert.equal(keyData.publicJWK.kty, 'OKP');
      assert.equal(keyData.publicJWK.crv, 'Ed25519');
    });
    
    test('generates RSA key pair', async () => {
      const keyData = await keyManager.generateKeyPair('RS256');
      
      assert.ok(keyData.keyId);
      assert.equal(keyData.algorithm, 'RS256');
      assert.equal(keyData.keySize, 2048);
      assert.ok(keyData.fingerprint);
      assert.ok(keyData.publicJWK);
      assert.equal(keyData.publicJWK.kty, 'RSA');
    });
    
    test('retrieves active keys', async () => {
      const eddsaKey = await keyManager.getActiveKey('EdDSA');
      assert.ok(eddsaKey);
      assert.equal(eddsaKey.algorithm, 'EdDSA');
      assert.equal(eddsaKey.status, 'active');
      
      const rsaKey = await keyManager.getActiveKey('RS256');
      assert.ok(rsaKey);
      assert.equal(rsaKey.algorithm, 'RS256');
      assert.equal(rsaKey.status, 'active');
    });
    
    test('exports public keys in JWKS format', async () => {
      const jwks = await keyManager.exportPublicJWKS();
      
      assert.ok(jwks.keys);
      assert.ok(Array.isArray(jwks.keys));
      assert.ok(jwks.keys.length >= 3);
      
      // Verify JWKS structure
      for (const key of jwks.keys) {
        assert.ok(key.kty);
        assert.ok(key.use === 'sig');
        assert.ok(key.alg);
        assert.ok(key.kid);
      }
    });
    
    test('rotates keys', async () => {
      const oldKey = await keyManager.getActiveKey('EdDSA');
      const rotationResult = await keyManager.rotateKey('EdDSA');
      
      assert.equal(rotationResult.algorithm, 'EdDSA');
      assert.ok(rotationResult.newKeyId);
      assert.equal(rotationResult.oldKeyId, oldKey.keyId);
      assert.notEqual(rotationResult.newKeyId, rotationResult.oldKeyId);
      
      const newKey = await keyManager.getActiveKey('EdDSA');
      assert.equal(newKey.keyId, rotationResult.newKeyId);
      assert.equal(newKey.status, 'active');
    });
    
    test.after(async () => {
      await cleanupTestFiles(cleanup);
    });
  });

  describe('JOSEOperations', () => {
    let joseOps;
    let keyManager;
    let testKey;
    let cleanup = [];
    
    test.before(async () => {
      keyManager = new KeyManager(TEST_CONFIG.keys);
      cleanup.push(TEST_CONFIG.keys.keyStorePath);
      await keyManager.initialize();
      
      joseOps = new JOSEOperations(TEST_CONFIG.jose);
      await joseOps.initialize();
      
      testKey = await keyManager.getActiveKey('EdDSA');
    });
    
    test('creates valid JWS tokens', async () => {
      const payload = {
        test: 'data',
        timestamp: new Date().toISOString()
      };
      
      const jwsToken = await joseOps.signPayload(payload, testKey, 'EdDSA');
      
      assert.ok(typeof jwsToken === 'string');
      assert.equal(jwsToken.split('.').length, 3); // Header.Payload.Signature
      
      // Verify structure
      const structure = joseOps.validateStructure(jwsToken);
      assert.equal(structure.valid, true);
      assert.equal(structure.errors.length, 0);
    });
    
    test('verifies JWS tokens', async () => {
      const payload = {
        test: 'verification',
        value: 42
      };
      
      const jwsToken = await joseOps.signPayload(payload, testKey, 'EdDSA');
      const verificationResult = await joseOps.verifyToken(jwsToken, testKey);
      
      assert.equal(verificationResult.valid, true);
      assert.equal(verificationResult.algorithm, 'EdDSA');
      assert.equal(verificationResult.keyId, testKey.keyId);
      assert.equal(verificationResult.payload.test, 'verification');
      assert.equal(verificationResult.payload.value, 42);
    });
    
    test('parses JWT headers and payloads', async () => {
      const payload = { test: 'parsing' };
      const jwsToken = await joseOps.signPayload(payload, testKey, 'EdDSA');
      
      const header = joseOps.parseHeader(jwsToken);
      assert.equal(header.alg, 'EdDSA');
      assert.equal(header.typ, 'JWT');
      assert.equal(header.kid, testKey.keyId);
      
      const parsedPayload = joseOps.parsePayload(jwsToken);
      assert.equal(parsedPayload.test, 'parsing');
      assert.ok(parsedPayload.iss);
      assert.ok(parsedPayload.iat);
      assert.ok(parsedPayload.exp);
    });
    
    test('creates compact tokens', async () => {
      const minimalPayload = { id: '123' };
      const compactToken = await joseOps.createCompactToken(
        minimalPayload, 
        testKey, 
        'EdDSA',
        { shortExpiry: 300 } // 5 minutes
      );
      
      assert.ok(typeof compactToken === 'string');
      
      const parsed = joseOps.parsePayload(compactToken);
      assert.equal(parsed.id, '123');
      assert.ok(parsed.exp - parsed.iat <= 300); // Short expiry
    });
    
    test.after(async () => {
      await cleanupTestFiles(cleanup);
    });
  });

  describe('AttestationGenerator', () => {
    let generator;
    let testArtifact;
    let cleanup = [];
    
    test.before(async () => {
      generator = new AttestationGenerator(TEST_CONFIG.attestation);
      await generator.initialize();
      
      testArtifact = await createTestArtifact();
      cleanup.push(path.dirname(testArtifact.path));
    });
    
    test('generates comprehensive attestations', async () => {
      const context = {
        templatePath: 'test/template.njk',
        operationId: 'test-op-123',
        reproducible: true
      };
      
      const attestation = await generator.generateAttestation(testArtifact, context);
      
      // Verify structure
      assert.equal(attestation.version, '2.0.0');
      assert.equal(attestation.format, 'jose-jws-slsa');
      
      // Verify artifact data
      assert.equal(attestation.artifact.path, testArtifact.path);
      assert.equal(attestation.artifact.contentHash, testArtifact.contentHash);
      assert.equal(attestation.artifact.size, testArtifact.size);
      
      // Verify signatures
      assert.ok(attestation.signatures);
      assert.ok(attestation.signatures.eddsa); // Ed25519 signature
      
      // Verify public keys
      assert.ok(attestation.verification);
      assert.ok(attestation.verification.keys);
      assert.ok(attestation.verification.keys.eddsa);
      
      // Verify SLSA compliance
      assert.ok(attestation.slsa);
      assert.ok(attestation.slsa.buildDefinition);
      assert.equal(attestation.slsa.predicateType, 'https://slsa.dev/provenance/v0.2');
      
      // Verify W3C PROV-O compliance
      assert.ok(attestation.provenance);
      assert.ok(attestation.provenance['@context']);
      assert.equal(attestation.provenance['@type'], 'prov:Generation');
    });
    
    test('generates batch attestations', async () => {
      const artifacts = [];
      for (let i = 0; i < 3; i++) {
        const artifact = await createTestArtifact();
        artifacts.push(artifact);
        cleanup.push(path.dirname(artifact.path));
      }
      
      const context = { batchOperation: true };
      const results = await generator.generateBatchAttestations(artifacts, context);
      
      assert.equal(results.length, 3);
      
      for (const result of results) {
        assert.ok(result.artifact);
        assert.ok(result.signatures);
        assert.ok(result.metadata.batchId);
      }
    });
    
    test.after(async () => {
      await cleanupTestFiles(cleanup);
    });
  });

  describe('AttestationVerifier', () => {
    let verifier;
    let generator;
    let testArtifact;
    let testAttestation;
    let cleanup = [];
    
    test.before(async () => {
      verifier = new AttestationVerifier(TEST_CONFIG.verifier);
      await verifier.initialize();
      
      generator = new AttestationGenerator(TEST_CONFIG.attestation);
      await generator.initialize();
      
      testArtifact = await createTestArtifact();
      cleanup.push(path.dirname(testArtifact.path));
      
      testAttestation = await generator.generateAttestation(testArtifact, {
        templatePath: 'test/verify.njk'
      });
    });
    
    test('verifies JWS tokens with JOSE', async () => {
      const jwsToken = testAttestation.signatures.eddsa;
      const publicKey = testAttestation.verification.keys.eddsa;
      
      const result = await verifier.verifyWithJOSE(jwsToken, publicKey);
      
      assert.equal(result.valid, true);
      assert.equal(result.tool, 'jose');
      assert.equal(result.algorithm, 'EdDSA');
      assert.ok(result.payload);
      assert.ok(result.claims);
    });
    
    test('performs cross-verification', async () => {
      const jwsToken = testAttestation.signatures.eddsa;
      const publicKey = testAttestation.verification.keys.eddsa;
      
      // Only test with JOSE since external tools might not be available in CI
      const result = await verifier.crossVerify(jwsToken, publicKey, {
        tools: ['jose']
      });
      
      assert.ok(result.consensus);
      assert.equal(result.consensus.consensus, 'valid');
      assert.equal(result.consensus.confidence, 1.0);
      assert.ok(result.toolResults.jose);
      assert.equal(result.toolResults.jose.valid, true);
    });
    
    test('verifies attestation integrity', async () => {
      const result = await verifier.verifyAttestationIntegrity(testAttestation);
      
      assert.equal(result.valid, true);
      assert.ok(result.checks.artifactExists);
      assert.ok(result.checks.contentIntegrity);
      assert.ok(result.checks.signatureVerification);
    });
    
    test('detects tampered content', async () => {
      // Modify the artifact content
      await fs.writeFile(testArtifact.path, 'TAMPERED CONTENT');
      
      const result = await verifier.verifyAttestationIntegrity(testAttestation);
      
      assert.equal(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors.some(e => e.includes('modified')));
    });
    
    test('generates verification reports', async () => {
      const jwsToken = testAttestation.signatures.eddsa;
      const publicKey = testAttestation.verification.keys.eddsa;
      
      const crossResult = await verifier.crossVerify(jwsToken, publicKey, {
        tools: ['jose']
      });
      
      const report = verifier.generateVerificationReport(crossResult);
      
      assert.ok(typeof report === 'string');
      assert.ok(report.includes('JWS Attestation Verification Report'));
      assert.ok(report.includes('Executive Summary'));
      assert.ok(report.includes('✅ PASSED'));
      assert.ok(report.includes('Manual Verification'));
    });
    
    test.after(async () => {
      await cleanupTestFiles(cleanup);
    });
  });

  describe('SidecarGenerator', () => {
    let sidecarGen;
    let testArtifact;
    let testAttestation;
    let cleanup = [];
    
    test.before(async () => {
      sidecarGen = new SidecarGenerator(TEST_CONFIG.sidecar);
      await sidecarGen.initialize();
      
      const generator = new AttestationGenerator(TEST_CONFIG.attestation);
      await generator.initialize();
      
      testArtifact = await createTestArtifact();
      cleanup.push(path.dirname(testArtifact.path));
      
      testAttestation = await generator.generateAttestation(testArtifact, {
        templatePath: 'test/sidecar.njk'
      });
    });
    
    test('generates sidecar files', async () => {
      const result = await sidecarGen.generateSidecarFile(
        testArtifact.path,
        testAttestation
      );
      
      cleanup.push(result.sidecarPath);
      
      assert.equal(result.artifactPath, testArtifact.path);
      assert.ok(result.sidecarPath.endsWith('.attest.json'));
      assert.equal(result.format, 'json');
      assert.ok(result.size > 0);
      assert.ok(result.contentHash);
      
      // Verify file exists and has content
      const sidecarContent = await fs.readFile(result.sidecarPath, 'utf8');
      const sidecarData = JSON.parse(sidecarContent);
      
      assert.equal(sidecarData.version, '2.0.0');
      assert.ok(sidecarData.artifact);
      assert.ok(sidecarData.signatures);
      assert.ok(sidecarData.metadata);
    });
    
    test('validates sidecar content', async () => {
      const sidecarPath = testArtifact.path + '.attest.json';
      
      const validationResult = await sidecarGen.validateSidecarFile(sidecarPath);
      
      assert.equal(validationResult.valid, true);
      assert.equal(validationResult.errors.length, 0);
    });
    
    test('extracts artifact information', async () => {
      const sidecarPath = testArtifact.path + '.attest.json';
      
      const info = await sidecarGen.extractArtifactInfo(sidecarPath);
      
      assert.equal(info.artifactPath, testArtifact.path);
      assert.equal(info.contentHash, testArtifact.contentHash);
      assert.equal(info.size, testArtifact.size);
      assert.equal(info.type, testArtifact.type);
      assert.ok(info.signatures.includes('eddsa'));
      assert.equal(info.externallyVerifiable, true);
      assert.equal(info.provenanceCompliant, true);
    });
    
    test.after(async () => {
      await cleanupTestFiles(cleanup);
    });
  });

  describe('Integration Tests', () => {
    let system;
    let testArtifact;
    let cleanup = [];
    
    test.before(async () => {
      system = createProvenanceSystem(TEST_CONFIG);
      await system.initialize();
      
      testArtifact = await createTestArtifact();
      cleanup.push(path.dirname(testArtifact.path));
    });
    
    test('end-to-end attestation workflow', async () => {
      // Generate attestation
      const attestation = await system.generateAttestation(testArtifact, {
        templatePath: 'test/integration.njk',
        operationId: 'integration-test-' + Date.now()
      });
      
      // Verify attestation
      const verification = await system.verifyAttestation(attestation);
      
      assert.equal(verification.valid, true);
      assert.ok(verification.checks.contentIntegrity);
      assert.ok(verification.checks.signatureVerification);
    });
    
    test('cross-verification workflow', async () => {
      const attestation = await system.generateAttestation(testArtifact, {
        templatePath: 'test/cross-verify.njk'
      });
      
      const jwsToken = attestation.signatures.eddsa;
      const publicKey = attestation.verification.keys.eddsa;
      
      const crossResult = await system.crossVerify(jwsToken, publicKey, {
        tools: ['jose']
      });
      
      assert.equal(crossResult.consensus.consensus, 'valid');
      assert.equal(crossResult.consensus.confidence, 1.0);
    });
    
    test('system status reporting', async () => {
      const status = system.getStatus();
      
      assert.ok(status.keyManager);
      assert.ok(status.attestationGenerator);
      assert.ok(status.verifier);
      
      assert.equal(status.keyManager.initialized, true);
      assert.equal(status.attestationGenerator.initialized, true);
      assert.equal(status.verifier.initialized, true);
    });
    
    test.after(async () => {
      await cleanupTestFiles(cleanup);
    });
  });

  describe('Quick API Functions', () => {
    let testArtifact;
    let cleanup = [];
    
    test.before(async () => {
      testArtifact = await createTestArtifact();
      cleanup.push(path.dirname(testArtifact.path));
    });
    
    test('quickAttest creates attestation', async () => {
      const attestation = await quickAttest(testArtifact.path, {
        templatePath: 'test/quick.njk'
      }, {
        config: TEST_CONFIG
      });
      
      assert.ok(attestation);
      assert.equal(attestation.version, '2.0.0');
      assert.ok(attestation.signatures);
      assert.ok(attestation.verification);
    });
    
    test('quickVerify validates JWS token', async () => {
      const attestation = await quickAttest(testArtifact.path, {}, {
        config: TEST_CONFIG
      });
      
      const jwsToken = attestation.signatures.eddsa;
      const publicKey = attestation.verification.keys.eddsa;
      
      const result = await quickVerify(jwsToken, publicKey, {
        config: TEST_CONFIG.verifier
      });
      
      assert.equal(result.valid, true);
      assert.equal(result.tool, 'jose');
    });
    
    test.after(async () => {
      await cleanupTestFiles(cleanup);
    });
  });

  describe('Error Handling', () => {
    test('handles invalid JWS tokens', async () => {
      const verifier = new AttestationVerifier();
      await verifier.initialize();
      
      const result = await verifier.verifyWithJOSE(
        'invalid.jwt.token',
        { kty: 'OKP', crv: 'Ed25519', x: 'test', alg: 'EdDSA' }
      );
      
      assert.equal(result.valid, false);
      assert.ok(result.error);
    });
    
    test('handles missing artifacts', async () => {
      const generator = new AttestationGenerator();
      await generator.initialize();
      
      try {
        await generator.generateAttestation({
          path: '/nonexistent/file.js'
        }, {});
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error.message.includes('nonexistent'));
      }
    });
    
    test('validates configuration', async () => {
      try {
        const keyManager = new KeyManager({
          supportedAlgorithms: ['INVALID_ALG']
        });
        await keyManager.initialize();
        await keyManager.generateKeyPair('INVALID_ALG');
        assert.fail('Should have thrown error');
      } catch (error) {
        assert.ok(error.message.includes('Unsupported'));
      }
    });
  });
});

// Export test helpers for use in other test files
export {
  TEST_CONFIG,
  createTestArtifact,
  cleanupTestFiles
};