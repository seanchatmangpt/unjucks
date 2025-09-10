/**
 * RDF Core Processor Tests
 * 
 * Comprehensive tests for the core RDF processor functionality
 * Tests N3.js integration, SPARQL-like queries, and template integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RDFProcessor, createRDFProcessor } from '../../src/core/rdf.js';
import { RDFTemplateIntegration } from '../../src/core/rdf-template-integration.js';

describe('RDF Core Processor', () => {
  let processor;

  beforeEach(() => {
    processor = createRDFProcessor({
      baseUri: 'http://example.org/',
      enableCache: true
    });
  });

  afterEach(() => {
    processor?.destroy();
  });

  describe('Basic RDF Processing', () => {
    it('should create processor with default configuration', () => {
      expect(processor).toBeDefined();
      expect(processor.store).toBeDefined();
      expect(processor.parser).toBeDefined();
      expect(processor.filters).toBeDefined();
    });

    it('should load inline Turtle data', async () => {
      const turtleData = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:john a foaf:Person ;
  foaf:name "John Doe" ;
  foaf:email "john@example.com" .
`;

      const result = await processor.loadData(turtleData);
      
      expect(result.success).toBe(true);
      expect(result.triples).toBeDefined();
      expect(result.triples.length).toBeGreaterThan(0);
      
      const stats = processor.getStoreStats();
      expect(stats.tripleCount).toBeGreaterThan(0);
    });

    it('should handle structured data source', async () => {
      const source = {
        type: 'inline',
        content: `
@prefix schema: <https://schema.org/> .

<http://example.org/person/1> a schema:Person ;
  schema:name "Alice Smith" ;
  schema:email "alice@example.com" .
`
      };

      const result = await processor.loadData(source);
      expect(result.success).toBe(true);
      expect(result.triples.length).toBe(3); // type, name, email
    });
  });

  describe('SPARQL-like Query Engine', () => {
    beforeEach(async () => {
      const testData = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix schema: <https://schema.org/> .

ex:john a foaf:Person ;
  foaf:name "John Doe" ;
  foaf:email "john@example.com" .

ex:alice a schema:Person ;
  schema:name "Alice Smith" ;
  schema:email "alice@example.com" .
`;
      await processor.loadData(testData);
    });

    it('should execute simple pattern queries', () => {
      const results = processor.query([{
        subject: '?person',
        predicate: 'foaf:name',
        object: null
      }]);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Check that we have bindings for ?person
      const firstResult = results[0];
      expect(firstResult.has('person')).toBe(true);
    });

    it('should handle multiple patterns', () => {
      const results = processor.query([
        {
          subject: '?person',
          predicate: 'rdf:type',
          object: 'foaf:Person'
        },
        {
          subject: '?person',
          predicate: 'foaf:name',
          object: '?name'
        }
      ]);

      expect(results.length).toBeGreaterThan(0);
      const firstResult = results[0];
      expect(firstResult.has('person')).toBe(true);
      expect(firstResult.has('name')).toBe(true);
    });

    it('should support optional patterns', () => {
      const results = processor.query([
        {
          subject: '?person',
          predicate: 'rdf:type',
          object: '?type'
        },
        {
          subject: '?person',
          predicate: 'foaf:phone',
          object: '?phone',
          optional: true
        }
      ]);

      // Should still return results even though phone is missing
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Entity Processing', () => {
    beforeEach(async () => {
      const testData = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:john a foaf:Person ;
  foaf:name "John Doe" ;
  foaf:email "john@example.com" ;
  rdfs:label "John Doe" ;
  rdfs:comment "A software developer" .
`;
      await processor.loadData(testData);
    });

    it('should extract entity information', () => {
      const entity = processor.getEntity('ex:john');
      
      expect(entity).toBeDefined();
      expect(entity.uri).toBe('http://example.org/john');
      expect(entity.types).toContain('http://xmlns.com/foaf/0.1/Person');
      expect(entity.label).toBe('John Doe');
      expect(entity.comment).toBe('A software developer');
      expect(entity.properties.name).toBeDefined();
      expect(entity.properties.email).toBeDefined();
    });

    it('should create template context', () => {
      const context = processor.createTemplateContext(['ex:john']);
      
      expect(context.entities).toBeDefined();
      expect(context.entities['http://example.org/john']).toBeDefined();
      expect(context.prefixes).toBeDefined();
      expect(context.stats).toBeDefined();
    });
  });

  describe('Template Filters Integration', () => {
    beforeEach(async () => {
      await processor.loadData(`
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:john a foaf:Person ;
  foaf:name "John Doe" .
`);
    });

    it('should provide template filters', () => {
      const filters = processor.getTemplateFilters();
      
      expect(filters.rdfLabel).toBeDefined();
      expect(filters.rdfType).toBeDefined();
      expect(filters.rdfQuery).toBeDefined();
      expect(filters.rdfExists).toBeDefined();
      
      // Test a filter
      const label = filters.rdfLabel('ex:john');
      expect(label).toBe('John Doe');
    });

    it('should register filters with mock Nunjucks environment', () => {
      const mockEnv = {
        addFilter: vi.fn(),
        addGlobal: vi.fn()
      };

      processor.registerFilters(mockEnv);
      
      expect(mockEnv.addFilter).toHaveBeenCalled();
      expect(mockEnv.addGlobal).toHaveBeenCalledWith('rdf', expect.any(Object));
    });
  });

  describe('Vocabulary Management', () => {
    it('should have default vocabularies registered', () => {
      const vocabularies = processor.getVocabularies();
      
      expect(vocabularies.has('schema.org')).toBe(true);
      expect(vocabularies.has('foaf')).toBe(true);
      expect(vocabularies.has('dublin-core')).toBe(true);
    });

    it('should provide default prefixes', () => {
      const prefixes = processor.getPrefixes();
      
      expect(prefixes.rdf).toBeDefined();
      expect(prefixes.rdfs).toBeDefined();
      expect(prefixes.schema).toBeDefined();
      expect(prefixes.foaf).toBeDefined();
    });
  });

  describe('Semantic Patterns Generation', () => {
    beforeEach(async () => {
      await processor.loadData(`
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:john a foaf:Person ;
  foaf:name "John Doe" .

ex:alice a foaf:Person ;
  foaf:name "Alice Smith" .
`);
    });

    it('should generate semantic patterns for memory storage', () => {
      const patterns = processor.generateSemanticPatterns();
      
      expect(patterns.timestamp).toBeDefined();
      expect(patterns.vocabularies).toBeDefined();
      expect(patterns.prefixes).toBeDefined();
      expect(patterns.stats).toBeDefined();
      expect(patterns.commonPatterns).toBeDefined();
      expect(patterns.entityTypes).toBeDefined();
      expect(patterns.propertyFrequency).toBeDefined();
    });

    it('should extract common patterns', () => {
      const patterns = processor.extractCommonPatterns();
      
      expect(Array.isArray(patterns)).toBe(true);
      if (patterns.length > 0) {
        expect(patterns[0].pattern).toBe('typeFrequency');
        expect(patterns[0].type).toBeDefined();
        expect(patterns[0].count).toBeGreaterThan(0);
      }
    });

    it('should extract entity types', () => {
      const entityTypes = processor.extractEntityTypes();
      
      expect(entityTypes.Person).toBeDefined();
      expect(entityTypes.Person.count).toBe(2);
      expect(entityTypes.Person.instances).toHaveLength(2);
    });
  });

  describe('Performance and Caching', () => {
    it('should cache query results', () => {
      const pattern = [{ subject: '?s', predicate: 'rdf:type', object: '?o' }];
      
      // First query
      const result1 = processor.query(pattern);
      
      // Second query (should be cached)
      const result2 = processor.query(pattern);
      
      expect(result1).toEqual(result2);
    });

    it('should clear caches', () => {
      processor.query([{ subject: '?s', predicate: '?p', object: '?o' }]);
      processor.clearCache();
      
      // Cache should be empty but this is hard to test directly
      // Just ensure no errors occur
      expect(() => processor.clearCache()).not.toThrow();
    });

    it('should export Turtle serialization', () => {
      const turtle = processor.exportTurtle();
      expect(typeof turtle).toBe('string');
    });
  });
});

describe('RDF Template Integration', () => {
  let integration;

  beforeEach(() => {
    integration = new RDFTemplateIntegration({
      enableCache: true,
      defaultVocabularies: ['schema.org']
    });
  });

  afterEach(() => {
    integration?.destroy();
  });

  describe('RDF Configuration Processing', () => {
    it('should process RDF configuration from frontmatter', async () => {
      const rdfConfig = {
        rdf: [{
          type: 'inline',
          content: `
@prefix schema: <https://schema.org/> .

<http://example.org/person/1> a schema:Person ;
  schema:name "Test Person" .
`
        }],
        enableFilters: true
      };

      const templateVars = { name: 'test' };
      const enhancedContext = await integration.processRDFConfig(rdfConfig, templateVars);

      expect(enhancedContext.name).toBe('test'); // Original var preserved
      expect(enhancedContext.rdf).toBeDefined();
      expect(enhancedContext.rdf.processor).toBeDefined();
      expect(enhancedContext.rdf.stats).toBeDefined();
    });

    it('should handle semantic variable mappings', async () => {
      const rdfConfig = {
        rdf: [{
          type: 'inline',
          content: `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:john a foaf:Person ;
  foaf:name "John Doe" .
`
        }],
        semanticVars: {
          person: {
            type: 'entity',
            uri: 'ex:john'
          }
        }
      };

      const context = await integration.processRDFConfig(rdfConfig, {});
      
      expect(context.entities.person).toBeDefined();
      expect(context.entities.person.uri).toBe('http://example.org/john');
    });

    it('should auto-extract entities from template variables', async () => {
      await integration.processor.loadData(`
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:john a foaf:Person ;
  foaf:name "John Doe" .
`);

      const templateVars = {
        person: 'ex:john',
        regularVar: 'test'
      };

      const context = await integration.processRDFConfig({}, templateVars);
      
      // Should auto-detect ex:john as an entity
      expect(context.entities.person).toBeDefined();
      expect(context.regularVar).toBe('test');
    });
  });

  describe('Vocabulary Loading', () => {
    it('should load Schema.org subset', async () => {
      await integration.loadSchemaOrgSubset();
      
      const stats = integration.processor.getStoreStats();
      expect(stats.tripleCount).toBeGreaterThan(0);
      
      // Should have Person class
      const entity = integration.processor.getEntity('schema:Person');
      expect(entity).toBeDefined();
      expect(entity.label).toBe('Person');
    });

    it('should load FOAF vocabulary subset', async () => {
      await integration.loadFOAFVocabulary();
      
      const stats = integration.processor.getStoreStats();
      expect(stats.tripleCount).toBeGreaterThan(0);
      
      // Should have Person class
      const entity = integration.processor.getEntity('foaf:Person');
      expect(entity).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should cache entity lookups', async () => {
      await integration.processor.loadData(`
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:john a foaf:Person ;
  foaf:name "John Doe" .
`);

      const entity1 = await integration.getEntityWithCache('ex:john');
      const entity2 = await integration.getEntityWithCache('ex:john');
      
      expect(entity1).toEqual(entity2);
      expect(integration.entityCache.size).toBe(1);
    });

    it('should provide integration statistics', () => {
      const stats = integration.getStats();
      
      expect(stats.rdfProcessor).toBeDefined();
      expect(stats.entityCache).toBeDefined();
      expect(stats.vocabularies).toBeDefined();
    });
  });
});