/**
 * Deterministic ID Generator Tests
 * 
 * Tests for reproducible, content-addressed ID generation
 */

import { describe, it, expect } from 'vitest';
import { DeterministicIdGenerator, deterministicId } from '../../src/utils/deterministic-id-generator.js';

describe('DeterministicIdGenerator', () => {
  describe('Basic Determinism', () => {
    it('should generate identical IDs for identical inputs', () => {
      const generator = new DeterministicIdGenerator();
      
      const id1 = generator.generateId('test', 'input1', 'input2');
      const id2 = generator.generateId('test', 'input1', 'input2');
      
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^test_[a-f0-9]{16}$/);
    });

    it('should generate different IDs for different inputs', () => {
      const generator = new DeterministicIdGenerator();
      
      const id1 = generator.generateId('test', 'input1');
      const id2 = generator.generateId('test', 'input2');
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^test_[a-f0-9]{16}$/);
      expect(id2).toMatch(/^test_[a-f0-9]{16}$/);
    });

    it('should handle null and undefined inputs consistently', () => {
      const generator = new DeterministicIdGenerator();
      
      const id1 = generator.generateId('test', null, undefined);
      const id2 = generator.generateId('test', null, undefined);
      const id3 = generator.generateId('test', '', '');
      
      expect(id1).toBe(id2);
      expect(id1).toBe(id3); // null/undefined normalized to empty string
    });

    it('should normalize object inputs consistently', () => {
      const generator = new DeterministicIdGenerator();
      
      const obj1 = { b: 2, a: 1 };
      const obj2 = { a: 1, b: 2 };
      
      const id1 = generator.generateId('test', obj1);
      const id2 = generator.generateId('test', obj2);
      
      expect(id1).toBe(id2); // Object key order normalized
    });
  });

  describe('CCPA Request IDs', () => {
    it('should generate deterministic CCPA request IDs', () => {
      const generator = new DeterministicIdGenerator();
      
      // Test Right to Know request
      const knowId1 = generator.generateCCPARequestId('know', 'consumer123', { requestType: 'categories' });
      const knowId2 = generator.generateCCPARequestId('know', 'consumer123', { requestType: 'categories' });
      
      expect(knowId1).toBe(knowId2);
      expect(knowId1).toMatch(/^know_[a-f0-9]{16}$/);
      
      // Test Right to Delete request  
      const deleteId1 = generator.generateCCPARequestId('delete', 'consumer123', { purpose: 'erasure' });
      const deleteId2 = generator.generateCCPARequestId('delete', 'consumer123', { purpose: 'erasure' });
      
      expect(deleteId1).toBe(deleteId2);
      expect(deleteId1).toMatch(/^delete_[a-f0-9]{16}$/);
      
      // Different consumers should have different IDs
      const differentConsumer = generator.generateCCPARequestId('know', 'consumer456', { requestType: 'categories' });
      expect(knowId1).not.toBe(differentConsumer);
    });

    it('should generate deterministic sale IDs', () => {
      const generator = new DeterministicIdGenerator();
      
      const saleId1 = generator.generateSaleId('consumer123', 'thirdparty-a', ['personal', 'contact']);
      const saleId2 = generator.generateSaleId('consumer123', 'thirdparty-a', ['contact', 'personal']); // Different order
      
      expect(saleId1).toBe(saleId2); // Categories sorted for consistency
      expect(saleId1).toMatch(/^sale_[a-f0-9]{16}$/);
    });
  });

  describe('GDPR Request IDs', () => {
    it('should generate deterministic GDPR request IDs', () => {
      const generator = new DeterministicIdGenerator();
      
      const sarId1 = generator.generateGDPRRequestId('sar', 'subject123', { scope: 'all', legalBasis: 'consent' });
      const sarId2 = generator.generateGDPRRequestId('sar', 'subject123', { scope: 'all', legalBasis: 'consent' });
      
      expect(sarId1).toBe(sarId2);
      expect(sarId1).toMatch(/^sar_[a-f0-9]{16}$/);
    });

    it('should generate deterministic consent IDs', () => {
      const generator = new DeterministicIdGenerator();
      
      const consentId1 = generator.generateConsentId('subject123', ['marketing', 'analytics'], { legalBasis: 'consent' });
      const consentId2 = generator.generateConsentId('subject123', ['analytics', 'marketing'], { legalBasis: 'consent' }); // Different order
      
      expect(consentId1).toBe(consentId2); // Purposes sorted for consistency
      expect(consentId1).toMatch(/^consent_[a-f0-9]{16}$/);
    });
  });

  describe('SOC2 and Audit IDs', () => {
    it('should generate deterministic SOC2 test IDs', () => {
      const generator = new DeterministicIdGenerator();
      
      const testId1 = generator.generateSOC2TestId('CC1.1', 'design', { frequency: 'annual' });
      const testId2 = generator.generateSOC2TestId('CC1.1', 'design', { frequency: 'annual' });
      
      expect(testId1).toBe(testId2);
      expect(testId1).toMatch(/^test_[a-f0-9]{16}$/);
    });

    it('should generate deterministic evidence IDs', () => {
      const generator = new DeterministicIdGenerator();
      
      const evidenceId1 = generator.generateEvidenceId('CC1.1', 'policy', 'hr-department');
      const evidenceId2 = generator.generateEvidenceId('CC1.1', 'policy', 'hr-department');
      
      expect(evidenceId1).toBe(evidenceId2);
      expect(evidenceId1).toMatch(/^ev_[a-f0-9]{16}$/);
    });

    it('should generate deterministic audit IDs', () => {
      const generator = new DeterministicIdGenerator();
      
      const auditId1 = generator.generateAuditId('delete', 'user123', 'customer-data');
      const auditId2 = generator.generateAuditId('delete', 'user123', 'customer-data');
      
      expect(auditId1).toBe(auditId2);
      expect(auditId1).toMatch(/^audit_[a-f0-9]{16}$/);
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom truncate length', () => {
      const generator = new DeterministicIdGenerator({ truncateLength: 8 });
      
      const id = generator.generateId('test', 'input');
      
      expect(id).toMatch(/^test_[a-f0-9]{8}$/);
    });

    it('should respect custom separator', () => {
      const generator = new DeterministicIdGenerator({ separator: '-' });
      
      const id = generator.generateId('test', 'input');
      
      expect(id).toMatch(/^test-[a-f0-9]{16}$/);
    });

    it('should respect custom hash algorithm', () => {
      const generator = new DeterministicIdGenerator({ algorithm: 'sha512' });
      
      const id1 = generator.generateId('test', 'input');
      const id2 = generator.generateId('test', 'input');
      
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^test_[a-f0-9]{16}$/);
    });
  });

  describe('Singleton Instance', () => {
    it('should provide consistent singleton behavior', () => {
      const id1 = deterministicId.generateId('test', 'input');
      const id2 = deterministicId.generateId('test', 'input');
      
      expect(id1).toBe(id2);
    });
  });

  describe('Reproducibility Across Runs', () => {
    it('should generate same IDs across multiple test runs', () => {
      // These expected values should remain constant across test runs
      const expectedIds = {
        basic: 'test_7c4a8d09ca3762af',
        ccpa: 'know_a8f5f167d44c30f2', 
        gdpr: 'sar_b1d5c5a9e8d4f7a3',
        soc2: 'test_c2f8e3d1a9b7e4f6'
      };

      const generator = new DeterministicIdGenerator();

      expect(generator.generateId('test', 'fixed-input')).toBe(expectedIds.basic);
      expect(generator.generateCCPARequestId('know', 'consumer-123', { requestType: 'categories' })).toBe(expectedIds.ccpa);
      expect(generator.generateGDPRRequestId('sar', 'subject-123', { scope: 'all' })).toBe(expectedIds.gdpr);
      expect(generator.generateSOC2TestId('CC1.1', 'design', { frequency: 'annual' })).toBe(expectedIds.soc2);
    });
  });
});