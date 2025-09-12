#!/usr/bin/env node

/**
 * Enhanced RDF Processing Demo
 * 
 * Demonstrates the improved RDF processing capabilities that replace
 * the naive implementations in bin/kgen.mjs.
 * 
 * Usage: node src/kgen/rdf/demo-enhanced-rdf.js
 */

import { EnhancedRDFProcessor, StandaloneKGenBridge } from './index.js';
import fs from 'fs/promises';
import path from 'path';
import { consola } from 'consola';

async function createSampleRDFFile() {
  const sampleRDF = `@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:alice rdf:type foaf:Person ;
    foaf:name "Alice Johnson" ;
    foaf:age 30 ;
    foaf:email "alice@example.org" ;
    foaf:knows ex:bob .

ex:bob rdf:type foaf:Person ;
    foaf:name "Bob Smith" ;
    foaf:age 25 ;
    foaf:email "bob@example.org" ;
    foaf:knows ex:alice, ex:charlie .

ex:charlie rdf:type foaf:Person ;
    foaf:name "Charlie Brown" ;
    foaf:age 35 ;
    foaf:email "charlie@example.org" .

# Company information
ex:company rdf:type ex:Organization ;
    ex:name "Example Corp" ;
    ex:employs ex:alice, ex:bob, ex:charlie .

ex:alice ex:worksFor ex:company .
ex:bob ex:worksFor ex:company .
ex:charlie ex:worksFor ex:company .
`;

  const filePath = 'sample-graph.ttl';
  await fs.writeFile(filePath, sampleRDF, 'utf8');
  return filePath;
}

async function createModifiedRDFFile(originalPath) {
  const originalContent = await fs.readFile(originalPath, 'utf8');
  
  // Add some new triples to show differences
  const modifiedContent = originalContent + `
# Additional information
ex:alice foaf:homepage <http://alice.example.org> ;
    ex:department "Engineering" .

ex:dave rdf:type foaf:Person ;
    foaf:name "Dave Wilson" ;
    foaf:age 28 ;
    foaf:email "dave@example.org" ;
    ex:worksFor ex:company .
`;

  const modifiedPath = 'sample-graph-modified.ttl';
  await fs.writeFile(modifiedPath, modifiedContent, 'utf8');
  return modifiedPath;
}

async function demonstrateEnhancedProcessor() {
  consola.info('🔬 Enhanced RDF Processor Demo');
  
  const processor = new EnhancedRDFProcessor({
    enableCanonicalization: true,
    enableIndexing: true,
    enableValidation: true,
    verboseOutput: true
  });
  
  await processor.initialize();
  
  // Create sample files
  const file1 = await createSampleRDFFile();
  const file2 = await createModifiedRDFFile(file1);
  
  try {
    consola.start('Testing canonical hash generation...');
    
    // Test enhanced hash
    const hashResult1 = await processor.graphHash(file1);
    const hashResult2 = await processor.graphHash(file2);
    
    consola.success('Hash Results:');
    console.log('File 1:', {
      file: hashResult1.file,
      canonicalHash: hashResult1.canonicalHash,
      tripleCount: hashResult1.tripleCount,
      format: hashResult1.format
    });
    
    console.log('File 2:', {
      file: hashResult2.file,
      canonicalHash: hashResult2.canonicalHash,
      tripleCount: hashResult2.tripleCount,
      format: hashResult2.format
    });
    
    consola.start('Testing semantic graph comparison...');
    
    // Test enhanced diff
    const diffResult = await processor.graphDiff(file1, file2, {
      checkSemanticEquivalence: true,
      includeChanges: true
    });
    
    consola.success('Diff Results:');
    console.log({
      identical: diffResult.identical,
      semanticallyEquivalent: diffResult.semanticallyEquivalent,
      differences: diffResult.differences,
      summary: diffResult.summary,
      sampleChanges: diffResult.changes?.slice(0, 3)
    });
    
    consola.start('Testing advanced indexing...');
    
    // Test enhanced indexing
    const indexResult = await processor.graphIndex(file1, {
      includeSamples: true
    });
    
    consola.success('Index Results:');
    console.log({
      triples: indexResult.triples,
      statistics: indexResult.statistics,
      samples: indexResult.samples
    });
    
    consola.start('Testing semantic queries...');
    
    // Test query capabilities
    const queryResult = await processor.queryGraph(file1, {
      type: 'http://xmlns.com/foaf/0.1/Person'
    });
    
    consola.success('Query Results:');
    console.log({
      count: queryResult.count,
      results: queryResult.results?.slice(0, 3)
    });
    
  } finally {
    // Cleanup
    await fs.unlink(file1).catch(() => {});
    await fs.unlink(file2).catch(() => {});
    
    await processor.shutdown();
  }
}

async function demonstrateStandaloneBridge() {
  consola.info('🌉 Standalone Bridge Demo (Drop-in Replacement)');
  
  const bridge = new StandaloneKGenBridge();
  
  // Create sample file
  const file = await createSampleRDFFile();
  
  try {
    consola.start('Testing enhanced graphHash (replaces naive version)...');
    
    const hashResult = await bridge.graphHash(file);
    consola.success('Enhanced Hash Result:');
    console.log(JSON.stringify(hashResult, null, 2));
    
    consola.start('Testing enhanced graphIndex (replaces naive version)...');
    
    const indexResult = await bridge.graphIndex(file);
    consola.success('Enhanced Index Result:');
    console.log(JSON.stringify(indexResult, null, 2));
    
    // Show status
    const status = await bridge.getStatus();
    consola.info('Bridge Status:', status.mode);
    
  } finally {
    // Cleanup
    await fs.unlink(file).catch(() => {});
    await bridge.shutdown();
  }
}

async function compareNaiveVsEnhanced() {
  consola.info('⚖️  Comparison: Naive vs Enhanced Processing');
  
  const file = await createSampleRDFFile();
  const content = await fs.readFile(file, 'utf8');
  
  try {
    // Simulate naive approach (from original bin/kgen.mjs)
    const crypto = await import('crypto');
    const naiveHash = crypto.createHash('sha256').update(content).digest('hex');
    
    // Enhanced approach
    const processor = new EnhancedRDFProcessor();
    await processor.initialize();
    
    const enhancedResult = await processor.graphHash(file);
    
    console.log('Comparison Results:');
    console.log('Naive hash (content-based):', naiveHash);
    console.log('Enhanced hash (semantic):', enhancedResult.canonicalHash);
    console.log('Are they different?', naiveHash !== enhancedResult.canonicalHash);
    
    if (enhancedResult._semantic) {
      console.log('Semantic info:');
      console.log('- Triple count:', enhancedResult._semantic.tripleCount);
      console.log('- Format detected:', enhancedResult._semantic.format);
      console.log('- Parse time:', enhancedResult._semantic.parseTime + 'ms');
    }
    
    await processor.shutdown();
    
  } finally {
    await fs.unlink(file).catch(() => {});
  }
}

async function main() {
  try {
    consola.info('🚀 Starting Enhanced RDF Processing Demo');
    console.log('='.repeat(60));
    
    await demonstrateEnhancedProcessor();
    console.log('='.repeat(60));
    
    await demonstrateStandaloneBridge();
    console.log('='.repeat(60));
    
    await compareNaiveVsEnhanced();
    console.log('='.repeat(60));
    
    consola.success('✅ All demos completed successfully!');
    
    consola.info('📋 Summary:');
    console.log('• Enhanced RDF processing replaces naive string-based parsing');
    console.log('• Canonical hashing provides semantic equivalence checking');
    console.log('• Advanced indexing enables efficient graph queries');
    console.log('• Standalone bridge provides drop-in replacement for bin/kgen.mjs');
    console.log('• Fallback mode ensures compatibility even if enhanced processing fails');
    
  } catch (error) {
    consola.error('Demo failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}