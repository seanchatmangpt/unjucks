/**
 * Cryptographic Attestation Test
 * 
 * Test real cryptographic signature generation using Node.js built-in test runner
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { AttestationGenerator } from '../../packages/kgen-core/src/provenance/attestation/generator.js';
import { CryptoManager } from '../../packages/kgen-core/src/provenance/crypto/manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Cryptographic Attestation Tests', () => {
  let testDir;
  let testArtifactPath;
  let cryptoManager;
  let attestationGenerator;

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(__dirname, '..', '..', 'temp', 'crypto-test');
    await fs.mkdir(testDir, { recursive: true });

    // Create test artifact
    testArtifactPath = path.join(testDir, 'test-file.js');
    await fs.writeFile(testArtifactPath, `
// Test artifact for cryptographic verification
const message = "Hello from KGEN Crypto Test!";
console.log(message);
    `.trim());

    // Initialize crypto manager
    cryptoManager = new CryptoManager({
      keyPath: path.join(testDir, 'crypto.pem'),
      publicKeyPath: path.join(testDir, 'crypto.pub'),
      autoGenerateKeys: true,
      keySize: 2048
    });

    // Initialize attestation generator  
    attestationGenerator = new AttestationGenerator({
      enableCryptographicSigning: true
    });
    attestationGenerator.cryptoManager = cryptoManager;
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  test('should generate real RSA signatures', async () => {
    await cryptoManager.initialize();
    await attestationGenerator.initialize();

    const mockContext = {
      operationId: 'test-crypto-001',
      type: 'generation',
      startTime: new Date('2025-01-01T10:00:00.000Z'),
      endTime: new Date('2025-01-01T10:01:00.000Z'),
      agent: {
        id: 'crypto-test-agent',
        type: 'software',
        name: 'KGEN Crypto Test Agent',
        version: '1.0.0'
      }
    };

    const mockArtifact = {
      id: 'test-crypto-artifact',
      path: testArtifactPath,
      type: 'javascript'
    };

    const attestation = await attestationGenerator.generateAttestation(mockContext, mockArtifact);

    // Verify signature exists and is valid
    assert.notEqual(attestation.signature, null, 'Signature should not be null');
    assert.equal(typeof attestation.signature, 'object', 'Signature should be an object');
    assert.equal(attestation.signature.algorithm, 'RSA-SHA256', 'Should use RSA-SHA256');
    assert.ok(attestation.signature.keyFingerprint, 'Should have key fingerprint');
    assert.ok(attestation.signature.signedAt, 'Should have signed timestamp');
    assert.ok(attestation.signature.signature, 'Should have actual signature');

    // Verify signature is a valid base64 string
    assert.equal(typeof attestation.signature.signature, 'string', 'Signature should be a string');
    assert.ok(attestation.signature.signature.length > 100, 'Signature should be substantial length');
    
    // Should not throw when decoding base64
    const decodedSignature = Buffer.from(attestation.signature.signature, 'base64');
    assert.ok(decodedSignature.length > 0, 'Decoded signature should have content');
  });

  test('should calculate proper SHA-256 hashes', async () => {
    await cryptoManager.initialize();
    await attestationGenerator.initialize();

    const mockContext = {
      operationId: 'test-hash-001',
      type: 'generation',
      startTime: new Date(),
      endTime: new Date(),
      agent: {
        id: 'hash-test-agent',
        type: 'software',
        name: 'Hash Test Agent'
      }
    };

    const mockArtifact = {
      id: 'test-hash-artifact',
      path: testArtifactPath,
      type: 'javascript'
    };

    const attestation = await attestationGenerator.generateAttestation(mockContext, mockArtifact);

    // Verify artifact hash
    assert.ok(attestation.artifact.hash, 'Artifact should have hash');
    assert.equal(typeof attestation.artifact.hash, 'string', 'Hash should be a string');
    assert.equal(attestation.artifact.hash.length, 64, 'SHA-256 hash should be 64 characters');

    // Verify hash matches actual file content
    const fileContent = await fs.readFile(testArtifactPath, 'utf8');
    const expectedHash = crypto.createHash('sha256').update(fileContent).digest('hex');
    assert.equal(attestation.artifact.hash, expectedHash, 'Hash should match file content');
  });

  test('should verify signatures correctly', async () => {
    await cryptoManager.initialize();
    await attestationGenerator.initialize();

    const mockContext = {
      operationId: 'test-verify-001',
      type: 'generation',
      startTime: new Date(),
      endTime: new Date(),
      agent: {
        id: 'verify-test-agent',
        type: 'software',
        name: 'Verification Test Agent'
      }
    };

    const mockArtifact = {
      id: 'test-verify-artifact',
      path: testArtifactPath,
      type: 'javascript'
    };

    const attestation = await attestationGenerator.generateAttestation(mockContext, mockArtifact);

    // Verify the attestation signature
    const isValid = await cryptoManager.verifyAttestation(attestation);
    assert.equal(isValid, true, 'Signature should verify as valid');
  });

  test('should create valid .attest.json sidecar files', async () => {
    await cryptoManager.initialize();
    await attestationGenerator.initialize();

    const mockContext = {
      operationId: 'test-sidecar-001',
      type: 'generation',
      startTime: new Date(),
      endTime: new Date(),
      agent: {
        id: 'sidecar-test-agent',
        type: 'software',
        name: 'Sidecar Test Agent'
      }
    };

    const mockArtifact = {
      id: 'test-sidecar-artifact',
      path: testArtifactPath,
      type: 'javascript'
    };

    const attestation = await attestationGenerator.generateAttestation(mockContext, mockArtifact);
    const sidecarPath = await attestationGenerator.writeAttestationSidecar(testArtifactPath, attestation);

    // Verify sidecar file was created
    assert.equal(existsSync(sidecarPath), true, 'Sidecar file should exist');
    assert.equal(sidecarPath, `${testArtifactPath}.attest.json`, 'Sidecar should have correct path');

    // Verify sidecar content
    const sidecarContent = await fs.readFile(sidecarPath, 'utf8');
    const parsedAttestation = JSON.parse(sidecarContent);
    
    assert.notEqual(parsedAttestation.signature, null, 'Sidecar signature should not be null');
    assert.ok(parsedAttestation.signature.signature, 'Sidecar should have signature data');
    assert.ok(parsedAttestation.artifact.hash, 'Sidecar should have artifact hash');
    assert.ok(parsedAttestation.attestationId, 'Sidecar should have attestation ID');
  });

  test('should detect tampering with hash validation', async () => {
    await cryptoManager.initialize();
    await attestationGenerator.initialize();

    const mockContext = {
      operationId: 'test-tamper-001',
      type: 'generation',
      startTime: new Date(),
      endTime: new Date(),
      agent: {
        id: 'tamper-test-agent',
        type: 'software',
        name: 'Tamper Test Agent'
      }
    };

    const mockArtifact = {
      id: 'test-tamper-artifact',
      path: testArtifactPath,
      type: 'javascript'
    };

    // Generate original attestation
    const originalAttestation = await attestationGenerator.generateAttestation(mockContext, mockArtifact);

    // Tamper with the artifact
    await fs.writeFile(testArtifactPath, 'console.log("TAMPERED!");');

    // Validation should now fail
    const validation = await attestationGenerator.validateAttestation(originalAttestation);
    assert.equal(validation.valid, false, 'Validation should fail after tampering');
    assert.ok(validation.errors.length > 0, 'Should have validation errors');
    assert.ok(validation.errors[0].includes('hash mismatch'), 'Should detect hash mismatch');
  });

  test('should create signature chains', async () => {
    await cryptoManager.initialize();

    const operations = [
      {
        operationId: 'chain-op-001',
        type: 'generation',
        startTime: new Date('2025-01-01T10:00:00.000Z'),
        endTime: new Date('2025-01-01T10:01:00.000Z'),
        integrityHash: 'test-hash-001'
      },
      {
        operationId: 'chain-op-002',
        type: 'generation', 
        startTime: new Date('2025-01-01T10:02:00.000Z'),
        endTime: new Date('2025-01-01T10:03:00.000Z'),
        integrityHash: 'test-hash-002'
      }
    ];

    const signatureChain = await cryptoManager.createSignatureChain(operations);

    assert.ok(signatureChain.id, 'Chain should have ID');
    assert.equal(signatureChain.links.length, 2, 'Chain should have 2 links');
    assert.ok(signatureChain.chainSignature, 'Chain should have signature');
    assert.ok(signatureChain.keyFingerprint, 'Chain should have key fingerprint');

    // Verify chain integrity
    const verification = await cryptoManager.verifySignatureChain(signatureChain);
    assert.equal(verification.valid, true, 'Chain should be valid');
    assert.equal(verification.validLinks, 2, 'Both links should be valid');
    assert.equal(verification.brokenLinks.length, 0, 'No links should be broken');
    assert.equal(verification.integrityScore, 1, 'Integrity score should be 1.0');
  });
});