import { describe, it, expect, beforeEach } from 'vitest';
import { Store, Parser, DataFactory } from 'n3';
import type { Quad } from 'n3';
import RDFFilters, { createRDFFilters, registerRDFFilters, type RDFFilterOptions } from '../../src/lib/rdf-filters.js';

const { namedNode, literal, quad } = DataFactory;

describe('RDF Filters', () => {
  let store: Store;
  let rdfFilters: RDFFilters;
  let sampleTurtleData: string;

  beforeEach(() => {
    store = new Store();
    
    // Sample RDF data for testing
    sampleTurtleData = `
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix ex: <http://example.org/> .

      ex:john rdf:type foaf:Person ;
              rdfs:label "John Doe" ;
              foaf:name "John Doe" ;
              foaf:age 30 ;
              foaf:homepage <http://johndoe.com> .

      ex:jane rdf:type foaf:Person ;
              rdfs:label "Jane Smith" ;
              foaf:name "Jane Smith" ;
              skos:prefLabel "Jane S." ;
              foaf:age 25 .

      ex:company rdf:type foaf:Organization ;
                 rdfs:label "Test Company" ;
                 foaf:homepage <http://testcompany.com> .

      ex:book rdf:type ex:Book ;
              rdfs:label "Sample Book" ;
              ex:author ex:john ;
              ex:isbn "978-0123456789" .
    `;

    // Parse sample data
    const parser = new Parser();
    const quads = parser.parse(sampleTurtleData);
    store.addQuads(quads);

    rdfFilters = new RDFFilters({ store });
  });

  describe('Core Filter Functions', () => {
    describe('rdfSubject', () => {
      it('should find subjects with given predicate-object pair', () => {
        const subjects = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
        expect(subjects).toHaveLength(2);
        expect(subjects).toContain('http://example.org/john');
        expect(subjects).toContain('http://example.org/jane');
      });

      it('should return empty array for non-existent predicate-object pair', () => {
        const subjects = rdfFilters.rdfSubject('rdf:type', 'ex:NonExistent');
        expect(subjects).toHaveLength(0);
      });

      it('should handle full URIs', () => {
        const subjects = rdfFilters.rdfSubject(
          'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
          'http://xmlns.com/foaf/0.1/Person'
        );
        expect(subjects).toHaveLength(2);
      });
    });

    describe('rdfObject', () => {
      it('should find objects for given subject-predicate pair', () => {
        const objects = rdfFilters.rdfObject('ex:john', 'foaf:age');
        expect(objects).toHaveLength(1);
        expect(objects[0].value).toBe('30');
        expect(objects[0].type).toBe('literal');
      });

      it('should return URI objects correctly', () => {
        const objects = rdfFilters.rdfObject('ex:john', 'foaf:homepage');
        expect(objects).toHaveLength(1);
        expect(objects[0].value).toBe('http://johndoe.com');
        expect(objects[0].type).toBe('uri');
      });

      it('should return empty array for non-existent subject-predicate pair', () => {
        const objects = rdfFilters.rdfObject('ex:nonexistent', 'foaf:name');
        expect(objects).toHaveLength(0);
      });
    });

    describe('rdfPredicate', () => {
      it('should find predicates connecting subject and object', () => {
        const predicates = rdfFilters.rdfPredicate('ex:john', 'foaf:Person');
        expect(predicates).toContain('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
      });

      it('should find multiple predicates for literal values', () => {
        const predicates = rdfFilters.rdfPredicate('ex:john', '"John Doe"');
        expect(predicates.length).toBeGreaterThan(0);
      });

      it('should return empty array for non-connected subject-object pair', () => {
        const predicates = rdfFilters.rdfPredicate('ex:john', 'ex:company');
        expect(predicates).toHaveLength(0);
      });
    });

    describe('rdfQuery', () => {
      it('should execute pattern queries with object interface', () => {
        const results = rdfFilters.rdfQuery({
          subject: null,
          predicate: 'rdf:type',
          object: 'foaf:Person'
        });
        expect(results).toHaveLength(2);
        
        results.forEach(result => {
          expect(result).toHaveLength(3); // subject, predicate, object
          expect(result[1].value).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
          expect(result[2].value).toBe('http://xmlns.com/foaf/0.1/Person');
        });
      });

      it('should parse simple pattern strings', () => {
        const results = rdfFilters.rdfQuery('?s rdf:type foaf:Person');
        expect(results).toHaveLength(2);
      });

      it('should handle specific subject queries', () => {
        const results = rdfFilters.rdfQuery({
          subject: 'ex:john',
          predicate: null,
          object: null
        });
        expect(results.length).toBeGreaterThan(0);
        
        results.forEach(result => {
          expect(result[0].value).toBe('http://example.org/john');
        });
      });

      it('should return empty array for non-matching patterns', () => {
        const results = rdfFilters.rdfQuery('?s rdf:type ex:NonExistent');
        expect(results).toHaveLength(0);
      });
    });

    describe('rdfLabel', () => {
      it('should return rdfs:label when available', () => {
        const label = rdfFilters.rdfLabel('ex:john');
        expect(label).toBe('John Doe');
      });

      it('should fallback to skos:prefLabel', () => {
        const label = rdfFilters.rdfLabel('ex:jane');
        // Should return rdfs:label first, then skos:prefLabel
        expect(label).toBe('Jane Smith');
      });

      it('should fallback to local name for resources without labels', () => {
        const label = rdfFilters.rdfLabel('http://example.org/unlabeled');
        expect(label).toBe('unlabeled');
      });

      it('should handle foaf:name fallback', () => {
        // Create a resource with only foaf:name
        const testQuads = [
          quad(
            namedNode('http://example.org/test'),
            namedNode('http://xmlns.com/foaf/0.1/name'),
            literal('Test Name')
          )
        ];
        store.addQuads(testQuads);
        
        const label = rdfFilters.rdfLabel('ex:test');
        expect(label).toBe('Test Name');
      });
    });

    describe('rdfType', () => {
      it('should return all types for a resource', () => {
        const types = rdfFilters.rdfType('ex:john');
        expect(types).toContain('http://xmlns.com/foaf/0.1/Person');
      });

      it('should return empty array for resources without types', () => {
        const types = rdfFilters.rdfType('ex:nonexistent');
        expect(types).toHaveLength(0);
      });

      it('should handle multiple types', () => {
        // Add another type to john
        const additionalQuad = quad(
          namedNode('http://example.org/john'),
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://example.org/Employee')
        );
        store.addQuad(additionalQuad);
        
        const types = rdfFilters.rdfType('ex:john');
        expect(types.length).toBeGreaterThanOrEqual(2);
        expect(types).toContain('http://xmlns.com/foaf/0.1/Person');
        expect(types).toContain('http://example.org/Employee');
      });
    });

    describe('rdfNamespace', () => {
      it('should resolve known prefixes', () => {
        const namespace = rdfFilters.rdfNamespace('foaf');
        expect(namespace).toBe('http://xmlns.com/foaf/0.1/');
      });

      it('should return the prefix unchanged for unknown prefixes', () => {
        const namespace = rdfFilters.rdfNamespace('unknown');
        expect(namespace).toBe('unknown');
      });

      it('should handle all common prefixes', () => {
        expect(rdfFilters.rdfNamespace('rdf')).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
        expect(rdfFilters.rdfNamespace('rdfs')).toBe('http://www.w3.org/2000/01/rdf-schema#');
        expect(rdfFilters.rdfNamespace('owl')).toBe('http://www.w3.org/2002/07/owl#');
        expect(rdfFilters.rdfNamespace('skos')).toBe('http://www.w3.org/2004/02/skos/core#');
      });
    });

    describe('rdfGraph', () => {
      it('should return all triples when no graph specified', () => {
        const triples = rdfFilters.rdfGraph();
        expect(triples.length).toBeGreaterThan(0);
        
        triples.forEach(triple => {
          expect(triple).toHaveLength(3); // subject, predicate, object
          expect(triple[0]).toHaveProperty('value');
          expect(triple[0]).toHaveProperty('type');
        });
      });

      it('should filter by named graph', () => {
        // For this test, we'll add some quads to a named graph
        const namedGraph = namedNode('http://example.org/graph1');
        const graphQuad = quad(
          namedNode('http://example.org/graphResource'),
          namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
          literal('Graph Resource'),
          namedGraph
        );
        store.addQuad(graphQuad);
        
        const graphTriples = rdfFilters.rdfGraph('http://example.org/graph1');
        expect(graphTriples).toHaveLength(1);
        expect(graphTriples[0][0].value).toBe('http://example.org/graphResource');
      });
    });
  });

  describe('Additional Utility Filters', () => {
    describe('rdfExpand', () => {
      it('should expand prefixed URIs', () => {
        const expanded = rdfFilters.rdfExpand('foaf:Person');
        expect(expanded).toBe('http://xmlns.com/foaf/0.1/Person');
      });

      it('should return full URIs unchanged', () => {
        const uri = 'http://example.org/test';
        const expanded = rdfFilters.rdfExpand(uri);
        expect(expanded).toBe(uri);
      });

      it('should handle unknown prefixes gracefully', () => {
        const unknown = 'unknown:test';
        const expanded = rdfFilters.rdfExpand(unknown);
        expect(expanded).toBe(unknown);
      });
    });

    describe('rdfCompact', () => {
      it('should compact full URIs to prefixed form', () => {
        const compacted = rdfFilters.rdfCompact('http://xmlns.com/foaf/0.1/Person');
        expect(compacted).toBe('foaf:Person');
      });

      it('should return URIs without known prefixes unchanged', () => {
        const uri = 'http://unknown.example.org/test';
        const compacted = rdfFilters.rdfCompact(uri);
        expect(compacted).toBe(uri);
      });

      it('should handle all common vocabularies', () => {
        expect(rdfFilters.rdfCompact('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')).toBe('rdf:type');
        expect(rdfFilters.rdfCompact('http://www.w3.org/2000/01/rdf-schema#label')).toBe('rdfs:label');
        expect(rdfFilters.rdfCompact('http://www.w3.org/2004/02/skos/core#prefLabel')).toBe('skos:prefLabel');
      });
    });

    describe('rdfCount', () => {
      it('should count all triples when no parameters provided', () => {
        const count = rdfFilters.rdfCount();
        expect(count).toBeGreaterThan(0);
      });

      it('should count triples for specific subject', () => {
        const count = rdfFilters.rdfCount('ex:john');
        expect(count).toBeGreaterThan(0);
      });

      it('should count triples for specific predicate', () => {
        const count = rdfFilters.rdfCount(undefined, 'rdf:type');
        expect(count).toBeGreaterThan(0);
      });

      it('should count specific triple patterns', () => {
        const count = rdfFilters.rdfCount('ex:john', 'rdf:type', 'foaf:Person');
        expect(count).toBe(1);
      });

      it('should return 0 for non-existent patterns', () => {
        const count = rdfFilters.rdfCount('ex:nonexistent', 'rdf:type', 'foaf:Person');
        expect(count).toBe(0);
      });
    });

    describe('rdfExists', () => {
      it('should return true for existing resources', () => {
        const exists = rdfFilters.rdfExists('ex:john');
        expect(exists).toBe(true);
      });

      it('should return false for non-existent resources', () => {
        const exists = rdfFilters.rdfExists('ex:nonexistent');
        expect(exists).toBe(false);
      });

      it('should check specific property existence', () => {
        const exists = rdfFilters.rdfExists('ex:john', 'foaf:age');
        expect(exists).toBe(true);
      });

      it('should check specific triple existence', () => {
        const exists = rdfFilters.rdfExists('ex:john', 'rdf:type', 'foaf:Person');
        expect(exists).toBe(true);
      });

      it('should return false for non-existent triples', () => {
        const exists = rdfFilters.rdfExists('ex:john', 'rdf:type', 'ex:NonExistent');
        expect(exists).toBe(false);
      });
    });
  });

  describe('Factory and Registration Functions', () => {
    it('should create filters with factory function', () => {
      const filters = createRDFFilters({ store });
      
      expect(filters).toHaveProperty('rdfSubject');
      expect(filters).toHaveProperty('rdfObject');
      expect(filters).toHaveProperty('rdfPredicate');
      expect(filters).toHaveProperty('rdfQuery');
      expect(filters).toHaveProperty('rdfLabel');
      expect(filters).toHaveProperty('rdfType');
      expect(filters).toHaveProperty('rdfNamespace');
      expect(filters).toHaveProperty('rdfGraph');
      
      expect(typeof filters.rdfSubject).toBe('function');
      expect(typeof filters.rdfObject).toBe('function');
    });

    it('should register filters with Nunjucks environment', () => {
      const mockNunjucksEnv = {
        addedFilters: {} as Record<string, Function>,
        addFilter: function(name: string, filter: Function) {
          this.addedFilters[name] = filter;
        }
      };

      registerRDFFilters(mockNunjucksEnv, { store });

      expect(mockNunjucksEnv.addedFilters).toHaveProperty('rdfSubject');
      expect(mockNunjucksEnv.addedFilters).toHaveProperty('rdfObject');
      expect(mockNunjucksEnv.addedFilters).toHaveProperty('rdfQuery');
      expect(typeof mockNunjucksEnv.addedFilters.rdfSubject).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed URIs gracefully', () => {
      const results = rdfFilters.rdfSubject('malformed://uri', 'also::malformed');
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(0);
    });

    it('should handle null/undefined inputs', () => {
      expect(() => rdfFilters.rdfSubject('', '')).not.toThrow();
      expect(() => rdfFilters.rdfObject('', '')).not.toThrow();
      expect(() => rdfFilters.rdfLabel('')).not.toThrow();
    });

    it('should handle pattern parsing errors', () => {
      const results = rdfFilters.rdfQuery('invalid pattern');
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(0);
    });
  });

  describe('Integration with Real Template Usage', () => {
    it('should work like Nunjucks filters would be used', () => {
      // Simulate how these would be used in templates
      
      // {{ resource | rdfLabel }}
      const johnLabel = rdfFilters.rdfLabel('ex:john');
      expect(johnLabel).toBe('John Doe');
      
      // {{ resource | rdfType | length }}
      const johnTypes = rdfFilters.rdfType('ex:john');
      expect(johnTypes.length).toBe(1);
      
      // {{ 'foaf:Person' | rdfSubject }}
      const peopleSubjects = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
      expect(peopleSubjects.length).toBe(2);
      
      // {{ resource | rdfExists('foaf:age') }}
      const hasAge = rdfFilters.rdfExists('ex:john', 'foaf:age');
      expect(hasAge).toBe(true);
    });

    it('should chain filters like in real templates', () => {
      // {{ 'foaf' | rdfNamespace }}{{ 'Person' }}
      const foafNS = rdfFilters.rdfNamespace('foaf');
      const fullType = foafNS + 'Person';
      expect(fullType).toBe('http://xmlns.com/foaf/0.1/Person');
      
      // Then use that in another filter
      const subjects = rdfFilters.rdfSubject('rdf:type', fullType);
      expect(subjects.length).toBe(2);
    });
  });

  describe('Custom Prefixes and Options', () => {
    it('should accept custom prefixes in options', () => {
      const customPrefixes = {
        myorg: 'http://myorganization.org/',
        custom: 'http://custom.example.org/'
      };
      
      const customFilters = new RDFFilters({ 
        store,
        prefixes: customPrefixes 
      });
      
      expect(customFilters.rdfNamespace('myorg')).toBe('http://myorganization.org/');
      expect(customFilters.rdfNamespace('custom')).toBe('http://custom.example.org/');
      
      // Should still have default prefixes
      expect(customFilters.rdfNamespace('foaf')).toBe('http://xmlns.com/foaf/0.1/');
    });

    it('should use custom base URI', () => {
      const customFilters = new RDFFilters({
        store,
        baseUri: 'http://mybase.org/'
      });
      
      // This would be used for relative URI resolution
      expect(customFilters.rdfExpand('relative')).toBe('relative'); // No prefix, so unchanged
    });
  });
});