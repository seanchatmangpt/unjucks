/**
 * KGEN CLI - Artifact Explain Command
 * 
 * Implements the 'kgen artifact explain' command to provide complete
 * auditability and provenance analysis for any KGEN-generated artifact.
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import consola from 'consola';
import { ArtifactExplainer } from '@kgen/core/src/provenance/artifact-explainer.js';
import { createProvenanceTracker } from '@kgen/core/src/provenance/index.js';

/**
 * Create the artifact explain command
 * @returns {Command} Commander command
 */
export function createArtifactExplainCommand() {
  const command = new Command('explain')
    .description('Explain how an artifact was generated with complete provenance tracking')
    .argument('<artifact>', 'Path to the artifact to explain')
    .option('-f, --format <format>', 'Output format (summary|detailed|comprehensive|json)', 'detailed')
    .option('-o, --output <file>', 'Output file (default: stdout)')
    .option('--attestation <path>', 'Path to specific attestation file')
    .option('--verify', 'Include cryptographic verification', false)
    .option('--lineage', 'Include full lineage chain', false)
    .option('--compliance', 'Include compliance report', false)
    .option('--no-cache', 'Disable caching', false)
    .option('--generate-attestation', 'Generate attestation if missing', false)
    .option('--max-depth <number>', 'Maximum lineage depth to analyze', '10')
    .option('--include-source', 'Include template and rule source code', false)
    .option('--graph-visualization', 'Generate dependency graph visualization', false)
    .action(async (artifactPath, options) => {
      await executeArtifactExplain(artifactPath, options);
    });

  return command;
}

/**
 * Execute the artifact explain command
 * @param {string} artifactPath - Path to artifact
 * @param {Object} options - Command options
 */
async function executeArtifactExplain(artifactPath, options) {
  const logger = consola.withTag('artifact-explain');
  
  try {
    logger.info(`Explaining artifact: ${path.basename(artifactPath)}`);
    
    // Resolve artifact path
    const resolvedPath = path.resolve(artifactPath);
    
    // Check if artifact exists
    try {
      await fs.access(resolvedPath);
    } catch (error) {
      logger.error(`Artifact not found: ${artifactPath}`);
      process.exit(1);
    }
    
    // Create explainer with options
    const explainerConfig = {
      maxLineageDepth: parseInt(options.maxDepth),
      includeFullLineage: options.lineage,
      includeTemplateSource: options.includeSource,
      includeRuleSource: options.includeSource,
      enableCryptographicVerification: options.verify,
      enableCaching: options.cache,
      includeComplianceReport: options.compliance,
      includeGraphVisualization: options.graphVisualization,
      outputFormat: options.format
    };
    
    const explainer = new ArtifactExplainer(explainerConfig);
    
    // Prepare explanation options
    const explainOptions = {
      skipCache: !options.cache,
      generateAttestation: options.generateAttestation,
      attestationPath: options.attestation,
      includeVerification: options.verify
    };
    
    // Generate explanation
    const startTime = this.getDeterministicTimestamp();
    logger.start('Analyzing artifact...');
    
    const explanation = await explainer.explainArtifact(resolvedPath, explainOptions);
    
    const analysisTime = this.getDeterministicTimestamp() - startTime;
    logger.success(`Analysis complete in ${analysisTime}ms`);
    
    // Format and output results
    const output = formatExplanation(explanation, options.format);
    
    if (options.output) {
      await fs.writeFile(options.output, output, 'utf8');
      logger.success(`Explanation saved to: ${options.output}`);
    } else {
      console.log(output);
    }
    
    // Show summary statistics
    displaySummaryStats(explanation, logger);
    
    // Cleanup
    await explainer.shutdown();
    
    // Exit with appropriate code
    const exitCode = explanation.summary?.quality?.overall === 'POOR' ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    logger.error('Failed to explain artifact:', error);
    process.exit(1);
  }
}

/**
 * Format explanation based on output format
 * @param {Object} explanation - Explanation object
 * @param {string} format - Output format
 * @returns {string} Formatted output
 */
function formatExplanation(explanation, format) {
  switch (format) {
    case 'json':
      return JSON.stringify(explanation, null, 2);
      
    case 'summary':
      return formatSummaryOutput(explanation);
      
    case 'detailed':
      return formatDetailedOutput(explanation);
      
    case 'comprehensive':
      return formatComprehensiveOutput(explanation);
      
    default:
      return formatDetailedOutput(explanation);
  }
}

/**
 * Format summary output
 * @param {Object} explanation - Explanation object
 * @returns {string} Formatted summary
 */
function formatSummaryOutput(explanation) {
  const { artifact, summary } = explanation;
  
  return `
KGEN Artifact Explanation Summary
================================

Artifact: ${path.basename(artifact.path)}
Type: ${artifact.type || 'unknown'}
Size: ${formatBytes(artifact.size)}
Quality: ${summary.quality?.overall || 'unknown'}
Auditability: ${summary.auditability?.level || 'unknown'}

Provenance:
  • Attestation: ${summary.provenance?.attestationFound ? '✓ Found' : '✗ Not found'}
  • Verification: ${summary.provenance?.verificationPassed ? '✓ Passed' : '✗ Failed'}
  • Lineage Depth: ${summary.provenance?.lineageDepth || 0}
  • Compliance Score: ${summary.provenance?.complianceScore || 0}%

Generation:
  • Engine: ${summary.generation?.engine || 'unknown'}
  • Timestamp: ${summary.generation?.timestamp || 'unknown'}
  • Templates: ${summary.generation?.templates || 0}
  • Rules: ${summary.generation?.rules || 0}

Issues: ${summary.quality?.issues || 0}
Recommendations: ${summary.quality?.recommendations || 0}
`;
}

/**
 * Format detailed output
 * @param {Object} explanation - Explanation object
 * @returns {string} Formatted detailed output
 */
function formatDetailedOutput(explanation) {
  const { artifact, attestation, verification, lineage, generation, compliance } = explanation;
  
  let output = `
KGEN Artifact Explanation
========================

ARTIFACT INFORMATION
-------------------
Path: ${artifact.path}
Type: ${artifact.type || 'unknown'}
Size: ${formatBytes(artifact.size)}
Hash: ${artifact.hash || 'unknown'}
Created: ${artifact.created ? new Date(artifact.created).toLocaleString() : 'unknown'}
Modified: ${artifact.modified ? new Date(artifact.modified).toLocaleString() : 'unknown'}
Exists: ${artifact.exists ? '✓' : '✗'}

ATTESTATION ANALYSIS
-------------------
Found: ${attestation?.found ? '✓' : '✗'}
`;

  if (attestation?.found) {
    output += `Path: ${attestation.path}
Version: ${attestation.data?.version || 'unknown'}
ID: ${attestation.data?.attestationId || 'unknown'}
Timestamp: ${attestation.data?.timestamp ? new Date(attestation.data.timestamp).toLocaleString() : 'unknown'}
Has Signature: ${attestation.data?.signature ? '✓' : '✗'}
Has Provenance: ${attestation.data?.provenance ? '✓' : '✗'}
`;
  }

  if (verification?.performed) {
    output += `
VERIFICATION RESULTS
-------------------
Status: ${verification.result?.valid ? '✓ Valid' : '✗ Invalid'}
Checks Performed: ${Object.keys(verification.result?.checks || {}).length}
Errors: ${verification.result?.errors?.length || 0}
Warnings: ${verification.result?.warnings?.length || 0}
`;

    if (verification.result?.errors?.length > 0) {
      output += `
Errors:
${verification.result.errors.map(error => `  • ${error}`).join('\n')}
`;
    }
  }

  if (lineage?.depth > 0) {
    output += `
LINEAGE ANALYSIS
---------------
Chain Length: ${lineage.depth}
Sources: ${lineage.sources?.length || 0}
Templates: ${lineage.templates?.length || 0}
Rules: ${lineage.rules?.length || 0}
Dependencies: ${lineage.dependencies?.length || 0}

Lineage Chain:
${lineage.chain?.slice(0, 5).map((item, index) => 
  `  ${index + 1}. ${item.type}: ${path.basename(item.resource || 'unknown')} (${item.timestamp ? new Date(item.timestamp).toLocaleString() : 'no timestamp'})`
).join('\n')}${lineage.chain?.length > 5 ? `\n  ... and ${lineage.chain.length - 5} more items` : ''}
`;
  }

  if (generation) {
    output += `
GENERATION PROCESS
-----------------
Engine: ${generation.process?.engine || 'unknown'}
Operation ID: ${generation.process?.operationId || 'unknown'}
Timestamp: ${generation.process?.timestamp ? new Date(generation.process.timestamp).toLocaleString() : 'unknown'}
Graph Hash: ${generation.process?.graphHash || 'unknown'}
`;
  }

  if (compliance) {
    output += `
COMPLIANCE REPORT
----------------
Overall Status: ${compliance.overall}
Compliance Score: ${compliance.score || 0}%
Checks: ${compliance.checks?.length || 0}
Issues: ${compliance.issues?.length || 0}
Recommendations: ${compliance.recommendations?.length || 0}
`;

    if (compliance.issues?.length > 0) {
      output += `
Issues:
${compliance.issues.map(issue => `  • ${issue}`).join('\n')}
`;
    }
  }

  return output;
}

/**
 * Format comprehensive output
 * @param {Object} explanation - Explanation object
 * @returns {string} Formatted comprehensive output
 */
function formatComprehensiveOutput(explanation) {
  // Start with detailed output
  let output = formatDetailedOutput(explanation);
  
  // Add additional comprehensive sections
  const { attestation, lineage, generation, verification } = explanation;
  
  if (attestation?.data?.provenance) {
    output += `
PROVENANCE METADATA (W3C PROV-O)
-------------------------------
Context: ${attestation.data.provenance['@context'] ? '✓ Present' : '✗ Missing'}
Entity URI: ${attestation.data.provenance.entity?.['@id'] || 'unknown'}
Activity URI: ${attestation.data.provenance.activity?.['@id'] || 'unknown'}
Agent URI: ${attestation.data.provenance.agent?.['@id'] || 'unknown'}
`;
  }
  
  if (lineage?.dependencyGraph) {
    output += `
DEPENDENCY GRAPH
---------------
Nodes: ${lineage.dependencyGraph.nodes?.length || 0}
Edges: ${lineage.dependencyGraph.edges?.length || 0}
Levels: ${lineage.dependencyGraph.levels?.length || 0}
`;
  }
  
  if (generation?.environment) {
    output += `
GENERATION ENVIRONMENT
---------------------
Node Version: ${generation.environment.data?.node?.version || 'unknown'}
Platform: ${generation.environment.data?.system?.type || 'unknown'}
Hostname: ${generation.environment.data?.system?.hostname || 'unknown'}
Working Directory: ${generation.environment.data?.working_directory || 'unknown'}
Secure: ${generation.environment.analysis?.secure ? '✓' : '✗'}
Reproducible: ${generation.environment.analysis?.reproducible ? '✓' : '✗'}
`;
  }
  
  if (verification?.result?.checks) {
    output += `
DETAILED VERIFICATION CHECKS
----------------------------
${Object.entries(verification.result.checks).map(([check, result]) => 
  `${check}: ${typeof result === 'boolean' ? (result ? '✓' : '✗') : result}`
).join('\n')}
`;
  }
  
  return output;
}

/**
 * Display summary statistics
 * @param {Object} explanation - Explanation object
 * @param {Object} logger - Logger instance
 */
function displaySummaryStats(explanation, logger) {
  const stats = explanation.metrics || {};
  const summary = explanation.summary || {};
  
  logger.info('Analysis Statistics:');
  logger.info(`  • Explanation time: ${stats.explanationTime || 0}ms`);
  logger.info(`  • Lineage depth: ${stats.lineageDepth || 0}`);
  logger.info(`  • Verifications performed: ${stats.verificationsPerformed || 0}`);
  
  logger.info('Quality Assessment:');
  logger.info(`  • Overall quality: ${summary.quality?.overall || 'unknown'}`);
  logger.info(`  • Auditability level: ${summary.auditability?.level || 'unknown'}`);
  logger.info(`  • Compliance score: ${summary.provenance?.complianceScore || 0}%`);
  
  if (summary.quality?.issues > 0) {
    logger.warn(`⚠ Found ${summary.quality.issues} issues`);
  }
  
  if (summary.quality?.recommendations > 0) {
    logger.info(`💡 ${summary.quality.recommendations} recommendations available`);
  }
  
  if (summary.auditability?.cryptographicallySecure) {
    logger.success('🔐 Artifact is cryptographically secure');
  }
  
  if (summary.auditability?.traceableToSource) {
    logger.success('🔍 Full traceability to source confirmed');
  }
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default createArtifactExplainCommand;