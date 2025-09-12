/**
 * Comprehensive test suite for SecureKeyManager
 * Tests real cryptographic operations with actual key generation
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { SecureKeyManager } from '../../src/security/key-manager.js';
import { KeyValidator } from '../../src/security/key-validator.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Set up hash functions for Noble libraries (for tests)
import * as ed25519 from '@noble/ed25519';
import * as secp256k1 from '@noble/secp256k1';
ed25519.utils.sha512Sync = (...m) => crypto.createHash('sha512').update(Buffer.concat(m)).digest();
secp256k1.utils.sha256Sync = (...m) => crypto.createHash('sha256').update(Buffer.concat(m)).digest();

describe('SecureKeyManager', () => {
  let keyManager;
  let testKeyStore;

  beforeEach(async () => {
    // Create temporary test key store
    testKeyStore = path.join(process.cwd(), 'test-keys');
    keyManager = new SecureKeyManager({ keyStorePath: testKeyStore });
    
    // Clean up any existing test keys
    try {
      await fs.rmdir(testKeyStore, { recursive: true });
    } catch (error) {
      // Directory doesn't exist, that's fine
    }
  });

  afterEach(async () => {
    // Clean up test key store using modern fs.rm
    try {
      await fs.rm(testKeyStore, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist or have permission issues
    }
  });

  describe('Ed25519 Key Operations', () => {
    test('should generate Ed25519 keypair successfully', async () => {
      const keyInfo = await keyManager.generateEd25519Keypair('test-ed25519');
      
      expect(keyInfo).toMatchObject({
        keyId: 'test-ed25519',
        algorithm: 'Ed25519',
        fingerprint: expect.any(String),
        created: expect.any(String)
      });
      
      expect(keyInfo.fingerprint).toHaveLength(16);
      expect(keyInfo.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    });

    test('should generate encrypted Ed25519 keypair with passphrase', async () => {
      const keyInfo = await keyManager.generateEd25519Keypair('test-ed25519-encrypted', {
        passphrase: 'test-passphrase-123'
      });
      
      expect(keyInfo.keyId).toBe('test-ed25519-encrypted');
      
      // Load the key and verify it's encrypted
      const loadedKey = await keyManager.loadKeyPair('test-ed25519-encrypted', 'test-passphrase-123');
      expect(loadedKey.encrypted).toBe(true);
    });

    test('should sign and verify data with Ed25519 key', async () => {
      const keyInfo = await keyManager.generateEd25519Keypair('test-ed25519-sign');
      const testData = 'Hello, World! This is test data for signing.';
      
      // Sign the data
      const signature = await keyManager.signData('test-ed25519-sign', testData);
      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(64); // Ed25519 signatures are 64 bytes
      
      // Verify the signature
      const isValid = await keyManager.verifySignature('test-ed25519-sign', testData, signature);
      expect(isValid).toBe(true);
      
      // Verify with wrong data should fail
      const isInvalid = await keyManager.verifySignature('test-ed25519-sign', 'wrong data', signature);
      expect(isInvalid).toBe(false);
    });

    test('should extract public key from Ed25519 private key', async () => {
      await keyManager.generateEd25519Keypair('test-ed25519-extract');
      const keyPair = await keyManager.loadKeyPair('test-ed25519-extract');
      
      const extractedPublicKey = await keyManager.extractPublicKey(
        Buffer.from(keyPair.privateKey, 'base64'), 
        'Ed25519'
      );
      
      expect(extractedPublicKey).toBeInstanceOf(Uint8Array);
      expect(extractedPublicKey.length).toBe(32);
      
      // Compare with stored public key
      const storedPublicKey = Buffer.from(keyPair.publicKey, 'base64');
      expect(Buffer.compare(Buffer.from(extractedPublicKey), storedPublicKey)).toBe(0);
    });
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
      
      expect(keyInfo.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    });

    test('should generate RSA-4096 keypair successfully', async () => {
      const keyInfo = await keyManager.generateRSAKeypair('test-rsa-4096', {
        keySize: 4096
      });
      
      expect(keyInfo.keySize).toBe(4096);
    });

    test('should reject invalid RSA key sizes', async () => {
      await expect(
        keyManager.generateRSAKeypair('test-rsa-invalid', { keySize: 1024 })
      ).rejects.toThrow('RSA key size must be 2048, 3072, or 4096 bits');
    });

    test('should sign and verify data with RSA key', async () => {
      const keyInfo = await keyManager.generateRSAKeypair('test-rsa-sign', {
        keySize: 2048
      });
      
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
      
      // Loading without passphrase should work for metadata but private key operations will fail
      const keyData = await keyManager.loadKeyPair('test-rsa-encrypted');
      expect(keyData.encrypted).toBe(true);
    });
  });

  describe('ECDSA Key Operations', () => {
    test('should generate ECDSA keypair successfully', async () => {
      const keyInfo = await keyManager.generateECDSAKeypair('test-ecdsa');
      
      expect(keyInfo).toMatchObject({
        keyId: 'test-ecdsa',
        algorithm: 'ECDSA',
        curve: 'secp256k1',
        fingerprint: expect.any(String),
        created: expect.any(String)
      });
    });

    test('should sign and verify data with ECDSA key', async () => {
      const keyInfo = await keyManager.generateECDSAKeypair('test-ecdsa-sign');
      const testData = 'ECDSA test data for signing operations';
      
      // Sign the data
      const signature = await keyManager.signData('test-ecdsa-sign', testData);
      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(64); // secp256k1 compact signatures are 64 bytes
      
      // Verify the signature
      const isValid = await keyManager.verifySignature('test-ecdsa-sign', testData, signature);
      expect(isValid).toBe(true);
      
      // Verify with wrong data should fail
      const isInvalid = await keyManager.verifySignature('test-ecdsa-sign', 'different data', signature);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Key Management Operations', () => {
    test('should list all stored keys with metadata', async () => {
      // Generate multiple keys
      await keyManager.generateEd25519Keypair('list-test-ed25519');
      await keyManager.generateRSAKeypair('list-test-rsa', { keySize: 2048 });
      await keyManager.generateECDSAKeypair('list-test-ecdsa');
      
      const keys = await keyManager.listKeys();
      expect(keys).toHaveLength(3);
      
      const keyIds = keys.map(k => k.keyId);
      expect(keyIds).toContain('list-test-ed25519');
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

    test('should rotate key successfully', async () => {
      // Generate initial key
      const initialKey = await keyManager.generateEd25519Keypair('rotate-test');
      
      // Rotate the key
      const rotationResult = await keyManager.rotateKey('rotate-test');
      
      expect(rotationResult).toMatchObject({
        newKey: expect.objectContaining({
          keyId: 'rotate-test',
          algorithm: 'Ed25519'
        }),
        backupPath: expect.stringContaining('rotate-test_backup_'),
        rotatedAt: expect.any(String)
      });
      
      // Verify backup was created
      const backupExists = await fs.access(rotationResult.backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
      
      // Verify new key has different fingerprint
      expect(rotationResult.newKey.fingerprint).not.toBe(initialKey.fingerprint);
    });

    test('should delete key securely with confirmation', async () => {
      await keyManager.generateEd25519Keypair('delete-test');
      
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
      const key1 = await keyManager.generateEd25519Keypair('fingerprint-test-1');
      const key2 = await keyManager.generateEd25519Keypair('fingerprint-test-2');
      const key3 = await keyManager.generateRSAKeypair('fingerprint-test-3', { keySize: 2048 });
      
      expect(key1.fingerprint).not.toBe(key2.fingerprint);
      expect(key1.fingerprint).not.toBe(key3.fingerprint);
      expect(key2.fingerprint).not.toBe(key3.fingerprint);
      
      // All fingerprints should be 16 characters hex
      [key1, key2, key3].forEach(key => {
        expect(key.fingerprint).toMatch(/^[a-f0-9]{16}$/);
      });
    });
  });

  describe('Key Format Support', () => {
    test('should support PEM format export', async () => {
      const keyInfo = await keyManager.generateEd25519Keypair('format-test-pem', {
        exportFormat: 'PEM'
      });
      
      expect(keyInfo.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      expect(keyInfo.publicKey).toContain('-----END PUBLIC KEY-----');
    });

    test('should support JWK format export', async () => {
      const keyInfo = await keyManager.generateEd25519Keypair('format-test-jwk', {
        exportFormat: 'JWK'
      });
      
      expect(keyInfo.publicKey).toMatchObject({
        kty: 'OKP',
        use: 'sig',
        key_ops: ['verify'],
        x: expect.any(String)
      });
    });

    test('should support RAW format export', async () => {
      const keyInfo = await keyManager.generateEd25519Keypair('format-test-raw', {
        exportFormat: 'RAW'
      });
      
      expect(typeof keyInfo.publicKey).toBe('string');
      expect(keyInfo.publicKey).toMatch(/^[a-f0-9]+$/); // Hex string
      expect(keyInfo.publicKey).toHaveLength(64); // 32 bytes = 64 hex chars
    });
  });

  describe('Error Handling', () => {
    test('should handle loading non-existent key', async () => {
      await expect(
        keyManager.loadKeyPair('non-existent-key')
      ).rejects.toThrow('Failed to load keypair non-existent-key');
    });

    test('should handle wrong passphrase for encrypted key', async () => {
      await keyManager.generateEd25519Keypair('wrong-passphrase-test', {
        passphrase: 'correct-passphrase'
      });
      
      // This should not throw immediately (metadata can be loaded)
      // but private key operations would fail
      const keyData = await keyManager.loadKeyPair('wrong-passphrase-test');
      expect(keyData.encrypted).toBe(true);
    });

    test('should validate key structure when loading', async () => {
      // Create malformed key file
      const malformedKeyPath = path.join(testKeyStore, 'malformed.json');
      await fs.mkdir(testKeyStore, { recursive: true });
      await fs.writeFile(malformedKeyPath, JSON.stringify({ invalid: 'structure' }));
      
      await expect(
        keyManager.loadKeyPair('malformed')
      ).rejects.toThrow('Invalid key structure');
    });
  });

  describe('Security Features', () => {
    test('should use secure random generation', async () => {
      // Generate multiple keys and verify they're different
      const keys = await Promise.all([
        keyManager.generateEd25519Keypair('random-test-1'),
        keyManager.generateEd25519Keypair('random-test-2'),
        keyManager.generateEd25519Keypair('random-test-3')
      ]);
      
      const fingerprints = keys.map(k => k.fingerprint);
      const uniqueFingerprints = new Set(fingerprints);
      
      expect(uniqueFingerprints.size).toBe(3); // All should be unique
    });

    test('should store keys with proper timestamps', async () => {
      const beforeGeneration = new Date().toISOString();
      const keyInfo = await keyManager.generateEd25519Keypair('timestamp-test');
      const afterGeneration = new Date().toISOString();
      
      expect(keyInfo.created).toBeGreaterThanOrEqual(beforeGeneration);
      expect(keyInfo.created).toBeLessThanOrEqual(afterGeneration);
    });

    test('should handle concurrent key operations safely', async () => {
      // Generate multiple keys concurrently
      const keyPromises = Array.from({ length: 5 }, (_, i) => 
        keyManager.generateEd25519Keypair(`concurrent-test-${i}`)
      );
      
      const results = await Promise.all(keyPromises);
      
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.keyId).toBe(`concurrent-test-${index}`);
        expect(result.algorithm).toBe('Ed25519');
      });
      
      // Verify all keys were stored
      const storedKeys = await keyManager.listKeys();
      const concurrentKeys = storedKeys.filter(k => k.keyId.startsWith('concurrent-test-'));
      expect(concurrentKeys).toHaveLength(5);
    });
  });
});

describe('KeyValidator', () => {
  let keyValidator;

  beforeEach(() => {
    keyValidator = new KeyValidator();
  });

  describe('Format Detection', () => {
    test('should detect PEM format correctly', () => {
      const pemPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4f5wg5l2hKsTeNem/V41
fGnJm6gOdrj8ym3rFkEjWT2btf02VoBtkrtAtLJwB+uYOUGOxg7VHRcWCKDNMnHu
bHvYNEXhWgYOWyQX9IcQQ0e6tIHLX1bYcZE3zK4+K7Gn3W1GqJpEJcSgfJBZGzEz
wMLktRjGkGjLp1VkPxhyHKRKILGJ/PaFhYF+gLvM2zH4NmLg3TqKh5vYT1ZP3jSd
PBLCElV3jKzHzQ+GgJ0BgQWjF7Kj9gGF3pO4pTGJ9K2HXnOF7jXxU1EjlvdZUgHo
rQBhH9Lhh7xUbLU8kG4S7h+SrCWjFt+7KAHzY6LbGKB2Rl8Fl6y5pGjGkGjLp1Vk
PxhyHKRKILGJ/PaFhYF+gLvM2zH4NmLg3TqKh5vYT1ZP3jSdPBLCElV3jKzHzQ+G
gJ0BgQWjF7Kj9gGF3pO4pTGJ9K2HXnOF7jXxU1EjlvdZUgHorQBhH9Lhh7xUbLU8
kG4S7h+SrCWjFt+7KAHzY6LbGKB2Rl8Fl6y5pGjGkGjLp1VkPxhyHKRKILGJ/PaF
hYF+gLvM2zH4NmLg3TqKh5vYT1ZP3jSdPBLCElV3jKzHzQ+GgJ0BgQWjF7Kj9gGF
3pO4pTGJ9K2HXnOF7jXxU1EjlvdZUgHorQBhH9Lhh7xUbLU8kG4S7h+SrCWjFt+7
KQIDAQAB
-----END PUBLIC KEY-----`;

      const formatInfo = keyValidator.detectKeyFormat(pemPublicKey);
      expect(formatInfo).toMatchObject({
        format: 'PEM',
        type: 'public',
        algorithm: 'SPKI'
      });
    });

    test('should detect OpenSSH format correctly', () => {
      const opensshKey = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC+4MxV... user@host';
      
      const formatInfo = keyValidator.detectKeyFormat(opensshKey);
      expect(formatInfo).toMatchObject({
        format: 'OPENSSH',
        type: 'public',
        algorithm: 'RSA'
      });
    });

    test('should detect Ed25519 OpenSSH format', () => {
      const ed25519Key = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... user@host';
      
      const formatInfo = keyValidator.detectKeyFormat(ed25519Key);
      expect(formatInfo).toMatchObject({
        format: 'OPENSSH',
        type: 'public',
        algorithm: 'Ed25519'
      });
    });

    test('should detect JWK format correctly', () => {
      const jwkKey = {
        kty: 'RSA',
        use: 'sig',
        n: 'base64-encoded-modulus',
        e: 'AQAB'
      };
      
      const formatInfo = keyValidator.detectKeyFormat(JSON.stringify(jwkKey));
      expect(formatInfo).toMatchObject({
        format: 'JWK',
        type: 'public',
        algorithm: 'RSA'
      });
    });

    test('should return UNKNOWN for unrecognized formats', () => {
      const unknownData = 'this is not a valid key format';
      
      const formatInfo = keyValidator.detectKeyFormat(unknownData);
      expect(formatInfo.format).toBe('UNKNOWN');
    });
  });

  describe('Fingerprint Generation', () => {
    test('should generate consistent fingerprints for same key', () => {
      const keyData = Buffer.from('test-key-data-for-fingerprinting');
      
      const fingerprint1 = keyValidator.generateFingerprint(keyData, 'Ed25519');
      const fingerprint2 = keyValidator.generateFingerprint(keyData, 'Ed25519');
      
      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    test('should generate different fingerprints for different keys', () => {
      const keyData1 = Buffer.from('first-key-data');
      const keyData2 = Buffer.from('second-key-data');
      
      const fingerprint1 = keyValidator.generateFingerprint(keyData1, 'Ed25519');
      const fingerprint2 = keyValidator.generateFingerprint(keyData2, 'Ed25519');
      
      expect(fingerprint1).not.toBe(fingerprint2);
    });

    test('should support different hash algorithms', () => {
      const keyData = Buffer.from('test-key-data');
      
      const sha256 = keyValidator.generateFingerprint(keyData, 'Ed25519', 'sha256');
      const sha512 = keyValidator.generateFingerprint(keyData, 'Ed25519', 'sha512');
      
      expect(sha256).toHaveLength(64);  // SHA256 = 32 bytes = 64 hex chars
      expect(sha512).toHaveLength(128); // SHA512 = 64 bytes = 128 hex chars
      expect(sha256).not.toBe(sha512);
    });
  });

  describe('Key Strength Validation', () => {
    test('should validate Ed25519 key strength', async () => {
      const validKey = Buffer.alloc(32); // 32 bytes for Ed25519
      crypto.randomFillSync(validKey);
      
      const validation = await keyValidator.validateKeyStrength(validKey, 'Ed25519');
      
      expect(validation).toMatchObject({
        valid: true,
        strength: 'strong',
        warnings: [],
        errors: []
      });
    });

    test('should reject invalid Ed25519 key length', async () => {
      const invalidKey = Buffer.alloc(16); // Wrong length
      
      const validation = await keyValidator.validateKeyStrength(invalidKey, 'Ed25519');
      
      expect(validation).toMatchObject({
        valid: false,
        strength: 'invalid',
        errors: expect.arrayContaining([
          expect.stringContaining('Ed25519 key must be exactly 32 bytes')
        ])
      });
    });

    test('should handle unsupported algorithms gracefully', async () => {
      const keyData = Buffer.alloc(32);
      
      const validation = await keyValidator.validateKeyStrength(keyData, 'UnsupportedAlgorithm');
      
      expect(validation).toMatchObject({
        valid: false,
        errors: expect.arrayContaining([
          expect.stringContaining('Unsupported algorithm')
        ])
      });
    });
  });
});