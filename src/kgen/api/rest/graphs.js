/**
 * Knowledge Graph REST API Endpoints
 * 
 * RESTful API endpoints for knowledge graph operations including
 * CRUD operations, querying, validation, and management.
 */

import { Router } from 'express';
import { Logger } from 'consola';
import { body, param, query, validationResult } from 'express-validator';

export class KnowledgeGraphAPI {
  constructor(kgenEngine, config = {}) {
    this.kgenEngine = kgenEngine;
    this.config = {
      enableValidation: true,
      enableRateLimit: true,
      maxGraphSize: 100000, // 100K triples
      maxQueryTime: 30000,
      enableCaching: true,
      ...config
    };
    
    this.logger = new Logger({ tag: 'kgen-api-graphs' });
    this.router = Router();
    
    // Request statistics
    this.requestStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
    
    this._setupRoutes();
    this._setupErrorHandling();
  }

  /**
   * Setup API routes
   */
  _setupRoutes() {
    // Knowledge graph CRUD operations
    this.router.post('/graphs', 
      this._validateCreateGraph(),
      this._createKnowledgeGraph.bind(this)
    );
    
    this.router.get('/graphs',
      this._validateListGraphs(),
      this._listKnowledgeGraphs.bind(this)
    );
    
    this.router.get('/graphs/:id',
      this._validateGetGraph(),
      this._getKnowledgeGraph.bind(this)
    );
    
    this.router.put('/graphs/:id',
      this._validateUpdateGraph(),
      this._updateKnowledgeGraph.bind(this)
    );
    
    this.router.delete('/graphs/:id',
      this._validateDeleteGraph(),
      this._deleteKnowledgeGraph.bind(this)
    );
    
    // Graph operations
    this.router.post('/graphs/:id/merge',
      this._validateMergeGraphs(),
      this._mergeKnowledgeGraphs.bind(this)
    );
    
    this.router.post('/graphs/:id/validate',
      this._validateValidateGraph(),
      this._validateKnowledgeGraph.bind(this)
    );
    
    this.router.post('/graphs/:id/reason',
      this._validateReasonGraph(),
      this._reasonKnowledgeGraph.bind(this)
    );
    
    // Graph export/import
    this.router.get('/graphs/:id/export',
      this._validateExportGraph(),
      this._exportKnowledgeGraph.bind(this)
    );
    
    this.router.post('/graphs/import',
      this._validateImportGraph(),
      this._importKnowledgeGraph.bind(this)
    );
    
    // Graph statistics and analytics
    this.router.get('/graphs/:id/stats',
      this._validateGetStats(),
      this._getGraphStatistics.bind(this)
    );
    
    this.router.get('/graphs/:id/metrics',
      this._validateGetMetrics(),
      this._getGraphMetrics.bind(this)
    );
    
    // Graph versioning
    this.router.get('/graphs/:id/versions',
      this._validateGetVersions(),
      this._getGraphVersions.bind(this)
    );
    
    this.router.post('/graphs/:id/versions',
      this._validateCreateVersion(),
      this._createGraphVersion.bind(this)
    );
    
    this.router.get('/graphs/:id/versions/:version',
      this._validateGetVersion(),
      this._getGraphVersion.bind(this)
    );
  }

  /**
   * Create a new knowledge graph
   */
  async _createKnowledgeGraph(req, res) {
    const startTime = Date.now();
    
    try {
      this._incrementRequestStats();
      
      this.logger.info('Creating new knowledge graph');
      
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return this._sendError(res, 400, 'Validation failed', errors.array());
      }
      
      // Extract graph data from request
      const graphData = {
        name: req.body.name,
        description: req.body.description,
        entities: req.body.entities || [],
        relationships: req.body.relationships || [],
        metadata: req.body.metadata || {},
        sources: req.body.sources || [],
        user: req.user
      };
      
      // Validate graph size
      if (this._calculateGraphSize(graphData) > this.config.maxGraphSize) {
        return this._sendError(res, 413, 'Graph too large', {
          maxSize: this.config.maxGraphSize,
          actualSize: this._calculateGraphSize(graphData)
        });
      }
      
      // Create knowledge graph through ingestion pipeline
      const knowledgeGraph = await this.kgenEngine.ingest([{
        type: 'inline',
        id: 'api-request',
        data: graphData
      }], {
        user: req.user,
        enableReasoning: req.body.enableReasoning !== false,
        complianceRules: req.body.complianceRules || []
      });
      
      // Store graph metadata
      knowledgeGraph.metadata = {
        ...knowledgeGraph.metadata,
        createdBy: req.user?.id,
        createdAt: new Date(),
        apiVersion: '1.0.0',
        name: graphData.name,
        description: graphData.description
      };
      
      const responseTime = Date.now() - startTime;
      this._updateResponseTimeStats(responseTime);
      this.requestStats.successfulRequests++;
      
      res.status(201).json({
        status: 'success',
        data: {
          graph: this._formatGraphResponse(knowledgeGraph),
          metadata: {
            responseTime,
            timestamp: new Date()
          }
        }
      });
      
      this.logger.success(`Knowledge graph created: ${knowledgeGraph.id}`);
      
    } catch (error) {
      this.requestStats.failedRequests++;
      this.logger.error('Failed to create knowledge graph:', error);
      this._sendError(res, 500, 'Failed to create knowledge graph', error.message);
    }
  }

  /**
   * List knowledge graphs
   */
  async _listKnowledgeGraphs(req, res) {
    const startTime = Date.now();
    
    try {
      this._incrementRequestStats();
      
      this.logger.info('Listing knowledge graphs');
      
      const queryOptions = {
        limit: parseInt(req.query.limit) || 10,
        offset: parseInt(req.query.offset) || 0,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc',
        filters: {
          createdBy: req.query.createdBy,
          status: req.query.status,
          tags: req.query.tags?.split(','),
          dateRange: {
            start: req.query.startDate ? new Date(req.query.startDate) : null,
            end: req.query.endDate ? new Date(req.query.endDate) : null
          }
        }
      };
      
      // Get graphs from storage (placeholder implementation)
      const graphs = await this._getStoredGraphs(queryOptions, req.user);
      
      const responseTime = Date.now() - startTime;
      this._updateResponseTimeStats(responseTime);
      this.requestStats.successfulRequests++;
      
      res.json({
        status: 'success',
        data: {
          graphs: graphs.items.map(graph => this._formatGraphSummary(graph)),
          pagination: {
            total: graphs.total,
            limit: queryOptions.limit,
            offset: queryOptions.offset,
            hasMore: (queryOptions.offset + queryOptions.limit) < graphs.total
          },
          metadata: {
            responseTime,
            timestamp: new Date()
          }
        }
      });
      
    } catch (error) {
      this.requestStats.failedRequests++;
      this.logger.error('Failed to list knowledge graphs:', error);
      this._sendError(res, 500, 'Failed to list knowledge graphs', error.message);
    }
  }

  /**
   * Get a specific knowledge graph
   */
  async _getKnowledgeGraph(req, res) {
    const startTime = Date.now();
    
    try {
      this._incrementRequestStats();
      
      const graphId = req.params.id;
      this.logger.info(`Getting knowledge graph: ${graphId}`);
      
      // Check authorization
      const authorized = await this._checkGraphAccess(graphId, req.user, 'read');
      if (!authorized) {
        return this._sendError(res, 403, 'Access denied');
      }
      
      // Get graph from storage
      const graph = await this._getStoredGraph(graphId);
      if (!graph) {
        return this._sendError(res, 404, 'Knowledge graph not found');
      }
      
      // Apply format options
      const format = req.query.format || 'json';
      const includeProvenance = req.query.includeProvenance === 'true';
      const includeMetrics = req.query.includeMetrics === 'true';
      
      let responseData = this._formatGraphResponse(graph);
      
      // Add provenance if requested
      if (includeProvenance) {
        responseData.provenance = await this._getGraphProvenance(graphId);
      }
      
      // Add metrics if requested
      if (includeMetrics) {
        responseData.metrics = await this._calculateGraphMetrics(graph);
      }
      
      // Format response based on requested format
      if (format === 'turtle') {
        res.set('Content-Type', 'text/turtle');
        return res.send(await this._formatAsTurtle(graph));
      } else if (format === 'rdf-xml') {
        res.set('Content-Type', 'application/rdf+xml');
        return res.send(await this._formatAsRDFXML(graph));
      } else if (format === 'json-ld') {
        res.set('Content-Type', 'application/ld+json');
        return res.json(await this._formatAsJSONLD(graph));
      }
      
      const responseTime = Date.now() - startTime;
      this._updateResponseTimeStats(responseTime);
      this.requestStats.successfulRequests++;
      
      res.json({
        status: 'success',
        data: {
          graph: responseData,
          metadata: {
            responseTime,
            timestamp: new Date()
          }
        }
      });
      
    } catch (error) {
      this.requestStats.failedRequests++;
      this.logger.error(`Failed to get knowledge graph ${req.params.id}:`, error);
      this._sendError(res, 500, 'Failed to get knowledge graph', error.message);
    }
  }

  /**
   * Update a knowledge graph
   */
  async _updateKnowledgeGraph(req, res) {
    const startTime = Date.now();
    
    try {
      this._incrementRequestStats();
      
      const graphId = req.params.id;
      this.logger.info(`Updating knowledge graph: ${graphId}`);
      
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return this._sendError(res, 400, 'Validation failed', errors.array());
      }
      
      // Check authorization
      const authorized = await this._checkGraphAccess(graphId, req.user, 'write');
      if (!authorized) {
        return this._sendError(res, 403, 'Access denied');
      }
      
      // Get existing graph
      const existingGraph = await this._getStoredGraph(graphId);
      if (!existingGraph) {
        return this._sendError(res, 404, 'Knowledge graph not found');
      }
      
      // Apply updates
      const updateData = {
        entities: req.body.entities,
        relationships: req.body.relationships,
        metadata: { ...existingGraph.metadata, ...req.body.metadata },
        updatedBy: req.user?.id,
        updatedAt: new Date()
      };
      
      // Validate updated graph size
      if (this._calculateGraphSize(updateData) > this.config.maxGraphSize) {
        return this._sendError(res, 413, 'Updated graph too large');
      }
      
      // Process updates through reasoning engine if requested
      let updatedGraph = { ...existingGraph, ...updateData };
      
      if (req.body.enableReasoning) {
        const rules = req.body.reasoningRules || [];
        updatedGraph = await this.kgenEngine.reason(updatedGraph, rules, {
          user: req.user
        });
      }
      
      // Validate updated graph if requested
      if (req.body.enableValidation) {
        const constraints = req.body.validationConstraints || [];
        const validationReport = await this.kgenEngine.validate(updatedGraph, constraints, {
          user: req.user
        });
        
        if (!validationReport.isValid) {
          return this._sendError(res, 400, 'Graph validation failed', validationReport.violations);
        }
      }
      
      // Store updated graph
      await this._storeGraph(graphId, updatedGraph);
      
      const responseTime = Date.now() - startTime;
      this._updateResponseTimeStats(responseTime);
      this.requestStats.successfulRequests++;
      
      res.json({
        status: 'success',
        data: {
          graph: this._formatGraphResponse(updatedGraph),
          metadata: {
            responseTime,
            timestamp: new Date()
          }
        }
      });
      
      this.logger.success(`Knowledge graph updated: ${graphId}`);
      
    } catch (error) {
      this.requestStats.failedRequests++;
      this.logger.error(`Failed to update knowledge graph ${req.params.id}:`, error);
      this._sendError(res, 500, 'Failed to update knowledge graph', error.message);
    }
  }

  /**
   * Delete a knowledge graph
   */
  async _deleteKnowledgeGraph(req, res) {
    const startTime = Date.now();
    
    try {
      this._incrementRequestStats();
      
      const graphId = req.params.id;
      this.logger.info(`Deleting knowledge graph: ${graphId}`);
      
      // Check authorization
      const authorized = await this._checkGraphAccess(graphId, req.user, 'delete');
      if (!authorized) {
        return this._sendError(res, 403, 'Access denied');
      }
      
      // Check if graph exists
      const graph = await this._getStoredGraph(graphId);
      if (!graph) {
        return this._sendError(res, 404, 'Knowledge graph not found');
      }
      
      // Soft delete or hard delete based on configuration
      const deleteMode = req.query.mode || 'soft';
      
      if (deleteMode === 'hard') {
        await this._hardDeleteGraph(graphId);
      } else {
        await this._softDeleteGraph(graphId, req.user);
      }
      
      const responseTime = Date.now() - startTime;
      this._updateResponseTimeStats(responseTime);
      this.requestStats.successfulRequests++;
      
      res.json({
        status: 'success',
        data: {
          message: `Knowledge graph ${deleteMode} deleted successfully`,
          graphId,
          deleteMode,
          metadata: {
            responseTime,
            timestamp: new Date()
          }
        }
      });
      
      this.logger.success(`Knowledge graph deleted: ${graphId} (${deleteMode})`);
      
    } catch (error) {
      this.requestStats.failedRequests++;
      this.logger.error(`Failed to delete knowledge graph ${req.params.id}:`, error);
      this._sendError(res, 500, 'Failed to delete knowledge graph', error.message);
    }
  }

  /**
   * Validate a knowledge graph
   */
  async _validateKnowledgeGraph(req, res) {
    const startTime = Date.now();
    
    try {
      this._incrementRequestStats();
      
      const graphId = req.params.id;
      this.logger.info(`Validating knowledge graph: ${graphId}`);
      
      // Check authorization
      const authorized = await this._checkGraphAccess(graphId, req.user, 'read');
      if (!authorized) {
        return this._sendError(res, 403, 'Access denied');
      }
      
      // Get graph
      const graph = await this._getStoredGraph(graphId);
      if (!graph) {
        return this._sendError(res, 404, 'Knowledge graph not found');
      }
      
      // Get validation constraints
      const constraints = req.body.constraints || [];
      const validationOptions = {
        user: req.user,
        consistencyChecks: req.body.consistencyChecks !== false,
        completenessChecks: req.body.completenessChecks !== false,
        complianceChecks: req.body.complianceChecks || []
      };
      
      // Perform validation
      const validationReport = await this.kgenEngine.validate(graph, constraints, validationOptions);
      
      const responseTime = Date.now() - startTime;
      this._updateResponseTimeStats(responseTime);
      this.requestStats.successfulRequests++;
      
      res.json({
        status: 'success',
        data: {
          validationReport,
          metadata: {
            responseTime,
            timestamp: new Date()
          }
        }
      });
      
    } catch (error) {
      this.requestStats.failedRequests++;
      this.logger.error(`Failed to validate knowledge graph ${req.params.id}:`, error);
      this._sendError(res, 500, 'Failed to validate knowledge graph', error.message);
    }
  }

  /**
   * Get API router
   */
  getRouter() {
    return this.router;
  }

  /**
   * Get API statistics
   */
  getStats() {
    return {
      requestStats: this.requestStats,
      config: this.config
    };
  }

  // Private methods

  _setupErrorHandling() {
    // Global error handler for this router
    this.router.use((error, req, res, next) => {
      this.logger.error('API error:', error);
      this._sendError(res, 500, 'Internal server error', error.message);
    });
  }

  _incrementRequestStats() {
    this.requestStats.totalRequests++;
  }

  _updateResponseTimeStats(responseTime) {
    const currentAvg = this.requestStats.averageResponseTime;
    const totalRequests = this.requestStats.totalRequests;
    
    this.requestStats.averageResponseTime = 
      (currentAvg * (totalRequests - 1) + responseTime) / totalRequests;
  }

  _sendError(res, statusCode, message, details = null) {
    res.status(statusCode).json({
      status: 'error',
      error: {
        message,
        details,
        timestamp: new Date()
      }
    });
  }

  _calculateGraphSize(graphData) {
    // Calculate graph size (estimated number of triples)
    const entityTriples = (graphData.entities?.length || 0) * 5; // Estimate 5 triples per entity
    const relationshipTriples = graphData.relationships?.length || 0;
    const directTriples = graphData.triples?.length || 0;
    
    return entityTriples + relationshipTriples + directTriples;
  }

  _formatGraphResponse(graph) {
    // Format graph for API response
    return {
      id: graph.id,
      name: graph.metadata?.name,
      description: graph.metadata?.description,
      entities: graph.entities?.length || 0,
      relationships: graph.relationships?.length || 0,
      triples: graph.triples?.length || 0,
      createdAt: graph.metadata?.createdAt,
      updatedAt: graph.metadata?.updatedAt,
      createdBy: graph.metadata?.createdBy,
      status: graph.metadata?.status || 'active',
      // Include actual data if requested
      ...(graph.includeData ? {
        entityData: graph.entities,
        relationshipData: graph.relationships,
        tripleData: graph.triples
      } : {})
    };
  }

  _formatGraphSummary(graph) {
    // Format graph summary for list responses
    return {
      id: graph.id,
      name: graph.metadata?.name,
      description: graph.metadata?.description,
      entityCount: graph.entities?.length || 0,
      relationshipCount: graph.relationships?.length || 0,
      createdAt: graph.metadata?.createdAt,
      updatedAt: graph.metadata?.updatedAt,
      createdBy: graph.metadata?.createdBy,
      status: graph.metadata?.status || 'active'
    };
  }

  async _checkGraphAccess(graphId, user, operation) {
    // Check user access to graph for specific operation
    try {
      await this.kgenEngine.securityManager.authorizeAccess(user, {
        type: 'knowledge_graph',
        id: graphId
      }, operation);
      return true;
    } catch (error) {
      return false;
    }
  }

  async _getStoredGraphs(queryOptions, user) {
    // Get graphs from storage with filtering and pagination
    // This is a placeholder implementation
    return {
      items: [],
      total: 0
    };
  }

  async _getStoredGraph(graphId) {
    // Get specific graph from storage
    // This is a placeholder implementation
    return null;
  }

  async _storeGraph(graphId, graph) {
    // Store graph to persistent storage
    // This is a placeholder implementation
  }

  async _softDeleteGraph(graphId, user) {
    // Mark graph as deleted but keep data
    // This is a placeholder implementation
  }

  async _hardDeleteGraph(graphId) {
    // Permanently delete graph data
    // This is a placeholder implementation
  }

  async _getGraphProvenance(graphId) {
    // Get provenance information for graph
    // This is a placeholder implementation
    return {};
  }

  async _calculateGraphMetrics(graph) {
    // Calculate graph metrics
    return await this.kgenEngine.queryEngine.calculateMetrics(graph);
  }

  async _formatAsTurtle(graph) {
    // Format graph as Turtle
    return '# Turtle format placeholder';
  }

  async _formatAsRDFXML(graph) {
    // Format graph as RDF/XML
    return '<rdf:RDF></rdf:RDF>';
  }

  async _formatAsJSONLD(graph) {
    // Format graph as JSON-LD
    return {
      '@context': {},
      '@graph': []
    };
  }

  // Validation middleware
  _validateCreateGraph() {
    return [
      body('name').isString().isLength({ min: 1, max: 255 }),
      body('description').optional().isString().isLength({ max: 1000 }),
      body('entities').optional().isArray(),
      body('relationships').optional().isArray(),
      body('enableReasoning').optional().isBoolean(),
      body('complianceRules').optional().isArray()
    ];
  }

  _validateListGraphs() {
    return [
      query('limit').optional().isInt({ min: 1, max: 100 }),
      query('offset').optional().isInt({ min: 0 }),
      query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'name']),
      query('sortOrder').optional().isIn(['asc', 'desc'])
    ];
  }

  _validateGetGraph() {
    return [
      param('id').isString().isLength({ min: 1 }),
      query('format').optional().isIn(['json', 'turtle', 'rdf-xml', 'json-ld']),
      query('includeProvenance').optional().isBoolean(),
      query('includeMetrics').optional().isBoolean()
    ];
  }

  _validateUpdateGraph() {
    return [
      param('id').isString().isLength({ min: 1 }),
      body('entities').optional().isArray(),
      body('relationships').optional().isArray(),
      body('metadata').optional().isObject(),
      body('enableReasoning').optional().isBoolean(),
      body('enableValidation').optional().isBoolean()
    ];
  }

  _validateDeleteGraph() {
    return [
      param('id').isString().isLength({ min: 1 }),
      query('mode').optional().isIn(['soft', 'hard'])
    ];
  }

  _validateMergeGraphs() {
    return [
      param('id').isString().isLength({ min: 1 }),
      body('sourceGraphIds').isArray().isLength({ min: 1 }),
      body('mergeStrategy').optional().isIn(['union', 'intersection', 'difference'])
    ];
  }

  _validateValidateGraph() {
    return [
      param('id').isString().isLength({ min: 1 }),
      body('constraints').optional().isArray(),
      body('consistencyChecks').optional().isBoolean(),
      body('completenessChecks').optional().isBoolean(),
      body('complianceChecks').optional().isArray()
    ];
  }

  _validateReasonGraph() {
    return [
      param('id').isString().isLength({ min: 1 }),
      body('rules').optional().isArray(),
      body('reasoningType').optional().isIn(['forward', 'backward', 'mixed'])
    ];
  }

  _validateExportGraph() {
    return [
      param('id').isString().isLength({ min: 1 }),
      query('format').isIn(['turtle', 'rdf-xml', 'json-ld', 'n-triples']),
      query('includeProvenance').optional().isBoolean(),
      query('compression').optional().isIn(['gzip', 'zip'])
    ];
  }

  _validateImportGraph() {
    return [
      body('format').isIn(['turtle', 'rdf-xml', 'json-ld', 'n-triples']),
      body('data').isString().isLength({ min: 1 }),
      body('name').isString().isLength({ min: 1, max: 255 }),
      body('enableValidation').optional().isBoolean()
    ];
  }

  _validateGetStats() {
    return [
      param('id').isString().isLength({ min: 1 }),
      query('includeDetail').optional().isBoolean()
    ];
  }

  _validateGetMetrics() {
    return [
      param('id').isString().isLength({ min: 1 }),
      query('metricsType').optional().isIn(['basic', 'structural', 'semantic', 'quality', 'all'])
    ];
  }

  _validateGetVersions() {
    return [
      param('id').isString().isLength({ min: 1 }),
      query('limit').optional().isInt({ min: 1, max: 50 }),
      query('offset').optional().isInt({ min: 0 })
    ];
  }

  _validateCreateVersion() {
    return [
      param('id').isString().isLength({ min: 1 }),
      body('description').optional().isString().isLength({ max: 500 }),
      body('tags').optional().isArray()
    ];
  }

  _validateGetVersion() {
    return [
      param('id').isString().isLength({ min: 1 }),
      param('version').isString().isLength({ min: 1 })
    ];
  }
}

export default KnowledgeGraphAPI;