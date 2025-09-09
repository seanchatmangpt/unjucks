const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');

const { errorHandler, notFound } = require('./middleware/error-handler');
const { healthRoutes } = require('./routes/health');
const { metricsRoutes } = require('./routes/metrics');
const { Routes } = require('./routes/');
const database = require('./database');
const logger = require('./utils/logger');
const config = require('./config');

// Import security modules
const secretManager = require('./security/secret-manager');
const secureLogger = require('./utils/secure-logger');

class Server {
  constructor() {
    // Validate secrets before starting server
    try {
      secretManager.validateForProduction();
    } catch (error) {
      secureLogger.error('Server startup failed due to security validation:', error.message);
      process.exit(1);
    }

    this.app = express();
    this.server = null;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // Secure CORS configuration
    this.app.use(cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed list
        if (config.cors.allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        // Reject wildcard origins in production
        if (config.cors.allowedOrigins.includes('*') && process.env.NODE_ENV === 'production') {
          secureLogger.error('SECURITY: Wildcard CORS origin detected in production', { origin });
          return callback(new Error('Wildcard CORS not allowed in production'), false);
        }
        
        secureLogger.warn('CORS request from unauthorized origin', { origin });
        return callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      optionsSuccessStatus: 200
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    

    

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      next();
    });

    
  }

  setupRoutes() {
    // Health check endpoints
    this.app.use('/health', healthRoutes);
    
    // Metrics endpoint
    this.app.use('/metrics', metricsRoutes);

    // API routes with versioning
    const apiRouter = express.Router();
    
    

    

    // Main service routes
    apiRouter.use('/', Routes);

    this.app.use('/api/', apiRouter);

    // API documentation
    this.app.get('/api/docs', (req, res) => {
      res.json({
        service: '',
        version: '',
        description: ' microservice API',
        endpoints: {
          'GET /health': 'Health check endpoint',
          'GET /metrics': 'Prometheus metrics endpoint',
          'GET /api//': 'Main service endpoints'
        },
        
        documentation: `/api///docs`
      });
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use(notFound);
    
    // Global error handler
    this.app.use(errorHandler);
  }

  async start() {
    try {
      // Initialize database connection
      await database.connect();
      logger.info('Database connected successfully');

      

      // Start HTTP server
      this.server = createServer(this.app);
      
      this.server.listen(config.port, () => {
        logger.info(` service started`, {
          port: config.port,
          environment: config.environment,
          version: config.version,
          
          database: 'postgresql',
          monitoring: ''
        });
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  async shutdown() {
    logger.info('Shutting down  service...');
    
    if (this.server) {
      this.server.close(async () => {
        logger.info('HTTP server closed');
        await database.disconnect();
        logger.info('Database connection closed');
        process.exit(0);
      });
    }
  }
}

module.exports = { Server };

// Start server if this file is run directly
if (require.main === module) {
  const server = new Server();
  server.start();
}