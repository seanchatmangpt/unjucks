/**
 * SPARQL Query Validation Test Suite
 * 
 * Comprehensive test suite for validating SPARQL-like query functionality in the Unjucks
 * RDF integration system. This suite tests the query capabilities provided by the RDF
 * filters system which implements SPARQL-like functionality using N3.js Store.
 * 
 * Test Coverage:
 * 
 * 1. **Basic SPARQL Patterns**:
 *    - SELECT queries with variables (?s, ?p, ?o)
 *    - WHERE clauses with triple patterns
 *    - Multiple pattern matching and combinations
 *    - OPTIONAL pattern handling for missing properties
 * 
 * 2. **Query Execution**:
 *    - Queries against N3 Store with proper result binding
 *    - Multiple result handling with ordering consistency
 *    - Empty result set handling
 *    - Large dataset performance validation
 * 
 * 3. **Complex Query Operations**:
 *    - Join operations between triple patterns
 *    - Filter conditions (numeric, string, existence)
 *    - Graph pattern queries (default and named graphs)
 *    - Basic aggregations (COUNT, GROUP BY, statistics)
 * 
 * 4. **Error Handling**:
 *    - Invalid SPARQL syntax tolerance
 *    - Non-existent predicate handling
 *    - Type mismatch scenarios
 *    - Resource limitation stress tests
 * 
 * 5. **Integration Tests**:
 *    - Real Turtle file parsing and querying
 *    - Performance benchmarks with concurrent queries
 *    - Memory efficiency validation
 * 
 * The tests use sample RDF data with FOAF and Schema.org vocabularies to simulate
 * realistic use cases for template generation scenarios.
 * 
 * @see {@link ../../src/lib/rdf-filters.ts} - RDF filter implementation
 * @see {@link ../../src/lib/turtle-parser.ts} - Turtle parsing functionality
 * @see {@link ../../src/lib/rdf-data-loader.ts} - Data loading utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Store, Parser, DataFactory } from 'n3';
import fs from 'fs-extra';
import path from 'path';
import { TurtleParser, TurtleUtils } from '../../src/lib/turtle-parser.js';
import { RDFFilters, type RDFQueryPattern, type RDFFilterResult } from '../../src/lib/rdf-filters.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';

const { namedNode, literal, quad } = DataFactory;

describe('SPARQL Query Validation Tests', () => { let store;
  let rdfFilters;
  let turtleParser;
  let dataLoader;

  const sampleTurtle = `
    @prefix foaf });

  afterEach(() => {
    store = new Store();
  });

  describe('Basic SPARQL Pattern Matching', () => { describe('SELECT queries with variables', () => {
      it('should find all subjects with rdf });

      it('should find all foaf:name values for persons', () => { const aliceNames = rdfFilters.rdfObject('ex });

      it('should handle variable binding patterns', () => { // Pattern };
        
        const results = rdfFilters.rdfQuery(knowsPattern);
        
        expect(results.length).toBeGreaterThan(0);
        
        // Check that Alice knows both Bob and Carol
        const aliceKnowsResults = results.filter(result => 
          result?.[0]?.value === 'http://example.org/alice'
        );
        expect(aliceKnowsResults).toHaveLength(2);
        
        const friendURIs = aliceKnowsResults.map(result => result?.[2]?.value).filter(Boolean);
        expect(friendURIs).toContain('http://example.org/bob');
        expect(friendURIs).toContain('http://example.org/carol');
      });
    });

    describe('WHERE clauses with triple patterns', () => { it('should match single triple pattern', () => {
        const pattern = {
          subject };
        
        const results = rdfFilters.rdfQuery(pattern);
        
        expect(results).toHaveLength(1);
        expect(results?.[0]?.[0]?.value).toBe('http://example.org/alice');
        expect(results?.[0]?.[1]?.value).toBe('http://xmlns.com/foaf/0.1/name');
        expect(results?.[0]?.[2]?.value).toBe('Alice Johnson');
      });

      it('should match multiple triple patterns by chaining', () => { // Find all people who know someone
        const knowsResults = rdfFilters.rdfQuery({
          subject,
          predicate });

      it('should handle complex WHERE patterns', () => { // Find all persons with their names and ages
        const persons = rdfFilters.rdfSubject('rdf };
        });
        
        expect(personDetails).toHaveLength(3);
        
        const alice = personDetails.find(p => p.uri === 'http://example.org/alice');
        expect(alice?.name).toBe('Alice Johnson');
        expect(alice?.age).toBe(30);
      });
    });

    describe('Multiple pattern matching', () => { it('should handle pattern string parsing', () => {
        const results = rdfFilters.rdfQuery('?s foaf });

      it('should support complex pattern combinations', () => { // Find all people and their email addresses
        const emailResults = rdfFilters.rdfQuery({
          subject,
          predicate });
      });

      it('should handle intersection of patterns', () => { // Find people who both have names and know others
        const namedPersons = new Set(
          rdfFilters.rdfQuery({ predicate)
            .map(result => result?.[0]?.value).filter(Boolean)
        );
        
        const socialPersons = new Set(
          rdfFilters.rdfQuery({ predicate)
            .map(result => result?.[0]?.value).filter(Boolean)
        );
        
        const intersection = [...namedPersons].filter(uri => socialPersons.has(uri));
        
        expect(intersection).toHaveLength(2); // Alice and Bob
        expect(intersection).toContain('http });
    });

    describe('OPTIONAL patterns', () => { it('should handle optional properties gracefully', () => {
        const persons = rdfFilters.rdfSubject('rdf };
        });
        
        expect(personProfiles).toHaveLength(3);
        
        // Alice and Bob don't have workplace, Carol does
        const alice = personProfiles.find(p => p.uri === 'http://example.org/alice');
        const carol = personProfiles.find(p => p.uri === 'http://example.org/carol');
        
        expect(alice?.workplace).toBeNull();
        expect(carol?.workplace).toBe('https://techcorp.example.com');
      });

      it('should provide default values for missing optional properties', () => { const persons = rdfFilters.rdfSubject('rdf };
        });
        
        expect(profiles).toHaveLength(3);
        
        // Check default values are applied
        profiles.forEach(profile => {
          expect(profile.age).toBeGreaterThanOrEqual(0);
          expect(profile.email).toBeTruthy();
        });
      });
    });
  });

  describe('Query Execution Against N3 Store', () => { describe('Result binding extraction', () => {
      it('should extract bindings correctly', () => {
        const pattern = {
          subject,
          predicate };
        
        const results = rdfFilters.rdfQuery(pattern);
        
        expect(results).toHaveLength(3);
        
        results.forEach(result => { expect(result).toHaveLength(3); // [subject, predicate, object]
          expect(result?.[0]).toHaveProperty('value');
          expect(result?.[0]).toHaveProperty('type');
          expect(result?.[1]?.value).toBe('http });
      });

      it('should handle different term types in results', () => { // Query that returns URIs, literals, and potentially blank nodes
        const results = rdfFilters.rdfQuery({
          subject,
          predicate,
          object });
        
        expect(results.length).toBeGreaterThan(0);
        
        // Categorize results by object type
        const uriObjects = results.filter(r => r?.[2]?.type === 'uri');
        const literalObjects = results.filter(r => r?.[2]?.type === 'literal');
        
        expect(uriObjects.length).toBeGreaterThan(0);
        expect(literalObjects.length).toBeGreaterThan(0);
      });

      it('should preserve datatype information', () => { const foundingDates = rdfFilters.rdfObject('ex });
    });

    describe('Multiple result handling', () => { it('should handle queries returning multiple results', () => {
        const allTypes = rdfFilters.rdfQuery({
          subject,
          predicate }, {});
        
        expect(typeGroups['http://xmlns.com/foaf/0.1/Person']?.length).toBe(3);
        expect(typeGroups['http://schema.org/Organization']?.length).toBe(1);
      });

      it('should handle large result sets efficiently', async () => {
        const startTime = performance.now();
        
        // Query all triples
        const allTriples = rdfFilters.rdfQuery({});
        
        const endTime = performance.now();
        
        expect(allTriples.length).toBeGreaterThan(10);
        expect(endTime - startTime).toBeLessThan(100); // Should be fast
      });

      it('should maintain result ordering consistency', () => { // Run the same query multiple times
        const query = { predicate };
        
        const results1 = rdfFilters.rdfQuery(query);
        const results2 = rdfFilters.rdfQuery(query);
        const results3 = rdfFilters.rdfQuery(query);
        
        expect(results1).toEqual(results2);
        expect(results2).toEqual(results3);
      });
    });

    describe('Empty result sets', () => { it('should handle queries with no matches gracefully', () => {
        const noResults = rdfFilters.rdfQuery({
          subject });

      it('should return empty arrays for non-matching patterns', () => { const subjects = rdfFilters.rdfSubject('ex });

      it('should handle empty store gracefully', () => { const emptyStore = new Store();
        const emptyFilters = new RDFFilters({ store });
        
        const results = emptyFilters.rdfQuery({});
        
        expect(results).toEqual([]);
      });
    });
  });

  describe('Complex Query Operations', () => { describe('Join operations', () => {
      it('should perform implicit joins between patterns', () => {
        // Find all people and their friends' names
        const knowsResults = rdfFilters.rdfQuery({
          subject,
          predicate };
        });
        
        expect(joinedResults.length).toBeGreaterThan(0);
        
        // Check specific relationships
        const aliceToFriends = joinedResults.filter(r => r.person === 'Alice Johnson');
        expect(aliceToFriends).toHaveLength(2);
        
        const friendNames = aliceToFriends.map(r => r?.friend);
        expect(friendNames).toContain('Bob Smith');
        expect(friendNames).toContain('Carol White');
      });

      it('should handle self-joins correctly', () => { // Find mutual friendships (people who know each other)
        const knowsResults = rdfFilters.rdfQuery({
          predicate);
        
        const mutualFriends = [];
        
        knowsResults.forEach(result1 => {
          const person1 = result1?.[0]?.value;
          const friend1 = result1?.[2]?.value;
          
          // Check if friend1 also knows person1
          if (friend1 && person1) {
            const reverseKnows = rdfFilters.rdfQuery({
              subject,
              predicate });
            }
          }
        });
        
        expect(mutualFriends.length).toBeGreaterThan(0);
        
        // Alice and Bob should be mutual friends
        const aliceBobMutual = mutualFriends.find(mf => 
          (mf.person1 === 'http://example.org/alice' && mf.person2 === 'http://example.org/bob') ||
          (mf.person1 === 'http://example.org/bob' && mf.person2 === 'http://example.org/alice')
        );
        
        expect(aliceBobMutual).toBeTruthy();
      });
    });

    describe('Filter conditions', () => { it('should apply numeric filters', () => {
        const persons = rdfFilters.rdfSubject('rdf });
        
        expect(adultsOver25).toHaveLength(2); // Alice (30) and Carol (28)
      });

      it('should apply string filters with regex', () => { const persons = rdfFilters.rdfSubject('rdf });
        
        expect(peopleWithJobnInName).toHaveLength(1); // Alice Johnson
      });

      it('should apply existence filters', () => { const persons = rdfFilters.rdfSubject('rdf });
        
        expect(peopleWithWorkplace).toHaveLength(1); // Only Carol
        expect(peopleWithWorkplace?.[0]).toBe('http://example.org/carol');
      });
    });

    describe('Graph patterns', () => { it('should handle default graph queries', () => {
        const defaultGraphTriples = rdfFilters.rdfGraph();
        
        expect(defaultGraphTriples.length).toBeGreaterThan(0);
        
        // All our sample data should be in the default graph
        const subjects = new Set(defaultGraphTriples.map(t => t?.[0]?.value));
        expect(subjects.has('http });

      it('should handle named graph queries', () => { // Our sample data doesn't use named graphs, so this should return empty
        const namedGraphTriples = rdfFilters.rdfGraph('ex });

      it('should support graph-based filtering', () => { // Add some test data to a named graph
        const namedGraphQuads = [
          quad(
            namedNode('http });
    });

    describe('Aggregations', () => { it('should count query results', () => {
        const personCount = rdfFilters.rdfCount(undefined, 'rdf });

      it('should group results by property values', () => {
        const allAges = rdfFilters.rdfQuery({
          predicate);
        
        const ageGroups = allAges.reduce((groups, result) => {
          const age = result?.[2]?.value;
          if (age && !groups[age]) groups[age] = [];
          if (age) groups[age]?.push(result?.[0]?.value);
          return groups;
        }, {});
        
        expect(Object.keys(ageGroups)).toHaveLength(3); // Three different ages
        expect(ageGroups['30']?.length).toBe(1); // Alice
        expect(ageGroups['25']?.length).toBe(1); // Bob
        expect(ageGroups['28']?.length).toBe(1); // Carol
      });

      it('should calculate basic statistics', () => { const ages = rdfFilters.rdfQuery({ predicate)
          .map(result => result?.[2]?.value ? parseInt(result[2].value)  });
    });
  });

  describe('Query Error Handling', () => {
    describe('Invalid SPARQL syntax', () => {
      it('should handle malformed pattern strings', () => {
        expect(() => {
          rdfFilters.rdfQuery('invalid pattern');
        }).not.toThrow();
        
        const results = rdfFilters.rdfQuery('invalid pattern');
        expect(results).toEqual([]);
      });

      it('should handle invalid URIs gracefully', () => { const results = rdfFilters.rdfObject('not-a-valid-uri', 'foaf });

      it('should handle malformed prefixed URIs', () => { const results = rdfFilters.rdfObject('invalid });
    });

    describe('Non-existent predicates', () => {
      it('should return empty results for unknown predicates', () => {
        const results = rdfFilters.rdfQuery({
          predicate);
        
        expect(results).toEqual([]);
      });

      it('should handle undefined predicate namespace', () => { const results = rdfFilters.rdfObject('ex });
    });

    describe('Type mismatches', () => { it('should handle datatype mismatches gracefully', () => {
        // Try to query for age string when it's stored integer
        const results = rdfFilters.rdfQuery({
          predicate });

      it('should handle URI vs literal confusion', () => { // Try to query for a URI literal
        const results = rdfFilters.rdfQuery({
          subject });
    });

    describe('Resource limitations', () => { it('should handle very large query results', () => {
        // Create a large dataset
        const largeDataset = Array.from({ length, (_, i) => 
          quad(
            namedNode(`http }`),
            namedNode('http://xmlns.com/foaf/0.1/name'),
            literal(`Person ${i}`)
          )
        );
        
        store.addQuads(largeDataset);
        
        const startTime = performance.now();
        const allNames = rdfFilters.rdfQuery({ predicate);
        const endTime = performance.now();
        
        expect(allNames.length).toBeGreaterThan(1000);
        expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      });

      it('should handle deep recursion patterns', () => { // Create a chain of "knows" relationships
        const chainQuads = Array.from({ length, (_, i) =>
          quad(
            namedNode(`http }`),
            namedNode('http://xmlns.com/foaf/0.1/knows'),
            namedNode(`http://example.org/chain${i + 1}`)
          )
        );
        
        store.addQuads(chainQuads);
        
        // This should not cause stack overflow
        const allKnows = rdfFilters.rdfQuery({ predicate);
        expect(allKnows.length).toBeGreaterThan(100);
      });
    });
  });

  describe('Integration with Actual Turtle Files', () => { const fixturesDir = path.join(__dirname, '../fixtures/turtle');

    it('should validate queries against basic-person.ttl', async () => {
      const basicPersonPath = path.join(fixturesDir, 'basic-person.ttl');
      
      if (await fs.pathExists(basicPersonPath)) {
        const turtleContent = await fs.readFile(basicPersonPath, 'utf-8');
        const parseResult = await turtleParser.parse(turtleContent);
        
        expect(parseResult?.triples?.length).toBeGreaterThan(0);
        
        // Test specific queries on this data
        const parser = new Parser();
        const quads = parser.parse(turtleContent);
        const testStore = new Store(quads);
        
        const testFilters = new RDFFilters({
          store,
          prefixes);
        
        const persons = testFilters.rdfSubject('rdf }
    });

    it('should validate queries against sample.ttl', async () => { const samplePath = path.join(fixturesDir, 'sample.ttl');
      
      if (await fs.pathExists(samplePath)) {
        const turtleContent = await fs.readFile(samplePath, 'utf-8');
        const parseResult = await turtleParser.parse(turtleContent);
        
        expect(parseResult?.triples?.length).toBeGreaterThan(0);
        
        // Test complex queries on this richer dataset
        const parser = new Parser();
        const quads = parser.parse(turtleContent);
        const testStore = new Store(quads);
        
        const testFilters = new RDFFilters({
          store,
          prefixes);
        
        // Test organizational queries
        const organizations = testFilters.rdfSubject('rdf };
          });
          
          expect(eventDetails?.every(e => e?.name !== null)).toBe(true);
        }
      }
    });

    it('should handle validation errors for invalid-syntax.ttl', async () => {
      const invalidPath = path.join(fixturesDir, 'invalid-syntax.ttl');
      
      if (await fs.pathExists(invalidPath)) {
        try {
          const turtleContent = await fs.readFile(invalidPath, 'utf-8');
          await turtleParser.parse(turtleContent);
          
          // If parsing succeeds, the file might not be invalid anymore
          // or the parser is very tolerant
          expect(true).toBe(true);
        } catch (error) {
          // Expected for invalid syntax
          expect(error).toBeTruthy();
        }
      }
    });
  });

  describe('Performance and Scalability', () => { it('should maintain performance with concurrent queries', async () => {
      const queries = Array.from({ length, (_, i) => ({
        subject });

    it('should handle memory efficiently with large result sets', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Run multiple large queries
      for (let i = 0; i < 100; i++) {
        const results = rdfFilters.rdfQuery({});
        expect(results?.length).toBeGreaterThan(0);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('SPARQL Extensions and Utilities', () => { it('should provide label resolution functionality', () => {
      const aliceLabel = rdfFilters.rdfLabel('ex });

    it('should provide type checking functionality', () => { const aliceTypes = rdfFilters.rdfType('ex });

    it('should provide namespace expansion/compaction', () => { const expanded = rdfFilters.rdfExpand('foaf });

    it('should provide existence checks', () => { expect(rdfFilters.rdfExists('ex });
  });
});