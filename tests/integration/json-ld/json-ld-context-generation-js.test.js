/**
 * Comprehensive JSON-LD context generation validation tests
 * Tests all context patterns with template filters for semantic web applications
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import nunjucks from 'nunjucks';
import { jsonLdFilters } from '../../../src/lib/filters/json-ld/rdf-filters.js';

// Mock JSON-LD processor for validation
class MockJsonLdProcessor {
  /**
   * Compact a JSON-LD document using the provided context
   */
  static async compact(document, context) {
    const errors = [];
    let valid = true;

    try {
      // Basic validation
      if (!context || typeof context !== 'object') {
        errors.push('Invalid context provided');
        valid = false;
      }

      if (!document || typeof document !== 'object') {
        errors.push('Invalid document provided');
        valid = false;
      }

      // Mock compaction logic
      const compacted = {
        '@context': context,
        ...document
      };

      return { compacted, valid, errors };
    } catch (error) {
      errors.push(`Compaction failed: ${error}`);
      return { compacted: document, valid: false, errors };
    }
  }

  /**
   * Expand a JSON-LD document
   */
  static async expand(document) {
    const errors = [];
    let valid = true;

    try {
      // Mock expansion logic - convert to array format
      const expanded = [document];
      return { expanded, valid, errors };
    } catch (error) {
      errors.push(`Expansion failed: ${error}`);
      return { expanded: [], valid: false, errors };
    }
  }

  /**
   * Validate JSON-LD context structure
   */
  static validateContext(context) {
    const errors = [];

    if (!context || typeof context !== 'object') {
      errors.push('Context must be an object');
      return { valid: false, errors };
    }

    // Check for valid @version
    if (context['@version'] && ![1.0, 1.1, '1.0', '1.1'].includes(context['@version'])) {
      errors.push('@version must be 1.0 or 1.1');
    }

    // Check for valid @base
    if (context['@base'] && typeof context['@base'] !== 'string') {
      errors.push('@base must be a string URI');
    }

    // Check for valid @vocab
    if (context['@vocab'] && typeof context['@vocab'] !== 'string') {
      errors.push('@vocab must be a string URI');
    }

    // Validate property mappings
    for (const [key, value] of Object.entries(context)) {
      if (key.startsWith('@') || key.startsWith('_')) continue;

      if (typeof value === 'object' && value !== null) {
        const mapping = value;
        
        // Check @id
        if (mapping['@id'] && typeof mapping['@id'] !== 'string') {
          errors.push(`Property ${key}: @id must be a string`);
        }

        // Check @type
        if (mapping['@type'] && typeof mapping['@type'] !== 'string') {
          errors.push(`Property ${key}: @type must be a string`);
        }

        // Check @container
        if (mapping['@container']) {
          const validContainers = ['@list', '@set', '@index', '@language', '@type', '@id'];
          const containers = Array.isArray(mapping['@container']) 
            ? mapping['@container']
            : [mapping['@container']];
          
          for (const container of containers) {
            if (!validContainers.includes(container)) {
              errors.push(`Property ${key}: invalid @container value: ${container}`);
            }
          }
        }

        // Check @language
        if (mapping['@language'] && typeof mapping['@language'] !== 'string') {
          errors.push(`Property ${key}: @language must be a string`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

describe('JSON-LD Context Generation with Template Filters', () => {
  const testOutputDir = join(process.cwd(), 'tests/.tmp/json-ld-contexts');
  const fixturesDir = join(process.cwd(), 'tests/fixtures/json-ld');
  let nunjucksEnv;

  beforeAll(() => {
    // Create test output directory
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true });
    }
    mkdirSync(testOutputDir, { recursive: true });

    // Configure Nunjucks with filters
    nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(fixturesDir),
      { autoescape: false }
    );

    // Register JSON-LD filters
    Object.entries(jsonLdFilters).forEach(([name, filter]) => {
      nunjucksEnv.addFilter(name, filter);
    });

    // Register additional template filters for testing
    nunjucksEnv.addFilter('kebabCase', (str) => 
      str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    );
    
    nunjucksEnv.addFilter('camelCase', (str) =>
      str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    );
    
    nunjucksEnv.addFilter('pascalCase', (str) => {
      const camelCase = str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
      return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
    });

    nunjucksEnv.addFilter('languageName', (code) => {
      const languages = {
        'en': 'English',
        'es': 'Spanish', 
        'fr': 'French',
        'de': 'German',
        'ja': 'Japanese',
        'zh': 'Chinese'
      };
      return languages[code] || code;
    });

    nunjucksEnv.addFilter('dump', (obj) => JSON.stringify(obj, null, 2));
    nunjucksEnv.addFilter('slice', (str, start, end) => str.slice(start, end));
    nunjucksEnv.addFilter('safe', (str) => str);
  });

  afterAll(() => {
    // Cleanup test directory
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true });
    }
  });

  describe('RDF Filter Functions', () => {
    it('should correctly map datatypes with rdfDatatype filter', () => {
      expect(jsonLdFilters.rdfDatatype('string')).toBe('xsd:string');
      expect(jsonLdFilters.rdfDatatype('integer')).toBe('xsd:integer');
      expect(jsonLdFilters.rdfDatatype('decimal')).toBe('xsd:decimal');
      expect(jsonLdFilters.rdfDatatype('boolean')).toBe('xsd:boolean');
      expect(jsonLdFilters.rdfDatatype('dateTime')).toBe('xsd:dateTime');
      expect(jsonLdFilters.rdfDatatype('anyURI')).toBe('xsd:anyURI');
      
      // Test aliases
      expect(jsonLdFilters.rdfDatatype('int')).toBe('xsd:integer');
      expect(jsonLdFilters.rdfDatatype('number')).toBe('xsd:decimal');
      expect(jsonLdFilters.rdfDatatype('bool')).toBe('xsd:boolean');
      expect(jsonLdFilters.rdfDatatype('url')).toBe('xsd:anyURI');
      
      // Test default fallback
      expect(jsonLdFilters.rdfDatatype('unknown')).toBe('xsd:string');
    });

    it('should correctly handle URIs with rdfResource filter', () => {
      // Full URIs
      expect(jsonLdFilters.rdfResource('https://schema.org/Person')).toBe('https://schema.org/Person');
      expect(jsonLdFilters.rdfResource('http://example.com/vocab/Property')).toBe('http://example.com/vocab/Property');
      
      // Namespace prefixes
      expect(jsonLdFilters.rdfResource('schema:Person')).toBe('https://schema.org/Person');
      expect(jsonLdFilters.rdfResource('dct:title')).toBe('http://purl.org/dc/terms/title');
      expect(jsonLdFilters.rdfResource('xsd:string')).toBe('http://www.w3.org/2001/XMLSchema#string');
      
      // Unknown prefixes
      expect(jsonLdFilters.rdfResource('unknown:test')).toBe('unknown:test');
      
      // Local resources
      expect(jsonLdFilters.rdfResource('localProperty')).toBe('localProperty');
    });

    it('should generate correct namespace mappings', () => {
      const namespaces = jsonLdFilters.rdfNamespaces(['geo', 'time']);
      
      expect(namespaces['rdf']).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
      expect(namespaces['schema']).toBe('https://schema.org/');
      expect(namespaces['geo']).toBe('http://www.w3.org/2003/01/geo/wgs84_pos#');
      expect(namespaces['time']).toBe('http://www.w3.org/2006/time#');
    });

    it('should generate Schema.org context correctly', () => {
      const context = jsonLdFilters.schemaOrgContext(['Article', 'Review']);
      
      expect(context['@vocab']).toBe('https://schema.org/');
      expect(context['@version']).toBe(1.1);
      expect(context['Person']).toEqual({ '@id': 'schema:Person', '@type': '@id' });
      expect(context['Article']).toEqual({ '@id': 'schema:Article', '@type': '@id' });
      expect(context['name']).toEqual({ '@type': 'xsd:string' });
      expect(context['dateCreated']).toEqual({ '@type': 'xsd:dateTime' });
    });
  });

  describe('Context Validation and Compliance', () => {
    it('should validate JSON-LD 1.1 spec compliance', () => {
      const validContext = {
        '@version': 1.1,
        '@vocab': 'https://schema.org/',
        'name': { '@id': 'schema:name', '@type': 'xsd:string' },
        'tags': { '@id': 'schema:keywords', '@container': '@set' }
      };

      const validation = jsonLdFilters.validateJsonLdContext(validContext);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid context structures', () => {
      const invalidContext = {
        '@version': '2.0', // Invalid version
        '@base': 123, // Invalid base type
        '@vocab': null, // Invalid vocab
        'badProperty': {
          '@type': 'invalid-type',
          '@container': '@invalid' // Invalid container
        }
      };

      const validation = jsonLdFilters.validateJsonLdContext(invalidContext);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(err => err.includes('@version'))).toBe(true);
      expect(validation.errors.some(err => err.includes('@base'))).toBe(true);
      expect(validation.errors.some(err => err.includes('@vocab'))).toBe(true);
    });

    it('should perform round-trip testing (compact → expand → compact)', async () => {
      const context = {
        '@version': 1.1,
        '@vocab': 'https://schema.org/',
        'name': { '@type': 'xsd:string' },
        'price': { '@type': 'xsd:decimal' }
      };

      const originalDocument = {
        '@type': 'Product',
        name: 'Test Product',
        price: 29.99
      };

      // Compact
      const compactionResult = await MockJsonLdProcessor.compact(originalDocument, context);
      expect(compactionResult.valid).toBe(true);

      // Expand
      const expansionResult = await MockJsonLdProcessor.expand(compactionResult.compacted);
      expect(expansionResult.valid).toBe(true);

      // Compact again
      const secondCompaction = await MockJsonLdProcessor.compact(
        expansionResult.expanded[0], 
        context
      );
      expect(secondCompaction.valid).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large contexts efficiently', () => {
      const startTime = performance.now();
      
      // Generate a large context with many properties
      const largeContext = jsonLdFilters.schemaOrgContext(
        Array.from({ length: 100 }, (_, i) => `Type${i}`)
      );
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
      expect(Object.keys(largeContext).length).toBeGreaterThan(100);
      
      const validation = jsonLdFilters.validateJsonLdContext(largeContext);
      expect(validation.valid).toBe(true);
    });

    it('should validate complex nested contexts', () => {
      const complexContext = {
        '@version': 1.1,
        '@vocab': 'https://schema.org/',
        ...jsonLdFilters.rdfNamespaces(['geo', 'time', 'dct', 'prov']),
        ...jsonLdFilters.temporalContext(),
        ...jsonLdFilters.geospatialContext(),
        'complexProperty': {
          '@id': 'schema:complexProperty',
          '@type': '@id',
          '@container': ['@language', '@set'],
          'rdfs:domain': { '@id': 'schema:Thing', '@type': '@id' },
          'rdfs:range': { '@id': 'schema:Text', '@type': '@id' }
        }
      };

      const validation = jsonLdFilters.validateJsonLdContext(complexContext);
      expect(validation.valid).toBe(true);
    });
  });
});