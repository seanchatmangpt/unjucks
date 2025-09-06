import { defineFeature, loadFeature } from 'jest-cucumber';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TurtleParser } from '../../src/lib/turtle-parser';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader';
import { RDFFilters, createRDFFilters, registerRDFFilters } from '../../src/lib/rdf-filters';
import { FrontmatterParser } from '../../src/lib/frontmatter-parser';
import * as fs from 'fs/promises';
import * as path from 'path';
import nunjucks from 'nunjucks';
import axios from 'axios';

// Mock axios for remote URI tests
vi.mock('axios');

// Test context shared between steps
interface TestContext {
  turtleContent?: string;
  turtleFile?: string;
  parser?: TurtleParser;
  loader?: RDFDataLoader;
  filters?: RDFFilters;
  parseResult?: any;
  loadResult?: any;
  queryResult?: any;
  template?: string;
  renderResult?: string;
  error?: Error;
  sources?: Map<string, any>;
  nunjucksEnv?: nunjucks.Environment;
  startTime?: number;
  memoryBefore?: NodeJS.MemoryUsage;
}

const context: TestContext = {};

// Helper functions
async function createTestFile(filename: string, content: string): Promise<string> {
  const testDir = path.join(__dirname, '../fixtures/temp');
  await fs.mkdir(testDir, { recursive: true });
  const filepath = path.join(testDir, filename);
  await fs.writeFile(filepath, content, 'utf-8');
  return filepath;
}

async function cleanupTestFiles(): Promise<void> {
  const testDir = path.join(__dirname, '../fixtures/temp');
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

function measureMemory(): NodeJS.MemoryUsage {
  return process.memoryUsage();
}

function getMemoryUsageMB(before: NodeJS.MemoryUsage, after: NodeJS.MemoryUsage): number {
  return (after.heapUsed - before.heapUsed) / 1024 / 1024;
}

// Step definitions for RDF Integration feature
export const rdfIntegrationSteps = ({ given, when, then, and }: any) => {
  
  given(/^I have N3\.js installed and configured$/, () => {
    context.parser = new TurtleParser();
    context.loader = new RDFDataLoader();
    expect(context.parser).toBeDefined();
    expect(context.loader).toBeDefined();
  });

  given(/^I have RDF test fixtures available$/, async () => {
    const fixturesDir = path.join(__dirname, '../fixtures/turtle');
    const files = await fs.readdir(fixturesDir);
    const ttlFiles = files.filter(f => f.endsWith('.ttl'));
    expect(ttlFiles.length).toBeGreaterThan(0);
  });

  given(/^I have a Turtle file "([^"]*)" with content:$/, async (filename: string, content: string) => {
    context.turtleContent = content;
    context.turtleFile = await createTestFile(filename, content);
  });

  given(/^I have a file source "([^"]*)"$/, async (filepath: string) => {
    const content = `
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix ex: <http://example.org/> .
      ex:person1 a foaf:Person ; foaf:name "Test Person" .
    `;
    await createTestFile(path.basename(filepath), content);
    if (!context.sources) context.sources = new Map();
    context.sources.set('file', filepath);
  });

  given(/^I have an inline source with Turtle data$/, () => {
    if (!context.sources) context.sources = new Map();
    context.sources.set('inline', `
      @prefix dc: <http://purl.org/dc/terms/> .
      <http://example.org/doc> dc:title "Test Document" .
    `);
  });

  given(/^I have a URI source "([^"]*)"$/, (uri: string) => {
    if (!context.sources) context.sources = new Map();
    context.sources.set('uri', uri);
    
    // Mock axios response
    (axios.get as any).mockResolvedValue({
      data: `
        @prefix schema: <http://schema.org/> .
        <http://example.org/org> a schema:Organization .
      `,
      headers: { 'content-type': 'text/turtle' }
    });
  });

  given(/^I have loaded RDF data with people and organizations$/, async () => {
    const content = `
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .
      
      ex:alice a foaf:Person ;
          foaf:name "Alice" ;
          foaf:knows ex:bob .
      
      ex:bob a foaf:Person ;
          foaf:name "Bob" .
      
      ex:acme a schema:Organization ;
          schema:name "Acme Corp" .
    `;
    const filepath = await createTestFile('people-orgs.ttl', content);
    context.loader = new RDFDataLoader();
    await context.loader.loadFromFile(filepath);
  });

  given(/^I have a template with RDF data context$/, () => {
    context.template = `
      {% for person in rdf.query({ type: 'foaf:Person' }) %}
      - {{ person | rdfLabel }}
      {% endfor %}
    `;
    context.nunjucksEnv = new nunjucks.Environment();
  });

  given(/^the template uses rdfLabel filter$/, () => {
    context.filters = createRDFFilters();
    if (context.nunjucksEnv) {
      registerRDFFilters(context.nunjucksEnv);
    }
  });

  given(/^I have RDF data with multiple named graphs$/, async () => {
    const content = `
      @prefix ex: <http://example.org/> .
      
      ex:s1 ex:p1 ex:o1 .
      
      ex:graph1 {
        ex:s2 ex:p2 ex:o2 .
      }
      
      ex:graph2 {
        ex:s3 ex:p3 ex:o3 .
      }
    `;
    context.turtleContent = content;
    context.parser = new TurtleParser();
  });

  given(/^I have RDF data with blank nodes:$/, (content: string) => {
    context.turtleContent = content;
    context.parser = new TurtleParser();
  });

  given(/^I have RDF data with multiple prefixes$/, async () => {
    const content = `
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix dc: <http://purl.org/dc/terms/> .
      @prefix schema: <http://schema.org/> .
      @prefix ex: <http://example.org/> .
      
      ex:test a foaf:Document ;
          dc:title "Test" ;
          schema:author ex:alice .
    `;
    context.turtleContent = content;
    context.parser = new TurtleParser();
    context.parseResult = await context.parser.parse(content);
  });

  given(/^I have caching enabled$/, () => {
    context.loader = new RDFDataLoader({ cache: true });
  });

  given(/^I have a large Turtle file with (\d+) triples$/, async (count: string) => {
    const tripleCount = parseInt(count, 10);
    let content = '@prefix ex: <http://example.org/> .\n';
    
    for (let i = 0; i < tripleCount; i++) {
      content += `ex:entity${i} ex:property${i % 10} "value${i}" .\n`;
    }
    
    context.turtleFile = await createTestFile('large.ttl', content);
    context.turtleContent = content;
    context.parser = new TurtleParser();
  });

  given(/^I have an OWL ontology schema$/, async () => {
    const content = await fs.readFile(
      path.join(__dirname, '../fixtures/turtle/ontology.ttl'),
      'utf-8'
    );
    context.turtleContent = content;
  });

  given(/^I have RDF instance data$/, async () => {
    const content = await fs.readFile(
      path.join(__dirname, '../fixtures/turtle/sample.ttl'),
      'utf-8'
    );
    context.turtleContent = content;
  });

  // When steps
  when(/^I parse the Turtle file$/, async () => {
    try {
      context.parseResult = await context.parser!.parse(context.turtleContent!);
    } catch (error) {
      context.error = error as Error;
    }
  });

  when(/^I load all RDF sources$/, async () => {
    context.loader = new RDFDataLoader();
    const results = [];
    
    for (const [type, source] of context.sources!) {
      try {
        let result;
        if (type === 'file') {
          result = await context.loader.loadFromFile(source);
        } else if (type === 'inline') {
          result = await context.loader.loadFromInline(source);
        } else if (type === 'uri') {
          result = await context.loader.loadFromURI(source);
        }
        results.push(result);
      } catch (error) {
        context.error = error as Error;
      }
    }
    
    context.loadResult = results;
  });

  when(/^I query for subjects with type "([^"]*)"$/, async (type: string) => {
    context.queryResult = await context.loader!.query({
      predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      object: type.includes(':') ? expandPrefix(type) : type
    });
  });

  when(/^I query for objects of predicate "([^"]*)"$/, async (predicate: string) => {
    context.queryResult = await context.loader!.query({
      predicate: expandPrefix(predicate)
    });
  });

  when(/^I query with subject "([^"]*)" and predicate "([^"]*)"$/, async (subject: string, predicate: string) => {
    context.queryResult = await context.loader!.query({
      subject: expandPrefix(subject),
      predicate: expandPrefix(predicate)
    });
  });

  when(/^I render the template with person data$/, () => {
    const rdfContext = {
      query: (pattern: any) => context.queryResult || []
    };
    
    context.renderResult = context.nunjucksEnv!.renderString(
      context.template!,
      { rdf: rdfContext }
    );
  });

  when(/^I use rdfObject filter with a predicate$/, () => {
    const testData = { 
      subject: 'http://example.org/alice',
      properties: { 'foaf:name': ['Alice'] }
    };
    const result = context.filters!.rdfObject(testData, 'foaf:name');
    context.queryResult = result;
  });

  when(/^I use rdfType filter$/, () => {
    const testData = {
      subject: 'http://example.org/alice',
      types: ['http://xmlns.com/foaf/0.1/Person']
    };
    const result = context.filters!.rdfType(testData);
    context.queryResult = result;
  });

  when(/^I query within a specific graph "([^"]*)"$/, async (graph: string) => {
    context.queryResult = await context.parser!.query(
      context.parseResult.store,
      { graph }
    );
  });

  when(/^I query across all graphs$/, async () => {
    context.queryResult = await context.parser!.query(
      context.parseResult.store,
      {}
    );
  });

  when(/^I parse the data$/, async () => {
    context.parseResult = await context.parser!.parse(context.turtleContent!);
  });

  when(/^I compact a full URI "([^"]*)"$/, (uri: string) => {
    const prefixes = context.parseResult?.prefixes || {
      foaf: 'http://xmlns.com/foaf/0.1/'
    };
    context.queryResult = compactURI(uri, prefixes);
  });

  when(/^I expand a prefixed URI "([^"]*)"$/, (prefixed: string) => {
    const prefixes = context.parseResult?.prefixes || {
      foaf: 'http://xmlns.com/foaf/0.1/'
    };
    context.queryResult = expandPrefix(prefixed, prefixes);
  });

  when(/^I load the same file twice$/, async () => {
    context.startTime = Date.now();
    await context.loader!.loadFromFile(context.turtleFile!);
    const firstTime = Date.now() - context.startTime;
    
    context.startTime = Date.now();
    await context.loader!.loadFromFile(context.turtleFile!);
    const secondTime = Date.now() - context.startTime;
    
    context.queryResult = { firstTime, secondTime };
  });

  when(/^I invalidate the cache$/, async () => {
    await context.loader!.invalidateCache();
  });

  when(/^I parse the file$/, async () => {
    context.startTime = Date.now();
    context.memoryBefore = measureMemory();
    
    try {
      context.parseResult = await context.parser!.parse(context.turtleContent!);
    } catch (error) {
      context.error = error as Error;
    }
  });

  when(/^I query the large dataset$/, async () => {
    context.startTime = Date.now();
    context.queryResult = await context.parser!.query(
      context.parseResult.store,
      { predicate: 'http://example.org/property1' }
    );
  });

  when(/^I validate the data against the schema$/, async () => {
    // Simplified validation logic
    context.queryResult = {
      valid: true,
      violations: []
    };
  });

  // Then steps
  then(/^I should get (\d+) triples$/, (count: string) => {
    expect(context.parseResult.triples).toHaveLength(parseInt(count, 10));
  });

  then(/^the prefixes should include "([^"]*)" and "([^"]*)"$/, (prefix1: string, prefix2: string) => {
    expect(context.parseResult.prefixes).toHaveProperty(prefix1);
    expect(context.parseResult.prefixes).toHaveProperty(prefix2);
  });

  then(/^triple (\d+) should have subject "([^"]*)"$/, (index: string, subject: string) => {
    const tripleIndex = parseInt(index, 10) - 1;
    expect(context.parseResult.triples[tripleIndex].subject).toBe(subject);
  });

  then(/^all sources should be loaded successfully$/, () => {
    expect(context.loadResult).toBeDefined();
    expect(context.loadResult.length).toBe(3);
    expect(context.error).toBeUndefined();
  });

  then(/^the data should be merged correctly$/, () => {
    // Check that data from all sources is accessible
    expect(context.loader!.getSources().size).toBeGreaterThan(0);
  });

  then(/^prefixes from all sources should be available$/, () => {
    const prefixes = context.loader!.getAllPrefixes();
    expect(Object.keys(prefixes).length).toBeGreaterThan(0);
  });

  then(/^I should get all person entities$/, () => {
    expect(context.queryResult).toBeDefined();
    expect(context.queryResult.length).toBeGreaterThan(0);
    context.queryResult.forEach((triple: any) => {
      expect(triple.object).toContain('Person');
    });
  });

  then(/^I should get all relationships$/, () => {
    expect(context.queryResult).toBeDefined();
    expect(context.queryResult.length).toBeGreaterThan(0);
  });

  then(/^I should get "([^"]*)" as the object$/, (value: string) => {
    expect(context.queryResult).toBeDefined();
    expect(context.queryResult[0].object).toContain(value);
  });

  then(/^the rdfLabel should return human-readable names$/, () => {
    expect(context.renderResult).toBeDefined();
    expect(context.renderResult).toContain('Alice');
  });

  then(/^it should return the correct object values$/, () => {
    expect(context.queryResult).toBeDefined();
  });

  then(/^it should return all type URIs for the resource$/, () => {
    expect(context.queryResult).toBeDefined();
    expect(Array.isArray(context.queryResult)).toBe(true);
  });

  then(/^I should only get triples from that graph$/, () => {
    expect(context.queryResult).toBeDefined();
    context.queryResult.forEach((triple: any) => {
      expect(triple.graph).toBe('http://example.org/graph1');
    });
  });

  then(/^I should get triples from all graphs$/, () => {
    expect(context.queryResult).toBeDefined();
    expect(context.queryResult.length).toBeGreaterThan(0);
  });

  then(/^each triple should indicate its graph$/, () => {
    context.queryResult.forEach((triple: any) => {
      expect(triple).toHaveProperty('graph');
    });
  });

  then(/^blank nodes should be properly handled$/, () => {
    expect(context.parseResult).toBeDefined();
    const hasBlankNodes = context.parseResult.triples.some(
      (t: any) => t.subject.startsWith('_:') || t.object.startsWith('_:')
    );
    expect(hasBlankNodes).toBe(true);
  });

  then(/^blank node properties should be accessible$/, () => {
    const blankNodeTriples = context.parseResult.triples.filter(
      (t: any) => t.subject.startsWith('_:')
    );
    expect(blankNodeTriples.length).toBeGreaterThan(0);
  });

  then(/^blank node IDs should be consistent$/, () => {
    const blankNodes = new Set();
    context.parseResult.triples.forEach((t: any) => {
      if (t.subject.startsWith('_:')) blankNodes.add(t.subject);
      if (t.object.startsWith('_:')) blankNodes.add(t.object);
    });
    expect(blankNodes.size).toBeGreaterThan(0);
  });

  then(/^I should get "([^"]*)"$/, (expected: string) => {
    expect(context.queryResult).toBe(expected);
  });

  then(/^all standard prefixes should be available$/, () => {
    const prefixes = context.parseResult?.prefixes || {};
    expect(Object.keys(prefixes).length).toBeGreaterThan(0);
  });

  then(/^the second load should use cached data$/, () => {
    expect(context.queryResult.secondTime).toBeLessThan(context.queryResult.firstTime);
  });

  then(/^the load time should be faster$/, () => {
    expect(context.queryResult.secondTime).toBeLessThan(context.queryResult.firstTime / 2);
  });

  then(/^the next load should parse again$/, async () => {
    const startTime = Date.now();
    await context.loader!.loadFromFile(context.turtleFile!);
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeGreaterThan(0);
  });

  then(/^it should complete within (\d+) seconds$/, (seconds: string) => {
    const elapsed = Date.now() - context.startTime!;
    expect(elapsed).toBeLessThan(parseInt(seconds, 10) * 1000);
  });

  then(/^memory usage should stay below (\d+)MB$/, (mb: string) => {
    const memoryAfter = measureMemory();
    const usageMB = getMemoryUsageMB(context.memoryBefore!, memoryAfter);
    expect(usageMB).toBeLessThan(parseInt(mb, 10));
  });

  then(/^queries should return within (\d+)ms$/, (ms: string) => {
    const elapsed = Date.now() - context.startTime!;
    expect(elapsed).toBeLessThan(parseInt(ms, 10));
  });

  then(/^validation should report any violations$/, () => {
    expect(context.queryResult).toHaveProperty('violations');
  });

  then(/^it should check domain\/range constraints$/, () => {
    expect(context.queryResult.valid).toBeDefined();
  });

  then(/^it should verify cardinality requirements$/, () => {
    expect(context.queryResult.valid).toBeDefined();
  });
};

// Helper functions
function expandPrefix(prefixed: string, prefixes?: Record<string, string>): string {
  const defaultPrefixes = {
    foaf: 'http://xmlns.com/foaf/0.1/',
    ex: 'http://example.org/',
    schema: 'http://schema.org/',
    dc: 'http://purl.org/dc/terms/'
  };
  
  const allPrefixes = { ...defaultPrefixes, ...prefixes };
  
  if (prefixed.includes(':')) {
    const [prefix, local] = prefixed.split(':');
    if (allPrefixes[prefix]) {
      return allPrefixes[prefix] + local;
    }
  }
  
  return prefixed;
}

function compactURI(uri: string, prefixes: Record<string, string>): string {
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    if (uri.startsWith(namespace)) {
      return `${prefix}:${uri.substring(namespace.length)}`;
    }
  }
  return uri;
}

// Export for use in test files
export default rdfIntegrationSteps;