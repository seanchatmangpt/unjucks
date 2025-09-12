/**
 * Provenance Attestation Signature Tests
 * 
 * Tests for fixing broken cryptographic signature generation in KGEN attestations.
 * This demonstrates the current broken state and validates the fixes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { AttestationGenerator } from '../../packages/kgen-core/src/provenance/attestation/generator.js';
import { CryptoManager } from '../../packages/kgen-core/src/provenance/crypto/manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Provenance Attestation Signatures', () => {
  let attestationGenerator;
  let cryptoManager;
  let testDir;
  let testArtifactPath;

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(__dirname, '..', '..', 'temp', 'attestation-test');
    await fs.mkdir(testDir, { recursive: true });

    // Create test artifact
    testArtifactPath = path.join(testDir, 'test-artifact.js');
    await fs.writeFile(testArtifactPath, `
// Test artifact for signature verification
const message = "Hello from KGEN!";
console.log(message);
    `.trim());

    // Initialize crypto manager with test keys
    cryptoManager = new CryptoManager({
      keyPath: path.join(testDir, 'test.pem'),
      publicKeyPath: path.join(testDir, 'test.pub'),
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

  describe('Current Broken State', () => {
    it('should demonstrate null signature when crypto manager not initialized', async () => {
      // Create generator without initialized crypto manager
      const brokenGenerator = new AttestationGenerator({
        enableCryptographicSigning: true
      });
      // Don't initialize crypto manager

      const mockContext = {
        operationId: 'test-op-001',
        type: 'generation',
        startTime: this.getDeterministicDate(),
        endTime: this.getDeterministicDate(),
        agent: {
          id: 'test-agent',
          type: 'software',
          name: 'Test Agent'
        }
      };

      const mockArtifact = {
        id: 'test-artifact-001',
        path: testArtifactPath,
        type: 'javascript'
      };

      const attestation = await brokenGenerator.generateAttestation(mockContext, mockArtifact);

      // This should be null because crypto manager is not initialized
      expect(attestation.signature).toBe(null);
    });
  });

  describe('Fixed Cryptographic Signatures', () => {
    it('should generate real RSA signatures when properly initialized', async () => {
      // Initialize crypto manager
      await cryptoManager.initialize();
      await attestationGenerator.initialize();

      const mockContext = {
        operationId: 'test-op-002',
        type: 'generation',
        startTime: new Date('2025-01-01T10:00:00.000Z'),
        endTime: new Date('2025-01-01T10:01:00.000Z'),
        agent: {
          id: 'kgen-test-agent',
          type: 'software',
          name: 'KGEN Test Agent',
          version: '1.0.0'
        }
      };

      const mockArtifact = {
        id: 'test-artifact-002',
        path: testArtifactPath,
        type: 'javascript'
      };

      const attestation = await attestationGenerator.generateAttestation(mockContext, mockArtifact);

      // Verify signature exists and is not null
      expect(attestation.signature).not.toBe(null);
      expect(attestation.signature).toBeDefined();
      expect(typeof attestation.signature).toBe('object');
      
      // Verify signature structure
      expect(attestation.signature.algorithm).toBe('RSA-SHA256');
      expect(attestation.signature.keyFingerprint).toBeDefined();
      expect(attestation.signature.signedAt).toBeDefined();
      expect(attestation.signature.signature).toBeDefined();
      
      // Verify signature is a valid base64 string
      expect(typeof attestation.signature.signature).toBe('string');
      expect(attestation.signature.signature.length).toBeGreaterThan(100);
      expect(() => Buffer.from(attestation.signature.signature, 'base64')).not.toThrow();
    });

    it('should generate proper SHA-256 hashes for artifacts', async () => {
      await cryptoManager.initialize();
      await attestationGenerator.initialize();

      const mockContext = {
        operationId: 'test-op-003',
        type: 'generation',
        startTime: this.getDeterministicDate(),
        endTime: this.getDeterministicDate(),
        agent: {
          id: 'kgen-hash-agent',
          type: 'software',
          name: 'KGEN Hash Agent'
        }
      };

      const mockArtifact = {
        id: 'test-artifact-003',
        path: testArtifactPath,
        type: 'javascript'
      };

      const attestation = await attestationGenerator.generateAttestation(mockContext, mockArtifact);

      // Verify artifact hash is properly calculated
      expect(attestation.artifact.hash).toBeDefined();
      expect(typeof attestation.artifact.hash).toBe('string');
      expect(attestation.artifact.hash.length).toBe(64); // SHA-256 hex length

      // Verify hash matches actual file content
      const fileContent = await fs.readFile(testArtifactPath, 'utf8');
      const expectedHash = crypto.createHash('sha256').update(fileContent).digest('hex');
      expect(attestation.artifact.hash).toBe(expectedHash);
    });

    it('should create valid .attest.json sidecar files', async () => {
      await cryptoManager.initialize();
      await attestationGenerator.initialize();

      const mockContext = {
        operationId: 'test-op-004',
        type: 'generation',
        startTime: this.getDeterministicDate(),
        endTime: this.getDeterministicDate(),
        agent: {
          id: 'kgen-sidecar-agent',
          type: 'software',
          name: 'KGEN Sidecar Agent'
        }
      };

      const mockArtifact = {
        id: 'test-artifact-004',
        path: testArtifactPath,
        type: 'javascript'
      };

      const attestation = await attestationGenerator.generateAttestation(mockContext, mockArtifact);
      const sidecarPath = await attestationGenerator.writeAttestationSidecar(testArtifactPath, attestation);

      // Verify sidecar file was created
      expect(existsSync(sidecarPath)).toBe(true);
      expect(sidecarPath).toBe(`${testArtifactPath}.attest.json`);

      // Verify sidecar content is valid JSON
      const sidecarContent = await fs.readFile(sidecarPath, 'utf8');
      const parsedAttestation = JSON.parse(sidecarContent);

      expect(parsedAttestation.signature).not.toBe(null);
      expect(parsedAttestation.signature.signature).toBeDefined();
      expect(parsedAttestation.artifact.hash).toBeDefined();
      expect(parsedAttestation.attestationId).toBeDefined();
    });

    it('should verify signatures correctly', async () => {
      await cryptoManager.initialize();
      await attestationGenerator.initialize();

      const mockContext = {
        operationId: 'test-op-005',
        type: 'generation',
        startTime: this.getDeterministicDate(),
        endTime: this.getDeterministicDate(),
        agent: {
          id: 'kgen-verify-agent',
          type: 'software',
          name: 'KGEN Verify Agent'
        }
      };

      const mockArtifact = {
        id: 'test-artifact-005',
        path: testArtifactPath,
        type: 'javascript'
      };

      const attestation = await attestationGenerator.generateAttestation(mockContext, mockArtifact);

      // Verify the signature using crypto manager
      const isValid = await cryptoManager.verifyAttestation(attestation);
      expect(isValid).toBe(true);
    });

    it('should validate attestation integrity', async () => {
      await cryptoManager.initialize();
      await attestationGenerator.initialize();

      const mockContext = {
        operationId: 'test-op-006',
        type: 'generation',
        startTime: this.getDeterministicDate(),
        endTime: this.getDeterministicDate(),
        agent: {
          id: 'kgen-integrity-agent',
          type: 'software',
          name: 'KGEN Integrity Agent'
        }
      };

      const mockArtifact = {
        id: 'test-artifact-006',
        path: testArtifactPath,
        type: 'javascript'
      };

      const attestation = await attestationGenerator.generateAttestation(mockContext, mockArtifact);
      const validation = await attestationGenerator.validateAttestation(attestation);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect tampered artifacts', async () => {
      await cryptoManager.initialize();
      await attestationGenerator.initialize();

      const mockContext = {
        operationId: 'test-op-007',
        type: 'generation',
        startTime: this.getDeterministicDate(),
        endTime: this.getDeterministicDate(),
        agent: {
          id: 'kgen-tamper-agent',
          type: 'software',
          name: 'KGEN Tamper Agent'
        }
      };

      const mockArtifact = {
        id: 'test-artifact-007',
        path: testArtifactPath,
        type: 'javascript'
      };

      // Generate original attestation
      const originalAttestation = await attestationGenerator.generateAttestation(mockContext, mockArtifact);

      // Tamper with the artifact
      await fs.writeFile(testArtifactPath, 'console.log("TAMPERED!");');

      // Validate should now fail
      const validation = await attestationGenerator.validateAttestation(originalAttestation);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('hash mismatch');
    });
  });

  describe('Signature Chain Creation', () => {
    it('should create verifiable signature chains', async () => {
      await cryptoManager.initialize();

      const operations = [
        {
          operationId: 'op-001',
          type: 'generation',
          startTime: new Date('2025-01-01T10:00:00.000Z'),
          endTime: new Date('2025-01-01T10:01:00.000Z'),
          integrityHash: 'hash001'
        },
        {
          operationId: 'op-002', 
          type: 'generation',
          startTime: new Date('2025-01-01T10:02:00.000Z'),
          endTime: new Date('2025-01-01T10:03:00.000Z'),
          integrityHash: 'hash002'
        },
        {
          operationId: 'op-003',
          type: 'generation',
          startTime: new Date('2025-01-01T10:04:00.000Z'),
          endTime: new Date('2025-01-01T10:05:00.000Z'),
          integrityHash: 'hash003'
        }
      ];

      const signatureChain = await cryptoManager.createSignatureChain(operations);

      expect(signatureChain.id).toBeDefined();
      expect(signatureChain.links).toHaveLength(3);
      expect(signatureChain.chainSignature).toBeDefined();
      expect(signatureChain.keyFingerprint).toBeDefined();

      // Verify chain integrity
      const verification = await cryptoManager.verifySignatureChain(signatureChain);
      expect(verification.valid).toBe(true);
      expect(verification.validLinks).toBe(3);
      expect(verification.brokenLinks).toHaveLength(0);
      expect(verification.integrityScore).toBe(1);
    });
  });

  describe('Merkle Tree Proofs', () => {
    it('should generate and verify Merkle proofs for operations', async () => {
      await cryptoManager.initialize();

      const operations = [
        { operationId: 'op-001', integrityHash: 'hash001' },
        { operationId: 'op-002', integrityHash: 'hash002' },
        { operationId: 'op-003', integrityHash: 'hash003' },
        { operationId: 'op-004', integrityHash: 'hash004' }
      ];

      const merkleTree = cryptoManager.generateMerkleTree(operations);

      expect(merkleTree.root).toBeDefined();
      expect(merkleTree.proofs.size).toBe(4);

      // Verify each proof
      for (const operation of operations) {
        const proof = merkleTree.proofs.get(operation.operationId);
        const leafHash = cryptoManager.generateHash(operation.integrityHash);
        
        const isValid = cryptoManager.verifyMerkleProof(leafHash, proof, merkleTree.root);
        expect(isValid).toBe(true);
      }
    });
  });
});