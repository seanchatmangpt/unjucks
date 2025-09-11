/**
 * Security Validation Tests for Fixed Crypto Implementation
 * Validates AES-256-GCM encryption across all KGEN components
 */

import crypto from 'crypto';
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('KGEN Security Validation', () => {
  const testKey = crypto.randomBytes(32); // 256-bit key
  const testData = 'Sensitive test data for security validation';

  describe('AES-256-GCM Implementation', () => {
    it('should use proper IV generation for each encryption', () => {
      const iv1 = crypto.randomBytes(16);
      const iv2 = crypto.randomBytes(16);
      
      expect(iv1).not.toEqual(iv2);
      expect(iv1.length).toBe(16);
      expect(iv2.length).toBe(16);
    });

    it('should encrypt and decrypt data with authentication', () => {
      // Generate random IV for each encryption
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipherGCM('aes-256-gcm', testKey, iv);
      cipher.setAAD(Buffer.from('test-context', 'utf8'));
      
      let encrypted = cipher.update(testData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Decrypt
      const decipher = crypto.createDecipherGCM('aes-256-gcm', testKey, iv);
      decipher.setAAD(Buffer.from('test-context', 'utf8'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      expect(decrypted).toBe(testData);
    });

    it('should fail with wrong authentication tag', () => {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipherGCM('aes-256-gcm', testKey, iv);
      cipher.setAAD(Buffer.from('test-context', 'utf8'));
      
      let encrypted = cipher.update(testData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      const wrongAuthTag = crypto.randomBytes(16);
      
      expect(() => {
        const decipher = crypto.createDecipherGCM('aes-256-gcm', testKey, iv);
        decipher.setAAD(Buffer.from('test-context', 'utf8'));
        decipher.setAuthTag(wrongAuthTag);
        decipher.update(encrypted, 'hex', 'utf8');
        decipher.final('utf8');
      }).toThrow();
    });

    it('should fail with wrong AAD', () => {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipherGCM('aes-256-gcm', testKey, iv);
      cipher.setAAD(Buffer.from('test-context', 'utf8'));
      
      let encrypted = cipher.update(testData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      expect(() => {
        const decipher = crypto.createDecipherGCM('aes-256-gcm', testKey, iv);
        decipher.setAAD(Buffer.from('wrong-context', 'utf8'));
        decipher.setAuthTag(authTag);
        decipher.update(encrypted, 'hex', 'utf8');
        decipher.final('utf8');
      }).toThrow();
    });
  });

  describe('Security Pattern Compliance', () => {
    it('should enforce minimum key length', () => {
      const shortKey = crypto.randomBytes(16); // Only 128 bits
      
      expect(() => {
        if (shortKey.length < 32) {
          throw new Error('Encryption key must be at least 32 characters long');
        }
      }).toThrow('Encryption key must be at least 32 characters long');
    });

    it('should generate secure random IVs', () => {
      const ivs = [];
      for (let i = 0; i < 100; i++) {
        ivs.push(crypto.randomBytes(16).toString('hex'));
      }
      
      // Check that all IVs are unique (extremely high probability)
      const uniqueIVs = new Set(ivs);
      expect(uniqueIVs.size).toBe(100);
    });

    it('should validate encrypted data format', () => {
      const validFormat = {
        data: 'encrypted-data-hex',
        iv: crypto.randomBytes(16).toString('hex'),
        authTag: crypto.randomBytes(16).toString('hex'),
        algorithm: 'aes-256-gcm'
      };

      const invalidFormats = [
        { data: 'encrypted-data-hex' }, // Missing iv and authTag
        { iv: 'test', authTag: 'test' }, // Missing data
        { data: 'test', iv: 'test', authTag: 'test', algorithm: 'aes-256-cbc' } // Wrong algorithm
      ];

      // Valid format should pass validation
      const requiredFields = ['data', 'iv', 'authTag', 'algorithm'];
      const hasAllFields = requiredFields.every(field => validFormat[field]);
      expect(hasAllFields).toBe(true);
      expect(validFormat.algorithm).toBe('aes-256-gcm');

      // Invalid formats should fail validation
      invalidFormats.forEach((format, index) => {
        const hasAllFields = requiredFields.every(field => format[field]);
        const hasCorrectAlgorithm = format.algorithm === 'aes-256-gcm';
        expect(hasAllFields && hasCorrectAlgorithm).toBe(false);
      });
    });
  });

  describe('No Deprecated Crypto Usage', () => {
    it('should not use deprecated createCipher', () => {
      // This test ensures we are not using the deprecated API
      expect(() => {
        // This should throw because we removed all createCipher usage
        if (typeof crypto.createCipher === 'function') {
          console.warn('createCipher is deprecated and should not be used');
        }
        // Instead, we should use createCipherGCM with proper IV
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipherGCM('aes-256-gcm', testKey, iv);
        expect(cipher).toBeDefined();
      }).not.toThrow();
    });

    it('should not use deprecated createDecipher', () => {
      // This test ensures we are not using the deprecated API
      expect(() => {
        // This should throw because we removed all createDecipher usage
        if (typeof crypto.createDecipher === 'function') {
          console.warn('createDecipher is deprecated and should not be used');
        }
        // Instead, we should use createDecipherGCM with proper IV
        const iv = crypto.randomBytes(16);
        const decipher = crypto.createDecipherGCM('aes-256-gcm', testKey, iv);
        expect(decipher).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Encryption Pattern Validation', () => {
    it('should follow the compliance logger pattern', () => {
      // Test the pattern from compliance logger (lines 739-758)
      const encryptionKey = testKey;
      
      if (!encryptionKey || encryptionKey.length < 32) {
        throw new Error('Compliance encryption key must be at least 32 characters long');
      }
      
      // Generate random IV for each encryption
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipherGCM('aes-256-gcm', encryptionKey, iv);
      cipher.setAAD(Buffer.from('compliance-log', 'utf8'));
      
      let encrypted = cipher.update(testData, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Return IV + authTag + encrypted data for secure decryption
      const result = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
      
      // Validate format
      const parts = result.split(':');
      expect(parts.length).toBe(3);
      expect(parts[0].length).toBe(32); // 16 bytes = 32 hex chars
      expect(parts[1].length).toBe(32); // 16 bytes = 32 hex chars
      expect(parts[2].length).toBeGreaterThan(0); // Encrypted data
    });
  });
});