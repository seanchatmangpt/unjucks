/**
 * Graceful Degradation System for KGEN
 * 
 * Provides adaptive fallback mechanisms when system components fail:
 * - Feature-level degradation policies
 * - Service availability matrix
 * - Performance-based degradation
 * - User experience preservation
 * - Resource conservation strategies
 */

import { EventEmitter } from 'events';
import { consola } from 'consola';

/**
 * Degradation levels
 */
export const DegradationLevel = {
  NONE: 'none',           // Full functionality
  MINIMAL: 'minimal',     // Minor feature reductions
  MODERATE: 'moderate',   // Significant feature limitations
  SEVERE: 'severe',       // Core features only
  CRITICAL: 'critical'    // Emergency mode
};

/**
 * Service status levels
 */
export const ServiceStatus = {
  OPERATIONAL: 'operational',
  DEGRADED: 'degraded',
  PARTIAL: 'partial',
  UNAVAILABLE: 'unavailable'
};

/**
 * Graceful Degradation Manager
 */
export class GracefulDegradationManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      // Degradation thresholds
      cpuThreshold: options.cpuThreshold || 80,        // CPU usage %
      memoryThreshold: options.memoryThreshold || 85,   // Memory usage %
      errorRateThreshold: options.errorRateThreshold || 10, // Error rate %
      responseTimeThreshold: options.responseTimeThreshold || 5000, // ms
      
      // Monitoring intervals
      monitoringInterval: options.monitoringInterval || 30000, // 30 seconds
      recoveryCheckInterval: options.recoveryCheckInterval || 60000, // 1 minute
      
      // Feature priorities (higher = more important)
      featurePriorities: {
        'core-rendering': 10,
        'rdf-processing': 9,
        'template-caching': 8,
        'semantic-enrichment': 7,
        'artifact-attestation': 6,
        'health-monitoring': 5,
        'metrics-collection': 4,
        'debug-logging': 3,
        'performance-analytics': 2,
        'experimental-features': 1
      },
      
      ...options
    };
    
    this.logger = consola.withTag('graceful-degradation');
    
    // System state
    this.currentDegradationLevel = DegradationLevel.NONE;
    this.serviceStatuses = new Map();
    this.disabledFeatures = new Set();
    this.performanceMetrics = new Map();
    
    // Degradation policies
    this.degradationPolicies = new Map();
    this.recoveryPolicies = new Map();
    
    // Monitoring
    this.monitoringTimer = null;
    this.recoveryTimer = null;
    this.isActive = false;
    
    this._initializeDegradationPolicies();
    this._initializeRecoveryPolicies();
  }
  
  /**
   * Start graceful degradation monitoring
   */
  async start() {
    if (this.isActive) {
      this.logger.warn('Graceful degradation already active');
      return;
    }
    
    this.logger.info('Starting graceful degradation system');
    this.isActive = true;
    
    // Initialize service statuses
    await this._initializeServiceStatuses();
    
    // Start monitoring
    this.monitoringTimer = setInterval(() => {
      this._performSystemCheck();
    }, this.config.monitoringInterval);
    
    this.recoveryTimer = setInterval(() => {
      this._checkForRecovery();
    }, this.config.recoveryCheckInterval);
    
    this.emit('degradation:started');
    this.logger.success('Graceful degradation system started');
  }
  
  /**
   * Stop graceful degradation monitoring
   */
  async stop() {
    if (!this.isActive) {
      return;
    }
    
    this.logger.info('Stopping graceful degradation system');
    this.isActive = false;
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    
    this.emit('degradation:stopped');
    this.logger.info('Graceful degradation system stopped');
  }
  
  /**
   * Manually trigger degradation for a specific reason
   */
  async triggerDegradation(reason, severity = DegradationLevel.MINIMAL, context = {}) {
    this.logger.warn(`Triggering degradation: ${reason} (${severity})`);
    
    const targetLevel = this._calculateDegradationLevel(severity, context);
    
    if (targetLevel !== this.currentDegradationLevel) {
      await this._applyDegradationLevel(targetLevel, reason, context);
    }
    
    return {
      success: true,
      previousLevel: this.currentDegradationLevel,
      currentLevel: targetLevel,
      reason,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Register a service with degradation policies
   */
  registerService(serviceName, options = {}) {
    const serviceConfig = {
      name: serviceName,
      priority: options.priority || 5,
      healthCheck: options.healthCheck || (() => Promise.resolve({ status: 'healthy' })),
      degradationActions: options.degradationActions || {},
      recoveryActions: options.recoveryActions || {},
      dependencies: options.dependencies || [],
      maxResponseTime: options.maxResponseTime || 5000,
      maxErrorRate: options.maxErrorRate || 10,
      ...options
    };
    
    this.serviceStatuses.set(serviceName, {
      ...serviceConfig,
      status: ServiceStatus.OPERATIONAL,
      lastCheck: null,
      errorCount: 0,
      successCount: 0,
      avgResponseTime: 0,
      lastError: null
    });
    
    this.logger.debug(`Registered service: ${serviceName} (priority: ${serviceConfig.priority})`);
    
    return serviceConfig;
  }
  
  /**
   * Update service health status
   */
  updateServiceStatus(serviceName, status, metrics = {}) {
    const service = this.serviceStatuses.get(serviceName);
    if (!service) {
      this.logger.warn(`Unknown service: ${serviceName}`);
      return;
    }
    
    const oldStatus = service.status;
    service.status = status;
    service.lastCheck = Date.now();
    
    // Update metrics
    if (metrics.responseTime) {
      service.avgResponseTime = (service.avgResponseTime + metrics.responseTime) / 2;
    }
    
    if (metrics.error) {
      service.errorCount++;
      service.lastError = metrics.error;
    } else {
      service.successCount++;
    }
    
    // Check if degradation needed
    if (oldStatus !== status && status !== ServiceStatus.OPERATIONAL) {
      this.logger.warn(`Service ${serviceName} status changed: ${oldStatus} -> ${status}`);
      this._evaluateSystemDegradation();
    }
    
    this.emit('service:status:changed', {
      serviceName,
      oldStatus,
      newStatus: status,
      metrics,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get fallback value for failed operation
   */
  getFallbackValue(operationType, context = {}) {
    const fallbackStrategies = {
      'template-render': () => this._getTemplateFallback(context),
      'rdf-parse': () => this._getRDFFallback(context),
      'artifact-generate': () => this._getArtifactFallback(context),
      'cache-lookup': () => this._getCacheFallback(context),
      'health-check': () => this._getHealthFallback(context),
      'default': () => this._getDefaultFallback(context)
    };
    
    const strategy = fallbackStrategies[operationType] || fallbackStrategies['default'];
    const fallback = strategy();
    
    this.logger.debug(`Generated fallback for ${operationType}:`, fallback);
    
    this.emit('fallback:generated', {
      operationType,
      fallback,
      context,
      timestamp: Date.now()
    });
    
    return fallback;
  }
  
  /**
   * Check if feature is available at current degradation level
   */
  isFeatureAvailable(featureName) {
    if (this.disabledFeatures.has(featureName)) {
      return false;
    }
    
    const policy = this.degradationPolicies.get(this.currentDegradationLevel);
    if (!policy) {
      return true;
    }
    
    const featurePriority = this.config.featurePriorities[featureName] || 0;
    return featurePriority >= policy.minFeaturePriority;
  }
  
  /**
   * Get current system status
   */
  getSystemStatus() {
    const services = {};
    for (const [name, service] of this.serviceStatuses) {
      services[name] = {
        status: service.status,
        errorRate: service.errorCount + service.successCount > 0 
          ? (service.errorCount / (service.errorCount + service.successCount) * 100).toFixed(2) + '%'
          : '0%',
        avgResponseTime: Math.round(service.avgResponseTime) + 'ms',
        lastCheck: service.lastCheck ? new Date(service.lastCheck).toISOString() : null
      };
    }
    
    return {
      degradationLevel: this.currentDegradationLevel,
      services,
      disabledFeatures: Array.from(this.disabledFeatures),
      metrics: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      },
      timestamp: new Date().toISOString()
    };
  }
  
  // Private methods
  
  /**
   * Initialize degradation policies
   */
  _initializeDegradationPolicies() {
    // No degradation - all features available
    this.degradationPolicies.set(DegradationLevel.NONE, {
      minFeaturePriority: 0,
      disabledFeatures: [],
      resourceLimits: {},
      fallbackModes: {}
    });
    
    // Minimal degradation - disable lowest priority features
    this.degradationPolicies.set(DegradationLevel.MINIMAL, {
      minFeaturePriority: 2,
      disabledFeatures: ['experimental-features'],
      resourceLimits: {
        maxConcurrentOperations: 80
      },
      fallbackModes: {
        'performance-analytics': 'reduced'
      }
    });
    
    // Moderate degradation - keep essential features only
    this.degradationPolicies.set(DegradationLevel.MODERATE, {
      minFeaturePriority: 5,
      disabledFeatures: ['experimental-features', 'performance-analytics', 'debug-logging', 'metrics-collection'],
      resourceLimits: {
        maxConcurrentOperations: 50,
        maxCacheSize: '50MB'
      },
      fallbackModes: {
        'health-monitoring': 'reduced',
        'artifact-attestation': 'basic'
      }
    });
    
    // Severe degradation - core features only
    this.degradationPolicies.set(DegradationLevel.SEVERE, {
      minFeaturePriority: 8,
      disabledFeatures: ['experimental-features', 'performance-analytics', 'debug-logging', 'metrics-collection', 'health-monitoring', 'artifact-attestation'],
      resourceLimits: {
        maxConcurrentOperations: 20,
        maxCacheSize: '10MB'
      },
      fallbackModes: {
        'template-caching': 'memory-only',
        'semantic-enrichment': 'basic'
      }
    });
    
    // Critical degradation - absolute minimum
    this.degradationPolicies.set(DegradationLevel.CRITICAL, {
      minFeaturePriority: 10,
      disabledFeatures: ['experimental-features', 'performance-analytics', 'debug-logging', 'metrics-collection', 'health-monitoring', 'artifact-attestation', 'semantic-enrichment', 'template-caching'],
      resourceLimits: {
        maxConcurrentOperations: 5,
        maxCacheSize: '1MB'
      },
      fallbackModes: {
        'rdf-processing': 'basic',
        'core-rendering': 'minimal'
      }
    });
  }
  
  /**
   * Initialize recovery policies
   */
  _initializeRecoveryPolicies() {
    this.recoveryPolicies.set(DegradationLevel.MINIMAL, {
      requiredHealthyServices: ['core-rendering'],
      maxErrorRate: 5,
      minUptime: 60000 // 1 minute
    });
    
    this.recoveryPolicies.set(DegradationLevel.MODERATE, {
      requiredHealthyServices: ['core-rendering', 'rdf-processing'],
      maxErrorRate: 3,
      minUptime: 120000 // 2 minutes
    });
    
    this.recoveryPolicies.set(DegradationLevel.SEVERE, {
      requiredHealthyServices: ['core-rendering', 'rdf-processing', 'template-caching'],
      maxErrorRate: 2,
      minUptime: 300000 // 5 minutes
    });
    
    this.recoveryPolicies.set(DegradationLevel.CRITICAL, {
      requiredHealthyServices: ['core-rendering', 'rdf-processing', 'template-caching', 'semantic-enrichment'],
      maxErrorRate: 1,
      minUptime: 600000 // 10 minutes
    });
  }
  
  /**
   * Initialize service statuses
   */
  async _initializeServiceStatuses() {
    // Register core KGEN services if not already registered
    if (!this.serviceStatuses.has('core-rendering')) {
      this.registerService('core-rendering', { priority: 10 });
    }
    
    if (!this.serviceStatuses.has('rdf-processing')) {
      this.registerService('rdf-processing', { priority: 9 });
    }
    
    if (!this.serviceStatuses.has('template-caching')) {
      this.registerService('template-caching', { priority: 8 });
    }
    
    if (!this.serviceStatuses.has('semantic-enrichment')) {
      this.registerService('semantic-enrichment', { priority: 7 });
    }
  }
  
  /**
   * Perform system health check
   */
  async _performSystemCheck() {
    try {
      // Check system resources
      const memUsage = process.memoryUsage();
      const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      // Check services
      for (const [serviceName, service] of this.serviceStatuses) {
        try {
          const healthResult = await Promise.race([
            service.healthCheck(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 5000))
          ]);
          
          const newStatus = this._determineServiceStatus(healthResult, service);
          if (newStatus !== service.status) {
            this.updateServiceStatus(serviceName, newStatus, healthResult);
          }
        } catch (error) {
          this.updateServiceStatus(serviceName, ServiceStatus.UNAVAILABLE, { error: error.message });
        }
      }
      
      // Evaluate if degradation needed
      this._evaluateSystemDegradation();
      
    } catch (error) {
      this.logger.error('System check failed:', error);
    }
  }
  
  /**
   * Determine service status from health check result
   */
  _determineServiceStatus(healthResult, service) {
    if (healthResult.status === 'healthy') {
      return ServiceStatus.OPERATIONAL;
    } else if (healthResult.status === 'degraded') {
      return ServiceStatus.DEGRADED;
    } else if (healthResult.status === 'partial') {
      return ServiceStatus.PARTIAL;
    } else {
      return ServiceStatus.UNAVAILABLE;
    }
  }
  
  /**
   * Evaluate if system degradation is needed
   */
  async _evaluateSystemDegradation() {
    const criticalServices = Array.from(this.serviceStatuses.values())
      .filter(service => service.priority >= 8);
    
    const unavailableServices = criticalServices
      .filter(service => service.status === ServiceStatus.UNAVAILABLE);
    
    const degradedServices = criticalServices
      .filter(service => service.status === ServiceStatus.DEGRADED);
    
    let targetLevel = DegradationLevel.NONE;
    let reason = 'normal_operation';
    
    // Determine degradation level based on service health
    if (unavailableServices.length >= 2) {
      targetLevel = DegradationLevel.CRITICAL;
      reason = `${unavailableServices.length} critical services unavailable`;
    } else if (unavailableServices.length === 1) {
      targetLevel = DegradationLevel.SEVERE;
      reason = `Critical service unavailable: ${unavailableServices[0].name}`;
    } else if (degradedServices.length >= 2) {
      targetLevel = DegradationLevel.MODERATE;
      reason = `${degradedServices.length} services degraded`;
    } else if (degradedServices.length === 1) {
      targetLevel = DegradationLevel.MINIMAL;
      reason = `Service degraded: ${degradedServices[0].name}`;
    }
    
    // Check system resources
    const memUsage = process.memoryUsage();
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (memPercent > 90) {
      targetLevel = Math.max(targetLevel, DegradationLevel.CRITICAL);
      reason = 'critical_memory_usage';
    } else if (memPercent > 80) {
      targetLevel = Math.max(targetLevel, DegradationLevel.SEVERE);
      reason = 'high_memory_usage';
    }
    
    if (targetLevel !== this.currentDegradationLevel) {
      await this._applyDegradationLevel(targetLevel, reason);
    }
  }
  
  /**
   * Apply degradation level
   */
  async _applyDegradationLevel(level, reason, context = {}) {
    const previousLevel = this.currentDegradationLevel;
    this.currentDegradationLevel = level;
    
    const policy = this.degradationPolicies.get(level);
    if (!policy) {
      this.logger.error(`Unknown degradation level: ${level}`);
      return;
    }
    
    // Apply feature restrictions
    this.disabledFeatures.clear();
    policy.disabledFeatures.forEach(feature => {
      this.disabledFeatures.add(feature);
    });
    
    this.logger.warn(`Degradation level changed: ${previousLevel} -> ${level} (${reason})`);
    this.logger.info(`Disabled features: ${Array.from(this.disabledFeatures).join(', ') || 'none'}`);
    
    this.emit('degradation:level:changed', {
      previousLevel,
      currentLevel: level,
      reason,
      disabledFeatures: Array.from(this.disabledFeatures),
      policy,
      context,
      timestamp: Date.now()
    });
  }
  
  /**
   * Check if system can recover to a higher level
   */
  async _checkForRecovery() {
    if (this.currentDegradationLevel === DegradationLevel.NONE) {
      return; // Already at highest level
    }
    
    const currentPolicy = this.recoveryPolicies.get(this.currentDegradationLevel);
    if (!currentPolicy) {
      return;
    }
    
    // Check if recovery conditions are met
    const healthyServices = Array.from(this.serviceStatuses.values())
      .filter(service => service.status === ServiceStatus.OPERATIONAL)
      .map(service => service.name);
    
    const hasRequiredServices = currentPolicy.requiredHealthyServices
      .every(serviceName => healthyServices.includes(serviceName));
    
    if (hasRequiredServices) {
      // Calculate overall error rate
      const totalErrors = Array.from(this.serviceStatuses.values())
        .reduce((sum, service) => sum + service.errorCount, 0);
      const totalCalls = Array.from(this.serviceStatuses.values())
        .reduce((sum, service) => sum + service.errorCount + service.successCount, 0);
      
      const errorRate = totalCalls > 0 ? (totalErrors / totalCalls * 100) : 0;
      
      if (errorRate <= currentPolicy.maxErrorRate) {
        // Attempt recovery
        const targetLevel = this._getNextRecoveryLevel();
        if (targetLevel !== this.currentDegradationLevel) {
          await this._applyDegradationLevel(targetLevel, 'recovery_conditions_met');
        }
      }
    }
  }
  
  /**
   * Get next recovery level
   */
  _getNextRecoveryLevel() {
    const levels = [DegradationLevel.NONE, DegradationLevel.MINIMAL, DegradationLevel.MODERATE, DegradationLevel.SEVERE, DegradationLevel.CRITICAL];
    const currentIndex = levels.indexOf(this.currentDegradationLevel);
    
    if (currentIndex > 0) {
      return levels[currentIndex - 1];
    }
    
    return this.currentDegradationLevel;
  }
  
  /**
   * Calculate appropriate degradation level
   */
  _calculateDegradationLevel(requestedLevel, context) {
    // Can be enhanced with more sophisticated logic
    return requestedLevel;
  }
  
  // Fallback value generators
  
  _getTemplateFallback(context) {
    return {
      success: false,
      content: '// Template rendering unavailable in degraded mode',
      fallback: true,
      reason: 'service_degraded'
    };
  }
  
  _getRDFFallback(context) {
    return {
      success: false,
      triples: [],
      entities: [],
      fallback: true,
      reason: 'rdf_processing_unavailable'
    };
  }
  
  _getArtifactFallback(context) {
    return {
      success: false,
      content: null,
      fallback: true,
      reason: 'artifact_generation_unavailable'
    };
  }
  
  _getCacheFallback(context) {
    return {
      hit: false,
      value: null,
      fallback: true,
      reason: 'cache_unavailable'
    };
  }
  
  _getHealthFallback(context) {
    return {
      status: 'unknown',
      message: 'Health check unavailable in degraded mode',
      fallback: true
    };
  }
  
  _getDefaultFallback(context) {
    const type = context.expectedType || 'object';
    
    const defaults = {
      'string': '',
      'number': 0,
      'boolean': false,
      'array': [],
      'object': {},
      'null': null
    };
    
    return {
      value: defaults[type] || null,
      fallback: true,
      reason: 'default_fallback'
    };
  }
}

export default GracefulDegradationManager;
