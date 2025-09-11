/**
 * Integration test for ProvenanceQueries with RDFProcessor
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProvenanceQueries } from '../../src/kgen/provenance/queries/sparql.js';
import { Store } from 'n3';

describe('ProvenanceQueries RDFProcessor Integration', () => {
  let provenanceQueries;

  beforeEach(() => {
    const store = new Store();
    provenanceQueries = new ProvenanceQueries(store);
  });

  it('should initialize with RDFProcessor', () => {
    expect(provenanceQueries.rdfProcessor).toBeDefined();
    expect(provenanceQueries.store).toBeDefined();
    expect(provenanceQueries.getRDFProcessor()).toBe(provenanceQueries.rdfProcessor);
  });

  it('should add RDF data to store', async () => {
    const rdfData = `
      @prefix prov: <http://www.w3.org/ns/prov#> .
      @prefix ex: <http://example.org/> .
      
      ex:entity1 a prov:Entity .
      ex:activity1 a prov:Activity .
      ex:agent1 a prov:Agent .
      
      ex:entity1 prov:wasGeneratedBy ex:activity1 .
      ex:activity1 prov:wasAssociatedWith ex:agent1 .
    `;

    const result = await provenanceQueries.addRDFData(rdfData, 'turtle');
    expect(result.count).toBeGreaterThan(0);
    expect(result.quads).toBeDefined();
    
    const stats = provenanceQueries.getStoreStatistics();
    expect(stats.totalTriples).toBeGreaterThan(0);
  });

  it('should execute basic SPARQL SELECT query', async () => {
    // Add test data first
    const rdfData = `
      @prefix prov: <http://www.w3.org/ns/prov#> .
      @prefix ex: <http://example.org/> .
      
      ex:entity1 a prov:Entity .
      ex:activity1 a prov:Activity .
      ex:agent1 a prov:Agent .
      
      ex:entity1 prov:wasGeneratedBy ex:activity1 .
      ex:activity1 prov:wasAssociatedWith ex:agent1 .
    `;
    
    await provenanceQueries.addRDFData(rdfData, 'turtle');

    const query = `
      PREFIX prov: <http://www.w3.org/ns/prov#>
      SELECT ?entity ?activity WHERE {
        ?entity prov:wasGeneratedBy ?activity .
      }
    `;

    const results = await provenanceQueries.executeSparql(query);
    expect(results).toBeDefined();
    expect(results.results?.bindings).toBeDefined();
  });

  it('should execute ASK query', async () => {
    // Add test data
    const rdfData = `
      @prefix prov: <http://www.w3.org/ns/prov#> .
      @prefix ex: <http://example.org/> .
      
      ex:entity1 a prov:Entity .
    `;
    
    await provenanceQueries.addRDFData(rdfData, 'turtle');

    const askQuery = `
      PREFIX prov: <http://www.w3.org/ns/prov#>
      ASK {
        ?entity a prov:Entity .
      }
    `;

    const result = await provenanceQueries.executeSparql(askQuery);
    expect(result).toBeDefined();
    expect(typeof result.boolean).toBe('boolean');
  });

  it('should use executeQuery method with real SPARQL processing', async () => {
    // Add test data
    const rdfData = `
      @prefix prov: <http://www.w3.org/ns/prov#> .
      @prefix ex: <http://example.org/> .
      
      ex:entity1 a prov:Entity .
      ex:activity1 a prov:Activity .
      ex:entity1 prov:wasGeneratedBy ex:activity1 .
    `;
    
    await provenanceQueries.addRDFData(rdfData, 'turtle');

    const query = `
      PREFIX prov: <http://www.w3.org/ns/prov#>
      SELECT ?entity WHERE {
        ?entity a prov:Entity .
      }
    `;

    const results = await provenanceQueries.executeQuery(query);
    expect(results).toBeDefined();
    expect(results.results?.bindings).toBeDefined();
  });

  it('should get comprehensive statistics', () => {
    const stats = provenanceQueries.getStoreStatistics();
    expect(stats).toBeDefined();
    expect(stats.totalTriples).toBeDefined();
    expect(stats.queryCache).toBeDefined();
    expect(stats.provenanceQueries).toBeDefined();
    expect(stats.provenanceQueries.templateCount).toBeGreaterThan(0);
  });

  it('should handle query cache operations', () => {
    const initialStats = provenanceQueries.getQueryStatistics();
    provenanceQueries.clearCache();
    
    const clearedStats = provenanceQueries.getQueryStatistics();
    expect(clearedStats.cacheSize).toBe(0);
  });
});