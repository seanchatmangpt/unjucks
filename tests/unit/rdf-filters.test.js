import { describe, it, expect, beforeEach } from 'vitest';
import { Store, Parser, DataFactory } from 'n3';
import RDFFilters, { createRDFFilters, registerRDFFilters, type RDFFilterOptions } from '../../src/lib/rdf-filters.js';

const { namedNode, literal, quad } = DataFactory;

describe('RDF Filters', () => { let store;
  let rdfFilters;
  let sampleTurtleData => {
    store = new Store();
    
    // Sample RDF data for testing
    sampleTurtleData = `
      @prefix rdf });
  });

  describe('Core Filter Functions', () => { describe('rdfSubject', () => {
      it('should find subjects with given predicate-object pair', () => {
        const subjects = rdfFilters.rdfSubject('rdf });

      it('should return empty array for non-existent predicate-object pair', () => { const subjects = rdfFilters.rdfSubject('rdf });

      it('should handle full URIs', () => { const subjects = rdfFilters.rdfSubject(
          'http });
    });

    describe('rdfObject', () => { it('should find objects for given subject-predicate pair', () => {
        const objects = rdfFilters.rdfObject('ex });

      it('should return URI objects correctly', () => { const objects = rdfFilters.rdfObject('ex });

      it('should return empty array for non-existent subject-predicate pair', () => { const objects = rdfFilters.rdfObject('ex });
    });

    describe('rdfPredicate', () => { it('should find predicates connecting subject and object', () => {
        const predicates = rdfFilters.rdfPredicate('ex });

      it('should find multiple predicates for literal values', () => { const predicates = rdfFilters.rdfPredicate('ex });

      it('should return empty array for non-connected subject-object pair', () => { const predicates = rdfFilters.rdfPredicate('ex });
    });

    describe('rdfQuery', () => { it('should execute pattern queries with object interface', () => {
        const results = rdfFilters.rdfQuery({
          subject,
          predicate });
      });

      it('should parse simple pattern strings', () => { const results = rdfFilters.rdfQuery('?s rdf });

      it('should handle specific subject queries', () => { const results = rdfFilters.rdfQuery({
          subject });
      });

      it('should return empty array for non-matching patterns', () => { const results = rdfFilters.rdfQuery('?s rdf });
    });

    describe('rdfLabel', () => { it('should return rdfs });

      it('should fallback to skos:prefLabel', () => { const label = rdfFilters.rdfLabel('ex });

      it('should fallback to local name for resources without labels', () => { const label = rdfFilters.rdfLabel('http });

      it('should handle foaf:name fallback', () => { // Create a resource with only foaf });
    });

    describe('rdfType', () => { it('should return all types for a resource', () => {
        const types = rdfFilters.rdfType('ex });

      it('should return empty array for resources without types', () => { const types = rdfFilters.rdfType('ex });

      it('should handle multiple types', () => { // Add another type to john
        const additionalQuad = quad(
          namedNode('http });
    });

    describe('rdfNamespace', () => { it('should resolve known prefixes', () => {
        const namespace = rdfFilters.rdfNamespace('foaf');
        expect(namespace).toBe('http });

      it('should return the prefix unchanged for unknown prefixes', () => {
        const namespace = rdfFilters.rdfNamespace('unknown');
        expect(namespace).toBe('unknown');
      });

      it('should handle all common prefixes', () => { expect(rdfFilters.rdfNamespace('rdf')).toBe('http });
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

      it('should filter by named graph', () => { // For this test, we'll add some quads to a named graph
        const namedGraph = namedNode('http });
    });
  });

  describe('Additional Utility Filters', () => { describe('rdfExpand', () => {
      it('should expand prefixed URIs', () => {
        const expanded = rdfFilters.rdfExpand('foaf });

      it('should return full URIs unchanged', () => { const uri = 'http });

      it('should handle unknown prefixes gracefully', () => { const unknown = 'unknown });
    });

    describe('rdfCompact', () => { it('should compact full URIs to prefixed form', () => {
        const compacted = rdfFilters.rdfCompact('http });

      it('should return URIs without known prefixes unchanged', () => { const uri = 'http });

      it('should handle all common vocabularies', () => { expect(rdfFilters.rdfCompact('http });
    });

    describe('rdfCount', () => {
      it('should count all triples when no parameters provided', () => {
        const count = rdfFilters.rdfCount();
        expect(count).toBeGreaterThan(0);
      });

      it('should count triples for specific subject', () => { const count = rdfFilters.rdfCount('ex });

      it('should count triples for specific predicate', () => { const count = rdfFilters.rdfCount(undefined, 'rdf });

      it('should count specific triple patterns', () => { const count = rdfFilters.rdfCount('ex });

      it('should return 0 for non-existent patterns', () => { const count = rdfFilters.rdfCount('ex });
    });

    describe('rdfExists', () => { it('should return true for existing resources', () => {
        const exists = rdfFilters.rdfExists('ex });

      it('should return false for non-existent resources', () => { const exists = rdfFilters.rdfExists('ex });

      it('should check specific property existence', () => { const exists = rdfFilters.rdfExists('ex });

      it('should check specific triple existence', () => { const exists = rdfFilters.rdfExists('ex });

      it('should return false for non-existent triples', () => { const exists = rdfFilters.rdfExists('ex });
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

    it('should register filters with Nunjucks environment', () => { const mockNunjucksEnv = {
        addedFilters },
        addFilter: function(name, filter) {
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

  describe('Error Handling', () => { it('should handle malformed URIs gracefully', () => {
      const results = rdfFilters.rdfSubject('malformed });

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
      
      // { { 'foaf }}
      const peopleSubjects = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
      expect(peopleSubjects.length).toBe(2);
      
      // { { resource | rdfExists('foaf }}
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

  describe('Custom Prefixes and Options', () => { it('should accept custom prefixes in options', () => {
      const customPrefixes = {
        myorg };
      
      const customFilters = new RDFFilters({ store,
        prefixes });
      
      expect(customFilters.rdfNamespace('myorg')).toBe('http://myorganization.org/');
      expect(customFilters.rdfNamespace('custom')).toBe('http://custom.example.org/');
      
      // Should still have default prefixes
      expect(customFilters.rdfNamespace('foaf')).toBe('http://xmlns.com/foaf/0.1/');
    });

    it('should use custom base URI', () => {
      const customFilters = new RDFFilters({
        store,
        baseUri);
      
      // This would be used for relative URI resolution
      expect(customFilters.rdfExpand('relative')).toBe('relative'); // No prefix, so unchanged
    });
  });
});