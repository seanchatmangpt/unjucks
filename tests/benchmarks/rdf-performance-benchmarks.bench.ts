import { bench, describe } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { TurtleParser, TurtleUtils, parseTurtle, parseTurtleSync } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import type { RDFDataSource } from '../../src/lib/types/turtle-types.js';

/**
 * Vitest Benchmark Suite for RDF/Turtle Performance
 * Uses Vitest's built-in benchmark functionality for precise measurements
 */

// Test data generator
class TestDataGenerator {
  static generateTurtleData(tripleCount: number, prefix: string = 'ex'): string {
    const prefixDeclaration = `@prefix ${prefix}: <http://example.org/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

`;

    const triples: string[] = [];
    
    for (let i = 0; i < tripleCount; i++) {
      const subject = `${prefix}:entity${i}`;
      const predicateType = i % 4;
      
      switch (predicateType) {
        case 0:
          triples.push(`${subject} rdf:type ${prefix}:Entity .`);
          break;
        case 1:
          triples.push(`${subject} rdfs:label "Entity ${i}" .`);
          break;
        case 2:
          triples.push(`${subject} ${prefix}:hasValue ${i} .`);
          break;
        case 3:
          triples.push(`${subject} ${prefix}:relatedTo ${prefix}:entity${(i + 1) % tripleCount} .`);
          break;
      }
    }

    return prefixDeclaration + triples.join('\n');
  }
}

// Pre-generate test data
const smallData = TestDataGenerator.generateTurtleData(100);
const mediumData = TestDataGenerator.generateTurtleData(1000);
const largeData = TestDataGenerator.generateTurtleData(10000);

// Pre-setup parsers and data loaders
const parser = new TurtleParser();
const dataLoader = new RDFDataLoader();

describe('RDF/Turtle Parsing Benchmarks', () => {
  bench('parse small file (100 triples)', async () => {
    await parseTurtle(smallData);
  }, { iterations: 100, time: 1000 });

  bench('parse medium file (1000 triples)', async () => {
    await parseTurtle(mediumData);
  }, { iterations: 50, time: 1000 });

  bench('parse large file (10000 triples)', async () => {
    await parseTurtle(largeData);
  }, { iterations: 10, time: 1000 });

  bench('parse sync small file (100 triples)', () => {
    parseTurtleSync(smallData);
  }, { iterations: 100, time: 1000 });

  bench('parse sync medium file (1000 triples)', () => {
    parseTurtleSync(mediumData);
  }, { iterations: 50, time: 1000 });
});

describe('RDF Query Benchmarks', () => {
  let parsedData: any;
  let rdfFilters: RDFFilters;

  // Setup for query benchmarks
  beforeAll(async () => {
    parsedData = await parseTurtle(mediumData);
    const store = await parser.createStore(mediumData);
    rdfFilters = new RDFFilters({ store });
  });

  bench('simple pattern query', () => {
    TurtleUtils.filterByPredicate(
      parsedData.triples,
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    );
  }, { iterations: 1000, time: 1000 });

  bench('RDF filter query', () => {
    rdfFilters.rdfObject('http://example.org/entity1', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
  }, { iterations: 1000, time: 1000 });

  bench('complex SPARQL-like query', () => {
    const types = rdfFilters.rdfQuery({
      predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    });
    const labels = rdfFilters.rdfQuery({
      predicate: 'http://www.w3.org/2000/01/rdf-schema#label'
    });
    return { types, labels };
  }, { iterations: 100, time: 1000 });

  bench('concurrent queries', async () => {
    const queries = Array.from({ length: 10 }, (_, i) => 
      Promise.resolve(rdfFilters.rdfObject(`http://example.org/entity${i}`, 'http://www.w3.org/2000/01/rdf-schema#label'))
    );
    await Promise.all(queries);
  }, { iterations: 50, time: 1000 });
});

describe('RDF Template Rendering Benchmarks', () => {
  const rdfSource: RDFDataSource = {
    type: 'inline',
    source: TestDataGenerator.generateTurtleData(100)
  };

  bench('simple RDF template rendering', async () => {
    const loadResult = await dataLoader.loadFromSource(rdfSource);
    const context = dataLoader.createTemplateContext(loadResult.data, loadResult.variables);
    
    return {
      subjects: Object.keys(context.$rdf.subjects).length,
      prefixes: Object.keys(context.$rdf.prefixes).length
    };
  }, { iterations: 100, time: 1000 });

  bench('complex template generation', async () => {
    const loadResult = await dataLoader.loadFromSource(rdfSource);
    const context = dataLoader.createTemplateContext(loadResult.data, loadResult.variables);
    
    const subjects = Object.values(context.$rdf.subjects);
    return subjects.map(subject => ({
      uri: subject.uri,
      typeCount: (subject.type || []).length,
      propertyCount: Object.keys(subject.properties).length
    }));
  }, { iterations: 50, time: 1000 });
});

describe('RDF Data Loading Benchmarks', () => {
  bench('load inline data', async () => {
    await dataLoader.loadFromSource({
      type: 'inline',
      source: smallData
    });
  }, { iterations: 100, time: 1000 });

  bench('validate RDF data', async () => {
    await dataLoader.validateRDF(smallData, 'turtle');
  }, { iterations: 100, time: 1000 });
});

describe('RDF Error Handling Benchmarks', () => {
  const invalidTurtle = 'invalid turtle syntax @#$%^&*()';

  bench('handle parsing errors', async () => {
    try {
      await parseTurtle(invalidTurtle);
      return false;
    } catch (error) {
      return true;
    }
  }, { iterations: 100, time: 1000 });
});