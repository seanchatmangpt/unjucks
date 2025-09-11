/**
 * kgen artifact dependencies - Artifact dependency resolution command
 * 
 * Implementation of CLI command for resolving artifact dependencies
 * and generating dependency graphs for build optimization.
 */

import { SparqlCliAdapter } from '../sparql-adapter.js';
import { existsSync } from 'fs';
import { resolve } from 'path';
import consola from 'consola';

export const artifactDependenciesCommand = {
  meta: {
    name: 'dependencies',
    description: 'Resolve artifact dependencies and generate dependency graphs'
  },
  
  args: {
    artifacts: {
      type: 'string',
      description: 'Comma-separated artifact URIs or file with artifact list',
      required: true
    }
  },
  
  options: {
    graph: {
      type: 'string',
      alias: 'g',
      description: 'RDF graph file to query',
      required: true
    },
    
    'output-format': {
      type: 'string',
      alias: 'f',
      description: 'Output format (json, dot, mermaid, table)',
      default: 'json'
    },
    
    'max-depth': {
      type: 'number',
      alias: 'd',
      description: 'Maximum dependency depth to traverse',
      default: 10
    },
    
    'dependency-type': {
      type: 'string',
      description: 'Filter by dependency type (compile, runtime, test)',
      default: null
    },
    
    'include-transitive': {
      type: 'boolean',
      description: 'Include transitive dependencies',
      default: true
    },
    
    'group-by': {
      type: 'string',
      description: 'Group results by (type, depth, artifact)',
      default: null
    },
    
    'reverse': {
      type: 'boolean',
      description: 'Show reverse dependencies (what depends on this)',
      default: false
    },
    
    'output-file': {
      type: 'string',
      alias: 'o',
      description: 'Output file path',
      default: null
    },
    
    'build-order': {
      type: 'boolean',
      description: 'Generate topological build order',
      default: false
    },
    
    verbose: {
      type: 'boolean',
      alias: 'v',
      description: 'Enable verbose output',
      default: false
    },
    
    'analyze-cycles': {
      type: 'boolean',
      description: 'Detect and report circular dependencies',
      default: true
    }
  },
  
  async run({ args, options }) {
    const logger = consola.withTag('kgen:artifact:dependencies');
    
    try {
      // Validate inputs
      const graphPath = resolve(options.graph);
      
      if (!existsSync(graphPath)) {
        logger.error(`Graph file not found: ${graphPath}`);
        process.exit(1);
      }
      
      // Parse artifact URIs
      const artifactUris = this._parseArtifactUris(args.artifacts);
      
      if (artifactUris.length === 0) {
        logger.error('No artifact URIs provided');
        process.exit(1);
      }
      
      logger.info(`Resolving dependencies for ${artifactUris.length} artifacts`);
      
      if (options.verbose) {
        logger.info('Configuration:', {
          graphPath,
          artifacts: artifactUris,
          maxDepth: options['max-depth'],
          dependencyType: options['dependency-type'],
          includeTransitive: options['include-transitive'],
          reverse: options.reverse,
          buildOrder: options['build-order'],
          analyzeCycles: options['analyze-cycles']
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
      adapter.on('dependencies:resolved', (data) => {
        if (options.verbose) {
          logger.info(`✓ Dependencies resolved for ${data.inputArtifacts} artifacts`);
          logger.info(`  - Successfully resolved: ${data.resolvedArtifacts}`);
        }
      });
      
      // Initialize adapter and load graph
      await adapter.initialize();
      await adapter.loadGraph(graphPath);
      
      // Execute dependency resolution
      const startTime = Date.now();
      
      const dependencyResult = await adapter.executeArtifactDependencies(artifactUris, {
        maxDepth: options['max-depth'],
        dependencyType: options['dependency-type'],
        includeTransitive: options['include-transitive'],
        reverse: options.reverse
      });
      
      // Post-process results
      const processedResult = this._processResults(dependencyResult, options);
      
      // Analyze circular dependencies if requested
      if (options['analyze-cycles']) {
        processedResult.cycleAnalysis = this._detectCircularDependencies(dependencyResult);
        
        if (processedResult.cycleAnalysis.cycles.length > 0) {
          logger.warn(`Found ${processedResult.cycleAnalysis.cycles.length} circular dependencies`);
        }
      }
      
      // Generate build order if requested
      if (options['build-order']) {
        processedResult.buildOrder = this._generateBuildOrder(dependencyResult);
        
        if (options.verbose) {
          logger.info(`Generated build order with ${processedResult.buildOrder.length} steps`);
        }
      }
      
      const totalTime = Date.now() - startTime;
      
      // Format and output results
      const output = this._formatOutput(processedResult, options['output-format']);
      
      if (options['output-file']) {
        const { writeFile } = await import('fs/promises');
        await writeFile(options['output-file'], output);
        logger.success(`Results saved to: ${options['output-file']}`);
      } else {
        console.log(output);
      }
      
      if (!options['output-file'] && options['output-format'] === 'json') {
        console.error(`Dependency resolution completed in ${totalTime}ms`);
      }
      
      // Exit with appropriate code
      const hasErrors = Object.values(dependencyResult.artifacts).some(a => a.error);
      const hasCycles = processedResult.cycleAnalysis?.cycles?.length > 0;
      
      if (hasErrors) {
        process.exit(1);
      } else if (hasCycles) {
        process.exit(2); // Circular dependencies detected
      } else {
        process.exit(0);
      }
      
    } catch (error) {
      logger.error('Failed to resolve artifact dependencies:', error);
      
      if (options.verbose) {
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  },
  
  _parseArtifactUris(artifactsArg) {
    // Handle comma-separated URIs or file path
    if (existsSync(artifactsArg)) {
      // Read from file
      const { readFileSync } = require('fs');
      const content = readFileSync(artifactsArg, 'utf8');
      return content.split('\n').filter(line => line.trim()).map(line => line.trim());
    } else {
      // Parse comma-separated list
      return artifactsArg.split(',').map(uri => uri.trim()).filter(uri => uri);
    }
  },
  
  _processResults(dependencyResult, options) {
    let processed = { ...dependencyResult };
    
    // Group results if requested
    if (options['group-by']) {
      processed.grouped = this._groupResults(dependencyResult, options['group-by']);
    }
    
    // Calculate summary statistics
    processed.summary = this._calculateSummary(dependencyResult);
    
    return processed;
  },
  
  _groupResults(dependencyResult, groupBy) {
    const grouped = {};
    
    for (const [artifactUri, data] of Object.entries(dependencyResult.artifacts)) {
      if (data.error) continue;
      
      for (const dep of data.dependencies || []) {
        let groupKey;
        
        switch (groupBy) {
          case 'type':
            groupKey = dep.relation || 'unknown';
            break;
          case 'depth':
            groupKey = `depth-${dep.depth || 0}`;
            break;
          case 'artifact':
            groupKey = dep.dependency;
            break;
          default:
            groupKey = 'all';
        }
        
        if (!grouped[groupKey]) {
          grouped[groupKey] = [];
        }
        
        grouped[groupKey].push({
          artifact: artifactUri,
          dependency: dep.dependency,
          relation: dep.relation,
          depth: dep.depth
        });
      }
    }
    
    return grouped;
  },
  
  _calculateSummary(dependencyResult) {
    const summary = {
      totalArtifacts: Object.keys(dependencyResult.artifacts).length,
      resolvedArtifacts: 0,
      failedArtifacts: 0,
      totalDependencies: 0,
      directDependencies: 0,
      transitiveDependencies: 0,
      uniqueDependencies: new Set(),
      dependencyTypes: {}
    };
    
    for (const [artifactUri, data] of Object.entries(dependencyResult.artifacts)) {
      if (data.error) {
        summary.failedArtifacts++;
        continue;
      }
      
      summary.resolvedArtifacts++;
      summary.totalDependencies += data.dependencies?.length || 0;
      summary.directDependencies += data.directDependencies || 0;
      summary.transitiveDependencies += data.transitiveDependencies || 0;
      
      for (const dep of data.dependencies || []) {
        summary.uniqueDependencies.add(dep.dependency);
        
        const type = dep.relation || 'unknown';
        summary.dependencyTypes[type] = (summary.dependencyTypes[type] || 0) + 1;
      }
    }
    
    summary.uniqueDependencies = summary.uniqueDependencies.size;
    
    return summary;
  },
  
  _detectCircularDependencies(dependencyResult) {
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();
    
    const detectCycle = (node, path = []) => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        const cycle = path.slice(cycleStart).concat([node]);
        cycles.push(cycle);
        return;
      }
      
      if (visited.has(node)) {
        return;
      }
      
      visited.add(node);
      recursionStack.add(node);
      path.push(node);
      
      const nodeData = dependencyResult.artifacts[node];
      if (nodeData && !nodeData.error) {
        for (const dep of nodeData.dependencies || []) {
          detectCycle(dep.dependency, [...path]);
        }
      }
      
      recursionStack.delete(node);
      path.pop();
    };
    
    // Check each artifact for cycles
    for (const artifactUri of Object.keys(dependencyResult.artifacts)) {
      if (!visited.has(artifactUri)) {
        detectCycle(artifactUri);
      }
    }
    
    return {
      hasCycles: cycles.length > 0,
      cycleCount: cycles.length,
      cycles: cycles.map(cycle => ({
        path: cycle,
        length: cycle.length - 1
      }))
    };
  },
  
  _generateBuildOrder(dependencyResult) {
    const buildOrder = [];
    const visited = new Set();
    const temp = new Set();
    
    const visit = (node) => {
      if (temp.has(node)) {
        // Circular dependency - skip for now
        return;
      }
      
      if (visited.has(node)) {
        return;
      }
      
      temp.add(node);
      
      const nodeData = dependencyResult.artifacts[node];
      if (nodeData && !nodeData.error) {
        for (const dep of nodeData.dependencies || []) {
          visit(dep.dependency);
        }
      }
      
      temp.delete(node);
      visited.add(node);
      buildOrder.push(node);
    };
    
    // Visit all artifacts
    for (const artifactUri of Object.keys(dependencyResult.artifacts)) {
      if (!visited.has(artifactUri)) {
        visit(artifactUri);
      }
    }
    
    return buildOrder;
  },
  
  _formatOutput(data, format) {
    switch (format) {
      case 'dot':
        return this._formatAsDot(data);
      case 'mermaid':
        return this._formatAsMermaid(data);
      case 'table':
        return this._formatAsTable(data);
      case 'json':
      default:
        return JSON.stringify(data, null, 2);
    }
  },
  
  _formatAsDot(data) {
    const lines = [];
    
    lines.push('digraph Dependencies {');
    lines.push('  rankdir=TB;');
    lines.push('  node [shape=box, style=rounded];');
    lines.push('');
    
    // Add nodes
    for (const artifactUri of Object.keys(data.artifacts)) {
      const label = artifactUri.split('/').pop() || artifactUri;
      lines.push(`  "${artifactUri}" [label="${label}"];`);
    }
    
    lines.push('');
    
    // Add edges
    for (const [artifactUri, artifactData] of Object.entries(data.artifacts)) {
      if (artifactData.error) continue;
      
      for (const dep of artifactData.dependencies || []) {
        const style = dep.relation === 'compile' ? 'solid' : 'dashed';
        lines.push(`  "${artifactUri}" -> "${dep.dependency}" [style=${style}];`);
      }
    }
    
    lines.push('}');
    
    return lines.join('\n');
  },
  
  _formatAsMermaid(data) {
    const lines = [];
    
    lines.push('graph TD');
    
    for (const [artifactUri, artifactData] of Object.entries(data.artifacts)) {
      if (artifactData.error) continue;
      
      const nodeId = artifactUri.replace(/[^a-zA-Z0-9]/g, '_');
      const label = artifactUri.split('/').pop() || artifactUri;
      
      for (const dep of artifactData.dependencies || []) {
        const depId = dep.dependency.replace(/[^a-zA-Z0-9]/g, '_');
        const depLabel = dep.dependency.split('/').pop() || dep.dependency;
        
        lines.push(`  ${nodeId}[${label}] --> ${depId}[${depLabel}]`);
      }
    }
    
    return lines.join('\n');
  },
  
  _formatAsTable(data) {
    const lines = [];
    
    lines.push('=== ARTIFACT DEPENDENCY ANALYSIS ===');
    lines.push('');
    
    if (data.summary) {
      lines.push('SUMMARY:');
      lines.push(`  Total Artifacts: ${data.summary.totalArtifacts}`);
      lines.push(`  Resolved: ${data.summary.resolvedArtifacts}`);
      lines.push(`  Failed: ${data.summary.failedArtifacts}`);
      lines.push(`  Total Dependencies: ${data.summary.totalDependencies}`);
      lines.push(`  Unique Dependencies: ${data.summary.uniqueDependencies}`);
      lines.push('');
    }
    
    if (data.cycleAnalysis && data.cycleAnalysis.hasCycles) {
      lines.push('CIRCULAR DEPENDENCIES:');
      for (const cycle of data.cycleAnalysis.cycles) {
        lines.push(`  ${cycle.path.join(' -> ')}`);
      }
      lines.push('');
    }
    
    if (data.buildOrder) {
      lines.push('BUILD ORDER:');
      for (let i = 0; i < data.buildOrder.length; i++) {
        const artifact = data.buildOrder[i].split('/').pop() || data.buildOrder[i];
        lines.push(`  ${i + 1}. ${artifact}`);
      }
      lines.push('');
    }
    
    lines.push('DEPENDENCIES:');
    for (const [artifactUri, artifactData] of Object.entries(data.artifacts)) {
      const artifactName = artifactUri.split('/').pop() || artifactUri;
      
      if (artifactData.error) {
        lines.push(`  ${artifactName}: ERROR - ${artifactData.error}`);
        continue;
      }
      
      lines.push(`  ${artifactName}:`);
      lines.push(`    Direct: ${artifactData.directDependencies || 0}`);
      lines.push(`    Transitive: ${artifactData.transitiveDependencies || 0}`);
      
      if (artifactData.dependencies && artifactData.dependencies.length > 0) {
        lines.push('    Dependencies:');
        for (const dep of artifactData.dependencies.slice(0, 5)) {
          const depName = dep.dependency.split('/').pop() || dep.dependency;
          lines.push(`      - ${depName} (${dep.relation})`);
        }
        
        if (artifactData.dependencies.length > 5) {
          lines.push(`      ... and ${artifactData.dependencies.length - 5} more`);
        }
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }
};

export default artifactDependenciesCommand;