#!/usr/bin/env node

/**
 * KGEN RDF Processing Engine Demonstration
 * 
 * Shows the deterministic graph processing capabilities including:
 * - Deterministic hashing using canonical N-Triples
 * - Graph diff calculation with impact analysis
 * - Subject-to-artifact mapping
 * - Content-addressed caching
 * - SPARQL querying
 */

import { GraphProcessor, GraphDiffEngine, ContentAddressedCache, SparqlInterface, createRDFProcessor } from '../packages/kgen-core/src/rdf/index.js';

async function demonstrateRDFProcessing() {
  console.log('🔬 KGEN RDF Processing Engine Demonstration\n');
  
  try {
    // Sample RDF data
    const baseGraph = `
      @prefix ex: <http://example.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      
      ex:alice rdf:type foaf:Person .
      ex:alice foaf:name "Alice Smith" .
      ex:alice foaf:email "alice@example.org" .
      ex:alice foaf:knows ex:bob .
      
      ex:bob rdf:type foaf:Person .
      ex:bob foaf:name "Bob Johnson" .
      ex:bob foaf:email "bob@example.org" .
    `;
    
    const modifiedGraph = `
      @prefix ex: <http://example.org/> .
      @prefix foaf: <http://xmlns.com/foaf/0.1/> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      
      ex:alice rdf:type foaf:Person .
      ex:alice foaf:name "Alice Johnson" .
      ex:alice foaf:email "alice.johnson@example.org" .
      ex:alice foaf:age "30" .
      ex:alice foaf:knows ex:bob .
      ex:alice foaf:knows ex:charlie .
      
      ex:bob rdf:type foaf:Person .
      ex:bob foaf:name "Bob Johnson" .
      ex:bob foaf:email "bob@example.org" .
      
      ex:charlie rdf:type foaf:Person .
      ex:charlie foaf:name "Charlie Brown" .
      ex:charlie foaf:email "charlie@example.org" .
    `;

    // 1. Create RDF Processing System
    console.log('1. 📊 Creating RDF Processing System');
    const rdfSystem = createRDFProcessor({
      graph: { enableCaching: true },
      diff: { enableArtifactMapping: true },
      cache: { cacheDir: './cache/rdf-demo' }
    });
    
    // 2. Process Base Graph
    console.log('\n2. 🔄 Processing Base Graph');
    const baseResult = await rdfSystem.processGraph(baseGraph, 'turtle');
    console.log(`   ✅ Parsed ${baseResult.count} triples`);
    console.log(`   🔍 Hash: ${baseResult.hash.substring(0, 16)}...`);
    console.log(`   📝 Subjects: ${baseResult.subjects.length}, Predicates: ${baseResult.predicates.length}`);

    // 3. Process Modified Graph
    console.log('\n3. 🔄 Processing Modified Graph');
    const processor2 = new GraphProcessor();
    const modifiedResult = await processor2.parseRDF(modifiedGraph, 'turtle');
    processor2.addQuads(modifiedResult.quads);
    const modifiedHash = processor2.calculateContentHash();
    console.log(`   ✅ Parsed ${modifiedResult.count} triples`);
    console.log(`   🔍 Hash: ${modifiedHash.substring(0, 16)}...`);

    // 4. Calculate Graph Diff
    console.log('\n4. 📊 Calculating Graph Difference');
    const diff = await rdfSystem.compareGraphs(rdfSystem.processor, processor2);
    console.log(`   📈 Changes: +${diff.changes.added} -${diff.changes.removed} =${diff.changes.unchanged}`);
    console.log(`   📊 Change %: ${diff.metrics.changePercentage.toFixed(2)}%`);
    console.log(`   🔄 Stability: ${(diff.metrics.stability * 100).toFixed(1)}%`);
    console.log(`   👥 Impacted Subjects: ${diff.subjects?.total || diff.subjects?.impacted?.length || 0}`);
    
    if (diff.subjects?.impacted?.length > 0) {
      console.log(`   📋 Impacted: ${diff.subjects.impacted.slice(0, 3).join(', ')}${diff.subjects.impacted.length > 3 ? '...' : ''}`);
    }

    // 5. Subject-to-Artifact Index
    console.log('\n5. 🗂️  Building Subject-to-Artifact Index');
    const diffEngine = rdfSystem.diffEngine;
    
    // Register custom artifact mappers
    diffEngine.registerArtifactMapper('http://example.org/', (subject, graph) => {
      const name = subject.replace('http://example.org/', '');
      return [
        `src/models/${name}.js`,
        `src/controllers/${name}Controller.js`,
        `templates/views/${name}.njk`,
        `docs/${name}.md`
      ];
    });
    
    const subjectIndex = await diffEngine.buildSubjectIndex([rdfSystem.processor, processor2]);
    console.log(`   📚 Indexed ${subjectIndex.size} subjects`);
    
    for (const [subject, artifacts] of Array.from(subjectIndex.entries()).slice(0, 2)) {
      console.log(`   📄 ${subject}: ${artifacts.length} artifacts`);
      console.log(`      └─ ${artifacts.slice(0, 2).join(', ')}${artifacts.length > 2 ? '...' : ''}`);
    }

    // 6. Content-Addressed Caching
    console.log('\n6. 💾 Content-Addressed Caching');
    const baseHash = await rdfSystem.cacheContent(baseGraph, {
      contentType: 'text/turtle',
      tags: ['graph', 'base']
    });
    const modifiedCacheHash = await rdfSystem.cacheContent(modifiedGraph, {
      contentType: 'text/turtle', 
      tags: ['graph', 'modified']
    });
    
    console.log(`   🔐 Base graph cached: ${baseHash.substring(0, 16)}...`);
    console.log(`   🔐 Modified graph cached: ${modifiedCacheHash.substring(0, 16)}...`);
    
    // Verify retrieval
    const retrieved = await rdfSystem.cache.retrieve(baseHash);
    console.log(`   ✅ Retrieved ${retrieved.length} bytes (matches: ${retrieved.toString() === baseGraph})`);

    // 7. SPARQL Queries
    console.log('\n7. 🔍 SPARQL Query Examples');
    const sparql = rdfSystem.sparqlInterface;
    const commonQueries = sparql.getCommonQueries();
    
    console.log('   📋 Available query templates:');
    console.log(`      • getAllClasses: ${commonQueries.getAllClasses.includes('SELECT') ? '✅' : '❌'}`);
    console.log(`      • getAllProperties: ${commonQueries.getAllProperties.includes('SELECT') ? '✅' : '❌'}`);
    console.log(`      • getInstancesOfClass: ${typeof commonQueries.getInstancesOfClass === 'function' ? '✅' : '❌'}`);

    // 8. Performance Statistics
    console.log('\n8. 📊 Performance Statistics');
    const stats = rdfSystem.getStats();
    
    console.log('   🔄 Graph Processor:');
    console.log(`      • Triples Processed: ${stats.processor.metrics.triplesProcessed}`);
    console.log(`      • Cache Hits: ${stats.processor.metrics.cacheHits}`);
    console.log(`      • Total Quads: ${stats.processor.totalQuads}`);
    
    console.log('   📊 Diff Engine:');
    console.log(`      • Diffs Calculated: ${stats.diffEngine.diffsCalculated}`);
    console.log(`      • Subjects Analyzed: ${stats.diffEngine.subjectsAnalyzed}`);
    console.log(`      • Artifacts Mapped: ${stats.diffEngine.artifactsMapped}`);
    
    console.log('   💾 Content Cache:');
    console.log(`      • Total Entries: ${stats.cache.totalEntries}`);
    console.log(`      • Cache Hit Rate: ${(stats.cache.hitRate.total * 100).toFixed(1)}%`);
    console.log(`      • Memory Cache: ${stats.cache.memoryCache.entries} entries`);

    // 9. Deterministic Verification
    console.log('\n9. 🔒 Deterministic Verification');
    
    // Process same data multiple times
    const processor3 = new GraphProcessor();
    const result3 = await processor3.parseRDF(baseGraph, 'turtle');
    processor3.addQuads(result3.quads);
    const hash3 = processor3.calculateContentHash();
    
    const processor4 = new GraphProcessor();
    const result4 = await processor4.parseRDF(baseGraph, 'turtle');
    processor4.addQuads(result4.quads);
    const hash4 = processor4.calculateContentHash();
    
    console.log(`   🔍 Hash 1: ${baseResult.hash.substring(0, 16)}...`);
    console.log(`   🔍 Hash 2: ${hash3.substring(0, 16)}...`);
    console.log(`   🔍 Hash 3: ${hash4.substring(0, 16)}...`);
    console.log(`   ✅ Deterministic: ${baseResult.hash === hash3 && hash3 === hash4}`);

    // 10. Impact Analysis Example
    console.log('\n10. 🎯 Impact Analysis for CI/CD');
    const impact = diff.impact || {};
    console.log(`    📊 Risk Level: ${impact.risk?.level || 'unknown'}`);
    console.log(`    🔥 Risk Factors: ${impact.risk?.factors?.length || 0}`);
    console.log(`    💡 Recommendations: ${impact.risk?.recommendations?.length || 0}`);
    
    if (impact.risk?.recommendations?.length > 0) {
      console.log(`    📋 Top Recommendation: ${impact.risk.recommendations[0]}`);
    }

    console.log('\n✅ RDF Processing Demo Complete!');
    console.log('\nKey Features Demonstrated:');
    console.log('• ✅ Deterministic graph hashing using canonical N-Triples');
    console.log('• ✅ Comprehensive graph diff with change analysis');
    console.log('• ✅ Subject-to-artifact mapping for build impact');
    console.log('• ✅ Content-addressed caching for efficiency');
    console.log('• ✅ SPARQL query interface integration');
    console.log('• ✅ Performance monitoring and statistics');
    console.log('• ✅ N3.js integration for standards compliance');

    // Cleanup
    processor2.destroy();
    processor3.destroy();
    processor4.destroy();

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateRDFProcessing().catch(console.error);
}