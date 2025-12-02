/**
 * Graph Hash Command
 * 
 * Generate stable canonical hash of knowledge graphs using BLAKE3.
 * Implements deterministic hashing regardless of triple ordering or formatting.
 */

import { defineCommand } from 'citty';
import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { resolve } from 'path';
import { Parser, Store, Writer } from 'n3';
import { consola } from 'consola';

interface HashResult {
  hash: string;
  algorithm: string;
  inputFile: string;
  inputSize: number;
  tripleCount: number;
  canonical: boolean;
  metadata: {
    format: string;
    processingTime: number;
    normalized: boolean;
  };
}

export default defineCommand({
  meta: {
    name: 'hash',
    description: 'Generate stable canonical hash of knowledge graph using BLAKE3'
  },
  args: {
    input: {
      type: 'positional',
      description: 'Path to RDF file (TTL, NT, N3, RDF/XML)',
      required: true
    },
    algorithm: {
      type: 'string',
      description: 'Hash algorithm (blake3, sha256, sha512)',
      default: 'blake3',
      alias: 'a'
    },
    canonical: {
      type: 'boolean',
      description: 'Perform canonical normalization before hashing',
      default: true,
      alias: 'c'
    },
    format: {
      type: 'string',
      description: 'Input RDF format (auto-detect if not specified)',
      alias: 'f'
    },
    'output-length': {
      type: 'number',
      description: 'Hash output length in bytes (BLAKE3 only, default: 32)',
      default: 32
    },
    'include-metadata': {
      type: 'boolean',
      description: 'Include file metadata in hash calculation',
      default: false
    },
    benchmark: {
      type: 'boolean',
      description: 'Run performance benchmark',
      default: false
    },
    json: {
      type: 'boolean',
      description: 'Output result as JSON',
      default: false
    }
  },
  async run({ args }) {
    const startTime = Date.now();
    
    try {
      const inputPath = resolve(args.input);
      
      if (!existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      const inputContent = readFileSync(inputPath, 'utf8');
      const inputSize = Buffer.byteLength(inputContent, 'utf8');
      
      // Detect format if not specified
      const format = args.format || detectRDFFormat(inputPath, inputContent);
      
      // Parse RDF content
      const { triples, tripleCount } = await parseRDF(inputContent, format);
      
      // Generate canonical representation if requested
      let contentToHash = inputContent;
      let normalized = false;
      
      if (args.canonical) {
        contentToHash = await canonicalizeRDF(triples);
        normalized = true;
      }
      
      // Include metadata if requested
      if (args['include-metadata']) {
        const metadata = {
          inputFile: inputPath,
          inputSize,
          tripleCount,
          format,
          timestamp: new Date().toISOString()
        };
        contentToHash = JSON.stringify(metadata) + '\n' + contentToHash;
      }
      
      // Generate hash
      const hash = generateHash(contentToHash, args.algorithm, args['output-length']);
      
      const processingTime = Date.now() - startTime;
      
      const result: HashResult = {
        hash,
        algorithm: args.algorithm,
        inputFile: inputPath,
        inputSize,
        tripleCount,
        canonical: args.canonical,
        metadata: {
          format,
          processingTime,
          normalized
        }
      };

      // Benchmark if requested
      if (args.benchmark) {
        await runBenchmark(contentToHash, args.algorithm, args['output-length']);
      }

      // Output result
      if (args.json) {
        const output = {
          success: true,
          data: result,
          timestamp: new Date().toISOString()
        };
        console.log(JSON.stringify(output, null, 2));
      } else {
        consola.info(`📊 Graph Hash Result`);
        consola.info(`Hash: ${hash}`);
        consola.info(`Algorithm: ${args.algorithm.toUpperCase()}`);
        consola.info(`Triples: ${tripleCount.toLocaleString()}`);
        consola.info(`Size: ${formatBytes(inputSize)}`);
        consola.info(`Processing: ${processingTime}ms`);
        if (normalized) {
          consola.info(`✅ Canonicalized`);
        }
      }

    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'HASH_FAILED',
        timestamp: new Date().toISOString()
      };

      if (args.json) {
        console.log(JSON.stringify(errorResult, null, 2));
      } else {
        consola.error(`Hash generation failed: ${errorResult.error}`);
      }
      process.exit(1);
    }
  }
});

function detectRDFFormat(filePath: string, content: string): string {
  const extension = filePath.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'ttl':
    case 'turtle':
      return 'turtle';
    case 'nt':
      return 'n-triples';
    case 'n3':
      return 'n3';
    case 'nq':
      return 'n-quads';
    case 'rdf':
    case 'xml':
      return 'rdf/xml';
    case 'jsonld':
      return 'json-ld';
    default:
      // Try to detect from content
      if (content.includes('@prefix') || content.includes('PREFIX')) {
        return 'turtle';
      } else if (content.includes('<rdf:RDF')) {
        return 'rdf/xml';
      } else if (content.startsWith('[') || content.startsWith('{')) {
        return 'json-ld';
      } else {
        return 'turtle'; // Default fallback
      }
  }
}

async function parseRDF(content: string, format: string): Promise<{ triples: any[], tripleCount: number }> {
  const parser = new Parser({ format });
  const triples = parser.parse(content);
  
  return {
    triples,
    tripleCount: triples.length
  };
}

async function canonicalizeRDF(triples: any[]): Promise<string> {
  // Sort triples in canonical order for deterministic hashing
  const canonicalTriples = triples.sort((a, b) => {
    // Sort by subject, predicate, object
    const subjectCompare = a.subject.value.localeCompare(b.subject.value);
    if (subjectCompare !== 0) return subjectCompare;
    
    const predicateCompare = a.predicate.value.localeCompare(b.predicate.value);
    if (predicateCompare !== 0) return predicateCompare;
    
    return a.object.value.localeCompare(b.object.value);
  });
  
  // Create canonical N-Triples representation
  const store = new Store(canonicalTriples);
  const writer = new Writer({ format: 'N-Triples' });
  
  return new Promise((resolve, reject) => {
    writer.addQuads(store.getQuads(null, null, null, null));
    writer.end((error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

function generateHash(content: string, algorithm: string, outputLength?: number): string {
  switch (algorithm.toLowerCase()) {
    case 'blake3':
      // BLAKE3 with configurable output length
      return createHash('blake3', { outputLength: outputLength || 32 })
        .update(content, 'utf8')
        .digest('hex');
    
    case 'sha256':
      return createHash('sha256')
        .update(content, 'utf8')
        .digest('hex');
    
    case 'sha512':
      return createHash('sha512')
        .update(content, 'utf8')
        .digest('hex');
    
    case 'sha3-256':
      return createHash('sha3-256')
        .update(content, 'utf8')
        .digest('hex');
    
    default:
      throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }
}

async function runBenchmark(content: string, algorithm: string, outputLength?: number): Promise<void> {
  const iterations = [1, 10, 100, 1000];
  
  consola.info('🏃 Running benchmark...');
  
  for (const iter of iterations) {
    const start = Date.now();
    
    for (let i = 0; i < iter; i++) {
      generateHash(content, algorithm, outputLength);
    }
    
    const elapsed = Date.now() - start;
    const avgTime = elapsed / iter;
    const throughput = (Buffer.byteLength(content, 'utf8') * iter) / (elapsed / 1000);
    
    consola.info(`${iter} iterations: ${elapsed}ms total, ${avgTime.toFixed(2)}ms avg, ${formatBytes(throughput)}/s`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}