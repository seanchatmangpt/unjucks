/**
 * CLI Integration for Attestation System
 * 
 * Integration point for kgen CLI commands like 'kgen artifact explain'
 */

import { AttestationCommands } from './commands.js';
import consola from 'consola';
import path from 'path';

/**
 * Create CLI command handlers for attestation functionality
 * @param {Object} config - Configuration options
 * @returns {Object} CLI command handlers
 */
export function createAttestationCLI(config = {}) {
  let commands = null;
  
  const ensureInitialized = async () => {
    if (!commands) {
      commands = new AttestationCommands(config);
      await commands.initialize();
    }
    return commands;
  };

  return {
    /**
     * Handle 'kgen artifact explain <path>' command
     */
    async explainCommand(artifactPath, options = {}) {
      try {
        const cmd = await ensureInitialized();
        const result = await cmd.explainArtifact(artifactPath, options);
        
        if (!result.success) {
          consola.error(result.error || result.reason);
          process.exit(1);
        }
        
        return formatExplanationOutput(result, options);
        
      } catch (error) {
        consola.error('Failed to explain artifact:', error.message);
        process.exit(1);
      }
    },

    /**
     * Handle 'kgen artifact verify <path>' command
     */
    async verifyCommand(artifactPath, options = {}) {
      try {
        const cmd = await ensureInitialized();
        const result = await cmd.verifyArtifact(artifactPath, options);
        
        if (!result.success) {
          consola.error(result.error || 'Verification failed');
          process.exit(1);
        }
        
        return formatVerificationOutput(result, options);
        
      } catch (error) {
        consola.error('Failed to verify artifact:', error.message);
        process.exit(1);
      }
    },

    /**
     * Handle 'kgen artifact list [directory]' command
     */
    async listCommand(directory = '.', options = {}) {
      try {
        const cmd = await ensureInitialized();
        const result = await cmd.listAttestations(directory, options);
        
        if (!result.success) {
          consola.error(result.error);
          process.exit(1);
        }
        
        return formatListOutput(result, options);
        
      } catch (error) {
        consola.error('Failed to list attestations:', error.message);
        process.exit(1);
      }
    },

    /**
     * Handle 'kgen artifact batch-verify <paths>' command
     */
    async batchVerifyCommand(paths, options = {}) {
      try {
        const cmd = await ensureInitialized();
        const result = await cmd.batchVerify(paths, options);
        
        if (!result.success) {
          consola.error(result.error);
          process.exit(1);
        }
        
        return formatBatchVerifyOutput(result, options);
        
      } catch (error) {
        consola.error('Failed to batch verify:', error.message);
        process.exit(1);
      }
    },

    /**
     * Handle 'kgen artifact stats [directory]' command
     */
    async statsCommand(directory = '.', options = {}) {
      try {
        const cmd = await ensureInitialized();
        const result = await cmd.getStatistics(directory);
        
        if (!result.success) {
          consola.error(result.error);
          process.exit(1);
        }
        
        return formatStatsOutput(result, options);
        
      } catch (error) {
        consola.error('Failed to get statistics:', error.message);
        process.exit(1);
      }
    }
  };
}

/**
 * Format explanation output for CLI
 */
function formatExplanationOutput(result, options) {
  const { format = 'detailed' } = options;
  
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  
  const exp = result.explanation;
  
  // Header
  consola.info(`\n📋 Artifact Explanation: ${path.basename(exp.artifact.path)}`);
  consola.info(`✅ Verification Status: ${exp.artifact.verified ? 'VERIFIED' : 'FAILED'}`);
  
  if (format === 'summary') {
    // Summary format
    consola.info(`📁 Template: ${path.basename(exp.origin.template.path || 'unknown')}`);
    consola.info(`📝 Template Version: ${exp.origin.template.version}`);
    consola.info(`⏰ Generated At: ${new Date(exp.artifact.generatedAt).toLocaleString()}`);
    consola.info(`🔗 Chain Position: ${exp.lineage.chainPosition}`);
    
    if (exp.integrity.blockchainAnchored) {
      consola.info(`⛓️  Blockchain Anchored: Yes`);
    }
    
    return result;
  }
  
  // Detailed format
  console.log('\n📊 Artifact Information:');
  console.log(`   Path: ${exp.artifact.path}`);
  console.log(`   Generated: ${new Date(exp.artifact.generatedAt).toLocaleString()}`);
  console.log(`   Verified: ${exp.artifact.verified ? '✅ Yes' : '❌ No'}`);
  
  console.log('\n🎯 Origin & Provenance:');
  console.log(`   Template: ${exp.origin.template.path || 'Unknown'}`);
  console.log(`   Template Version: ${exp.origin.template.version}`);
  console.log(`   Template Hash: ${exp.origin.template.hash?.substring(0, 16)}...`);
  
  if (exp.origin.rule?.version) {
    console.log(`   Rule Version: ${exp.origin.rule.version}`);
  }
  
  console.log(`   Generation Agent: ${exp.origin.agent}`);
  
  if (exp.origin.variables && Object.keys(exp.origin.variables).length > 0) {
    console.log('\n🔧 Template Variables:');
    Object.entries(exp.origin.variables).forEach(([key, value]) => {
      console.log(`   ${key}: ${JSON.stringify(value)}`);
    });
  }
  
  if (exp.origin.sourceGraph && Object.keys(exp.origin.sourceGraph).length > 0) {
    console.log('\n📈 Source Graph:');
    Object.entries(exp.origin.sourceGraph).forEach(([key, value]) => {
      console.log(`   ${key}: ${JSON.stringify(value)}`);
    });
  }
  
  console.log('\n🔗 Template Lineage:');
  console.log(`   Chain Position: ${exp.lineage.chainPosition}`);
  
  if (exp.lineage.derivedFrom?.length > 0) {
    console.log(`   Derived From: ${exp.lineage.derivedFrom.join(', ')}`);
  }
  
  if (exp.lineage.dependencies?.length > 0) {
    console.log(`   Dependencies: ${exp.lineage.dependencies.join(', ')}`);
  }
  
  console.log('\n🔒 Cryptographic Integrity:');
  console.log(`   Artifact Hash: ${exp.integrity.artifactHash.substring(0, 16)}...`);
  console.log(`   Attestation Hash: ${exp.integrity.attestationHash.substring(0, 16)}...`);
  console.log(`   Verification Chain: ${exp.integrity.verificationChain.length} steps`);
  
  if (exp.integrity.blockchainAnchored) {
    console.log(`   Blockchain Anchored: ✅ Yes`);
    if (exp.blockchain) {
      console.log(`   Network: ${exp.blockchain.network}`);
      console.log(`   Transaction: ${exp.blockchain.transactionHash?.substring(0, 16)}...`);
    }
  } else {
    console.log(`   Blockchain Anchored: ❌ No`);
  }
  
  return result;
}

/**
 * Format verification output for CLI
 */
function formatVerificationOutput(result, options) {
  const { format = 'detailed' } = options;
  
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  
  const verification = result.verification;
  const status = verification.verified ? '✅ VERIFIED' : '❌ FAILED';
  
  consola.info(`\n🔍 Verification Result: ${status}`);
  consola.info(`📁 Artifact: ${path.basename(result.path)}`);
  
  if (verification.verified) {
    console.log('\n✅ All verification checks passed:');
    console.log('   ✓ Artifact hash matches attestation');
    console.log('   ✓ Chain integrity confirmed');
    console.log('   ✓ Template lineage verified');
    
    if (verification.verificationDetails?.blockchain?.verified) {
      console.log('   ✓ Blockchain anchor verified');
    }
  } else {
    console.log('\n❌ Verification failures:');
    
    if (!verification.verificationDetails?.artifactHash?.verified) {
      console.log('   ✗ Artifact hash mismatch');
      console.log(`     Expected: ${verification.verificationDetails.artifactHash.expected?.substring(0, 16)}...`);
      console.log(`     Actual:   ${verification.verificationDetails.artifactHash.actual?.substring(0, 16)}...`);
    }
    
    if (!verification.verificationDetails?.chain?.verified) {
      console.log(`   ✗ Chain integrity failed: ${verification.verificationDetails.chain.reason}`);
    }
    
    if (!verification.verificationDetails?.lineage?.verified) {
      console.log(`   ✗ Template lineage failed: ${verification.verificationDetails.lineage.reason}`);
    }
    
    if (verification.verificationDetails?.blockchain && !verification.verificationDetails.blockchain.verified) {
      console.log(`   ✗ Blockchain verification failed: ${verification.verificationDetails.blockchain.reason}`);
    }
  }
  
  return result;
}

/**
 * Format list output for CLI
 */
function formatListOutput(result, options) {
  const { format = 'table' } = options;
  
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  
  consola.info(`\n📋 Attestations in ${result.directory}`);
  consola.info(`Found ${result.count} attestations`);
  
  if (result.count === 0) {
    console.log('\nNo attestations found.');
    return result;
  }
  
  console.log('\n┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ Artifact                          │ Template            │ Status │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  
  for (const attestation of result.attestations) {
    const artifactName = path.basename(attestation.artifactPath).padEnd(32);
    const templateName = (attestation.templatePath ? path.basename(attestation.templatePath) : 'Unknown').padEnd(18);
    const status = attestation.artifactExists ? '✅ OK  ' : '❌ GONE';
    
    console.log(`│ ${artifactName} │ ${templateName} │ ${status} │`);
  }
  
  console.log('└─────────────────────────────────────────────────────────────────┘');
  
  const missing = result.attestations.filter(a => !a.artifactExists).length;
  if (missing > 0) {
    consola.warn(`⚠️  ${missing} attestations reference missing artifacts`);
  }
  
  return result;
}

/**
 * Format batch verify output for CLI
 */
function formatBatchVerifyOutput(result, options) {
  const { format = 'summary' } = options;
  
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  
  consola.info(`\n🔍 Batch Verification Results`);
  consola.info(`Total: ${result.total} | Verified: ${result.verified} | Failed: ${result.failed}`);
  
  const successRate = Math.round((result.verified / result.total) * 100);
  const statusIcon = successRate === 100 ? '✅' : successRate >= 80 ? '⚠️' : '❌';
  
  console.log(`\n${statusIcon} Success Rate: ${successRate}%`);
  
  if (result.failed > 0) {
    console.log('\n❌ Failed Verifications:');
    
    const failures = result.results.filter(r => !r.success || !r.verification?.verified);
    failures.forEach(failure => {
      const reason = failure.error || failure.verification?.verificationDetails?.artifactHash?.reason || 'Unknown failure';
      console.log(`   • ${path.basename(failure.path)}: ${reason}`);
    });
  }
  
  if (format === 'detailed') {
    console.log('\n📊 Detailed Results:');
    result.results.forEach(r => {
      const status = (r.success && r.verification?.verified) ? '✅' : '❌';
      console.log(`   ${status} ${path.basename(r.path)}`);
    });
  }
  
  return result;
}

/**
 * Format statistics output for CLI
 */
function formatStatsOutput(result, options) {
  const { format = 'detailed' } = options;
  
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  
  const fs = result.fileSystemStats;
  const gs = result.generatorStats;
  
  consola.info(`\n📊 Attestation Statistics for ${path.basename(result.directory)}`);
  
  console.log('\n📁 File System:');
  console.log(`   Total Attestations: ${fs.totalAttestations}`);
  console.log(`   Artifacts with Attestations: ${fs.artifactsWithAttestations}`);
  console.log(`   Orphaned Attestations: ${fs.orphanedAttestations}`);
  
  if (fs.oldestAttestation && fs.newestAttestation) {
    console.log(`   Date Range: ${new Date(fs.oldestAttestation).toLocaleDateString()} - ${new Date(fs.newestAttestation).toLocaleDateString()}`);
  }
  
  if (Object.keys(fs.templateUsage).length > 0) {
    console.log('\n🎯 Template Usage:');
    Object.entries(fs.templateUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([template, count]) => {
        console.log(`   ${template}: ${count} artifacts`);
      });
  }
  
  console.log('\n🔧 Generator Status:');
  console.log(`   State: ${gs.state}`);
  console.log(`   Hash Chain Length: ${gs.hashChainLength}`);
  console.log(`   Template Versions: ${gs.templateVersions}`);
  console.log(`   Rule Versions: ${gs.ruleVersions}`);
  
  if (gs.blockchain) {
    console.log('\n⛓️  Blockchain:');
    console.log(`   Total Anchored: ${gs.blockchain.totalAnchored}`);
    console.log(`   Success Rate: ${Math.round(gs.blockchain.successRate * 100)}%`);
    console.log(`   Network: ${gs.blockchain.network}`);
  }
  
  return result;
}

export default createAttestationCLI;