/**
 * Signature System Test Suite
 * 
 * Comprehensive tests for Ed25519 digital signature implementation
 * including key generation, signing, verification, and advanced features.
 */

import { describe, it, beforeEach, expect } from '@jest/globals';
import SignatureManager from '../packages/kgen-marketplace/src/crypto/signatures.js';

describe('SignatureManager', () => {
  let signatureManager;
  let keyPair;

  beforeEach(async () => {
    keyPair = await SignatureManager.generateKeyPair();
    signatureManager = new SignatureManager(keyPair.privateKey, keyPair.publicKey);
  });

  describe('Key Generation', () => {
    it('should generate valid Ed25519 key pairs', async () => {
      const keys = await SignatureManager.generateKeyPair();
      
      expect(keys.privateKey).toBeDefined();
      expect(keys.publicKey).toBeDefined();
      expect(keys.privateKey).toHaveLength(64); // 32 bytes as hex
      expect(keys.publicKey).toHaveLength(64);  // 32 bytes as hex
    });

    it('should generate unique key pairs', async () => {
      const keys1 = await SignatureManager.generateKeyPair();
      const keys2 = await SignatureManager.generateKeyPair();
      
      expect(keys1.privateKey).not.toBe(keys2.privateKey);
      expect(keys1.publicKey).not.toBe(keys2.publicKey);
    });

    it('should set key pair correctly', () => {
      const manager = new SignatureManager();
      manager.setKeyPair(keyPair.privateKey, keyPair.publicKey);
      
      expect(manager.privateKey).toBe(keyPair.privateKey);
      expect(manager.publicKey).toBe(keyPair.publicKey);
    });
  });

  describe('Data Hashing', () => {
    it('should create consistent data hashes', () => {
      const data = { test: 'data', value: 42 };
      const timestamp = 1234567890;
      
      const hash1 = signatureManager.createDataHash(data, timestamp);
      const hash2 = signatureManager.createDataHash(data, timestamp);
      
      expect(hash1.toString('hex')).toBe(hash2.toString('hex'));
    });

    it('should create different hashes for different data', () => {
      const data1 = { test: 'data1' };
      const data2 = { test: 'data2' };
      
      const hash1 = signatureManager.createDataHash(data1);
      const hash2 = signatureManager.createDataHash(data2);
      
      expect(hash1.toString('hex')).not.toBe(hash2.toString('hex'));
    });
  });

  describe('Basic Signing and Verification', () => {
    it('should sign data successfully', async () => {
      const data = { message: 'Hello, World!', value: 123 };
      
      const signed = await signatureManager.signData(data);
      
      expect(signed.data).toBeDefined();
      expect(signed.signature).toBeDefined();
      expect(signed.publicKey).toBe(keyPair.publicKey);
      expect(signed.algorithm).toBe('Ed25519');
      expect(signed.hash).toBeDefined();
    });

    it('should throw error when signing without private key', async () => {
      const manager = new SignatureManager();
      
      await expect(manager.signData({ test: 'data' }))
        .rejects.toThrow('Private key required for signing');
    });

    it('should verify valid signatures', async () => {
      const data = { important: 'data', timestamp: Date.now() };
      
      const signed = await signatureManager.signData(data);
      const verification = await SignatureManager.verifySignature(signed);
      
      expect(verification.valid).toBe(true);
      expect(verification.publicKey).toBe(keyPair.publicKey);
      expect(verification.algorithm).toBe('Ed25519');
    });

    it('should reject invalid signatures', async () => {
      const data = { test: 'data' };
      const signed = await signatureManager.signData(data);
      
      // Tamper with signature
      signed.signature = signed.signature.replace('a', 'b');
      
      const verification = await SignatureManager.verifySignature(signed);
      
      expect(verification.valid).toBe(false);
      expect(verification.error).toBeDefined();
    });

    it('should reject signatures with corrupted data hash', async () => {
      const data = { test: 'data' };
      const signed = await signatureManager.signData(data);
      
      // Tamper with hash
      signed.hash = signed.hash.replace('1', '2');
      
      const verification = await SignatureManager.verifySignature(signed);
      
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('Hash mismatch');
    });
  });

  describe('Multi-Signature Support', () => {
    it('should create multi-signatures', async () => {
      const signers = [];
      
      // Create multiple signers
      for (let i = 0; i < 3; i++) {
        const keys = await SignatureManager.generateKeyPair();
        signers.push({
          id: `signer-${i}`,
          privateKey: keys.privateKey,
          publicKey: keys.publicKey
        });
      }
      
      const data = { multiSig: 'test', value: 456 };
      const threshold = 2;
      
      const multiSig = await SignatureManager.createMultiSignature(data, signers, threshold);
      
      expect(multiSig.signatures).toHaveLength(3);
      expect(multiSig.threshold).toBe(2);
      expect(multiSig.type).toBe('multi-signature');
      expect(multiSig.data).toEqual(data);
    });

    it('should verify multi-signatures', async () => {
      const signers = [];
      
      for (let i = 0; i < 3; i++) {
        const keys = await SignatureManager.generateKeyPair();
        signers.push({
          id: `signer-${i}`,
          privateKey: keys.privateKey,
          publicKey: keys.publicKey
        });
      }
      
      const data = { multiSig: 'verification' };
      const multiSig = await SignatureManager.createMultiSignature(data, signers, 2);
      
      const verification = await SignatureManager.verifyMultiSignature(multiSig);
      
      expect(verification.valid).toBe(true);
      expect(verification.validSignatures).toBe(3);
      expect(verification.threshold).toBe(2);
    });

    it('should reject multi-signatures below threshold', async () => {
      const signers = [];
      
      for (let i = 0; i < 2; i++) {
        const keys = await SignatureManager.generateKeyPair();
        signers.push({
          id: `signer-${i}`,
          privateKey: keys.privateKey,
          publicKey: keys.publicKey
        });
      }
      
      const data = { test: 'threshold' };
      const multiSig = await SignatureManager.createMultiSignature(data, signers, 2);
      
      // Corrupt one signature
      multiSig.signatures[0].signature = 'invalid';
      
      const verification = await SignatureManager.verifyMultiSignature(multiSig);
      
      expect(verification.valid).toBe(false);
      expect(verification.validSignatures).toBe(1);
      expect(verification.threshold).toBe(2);
    });

    it('should throw error for insufficient signers', async () => {
      const signers = [
        {
          id: 'solo-signer',
          privateKey: keyPair.privateKey,
          publicKey: keyPair.publicKey
        }
      ];
      
      await expect(
        SignatureManager.createMultiSignature({ test: 'data' }, signers, 2)
      ).rejects.toThrow('Insufficient signers: need 2, got 1');
    });
  });

  describe('Timestamped Signatures', () => {
    it('should create timestamped signatures', async () => {
      const data = { timestamp: 'test' };
      
      const timestamped = await signatureManager.createTimestampedSignature(data);
      
      expect(timestamped.timestampProof).toBeDefined();
      expect(timestamped.timestampProof.timestamp).toBeDefined();
      expect(timestamped.timestampProof.authority).toBeDefined();
      expect(timestamped.timestampProof.hash).toBe(timestamped.hash);
    });

    it('should verify timestamp integrity', async () => {
      const data = { timestamp: 'verification' };
      const timestamped = await signatureManager.createTimestampedSignature(data);
      
      const verification = SignatureManager.verifyTimestamp(timestamped);
      
      expect(verification.valid).toBe(true);
      expect(verification.age).toBeGreaterThanOrEqual(0);
      expect(verification.timestamp).toBeDefined();
    });

    it('should reject future timestamps', async () => {
      const data = { test: 'future' };
      const timestamped = await signatureManager.createTimestampedSignature(data);
      
      // Modify timestamp to future
      const futureTime = Date.now() + 86400000; // 1 day in future
      const verification = SignatureManager.verifyTimestamp(timestamped, futureTime - 172800000); // 2 days ago
      
      expect(verification.valid).toBe(false);
    });
  });

  describe('Signature Chains', () => {
    it('should create signature chains', async () => {
      const entries = [
        { id: 1, data: 'first entry' },
        { id: 2, data: 'second entry' },
        { id: 3, data: 'third entry' }
      ];
      
      const chain = await signatureManager.createSignatureChain(entries);
      
      expect(chain).toHaveLength(3);
      expect(chain[0].previousHash).toBeNull();
      expect(chain[1].previousHash).toBe(chain[0].hash);
      expect(chain[2].previousHash).toBe(chain[1].hash);
    });

    it('should verify signature chains', async () => {
      const entries = [
        { id: 1, content: 'chain test 1' },
        { id: 2, content: 'chain test 2' }
      ];
      
      const chain = await signatureManager.createSignatureChain(entries);
      const verification = await SignatureManager.verifySignatureChain(chain);
      
      expect(verification.valid).toBe(true);
      expect(verification.chainLength).toBe(2);
      expect(verification.results.every(r => r.signatureValid && r.chainValid)).toBe(true);
    });

    it('should detect broken signature chains', async () => {
      const entries = [
        { id: 1, content: 'test 1' },
        { id: 2, content: 'test 2' }
      ];
      
      const chain = await signatureManager.createSignatureChain(entries);
      
      // Break the chain
      chain[1].previousHash = 'invalid-hash';
      
      const verification = await SignatureManager.verifySignatureChain(chain);
      
      expect(verification.valid).toBe(false);
      expect(verification.results[1].chainValid).toBe(false);
    });
  });

  describe('Deterministic Signing', () => {
    it('should create deterministic signatures', async () => {
      const data = { deterministic: 'test' };
      const seed = 'test-seed-123';
      
      const sig1 = await signatureManager.signDeterministic(data, seed);
      const sig2 = await signatureManager.signDeterministic(data, seed);
      
      expect(sig1.signature).toBe(sig2.signature);
      expect(sig1.hash).toBe(sig2.hash);
      expect(sig1.deterministic).toBe(true);
    });

    it('should create different signatures with different seeds', async () => {
      const data = { test: 'deterministic' };
      
      const sig1 = await signatureManager.signDeterministic(data, 'seed1');
      const sig2 = await signatureManager.signDeterministic(data, 'seed2');
      
      expect(sig1.signature).not.toBe(sig2.signature);
      expect(sig1.hash).not.toBe(sig2.hash);
    });

    it('should derive seed from data when none provided', async () => {
      const data = { auto: 'seed' };
      
      const sig1 = await signatureManager.signDeterministic(data);
      const sig2 = await signatureManager.signDeterministic(data);
      
      expect(sig1.signature).toBe(sig2.signature);
      expect(sig1.data.seed).toBeDefined();
      expect(sig2.data.seed).toBeDefined();
    });
  });

  describe('PEM Key Export/Import', () => {
    it('should export public key as PEM', () => {
      const pem = signatureManager.exportPublicKeyPEM();
      
      expect(pem).toContain('-----BEGIN PUBLIC KEY-----');
      expect(pem).toContain('-----END PUBLIC KEY-----');
      expect(pem.split('\n').length).toBeGreaterThan(2);
    });

    it('should import public key from PEM', () => {
      const pem = signatureManager.exportPublicKeyPEM();
      const imported = SignatureManager.importPublicKeyPEM(pem);
      
      expect(imported).toBe(keyPair.publicKey);
    });

    it('should throw error when exporting without public key', () => {
      const manager = new SignatureManager();
      
      expect(() => {
        manager.exportPublicKeyPEM();
      }).toThrow('No public key available');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed signature data', async () => {
      const malformedSig = {
        data: null,
        signature: 'invalid',
        publicKey: 'invalid',
        hash: 'invalid'
      };
      
      const verification = await SignatureManager.verifySignature(malformedSig);
      
      expect(verification.valid).toBe(false);
      expect(verification.error).toBeDefined();
    });

    it('should handle missing public key in verification', async () => {
      const data = { test: 'missing key' };
      const signed = await signatureManager.signData(data);
      
      delete signed.publicKey;
      
      const verification = await SignatureManager.verifySignature(signed);
      
      expect(verification.valid).toBe(false);
      expect(verification.error).toBeDefined();
    });

    it('should handle invalid hex strings gracefully', async () => {
      const invalidSig = {
        data: { test: 'invalid' },
        signature: 'not-hex',
        publicKey: 'not-hex-either',
        hash: 'definitely-not-hex'
      };
      
      const verification = await SignatureManager.verifySignature(invalidSig);
      
      expect(verification.valid).toBe(false);
      expect(verification.error).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should sign large data efficiently', async () => {
      const largeData = {
        content: 'x'.repeat(10000),
        metadata: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` }))
      };
      
      const startTime = Date.now();
      const signed = await signatureManager.signData(largeData);
      const signingTime = Date.now() - startTime;
      
      expect(signingTime).toBeLessThan(100); // Should be fast
      expect(signed.signature).toBeDefined();
    });

    it('should verify signatures quickly', async () => {
      const data = { performance: 'test' };
      const signed = await signatureManager.signData(data);
      
      const startTime = Date.now();
      const verification = await SignatureManager.verifySignature(signed);
      const verificationTime = Date.now() - startTime;
      
      expect(verificationTime).toBeLessThan(50); // Should be very fast
      expect(verification.valid).toBe(true);
    });

    it('should handle multiple concurrent signatures', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        signatureManager.signData({ concurrent: i, data: `test-${i}` })
      );
      
      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      expect(results).toHaveLength(10);
      expect(totalTime).toBeLessThan(500); // Should handle concurrency well
      expect(results.every(r => r.signature && r.hash)).toBe(true);
    });
  });
});