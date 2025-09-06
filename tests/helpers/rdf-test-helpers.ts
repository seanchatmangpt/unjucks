import { TurtleParser } from '../../src/lib/turtle-parser.js';
import { RDFDataLoader } from '../../src/lib/rdf-data-loader.js';
import { RDFFilters } from '../../src/lib/rdf-filters.js';
import type { RDFDataSource, TurtleData } from '../../src/lib/types/turtle-types.js';
import fs from 'fs-extra';
import path from 'node:path';

/**
 * Test helper utilities for RDF integration testing
 */
export class RDFTestHelpers {
  static readonly FIXTURES_DIR = path.resolve(__dirname, '../fixtures/turtle');
  
  /**
   * Create a minimal RDF dataset for testing
   */
  static createMinimalRDF(subject: string = 'http://example.org/test'): string {
    return `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:test a foaf:Person ;
    foaf:name "Test Person" ;
    foaf:age 30 .
`;
  }

  /**
   * Create a complex RDF dataset with multiple entities
   */
  static createComplexRDF(): string {
    return `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix schema: <http://schema.org/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:alice a foaf:Person ;
    foaf:name "Alice Johnson" ;
    foaf:age 28 ;
    foaf:email "alice@example.com" ;
    foaf:workplaceHomepage ex:company1 ;
    dcterms:created "2024-01-15T10:30:00Z"^^xsd:dateTime .

ex:bob a foaf:Person ;
    foaf:name "Bob Smith" ;
    foaf:age 32 ;
    foaf:email "bob@example.com" ;
    foaf:knows ex:alice ;
    foaf:workplaceHomepage ex:company1 .

ex:company1 a schema:Organization ;
    schema:name "Tech Solutions Inc." ;
    schema:employee ex:alice, ex:bob ;
    schema:foundingDate "2020-01-01"^^xsd:date ;
    schema:url <http://techsolutions.example.com> .

ex:project1 a schema:Project ;
    schema:name "AI Development Platform" ;
    schema:description "Building next-generation AI tools" ;
    schema:startDate "2024-03-01"^^xsd:date ;
    schema:endDate "2024-12-31"^^xsd:date ;
    schema:member ex:alice, ex:bob ;
    schema:budget "500000.00"^^xsd:decimal .
`;
  }

  /**
   * Create an ontology/schema RDF for testing
   */
  static createSchemaRDF(): string {
    return `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix api: <http://api.example.org/> .

# Classes
api:User a owl:Class ;
    rdfs:label "User" ;
    rdfs:comment "A system user account" .

api:Post a owl:Class ;
    rdfs:label "Post" ;
    rdfs:comment "A blog post or article" .

api:Comment a owl:Class ;
    rdfs:label "Comment" ;
    rdfs:comment "A comment on a post" .

# Properties
api:username a owl:DatatypeProperty ;
    rdfs:label "username" ;
    rdfs:domain api:User ;
    rdfs:range xsd:string .

api:email a owl:DatatypeProperty ;
    rdfs:label "email" ;
    rdfs:domain api:User ;
    rdfs:range xsd:string .

api:title a owl:DatatypeProperty ;
    rdfs:label "title" ;
    rdfs:domain api:Post ;
    rdfs:range xsd:string .

api:content a owl:DatatypeProperty ;
    rdfs:label "content" ;
    rdfs:domain api:Post ;
    rdfs:range xsd:string .

api:author a owl:ObjectProperty ;
    rdfs:label "author" ;
    rdfs:domain api:Post ;
    rdfs:range api:User .

api:hasComment a owl:ObjectProperty ;
    rdfs:label "has comment" ;
    rdfs:domain api:Post ;
    rdfs:range api:Comment .

# Sample instances
api:user1 a api:User ;
    api:username "johndoe" ;
    api:email "john@example.com" .

api:post1 a api:Post ;
    api:title "Getting Started with RDF" ;
    api:content "RDF (Resource Description Framework) is a standard..." ;
    api:author api:user1 .
`;
  }

  /**
   * Create invalid RDF for error testing
   */
  static createInvalidRDF(): string {
    return `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:person a foaf:Person  # Missing semicolon and period
    foaf:name "Invalid Person"
    foaf:age "not-a-number"^^xsd:integer
`;
  }

  /**
   * Set up a complete test environment
   */
  static async setupTestEnvironment(): Promise<{
    parser: TurtleParser;
    dataLoader: RDFDataLoader;
    rdfFilters: RDFFilters;
    tempDir: string;
  }> {
    const tempDir = path.join(__dirname, '../temp', `test-${Date.now()}`);
    await fs.ensureDir(tempDir);

    const parser = new TurtleParser({
      baseIRI: 'http://example.org/',
      format: 'text/turtle'
    });

    const dataLoader = new RDFDataLoader({
      baseUri: 'http://example.org/',
      cacheEnabled: true,
      templateDir: tempDir,
      httpTimeout: 5000
    });

    const rdfFilters = new RDFFilters({
      baseUri: 'http://example.org/',
      prefixes: {
        ex: 'http://example.org/',
        foaf: 'http://xmlns.com/foaf/0.1/',
        schema: 'http://schema.org/',
        dcterms: 'http://purl.org/dc/terms/',
        api: 'http://api.example.org/'
      }
    });

    return { parser, dataLoader, rdfFilters, tempDir };
  }

  /**
   * Clean up test environment
   */
  static async cleanupTestEnvironment(tempDir: string): Promise<void> {
    try {
      await fs.remove(tempDir);
    } catch (error) {
      console.warn(`Failed to cleanup test directory ${tempDir}:`, error);
    }
  }

  /**
   * Write RDF data to a temporary file
   */
  static async writeRDFFile(
    tempDir: string, 
    filename: string, 
    content: string
  ): Promise<string> {
    const filePath = path.join(tempDir, filename);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * Load and parse RDF from string
   */
  static async loadRDFFromString(
    dataLoader: RDFDataLoader,
    content: string
  ): Promise<TurtleData> {
    const result = await dataLoader.loadFromSource({
      type: 'inline',
      source: content
    });

    if (!result.success) {
      throw new Error(`Failed to load RDF: ${result.errors.join(', ')}`);
    }

    return result.data;
  }

  /**
   * Assert RDF data contains expected triples
   */
  static assertContainsTriple(
    data: TurtleData,
    subject: string,
    predicate: string,
    object?: string
  ): void {
    const matchingTriples = data.triples.filter(triple => 
      triple.subject.value === subject && 
      triple.predicate.value === predicate &&
      (object ? triple.object.value === object : true)
    );

    if (matchingTriples.length === 0) {
      throw new Error(
        `Expected triple not found: <${subject}> <${predicate}> ${object ? `<${object}>` : '?'}`
      );
    }
  }

  /**
   * Assert RDF data has expected subject count
   */
  static assertSubjectCount(data: TurtleData, expectedCount: number): void {
    const actualCount = Object.keys(data.subjects).length;
    if (actualCount !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} subjects, but found ${actualCount}`
      );
    }
  }

  /**
   * Assert RDF data has expected triple count
   */
  static assertTripleCount(data: TurtleData, expectedCount: number): void {
    const actualCount = data.triples.length;
    if (actualCount !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} triples, but found ${actualCount}`
      );
    }
  }

  /**
   * Get fixture file path
   */
  static getFixturePath(filename: string): string {
    return path.join(this.FIXTURES_DIR, filename);
  }

  /**
   * Load fixture file content
   */
  static async loadFixture(filename: string): Promise<string> {
    const filePath = this.getFixturePath(filename);
    return fs.readFile(filePath, 'utf-8');
  }

  /**
   * Create test RDF data source
   */
  static createDataSource(
    type: 'file' | 'inline' | 'uri',
    source: string,
    options?: Partial<RDFDataSource>
  ): RDFDataSource {
    return {
      type,
      source,
      ...options
    };
  }

  /**
   * Generate template code from RDF classes
   */
  static generateTypeScriptFromClasses(classUris: string[]): string {
    return `
// Generated TypeScript interfaces
${classUris.map(uri => {
  const className = uri.split('/').pop() || uri.split('#').pop() || 'Unknown';
  return `
export interface ${className} {
  id: string;
  // TODO: Add properties from RDF schema
}`;
}).join('\n')}
`;
  }

  /**
   * Simulate template rendering with basic string replacement
   */
  static renderTemplate(template: string, context: Record<string, any>): string {
    let rendered = template;
    
    // Simple template variable replacement for testing
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }
    
    return rendered;
  }

  /**
   * Create performance test data
   */
  static createLargeRDFDataset(entityCount: number = 1000): string {
    const prefixes = `
@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix schema: <http://schema.org/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
`;

    const entities = [];
    for (let i = 1; i <= entityCount; i++) {
      const id = i.toString().padStart(3, '0');
      entities.push(`
ex:person${id} a foaf:Person ;
    foaf:name "Person ${id}" ;
    foaf:age ${20 + (i % 50)} ;
    foaf:email "person${id}@example.com" ;
    dcterms:created "2024-01-${(i % 30) + 1}T00:00:00Z"^^xsd:dateTime .`);
    }

    return prefixes + entities.join('\n');
  }

  /**
   * Measure execution time of a function
   */
  static async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
    const start = performance.now();
    const result = await fn();
    const time = performance.now() - start;
    return { result, time };
  }

  /**
   * Create mock HTTP responses for testing remote RDF loading
   */
  static mockFetch(responses: Record<string, { status: number; body: string; headers?: Record<string, string> }>): void {
    const originalFetch = global.fetch;
    
    global.fetch = async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const mockResponse = responses[url];
      
      if (mockResponse) {
        return Promise.resolve({
          ok: mockResponse.status >= 200 && mockResponse.status < 300,
          status: mockResponse.status,
          statusText: mockResponse.status === 200 ? 'OK' : 'Error',
          text: () => Promise.resolve(mockResponse.body),
          headers: {
            get: (name: string) => mockResponse.headers?.[name.toLowerCase()] || null
          }
        } as Response);
      }
      
      return Promise.reject(new Error(`No mock response configured for ${url}`));
    };
  }

  /**
   * Restore original fetch implementation
   */
  static restoreFetch(): void {
    if (typeof global.fetch !== 'undefined') {
      delete (global as any).fetch;
    }
  }
}

/**
 * Custom matchers for RDF testing
 */
export const RDFMatchers = {
  /**
   * Check if RDF data contains a specific subject
   */
  toHaveSubject(data: TurtleData, subjectUri: string): boolean {
    return Object.keys(data.subjects).includes(subjectUri);
  },

  /**
   * Check if RDF data contains a specific predicate
   */
  toHavePredicate(data: TurtleData, predicateUri: string): boolean {
    return data.predicates.has(predicateUri);
  },

  /**
   * Check if RDF data contains a triple with specific pattern
   */
  toHaveTriple(
    data: TurtleData, 
    subject?: string, 
    predicate?: string, 
    object?: string
  ): boolean {
    return data.triples.some(triple => 
      (!subject || triple.subject.value === subject) &&
      (!predicate || triple.predicate.value === predicate) &&
      (!object || triple.object.value === object)
    );
  },

  /**
   * Check if RDF load result is successful
   */
  toBeSuccessfulRDFLoad(result: any): boolean {
    return result && 
           typeof result.success === 'boolean' && 
           result.success === true &&
           Array.isArray(result.errors) && 
           result.errors.length === 0;
  },

  /**
   * Check if RDF data has expected structure
   */
  toHaveValidRDFStructure(data: TurtleData): boolean {
    return data &&
           typeof data === 'object' &&
           typeof data.subjects === 'object' &&
           data.predicates instanceof Set &&
           Array.isArray(data.triples) &&
           typeof data.prefixes === 'object';
  }
};

export default RDFTestHelpers;