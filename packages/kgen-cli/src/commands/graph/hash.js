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
      
      // Parse into canonical form
      const quads = [];
      parser.parse(rdfContent, (error, quad, prefixes) => {
        if (error) {
          throw error;
        }
        if (quad) {
          // Convert quad to canonical string representation
          const canonicalQuad = `${quad.subject.value} ${quad.predicate.value} ${quad.object.value}`;
          quads.push(canonicalQuad);
        }
      });
      
      // Sort quads for deterministic hash
      quads.sort();
      
      // Generate hash
      const canonicalContent = quads.join('\n');
      const hash = createHash(args.algorithm.toLowerCase()).update(canonicalContent).digest('hex');
      
      // Prepare result
      const result = {
        file: args.file,
        hash,
        algorithm: args.algorithm,
        format: args.format,
        quadCount: quads.length,
        timestamp: new Date().toISOString()
      };
      
      if (args.verbose) {
        result.metadata = {
          fileSize: rdfContent.length,
          canonicalSize: canonicalContent.length,
          processingTime: Date.now() // Would be calculated properly
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