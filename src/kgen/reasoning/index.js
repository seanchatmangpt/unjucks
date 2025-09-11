/**
 * Federated Reasoning System - Main Entry Point
 * 
 * Comprehensive federated reasoning architecture for distributed semantic
 * processing across multi-agent swarms with consensus, fault tolerance,
 * and enterprise-grade governance.
 */

export { FederatedReasoningCoordinator } from './federated-coordinator.js';
export { DistributedReasoningEngine } from './distributed-engine.js';
export { ConsensusReasoningEngine } from './consensus-engine.js';
export { CollaborativeReasoningEngine } from './collaborative-engine.js';
export { ReasoningCacheSynchronizer } from './cache-synchronizer.js';
export { ReasoningTopologyOptimizer } from './topology-optimizer.js';
export { ReasoningWorkflowOrchestrator } from './workflow-orchestrator.js';
export { ReasoningGovernanceController } from './governance-controller.js';
export { ReasoningAuditProvenance } from './audit-provenance.js';
export { FederatedReasoningValidationSuite } from './validation-suite.js';

/**
 * Federated Reasoning System Factory
 * 
 * Creates and configures a complete federated reasoning system with
 * all components properly integrated and initialized.
 */
export class FederatedReasoningSystem {
  constructor(config = {}) {
    this.config = {
      // System configuration
      mode: config.mode || 'production',
      enableAllComponents: config.enableAllComponents !== false,
      
      // Component configurations
      coordinator: config.coordinator || {},
      distributedEngine: config.distributedEngine || {},
      consensusEngine: config.consensusEngine || {},
      collaborativeEngine: config.collaborativeEngine || {},
      cacheSynchronizer: config.cacheSynchronizer || {},
      topologyOptimizer: config.topologyOptimizer || {},
      workflowOrchestrator: config.workflowOrchestrator || {},
      governanceController: config.governanceController || {},
      auditProvenance: config.auditProvenance || {},
      validationSuite: config.validationSuite || {},
      
      ...config
    };
    
    this.components = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the complete federated reasoning system
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Federated Reasoning System...');
      
      // Initialize core coordinator
      const coordinator = new FederatedReasoningCoordinator(this.config.coordinator);
      await coordinator.initialize();
      this.components.set('coordinator', coordinator);
      
      // Initialize distributed reasoning engine
      const distributedEngine = new DistributedReasoningEngine(this.config.distributedEngine);
      await distributedEngine.initialize();
      this.components.set('distributedEngine', distributedEngine);
      
      // Initialize consensus engine
      const consensusEngine = new ConsensusReasoningEngine(this.config.consensusEngine);
      await consensusEngine.initialize();
      this.components.set('consensusEngine', consensusEngine);
      
      // Initialize collaborative engine
      const collaborativeEngine = new CollaborativeReasoningEngine(this.config.collaborativeEngine);
      await collaborativeEngine.initialize();
      this.components.set('collaborativeEngine', collaborativeEngine);
      
      // Initialize cache synchronizer
      const cacheSynchronizer = new ReasoningCacheSynchronizer(this.config.cacheSynchronizer);
      await cacheSynchronizer.initialize();
      this.components.set('cacheSynchronizer', cacheSynchronizer);
      
      // Initialize topology optimizer
      const topologyOptimizer = new ReasoningTopologyOptimizer(this.config.topologyOptimizer);
      await topologyOptimizer.initialize();
      this.components.set('topologyOptimizer', topologyOptimizer);
      
      // Initialize workflow orchestrator
      const workflowOrchestrator = new ReasoningWorkflowOrchestrator(this.config.workflowOrchestrator);
      await workflowOrchestrator.initialize();
      this.components.set('workflowOrchestrator', workflowOrchestrator);
      
      // Initialize governance controller
      const governanceController = new ReasoningGovernanceController(this.config.governanceController);
      await governanceController.initialize();
      this.components.set('governanceController', governanceController);
      
      // Initialize audit and provenance
      const auditProvenance = new ReasoningAuditProvenance(this.config.auditProvenance);
      await auditProvenance.initialize();
      this.components.set('auditProvenance', auditProvenance);
      
      // Initialize validation suite
      const validationSuite = new FederatedReasoningValidationSuite(this.config.validationSuite);
      await validationSuite.initialize();
      this.components.set('validationSuite', validationSuite);
      
      this.initialized = true;
      
      console.log('✅ Federated Reasoning System initialized successfully');
      console.log(`📊 Components: ${this.components.size}`);
      console.log('🧠 Ready for distributed semantic reasoning across agent swarms');
      
      return {
        status: 'success',
        components: Array.from(this.components.keys()),
        capabilities: this._getSystemCapabilities()
      };
      
    } catch (error) {
      console.error('❌ Failed to initialize Federated Reasoning System:', error);
      throw error;
    }
  }

  /**
   * Get system capabilities and features
   */
  _getSystemCapabilities() {
    return {
      // Core reasoning capabilities
      distributedReasoning: true,
      consensusBasedReasoning: true,
      collaborativeReasoning: true,
      
      // Performance features
      cacheCoherence: true,
      topologyOptimization: true,
      workflowOrchestration: true,
      
      // Enterprise features
      governanceAndCompliance: true,
      auditTrails: true,
      provenanceTracking: true,
      
      // Quality assurance
      comprehensiveValidation: true,
      performanceBenchmarking: true,
      regressionDetection: true,
      
      // Fault tolerance
      byzantineFaultTolerance: true,
      gracefulDegradation: true,
      selfHealing: true,
      
      // Scalability
      horizontalScaling: true,
      dynamicLoadBalancing: true,
      elasticResources: true
    };
  }

  /**
   * Get component by name
   */
  getComponent(componentName) {
    return this.components.get(componentName);
  }

  /**
   * Get all components
   */
  getAllComponents() {
    return new Map(this.components);
  }

  /**
   * Get system status
   */
  getStatus() {
    const componentStatuses = {};
    
    for (const [name, component] of this.components) {
      if (component.getStatus) {
        componentStatuses[name] = component.getStatus();
      }
    }
    
    return {
      initialized: this.initialized,
      components: componentStatuses,
      totalComponents: this.components.size,
      capabilities: this._getSystemCapabilities()
    };
  }

  /**
   * Shutdown the entire federated reasoning system
   */
  async shutdown() {
    try {
      console.log('🔄 Shutting down Federated Reasoning System...');
      
      // Shutdown components in reverse order
      const shutdownOrder = [
        'validationSuite',
        'auditProvenance',
        'governanceController',
        'workflowOrchestrator',
        'topologyOptimizer',
        'cacheSynchronizer',
        'collaborativeEngine',
        'consensusEngine',
        'distributedEngine',
        'coordinator'
      ];
      
      for (const componentName of shutdownOrder) {
        const component = this.components.get(componentName);
        if (component && component.shutdown) {
          await component.shutdown();
          console.log(`✅ ${componentName} shutdown completed`);
        }
      }
      
      this.components.clear();
      this.initialized = false;
      
      console.log('✅ Federated Reasoning System shutdown completed');
      
    } catch (error) {
      console.error('❌ Error during system shutdown:', error);
      throw error;
    }
  }
}

export default FederatedReasoningSystem;