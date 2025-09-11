/**
 * Provenance Tracker - PROV-O compliant provenance tracking for enterprise accountability
 * 
 * Implements comprehensive provenance tracking using W3C PROV-O standard for
 * data lineage, audit trails, and decision transparency in knowledge generation.
 */

import { EventEmitter } from 'events';
import { Logger } from 'consola';
import { Store, Writer, Parser } from 'n3';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

// Import specialized modules
import { ProvenanceStorage } from './storage/index.js';
import { BlockchainAnchor } from './blockchain/anchor.js';
import { ComplianceLogger } from './compliance/logger.js';
import { ProvenanceQueries } from './queries/sparql.js';

export class ProvenanceTracker extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Provenance configuration
      enableDetailedTracking: true,
      enableBlockchainIntegrity: process.env.KGEN_BLOCKCHAIN_ENABLED === 'true',
      blockchainNetwork: process.env.KGEN_BLOCKCHAIN_NETWORK || 'ethereum',
      blockchainInterval: parseInt(process.env.KGEN_BLOCKCHAIN_INTERVAL || '3600000', 10), // 1 hour
      retentionPeriod: '7years', // Compliance requirement
      
      // Storage configuration
      storageBackend: 'memory', // memory, file, database
      auditLevel: 'FULL', // BASIC, DETAILED, FULL
      
      // Integrity settings
      enableCryptographicHashing: true,
      hashAlgorithm: 'sha256',
      enableDigitalSignatures: process.env.KGEN_DIGITAL_SIGNATURES === 'true',
      signatureAlgorithm: 'RSA-SHA256',
      keyPath: process.env.KGEN_PRIVATE_KEY_PATH || './keys/private.pem',
      
      // Compliance settings
      complianceMode: process.env.KGEN_COMPLIANCE_MODE || 'GDPR', // GDPR, SOX, HIPAA, ALL
      auditRetention: process.env.KGEN_AUDIT_RETENTION || '7years',
      encryptionEnabled: process.env.KGEN_ENCRYPTION_ENABLED === 'true',
      
      // Chain validation
      enableChainValidation: true,
      chainValidationInterval: parseInt(process.env.KGEN_CHAIN_VALIDATION_INTERVAL || '86400000', 10), // 24 hours
      
      // Bundle configuration
      enableProvBundles: true,
      bundleStrategy: 'temporal', // temporal, activity, entity
      bundleSize: parseInt(process.env.KGEN_BUNDLE_SIZE || '1000', 10),
      
      // Namespaces
      namespaces: {
        prov: 'http://www.w3.org/ns/prov#',
        kgen: 'http://kgen.enterprise/provenance/',
        dct: 'http://purl.org/dc/terms/',
        foaf: 'http://xmlns.com/foaf/0.1/',
        xsd: 'http://www.w3.org/2001/XMLSchema#'
      },
      
      ...config
    };
    
    this.logger = new Logger({ tag: 'provenance-tracker' });
    this.store = new Store();
    this.writer = new Writer({ prefixes: this.config.namespaces });
    this.parser = new Parser({ factory: this.store.dataFactory });
    
    // Initialize specialized components
    this.storage = new ProvenanceStorage(this.config);
    this.blockchain = this.config.enableBlockchainIntegrity ? new BlockchainAnchor(this.config) : null;
    this.complianceLogger = new ComplianceLogger(this.config);
    this.queryEngine = new ProvenanceQueries(this.store, this.config);
    
    // Provenance state
    this.activeOperations = new Map();
    this.entityLineage = new Map();
    this.activityHistory = [];
    this.agentRegistry = new Map();
    this.provBundles = new Map();
    this.hashChain = [];
    this.digitalSignatures = new Map();
    
    // Compliance state
    this.complianceEvents = [];
    this.auditLog = [];
    this.encryptionKeys = new Map();
    
    // Performance metrics
    this.metrics = {
      operationsTracked: 0,
      entitiesTracked: 0,
      integrityVerifications: 0,
      blockchainAnchors: 0,
      queriesExecuted: 0
    };
    
    this.state = 'initialized';
  }

  /**
   * Initialize the provenance tracker
   */
  async initialize() {
    try {
      this.logger.info('Initializing provenance tracker...');
      
      // Initialize specialized components
      await this.storage.initialize();
      await this.complianceLogger.initialize();
      
      if (this.blockchain) {
        await this.blockchain.initialize();
      }
      
      // Initialize storage backend
      await this._initializeStorage();
      
      // Register system agents
      await this._registerSystemAgents();
      
      // Load existing provenance if available
      await this._loadExistingProvenance();
      
      // Initialize hash chain
      await this._initializeHashChain();
      
      // Load digital signature keys if enabled
      if (this.config.enableDigitalSignatures) {
        await this._loadSignatureKeys();
      }
      
      // Start periodic validation
      if (this.config.enableChainValidation) {
        await this._startChainValidation();
      }
      
      this.state = 'ready';
      this.logger.success('Provenance tracker initialized successfully');
      
      return { 
        status: 'success', 
        records: this.store.size,
        blockchain: this.blockchain ? 'enabled' : 'disabled',
        compliance: this.config.complianceMode
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize provenance tracker:', error);
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Start tracking a new operation
   * @param {Object} operationInfo - Operation information
   * @returns {Promise<Object>} Provenance context
   */
  async startOperation(operationInfo) {
    try {
      const operationId = operationInfo.operationId || uuidv4();
      const timestamp = new Date();
      
      this.logger.info(`Starting provenance tracking for operation: ${operationId}`);
      
      // Create operation context
      const provenanceContext = {
        operationId,
        type: operationInfo.type,
        startTime: timestamp,
        user: operationInfo.user,
        inputs: operationInfo.inputs || [],
        sources: operationInfo.sources || [],
        agent: await this._identifyAgent(operationInfo.user),
        activityUri: `${this.config.namespaces.kgen}activity/${operationId}`,
        planUri: `${this.config.namespaces.kgen}plan/${operationInfo.type}`,
        metadata: operationInfo.metadata || {}
      };
      
      // Store active operation
      this.activeOperations.set(operationId, provenanceContext);
      
      // Record activity start in RDF
      await this._recordActivityStart(provenanceContext);
      
      // Record input entities
      if (operationInfo.sources?.length > 0) {
        await this._recordInputEntities(provenanceContext, operationInfo.sources);
      }
      
      this.emit('operation:started', { operationId, context: provenanceContext });
      
      return provenanceContext;
      
    } catch (error) {
      this.logger.error('Failed to start operation tracking:', error);
      throw error;
    }
  }

  /**
   * Complete operation tracking
   * @param {string} operationId - Operation identifier
   * @param {Object} completionInfo - Operation completion information
   * @returns {Promise<Object>} Final provenance record
   */
  async completeOperation(operationId, completionInfo) {
    try {
      this.logger.info(`Completing provenance tracking for operation: ${operationId}`);
      
      const context = this.activeOperations.get(operationId);
      if (!context) {
        throw new Error(`No active operation found for ID: ${operationId}`);
      }
      
      // Update context with completion info
      context.endTime = new Date();
      context.status = completionInfo.status;
      context.outputs = completionInfo.outputs || [];
      context.metrics = completionInfo.metrics || {};
      context.outputGraph = completionInfo.outputGraph;
      context.validationReport = completionInfo.validationReport;
      context.duration = context.endTime.getTime() - context.startTime.getTime();
      
      // Record activity completion in RDF
      await this._recordActivityCompletion(context);
      
      // Record output entities
      if (completionInfo.outputGraph) {
        await this._recordOutputEntities(context, completionInfo.outputGraph);
      }
      
      // Record transformations and derivations
      await this._recordTransformations(context);
      
      // Generate cryptographic hash for integrity
      if (this.config.enableCryptographicHashing) {
        context.integrityHash = await this._generateIntegrityHash(context);
        await this._recordIntegrityHash(context);
        
        // Add to hash chain
        await this._addToHashChain(context);
      }
      
      // Generate digital signature if enabled
      if (this.config.enableDigitalSignatures) {
        context.digitalSignature = await this._generateDigitalSignature(context);
        this.digitalSignatures.set(operationId, context.digitalSignature);
      }
      
      // Queue for blockchain anchoring if enabled
      if (this.blockchain && context.integrityHash) {
        await this.blockchain.queueForAnchoring(operationId, context.integrityHash, {
          operationType: context.type,
          timestamp: context.endTime
        });
        this.metrics.blockchainAnchors++;
      }
      
      // Log compliance event
      await this.complianceLogger.logComplianceEvent('operation_completed', {
        operationId,
        type: context.type,
        user: context.user?.id || context.user?.username,
        duration: context.duration,
        status: context.status
      }, context);
      
      // Archive the operation
      this.activityHistory.push({ ...context });
      this.activeOperations.delete(operationId);
      
      // Store in persistent storage
      await this.storage.store(operationId, context, {
        type: 'operation',
        version: '1.0'
      });
      
      // Update metrics
      this.metrics.operationsTracked++;
      
      // Create provenance bundle if threshold reached
      if (this.config.enableProvBundles && this.activityHistory.length % this.config.bundleSize === 0) {
        await this._createProvenanceBundle();
      }
      
      // Generate provenance summary
      const provenanceRecord = await this._generateProvenanceRecord(context);
      
      this.emit('operation:completed', { 
        operationId, 
        context, 
        provenanceRecord 
      });
      
      this.logger.success(`Provenance tracking completed for operation: ${operationId}`);
      
      return provenanceRecord;
      
    } catch (error) {
      this.logger.error(`Failed to complete operation tracking for ${operationId}:`, error);
      throw error;
    }
  }

  /**
   * Record an error in operation tracking
   * @param {string} operationId - Operation identifier
   * @param {Error} error - Error object
   * @returns {Promise<void>}
   */
  async recordError(operationId, error) {
    try {
      this.logger.info(`Recording error for operation: ${operationId}`);
      
      const context = this.activeOperations.get(operationId);
      if (!context) {
        this.logger.warn(`No active operation found for error recording: ${operationId}`);
        return;
      }
      
      // Update context with error info
      context.endTime = new Date();
      context.status = 'error';
      context.error = {
        message: error.message,
        stack: error.stack,
        code: error.code,
        timestamp: new Date()
      };
      context.duration = context.endTime.getTime() - context.startTime.getTime();
      
      // Record error in RDF
      await this._recordActivityError(context);
      
      // Archive the failed operation
      this.activityHistory.push({ ...context });
      this.activeOperations.delete(operationId);
      
      this.emit('operation:error', { operationId, context, error });
      
    } catch (trackingError) {
      this.logger.error('Failed to record operation error:', trackingError);
    }
  }

  /**
   * Track data lineage for an entity
   * @param {string} entityId - Entity identifier
   * @param {Object} lineageInfo - Lineage information
   * @returns {Promise<Object>} Lineage record
   */
  async trackEntityLineage(entityId, lineageInfo) {
    try {
      this.logger.info(`Tracking lineage for entity: ${entityId}`);
      
      const lineageRecord = {
        entityId,
        entityUri: `${this.config.namespaces.kgen}entity/${entityId}`,
        sources: lineageInfo.sources || [],
        transformations: lineageInfo.transformations || [],
        derivations: lineageInfo.derivations || [],
        timestamp: new Date(),
        operationId: lineageInfo.operationId
      };
      
      // Store lineage
      this.entityLineage.set(entityId, lineageRecord);
      
      // Record lineage in RDF
      await this._recordEntityLineage(lineageRecord);
      
      this.emit('lineage:recorded', { entityId, lineageRecord });
      
      return lineageRecord;
      
    } catch (error) {
      this.logger.error(`Failed to track entity lineage for ${entityId}:`, error);
      throw error;
    }
  }

  /**
   * Get comprehensive lineage for an entity
   * @param {string} entityId - Entity identifier
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Complete lineage graph
   */
  async getEntityLineage(entityId, options = {}) {
    try {
      this.logger.info(`Retrieving lineage for entity: ${entityId}`);
      
      const lineageGraph = {
        entityId,
        directLineage: this.entityLineage.get(entityId),
        upstreamLineage: [],
        downstreamLineage: [],
        fullGraph: null
      };
      
      // Get upstream lineage (sources)
      if (options.includeUpstream !== false) {
        lineageGraph.upstreamLineage = await this._getUpstreamLineage(entityId, options.maxDepth || 10);
      }
      
      // Get downstream lineage (derived entities)
      if (options.includeDownstream !== false) {
        lineageGraph.downstreamLineage = await this._getDownstreamLineage(entityId, options.maxDepth || 10);
      }
      
      // Build complete lineage graph
      if (options.includeFullGraph) {
        lineageGraph.fullGraph = await this._buildLineageGraph(entityId, options);
      }
      
      return lineageGraph;
      
    } catch (error) {
      this.logger.error(`Failed to get entity lineage for ${entityId}:`, error);
      throw error;
    }
  }

  /**
   * Generate audit trail for a time period
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} options - Audit options
   * @returns {Promise<Object>} Audit trail report
   */
  async generateAuditTrail(startDate, endDate, options = {}) {
    try {
      this.logger.info(`Generating audit trail from ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      // Filter activities by date range
      const auditActivities = this.activityHistory.filter(activity => {
        const activityDate = new Date(activity.startTime);
        return activityDate >= startDate && activityDate <= endDate;
      });
      
      // Group by user/agent
      const activitiesByAgent = this._groupActivitiesByAgent(auditActivities);
      
      // Generate statistics
      const statistics = this._generateAuditStatistics(auditActivities);
      
      // Identify anomalies if requested
      const anomalies = options.detectAnomalies ? 
        await this._detectAuditAnomalies(auditActivities) : [];
      
      const auditTrail = {
        timeframe: { startDate, endDate },
        totalActivities: auditActivities.length,
        activitiesByAgent,
        statistics,
        anomalies,
        generatedAt: new Date(),
        integrityVerified: await this._verifyAuditIntegrity(auditActivities)
      };
      
      this.emit('audit:generated', auditTrail);
      
      return auditTrail;
      
    } catch (error) {
      this.logger.error('Failed to generate audit trail:', error);
      throw error;
    }
  }

  /**
   * Verify integrity of provenance records
   * @param {Array} records - Records to verify
   * @returns {Promise<Object>} Integrity verification result
   */
  async verifyIntegrity(records = null) {
    try {
      this.logger.info('Verifying provenance integrity');
      
      const recordsToVerify = records || this.activityHistory;
      const verificationResult = {
        totalRecords: recordsToVerify.length,
        verifiedRecords: 0,
        failedRecords: 0,
        integrityScore: 0,
        issues: []
      };
      
      for (const record of recordsToVerify) {
        if (record.integrityHash) {
          const computedHash = await this._generateIntegrityHash(record);
          
          if (computedHash === record.integrityHash) {
            verificationResult.verifiedRecords++;
          } else {
            verificationResult.failedRecords++;
            verificationResult.issues.push({
              operationId: record.operationId,
              issue: 'Hash mismatch',
              expected: record.integrityHash,
              computed: computedHash
            });
          }
        } else {
          verificationResult.issues.push({
            operationId: record.operationId,
            issue: 'Missing integrity hash'
          });
        }
      }
      
      verificationResult.integrityScore = verificationResult.totalRecords > 0 ?
        verificationResult.verifiedRecords / verificationResult.totalRecords : 1;
      
      this.emit('integrity:verified', verificationResult);
      
      return verificationResult;
      
    } catch (error) {
      this.logger.error('Failed to verify integrity:', error);
      throw error;
    }
  }

  /**
   * Export provenance data in various formats
   * @param {Object} options - Export options
   * @returns {Promise<string>} Exported data
   */
  async exportProvenance(options = {}) {
    try {
      const format = options.format || 'turtle';
      
      switch (format) {
        case 'turtle':
        case 'ttl':
          return await this._exportAsTurtle(options);
        case 'json-ld':
          return await this._exportAsJsonLD(options);
        case 'rdf-xml':
          return await this._exportAsRDFXML(options);
        case 'json':
          return await this._exportAsJSON(options);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
      
    } catch (error) {
      this.logger.error('Failed to export provenance:', error);
      throw error;
    }
  }

  /**
   * Get tracker status and metrics
   */
  getStatus() {
    return {
      state: this.state,
      activeOperations: this.activeOperations.size,
      historicalActivities: this.activityHistory.length,
      entityLineageRecords: this.entityLineage.size,
      registeredAgents: this.agentRegistry.size,
      provenanceTriples: this.store.size,
      provBundles: this.provBundles.size,
      hashChainLength: this.hashChain.length,
      digitalSignatures: this.digitalSignatures.size,
      metrics: this.metrics,
      blockchain: this.blockchain ? this.blockchain.getStatistics() : null,
      compliance: this.complianceLogger ? this.complianceLogger.getComplianceStatistics() : null,
      configuration: {
        auditLevel: this.config.auditLevel,
        enableDetailedTracking: this.config.enableDetailedTracking,
        enableCryptographicHashing: this.config.enableCryptographicHashing,
        enableBlockchainIntegrity: this.config.enableBlockchainIntegrity,
        enableDigitalSignatures: this.config.enableDigitalSignatures,
        complianceMode: this.config.complianceMode,
        storageBackend: this.config.storageBackend
      }
    };
  }

  /**
   * Shutdown the provenance tracker
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down provenance tracker...');
      
      // Complete any active operations
      for (const [operationId, context] of this.activeOperations) {
        await this.recordError(operationId, new Error('System shutdown'));
      }
      
      // Save provenance data if using persistent storage
      await this._saveProvenance();
      
      // Clear in-memory state
      this.activeOperations.clear();
      this.entityLineage.clear();
      this.agentRegistry.clear();
      this.activityHistory = [];
      this.store.removeQuads(this.store.getQuads());
      
      this.state = 'shutdown';
      this.logger.success('Provenance tracker shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during provenance tracker shutdown:', error);
      throw error;
    }
  }

  // Private methods

  async _initializeStorage() {
    // Initialize storage backend based on configuration
    switch (this.config.storageBackend) {
      case 'memory':
        // Already using in-memory storage
        break;
      case 'file':
        await this._initializeFileStorage();
        break;
      case 'database':
        await this._initializeDatabaseStorage();
        break;
      default:
        throw new Error(`Unsupported storage backend: ${this.config.storageBackend}`);
    }
  }

  async _initializeFileStorage() {
    // Implementation for file-based storage
    this.logger.info('Initialized file-based provenance storage');
  }

  async _initializeDatabaseStorage() {
    // Implementation for database storage
    this.logger.info('Initialized database provenance storage');
  }

  async _registerSystemAgents() {
    // Register system agents
    const systemAgent = {
      id: 'kgen-system',
      uri: `${this.config.namespaces.kgen}agent/system`,
      type: 'software',
      name: 'kgen Knowledge Generation System',
      version: '1.0.0'
    };
    
    this.agentRegistry.set('system', systemAgent);
    
    // Record agent in RDF
    await this._recordAgent(systemAgent);
  }

  async _loadExistingProvenance() {
    // Load existing provenance data if available
    if (this.config.storageBackend !== 'memory') {
      // Implementation for loading from persistent storage
    }
  }

  async _identifyAgent(user) {
    if (!user) {
      return this.agentRegistry.get('system');
    }
    
    // Check if agent is already registered
    let agent = this.agentRegistry.get(user.id || user.username);
    
    if (!agent) {
      // Register new agent
      agent = {
        id: user.id || user.username,
        uri: `${this.config.namespaces.kgen}agent/${user.id || user.username}`,
        type: 'person',
        name: user.name || user.username,
        email: user.email
      };
      
      this.agentRegistry.set(agent.id, agent);
      await this._recordAgent(agent);
    }
    
    return agent;
  }

  async _recordActivityStart(context) {
    // Record activity start in PROV-O format
    const activityTriples = [
      {
        subject: context.activityUri,
        predicate: 'rdf:type',
        object: 'prov:Activity'
      },
      {
        subject: context.activityUri,
        predicate: 'prov:startedAtTime',
        object: `"${context.startTime.toISOString()}"^^xsd:dateTime`
      },
      {
        subject: context.activityUri,
        predicate: 'prov:wasAssociatedWith',
        object: context.agent.uri
      },
      {
        subject: context.activityUri,
        predicate: 'dct:type',
        object: `"${context.type}"`
      }
    ];
    
    for (const triple of activityTriples) {
      this.store.addQuad(
        triple.subject,
        triple.predicate,
        triple.object
      );
    }
  }

  async _recordInputEntities(context, sources) {
    // Record input entities and their usage
    for (const source of sources) {
      const entityUri = `${this.config.namespaces.kgen}entity/${source.id || source.name}`;
      
      // Record entity
      this.store.addQuad(
        entityUri,
        'rdf:type',
        'prov:Entity'
      );
      
      // Record usage
      const usageUri = `${this.config.namespaces.kgen}usage/${context.operationId}_${source.id}`;
      this.store.addQuad(usageUri, 'rdf:type', 'prov:Usage');
      this.store.addQuad(usageUri, 'prov:activity', context.activityUri);
      this.store.addQuad(usageUri, 'prov:entity', entityUri);
    }
  }

  async _recordActivityCompletion(context) {
    // Record activity completion
    this.store.addQuad(
      context.activityUri,
      'prov:endedAtTime',
      `"${context.endTime.toISOString()}"^^xsd:dateTime`
    );
    
    this.store.addQuad(
      context.activityUri,
      'kgen:status',
      `"${context.status}"`
    );
    
    if (context.duration) {
      this.store.addQuad(
        context.activityUri,
        'kgen:duration',
        `"${context.duration}"^^xsd:integer`
      );
    }
  }

  async _recordOutputEntities(context, outputGraph) {
    // Record output entities and their generation
    if (outputGraph.entities) {
      for (const entity of outputGraph.entities) {
        const entityUri = `${this.config.namespaces.kgen}entity/${entity.id}`;
        
        // Record entity
        this.store.addQuad(entityUri, 'rdf:type', 'prov:Entity');
        
        // Record generation
        const generationUri = `${this.config.namespaces.kgen}generation/${context.operationId}_${entity.id}`;
        this.store.addQuad(generationUri, 'rdf:type', 'prov:Generation');
        this.store.addQuad(generationUri, 'prov:activity', context.activityUri);
        this.store.addQuad(generationUri, 'prov:entity', entityUri);
      }
    }
  }

  async _recordTransformations(context) {
    // Record transformations and derivations
    if (context.inputs && context.outputs) {
      // Implementation for recording data transformations
    }
  }

  async _recordIntegrityHash(context) {
    // Record cryptographic hash for integrity
    if (context.integrityHash) {
      this.store.addQuad(
        context.activityUri,
        'kgen:integrityHash',
        `"${context.integrityHash}"`
      );
    }
  }

  async _recordActivityError(context) {
    // Record activity error
    this.store.addQuad(
      context.activityUri,
      'prov:endedAtTime',
      `"${context.endTime.toISOString()}"^^xsd:dateTime`
    );
    
    this.store.addQuad(
      context.activityUri,
      'kgen:status',
      '"error"'
    );
    
    if (context.error) {
      this.store.addQuad(
        context.activityUri,
        'kgen:errorMessage',
        `"${context.error.message}"`
      );
    }
  }

  async _recordAgent(agent) {
    // Record agent in RDF
    this.store.addQuad(agent.uri, 'rdf:type', 'prov:Agent');
    this.store.addQuad(agent.uri, 'foaf:name', `"${agent.name}"`);
    
    if (agent.type === 'person') {
      this.store.addQuad(agent.uri, 'rdf:type', 'prov:Person');
      if (agent.email) {
        this.store.addQuad(agent.uri, 'foaf:mbox', `mailto:${agent.email}`);
      }
    } else if (agent.type === 'software') {
      this.store.addQuad(agent.uri, 'rdf:type', 'prov:SoftwareAgent');
      if (agent.version) {
        this.store.addQuad(agent.uri, 'kgen:version', `"${agent.version}"`);
      }
    }
  }

  async _recordEntityLineage(lineageRecord) {
    // Record entity lineage in RDF
    for (const source of lineageRecord.sources) {
      this.store.addQuad(
        lineageRecord.entityUri,
        'prov:wasDerivedFrom',
        `${this.config.namespaces.kgen}entity/${source.id}`
      );
    }
  }

  async _generateIntegrityHash(context) {
    // Generate cryptographic hash for integrity verification
    const contextData = {
      operationId: context.operationId,
      type: context.type,
      startTime: context.startTime,
      endTime: context.endTime,
      inputs: context.inputs,
      outputs: context.outputs,
      agent: context.agent?.id
    };
    
    const contextString = JSON.stringify(contextData, Object.keys(contextData).sort());
    return crypto.createHash(this.config.hashAlgorithm).update(contextString).digest('hex');
  }

  async _generateProvenanceRecord(context) {
    // Generate comprehensive provenance record
    return {
      operationId: context.operationId,
      type: context.type,
      agent: context.agent,
      startTime: context.startTime,
      endTime: context.endTime,
      duration: context.duration,
      status: context.status,
      inputs: context.inputs,
      outputs: context.outputs,
      metrics: context.metrics,
      integrityHash: context.integrityHash,
      provenanceTriples: this._extractActivityTriples(context.activityUri)
    };
  }

  _extractActivityTriples(activityUri) {
    // Extract RDF triples related to specific activity
    return this.store.getQuads(activityUri, null, null);
  }

  async _getUpstreamLineage(entityId, maxDepth) {
    // Get upstream lineage (recursive)
    const upstream = [];
    // Implementation for upstream lineage traversal
    return upstream;
  }

  async _getDownstreamLineage(entityId, maxDepth) {
    // Get downstream lineage (recursive)
    const downstream = [];
    // Implementation for downstream lineage traversal
    return downstream;
  }

  async _buildLineageGraph(entityId, options) {
    // Build complete lineage graph
    return {
      nodes: [],
      edges: [],
      metadata: {}
    };
  }

  _groupActivitiesByAgent(activities) {
    const grouped = new Map();
    
    for (const activity of activities) {
      const agentId = activity.agent?.id || 'unknown';
      if (!grouped.has(agentId)) {
        grouped.set(agentId, []);
      }
      grouped.get(agentId).push(activity);
    }
    
    return Object.fromEntries(grouped);
  }

  _generateAuditStatistics(activities) {
    return {
      totalActivities: activities.length,
      successfulActivities: activities.filter(a => a.status === 'success').length,
      failedActivities: activities.filter(a => a.status === 'error').length,
      averageDuration: activities.reduce((sum, a) => sum + (a.duration || 0), 0) / activities.length,
      activityTypes: this._countByProperty(activities, 'type'),
      agentActivity: this._countByProperty(activities, 'agent.id')
    };
  }

  _countByProperty(activities, property) {
    const counts = {};
    for (const activity of activities) {
      const value = this._getNestedProperty(activity, property) || 'unknown';
      counts[value] = (counts[value] || 0) + 1;
    }
    return counts;
  }

  _getNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  async _detectAuditAnomalies(activities) {
    // Detect anomalies in audit trail
    const anomalies = [];
    // Implementation for anomaly detection
    return anomalies;
  }

  async _verifyAuditIntegrity(activities) {
    // Verify integrity of audit trail
    const verificationResult = await this.verifyIntegrity(activities);
    return verificationResult.integrityScore > 0.95;
  }

  async _exportAsTurtle(options) {
    // Export provenance as Turtle format
    return this.writer.quadsToString(this.store.getQuads());
  }

  async _exportAsJsonLD(options) {
    // Export provenance as JSON-LD format
    return JSON.stringify({ '@context': this.config.namespaces, '@graph': [] }, null, 2);
  }

  async _exportAsRDFXML(options) {
    // Export provenance as RDF/XML format
    return '<rdf:RDF></rdf:RDF>';
  }

  async _exportAsJSON(options) {
    // Export provenance as JSON format
    return JSON.stringify({
      activities: this.activityHistory,
      entityLineage: Object.fromEntries(this.entityLineage),
      agents: Object.fromEntries(this.agentRegistry)
    }, null, 2);
  }

  async _saveProvenance() {
    // Save provenance data based on storage backend
    if (this.config.storageBackend !== 'memory') {
      await this.storage.store('provenance-state', {
        activityHistory: this.activityHistory,
        entityLineage: Object.fromEntries(this.entityLineage),
        agentRegistry: Object.fromEntries(this.agentRegistry),
        hashChain: this.hashChain,
        digitalSignatures: Object.fromEntries(this.digitalSignatures),
        metrics: this.metrics
      });
    }
  }

  // Enhanced provenance methods

  /**
   * Execute SPARQL query on provenance data
   * @param {string} query - SPARQL query string
   * @param {Object} options - Query options
   */
  async executeQuery(query, options = {}) {
    try {
      this.metrics.queriesExecuted++;
      const results = await this.queryEngine.executeQuery(query, options);
      
      await this.complianceLogger.logComplianceEvent('sparql_query', {
        query: query.length > 500 ? `${query.slice(0, 500)}...` : query,
        resultCount: results.results?.bindings?.length || 0
      });
      
      return results;
    } catch (error) {
      this.logger.error('Failed to execute SPARQL query:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive entity lineage using SPARQL
   * @param {string} entityId - Entity identifier
   * @param {Object} options - Lineage options
   */
  async getAdvancedEntityLineage(entityId, options = {}) {
    try {
      const entityUri = `${this.config.namespaces.kgen}entity/${entityId}`;
      const lineage = await this.queryEngine.getEntityLineage(entityUri, options);
      
      // Add impact analysis
      if (options.includeImpactAnalysis) {
        lineage.impactAnalysis = await this._analyzeEntityImpact(entityId);
      }
      
      // Add compliance information
      if (options.includeCompliance) {
        lineage.compliance = await this._getEntityComplianceInfo(entityId);
      }
      
      return lineage;
    } catch (error) {
      this.logger.error(`Failed to get advanced lineage for ${entityId}:`, error);
      throw error;
    }
  }

  /**
   * Verify hash chain integrity
   * @returns {Promise<Object>} Chain verification result
   */
  async verifyHashChain() {
    try {
      this.logger.info('Verifying hash chain integrity');
      
      const verificationResult = {
        totalLinks: this.hashChain.length,
        validLinks: 0,
        brokenLinks: [],
        integrityScore: 0
      };
      
      for (let i = 1; i < this.hashChain.length; i++) {
        const currentLink = this.hashChain[i];
        const previousLink = this.hashChain[i - 1];
        
        if (currentLink.previousHash === previousLink.hash) {
          verificationResult.validLinks++;
        } else {
          verificationResult.brokenLinks.push({
            index: i,
            expected: previousLink.hash,
            actual: currentLink.previousHash,
            operationId: currentLink.operationId
          });
        }
      }
      
      verificationResult.integrityScore = this.hashChain.length > 0 ?
        verificationResult.validLinks / Math.max(1, this.hashChain.length - 1) : 1;
      
      this.metrics.integrityVerifications++;
      
      await this.complianceLogger.logComplianceEvent('chain_verification', {
        totalLinks: verificationResult.totalLinks,
        validLinks: verificationResult.validLinks,
        brokenLinks: verificationResult.brokenLinks.length,
        integrityScore: verificationResult.integrityScore
      });
      
      return verificationResult;
      
    } catch (error) {
      this.logger.error('Failed to verify hash chain:', error);
      throw error;
    }
  }

  /**
   * Generate compliance report using SPARQL queries
   * @param {string} regulation - Regulation type (GDPR, SOX, HIPAA)
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async generateComplianceReport(regulation, startDate, endDate) {
    try {
      this.logger.info(`Generating ${regulation} compliance report`);
      
      const report = await this.queryEngine.generateComplianceQuery(regulation, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      // Add additional compliance information
      const complianceReport = await this.complianceLogger.generateComplianceReport(
        startDate, 
        endDate, 
        { includeRecommendations: true }
      );
      
      const combinedReport = {
        ...report,
        complianceAnalysis: complianceReport,
        blockchainAnchorage: this.blockchain ? await this._getBlockchainAnchorageInfo(startDate, endDate) : null,
        integrityVerification: await this.verifyIntegrity(),
        chainIntegrity: await this.verifyHashChain()
      };
      
      // Store report
      await this.storage.store(`compliance-report-${regulation}-${Date.now()}`, combinedReport);
      
      return combinedReport;
      
    } catch (error) {
      this.logger.error(`Failed to generate ${regulation} compliance report:`, error);
      throw error;
    }
  }

  /**
   * Analyze change impact for entity
   * @param {string} entityId - Entity identifier
   * @param {Object} proposedChanges - Proposed changes
   */
  async analyzeChangeImpact(entityId, proposedChanges) {
    try {
      this.logger.info(`Analyzing change impact for entity: ${entityId}`);
      
      // Get entity lineage
      const lineage = await this.getAdvancedEntityLineage(entityId, {
        includeDownstream: true,
        maxDepth: 5
      });
      
      // Analyze affected entities
      const affectedEntities = new Set();
      const affectedActivities = new Set();
      const affectedAgents = new Set();
      
      // Process downstream lineage
      for (const item of lineage.downstreamLineage) {
        if (item.relatedEntity) affectedEntities.add(item.relatedEntity);
        if (item.activity) affectedActivities.add(item.activity);
        if (item.agent) affectedAgents.add(item.agent);
      }
      
      const impact = {
        targetEntity: entityId,
        proposedChanges,
        affectedEntities: Array.from(affectedEntities),
        affectedActivities: Array.from(affectedActivities),
        affectedAgents: Array.from(affectedAgents),
        riskLevel: this._calculateRiskLevel(affectedEntities.size, affectedActivities.size),
        recommendations: this._generateChangeRecommendations(affectedEntities.size, proposedChanges),
        analyzedAt: new Date()
      };
      
      // Log compliance event
      await this.complianceLogger.logComplianceEvent('change_impact_analysis', {
        entityId,
        affectedEntities: impact.affectedEntities.length,
        riskLevel: impact.riskLevel
      });
      
      return impact;
      
    } catch (error) {
      this.logger.error(`Failed to analyze change impact for ${entityId}:`, error);
      throw error;
    }
  }

  /**
   * Get provenance visualization data
   * @param {Object} options - Visualization options
   */
  async getVisualizationData(options = {}) {
    try {
      const format = options.format || 'cytoscape';
      
      const nodes = [];
      const edges = [];
      
      // Add entity nodes
      for (const [entityId, lineage] of this.entityLineage) {
        nodes.push({
          data: {
            id: entityId,
            label: entityId,
            type: 'entity',
            lineage: lineage.sources.length + lineage.derivations.length
          }
        });
      }
      
      // Add activity nodes
      for (const activity of this.activityHistory) {
        nodes.push({
          data: {
            id: activity.operationId,
            label: activity.type,
            type: 'activity',
            status: activity.status,
            agent: activity.agent?.id
          }
        });
        
        // Add edges for inputs
        for (const input of activity.inputs || []) {
          edges.push({
            data: {
              id: `${input.id}-${activity.operationId}`,
              source: input.id,
              target: activity.operationId,
              type: 'used'
            }
          });
        }
        
        // Add edges for outputs
        for (const output of activity.outputs || []) {
          edges.push({
            data: {
              id: `${activity.operationId}-${output.id}`,
              source: activity.operationId,
              target: output.id,
              type: 'generated'
            }
          });
        }
      }
      
      // Add agent nodes
      for (const [agentId, agent] of this.agentRegistry) {
        nodes.push({
          data: {
            id: agentId,
            label: agent.name,
            type: 'agent',
            agentType: agent.type
          }
        });
      }
      
      const visualization = {
        format,
        nodes,
        edges,
        metadata: {
          totalEntities: this.entityLineage.size,
          totalActivities: this.activityHistory.length,
          totalAgents: this.agentRegistry.size,
          generatedAt: new Date()
        }
      };
      
      if (format === 'd3') {
        return this._convertToD3Format(visualization);
      } else if (format === 'graphviz') {
        return this._convertToGraphvizFormat(visualization);
      }
      
      return visualization;
      
    } catch (error) {
      this.logger.error('Failed to generate visualization data:', error);
      throw error;
    }
  }

  // Private methods for enhanced functionality

  async _initializeHashChain() {
    // Initialize hash chain with genesis block
    if (this.hashChain.length === 0) {
      const genesisBlock = {
        index: 0,
        timestamp: new Date(),
        operationId: 'genesis',
        previousHash: '0',
        hash: crypto.createHash(this.config.hashAlgorithm)
          .update('genesis-block')
          .digest('hex')
      };
      
      this.hashChain.push(genesisBlock);
    }
  }

  async _loadSignatureKeys() {
    try {
      if (this.config.keyPath && await fs.access(this.config.keyPath).then(() => true).catch(() => false)) {
        this.privateKey = await fs.readFile(this.config.keyPath, 'utf8');
        this.logger.info('Digital signature keys loaded');
      } else {
        this.logger.warn('Digital signature enabled but no keys found');
      }
    } catch (error) {
      this.logger.error('Failed to load signature keys:', error);
    }
  }

  async _startChainValidation() {
    setInterval(async () => {
      try {
        const result = await this.verifyHashChain();
        if (result.integrityScore < 0.95) {
          this.logger.warn('Hash chain integrity degraded:', result);
        }
      } catch (error) {
        this.logger.error('Chain validation failed:', error);
      }
    }, this.config.chainValidationInterval);
  }

  async _addToHashChain(context) {
    const previousBlock = this.hashChain[this.hashChain.length - 1];
    const newBlock = {
      index: this.hashChain.length,
      timestamp: context.endTime,
      operationId: context.operationId,
      previousHash: previousBlock.hash,
      data: {
        type: context.type,
        agent: context.agent?.id,
        integrityHash: context.integrityHash
      },
      hash: null
    };
    
    // Calculate block hash
    const blockString = JSON.stringify({
      index: newBlock.index,
      timestamp: newBlock.timestamp,
      operationId: newBlock.operationId,
      previousHash: newBlock.previousHash,
      data: newBlock.data
    }, Object.keys(newBlock).sort());
    
    newBlock.hash = crypto.createHash(this.config.hashAlgorithm)
      .update(blockString)
      .digest('hex');
    
    this.hashChain.push(newBlock);
  }

  async _generateDigitalSignature(context) {
    if (!this.privateKey) {
      throw new Error('Private key not available for digital signatures');
    }
    
    const dataToSign = JSON.stringify({
      operationId: context.operationId,
      integrityHash: context.integrityHash,
      timestamp: context.endTime
    });
    
    const sign = crypto.createSign(this.config.signatureAlgorithm);
    sign.update(dataToSign);
    return sign.sign(this.privateKey, 'hex');
  }

  async _createProvenanceBundle() {
    const bundleId = `bundle-${Date.now()}`;
    const bundleMembers = this.activityHistory.slice(-this.config.bundleSize);
    
    const bundle = {
      id: bundleId,
      type: 'prov:Bundle',
      strategy: this.config.bundleStrategy,
      members: bundleMembers.map(a => a.operationId),
      createdAt: new Date(),
      integrityHash: crypto.createHash(this.config.hashAlgorithm)
        .update(JSON.stringify(bundleMembers.map(a => a.integrityHash)))
        .digest('hex')
    };
    
    this.provBundles.set(bundleId, bundle);
    
    // Store bundle in RDF
    this.store.addQuad(
      `${this.config.namespaces.kgen}bundle/${bundleId}`,
      'rdf:type',
      'prov:Bundle'
    );
    
    this.logger.debug(`Created provenance bundle: ${bundleId}`);
  }

  async _analyzeEntityImpact(entityId) {
    // Analyze entity impact based on lineage
    const lineage = this.entityLineage.get(entityId);
    if (!lineage) return null;
    
    return {
      directDependencies: lineage.sources.length,
      directDependents: lineage.derivations.length,
      impactScore: (lineage.sources.length + lineage.derivations.length) / 10,
      criticalityLevel: this._calculateCriticalityLevel(lineage)
    };
  }

  async _getEntityComplianceInfo(entityId) {
    // Get compliance information for entity
    return {
      dataTypes: ['personal_data'], // Would be determined from entity analysis
      retentionPeriod: this.config.auditRetention,
      legalBases: ['legitimate_interest'],
      complianceFrameworks: this.config.complianceMode.split(',')
    };
  }

  async _getBlockchainAnchorageInfo(startDate, endDate) {
    if (!this.blockchain) return null;
    
    const stats = this.blockchain.getStatistics();
    return {
      totalAnchored: stats.totalAnchored,
      successfulAnchors: stats.successfulAnchors,
      failedAnchors: stats.failedAnchors,
      successRate: stats.successRate,
      network: stats.network
    };
  }

  _calculateRiskLevel(affectedEntities, affectedActivities) {
    const totalAffected = affectedEntities + affectedActivities;
    if (totalAffected > 50) return 'high';
    if (totalAffected > 20) return 'medium';
    return 'low';
  }

  _generateChangeRecommendations(affectedCount, changes) {
    const recommendations = [];
    
    if (affectedCount > 10) {
      recommendations.push('Consider phased implementation due to high impact');
      recommendations.push('Implement comprehensive testing strategy');
    }
    
    if (changes.includes('schema')) {
      recommendations.push('Validate data migration procedures');
    }
    
    return recommendations;
  }

  _calculateCriticalityLevel(lineage) {
    const totalConnections = lineage.sources.length + lineage.derivations.length;
    if (totalConnections > 20) return 'critical';
    if (totalConnections > 10) return 'high';
    if (totalConnections > 5) return 'medium';
    return 'low';
  }

  _convertToD3Format(visualization) {
    return {
      nodes: visualization.nodes.map(n => n.data),
      links: visualization.edges.map(e => ({
        source: e.data.source,
        target: e.data.target,
        type: e.data.type
      })),
      metadata: visualization.metadata
    };
  }

  _convertToGraphvizFormat(visualization) {
    let dot = 'digraph provenance {\n';
    dot += '  rankdir=TB;\n';
    
    // Add nodes
    for (const node of visualization.nodes) {
      const shape = node.data.type === 'entity' ? 'box' : 
                   node.data.type === 'activity' ? 'ellipse' : 'diamond';
      dot += `  "${node.data.id}" [label="${node.data.label}", shape=${shape}];\n`;
    }
    
    // Add edges
    for (const edge of visualization.edges) {
      dot += `  "${edge.data.source}" -> "${edge.data.target}" [label="${edge.data.type}"];\n`;
    }
    
    dot += '}';
    return dot;
  }
}

export default ProvenanceTracker;