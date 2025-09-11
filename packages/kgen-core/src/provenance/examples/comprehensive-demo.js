/**
 * Comprehensive Provenance Tracking Demo
 * 
 * Demonstrates the full capabilities of the W3C PROV-O compliant
 * provenance tracking system with blockchain anchoring and compliance logging.
 */

import { ProvenanceTracker } from '../tracker.js';
import consola from 'consola';

const logger = consola.withTag('provenance-demo');

async function runComprehensiveDemo() {
  logger.info('🚀 Starting Comprehensive Provenance Tracking Demo');

  // Initialize tracker with full features
  const tracker = new ProvenanceTracker({
    // Storage configuration
    storageBackend: 'file',
    storagePath: './demo-data/provenance',
    
    // Security features
    enableCryptographicHashing: true,
    enableDigitalSignatures: false, // Disabled for demo
    hashAlgorithm: 'sha256',
    
    // Blockchain anchoring (mock for demo)
    enableBlockchainIntegrity: true,
    blockchainNetwork: 'mock',
    blockchainInterval: 10000, // 10 seconds for demo
    
    // Compliance settings
    complianceMode: 'GDPR,SOX,HIPAA',
    auditRetention: '7years',
    encryptionEnabled: false, // Disabled for demo
    
    // Provenance bundles
    enableProvBundles: true,
    bundleStrategy: 'temporal',
    bundleSize: 5,
    
    // Chain validation
    enableChainValidation: true,
    chainValidationInterval: 30000, // 30 seconds for demo
    
    auditLevel: 'FULL'
  });

  try {
    // Step 1: Initialize tracker
    logger.info('📋 Step 1: Initializing provenance tracker...');
    const initResult = await tracker.initialize();
    logger.success('Tracker initialized:', initResult);

    // Step 2: Simulate data ingestion pipeline
    logger.info('📊 Step 2: Simulating data ingestion pipeline...');
    await simulateDataPipeline(tracker);

    // Step 3: Demonstrate lineage tracking
    logger.info('🔗 Step 3: Demonstrating entity lineage tracking...');
    await demonstrateLineageTracking(tracker);

    // Step 4: Show compliance logging
    logger.info('⚖️ Step 4: Demonstrating compliance logging...');
    await demonstrateComplianceLogging(tracker);

    // Step 5: Verify integrity and chain
    logger.info('🔐 Step 5: Verifying integrity and hash chain...');
    await demonstrateIntegrityVerification(tracker);

    // Step 6: Generate reports
    logger.info('📈 Step 6: Generating compliance reports...');
    await demonstrateReporting(tracker);

    // Step 7: Show visualization capabilities
    logger.info('📊 Step 7: Generating visualization data...');
    await demonstrateVisualization(tracker);

    // Step 8: Demonstrate change impact analysis
    logger.info('🎯 Step 8: Demonstrating change impact analysis...');
    await demonstrateChangeImpact(tracker);

    // Step 9: Show SPARQL queries
    logger.info('🔍 Step 9: Demonstrating SPARQL queries...');
    await demonstrateSparqlQueries(tracker);

    // Final status
    logger.info('📊 Final Status:');
    const finalStatus = tracker.getStatus();
    logger.info(JSON.stringify(finalStatus, null, 2));

    await tracker.shutdown();
    logger.success('🎉 Demo completed successfully!');

  } catch (error) {
    logger.error('❌ Demo failed:', error);
    await tracker.shutdown();
  }
}

async function simulateDataPipeline(tracker) {
  const stages = [
    {
      name: 'data-extraction',
      user: { id: 'etl-system', name: 'ETL System', type: 'software' },
      inputs: [],
      sources: [
        { id: 'customer-db', name: 'Customer Database' },
        { id: 'transaction-log', name: 'Transaction Log' }
      ]
    },
    {
      name: 'data-transformation',
      user: { id: 'transform-engine', name: 'Transformation Engine', type: 'software' },
      inputs: [{ id: 'raw-customer-data' }, { id: 'raw-transactions' }],
      sources: [{ id: 'transformation-rules' }]
    },
    {
      name: 'data-validation',
      user: { id: 'validator', name: 'Data Validator', type: 'software' },
      inputs: [{ id: 'transformed-data' }],
      sources: [{ id: 'validation-schema' }]
    },
    {
      name: 'data-loading',
      user: { id: 'loader', name: 'Data Loader', type: 'software' },
      inputs: [{ id: 'validated-data' }],
      sources: []
    }
  ];

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    logger.info(`  └─ Processing stage: ${stage.name}`);

    // Start operation
    const operation = await tracker.startOperation({
      type: stage.name,
      user: stage.user,
      inputs: stage.inputs,
      sources: stage.sources,
      metadata: {
        pipeline: 'customer-analytics',
        stage: i + 1,
        totalStages: stages.length
      }
    });

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Complete operation
    await tracker.completeOperation(operation.operationId, {
      status: Math.random() > 0.1 ? 'success' : 'warning', // 90% success rate
      outputs: [
        { id: `${stage.name}-output`, name: `${stage.name} result` }
      ],
      metrics: {
        recordsProcessed: Math.floor(Math.random() * 10000) + 1000,
        duration: Math.floor(Math.random() * 5000) + 1000,
        memoryUsed: Math.floor(Math.random() * 100) + 50
      },
      outputGraph: {
        entities: [{ id: `${stage.name}-output`, type: 'dataset' }]
      }
    });

    logger.success(`    ✓ Completed: ${stage.name}`);
  }

  logger.success('  Pipeline simulation completed');
}

async function demonstrateLineageTracking(tracker) {
  // Track lineage for a complex entity
  const entityId = 'customer-360-view';
  
  await tracker.trackEntityLineage(entityId, {
    sources: [
      { id: 'customer-db', type: 'database' },
      { id: 'transaction-log', type: 'log' },
      { id: 'web-analytics', type: 'analytics' },
      { id: 'support-tickets', type: 'ticketing' }
    ],
    transformations: [
      'data-cleansing',
      'deduplication', 
      'normalization',
      'aggregation',
      'enrichment'
    ],
    derivations: [
      { id: 'customer-segments', type: 'analysis' },
      { id: 'churn-predictions', type: 'ml-model' },
      { id: 'recommendation-engine', type: 'ml-model' }
    ],
    operationId: 'customer-360-build'
  });

  // Get comprehensive lineage
  const lineage = await tracker.getAdvancedEntityLineage(entityId, {
    maxDepth: 10,
    direction: 'both',
    includeImpactAnalysis: true,
    includeCompliance: true
  });

  logger.info('  📊 Entity lineage tracked:');
  logger.info(`    - Sources: ${lineage.lineage.length || 0}`);
  logger.info(`    - Impact Score: ${lineage.impactAnalysis?.impactScore || 'N/A'}`);
  logger.info(`    - Criticality: ${lineage.impactAnalysis?.criticalityLevel || 'N/A'}`);
}

async function demonstrateComplianceLogging(tracker) {
  // GDPR compliance events
  await tracker.complianceLogger.logDataAccess({
    subject: 'customer-12345',
    dataTypes: ['personal_data', 'financial_data'],
    purpose: 'fraud_detection',
    legalBasis: 'legitimate_interest',
    accessor: 'fraud-detection-system',
    authorized: true
  });

  await tracker.complianceLogger.logConsent({
    subject: 'customer-12345',
    type: 'marketing_communications',
    granted: true,
    purposes: ['email_marketing', 'product_recommendations'],
    mechanism: 'web_consent_banner'
  });

  // SOX compliance events
  await tracker.complianceLogger.logFinancialTransaction({
    id: 'txn-789',
    amount: 15000.00,
    accounts: ['asset-123', 'revenue-456'],
    approver: 'manager-john-doe',
    controls: ['dual_approval', 'segregation_of_duties']
  });

  // HIPAA compliance events
  await tracker.complianceLogger.logHealthcareAccess({
    patientId: 'patient-xyz',
    accessor: 'dr-smith',
    type: 'medical_record_access',
    dataTypes: ['diagnosis', 'treatment_plan'],
    justification: 'treatment_planning'
  });

  const complianceStats = tracker.complianceLogger.getComplianceStatistics();
  logger.info('  📋 Compliance events logged:');
  logger.info(`    - Total events: ${complianceStats.totalEvents}`);
  logger.info(`    - Violations: ${complianceStats.violations}`);
  logger.info(`    - Compliance rate: ${(complianceStats.complianceRate * 100).toFixed(2)}%`);
}

async function demonstrateIntegrityVerification(tracker) {
  // Verify hash chain
  const chainVerification = await tracker.verifyHashChain();
  logger.info('  🔗 Hash chain verification:');
  logger.info(`    - Total links: ${chainVerification.totalLinks}`);
  logger.info(`    - Valid links: ${chainVerification.validLinks}`);
  logger.info(`    - Integrity score: ${(chainVerification.integrityScore * 100).toFixed(2)}%`);
  
  if (chainVerification.brokenLinks.length > 0) {
    logger.warn(`    - Broken links detected: ${chainVerification.brokenLinks.length}`);
  }

  // Verify provenance integrity
  const integrityVerification = await tracker.verifyIntegrity();
  logger.info('  🔐 Provenance integrity verification:');
  logger.info(`    - Total records: ${integrityVerification.totalRecords}`);
  logger.info(`    - Verified records: ${integrityVerification.verifiedRecords}`);
  logger.info(`    - Integrity score: ${(integrityVerification.integrityScore * 100).toFixed(2)}%`);
  
  if (integrityVerification.issues.length > 0) {
    logger.warn(`    - Issues found: ${integrityVerification.issues.length}`);
  }
}

async function demonstrateReporting(tracker) {
  const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
  const endDate = new Date();

  // Generate GDPR compliance report
  try {
    const gdprReport = await tracker.generateComplianceReport('GDPR', startDate, endDate);
    logger.info('  📊 GDPR Compliance Report generated:');
    logger.info(`    - Regulation: ${gdprReport.regulation}`);
    logger.info(`    - Query results: ${Object.keys(gdprReport.queries).length}`);
    logger.info(`    - Integrity verified: ${gdprReport.integrityVerification?.integrityScore || 'N/A'}`);
  } catch (error) {
    logger.warn('  ⚠️  GDPR report generation skipped:', error.message);
  }

  // Generate audit trail
  const auditTrail = await tracker.generateAuditTrail(startDate, endDate, {
    detectAnomalies: true
  });
  
  logger.info('  📋 Audit trail generated:');
  logger.info(`    - Total activities: ${auditTrail.totalActivities}`);
  logger.info(`    - Success rate: ${((auditTrail.statistics.successfulActivities / auditTrail.totalActivities) * 100).toFixed(2)}%`);
  logger.info(`    - Average duration: ${auditTrail.statistics.averageDuration?.toFixed(2) || 'N/A'}ms`);
}

async function demonstrateVisualization(tracker) {
  // Generate different visualization formats
  const formats = ['cytoscape', 'd3', 'graphviz'];
  
  for (const format of formats) {
    const vizData = await tracker.getVisualizationData({ format });
    
    if (format === 'graphviz') {
      logger.info(`  📊 ${format.toUpperCase()} visualization: ${typeof vizData} (${vizData.length} chars)`);
    } else {
      logger.info(`  📊 ${format.toUpperCase()} visualization:`);
      logger.info(`    - Nodes: ${vizData.nodes?.length || 0}`);
      logger.info(`    - Edges/Links: ${(vizData.edges || vizData.links)?.length || 0}`);
    }
  }
}

async function demonstrateChangeImpact(tracker) {
  const targetEntity = 'customer-360-view';
  
  const impact = await tracker.analyzeChangeImpact(targetEntity, {
    type: 'schema_change',
    changes: ['add_field', 'modify_type'],
    fields: ['email', 'phone_number', 'customer_segment'],
    description: 'Adding new customer segmentation fields'
  });

  logger.info('  🎯 Change Impact Analysis:');
  logger.info(`    - Target entity: ${impact.targetEntity}`);
  logger.info(`    - Affected entities: ${impact.affectedEntities.length}`);
  logger.info(`    - Affected activities: ${impact.affectedActivities.length}`);
  logger.info(`    - Risk level: ${impact.riskLevel}`);
  logger.info(`    - Recommendations: ${impact.recommendations.length}`);
  
  if (impact.recommendations.length > 0) {
    impact.recommendations.forEach((rec, i) => {
      logger.info(`      ${i + 1}. ${rec}`);
    });
  }
}

async function demonstrateSparqlQueries(tracker) {
  const queries = [
    {
      name: 'Recent Activities',
      query: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
        SELECT ?activity ?agent ?startTime WHERE {
          ?activity a prov:Activity .
          ?activity prov:wasAssociatedWith ?agent .
          ?activity prov:startedAtTime ?startTime .
        } ORDER BY DESC(?startTime) LIMIT 5
      `
    },
    {
      name: 'Entity Derivations',
      query: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        SELECT ?entity ?derived WHERE {
          ?derived prov:wasDerivedFrom ?entity .
        } LIMIT 10
      `
    },
    {
      name: 'Agent Activities',
      query: `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        SELECT ?agent ?name (COUNT(?activity) AS ?activityCount) WHERE {
          ?activity prov:wasAssociatedWith ?agent .
          OPTIONAL { ?agent foaf:name ?name }
        } GROUP BY ?agent ?name ORDER BY DESC(?activityCount)
      `
    }
  ];

  for (const queryInfo of queries) {
    try {
      const results = await tracker.executeQuery(queryInfo.query);
      logger.info(`  🔍 SPARQL Query - ${queryInfo.name}:`);
      logger.info(`    - Bindings: ${results.results?.bindings?.length || 0}`);
      logger.info(`    - Variables: ${results.head?.vars?.join(', ') || 'none'}`);
    } catch (error) {
      logger.warn(`  ⚠️  Query '${queryInfo.name}' failed:`, error.message);
    }
  }
}

// Performance monitoring
function logPerformanceMetrics(tracker) {
  const status = tracker.getStatus();
  const metrics = status.metrics;

  logger.info('📊 Performance Metrics:');
  logger.info(`  - Operations tracked: ${metrics.operationsTracked}`);
  logger.info(`  - Entities tracked: ${metrics.entitiesTracked}`);
  logger.info(`  - Integrity verifications: ${metrics.integrityVerifications}`);
  logger.info(`  - Blockchain anchors: ${metrics.blockchainAnchors}`);
  logger.info(`  - Queries executed: ${metrics.queriesExecuted}`);
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveDemo().catch(error => {
    logger.error('❌ Demo error:', error);
    process.exit(1);
  });
}

export { runComprehensiveDemo };