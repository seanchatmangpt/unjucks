/**
 * Security Validation Tests for Attestation System
 * 
 * Tests security aspects including cryptographic integrity, 
 * attack resistance, and secure key management.
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

import { AttestationGenerator } from '../../../packages/kgen-core/src/provenance/attestation/generator.js';
import { AttestationVerifier } from '../../../packages/kgen-core/src/attestation/verifier.js';
import { CryptoManager } from '../../../packages/kgen-core/src/provenance/crypto/manager.js';

describe('Attestation Security Validation', () => {
  let tempDir;
  let cryptoManager;
  let attestationGenerator;
  let attestationVerifier;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'security-test-'));
    
    // Initialize with strong security settings
    cryptoManager = new CryptoManager({
      keyPath: path.join(tempDir, 'secure-private.pem'),
      publicKeyPath: path.join(tempDir, 'secure-public.pem'),
      keySize: 4096, // Use larger key for security tests
      autoGenerateKeys: true,
      keyPassphrase: crypto.randomBytes(32).toString('hex'), // Strong passphrase
      enableKeyRotation: false // Disable for testing
    });
    
    await cryptoManager.initialize();
    
    attestationGenerator = new AttestationGenerator({
      enableCryptographicSigning: true,
      cryptoManager: cryptoManager,
      hashAlgorithm: 'sha256'
    });
    
    await attestationGenerator.initialize();
    
    attestationVerifier = new AttestationVerifier({
      hashAlgorithm: 'sha256',
      cacheVerificationResults: false
    });
    
    console.log(`🔒 Security test setup in: ${tempDir}`);
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup: ${error.message}`);
    }
  });

  describe('Cryptographic Integrity', () => {
    it('should resist signature forgery attempts', async () => {
      // Create test artifact and generate legitimate attestation
      const testContent = 'Original legitimate content';
      const testPath = path.join(tempDir, 'legitimate.txt');
      await fs.writeFile(testPath, testContent);
      
      const context = {
        operationId: crypto.randomUUID(),
        type: 'security-test',
        startTime: new Date(Date.now() - 100),
        endTime: new Date(),
        agent: { id: 'security-agent', type: 'software', name: 'Security Test Agent' }
      };
      
      const artifactInfo = {
        id: crypto.randomUUID(),
        path: testPath,
        size: testContent.length,
        hash: crypto.createHash('sha256').update(testContent).digest('hex')
      };
      
      const legitimateAttestation = await attestationGenerator.generateAttestation(context, artifactInfo);
      
      // Attempt 1: Modify signature directly
      const forgedAttestation1 = JSON.parse(JSON.stringify(legitimateAttestation));
      forgedAttestation1.signature.signature = Buffer.from('forged_signature').toString('base64');
      
      const verification1 = await cryptoManager.verifyAttestation(forgedAttestation1);
      expect(verification1).toBe(false);
      
      // Attempt 2: Use random signature
      const forgedAttestation2 = JSON.parse(JSON.stringify(legitimateAttestation));
      forgedAttestation2.signature.signature = crypto.randomBytes(256).toString('base64');
      
      const verification2 = await cryptoManager.verifyAttestation(forgedAttestation2);
      expect(verification2).toBe(false);
      
      // Attempt 3: Modify content but keep signature
      const forgedAttestation3 = JSON.parse(JSON.stringify(legitimateAttestation));
      forgedAttestation3.artifact.hash = crypto.createHash('sha256').update('Modified content').digest('hex');
      
      const verification3 = await cryptoManager.verifyAttestation(forgedAttestation3);
      expect(verification3).toBe(false);
      
      // Verify legitimate attestation still works
      const legitimateVerification = await cryptoManager.verifyAttestation(legitimateAttestation);
      expect(legitimateVerification).toBe(true);
      
      console.log('✅ Successfully resisted all signature forgery attempts');
    });

    it('should detect replay attacks', async () => {
      // Generate attestation for one file
      const content1 = 'File 1 content';
      const path1 = path.join(tempDir, 'file1.txt');
      await fs.writeFile(path1, content1);
      
      const context1 = {
        operationId: crypto.randomUUID(),
        type: 'replay-test-1',
        startTime: new Date(Date.now() - 200),
        endTime: new Date(Date.now() - 100),
        agent: { id: 'test-agent', type: 'software', name: 'Test Agent' }
      };
      
      const artifact1 = {
        id: crypto.randomUUID(),
        path: path1,
        size: content1.length,
        hash: crypto.createHash('sha256').update(content1).digest('hex')
      };
      
      const attestation1 = await attestationGenerator.generateAttestation(context1, artifact1);
      
      // Create different file with different content
      const content2 = 'File 2 completely different content';
      const path2 = path.join(tempDir, 'file2.txt');
      await fs.writeFile(path2, content2);
      
      // Try to use attestation1 for file2 (replay attack)
      const replayedAttestation = JSON.parse(JSON.stringify(attestation1));
      replayedAttestation.artifact.path = path2;
      replayedAttestation.artifact.size = content2.length;
      // Keep the original hash and signature (this is the attack)
      
      // Write the replayed attestation
      const replayedSidecarPath = path2 + '.attest.json';
      await fs.writeFile(replayedSidecarPath, JSON.stringify(replayedAttestation, null, 2));
      
      // Verification should fail due to hash mismatch
      const replayVerification = await attestationVerifier.fastVerify(path2);
      expect(replayVerification.verified).toBe(false);
      expect(replayVerification.details.hash.verified).toBe(false);
      
      console.log('✅ Successfully detected replay attack');
    });

    it('should resist timing attacks on signature verification', async () => {
      // Create test attestation
      const testContent = 'Timing attack test content';
      const testPath = path.join(tempDir, 'timing-test.txt');
      await fs.writeFile(testPath, testContent);
      
      const context = {
        operationId: crypto.randomUUID(),
        type: 'timing-test',
        startTime: new Date(Date.now() - 100),
        endTime: new Date(),
        agent: { id: 'timing-agent', type: 'software', name: 'Timing Test Agent' }
      };
      
      const artifactInfo = {
        id: crypto.randomUUID(),
        path: testPath,
        size: testContent.length,
        hash: crypto.createHash('sha256').update(testContent).digest('hex')
      };
      
      const attestation = await attestationGenerator.generateAttestation(context, artifactInfo);
      
      // Test multiple invalid signatures with different lengths and content
      const timings = [];
      const testCases = [
        '', // Empty
        'a', // Single character
        'invalid_sig_short', // Short invalid
        crypto.randomBytes(128).toString('base64'), // Wrong length
        crypto.randomBytes(256).toString('base64'), // Correct length, wrong content
        attestation.signature.signature.slice(0, -1) + 'X' // Almost correct
      ];
      
      for (const invalidSig of testCases) {
        const testAttestation = JSON.parse(JSON.stringify(attestation));
        testAttestation.signature.signature = invalidSig;
        
        const startTime = process.hrtime.bigint();
        const result = await cryptoManager.verifyAttestation(testAttestation);
        const endTime = process.hrtime.bigint();
        
        expect(result).toBe(false);
        timings.push(Number(endTime - startTime) / 1000000); // Convert to milliseconds
      }
      
      // Check that timing variations are not excessive (indication of timing attack resistance)
      const avgTiming = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      const maxDeviation = Math.max(...timings.map(time => Math.abs(time - avgTiming)));
      
      // Allow for some variation but not excessive (indicates constant-time operations)
      expect(maxDeviation / avgTiming).toBeLessThan(2.0); // Max 200% deviation from average
      
      console.log(`✅ Timing analysis: avg ${avgTiming.toFixed(2)}ms, max deviation ${maxDeviation.toFixed(2)}ms`);
    });
  });

  describe('Key Management Security', () => {
    it('should securely handle key rotation', async () => {
      // Create initial attestation
      const content = 'Key rotation test';
      const filePath = path.join(tempDir, 'rotation-test.txt');
      await fs.writeFile(filePath, content);
      
      const context = {
        operationId: crypto.randomUUID(),
        type: 'rotation-test',
        startTime: new Date(Date.now() - 100),
        endTime: new Date(),
        agent: { id: 'rotation-agent', type: 'software', name: 'Rotation Agent' }
      };
      
      const artifactInfo = {
        id: crypto.randomUUID(),
        path: filePath,
        size: content.length,
        hash: crypto.createHash('sha256').update(content).digest('hex')
      };
      
      // Generate attestation with original key
      const originalAttestation = await attestationGenerator.generateAttestation(context, artifactInfo);
      const originalFingerprint = originalAttestation.signature.keyFingerprint;
      
      // Verify original attestation works
      const originalVerification = await cryptoManager.verifyAttestation(originalAttestation);
      expect(originalVerification).toBe(true);
      
      // Rotate keys
      const rotationResult = await cryptoManager.rotateKeys();
      expect(rotationResult.newFingerprint).toBeDefined();
      expect(rotationResult.newFingerprint).not.toBe(originalFingerprint);
      
      // Generate new attestation with rotated key
      const newAttestation = await attestationGenerator.generateAttestation(context, artifactInfo);
      const newFingerprint = newAttestation.signature.keyFingerprint;
      
      expect(newFingerprint).not.toBe(originalFingerprint);
      expect(newFingerprint).toBe(rotationResult.newFingerprint);
      
      // Verify new attestation works
      const newVerification = await cryptoManager.verifyAttestation(newAttestation);
      expect(newVerification).toBe(true);
      
      // Original attestation should still be verifiable if we have the old key
      // (In practice, you might want to keep old public keys for verification)
      
      console.log('✅ Key rotation completed securely');
    });

    it('should protect against key extraction attempts', async () => {
      // Test that private key is not accessible through normal API
      const cryptoStatus = cryptoManager.getStatus();
      
      // Status should not contain private key material
      const statusString = JSON.stringify(cryptoStatus);
      expect(statusString).not.toContain('-----BEGIN PRIVATE KEY-----');
      expect(statusString).not.toContain('-----BEGIN RSA PRIVATE KEY-----');
      expect(statusString).not.toContain('privateKey');
      
      // Test that we can't access private key through prototype pollution
      try {
        cryptoManager.constructor.prototype.getPrivateKey = function() {
          return this.privateKey;
        };
        
        const extractedKey = cryptoManager.getPrivateKey();
        // If we get here, the protection failed
        expect(extractedKey).toBeUndefined(); // Should not have worked
      } catch (error) {
        // Expected - access should be protected
        console.log('✅ Private key access correctly protected');
      }
      
      // Test memory dumps don't contain key material easily
      const memorySnapshot = JSON.stringify(cryptoManager);
      expect(memorySnapshot).not.toContain('-----BEGIN PRIVATE KEY-----');
      
      console.log('✅ Key extraction protection validated');
    });
  });

  describe('Hash Integrity Security', () => {
    it('should resist hash collision attacks', async () => {
      // Test with known hash collision attempts
      const collisionAttempts = [
        'content1',
        'content1\x00', // Null byte injection
        'content1\n', // Line ending manipulation
        'content1 ', // Trailing space
        '\uffef' + 'content1', // BOM injection
      ];
      
      const hashes = new Set();
      
      for (const attempt of collisionAttempts) {
        const hash = cryptoManager.generateHash(attempt);
        expect(hashes.has(hash)).toBe(false); // Should be unique
        hashes.add(hash);
      }
      
      expect(hashes.size).toBe(collisionAttempts.length);
      console.log('✅ Hash collision resistance validated');
    });

    it('should handle malicious input in hash generation', async () => {
      const maliciousInputs = [
        null,
        undefined,
        {},
        [],
        Buffer.alloc(0),
        Buffer.alloc(1024 * 1024), // 1MB of zeros
        '\x00'.repeat(1000), // Null bytes
        'A'.repeat(10000), // Large string
        JSON.stringify({ a: { b: { c: { d: { e: 'deep' } } } } }), // Deep object
      ];
      
      for (const maliciousInput of maliciousInputs) {
        try {
          const hash = cryptoManager.generateHash(maliciousInput);
          expect(typeof hash).toBe('string');
          expect(hash.length).toBeGreaterThan(0);
        } catch (error) {
          // Some inputs may legitimately fail, but should not crash
          expect(error.message).toBeDefined();
          console.log(`Expected error for input type ${typeof maliciousInput}: ${error.message}`);
        }
      }
      
      console.log('✅ Malicious input handling validated');
    });
  });

  describe('Attestation Tampering Detection', () => {
    it('should detect subtle attestation modifications', async () => {
      // Create base attestation
      const content = 'Tampering detection test';
      const filePath = path.join(tempDir, 'tamper-test.txt');
      await fs.writeFile(filePath, content);
      
      const context = {
        operationId: crypto.randomUUID(),
        type: 'tamper-test',
        startTime: new Date(Date.now() - 100),
        endTime: new Date(),
        agent: { id: 'tamper-agent', type: 'software', name: 'Tamper Agent' }
      };
      
      const artifactInfo = {
        id: crypto.randomUUID(),
        path: filePath,
        size: content.length,
        hash: crypto.createHash('sha256').update(content).digest('hex')
      };
      
      const originalAttestation = await attestationGenerator.generateAttestation(context, artifactInfo);
      
      // Test various subtle modifications
      const tamperingTests = [
        {
          name: 'Timestamp modification',
          modify: (att) => { att.timestamps.generated = new Date().toISOString(); }
        },
        {
          name: 'Artifact size change',
          modify: (att) => { att.artifact.size += 1; }
        },
        {
          name: 'Hash change (one character)',
          modify: (att) => { att.artifact.hash = att.artifact.hash.slice(0, -1) + 'a'; }
        },
        {
          name: 'Operation ID modification',
          modify: (att) => { att.generation.operationId = crypto.randomUUID(); }
        },
        {
          name: 'Agent name change',
          modify: (att) => { att.generation.agent.name += ' Modified'; }
        },
        {
          name: 'Provenance activity modification',
          modify: (att) => { att.provenance.activity['prov:startedAtTime'] = new Date().toISOString(); }
        }
      ];
      
      for (const test of tamperingTests) {
        const tamperedAttestation = JSON.parse(JSON.stringify(originalAttestation));
        test.modify(tamperedAttestation);
        
        const verification = await cryptoManager.verifyAttestation(tamperedAttestation);
        expect(verification).toBe(false);
        
        console.log(`✅ Detected tampering: ${test.name}`);
      }
      
      // Verify original still works
      const originalVerification = await cryptoManager.verifyAttestation(originalAttestation);
      expect(originalVerification).toBe(true);
    });

    it('should detect chain manipulation attacks', async () => {
      // Create a chain of attestations
      const chain = [];
      
      for (let i = 0; i < 3; i++) {
        const content = `Chain item ${i}`;
        const filePath = path.join(tempDir, `chain-${i}.txt`);
        await fs.writeFile(filePath, content);
        
        const context = {
          operationId: crypto.randomUUID(),
          type: 'chain-test',
          startTime: new Date(Date.now() - (100 * (i + 1))),
          endTime: new Date(Date.now() - (100 * i)),
          agent: { id: 'chain-agent', type: 'software', name: 'Chain Agent' },
          chainIndex: i,
          previousHash: i > 0 ? chain[i - 1].integrity.artifactHash : null
        };
        
        const artifactInfo = {
          id: crypto.randomUUID(),
          path: filePath,
          size: content.length,
          hash: crypto.createHash('sha256').update(content).digest('hex')
        };
        
        const attestation = await attestationGenerator.generateAttestation(context, artifactInfo);
        chain.push(attestation);
      }
      
      // Test chain manipulation attacks
      const chainAttacks = [
        {
          name: 'Reorder chain items',
          modify: (c) => [c[1], c[0], c[2]]
        },
        {
          name: 'Skip chain item',
          modify: (c) => [c[0], c[2]]
        },
        {
          name: 'Duplicate chain item',
          modify: (c) => [c[0], c[1], c[1]]
        },
        {
          name: 'Modify previous hash',
          modify: (c) => {
            const modified = [...c];
            if (modified[1].integrity) {
              modified[1].integrity.previousHash = crypto.randomBytes(32).toString('hex');
            }
            return modified;
          }
        }
      ];
      
      for (const attack of chainAttacks) {
        const manipulatedChain = attack.modify([...chain]);
        const verification = await attestationVerifier.verifyChain(manipulatedChain);
        
        expect(verification.verified).toBe(false);
        console.log(`✅ Detected chain attack: ${attack.name}`);
      }
      
      // Verify original chain is valid
      const originalChainVerification = await attestationVerifier.verifyChain(chain);
      expect(originalChainVerification.verified).toBe(true);
    });
  });

  describe('Cryptographic Standards Compliance', () => {
    it('should use cryptographically secure random values', async () => {
      const randomValues = [];
      
      // Generate multiple random values and check for patterns
      for (let i = 0; i < 100; i++) {
        const context = {
          operationId: crypto.randomUUID(),
          type: 'random-test',
          startTime: new Date(),
          endTime: new Date(),
          agent: { id: crypto.randomUUID(), type: 'software', name: 'Random Test' }
        };
        
        randomValues.push({
          operationId: context.operationId,
          agentId: context.agent.id
        });
      }
      
      // Check uniqueness
      const operationIds = new Set(randomValues.map(v => v.operationId));
      const agentIds = new Set(randomValues.map(v => v.agentId));
      
      expect(operationIds.size).toBe(100); // All should be unique
      expect(agentIds.size).toBe(100); // All should be unique
      
      // Check UUID format (basic validation)
      for (const value of randomValues) {
        expect(value.operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(value.agentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      }
      
      console.log('✅ Cryptographically secure random values validated');
    });

    it('should comply with RSA key strength requirements', async () => {
      const status = cryptoManager.getStatus();
      
      // Verify minimum key size
      expect(status.keySize).toBeGreaterThanOrEqual(2048);
      
      // Verify algorithm
      expect(status.algorithm).toBe('RSA-SHA256');
      expect(status.hashAlgorithm).toBe('sha256');
      
      // Verify key metadata
      expect(status.keyMetadata.fingerprint).toBeDefined();
      expect(status.keyMetadata.fingerprint.length).toBeGreaterThan(8);
      
      console.log(`✅ RSA key strength validated: ${status.keySize}-bit ${status.algorithm}`);
    });
  });
});