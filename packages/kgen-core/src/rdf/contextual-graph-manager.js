/**
 * Contextual Graph Manager - Advanced provenance and metadata tracking
 * Implements PROV-O ontology with enterprise audit capabilities
 */

import { DataFactory } from 'n3';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { RDFStarProcessor } from './rdf-star-processor.js';
import { HashCalculator } from './hash-calculator.js';

const { namedNode, literal, blankNode, defaultGraph, quad } = DataFactory;

// PROV-O namespace constants
const PROV = {
  Entity: 'http://www.w3.org/ns/prov#Entity',
  Activity: 'http://www.w3.org/ns/prov#Activity', 
  Agent: 'http://www.w3.org/ns/prov#Agent',
  wasGeneratedBy: 'http://www.w3.org/ns/prov#wasGeneratedBy',
  used: 'http://www.w3.org/ns/prov#used',
  wasAssociatedWith: 'http://www.w3.org/ns/prov#wasAssociatedWith',
  wasAttributedTo: 'http://www.w3.org/ns/prov#wasAttributedTo',
  wasDerivedFrom: 'http://www.w3.org/ns/prov#wasDerivedFrom',
  wasInformedBy: 'http://www.w3.org/ns/prov#wasInformedBy',
  atTime: 'http://www.w3.org/ns/prov#atTime',
  hadPrimarySource: 'http://www.w3.org/ns/prov#hadPrimarySource'
};

export class ContextualGraphManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Provenance settings
      enableProvenance: config.enableProvenance !== false,
      enableVersioning: config.enableVersioning !== false,
      enableAuditTrail: config.enableAuditTrail !== false,
      
      // Context settings
      defaultContext: config.defaultContext || 'http://kgen.ai/context/default',
      autoGenerateIds: config.autoGenerateIds !== false,
      trackAllChanges: config.trackAllChanges !== false,
      
      // Performance settings
      maxContexts: config.maxContexts || 10000,
      maxVersionsPerContext: config.maxVersionsPerContext || 100,
      enableCompression: config.enableCompression !== false,
      
      // Security settings
      enableSignatures: config.enableSignatures || false,
      requireAuthentication: config.requireAuthentication || false,
      
      ...config
    };
    
    // Core components
    this.rdfStar = new RDFStarProcessor(config);
    this.hashCalculator = new HashCalculator(config);
    
    // Context storage
    this.contexts = new Map(); // contextId -> context data
    this.contextGraphs = new Map(); // contextId -> graph quads
    this.contextMetadata = new Map(); // contextId -> metadata
    
    // Versioning
    this.versions = new Map(); // contextId -> version history
    this.snapshots = new Map(); // versionId -> snapshot data
    
    // Provenance tracking
    this.provenanceGraph = new Map(); // entity -> provenance chains
    this.activities = new Map(); // activityId -> activity data
    this.agents = new Map(); // agentId -> agent data
    
    // Audit trail
    this.auditLog = [];
    this.changeLog = new Map(); // contextId -> changes
    
    // Indexes for fast lookup
    this.indexes = {
      byAgent: new Map(),
      byActivity: new Map(),
      byTimestamp: new Map(),
      byEntity: new Map(),
      byDerivation: new Map()
    };
    
    this.metrics = {
      contextsCreated: 0,
      versionsCreated: 0,
      provenanceEntriesAdded: 0,
      auditEventsLogged: 0,
      queriesExecuted: 0
    };
    
    this.status = 'initialized';
  }

  /**
   * Initialize the contextual graph manager
   */
  async initialize() {
    try {
      await this.rdfStar.initialize?.();
      
      // Setup periodic cleanup
      this._startCleanupProcess();
      
      // Setup audit trail logging
      if (this.config.enableAuditTrail) {
        this._setupAuditTrail();
      }
      
      this.status = 'ready';
      this.emit('initialized');
      
    } catch (error) {
      this.status = 'error';
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Create a new contextual graph with full provenance tracking
   */
  async createContext(contextData) {
    const contextId = contextData.id || this._generateContextId();
    
    // Validate context data
    this._validateContextData(contextData);
    
    // Create context metadata
    const metadata = {
      id: contextId,
      created: Date.now(),
      createdBy: contextData.createdBy || 'system',
      version: '1.0.0',
      description: contextData.description || '',
      tags: contextData.tags || [],
      properties: contextData.properties || {},
      hash: null, // Will be calculated after graph creation
      signature: null // Will be generated if signatures enabled
    };
    
    // Create empty graph for this context
    const contextGraph = [];
    
    // Store context
    this.contexts.set(contextId, {
      ...contextData,
      metadata
    });
    this.contextGraphs.set(contextId, contextGraph);
    this.contextMetadata.set(contextId, metadata);
    
    // Initialize versioning if enabled
    if (this.config.enableVersioning) {
      this.versions.set(contextId, [{
        version: '1.0.0',
        timestamp: Date.now(),
        hash: null,
        changes: [],
        snapshot: null
      }]);
    }
    
    // Initialize change tracking
    if (this.config.trackAllChanges) {
      this.changeLog.set(contextId, []);
    }
    
    // Create provenance entities
    if (this.config.enableProvenance) {
      await this._createProvenanceForContext(contextId, contextData);
    }
    
    // Log audit event
    this._logAuditEvent({
      type: 'context_created',
      contextId,
      timestamp: Date.now(),
      actor: contextData.createdBy || 'system',
      details: { description: contextData.description }
    });
    
    this.metrics.contextsCreated++;
    this.emit('context-created', { contextId, metadata });
    
    return contextId;
  }

  /**
   * Add statement to context with full provenance tracking
   */
  async addStatement(contextId, subject, predicate, object, provenanceData = {}) {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }
    
    // Create the base statement
    const statement = quad(
      this._termFromValue(subject),
      this._termFromValue(predicate),
      this._termFromValue(object),
      namedNode(contextId)
    );
    
    // Add to context graph
    const contextGraph = this.contextGraphs.get(contextId);
    contextGraph.push(statement);
    
    // Create contextual statement with RDF*
    const contextualStatement = await this.rdfStar.createContextualStatement(
      statement.subject,
      statement.predicate,
      statement.object,
      {
        graph: namedNode(contextId),
        timestamp: new Date(),
        source: provenanceData.source || 'user',
        confidence: provenanceData.confidence || 1.0,
        metadata: {
          contextId,
          addedBy: provenanceData.addedBy || 'system',
          ...provenanceData.metadata
        },
        provenance: provenanceData
      }
    );
    
    // Track change if enabled
    if (this.config.trackAllChanges) {
      const change = {
        id: this._generateId(),
        type: 'statement_added',
        timestamp: Date.now(),
        statement: this._serializeQuad(statement),
        provenance: provenanceData,
        context: contextId
      };
      
      this.changeLog.get(contextId).push(change);
    }
    
    // Update context metadata
    await this._updateContextMetadata(contextId);
    
    // Create version if enabled
    if (this.config.enableVersioning) {
      await this._createVersion(contextId, [change]);
    }
    
    // Create provenance chain
    if (this.config.enableProvenance && provenanceData.activity) {
      await this._addToProvenanceChain(statement, provenanceData);
    }
    
    // Log audit event
    this._logAuditEvent({
      type: 'statement_added',
      contextId,
      timestamp: Date.now(),
      actor: provenanceData.addedBy || 'system',
      details: {
        subject: subject.value || subject,
        predicate: predicate.value || predicate,
        object: object.value || object
      }
    });
    
    this.emit('statement-added', { contextId, statement, contextualStatement });
    
    return contextualStatement;
  }

  /**
   * Remove statement from context with provenance tracking
   */
  async removeStatement(contextId, subject, predicate, object, provenanceData = {}) {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }
    
    const contextGraph = this.contextGraphs.get(contextId);
    const statementToRemove = contextGraph.find(q => 
      this._quadsEqual(q, {
        subject: this._termFromValue(subject),
        predicate: this._termFromValue(predicate),
        object: this._termFromValue(object)
      })
    );
    
    if (!statementToRemove) {
      throw new Error('Statement not found in context');
    }
    
    // Remove from context graph
    const index = contextGraph.indexOf(statementToRemove);
    contextGraph.splice(index, 1);
    
    // Track change if enabled
    if (this.config.trackAllChanges) {
      const change = {
        id: this._generateId(),
        type: 'statement_removed',
        timestamp: Date.now(),
        statement: this._serializeQuad(statementToRemove),
        provenance: provenanceData,
        context: contextId
      };
      
      this.changeLog.get(contextId).push(change);
      
      // Create version if enabled
      if (this.config.enableVersioning) {
        await this._createVersion(contextId, [change]);
      }
    }
    
    // Update context metadata
    await this._updateContextMetadata(contextId);
    
    // Log audit event
    this._logAuditEvent({
      type: 'statement_removed',
      contextId,
      timestamp: Date.now(),
      actor: provenanceData.removedBy || 'system',
      details: {
        subject: subject.value || subject,
        predicate: predicate.value || predicate,
        object: object.value || object
      }
    });
    
    this.emit('statement-removed', { contextId, statement: statementToRemove });
    
    return true;
  }

  /**
   * Query context with advanced filtering
   */
  async queryContext(contextId, pattern = {}, options = {}) {
    const contextGraph = this.contextGraphs.get(contextId);
    if (!contextGraph) {
      throw new Error(`Context ${contextId} not found`);
    }
    
    let results = contextGraph;
    
    // Apply pattern matching
    if (Object.keys(pattern).length > 0) {
      results = results.filter(quad => this._matchesPattern(quad, pattern));
    }
    
    // Apply filters
    if (options.filters) {
      for (const filter of options.filters) {
        results = results.filter(filter);
      }
    }
    
    // Apply sorting
    if (options.orderBy) {
      results = this._sortResults(results, options.orderBy);
    }
    
    // Apply pagination
    if (options.limit || options.offset) {
      const offset = options.offset || 0;
      const limit = options.limit || results.length;
      results = results.slice(offset, offset + limit);
    }
    
    // Include annotations if requested
    if (options.includeAnnotations) {
      results = await this._enrichWithAnnotations(results);
    }
    
    // Include provenance if requested
    if (options.includeProvenance) {
      results = await this._enrichWithProvenance(results);
    }
    
    this.metrics.queriesExecuted++;
    
    return {
      results,
      total: contextGraph.length,
      returned: results.length,
      context: contextId,
      timestamp: Date.now()
    };
  }

  /**
   * Get context version history
   */
  getVersionHistory(contextId) {
    const versions = this.versions.get(contextId);
    if (!versions) {
      throw new Error(`Context ${contextId} not found or versioning not enabled`);
    }
    
    return versions.map(version => ({
      version: version.version,
      timestamp: version.timestamp,
      hash: version.hash,
      changes: version.changes.length,
      hasSnapshot: !!version.snapshot
    }));
  }

  /**
   * Restore context to specific version
   */
  async restoreVersion(contextId, targetVersion) {
    const versions = this.versions.get(contextId);
    if (!versions) {
      throw new Error(`Context ${contextId} not found or versioning not enabled`);
    }
    
    const version = versions.find(v => v.version === targetVersion);
    if (!version) {
      throw new Error(`Version ${targetVersion} not found`);
    }
    
    // Load snapshot if available
    if (version.snapshot) {
      const snapshot = this.snapshots.get(version.snapshot);
      if (snapshot) {
        this.contextGraphs.set(contextId, [...snapshot.graph]);
        this.contextMetadata.set(contextId, { ...snapshot.metadata });
        
        // Update context metadata
        await this._updateContextMetadata(contextId);
        
        // Log audit event
        this._logAuditEvent({
          type: 'version_restored',
          contextId,
          timestamp: Date.now(),
          details: { targetVersion, method: 'snapshot' }
        });
        
        this.emit('version-restored', { contextId, version: targetVersion });
        return true;
      }
    }
    
    // Fallback: reconstruct from change log
    return this._reconstructFromChanges(contextId, targetVersion);
  }

  /**
   * Create context diff between versions
   */
  async createDiff(contextId, fromVersion, toVersion) {
    const versions = this.versions.get(contextId);
    if (!versions) {
      throw new Error(`Context ${contextId} not found or versioning not enabled`);
    }
    
    const fromIdx = versions.findIndex(v => v.version === fromVersion);
    const toIdx = versions.findIndex(v => v.version === toVersion);
    
    if (fromIdx === -1 || toIdx === -1) {
      throw new Error('One or both versions not found');
    }
    
    const changes = versions.slice(fromIdx + 1, toIdx + 1)
      .flatMap(v => v.changes);
    
    const added = changes.filter(c => c.type === 'statement_added');
    const removed = changes.filter(c => c.type === 'statement_removed');
    const modified = changes.filter(c => c.type === 'statement_modified');
    
    return {
      from: fromVersion,
      to: toVersion,
      changes: {
        added: added.length,
        removed: removed.length,
        modified: modified.length,
        total: changes.length
      },
      details: {
        added,
        removed,
        modified
      },
      timestamp: Date.now()
    };
  }

  /**
   * Get provenance chain for entity
   */
  getProvenanceChain(entityId, options = {}) {
    const chain = this.provenanceGraph.get(entityId);
    if (!chain) {
      return { entity: entityId, chain: [], depth: 0 };
    }
    
    const depth = options.maxDepth || 10;
    const visited = new Set();
    
    const buildChain = (entity, currentDepth = 0) => {
      if (currentDepth >= depth || visited.has(entity)) {
        return [];
      }
      
      visited.add(entity);
      const provenance = this.provenanceGraph.get(entity);
      
      if (!provenance) {
        return [];
      }
      
      const chainEntry = {
        entity,
        activity: provenance.activity,
        agent: provenance.agent,
        timestamp: provenance.timestamp,
        derivedFrom: provenance.derivedFrom || [],
        depth: currentDepth
      };
      
      // Recursively build chain for derived entities
      const derivedChains = provenance.derivedFrom
        .map(derived => buildChain(derived, currentDepth + 1))
        .flat();
      
      return [chainEntry, ...derivedChains];
    };
    
    const fullChain = buildChain(entityId);
    
    return {
      entity: entityId,
      chain: fullChain,
      depth: Math.max(...fullChain.map(c => c.depth), 0) + 1,
      totalEntities: fullChain.length
    };
  }

  /**
   * Get audit trail for context or system
   */
  getAuditTrail(options = {}) {
    let trail = [...this.auditLog];
    
    // Filter by context if specified
    if (options.contextId) {
      trail = trail.filter(event => event.contextId === options.contextId);
    }
    
    // Filter by actor if specified
    if (options.actor) {
      trail = trail.filter(event => event.actor === options.actor);
    }
    
    // Filter by time range if specified
    if (options.from || options.to) {
      const fromTime = options.from ? new Date(options.from).getTime() : 0;
      const toTime = options.to ? new Date(options.to).getTime() : Date.now();
      
      trail = trail.filter(event => 
        event.timestamp >= fromTime && event.timestamp <= toTime
      );
    }
    
    // Filter by event type if specified
    if (options.eventTypes) {
      const types = Array.isArray(options.eventTypes) ? options.eventTypes : [options.eventTypes];
      trail = trail.filter(event => types.includes(event.type));
    }
    
    // Apply sorting
    trail.sort((a, b) => {
      const direction = options.order === 'asc' ? 1 : -1;
      return (a.timestamp - b.timestamp) * direction;
    });
    
    // Apply pagination
    if (options.limit || options.offset) {
      const offset = options.offset || 0;
      const limit = options.limit || trail.length;
      trail = trail.slice(offset, offset + limit);
    }
    
    return {
      events: trail,
      total: this.auditLog.length,
      filtered: trail.length,
      timestamp: Date.now()
    };
  }

  /**
   * Export contextual graph with full metadata
   */
  async exportContext(contextId, options = {}) {
    const context = this.contexts.get(contextId);
    const contextGraph = this.contextGraphs.get(contextId);
    const metadata = this.contextMetadata.get(contextId);
    
    if (!context || !contextGraph || !metadata) {
      throw new Error(`Context ${contextId} not found`);
    }
    
    const exportData = {
      context: {
        id: contextId,
        metadata,
        properties: context.properties || {}
      },
      graph: {
        quads: contextGraph.map(q => this._serializeQuadForExport(q)),
        count: contextGraph.length
      },
      annotations: {},
      provenance: {},
      versions: [],
      auditTrail: [],
      exported: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        format: 'kgen-contextual-graph-v1'
      }
    };
    
    // Include RDF* annotations if requested
    if (options.includeAnnotations) {
      exportData.annotations = await this.rdfStar.exportContextualGraph();
    }
    
    // Include provenance chains if requested
    if (options.includeProvenance) {
      for (const quad of contextGraph) {
        const entityId = quad.subject.value;
        const provenance = this.getProvenanceChain(entityId, options.provenance);
        if (provenance.chain.length > 0) {
          exportData.provenance[entityId] = provenance;
        }
      }
    }
    
    // Include version history if requested
    if (options.includeVersions) {
      const versions = this.versions.get(contextId);
      if (versions) {
        exportData.versions = versions.map(v => ({
          version: v.version,
          timestamp: v.timestamp,
          hash: v.hash,
          changes: v.changes
        }));
      }
    }
    
    // Include audit trail if requested
    if (options.includeAuditTrail) {
      exportData.auditTrail = this.getAuditTrail({
        contextId,
        ...options.auditTrail
      }).events;
    }
    
    return exportData;
  }

  /**
   * Import contextual graph
   */
  async importContext(importData, options = {}) {
    if (importData.exported?.format !== 'kgen-contextual-graph-v1') {
      throw new Error('Unsupported import format');
    }
    
    const contextId = importData.context.id;
    
    // Check if context exists
    if (this.contexts.has(contextId) && !options.overwrite) {
      throw new Error(`Context ${contextId} already exists. Use overwrite option to replace.`);
    }
    
    // Import context data
    this.contexts.set(contextId, {
      id: contextId,
      ...importData.context.properties
    });
    
    this.contextMetadata.set(contextId, importData.context.metadata);
    
    // Import graph quads
    const contextGraph = importData.graph.quads.map(q => this._deserializeQuad(q));
    this.contextGraphs.set(contextId, contextGraph);
    
    // Import annotations if present
    if (importData.annotations && Object.keys(importData.annotations).length > 0) {
      await this.rdfStar.importContextualGraph(importData.annotations);
    }
    
    // Import provenance chains if present
    if (importData.provenance) {
      for (const [entityId, provenance] of Object.entries(importData.provenance)) {
        this.provenanceGraph.set(entityId, provenance);
      }
    }
    
    // Import version history if present
    if (importData.versions && importData.versions.length > 0) {
      this.versions.set(contextId, importData.versions);
    }
    
    // Import audit trail if present and merge option is enabled
    if (importData.auditTrail && options.mergeAuditTrail) {
      this.auditLog.push(...importData.auditTrail);
      this.auditLog.sort((a, b) => a.timestamp - b.timestamp);
    }
    
    // Rebuild indexes
    await this._rebuildIndexes();
    
    // Log import event
    this._logAuditEvent({
      type: 'context_imported',
      contextId,
      timestamp: Date.now(),
      details: {
        quads: importData.graph.count,
        versions: importData.versions?.length || 0,
        auditEvents: importData.auditTrail?.length || 0
      }
    });
    
    this.emit('context-imported', { contextId, data: importData });
    
    return contextId;
  }

  /**
   * Get comprehensive statistics
   */
  getStatistics() {
    const memUsage = process.memoryUsage();
    
    const contextStats = Array.from(this.contexts.values()).reduce((acc, ctx) => {
      const graph = this.contextGraphs.get(ctx.id);
      acc.totalQuads += graph ? graph.length : 0;
      acc.averageQuadsPerContext = acc.totalQuads / this.contexts.size;
      return acc;
    }, { totalQuads: 0, averageQuadsPerContext: 0 });
    
    return {
      contexts: {
        total: this.contexts.size,
        totalQuads: contextStats.totalQuads,
        averageQuadsPerContext: Math.round(contextStats.averageQuadsPerContext)
      },
      versions: {
        totalVersions: Array.from(this.versions.values()).reduce((sum, v) => sum + v.length, 0),
        totalSnapshots: this.snapshots.size
      },
      provenance: {
        entities: this.provenanceGraph.size,
        activities: this.activities.size,
        agents: this.agents.size
      },
      audit: {
        totalEvents: this.auditLog.length,
        changeEntries: Array.from(this.changeLog.values()).reduce((sum, c) => sum + c.length, 0)
      },
      performance: {
        ...this.metrics,
        rdfStarStats: this.rdfStar.getStatistics()
      },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      }
    };
  }

  // Private methods

  _generateContextId() {
    return 'ctx_' + crypto.randomBytes(16).toString('hex');
  }

  _generateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  _validateContextData(contextData) {
    if (!contextData) {
      throw new Error('Context data is required');
    }
    
    if (contextData.id && typeof contextData.id !== 'string') {
      throw new Error('Context ID must be a string');
    }
  }

  _termFromValue(value) {
    if (typeof value === 'string') {
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return namedNode(value);
      } else if (value.startsWith('_:')) {
        return blankNode(value.substring(2));
      } else {
        return literal(value);
      }
    }
    return value;
  }

  _quadsEqual(a, b) {
    return a.subject.equals && a.subject.equals(b.subject) &&
           a.predicate.equals && a.predicate.equals(b.predicate) &&
           a.object.equals && a.object.equals(b.object);
  }

  _matchesPattern(quad, pattern) {
    if (pattern.subject && !this._termMatches(quad.subject, pattern.subject)) {
      return false;
    }
    if (pattern.predicate && !this._termMatches(quad.predicate, pattern.predicate)) {
      return false;
    }
    if (pattern.object && !this._termMatches(quad.object, pattern.object)) {
      return false;
    }
    return true;
  }

  _termMatches(term, pattern) {
    if (typeof pattern === 'string') {
      return term.value === pattern;
    }
    return term.equals && term.equals(pattern);
  }

  _serializeQuad(quad) {
    return {
      subject: this._serializeTerm(quad.subject),
      predicate: this._serializeTerm(quad.predicate),
      object: this._serializeTerm(quad.object),
      graph: this._serializeTerm(quad.graph)
    };
  }

  _serializeQuadForExport(quad) {
    return this._serializeQuad(quad);
  }

  _deserializeQuad(quadData) {
    return quad(
      this._deserializeTerm(quadData.subject),
      this._deserializeTerm(quadData.predicate),
      this._deserializeTerm(quadData.object),
      this._deserializeTerm(quadData.graph)
    );
  }

  _serializeTerm(term) {
    if (term.termType === 'NamedNode') {
      return { type: 'NamedNode', value: term.value };
    } else if (term.termType === 'Literal') {
      return {
        type: 'Literal',
        value: term.value,
        language: term.language,
        datatype: term.datatype?.value
      };
    } else if (term.termType === 'BlankNode') {
      return { type: 'BlankNode', value: term.value };
    } else if (term.termType === 'DefaultGraph') {
      return { type: 'DefaultGraph' };
    }
    return { type: 'Unknown', value: term.value };
  }

  _deserializeTerm(termData) {
    switch (termData.type) {
      case 'NamedNode':
        return namedNode(termData.value);
      case 'Literal':
        return literal(
          termData.value,
          termData.language || (termData.datatype ? namedNode(termData.datatype) : undefined)
        );
      case 'BlankNode':
        return blankNode(termData.value);
      case 'DefaultGraph':
        return defaultGraph();
      default:
        throw new Error(`Unknown term type: ${termData.type}`);
    }
  }

  async _updateContextMetadata(contextId) {
    const metadata = this.contextMetadata.get(contextId);
    const contextGraph = this.contextGraphs.get(contextId);
    
    if (metadata && contextGraph) {
      metadata.lastModified = Date.now();
      metadata.tripleCount = contextGraph.length;
      metadata.hash = await this.hashCalculator.calculateGraphHash(contextGraph);
      
      // Generate signature if enabled
      if (this.config.enableSignatures) {
        metadata.signature = await this._generateSignature(contextId, metadata.hash);
      }
    }
  }

  async _createVersion(contextId, changes) {
    const versions = this.versions.get(contextId);
    if (!versions) return;
    
    const currentVersion = versions[versions.length - 1];
    const nextVersion = this._incrementVersion(currentVersion.version);
    
    const contextGraph = this.contextGraphs.get(contextId);
    const hash = await this.hashCalculator.calculateGraphHash(contextGraph);
    
    const newVersion = {
      version: nextVersion,
      timestamp: Date.now(),
      hash,
      changes: [...changes],
      snapshot: null
    };
    
    // Create snapshot if version count is multiple of 10
    if (versions.length % 10 === 0) {
      const snapshotId = this._generateId();
      this.snapshots.set(snapshotId, {
        id: snapshotId,
        contextId,
        version: nextVersion,
        graph: [...contextGraph],
        metadata: { ...this.contextMetadata.get(contextId) },
        timestamp: Date.now()
      });
      newVersion.snapshot = snapshotId;
    }
    
    versions.push(newVersion);
    
    // Cleanup old versions if needed
    if (versions.length > this.config.maxVersionsPerContext) {
      const removed = versions.shift();
      if (removed.snapshot) {
        this.snapshots.delete(removed.snapshot);
      }
    }
    
    this.metrics.versionsCreated++;
  }

  _incrementVersion(version) {
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1;
    return parts.join('.');
  }

  async _createProvenanceForContext(contextId, contextData) {
    const activity = {
      id: 'activity_' + this._generateId(),
      type: PROV.Activity,
      startedAtTime: Date.now(),
      endedAtTime: null,
      wasAssociatedWith: contextData.createdBy || 'system',
      used: contextData.sources || [],
      generated: [contextId]
    };
    
    this.activities.set(activity.id, activity);
    
    const provenance = {
      entity: contextId,
      activity: activity.id,
      agent: contextData.createdBy || 'system',
      timestamp: Date.now(),
      wasGeneratedBy: activity.id,
      derivedFrom: contextData.derivedFrom || []
    };
    
    this.provenanceGraph.set(contextId, provenance);
    this.metrics.provenanceEntriesAdded++;
  }

  async _addToProvenanceChain(statement, provenanceData) {
    const entityId = statement.subject.value;
    
    const provenance = {
      entity: entityId,
      activity: provenanceData.activity,
      agent: provenanceData.agent || 'system',
      timestamp: Date.now(),
      wasGeneratedBy: provenanceData.activity,
      derivedFrom: provenanceData.derivedFrom || [],
      used: provenanceData.used || [],
      wasInformedBy: provenanceData.wasInformedBy || []
    };
    
    this.provenanceGraph.set(entityId, provenance);
    this.metrics.provenanceEntriesAdded++;
  }

  _logAuditEvent(event) {
    if (!this.config.enableAuditTrail) return;
    
    const auditEvent = {
      id: this._generateId(),
      ...event,
      timestamp: event.timestamp || Date.now()
    };
    
    this.auditLog.push(auditEvent);
    this.metrics.auditEventsLogged++;
    
    this.emit('audit-event', auditEvent);
  }

  _setupAuditTrail() {
    // Setup periodic cleanup of old audit events
    setInterval(() => {
      const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
      this.auditLog = this.auditLog.filter(event => event.timestamp > cutoffTime);
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  _startCleanupProcess() {
    // Periodic cleanup of expired data
    setInterval(() => {
      this._performCleanup();
    }, 60 * 60 * 1000); // Hourly cleanup
  }

  _performCleanup() {
    // Cleanup old versions beyond max limit
    for (const [contextId, versions] of this.versions) {
      if (versions.length > this.config.maxVersionsPerContext) {
        const toRemove = versions.splice(0, versions.length - this.config.maxVersionsPerContext);
        toRemove.forEach(version => {
          if (version.snapshot) {
            this.snapshots.delete(version.snapshot);
          }
        });
      }
    }
    
    // Cleanup contexts if over limit
    if (this.contexts.size > this.config.maxContexts) {
      const contexts = Array.from(this.contexts.keys());
      const toRemove = contexts.slice(0, this.contexts.size - this.config.maxContexts);
      
      toRemove.forEach(contextId => {
        this.contexts.delete(contextId);
        this.contextGraphs.delete(contextId);
        this.contextMetadata.delete(contextId);
        this.versions.delete(contextId);
        this.changeLog.delete(contextId);
      });
    }
  }

  async _rebuildIndexes() {
    // Clear existing indexes
    for (const index of Object.values(this.indexes)) {
      index.clear();
    }
    
    // Rebuild from current data
    for (const [entityId, provenance] of this.provenanceGraph) {
      if (provenance.agent) {
        if (!this.indexes.byAgent.has(provenance.agent)) {
          this.indexes.byAgent.set(provenance.agent, []);
        }
        this.indexes.byAgent.get(provenance.agent).push(entityId);
      }
      
      if (provenance.activity) {
        if (!this.indexes.byActivity.has(provenance.activity)) {
          this.indexes.byActivity.set(provenance.activity, []);
        }
        this.indexes.byActivity.get(provenance.activity).push(entityId);
      }
      
      const timestamp = Math.floor(provenance.timestamp / 1000);
      if (!this.indexes.byTimestamp.has(timestamp)) {
        this.indexes.byTimestamp.set(timestamp, []);
      }
      this.indexes.byTimestamp.get(timestamp).push(entityId);
    }
  }

  async _enrichWithAnnotations(results) {
    const enriched = [];
    
    for (const quad of results) {
      const quotedTriple = this.rdfStar.createQuotedTriple(
        quad.subject,
        quad.predicate,
        quad.object
      );
      
      const annotations = this.rdfStar.getAnnotations(quotedTriple);
      
      enriched.push({
        quad,
        annotations
      });
    }
    
    return enriched;
  }

  async _enrichWithProvenance(results) {
    const enriched = [];
    
    for (const quad of results) {
      const entityId = quad.subject.value;
      const provenance = this.getProvenanceChain(entityId, { maxDepth: 3 });
      
      enriched.push({
        quad,
        provenance
      });
    }
    
    return enriched;
  }

  _sortResults(results, orderBy) {
    return results.sort((a, b) => {
      switch (orderBy) {
        case 'subject':
          return a.subject.value.localeCompare(b.subject.value);
        case 'predicate':
          return a.predicate.value.localeCompare(b.predicate.value);
        case 'object':
          return a.object.value.localeCompare(b.object.value);
        default:
          return 0;
      }
    });
  }

  async _generateSignature(contextId, hash) {
    // Placeholder for digital signature generation
    // In production, would use proper cryptographic signing
    return crypto.createHmac('sha256', 'secret-key')
      .update(contextId + hash)
      .digest('hex');
  }

  async _reconstructFromChanges(contextId, targetVersion) {
    // Reconstruct context state from change log
    // This would involve replaying changes up to the target version
    throw new Error('Change log reconstruction not yet implemented');
  }

  /**
   * Shutdown the contextual graph manager
   */
  async shutdown() {
    // Shutdown RDF* processor
    await this.rdfStar.shutdown();
    
    // Clear all data structures
    this.contexts.clear();
    this.contextGraphs.clear();
    this.contextMetadata.clear();
    this.versions.clear();
    this.snapshots.clear();
    this.provenanceGraph.clear();
    this.activities.clear();
    this.agents.clear();
    this.auditLog.length = 0;
    this.changeLog.clear();
    
    for (const index of Object.values(this.indexes)) {
      index.clear();
    }
    
    this.removeAllListeners();
    this.status = 'shutdown';
  }
}

export default ContextualGraphManager;
