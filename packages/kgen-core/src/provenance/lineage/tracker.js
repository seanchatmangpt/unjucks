/**
 * Operation Lineage Tracker - Tracks complete operation lineage with semantic graph integration
 * 
 * Provides comprehensive lineage tracking that connects operations through semantic
 * relationships, enabling full traceability from data to artifacts.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import consola from 'consola';
import { v4 as uuidv4 } from 'uuid';

export class OperationLineageTracker {
  constructor(config = {}) {
    this.config = {
      storageBackend: config.storageBackend || 'memory', // memory, file, database
      storageLocation: config.storageLocation || './lineage',
      enableSemanticRelations: config.enableSemanticRelations !== false,
      enableImpactAnalysis: config.enableImpactAnalysis !== false,
      maxLineageDepth: config.maxLineageDepth || 10,
      retentionPolicyDays: config.retentionPolicyDays || 365,
      compressionEnabled: config.compressionEnabled !== false,
      ...config
    };
    
    this.logger = consola.withTag('lineage-tracker');
    
    // In-memory lineage graph
    this.lineageGraph = {
      operations: new Map(), // operationId -> operation data
      entities: new Map(),   // entityId -> entity data
      relations: new Map(),  // relationId -> relation data
      semantic: new Map()    // semanticId -> semantic relationship
    };
    
    // Lineage indices for fast queries
    this.indices = {
      byEntity: new Map(),     // entityId -> Set of operation IDs
      byTemplate: new Map(),   // templateId -> Set of operation IDs
      byRule: new Map(),       // ruleId -> Set of operation IDs
      byAgent: new Map(),      // agentId -> Set of operation IDs
      byTimestamp: []          // Sorted array of { timestamp, operationId }
    };
    
    this.initialized = false;
  }

  /**
   * Initialize the lineage tracker
   */
  async initialize() {
    try {
      this.logger.info('Initializing operation lineage tracker...');
      
      // Ensure storage directory exists
      if (this.config.storageBackend === 'file') {
        await fs.mkdir(this.config.storageLocation, { recursive: true });
      }
      
      // Load existing lineage data
      await this._loadExistingLineage();
      
      this.initialized = true;
      this.logger.success('Operation lineage tracker initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize lineage tracker:', error);
      throw error;
    }
  }

  /**
   * Track operation in lineage graph
   * @param {Object} operationContext - Complete operation context
   * @returns {Promise<Object>} Tracking result
   */
  async trackOperation(operationContext) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.logger.debug(`Tracking operation: ${operationContext.operationId}`);
      
      const operation = {
        operationId: operationContext.operationId,
        type: operationContext.type,
        startTime: operationContext.startTime,
        endTime: operationContext.endTime,
        status: operationContext.status || 'completed',
        
        // Core metadata
        agent: operationContext.agent,
        template: operationContext.templateId ? {
          id: operationContext.templateId,
          version: operationContext.templateVersion,
          hash: operationContext.templateHash,
          path: operationContext.templatePath
        } : null,
        
        rules: (operationContext.ruleIds || []).map(ruleId => ({
          id: ruleId,
          version: operationContext.ruleVersions?.[ruleId] || 'unknown',
          type: operationContext.ruleTypes?.[ruleId] || 'unknown'
        })),
        
        // Input/output entities
        inputs: operationContext.sources || [],
        outputs: operationContext.outputs || [],
        
        // Provenance metadata
        integrityHash: operationContext.integrityHash,
        chainIndex: operationContext.chainIndex || 0,
        
        // Quality metrics
        metrics: operationContext.metrics || {},
        
        // Configuration snapshot
        configuration: operationContext.configuration || {},
        
        // Semantic reasoning chain
        reasoningChain: operationContext.reasoningChain || [],
        
        // Tracked timestamp
        trackedAt: this.getDeterministicDate().toISOString()
      };
      
      // Store operation
      this.lineageGraph.operations.set(operation.operationId, operation);
      
      // Track entities
      await this._trackEntities(operation);
      
      // Create lineage relationships
      await this._createLineageRelationships(operation);
      
      // Update indices
      await this._updateIndices(operation);
      
      // Create semantic relationships if enabled
      if (this.config.enableSemanticRelations) {
        await this._createSemanticRelationships(operation);
      }
      
      // Persist if file storage enabled
      if (this.config.storageBackend === 'file') {
        await this._persistOperation(operation);
      }
      
      const result = {
        operationId: operation.operationId,
        tracked: true,
        entitiesTracked: operation.inputs.length + operation.outputs.length,
        relationshipsCreated: operation.inputs.length * operation.outputs.length,
        semanticRelationships: operation.reasoningChain.length
      };
      
      this.logger.debug(`Operation tracked successfully: ${operation.operationId}`);
      
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to track operation ${operationContext.operationId}:`, error);
      throw error;
    }
  }

  /**
   * Get complete lineage for an entity
   * @param {string} entityId - Entity identifier
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Lineage data
   */
  async getEntityLineage(entityId, options = {}) {
    try {
      this.logger.debug(`Getting lineage for entity: ${entityId}`);
      
      const {
        direction = 'both', // 'upstream', 'downstream', 'both'
        maxDepth = this.config.maxLineageDepth,
        includeSemantics = true,
        includeMetrics = false,
        format = 'graph' // 'graph', 'tree', 'flat'
      } = options;
      
      const visited = new Set();
      const lineage = {
        entityId,
        direction,
        maxDepth,
        
        // Core lineage data
        operations: [],
        entities: [],
        relationships: [],
        
        // Semantic information
        semanticRelationships: [],
        reasoningPaths: [],
        
        // Analysis results
        impact: null,
        dependencies: null,
        
        // Query metadata
        queryTime: this.getDeterministicTimestamp(),
        totalNodes: 0,
        totalEdges: 0
      };
      
      // Collect lineage data
      await this._collectLineageData(entityId, lineage, visited, 0, maxDepth, direction);
      
      // Add semantic relationships if requested
      if (includeSemantics && this.config.enableSemanticRelations) {
        lineage.semanticRelationships = await this._getSemanticRelationships(entityId);
        lineage.reasoningPaths = await this._getReasoningPaths(entityId);
      }
      
      // Perform impact analysis if enabled
      if (this.config.enableImpactAnalysis) {
        lineage.impact = await this._analyzeImpact(entityId, lineage);
        lineage.dependencies = await this._analyzeDependencies(entityId, lineage);
      }
      
      // Format results based on requested format
      const formattedLineage = await this._formatLineage(lineage, format);
      
      // Update statistics
      formattedLineage.totalNodes = formattedLineage.operations.length + formattedLineage.entities.length;
      formattedLineage.totalEdges = formattedLineage.relationships.length;
      formattedLineage.queryDuration = this.getDeterministicTimestamp() - lineage.queryTime;
      
      this.logger.debug(`Lineage retrieved: ${formattedLineage.totalNodes} nodes, ${formattedLineage.totalEdges} edges`);
      
      return formattedLineage;
      
    } catch (error) {
      this.logger.error(`Failed to get lineage for entity ${entityId}:`, error);
      throw error;
    }
  }

  /**
   * Get operation lineage with full context
   * @param {string} operationId - Operation identifier
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Operation lineage
   */
  async getOperationLineage(operationId, options = {}) {
    try {
      const operation = this.lineageGraph.operations.get(operationId);
      
      if (!operation) {
        throw new Error(`Operation not found: ${operationId}`);
      }
      
      const lineage = {
        operation,
        upstreamOperations: [],
        downstreamOperations: [],
        connectedEntities: [],
        templateLineage: null,
        ruleLineage: [],
        semanticContext: null
      };
      
      // Get upstream operations (operations that produced inputs)
      for (const input of operation.inputs) {
        const upstreamOps = await this._findOperationsByOutput(input.id);
        lineage.upstreamOperations.push(...upstreamOps);
      }
      
      // Get downstream operations (operations that used outputs)
      for (const output of operation.outputs) {
        const downstreamOps = await this._findOperationsByInput(output.id);
        lineage.downstreamOperations.push(...downstreamOps);
      }
      
      // Get all connected entities
      const allEntityIds = new Set([
        ...operation.inputs.map(i => i.id),
        ...operation.outputs.map(o => o.id)
      ]);
      
      for (const entityId of allEntityIds) {
        const entity = this.lineageGraph.entities.get(entityId);
        if (entity) {
          lineage.connectedEntities.push(entity);
        }
      }
      
      // Get template lineage if applicable
      if (operation.template) {
        lineage.templateLineage = await this._getTemplateLineage(operation.template.id);
      }
      
      // Get rule lineage
      for (const rule of operation.rules) {
        const ruleLineage = await this._getRuleLineage(rule.id);
        lineage.ruleLineage.push(ruleLineage);
      }
      
      // Get semantic context
      if (operation.reasoningChain.length > 0) {
        lineage.semanticContext = await this._getSemanticContext(operationId);
      }
      
      return lineage;
      
    } catch (error) {
      this.logger.error(`Failed to get operation lineage for ${operationId}:`, error);
      throw error;
    }
  }

  /**
   * Analyze change impact for an entity
   * @param {string} entityId - Entity to analyze
   * @param {Object} changeSpec - Specification of changes
   * @returns {Promise<Object>} Impact analysis result
   */
  async analyzeChangeImpact(entityId, changeSpec) {
    try {
      this.logger.debug(`Analyzing change impact for entity: ${entityId}`);
      
      const analysis = {
        entityId,
        changeSpec,
        
        // Impact scope
        directlyAffected: [],
        indirectlyAffected: [],
        cascadingEffects: [],
        
        // Risk assessment
        riskLevel: 'low', // low, medium, high, critical
        riskFactors: [],
        
        // Recommendations
        recommendations: [],
        testingStrategy: [],
        
        // Rollback plan
        rollbackComplexity: 'simple',
        rollbackSteps: [],
        
        analysisTime: this.getDeterministicTimestamp()
      };
      
      // Get entity lineage
      const lineage = await this.getEntityLineage(entityId, {
        direction: 'downstream',
        maxDepth: 5,
        includeSemantics: true
      });
      
      // Analyze direct impacts
      analysis.directlyAffected = lineage.operations
        .filter(op => op.inputs.some(input => input.id === entityId))
        .map(op => ({
          operationId: op.operationId,
          type: op.type,
          impact: this._assessOperationImpact(op, changeSpec),
          mitigation: this._suggestMitigation(op, changeSpec)
        }));
      
      // Analyze indirect impacts (operations that use outputs of directly affected operations)
      const directOutputs = new Set();
      for (const affected of analysis.directlyAffected) {
        const operation = this.lineageGraph.operations.get(affected.operationId);
        if (operation) {
          operation.outputs.forEach(output => directOutputs.add(output.id));
        }
      }
      
      for (const outputId of directOutputs) {
        const downstreamOps = await this._findOperationsByInput(outputId);
        for (const op of downstreamOps) {
          if (!analysis.directlyAffected.find(affected => affected.operationId === op.operationId)) {
            analysis.indirectlyAffected.push({
              operationId: op.operationId,
              type: op.type,
              impact: this._assessOperationImpact(op, changeSpec),
              throughEntity: outputId
            });
          }
        }
      }
      
      // Assess overall risk level
      analysis.riskLevel = this._calculateRiskLevel(analysis);
      analysis.riskFactors = this._identifyRiskFactors(analysis, lineage);
      
      // Generate recommendations
      analysis.recommendations = this._generateRecommendations(analysis);
      analysis.testingStrategy = this._generateTestingStrategy(analysis);
      
      // Plan rollback strategy
      analysis.rollbackComplexity = this._assessRollbackComplexity(analysis);
      analysis.rollbackSteps = this._generateRollbackSteps(analysis);
      
      analysis.analysisTime = this.getDeterministicTimestamp() - analysis.analysisTime;
      
      this.logger.debug(`Impact analysis completed: ${analysis.riskLevel} risk, ${analysis.directlyAffected.length} direct impacts`);
      
      return analysis;
      
    } catch (error) {
      this.logger.error(`Failed to analyze change impact for ${entityId}:`, error);
      throw error;
    }
  }

  /**
   * Get lineage statistics
   * @returns {Object} Lineage statistics
   */
  getStatistics() {
    return {
      operations: this.lineageGraph.operations.size,
      entities: this.lineageGraph.entities.size,
      relationships: this.lineageGraph.relations.size,
      semanticRelationships: this.lineageGraph.semantic.size,
      
      indices: {
        byEntity: this.indices.byEntity.size,
        byTemplate: this.indices.byTemplate.size,
        byRule: this.indices.byRule.size,
        byAgent: this.indices.byAgent.size,
        byTimestamp: this.indices.byTimestamp.length
      },
      
      configuration: {
        storageBackend: this.config.storageBackend,
        maxDepth: this.config.maxLineageDepth,
        semanticsEnabled: this.config.enableSemanticRelations,
        impactAnalysisEnabled: this.config.enableImpactAnalysis
      }
    };
  }

  // Private methods

  async _loadExistingLineage() {
    if (this.config.storageBackend === 'file') {
      try {
        const operationsFile = path.join(this.config.storageLocation, 'operations.json');
        if (await this._fileExists(operationsFile)) {
          const data = await fs.readFile(operationsFile, 'utf8');
          const operations = JSON.parse(data);
          
          for (const [id, operation] of Object.entries(operations)) {
            this.lineageGraph.operations.set(id, operation);
            await this._updateIndices(operation);
          }
          
          this.logger.info(`Loaded ${this.lineageGraph.operations.size} operations from storage`);
        }
      } catch (error) {
        this.logger.warn('Failed to load existing lineage:', error);
      }
    }
  }

  async _trackEntities(operation) {
    // Track input entities
    for (const input of operation.inputs) {
      if (!this.lineageGraph.entities.has(input.id)) {
        this.lineageGraph.entities.set(input.id, {
          entityId: input.id,
          type: input.type || 'unknown',
          properties: input.properties || {},
          firstSeen: this.getDeterministicDate().toISOString(),
          operations: new Set()
        });
      }
      
      const entity = this.lineageGraph.entities.get(input.id);
      entity.operations.add(operation.operationId);
      entity.lastUsed = this.getDeterministicDate().toISOString();
    }
    
    // Track output entities
    for (const output of operation.outputs) {
      this.lineageGraph.entities.set(output.id, {
        entityId: output.id,
        type: output.type || 'unknown',
        properties: output.properties || {},
        createdBy: operation.operationId,
        createdAt: operation.endTime || operation.startTime,
        operations: new Set([operation.operationId])
      });
    }
  }

  async _createLineageRelationships(operation) {
    // Create input -> operation -> output relationships
    for (const input of operation.inputs) {
      for (const output of operation.outputs) {
        const relationId = `${input.id}->${operation.operationId}->${output.id}`;
        
        this.lineageGraph.relations.set(relationId, {
          relationId,
          type: 'transformation',
          source: input.id,
          target: output.id,
          operation: operation.operationId,
          createdAt: this.getDeterministicDate().toISOString()
        });
      }
    }
  }

  async _updateIndices(operation) {
    // Update entity index
    for (const entity of [...operation.inputs, ...operation.outputs]) {
      if (!this.indices.byEntity.has(entity.id)) {
        this.indices.byEntity.set(entity.id, new Set());
      }
      this.indices.byEntity.get(entity.id).add(operation.operationId);
    }
    
    // Update template index
    if (operation.template) {
      if (!this.indices.byTemplate.has(operation.template.id)) {
        this.indices.byTemplate.set(operation.template.id, new Set());
      }
      this.indices.byTemplate.get(operation.template.id).add(operation.operationId);
    }
    
    // Update rule indices
    for (const rule of operation.rules) {
      if (!this.indices.byRule.has(rule.id)) {
        this.indices.byRule.set(rule.id, new Set());
      }
      this.indices.byRule.get(rule.id).add(operation.operationId);
    }
    
    // Update agent index
    if (operation.agent) {
      if (!this.indices.byAgent.has(operation.agent.id)) {
        this.indices.byAgent.set(operation.agent.id, new Set());
      }
      this.indices.byAgent.get(operation.agent.id).add(operation.operationId);
    }
    
    // Update timestamp index
    this.indices.byTimestamp.push({
      timestamp: operation.startTime,
      operationId: operation.operationId
    });
    
    // Keep timestamp index sorted
    this.indices.byTimestamp.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  async _createSemanticRelationships(operation) {
    // Create semantic relationships based on reasoning chain
    for (const [index, step] of operation.reasoningChain.entries()) {
      const semanticId = `${operation.operationId}-semantic-${index}`;
      
      this.lineageGraph.semantic.set(semanticId, {
        semanticId,
        operationId: operation.operationId,
        stepIndex: index,
        rule: step.rule,
        inferenceType: step.type,
        inputs: step.inputs || [],
        outputs: step.outputs || [],
        confidence: step.confidence || 1.0,
        createdAt: this.getDeterministicDate().toISOString()
      });
    }
  }

  async _collectLineageData(entityId, lineage, visited, currentDepth, maxDepth, direction) {
    if (visited.has(entityId) || currentDepth >= maxDepth) {
      return;
    }
    
    visited.add(entityId);
    
    // Get entity
    const entity = this.lineageGraph.entities.get(entityId);
    if (entity) {
      lineage.entities.push(entity);
    }
    
    // Get operations that involve this entity
    const operationIds = this.indices.byEntity.get(entityId) || new Set();
    
    for (const operationId of operationIds) {
      const operation = this.lineageGraph.operations.get(operationId);
      if (!operation) continue;
      
      // Add operation if not already included
      if (!lineage.operations.find(op => op.operationId === operationId)) {
        lineage.operations.push(operation);
      }
      
      // Follow relationships based on direction
      if (direction === 'upstream' || direction === 'both') {
        // Follow inputs (upstream)
        for (const input of operation.inputs) {
          if (input.id !== entityId) {
            await this._collectLineageData(input.id, lineage, visited, currentDepth + 1, maxDepth, direction);
          }
        }
      }
      
      if (direction === 'downstream' || direction === 'both') {
        // Follow outputs (downstream)
        for (const output of operation.outputs) {
          if (output.id !== entityId) {
            await this._collectLineageData(output.id, lineage, visited, currentDepth + 1, maxDepth, direction);
          }
        }
      }
    }
  }

  async _findOperationsByOutput(outputId) {
    const operations = [];
    for (const [operationId, operation] of this.lineageGraph.operations) {
      if (operation.outputs.some(output => output.id === outputId)) {
        operations.push(operation);
      }
    }
    return operations;
  }

  async _findOperationsByInput(inputId) {
    const operations = [];
    for (const [operationId, operation] of this.lineageGraph.operations) {
      if (operation.inputs.some(input => input.id === inputId)) {
        operations.push(operation);
      }
    }
    return operations;
  }

  _assessOperationImpact(operation, changeSpec) {
    // Simple impact assessment logic
    const factors = [];
    let score = 1;
    
    if (operation.type === 'critical') {
      factors.push('Critical operation type');
      score += 2;
    }
    
    if (operation.outputs.length > 3) {
      factors.push('High fan-out');
      score += 1;
    }
    
    if (operation.reasoningChain.length > 0) {
      factors.push('Semantic reasoning involved');
      score += 1;
    }
    
    return {
      score: Math.min(score, 5),
      level: score <= 2 ? 'low' : score <= 3 ? 'medium' : 'high',
      factors
    };
  }

  _calculateRiskLevel(analysis) {
    const highImpact = analysis.directlyAffected.filter(a => a.impact.level === 'high').length;
    const mediumImpact = analysis.directlyAffected.filter(a => a.impact.level === 'medium').length;
    
    if (highImpact > 2 || analysis.indirectlyAffected.length > 10) {
      return 'critical';
    } else if (highImpact > 0 || mediumImpact > 3) {
      return 'high';
    } else if (mediumImpact > 0 || analysis.indirectlyAffected.length > 0) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  _generateRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.riskLevel === 'critical' || analysis.riskLevel === 'high') {
      recommendations.push('Implement staged rollout with monitoring');
      recommendations.push('Create comprehensive rollback plan');
      recommendations.push('Notify stakeholders of potential impact');
    }
    
    if (analysis.directlyAffected.length > 0) {
      recommendations.push('Test all directly affected operations');
    }
    
    if (analysis.indirectlyAffected.length > 0) {
      recommendations.push('Verify downstream operation compatibility');
    }
    
    return recommendations;
  }

  async _persistOperation(operation) {
    // Persist to file storage
    const operationsFile = path.join(this.config.storageLocation, 'operations.json');
    
    try {
      let operations = {};
      if (await this._fileExists(operationsFile)) {
        const data = await fs.readFile(operationsFile, 'utf8');
        operations = JSON.parse(data);
      }
      
      operations[operation.operationId] = operation;
      
      await fs.writeFile(operationsFile, JSON.stringify(operations, null, 2));
    } catch (error) {
      this.logger.warn('Failed to persist operation:', error);
    }
  }

  async _fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async _formatLineage(lineage, format) {
    // For now, return as-is. Could implement different formats here
    return lineage;
  }

  async _getSemanticRelationships(entityId) {
    const relationships = [];
    for (const [semanticId, semantic] of this.lineageGraph.semantic) {
      if (semantic.inputs.includes(entityId) || semantic.outputs.includes(entityId)) {
        relationships.push(semantic);
      }
    }
    return relationships;
  }

  async _analyzeImpact(entityId, lineage) {
    return {
      scope: lineage.operations.length,
      depth: lineage.maxDepth,
      breadth: lineage.entities.length
    };
  }

  async _analyzeDependencies(entityId, lineage) {
    const dependencies = {
      templates: new Set(),
      rules: new Set(),
      agents: new Set()
    };
    
    for (const operation of lineage.operations) {
      if (operation.template) {
        dependencies.templates.add(operation.template.id);
      }
      for (const rule of operation.rules) {
        dependencies.rules.add(rule.id);
      }
      if (operation.agent) {
        dependencies.agents.add(operation.agent.id);
      }
    }
    
    return {
      templates: Array.from(dependencies.templates),
      rules: Array.from(dependencies.rules),
      agents: Array.from(dependencies.agents)
    };
  }

  // Stub implementations for additional methods
  async _suggestMitigation(operation, changeSpec) { return []; }
  async _getTemplateLineage(templateId) { return null; }
  async _getRuleLineage(ruleId) { return null; }
  async _getSemanticContext(operationId) { return null; }
  async _getReasoningPaths(entityId) { return []; }
  _identifyRiskFactors(analysis, lineage) { return []; }
  _generateTestingStrategy(analysis) { return []; }
  _assessRollbackComplexity(analysis) { return 'simple'; }
  _generateRollbackSteps(analysis) { return []; }
}

export default OperationLineageTracker;