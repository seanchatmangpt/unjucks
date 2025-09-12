/**
 * Graph hash command - Generate canonical deterministic hash of knowledge graph
 * Usage: kgen graph hash <file.ttl> [options]
 * 
 * Features:
 * - Canonical RDF hashing with C14N normalization
 * - Deterministic hashing regardless of triple ordering
 * - Content-addressed storage integration
 * - Performance optimized (<150ms target)
 * - Support for multiple RDF formats
 * - SHA256 output in JSON format
 */

import { defineCommand } from 'citty';
import { readFile } from 'fs/promises';
import crypto from 'crypto';
import { SemanticHashEngine } from '../../../../../src/kgen/rdf/semantic-hash-engine.js';
import { canonicalProcessor } from '../../../../../src/kgen/rdf/canonical-processor-cas.js';
import { cas } from '../../../../../src/kgen/cas/cas-core.js';

export default defineCommand({
  meta: {
    name: 'hash',
    description: 'Generate canonical deterministic hash of a knowledge graph'
  },
  args: {
    file: {
      type: 'positional',
      description: 'Path to RDF file',
      required: true
    },
    format: {
      type: 'string',
      description: 'RDF format (turtle, ntriples, nquads)',
      default: 'turtle',
      alias: 'f'
    },
    algorithm: {
      type: 'string',
      description: 'Hash algorithm (sha256, sha512, blake2b, blake3)',
      default: 'sha256',
      alias: 'a'
    },
    semantic: {
      type: 'boolean',
      description: 'Use semantic hashing (ignores formatting)',
      default: true
    },
    json: {
      type: 'boolean',
      description: 'Output in JSON format',
      default: false,
      alias: 'j'
    },
    verbose: {
      type: 'boolean',
      description: 'Verbose output with metadata',
      default: false,
      alias: 'v'
    },
    benchmark: {
      type: 'boolean',
      description: 'Run determinism benchmark',
      default: false,
      alias: 'b'
    }
  },
  async run(context) {
    const { args } = context;
    const startTime = performance.now();
    
    try {
      if (args.verbose && !args.json) {
        console.log(`🔍 Computing ${args.algorithm.toUpperCase()} hash for ${args.file}`);
      }
      
      // Read RDF content
      const rdfContent = await readFile(args.file, 'utf8');
      
      let hashResult;
      
      if (args.semantic) {
        // Use semantic hashing engine for canonical deterministic hashing
        const semanticEngine = new SemanticHashEngine({
          hashAlgorithm: args.algorithm,
          canonicalAlgorithm: 'c14n-rdf',
          enableCaching: true,
          casEnabled: true
        });
        
        const result = await semanticEngine.calculateSemanticHash(rdfContent, {
          format: args.format
        });
        
        // Convert to expected format
        hashResult = {
          hash: result.semanticHash,
          canonical: result.canonical,
          quadCount: result.metadata.quadCount,
          processingTime: result.metadata.processingTime
        };
      } else {
        // Use canonical processor for content-addressed hashing
        hashResult = await canonicalProcessor.calculateContentHash(rdfContent, {
          algorithm: args.algorithm,
          format: args.format
        });
      }
      
      // Generate content:// URI
      const contentUri = `content://${args.algorithm}/${hashResult.hash}`;
      
      // Prepare result
      const result = {
        file: args.file,
        hash: hashResult.hash,
        contentUri,
        algorithm: args.algorithm,
        format: args.format,
        quadCount: hashResult.quadCount,
        canonicalSize: hashResult.canonical?.length || 0,
        processingTime: Math.round(performance.now() - startTime),
        timestamp: this.getDeterministicDate().toISOString(),
        deterministic: args.semantic
      };
      
      if (args.verbose) {
        const casMetrics = cas.getMetrics();
        
        result.metadata = {
          fileSize: rdfContent.length,
          canonicalSize: hashResult.canonical?.length || 0,
          cacheMetrics: {
            hitRate: casMetrics.cache.hitRate,
            hits: casMetrics.cache.hits,
            misses: casMetrics.cache.misses
          },
          performanceTargets: {
            met: result.processingTime <= 150,
            target: '≤150ms',
            actual: `${result.processingTime}ms`
          }
        };
      }
      
      if (args.benchmark) {
        await runBenchmark(rdfContent, args, result);
      }
      
      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n📄 Graph Hash Result`);
        console.log(`Hash: ${result.hash}`);
        console.log(`URI:  ${result.contentUri}`);
        console.log(`Algorithm: ${result.algorithm.toUpperCase()}`);
        console.log(`Quads: ${result.quadCount}`);
        console.log(`Processing time: ${result.processingTime}ms`);
        
        if (args.verbose) {
          console.log(`\n🔧 Performance Details`);
          console.log(`File size: ${result.metadata.fileSize} bytes`);
          console.log(`Canonical size: ${result.metadata.canonicalSize} bytes`);
          console.log(`Cache hit rate: ${(result.metadata.cacheMetrics.hitRate * 100).toFixed(1)}%`);
          console.log(`Target met: ${result.metadata.performanceTargets.met ? '✅' : '❌'} (${result.metadata.performanceTargets.actual})`);
        }
        
        if (result.processingTime <= 150) {
          console.log(`\n✅ Performance target met (≤150ms)`);
        } else {
          console.log(`\n⚠️  Performance target missed: ${result.processingTime}ms > 150ms`);
        }
      }
      
    } catch (error) {
      if (args.json) {
        console.error(JSON.stringify({ 
          error: error.message, 
          stack: args.verbose ? error.stack : undefined,
          timestamp: this.getDeterministicDate().toISOString()
        }, null, 2));
      } else {
        console.error(`❌ Hash generation failed: ${error.message}`);
        if (args.verbose) {
          console.error(`Stack trace: ${error.stack}`);
        }
      }
      process.exit(1);
    }
  }
});

/**
 * Run performance benchmark to test determinism
 */
async function runBenchmark(rdfContent, args, result) {
  console.log(`\n🧪 Running determinism benchmark...`);
  
  const semanticEngine = new SemanticHashEngine({
    hashAlgorithm: args.algorithm,
    enableCaching: false  // Disable cache for benchmark
  });
  
  const iterations = 5;
  const hashes = [];
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const hashResult = await semanticEngine.calculateSemanticHash(rdfContent, {
      format: args.format
    });
    const time = performance.now() - start;
    
    hashes.push(hashResult.semanticHash);
    times.push(time);
  }
  
  // Check determinism
  const allIdentical = hashes.every(h => h === hashes[0]);
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  
  console.log(`Deterministic: ${allIdentical ? '✅' : '❌'} (${iterations} iterations)`);
  console.log(`Average time: ${avgTime.toFixed(2)}ms`);
  console.log(`Min time: ${minTime.toFixed(2)}ms`);
  console.log(`Max time: ${maxTime.toFixed(2)}ms`);
  
  if (!allIdentical) {
    console.log(`❌ Hash determinism failed!`);
    hashes.forEach((h, i) => console.log(`  ${i + 1}: ${h}`));
  }
  
  // Add benchmark results to result object
  result.benchmark = {
    deterministic: allIdentical,
    iterations,
    avgTime: Math.round(avgTime),
    minTime: Math.round(minTime),
    maxTime: Math.round(maxTime),
    hashes: args.verbose ? hashes : [hashes[0]]
  };
}