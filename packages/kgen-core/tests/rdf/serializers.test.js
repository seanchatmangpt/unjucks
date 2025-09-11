/**
 * Test suite for RDFSerializers module
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RDFSerializers } from '../../src/rdf/serializers.js';
import { DataFactory } from 'n3';

const { namedNode, literal, blankNode, quad, defaultGraph } = DataFactory;

describe('RDFSerializers', () => {
  let serializers;

  beforeEach(() => {
    serializers = new RDFSerializers({
      prettyPrint: true,
      deterministic: true,
      includeComments: false
    });
  });

  describe('Basic Serialization', () => {
    it('should serialize to Turtle format', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const result = await serializers.serialize(quads, 'turtle');
      
      expect(result).toContain('<http://example.org/s>');
      expect(result).toContain('<http://example.org/p>');
      expect(result).toContain('"test"');
    });

    it('should serialize to N-Triples format', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const result = await serializers.serialize(quads, 'ntriples');
      
      expect(result).toContain('<http://example.org/s>');
      expect(result).toContain('<http://example.org/p>');
      expect(result).toContain('"test"');
      expect(result).toMatch(/\s+\./); // N-Triples format
    });

    it('should serialize to N-Quads format', async () => {
      const quads = [
        quad(
          namedNode('http://example.org/s'), 
          namedNode('http://example.org/p'), 
          literal('test'),
          namedNode('http://example.org/graph')
        )
      ];

      const result = await serializers.serialize(quads, 'nquads');
      
      expect(result).toContain('<http://example.org/graph>');
    });

    it('should serialize to JSON-LD format', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const result = await serializers.serialize(quads, 'jsonld');
      
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('@context');
      expect(parsed).toHaveProperty('@graph');
    });

    it('should serialize to canonical format', async () => {
      const quads = [
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('test2')),
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('test1'))
      ];

      const result = await serializers.serialize(quads, 'canonical');
      
      expect(result).toContain('<http://example.org/s1>');
      expect(result).toContain('<http://example.org/s2>');
      
      // Should be deterministically ordered
      const lines = result.split('\n');
      expect(lines[0]).toContain('s1');
      expect(lines[1]).toContain('s2');
    });
  });

  describe('Deterministic Serialization', () => {
    it('should produce identical output for same graph', async () => {
      const quads = [
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('test2')),
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('test1'))
      ];

      const result1 = await serializers.serialize(quads, 'canonical');
      const result2 = await serializers.serialize(quads, 'canonical');
      
      expect(result1).toBe(result2);
    });

    it('should canonicalize quad order', async () => {
      const quads1 = [
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('test1')),
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('test2'))
      ];
      const quads2 = [
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('test2')),
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('test1'))
      ];

      const result1 = await serializers.serialize(quads1, 'canonical');
      const result2 = await serializers.serialize(quads2, 'canonical');
      
      expect(result1).toBe(result2);
    });

    it('should handle blank nodes deterministically', async () => {
      const quads1 = [
        quad(blankNode('b1'), namedNode('http://example.org/p'), literal('test1')),
        quad(blankNode('b2'), namedNode('http://example.org/p'), literal('test2'))
      ];
      const quads2 = [
        quad(blankNode('x1'), namedNode('http://example.org/p'), literal('test1')),
        quad(blankNode('x2'), namedNode('http://example.org/p'), literal('test2'))
      ];

      const result1 = await serializers.serialize(quads1, 'canonical');
      const result2 = await serializers.serialize(quads2, 'canonical');
      
      expect(result1).toBe(result2);
    });
  });

  describe('Hash Calculation', () => {
    it('should calculate hash for serialized content', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const hash = await serializers.calculateHash(quads);
      
      expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex format
    });

    it('should produce consistent hashes', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const hash1 = await serializers.calculateHash(quads);
      const hash2 = await serializers.calculateHash(quads);
      
      expect(hash1).toBe(hash2);
    });

    it('should support different hash algorithms', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const sha256Hash = await serializers.calculateHash(quads, 'canonical', { algorithm: 'sha256' });
      const sha1Hash = await serializers.calculateHash(quads, 'canonical', { algorithm: 'sha1' });
      
      expect(sha256Hash).toHaveLength(64);
      expect(sha1Hash).toHaveLength(40);
      expect(sha256Hash).not.toBe(sha1Hash);
    });
  });

  describe('Content Identifiers', () => {
    it('should create content-addressed identifiers', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const contentId = await serializers.createContentId(quads);
      
      expect(contentId).toMatch(/^kgen:v1:/);
    });

    it('should create content IDs with custom options', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const contentId = await serializers.createContentId(quads, {
        prefix: 'custom',
        version: 'v2'
      });
      
      expect(contentId).toMatch(/^custom:v2:/);
    });
  });

  describe('Integrity Verification', () => {
    it('should verify serialized data integrity', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const serialized = await serializers.serialize(quads, 'canonical');
      const hash = await serializers.calculateHash(quads);
      
      const isValid = serializers.verifyIntegrity(serialized, hash);
      
      expect(isValid).toBe(true);
    });

    it('should detect integrity violations', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const serialized = await serializers.serialize(quads, 'canonical');
      const wrongHash = 'wrong_hash_value';
      
      const isValid = serializers.verifyIntegrity(serialized, wrongHash);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Diff Creation', () => {
    it('should create diff between two serializations', async () => {
      const quads1 = [
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('test1'))
      ];
      const quads2 = [
        quad(namedNode('http://example.org/s1'), namedNode('http://example.org/p'), literal('test1')),
        quad(namedNode('http://example.org/s2'), namedNode('http://example.org/p'), literal('test2'))
      ];

      const serialized1 = await serializers.serialize(quads1, 'canonical');
      const serialized2 = await serializers.serialize(quads2, 'canonical');
      
      const diff = serializers.createDiff(serialized1, serialized2);
      
      expect(diff.added).toBe(1);
      expect(diff.removed).toBe(0);
      expect(diff.common).toBe(1);
      expect(diff.identical).toBe(false);
    });

    it('should detect identical serializations', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const serialized1 = await serializers.serialize(quads, 'canonical');
      const serialized2 = await serializers.serialize(quads, 'canonical');
      
      const diff = serializers.createDiff(serialized1, serialized2);
      
      expect(diff.identical).toBe(true);
      expect(diff.added).toBe(0);
      expect(diff.removed).toBe(0);
    });
  });

  describe('Format Detection', () => {
    it('should detect format from MIME type', () => {
      expect(serializers.detectFormatFromMimeType('text/turtle')).toBe('turtle');
      expect(serializers.detectFormatFromMimeType('application/n-triples')).toBe('ntriples');
      expect(serializers.detectFormatFromMimeType('application/ld+json')).toBe('jsonld');
      expect(serializers.detectFormatFromMimeType('application/rdf+xml')).toBe('rdfxml');
    });

    it('should return null for unknown MIME types', () => {
      expect(serializers.detectFormatFromMimeType('unknown/type')).toBe(null);
    });

    it('should list supported formats', () => {
      const formats = serializers.getSupportedFormats();
      
      expect(formats).toContain('turtle');
      expect(formats).toContain('ntriples');
      expect(formats).toContain('jsonld');
      expect(formats).toContain('canonical');
    });
  });

  describe('Serialization Options', () => {
    it('should include prefixes in serialization', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];
      const prefixes = { ex: 'http://example.org/' };

      const result = await serializers.serialize(quads, 'turtle', { prefixes });
      
      expect(result).toContain('@prefix ex:');
    });

    it('should support pretty printing option', async () => {
      const serializers = new RDFSerializers({ prettyPrint: true });
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const result = await serializers.serialize(quads, 'jsonld');
      
      // Pretty printed JSON should contain newlines and indentation
      expect(result).toContain('\n');
    });

    it('should support header comments', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const result = await serializers.serialize(quads, 'turtle', { 
        includeComments: true,
        header: 'Test RDF Graph'
      });
      
      expect(result).toContain('# Test RDF Graph');
    });
  });

  describe('RDF/XML Serialization', () => {
    it('should serialize to RDF/XML format', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const result = await serializers.serialize(quads, 'rdfxml');
      
      expect(result).toContain('<?xml version="1.0"');
      expect(result).toContain('<rdf:RDF');
      expect(result).toContain('<rdf:Description');
    });

    it('should handle RDF/XML namespaces', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];
      const prefixes = { ex: 'http://example.org/' };

      const result = await serializers.serialize(quads, 'rdfxml', { prefixes });
      
      expect(result).toContain('xmlns:ex="http://example.org/"');
    });
  });

  describe('Error Handling', () => {
    it('should handle unsupported formats gracefully', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      await expect(serializers.serialize(quads, 'unsupported'))
        .rejects
        .toThrow(/Unsupported serialization format/);
    });

    it('should handle empty quad arrays', async () => {
      const result = await serializers.serialize([], 'turtle');
      
      expect(typeof result).toBe('string');
    });
  });

  describe('Literal Handling', () => {
    it('should handle language-tagged literals', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), 
              literal('Hello', 'en'))
      ];

      const result = await serializers.serialize(quads, 'canonical');
      
      expect(result).toContain('"Hello"@en');
    });

    it('should handle datatype literals', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), 
              literal('42', namedNode('http://www.w3.org/2001/XMLSchema#integer')))
      ];

      const result = await serializers.serialize(quads, 'canonical');
      
      expect(result).toContain('^^<http://www.w3.org/2001/XMLSchema#integer>');
    });

    it('should escape special characters in literals', async () => {
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), 
              literal('Text with "quotes" and \n newlines'))
      ];

      const result = await serializers.serialize(quads, 'canonical');
      
      expect(result).toContain('\\"'); // Escaped quotes
      expect(result).toContain('\\n'); // Escaped newlines
    });
  });

  describe('Compression Options', () => {
    it('should support whitespace compression', async () => {
      const serializers = new RDFSerializers({ compression: 'whitespace' });
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const result = await serializers.serialize(quads, 'turtle');
      
      // Compressed output should have minimal whitespace
      expect(result.split('\n').length).toBe(1);
    });

    it('should support minimal compression', async () => {
      const serializers = new RDFSerializers({ compression: 'minimal' });
      const quads = [
        quad(namedNode('http://example.org/s'), namedNode('http://example.org/p'), literal('test'))
      ];

      const result = await serializers.serialize(quads, 'turtle');
      
      expect(result).toBeDefined();
    });
  });
});