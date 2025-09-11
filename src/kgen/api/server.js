/**
 * KGEN API Server
 * RESTful API with Express.js, security middleware, monitoring, and documentation
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import morgan from 'morgan';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { body, param, query, validationResult } from 'express-validator';
import consola from 'consola';
import { EventEmitter } from 'events';

export class APIServer extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.app = express();
    this.server = null;
    this.status = 'uninitialized';
    this.connections = new Set();
    
    // Metrics
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: [],
      activeConnections: 0
    };
  }

  /**
   * Initialize API server
   */
  async initialize() {
    try {
      this.status = 'initializing';
      
      // Setup middleware
      this.setupMiddleware();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup error handling
      this.setupErrorHandling();
      
      // Setup documentation
      if (this.config.swagger?.enabled) {
        this.setupSwagger();
      }
      
      this.status = 'ready';
      consola.success('✅ API Server initialized');
      
      this.emit('initialized');
    } catch (error) {
      this.status = 'error';
      consola.error('❌ API Server initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup middleware
   */
  setupMiddleware() {
    // Security headers
    this.app.use(helmet(this.config.helmet));
    
    // CORS
    this.app.use(cors(this.config.cors));
    
    // Compression
    this.app.use(compression());
    
    // Request parsing
    this.app.use(express.json({ limit: this.config.maxRequestSize || '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: this.config.maxRequestSize || '50mb' }));
    
    // Rate limiting
    if (this.config.rateLimit) {
      const limiter = rateLimit({
        ...this.config.rateLimit,
        handler: (req, res) => {
          this.metrics.errors++;
          res.status(429).json({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.round(this.config.rateLimit.windowMs / 1000)
          });
        }
      });
      this.app.use(limiter);
    }
    
    // Slow down
    if (this.config.slowDown) {
      this.app.use(slowDown(this.config.slowDown));
    }
    
    // Request logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message) => consola.info(message.trim())
      }
    }));
    
    // Request metrics
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      this.metrics.requests++;
      this.metrics.activeConnections++;
      
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.metrics.responseTime.push(responseTime);
        this.metrics.activeConnections--;
        
        // Keep only last 1000 response times
        if (this.metrics.responseTime.length > 1000) {
          this.metrics.responseTime.shift();
        }
        
        if (res.statusCode >= 400) {
          this.metrics.errors++;
        }
      });
      
      next();
    });
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: this.config.version || '2.0.8'
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', (req, res) => {
      const avgResponseTime = this.metrics.responseTime.length > 0 
        ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length 
        : 0;

      res.json({
        requests_total: this.metrics.requests,
        errors_total: this.metrics.errors,
        active_connections: this.metrics.activeConnections,
        average_response_time_ms: Math.round(avgResponseTime),
        memory_usage: process.memoryUsage(),
        uptime_seconds: Math.round(process.uptime())
      });
    });

    // RDF API routes
    this.setupRDFRoutes();
    
    // SPARQL API routes
    this.setupSPARQLRoutes();
    
    // Validation API routes
    this.setupValidationRoutes();
    
    // Management API routes
    this.setupManagementRoutes();
  }

  /**
   * Setup RDF-specific routes
   */
  setupRDFRoutes() {
    const router = express.Router();

    // Parse RDF data
    router.post('/parse',
      [
        body('data').notEmpty().withMessage('RDF data is required'),
        body('format').optional().isIn(['turtle', 'n3', 'ntriples', 'rdfxml', 'jsonld']),
        body('graph').optional().isURL()
      ],
      this.validateRequest,
      async (req, res, next) => {
        try {
          const { data, format = 'turtle', graph, addToStore = false } = req.body;
          
          // Get RDF processor from parent engine
          const rdf = this.parent?.getSubsystem('rdf');
          if (!rdf) {
            return res.status(503).json({ error: 'RDF processor not available' });
          }

          const result = await rdf.parseRDF(data, format);
          
          if (addToStore) {
            rdf.addQuads(result.quads, graph);
          }

          res.json({
            success: true,
            tripleCount: result.count,
            format: result.format,
            prefixes: result.prefixes,
            addedToStore: addToStore
          });
        } catch (error) {
          next(error);
        }
      }
    );

    // Serialize RDF data
    router.get('/serialize',
      [
        query('format').optional().isIn(['turtle', 'n3', 'ntriples', 'rdfxml', 'jsonld']),
        query('graph').optional().isURL()
      ],
      this.validateRequest,
      async (req, res, next) => {
        try {
          const { format = 'turtle', graph } = req.query;
          
          const rdf = this.parent?.getSubsystem('rdf');
          if (!rdf) {
            return res.status(503).json({ error: 'RDF processor not available' });
          }

          let quads = null;
          if (graph) {
            quads = rdf.store.getQuads(null, null, null, rdf.namedNode(graph));
          }

          const serialized = await rdf.serializeRDF(quads, format);

          res.type(this.getContentType(format)).send(serialized);
        } catch (error) {
          next(error);
        }
      }
    );

    // Get store statistics
    router.get('/stats', async (req, res, next) => {
      try {
        const rdf = this.parent?.getSubsystem('rdf');
        if (!rdf) {
          return res.status(503).json({ error: 'RDF processor not available' });
        }

        const stats = rdf.getStats();
        res.json(stats);
      } catch (error) {
        next(error);
      }
    });

    // Clear store
    router.delete('/clear',
      [
        query('graph').optional().isURL()
      ],
      this.validateRequest,
      async (req, res, next) => {
        try {
          const { graph } = req.query;
          
          const rdf = this.parent?.getSubsystem('rdf');
          if (!rdf) {
            return res.status(503).json({ error: 'RDF processor not available' });
          }

          rdf.clear(graph);
          
          res.json({
            success: true,
            message: graph ? `Graph ${graph} cleared` : 'Store cleared'
          });
        } catch (error) {
          next(error);
        }
      }
    );

    this.app.use('/api/rdf', router);
  }

  /**
   * Setup SPARQL routes
   */
  setupSPARQLRoutes() {
    const router = express.Router();

    // SPARQL query endpoint
    router.post('/query',
      [
        body('query').notEmpty().withMessage('SPARQL query is required'),
        body('maxResults').optional().isInt({ min: 1, max: 100000 })
      ],
      this.validateRequest,
      async (req, res, next) => {
        try {
          const { query, maxResults, cache = true } = req.body;
          
          const rdf = this.parent?.getSubsystem('rdf');
          if (!rdf) {
            return res.status(503).json({ error: 'RDF processor not available' });
          }

          const result = await rdf.query(query, { maxResults, cache });
          
          res.json({
            success: true,
            result,
            executionTime: Date.now() // Would be calculated properly
          });
        } catch (error) {
          next(error);
        }
      }
    );

    // SPARQL query endpoint (GET for simple queries)
    router.get('/query',
      [
        query('query').notEmpty().withMessage('SPARQL query is required'),
        query('maxResults').optional().isInt({ min: 1, max: 100000 })
      ],
      this.validateRequest,
      async (req, res, next) => {
        try {
          const { query, maxResults, cache = 'true' } = req.query;
          
          const rdf = this.parent?.getSubsystem('rdf');
          if (!rdf) {
            return res.status(503).json({ error: 'RDF processor not available' });
          }

          const result = await rdf.query(query, { 
            maxResults: maxResults ? parseInt(maxResults) : undefined, 
            cache: cache === 'true' 
          });
          
          res.json({
            success: true,
            result,
            executionTime: Date.now()
          });
        } catch (error) {
          next(error);
        }
      }
    );

    this.app.use('/api/sparql', router);
  }

  /**
   * Setup validation routes
   */
  setupValidationRoutes() {
    const router = express.Router();

    // SHACL validation
    router.post('/shacl',
      [
        body('data').notEmpty().withMessage('RDF data is required'),
        body('shapes').notEmpty().withMessage('SHACL shapes are required'),
        body('dataFormat').optional().isIn(['turtle', 'n3', 'ntriples', 'rdfxml', 'jsonld']),
        body('shapesFormat').optional().isIn(['turtle', 'n3', 'ntriples', 'rdfxml', 'jsonld'])
      ],
      this.validateRequest,
      async (req, res, next) => {
        try {
          const { 
            data, 
            shapes, 
            dataFormat = 'turtle', 
            shapesFormat = 'turtle',
            allowWarnings = false 
          } = req.body;
          
          const validation = this.parent?.getSubsystem('validation');
          if (!validation) {
            return res.status(503).json({ error: 'Validation engine not available' });
          }

          const result = await validation.validateSHACL(data, shapes, {
            dataFormat,
            shapesFormat,
            allowWarnings
          });
          
          res.json({
            success: true,
            valid: result.conforms,
            violations: result.results || [],
            report: result
          });
        } catch (error) {
          next(error);
        }
      }
    );

    this.app.use('/api/validate', router);
  }

  /**
   * Setup management routes
   */
  setupManagementRoutes() {
    const router = express.Router();

    // System status
    router.get('/status', async (req, res, next) => {
      try {
        const status = this.parent?.getStatus() || {
          state: 'unknown',
          message: 'Parent engine not available'
        };
        
        res.json(status);
      } catch (error) {
        next(error);
      }
    });

    // System health check
    router.get('/health-check', async (req, res, next) => {
      try {
        const healthCheck = await this.parent?.performHealthCheck() || {
          overall: 'unknown',
          subsystems: {}
        };
        
        res.json(healthCheck);
      } catch (error) {
        next(error);
      }
    });

    this.app.use('/api/system', router);
  }

  /**
   * Setup Swagger documentation
   */
  setupSwagger() {
    const swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: this.config.swagger.title,
          description: this.config.swagger.description,
          version: this.config.swagger.version
        },
        servers: [
          {
            url: this.config.baseUrl || `http://localhost:${this.config.port}`,
            description: 'KGEN API Server'
          }
        ]
      },
      apis: [__filename] // This file contains route definitions
    };

    const swaggerSpec = swaggerJSDoc(swaggerOptions);
    
    this.app.use(
      this.config.swagger.path,
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec)
    );

    consola.info(`📚 API documentation available at ${this.config.swagger.path}`);
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      consola.error('API Error:', error);
      
      // Don't leak error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      res.status(error.status || 500).json({
        error: error.name || 'Internal Server Error',
        message: error.message || 'An unexpected error occurred',
        ...(isDevelopment && { stack: error.stack }),
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Validation middleware
   */
  validateRequest(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Request validation failed',
        details: errors.array()
      });
    }
    next();
  }

  /**
   * Start the server
   */
  async start(port = 3000) {
    return new Promise((resolve, reject) => {
      const actualPort = port || this.config.port || 3000;
      const host = this.config.host || '0.0.0.0';
      
      this.server = this.app.listen(actualPort, host, (error) => {
        if (error) {
          this.status = 'error';
          reject(error);
          return;
        }
        
        this.status = 'running';
        
        // Track connections for graceful shutdown
        this.server.on('connection', (socket) => {
          this.connections.add(socket);
          socket.on('close', () => {
            this.connections.delete(socket);
          });
        });
        
        consola.success(`🚀 API Server listening on ${host}:${actualPort}`);
        this.emit('started', { port: actualPort, host });
        
        resolve({ port: actualPort, host });
      });
      
      this.server.on('error', (error) => {
        this.status = 'error';
        this.emit('error', error);
      });
    });
  }

  /**
   * Stop the server
   */
  async stop() {
    if (!this.server) return;
    
    return new Promise((resolve) => {
      // Close all connections
      for (const connection of this.connections) {
        connection.destroy();
      }
      
      this.server.close(() => {
        this.status = 'stopped';
        consola.info('🛑 API Server stopped');
        this.emit('stopped');
        resolve();
      });
    });
  }

  /**
   * Health check
   */
  async healthCheck() {
    return {
      status: this.status,
      metrics: {
        ...this.metrics,
        avgResponseTime: this.metrics.responseTime.length > 0 
          ? Math.round(this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length)
          : 0
      }
    };
  }

  /**
   * Shutdown server
   */
  async shutdown() {
    await this.stop();
    this.removeAllListeners();
    consola.info('🛑 API Server shutdown complete');
  }

  /**
   * Get content type for RDF format
   */
  getContentType(format) {
    const contentTypes = {
      turtle: 'text/turtle',
      n3: 'text/n3',
      ntriples: 'application/n-triples',
      rdfxml: 'application/rdf+xml',
      jsonld: 'application/ld+json'
    };
    
    return contentTypes[format] || 'text/plain';
  }

  /**
   * Set parent engine reference
   */
  setParent(engine) {
    this.parent = engine;
  }
}