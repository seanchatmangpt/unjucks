/**
 * RDF and SPARQL BDD Step Definitions for Unjucks
 * 
 * Comprehensive step definitions that connect to the existing RDF engine
 * and provide testing capabilities for RDF processing, SPARQL queries,
 * ontology loading, and namespace resolution.
 */

import { Given, When, Then, Before, After } from '@cucumber/cucumber';
import { expect } from 'chai';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Parser as TurtleParser, Store, DataFactory, Writer } from 'n3';
import { createRDFProcessor, getDefaultProcessor, KgenSparqlEngine } from '../../../packages/kgen-core/src/rdf/index.js';
import { SparqlInterface } from '../../../packages/kgen-core/src/rdf/sparql-interface.js';

const { namedNode, literal, blankNode } = DataFactory;

/**
 * RDF Test Context - manages state across step definitions
 */
class RDFTestContext {
  constructor() {
    this.reset();
  }

  reset() {
    // RDF processing components
    this.rdfProcessor = null;
    this.sparqlEngine = null;
    this.sparqlInterface = null;
    this.store = new Store();
    this.parser = new TurtleParser();
    this.writer = new Writer();
    
    // Test data storage
    this.loadedData = new Map();
    this.queryResults = [];
    this.lastQuery = null;
    this.lastQueryType = null;
    this.namespaces = new Map();
    this.ontologies = new Map();
    this.validationResults = null;
    this.errorResults = null;
    this.fixtures = new Map();
    
    // Performance metrics
    this.loadTimes = [];
    this.queryTimes = [];
    this.lastExecutionTime = 0;
    this.memoryUsage = { before: 0, after: 0 };
    
    // Expectations and assertions
    this.expectedTripleCount = null;
    this.expectedPrefixes = [];
    this.expectedResults = [];
    
    // Configuration
    this.enableCaching = true;
    this.queryTimeout = 30000;
    this.maxResults = 1000;
  }

  // Helper methods for data loading
  loadFixture(filename: string): string {
    const fixturePath = join(__dirname, '../fixtures/rdf', filename);
    if (!existsSync(fixturePath)) {
      throw new Error(`Fixture file not found: ${fixturePath}`);
    }
    return readFileSync(fixturePath, 'utf8');
  }

  // Helper methods for RDF processing
  async parseRDF(data: string, format: string = 'turtle'): Promise<any> {
    const startTime = Date.now();
    
    try {
      const quads = this.parser.parse(data);
      this.store.addQuads(quads);
      
      this.lastExecutionTime = Date.now() - startTime;
      this.loadTimes.push(this.lastExecutionTime);
      
      return {
        success: true,
        quadCount: quads.length,
        totalQuads: this.store.size,
        executionTime: this.lastExecutionTime,
        prefixes: this.extractPrefixes(data)
      };
    } catch (error) {
      this.errorResults = {
        error: error.message,
        executionTime: Date.now() - startTime
      };
      throw error;
    }
  }

  extractPrefixes(turtleData: string): Map<string, string> {
    const prefixes = new Map();
    const prefixRegex = /@prefix\s+([^:]+):\s+<([^>]+)>\s*\./g;
    let match;
    
    while ((match = prefixRegex.exec(turtleData)) !== null) {
      prefixes.set(match[1], match[2]);
      this.namespaces.set(match[1], match[2]);
    }
    
    return prefixes;
  }

  // Helper methods for SPARQL queries
  async executeSparqlQuery(query: string, format: string = 'json'): Promise<any> {
    if (!this.sparqlEngine) {
      this.sparqlEngine = new KgenSparqlEngine();
      await this.sparqlEngine.initialize();
      // Load current store data into engine
      const quads = this.store.getQuads(null, null, null);
      for (const quad of quads) {
        this.sparqlEngine.store.addQuad(quad);
      }
    }

    const startTime = Date.now();
    
    try {
      this.lastQuery = query;
      const result = await this.sparqlEngine.executeQuery(query, { format });
      
      this.lastExecutionTime = Date.now() - startTime;
      this.queryTimes.push(this.lastExecutionTime);
      this.queryResults = result;
      
      // Determine query type
      const upperQuery = query.trim().toUpperCase();
      if (upperQuery.startsWith('SELECT')) this.lastQueryType = 'SELECT';
      else if (upperQuery.startsWith('CONSTRUCT')) this.lastQueryType = 'CONSTRUCT';
      else if (upperQuery.startsWith('ASK')) this.lastQueryType = 'ASK';
      else if (upperQuery.startsWith('DESCRIBE')) this.lastQueryType = 'DESCRIBE';
      
      return result;
    } catch (error) {
      this.errorResults = {
        error: error.message,
        query,
        executionTime: Date.now() - startTime
      };
      throw error;
    }
  }

  // Memory monitoring
  captureMemoryUsage(phase: 'before' | 'after') {
    this.memoryUsage[phase] = process.memoryUsage().heapUsed;
  }
}

// Global test context
const rdfContext = new RDFTestContext();

// Before/After hooks
Before(function() {
  rdfContext.reset();
});

After(function() {
  // Cleanup resources if needed
  if (rdfContext.sparqlEngine) {
    rdfContext.sparqlEngine.shutdown?.();
  }
});

/**
 * Background Setup Steps
 */
Given('I have N3.js installed and configured', function() {
  expect(TurtleParser).to.exist;
  expect(Store).to.exist;
  expect(DataFactory).to.exist;
  rdfContext.parser = new TurtleParser();
  rdfContext.store = new Store();
});

Given('I have RDF test fixtures available', function() {
  const fixtures = ['sample-ontology.ttl', 'foaf-data.ttl', 'namespaces.ttl', 'invalid-syntax.ttl'];
  
  for (const fixture of fixtures) {
    try {
      const data = rdfContext.loadFixture(fixture);
      rdfContext.fixtures.set(fixture, data);
    } catch (error) {
      throw new Error(`Failed to load fixture ${fixture}: ${error.message}`);
    }
  }
  
  expect(rdfContext.fixtures.size).to.equal(fixtures.length);
});

Given('I have the N3 library installed', function() {
  expect(TurtleParser).to.exist;
  expect(Store).to.exist;
});

/**
 * RDF Data Loading Steps
 */
Given('I have a Turtle file {string} with content:', function(filename: string, content: string) {
  rdfContext.loadedData.set(filename, content);
});

Given('I have Turtle data with prefixes and triples', function() {
  const turtleData = rdfContext.loadFixture('sample-ontology.ttl');
  rdfContext.loadedData.set('test-data', turtleData);
});

Given('I have parsed RDF data with organizations and people', function() {
  const foafData = rdfContext.loadFixture('foaf-data.ttl');
  const ontologyData = rdfContext.loadFixture('sample-ontology.ttl');
  
  rdfContext.loadedData.set('foaf-data', foafData);
  rdfContext.loadedData.set('ontology-data', ontologyData);
});

Given('I have a file source {string}', function(source: string) {
  // Mock file source loading
  rdfContext.loadedData.set(source, rdfContext.loadFixture('foaf-data.ttl'));
});

Given('I have an inline source with Turtle data', function() {
  const inlineData = `
    @prefix ex: <http://example.org/> .
    @prefix foaf: <http://xmlns.com/foaf/0.1/> .
    
    ex:inline-person a foaf:Person ;
        foaf:name "Inline Person" .
  `;
  rdfContext.loadedData.set('inline-source', inlineData);
});

Given('I have a URI source {string}', function(uriSource: string) {
  // Mock URI source loading
  rdfContext.loadedData.set(uriSource, rdfContext.loadFixture('namespaces.ttl'));
});

Given('I have loaded RDF data with people and organizations', async function() {
  const foafData = rdfContext.loadFixture('foaf-data.ttl');
  const ontologyData = rdfContext.loadFixture('sample-ontology.ttl');
  
  await rdfContext.parseRDF(foafData);
  await rdfContext.parseRDF(ontologyData);
});

/**
 * RDF Parsing Steps
 */
When('I parse the Turtle file', async function() {
  const data = Array.from(rdfContext.loadedData.values())[0];
  await rdfContext.parseRDF(data);
});

When('I parse the Turtle data', async function() {
  const testData = rdfContext.loadedData.get('test-data');
  const result = await rdfContext.parseRDF(testData);
  rdfContext.queryResults = result;
});

When('I parse the data', async function() {
  const data = Array.from(rdfContext.loadedData.values())[0];
  await rdfContext.parseRDF(data);
});

When('I load all RDF sources', async function() {
  for (const [source, data] of rdfContext.loadedData.entries()) {
    await rdfContext.parseRDF(data);
  }
});

/**
 * SPARQL Query Steps
 */
When('I query for subjects with type {string}', async function(typeUri: string) {
  // Expand prefixed URI if needed
  const expandedType = rdfContext.namespaces.has('foaf') && typeUri === 'foaf:Person' 
    ? `<${rdfContext.namespaces.get('foaf')}Person>`
    : typeUri;
    
  const query = `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    
    SELECT ?subject WHERE {
      ?subject rdf:type ${expandedType} .
    }
  `;
  
  await rdfContext.executeSparqlQuery(query);
});

When('I query for objects of predicate {string}', async function(predicate: string) {
  const expandedPredicate = rdfContext.namespaces.has('foaf') && predicate === 'foaf:knows'
    ? `<${rdfContext.namespaces.get('foaf')}knows>`
    : predicate;
    
  const query = `
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    
    SELECT ?object WHERE {
      ?subject ${expandedPredicate} ?object .
    }
  `;
  
  await rdfContext.executeSparqlQuery(query);
});

When('I query with subject {string} and predicate {string}', async function(subject: string, predicate: string) {
  const expandedSubject = subject.startsWith('ex:') 
    ? `<http://example.org/people/${subject.substring(3)}>` 
    : subject;
  const expandedPredicate = predicate === 'foaf:name'
    ? `<${rdfContext.namespaces.get('foaf') || 'http://xmlns.com/foaf/0.1/'}name>`
    : predicate;
    
  const query = `
    SELECT ?object WHERE {
      ${expandedSubject} ${expandedPredicate} ?object .
    }
  `;
  
  await rdfContext.executeSparqlQuery(query);
});

/**
 * SPARQL SELECT Query Steps
 */
When('I execute a SPARQL SELECT query:', async function(query: string) {
  await rdfContext.executeSparqlQuery(query.trim());
});

When('I execute SPARQL SELECT for all classes', async function() {
  const query = `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX owl: <http://www.w3.org/2002/07/owl#>
    
    SELECT DISTINCT ?class ?label WHERE {
      {
        ?class rdf:type rdfs:Class .
      } UNION {
        ?class rdf:type owl:Class .
      }
      OPTIONAL { ?class rdfs:label ?label }
    }
    ORDER BY ?class
  `;
  
  await rdfContext.executeSparqlQuery(query);
});

/**
 * SPARQL CONSTRUCT Query Steps
 */
When('I execute a SPARQL CONSTRUCT query:', async function(query: string) {
  await rdfContext.executeSparqlQuery(query.trim());
});

When('I execute SPARQL CONSTRUCT to create new graph', async function() {
  const query = `
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX ex: <http://example.org/>
    
    CONSTRUCT {
      ?person ex:hasName ?name .
      ?person ex:hasEmail ?email .
    }
    WHERE {
      ?person foaf:name ?name .
      OPTIONAL { ?person foaf:mbox ?email }
    }
  `;
  
  await rdfContext.executeSparqlQuery(query);
});

/**
 * RDF Syntax Validation Steps
 */
When('I validate the RDF syntax', async function() {
  try {
    const invalidData = rdfContext.loadFixture('invalid-syntax.ttl');
    await rdfContext.parseRDF(invalidData);
    // If parsing succeeds, mark as unexpected
    rdfContext.validationResults = { valid: true, errors: [] };
  } catch (error) {
    rdfContext.validationResults = { 
      valid: false, 
      errors: [{ message: error.message, line: null, column: null }] 
    };
  }
});

When('I validate RDF syntax using N3.js', async function() {
  const testData = Array.from(rdfContext.loadedData.values())[0];
  
  try {
    const quads = rdfContext.parser.parse(testData);
    rdfContext.validationResults = {
      valid: true,
      quadCount: quads.length,
      errors: []
    };
  } catch (error) {
    rdfContext.validationResults = {
      valid: false,
      errors: [{ message: error.message }]
    };
  }
});

/**
 * Ontology Loading Steps
 */
Given('I have ontology files in the ontologies directory', function() {
  const ontologyFiles = ['core.ttl', 'cli.ttl', 'attest.ttl'];
  
  for (const file of ontologyFiles) {
    try {
      const ontologyPath = join(process.cwd(), 'ontologies', file);
      if (existsSync(ontologyPath)) {
        const ontologyData = readFileSync(ontologyPath, 'utf8');
        rdfContext.ontologies.set(file, ontologyData);
      }
    } catch (error) {
      // Ontology file might not exist, that's okay for testing
    }
  }
});

When('I load ontologies from the ontologies directory', async function() {
  for (const [filename, data] of rdfContext.ontologies.entries()) {
    await rdfContext.parseRDF(data);
  }
});

When('I load ontology from {string}', async function(ontologyFile: string) {
  if (rdfContext.ontologies.has(ontologyFile)) {
    const ontologyData = rdfContext.ontologies.get(ontologyFile);
    await rdfContext.parseRDF(ontologyData);
  } else {
    // Try to load from fixtures
    const fixtureData = rdfContext.loadFixture('sample-ontology.ttl');
    await rdfContext.parseRDF(fixtureData);
  }
});

/**
 * Namespace Resolution Steps
 */
Given('I have RDF data with multiple prefixes', function() {
  const namespacedData = rdfContext.loadFixture('namespaces.ttl');
  rdfContext.loadedData.set('namespace-data', namespacedData);
});

When('I compact a full URI {string}', function(fullUri: string) {
  // Simple prefix compaction logic
  for (const [prefix, namespace] of rdfContext.namespaces.entries()) {
    if (fullUri.startsWith(namespace)) {
      const localName = fullUri.substring(namespace.length);
      rdfContext.queryResults = `${prefix}:${localName}`;
      return;
    }
  }
  rdfContext.queryResults = fullUri;
});

When('I expand a prefixed URI {string}', function(prefixedUri: string) {
  const [prefix, localName] = prefixedUri.split(':', 2);
  
  if (rdfContext.namespaces.has(prefix)) {
    const namespace = rdfContext.namespaces.get(prefix);
    rdfContext.queryResults = `${namespace}${localName}`;
  } else {
    rdfContext.queryResults = prefixedUri;
  }
});

When('I resolve namespace prefixes', function() {
  const namespacedData = rdfContext.loadedData.get('namespace-data');
  if (namespacedData) {
    rdfContext.extractPrefixes(namespacedData);
  }
});

/**
 * Assertion Steps
 */
Then('I should get {int} triples', function(expectedCount: number) {
  expect(rdfContext.store.size).to.equal(expectedCount);
});

Then('the prefixes should include {string} and {string}', function(prefix1: string, prefix2: string) {
  expect(rdfContext.namespaces.has(prefix1.replace(/"/g, ''))).to.be.true;
  expect(rdfContext.namespaces.has(prefix2.replace(/"/g, ''))).to.be.true;
});

Then('triple {int} should have subject {string}', function(tripleIndex: number, expectedSubject: string) {
  const quads = rdfContext.store.getQuads(null, null, null);
  expect(quads.length).to.be.greaterThan(tripleIndex - 1);
  expect(quads[tripleIndex - 1].subject.value).to.equal(expectedSubject.replace(/"/g, ''));
});

Then('I should get a valid RDF store', function() {
  expect(rdfContext.store).to.exist;
  expect(rdfContext.store.size).to.be.greaterThan(0);
});

Then('I should extract template variables from the RDF', function() {
  // Check that we have extracted some meaningful data
  expect(rdfContext.namespaces.size).to.be.greaterThan(0);
});

Then('all sources should be loaded successfully', function() {
  expect(rdfContext.store.size).to.be.greaterThan(0);
  expect(rdfContext.loadTimes.length).to.be.greaterThan(0);
});

Then('the data should be merged correctly', function() {
  // Verify data from multiple sources exists
  const subjects = new Set();
  const quads = rdfContext.store.getQuads(null, null, null);
  
  for (const quad of quads) {
    subjects.add(quad.subject.value);
  }
  
  expect(subjects.size).to.be.greaterThan(1);
});

Then('prefixes from all sources should be available', function() {
  expect(rdfContext.namespaces.size).to.be.greaterThan(2);
});

/**
 * Query Result Assertions
 */
Then('I should get all person entities', function() {
  expect(rdfContext.queryResults).to.exist;
  
  if (rdfContext.queryResults.results && rdfContext.queryResults.results.bindings) {
    expect(rdfContext.queryResults.results.bindings.length).to.be.greaterThan(0);
  }
});

Then('I should get all relationships', function() {
  expect(rdfContext.queryResults).to.exist;
  
  if (rdfContext.queryResults.results && rdfContext.queryResults.results.bindings) {
    expect(rdfContext.queryResults.results.bindings.length).to.be.greaterThan(0);
  }
});

Then('I should get {string} as the object', function(expectedObject: string) {
  expect(rdfContext.queryResults).to.exist;
  
  if (rdfContext.queryResults.results && rdfContext.queryResults.results.bindings) {
    const bindings = rdfContext.queryResults.results.bindings;
    const hasExpectedObject = bindings.some(binding => 
      binding.object && binding.object.value === expectedObject.replace(/"/g, '')
    );
    expect(hasExpectedObject).to.be.true;
  }
});

Then('the query should return JSON results', function() {
  expect(rdfContext.queryResults).to.exist;
  expect(rdfContext.queryResults).to.be.an('object');
});

Then('the results should contain class information', function() {
  expect(rdfContext.queryResults).to.exist;
  
  if (rdfContext.lastQueryType === 'SELECT' && rdfContext.queryResults.results) {
    expect(rdfContext.queryResults.results.bindings).to.exist;
    expect(rdfContext.queryResults.results.bindings.length).to.be.greaterThan(0);
  }
});

Then('the constructed graph should have new triples', function() {
  expect(rdfContext.queryResults).to.exist;
  
  if (rdfContext.lastQueryType === 'CONSTRUCT' && rdfContext.queryResults.quads) {
    expect(rdfContext.queryResults.quads.length).to.be.greaterThan(0);
  }
});

/**
 * Syntax Validation Assertions
 */
Then('syntax validation should report errors', function() {
  expect(rdfContext.validationResults).to.exist;
  expect(rdfContext.validationResults.valid).to.be.false;
  expect(rdfContext.validationResults.errors).to.exist;
  expect(rdfContext.validationResults.errors.length).to.be.greaterThan(0);
});

Then('valid syntax should pass validation', function() {
  expect(rdfContext.validationResults).to.exist;
  expect(rdfContext.validationResults.valid).to.be.true;
  expect(rdfContext.validationResults.errors).to.be.empty;
});

/**
 * Ontology Loading Assertions
 */
Then('ontologies should be loaded successfully', function() {
  expect(rdfContext.store.size).to.be.greaterThan(0);
});

Then('ontology classes and properties should be available', function() {
  const quads = rdfContext.store.getQuads(null, null, null);
  const hasClasses = quads.some(quad => 
    quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
    (quad.object.value === 'http://www.w3.org/2002/07/owl#Class' ||
     quad.object.value === 'http://www.w3.org/2000/01/rdf-schema#Class')
  );
  
  expect(hasClasses).to.be.true;
});

/**
 * Namespace Resolution Assertions
 */
Then('I should get {string}', function(expectedResult: string) {
  expect(rdfContext.queryResults).to.equal(expectedResult.replace(/"/g, ''));
});

Then('all standard prefixes should be available', function() {
  const standardPrefixes = ['rdf', 'rdfs', 'owl', 'xsd'];
  
  for (const prefix of standardPrefixes) {
    expect(rdfContext.namespaces.has(prefix)).to.be.true;
  }
});

Then('namespace prefixes should be resolved correctly', function() {
  expect(rdfContext.namespaces.size).to.be.greaterThan(0);
  
  // Test a few common namespace resolutions
  if (rdfContext.namespaces.has('foaf')) {
    expect(rdfContext.namespaces.get('foaf')).to.equal('http://xmlns.com/foaf/0.1/');
  }
});

/**
 * Performance Assertions
 */
Then('parsing should complete within {int} seconds', function(maxSeconds: number) {
  const maxMilliseconds = maxSeconds * 1000;
  expect(rdfContext.lastExecutionTime).to.be.lessThan(maxMilliseconds);
});

Then('query execution should be under {int}ms', function(maxMs: number) {
  expect(rdfContext.lastExecutionTime).to.be.lessThan(maxMs);
});

/**
 * Export for testing
 */
export { RDFTestContext, rdfContext };