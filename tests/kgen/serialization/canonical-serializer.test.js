/**
 * Canonical Turtle Serializer Test Suite
 * 
 * Comprehensive tests for deterministic, canonical turtle serialization
 * including edge cases, performance validation, and enterprise compliance.
 */

import { strict as assert } from 'assert';
import { Store, DataFactory, Parser } from 'n3';
import crypto from 'crypto';
import { CanonicalTurtleSerializer } from '../../../src/kgen/serialization/canonical-turtle-serializer.js';

const { namedNode, literal, blankNode, quad } = DataFactory;

describe('CanonicalTurtleSerializer', function() {
  let serializer;
  
  beforeEach(async function() {
    serializer = new CanonicalTurtleSerializer({
      enableCanonicalOrdering: true,
      deterministicBlankNodes: true,
      enableIntegrityHash: true
    });
    
    await serializer.initialize();
  });
  
  afterEach(async function() {
    await serializer.shutdown();
  });

  describe('Initialization', function() {
    it('should initialize successfully with default config', async function() {
      const newSerializer = new CanonicalTurtleSerializer();
      const result = await newSerializer.initialize();
      
      assert.equal(result.status, 'success');
      assert(Array.isArray(result.features));
      
      await newSerializer.shutdown();
    });
    
    it('should initialize canonical namespaces', async function() {
      const stats = serializer.getStatistics();
      assert(stats.features.canonicalOrdering);
      assert(stats.features.deterministicBlankNodes);
    });
  });

  describe('Canonical Ordering', function() {
    it('should produce identical output for same data in different order', async function() {
      // Create test data in different orders
      const quads1 = [
        quad(namedNode('http://example.org/b'), namedNode('http://example.org/pred'), literal('value1')),
        quad(namedNode('http://example.org/a'), namedNode('http://example.org/pred'), literal('value2')),
        quad(namedNode('http://example.org/c'), namedNode('http://example.org/pred'), literal('value3'))
      ];
      
      const quads2 = [
        quad(namedNode('http://example.org/c'), namedNode('http://example.org/pred'), literal('value3')),
        quad(namedNode('http://example.org/a'), namedNode('http://example.org/pred'), literal('value2')),
        quad(namedNode('http://example.org/b'), namedNode('http://example.org/pred'), literal('value1'))
      ];
      
      const result1 = await serializer.serializeCanonical(quads1);
      const result2 = await serializer.serializeCanonical(quads2);
      
      // Should produce identical canonical output
      assert.equal(result1.turtle, result2.turtle);
      assert.equal(result1.statistics.integrityHash, result2.statistics.integrityHash);
    });
    
    it('should order subjects lexicographically', async function() {
      const quads = [
        quad(namedNode('http://example.org/z'), namedNode('http://example.org/pred'), literal('value')),
        quad(namedNode('http://example.org/a'), namedNode('http://example.org/pred'), literal('value')),
        quad(namedNode('http://example.org/m'), namedNode('http://example.org/pred'), literal('value'))
      ];
      
      const result = await serializer.serializeCanonical(quads);
      
      // Parse result to verify ordering
      const lines = result.turtle.split('\n').filter(line => line.includes('example.org/'));
      
      // Should be in alphabetical order: a, m, z
      assert(lines[0].includes('example.org/a'));
      assert(lines[1].includes('example.org/m'));
      assert(lines[2].includes('example.org/z'));
    });
  });

  describe('Deterministic Blank Nodes', function() {
    it('should generate consistent blank node labels', async function() {
      const quads = [
        quad(blankNode('temp1'), namedNode('http://example.org/pred'), literal('value1')),
        quad(blankNode('temp2'), namedNode('http://example.org/pred'), literal('value2'))
      ];
      
      const result1 = await serializer.serializeCanonical(quads);
      const result2 = await serializer.serializeCanonical(quads);
      
      // Should produce identical blank node labels
      assert.equal(result1.turtle, result2.turtle);
      assert.equal(result1.statistics.integrityHash, result2.statistics.integrityHash);
    });
    
    it('should use deterministic blank node prefix', async function() {
      const quads = [
        quad(blankNode('temp'), namedNode('http://example.org/pred'), literal('value'))
      ];
      
      const result = await serializer.serializeCanonical(quads);
      
      // Should contain the configured blank node prefix
      assert(result.turtle.includes('_:b'));
    });
  });

  describe('Prefix Optimization', function() {
    it('should optimize prefixes based on frequency', async function() {
      const quads = [
        quad(namedNode('http://example.org/frequent1'), namedNode('http://example.org/pred'), literal('value1')),
        quad(namedNode('http://example.org/frequent2'), namedNode('http://example.org/pred'), literal('value2')),
        quad(namedNode('http://example.org/frequent3'), namedNode('http://example.org/pred'), literal('value3')),
        quad(namedNode('http://rare.org/rare1'), namedNode('http://rare.org/pred'), literal('value'))
      ];
      
      const result = await serializer.serializeCanonical(quads);
      
      // Should contain optimized prefixes
      assert(result.turtle.includes('@prefix'));
      
      // High-frequency namespace should get shorter prefix
      const prefixLines = result.turtle.split('\n').filter(line => line.startsWith('@prefix'));
      assert(prefixLines.length > 0);
    });
  });

  describe('Integrity Verification', function() {
    it('should generate cryptographic integrity hash', async function() {
      const quads = [
        quad(namedNode('http://example.org/subj'), namedNode('http://example.org/pred'), literal('value'))
      ];
      
      const result = await serializer.serializeCanonical(quads);
      
      assert(result.statistics.integrityHash);
      assert.equal(result.statistics.integrityHash.length, 64); // SHA-256 hex length
      
      // Verify hash is deterministic
      const result2 = await serializer.serializeCanonical(quads);
      assert.equal(result.statistics.integrityHash, result2.statistics.integrityHash);
    });
    
    it('should detect content changes through hash', async function() {
      const quads1 = [
        quad(namedNode('http://example.org/subj'), namedNode('http://example.org/pred'), literal('value1'))
      ];
      
      const quads2 = [
        quad(namedNode('http://example.org/subj'), namedNode('http://example.org/pred'), literal('value2'))
      ];
      
      const result1 = await serializer.serializeCanonical(quads1);
      const result2 = await serializer.serializeCanonical(quads2);
      
      // Hashes should be different
      assert.notEqual(result1.statistics.integrityHash, result2.statistics.integrityHash);
    });
  });

  describe('Incremental Serialization', function() {
    it('should handle incremental updates', async function() {
      const baseQuads = [
        quad(namedNode('http://example.org/subj1'), namedNode('http://example.org/pred'), literal('value1'))
      ];
      
      const baseResult = await serializer.serializeCanonical(baseQuads);
      
      const addedQuads = [
        quad(namedNode('http://example.org/subj2'), namedNode('http://example.org/pred'), literal('value2'))
      ];
      
      // This should fall back to full serialization for now
      try {
        await serializer.serializeIncremental(addedQuads, [], baseResult.metadata.serializationId);
        assert.fail('Should throw error - incremental not yet implemented');
      } catch (error) {
        assert(error.message.includes('not yet implemented'));
      }
    });
  });

  describe('Serialization Comparison', function() {
    it('should correctly identify identical content', async function() {
      const quads = [
        quad(namedNode('http://example.org/subj'), namedNode('http://example.org/pred'), literal('value'))
      ];
      
      const result1 = await serializer.serializeCanonical(quads);
      const result2 = await serializer.serializeCanonical(quads);
      
      const comparison = await serializer.compareSerializations(result1.turtle, result2.turtle);
      
      assert(comparison.isIdentical);
      assert.equal(comparison.differences.length, 0);
      assert.equal(comparison.hash1, comparison.hash2);
    });
    
    it('should detect differences in content', async function() {
      const quads1 = [
        quad(namedNode('http://example.org/subj'), namedNode('http://example.org/pred'), literal('value1'))
      ];
      
      const quads2 = [
        quad(namedNode('http://example.org/subj'), namedNode('http://example.org/pred'), literal('value2'))
      ];
      
      const result1 = await serializer.serializeCanonical(quads1);
      const result2 = await serializer.serializeCanonical(quads2);
      
      const comparison = await serializer.compareSerializations(result1.turtle, result2.turtle);
      
      assert(!comparison.isIdentical);
      assert(comparison.differences.length > 0);
      assert.notEqual(comparison.hash1, comparison.hash2);
    });
  });

  describe('Canonical Validation', function() {
    it('should validate canonical ordering', async function() {
      const quads = [
        quad(namedNode('http://example.org/a'), namedNode('http://example.org/pred'), literal('value1')),
        quad(namedNode('http://example.org/b'), namedNode('http://example.org/pred'), literal('value2'))
      ];
      
      const result = await serializer.serializeCanonical(quads);
      const validation = await serializer.validateCanonicalOrdering(result.turtle);
      
      assert(validation.isCanonical);
      assert.equal(validation.issues.length, 0);
    });
    
    it('should detect non-canonical ordering', async function() {
      // Create manually ordered turtle that might not be canonical
      const nonCanonicalTurtle = `
@prefix ex: <http://example.org/> .

ex:z ex:pred "value3" .
ex:a ex:pred "value1" .
ex:m ex:pred "value2" .
`;
      
      const validation = await serializer.validateCanonicalOrdering(nonCanonicalTurtle);
      
      // Should detect ordering issues
      assert(!validation.isCanonical);
      assert(validation.issues.length > 0);
    });
  });

  describe('Performance and Statistics', function() {
    it('should track serialization statistics', async function() {
      const quads = [
        quad(namedNode('http://example.org/subj'), namedNode('http://example.org/pred'), literal('value'))
      ];
      
      const initialStats = serializer.getStatistics();
      await serializer.serializeCanonical(quads);
      const finalStats = serializer.getStatistics();
      
      assert.equal(finalStats.totalSerializations, initialStats.totalSerializations + 1);
      assert(finalStats.averageSerializationTime >= 0);
    });
    
    it('should handle large datasets efficiently', async function() {
      // Generate a larger dataset
      const quads = [];
      for (let i = 0; i < 1000; i++) {
        quads.push(quad(
          namedNode(`http://example.org/subj${i}`),
          namedNode(`http://example.org/pred${i % 10}`),
          literal(`value${i}`)
        ));
      }
      
      const startTime = this.getDeterministicTimestamp();
      const result = await serializer.serializeCanonical(quads);
      const processingTime = this.getDeterministicTimestamp() - startTime;
      
      assert(result.statistics.inputTriples === 1000);
      assert(processingTime < 5000); // Should complete within 5 seconds
      assert(result.statistics.integrityHash);
    });
  });

  describe('Configuration Options', function() {
    it('should respect configuration settings', async function() {
      const customSerializer = new CanonicalTurtleSerializer({
        enableCanonicalOrdering: false,
        deterministicBlankNodes: false,
        enableIntegrityHash: false
      });
      
      await customSerializer.initialize();
      
      const stats = customSerializer.getStatistics();
      assert(!stats.features.canonicalOrdering);
      assert(!stats.features.deterministicBlankNodes);
      assert(!stats.features.integrityHashing);
      
      await customSerializer.shutdown();
    });
  });

  describe('Error Handling', function() {
    it('should handle invalid input gracefully', async function() {
      try {
        await serializer.serializeCanonical(null);
        assert.fail('Should throw error for null input');
      } catch (error) {
        assert(error instanceof Error);
      }
    });
    
    it('should handle malformed turtle in validation', async function() {
      const malformedTurtle = 'This is not valid turtle syntax';
      
      try {
        await serializer.validateCanonicalOrdering(malformedTurtle);
        assert.fail('Should throw error for malformed turtle');
      } catch (error) {
        assert(error instanceof Error);
      }
    });
  });

  describe('Enterprise Features', function() {
    it('should embed serialization metadata', async function() {
      const quads = [
        quad(namedNode('http://example.org/subj'), namedNode('http://example.org/pred'), literal('value'))
      ];
      
      const result = await serializer.serializeCanonical(quads);
      
      assert(result.metadata);
      assert(result.metadata.serializationId);
      assert(result.metadata.timestamp);
      assert(result.metadata.serializer);
      assert(result.metadata.deterministicProperties);
    });
    
    it('should maintain audit trail', async function() {
      const quads = [
        quad(namedNode('http://example.org/subj'), namedNode('http://example.org/pred'), literal('value'))
      ];
      
      await serializer.serializeCanonical(quads);
      await serializer.serializeCanonical(quads);
      
      const stats = serializer.getStatistics();
      assert(stats.historySize >= 2);
    });
  });
});

export default {
  description: 'Canonical Turtle Serializer Tests',
  testCount: 20,
  categories: [
    'initialization',
    'canonical-ordering', 
    'blank-nodes',
    'prefix-optimization',
    'integrity-verification',
    'performance',
    'enterprise-features'
  ]
};