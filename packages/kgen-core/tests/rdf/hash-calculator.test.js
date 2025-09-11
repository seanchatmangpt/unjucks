/**
 * Test suite for HashCalculator module
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { HashCalculator } from '../../src/rdf/hash-calculator.js';
import { DataFactory } from 'n3';

const { namedNode, literal, blankNode, quad, defaultGraph } = DataFactory;

describe('HashCalculator', () => {
  let calculator;

  beforeEach(() => {
    calculator = new HashCalculator({
      algorithm: 'sha256',
      encoding: 'hex',
      normalization: 'rdf-dataset-canonical'
    });
  });

  afterEach(() => {
    calculator?.clearCache();
  });

  describe('Graph Hashing', () => {
    it('should calculate consistent hash for same graph', () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('o'))
      ];

      const hash1 = calculator.calculateGraphHash(quads);
      const hash2 = calculator.calculateGraphHash(quads);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex format
    });

    it('should produce different hashes for different graphs', () => {
      const quads1 = [
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('o'))
      ];
      const quads2 = [
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('o'))
      ];

      const hash1 = calculator.calculateGraphHash(quads1);
      const hash2 = calculator.calculateGraphHash(quads2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty graphs', () => {
      const hash = calculator.calculateGraphHash([]);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be order-independent for same triples', () => {
      const quads1 = [
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('o1')),
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('o2'))
      ];
      const quads2 = [
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('o2')),
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('o1'))
      ];

      const hash1 = calculator.calculateGraphHash(quads1);
      const hash2 = calculator.calculateGraphHash(quads2);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('Quad Hashing', () => {
    it('should calculate hash for individual quad', () => {
      const testQuad = quad(
        namedNode('http://example.org/s'),
        namedNode('http://example.org/p'),
        literal('o')
      );

      const hash = calculator.calculateQuadHash(testQuad);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent quad hashes', () => {
      const testQuad = quad(
        namedNode('http://example.org/s'),
        namedNode('http://example.org/p'),
        literal('o')
      );

      const hash1 = calculator.calculateQuadHash(testQuad);
      const hash2 = calculator.calculateQuadHash(testQuad);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('Incremental Hashing', () => {
    it('should calculate incremental hash when adding quads', () => {
      const originalQuads = [
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('o1'))
      ];
      const additionalQuads = [
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('o2'))
      ];

      const originalHash = calculator.calculateGraphHash(originalQuads);
      const incrementalHash = calculator.calculateIncrementalHash(originalHash, additionalQuads);
      
      expect(incrementalHash).not.toBe(originalHash);
      expect(incrementalHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should return same hash when no quads added', () => {
      const originalHash = 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234';
      const incrementalHash = calculator.calculateIncrementalHash(originalHash, []);
      
      expect(incrementalHash).toBe(originalHash);
    });
  });

  describe('Content Identifiers', () => {
    it('should create content-addressed identifier', () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('o'))
      ];

      const contentId = calculator.createContentId(quads);
      
      expect(contentId).toMatch(/^kgen:v1:/);
    });

    it('should create content ID with custom options', () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('o'))
      ];

      const contentId = calculator.createContentId(quads, {
        prefix: 'custom',
        version: 'v2',
        encoding: 'hex'
      });
      
      expect(contentId).toMatch(/^custom:v2:/);
    });
  });

  describe('Blank Node Normalization', () => {
    it('should canonicalize blank nodes consistently', () => {
      const quads1 = [
        quad(blankNode('b1'), namedNode('http://example.org/p'), literal('o1')),
        quad(blankNode('b2'), namedNode('http://example.org/p'), literal('o2'))
      ];
      const quads2 = [
        quad(blankNode('x1'), namedNode('http://example.org/p'), literal('o1')),
        quad(blankNode('x2'), namedNode('http://example.org/p'), literal('o2'))
      ];

      const hash1 = calculator.calculateGraphHash(quads1);
      const hash2 = calculator.calculateGraphHash(quads2);
      
      expect(hash1).toBe(hash2);
    });

    it('should handle blank nodes in different positions', () => {
      const quads1 = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), blankNode('b1'))
      ];
      const quads2 = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), blankNode('x1'))
      ];

      const hash1 = calculator.calculateGraphHash(quads1);
      const hash2 = calculator.calculateGraphHash(quads2);
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('Merkle Tree Hashing', () => {
    it('should calculate Merkle tree hash for large graphs', () => {
      const quads = Array.from({ length: 100 }, (_, i) => 
        quad(namedNode(`http://example.org/s${i}`), namedNode('http://example.org/p'), literal(`o${i}`))
      );

      const hash = calculator._calculateMerkleHash(quads);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should build consistent Merkle tree', () => {
      const hashes = ['abc123', 'def456', 'ghi789'];
      
      const root1 = calculator._buildMerkleTree(hashes);
      const root2 = calculator._buildMerkleTree(hashes);
      
      expect(root1).toBe(root2);
    });
  });

  describe('Normalization Algorithms', () => {
    it('should support simple normalization', () => {
      const calculator = new HashCalculator({
        normalization: 'simple'
      });
      
      const quads = [
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('o2')),
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('o1'))
      ];

      const hash = calculator.calculateGraphHash(quads);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should support Merkle normalization', () => {
      const calculator = new HashCalculator({
        normalization: 'merkle'
      });
      
      const quads = [
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('o1')),
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('o2'))
      ];

      const hash = calculator.calculateGraphHash(quads);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Hash Verification', () => {
    it('should verify hash integrity correctly', () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('o'))
      ];

      const hash = calculator.calculateGraphHash(quads);
      const isValid = calculator.verifyHash(quads, hash);
      
      expect(isValid).toBe(true);
    });

    it('should detect hash mismatches', () => {
      const quads1 = [
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('o'))
      ];
      const quads2 = [
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('o'))
      ];

      const hash1 = calculator.calculateGraphHash(quads1);
      const isValid = calculator.verifyHash(quads2, hash1);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Caching', () => {
    it('should cache hash calculations for performance', () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('o'))
      ];

      // First calculation
      const hash1 = calculator.calculateGraphHash(quads);
      
      // Second calculation should hit cache
      const hash2 = calculator.calculateGraphHash(quads);
      
      expect(hash1).toBe(hash2);
      expect(calculator.cache.size).toBeGreaterThan(0);
    });

    it('should provide cache statistics', () => {
      const stats = calculator.getCacheStats();
      
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBe(10000);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
    });

    it('should clear cache when requested', () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('o'))
      ];
      
      calculator.calculateGraphHash(quads);
      expect(calculator.cache.size).toBeGreaterThan(0);
      
      calculator.clearCache();
      expect(calculator.cache.size).toBe(0);
    });
  });

  describe('Different Hash Algorithms', () => {
    it('should support different hash algorithms', () => {
      const sha256Calculator = new HashCalculator({ algorithm: 'sha256' });
      const sha1Calculator = new HashCalculator({ algorithm: 'sha1' });
      
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('o'))
      ];

      const sha256Hash = sha256Calculator.calculateGraphHash(quads);
      const sha1Hash = sha1Calculator.calculateGraphHash(quads);
      
      expect(sha256Hash).toHaveLength(64); // SHA256
      expect(sha1Hash).toHaveLength(40);   // SHA1
      expect(sha256Hash).not.toBe(sha1Hash);
    });
  });

  describe('Edge Cases', () => {
    it('should handle graphs with literals containing special characters', () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), 
              literal('Text with "quotes" and \n newlines'))
      ];

      const hash = calculator.calculateGraphHash(quads);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle graphs with language tags', () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), 
              literal('Hello', 'en'))
      ];

      const hash = calculator.calculateGraphHash(quads);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle graphs with datatype literals', () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), 
              literal('42', namedNode('http://www.w3.org/2001/XMLSchema#integer')))
      ];

      const hash = calculator.calculateGraphHash(quads);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});