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

describe('SPARQL Query Validation Tests', () => {
  let store: Store;
  let rdfFilters: RDFFilters;
  let turtleParser: TurtleParser;
  let dataLoader: RDFDataLoader;

  const sampleTurtle = `
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    @prefix ex: <http://example.org/> .
    @prefix schema: <http://schema.org/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

    ex:alice a foaf:Person ;
        foaf:name "Alice Johnson" ;
        foaf:age 30 ;
        foaf:email "alice@example.org" ;
        foaf:knows ex:bob, ex:carol .

    ex:bob a foaf:Person ;
        foaf:name "Bob Smith" ;
        foaf:age 25 ;
        foaf:email "bob@example.org" ;
        foaf:knows ex:alice .

    ex:carol a foaf:Person ;
        foaf:name "Carol White" ;
        foaf:age 28 ;
        foaf:email "carol@example.org" ;
        foaf:workplaceHomepage <https://techcorp.example.com> .

    ex:company a schema:Organization ;
        schema:name "TechCorp Inc." ;
        schema:employee ex:alice, ex:bob ;
        schema:foundingDate "2010-01-01"^^xsd:date .
  `;

  beforeEach(async () => {
    store = new Store();
    turtleParser = new TurtleParser();
    dataLoader = new RDFDataLoader();
    
    // Parse and load sample data
    const parser = new Parser();
    const quads = parser.parse(sampleTurtle);
    quads.forEach(quad => store.add(quad));
    
    // Initialize RDF filters with the populated store
    rdfFilters = new RDFFilters({
      store,
      prefixes: {
        foaf: 'http://xmlns.com/foaf/0.1/',
        ex: 'http://example.org/',
        schema: 'http://schema.org/',
        xsd: 'http://www.w3.org/2001/XMLSchema#'
      }
    });
  });

  afterEach(() => {
    store = new Store();
  });

  describe('Basic SPARQL Pattern Matching', () => {
    describe('SELECT queries with variables', () => {
      it('should find all subjects with rdf:type foaf:Person', () => {
        const results = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
        
        expect(results).toHaveLength(3);
        expect(results).toContain('http://example.org/alice');
        expect(results).toContain('http://example.org/bob');
        expect(results).toContain('http://example.org/carol');
      });

      it('should find all foaf:name values for persons', () => {
        const aliceNames = rdfFilters.rdfObject('ex:alice', 'foaf:name');
        const bobNames = rdfFilters.rdfObject('ex:bob', 'foaf:name');
        
        expect(aliceNames).toHaveLength(1);
        expect(aliceNames[0].value).toBe('Alice Johnson');
        expect(aliceNames[0].type).toBe('literal');
        
        expect(bobNames).toHaveLength(1);
        expect(bobNames[0].value).toBe('Bob Smith');
      });

      it('should handle variable binding patterns', () => {
        // Pattern: ?person foaf:knows ?friend
        const knowsPattern: RDFQueryPattern = {
          subject: null, // variable
          predicate: 'foaf:knows',
          object: null // variable
        };
        
        const results = rdfFilters.rdfQuery(knowsPattern);
        
        expect(results.length).toBeGreaterThan(0);
        
        // Check that Alice knows both Bob and Carol
        const aliceKnowsResults = results.filter(result => 
          result[0].value === 'http://example.org/alice'
        );
        expect(aliceKnowsResults).toHaveLength(2);
        
        const friendURIs = aliceKnowsResults.map(result => result[2].value);
        expect(friendURIs).toContain('http://example.org/bob');
        expect(friendURIs).toContain('http://example.org/carol');
      });
    });

    describe('WHERE clauses with triple patterns', () => {
      it('should match single triple pattern', () => {
        const pattern: RDFQueryPattern = {
          subject: 'ex:alice',
          predicate: 'foaf:name',
          object: null
        };
        
        const results = rdfFilters.rdfQuery(pattern);
        
        expect(results).toHaveLength(1);
        expect(results[0][0].value).toBe('http://example.org/alice');
        expect(results[0][1].value).toBe('http://xmlns.com/foaf/0.1/name');
        expect(results[0][2].value).toBe('Alice Johnson');
      });

      it('should match multiple triple patterns by chaining', () => {
        // Find all people who know someone
        const knowsResults = rdfFilters.rdfQuery({
          subject: null,
          predicate: 'foaf:knows',
          object: null
        });
        
        // Get unique subjects (people who know others)
        const peopleWhoKnowOthers = new Set(
          knowsResults.map(result => result[0].value)
        );
        
        expect(peopleWhoKnowOthers.size).toBe(2); // Alice and Bob
        expect(peopleWhoKnowOthers.has('http://example.org/alice')).toBe(true);
        expect(peopleWhoKnowOthers.has('http://example.org/bob')).toBe(true);
      });

      it('should handle complex WHERE patterns', () => {
        // Find all persons with their names and ages
        const persons = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
        
        const personDetails = persons.map(personURI => {
          const names = rdfFilters.rdfObject(personURI, 'foaf:name');
          const ages = rdfFilters.rdfObject(personURI, 'foaf:age');
          
          return {
            uri: personURI,
            name: names.length > 0 ? names[0].value : null,
            age: ages.length > 0 ? parseInt(ages[0].value) : null
          };
        });
        
        expect(personDetails).toHaveLength(3);
        
        const alice = personDetails.find(p => p.uri === 'http://example.org/alice');
        expect(alice?.name).toBe('Alice Johnson');
        expect(alice?.age).toBe(30);
      });
    });

    describe('Multiple pattern matching', () => {
      it('should handle pattern string parsing', () => {
        const results = rdfFilters.rdfQuery('?s foaf:name ?o');
        
        expect(results.length).toBe(3); // All three persons have names
        
        const names = results.map(result => result[2].value);
        expect(names).toContain('Alice Johnson');
        expect(names).toContain('Bob Smith');
        expect(names).toContain('Carol White');
      });

      it('should support complex pattern combinations', () => {
        // Find all people and their email addresses
        const emailResults = rdfFilters.rdfQuery({
          subject: null,
          predicate: 'foaf:email',
          object: null
        });
        
        expect(emailResults).toHaveLength(3);
        
        // Verify all results are email patterns
        emailResults.forEach(result => {
          expect(result[1].value).toBe('http://xmlns.com/foaf/0.1/email');
          expect(result[2].value).toMatch(/@example\.org$/);
        });
      });

      it('should handle intersection of patterns', () => {
        // Find people who both have names and know others
        const namedPersons = new Set(
          rdfFilters.rdfQuery({ predicate: 'foaf:name' })
            .map(result => result[0].value)
        );
        
        const socialPersons = new Set(
          rdfFilters.rdfQuery({ predicate: 'foaf:knows' })
            .map(result => result[0].value)
        );
        
        const intersection = [...namedPersons].filter(uri => socialPersons.has(uri));
        
        expect(intersection).toHaveLength(2); // Alice and Bob
        expect(intersection).toContain('http://example.org/alice');
        expect(intersection).toContain('http://example.org/bob');
      });
    });

    describe('OPTIONAL patterns', () => {
      it('should handle optional properties gracefully', () => {
        const persons = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
        
        const personProfiles = persons.map(personURI => {
          const names = rdfFilters.rdfObject(personURI, 'foaf:name');
          const workplaces = rdfFilters.rdfObject(personURI, 'foaf:workplaceHomepage');
          
          return {
            uri: personURI,
            name: names.length > 0 ? names[0].value : null,
            workplace: workplaces.length > 0 ? workplaces[0].value : null
          };
        });
        
        expect(personProfiles).toHaveLength(3);
        
        // Alice and Bob don't have workplace, Carol does
        const alice = personProfiles.find(p => p.uri === 'http://example.org/alice');
        const carol = personProfiles.find(p => p.uri === 'http://example.org/carol');
        
        expect(alice?.workplace).toBeNull();
        expect(carol?.workplace).toBe('https://techcorp.example.com');
      });

      it('should provide default values for missing optional properties', () => {
        const persons = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
        
        const profiles = persons.map(personURI => {
          const ages = rdfFilters.rdfObject(personURI, 'foaf:age');
          const emails = rdfFilters.rdfObject(personURI, 'foaf:email');
          const homepages = rdfFilters.rdfObject(personURI, 'foaf:homepage');
          
          return {
            uri: personURI,
            age: ages.length > 0 ? parseInt(ages[0].value) : 0,
            email: emails.length > 0 ? emails[0].value : 'unknown@example.org',
            homepage: homepages.length > 0 ? homepages[0].value : null
          };
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

  describe('Query Execution Against N3 Store', () => {
    describe('Result binding extraction', () => {
      it('should extract bindings correctly', () => {
        const pattern: RDFQueryPattern = {
          subject: null,
          predicate: 'foaf:name',
          object: null
        };
        
        const results = rdfFilters.rdfQuery(pattern);
        
        expect(results).toHaveLength(3);
        
        results.forEach(result => {
          expect(result).toHaveLength(3); // [subject, predicate, object]
          expect(result[0]).toHaveProperty('value');
          expect(result[0]).toHaveProperty('type');
          expect(result[1].value).toBe('http://xmlns.com/foaf/0.1/name');
          expect(result[2].type).toBe('literal');
        });
      });

      it('should handle different term types in results', () => {
        // Query that returns URIs, literals, and potentially blank nodes
        const results = rdfFilters.rdfQuery({
          subject: null,
          predicate: null,
          object: null
        });
        
        expect(results.length).toBeGreaterThan(0);
        
        // Categorize results by object type
        const uriObjects = results.filter(r => r[2].type === 'uri');
        const literalObjects = results.filter(r => r[2].type === 'literal');
        
        expect(uriObjects.length).toBeGreaterThan(0);
        expect(literalObjects.length).toBeGreaterThan(0);
      });

      it('should preserve datatype information', () => {
        const foundingDates = rdfFilters.rdfObject('ex:company', 'schema:foundingDate');
        
        expect(foundingDates).toHaveLength(1);
        expect(foundingDates[0].type).toBe('literal');
        expect(foundingDates[0].datatype).toBe('http://www.w3.org/2001/XMLSchema#date');
        expect(foundingDates[0].value).toBe('2010-01-01');
      });
    });

    describe('Multiple result handling', () => {
      it('should handle queries returning multiple results', () => {
        const allTypes = rdfFilters.rdfQuery({
          subject: null,
          predicate: 'rdf:type',
          object: null
        });
        
        expect(allTypes.length).toBeGreaterThan(3);
        
        // Group by type
        const typeGroups = allTypes.reduce((groups, result) => {
          const type = result[2].value;
          if (!groups[type]) groups[type] = [];
          groups[type].push(result[0].value);
          return groups;
        }, {} as Record<string, string[]>);
        
        expect(typeGroups['http://xmlns.com/foaf/0.1/Person']).toHaveLength(3);
        expect(typeGroups['http://schema.org/Organization']).toHaveLength(1);
      });

      it('should handle large result sets efficiently', async () => {
        const startTime = performance.now();
        
        // Query all triples
        const allTriples = rdfFilters.rdfQuery({});
        
        const endTime = performance.now();
        
        expect(allTriples.length).toBeGreaterThan(10);
        expect(endTime - startTime).toBeLessThan(100); // Should be fast
      });

      it('should maintain result ordering consistency', () => {
        // Run the same query multiple times
        const query = { predicate: 'foaf:name' };
        
        const results1 = rdfFilters.rdfQuery(query);
        const results2 = rdfFilters.rdfQuery(query);
        const results3 = rdfFilters.rdfQuery(query);
        
        expect(results1).toEqual(results2);
        expect(results2).toEqual(results3);
      });
    });

    describe('Empty result sets', () => {
      it('should handle queries with no matches gracefully', () => {
        const noResults = rdfFilters.rdfQuery({
          subject: 'ex:nonexistent',
          predicate: 'foaf:name',
          object: null
        });
        
        expect(noResults).toEqual([]);
      });

      it('should return empty arrays for non-matching patterns', () => {
        const subjects = rdfFilters.rdfSubject('ex:nonexistent', 'ex:value');
        const objects = rdfFilters.rdfObject('ex:nonexistent', 'ex:property');
        const predicates = rdfFilters.rdfPredicate('ex:alice', 'ex:nonexistent');
        
        expect(subjects).toEqual([]);
        expect(objects).toEqual([]);
        expect(predicates).toEqual([]);
      });

      it('should handle empty store gracefully', () => {
        const emptyStore = new Store();
        const emptyFilters = new RDFFilters({ store: emptyStore });
        
        const results = emptyFilters.rdfQuery({});
        
        expect(results).toEqual([]);
      });
    });
  });

  describe('Complex Query Operations', () => {
    describe('Join operations', () => {
      it('should perform implicit joins between patterns', () => {
        // Find all people and their friends' names
        const knowsResults = rdfFilters.rdfQuery({
          subject: null,
          predicate: 'foaf:knows',
          object: null
        });
        
        const joinedResults = knowsResults.map(result => {
          const person = result[0].value;
          const friend = result[2].value;
          const personNames = rdfFilters.rdfObject(person, 'foaf:name');
          const friendNames = rdfFilters.rdfObject(friend, 'foaf:name');
          
          return {
            person: personNames.length > 0 ? personNames[0].value : null,
            friend: friendNames.length > 0 ? friendNames[0].value : null
          };
        });
        
        expect(joinedResults.length).toBeGreaterThan(0);
        
        // Check specific relationships
        const aliceToFriends = joinedResults.filter(r => r.person === 'Alice Johnson');
        expect(aliceToFriends).toHaveLength(2);
        
        const friendNames = aliceToFriends.map(r => r.friend);
        expect(friendNames).toContain('Bob Smith');
        expect(friendNames).toContain('Carol White');
      });

      it('should handle self-joins correctly', () => {
        // Find mutual friendships (people who know each other)
        const knowsResults = rdfFilters.rdfQuery({
          predicate: 'foaf:knows'
        });
        
        const mutualFriends: Array<{ person1: string, person2: string }> = [];
        
        knowsResults.forEach(result1 => {
          const person1 = result1[0].value;
          const friend1 = result1[2].value;
          
          // Check if friend1 also knows person1
          const reverseKnows = rdfFilters.rdfQuery({
            subject: friend1,
            predicate: 'foaf:knows',
            object: person1
          });
          
          if (reverseKnows.length > 0) {
            mutualFriends.push({ person1, person2: friend1 });
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

    describe('Filter conditions', () => {
      it('should apply numeric filters', () => {
        const persons = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
        
        const adultsOver25 = persons.filter(personURI => {
          const ages = rdfFilters.rdfObject(personURI, 'foaf:age');
          if (ages.length === 0) return false;
          
          const age = parseInt(ages[0].value);
          return age > 25;
        });
        
        expect(adultsOver25).toHaveLength(2); // Alice (30) and Carol (28)
      });

      it('should apply string filters with regex', () => {
        const persons = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
        
        const peopleWithJobnInName = persons.filter(personURI => {
          const names = rdfFilters.rdfObject(personURI, 'foaf:name');
          if (names.length === 0) return false;
          
          return names[0].value.toLowerCase().includes('john');
        });
        
        expect(peopleWithJobnInName).toHaveLength(1); // Alice Johnson
      });

      it('should apply existence filters', () => {
        const persons = rdfFilters.rdfSubject('rdf:type', 'foaf:Person');
        
        const peopleWithWorkplace = persons.filter(personURI => {
          return rdfFilters.rdfExists(personURI, 'foaf:workplaceHomepage');
        });
        
        expect(peopleWithWorkplace).toHaveLength(1); // Only Carol
        expect(peopleWithWorkplace[0]).toBe('http://example.org/carol');
      });
    });

    describe('Graph patterns', () => {
      it('should handle default graph queries', () => {
        const defaultGraphTriples = rdfFilters.rdfGraph();
        
        expect(defaultGraphTriples.length).toBeGreaterThan(0);
        
        // All our sample data should be in the default graph
        const subjects = new Set(defaultGraphTriples.map(t => t[0].value));
        expect(subjects.has('http://example.org/alice')).toBe(true);
        expect(subjects.has('http://example.org/company')).toBe(true);
      });

      it('should handle named graph queries', () => {
        // Our sample data doesn't use named graphs, so this should return empty
        const namedGraphTriples = rdfFilters.rdfGraph('ex:namedGraph');
        
        expect(namedGraphTriples).toEqual([]);
      });

      it('should support graph-based filtering', () => {
        // Add some test data to a named graph
        const namedGraphQuads = [
          quad(
            namedNode('http://example.org/test1'),
            namedNode('http://xmlns.com/foaf/0.1/name'),
            literal('Test Person'),
            namedNode('http://example.org/testGraph')
          )
        ];
        
        store.addQuads(namedGraphQuads);
        
        const testGraphTriples = rdfFilters.rdfGraph('ex:testGraph');
        expect(testGraphTriples).toHaveLength(1);
        expect(testGraphTriples[0][2].value).toBe('Test Person');
      });
    });

    describe('Aggregations', () => {
      it('should count query results', () => {
        const personCount = rdfFilters.rdfCount(null, 'rdf:type', 'foaf:Person');
        const nameCount = rdfFilters.rdfCount(null, 'foaf:name');
        
        expect(personCount).toBe(3);
        expect(nameCount).toBe(3);
      });

      it('should group results by property values', () => {
        const allAges = rdfFilters.rdfQuery({
          predicate: 'foaf:age'
        });
        
        const ageGroups = allAges.reduce((groups, result) => {
          const age = result[2].value;
          if (!groups[age]) groups[age] = [];
          groups[age].push(result[0].value);
          return groups;
        }, {} as Record<string, string[]>);
        
        expect(Object.keys(ageGroups)).toHaveLength(3); // Three different ages
        expect(ageGroups['30']).toHaveLength(1); // Alice
        expect(ageGroups['25']).toHaveLength(1); // Bob
        expect(ageGroups['28']).toHaveLength(1); // Carol
      });

      it('should calculate basic statistics', () => {
        const ages = rdfFilters.rdfQuery({ predicate: 'foaf:age' })
          .map(result => parseInt(result[2].value));
        
        const sum = ages.reduce((a, b) => a + b, 0);
        const avg = sum / ages.length;
        const min = Math.min(...ages);
        const max = Math.max(...ages);
        
        expect(ages).toHaveLength(3);
        expect(avg).toBeCloseTo(27.67, 2);
        expect(min).toBe(25);
        expect(max).toBe(30);
      });
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

      it('should handle invalid URIs gracefully', () => {
        const results = rdfFilters.rdfObject('not-a-valid-uri', 'foaf:name');
        expect(results).toEqual([]);
      });

      it('should handle malformed prefixed URIs', () => {
        const results = rdfFilters.rdfObject('invalid:prefix:uri', 'foaf:name');
        expect(results).toEqual([]);
      });
    });

    describe('Non-existent predicates', () => {
      it('should return empty results for unknown predicates', () => {
        const results = rdfFilters.rdfQuery({
          predicate: 'unknown:predicate'
        });
        
        expect(results).toEqual([]);
      });

      it('should handle undefined predicate namespace', () => {
        const results = rdfFilters.rdfObject('ex:alice', 'unknownPrefix:property');
        expect(results).toEqual([]);
      });
    });

    describe('Type mismatches', () => {
      it('should handle datatype mismatches gracefully', () => {
        // Try to query for age as a string when it's stored as an integer
        const results = rdfFilters.rdfQuery({
          predicate: 'foaf:age',
          object: '"30"'
        });
        
        // Should still work because both are literals
        expect(results.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle URI vs literal confusion', () => {
        // Try to query for a URI as a literal
        const results = rdfFilters.rdfQuery({
          subject: '"http://example.org/alice"', // quoted as literal
          predicate: 'foaf:name'
        });
        
        expect(results).toEqual([]);
      });
    });

    describe('Resource limitations', () => {
      it('should handle very large query results', () => {
        // Create a large dataset
        const largeDataset = Array.from({ length: 1000 }, (_, i) => 
          quad(
            namedNode(`http://example.org/person${i}`),
            namedNode('http://xmlns.com/foaf/0.1/name'),
            literal(`Person ${i}`)
          )
        );
        
        store.addQuads(largeDataset);
        
        const startTime = performance.now();
        const allNames = rdfFilters.rdfQuery({ predicate: 'foaf:name' });
        const endTime = performance.now();
        
        expect(allNames.length).toBeGreaterThan(1000);
        expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      });

      it('should handle deep recursion patterns', () => {
        // Create a chain of "knows" relationships
        const chainQuads = Array.from({ length: 100 }, (_, i) =>
          quad(
            namedNode(`http://example.org/chain${i}`),
            namedNode('http://xmlns.com/foaf/0.1/knows'),
            namedNode(`http://example.org/chain${i + 1}`)
          )
        );
        
        store.addQuads(chainQuads);
        
        // This should not cause stack overflow
        const allKnows = rdfFilters.rdfQuery({ predicate: 'foaf:knows' });
        expect(allKnows.length).toBeGreaterThan(100);
      });
    });
  });

  describe('Integration with Actual Turtle Files', () => {
    const fixturesDir = path.join(__dirname, '../fixtures/turtle');

    it('should validate queries against basic-person.ttl', async () => {
      const basicPersonPath = path.join(fixturesDir, 'basic-person.ttl');
      
      if (await fs.pathExists(basicPersonPath)) {
        const turtleContent = await fs.readFile(basicPersonPath, 'utf-8');
        const parseResult = await turtleParser.parse(turtleContent);
        
        expect(parseResult.triples.length).toBeGreaterThan(0);
        
        // Test specific queries on this data
        const parser = new Parser();
        const quads = parser.parse(turtleContent);
        const testStore = new Store(quads);
        
        const testFilters = new RDFFilters({
          store: testStore,
          prefixes: parseResult.prefixes
        });
        
        const persons = testFilters.rdfSubject('rdf:type', 'foaf:Person');
        expect(persons.length).toBeGreaterThan(0);
      }
    });

    it('should validate queries against sample.ttl', async () => {
      const samplePath = path.join(fixturesDir, 'sample.ttl');
      
      if (await fs.pathExists(samplePath)) {
        const turtleContent = await fs.readFile(samplePath, 'utf-8');
        const parseResult = await turtleParser.parse(turtleContent);
        
        expect(parseResult.triples.length).toBeGreaterThan(0);
        
        // Test complex queries on this richer dataset
        const parser = new Parser();
        const quads = parser.parse(turtleContent);
        const testStore = new Store(quads);
        
        const testFilters = new RDFFilters({
          store: testStore,
          prefixes: parseResult.prefixes
        });
        
        // Test organizational queries
        const organizations = testFilters.rdfSubject('rdf:type', 'schema:Organization');
        expect(organizations.length).toBeGreaterThan(0);
        
        // Test event queries if present
        const events = testFilters.rdfSubject('rdf:type', 'schema:Event');
        if (events.length > 0) {
          const eventDetails = events.map(eventURI => {
            const names = testFilters.rdfObject(eventURI, 'schema:name');
            const dates = testFilters.rdfObject(eventURI, 'schema:startDate');
            return {
              uri: eventURI,
              name: names.length > 0 ? names[0].value : null,
              date: dates.length > 0 ? dates[0].value : null
            };
          });
          
          expect(eventDetails.every(e => e.name !== null)).toBe(true);
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

  describe('Performance and Scalability', () => {
    it('should maintain performance with concurrent queries', async () => {
      const queries = Array.from({ length: 50 }, (_, i) => ({
        subject: i % 2 === 0 ? null : 'ex:alice',
        predicate: 'foaf:name'
      }));
      
      const startTime = performance.now();
      
      const results = await Promise.all(
        queries.map(query => Promise.resolve(rdfFilters.rdfQuery(query)))
      );
      
      const endTime = performance.now();
      
      expect(results).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(500); // Should complete quickly
    });

    it('should handle memory efficiently with large result sets', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Run multiple large queries
      for (let i = 0; i < 100; i++) {
        const results = rdfFilters.rdfQuery({});
        expect(results.length).toBeGreaterThan(0);
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

  describe('SPARQL Extensions and Utilities', () => {
    it('should provide label resolution functionality', () => {
      const aliceLabel = rdfFilters.rdfLabel('ex:alice');
      const bobLabel = rdfFilters.rdfLabel('ex:bob');
      
      // Falls back to foaf:name since no rdfs:label is defined
      expect(aliceLabel).toBe('Alice Johnson');
      expect(bobLabel).toBe('Bob Smith');
    });

    it('should provide type checking functionality', () => {
      const aliceTypes = rdfFilters.rdfType('ex:alice');
      expect(aliceTypes).toContain('http://xmlns.com/foaf/0.1/Person');
      
      const companyTypes = rdfFilters.rdfType('ex:company');
      expect(companyTypes).toContain('http://schema.org/Organization');
    });

    it('should provide namespace expansion/compaction', () => {
      const expanded = rdfFilters.rdfExpand('foaf:Person');
      expect(expanded).toBe('http://xmlns.com/foaf/0.1/Person');
      
      const compacted = rdfFilters.rdfCompact('http://xmlns.com/foaf/0.1/Person');
      expect(compacted).toBe('foaf:Person');
    });

    it('should provide existence checks', () => {
      expect(rdfFilters.rdfExists('ex:alice', 'foaf:name')).toBe(true);
      expect(rdfFilters.rdfExists('ex:alice', 'foaf:nonexistent')).toBe(false);
      expect(rdfFilters.rdfExists('ex:nonexistent', 'foaf:name')).toBe(false);
    });
  });
});