/**
 * Graph diff command - Compare two knowledge graphs
 * Usage: kgen graph diff <file1.ttl> <file2.ttl> [options]
 */

import { defineCommand } from 'citty';
import { readFile } from 'fs/promises';
import { Parser } from 'n3';
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
      
      // Parse both files
      const [graph1, graph2] = await Promise.all([
        parseRDFFile(args.file1, args.format),
        parseRDFFile(args.file2, args.format)
      ]);
      
      // Compute differences based on report type
      let diff;
      switch (args.reportType) {
        case 'triples':
          diff = computeTripleDiff(graph1, graph2, { ignoreBlankNodes: args.ignoreBlankNodes, ignorePredicates: ignoreList });
          break;
        case 'subjects':
          diff = computeSubjectDiff(graph1, graph2, { ignoreBlankNodes: args.ignoreBlankNodes, ignorePredicates: ignoreList });
          break;
        case 'artifacts':
          diff = computeArtifactDiff(graph1, graph2, { ignoreBlankNodes: args.ignoreBlankNodes, ignorePredicates: ignoreList });
          break;
        default:
          throw new Error(`Unknown report type: ${args.reportType}`);
      }
      
      // Add metadata
      const result = {
        file1: args.file1,
        file2: args.file2,
        reportType: args.reportType,
        diff,
        summary: {
          added: diff.added?.length || 0,
          removed: diff.removed?.length || 0,
          modified: diff.modified?.length || 0,
          total: (diff.added?.length || 0) + (diff.removed?.length || 0) + (diff.modified?.length || 0)
        },
        timestamp: new Date().toISOString()
      };
      
      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`📊 Graph diff results (${args.reportType}):`);
        formatDiff(diff);
        
        if (args.verbose) {
          console.log(`\nFiles compared:`);
          console.log(`  File 1: ${args.file1} (${graph1.size} quads)`);
          console.log(`  File 2: ${args.file2} (${graph2.size} quads)`);
          console.log(`  Report type: ${args.reportType}`);
          console.log(`  Ignored predicates: ${ignoreList.length > 0 ? ignoreList.join(', ') : 'none'}`);
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
 * Parse RDF file into quad set
 */
async function parseRDFFile(filePath, format) {
  const content = await readFile(filePath, 'utf8');
  const parser = new Parser({ format });
  const quads = new Set();
  
  return new Promise((resolve, reject) => {
    parser.parse(content, (error, quad, prefixes) => {
      if (error) {
        reject(error);
        return;
      }
      if (quad) {
        const quadString = `${quad.subject.value}|${quad.predicate.value}|${quad.object.value}|${quad.graph?.value || ''}`;
        quads.add(quadString);
      } else {
        // Parsing complete
        resolve(quads);
      }
    });
  });
}

/**
 * Compute triple-level differences
 */
function computeTripleDiff(graph1, graph2, options = {}) {
  const set1 = filterQuads(graph1, options);
  const set2 = filterQuads(graph2, options);
  
  const added = [...set2].filter(quad => !set1.has(quad));
  const removed = [...set1].filter(quad => !set2.has(quad));
  
  return { added, removed, modified: [] };
}

/**
 * Compute subject-level differences
 */
function computeSubjectDiff(graph1, graph2, options = {}) {
  const subjects1 = getSubjects(filterQuads(graph1, options));
  const subjects2 = getSubjects(filterQuads(graph2, options));
  
  const added = [...subjects2].filter(subj => !subjects1.has(subj));
  const removed = [...subjects1].filter(subj => !subjects2.has(subj));
  const modified = [...subjects1].filter(subj => 
    subjects2.has(subj) && hasSubjectChanged(subj, graph1, graph2, options)
  );
  
  return { added, removed, modified };
}

/**
 * Compute artifact-level differences (placeholder - would integrate with template system)
 */
function computeArtifactDiff(graph1, graph2, options = {}) {
  // This would analyze which generated artifacts would be affected
  // For now, falling back to subject diff
  return computeSubjectDiff(graph1, graph2, options);
}

/**
 * Filter quads based on options
 */
function filterQuads(quadSet, options) {
  if (!options.ignoreBlankNodes && (!options.ignorePredicates || options.ignorePredicates.length === 0)) {
    return quadSet;
  }
  
  const filtered = new Set();
  for (const quad of quadSet) {
    const [subject, predicate, object, graph] = quad.split('|');
    
    // Skip blank nodes if ignoring
    if (options.ignoreBlankNodes && (subject.startsWith('_:') || object.startsWith('_:'))) {
      continue;
    }
    
    // Skip ignored predicates
    if (options.ignorePredicates && options.ignorePredicates.includes(predicate)) {
      continue;
    }
    
    filtered.add(quad);
  }
  
  return filtered;
}

/**
 * Extract unique subjects from quad set
 */
function getSubjects(quadSet) {
  const subjects = new Set();
  for (const quad of quadSet) {
    const [subject] = quad.split('|');
    subjects.add(subject);
  }
  return subjects;
}

/**
 * Check if subject has changed between graphs
 */
function hasSubjectChanged(subject, graph1, graph2, options) {
  const quads1 = [...graph1].filter(q => q.startsWith(subject + '|'));
  const quads2 = [...graph2].filter(q => q.startsWith(subject + '|'));
  
  const filtered1 = filterQuads(new Set(quads1), options);
  const filtered2 = filterQuads(new Set(quads2), options);
  
  return filtered1.size !== filtered2.size || 
    ![...filtered1].every(quad => filtered2.has(quad));
}