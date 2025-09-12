/**
 * Graph hash command - Generate canonical hash of knowledge graph
 * Usage: kgen graph hash <file.ttl> [options]
 */

import { defineCommand } from 'citty';
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { Parser } from 'n3';
import { formatHash, outputError, outputSuccess } from '../../utils/output.js';
import { loadConfig } from '../../utils/config.js';

export default defineCommand({
  meta: {
    name: 'hash',
    description: 'Generate canonical SHA256 hash of a knowledge graph'
  },
  args: {
    file: {
      type: 'positional',
      description: 'Path to RDF/Turtle file',
      required: true
    },
    format: {
      type: 'string',
      description: 'RDF format (turtle, n3, ntriples, rdfxml, jsonld)',
      default: 'turtle',
      alias: 'f'
    },
    algorithm: {
      type: 'string', 
      description: 'Hash algorithm (SHA256, SHA512, MD5)',
      default: 'SHA256',
      alias: 'a'
    },
    json: {
      type: 'boolean',
      description: 'Output in JSON format',
      default: false
    },
    verbose: {
      type: 'boolean',
      description: 'Verbose output with metadata',
      default: false,
      alias: 'v'
    },
    config: {
      type: 'string',
      description: 'Path to config file',
      alias: 'c'
    }
  },
  async run(context) {
    const { args } = context;
    
    try {
      // Load configuration
      const config = await loadConfig(args.config);
      
      if (args.verbose && !args.json) {
        console.log(`📊 Generating ${args.algorithm} hash for ${args.file}`);
      }
      
      // Read and parse RDF file
      const rdfContent = await readFile(args.file, 'utf8');
      const parser = new Parser({ format: args.format });
      
      // Parse into canonical form using GraphProcessor for consistency
      const { GraphProcessor } = await import('../../../kgen-core/src/rdf/graph-processor.js');
      const processor = new GraphProcessor({ parser: { format: args.format } });
      
      // Parse RDF content
      const parseResult = await processor.parseRDF(rdfContent, args.format);
      
      // Add quads to processor for canonical processing
      processor.addQuads(parseResult.quads);
      
      // Generate canonical hash using processor method
      const hash = processor.calculateContentHash({ algorithm: args.algorithm.toLowerCase() });
      const quads = parseResult.quads;
      
      // Prepare result
      const result = {
        file: args.file,
        hash,
        algorithm: args.algorithm,
        format: args.format,
        quadCount: parseResult.count,
        timestamp: new Date().toISOString()
      };
      
      if (args.verbose) {
        result.metadata = {
          fileSize: rdfContent.length,
          canonicalSize: parseResult.count * 50, // Rough estimate
          processingTime: parseResult.parseTime,
          stats: parseResult.stats
        };
      }
      
      if (args.json) {
        outputSuccess('Hash generated successfully', result, true);
      } else {
        formatHash(hash, args.algorithm);
        
        if (args.verbose) {
          console.log(`File: ${args.file}`);
          console.log(`Format: ${args.format}`);
          console.log(`Quads: ${quads.length}`);
          console.log(`Canonical size: ${canonicalContent.length} bytes`);
        }
        
        outputSuccess(`Hash generated successfully`);
      }
      
    } catch (error) {
      outputError(`Failed to generate hash: ${error.message}`, error, args.json);
      process.exit(1);
    }
  }
});