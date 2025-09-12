/**
 * Test suite for SimplifiedKeyManager
 * Tests real cryptographic operations using Node.js built-in crypto
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { SimplifiedKeyManager } from '../../src/security/simplified-key-manager.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

describe('SimplifiedKeyManager', () => {
  let keyManager;
  let testKeyStore;

  beforeEach(async () => {
    // Create temporary test key store
    testKeyStore = path.join(process.cwd(), 'test-keys-simple');
    keyManager = new SimplifiedKeyManager({ keyStorePath: testKeyStore });
    
    // Clean up any existing test keys
    try {
      await fs.rm(testKeyStore, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, that's fine
    }
  });

  afterEach(async () => {
    // Clean up test key store
    try {
      await fs.rm(testKeyStore, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist or have permission issues
    }
  });

  describe('RSA Key Operations', () => {
    test('should generate RSA-2048 keypair successfully', async () => {
      const keyInfo = await keyManager.generateRSAKeypair('test-rsa-2048', {
        keySize: 2048
      });
      
      expect(keyInfo).toMatchObject({
        keyId: 'test-rsa-2048',
        algorithm: 'RSA',
        keySize: 2048,
        fingerprint: expect.any(String),
        created: expect.any(String)
      });
      
      expect(keyInfo.fingerprint).toHaveLength(16);
      expect(keyInfo.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    });

    test('should generate RSA-4096 keypair successfully', async () => {
      const keyInfo = await keyManager.generateRSAKeypair('test-rsa-4096', {
        keySize: 4096
      });
      
      expect(keyInfo.keySize).toBe(4096);
    }, 30000); // Increase timeout for 4096-bit key generation

    test('should reject invalid RSA key sizes', async () => {
      await expect(
        keyManager.generateRSAKeypair('test-rsa-invalid', { keySize: 1024 })
      ).rejects.toThrow('RSA key size must be 2048, 3072, or 4096 bits');
    });

    test('should sign and verify data with RSA key', async () => {
      await keyManager.generateRSAKeypair('test-rsa-sign', { keySize: 2048 });
      
      const testData = 'RSA signing test data - this is longer content to test RSA signatures properly.';
      
      // Sign the data
      const signature = await keyManager.signData('test-rsa-sign', testData);
      expect(signature).toBeInstanceOf(Buffer);
      expect(signature.length).toBeGreaterThan(200); // RSA-2048 signatures are ~256 bytes
      
      // Verify the signature
      const isValid = await keyManager.verifySignature('test-rsa-sign', testData, signature);
      expect(isValid).toBe(true);
      
      // Verify with wrong data should fail
      const isInvalid = await keyManager.verifySignature('test-rsa-sign', 'wrong data', signature);
      expect(isInvalid).toBe(false);
    });

    test('should generate encrypted RSA keypair with passphrase', async () => {
      const keyInfo = await keyManager.generateRSAKeypair('test-rsa-encrypted', {
        keySize: 2048,
        passphrase: 'strong-rsa-passphrase-456'
      });
      
      expect(keyInfo.keyId).toBe('test-rsa-encrypted');
      
      // Loading should work for metadata
      const keyData = await keyManager.loadKeyPair('test-rsa-encrypted');
      expect(keyData.encrypted).toBe(true);
      
      // Signing should work with passphrase
      const testData = 'test data for encrypted key';
      const signature = await keyManager.signData('test-rsa-encrypted', testData, 'strong-rsa-passphrase-456');
      const isValid = await keyManager.verifySignature('test-rsa-encrypted', testData, signature);
      expect(isValid).toBe(true);
    });
  });

  describe('ECDSA Key Operations', () => {
    test('should generate ECDSA keypair successfully', async () => {
      const keyInfo = await keyManager.generateECDSAKeypair('test-ecdsa');
      
      expect(keyInfo).toMatchObject({
        keyId: 'test-ecdsa',
        algorithm: 'ECDSA',
        curve: 'prime256v1',
        fingerprint: expect.any(String),
        created: expect.any(String)
      });
    });

    test('should sign and verify data with ECDSA key', async () => {
      await keyManager.generateECDSAKeypair('test-ecdsa-sign');
      const testData = 'ECDSA test data for signing operations';
      
      // Sign the data
      const signature = await keyManager.signData('test-ecdsa-sign', testData);
      expect(signature).toBeInstanceOf(Buffer);
      expect(signature.length).toBeGreaterThan(60); // ECDSA signatures vary but are typically 70-72 bytes
      
      // Verify the signature
      const isValid = await keyManager.verifySignature('test-ecdsa-sign', testData, signature);
      expect(isValid).toBe(true);
      
      // Verify with wrong data should fail
      const isInvalid = await keyManager.verifySignature('test-ecdsa-sign', 'different data', signature);
      expect(isInvalid).toBe(false);
    });

    test('should generate ECDSA keypair with different curves', async () => {
      const secp256r1Key = await keyManager.generateECDSAKeypair('test-ecdsa-p256', {
        namedCurve: 'prime256v1'
      });
      
      expect(secp256r1Key.curve).toBe('prime256v1');
      
      // Test signing with P-256 curve
      const testData = 'test data';
      const signature = await keyManager.signData('test-ecdsa-p256', testData);
      const isValid = await keyManager.verifySignature('test-ecdsa-p256', testData, signature);
      expect(isValid).toBe(true);
    });
  });

  describe('Key Management Operations', () => {
    test('should list all stored keys with metadata', async () => {
      // Generate multiple keys
      await keyManager.generateRSAKeypair('list-test-rsa', { keySize: 2048 });
      await keyManager.generateECDSAKeypair('list-test-ecdsa');
      
      const keys = await keyManager.listKeys();
      expect(keys).toHaveLength(2);
      
      const keyIds = keys.map(k => k.keyId);
      expect(keyIds).toContain('list-test-rsa');
      expect(keyIds).toContain('list-test-ecdsa');
      
      // Check metadata structure
      keys.forEach(key => {
        expect(key).toMatchObject({
          keyId: expect.any(String),
          algorithm: expect.any(String),
          fingerprint: expect.any(String),
          created: expect.any(String),
          encrypted: expect.any(Boolean)
        });
      });
    });

    test('should delete key securely with confirmation', async () => {
      await keyManager.generateRSAKeypair('delete-test', { keySize: 2048 });
      
      // Should require confirmation
      await expect(
        keyManager.deleteKey('delete-test', false)
      ).rejects.toThrow('Key deletion requires explicit confirmation');
      
      // Should work with confirmation
      const deleteResult = await keyManager.deleteKey('delete-test', true);
      expect(deleteResult.deleted).toBe(true);
      expect(deleteResult.backupPath).toContain('delete-test_deleted_');
      
      // Verify key is gone
      await expect(
        keyManager.loadKeyPair('delete-test')
      ).rejects.toThrow('Failed to load keypair');
    });

    test('should handle key fingerprinting correctly', async () => {
      // Generate multiple keys and verify unique fingerprints
      const key1 = await keyManager.generateRSAKeypair('fingerprint-test-1', { keySize: 2048 });
      const key2 = await keyManager.generateRSAKeypair('fingerprint-test-2', { keySize: 2048 });
      const key3 = await keyManager.generateECDSAKeypair('fingerprint-test-3');
      
      expect(key1.fingerprint).not.toBe(key2.fingerprint);
      expect(key1.fingerprint).not.toBe(key3.fingerprint);
      expect(key2.fingerprint).not.toBe(key3.fingerprint);
      
      // All fingerprints should be 16 characters hex
      [key1, key2, key3].forEach(key => {
        expect(key.fingerprint).toMatch(/^[a-f0-9]{16}$/);
      });
    });

    test('should extract public key from private key', async () => {
      await keyManager.generateRSAKeypair('extract-test', { keySize: 2048 });
      const keyPair = await keyManager.loadKeyPair('extract-test');
      
      const extractedPublicKey = await keyManager.extractPublicKey(keyPair.privateKey, 'RSA');
      expect(extractedPublicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(extractedPublicKey).toContain('-----END PUBLIC KEY-----');
      
      // Should be able to verify signatures with extracted public key
      const testData = 'test data for extraction';
      const signature = await keyManager.signData('extract-test', testData);
      
      // Create a temporary key object for verification
      const publicKeyObject = crypto.createPublicKey(extractedPublicKey);
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(testData);
      const isValid = verify.verify(publicKeyObject, signature);
      expect(isValid).toBe(true);
    });
  });

  describe('Key Format Support', () => {
    test('should support PEM format export', async () => {
      const keyInfo = await keyManager.generateRSAKeypair('format-test-pem', {
        keySize: 2048,
        exportFormat: 'PEM'
      });
      
      expect(keyInfo.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(keyInfo.publicKey).toContain('-----END PUBLIC KEY-----');
    });

    test('should support JWK format export', async () => {
      const keyInfo = await keyManager.generateRSAKeypair('format-test-jwk', {
        keySize: 2048,
        exportFormat: 'JWK'
      });
      
      expect(keyInfo.publicKey).toMatchObject({
        kty: 'RSA',
        n: expect.any(String),
        e: expect.any(String)
      });
    });

    test('should support RAW format export', async () => {
      const keyInfo = await keyManager.generateRSAKeypair('format-test-raw', {
        keySize: 2048,
        exportFormat: 'RAW'
      });
      
      expect(typeof keyInfo.publicKey).toBe('string');
      expect(keyInfo.publicKey).toMatch(/^[a-f0-9]+$/i); // Hex string
    });
  });

  describe('Security Features', () => {
    test('should use secure random generation', async () => {
      // Generate multiple keys and verify they're different
      const keys = await Promise.all([
        keyManager.generateRSAKeypair('random-test-1', { keySize: 2048 }),
        keyManager.generateRSAKeypair('random-test-2', { keySize: 2048 }),
        keyManager.generateRSAKeypair('random-test-3', { keySize: 2048 })
      ]);
      
      const fingerprints = keys.map(k => k.fingerprint);
      const uniqueFingerprints = new Set(fingerprints);
      
      expect(uniqueFingerprints.size).toBe(3); // All should be unique
    });

    test('should store keys with proper timestamps', async () => {
      const beforeGeneration = new Date().toISOString();
      const keyInfo = await keyManager.generateRSAKeypair('timestamp-test', { keySize: 2048 });
      const afterGeneration = new Date().toISOString();
      
      expect(new Date(keyInfo.created).getTime()).toBeGreaterThanOrEqual(new Date(beforeGeneration).getTime());
      expect(new Date(keyInfo.created).getTime()).toBeLessThanOrEqual(new Date(afterGeneration).getTime());
    });

    test('should handle concurrent key operations safely', async () => {
      // Generate multiple keys concurrently
      const keyPromises = Array.from({ length: 3 }, (_, i) => 
        keyManager.generateRSAKeypair(`concurrent-test-${i}`, { keySize: 2048 })
      );
      
      const results = await Promise.all(keyPromises);
      
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.keyId).toBe(`concurrent-test-${index}`);
        expect(result.algorithm).toBe('RSA');
      });
      
      // Verify all keys were stored
      const storedKeys = await keyManager.listKeys();
      const concurrentKeys = storedKeys.filter(k => k.keyId.startsWith('concurrent-test-'));
      expect(concurrentKeys).toHaveLength(3);
    }, 30000); // Increase timeout for concurrent operations
  });

  describe('Fingerprint Generation', () => {
    test('should generate consistent fingerprints for same key', async () => {
      await keyManager.generateRSAKeypair('fingerprint-consistency-test', { keySize: 2048 });
      const keyPair = await keyManager.loadKeyPair('fingerprint-consistency-test');
      
      const fingerprint1 = keyManager.generateFingerprint(keyPair.publicKey);
      const fingerprint2 = keyManager.generateFingerprint(keyPair.publicKey);
      
      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    test('should generate different fingerprints for different keys', async () => {
      await keyManager.generateRSAKeypair('fingerprint-diff-1', { keySize: 2048 });
      await keyManager.generateRSAKeypair('fingerprint-diff-2', { keySize: 2048 });
      
      const keyPair1 = await keyManager.loadKeyPair('fingerprint-diff-1');
      const keyPair2 = await keyManager.loadKeyPair('fingerprint-diff-2');
      
      const fingerprint1 = keyManager.generateFingerprint(keyPair1.publicKey);
      const fingerprint2 = keyManager.generateFingerprint(keyPair2.publicKey);
      
      expect(fingerprint1).not.toBe(fingerprint2);
    });
  });

  describe('Error Handling', () => {
    test('should handle loading non-existent key', async () => {
      await expect(
        keyManager.loadKeyPair('non-existent-key')
      ).rejects.toThrow('Failed to load keypair non-existent-key');
    });

    test('should handle malformed key files', async () => {
      // Create malformed key file
      const malformedKeyPath = path.join(testKeyStore, 'malformed.json');
      await fs.mkdir(testKeyStore, { recursive: true });
      await fs.writeFile(malformedKeyPath, JSON.stringify({ invalid: 'structure' }));
      
      await expect(
        keyManager.loadKeyPair('malformed')
      ).rejects.toThrow('Invalid key structure');
    });
  });
});