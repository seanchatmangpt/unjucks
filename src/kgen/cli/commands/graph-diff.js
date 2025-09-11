/**
 * kgen graph diff - Graph difference and impact analysis command
 * 
 * Implementation of the "kgen graph diff" CLI command for analyzing
 * changes between two graphs and calculating artifact impact.
 */

import { SparqlCliAdapter } from '../sparql-adapter.js';
import { existsSync } from 'fs';
import { resolve } from 'path';
import consola from 'consola';

export const graphDiffCommand = {
  meta: {
    name: 'diff',
    description: 'Calculate graph differences and analyze artifact impact'
  },
  
  args: {
    base: {
      type: 'positional',
      description: 'Base (original) graph file path',
      required: true
    },
    target: {
      type: 'positional', 
      description: 'Target (modified) graph file path',
      required: true
    }
  },
  
  options: {
    'output-format': {
      type: 'string',
      alias: 'f',
      description: 'Output format (json, table, csv)',
      default: 'json'
    },
    
    'report-type': {
      type: 'string',
      description: 'Report type (subjects, triples, artifacts, impact)',
      default: 'impact'
    },
    
    'include-unchanged': {
      type: 'boolean',
      description: 'Include unchanged elements in report',
      default: false
    },
    
    'max-depth': {
      type: 'number',
      description: 'Maximum depth for impact analysis',
      default: 5
    },
    
    'threshold': {
      type: 'number',
      description: 'Minimum changes to report (0-100)',
      default: 0
    },
    
    verbose: {
      type: 'boolean',
      alias: 'v',
      description: 'Enable verbose output',
      default: false
    },
    
    'analyze-risk': {
      type: 'boolean',
      description: 'Include risk assessment in analysis',
      default: true
    },
    
    'save-report': {
      type: 'string',
      description: 'Save detailed report to file',
      default: null
    }
  },
  
  async run({ args, options }) {
    const logger = consola.withTag('kgen:graph:diff');
    
    try {
      // Validate inputs
      const basePath = resolve(args.base);
      const targetPath = resolve(args.target);
      
      if (!existsSync(basePath)) {
        logger.error(`Base graph file not found: ${basePath}`);
        process.exit(1);
      }
      
      if (!existsSync(targetPath)) {
        logger.error(`Target graph file not found: ${targetPath}`);
        process.exit(1);
      }
      
      logger.info(`Analyzing graph diff: ${basePath} -> ${targetPath}`);
      
      if (options.verbose) {
        logger.info('Configuration:', {
          basePath,
          targetPath,
          reportType: options['report-type'],
          outputFormat: options['output-format'],
          maxDepth: options['max-depth'],
          threshold: options.threshold,
          analyzeRisk: options['analyze-risk']
        });
      }
      
      // Initialize SPARQL CLI adapter  
      const adapter = new SparqlCliAdapter({
        outputFormat: options['output-format'],
        enableVerbose: options.verbose,
        enableProgress: true,
        maxDepth: options['max-depth']
      });
      
      // Setup progress reporting
      adapter.on('diff:analyzed', (data) => {
        if (options.verbose) {
          logger.info(`✓ Diff analysis completed`);
          logger.info(`  - Added triples: ${data.changes.added}`);
          logger.info(`  - Removed triples: ${data.changes.removed}`);
          logger.info(`  - Impacted artifacts: ${data.impactedArtifacts}`);
        }
      });
      
      // Initialize adapter
      await adapter.initialize();
      
      // Execute graph diff analysis
      const startTime = Date.now();
      
      const diffResult = await adapter.executeGraphDiff(basePath, targetPath, {
        reportType: options['report-type'],
        includeUnchanged: options['include-unchanged'],
        maxDepth: options['max-depth'],
        threshold: options.threshold,
        analyzeRisk: options['analyze-risk']
      });
      
      const totalTime = Date.now() - startTime;
      
      // Process and filter results based on options
      const processedResult = this._processResults(diffResult, options);
      
      // Save detailed report if requested
      if (options['save-report']) {
        const { writeFile } = await import('fs/promises');
        await writeFile(options['save-report'], JSON.stringify(diffResult, null, 2));
        logger.info(`Detailed report saved to: ${options['save-report']}`);
      }
      
      // Output results
      if (options['output-format'] === 'json') {
        // For JSON output, show summary to stderr and JSON to stdout
        if (!options.verbose) {
          console.error(`Diff analysis completed in ${totalTime}ms`);
          console.error(`Changes: +${diffResult.changes.added} -${diffResult.changes.removed}`);
          console.error(`Impacted artifacts: ${diffResult.impact.artifacts?.length || 0}`);
        }
        
        console.log(JSON.stringify(processedResult, null, 2));
      } else {
        // For other formats, format appropriately
        const formatted = this._formatOutput(processedResult, options['output-format']);
        console.log(formatted);
        
        if (!options.verbose) {
          logger.success(`Diff analysis completed in ${totalTime}ms`);
        }
      }
      
      // Exit with appropriate code for automation
      const hasSignificantChanges = diffResult.changes.added + diffResult.changes.removed > options.threshold;
      const hasHighRisk = diffResult.impact.riskLevel === 'high';
      
      if (hasSignificantChanges || hasHighRisk) {
        process.exit(2); // Indicates significant changes detected
      } else {
        process.exit(0); // No significant changes
      }
      
    } catch (error) {
      logger.error('Failed to analyze graph diff:', error);
      
      if (options.verbose) {
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  },
  
  _processResults(diffResult, options) {
    const processed = { ...diffResult };
    
    // Filter based on report type
    switch (options['report-type']) {
      case 'subjects':
        return {
          metadata: processed.metadata,
          changes: processed.changes,
          subjects: processed.impact.impactedSubjects
        };
        
      case 'triples':
        return {
          metadata: processed.metadata,
          changes: processed.changes,
          triples: processed.triples
        };
        
      case 'artifacts':
        return {
          metadata: processed.metadata,
          changes: processed.changes,
          artifacts: processed.impact.artifacts
        };
        
      case 'impact':
      default:
        return processed;
    }
  },
  
  _formatOutput(data, format) {
    switch (format) {
      case 'table':
        return this._formatAsTable(data);
      case 'csv':
        return this._formatAsCsv(data);
      case 'json':
      default:
        return JSON.stringify(data, null, 2);
    }
  },
  
  _formatAsTable(data) {
    // Simple table formatting for diff results
    const lines = [];
    
    lines.push('=== GRAPH DIFF ANALYSIS ===');
    lines.push('');
    
    if (data.metadata) {
      lines.push(`Base Graph: ${data.metadata.baseGraph}`);
      lines.push(`Target Graph: ${data.metadata.targetGraph}`);
      lines.push(`Analysis Time: ${data.metadata.timestamp}`);
      lines.push('');
    }
    
    if (data.changes) {
      lines.push('CHANGES:');
      lines.push(`  Added Triples: ${data.changes.added}`);
      lines.push(`  Removed Triples: ${data.changes.removed}`);
      lines.push(`  Modified: ${data.changes.modified}`);
      lines.push('');
    }
    
    if (data.impact) {
      lines.push('IMPACT ANALYSIS:');
      lines.push(`  Impacted Subjects: ${data.impact.impactedSubjects?.length || 0}`);
      lines.push(`  Affected Artifacts: ${data.impact.artifacts?.length || 0}`);
      lines.push(`  Rebuild Required: ${data.impact.estimatedRebuildRequired ? 'YES' : 'NO'}`);
      lines.push(`  Risk Level: ${data.impact.riskLevel?.toUpperCase() || 'UNKNOWN'}`);
      lines.push('');
    }
    
    if (data.impact?.artifacts?.length > 0) {
      lines.push('AFFECTED ARTIFACTS:');
      for (const artifact of data.impact.artifacts.slice(0, 10)) {
        lines.push(`  - ${artifact}`);
      }
      if (data.impact.artifacts.length > 10) {
        lines.push(`  ... and ${data.impact.artifacts.length - 10} more`);
      }
    }
    
    return lines.join('\n');
  },
  
  _formatAsCsv(data) {
    const rows = [];
    
    // CSV headers
    rows.push('type,subject,predicate,object,change');
    
    // Added triples
    if (data.triples?.added) {
      for (const triple of data.triples.added) {
        rows.push(`added,${triple.subject},${triple.predicate},${triple.object}`);
      }
    }
    
    // Removed triples
    if (data.triples?.removed) {
      for (const triple of data.triples.removed) {
        rows.push(`removed,${triple.subject},${triple.predicate},${triple.object}`);
      }
    }
    
    return rows.join('\n');
  }
};

export default graphDiffCommand;