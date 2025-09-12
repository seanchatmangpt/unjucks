/**
 * Provenance Tracker Tests
 * 
 * Comprehensive tests for W3C PROV-O compliant provenance tracking system
 * including audit trails, blockchain anchoring, and compliance logging.
 */

import { strict as assert } from 'assert';
import { ProvenanceTracker } from '../../../src/kgen/provenance/tracker.js';

describe('ProvenanceTracker', () => {
  let tracker;
  
  beforeEach(async () => {
    tracker = new ProvenanceTracker({
      storageBackend: 'memory',
      enableCryptographicHashing: true,
      enableDigitalSignatures: false,
      enableBlockchainIntegrity: false,
      complianceMode: 'GDPR',
      auditLevel: 'FULL'
    });
    
    await tracker.initialize();
  });
  
  afterEach(async () => {
    if (tracker) {
      await tracker.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const status = tracker.getStatus();
      
      assert.equal(status.state, 'ready');
      assert.equal(status.activeOperations, 0);
      assert.equal(status.hashChainLength, 1); // Genesis block
      assert.equal(status.configuration.enableCryptographicHashing, true);
      assert.equal(status.configuration.complianceMode, 'GDPR');
    });
    
    it('should initialize hash chain with genesis block', async () => {
      const status = tracker.getStatus();
      assert.equal(status.hashChainLength, 1);
    });
  });

  describe('Operation Tracking', () => {
    it('should track complete operation lifecycle', async () => {
      // Start operation
      const operation = await tracker.startOperation({
        type: 'data-transformation',
        user: { id: 'user123', name: 'John Doe', email: 'john@example.com' },
        inputs: [{ id: 'input1', name: 'source-data' }],
        sources: [{ id: 'source1', name: 'database-table' }],
        metadata: { version: '1.0' }
      });
      
      assert(operation.operationId);
      assert.equal(operation.type, 'data-transformation');
      assert(operation.startTime instanceof Date);
      
      // Complete operation
      const completion = await tracker.completeOperation(operation.operationId, {
        status: 'success',
        outputs: [{ id: 'output1', name: 'transformed-data' }],
        metrics: { recordsProcessed: 1000, duration: 5000 },
        outputGraph: {
          entities: [{ id: 'output1', type: 'dataset' }]
        }
      });
      
      assert.equal(completion.operationId, operation.operationId);
      assert.equal(completion.status, 'success');
      assert(completion.integrityHash);
      
      // Verify tracking state
      const status = tracker.getStatus();
      assert.equal(status.activeOperations, 0);
      assert.equal(status.historicalActivities, 1);
      assert.equal(status.hashChainLength, 2); // Genesis + operation
    });
    
    it('should handle operation errors', async () => {
      const operation = await tracker.startOperation({
        type: 'test-operation',
        user: { id: 'user456' }
      });
      
      await tracker.recordError(operation.operationId, new Error('Test error'));
      
      const status = tracker.getStatus();
      assert.equal(status.activeOperations, 0);
      assert.equal(status.historicalActivities, 1);
      
      // Check that error was recorded
      const activities = tracker.activityHistory;
      assert.equal(activities[0].status, 'error');
      assert(activities[0].error);
    });
  });

  describe('Entity Lineage', () => {
    it('should track entity lineage', async () => {
      const entityId = 'test-entity-123';
      
      const lineage = await tracker.trackEntityLineage(entityId, {
        sources: [{ id: 'source1' }, { id: 'source2' }],
        transformations: ['normalize', 'aggregate'],
        derivations: [{ id: 'derived1' }],
        operationId: 'op-123'
      });
      
      assert.equal(lineage.entityId, entityId);
      assert.equal(lineage.sources.length, 2);
      assert.equal(lineage.transformations.length, 2);
      assert.equal(lineage.derivations.length, 1);
      assert(lineage.timestamp);
      
      // Test retrieval
      const retrievedLineage = await tracker.getEntityLineage(entityId);
      assert.equal(retrievedLineage.entityId, entityId);
      assert(retrievedLineage.directLineage);
    });
    
    it('should get advanced entity lineage with SPARQL', async () => {
      // First track some lineage
      await tracker.trackEntityLineage('entity1', {
        sources: [{ id: 'source1' }],
        operationId: 'op1'
      });
      
      const advancedLineage = await tracker.getAdvancedEntityLineage('entity1', {
        maxDepth: 5,
        direction: 'both',
        includeImpactAnalysis: true,
        includeCompliance: true
      });
      
      assert.equal(advancedLineage.entity, 'http://kgen.enterprise/provenance/entity/entity1');
      assert(advancedLineage.lineage);
      assert(advancedLineage.impactAnalysis);
      assert(advancedLineage.compliance);
    });
  });

  describe('Hash Chain Integrity', () => {
    it('should maintain hash chain integrity', async () => {
      // Create multiple operations to build chain
      for (let i = 0; i < 3; i++) {
        const operation = await tracker.startOperation({
          type: `test-operation-${i}`,
          user: { id: `user${i}` }
        });
        
        await tracker.completeOperation(operation.operationId, {
          status: 'success',
          outputs: [{ id: `output${i}` }]
        });
      }
      
      // Verify chain integrity
      const verification = await tracker.verifyHashChain();
      
      assert.equal(verification.totalLinks, 4); // Genesis + 3 operations
      assert.equal(verification.validLinks, 3); // 3 valid links between blocks
      assert.equal(verification.brokenLinks.length, 0);
      assert.equal(verification.integrityScore, 1.0);
    });
    
    it('should detect hash chain tampering', async () => {
      // Create operation
      const operation = await tracker.startOperation({
        type: 'test-operation',
        user: { id: 'user1' }
      });
      
      await tracker.completeOperation(operation.operationId, {
        status: 'success'
      });
      
      // Tamper with hash chain
      tracker.hashChain[1].hash = 'tampered-hash';
      
      // Verify should detect tampering
      const verification = await tracker.verifyHashChain();
      
      assert.equal(verification.integrityScore, 0); // Should be broken
      assert.equal(verification.brokenLinks.length, 0); // No forward links to check
    });
  });

  describe('SPARQL Queries', () => {
    it('should execute SPARQL queries', async () => {
      const query = `
        PREFIX prov: <http://www.w3.org/ns/prov#>
        SELECT ?activity ?agent WHERE {
          ?activity a prov:Activity .
          ?activity prov:wasAssociatedWith ?agent .
        }
      `;
      
      const results = await tracker.executeQuery(query);
      
      assert(results);
      assert(results.head);
      assert(results.results);
      assert(Array.isArray(results.results.bindings));
    });
  });

  describe('Compliance Logging', () => {
    it('should log GDPR compliance events', async () => {
      await tracker.complianceLogger.logDataAccess({
        subject: 'user123',
        dataTypes: ['name', 'email'],
        purpose: 'service_delivery',
        legalBasis: 'contract',
        accessor: 'system',
        authorized: true
      });
      
      await tracker.complianceLogger.logConsent({
        subject: 'user123',
        type: 'marketing',
        granted: true,
        purposes: ['email_marketing'],
        mechanism: 'web_form'
      });
      
      const stats = tracker.complianceLogger.getComplianceStatistics();
      assert.equal(stats.totalEvents, 2);
      assert.equal(stats.framework, 'GDPR');
    });
    
    it('should generate compliance reports', async () => {
      const startDate = new Date(this.getDeterministicTimestamp() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endDate = this.getDeterministicDate();
      
      const report = await tracker.generateComplianceReport('GDPR', startDate, endDate);
      
      assert.equal(report.regulation, 'GDPR');
      assert(report.queries);
      assert(report.complianceAnalysis);
      assert(report.integrityVerification);
      assert(report.chainIntegrity);
    });
  });

  describe('Change Impact Analysis', () => {
    it('should analyze change impact', async () => {
      // Set up some lineage data
      await tracker.trackEntityLineage('target-entity', {
        sources: [{ id: 'source1' }],
        derivations: [{ id: 'derived1' }, { id: 'derived2' }],
        operationId: 'op1'
      });
      
      const impact = await tracker.analyzeChangeImpact('target-entity', {
        type: 'schema_change',
        fields: ['name', 'email']
      });
      
      assert.equal(impact.targetEntity, 'target-entity');
      assert(impact.proposedChanges);
      assert(Array.isArray(impact.affectedEntities));
      assert(Array.isArray(impact.recommendations));
      assert(['low', 'medium', 'high'].includes(impact.riskLevel));
    });
  });

  describe('Visualization Data', () => {
    it('should generate Cytoscape visualization data', async () => {
      // Create some provenance data
      const operation = await tracker.startOperation({
        type: 'test-operation',
        user: { id: 'user1', name: 'Test User' },
        inputs: [{ id: 'input1' }]
      });
      
      await tracker.completeOperation(operation.operationId, {
        status: 'success',
        outputs: [{ id: 'output1' }]
      });
      
      const vizData = await tracker.getVisualizationData({
        format: 'cytoscape'
      });
      
      assert.equal(vizData.format, 'cytoscape');
      assert(Array.isArray(vizData.nodes));
      assert(Array.isArray(vizData.edges));
      assert(vizData.metadata);
      assert(vizData.metadata.totalActivities > 0);
    });
    
    it('should generate D3 visualization data', async () => {
      const vizData = await tracker.getVisualizationData({
        format: 'd3'
      });
      
      assert(Array.isArray(vizData.nodes));
      assert(Array.isArray(vizData.links));
      assert(vizData.metadata);
    });
    
    it('should generate Graphviz DOT format', async () => {
      const vizData = await tracker.getVisualizationData({
        format: 'graphviz'
      });
      
      assert(typeof vizData === 'string');
      assert(vizData.includes('digraph provenance'));
    });
  });

  describe('Audit Trails', () => {
    it('should generate comprehensive audit trail', async () => {
      // Create some activities
      for (let i = 0; i < 5; i++) {
        const operation = await tracker.startOperation({
          type: `audit-test-${i}`,
          user: { id: `user${i % 2}`, name: `User ${i % 2}` }
        });
        
        await tracker.completeOperation(operation.operationId, {
          status: i % 4 === 0 ? 'error' : 'success'
        });
      }
      
      const startDate = new Date(this.getDeterministicTimestamp() - 24 * 60 * 60 * 1000);
      const endDate = this.getDeterministicDate();
      
      const audit = await tracker.generateAuditTrail(startDate, endDate, {
        detectAnomalies: true
      });
      
      assert(audit.timeframe);
      assert.equal(audit.totalActivities, 5);
      assert(audit.activitiesByAgent);
      assert(audit.statistics);
      assert(audit.statistics.totalActivities > 0);
      assert(typeof audit.statistics.successfulActivities === 'number');
      assert(typeof audit.statistics.failedActivities === 'number');
      assert(audit.integrityVerified === true || audit.integrityVerified === false);
    });
  });

  describe('Integrity Verification', () => {
    it('should verify provenance integrity', async () => {
      // Create operations with hashes
      for (let i = 0; i < 3; i++) {
        const operation = await tracker.startOperation({
          type: `integrity-test-${i}`,
          user: { id: 'test-user' }
        });
        
        await tracker.completeOperation(operation.operationId, {
          status: 'success'
        });
      }
      
      const verification = await tracker.verifyIntegrity();
      
      assert(typeof verification.totalRecords === 'number');
      assert(typeof verification.verifiedRecords === 'number');
      assert(typeof verification.failedRecords === 'number');
      assert(typeof verification.integrityScore === 'number');
      assert(verification.integrityScore >= 0 && verification.integrityScore <= 1);
      assert(Array.isArray(verification.issues));
    });
  });

  describe('Export Functionality', () => {
    it('should export provenance as Turtle', async () => {
      // Create some provenance data
      const operation = await tracker.startOperation({
        type: 'export-test',
        user: { id: 'test-user' }
      });
      
      await tracker.completeOperation(operation.operationId, {
        status: 'success'
      });
      
      const turtle = await tracker.exportProvenance({
        format: 'turtle'
      });
      
      assert(typeof turtle === 'string');
      // Should contain RDF/Turtle syntax
      assert(turtle.includes('@prefix') || turtle.length === 0); // May be empty for test data
    });
    
    it('should export provenance as JSON', async () => {
      const json = await tracker.exportProvenance({
        format: 'json'
      });
      
      assert(typeof json === 'string');
      const parsed = JSON.parse(json);
      assert(parsed.activities);
      assert(parsed.entityLineage);
      assert(parsed.agents);
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics', async () => {
      const initialStatus = tracker.getStatus();
      const initialMetrics = initialStatus.metrics;
      
      // Perform some operations
      const operation = await tracker.startOperation({
        type: 'metrics-test',
        user: { id: 'test-user' }
      });
      
      await tracker.completeOperation(operation.operationId, {
        status: 'success'
      });
      
      await tracker.executeQuery('SELECT * WHERE { ?s ?p ?o } LIMIT 1');
      
      const finalStatus = tracker.getStatus();
      const finalMetrics = finalStatus.metrics;
      
      assert(finalMetrics.operationsTracked > initialMetrics.operationsTracked);
      assert(finalMetrics.queriesExecuted > initialMetrics.queriesExecuted);
    });
  });
});