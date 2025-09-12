/**
 * RDF Integration Test - Validates real-world RDF processing
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseRDF, serializeRDF, queryRDF } from '../../src/rdf/processor.js';
import { createRDFStore } from '../../src/rdf/store.js';
import { Store, DataFactory } from 'n3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { namedNode, literal } = DataFactory;

describe('RDF Integration Tests', () => {
  const testData = readFileSync(join(__dirname, 'test-data.ttl'), 'utf-8');

  it('should parse, query, and serialize real RDF data', async () => {
    // Parse RDF content
    const parseResult = await parseRDF(testData);
    expect(parseResult.success).toBe(true);
    expect(parseResult.quadCount).toBeGreaterThan(10);
    expect(parseResult.prefixes).toHaveProperty('foaf');
    expect(parseResult.prefixes).toHaveProperty('ex');

    // Execute SPARQL query
    const sparqlQuery = `
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      SELECT ?person ?name WHERE {
        ?person a foaf:Person .
        ?person foaf:name ?name .
      }
    `;
    
    const queryResult = await queryRDF(parseResult.quads, sparqlQuery);
    expect(queryResult.success).toBe(true);
    expect(queryResult.queryType).toBe('SELECT');
    expect(queryResult.resultCount).toBeGreaterThan(0);

    // Serialize back to Turtle
    const serialized = await serializeRDF(parseResult.quads, { format: 'turtle' });
    expect(typeof serialized).toBe('string');
    expect(serialized.length).toBeGreaterThan(100);
    expect(serialized).toContain('@prefix foaf:');
    expect(serialized).toContain('foaf:Person');
  });

  it('should work with RDF Store for advanced operations', async () => {
    // Create and populate store
    const store = createRDFStore({ enableIndexing: true });
    const parseResult = await parseRDF(testData);
    
    const importResult = store.import(parseResult.quads);
    expect(importResult.success).toBe(true);
    expect(store.size).toBeGreaterThan(10);

    // Query store with patterns
    const personQuads = store.getQuads(
      null, 
      namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), 
      namedNode('http://xmlns.com/foaf/0.1/Person')
    );
    
    expect(personQuads.length).toBeGreaterThan(0);

    // Get all subjects (people and organizations)
    const subjects = store.getSubjects();
    expect(subjects.length).toBeGreaterThan(0);

    // Pattern matching with options
    const matchResult = store.match({
      predicate: namedNode('http://xmlns.com/foaf/0.1/name'),
      limit: 5
    });
    
    expect(matchResult.success).toBe(true);
    expect(matchResult.quads.length).toBeGreaterThan(0);
    expect(matchResult.quads.length).toBeLessThanOrEqual(5);
  });

  it('should handle PREFIX expansion and compaction correctly', async () => {
    const parseResult = await parseRDF(testData);
    expect(parseResult.success).toBe(true);

    // Check that prefixes were extracted
    expect(parseResult.prefixes.foaf).toBe('http://xmlns.com/foaf/0.1/');
    expect(parseResult.prefixes.ex).toBe('http://example.org/');
    expect(parseResult.prefixes.dc).toBe('http://purl.org/dc/elements/1.1/');

    // Verify quads use full URIs internally
    const personQuads = parseResult.quads.filter(quad => 
      quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
      quad.object.value === 'http://xmlns.com/foaf/0.1/Person'
    );
    
    expect(personQuads.length).toBeGreaterThan(0);
  });

  it('should demonstrate complete RDF workflow', async () => {
    // 1. Parse RDF
    const parseResult = await parseRDF(testData);
    console.log(`Parsed ${parseResult.quadCount} quads with ${Object.keys(parseResult.prefixes).length} prefixes`);
    
    // 2. Query for specific information
    const askQuery = `
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      ASK WHERE {
        ?person foaf:knows ?friend .
        ?friend foaf:knows ?person .
      }
    `;
    
    const askResult = await queryRDF(parseResult.quads, askQuery);
    console.log(`Mutual friendship exists: ${askResult.results.boolean}`);
    
    // 3. Count organizations
    const orgQuery = `
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      SELECT ?org WHERE {
        ?org a foaf:Organization .
      }
    `;
    
    const orgResult = await queryRDF(parseResult.quads, orgQuery);
    console.log(`Found ${orgResult.resultCount} organizations`);
    
    // 4. Export subset as N-Triples
    const orgQuads = parseResult.quads.filter(quad => 
      quad.object.value === 'http://xmlns.com/foaf/0.1/Organization' &&
      quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    );
    
    if (orgQuads.length > 0) {
      const ntriplesSerialized = await serializeRDF(orgQuads, { format: 'n-triples' });
      console.log('Organization data in N-Triples format:', ntriplesSerialized.substring(0, 100) + '...');
    }

    expect(parseResult.success).toBe(true);
    expect(askResult.success).toBe(true);
    expect(orgResult.success).toBe(true);
  });
});