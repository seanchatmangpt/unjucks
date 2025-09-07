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

class Server {
  constructor() {
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

    // CORS configuration
    this.app.use(cors({
      origin: config.cors.allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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