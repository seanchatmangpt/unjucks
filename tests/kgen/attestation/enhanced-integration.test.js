/**
 * Enhanced Attestation System Integration Tests
 * 
 * Comprehensive test suite for the complete attestation system
 */

import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { rm, mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

import { AttestationGenerator } from '../../../src/kgen/attestation/generator.js';
import { AttestResolver } from '../../../src/kgen/attestation/attest-resolver.js';
import { JWTHandler } from '../../../src/kgen/attestation/jwt-handler.js';
import { KeyManager } from '../../../src/kgen/attestation/key-manager.js';

describe('Enhanced Attestation System Integration', () => {
  let testDir;
  let attestationGenerator;
  let attestResolver;
  let jwtHandler;
  let keyManager;
  let testArtifactPath;
  let testArtifactContent;

  beforeAll(async () => {
    // Create test directory
    testDir = join(tmpdir(), `kgen-attestation-test-${this.getDeterministicTimestamp()}`);
    await mkdir(testDir, { recursive: true });
    
    // Initialize test components with test directory
    const options = {
      keyDirectory: join(testDir, 'keys'),
      storageDir: join(testDir, 'attestations')
    };
    
    attestationGenerator = new AttestationGenerator({
      ...options,
      attestationFormat: 'enhanced',
      signAttestations: true,
      storeAttestations: true
    });
    
    attestResolver = new AttestResolver(options);
    jwtHandler = new JWTHandler(options);
    keyManager = new KeyManager(options);
    
    // Create test artifact
    testArtifactContent = `
// Test JavaScript file
function calculateSum(a, b) {
  return a + b;
}

module.exports = { calculateSum };
    `.trim();
    
    testArtifactPath = join(testDir, 'test-artifact.js');
    await writeFile(testArtifactPath, testArtifactContent, 'utf8');
  });

  afterAll(async () => {
    // Cleanup test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error.message);
    }
  });

  beforeEach(async () => {
    // Reset state between tests
    if (attestationGenerator.initialized) {
      attestationGenerator.attestations.clear();
      attestationGenerator.metrics = {
        generated: 0,
        verified: 0,
        signed: 0,
        resolved: 0,
        processingTime: 0,
        errors: 0
      };
    }
  });

  describe('System Initialization', () => {
    it('should initialize all components successfully', async () => {
      await attestationGenerator.initialize();
      
      expect(attestationGenerator.initialized).toBe(true);
      expect(attestResolver.initialized).toBe(true);
      expect(jwtHandler.initialized).toBe(true);
      expect(keyManager.initialized).toBe(true);
    });

    it('should generate default signing key', async () => {
      await attestationGenerator.initialize();
      
      const keys = await keyManager.listKeys({ status: 'active' });
      expect(keys.length).toBeGreaterThan(0);
      
      const defaultKey = keys[0];
      expect(defaultKey).toHaveProperty('keyId');
      expect(defaultKey).toHaveProperty('algorithm');
      expect(defaultKey).toHaveProperty('fingerprint');
    });
  });

  describe('Enhanced Attestation Generation', () => {
    it('should generate enhanced format attestation', async () => {
      await attestationGenerator.initialize();
      
      const attestation = await attestationGenerator.generateAttestation(testArtifactPath, {
        sourceType: 'test-file',
        creator: 'integration-test'
      });
      
      expect(attestation).toHaveProperty('version', '2.0.0');
      expect(attestation).toHaveProperty('format', 'enhanced');
      expect(attestation).toHaveProperty('artifact');
      expect(attestation).toHaveProperty('provenance');
      expect(attestation).toHaveProperty('attestURI');
      expect(attestation).toHaveProperty('signature');
      
      expect(attestation.artifact).toHaveProperty('cid');
      expect(attestation.artifact).toHaveProperty('contentHash');
      expect(attestation.artifact).toHaveProperty('size');
      expect(attestation.artifact).toHaveProperty('type', 'javascript');
      
      expect(attestation.compliance.standards).toContain('SLSA-L3');
      expect(attestation.compliance.verifiable).toBe(true);
    });

    it('should generate JWT format attestation', async () => {
      const jwtGenerator = new AttestationGenerator({
        keyDirectory: join(testDir, 'keys'),
        storageDir: join(testDir, 'attestations'),
        attestationFormat: 'jwt',
        jwtSignatures: true
      });
      
      await jwtGenerator.initialize();
      
      const attestation = await jwtGenerator.generateAttestation(testArtifactPath, {
        sourceType: 'test-file',
        creator: 'integration-test'
      });
      
      expect(attestation).toHaveProperty('format', 'jwt');
      expect(attestation).toHaveProperty('jwt');
      expect(attestation.jwt).toHaveProperty('token');
      expect(attestation.jwt).toHaveProperty('keyId');
      expect(attestation.jwt).toHaveProperty('algorithm');
      
      // Verify JWT format
      const jwtParts = attestation.jwt.token.split('.');
      expect(jwtParts).toHaveLength(3);
    });

    it('should include enhanced provenance information', async () => {
      await attestationGenerator.initialize();
      
      const attestation = await attestationGenerator.generateAttestation(testArtifactPath, {
        dependencies: ['test-dep-1', 'test-dep-2'],
        configuration: { test: true }
      });
      
      expect(attestation.provenance).toHaveProperty('generator');
      expect(attestation.provenance).toHaveProperty('source');
      expect(attestation.provenance).toHaveProperty('build');
      expect(attestation.provenance).toHaveProperty('chain');
      expect(attestation.provenance).toHaveProperty('integrity');
      expect(attestation.provenance).toHaveProperty('temporal');
      
      expect(attestation.provenance.build.dependencies).toEqual(['test-dep-1', 'test-dep-2']);
      expect(attestation.provenance.build.configuration).toEqual({ test: true });
      
      expect(attestation.provenance.chain).toHaveLength(1);
      expect(attestation.provenance.chain[0]).toHaveProperty('step', 'attestation-generation');
    });
  });

  describe('Attest:// URI Resolution', () => {
    it('should store and resolve attestations via attest:// URI', async () => {
      await attestationGenerator.initialize();
      
      // Generate attestation with storage
      const originalAttestation = await attestationGenerator.generateAttestation(testArtifactPath);
      expect(originalAttestation).toHaveProperty('attestURI');
      
      const attestURI = originalAttestation.attestURI;
      expect(attestURI).toMatch(/^attest:\/\/sha256\/[a-fA-F0-9]+$/);
      
      // Resolve the attestation
      const resolved = await attestationGenerator.resolveAttestURI(attestURI);
      
      expect(resolved).toHaveProperty('uri', attestURI);
      expect(resolved).toHaveProperty('hash');
      expect(resolved).toHaveProperty('algorithm', 'sha256');
      expect(resolved).toHaveProperty('attestation');
      expect(resolved).toHaveProperty('verified', true);
      
      // Verify content integrity
      expect(resolved.attestation.artifact.cid).toBe(originalAttestation.artifact.cid);
      expect(resolved.attestation.artifact.contentHash).toBe(originalAttestation.artifact.contentHash);
    });

    it('should verify attestation integrity during resolution', async () => {
      await attestationGenerator.initialize();
      
      const attestation = await attestationGenerator.generateAttestation(testArtifactPath);
      const attestURI = attestation.attestURI;
      
      // Resolve and verify
      const resolved = await attestationGenerator.resolveAttestURI(attestURI);
      const verificationResult = await attestResolver.verifyAttestation(resolved.attestation, resolved.hash);
      
      expect(verificationResult.valid).toBe(true);
      expect(verificationResult.checks.contentHash).toBe(true);
      expect(verificationResult.checks.signature).toBe(true);
      expect(verificationResult.checks.timestamp).toBe(true);
    });

    it('should detect tampered attestations', async () => {
      await attestationGenerator.initialize();
      
      const attestation = await attestationGenerator.generateAttestation(testArtifactPath);
      
      // Tamper with attestation content
      const tamperedAttestation = { ...attestation };
      tamperedAttestation.artifact.contentHash = 'tampered-hash';
      
      // Verification should fail
      const verificationResult = await attestResolver.verifyAttestation(tamperedAttestation, 'expected-hash');
      
      expect(verificationResult.valid).toBe(false);
      expect(verificationResult.error).toBeDefined();
    });
  });

  describe('Key Management Integration', () => {
    it('should generate and use Ed25519 keys', async () => {
      await keyManager.initialize();
      
      const keyInfo = await keyManager.generateKeyPair({
        algorithm: 'Ed25519',
        keyId: 'test-ed25519',
        purpose: 'signing'
      });
      
      expect(keyInfo).toHaveProperty('keyId', 'test-ed25519');
      expect(keyInfo).toHaveProperty('algorithm', 'Ed25519');
      expect(keyInfo).toHaveProperty('fingerprint');
      expect(keyInfo).toHaveProperty('publicKey');
      
      // Use key for signing
      const keyPair = await keyManager.loadKeyPair('test-ed25519');
      expect(keyPair).toHaveProperty('privateKey');
      expect(keyPair).toHaveProperty('publicKey');
      expect(keyPair.usage.signatureCount).toBe(1); // Incremented by loadKeyPair
    });

    it('should support key rotation', async () => {
      await keyManager.initialize();
      
      // Generate initial key
      const originalKey = await keyManager.generateKeyPair({
        algorithm: 'RSA-2048',
        keyId: 'rotation-test',
        purpose: 'signing'
      });
      
      // Rotate key
      const newKey = await keyManager.rotateKey('rotation-test', {
        reason: 'scheduled'
      });
      
      expect(newKey.keyId).not.toBe(originalKey.keyId);
      expect(newKey.algorithm).toBe(originalKey.algorithm);
      
      // Original key should be marked as rotated
      const keys = await keyManager.listKeys();
      const rotatedKey = keys.find(k => k.keyId === originalKey.keyId);
      expect(rotatedKey.status).toBe('rotated');
      expect(rotatedKey.rotatedTo).toBe(newKey.keyId);
    });

    it('should export keys in JWK format', async () => {
      await keyManager.initialize();
      
      const keyInfo = await keyManager.generateKeyPair({
        algorithm: 'Ed25519',
        keyId: 'jwk-test'
      });
      
      const jwk = await keyManager.exportKey('jwk-test', 'jwk');
      
      expect(jwk).toHaveProperty('kty', 'OKP');
      expect(jwk).toHaveProperty('kid', 'jwk-test');
      expect(jwk).toHaveProperty('alg', 'EdDSA');
      expect(jwk).toHaveProperty('crv', 'Ed25519');
      expect(jwk).toHaveProperty('x');
    });
  });

  describe('JWT Integration', () => {
    it('should create and verify JWT tokens', async () => {
      await jwtHandler.initialize();
      await keyManager.initialize();
      
      // Generate signing key
      await keyManager.generateKeyPair({
        algorithm: 'Ed25519',
        keyId: 'jwt-test'
      });
      
      // Create JWT
      const payload = {
        'urn:kgen:artifact': {
          cid: 'test-cid',
          contentHash: 'test-hash'
        }
      };
      
      const token = await jwtHandler.createToken(payload, {
        keyId: 'jwt-test',
        algorithm: 'EdDSA'
      });
      
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
      
      // Verify JWT
      const verification = await jwtHandler.verifyToken(token);
      
      expect(verification.valid).toBe(true);
      expect(verification.payload['urn:kgen:artifact']).toEqual(payload['urn:kgen:artifact']);
      expect(verification.header.alg).toBe('EdDSA');
      expect(verification.header.kid).toBe('jwt-test');
    });

    it('should handle token expiration', async () => {
      await jwtHandler.initialize();
      await keyManager.initialize();
      
      await keyManager.generateKeyPair({
        algorithm: 'HMAC-256',
        keyId: 'expiry-test'
      });
      
      // Create token that expires immediately
      const token = await jwtHandler.createToken({ test: true }, {
        keyId: 'expiry-test',
        algorithm: 'HS256',
        expiresIn: 0 // Already expired
      });
      
      // Wait to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const verification = await jwtHandler.verifyToken(token);
      
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('expired');
    });
  });

  describe('Performance and Metrics', () => {
    it('should track performance metrics', async () => {
      await attestationGenerator.initialize();
      
      // Generate multiple attestations
      for (let i = 0; i < 3; i++) {
        const content = `test content ${i}`;
        const path = join(testDir, `test-${i}.txt`);
        await writeFile(path, content);
        
        await attestationGenerator.generateAttestation(path);
      }
      
      const metrics = await attestationGenerator.getMetrics();
      
      expect(metrics.generator.generated).toBe(3);
      expect(metrics.generator.signed).toBe(3);
      expect(metrics.generator.processingTime).toBeGreaterThan(0);
      
      expect(metrics).toHaveProperty('cas');
      expect(metrics).toHaveProperty('keys');
      expect(metrics).toHaveProperty('resolver');
      expect(metrics).toHaveProperty('system');
    });

    it('should demonstrate acceptable performance', async () => {
      await attestationGenerator.initialize();
      
      const startTime = performance.now();
      
      // Generate attestation for larger content
      const largeContent = 'x'.repeat(10000); // 10KB
      const largePath = join(testDir, 'large-test.txt');
      await writeFile(largePath, largeContent);
      
      const attestation = await attestationGenerator.generateAttestation(largePath);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
      
      expect(attestation.artifact.size).toBe(10000);
      expect(attestation.artifact.cid).toBeDefined();
      expect(attestation.provenance).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing files gracefully', async () => {
      await attestationGenerator.initialize();
      
      const nonExistentPath = join(testDir, 'does-not-exist.txt');
      
      await expect(
        attestationGenerator.generateAttestation(nonExistentPath)
      ).rejects.toThrow(/ENOENT|no such file/i);
    });

    it('should handle invalid attest URIs', async () => {
      await attestResolver.initialize();
      
      const invalidURI = 'attest://invalid/format';
      
      await expect(
        attestationGenerator.resolveAttestURI(invalidURI)
      ).rejects.toThrow(/Invalid attest URI format/);
    });

    it('should handle non-existent attestations', async () => {
      await attestResolver.initialize();
      
      const nonExistentURI = 'attest://sha256/0000000000000000000000000000000000000000000000000000000000000000';
      
      await expect(
        attestationGenerator.resolveAttestURI(nonExistentURI)
      ).rejects.toThrow(/Attestation not found/);
    });

    it('should handle revoked keys', async () => {
      await keyManager.initialize();
      
      // Generate and then revoke key
      const keyInfo = await keyManager.generateKeyPair({
        algorithm: 'Ed25519',
        keyId: 'revoke-test'
      });
      
      await keyManager.revokeKey('revoke-test', 'test-revocation');
      
      // Attempting to export revoked key should fail
      await expect(
        keyManager.exportKey('revoke-test', 'jwk')
      ).rejects.toThrow(/Cannot export revoked key/);
    });
  });

  describe('Compliance and Standards', () => {
    it('should meet SLSA Level 3 requirements', async () => {
      await attestationGenerator.initialize();
      
      const attestation = await attestationGenerator.generateAttestation(testArtifactPath);
      
      // Check SLSA L3 requirements
      expect(attestation.compliance.standards).toContain('SLSA-L3');
      expect(attestation.compliance.level).toBe('L3');
      expect(attestation.compliance.verifiable).toBe(true);
      expect(attestation.compliance.signed).toBe(true);
      
      // Provenance should be comprehensive
      expect(attestation.provenance.generator).toBeDefined();
      expect(attestation.provenance.source).toBeDefined();
      expect(attestation.provenance.build).toBeDefined();
      expect(attestation.provenance.chain).toHaveLength(1);
      expect(attestation.provenance.integrity).toBeDefined();
      
      // Security features
      expect(attestation).toHaveProperty('security');
      expect(attestation.security.algorithm).toBe('sha256');
      expect(attestation).toHaveProperty('trustChain');
      expect(attestation.trustChain).toBeInstanceOf(Array);
      expect(attestation.trustChain.length).toBeGreaterThan(0);
    });

    it('should provide comprehensive audit trail', async () => {
      await attestationGenerator.initialize();
      
      const attestation = await attestationGenerator.generateAttestation(testArtifactPath, {
        auditContext: 'integration-test',
        creator: 'test-system'
      });
      
      // Audit information should be present
      expect(attestation.metadata.creator).toBe('test-system');
      expect(attestation.metadata.processingTime).toBeGreaterThan(0);
      expect(attestation.provenance.temporal.created).toBeDefined();
      expect(attestation.provenance.temporal.validFrom).toBeDefined();
      expect(attestation.provenance.temporal.validUntil).toBeDefined();
      
      // Verification trail
      expect(attestation.verification.methods).toContain('content-hash');
      expect(attestation.verification.methods).toContain('cid');
      expect(attestation.verification.methods).toContain('signature');
      expect(attestation.verification.automated).toBe(true);
    });
  });
});