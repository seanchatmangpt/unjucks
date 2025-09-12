/**
 * Enterprise Semantic API - Production REST Interface
 * 
 * Provides comprehensive REST API for semantic operations with enterprise
 * features including authentication, rate limiting, monitoring, and compliance.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { body, param, query, validationResult } from 'express-validator';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { consola } from 'consola';
import { SemanticOrchestrator } from '../semantic-orchestrator.js';
import { KGenCLIBridge } from '../../cli/kgen-cli-bridge.js';

export class SemanticAPI {
  constructor(config = {}) {
    this.config = {
      port: config.port || 3000,
      host: config.host || '0.0.0.0',
      environment: config.environment || 'production',
      
      // Security settings
      enableAuth: config.enableAuth !== false,
      enableRateLimit: config.enableRateLimit !== false,
      enableCors: config.enableCors !== false,
      
      // Performance settings
      enableCompression: config.enableCompression !== false,
      enableCaching: config.enableCaching !== false,
      
      // Enterprise features
      enableMetrics: config.enableMetrics !== false,
      enableAuditLog: config.enableAuditLog !== false,
      enableCompliance: config.enableCompliance !== false,
      
      ...config
    };
    
    this.app = express();
    this.logger = consola.withTag('semantic-api');
    this.orchestrator = new SemanticOrchestrator(config.orchestrator);
    this.cliBridge = new KGenCLIBridge(config.cli);
    
    this.requestCount = 0;
    this.activeRequests = new Map();
    this.performanceMetrics = new Map();
  }

  /**
   * Initialize the API server
   */
  async initialize() {
    try {
      this.logger.info('🚀 Initializing Semantic API Server');
      
      // Initialize semantic components
      await this.orchestrator.initialize();
      await this.cliBridge.initialize();
      
      // Setup middleware
      this._setupSecurityMiddleware();
      this._setupPerformanceMiddleware();
      this._setupValidationMiddleware();
      this._setupMonitoringMiddleware();
      
      // Setup routes
      this._setupApiRoutes();
      this._setupDocumentation();
      this._setupHealthChecks();
      
      this.logger.success('✅ Semantic API Server initialized');
      
    } catch (error) {
      this.logger.error('❌ API initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start the API server
   */
  async start() {
    return new Promise((resolve, reject) => {
      const server = this.app.listen(this.config.port, this.config.host, (error) => {
        if (error) {
          this.logger.error('❌ Failed to start API server:', error);
          reject(error);
        } else {
          this.logger.success(`✅ Semantic API Server running on ${this.config.host}:${this.config.port}`);
          resolve(server);
        }
      });
    });
  }

  // ========================================
  // SECURITY MIDDLEWARE
  // ========================================

  _setupSecurityMiddleware() {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    }));

    // CORS configuration
    if (this.config.enableCors) {
      this.app.use(cors({
        origin: this.config.allowedOrigins || true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
      }));
    }

    // Rate limiting
    if (this.config.enableRateLimit) {
      const rateLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: this.config.rateLimit || 1000, // requests per window
        message: {
          error: 'Rate limit exceeded',
          retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false
      });
      
      this.app.use('/api/', rateLimiter);

      // Slower rate limit for expensive operations
      const heavyLimiter = rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 100, // requests per hour
        message: {
          error: 'Heavy operation rate limit exceeded',
          retryAfter: '1 hour'
        }
      });
      
      this.app.use('/api/semantic/reasoning', heavyLimiter);
      this.app.use('/api/artifacts/generate', heavyLimiter);
    }

    // Speed limiting for DoS protection
    const speedLimiter = slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: 100, // allow 100 requests per 15 minutes at full speed
      delayMs: 500, // slow down subsequent requests by 500ms per request
      maxDelayMs: 20000 // maximum delay of 20 seconds
    });
    
    this.app.use('/api/', speedLimiter);

    // Authentication middleware
    if (this.config.enableAuth) {
      this.app.use('/api/', this._authenticationMiddleware.bind(this));
    }
  }

  _setupPerformanceMiddleware() {
    // Compression
    if (this.config.enableCompression) {
      this.app.use(compression({
        level: 6,
        threshold: 1024,
        filter: (req, res) => {
          return req.headers['x-no-compression'] ? false : compression.filter(req, res);
        }
      }));
    }

    // Request parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Request tracking
    this.app.use(this._requestTrackingMiddleware.bind(this));
  }

  _setupValidationMiddleware() {
    // Global error handler for validation
    this.app.use((error, req, res, next) => {
      if (error) {
        this.logger.error('Request error:', error);
        res.status(400).json({
          error: 'Invalid request',
          message: error.message
        });
      } else {
        next();
      }
    });
  }

  _setupMonitoringMiddleware() {
    // Performance monitoring
    this.app.use(this._performanceMonitoringMiddleware.bind(this));
    
    // Audit logging
    if (this.config.enableAuditLog) {
      this.app.use(this._auditLoggingMiddleware.bind(this));
    }
  }

  // ========================================
  // API ROUTES
  // ========================================

  _setupApiRoutes() {
    // Base API info
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'KGEN Semantic API',
        version: '1.0.0',
        status: 'operational',
        capabilities: this.orchestrator.getComprehensiveStatus().capabilities,
        endpoints: this._getEndpointList()
      });
    });

    // Graph operations
    this._setupGraphRoutes();
    
    // Semantic operations  
    this._setupSemanticRoutes();
    
    // Artifact operations
    this._setupArtifactRoutes();
    
    // Project operations
    this._setupProjectRoutes();
    
    // System operations
    this._setupSystemRoutes();
  }

  _setupGraphRoutes() {
    // POST /api/graphs/hash - Compute graph hash
    this.app.post('/api/graphs/hash',
      body('graph').notEmpty().withMessage('Graph data is required'),
      body('format').optional().isIn(['turtle', 'rdfxml', 'jsonld']).withMessage('Invalid format'),
      this._validationHandler,
      async (req, res) => {
        try {
          const { graph, format = 'turtle' } = req.body;
          
          // Create temporary file for CLI bridge
          const tempFile = `/tmp/graph_${this.getDeterministicTimestamp()}.ttl`;
          await require('fs/promises').writeFile(tempFile, graph);
          
          const result = await this.cliBridge.graphHash(tempFile);
          
          // Cleanup
          await require('fs/promises').unlink(tempFile);
          
          res.json(result);
        } catch (error) {
          this._handleApiError(res, error, 'Graph hash computation failed');
        }
      }
    );

    // POST /api/graphs/diff - Compare graphs
    this.app.post('/api/graphs/diff',
      body('graph1').notEmpty().withMessage('First graph is required'),
      body('graph2').notEmpty().withMessage('Second graph is required'),
      this._validationHandler,
      async (req, res) => {
        try {
          const { graph1, graph2 } = req.body;
          
          // Create temporary files
          const tempFile1 = `/tmp/graph1_${this.getDeterministicTimestamp()}.ttl`;
          const tempFile2 = `/tmp/graph2_${this.getDeterministicTimestamp()}.ttl`;
          
          await Promise.all([
            require('fs/promises').writeFile(tempFile1, graph1),
            require('fs/promises').writeFile(tempFile2, graph2)
          ]);
          
          const result = await this.cliBridge.graphDiff(tempFile1, tempFile2);
          
          // Cleanup
          await Promise.all([
            require('fs/promises').unlink(tempFile1),
            require('fs/promises').unlink(tempFile2)
          ]);
          
          res.json(result);
        } catch (error) {
          this._handleApiError(res, error, 'Graph diff computation failed');
        }
      }
    );

    // POST /api/graphs/index - Build graph index
    this.app.post('/api/graphs/index',
      body('graph').notEmpty().withMessage('Graph data is required'),
      this._validationHandler,
      async (req, res) => {
        try {
          const { graph } = req.body;
          
          const tempFile = `/tmp/graph_${this.getDeterministicTimestamp()}.ttl`;
          await require('fs/promises').writeFile(tempFile, graph);
          
          const result = await this.cliBridge.graphIndex(tempFile);
          
          await require('fs/promises').unlink(tempFile);
          
          res.json(result);
        } catch (error) {
          this._handleApiError(res, error, 'Graph indexing failed');
        }
      }
    );
  }

  _setupSemanticRoutes() {
    // POST /api/semantic/reasoning - Perform semantic reasoning
    this.app.post('/api/semantic/reasoning',
      body('graph').notEmpty().withMessage('Graph data is required'),
      body('rules').optional().isArray().withMessage('Rules must be an array'),
      body('options').optional().isObject().withMessage('Options must be an object'),
      this._validationHandler,
      async (req, res) => {
        try {
          const { graph, rules = [], options = {} } = req.body;
          
          const result = await this.orchestrator.performAdvancedReasoning(
            graph, 
            { ...options, rules }
          );
          
          res.json(result);
        } catch (error) {
          this._handleApiError(res, error, 'Semantic reasoning failed');
        }
      }
    );

    // POST /api/semantic/validation - Validate graph
    this.app.post('/api/semantic/validation',
      body('graph').notEmpty().withMessage('Graph data is required'),
      body('constraints').optional().isArray().withMessage('Constraints must be an array'),
      this._validationHandler,
      async (req, res) => {
        try {
          const { graph, constraints = [] } = req.body;
          
          const result = await this.orchestrator.semanticProcessor.validateGraph(
            graph, 
            constraints
          );
          
          res.json(result);
        } catch (error) {
          this._handleApiError(res, error, 'Graph validation failed');
        }
      }
    );

    // POST /api/semantic/query - Execute SPARQL query
    this.app.post('/api/semantic/query',
      body('query').notEmpty().withMessage('SPARQL query is required'),
      body('graph').optional().withMessage('Optional graph data'),
      this._validationHandler,
      async (req, res) => {
        try {
          const { query, graph } = req.body;
          
          const result = await this.orchestrator.executeIntelligentQuery(
            query,
            { graph }
          );
          
          res.json(result);
        } catch (error) {
          this._handleApiError(res, error, 'SPARQL query failed');
        }
      }
    );
  }

  _setupArtifactRoutes() {
    // POST /api/artifacts/generate - Generate artifacts
    this.app.post('/api/artifacts/generate',
      body('graph').notEmpty().withMessage('Graph data is required'),
      body('templates').optional().isArray().withMessage('Templates must be an array'),
      body('options').optional().isObject().withMessage('Options must be an object'),
      this._validationHandler,
      async (req, res) => {
        try {
          const { graph, templates = [], options = {} } = req.body;
          
          const result = await this.orchestrator.generateIntelligentArtifacts(
            graph,
            templates,
            options
          );
          
          res.json(result);
        } catch (error) {
          this._handleApiError(res, error, 'Artifact generation failed');
        }
      }
    );

    // POST /api/artifacts/drift - Check artifact drift
    this.app.post('/api/artifacts/drift',
      body('artifact').notEmpty().withMessage('Artifact content is required'),
      body('attestation').notEmpty().withMessage('Attestation is required'),
      this._validationHandler,
      async (req, res) => {
        try {
          const { artifact, attestation } = req.body;
          
          // Create temporary files for CLI bridge
          const tempArtifact = `/tmp/artifact_${this.getDeterministicTimestamp()}.txt`;
          const tempAttestation = `/tmp/artifact_${this.getDeterministicTimestamp()}.txt.attest.json`;
          
          await Promise.all([
            require('fs/promises').writeFile(tempArtifact, artifact),
            require('fs/promises').writeFile(tempAttestation, JSON.stringify(attestation))
          ]);
          
          const result = await this.cliBridge.artifactDrift(tempArtifact);
          
          // Cleanup
          await Promise.all([
            require('fs/promises').unlink(tempArtifact),
            require('fs/promises').unlink(tempAttestation)
          ]);
          
          res.json(result);
        } catch (error) {
          this._handleApiError(res, error, 'Drift detection failed');
        }
      }
    );
  }

  _setupProjectRoutes() {
    // POST /api/projects/lock - Generate project lockfile
    this.app.post('/api/projects/lock',
      body('project').optional().isObject().withMessage('Project info must be an object'),
      this._validationHandler,
      async (req, res) => {
        try {
          const { project = {} } = req.body;
          
          const result = await this.cliBridge.projectLock(project);
          
          res.json(result);
        } catch (error) {
          this._handleApiError(res, error, 'Project lock generation failed');
        }
      }
    );

    // GET /api/projects/templates - List templates
    this.app.get('/api/projects/templates',
      query('format').optional().isIn(['json', 'table']).withMessage('Invalid format'),
      this._validationHandler,
      async (req, res) => {
        try {
          const { format = 'json' } = req.query;
          
          const result = await this.cliBridge.templatesLs({ format });
          
          res.json(result);
        } catch (error) {
          this._handleApiError(res, error, 'Template listing failed');
        }
      }
    );

    // GET /api/projects/rules - List rules
    this.app.get('/api/projects/rules',
      query('format').optional().isIn(['json', 'table']).withMessage('Invalid format'),
      this._validationHandler,
      async (req, res) => {
        try {
          const { format = 'json' } = req.query;
          
          const result = await this.cliBridge.rulesLs({ format });
          
          res.json(result);
        } catch (error) {
          this._handleApiError(res, error, 'Rules listing failed');
        }
      }
    );
  }

  _setupSystemRoutes() {
    // GET /api/system/status - System status
    this.app.get('/api/system/status', async (req, res) => {
      try {
        const status = this.orchestrator.getComprehensiveStatus();
        res.json(status);
      } catch (error) {
        this._handleApiError(res, error, 'Status retrieval failed');
      }
    });

    // GET /api/system/metrics - Export metrics
    this.app.get('/api/system/metrics',
      query('timeframe').optional().isString().withMessage('Timeframe must be string'),
      this._validationHandler,
      async (req, res) => {
        try {
          const { timeframe = '24h' } = req.query;
          
          const result = await this.cliBridge.metricsExport({ timeframe });
          
          res.json(result);
        } catch (error) {
          this._handleApiError(res, error, 'Metrics export failed');
        }
      }
    );

    // POST /api/system/cache/gc - Cache garbage collection
    this.app.post('/api/system/cache/gc',
      body('policy').optional().isObject().withMessage('Policy must be an object'),
      this._validationHandler,
      async (req, res) => {
        try {
          const { policy = {} } = req.body;
          
          const result = await this.cliBridge.cacheGc(policy);
          
          res.json(result);
        } catch (error) {
          this._handleApiError(res, error, 'Cache GC failed');
        }
      }
    );
  }

  // ========================================
  // DOCUMENTATION & HEALTH CHECKS
  // ========================================

  _setupDocumentation() {
    const swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'KGEN Semantic API',
          version: '1.0.0',
          description: 'Enterprise semantic processing and knowledge graph management API',
          contact: {
            name: 'KGEN Team',
            url: 'https://kgen.enterprise'
          }
        },
        servers: [
          {
            url: `http://${this.config.host}:${this.config.port}`,
            description: 'Development server'
          }
        ],
        components: {
          securitySchemes: {
            apiKey: {
              type: 'apiKey',
              in: 'header',
              name: 'X-API-Key'
            }
          }
        }
      },
      apis: [__filename]
    };

    const swaggerSpec = swaggerJSDoc(swaggerOptions);
    
    this.app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customSiteTitle: 'KGEN Semantic API Documentation'
    }));

    // Serve OpenAPI spec
    this.app.get('/api/docs/openapi.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });
  }

  _setupHealthChecks() {
    // Basic health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: this.getDeterministicDate().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
      });
    });

    // Detailed health check
    this.app.get('/health/detailed', async (req, res) => {
      try {
        const status = this.orchestrator.getComprehensiveStatus();
        
        res.json({
          status: 'healthy',
          timestamp: this.getDeterministicDate().toISOString(),
          components: status.components,
          performance: status.performance,
          quality: status.quality
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: this.getDeterministicDate().toISOString()
        });
      }
    });

    // Readiness probe
    this.app.get('/ready', (req, res) => {
      const ready = this.orchestrator.state === 'ready';
      
      res.status(ready ? 200 : 503).json({
        ready,
        timestamp: this.getDeterministicDate().toISOString()
      });
    });

    // Liveness probe
    this.app.get('/live', (req, res) => {
      res.json({
        alive: true,
        timestamp: this.getDeterministicDate().toISOString()
      });
    });
  }

  // ========================================
  // MIDDLEWARE IMPLEMENTATIONS
  // ========================================

  async _authenticationMiddleware(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'API key is required'
      });
    }

    try {
      // Validate API key (implement your authentication logic)
      const isValid = await this._validateApiKey(apiKey);
      
      if (!isValid) {
        return res.status(401).json({
          error: 'Invalid authentication',
          message: 'API key is invalid'
        });
      }

      req.user = await this._getUserFromApiKey(apiKey);
      next();
    } catch (error) {
      res.status(401).json({
        error: 'Authentication failed',
        message: error.message
      });
    }
  }

  _requestTrackingMiddleware(req, res, next) {
    const requestId = `req_${this.getDeterministicTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;
    
    req.startTime = this.getDeterministicTimestamp();
    this.requestCount++;
    this.activeRequests.set(requestId, {
      method: req.method,
      url: req.url,
      startTime: req.startTime,
      userAgent: req.get('user-agent')
    });

    res.setHeader('X-Request-ID', requestId);

    const originalEnd = res.end;
    res.end = (...args) => {
      const duration = this.getDeterministicTimestamp() - req.startTime;
      this.activeRequests.delete(requestId);
      
      this.logger.info(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
      
      originalEnd.apply(res, args);
    };

    next();
  }

  _performanceMonitoringMiddleware(req, res, next) {
    const startTime = process.hrtime();
    
    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;
      
      const endpoint = `${req.method} ${req.route?.path || req.url}`;
      
      if (!this.performanceMetrics.has(endpoint)) {
        this.performanceMetrics.set(endpoint, {
          count: 0,
          totalTime: 0,
          avgTime: 0,
          minTime: Infinity,
          maxTime: 0
        });
      }
      
      const metrics = this.performanceMetrics.get(endpoint);
      metrics.count++;
      metrics.totalTime += duration;
      metrics.avgTime = metrics.totalTime / metrics.count;
      metrics.minTime = Math.min(metrics.minTime, duration);
      metrics.maxTime = Math.max(metrics.maxTime, duration);
    });
    
    next();
  }

  _auditLoggingMiddleware(req, res, next) {
    const auditLog = {
      timestamp: this.getDeterministicDate().toISOString(),
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      user: req.user?.id || 'anonymous'
    };

    // Log request (implement your audit logging)
    this.logger.info('Audit:', auditLog);
    
    next();
  }

  _validationHandler = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }
    next();
  };

  // ========================================
  // HELPER METHODS
  // ========================================

  _handleApiError(res, error, message) {
    this.logger.error(message, error);
    
    const statusCode = error.statusCode || 500;
    const response = {
      error: message,
      message: error.message
    };

    if (this.config.environment === 'development') {
      response.stack = error.stack;
    }

    res.status(statusCode).json(response);
  }

  _getEndpointList() {
    return [
      'GET /api - API information',
      'POST /api/graphs/hash - Compute graph hash',
      'POST /api/graphs/diff - Compare graphs',
      'POST /api/graphs/index - Build graph index',
      'POST /api/semantic/reasoning - Semantic reasoning',
      'POST /api/semantic/validation - Graph validation',
      'POST /api/semantic/query - SPARQL query',
      'POST /api/artifacts/generate - Generate artifacts',
      'POST /api/artifacts/drift - Check artifact drift',
      'POST /api/projects/lock - Generate project lockfile',
      'GET /api/projects/templates - List templates',
      'GET /api/projects/rules - List rules',
      'GET /api/system/status - System status',
      'GET /api/system/metrics - Export metrics',
      'POST /api/system/cache/gc - Cache garbage collection',
      'GET /api/docs - API documentation',
      'GET /health - Health check',
      'GET /ready - Readiness check',
      'GET /live - Liveness check'
    ];
  }

  // Authentication helper stubs
  async _validateApiKey(apiKey) {
    // Implement your API key validation logic
    return apiKey === 'development-key' || apiKey.startsWith('kgen_');
  }

  async _getUserFromApiKey(apiKey) {
    // Implement user lookup from API key
    return {
      id: 'system',
      name: 'System User',
      permissions: ['read', 'write']
    };
  }
}

export default SemanticAPI;