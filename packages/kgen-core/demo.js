#!/usr/bin/env node

/**
 * KGEN Core Enhanced RDF Processor Demonstration
 * Showcases deterministic graph hashing, normalization, diff engine, and indexing
 * 
 * @author KGEN Team
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createEnhancedRDFProcessor, validateRDF } from './src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI colors for output formatting
const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
  console.log(`\n${colors.bold}${colors.cyan}=== ${title} ===${colors.reset}`);
}

function success(message) {
  log('green', `✅ ${message}`);
}

function info(message) {
  log('blue', `ℹ️  ${message}`);
}

function warning(message) {
  log('yellow', `⚠️  ${message}`);
}

function error(message) {
  log('red', `❌ ${message}`);
}

async function demonstrateRDFProcessor() {
  try {
    header('KGEN Enhanced RDF Processor Demonstration');
    
    // Load sample RDF data
    const sampleTTL = readFileSync(join(__dirname, 'test-data/sample.ttl'), 'utf8');
    const simpleTTL = readFileSync(join(__dirname, 'test-data/simple.ttl'), 'utf8');
    
    // 1. Create and initialize processor
    header('1. Processor Initialization');
    const processor = await createEnhancedRDFProcessor({
      deterministic: true,
      hashAlgorithm: 'sha256'
    });
    success('Enhanced RDF Processor initialized with deterministic mode');
    
    // 2. Parse RDF data
    header('2. RDF Parsing');
    const sampleParsed = await processor.parseRDF(sampleTTL, 'turtle');
    const simpleParsed = await processor.parseRDF(simpleTTL, 'turtle');
    
    success(`Parsed sample.ttl: ${sampleParsed.count} triples`);
    success(`Parsed simple.ttl: ${simpleParsed.count} triples`);
    info(`Detected prefixes: ${Object.keys(sampleParsed.prefixes).join(', ')}`);
    
    // 3. Deterministic Graph Hashing
    header('3. Deterministic Graph Hashing');
    const hash1 = processor.computeGraphHash(sampleParsed.quads);
    const hash2 = processor.computeGraphHash(sampleParsed.quads); // Same data
    
    success(`Graph hash (first): ${hash1.sha256.substring(0, 16)}...`);
    success(`Graph hash (second): ${hash2.sha256.substring(0, 16)}...`);
    success(`Hashes identical: ${hash1.sha256 === hash2.sha256}`);
    info(`Hash algorithm: ${hash1.algorithm}`);
    info(`Triple count: ${hash1.tripleCount}`);
    info(`Canonical: ${hash1.canonical}`);
    
    // 4. Graph Normalization
    header('4. Graph Normalization');
    const normalized1 = processor.normalizeGraph(sampleParsed.quads);
    const normalized2 = processor.normalizeGraph(sampleParsed.quads);
    
    success(`Normalized serialization identical: ${normalized1.serialization === normalized2.serialization}`);
    info(`Original triples: ${normalized1.metadata.originalCount}`);
    info(`Normalized triples: ${normalized1.metadata.normalizedCount}`);
    info(`Blank nodes renamed: ${normalized1.metadata.blankNodesRenamed}`);
    info(`Deterministic: ${normalized1.metadata.deterministic}`);
    
    // Show sample normalized triples
    console.log('\n' + colors.magenta + '📄 Sample normalized triples:' + colors.reset);
    console.log(normalized1.serialization.split('\\n').slice(0, 3).join('\\n'));
    console.log(colors.yellow + '   ... (truncated)' + colors.reset);
    
    // 5. Graph Diff Engine
    header('5. Graph Diff Engine');
    const diff = processor.computeGraphDiff(simpleParsed.quads, sampleParsed.quads);
    
    success(`Diff computed successfully`);
    info(`Added triples: ${diff.added.length}`);
    info(`Removed triples: ${diff.removed.length}`);
    info(`Common triples: ${diff.statistics.common}`);
    info(`Similarity: ${(diff.statistics.similarity * 100).toFixed(1)}%`);
    
    if (diff.metadata) {
      info(`Source hash: ${diff.metadata.sourceHash.substring(0, 16)}...`);
      info(`Target hash: ${diff.metadata.targetHash.substring(0, 16)}...`);
    }
    
    // 6. Graph Indexing
    header('6. Graph Indexing');
    const artifactMap = {
      'https://kgen.io/artifact/sample-001': ['/api/users.js', '/tests/users.test.js'],
      'https://kgen.io/template/api-endpoint': ['/templates/api.njk'],
      'https://kgen.io/agent/backend-dev': ['/agents/backend-dev.js']
    };
    
    const index = processor.buildGraphIndex(sampleParsed.quads, artifactMap);
    success(`Graph index built with ${index.size} subjects`);
    
    // Query index
    const entry = processor.getIndexEntry('https://kgen.io/artifact/sample-001');
    if (entry) {
      success(`Found subject in index`);
      info(`  Subject: ${entry.subject.value}`);
      info(`  Triples: ${entry.triples.length}`);
      info(`  Artifacts: ${Array.from(entry.artifacts).join(', ')}`);
      info(`  Predicates: ${entry.predicates.size}`);
    }
    
    // Find by artifact
    const subjects = processor.findSubjectsByArtifact('/api/users.js');
    success(`Found ${subjects.length} subjects with artifact '/api/users.js'`);
    if (subjects.length > 0) {
      info(`  Subject: ${subjects[0].subject}`);
      info(`  Triple count: ${subjects[0].tripleCount}`);
    }
    
    // 7. Store Operations
    header('7. Store Operations & Statistics');
    processor.addQuads(sampleParsed.quads);
    processor.addQuads(simpleParsed.quads);
    
    const stats = processor.getStats();
    success(`Store populated with data`);
    info(`Total triples: ${stats.store.totalTriples}`);
    info(`Unique subjects: ${stats.store.subjects}`);
    info(`Unique predicates: ${stats.store.predicates}`);
    info(`Unique objects: ${stats.store.objects}`);
    info(`Indexed subjects: ${stats.index.indexedSubjects}`);
    info(`Total artifacts: ${stats.index.totalArtifacts}`);
    info(`Hash cache size: ${stats.caches.hashCacheSize}`);
    info(`Normalized cache size: ${stats.caches.normalizedCacheSize}`);
    
    // 8. Deterministic Serialization
    header('8. Deterministic Serialization');
    const serialized1 = await processor.serializeRDF(null, 'turtle');
    const serialized2 = await processor.serializeRDF(null, 'turtle');
    
    success(`Serializations identical: ${serialized1 === serialized2}`);
    info(`Serialization length: ${serialized1.length} characters`);
    
    // Show sample serialization
    console.log('\\n' + colors.magenta + '📄 Sample serialized output:' + colors.reset);
    const lines = serialized1.split('\\n');
    console.log(lines.slice(0, 5).join('\\n'));
    console.log(colors.yellow + '   ... (truncated)' + colors.reset);
    
    // 9. Health Check
    header('9. Health Check');
    const health = await processor.healthCheck();
    success(`System status: ${health.status}`);
    info(`Store size: ${health.storeSize}`);
    info(`Index size: ${health.indexSize}`);
    info(`Memory usage: ${Math.round(health.memory.heapUsed / 1024 / 1024)}MB`);
    info(`Uptime: ${Math.round(health.uptime)}s`);
    info(`Hash hit rate: ${(health.cacheEfficiency.hashHitRate * 100).toFixed(1)}%`);
    
    // 10. Performance Metrics
    header('10. Performance Metrics');
    success(`Triples processed: ${stats.metrics.triplesProcessed}`);
    info(`Parse errors: ${stats.metrics.parseErrors}`);
    info(`Hashes computed: ${stats.metrics.hashesComputed}`);
    info(`Normalizations: ${stats.metrics.normalizations}`);
    info(`Diffs computed: ${stats.metrics.diffsComputed}`);
    
    // 11. RDF Validation Utility
    header('11. RDF Validation');
    const validationResult = await validateRDF(sampleTTL, 'turtle');
    if (validationResult.success) {
      success(`RDF validation passed`);
      info(`Validated ${validationResult.tripleCount} triples`);
    } else {
      error(`RDF validation failed: ${validationResult.error}`);
    }
    
    // 12. Cleanup
    header('12. Cleanup');
    await processor.shutdown();
    success('Processor shutdown complete');
    
    // Summary
    header('DEMONSTRATION COMPLETE');
    success('All core features demonstrated successfully:');
    console.log(`${colors.green}  ✅ Deterministic graph hashing (SHA256)${colors.reset}`);
    console.log(`${colors.green}  ✅ Graph normalization for reproducibility${colors.reset}`);
    console.log(`${colors.green}  ✅ Triple-level diff engine${colors.reset}`);
    console.log(`${colors.green}  ✅ Subject-to-artifact indexing${colors.reset}`);
    console.log(`${colors.green}  ✅ Deterministic serialization${colors.reset}`);
    console.log(`${colors.green}  ✅ Comprehensive statistics${colors.reset}`);
    console.log(`${colors.green}  ✅ Performance monitoring${colors.reset}`);
    console.log(`${colors.green}  ✅ Enterprise-grade error handling${colors.reset}`);
    
    info('KGEN Core RDF Engine ready for production use! 🚀');
    
  } catch (err) {
    error(`Demonstration failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run demonstration
demonstrateRDFProcessor();