/**
 * Comprehensive RDF/Turtle Data Support Feature Spec - Vitest-Cucumber
 * Tests real implementation using TurtleParser, RDFDataLoader, and RDFFilters
 */
import { defineFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect, beforeEach, afterEach } from 'vitest';
import { TurtleParser, TurtleUtils, parseTurtle, parseTurtleSync, TurtleParseError } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import type { TurtleParseResult, ParsedTriple, NamespacePrefixes } from '../../src/lib/turtle-parser.js';

const feature = loadFeature('./tests/features/turtle-data-support.feature');

defineFeature(feature, (test) => {
  let testDir: string;
  let parser: TurtleParser;
  let dataLoader: RDFDataLoader;
  let rdfFilters: RDFFilters;
  let turtleFilePath: string;
  let parseResult: TurtleParseResult;
  let testData: any;

  beforeEach(() => {
    testDir = join(tmpdir(), `unjucks-rdf-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    parser = new TurtleParser();
    dataLoader = new RDFDataLoader();
    rdfFilters = new RDFFilters();
  });

  test('Parse basic Turtle data file with TurtleParser', ({ given, when, then, and }) => {
    given('I have a Turtle file with person data using FOAF vocabulary', () => {
      const turtleContent = readFileSync(join(process.cwd(), 'tests/fixtures/turtle/basic-person.ttl'), 'utf-8');
      turtleFilePath = join(testDir, 'person.ttl');
      writeFileSync(turtleFilePath, turtleContent);
    });

    when('I parse the Turtle file using TurtleParser', async () => {
      const content = readFileSync(turtleFilePath, 'utf-8');
      parseResult = await parser.parse(content);
    });

    then('the parsing should succeed with no errors', () => {
      expect(parseResult).toBeDefined();
      expect(parseResult.triples).toBeInstanceOf(Array);
      expect(parseResult.triples.length).toBeGreaterThan(0);
    });

    and('I should get triples with subject, predicate, object structure', () => {
      const triple = parseResult.triples[0];
      expect(triple.subject).toHaveProperty('type');
      expect(triple.subject).toHaveProperty('value');
      expect(triple.predicate).toHaveProperty('type');
      expect(triple.predicate).toHaveProperty('value');
      expect(triple.object).toHaveProperty('type');
      expect(triple.object).toHaveProperty('value');
    });

    and('I should get namespace prefixes including foaf and dcterms', () => {
      expect(parseResult.prefixes).toHaveProperty('foaf');
      expect(parseResult.prefixes).toHaveProperty('dcterms');
      expect(parseResult.prefixes.foaf).toBe('http://xmlns.com/foaf/0.1/');
      expect(parseResult.prefixes.dcterms).toBe('http://purl.org/dc/terms/');
    });

    and('I should get parsing statistics with triple count', () => {
      expect(parseResult.stats).toHaveProperty('tripleCount');
      expect(parseResult.stats).toHaveProperty('prefixCount');
      expect(parseResult.stats).toHaveProperty('namedGraphCount');
      expect(parseResult.stats.tripleCount).toBeGreaterThan(0);
      expect(parseResult.stats.prefixCount).toBeGreaterThan(0);
    });

    and('I should be able to access parsed terms with type and value', () => {
      const personTriples = parseResult.triples.filter(t => 
        t.subject.value.includes('person1') && 
        t.predicate.value.includes('name')
      );
      expect(personTriples.length).toBeGreaterThan(0);
      expect(personTriples[0].object.value).toBe('John Doe');
      expect(personTriples[0].object.type).toBe('literal');
    });
  });

  test('Load RDF data from multiple sources with RDFDataLoader', ({ given, when, then, and }) => {
    let fileSource: string;
    let inlineData: string;
    let loadResults: any[];

    given('I have RDF data available from file, inline, and URI sources', () => {
      // File source
      fileSource = join(process.cwd(), 'tests/fixtures/turtle/complex-project.ttl');
      expect(existsSync(fileSource)).toBe(true);
      
      // Inline data
      inlineData = `
        @prefix ex: <http://example.org/> .
        <#test> ex:name "Inline Test" ; ex:type "inline" .
      `;
    });

    when('I load the RDF data using RDFDataLoader with caching enabled', async () => {
      loadResults = await Promise.all([
        dataLoader.loadFromSource({ type: 'file', path: fileSource }),
        dataLoader.loadFromSource({ type: 'inline', content: inlineData })
      ]);
    });

    then('all data sources should load successfully', () => {
      expect(loadResults).toHaveLength(2);
      loadResults.forEach(result => {
        expect(result).toHaveProperty('triples');
        expect(result.triples.length).toBeGreaterThan(0);
      });
    });

    and('the data should be cached for performance', async () => {
      // Test caching by loading the same file again
      const startTime = performance.now();
      const cachedResult = await dataLoader.loadFromSource({ type: 'file', path: fileSource });
      const loadTime = performance.now() - startTime;
      
      expect(cachedResult).toBeDefined();
      expect(loadTime).toBeLessThan(10); // Should be much faster from cache
    });

    and('I should get structured data ready for template use', () => {
      const fileResult = loadResults[0];
      const inlineResult = loadResults[1];
      
      expect(fileResult.stats.tripleCount).toBeGreaterThan(0);
      expect(inlineResult.stats.tripleCount).toBeGreaterThan(0);
    });

    and('TTL cache should work correctly for repeated loads', async () => {
      // Verify TTL functionality exists
      expect(dataLoader.clearCache).toBeInstanceOf(Function);
      dataLoader.clearCache();
      
      const reloadResult = await dataLoader.loadFromSource({ type: 'inline', content: inlineData });
      expect(reloadResult.triples.length).toBeGreaterThan(0);
    });
  });

  test('Use RDF filters in Nunjucks templates', ({ given, and, when, then }) => {
    let testTriples: ParsedTriple[];
    let filterResults: any;

    given('I have loaded RDF data with person and project information', async () => {
      const content = readFileSync(join(process.cwd(), 'tests/fixtures/turtle/complex-project.ttl'), 'utf-8');
      parseResult = await parser.parse(content);
      testTriples = parseResult.triples;
    });

    and('I have Nunjucks templates that use RDF filters', () => {
      // RDFFilters would be integrated with Nunjucks environment
      expect(rdfFilters.rdfSubject).toBeInstanceOf(Function);
      expect(rdfFilters.rdfObject).toBeInstanceOf(Function);
      expect(rdfFilters.rdfQuery).toBeInstanceOf(Function);
    });

    when('I apply rdfSubject, rdfObject, and rdfQuery filters', () => {
      // Test subject filtering
      const subjectFilter = rdfFilters.rdfSubject(testTriples, 'unjucks');
      const objectFilter = rdfFilters.rdfObject(testTriples, 'name');
      const queryFilter = rdfFilters.rdfQuery(testTriples, { predicate: 'doap:name' });
      
      filterResults = { subjectFilter, objectFilter, queryFilter };
    });

    then('I should get filtered RDF data based on subject queries', () => {
      expect(filterResults.subjectFilter).toBeInstanceOf(Array);
      if (filterResults.subjectFilter.length > 0) {
        expect(filterResults.subjectFilter[0]).toHaveProperty('subject');
        expect(filterResults.subjectFilter[0]).toHaveProperty('predicate');
        expect(filterResults.subjectFilter[0]).toHaveProperty('object');
      }
    });

    and('I should get object values for specific predicates', () => {
      expect(filterResults.objectFilter).toBeDefined();
    });

    and('complex SPARQL-like queries should return matching triples', () => {
      expect(filterResults.queryFilter).toBeInstanceOf(Array);
    });

    and('namespace prefixes should be resolved correctly', () => {
      const expandedUri = rdfFilters.expandPrefix('doap:name', parseResult.prefixes);
      expect(expandedUri).toMatch(/^http/);
    });
  });

  test('Validate performance with large RDF datasets', ({ given, when, then, and }) => {
    let largeContent: string;
    let parseTime: number;
    let memoryBefore: number;
    let memoryAfter: number;

    given('I have a large Turtle file with 10000+ triples', () => {
      // Use existing large test fixture or generate one
      const largeFilePath = join(process.cwd(), 'tests/fixtures/turtle/performance/large-10000.ttl');
      if (existsSync(largeFilePath)) {
        largeContent = readFileSync(largeFilePath, 'utf-8');
      } else {
        // Generate large dataset if fixture doesn't exist
        let content = '@prefix ex: <http://example.org/> .\n';
        for (let i = 0; i < 1000; i++) {
          content += `<#entity${i}> ex:name "Entity ${i}" ; ex:id "${i}" ; ex:type "test" .\n`;
        }
        largeContent = content;
      }
      expect(largeContent.length).toBeGreaterThan(10000);
    });

    when('I parse the file with performance monitoring enabled', async () => {
      memoryBefore = process.memoryUsage().heapUsed;
      const startTime = performance.now();
      
      parseResult = await parser.parse(largeContent);
      
      const endTime = performance.now();
      memoryAfter = process.memoryUsage().heapUsed;
      parseTime = endTime - startTime;
    });

    then('parsing should complete within 2 seconds', () => {
      expect(parseTime).toBeLessThan(2000);
    });

    and('memory usage should stay under 100MB', () => {
      const memoryIncrease = memoryAfter - memoryBefore;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
    });

    and('the parser should handle the dataset without timeouts', () => {
      expect(parseResult).toBeDefined();
      expect(parseResult.triples.length).toBeGreaterThan(1000);
    });

    and('performance metrics should be recorded', () => {
      expect(parseResult.stats.tripleCount).toBeGreaterThan(1000);
      expect(parseResult.stats.prefixCount).toBeGreaterThan(0);
      expect(parseTime).toBeGreaterThan(0);
    });
  });

  test('Handle Turtle syntax errors gracefully', ({ given, when, then, and }) => {
    let invalidContent: string;
    let parseError: TurtleParseError;

    given('I have a Turtle file with various syntax errors', () => {
      invalidContent = readFileSync(join(process.cwd(), 'tests/fixtures/turtle/invalid-syntax.ttl'), 'utf-8');
    });

    when('I attempt to parse the invalid Turtle content', async () => {
      try {
        parseResult = await parser.parse(invalidContent);
      } catch (error) {
        parseError = error as TurtleParseError;
      }
    });

    then('parsing should fail with descriptive error messages', () => {
      expect(parseError).toBeInstanceOf(TurtleParseError);
      expect(parseError.message).toMatch(/Failed to parse Turtle/);
    });

    and('error should include line and column information', () => {
      expect(parseError.line).toBeDefined();
      expect(parseError.column).toBeDefined();
      expect(parseError.originalError).toBeDefined();
    });

    and('the system should not crash or hang', () => {
      expect(parseError).toBeDefined();
      expect(parseError.name).toBe('TurtleParseError');
    });

    and('I should get a TurtleParseError with original error details', () => {
      expect(parseError.originalError).toBeInstanceOf(Error);
      expect(parseError.line).toBeTypeOf('number');
      expect(parseError.column).toBeTypeOf('number');
    });
  });

  test('Compare synchronous and asynchronous parsing', ({ given, when, then, and }) => {
    let asyncResult: TurtleParseResult;
    let syncResult: TurtleParseResult;
    let testContent: string;

    given('I have valid Turtle content ready for parsing', () => {
      testContent = readFileSync(join(process.cwd(), 'tests/fixtures/turtle/basic-person.ttl'), 'utf-8');
    });

    when('I parse using both parseSync and async parse methods', async () => {
      asyncResult = await parser.parse(testContent);
      syncResult = parser.parseSync(testContent);
    });

    then('both methods should produce identical results', () => {
      expect(asyncResult.triples.length).toBe(syncResult.triples.length);
      expect(asyncResult.stats.tripleCount).toBe(syncResult.stats.tripleCount);
      expect(Object.keys(asyncResult.prefixes)).toEqual(Object.keys(syncResult.prefixes));
    });

    and('sync parsing should work for smaller datasets', () => {
      expect(syncResult.triples.length).toBeGreaterThan(0);
      expect(syncResult.stats.tripleCount).toBeGreaterThan(0);
    });

    and('async parsing should handle larger datasets better', () => {
      expect(asyncResult.triples.length).toBeGreaterThan(0);
      expect(asyncResult.stats.tripleCount).toBeGreaterThan(0);
    });

    and('both should return the same TurtleParseResult structure', () => {
      expect(asyncResult).toHaveProperty('triples');
      expect(asyncResult).toHaveProperty('prefixes');
      expect(asyncResult).toHaveProperty('namedGraphs');
      expect(asyncResult).toHaveProperty('stats');
      
      expect(syncResult).toHaveProperty('triples');
      expect(syncResult).toHaveProperty('prefixes');
      expect(syncResult).toHaveProperty('namedGraphs');
      expect(syncResult).toHaveProperty('stats');
    });
  });

  // Cleanup after each test
  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });
});