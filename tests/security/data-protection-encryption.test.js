/**
 * Data Protection and Encryption Security Tests
 * Tests for FIPS-compliant encryption, key management, and data protection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FIPSCryptoProvider } from '../../src/security/crypto/fips-compliant.js';
import crypto from 'crypto';

describe('Data Protection and Encryption Security', () => {
  let cryptoProvider;

  beforeEach(async () => {
    cryptoProvider = FIPSCryptoProvider.getInstance();
    await cryptoProvider.initialize();
  });

  describe('FIPS 140-2 Compliance', () => {
    it('should use only FIPS-approved algorithms', () => {
      const approvedAlgorithms = cryptoProvider.approvedAlgorithms;
      
      expect(approvedAlgorithms.has('AES-256-GCM')).toBe(true);
      expect(approvedAlgorithms.has('SHA-256')).toBe(true);
      expect(approvedAlgorithms.has('RSA-PSS')).toBe(true);
      expect(approvedAlgorithms.has('ECDSA')).toBe(true);
      expect(approvedAlgorithms.has('PBKDF2')).toBe(true);
      
      // Non-FIPS algorithms should not be approved
      expect(approvedAlgorithms.has('MD5')).toBe(false);
      expect(approvedAlgorithms.has('DES')).toBe(false);
      expect(approvedAlgorithms.has('RC4')).toBe(false);
    });

    it('should enforce minimum key lengths', () => {
      expect(() => {
        cryptoProvider.generateRSAKeyPair(1024); // Too small
      }).toThrow('RSA key size must be at least 2048 bits');

      expect(() => {
        const weakKey = Buffer.alloc(8); // 64-bit key, too small
        cryptoProvider.deriveKey('password', crypto.randomBytes(16), 100000, 8);
      }).toThrow('Key length must be at least 128 bits');
    });

    it('should perform self-tests on initialization', async () => {
      const testResults = await cryptoProvider.performSelfTests();
      
      expect(testResults.encryptionTest).toBe(true);
      expect(testResults.hashTest).toBe(true);
      expect(testResults.keyDerivationTest).toBe(true);
      expect(testResults.overallStatus).toBe('PASS');
    });
  });

  describe('Encryption Operations', () => {
    it('should encrypt and decrypt data using AES-GCM', async () => {
      const plaintext = Buffer.from('Sensitive financial data: $1,000,000');
      const key = cryptoProvider.generateSecureRandom(32); // 256-bit key
      
      const encrypted = await cryptoProvider.encryptAESGCM(plaintext, key);
      const decrypted = await cryptoProvider.decryptAESGCM(encrypted, key);
      
      expect(decrypted.toString()).toBe(plaintext.toString());
      expect(encrypted.ciphertext).not.toEqual(plaintext);
      expect(encrypted.iv).toHaveLength(12); // GCM IV is 96 bits
      expect(encrypted.authTag).toHaveLength(16); // GCM auth tag is 128 bits
    });

    it('should support authenticated encryption with additional data (AEAD)', async () => {
      const plaintext = Buffer.from('Patient medical record #12345');
      const aad = Buffer.from('patient-id:12345|doctor-id:67890');
      const key = cryptoProvider.generateSecureRandom(32);
      
      const encrypted = await cryptoProvider.encryptAESGCM(plaintext, key, aad);
      const decrypted = await cryptoProvider.decryptAESGCM(encrypted, key, aad);
      
      expect(decrypted.toString()).toBe(plaintext.toString());
      
      // Should fail with wrong AAD
      const wrongAAD = Buffer.from('different-aad');
      await expect(cryptoProvider.decryptAESGCM(encrypted, key, wrongAAD))
        .rejects.toThrow();
    });

    it('should detect tampering through authentication tags', async () => {
      const plaintext = Buffer.from('Critical system configuration');
      const key = cryptoProvider.generateSecureRandom(32);
      
      const encrypted = await cryptoProvider.encryptAESGCM(plaintext, key);
      
      // Tamper with ciphertext
      encrypted.ciphertext[0] ^= 1;
      
      await expect(cryptoProvider.decryptAESGCM(encrypted, key))
        .rejects.toThrow();
    });
  });

  describe('Key Management', () => {
    it('should generate cryptographically secure random keys', () => {
      const key1 = cryptoProvider.generateSecureRandom(32);
      const key2 = cryptoProvider.generateSecureRandom(32);
      
      expect(key1).toHaveLength(32);
      expect(key2).toHaveLength(32);
      expect(key1.equals(key2)).toBe(false);
      
      // Check randomness quality (basic test)
      const zeros = key1.filter(byte => byte === 0).length;
      expect(zeros).toBeLessThan(key1.length * 0.1); // Less than 10% zeros
    });

    it('should derive keys using PBKDF2', () => {
      const password = 'StrongUserPassword123!';
      const salt = cryptoProvider.generateSecureRandom(16);
      const iterations = 100000;
      
      const key1 = cryptoProvider.deriveKey(password, salt, iterations, 32);
      const key2 = cryptoProvider.deriveKey(password, salt, iterations, 32);
      
      expect(key1.equals(key2)).toBe(true); // Same inputs = same output
      expect(key1).toHaveLength(32);
      
      // Different salt should produce different key
      const differentSalt = cryptoProvider.generateSecureRandom(16);
      const key3 = cryptoProvider.deriveKey(password, differentSalt, iterations, 32);
      
      expect(key1.equals(key3)).toBe(false);
    });

    it('should support key rotation', async () => {
      const keyRotationManager = {
        currentKeyId: 'key-v1',
        keys: new Map(),
        generateNewKey() {
          const keyId = `key-v${this.getDeterministicTimestamp()}`;
          const key = cryptoProvider.generateSecureRandom(32);
          this.keys.set(keyId, key);
          return keyId;
        },
        rotateKey() {
          const newKeyId = this.generateNewKey();
          const oldKeyId = this.currentKeyId;
          this.currentKeyId = newKeyId;
          return { oldKeyId, newKeyId };
        }
      };
      
      keyRotationManager.keys.set('key-v1', cryptoProvider.generateSecureRandom(32));
      
      const { oldKeyId, newKeyId } = keyRotationManager.rotateKey();
      
      expect(oldKeyId).toBe('key-v1');
      expect(newKeyId).not.toBe('key-v1');
      expect(keyRotationManager.keys.has(oldKeyId)).toBe(true); // Keep old key for decryption
      expect(keyRotationManager.keys.has(newKeyId)).toBe(true);
    });
  });

  describe('Digital Signatures', () => {
    it('should generate and verify RSA-PSS signatures', () => {
      const data = Buffer.from('Document to be signed');
      const keyPair = cryptoProvider.generateRSAKeyPair(2048);
      
      const signature = cryptoProvider.signRSAPSS(data, keyPair.privateKey);
      const isValid = cryptoProvider.verifyRSAPSS(data, signature, keyPair.publicKey);
      
      expect(isValid).toBe(true);
      
      // Should fail with tampered data
      const tamperedData = Buffer.from('Tampered document');
      const isValidTampered = cryptoProvider.verifyRSAPSS(tamperedData, signature, keyPair.publicKey);
      
      expect(isValidTampered).toBe(false);
    });

    it('should generate and verify ECDSA signatures', () => {
      const data = Buffer.from('Transaction data: transfer $500 to account 12345');
      const keyPair = cryptoProvider.generateECDSAKeyPair('prime256v1');
      
      const signature = cryptoProvider.signECDSA(data, keyPair.privateKey);
      const isValid = cryptoProvider.verifyECDSA(data, signature, keyPair.publicKey);
      
      expect(isValid).toBe(true);
    });
  });

  describe('Hash Functions', () => {
    it('should compute secure hashes using SHA-256/384/512', () => {
      const data = Buffer.from('Data to be hashed');
      
      const sha256 = cryptoProvider.computeHash(data, 'SHA-256');
      const sha384 = cryptoProvider.computeHash(data, 'SHA-384');
      const sha512 = cryptoProvider.computeHash(data, 'SHA-512');
      
      expect(sha256).toHaveLength(32); // 256 bits / 8 = 32 bytes
      expect(sha384).toHaveLength(48); // 384 bits / 8 = 48 bytes
      expect(sha512).toHaveLength(64); // 512 bits / 8 = 64 bytes
      
      // Same input should produce same hash
      const sha256_2 = cryptoProvider.computeHash(data, 'SHA-256');
      expect(sha256.equals(sha256_2)).toBe(true);
    });

    it('should compute HMAC for message authentication', () => {
      const message = Buffer.from('API request data');
      const key = cryptoProvider.generateSecureRandom(32);
      
      const hmac1 = cryptoProvider.createHMAC(message, key, 'HMAC-SHA-256');
      const hmac2 = cryptoProvider.createHMAC(message, key, 'HMAC-SHA-256');
      
      expect(hmac1.equals(hmac2)).toBe(true);
      
      // Different key should produce different HMAC
      const differentKey = cryptoProvider.generateSecureRandom(32);
      const hmac3 = cryptoProvider.createHMAC(message, differentKey, 'HMAC-SHA-256');
      
      expect(hmac1.equals(hmac3)).toBe(false);
    });
  });

  describe('Personal Data Protection', () => {
    it('should encrypt personal identifiable information (PII)', async () => {
      const piiData = {
        ssn: '123-45-6789',
        email: 'john.doe@company.com',
        phoneNumber: '+1-555-123-4567',
        creditCardNumber: '4111-1111-1111-1111'
      };

      const dataKey = cryptoProvider.generateSecureRandom(32);
      const encryptedPII = {};

      for (const [field, value] of Object.entries(piiData)) {
        const encrypted = await cryptoProvider.encryptAESGCM(
          Buffer.from(value),
          dataKey,
          Buffer.from(`pii:${field}`) // AAD for field identification
        );
        encryptedPII[field] = encrypted;
      }

      // Verify data is encrypted
      expect(encryptedPII.ssn.ciphertext.toString()).not.toContain('123-45-6789');
      expect(encryptedPII.email.ciphertext.toString()).not.toContain('john.doe');

      // Verify data can be decrypted
      const decryptedSSN = await cryptoProvider.decryptAESGCM(
        encryptedPII.ssn,
        dataKey,
        Buffer.from('pii:ssn')
      );

      expect(decryptedSSN.toString()).toBe(piiData.ssn);
    });

    it('should implement field-level encryption for database storage', async () => {
      const databaseRecord = {
        id: 12345, // Not encrypted
        name: 'John Doe', // Encrypted
        email: 'john@example.com', // Encrypted
        department: 'Engineering', // Not encrypted
        salary: 95000 // Encrypted
      };

      const encryptionKey = cryptoProvider.generateSecureRandom(32);
      const encryptedFields = ['name', 'email', 'salary'];

      const processedRecord = {};

      for (const [field, value] of Object.entries(databaseRecord)) {
        if (encryptedFields.includes(field)) {
          const encrypted = await cryptoProvider.encryptAESGCM(
            Buffer.from(String(value)),
            encryptionKey,
            Buffer.from(`field:${field}`)
          );
          processedRecord[field] = {
            encrypted: true,
            data: encrypted.ciphertext.toString('base64'),
            iv: encrypted.iv.toString('base64'),
            authTag: encrypted.authTag.toString('base64')
          };
        } else {
          processedRecord[field] = value;
        }
      }

      expect(processedRecord.id).toBe(12345);
      expect(processedRecord.department).toBe('Engineering');
      expect(processedRecord.name.encrypted).toBe(true);
      expect(processedRecord.email.encrypted).toBe(true);
      expect(processedRecord.salary.encrypted).toBe(true);
    });
  });

  describe('Key Storage Security', () => {
    it('should securely store encryption keys', () => {
      const keyStore = cryptoProvider.keyStore;
      
      // Keys should be stored with metadata
      const aesKey = keyStore.get('master-aes');
      expect(aesKey).toBeDefined();
      expect(aesKey.algorithm).toBe('AES-256-GCM');
      expect(aesKey.createdAt).toBeDefined();
      expect(aesKey.keySize).toBe(32);
    });

    it('should implement key escrow for regulatory compliance', () => {
      const escrowSystem = {
        escrowKeys: new Map(),
        storeKey(keyId, key, threshold = 3, totalShares = 5) {
          // Simplified Shamir's Secret Sharing simulation
          const shares = this.splitSecret(key, threshold, totalShares);
          this.escrowKeys.set(keyId, {
            threshold,
            totalShares,
            shares: shares.map((share, i) => ({
              shareId: i + 1,
              data: share
            }))
          });
          return true;
        },
        splitSecret(secret, threshold, totalShares) {
          // Simplified - in real implementation use proper secret sharing
          const shares = [];
          for (let i = 0; i < totalShares; i++) {
            shares.push({
              x: i + 1,
              y: Buffer.concat([secret, Buffer.from([i])])
            });
          }
          return shares;
        },
        reconstructSecret(keyId, providedShares) {
          if (providedShares.length < this.escrowKeys.get(keyId).threshold) {
            throw new Error('Insufficient shares for key reconstruction');
          }
          // Simplified reconstruction
          return providedShares[0].y.slice(0, -1);
        }
      };

      const sensitiveKey = cryptoProvider.generateSecureRandom(32);
      const keyId = 'master-key-2024';
      
      const stored = escrowSystem.storeKey(keyId, sensitiveKey);
      expect(stored).toBe(true);
      
      const escrowedKey = escrowSystem.escrowKeys.get(keyId);
      expect(escrowedKey.threshold).toBe(3);
      expect(escrowedKey.totalShares).toBe(5);
      expect(escrowedKey.shares).toHaveLength(5);
    });
  });

  describe('Compliance and Audit', () => {
    it('should log all cryptographic operations for audit', () => {
      const auditLog = [];
      
      const auditableProvider = {
        ...cryptoProvider,
        encryptAESGCM: async function(plaintext, key, aad) {
          auditLog.push({
            timestamp: this.getDeterministicDate().toISOString(),
            operation: 'ENCRYPT',
            algorithm: 'AES-256-GCM',
            keyLength: key.length * 8,
            dataLength: plaintext.length,
            hasAAD: !!aad,
            userId: 'system',
            sessionId: 'session-123'
          });
          return await cryptoProvider.encryptAESGCM(plaintext, key, aad);
        }
      };

      const data = Buffer.from('Test data');
      const key = cryptoProvider.generateSecureRandom(32);
      
      auditableProvider.encryptAESGCM(data, key);
      
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].operation).toBe('ENCRYPT');
      expect(auditLog[0].algorithm).toBe('AES-256-GCM');
      expect(auditLog[0].keyLength).toBe(256);
    });

    it('should validate data retention and destruction policies', () => {
      const dataRetentionManager = {
        policies: new Map([
          ['PII', { retentionPeriod: 2 * 365 * 24 * 60 * 60 * 1000 }], // 2 years
          ['FINANCIAL', { retentionPeriod: 7 * 365 * 24 * 60 * 60 * 1000 }], // 7 years
          ['LOGS', { retentionPeriod: 90 * 24 * 60 * 60 * 1000 }] // 90 days
        ]),
        encryptedData: new Map(),
        
        storeData(dataId, data, classification) {
          const policy = this.policies.get(classification);
          const expirationDate = new Date(this.getDeterministicTimestamp() + policy.retentionPeriod);
          
          this.encryptedData.set(dataId, {
            data: data,
            classification: classification,
            createdAt: this.getDeterministicDate(),
            expiresAt: expirationDate
          });
        },
        
        checkExpiredData() {
          const now = this.getDeterministicDate();
          const expiredData = [];
          
          for (const [dataId, record] of this.encryptedData.entries()) {
            if (record.expiresAt <= now) {
              expiredData.push(dataId);
            }
          }
          
          return expiredData;
        },
        
        secureDestroy(dataId) {
          // Cryptographic erasure - destroy the key
          this.encryptedData.delete(dataId);
          return true;
        }
      };

      // Store some test data
      dataRetentionManager.storeData('pii-001', 'encrypted-pii-data', 'PII');
      dataRetentionManager.storeData('log-001', 'encrypted-log-data', 'LOGS');

      expect(dataRetentionManager.encryptedData.size).toBe(2);
      
      // Simulate data with past expiration
      const expiredRecord = dataRetentionManager.encryptedData.get('log-001');
      expiredRecord.expiresAt = new Date(this.getDeterministicTimestamp() - 86400000); // 1 day ago

      const expiredData = dataRetentionManager.checkExpiredData();
      expect(expiredData).toContain('log-001');

      const destroyed = dataRetentionManager.secureDestroy('log-001');
      expect(destroyed).toBe(true);
      expect(dataRetentionManager.encryptedData.has('log-001')).toBe(false);
    });
  });
});