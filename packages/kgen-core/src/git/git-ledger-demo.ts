/**
 * Git-based Ledger System Demo
 * 
 * Demonstrates the working git-based ledger where:
 * - Commits are anchors for operations
 * - Git notes store receipts and attestations  
 * - All state is stored in git for auditability
 */

import fs from 'fs-extra';
import { SimpleLedger } from './ledger-simple.js';
import { SimpleReceipts } from './receipts-simple.js';
import { SimpleHooks } from './hooks-simple.js';

export async function demonstrateGitLedgerSystem(workingDir: string = process.cwd()) {
  console.log('🔧 Git-based Ledger System Demo');
  console.log(`📂 Working directory: ${workingDir}`);

  // Configuration
  const config = {
    gitDir: `${workingDir}/.git`,
    fs: fs,
    enableSigning: true
  };

  // Initialize components
  const ledger = new SimpleLedger(config);
  const receipts = new SimpleReceipts(config);
  const hooks = new SimpleHooks(config);

  try {
    // Initialize all components
    console.log('\n📋 Initializing git ledger system...');
    await ledger.initialize();
    await receipts.initialize();
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
        'isomorphic-git': '^1.25.10'
      }
    };

    await hooks.executeHooks('post-publish', {
      operation: 'publish',
      timestamp: new Date().toISOString(),
      workingDir,
      metadata: publishMetadata,
      outputs: {
        'package.json': JSON.stringify({ 
          name: publishMetadata.packageName, 
          version: publishMetadata.version 
        }),
        'README.md': '# Example Package\n\nGit-based ledger demo package.',
        'dist/index.js': 'export function hello() { return "Hello from git ledger!"; }'
      }
    });

    // Example 2: Record an install operation  
    console.log('\n💾 Recording install operation...');
    const installMetadata = {
      packageName: '@kgen/example',
      version: '1.0.0',
      installMethod: 'npm' as const,
      registry: 'https://registry.npmjs.org/',
      filesCount: 5,
      size: 12345,
      duration: 1500,
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
      attestationType: 'security-scan',
      attestationData: {
        scanner: 'npm audit',
        scanDate: new Date().toISOString(),
        vulnerabilities: 0,
        passed: true
      }
    };

    await hooks.executeHooks('post-attest', {
      operation: 'attest',
      timestamp: new Date().toISOString(),
      workingDir,
      metadata: attestationMetadata,
      inputs: {
        codeHash: 'sha256:def456...',
        scanCriteria: ['vulnerabilities', 'licenses', 'dependencies']
      }
    });

    // Example 4: Query ledger entries
    console.log('\n📊 Querying ledger entries...');
    const allEntries = await ledger.getAllEntries();
    console.log(`Found ${allEntries.length} ledger entries:`);
    
    for (const entry of allEntries) {
      console.log(`  - ${entry.operation} at ${entry.timestamp} (${entry.id})`);
      if (entry.metadata?.packageName) {
        console.log(`    Package: ${entry.metadata.packageName}@${entry.metadata.version}`);
      }
    }

    // Example 5: Query receipts
    console.log('\n🧾 Querying receipts...');
    const allReceipts = await receipts.getAllReceipts();
    console.log(`Found ${allReceipts.length} receipts:`);
    
    for (const receipt of allReceipts) {
      const verified = receipt.verification.inputsValid && 
                      receipt.verification.outputsValid && 
                      receipt.verification.checksumValid;
      console.log(`  - ${receipt.operation} (${receipt.id.substring(0, 8)}) - Verified: ${verified}`);
    }

    // Example 6: Query by operation type
    console.log('\n🔍 Querying by operation type...');
    const publishEntries = await ledger.getEntriesByOperation('publish');
    const installReceipts = await receipts.queryReceipts({ operation: 'install' });
    
    console.log(`Publish operations: ${publishEntries.length}`);
    console.log(`Install receipts: ${installReceipts.length}`);

    // Example 7: System statistics
    console.log('\n📈 System statistics:');
    console.log('Ledger stats:', ledger.getStats());
    console.log('Receipts stats:', receipts.getStats());
    console.log('Hooks stats:', hooks.getStats());

    console.log('\n✅ Git ledger system demonstration completed successfully!');
    console.log('\n💡 Key Benefits:');
    console.log('  - All state stored in git for auditability');
    console.log('  - Commits act as anchors for operations');
    console.log('  - Git notes provide receipt storage');
    console.log('  - Hooks enable automated tracking');
    console.log('  - Full provenance and verification');

    return {
      ledgerEntries: allEntries.length,
      receipts: allReceipts.length,
      publishOperations: publishEntries.length,
      installReceipts: installReceipts.length,
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

// Example of extending the system with custom operations
export function setupCustomOperations(hooks: SimpleHooks) {
  // Custom hook for deployment tracking
  hooks.registerHook('post-deploy', async (context) => {
    console.log(`🚀 Deployment tracked: ${context.metadata?.environment || 'unknown'}`);
    
    const deploymentData = {
      environment: context.metadata?.environment || 'production',
      version: context.metadata?.version,
      deployedAt: context.timestamp,
      deploymentId: `deploy-${Date.now()}`
    };

    console.log('Deployment metadata stored:', deploymentData);
  });

  // Custom hook for security scanning
  hooks.registerHook('post-scan', async (context) => {
    console.log(`🔍 Security scan tracked: ${context.metadata?.scanType || 'general'}`);
    
    const scanResults = context.metadata?.scanResults || {
      vulnerabilities: 0,
      warnings: 0,
      passed: true
    };

    console.log('Security scan results stored:', scanResults);
  });
}

// Example of creating an audit trail
export async function generateAuditTrail(workingDir: string) {
  const config = {
    gitDir: `${workingDir}/.git`,
    fs: fs,
    enableSigning: true
  };

  const ledger = new SimpleLedger(config);
  const receipts = new SimpleReceipts(config);

  try {
    await ledger.initialize();
    await receipts.initialize();

    const auditTrail = {
      generated: new Date().toISOString(),
      summary: {
        totalOperations: 0,
        operationTypes: {} as Record<string, number>,
        verifiedReceipts: 0,
        totalReceipts: 0
      },
      timeline: [] as any[],
      integrity: {
        allVerified: true,
        issues: [] as string[]
      }
    };

    // Get all operations
    const entries = await ledger.getAllEntries();
    auditTrail.summary.totalOperations = entries.length;

    // Count operation types
    for (const entry of entries) {
      auditTrail.summary.operationTypes[entry.operation] = 
        (auditTrail.summary.operationTypes[entry.operation] || 0) + 1;
      
      auditTrail.timeline.push({
        timestamp: entry.timestamp,
        operation: entry.operation,
        id: entry.id,
        metadata: entry.metadata
      });
    }

    // Get all receipts
    const allReceipts = await receipts.getAllReceipts();
    auditTrail.summary.totalReceipts = allReceipts.length;

    // Check receipt verification
    for (const receipt of allReceipts) {
      if (receipt.verification.inputsValid && 
          receipt.verification.outputsValid && 
          receipt.verification.checksumValid) {
        auditTrail.summary.verifiedReceipts++;
      } else {
        auditTrail.integrity.allVerified = false;
        auditTrail.integrity.issues.push(`Receipt ${receipt.id} failed verification`);
      }
    }

    // Sort timeline by timestamp
    auditTrail.timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    console.log('\n📋 Audit Trail Generated:');
    console.log(`Total Operations: ${auditTrail.summary.totalOperations}`);
    console.log(`Total Receipts: ${auditTrail.summary.totalReceipts}`);
    console.log(`Verified Receipts: ${auditTrail.summary.verifiedReceipts}`);
    console.log(`Integrity Check: ${auditTrail.integrity.allVerified ? 'PASSED' : 'FAILED'}`);
    
    if (auditTrail.integrity.issues.length > 0) {
      console.log('Issues found:', auditTrail.integrity.issues);
    }

    return auditTrail;

  } finally {
    await ledger.cleanup();
    await receipts.cleanup();
  }
}

// Export the main components
export { SimpleLedger, SimpleReceipts, SimpleHooks };