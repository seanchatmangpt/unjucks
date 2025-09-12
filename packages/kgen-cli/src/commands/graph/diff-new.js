/**
 * Graph diff command - Compare two knowledge graphs using GraphProcessor
 * Usage: kgen graph diff <file1.ttl> <file2.ttl> [options]
 */

import { defineCommand } from 'citty';
import { readFile } from 'fs/promises';
import { formatDiff, outputError, outputSuccess } from '../../utils/output.js';
import { loadConfig } from '../../utils/config.js';

export default defineCommand({
  meta: {
    name: 'diff',
    description: 'Compare two knowledge graphs and show differences'
  },
  args: {
    file1: {
      type: 'positional',
      description: 'First RDF/Turtle file',
      required: true
    },
    file2: {
      type: 'positional', 
      description: 'Second RDF/Turtle file',
      required: true
    },
    format: {
      type: 'string',
      description: 'RDF format (turtle, n3, ntriples, rdfxml, jsonld)',
      default: 'turtle',
      alias: 'f'
    },
    reportType: {
      type: 'string',
      description: 'Report type (subjects, triples, artifacts)',
      default: 'subjects',
      alias: 't'
    },
    ignoreBlankNodes: {
      type: 'boolean',
      description: 'Ignore blank node differences',
      default: true
    },
    ignorePredicates: {
      type: 'string',
      description: 'Comma-separated list of predicates to ignore',
      alias: 'i'
    },
    json: {
      type: 'boolean',
      description: 'Output in JSON format',
      default: false
    },
    verbose: {
      type: 'boolean',
      description: 'Verbose output with detailed changes',
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
      const ignoreList = args.ignorePredicates 
        ? args.ignorePredicates.split(',').map(p => p.trim())
        : config.impact?.ignore?.predicates || [];
      
      if (args.verbose && !args.json) {
        console.log(`🔍 Comparing ${args.file1} with ${args.file2}`);
      }
      
      // Parse both files using GraphProcessor
      const [processor1, processor2] = await Promise.all([
        parseRDFFile(args.file1, args.format),
        parseRDFFile(args.file2, args.format)
      ]);
      
      // Use GraphProcessor diff functionality
      const diffOptions = {
        ignoreBlankNodes: args.ignoreBlankNodes,
        ignorePredicates: ignoreList,
        includeTriples: args.reportType === 'triples',
        maxTriples: 1000
      };
      
      const diffResult = processor1.diff(processor2, diffOptions);
      
      // Add metadata
      const result = {
        file1: args.file1,
        file2: args.file2,
        reportType: args.reportType,
        diff: diffResult,
        summary: diffResult.changes,
        metrics: diffResult.metrics,
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`📊 Graph diff results (${args.reportType}):`);
        console.log(`  Added: ${diffResult.changes.added}`);
        console.log(`  Removed: ${diffResult.changes.removed}`);
        console.log(`  Modified: ${diffResult.changes.modified}`);
        console.log(`  Total changes: ${diffResult.changes.total}`);
        
        if (args.verbose) {
          console.log(`\nFiles compared:`);
          console.log(`  File 1: ${args.file1} (${processor1.store.size} quads)`);
          console.log(`  File 2: ${args.file2} (${processor2.store.size} quads)`);
          console.log(`  Report type: ${args.reportType}`);
          console.log(`  Ignored predicates: ${ignoreList.length > 0 ? ignoreList.join(', ') : 'none'}`);
          console.log(`  Calculation time: ${diffResult.calculationTime}ms`);
          console.log(`  Change percentage: ${diffResult.metrics.changePercentage.toFixed(2)}%`);
          console.log(`  Impacted subjects: ${diffResult.subjects.total}`);
        }
      }
      
      // Exit with non-zero code if differences found (for CI/CD)
      if (result.summary.total > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      outputError(`Failed to compare graphs: ${error.message}`, error, args.json);
      process.exit(2);
    }
  }
});

/**
 * Parse RDF file using GraphProcessor for consistency
 */
async function parseRDFFile(filePath, format) {
  const content = await readFile(filePath, 'utf8');
  const { GraphProcessor } = await import('../../../kgen-core/src/rdf/graph-processor.js');
  
  const processor = new GraphProcessor({ parser: { format } });
  const parseResult = await processor.parseRDF(content, format);
  
  // Add to processor for canonical processing
  processor.addQuads(parseResult.quads);
  
  return processor;
}