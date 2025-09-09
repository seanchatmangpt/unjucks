const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const cls = require('cls-hooked');

// Create namespace for correlation context
const correlationNamespace = cls.createNamespace('correlation');

class StructuredLogger {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'unjucks-service';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.version = options.version || process.env.APP_VERSION || '1.0.0';
    
    this.logger = winston.createLogger({
      level: options.level || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        this.correlationFormat()
      ),
      defaultMeta: {
        service: this.serviceName,
        environment: this.environment,
        version: this.version
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        }),
        new winston.transports.File({ 
          filename: 'logs/combined.log',
          maxsize: 10485760,
          maxFiles: 10
        })
      ]
    });

    // Add structured logging methods
    this.addStructuredMethods();
  }

  correlationFormat() {
    return winston.format((info) => {
      const correlationId = this.getCorrelationId();
      const traceId = this.getTraceId();
      const spanId = this.getSpanId();
      
      return {
        ...info,
        correlationId,
        traceId,
        spanId,
        timestamp: new Date().toISOString()
      };
    })();
  }

  getCorrelationId() {
    return correlationNamespace.get('correlationId') || 'no-correlation-id';
  }

  getTraceId() {
    return correlationNamespace.get('traceId') || 'no-trace-id';
  }

  getSpanId() {
    return correlationNamespace.get('spanId') || 'no-span-id';
  }

  generateCorrelationId() {
    return uuidv4();
  }

  withCorrelation(correlationId, traceId, spanId, fn) {
    return correlationNamespace.runAndReturn(() => {
      correlationNamespace.set('correlationId', correlationId);
      correlationNamespace.set('traceId', traceId);
      correlationNamespace.set('spanId', spanId);
      return fn();
    });
  }

  addStructuredMethods() {
    // Business event logging
    this.logEvent = (eventType, eventData, metadata = {}) => {
      this.logger.info('Business Event', {
        eventType,
        eventData,
        ...metadata,
        category: 'business-event'
      });
    };

    // Performance logging
    this.logPerformance = (operation, duration, metadata = {}) => {
      this.logger.info('Performance Metric', {
        operation,
        duration,
        ...metadata,
        category: 'performance'
      });
    };

    // Security logging
    this.logSecurity = (action, userId, resource, outcome, metadata = {}) => {
      this.logger.warn('Security Event', {
        action,
        userId,
        resource,
        outcome,
        ...metadata,
        category: 'security'
      });
    };

    // Error logging with context
    this.logError = (error, context = {}) => {
      this.logger.error('Application Error', {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        context,
        category: 'error'
      });
    };

    // API logging
    this.logAPI = (method, path, statusCode, duration, metadata = {}) => {
      this.logger.info('API Request', {
        method,
        path,
        statusCode,
        duration,
        ...metadata,
        category: 'api'
      });
    };
  }

  // Middleware for Express.js
  middleware() {
    return (req, res, next) => {
      const correlationId = req.headers['x-correlation-id'] || this.generateCorrelationId();
      const traceId = req.headers['x-trace-id'] || this.generateCorrelationId();
      const spanId = this.generateCorrelationId();

      req.correlationId = correlationId;
      req.traceId = traceId;
      req.spanId = spanId;

      res.setHeader('X-Correlation-ID', correlationId);
      res.setHeader('X-Trace-ID', traceId);

      correlationNamespace.bindEmitter(req);
      correlationNamespace.bindEmitter(res);

      correlationNamespace.run(() => {
        correlationNamespace.set('correlationId', correlationId);
        correlationNamespace.set('traceId', traceId);
        correlationNamespace.set('spanId', spanId);

        const startTime = Date.now();
        
        res.on('finish', () => {
          const duration = Date.now() - startTime;
          this.logAPI(req.method, req.path, res.statusCode, duration, {
            userAgent: req.headers['user-agent'],
            ip: req.ip,
            query: req.query,
            body: req.method !== 'GET' ? req.body : undefined
          });
        });

        next();
      });
    };
  }

  // Child logger with additional context
  child(context) {
    return {
      ...this.logger,
      info: (message, meta = {}) => this.logger.info(message, { ...context, ...meta }),
      warn: (message, meta = {}) => this.logger.warn(message, { ...context, ...meta }),
      error: (message, meta = {}) => this.logger.error(message, { ...context, ...meta }),
      debug: (message, meta = {}) => this.logger.debug(message, { ...context, ...meta })
    };
  }
}

module.exports = StructuredLogger;
