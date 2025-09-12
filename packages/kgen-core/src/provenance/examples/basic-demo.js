/**
 * Basic Provenance Tracking Demo
 * 
 * Simple demonstration of core provenance tracking functionality
 * without advanced features that might cause issues.
 */

import { ProvenanceTracker } from '../tracker.js';
import consola from 'consola';

const logger = consola.withTag('basic-demo');

async function runBasicDemo() {
  logger.info('🚀 Starting Basic Provenance Tracking Demo');

  // Initialize tracker with basic features
  const tracker = new ProvenanceTracker({
    // Storage configuration
    storageBackend: 'memory',
    
    // Security features
    enableCryptographicHashing: true,
    enableDigitalSignatures: false, // Disabled for demo
    hashAlgorithm: 'sha256',
    
    // Blockchain anchoring disabled for basic demo
    enableBlockchainIntegrity: false,
    
    // Compliance settings
    complianceMode: 'GDPR',
    auditRetention: '7years',
    encryptionEnabled: false, // Disabled for demo
    
    // Provenance bundles disabled
    enableProvBundles: false,
    
    // Chain validation
    enableChainValidation: false,
    
    auditLevel: 'FULL'
  });

  try {
    // Step 1: Initialize tracker
    logger.info('📋 Step 1: Initializing provenance tracker...');
    const initResult = await tracker.initialize();
    logger.success('Tracker initialized:', initResult);

    // Step 2: Track a simple operation
    logger.info('📊 Step 2: Tracking a simple operation...');
    const operation = await tracker.startOperation({
      type: 'data-processing',
      user: { id: 'demo-user', name: 'Demo User', email: 'demo@example.com' },
      inputs: [{ id: 'input1', name: 'source-data.csv' }],
      sources: [{ id: 'database1', name: 'Customer Database' }],
      metadata: { 
        version: '1.0',
        description: 'Process customer data for analytics'
      }
    });

    logger.info(`Operation started: ${operation.operationId}`);

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Complete the operation
    const completion = await tracker.completeOperation(operation.operationId, {
      status: 'success',
      outputs: [
        { id: 'output1', name: 'processed-data.json' }
      ],
      metrics: {
        recordsProcessed: 1500,
        duration: 2500,
        memoryUsed: 128
      },
      outputGraph: {
        entities: [
          { id: 'output1', type: 'dataset', format: 'json' }
        ]
      }
    });

    logger.success('Operation completed:', completion.operationId);

    // Step 3: Track entity lineage
    logger.info('🔗 Step 3: Tracking entity lineage...');
    const lineage = await tracker.trackEntityLineage('customer-dataset', {
      sources: [
        { id: 'raw-customers', type: 'table' },
        { id: 'transactions', type: 'log' }
      ],
      transformations: [
        'data-cleaning',
        'deduplication',
        'normalization'
      ],
      derivations: [
        { id: 'analytics-ready-dataset', type: 'view' }
      ],
      operationId: operation.operationId
    });

    logger.success('Lineage tracked for entity:', lineage.entityId);

    // Step 4: Verify integrity
    logger.info('🔐 Step 4: Verifying integrity...');
    const integrityResult = await tracker.verifyIntegrity();
    logger.success('Integrity verification:', {
      totalRecords: integrityResult.totalRecords,
      verifiedRecords: integrityResult.verifiedRecords,
      integrityScore: (integrityResult.integrityScore * 100).toFixed(2) + '%'
    });

    // Step 5: Generate audit trail
    logger.info('📈 Step 5: Generating audit trail...');
    const startDate = new Date(this.getDeterministicTimestamp() - 24 * 60 * 60 * 1000); // 24 hours ago
    const endDate = this.getDeterministicDate();
    
    const auditTrail = await tracker.generateAuditTrail(startDate, endDate);
    logger.success('Audit trail generated:', {
      totalActivities: auditTrail.totalActivities,
      successfulActivities: auditTrail.statistics.successfulActivities,
      integrityVerified: auditTrail.integrityVerified
    });

    // Step 6: Export provenance data
    logger.info('📤 Step 6: Exporting provenance data...');
    const jsonExport = await tracker.exportProvenance({ format: 'json' });
    const exportData = JSON.parse(jsonExport);
    logger.success('Provenance exported:', {
      activities: exportData.activities.length,
      entities: Object.keys(exportData.entityLineage).length,
      agents: Object.keys(exportData.agents).length
    });

    // Step 7: Show final status
    logger.info('📊 Step 7: Final status...');
    const finalStatus = tracker.getStatus();
    logger.success('Final tracker status:', {
      state: finalStatus.state,
      historicalActivities: finalStatus.historicalActivities,
      entityLineageRecords: finalStatus.entityLineageRecords,
      provenanceTriples: finalStatus.provenanceTriples,
      metrics: finalStatus.metrics
    });

    // Cleanup
    await tracker.shutdown();
    logger.success('🎉 Basic demo completed successfully!');

    return {
      success: true,
      operationsTracked: finalStatus.historicalActivities,
      entitiesTracked: finalStatus.entityLineageRecords,
      integrityScore: integrityResult.integrityScore
    };

  } catch (error) {
    logger.error('❌ Demo failed:', error);
    await tracker.shutdown();
    throw error;
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runBasicDemo().catch(error => {
    logger.error('❌ Demo error:', error);
    process.exit(1);
  });
}

export { runBasicDemo };