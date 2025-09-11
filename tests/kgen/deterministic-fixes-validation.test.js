/**
 * Deterministic Fixes Validation Test
 * 
 * Validates that our fixes for non-deterministic operations work correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Deterministic Fixes Validation', () => {
  describe('CCPA Privacy Controller Fixes', () => {
    let FixedCCPAController;
    let controller1, controller2;

    beforeEach(async () => {
      // Set test environment
      process.env.NODE_ENV = 'test';
      
      // Import the fixed controller
      const module = await import('../../compliance/ccpa/fixed-privacy-controller.js');
      FixedCCPAController = module.CCPAPrivacyController;
      
      // Create two controller instances
      controller1 = new FixedCCPAController({ businessName: 'Test Corp' });
      controller2 = new FixedCCPAController({ businessName: 'Test Corp' });
    });

    it('should generate identical request IDs for identical inputs', () => {
      // Record same consumer in both controllers
      controller1.recordConsumer('consumer-123', {
        categories: ['contact', 'personal'],
        sources: ['direct'],
        businessPurposes: ['service']
      });
      
      controller2.recordConsumer('consumer-123', {
        categories: ['contact', 'personal'], 
        sources: ['direct'],
        businessPurposes: ['service']
      });

      // Handle identical requests
      const result1 = controller1.handleRightToKnowRequest('consumer-123', 'categories', { email: 'test@example.com' });
      const result2 = controller2.handleRightToKnowRequest('consumer-123', 'categories', { email: 'test@example.com' });

      // Request IDs should be identical
      expect(result1.requestId).toBe(result2.requestId);
      expect(result1.requestId).toMatch(/^know_[a-f0-9]{16}$/);
    });

    it('should generate different IDs for different consumers', () => {
      controller1.recordConsumer('consumer-123', { categories: ['contact'] });
      controller1.recordConsumer('consumer-456', { categories: ['contact'] });

      const result1 = controller1.handleRightToKnowRequest('consumer-123', 'categories', { email: 'test@example.com' });
      const result2 = controller1.handleRightToKnowRequest('consumer-456', 'categories', { email: 'test@example.com' });

      expect(result1.requestId).not.toBe(result2.requestId);
    });

    it('should generate deterministic delete request IDs', () => {
      controller1.recordConsumer('consumer-789', { categories: ['personal'] });
      controller2.recordConsumer('consumer-789', { categories: ['personal'] });

      const result1 = controller1.handleRightToDeleteRequest('consumer-789', { phone: '555-1234', code: '123456' });
      const result2 = controller2.handleRightToDeleteRequest('consumer-789', { phone: '555-1234', code: '123456' });

      expect(result1.result.requestId || result1.requestId).toBe(result2.result.requestId || result2.requestId);
    });

    it('should generate deterministic sale IDs', () => {
      controller1.recordConsumer('consumer-sale', { categories: ['contact'] });
      controller2.recordConsumer('consumer-sale', { categories: ['contact'] });

      const saleId1 = controller1.recordSale('consumer-sale', 'partner-a', ['contact', 'behavior'], 100);
      const saleId2 = controller2.recordSale('consumer-sale', 'partner-a', ['contact', 'behavior'], 100);

      expect(saleId1).toBe(saleId2);
      expect(saleId1).toMatch(/^sale_[a-f0-9]{16}$/);
    });

    it('should use deterministic timestamps in test environment', () => {
      controller1.recordConsumer('consumer-timestamp', { categories: ['test'] });
      
      const consumer = controller1.consumers.get('consumer-timestamp');
      
      // Should use fixed timestamp in test environment
      expect(consumer.recordedAt).toBe('2025-01-01T00:00:00.000Z');
      expect(consumer.lastUpdated).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should generate identical compliance reports for identical data', () => {
      // Set up identical data in both controllers
      controller1.recordConsumer('consumer-report', { categories: ['contact'] });
      controller2.recordConsumer('consumer-report', { categories: ['contact'] });

      controller1.handleRightToKnowRequest('consumer-report', 'categories', { email: 'test@example.com' });
      controller2.handleRightToKnowRequest('consumer-report', 'categories', { email: 'test@example.com' });

      const report1 = controller1.generateComplianceReport();
      const report2 = controller2.generateComplianceReport();

      // Reports should have identical content
      expect(report1.reportGeneratedAt).toBe(report2.reportGeneratedAt);
      expect(report1.summary).toEqual(report2.summary);
      expect(report1.requestTypes).toEqual(report2.requestTypes);
    });
  });

  describe('Deterministic ID Generator Edge Cases', () => {
    let DeterministicIdGenerator;
    let generator;

    beforeEach(async () => {
      const module = await import('../../src/utils/deterministic-id-generator.js');
      DeterministicIdGenerator = module.DeterministicIdGenerator;
      generator = new DeterministicIdGenerator();
    });

    it('should handle array order normalization', () => {
      const id1 = generator.generateSaleId('consumer', 'partner', ['category-a', 'category-b']);
      const id2 = generator.generateSaleId('consumer', 'partner', ['category-b', 'category-a']);

      expect(id1).toBe(id2); // Arrays should be sorted for consistency
    });

    it('should handle object property order normalization', () => {
      const obj1 = { purpose: 'marketing', scope: 'all' };
      const obj2 = { scope: 'all', purpose: 'marketing' };

      const id1 = generator.generateGDPRRequestId('sar', 'subject', obj1);
      const id2 = generator.generateGDPRRequestId('sar', 'subject', obj2);

      expect(id1).toBe(id2); // Object keys should be sorted
    });

    it('should handle null/undefined inputs consistently', () => {
      const id1 = generator.generateId('test', null, undefined, '');
      const id2 = generator.generateId('test', '', '', '');

      expect(id1).toBe(id2); // null/undefined should normalize to empty string
    });

    it('should be collision resistant for similar inputs', () => {
      const ids = new Set();
      
      // Generate many IDs with similar inputs
      for (let i = 0; i < 1000; i++) {
        const id = generator.generateId('test', `input-${i}`);
        expect(ids.has(id)).toBe(false); // No collisions expected
        ids.add(id);
      }
      
      expect(ids.size).toBe(1000);
    });
  });

  describe('Reproducibility Across Processes', () => {
    it('should generate same IDs in different process runs', async () => {
      // This test would ideally run across multiple Node.js processes
      // For now, we test multiple imports/instantiations
      
      const module1 = await import('../../src/utils/deterministic-id-generator.js?v=1');
      const module2 = await import('../../src/utils/deterministic-id-generator.js?v=2');
      
      const gen1 = new module1.DeterministicIdGenerator();
      const gen2 = new module2.DeterministicIdGenerator();
      
      const id1 = gen1.generateId('cross-process', 'test-data');
      const id2 = gen2.generateId('cross-process', 'test-data');
      
      expect(id1).toBe(id2);
    });
  });
});

describe('Original vs Fixed Implementation Comparison', () => {
  it('should demonstrate non-deterministic vs deterministic behavior', async () => {
    // Simulate original non-deterministic behavior
    const fakeId1 = `know_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fakeId2 = `know_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Original IDs should be different (non-deterministic)
    expect(fakeId1).not.toBe(fakeId2);
    
    // Fixed deterministic behavior
    const module = await import('../../src/utils/deterministic-id-generator.js');
    const generator = new module.DeterministicIdGenerator();
    
    const fixedId1 = generator.generateCCPARequestId('know', 'consumer-123', { requestType: 'categories' });
    const fixedId2 = generator.generateCCPARequestId('know', 'consumer-123', { requestType: 'categories' });
    
    // Fixed IDs should be identical (deterministic)
    expect(fixedId1).toBe(fixedId2);
    
    console.log('📊 COMPARISON RESULTS:');
    console.log('Non-deterministic (original):', { fakeId1, fakeId2, identical: fakeId1 === fakeId2 });
    console.log('Deterministic (fixed):', { fixedId1, fixedId2, identical: fixedId1 === fixedId2 });
  });
});