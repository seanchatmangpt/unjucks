import { describe, it, expect, beforeEach } from 'vitest';
import { Store, Parser, DataFactory } from 'n3';
import RDFFilters, { createRDFFilters, registerRDFFilters } from '../../src/lib/rdf-filters.js';

const { namedNode, literal, quad } = DataFactory;

describe('RDF Filters', () => {
  let store;
  let rdfFilters;
  let sampleTurtleData;

  beforeEach(() => {
    store = new Store();
    
    // Sample RDF data for testing
    sampleTurtleData = `
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix ex: <http://example.org/> .
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .

      ex:john rdf:type foaf:Person ;
              rdfs:label "John Doe" ;
              foaf:age "30"^^<http://www.w3.org/2001/XMLSchema#integer> .
      
      ex:jane rdf:type foaf:Person ;
              rdfs:label "Jane Smith" ;
              foaf:name "Jane Smith" ;
              skos:prefLabel "Jane" .
      
      ex:company rdf:type foaf:Organization ;
                 rdfs:label "Example Corp" .
    `;
    
    // Parse the turtle data into the store
    const parser = new Parser();
    const quads = parser.parse(sampleTurtleData);
    store.addQuads(quads);
    
    // Create RDF filters instance
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
        const subjects = rdfFilters.rdfSubject('rdf:type', 'foaf:Animal');
        
        expect(subjects).toHaveLength(0);
      });
    });

    describe('rdfObject', () => {
      it('should find objects for given subject-predicate pair', () => {
        const objects = rdfFilters.rdfObject('ex:john', 'rdfs:label');
        
        expect(objects).toHaveLength(1);
        expect(objects[0].value).toBe('John Doe');
        expect(objects[0].type).toBe('literal');
      });

      it('should return empty array for non-existent subject-predicate pair', () => {
        const objects = rdfFilters.rdfObject('ex:nonexistent', 'rdfs:label');
        
        expect(objects).toHaveLength(0);
      });
    });

    describe('rdfLabel', () => {
      it('should return rdfs:label', () => {
        const label = rdfFilters.rdfLabel('ex:john');
        
        expect(label).toBe('John Doe');
      });

      it('should fallback to local name for resources without labels', () => {
        const label = rdfFilters.rdfLabel('http://example.org/unlabeled');
        
        expect(label).toBe('unlabeled');
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
    });
  });

  describe('Factory and Registration Functions', () => {
    it('should create filters with factory function', () => {
      const filters = createRDFFilters({ store });
      
      expect(filters).toHaveProperty('rdfSubject');
      expect(filters).toHaveProperty('rdfObject');
      expect(typeof filters.rdfSubject).toBe('function');
    });

    it('should register filters with Nunjucks environment', () => {
      const mockNunjucksEnv = {
        addedFilters: {},
        addFilter: function(name, filter) {
          this.addedFilters[name] = filter;
        }
      };

      registerRDFFilters(mockNunjucksEnv, { store });

      expect(mockNunjucksEnv.addedFilters).toHaveProperty('rdfSubject');
      expect(typeof mockNunjucksEnv.addedFilters.rdfSubject).toBe('function');
    });
  });
});