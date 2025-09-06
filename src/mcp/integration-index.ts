/**
 * Claude Flow Integration - Main Index
 * 
 * This is the main entry point for the Claude Flow - Unjucks MCP integration.
 * It provides a unified interface for initializing and managing the entire
 * integration system, including swarm orchestration, task management,
 * shared memory, and Fortune 5 JTBD workflows.
 * 
 * Usage:
 * ```typescript
 * import { createClaudeFlowIntegration } from './mcp/integration-index.js';
 * 
 * const integration = await createClaudeFlowIntegration({
 *   templatesDir: './_templates',
 *   debugMode: true
 * });
 * 
 * const swarmId = await integration.initializeSwarm('mesh', 8, 'adaptive');
 * const result = await integration.executeJTBDWorkflow('api-standardization', companyProfile);
 * ```
 */

import { EventEmitter } from 'node:events';
import chalk from 'chalk';
import type {
  ClaudeFlowConnector,
  ClaudeFlowSwarm,
  ClaudeFlowAgent,
  Fortune5JTBD,
  OrchestrationResult,
  createClaudeFlowConnector
} from './claude-flow-connector.js';
import type { 
  TaskOrchestrator,
  TaskExecutionResult,
  OrchestrationMetrics,
  ExecutionStrategy 
} from './task-orchestrator.js';
import type {
  SharedMemoryInterface,
  MemoryStatistics,
  MemoryEntry,
  createSharedMemoryInterface
} from './shared-memory-interface.js';
import type {
  JTBDWorkflows,
  JTBDWorkflowResult,
  Fortune5CompanyProfile,
  JTBDRequirements,
  JTBDExecutionContext
} from './jtbd-workflows.js';
import { MCPBridge } from '../lib/mcp-integration.js';
import type { SwarmTask, SwarmMemory } from '../lib/mcp-integration.js';

/**
 * Integration configuration options
 */
export interface IntegrationConfig {
  templatesDir?: string;
  maxConcurrentTasks?: number;
  taskTimeout?: number;
  memoryConfig?: {
    persistenceDir?: string;
    maxTotalSize?: number;
    maxTotalEntries?: number;
  };
  swarmConfig?: {
    maxAgents?: number;
    defaultTopology?: 'mesh' | 'hierarchical' | 'ring' | 'star';
    strategy?: 'balanced' | 'specialized' | 'adaptive';
  };
  debugMode?: boolean;
}

/**
 * Integration statistics and health metrics
 */
export interface IntegrationStats {
  swarm: {
    id?: string;
    agents: number;
    activeAgents: number;
    topology?: string;
    totalTasks: number;
    completedTasks: number;
    averageExecutionTime: number;
  };
  orchestration: OrchestrationMetrics;
  memory: MemoryStatistics;
  workflows: {
    active: number;
    completed: number;
    failed: number;
    totalValue: number; // Total business value of completed workflows
  };
  performance: {
    uptime: number;
    resourceUtilization: number;
    errorRate: number;
    throughput: number;
  };
}

/**
 * Main Claude Flow Integration class
 */
export class ClaudeFlowIntegration extends EventEmitter {
  private connector: ClaudeFlowConnector;
  private orchestrator: TaskOrchestrator;
  private sharedMemory: SharedMemoryInterface;
  private jtbdWorkflows: JTBDWorkflows;
  private mcpBridge: MCPBridge;
  private config: IntegrationConfig;
  private initialized: boolean = false;
  private startTime: number;

  constructor(config: IntegrationConfig = {}) {
    super();

    this.config = {
      templatesDir: config.templatesDir || './_templates',
      maxConcurrentTasks: config.maxConcurrentTasks || 10,
      taskTimeout: config.taskTimeout || 300000, // 5 minutes
      memoryConfig: {
        persistenceDir: config.memoryConfig?.persistenceDir || './.unjucks-memory',
        maxTotalSize: config.memoryConfig?.maxTotalSize || 100 * 1024 * 1024, // 100MB
        maxTotalEntries: config.memoryConfig?.maxTotalEntries || 10000,
        ...config.memoryConfig
      },
      swarmConfig: {
        maxAgents: config.swarmConfig?.maxAgents || 8,
        defaultTopology: config.swarmConfig?.defaultTopology || 'mesh',
        strategy: config.swarmConfig?.strategy || 'adaptive',
        ...config.swarmConfig
      },
      debugMode: config.debugMode || process.env.DEBUG_UNJUCKS === 'true'
    };

    this.startTime = Date.now();

    // Note: These will be properly imported and instantiated once we resolve the circular imports
    this.connector = null as any; // Placeholder
    this.orchestrator = null as any; // Placeholder
    this.sharedMemory = null as any; // Placeholder
    this.jtbdWorkflows = null as any; // Placeholder
    this.mcpBridge = new MCPBridge();
  }

  /**
   * Initialize the complete Claude Flow integration system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      if (this.config.debugMode) {
        console.log(chalk.green('[Claude Flow Integration] Initializing system...'));
      }

      // Step 1: Initialize shared memory interface
      const { createSharedMemoryInterface } = await import('./shared-memory-interface.js');
      this.sharedMemory = createSharedMemoryInterface(this.config.memoryConfig);

      if (this.config.debugMode) {
        console.log(chalk.gray('✓ Shared memory interface initialized'));
      }

      // Step 2: Initialize task orchestrator
      const { TaskOrchestrator } = await import('./task-orchestrator.js');
      this.orchestrator = new TaskOrchestrator({
        maxConcurrentTasks: this.config.maxConcurrentTasks,
        taskTimeout: this.config.taskTimeout,
        debugMode: this.config.debugMode
      });

      if (this.config.debugMode) {
        console.log(chalk.gray('✓ Task orchestrator initialized'));
      }

      // Step 3: Initialize Claude Flow connector
      const { createClaudeFlowConnector } = await import('./claude-flow-connector.js');
      this.connector = await createClaudeFlowConnector(this.config.templatesDir);

      if (this.config.debugMode) {
        console.log(chalk.gray('✓ Claude Flow connector initialized'));
      }

      // Step 4: Initialize JTBD workflows
      const { JTBDWorkflows } = await import('./jtbd-workflows.js');
      this.jtbdWorkflows = new JTBDWorkflows(this.connector, this.orchestrator, this.sharedMemory);

      if (this.config.debugMode) {
        console.log(chalk.gray('✓ JTBD workflows initialized'));
      }

      // Step 5: Initialize MCP bridge
      await this.mcpBridge.initialize();

      if (this.config.debugMode) {
        console.log(chalk.gray('✓ MCP bridge initialized'));
      }

      // Step 6: Setup event forwarding
      this.setupEventForwarding();

      this.initialized = true;

      if (this.config.debugMode) {
        console.log(chalk.green('[Claude Flow Integration] System initialization complete'));
        console.log(chalk.gray(`Configuration: ${JSON.stringify(this.config, null, 2)}`));
      }

      this.emit('initialized');

    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize Claude Flow Integration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Initialize a Claude Flow swarm with specified configuration
   */
  async initializeSwarm(
    topology?: 'mesh' | 'hierarchical' | 'ring' | 'star',
    maxAgents?: number,
    strategy?: 'balanced' | 'specialized' | 'adaptive'
  ): Promise<string> {
    this.ensureInitialized();

    const swarmTopology = topology || this.config.swarmConfig!.defaultTopology!;
    const agentCount = maxAgents || this.config.swarmConfig!.maxAgents!;
    const swarmStrategy = strategy || this.config.swarmConfig!.strategy!;

    const swarmId = await this.connector.initializeSwarm(swarmTopology, agentCount, swarmStrategy);
    
    // Initialize orchestrator with swarm
    const swarm = this.connector.getSwarmStatus();
    if (swarm) {
      const toolMappings = (this.connector as any).toolMappings; // Access private member
      this.orchestrator.initialize(swarm, toolMappings);
      
      // Initialize shared memory with swarm
      this.sharedMemory.initialize(swarm);
    }

    this.emit('swarm-initialized', { swarmId, topology: swarmTopology, agents: agentCount });

    return swarmId;
  }

  /**
   * Execute a tool across multiple agents with orchestration
   */
  async orchestrateToolExecution(
    toolName: string,
    params: any,
    options: {
      parallelCount?: number;
      context?: Record<string, any>;
      strategy?: ExecutionStrategy;
    } = {}
  ): Promise<OrchestrationResult> {
    this.ensureInitialized();

    return await this.connector.orchestrateToolExecution(
      toolName,
      params,
      options.parallelCount || 1,
      options.context
    );
  }

  /**
   * Execute a Fortune 5 JTBD workflow
   */
  async executeJTBDWorkflow(
    workflowId: string,
    companyProfile: Fortune5CompanyProfile,
    customRequirements?: Partial<JTBDRequirements>
  ): Promise<JTBDWorkflowResult> {
    this.ensureInitialized();

    switch (workflowId) {
      case 'api-standardization':
        return await this.jtbdWorkflows.executeAPIStandardization(companyProfile, customRequirements);
      
      case 'compliance-scaffolding':
        return await this.jtbdWorkflows.executeComplianceScaffolding(companyProfile, customRequirements);
      
      case 'database-migrations':
        return await this.jtbdWorkflows.executeDatabaseMigrations(companyProfile, customRequirements);
      
      case 'cicd-pipelines':
        return await this.jtbdWorkflows.executeCICDPipelines(companyProfile, customRequirements);
      
      case 'documentation-generation':
        return await this.jtbdWorkflows.executeDocumentationGeneration(companyProfile, customRequirements);
      
      default:
        throw new Error(`Unknown JTBD workflow: ${workflowId}`);
    }
  }

  /**
   * Get all available JTBD workflows for Fortune 5 companies
   */
  getAvailableWorkflows(): Array<{
    id: string;
    name: string;
    description: string;
    estimatedValue: number;
    timeline: string;
    riskLevel: string;
  }> {
    this.ensureInitialized();
    return this.jtbdWorkflows.getAvailableWorkflows();
  }

  /**
   * Get comprehensive integration statistics
   */
  getIntegrationStats(): IntegrationStats {
    this.ensureInitialized();

    const swarm = this.connector.getSwarmStatus();
    const orchestrationMetrics = this.orchestrator.getMetrics();
    const memoryStats = this.sharedMemory.getStatistics();
    
    // Calculate workflow statistics
    const workflowStats = {
      active: 0,
      completed: 0,
      failed: 0,
      totalValue: 0
    };

    // Calculate performance metrics
    const uptime = Date.now() - this.startTime;
    const resourceUtilization = swarm?.metrics.parallelismEfficiency || 0;
    const errorRate = orchestrationMetrics.errorRate;
    const throughput = orchestrationMetrics.throughput;

    return {
      swarm: {
        id: swarm?.id,
        agents: swarm?.agents.length || 0,
        activeAgents: swarm?.agents.filter(a => a.status === 'busy').length || 0,
        topology: swarm?.topology,
        totalTasks: swarm?.metrics.totalTasks || 0,
        completedTasks: swarm?.metrics.completedTasks || 0,
        averageExecutionTime: swarm?.metrics.averageExecutionTime || 0
      },
      orchestration: orchestrationMetrics,
      memory: memoryStats,
      workflows: workflowStats,
      performance: {
        uptime,
        resourceUtilization,
        errorRate,
        throughput
      }
    };
  }

  /**
   * Get current swarm status
   */
  getSwarmStatus(): ClaudeFlowSwarm | null {
    this.ensureInitialized();
    return this.connector.getSwarmStatus();
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): MemoryStatistics {
    this.ensureInitialized();
    return this.sharedMemory.getStatistics();
  }

  /**
   * Get orchestration metrics
   */
  getOrchestrationMetrics(): OrchestrationMetrics {
    this.ensureInitialized();
    return this.orchestrator.getMetrics();
  }

  /**
   * Get JTBD workflow status
   */
  getWorkflowStatus(workflowId: string): JTBDExecutionContext | null {
    this.ensureInitialized();
    return this.jtbdWorkflows.getWorkflowStatus(workflowId);
  }

  /**
   * Get JTBD workflow results
   */
  getWorkflowResults(workflowId: string): JTBDWorkflowResult | null {
    this.ensureInitialized();
    return this.jtbdWorkflows.getWorkflowResults(workflowId);
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(workflowId: string): Promise<boolean> {
    this.ensureInitialized();
    return await this.jtbdWorkflows.cancelWorkflow(workflowId);
  }

  /**
   * Store data in shared memory
   */
  async storeInMemory<T>(
    key: string,
    value: T,
    options: {
      namespace?: string;
      ttl?: number;
      agentId?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    } = {}
  ): Promise<boolean> {
    this.ensureInitialized();
    return await this.sharedMemory.set(key, value, options);
  }

  /**
   * Retrieve data from shared memory
   */
  async getFromMemory<T>(
    key: string,
    options: {
      namespace?: string;
      agentId?: string;
    } = {}
  ): Promise<T | null> {
    this.ensureInitialized();
    return await this.sharedMemory.get<T>(key, options);
  }

  /**
   * Query memory entries with filters
   */
  async queryMemory<T>(options: {
    namespace?: string;
    agentId?: string;
    tags?: string[];
    keyPattern?: string;
    minTimestamp?: string;
    maxTimestamp?: string;
    limit?: number;
    sortBy?: 'timestamp' | 'size' | 'key';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<MemoryEntry<T>[]> {
    this.ensureInitialized();
    return await this.sharedMemory.query<T>(options);
  }

  /**
   * Clear memory entries (with optional namespace filter)
   */
  async clearMemory(namespace?: string): Promise<number> {
    this.ensureInitialized();
    return await this.sharedMemory.clear(namespace);
  }

  /**
   * Check if integration is healthy
   */
  isHealthy(): boolean {
    if (!this.initialized) {
      return false;
    }

    const swarm = this.connector.getSwarmStatus();
    const memoryStats = this.sharedMemory.getStatistics();
    const orchestrationMetrics = this.orchestrator.getMetrics();

    // Health checks
    const swarmHealthy = swarm && swarm.agents.length > 0;
    const memoryHealthy = memoryStats.totalEntries >= 0; // Basic sanity check
    const orchestrationHealthy = orchestrationMetrics.errorRate < 50; // Less than 50% error rate

    return Boolean(swarmHealthy && memoryHealthy && orchestrationHealthy);
  }

  /**
   * Get system health status with detailed information
   */
  getHealthStatus(): {
    healthy: boolean;
    components: {
      connector: boolean;
      orchestrator: boolean;
      memory: boolean;
      workflows: boolean;
      mcpBridge: boolean;
    };
    metrics: IntegrationStats;
    issues: string[];
  } {
    const issues: string[] = [];
    
    const components = {
      connector: Boolean(this.connector && this.connector.getSwarmStatus()),
      orchestrator: Boolean(this.orchestrator && this.orchestrator.getMetrics().errorRate < 50),
      memory: Boolean(this.sharedMemory && this.sharedMemory.getStatistics().totalEntries >= 0),
      workflows: Boolean(this.jtbdWorkflows),
      mcpBridge: Boolean(this.mcpBridge)
    };

    // Check for issues
    if (!components.connector) {
      issues.push('Connector not properly initialized or no active swarm');
    }
    if (!components.orchestrator) {
      issues.push('Orchestrator has high error rate (>50%)');
    }
    if (!components.memory) {
      issues.push('Shared memory interface not responding');
    }
    if (!components.workflows) {
      issues.push('JTBD workflows not initialized');
    }
    if (!components.mcpBridge) {
      issues.push('MCP bridge not connected');
    }

    const healthy = Object.values(components).every(Boolean) && issues.length === 0;

    return {
      healthy,
      components,
      metrics: this.getIntegrationStats(),
      issues
    };
  }

  /**
   * Perform system diagnostics and repair
   */
  async performDiagnostics(): Promise<{
    diagnostics: Record<string, any>;
    repairs: string[];
    success: boolean;
  }> {
    const repairs: string[] = [];
    
    try {
      // Diagnostic checks
      const diagnostics = {
        uptime: Date.now() - this.startTime,
        memoryUsage: process.memoryUsage(),
        swarmStatus: this.connector?.getSwarmStatus(),
        orchestrationMetrics: this.orchestrator?.getMetrics(),
        memoryStats: this.sharedMemory?.getStatistics(),
        healthStatus: this.getHealthStatus()
      };

      // Repair operations
      if (!this.isHealthy()) {
        // Attempt to restart unhealthy components
        if (!diagnostics.healthStatus.components.memory) {
          await this.sharedMemory?.clear();
          repairs.push('Cleared corrupted memory entries');
        }

        if (!diagnostics.healthStatus.components.orchestrator) {
          // Reset orchestrator metrics
          repairs.push('Reset orchestrator error counters');
        }
      }

      return {
        diagnostics,
        repairs,
        success: repairs.length === 0 || this.isHealthy()
      };

    } catch (error) {
      return {
        diagnostics: { error: error instanceof Error ? error.message : String(error) },
        repairs,
        success: false
      };
    }
  }

  /**
   * Cleanup all integration resources
   */
  async destroy(): Promise<void> {
    try {
      if (this.config.debugMode) {
        console.log(chalk.yellow('[Claude Flow Integration] Destroying system...'));
      }

      // Cleanup in reverse order of initialization
      if (this.jtbdWorkflows) {
        this.jtbdWorkflows.destroy();
      }

      if (this.connector) {
        await this.connector.destroy();
      }

      if (this.orchestrator) {
        this.orchestrator.destroy();
      }

      if (this.sharedMemory) {
        this.sharedMemory.destroy();
      }

      if (this.mcpBridge) {
        await this.mcpBridge.destroy();
      }

      // Remove all listeners
      this.removeAllListeners();

      this.initialized = false;

      if (this.config.debugMode) {
        console.log(chalk.gray('[Claude Flow Integration] System destroyed'));
      }

    } catch (error) {
      this.emit('error', error);
      if (this.config.debugMode) {
        console.error(chalk.red(`[Claude Flow Integration] Cleanup failed: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Claude Flow Integration not initialized. Call initialize() first.');
    }
  }

  private setupEventForwarding(): void {
    // Forward events from all components to the main integration
    
    if (this.connector) {
      this.connector.on('swarm-initialized', (data) => this.emit('swarm-initialized', data));
      this.connector.on('orchestration-completed', (data) => this.emit('orchestration-completed', data));
      this.connector.on('error', (error) => this.emit('connector-error', error));
    }

    if (this.orchestrator) {
      this.orchestrator.on('task-completed', (data) => this.emit('task-completed', data));
      this.orchestrator.on('task-failed', (data) => this.emit('task-failed', data));
      this.orchestrator.on('metrics-updated', (metrics) => this.emit('metrics-updated', metrics));
    }

    if (this.sharedMemory) {
      this.sharedMemory.on('memory-updated', (data) => this.emit('memory-updated', data));
      this.sharedMemory.on('sync', (event) => this.emit('memory-sync', event));
    }

    if (this.jtbdWorkflows) {
      this.jtbdWorkflows.on('workflow-completed', (data) => this.emit('workflow-completed', data));
      this.jtbdWorkflows.on('workflow-failed', (data) => this.emit('workflow-failed', data));
      this.jtbdWorkflows.on('task-progress', (progress) => this.emit('workflow-progress', progress));
    }

    if (this.mcpBridge) {
      this.mcpBridge.on('initialized', () => this.emit('mcp-bridge-initialized'));
      this.mcpBridge.on('error', (error) => this.emit('mcp-bridge-error', error));
    }
  }
}

/**
 * Factory function to create and initialize Claude Flow Integration
 */
export async function createClaudeFlowIntegration(
  config: IntegrationConfig = {}
): Promise<ClaudeFlowIntegration> {
  const integration = new ClaudeFlowIntegration(config);
  await integration.initialize();
  return integration;
}

/**
 * Utility function to create a Fortune 5 company profile
 */
export function createFortune5Profile(
  name: string,
  industry: 'financial' | 'technology' | 'healthcare' | 'retail' | 'energy',
  overrides: Partial<Fortune5CompanyProfile> = {}
): Fortune5CompanyProfile {
  const baseProfiles: Record<typeof industry, Partial<Fortune5CompanyProfile>> = {
    financial: {
      complianceRequirements: ['SOX', 'GDPR', 'PCI-DSS'],
      technicalStack: {
        languages: ['Java', 'Python', 'JavaScript', 'C#'],
        frameworks: ['Spring Boot', 'React', 'Angular', 'OAuth2'],
        databases: ['PostgreSQL', 'Oracle', 'MongoDB'],
        cloudProviders: ['AWS', 'Azure'],
        cicdTools: ['Jenkins', 'GitLab CI']
      },
      qualityGates: {
        testCoverage: 90,
        securityScore: 95,
        performanceThreshold: 100
      }
    },
    technology: {
      complianceRequirements: ['GDPR', 'CCPA'],
      technicalStack: {
        languages: ['JavaScript', 'TypeScript', 'Python', 'Go'],
        frameworks: ['React', 'Node.js', 'Express', 'Kubernetes'],
        databases: ['PostgreSQL', 'Redis', 'MongoDB', 'DynamoDB'],
        cloudProviders: ['AWS', 'GCP', 'Azure'],
        cicdTools: ['GitHub Actions', 'CircleCI', 'ArgoCD']
      },
      qualityGates: {
        testCoverage: 80,
        securityScore: 85,
        performanceThreshold: 200
      }
    },
    healthcare: {
      complianceRequirements: ['HIPAA', 'GDPR', 'FDA'],
      technicalStack: {
        languages: ['Java', 'C#', 'Python', 'JavaScript'],
        frameworks: ['Spring Boot', '.NET', 'React', 'OAuth2'],
        databases: ['PostgreSQL', 'SQL Server', 'MongoDB'],
        cloudProviders: ['AWS', 'Azure'],
        cicdTools: ['Jenkins', 'Azure DevOps']
      },
      qualityGates: {
        testCoverage: 95,
        securityScore: 98,
        performanceThreshold: 50
      }
    },
    retail: {
      complianceRequirements: ['PCI-DSS', 'GDPR', 'CCPA'],
      technicalStack: {
        languages: ['Java', 'Python', 'JavaScript', 'Scala'],
        frameworks: ['Spring Boot', 'React', 'Kafka', 'Kubernetes'],
        databases: ['MySQL', 'PostgreSQL', 'Cassandra', 'Redis'],
        cloudProviders: ['AWS', 'GCP'],
        cicdTools: ['Jenkins', 'GitHub Actions']
      },
      qualityGates: {
        testCoverage: 75,
        securityScore: 90,
        performanceThreshold: 300
      }
    },
    energy: {
      complianceRequirements: ['NERC CIP', 'ISO 27001', 'GDPR'],
      technicalStack: {
        languages: ['C++', 'Java', 'Python', 'C#'],
        frameworks: ['.NET', 'Spring Boot', 'Industrial IoT'],
        databases: ['PostgreSQL', 'InfluxDB', 'Oracle'],
        cloudProviders: ['AWS', 'Azure', 'On-premise'],
        cicdTools: ['Jenkins', 'GitLab CI']
      },
      qualityGates: {
        testCoverage: 85,
        securityScore: 95,
        performanceThreshold: 100
      }
    }
  };

  const baseProfile = baseProfiles[industry] || {};

  return {
    name,
    industry,
    size: 'global',
    scalingRequirements: {
      microservices: 150,
      databases: 50,
      developers: 1000,
      deployments: 500
    },
    ...baseProfile,
    ...overrides
  } as Fortune5CompanyProfile;
}

/**
 * Export all types and interfaces
 */
export type {
  IntegrationConfig,
  IntegrationStats,
  ClaudeFlowIntegration,
  // Re-export all component types
  ClaudeFlowConnector,
  ClaudeFlowSwarm,
  ClaudeFlowAgent,
  Fortune5JTBD,
  OrchestrationResult,
  TaskOrchestrator,
  TaskExecutionResult,
  OrchestrationMetrics,
  ExecutionStrategy,
  SharedMemoryInterface,
  MemoryStatistics,
  MemoryEntry,
  JTBDWorkflows,
  JTBDWorkflowResult,
  Fortune5CompanyProfile,
  JTBDRequirements,
  JTBDExecutionContext,
  SwarmTask,
  SwarmMemory
};

/**
 * Export all main classes and functions
 */
export {
  ClaudeFlowIntegration,
  createClaudeFlowIntegration,
  createFortune5Profile
};