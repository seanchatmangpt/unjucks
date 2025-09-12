/**
 * Supply Chain Visualization and Tracing Tool
 * 
 * Implements dark-matter supply chain analysis:
 * - Trace artifact lineage back to templates
 * - Visualize dependency graphs
 * - Generate supply chain reports
 * - Detect circular dependencies
 * - Validate entire supply chain integrity
 */

import { defineCommand } from 'citty';
import { UnifiedProvenanceSystem } from '../../../kgen-core/src/provenance/unified-provenance.js';
import { resolve, relative, dirname } from 'path';
import { promises as fs } from 'fs';
import consola from 'consola';

export default defineCommand({
  meta: {
    name: 'supply-chain',
    description: 'Supply chain visualization and analysis tools (Agent #10)',
    version: '2.0.0'
  },
  args: {
    directory: {
      type: 'positional',
      description: 'Directory to analyze supply chain',
      default: '.'
    }
  },
  
  subCommands: {
    // Trace artifact back to its origin
    trace: defineCommand({
      meta: {
        name: 'trace',
        description: 'Trace artifact lineage back to templates and dependencies'
      },
      args: {
        artifact: {
          type: 'positional',
          description: 'Path to artifact to trace',
          required: true
        },
        depth: {
          type: 'number',
          description: 'Maximum depth to trace (0 = unlimited)',
          default: 0
        },
        format: {
          type: 'string',
          description: 'Output format (tree, json, dot, mermaid)',
          default: 'tree'
        },
        'include-hashes': {
          type: 'boolean',
          description: 'Include content hashes in output',
          default: false
        },
        'save-to': {
          type: 'string',
          description: 'Save output to file'
        }
      },
      async run({ args }) {
        const logger = consola.withTag('supply-chain:trace');
        
        try {
          const artifactPath = resolve(args.artifact);
          logger.info(`Tracing supply chain for: ${artifactPath}`);
          
          const provenance = new UnifiedProvenanceSystem({
            enableGitFirst: true,
            noCentralDatabase: true
          });
          await provenance.initialize();
          
          // Build trace tree
          const traceResult = await traceArtifactLineage(
            provenance, 
            artifactPath, 
            args.depth
          );
          
          // Format output
          const output = await formatTraceOutput(traceResult, {
            format: args.format,
            includeHashes: args['include-hashes'],
            rootArtifact: artifactPath
          });
          
          if (args['save-to']) {
            await fs.writeFile(args['save-to'], output);
            logger.success(`Trace saved to: ${args['save-to']}`);
          } else {
            console.log(output);
          }
          
        } catch (error) {
          logger.error('Trace failed:', error);
          process.exitCode = 1;
        }
      }
    }),
    
    // Visualize supply chain graph
    visualize: defineCommand({
      meta: {
        name: 'visualize',
        description: 'Generate visual representation of supply chain'
      },
      args: {
        directory: {
          type: 'positional',
          description: 'Directory to analyze',
          default: '.'
        },
        format: {
          type: 'string',
          description: 'Output format (svg, png, dot, mermaid, html)',
          default: 'dot'
        },
        layout: {
          type: 'string',
          description: 'Graph layout (hierarchical, force, circular)',
          default: 'hierarchical'
        },
        'include-templates': {
          type: 'boolean',
          description: 'Include template nodes in visualization',
          default: true
        },
        'group-by-family': {
          type: 'boolean',
          description: 'Group artifacts by template family',
          default: true
        },
        'output-file': {
          type: 'string',
          description: 'Output file path'
        },
        'open-browser': {
          type: 'boolean',
          description: 'Open visualization in browser (HTML format only)',
          default: false
        }
      },
      async run({ args }) {
        const logger = consola.withTag('supply-chain:visualize');
        
        try {
          logger.info(`Generating supply chain visualization for: ${args.directory}`);
          
          const provenance = new UnifiedProvenanceSystem({
            enableGitFirst: true,
            noCentralDatabase: true
          });
          await provenance.initialize();
          
          // Scan directory for artifacts
          const artifacts = await scanDirectoryForArtifacts(args.directory);
          logger.info(`Found ${artifacts.length} artifacts`);
          
          // Build supply chain graph
          const supplyChainGraph = await buildSupplyChainGraph(provenance, artifacts);
          
          // Generate visualization
          const visualization = await generateVisualization(supplyChainGraph, {
            format: args.format,
            layout: args.layout,
            includeTemplates: args['include-templates'],
            groupByFamily: args['group-by-family']
          });
          
          // Save or display
          if (args['output-file'] || args.format !== 'dot') {
            const outputFile = args['output-file'] || `supply-chain.${args.format}`;
            await fs.writeFile(outputFile, visualization);
            logger.success(`Visualization saved to: ${outputFile}`);
            
            if (args['open-browser'] && args.format === 'html') {
              const { default: open } = await import('open');
              await open(outputFile);
            }
          } else {
            console.log(visualization);
          }
          
        } catch (error) {
          logger.error('Visualization failed:', error);
          process.exitCode = 1;
        }
      }
    }),
    
    // Verify entire supply chain
    'verify-all': defineCommand({
      meta: {
        name: 'verify-all',
        description: 'Verify integrity of entire supply chain'
      },
      args: {
        directory: {
          type: 'positional',
          description: 'Directory to verify',
          default: '.'
        },
        'fail-fast': {
          type: 'boolean',
          description: 'Stop on first verification failure',
          default: false
        },
        'parallel': {
          type: 'boolean',
          description: 'Run verifications in parallel',
          default: true
        },
        'output-report': {
          type: 'string',
          description: 'Save detailed report to file'
        },
        'format': {
          type: 'string',
          description: 'Report format (json, html, markdown)',
          default: 'markdown'
        }
      },
      async run({ args }) {
        const logger = consola.withTag('supply-chain:verify-all');
        
        try {
          logger.info(`Verifying supply chain in: ${args.directory}`);
          
          const provenance = new UnifiedProvenanceSystem({
            enableGitFirst: true,
            noCentralDatabase: true
          });
          await provenance.initialize();
          
          // Scan for artifacts
          const artifacts = await scanDirectoryForArtifacts(args.directory);
          logger.info(`Found ${artifacts.length} artifacts to verify`);
          
          // Verify all artifacts
          const verificationResults = await verifySupplyChainBatch(
            provenance, 
            artifacts, 
            {
              parallel: args.parallel,
              failFast: args['fail-fast']
            }
          );
          
          // Generate comprehensive report
          const report = await generateSupplyChainReport(verificationResults, {
            format: args.format,
            includeDetails: true,
            directory: args.directory
          });
          
          // Display summary
          displayVerificationSummary(verificationResults);
          
          // Save report if requested
          if (args['output-report']) {
            await fs.writeFile(args['output-report'], report);
            logger.success(`Detailed report saved to: ${args['output-report']}`);
          }
          
          // Set exit code based on overall result
          const allVerified = verificationResults.every(r => r.verified);
          process.exitCode = allVerified ? 0 : 1;
          
        } catch (error) {
          logger.error('Supply chain verification failed:', error);
          process.exitCode = 1;
        }
      }
    }),
    
    // Analyze supply chain metrics
    analyze: defineCommand({
      meta: {
        name: 'analyze',
        description: 'Analyze supply chain metrics and health'
      },
      args: {
        directory: {
          type: 'positional',
          description: 'Directory to analyze',
          default: '.'
        },
        'include-risk': {
          type: 'boolean',
          description: 'Include risk assessment',
          default: true
        },
        'include-performance': {
          type: 'boolean',
          description: 'Include performance metrics',
          default: true
        },
        'output-format': {
          type: 'string',
          description: 'Output format (json, table, dashboard)',
          default: 'table'
        }
      },
      async run({ args }) {
        const logger = consola.withTag('supply-chain:analyze');
        
        try {
          logger.info(`Analyzing supply chain metrics for: ${args.directory}`);
          
          const provenance = new UnifiedProvenanceSystem({
            enableGitFirst: true,
            noCentralDatabase: true
          });
          await provenance.initialize();
          
          // Generate comprehensive supply chain analysis
          const analysis = await analyzeSupplyChain(provenance, args.directory, {
            includeRisk: args['include-risk'],
            includePerformance: args['include-performance']
          });
          
          // Display analysis results
          await displayAnalysisResults(analysis, {
            format: args['output-format']
          });
          
        } catch (error) {
          logger.error('Supply chain analysis failed:', error);
          process.exitCode = 1;
        }
      }
    }),
    
    // Export supply chain data
    export: defineCommand({
      meta: {
        name: 'export',
        description: 'Export supply chain data for external tools'
      },
      args: {
        directory: {
          type: 'positional',
          description: 'Directory to export',
          default: '.'
        },
        format: {
          type: 'string',
          description: 'Export format (json, csv, xml, rdf, sbom)',
          default: 'json'
        },
        'output-file': {
          type: 'string',
          description: 'Output file path',
          required: true
        },
        'include-content': {
          type: 'boolean',
          description: 'Include artifact content hashes',
          default: true
        },
        'sbom-format': {
          type: 'string',
          description: 'SBOM format (spdx, cyclonedx)',
          default: 'spdx'
        }
      },
      async run({ args }) {
        const logger = consola.withTag('supply-chain:export');
        
        try {
          logger.info(`Exporting supply chain data from: ${args.directory}`);
          
          const provenance = new UnifiedProvenanceSystem({
            enableGitFirst: true,
            noCentralDatabase: true
          });
          await provenance.initialize();
          
          // Export supply chain data
          const exportData = await exportSupplyChainData(provenance, args.directory, {
            format: args.format,
            includeContent: args['include-content'],
            sbomFormat: args['sbom-format']
          });
          
          await fs.writeFile(args['output-file'], exportData);
          logger.success(`Supply chain data exported to: ${args['output-file']}`);
          
        } catch (error) {
          logger.error('Supply chain export failed:', error);
          process.exitCode = 1;
        }
      }
    })
  }
});

// Implementation functions

async function traceArtifactLineage(provenance, artifactPath, maxDepth = 0) {
  const traced = new Set();
  const lineage = {
    root: artifactPath,
    nodes: new Map(),
    edges: [],
    depth: 0
  };
  
  async function traceRecursive(currentPath, currentDepth) {
    if (traced.has(currentPath) || (maxDepth > 0 && currentDepth >= maxDepth)) {
      return;
    }
    
    traced.add(currentPath);
    lineage.depth = Math.max(lineage.depth, currentDepth);
    
    try {
      // Get provenance for current artifact
      const provenanceData = await provenance.getProvenance(currentPath);
      
      if (!provenanceData.combined) return;
      
      const node = {
        path: currentPath,
        type: 'artifact',
        depth: currentDepth,
        provenance: provenanceData.combined,
        verified: false // Will be set during verification
      };
      
      lineage.nodes.set(currentPath, node);
      
      // Trace template if exists
      const templatePath = provenanceData.combined.generation?.templatePath;
      if (templatePath) {
        const templateNode = {
          path: templatePath,
          type: 'template',
          depth: currentDepth + 1,
          verified: await verifyTemplateExists(templatePath)
        };
        
        lineage.nodes.set(templatePath, templateNode);
        lineage.edges.push({
          source: templatePath,
          target: currentPath,
          type: 'generates'
        });
      }
      
      // Trace dependencies
      if (provenanceData.combined.dependencies) {
        for (const dep of provenanceData.combined.dependencies) {
          lineage.edges.push({
            source: dep,
            target: currentPath,
            type: 'depends_on'
          });
          
          await traceRecursive(dep, currentDepth + 1);
        }
      }
      
    } catch (error) {
      // Create error node
      lineage.nodes.set(currentPath, {
        path: currentPath,
        type: 'artifact',
        depth: currentDepth,
        error: error.message,
        verified: false
      });
    }
  }
  
  await traceRecursive(artifactPath, 0);
  return lineage;
}

async function formatTraceOutput(traceResult, options) {
  switch (options.format) {
    case 'json':
      return JSON.stringify(traceResult, null, 2);
      
    case 'dot':
      return generateDotGraph(traceResult, options);
      
    case 'mermaid':
      return generateMermaidGraph(traceResult, options);
      
    default: // tree
      return generateTreeOutput(traceResult, options);
  }
}

function generateTreeOutput(traceResult, options) {
  let output = '🌳 Supply Chain Lineage Tree\\n\\n';
  
  // Build tree structure
  const rootPath = traceResult.root;
  const visited = new Set();
  
  function printNode(path, prefix = '', isLast = true) {
    if (visited.has(path)) return '';
    visited.add(path);
    
    const node = traceResult.nodes.get(path);
    if (!node) return '';
    
    const connector = isLast ? '└── ' : '├── ';
    const nodeType = node.type === 'template' ? '📄' : '📦';
    const verifiedIcon = node.verified ? '✅' : (node.error ? '❌' : '❓');
    
    let line = `${prefix}${connector}${nodeType} ${relative(process.cwd(), path)}`;
    
    if (options.includeHashes && node.provenance?.artifact?.contentHash) {
      line += ` [${node.provenance.artifact.contentHash.substring(0, 8)}...]`;
    }
    
    line += ` ${verifiedIcon}`;
    
    if (node.error) {
      line += ` (${node.error})`;
    }
    
    output += line + '\\n';
    
    // Find children
    const children = traceResult.edges
      .filter(edge => edge.source === path)
      .map(edge => edge.target);
    
    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    children.forEach((child, index) => {
      output += printNode(child, newPrefix, index === children.length - 1);
    });
    
    return output;
  }
  
  output += printNode(rootPath);
  output += `\\n📊 Summary: ${traceResult.nodes.size} nodes, ${traceResult.edges.length} edges, depth ${traceResult.depth}\\n`;
  
  return output;
}

function generateDotGraph(traceResult, options) {
  let dot = 'digraph SupplyChain {\\n';
  dot += '  rankdir=TB;\\n';
  dot += '  node [shape=box, style=rounded];\\n\\n';
  
  // Add nodes
  for (const [path, node] of traceResult.nodes) {
    const label = relative(process.cwd(), path);
    const color = node.type === 'template' ? 'lightblue' : 
                  node.verified ? 'lightgreen' : 
                  node.error ? 'lightcoral' : 'lightyellow';
    
    dot += `  "${path}" [label="${label}", fillcolor=${color}, style=filled];\\n`;
  }
  
  dot += '\\n';
  
  // Add edges
  for (const edge of traceResult.edges) {
    const style = edge.type === 'generates' ? 'solid' : 'dashed';
    const color = edge.type === 'generates' ? 'blue' : 'gray';
    
    dot += `  "${edge.source}" -> "${edge.target}" [style=${style}, color=${color}];\\n`;
  }
  
  dot += '}\\n';
  return dot;
}

function generateMermaidGraph(traceResult, options) {
  let mermaid = 'graph TD\\n';
  
  // Convert paths to safe IDs
  const pathToId = new Map();
  let idCounter = 0;
  
  for (const path of traceResult.nodes.keys()) {
    pathToId.set(path, `node${idCounter++}`);
  }
  
  // Add nodes with labels
  for (const [path, node] of traceResult.nodes) {
    const id = pathToId.get(path);
    const label = relative(process.cwd(), path);
    const shape = node.type === 'template' ? '[]' : '()';
    
    mermaid += `  ${id}${shape[0]}${label}${shape[1]}\\n`;
  }
  
  // Add edges
  for (const edge of traceResult.edges) {
    const sourceId = pathToId.get(edge.source);
    const targetId = pathToId.get(edge.target);
    const arrow = edge.type === 'generates' ? '-->' : '-..->';
    
    mermaid += `  ${sourceId} ${arrow} ${targetId}\\n`;
  }
  
  return mermaid;
}

async function scanDirectoryForArtifacts(directory) {
  const { glob } = await import('glob');
  const attestationFiles = await glob('**/*.attest.json', { 
    cwd: directory,
    absolute: true,
    ignore: ['node_modules/**', '.git/**']
  });
  
  // Return artifact paths (remove .attest.json extension)
  return attestationFiles.map(file => file.replace('.attest.json', ''));
}

async function buildSupplyChainGraph(provenance, artifacts) {
  const graph = {
    nodes: [],
    edges: [],
    statistics: {
      totalArtifacts: artifacts.length,
      templateFamilies: new Set(),
      dependencies: 0
    }
  };
  
  for (const artifactPath of artifacts) {
    try {
      const provenanceData = await provenance.getProvenance(artifactPath);
      
      if (provenanceData.combined) {
        // Add artifact node
        graph.nodes.push({
          id: artifactPath,
          type: 'artifact',
          label: relative(process.cwd(), artifactPath),
          data: provenanceData.combined
        });
        
        // Add template node and edge if exists
        const templatePath = provenanceData.combined.generation?.templatePath;
        if (templatePath) {
          const templateId = `template:${templatePath}`;
          
          if (!graph.nodes.find(n => n.id === templateId)) {
            graph.nodes.push({
              id: templateId,
              type: 'template',
              label: relative(process.cwd(), templatePath),
              path: templatePath
            });
          }
          
          graph.edges.push({
            source: templateId,
            target: artifactPath,
            type: 'generates'
          });
          
          const family = provenanceData.combined.templateFamily || 'unknown';
          graph.statistics.templateFamilies.add(family);
        }
        
        // Add dependency edges
        if (provenanceData.combined.dependencies) {
          for (const dep of provenanceData.combined.dependencies) {
            graph.edges.push({
              source: dep,
              target: artifactPath,
              type: 'depends_on'
            });
            graph.statistics.dependencies++;
          }
        }
      }
    } catch (error) {
      // Add error node
      graph.nodes.push({
        id: artifactPath,
        type: 'artifact',
        label: relative(process.cwd(), artifactPath),
        error: error.message
      });
    }
  }
  
  graph.statistics.templateFamilies = Array.from(graph.statistics.templateFamilies);
  
  return graph;
}

async function generateVisualization(graph, options) {
  switch (options.format) {
    case 'html':
      return generateHTMLVisualization(graph, options);
    case 'mermaid':
      return generateMermaidFromGraph(graph, options);
    case 'svg':
    case 'png':
      return generateGraphvizVisualization(graph, options);
    default: // dot
      return generateDotFromGraph(graph, options);
  }
}

function generateHTMLVisualization(graph, options) {
  // Generate interactive HTML visualization using D3.js or similar
  return `<!DOCTYPE html>
<html>
<head>
    <title>Supply Chain Visualization</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .node { fill: #69b3a2; stroke: #333; stroke-width: 2px; }
        .template { fill: #ff7f0e; }
        .link { stroke: #999; stroke-opacity: 0.6; }
        .generates { stroke: #2ca02c; stroke-width: 2px; }
        .depends_on { stroke: #d62728; stroke-dasharray: 5,5; }
    </style>
</head>
<body>
    <h1>🔗 Supply Chain Visualization</h1>
    <div id="graph"></div>
    <script>
        const data = ${JSON.stringify(graph, null, 2)};
        // D3.js visualization code would go here
        console.log('Supply chain data:', data);
    </script>
</body>
</html>`;
}

function generateDotFromGraph(graph, options) {
  let dot = 'digraph SupplyChain {\\n';
  dot += '  rankdir=TB;\\n';
  dot += '  node [shape=box, style=rounded];\\n\\n';
  
  // Group by template family if requested
  if (options.groupByFamily) {
    const families = [...new Set(graph.nodes
      .filter(n => n.data?.templateFamily)
      .map(n => n.data.templateFamily))];
    
    for (const family of families) {
      dot += `  subgraph cluster_${family.replace(/[^a-zA-Z0-9]/g, '_')} {\\n`;
      dot += `    label="${family}";\\n`;
      dot += `    style=filled;\\n`;
      dot += `    fillcolor=lightgray;\\n`;
      
      const familyNodes = graph.nodes.filter(n => n.data?.templateFamily === family);
      for (const node of familyNodes) {
        const color = node.type === 'template' ? 'lightblue' : 'lightgreen';
        dot += `    "${node.id}" [label="${node.label}", fillcolor=${color}, style=filled];\\n`;
      }
      
      dot += '  }\\n\\n';
    }
  } else {
    // Add all nodes
    for (const node of graph.nodes) {
      const color = node.type === 'template' ? 'lightblue' : 'lightgreen';
      dot += `  "${node.id}" [label="${node.label}", fillcolor=${color}, style=filled];\\n`;
    }
  }
  
  dot += '\\n';
  
  // Add edges
  for (const edge of graph.edges) {
    const style = edge.type === 'generates' ? 'solid' : 'dashed';
    const color = edge.type === 'generates' ? 'blue' : 'gray';
    
    dot += `  "${edge.source}" -> "${edge.target}" [style=${style}, color=${color}];\\n`;
  }
  
  dot += '}\\n';
  return dot;
}

async function verifySupplyChainBatch(provenance, artifacts, options) {
  const results = [];
  
  if (options.parallel && !options.failFast) {
    // Parallel verification
    const promises = artifacts.map(async (artifact) => {
      try {
        const result = await provenance.verifyArtifact(artifact);
        return { artifact, result, verified: result.overall.verified, error: null };
      } catch (error) {
        return { artifact, result: null, verified: false, error: error.message };
      }
    });
    
    const allResults = await Promise.allSettled(promises);
    for (const promiseResult of allResults) {
      if (promiseResult.status === 'fulfilled') {
        results.push(promiseResult.value);
      } else {
        results.push({ 
          artifact: 'unknown', 
          result: null, 
          verified: false, 
          error: promiseResult.reason 
        });
      }
    }
  } else {
    // Sequential verification
    for (const artifact of artifacts) {
      try {
        const result = await provenance.verifyArtifact(artifact);
        const verified = result.overall.verified;
        
        results.push({ artifact, result, verified, error: null });
        
        if (!verified && options.failFast) {
          break;
        }
      } catch (error) {
        results.push({ artifact, result: null, verified: false, error: error.message });
        if (options.failFast) {
          break;
        }
      }
    }
  }
  
  return results;
}

function displayVerificationSummary(results) {
  const total = results.length;
  const verified = results.filter(r => r.verified).length;
  const failed = total - verified;
  
  console.log('\\n📊 Supply Chain Verification Summary\\n');
  console.log(`📦 Total Artifacts: ${total}`);
  console.log(`✅ Verified: ${verified}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Success Rate: ${((verified / total) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\\n❌ Failed Verifications:');
    for (const result of results.filter(r => !r.verified)) {
      console.log(`  • ${relative(process.cwd(), result.artifact)}: ${result.error || 'Verification failed'}`);
    }
  }
}

async function generateSupplyChainReport(results, options) {
  const report = {
    timestamp: this.getDeterministicDate().toISOString(),
    directory: options.directory,
    summary: {
      totalArtifacts: results.length,
      verifiedArtifacts: results.filter(r => r.verified).length,
      failedArtifacts: results.filter(r => !r.verified).length
    },
    results: results.map(r => ({
      artifact: relative(process.cwd(), r.artifact),
      verified: r.verified,
      error: r.error,
      details: options.includeDetails ? r.result : null
    }))
  };
  
  switch (options.format) {
    case 'json':
      return JSON.stringify(report, null, 2);
    case 'html':
      return generateHTMLReport(report);
    default: // markdown
      return generateMarkdownReport(report);
  }
}

function generateMarkdownReport(report) {
  let md = '# Supply Chain Verification Report\\n\\n';
  md += `**Directory:** ${report.directory}\\n`;
  md += `**Timestamp:** ${report.timestamp}\\n\\n`;
  
  md += '## Summary\\n\\n';
  md += `- **Total Artifacts:** ${report.summary.totalArtifacts}\\n`;
  md += `- **Verified:** ${report.summary.verifiedArtifacts} ✅\\n`;
  md += `- **Failed:** ${report.summary.failedArtifacts} ❌\\n`;
  md += `- **Success Rate:** ${((report.summary.verifiedArtifacts / report.summary.totalArtifacts) * 100).toFixed(1)}%\\n\\n`;
  
  if (report.summary.failedArtifacts > 0) {
    md += '## Failed Verifications\\n\\n';
    for (const result of report.results.filter(r => !r.verified)) {
      md += `### ${result.artifact}\\n\\n`;
      md += `**Status:** ❌ FAILED\\n`;
      md += `**Error:** ${result.error || 'Verification failed'}\\n\\n`;
    }
  }
  
  md += '## All Results\\n\\n';
  md += '| Artifact | Status | Error |\\n';
  md += '|----------|---------|-------|\\n';
  for (const result of report.results) {
    const status = result.verified ? '✅ VERIFIED' : '❌ FAILED';
    const error = result.error || '';
    md += `| ${result.artifact} | ${status} | ${error} |\\n`;
  }
  
  return md;
}

async function analyzeSupplyChain(provenance, directory, options) {
  const artifacts = await scanDirectoryForArtifacts(directory);
  const analysis = {
    timestamp: this.getDeterministicDate().toISOString(),
    directory,
    metrics: {
      totalArtifacts: artifacts.length,
      templateFamilies: new Set(),
      averageGenerationTime: 0,
      dependencyDepth: 0,
      circularDependencies: []
    },
    health: {
      overall: 'unknown',
      verificationRate: 0,
      integrityScore: 0,
      riskFactors: []
    }
  };
  
  // Collect metrics
  const verificationResults = [];
  for (const artifact of artifacts) {
    try {
      const verification = await provenance.verifyArtifact(artifact);
      verificationResults.push(verification.overall.verified);
      
      const provenanceData = await provenance.getProvenance(artifact);
      if (provenanceData.combined?.templateFamily) {
        analysis.metrics.templateFamilies.add(provenanceData.combined.templateFamily);
      }
    } catch (error) {
      verificationResults.push(false);
      if (options.includeRisk) {
        analysis.health.riskFactors.push(`Verification error for ${artifact}: ${error.message}`);
      }
    }
  }
  
  // Calculate health metrics
  analysis.health.verificationRate = verificationResults.filter(v => v).length / verificationResults.length;
  analysis.health.integrityScore = analysis.health.verificationRate;
  
  if (analysis.health.verificationRate >= 0.9) {
    analysis.health.overall = 'excellent';
  } else if (analysis.health.verificationRate >= 0.7) {
    analysis.health.overall = 'good';
  } else if (analysis.health.verificationRate >= 0.5) {
    analysis.health.overall = 'fair';
  } else {
    analysis.health.overall = 'poor';
  }
  
  analysis.metrics.templateFamilies = Array.from(analysis.metrics.templateFamilies);
  
  return analysis;
}

async function displayAnalysisResults(analysis, options) {
  if (options.format === 'json') {
    console.log(JSON.stringify(analysis, null, 2));
    return;
  }
  
  console.log('\\n📊 Supply Chain Analysis\\n');
  console.log(`📁 Directory: ${analysis.directory}`);
  console.log(`📅 Analyzed: ${analysis.timestamp}`);
  
  console.log('\\n📈 Metrics:');
  console.log(`  Total Artifacts: ${analysis.metrics.totalArtifacts}`);
  console.log(`  Template Families: ${analysis.metrics.templateFamilies.length}`);
  console.log(`  Families: ${analysis.metrics.templateFamilies.join(', ')}`);
  
  console.log('\\n🏥 Health Assessment:');
  const healthIcon = analysis.health.overall === 'excellent' ? '🟢' :
                    analysis.health.overall === 'good' ? '🟡' :
                    analysis.health.overall === 'fair' ? '🟠' : '🔴';
  console.log(`  Overall: ${healthIcon} ${analysis.health.overall.toUpperCase()}`);
  console.log(`  Verification Rate: ${(analysis.health.verificationRate * 100).toFixed(1)}%`);
  console.log(`  Integrity Score: ${(analysis.health.integrityScore * 100).toFixed(1)}%`);
  
  if (analysis.health.riskFactors.length > 0) {
    console.log('\\n⚠️  Risk Factors:');
    for (const risk of analysis.health.riskFactors) {
      console.log(`  • ${risk}`);
    }
  }
}

async function exportSupplyChainData(provenance, directory, options) {
  const artifacts = await scanDirectoryForArtifacts(directory);
  const exportData = {
    metadata: {
      timestamp: this.getDeterministicDate().toISOString(),
      directory,
      format: options.format,
      totalArtifacts: artifacts.length
    },
    artifacts: []
  };
  
  // Collect artifact data
  for (const artifact of artifacts) {
    try {
      const provenanceData = await provenance.getProvenance(artifact);
      const exportEntry = {
        path: artifact,
        verified: false,
        provenance: provenanceData.combined
      };
      
      if (options.includeContent && provenanceData.combined?.artifact?.contentHash) {
        exportEntry.contentHash = provenanceData.combined.artifact.contentHash;
      }
      
      exportData.artifacts.push(exportEntry);
    } catch (error) {
      exportData.artifacts.push({
        path: artifact,
        verified: false,
        error: error.message
      });
    }
  }
  
  switch (options.format) {
    case 'sbom':
      return generateSBOM(exportData, options.sbomFormat);
    case 'xml':
      return generateXMLExport(exportData);
    case 'csv':
      return generateCSVExport(exportData);
    case 'rdf':
      return generateRDFExport(exportData);
    default: // json
      return JSON.stringify(exportData, null, 2);
  }
}

function generateSBOM(exportData, format) {
  if (format === 'cyclonedx') {
    return JSON.stringify({
      bomFormat: 'CycloneDX',
      specVersion: '1.4',
      version: 1,
      metadata: {
        timestamp: exportData.metadata.timestamp,
        tools: [{
          vendor: 'KGEN',
          name: 'Unified Provenance System',
          version: '2.0.0'
        }]
      },
      components: exportData.artifacts.map(artifact => ({
        type: 'file',
        name: artifact.path,
        version: '1.0.0',
        hashes: artifact.contentHash ? [{
          alg: 'SHA-256',
          content: artifact.contentHash
        }] : [],
        evidence: {
          identity: {
            field: 'purl',
            confidence: artifact.verified ? 1.0 : 0.0
          }
        }
      }))
    }, null, 2);
  } else { // SPDX
    return JSON.stringify({
      spdxVersion: 'SPDX-2.3',
      dataLicense: 'CC0-1.0',
      SPDXID: 'SPDXRef-DOCUMENT',
      name: `Supply Chain SBOM - ${exportData.metadata.directory}`,
      documentNamespace: `https://kgen.org/spdx/${this.getDeterministicTimestamp()}`,
      creationInfo: {
        created: exportData.metadata.timestamp,
        creators: ['Tool: KGEN Unified Provenance System-2.0.0']
      },
      packages: exportData.artifacts.map((artifact, index) => ({
        SPDXID: `SPDXRef-Package-${index}`,
        name: artifact.path,
        downloadLocation: 'NOASSERTION',
        filesAnalyzed: false,
        verification: artifact.verified ? 'VERIFIED' : 'UNVERIFIED'
      }))
    }, null, 2);
  }
}

function generateCSVExport(exportData) {
  let csv = 'Path,Verified,ContentHash,TemplatePath,GeneratedAt,Error\\n';
  
  for (const artifact of exportData.artifacts) {
    const row = [
      artifact.path,
      artifact.verified,
      artifact.contentHash || '',
      artifact.provenance?.generation?.templatePath || '',
      artifact.provenance?.generation?.generatedAt || '',
      artifact.error || ''
    ].map(field => `"${field}"`).join(',');
    
    csv += row + '\\n';
  }
  
  return csv;
}

async function verifyTemplateExists(templatePath) {
  try {
    await fs.access(templatePath);
    return true;
  } catch {
    return false;
  }
}