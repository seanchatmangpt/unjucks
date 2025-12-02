/**
 * Example usage of the Git-based Ledger System
 * 
 * Demonstrates how to use the ledger, receipts, and hooks systems together
 */

import fs from 'fs-extra';
import { GitLedger } from './ledger.js';
import { GitReceipts } from './receipts.js';
import { GitHooks } from './hooks.js';

export async function demonstrateGitLedgerSystem(workingDir: string = process.cwd()) {
  console.log('🔧 Demonstrating Git-based Ledger System');
  console.log(`📂 Working directory: ${workingDir}`);

  // Configuration
  const config = {
    gitDir: `${workingDir}/.git`,
    fs: fs,
    enableSigning: true,
    autoCommit: true
  };

  // Initialize components
  const ledger = new GitLedger(config);
  const receipts = new GitReceipts(config);
  const hooks = new GitHooks(config);

  try {
    // Initialize all components
    console.log('\n📋 Initializing ledger system...');
    await ledger.initialize();
    await hooks.initialize();

    // Example 1: Record a publish operation
    console.log('\n📦 Recording publish operation...');
    const publishMetadata = {
      packageName: '@kgen/example',
      version: '1.0.0',
      registry: 'npm',
      author: {
        name: 'KGEN System',
        email: 'kgen@example.com'
      },
      dependencies: {
        'isomorphic-git': '^1.25.10',
        'crypto-js': '^4.2.0'
      }
    };

    // Execute post-publish hook
    await hooks.executeHooks('post-publish', {
      operation: 'publish',
      timestamp: new Date().toISOString(),
      workingDir,
      metadata: publishMetadata,
      outputs: {
        'package.json': JSON.stringify({ name: publishMetadata.packageName, version: publishMetadata.version }),
        'README.md': '# Example Package\n\nThis is an example package.',
        'dist/index.js': 'export function hello() { return "Hello, world!"; }'
      }
    });

    // Example 2: Record an install operation
    console.log('\n💾 Recording install operation...');
    const installMetadata = {
      packageName: '@kgen/example',
      version: '1.0.0',
      installMethod: 'npm' as const,
      registry: 'https://registry.npmjs.org/',
      filesCount: 10,
      size: 15234,
      duration: 2500,
      npmVersion: '10.2.4'
    };

    await hooks.executeHooks('post-install', {
      operation: 'install',
      timestamp: new Date().toISOString(),
      workingDir,
      metadata: installMetadata,
      inputs: {
        command: 'npm install @kgen/example',
        flags: ['--save']
      },
      outputs: {
        installedPackage: publishMetadata.packageName,
        version: publishMetadata.version
      }
    });

    // Example 3: Record an attestation
    console.log('\n🔏 Recording attestation operation...');
    const attestationMetadata = {
      attestationType: 'code-review',
      attestationData: {
        reviewer: 'Alice Smith',
        reviewDate: new Date().toISOString(),
        approved: true,
        comments: ['Code quality looks good', 'Tests are comprehensive']
      },
      previousAttestations: []
    };

    await hooks.executeHooks('post-attest', {
      operation: 'attest',
      timestamp: new Date().toISOString(),
      workingDir,
      metadata: attestationMetadata,
      inputs: {
        codeHash: 'sha256:abc123...',
        reviewCriteria: ['security', 'performance', 'maintainability']
      }
    });

    // Example 4: Query ledger entries
    console.log('\n📊 Querying ledger entries...');
    const allEntries = await ledger.getAllEntries();
    console.log(`Found ${allEntries.length} ledger entries:`);
    
    for (const entry of allEntries) {
      console.log(`  - ${entry.operation} at ${entry.timestamp} (${entry.id})`);
    }

    // Example 5: Query receipts
    console.log('\n🧾 Querying receipts...');
    const recentReceipts = await receipts.queryReceipts({
      since: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      limit: 10
    });
    
    console.log(`Found ${recentReceipts.length} recent receipts:`);
    for (const receipt of recentReceipts) {
      const verified = receipt.verification.inputsValid && 
                      receipt.verification.outputsValid && 
                      receipt.verification.checksumValid;
      console.log(`  - ${receipt.operation} (${receipt.id}) - Verified: ${verified}`);
    }

    // Example 6: Get statistics
    console.log('\n📈 System statistics:');
    console.log('Ledger stats:', ledger.getStats());
    console.log('Receipts stats:', receipts.getStats());
    console.log('Hooks stats:', hooks.getStats());

    console.log('\n✅ Git ledger system demonstration completed successfully!');
    
    return {
      ledgerEntries: allEntries.length,
      receipts: recentReceipts.length,
      stats: {
        ledger: ledger.getStats(),
        receipts: receipts.getStats(),
        hooks: hooks.getStats()
      }
    };

  } catch (error) {
    console.error('❌ Error during demonstration:', error);
    throw error;
  } finally {
    // Cleanup resources
    await ledger.cleanup();
    await receipts.cleanup(); 
    await hooks.cleanup();
  }
}

// Example of how to extend the system with custom hooks
export function setupCustomHooks(hooks: GitHooks) {
  // Custom hook for deployment operations
  hooks.registerHook('post-deploy', async (context) => {
    console.log(`🚀 Deployment hook executed for ${context.operation}`);
    
    // Record deployment metadata
    const deploymentMetadata = {
      environment: context.metadata?.environment || 'production',
      version: context.metadata?.version,
      deployedAt: context.timestamp,
      deploymentId: `deploy-${Date.now()}`
    };

    // Could store deployment receipts, update service registry, etc.
    console.log('Deployment metadata:', deploymentMetadata);
  });

  // Custom hook for security scanning
  hooks.registerHook('post-scan', async (context) => {
    console.log(`🔍 Security scan hook executed for ${context.operation}`);
    
    const scanResults = context.metadata?.scanResults || {
      vulnerabilities: 0,
      warnings: 0,
      passed: true
    };

    console.log('Security scan results:', scanResults);
  });
}

// Example of querying across the entire system
export async function generateAuditReport(workingDir: string) {
  const config = {
    gitDir: `${workingDir}/.git`,
    fs: fs,
    enableSigning: true
  };

  const ledger = new GitLedger(config);
  const receipts = new GitReceipts(config);

  try {
    await ledger.initialize();

    const report = {
      generated: new Date().toISOString(),
      summary: {
        totalOperations: 0,
        publishOperations: 0,
        installOperations: 0,
        attestations: 0,
        verifiedReceipts: 0,
        failedVerifications: 0
      },
      timeline: [] as any[],
      integrity: {
        allEntriesVerified: true,
        missingReceipts: [] as string[],
        corruptedData: [] as string[]
      }
    };

    // Get all ledger entries
    const entries = await ledger.getAllEntries();
    report.summary.totalOperations = entries.length;

    // Get all receipts
    const allReceipts = await receipts.getAllReceipts();

    // Analyze operations
    for (const entry of entries) {
      switch (entry.operation) {
        case 'publish':
          report.summary.publishOperations++;
          break;
        case 'install':
          report.summary.installOperations++;
          break;
        case 'attest':
          report.summary.attestations++;
          break;
      }

      // Add to timeline
      report.timeline.push({
        timestamp: entry.timestamp,
        operation: entry.operation,
        id: entry.id,
        commitHash: entry.commitHash,
        tags: entry.tags
      });
    }

    // Analyze receipts
    for (const receipt of allReceipts) {
      if (receipt.verification.inputsValid && 
          receipt.verification.outputsValid && 
          receipt.verification.checksumValid) {
        report.summary.verifiedReceipts++;
      } else {
        report.summary.failedVerifications++;
        report.integrity.corruptedData.push(receipt.id);
      }
    }

    // Check for missing receipts
    for (const entry of entries) {
      const hasReceipt = allReceipts.some(r => r.commitHash === entry.commitHash);
      if (!hasReceipt) {
        report.integrity.missingReceipts.push(entry.id);
      }
    }

    report.integrity.allEntriesVerified = 
      report.integrity.missingReceipts.length === 0 && 
      report.integrity.corruptedData.length === 0;

    return report;
    
  } finally {
    await ledger.cleanup();
    await receipts.cleanup();
  }
}

// Export for use in other modules
export { GitLedger, GitReceipts, GitHooks };