/**
 * Graph Index Command
 * 
 * Build searchable index of graph subjects and predicates.
 * Optimizes impact analysis queries for large knowledge graphs.
 */

import { defineCommand } from 'citty';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { Parser } from 'n3';
import { mkdirSync } from 'fs';

import { success, error, output } from '../../lib/output.js';
import { validateTurtleFile, hashContent } from '../../lib/utils.js';

export default defineCommand({
  meta: {
    name: 'index',
    description: 'Build searchable index of graph subjects and predicates'
  },
  args: {
    input: {
      type: 'string',
      description: 'Path to TTL/RDF knowledge graph file',
      required: true,
      alias: 'i'
    },
    output: {
      type: 'string',
      description: 'Output path for index file',
      alias: 'o'
    },
    includeTriples: {
      type: 'boolean',
      description: 'Include full triple information in index',
      default: false
    },
    groupBy: {
      type: 'string',
      description: 'Index grouping strategy: subject|predicate|object',
      default: 'subject',
      alias: 'g'
    },
    format: {
      type: 'string',
      description: 'Output format (json|yaml)',
      default: 'json',
      alias: 'f'
    }
  },
  async run({ args }) {
    try {
      const startTime = Date.now();
      
      // Validate input file
      const graphInfo = validateTurtleFile(args.input);
      
      // Parse the graph
      const graphContent = readFileSync(args.input, 'utf8');
      const parser = new Parser();
      const quads = parser.parse(graphContent);
      
      // Build index based on grouping strategy
      const index = {};
      const statistics = {
        subjects: new Set(),
        predicates: new Set(),
        objects: new Set(),
        literals: new Set(),
        blankNodes: new Set()
      };
      
      quads.forEach((quad, quadIndex) => {
        // Update statistics
        statistics.subjects.add(quad.subject.value);
        statistics.predicates.add(quad.predicate.value);
        
        if (quad.object.termType === 'Literal') {
          statistics.literals.add(quad.object.value);
        } else {
          statistics.objects.add(quad.object.value);
        }
        
        if (quad.subject.termType === 'BlankNode') {
          statistics.blankNodes.add(quad.subject.value);
        }
        if (quad.object.termType === 'BlankNode') {
          statistics.blankNodes.add(quad.object.value);
        }
        
        // Build index
        let groupKey;
        switch (args.groupBy) {
          case 'predicate':
            groupKey = quad.predicate.value;
            break;
          case 'object':
            groupKey = quad.object.value;
            break;
          default: // 'subject'
            groupKey = quad.subject.value;
        }
        
        if (!index[groupKey]) {
          index[groupKey] = {
            count: 0,
            predicates: new Set(),
            relatedSubjects: new Set(),
            relatedObjects: new Set()
          };
          
          if (args.includeTriples) {
            index[groupKey].triples = [];
          }
        }
        
        // Update group data
        const group = index[groupKey];
        group.count++;
        group.predicates.add(quad.predicate.value);
        
        if (args.groupBy !== 'subject') {
          group.relatedSubjects.add(quad.subject.value);
        }
        if (args.groupBy !== 'object') {
          group.relatedObjects.add(quad.object.value);
        }
        
        if (args.includeTriples) {
          group.triples.push({
            subject: quad.subject.value,
            predicate: quad.predicate.value,
            object: quad.object.value,
            objectType: quad.object.termType
          });
        }
      });
      
      // Convert sets to arrays for JSON serialization
      const serializedIndex = {};
      Object.entries(index).forEach(([key, value]) => {
        serializedIndex[key] = {
          count: value.count,
          predicates: [...value.predicates],
          relatedSubjects: [...value.relatedSubjects],
          relatedObjects: [...value.relatedObjects]
        };
        
        if (args.includeTriples) {
          serializedIndex[key].triples = value.triples;
        }
      });
      
      const indexData = {
        source: {
          path: graphInfo.path,
          hash: graphInfo.hash,
          lastModified: graphInfo.lastModified
        },
        indexMetadata: {
          groupBy: args.groupBy,
          includeTriples: args.includeTriples,
          createdAt: new Date().toISOString(),
          entries: Object.keys(serializedIndex).length
        },
        statistics: {
          triples: quads.length,
          subjects: statistics.subjects.size,
          predicates: statistics.predicates.size,
          objects: statistics.objects.size,
          literals: statistics.literals.size,
          blankNodes: statistics.blankNodes.size
        },
        index: serializedIndex
      };
      
      // Write index file if output specified
      let outputPath = null;
      if (args.output) {
        outputPath = resolve(args.output);
        mkdirSync(dirname(outputPath), { recursive: true });
        
        const indexContent = JSON.stringify(indexData, null, 2);
        writeFileSync(outputPath, indexContent + '\n', 'utf8');
      }
      
      const duration = Date.now() - startTime;
      
      const result = success({
        index: outputPath ? { written: outputPath } : indexData.index,
        metadata: indexData.indexMetadata,
        statistics: indexData.statistics,
        metrics: {
          durationMs: duration,
          indexSize: Object.keys(serializedIndex).length,
          avgEntriesPerGroup: Object.values(serializedIndex).reduce((sum, g) => sum + g.count, 0) / Object.keys(serializedIndex).length
        }
      });
      
      output(result, args.format);
      
    } catch (err) {
      const result = error(err.message, 'INDEX_FAILED', {
        input: args.input,
        output: args.output,
        groupBy: args.groupBy,
        stack: process.env.KGEN_DEBUG ? err.stack : undefined
      });
      
      output(result, args.format);
      process.exit(1);
    }
  }
});