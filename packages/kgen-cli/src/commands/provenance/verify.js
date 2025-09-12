/**
 * Provenance Verification CLI - "git show + verify" Implementation
 * 
 * Implements dark-matter verification workflow:
 * 1. Check .attest.json sidecar
 * 2. Verify git-notes provenance
 * 3. Validate content addressing
 * 4. Trace supply chain
 * 5. Generate verification report
 */

import { defineCommand } from 'citty';
import { UnifiedProvenanceSystem } from '../../../kgen-core/src/provenance/unified-provenance.js';
import { resolve } from 'path';
import consola from 'consola';

export default defineCommand({
  meta: {
    name: 'verify',
    description: 'Verify artifact provenance using dark-matter principles (Agent #10)',
    version: '2.0.0'
  },
  args: {
    artifact: {
      type: 'positional',
      description: 'Path to artifact to verify',
      required: true
    },
    format: {
      type: 'string',
      description: 'Output format (json, table, markdown)',
      default: 'table',
      valueHint: 'json|table|markdown'
    },
    'git-show': {
      type: 'boolean',
      description: 'Show git commands for manual verification',
      default: false
    },
    'supply-chain': {
      type: 'boolean',
      description: 'Include supply chain verification',
      default: false
    },
    verbose: {
      type: 'boolean',
      description: 'Verbose output with detailed information',
      default: false
    },
    'dry-run': {
      type: 'boolean',
      description: 'Show what would be verified without executing',
      default: false
    }
  },
  async run({ args }) {
    const logger = consola.withTag('provenance:verify');
    
    try {
      const artifactPath = resolve(args.artifact);
      logger.info(`Verifying artifact provenance: ${artifactPath}`);
      
      if (args['dry-run']) {
        return await showDryRun(artifactPath, args);
      }
      
      // Initialize unified provenance system
      const provenance = new UnifiedProvenanceSystem({
        enableGitFirst: true,
        requireSidecars: true,
        noCentralDatabase: true,
        enableContentAddressing: true
      });
      
      await provenance.initialize();
      
      // Perform comprehensive verification
      const verification = await provenance.verifyArtifact(artifactPath, {
        includeSupplyChain: args['supply-chain'],
        verbose: args.verbose
      });
      
      // Get provenance data for git commands
      let gitCommands = null;
      if (args['git-show']) {
        const provenanceData = await provenance.getProvenance(artifactPath);
        const commandResult = await provenance.createVerificationCommand(artifactPath);
        gitCommands = commandResult.commands;
      }
      
      // Format and display results
      await displayVerificationResults(verification, {
        format: args.format,
        gitCommands,
        verbose: args.verbose,
        includeSupplyChain: args['supply-chain']
      });
      
      // Set exit code based on verification result
      process.exitCode = verification.overall.verified ? 0 : 1;
      
    } catch (error) {
      logger.error('Verification failed:', error);
      process.exitCode = 1;
    }
  },
  
  subCommands: {
    // Subcommand: verify all artifacts in directory
    all: defineCommand({
      meta: {
        name: 'all',
        description: 'Verify all artifacts in directory'
      },
      args: {
        directory: {
          type: 'positional',
          description: 'Directory to scan for artifacts',
          default: '.'
        },
        pattern: {
          type: 'string',
          description: 'File pattern to match (e.g., "*.js", "**/*.json")',
          default: '**/*'
        },
        parallel: {
          type: 'boolean',
          description: 'Run verifications in parallel',
          default: true
        },
        'fail-fast': {
          type: 'boolean',
          description: 'Stop on first verification failure',
          default: false
        }
      },
      async run({ args }) {
        const logger = consola.withTag('provenance:verify:all');
        
        try {
          const provenance = new UnifiedProvenanceSystem({
            enableGitFirst: true,
            noCentralDatabase: true
          });
          
          await provenance.initialize();
          
          // Find all artifacts with .attest.json sidecars
          const artifacts = await findArtifactsWithAttestations(args.directory, args.pattern);
          logger.info(`Found ${artifacts.length} artifacts to verify`);
          
          const results = [];
          let failureCount = 0;
          
          if (args.parallel && !args['fail-fast']) {
            // Parallel verification
            const verificationPromises = artifacts.map(async (artifact) => {
              try {
                const result = await provenance.verifyArtifact(artifact);
                return { artifact, result, success: true };
              } catch (error) {
                return { artifact, error: error.message, success: false };
              }
            });
            
            const allResults = await Promise.allSettled(verificationPromises);
            for (const promiseResult of allResults) {
              if (promiseResult.status === 'fulfilled') {
                results.push(promiseResult.value);
                if (!promiseResult.value.success) failureCount++;
              } else {
                failureCount++;
                results.push({ 
                  artifact: 'unknown', 
                  error: promiseResult.reason, 
                  success: false 
                });
              }
            }
          } else {
            // Sequential verification
            for (const artifact of artifacts) {
              try {
                const result = await provenance.verifyArtifact(artifact);
                results.push({ artifact, result, success: true });
                
                if (!result.overall.verified) {
                  failureCount++;
                  if (args['fail-fast']) {
                    logger.error(`Verification failed for ${artifact}, stopping due to --fail-fast`);
                    break;
                  }
                }
              } catch (error) {
                failureCount++;
                results.push({ artifact, error: error.message, success: false });
                if (args['fail-fast']) {
                  logger.error(`Verification error for ${artifact}, stopping due to --fail-fast`);
                  break;
                }
              }
            }
          }
          
          // Display summary
          await displayBatchVerificationResults(results, {
            totalArtifacts: artifacts.length,
            failureCount,
            successCount: results.length - failureCount
          });
          
          process.exitCode = failureCount === 0 ? 0 : 1;
          
        } catch (error) {
          logger.error('Batch verification failed:', error);
          process.exitCode = 1;
        }
      }
    }),
    
    // Subcommand: show git commands for manual verification
    'git-commands': defineCommand({
      meta: {
        name: 'git-commands',
        description: 'Show git commands for manual artifact verification'
      },
      args: {
        artifact: {
          type: 'positional',
          description: 'Path to artifact',
          required: true
        },
        'copy-to-clipboard': {
          type: 'boolean',
          description: 'Copy commands to clipboard',
          default: false
        }
      },
      async run({ args }) {
        const logger = consola.withTag('provenance:git-commands');
        
        try {
          const artifactPath = resolve(args.artifact);
          
          const provenance = new UnifiedProvenanceSystem({
            enableGitFirst: true,
            noCentralDatabase: true
          });
          await provenance.initialize();
          
          const commandResult = await provenance.createVerificationCommand(artifactPath);
          
          console.log('\n📋 Git Commands for Manual Verification:\n');
          
          if (commandResult.commands.gitShow.length > 0) {
            console.log('🔍 Git Show Commands:');
            for (const cmd of commandResult.commands.gitShow) {
              console.log(`  ${cmd}`);
            }
            console.log();
          }
          
          console.log('✅ Local Verification Commands:');
          for (const cmd of commandResult.commands.localVerify) {
            console.log(`  ${cmd}`);
          }
          console.log();
          
          if (commandResult.commands.supplyChain.length > 0) {
            console.log('🔗 Supply Chain Commands:');
            for (const cmd of commandResult.commands.supplyChain) {
              console.log(`  ${cmd}`);
            }
            console.log();
          }
          
          console.log('💡 Manual Verification Workflow:');
          console.log('  1. Check .attest.json sidecar exists and is valid');
          console.log('  2. Verify artifact hash matches recorded hash');
          console.log('  3. Check git-notes for distributed provenance');
          console.log('  4. Validate template and dependency integrity');
          console.log('  5. Trace complete supply chain if needed');
          
          if (args['copy-to-clipboard']) {
            const allCommands = [
              ...commandResult.commands.gitShow,
              ...commandResult.commands.localVerify,
              ...commandResult.commands.supplyChain
            ].join('\n');
            
            // Note: Clipboard functionality would require additional dependency
            logger.info('Commands ready to copy (clipboard functionality requires additional setup)');
          }
          
        } catch (error) {
          logger.error('Failed to generate git commands:', error);
          process.exitCode = 1;
        }
      }
    }),
    
    // Subcommand: explain artifact provenance
    explain: defineCommand({
      meta: {
        name: 'explain',
        description: 'Explain artifact origin and provenance chain'
      },
      args: {
        artifact: {
          type: 'positional',
          description: 'Path to artifact',
          required: true
        },
        format: {
          type: 'string',
          description: 'Output format (json, yaml, table)',
          default: 'table'
        },
        'include-content': {
          type: 'boolean',
          description: 'Include artifact content in explanation',
          default: false
        }
      },
      async run({ args }) {
        const logger = consola.withTag('provenance:explain');
        
        try {
          const artifactPath = resolve(args.artifact);
          
          const provenance = new UnifiedProvenanceSystem({
            enableGitFirst: true,
            noCentralDatabase: true
          });
          await provenance.initialize();
          
          const provenanceData = await provenance.getProvenance(artifactPath);
          
          await displayProvenanceExplanation(provenanceData, {
            format: args.format,
            includeContent: args['include-content'],
            artifactPath
          });
          
        } catch (error) {
          logger.error('Failed to explain artifact provenance:', error);
          process.exitCode = 1;
        }
      }
    })
  }
});

// Helper functions

async function showDryRun(artifactPath, args) {
  console.log('\n🔍 Dry Run - Verification Plan:\n');
  
  console.log(`📁 Artifact: ${artifactPath}`);
  console.log(`📋 Sidecar: ${artifactPath}.attest.json`);
  console.log();
  
  console.log('✅ Verification Steps:');
  console.log('  1. Check .attest.json sidecar exists');
  console.log('  2. Verify artifact content hash');
  console.log('  3. Validate attestation signature');
  
  if (args['git-show']) {
    console.log('  4. Extract git-notes provenance data');
    console.log('  5. Generate git show commands');
  }
  
  if (args['supply-chain']) {
    console.log('  6. Trace template dependencies');
    console.log('  7. Verify supply chain integrity');
  }
  
  console.log();
  console.log(`📊 Output Format: ${args.format}`);
  console.log(`🔧 Verbose: ${args.verbose}`);
  
  console.log('\n💡 Run without --dry-run to execute verification');
}

async function displayVerificationResults(verification, options) {
  switch (options.format) {
    case 'json':
      console.log(JSON.stringify(verification, null, 2));
      break;
      
    case 'markdown':
      await displayMarkdownResults(verification, options);
      break;
      
    default: // table
      await displayTableResults(verification, options);
  }
}

async function displayTableResults(verification, options) {
  const { verified, confidence, issues } = verification.overall;
  
  console.log('\n📋 Artifact Verification Report\n');
  console.log(`🎯 Artifact: ${verification.artifactPath}`);
  console.log(`✅ Verified: ${verified ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`📊 Confidence: ${(confidence * 100).toFixed(1)}%`);
  console.log(`📅 Verified At: ${verification.timestamp}`);
  
  if (verification.results.sidecar) {
    console.log('\n📄 Sidecar Verification:');
    const sidecar = verification.results.sidecar;
    console.log(`  Status: ${sidecar.verified ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Reason: ${sidecar.reason}`);
    if (sidecar.details && options.verbose) {
      console.log(`  Hash Match: ${sidecar.details.hashMatches ? '✓' : '✗'}`);
      console.log(`  Signature Valid: ${sidecar.details.signatureValid ? '✓' : '✗'}`);
      console.log(`  Unified Format: ${sidecar.details.unified ? '✓' : '✗'}`);
    }
  }
  
  if (verification.results.gitProvenance) {
    console.log('\n🔗 Git Provenance:');
    const git = verification.results.gitProvenance;
    console.log(`  Status: ${git.verified ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Reason: ${git.reason}`);
  }
  
  if (verification.results.contentAddressing) {
    console.log('\n🔢 Content Addressing:');
    const content = verification.results.contentAddressing;
    console.log(`  Status: ${content.verified ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Reason: ${content.reason}`);
    if (content.details && options.verbose) {
      console.log(`  Expected SHA: ${content.details.expectedSha?.substring(0, 12)}...`);
      console.log(`  Current SHA: ${content.details.currentSha?.substring(0, 12)}...`);
    }
  }
  
  if (verification.results.supplyChain && options.includeSupplyChain) {
    console.log('\n🔗 Supply Chain:');
    const chain = verification.results.supplyChain;
    console.log(`  Status: ${chain.verified ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Reason: ${chain.reason}`);
    if (chain.details && options.verbose) {
      console.log(`  Template Verified: ${chain.details.templateVerified ? '✓' : '✗'}`);
      console.log(`  Dependencies: ${chain.details.dependencyResults?.length || 0}`);
    }
  }
  
  if (issues.length > 0) {
    console.log('\n⚠️  Issues Found:');
    for (const issue of issues) {
      console.log(`  • ${issue}`);
    }
  }
  
  if (options.gitCommands) {
    console.log('\n📋 Git Verification Commands:');
    if (options.gitCommands.gitShow.length > 0) {
      console.log('\n  Git Show:');
      for (const cmd of options.gitCommands.gitShow) {
        console.log(`    ${cmd}`);
      }
    }
    console.log('\n  Local Verify:');
    for (const cmd of options.gitCommands.localVerify) {
      console.log(`    ${cmd}`);
    }
  }
}

async function displayMarkdownResults(verification, options) {
  const { verified, confidence, issues } = verification.overall;
  
  console.log('# Artifact Verification Report\n');
  console.log(`**Artifact:** \`${verification.artifactPath}\`\n`);
  console.log(`**Status:** ${verified ? '✅ VERIFIED' : '❌ FAILED'}\n`);
  console.log(`**Confidence:** ${(confidence * 100).toFixed(1)}%\n`);
  console.log(`**Timestamp:** ${verification.timestamp}\n`);
  
  console.log('## Verification Results\n');
  
  const results = verification.results;
  for (const [component, result] of Object.entries(results)) {
    if (result) {
      const status = result.verified ? '✅' : '❌';
      console.log(`### ${component.charAt(0).toUpperCase() + component.slice(1)}\n`);
      console.log(`${status} **Status:** ${result.reason}\n`);
      
      if (result.details && options.verbose) {
        console.log('**Details:**\n');
        for (const [key, value] of Object.entries(result.details)) {
          console.log(`- ${key}: \`${value}\``);
        }
        console.log();
      }
    }
  }
  
  if (issues.length > 0) {
    console.log('## Issues Found\n');
    for (const issue of issues) {
      console.log(`- ⚠️ ${issue}`);
    }
    console.log();
  }
  
  if (options.gitCommands) {
    console.log('## Manual Verification Commands\n');
    console.log('```bash');
    for (const cmd of options.gitCommands.localVerify) {
      console.log(cmd);
    }
    console.log('```\n');
  }
}

async function findArtifactsWithAttestations(directory, pattern) {
  const { glob } = await import('glob');
  const attestationFiles = await glob(`${pattern}.attest.json`, { 
    cwd: directory,
    absolute: true 
  });
  
  // Return the artifact paths (remove .attest.json extension)
  return attestationFiles.map(file => file.replace('.attest.json', ''));
}

async function displayBatchVerificationResults(results, summary) {
  console.log('\n📊 Batch Verification Summary\n');
  console.log(`📁 Total Artifacts: ${summary.totalArtifacts}`);
  console.log(`✅ Successful: ${summary.successCount}`);
  console.log(`❌ Failed: ${summary.failureCount}`);
  console.log(`📊 Success Rate: ${((summary.successCount / summary.totalArtifacts) * 100).toFixed(1)}%`);
  
  if (summary.failureCount > 0) {
    console.log('\n❌ Failed Verifications:');
    for (const result of results) {
      if (!result.success) {
        console.log(`  • ${result.artifact}: ${result.error || 'Verification failed'}`);
      }
    }
  }
  
  console.log('\n💡 Use "kgen provenance verify <artifact>" for detailed verification of individual artifacts');
}

async function displayProvenanceExplanation(provenanceData, options) {
  switch (options.format) {
    case 'json':
      console.log(JSON.stringify(provenanceData, null, 2));
      break;
      
    case 'yaml':
      const { stringify } = await import('yaml');
      console.log(stringify(provenanceData));
      break;
      
    default: // table
      console.log('\n🔍 Artifact Provenance Explanation\n');
      console.log(`📁 Artifact: ${options.artifactPath}`);
      console.log(`🔄 Unified: ${provenanceData.unified ? '✓' : '✗'}`);
      console.log(`📅 Retrieved: ${provenanceData.timestamp}`);
      
      console.log('\n📋 Data Sources:');
      for (const source of provenanceData.sources) {
        console.log(`  • ${source}`);
      }
      
      if (provenanceData.combined) {
        const combined = provenanceData.combined;
        
        if (combined.generation) {
          console.log('\n🏭 Generation Information:');
          console.log(`  Template: ${combined.generation.templatePath || 'Unknown'}`);
          console.log(`  Generated: ${combined.generation.generatedAt || 'Unknown'}`);
          console.log(`  Agent: ${combined.generation.agent || 'Unknown'}`);
        }
        
        if (combined.artifact) {
          console.log('\n📄 Artifact Details:');
          console.log(`  Size: ${combined.artifact.size || 'Unknown'} bytes`);
          console.log(`  Hash: ${combined.artifact.contentHash?.substring(0, 16)}...`);
          console.log(`  MIME Type: ${combined.artifact.mimeType || 'Unknown'}`);
        }
        
        if (combined.verification) {
          console.log('\n🔐 Verification Status:');
          console.log(`  Reproducible: ${combined.verification.reproducible ? '✓' : '✗'}`);
          console.log(`  Deterministic: ${combined.verification.deterministic ? '✓' : '✗'}`);
          console.log(`  Dark Matter: ${combined.verification.darkMatterCompliant ? '✓' : '✗'}`);
        }
      }
  }
}