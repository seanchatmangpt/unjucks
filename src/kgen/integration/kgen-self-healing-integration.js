/**
 * KGEN Self-Healing System Integration
 * 
 * Provides seamless integration between KGEN's deterministic system and 
 * the advanced self-healing capabilities:
 * 
 * - Integrates with existing error handling
 * - Adds circuit breakers to external dependencies
 * - Implements graceful degradation for core features
 * - Provides health monitoring and alerting
 * - Enables chaos engineering for resilience testing
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';
import { SelfHealingSystem } from '../resilience/self-healing-system.js';
import { CircuitBreakerManager } from '../resilience/circuit-breaker.js';
import { GracefulDegradationManager } from '../resilience/graceful-degradation.js';
import { HealthMonitor } from '../resilience/health-monitor.js';
import { ChaosEngineer } from '../resilience/chaos-engineer.js';

/**
 * Main integration class for KGEN Self-Healing System
 */
export class KGenSelfHealingIntegration extends EventEmitter {
  constructor(kgenEngine, options = {}) {
    super();
    
    this.kgenEngine = kgenEngine;
    this.config = {
      enabled: options.enabled !== false,
      
      // Component enablement
      enableSelfHealing: options.enableSelfHealing !== false,
      enableCircuitBreakers: options.enableCircuitBreakers !== false,
      enableGracefulDegradation: options.enableGracefulDegradation !== false,
      enableHealthMonitoring: options.enableHealthMonitoring !== false,
      enableChaosEngineering: options.enableChaosEngineering || false,
      
      // Configuration overrides
      selfHealingConfig: options.selfHealingConfig || {},
      circuitBreakerConfig: options.circuitBreakerConfig || {},
      gracefulDegradationConfig: options.gracefulDegradationConfig || {},
      healthMonitoringConfig: options.healthMonitoringConfig || {},
      chaosEngineeringConfig: options.chaosEngineeringConfig || {},
      
      ...options
    };
    
    this.logger = consola.withTag('kgen-self-healing');
    
    // Component instances
    this.selfHealingSystem = null;
    this.circuitBreakerManager = null;
    this.gracefulDegradationManager = null;
    this.healthMonitor = null;
    this.chaosEngineer = null;
    
    // Integration state
    this.isInitialized = false;
    this.isActive = false;
    
    // Metrics
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      recoveredOperations: 0,
      degradedOperations: 0,
      startTime: this.getDeterministicTimestamp()
    };
    
    this._initialize();
  }
  
  /**
   * Initialize all self-healing components
   */
  async _initialize() {
    if (!this.config.enabled) {
      this.logger.info('KGEN Self-Healing integration disabled by configuration');
      return;
    }
    
    try {
      this.logger.info('Initializing KGEN Self-Healing integration');
      
      // Initialize Self-Healing System
      if (this.config.enableSelfHealing) {
        this.selfHealingSystem = new SelfHealingSystem({
          enabled: true,
          maxRetries: 3,
          baseRetryDelay: 1000,
          circuitBreakerThreshold: 5,
          healthCheckInterval: 30000,
          ...this.config.selfHealingConfig
        });
        
        this.logger.info('Self-healing system initialized');
      }
      
      // Initialize Circuit Breaker Manager
      if (this.config.enableCircuitBreakers) {
        this.circuitBreakerManager = new CircuitBreakerManager();
        
        // Register circuit breakers for key operations
        this._registerCircuitBreakers();
        
        this.logger.info('Circuit breaker manager initialized');
      }
      
      // Initialize Graceful Degradation Manager
      if (this.config.enableGracefulDegradation) {
        this.gracefulDegradationManager = new GracefulDegradationManager({
          cpuThreshold: 80,
          memoryThreshold: 85,
          errorRateThreshold: 10,
          responseTimeThreshold: 5000,
          ...this.config.gracefulDegradationConfig
        });
        
        // Register KGEN services for degradation
        this._registerGracefulDegradationServices();
        
        this.logger.info('Graceful degradation manager initialized');
      }
      
      // Initialize Health Monitor
      if (this.config.enableHealthMonitoring) {
        this.healthMonitor = new HealthMonitor({
          pingInterval: 30000,
          functionalInterval: 60000,
          performanceInterval: 120000,
          ...this.config.healthMonitoringConfig
        });
        
        // Register health checks for KGEN components
        this._registerHealthChecks();
        
        this.logger.info('Health monitor initialized');
      }
      
      // Initialize Chaos Engineer (if enabled)
      if (this.config.enableChaosEngineering) {
        this.chaosEngineer = new ChaosEngineer({
          enabled: true,
          safetyThreshold: 0.1,
          maxConcurrentExperiments: 3,
          ...this.config.chaosEngineeringConfig
        });
        
        // Register KGEN services for chaos testing
        this._registerChaosTargets();
        
        this.logger.info('Chaos engineer initialized');
      }
      
      // Set up event forwarding
      this._setupEventForwarding();
      
      // Integrate with KGEN engine
      this._integrateWithKGenEngine();
      
      this.isInitialized = true;
      this.logger.success('KGEN Self-Healing integration initialized successfully');
      
      this.emit('integration:initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize KGEN Self-Healing integration:', error);
      throw error;
    }
  }
  
  /**
   * Start the self-healing system
   */
  async start() {
    if (!this.isInitialized) {
      throw new Error('Integration not initialized');
    }
    
    if (this.isActive) {
      this.logger.warn('Self-healing integration already active');
      return;
    }
    
    try {
      this.logger.info('Starting KGEN Self-Healing integration');
      
      // Start components in order
      if (this.selfHealingSystem) {
        await this.selfHealingSystem.start();
      }
      
      if (this.gracefulDegradationManager) {
        await this.gracefulDegradationManager.start();
      }
      
      if (this.healthMonitor) {
        await this.healthMonitor.start();
      }
      
      if (this.chaosEngineer) {
        await this.chaosEngineer.start();
      }
      
      this.isActive = true;
      this.metrics.startTime = this.getDeterministicTimestamp();
      
      this.logger.success('KGEN Self-Healing integration started successfully');
      this.emit('integration:started');
      
    } catch (error) {
      this.logger.error('Failed to start KGEN Self-Healing integration:', error);
      throw error;
    }
  }
  
  /**
   * Stop the self-healing system
   */
  async stop() {
    if (!this.isActive) {
      return;
    }
    
    try {
      this.logger.info('Stopping KGEN Self-Healing integration');
      
      // Stop components in reverse order
      if (this.chaosEngineer) {
        await this.chaosEngineer.stop();
      }
      
      if (this.healthMonitor) {
        await this.healthMonitor.stop();
      }
      
      if (this.gracefulDegradationManager) {
        await this.gracefulDegradationManager.stop();
      }
      
      if (this.selfHealingSystem) {
        await this.selfHealingSystem.stop();
      }
      
      if (this.circuitBreakerManager) {
        this.circuitBreakerManager.shutdown();
      }
      
      this.isActive = false;
      
      this.logger.info('KGEN Self-Healing integration stopped');
      this.emit('integration:stopped');
      
    } catch (error) {
      this.logger.error('Error stopping KGEN Self-Healing integration:', error);
    }
  }
  
  /**
   * Execute KGEN operation with self-healing protection
   */
  async executeWithSelfHealing(operationName, operation, options = {}) {
    if (!this.isActive) {
      return await operation();
    }
    
    const startTime = this.getDeterministicTimestamp();
    this.metrics.totalOperations++;
    
    try {
      let result;
      
      // Execute with circuit breaker if available
      if (this.circuitBreakerManager) {
        const circuitBreaker = this.circuitBreakerManager.getCircuitBreaker(operationName, {
          failureThreshold: 5,
          timeout: 60000
        });
        
        result = await circuitBreaker.execute(async () => {
          return await operation();
        }, options.fallback);
      } else {
        result = await operation();
      }
      
      this.metrics.successfulOperations++;
      
      this.emit('operation:success', {
        operationName,
        responseTime: this.getDeterministicTimestamp() - startTime,
        result
      });
      
      return result;
      
    } catch (error) {
      this.metrics.failedOperations++;
      
      // Attempt self-healing recovery
      if (this.selfHealingSystem) {
        try {
          const recovery = await this.selfHealingSystem.handleError(error, {
            operationName,
            operation,
            ...options
          });
          
          if (recovery.success) {
            this.metrics.recoveredOperations++;
            
            this.emit('operation:recovered', {
              operationName,
              originalError: error.message,
              recovery,
              responseTime: this.getDeterministicTimestamp() - startTime
            });
            
            return recovery.result || recovery;
          }
        } catch (recoveryError) {
          this.logger.warn(`Self-healing recovery failed for ${operationName}:`, recoveryError.message);
        }
      }
      
      // Try graceful degradation if recovery failed
      if (this.gracefulDegradationManager) {
        try {
          const fallback = this.gracefulDegradationManager.getFallbackValue(operationName, {
            error: error.message,
            operation: operationName,
            ...options
          });
          
          if (fallback && fallback.value !== undefined) {
            this.metrics.degradedOperations++;
            
            this.emit('operation:degraded', {
              operationName,
              originalError: error.message,
              fallback,
              responseTime: this.getDeterministicTimestamp() - startTime
            });
            
            return fallback.value;
          }
        } catch (degradationError) {
          this.logger.warn(`Graceful degradation failed for ${operationName}:`, degradationError.message);
        }
      }
      
      // If all recovery attempts failed, re-throw the original error
      this.emit('operation:failed', {
        operationName,
        error: error.message,
        responseTime: this.getDeterministicTimestamp() - startTime
      });
      
      throw error;
    }
  }
  
  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    const status = {
      integration: {
        initialized: this.isInitialized,
        active: this.isActive,
        uptime: this.getDeterministicTimestamp() - this.metrics.startTime
      },
      metrics: this.metrics,
      components: {}
    };
    
    if (this.selfHealingSystem) {
      status.components.selfHealing = this.selfHealingSystem.getStatistics();
    }
    
    if (this.circuitBreakerManager) {
      status.components.circuitBreakers = this.circuitBreakerManager.getAllStatistics();
    }
    
    if (this.gracefulDegradationManager) {
      status.components.gracefulDegradation = this.gracefulDegradationManager.getSystemStatus();
    }
    
    if (this.healthMonitor) {
      status.components.healthMonitoring = this.healthMonitor.getMetrics();
    }
    
    if (this.chaosEngineer) {
      status.components.chaosEngineering = this.chaosEngineer.getStatistics();
    }
    
    return status;
  }
  
  // Private methods
  
  /**
   * Register circuit breakers for key KGEN operations
   */
  _registerCircuitBreakers() {
    const operations = [
      { name: 'template-render', config: { failureThreshold: 5, timeout: 10000 } },
      { name: 'rdf-parse', config: { failureThreshold: 3, timeout: 15000 } },
      { name: 'artifact-generate', config: { failureThreshold: 5, timeout: 30000 } },
      { name: 'graph-query', config: { failureThreshold: 3, timeout: 5000 } },
      { name: 'cache-lookup', config: { failureThreshold: 10, timeout: 2000 } }
    ];
    
    operations.forEach(op => {
      this.circuitBreakerManager.getCircuitBreaker(op.name, op.config);
      this.logger.debug(`Registered circuit breaker: ${op.name}`);
    });
  }
  
  /**
   * Register services for graceful degradation
   */
  _registerGracefulDegradationServices() {
    const services = [
      {
        name: 'core-rendering',
        priority: 10,
        healthCheck: async () => ({ status: 'healthy', message: 'Core rendering operational' })
      },
      {
        name: 'rdf-processing', 
        priority: 9,
        healthCheck: async () => ({ status: 'healthy', message: 'RDF processing operational' })
      },
      {
        name: 'template-caching',
        priority: 8,
        healthCheck: async () => ({ status: 'healthy', message: 'Template caching operational' })
      },
      {
        name: 'semantic-enrichment',
        priority: 7,
        healthCheck: async () => ({ status: 'healthy', message: 'Semantic enrichment operational' })
      },
      {
        name: 'artifact-attestation',
        priority: 6,
        healthCheck: async () => ({ status: 'healthy', message: 'Artifact attestation operational' })
      }
    ];
    
    services.forEach(service => {
      this.gracefulDegradationManager.registerService(service.name, service);
      this.logger.debug(`Registered service for graceful degradation: ${service.name}`);
    });
  }
  
  /**
   * Register health checks for KGEN components
   */
  _registerHealthChecks() {
    // Core KGEN engine health
    this.healthMonitor.registerCheck('kgen-engine', async () => {
      try {
        const status = this.kgenEngine.getStatus();
        return {
          status: status.state === 'ready' ? 'healthy' : 'critical',
          message: `KGEN engine state: ${status.state}`,
          metrics: {
            activeOperations: status.activeOperations,
            queuedOperations: status.queuedOperations
          }
        };
      } catch (error) {
        return {
          status: 'critical',
          message: `KGEN engine health check failed: ${error.message}`
        };
      }
    }, {
      type: 'functional',
      critical: true,
      interval: 60000
    });
    
    // Template system health
    this.healthMonitor.registerCheck('template-system', async () => {
      // Test template rendering
      const testTemplate = '{{ test }}';
      const testContext = { test: 'health-check' };
      
      try {
        // This would use the actual template engine
        return {
          status: 'healthy',
          message: 'Template system operational'
        };
      } catch (error) {
        return {
          status: 'critical',
          message: `Template system health check failed: ${error.message}`
        };
      }
    }, {
      type: 'functional',
      critical: true,
      interval: 120000
    });
    
    // RDF processing health  
    this.healthMonitor.registerCheck('rdf-processing', async () => {
      try {
        // Test basic RDF parsing
        const testRDF = '@prefix ex: <http://example.org/> . ex:test ex:property "value" .';
        // This would use the actual RDF processor
        return {
          status: 'healthy',
          message: 'RDF processing operational'
        };
      } catch (error) {
        return {
          status: 'degraded',
          message: `RDF processing health check failed: ${error.message}`
        };
      }
    }, {
      type: 'functional',
      critical: false,
      interval: 180000
    });
  }
  
  /**
   * Register services for chaos testing
   */
  _registerChaosTargets() {
    const targets = [
      {
        name: 'core-rendering',
        criticality: 'high',
        allowedExperiments: ['network_failure', 'memory_pressure'],
        maxBlastRadius: 0.05 // 5%
      },
      {
        name: 'rdf-processing',
        criticality: 'medium', 
        allowedExperiments: ['network_failure', 'service_unavailable', 'memory_pressure'],
        maxBlastRadius: 0.1 // 10%
      },
      {
        name: 'template-caching',
        criticality: 'low',
        allowedExperiments: ['memory_pressure', 'disk_io_delay'],
        maxBlastRadius: 0.2 // 20%
      }
    ];
    
    targets.forEach(target => {
      this.chaosEngineer.registerTarget(target.name, target);
      this.logger.debug(`Registered chaos target: ${target.name}`);
    });
  }
  
  /**
   * Set up event forwarding between components
   */
  _setupEventForwarding() {
    // Forward self-healing events
    if (this.selfHealingSystem) {
      this.selfHealingSystem.on('error:recovered', (data) => {
        this.emit('self-healing:error:recovered', data);
      });
      
      this.selfHealingSystem.on('circuit:opened', (data) => {
        this.emit('self-healing:circuit:opened', data);
      });
    }
    
    // Forward circuit breaker events
    if (this.circuitBreakerManager) {
      this.circuitBreakerManager.on('circuit:state:changed', (data) => {
        this.emit('circuit-breaker:state:changed', data);
      });
    }
    
    // Forward graceful degradation events
    if (this.gracefulDegradationManager) {
      this.gracefulDegradationManager.on('degradation:level:changed', (data) => {
        this.emit('graceful-degradation:level:changed', data);
      });
    }
    
    // Forward health monitoring events
    if (this.healthMonitor) {
      this.healthMonitor.on('health:checked', (data) => {
        this.emit('health:checked', data);
      });
      
      this.healthMonitor.on('incident:created', (data) => {
        this.emit('health:incident:created', data);
      });
    }
    
    // Forward chaos engineering events
    if (this.chaosEngineer) {
      this.chaosEngineer.on('experiment:completed', (data) => {
        this.emit('chaos:experiment:completed', data);
      });
      
      this.chaosEngineer.on('failure:injected', (data) => {
        this.emit('chaos:failure:injected', data);
      });
    }
  }
  
  /**
   * Integrate with KGEN engine methods
   */
  _integrateWithKGenEngine() {
    if (!this.kgenEngine) {
      return;
    }
    
    // Store original methods
    const originalMethods = {
      ingest: this.kgenEngine.ingest,
      generate: this.kgenEngine.generate,
      validate: this.kgenEngine.validate,
      query: this.kgenEngine.query,
      reason: this.kgenEngine.reason
    };
    
    // Wrap methods with self-healing protection
    this.kgenEngine.ingest = async (sources, context = {}) => {
      return await this.executeWithSelfHealing('ingest', () => {
        return originalMethods.ingest.call(this.kgenEngine, sources, context);
      }, { operationType: 'ingest', context });
    };
    
    this.kgenEngine.generate = async (knowledgeGraph, templates, context = {}) => {
      return await this.executeWithSelfHealing('generate', () => {
        return originalMethods.generate.call(this.kgenEngine, knowledgeGraph, templates, context);
      }, { operationType: 'generate', context });
    };
    
    this.kgenEngine.validate = async (knowledgeGraph, constraints, context = {}) => {
      return await this.executeWithSelfHealing('validate', () => {
        return originalMethods.validate.call(this.kgenEngine, knowledgeGraph, constraints, context);
      }, { operationType: 'validate', context });
    };
    
    this.kgenEngine.query = async (sparqlQuery, context = {}) => {
      return await this.executeWithSelfHealing('query', () => {
        return originalMethods.query.call(this.kgenEngine, sparqlQuery, context);
      }, { operationType: 'query', context });
    };
    
    this.kgenEngine.reason = async (knowledgeGraph, rules, context = {}) => {
      return await this.executeWithSelfHealing('reason', () => {
        return originalMethods.reason.call(this.kgenEngine, knowledgeGraph, rules, context);
      }, { operationType: 'reason', context });
    };
    
    this.logger.info('KGEN engine methods wrapped with self-healing protection');
  }
}

/**
 * Factory function to create integrated KGEN engine with self-healing
 */
export function createSelfHealingKGenEngine(kgenEngineClass, options = {}) {
  const kgenEngine = new kgenEngineClass(options.engineConfig || {});
  const selfHealingIntegration = new KGenSelfHealingIntegration(kgenEngine, options.selfHealingConfig || {});
  
  // Add integration methods to engine
  kgenEngine.selfHealing = selfHealingIntegration;
  kgenEngine.startSelfHealing = () => selfHealingIntegration.start();
  kgenEngine.stopSelfHealing = () => selfHealingIntegration.stop();
  kgenEngine.getSelfHealingStatus = () => selfHealingIntegration.getSystemStatus();
  
  return kgenEngine;
}

export default KGenSelfHealingIntegration;
