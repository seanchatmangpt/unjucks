/**
 * KGEN - Knowledge Graph Engine
 * Main orchestration and unified API entry point
 * Production-ready with monitoring, security, and lifecycle management
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import { config } from './config/default.js';
import { KGenErrorHandler, createEnhancedTryCatch } from './utils/error-handler.js';
import { RDFProcessor } from './rdf/index.js';
import { APIServer } from './api/server.js';
import { DatabaseManager } from './db/index.js';
import { SecurityManager } from './security/index.js';
import { MonitoringSystem } from './monitoring/index.js';
import { CacheManager } from './cache/index.js';
import { ValidationEngine } from './validation/index.js';

class KGenEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = {
      ...config,
      ...options,
      errorHandling: {
        enableRecovery: true,
        maxRetryAttempts: 3,
        retryDelay: 1000,
        enableEventEmission: true,
        ...options.errorHandling
      }
    };
    this.state = 'uninitialized';
    this.subsystems = new Map();
    this.healthChecks = new Map();
    this.shutdownTimeout = 30000; // 30 seconds
    
    // Initialize comprehensive error handler
    this.errorHandler = new KGenErrorHandler(this.config.errorHandling);
    this._setupErrorRecoveryStrategies();
    
    // Setup error handling
    this.setupErrorHandling();
    
    consola.info('🚀 KGEN Engine initialized');
  }

  /**
   * Initialize all subsystems in proper order
   */
  async initialize() {
    try {
      this.state = 'initializing';
      this.emit('state-change', 'initializing');
      
      consola.info('🔧 Initializing KGEN subsystems...');
      
      // Initialize core subsystems in dependency order
      await this.initializeSubsystems();
      
      // Setup health checks
      this.setupHealthChecks();
      
      // Setup graceful shutdown
      this.setupShutdownHandlers();
      
      this.state = 'ready';
      this.emit('state-change', 'ready');
      this.emit('initialized');
      
      consola.success('✅ KGEN Engine ready');
      
      return this;
    } catch (error) {
      const operationId = 'kgen-engine:initialize';
      const errorContext = {
        component: 'kgen-engine',
        operation: 'initialization',
        state: { currentState: this.state, subsystemsCount: this.subsystems.size }
      };
      
      const handlingResult = await this.errorHandler.handleError(
        operationId,
        error,
        errorContext,
        { suppressRethrow: false }
      );
      
      this.state = 'error';
      this.emit('error', {
        operationId,
        error,
        errorContext: handlingResult.errorContext,
        initializationStep: 'subsystem-initialization'
      });
      
      throw error;
    }
  }

  /**
   * Initialize subsystems in proper dependency order
   */
  async initializeSubsystems() {
    const initOrder = [
      { name: 'monitoring', class: MonitoringSystem, deps: [] },
      { name: 'security', class: SecurityManager, deps: ['monitoring'] },
      { name: 'cache', class: CacheManager, deps: ['monitoring'] },
      { name: 'database', class: DatabaseManager, deps: ['monitoring', 'security'] },
      { name: 'validation', class: ValidationEngine, deps: ['monitoring'] },
      { name: 'rdf', class: RDFProcessor, deps: ['monitoring', 'cache', 'validation'] },
      { name: 'api', class: APIServer, deps: ['monitoring', 'security', 'database', 'rdf', 'cache'] }
    ];

    for (const { name, class: SubsystemClass, deps } of initOrder) {
      try {
        consola.info(`🔧 Initializing ${name}...`);
        
        // Check dependencies
        for (const dep of deps) {
          if (!this.subsystems.has(dep)) {
            throw new Error(`Dependency ${dep} not initialized before ${name}`);
          }
        }
        
        const subsystem = new SubsystemClass(this.config[name] || {});
        await subsystem.initialize();
        
        this.subsystems.set(name, subsystem);
        consola.success(`✅ ${name} initialized`);
        
      } catch (error) {
        const operationId = `subsystem-init:${name}`;
        const errorContext = {
          component: 'kgen-engine',
          operation: 'subsystem-initialization',
          input: { subsystemName: name, dependencies: deps },
          state: { initializedSubsystems: Array.from(this.subsystems.keys()) }
        };
        
        await this.errorHandler.handleError(
          operationId,
          error,
          errorContext,
          { suppressRethrow: false }
        );
        
        throw new Error(`Subsystem ${name} initialization failed: ${error.message}`);
      }
    }
  }

  /**
   * Setup health checks for all subsystems
   */
  setupHealthChecks() {
    for (const [name, subsystem] of this.subsystems) {
      if (typeof subsystem.healthCheck === 'function') {
        this.healthChecks.set(name, subsystem.healthCheck.bind(subsystem));
      }
    }
    
    // Setup periodic health monitoring
    setInterval(() => this.performHealthCheck(), this.config.monitoring?.healthCheckInterval || 30000);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const results = {};
    let overallHealthy = true;
    
    for (const [name, healthCheck] of this.healthChecks) {
      try {
        const result = await Promise.race([
          healthCheck(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 5000))
        ]);
        
        results[name] = { status: 'healthy', ...result };
      } catch (error) {
        const operationId = `health-check:${name}`;
        const errorContext = {
          component: 'kgen-engine',
          operation: 'health-check',
          input: { subsystemName: name },
          state: { overallHealthy }
        };
        
        await this.errorHandler.handleError(
          operationId,
          error,
          errorContext,
          { suppressRethrow: true }
        );
        
        results[name] = {
          status: 'unhealthy',
          error: error.message,
          errorId: operationId
        };
        overallHealthy = false;
      }
    }
    
    this.emit('health-check', { overall: overallHealthy ? 'healthy' : 'unhealthy', subsystems: results });
    return results;
  }

  /**
   * Get subsystem by name
   */
  getSubsystem(name) {
    const subsystem = this.subsystems.get(name);
    if (!subsystem) {
      throw new Error(`Subsystem '${name}' not found or not initialized`);
    }
    return subsystem;
  }

  /**
   * Process RDF data through the engine
   */
  async processRDF(data, options = {}) {
    const rdf = this.getSubsystem('rdf');
    const monitoring = this.getSubsystem('monitoring');
    
    const timer = monitoring.startTimer('rdf_processing');
    
    try {
      const result = await rdf.process(data, options);
      timer.end();
      monitoring.incrementCounter('rdf_processed_total');
      return result;
    } catch (error) {
      const operationId = `rdf-process-${Date.now()}`;
      const errorContext = {
        component: 'kgen-engine',
        operation: 'rdf-processing',
        input: { dataType: typeof data, optionsProvided: !!options },
        state: { engineState: this.state }
      };
      
      const handlingResult = await this.errorHandler.handleError(
        operationId,
        error,
        errorContext
      );
      
      timer.end();
      monitoring.incrementCounter('rdf_errors_total');
      
      if (!handlingResult.recovered) {
        throw error;
      }
      
      return handlingResult.result;
    }
  }

  /**
   * Validate RDF data against SHACL shapes
   */
  async validateRDF(data, shapes, options = {}) {
    const validation = this.getSubsystem('validation');
    return validation.validateSHACL(data, shapes, options);
  }

  /**
   * Query the knowledge graph
   */
  async query(sparql, options = {}) {
    const rdf = this.getSubsystem('rdf');
    const cache = this.getSubsystem('cache');
    
    // Check cache if enabled
    if (options.cache !== false) {
      const cached = await cache.get(`query:${Buffer.from(sparql).toString('base64')}`);
      if (cached) return cached;
    }
    
    const result = await rdf.query(sparql, options);
    
    // Cache result if enabled
    if (options.cache !== false) {
      await cache.set(`query:${Buffer.from(sparql).toString('base64')}`, result, options.cacheTTL);
    }
    
    return result;
  }

  /**
   * Start the API server
   */
  async startAPI(port = null) {
    const api = this.getSubsystem('api');
    const actualPort = port || this.config.api?.port || 3000;
    return api.start(actualPort);
  }

  /**
   * Get engine status and metrics
   */
  getStatus() {
    return {
      state: this.state,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      subsystems: Object.fromEntries(
        Array.from(this.subsystems.entries()).map(([name, subsystem]) => [
          name,
          {
            initialized: true,
            status: subsystem.status || 'unknown'
          }
        ])
      ),
      errorHandling: this.errorHandler.getErrorStatistics(),
      version: process.env.npm_package_version || '2.0.8'
    };
  }
  
  /**
   * Setup error recovery strategies for KGEN engine
   */
  _setupErrorRecoveryStrategies() {
    // Subsystem initialization recovery
    this.errorHandler.registerRecoveryStrategy('initialization', async (errorContext, options) => {
      consola.info('Attempting subsystem initialization recovery');
      
      const subsystemName = errorContext.context.input?.subsystemName;
      if (subsystemName && this.subsystems.has(subsystemName)) {
        // Subsystem already exists, consider it recovered
        return { success: true, reason: 'Subsystem already initialized' };
      }
      
      // Could implement retry with different configuration
      return { success: false, reason: 'Manual intervention required for initialization errors' };
    });
    
    // Health check recovery
    this.errorHandler.registerRecoveryStrategy('health_check', async (errorContext, options) => {
      consola.info('Attempting health check recovery');
      
      const subsystemName = errorContext.context.input?.subsystemName;
      const subsystem = this.subsystems.get(subsystemName);
      
      if (subsystem && typeof subsystem.restart === 'function') {
        try {
          await subsystem.restart();
          return { success: true, reason: 'Subsystem restarted successfully' };
        } catch (restartError) {
          return { success: false, reason: `Restart failed: ${restartError.message}` };
        }
      }
      
      return { success: false, reason: 'No restart capability available' };
    });
    
    // Service unavailable recovery
    this.errorHandler.registerRecoveryStrategy('service_unavailable', async (errorContext, options) => {
      consola.info('Attempting service availability recovery');
      
      // Wait for services to become available
      const maxWait = 10000; // 10 seconds
      const checkInterval = 500;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWait) {
        const healthCheck = await this.performHealthCheck();
        if (healthCheck.overall === 'healthy') {
          return { success: true, reason: 'Services are now available' };
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
      
      return { success: false, reason: 'Service recovery timeout' };
    });
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    process.on('uncaughtException', (error) => {
      consola.fatal('Uncaught Exception:', error);
      this.emit('fatal-error', error);
      this.gracefulShutdown(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      consola.fatal('Unhandled Rejection at:', promise, 'reason:', reason);
      this.emit('fatal-error', reason);
      this.gracefulShutdown(1);
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupShutdownHandlers() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        consola.info(`🛑 Received ${signal}, starting graceful shutdown...`);
        this.gracefulShutdown(0);
      });
    });
  }

  /**
   * Graceful shutdown with timeout
   */
  async gracefulShutdown(exitCode = 0) {
    if (this.state === 'shutting-down') return;
    
    this.state = 'shutting-down';
    this.emit('state-change', 'shutting-down');
    
    const shutdownPromise = this.performShutdown();
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        consola.warn('⚠️ Shutdown timeout reached, forcing exit');
        resolve();
      }, this.shutdownTimeout);
    });
    
    await Promise.race([shutdownPromise, timeoutPromise]);
    
    this.state = 'shutdown';
    this.emit('state-change', 'shutdown');
    process.exit(exitCode);
  }

  /**
   * Perform actual shutdown of all subsystems
   */
  async performShutdown() {
    const shutdownOrder = ['api', 'rdf', 'validation', 'database', 'cache', 'security', 'monitoring'];
    
    for (const name of shutdownOrder) {
      const subsystem = this.subsystems.get(name);
      if (subsystem && typeof subsystem.shutdown === 'function') {
        try {
          consola.info(`🔧 Shutting down ${name}...`);
          await subsystem.shutdown();
          consola.success(`✅ ${name} shutdown complete`);
        } catch (error) {
          const operationId = `shutdown:${name}`;
          const errorContext = {
            component: 'kgen-engine',
            operation: 'subsystem-shutdown',
            input: { subsystemName: name },
            state: { shutdownPhase: 'subsystem-cleanup' }
          };
          
          await this.errorHandler.handleError(
            operationId,
            error,
            errorContext,
            { suppressRethrow: true }
          );
        }
      }
    }
    
    consola.success('🛑 KGEN Engine shutdown complete');
  }
}

// Export factory function for easier usage
export function createKGenEngine(options = {}) {
  return new KGenEngine(options);
}

export { KGenEngine };

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const engine = new KGenEngine();
  
  engine.on('initialized', async () => {
    await engine.startAPI();
    consola.success('🌟 KGEN Engine running at http://localhost:3000');
  });
  
  engine.initialize().catch(async error => {
    const operationId = 'kgen-cli:startup';
    const errorContext = {
      component: 'kgen-cli',
      operation: 'startup',
      input: { args: process.argv }
    };
    
    if (engine.errorHandler) {
      await engine.errorHandler.handleError(
        operationId,
        error,
        errorContext,
        { suppressRethrow: true }
      );
    }
    
    consola.fatal('Failed to start KGEN:', error);
    process.exit(1);
  });
}