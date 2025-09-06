/**
 * Claude Flow Connector - Bridges Unjucks MCP tools with Claude Flow swarm agents
 * 
 * This connector enables Claude Flow swarms to orchestrate template generation tasks
 * across multiple agents in parallel, with shared memory and atomic operations.
 * 
 * Key capabilities:
 * - Map MCP tool calls to Claude Flow agent tasks
 * - Enable parallel template generation across swarm agents  
 * - Store generation results in shared memory
 * - Support all 5 Fortune 5 JTBD scenarios from the analysis
 * - Provide atomic operations and proper error handling
 */

import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';
import chalk from 'chalk';
import type {
  MCPRequest,
  MCPResponse,
  ToolResult,
  UnjucksGenerateParams,
  UnjucksGenerateResult,
  UnjucksListParams,
  UnjucksHelpParams,
  UnjucksDryRunParams,
  UnjucksInjectParams
} from '../types.js';
import { Generator } from '../lib/generator.js';
import type { GenerateOptions, TemplateFile, GenerateResult } from '../lib/generator.js';
import { MCPBridge } from '../lib/mcp-integration.js';
import type { SwarmTask, SwarmMemory, JTBDWorkflow } from '../lib/mcp-integration.js';
import { RDFDataLoader } from '../lib/rdf-data-loader.js';
import type { RDFDataSource, TurtleData } from '../lib/types/turtle-types.js';

/**
 * Claude Flow agent types and their capabilities
 */
export interface ClaudeFlowAgent {
  id: string;
  type: 'researcher' | 'coder' | 'tester' | 'reviewer' | 'system-architect' | 'code-analyzer' | 'backend-dev';
  status: 'idle' | 'busy' | 'completed' | 'error';
  capabilities: string[];
  memory: Record<string, any>;
  lastActivity: string;
  performance: {
    tasksCompleted: number;
    averageTime: number;
    successRate: number;
  };
}

/**
 * Claude Flow swarm configuration
 */
export interface ClaudeFlowSwarm {
  id: string;
  topology: 'mesh' | 'hierarchical' | 'ring' | 'star';
  agents: ClaudeFlowAgent[];
  coordinator: string; // Agent ID of coordinator
  sharedMemory: SwarmMemory;
  taskQueue: SwarmTask[];
  completedTasks: SwarmTask[];
  metrics: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageExecutionTime: number;
    parallelismEfficiency: number;
  };
}

/**
 * Tool-to-Agent mapping configuration
 */
export interface ToolAgentMapping {
  tool: string;
  preferredAgents: string[];
  capabilities: string[];
  concurrency: number;
  memoryRequirements: string[];
}

/**
 * Fortune 5 JTBD workflow templates
 */
export interface Fortune5JTBD {
  id: string;
  name: string;
  description: string;
  industry: 'financial' | 'technology' | 'healthcare' | 'retail' | 'energy';
  workflow: JTBDWorkflow;
  requiredTools: string[];
  estimatedValue: number;
  riskLevel: 'low' | 'medium' | 'high';
  complianceRequirements: string[];
}

/**
 * Task orchestration result
 */
export interface OrchestrationResult {
  taskId: string;
  success: boolean;
  results: Array<{
    agentId: string;
    toolName: string;
    result: ToolResult;
    executionTime: number;
  }>;
  errors: string[];
  metrics: {
    totalTime: number;
    parallelTasks: number;
    memoryUsage: number;
  };
  sharedMemory: Record<string, any>;
}

/**
 * Main Claude Flow Connector class
 */
export class ClaudeFlowConnector extends EventEmitter {
  private generator: Generator;
  private mcpBridge: MCPBridge;
  private rdfLoader: RDFDataLoader;
  private swarm: ClaudeFlowSwarm | null = null;
  private toolMappings: Map<string, ToolAgentMapping>;
  private fortune5Workflows: Map<string, Fortune5JTBD>;
  private activeOrchestrations: Map<string, OrchestrationResult>;
  private sharedMemory: Map<string, any>;
  private debugMode: boolean;

  constructor(templatesDir?: string) {
    super();
    
    this.generator = new Generator(templatesDir);
    this.mcpBridge = new MCPBridge();
    this.rdfLoader = new RDFDataLoader();
    this.toolMappings = new Map();
    this.fortune5Workflows = new Map();
    this.activeOrchestrations = new Map();
    this.sharedMemory = new Map();
    this.debugMode = process.env.DEBUG_UNJUCKS === 'true';

    this.initializeToolMappings();
    this.initializeFortune5Workflows();
  }

  /**
   * Initialize the Claude Flow Connector
   */
  async initialize(): Promise<void> {
    try {
      // Initialize MCP bridge
      await this.mcpBridge.initialize();
      
      // Store integration schema in swarm memory
      await this.mcpBridge.storeIntegrationSchema();
      
      // Setup event handlers
      this.setupEventHandlers();
      
      this.emit('initialized');
      
      if (this.debugMode) {
        console.log(chalk.green('[Claude Flow Connector] Successfully initialized'));
      }
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize Claude Flow Connector: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Initialize a Claude Flow swarm with specified topology
   */
  async initializeSwarm(
    topology: ClaudeFlowSwarm['topology'] = 'mesh',
    maxAgents: number = 8,
    strategy: 'balanced' | 'specialized' | 'adaptive' = 'balanced'
  ): Promise<string> {
    const swarmId = `swarm-${Date.now()}`;
    
    try {
      // Create agent pool based on strategy
      const agents = this.createAgentPool(maxAgents, strategy);
      
      // Initialize swarm
      this.swarm = {
        id: swarmId,
        topology,
        agents,
        coordinator: agents.find(a => a.type === 'system-architect')?.id || agents[0].id,
        sharedMemory: this.initializeSwarmMemory(),
        taskQueue: [],
        completedTasks: [],
        metrics: {
          totalTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          averageExecutionTime: 0,
          parallelismEfficiency: 0
        }
      };

      // Coordinate with swarm via MCP bridge
      await this.mcpBridge.coordinateWithSwarm(`Swarm ${swarmId} initialized with ${agents.length} agents`, {
        swarmId,
        topology,
        agentCount: agents.length,
        strategy
      });

      this.emit('swarm-initialized', this.swarm);
      
      if (this.debugMode) {
        console.log(chalk.green(`[Claude Flow Connector] Swarm ${swarmId} initialized with topology: ${topology}`));
        console.log(chalk.gray(`Agents: ${agents.map(a => `${a.type}(${a.id})`).join(', ')}`));
      }

      return swarmId;
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize swarm: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Orchestrate MCP tool calls across swarm agents for parallel execution
   */
  async orchestrateToolExecution(
    toolName: string,
    params: any,
    parallelCount: number = 1,
    context?: Record<string, any>
  ): Promise<OrchestrationResult> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    try {
      if (!this.swarm) {
        throw new Error('No swarm initialized. Call initializeSwarm() first.');
      }

      // Get tool-to-agent mapping
      const mapping = this.toolMappings.get(toolName);
      if (!mapping) {
        throw new Error(`No agent mapping found for tool: ${toolName}`);
      }

      // Select optimal agents for the task
      const selectedAgents = this.selectAgentsForTask(mapping, parallelCount);
      
      if (selectedAgents.length === 0) {
        throw new Error(`No suitable agents available for tool: ${toolName}`);
      }

      // Initialize orchestration result
      const orchestrationResult: OrchestrationResult = {
        taskId,
        success: false,
        results: [],
        errors: [],
        metrics: {
          totalTime: 0,
          parallelTasks: selectedAgents.length,
          memoryUsage: 0
        },
        sharedMemory: {}
      };

      this.activeOrchestrations.set(taskId, orchestrationResult);

      if (this.debugMode) {
        console.log(chalk.blue(`[Claude Flow Connector] Orchestrating ${toolName} across ${selectedAgents.length} agents`));
        console.log(chalk.gray(`Selected agents: ${selectedAgents.map(a => a.id).join(', ')}`));
      }

      // Prepare shared context from RDF data if available
      const rdfContext = await this.prepareRDFContext(context);
      const sharedContext = { ...context, ...rdfContext };

      // Store context in shared memory
      this.storeInSharedMemory(`${taskId}-context`, sharedContext);

      // Execute tool calls in parallel across selected agents
      const executePromises = selectedAgents.map(async (agent) => {
        const agentStartTime = performance.now();
        
        try {
          // Mark agent as busy
          agent.status = 'busy';
          agent.lastActivity = new Date().toISOString();

          // Synchronize template variables from swarm memory
          let processedParams = params;
          if (toolName === 'unjucks_generate' || toolName === 'unjucks_dry_run') {
            processedParams = await this.syncTemplateVariablesForAgent(
              params as UnjucksGenerateParams,
              agent,
              sharedContext
            );
          }

          // Execute the tool via appropriate method
          const result = await this.executeToolForAgent(toolName, processedParams, agent);
          
          const executionTime = performance.now() - agentStartTime;
          
          // Update agent performance metrics
          agent.performance.tasksCompleted++;
          agent.performance.averageTime = 
            (agent.performance.averageTime * (agent.performance.tasksCompleted - 1) + executionTime) / 
            agent.performance.tasksCompleted;
          agent.performance.successRate = 
            (agent.performance.successRate * (agent.performance.tasksCompleted - 1) + 100) / 
            agent.performance.tasksCompleted;

          // Mark agent as completed
          agent.status = 'completed';

          // Store results in shared memory
          this.storeInSharedMemory(`${taskId}-result-${agent.id}`, result);

          return {
            agentId: agent.id,
            toolName,
            result,
            executionTime
          };

        } catch (error) {
          const executionTime = performance.now() - agentStartTime;
          
          // Update agent error metrics
          agent.performance.successRate = 
            (agent.performance.successRate * agent.performance.tasksCompleted) / 
            (agent.performance.tasksCompleted + 1);
          
          agent.status = 'error';
          
          const errorMessage = error instanceof Error ? error.message : String(error);
          orchestrationResult.errors.push(`Agent ${agent.id}: ${errorMessage}`);

          if (this.debugMode) {
            console.error(chalk.red(`[Claude Flow Connector] Agent ${agent.id} failed: ${errorMessage}`));
          }

          return {
            agentId: agent.id,
            toolName,
            result: {
              content: [{ type: 'text', text: `Error: ${errorMessage}` }],
              isError: true
            } as ToolResult,
            executionTime
          };
        }
      });

      // Wait for all parallel executions to complete
      const results = await Promise.all(executePromises);
      orchestrationResult.results = results;

      // Calculate final metrics
      const totalTime = performance.now() - startTime;
      orchestrationResult.metrics.totalTime = totalTime;
      orchestrationResult.metrics.memoryUsage = this.calculateMemoryUsage(taskId);
      
      // Update swarm metrics
      this.updateSwarmMetrics(results, totalTime);

      // Determine overall success
      const successfulResults = results.filter(r => !r.result.isError);
      orchestrationResult.success = successfulResults.length > 0;

      // Aggregate results into shared memory
      const aggregatedResults = this.aggregateResults(results, toolName);
      orchestrationResult.sharedMemory = aggregatedResults;
      this.storeInSharedMemory(`${taskId}-final`, aggregatedResults);

      // Convert results to swarm format and sync
      await this.mcpBridge.unjucksToSwarm(
        {
          content: [{ type: 'text', text: JSON.stringify(aggregatedResults) }]
        } as ToolResult,
        taskId
      );

      this.emit('orchestration-completed', orchestrationResult);

      if (this.debugMode) {
        console.log(chalk.green(`[Claude Flow Connector] Task ${taskId} completed in ${totalTime.toFixed(2)}ms`));
        console.log(chalk.gray(`Success rate: ${successfulResults.length}/${results.length} agents`));
      }

      return orchestrationResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const failedResult: OrchestrationResult = {
        taskId,
        success: false,
        results: [],
        errors: [errorMessage],
        metrics: {
          totalTime: performance.now() - startTime,
          parallelTasks: 0,
          memoryUsage: 0
        },
        sharedMemory: {}
      };

      this.activeOrchestrations.set(taskId, failedResult);
      this.emit('error', error);
      
      return failedResult;
    }
  }

  /**
   * Execute a Fortune 5 JTBD workflow
   */
  async executeJTBDWorkflow(workflowId: string, context?: Record<string, any>): Promise<OrchestrationResult> {
    const workflow = this.fortune5Workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`JTBD workflow not found: ${workflowId}`);
    }

    try {
      if (this.debugMode) {
        console.log(chalk.blue(`[Claude Flow Connector] Executing JTBD workflow: ${workflow.name}`));
        console.log(chalk.gray(`Industry: ${workflow.industry}, Value: $${workflow.estimatedValue.toLocaleString()}`));
      }

      // Execute the workflow via MCP bridge
      const workflowResult = await this.mcpBridge.orchestrateJTBD(workflow.workflow);

      // Convert workflow result to orchestration result format
      const orchestrationResult: OrchestrationResult = {
        taskId: `jtbd-${workflowId}-${Date.now()}`,
        success: workflowResult.success,
        results: workflowResult.results.map(result => ({
          agentId: `workflow-agent-${result.stepIndex}`,
          toolName: result.action,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            isError: !result.success
          } as ToolResult,
          executionTime: 0 // TODO: Add timing to workflow steps
        })),
        errors: workflowResult.errors,
        metrics: {
          totalTime: 0, // TODO: Add workflow timing
          parallelTasks: workflowResult.results.length,
          memoryUsage: 0
        },
        sharedMemory: { workflowResults: workflowResult.results }
      };

      this.emit('jtbd-workflow-completed', { workflow, result: orchestrationResult });

      return orchestrationResult;

    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to execute JTBD workflow ${workflowId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all available JTBD workflows for Fortune 5 companies
   */
  getFortune5Workflows(): Fortune5JTBD[] {
    return Array.from(this.fortune5Workflows.values());
  }

  /**
   * Get current swarm status and metrics
   */
  getSwarmStatus(): ClaudeFlowSwarm | null {
    return this.swarm;
  }

  /**
   * Get orchestration results for a specific task
   */
  getOrchestrationResult(taskId: string): OrchestrationResult | undefined {
    return this.activeOrchestrations.get(taskId);
  }

  /**
   * Get shared memory value
   */
  getSharedMemory(key: string): any {
    return this.sharedMemory.get(key);
  }

  /**
   * Store value in shared memory with automatic agent notification
   */
  storeInSharedMemory(key: string, value: any): void {
    this.sharedMemory.set(key, {
      value,
      timestamp: new Date().toISOString(),
      size: JSON.stringify(value).length
    });

    // Notify all agents of memory update
    if (this.swarm) {
      for (const agent of this.swarm.agents) {
        agent.memory[key] = value;
      }
    }

    this.emit('memory-updated', { key, value });
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private initializeToolMappings(): void {
    // Map each MCP tool to optimal agent types and capabilities
    this.toolMappings.set('unjucks_generate', {
      tool: 'unjucks_generate',
      preferredAgents: ['coder', 'backend-dev', 'system-architect'],
      capabilities: ['template-processing', 'file-generation', 'nunjucks'],
      concurrency: 4,
      memoryRequirements: ['template-variables', 'generation-context']
    });

    this.toolMappings.set('unjucks_list', {
      tool: 'unjucks_list',
      preferredAgents: ['researcher', 'code-analyzer'],
      capabilities: ['template-analysis', 'directory-scanning'],
      concurrency: 2,
      memoryRequirements: ['template-metadata']
    });

    this.toolMappings.set('unjucks_help', {
      tool: 'unjucks_help',
      preferredAgents: ['researcher', 'code-analyzer'],
      capabilities: ['template-analysis', 'variable-extraction'],
      concurrency: 1,
      memoryRequirements: ['template-variables']
    });

    this.toolMappings.set('unjucks_dry_run', {
      tool: 'unjucks_dry_run',
      preferredAgents: ['tester', 'reviewer'],
      capabilities: ['simulation', 'validation'],
      concurrency: 3,
      memoryRequirements: ['template-variables', 'validation-rules']
    });

    this.toolMappings.set('unjucks_inject', {
      tool: 'unjucks_inject',
      preferredAgents: ['coder', 'backend-dev'],
      capabilities: ['file-injection', 'content-modification'],
      concurrency: 2,
      memoryRequirements: ['injection-targets', 'content-templates']
    });
  }

  private initializeFortune5Workflows(): void {
    // 1. API Development Standardization
    this.fortune5Workflows.set('api-standardization', {
      id: 'api-standardization',
      name: 'Standardize API Development Across Microservices',
      description: 'Generate consistent REST API endpoints across distributed microservice architecture',
      industry: 'technology',
      estimatedValue: 2000000, // $2M annual savings
      riskLevel: 'low',
      complianceRequirements: ['API Security', 'OpenAPI Standards'],
      requiredTools: ['unjucks_generate', 'unjucks_inject', 'unjucks_dry_run'],
      workflow: {
        id: 'api-standardization-workflow',
        name: 'API Standardization Workflow',
        description: 'Systematic API endpoint generation with security and documentation',
        job: 'Create consistent REST API endpoints across all microservices',
        steps: [
          {
            action: 'generate',
            description: 'Generate API controller with security middleware',
            generator: 'api',
            template: 'controller',
            parameters: {
              dest: './src/controllers',
              variables: { securityLevel: 'enterprise', docGeneration: true }
            }
          },
          {
            action: 'generate',
            description: 'Generate OpenAPI documentation',
            generator: 'api',
            template: 'openapi-spec',
            parameters: {
              dest: './docs/api',
              variables: { includeExamples: true, validationRules: true }
            }
          },
          {
            action: 'inject',
            description: 'Inject security middleware into existing services',
            parameters: {
              file: './src/app.js',
              content: 'app.use(securityMiddleware);',
              after: 'app.use(express.json());'
            }
          },
          {
            action: 'validate',
            description: 'Validate API consistency and security compliance',
            parameters: {
              files: ['./src/controllers', './docs/api']
            }
          }
        ]
      }
    });

    // 2. Compliance-Ready Service Scaffolding
    this.fortune5Workflows.set('compliance-scaffolding', {
      id: 'compliance-scaffolding',
      name: 'Generate Compliance-Ready Service Scaffolding',
      description: 'Automated scaffolding with required compliance, security, and monitoring configurations',
      industry: 'financial',
      estimatedValue: 5000000, // $5M annual savings
      riskLevel: 'high',
      complianceRequirements: ['SOX', 'GDPR', 'HIPAA', 'PCI-DSS'],
      requiredTools: ['unjucks_generate'],
      workflow: {
        id: 'compliance-scaffolding-workflow',
        name: 'Compliance Scaffolding Workflow',
        description: 'Generate services with built-in compliance features',
        job: 'Create services that pass all regulatory audits by default',
        steps: [
          {
            action: 'generate',
            description: 'Generate service base with compliance framework',
            generator: 'service',
            template: 'compliance-base',
            parameters: {
              dest: './services',
              variables: { 
                complianceLevel: 'SOX',
                auditingEnabled: true,
                encryptionStandard: 'AES-256'
              }
            }
          },
          {
            action: 'generate',
            description: 'Generate audit trail and logging infrastructure',
            generator: 'compliance',
            template: 'audit-system',
            parameters: {
              dest: './infrastructure/audit',
              variables: { retentionPeriod: '7-years', compressionEnabled: true }
            }
          }
        ]
      }
    });

    // 3. Database Migration Script Generation
    this.fortune5Workflows.set('database-migrations', {
      id: 'database-migrations',
      name: 'Automated Database Migration Script Generation',
      description: 'Generate migration scripts with dependencies and rollbacks for 50+ databases',
      industry: 'technology',
      estimatedValue: 3000000, // $3M annual savings
      riskLevel: 'medium',
      complianceRequirements: ['Data Integrity', 'ACID Compliance'],
      requiredTools: ['unjucks_generate'],
      workflow: {
        id: 'database-migrations-workflow',
        name: 'Database Migrations Workflow',
        description: 'Safe database schema evolution with automatic rollbacks',
        job: 'Deploy schema changes across databases without downtime or data loss',
        steps: [
          {
            action: 'generate',
            description: 'Generate forward migration scripts',
            generator: 'migration',
            template: 'schema-migration',
            parameters: {
              dest: './migrations',
              variables: { 
                operation: 'create',
                rollbackEnabled: true,
                dependencyTracking: true
              }
            }
          },
          {
            action: 'generate',
            description: 'Generate rollback procedures',
            generator: 'migration',
            template: 'rollback-script',
            parameters: {
              dest: './migrations/rollbacks',
              variables: { safetyChecks: true, dataPreservation: true }
            }
          },
          {
            action: 'validate',
            description: 'Validate migration dependencies and rollback procedures',
            parameters: {
              files: ['./migrations', './migrations/rollbacks']
            }
          }
        ]
      }
    });

    // 4. CI/CD Pipeline Generation
    this.fortune5Workflows.set('cicd-pipelines', {
      id: 'cicd-pipelines',
      name: 'Standardized CI/CD Pipeline Generation',
      description: 'Generate standardized CI/CD pipelines for multi-stack hybrid cloud architecture',
      industry: 'technology',
      estimatedValue: 4000000, // $4M annual savings
      riskLevel: 'medium',
      complianceRequirements: ['Security Scanning', 'Quality Gates', 'Deployment Policies'],
      requiredTools: ['unjucks_generate'],
      workflow: {
        id: 'cicd-pipelines-workflow',
        name: 'CI/CD Pipelines Workflow',
        description: 'Consistent deployment pipelines across all tech stacks',
        job: 'Ensure all applications have consistent security, testing, and deployment practices',
        steps: [
          {
            action: 'generate',
            description: 'Generate GitHub Actions workflow',
            generator: 'cicd',
            template: 'github-actions',
            parameters: {
              dest: './.github/workflows',
              variables: {
                environment: 'production',
                securityScanEnabled: true,
                qualityGatesCoverage: 80
              }
            }
          },
          {
            action: 'generate',
            description: 'Generate deployment configuration',
            generator: 'cicd',
            template: 'deployment-config',
            parameters: {
              dest: './deploy',
              variables: {
                multiCloud: true,
                rollbackStrategy: 'blue-green'
              }
            }
          }
        ]
      }
    });

    // 5. Documentation Generation
    this.fortune5Workflows.set('documentation-generation', {
      id: 'documentation-generation',
      name: 'Enterprise Documentation Generation from Code Annotations',
      description: 'Automated documentation generation from code annotations and semantic metadata',
      industry: 'technology',
      estimatedValue: 1500000, // $1.5M annual savings
      riskLevel: 'low',
      complianceRequirements: ['API Documentation', 'Compliance Documentation'],
      requiredTools: ['unjucks_generate'],
      workflow: {
        id: 'documentation-generation-workflow',
        name: 'Documentation Generation Workflow',
        description: 'Real-time documentation updates with code changes',
        job: 'Keep technical documentation current without manual maintenance',
        steps: [
          {
            action: 'generate',
            description: 'Generate API documentation from annotations',
            generator: 'docs',
            template: 'api-documentation',
            parameters: {
              dest: './docs/api',
              variables: {
                includeCompliance: true,
                autoUpdate: true,
                format: 'markdown'
              }
            }
          },
          {
            action: 'generate',
            description: 'Generate compliance documentation',
            generator: 'docs',
            template: 'compliance-docs',
            parameters: {
              dest: './docs/compliance',
              variables: {
                auditTrail: true,
                changeTracking: true
              }
            }
          }
        ]
      }
    });
  }

  private createAgentPool(maxAgents: number, strategy: 'balanced' | 'specialized' | 'adaptive'): ClaudeFlowAgent[] {
    const agents: ClaudeFlowAgent[] = [];
    const baseCapabilities = ['template-processing', 'file-operations', 'memory-sync'];

    // Define agent templates with their specific capabilities
    const agentTemplates = [
      { type: 'researcher' as const, capabilities: [...baseCapabilities, 'analysis', 'data-extraction', 'rdf-processing'] },
      { type: 'coder' as const, capabilities: [...baseCapabilities, 'code-generation', 'template-rendering', 'nunjucks'] },
      { type: 'tester' as const, capabilities: [...baseCapabilities, 'validation', 'dry-run', 'quality-assurance'] },
      { type: 'reviewer' as const, capabilities: [...baseCapabilities, 'code-review', 'compliance-check', 'security-audit'] },
      { type: 'system-architect' as const, capabilities: [...baseCapabilities, 'coordination', 'workflow-design', 'optimization'] },
      { type: 'code-analyzer' as const, capabilities: [...baseCapabilities, 'static-analysis', 'dependency-tracking', 'metrics'] },
      { type: 'backend-dev' as const, capabilities: [...baseCapabilities, 'api-development', 'database-migrations', 'service-integration'] }
    ];

    switch (strategy) {
      case 'balanced':
        // Equal distribution of agent types
        for (let i = 0; i < maxAgents; i++) {
          const template = agentTemplates[i % agentTemplates.length];
          agents.push(this.createAgent(template.type, template.capabilities, i));
        }
        break;

      case 'specialized':
        // More specialized agents for specific tasks
        const specializedDistribution = [
          { type: 'coder', count: Math.ceil(maxAgents * 0.3) },
          { type: 'researcher', count: Math.ceil(maxAgents * 0.2) },
          { type: 'tester', count: Math.ceil(maxAgents * 0.2) },
          { type: 'reviewer', count: Math.ceil(maxAgents * 0.15) },
          { type: 'system-architect', count: Math.ceil(maxAgents * 0.1) },
          { type: 'backend-dev', count: Math.ceil(maxAgents * 0.05) }
        ];

        let agentId = 0;
        for (const dist of specializedDistribution) {
          const template = agentTemplates.find(t => t.type === dist.type)!;
          for (let i = 0; i < dist.count && agentId < maxAgents; i++) {
            agents.push(this.createAgent(template.type, template.capabilities, agentId++));
          }
        }
        break;

      case 'adaptive':
        // Adaptive agents that can handle multiple roles
        for (let i = 0; i < maxAgents; i++) {
          const template = agentTemplates[i % agentTemplates.length];
          const adaptiveCapabilities = [
            ...template.capabilities,
            'multi-role',
            'adaptive-learning',
            'cross-functional'
          ];
          agents.push(this.createAgent(template.type, adaptiveCapabilities, i));
        }
        break;
    }

    return agents;
  }

  private createAgent(
    type: ClaudeFlowAgent['type'], 
    capabilities: string[], 
    index: number
  ): ClaudeFlowAgent {
    return {
      id: `agent-${type}-${index}`,
      type,
      status: 'idle',
      capabilities,
      memory: {},
      lastActivity: new Date().toISOString(),
      performance: {
        tasksCompleted: 0,
        averageTime: 0,
        successRate: 100
      }
    };
  }

  private initializeSwarmMemory(): SwarmMemory {
    return {
      templates: {
        variables: {},
        context: {},
        metadata: {}
      },
      agents: {},
      tasks: {},
      workflows: {}
    };
  }

  private selectAgentsForTask(mapping: ToolAgentMapping, parallelCount: number): ClaudeFlowAgent[] {
    if (!this.swarm) {
      return [];
    }

    const availableAgents = this.swarm.agents
      .filter(agent => agent.status === 'idle' || agent.status === 'completed')
      .filter(agent => mapping.preferredAgents.includes(agent.type))
      .sort((a, b) => b.performance.successRate - a.performance.successRate);

    return availableAgents.slice(0, Math.min(parallelCount, mapping.concurrency, availableAgents.length));
  }

  private async syncTemplateVariablesForAgent(
    params: UnjucksGenerateParams,
    agent: ClaudeFlowAgent,
    context: Record<string, any>
  ): Promise<UnjucksGenerateParams> {
    try {
      // Sync variables from swarm memory
      const syncedVariables = await this.mcpBridge.syncTemplateVariables(
        params.generator,
        params.template,
        context
      );

      // Merge with existing variables
      const mergedVariables = {
        ...params.variables,
        ...syncedVariables,
        agentId: agent.id,
        agentType: agent.type
      };

      return {
        ...params,
        variables: mergedVariables
      };

    } catch (error) {
      if (this.debugMode) {
        console.warn(chalk.yellow(`[Claude Flow Connector] Variable sync failed for agent ${agent.id}: ${error instanceof Error ? error.message : String(error)}`));
      }
      return params;
    }
  }

  private async executeToolForAgent(
    toolName: string,
    params: any,
    agent: ClaudeFlowAgent
  ): Promise<ToolResult> {
    try {
      // Execute the appropriate tool based on toolName
      switch (toolName) {
        case 'unjucks_generate':
          return await this.executeUnjucksGenerate(params as UnjucksGenerateParams);
        
        case 'unjucks_list':
          return await this.executeUnjucksList(params as UnjucksListParams);
        
        case 'unjucks_help':
          return await this.executeUnjucksHelp(params as UnjucksHelpParams);
        
        case 'unjucks_dry_run':
          return await this.executeUnjucksDryRun(params as UnjucksDryRunParams);
        
        case 'unjucks_inject':
          return await this.executeUnjucksInject(params as UnjucksInjectParams);
        
        default:
          throw new Error(`Unsupported tool: ${toolName}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Tool execution failed: ${errorMessage}` }],
        isError: true,
        _meta: { agentId: agent.id, toolName, error: errorMessage }
      };
    }
  }

  private async executeUnjucksGenerate(params: UnjucksGenerateParams): Promise<ToolResult> {
    try {
      const generateOptions: GenerateOptions = {
        generator: params.generator,
        template: params.template,
        dest: params.dest,
        force: params.force || false,
        dry: params.dry || false,
        variables: params.variables
      };

      const result = await this.generator.generate(generateOptions);
      
      const resultData: UnjucksGenerateResult = {
        files: result.files.map(file => ({
          path: file.path,
          content: file.content,
          action: file.injectionResult?.success ? 'created' : 'skipped'
        })),
        summary: {
          created: result.files.filter(f => f.injectionResult?.success).length,
          updated: 0,
          skipped: result.files.filter(f => !f.injectionResult?.success).length,
          injected: result.files.filter(f => f.injectionResult?.injected).length
        }
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(resultData, null, 2) }],
        isError: false,
        _meta: { toolName: 'unjucks_generate', filesGenerated: result.files.length }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Generation failed: ${errorMessage}` }],
        isError: true,
        _meta: { toolName: 'unjucks_generate', error: errorMessage }
      };
    }
  }

  private async executeUnjucksList(params: UnjucksListParams): Promise<ToolResult> {
    try {
      const generators = await this.generator.listGenerators();
      
      let result: any;
      if (params.generator) {
        const specificGenerator = generators.find(g => g.name === params.generator);
        if (!specificGenerator) {
          throw new Error(`Generator '${params.generator}' not found`);
        }
        result = params.detailed ? specificGenerator : { name: specificGenerator.name, description: specificGenerator.description };
      } else {
        result = params.detailed ? generators : generators.map(g => ({ name: g.name, description: g.description }));
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: false,
        _meta: { toolName: 'unjucks_list', generatorCount: generators.length }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `List operation failed: ${errorMessage}` }],
        isError: true,
        _meta: { toolName: 'unjucks_list', error: errorMessage }
      };
    }
  }

  private async executeUnjucksHelp(params: UnjucksHelpParams): Promise<ToolResult> {
    try {
      const { variables, cliArgs } = await this.generator.scanTemplateForVariables(
        params.generator,
        params.template
      );

      const helpData = {
        generator: params.generator,
        template: params.template,
        variables,
        cliArgs,
        usage: `unjucks generate ${params.generator} ${params.template} [options]`
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(helpData, null, 2) }],
        isError: false,
        _meta: { toolName: 'unjucks_help', variableCount: variables.length }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Help operation failed: ${errorMessage}` }],
        isError: true,
        _meta: { toolName: 'unjucks_help', error: errorMessage }
      };
    }
  }

  private async executeUnjucksDryRun(params: UnjucksDryRunParams): Promise<ToolResult> {
    try {
      // Execute dry run (same as generate but with dry=true)
      const dryRunParams: UnjucksGenerateParams = { ...params, dry: true };
      return await this.executeUnjucksGenerate(dryRunParams);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Dry run failed: ${errorMessage}` }],
        isError: true,
        _meta: { toolName: 'unjucks_dry_run', error: errorMessage }
      };
    }
  }

  private async executeUnjucksInject(params: UnjucksInjectParams): Promise<ToolResult> {
    try {
      // Use file injector from generator
      const injector = (this.generator as any).fileInjector;
      if (!injector) {
        throw new Error('File injector not available');
      }

      const frontmatter = {
        inject: true,
        before: params.before,
        after: params.after,
        append: params.append,
        prepend: params.prepend,
        lineAt: params.lineAt
      };

      const result = await injector.processFile(
        params.file,
        params.content,
        frontmatter,
        { force: params.force || false, dry: params.dry || false, backup: true }
      );

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
        _meta: { toolName: 'unjucks_inject', injected: result.injected }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `Injection failed: ${errorMessage}` }],
        isError: true,
        _meta: { toolName: 'unjucks_inject', error: errorMessage }
      };
    }
  }

  private async prepareRDFContext(context?: Record<string, any>): Promise<Record<string, any>> {
    if (!context?.rdf) {
      return {};
    }

    try {
      const rdfSource = {
        type: context.rdf.type || 'inline',
        source: context.rdf.source || context.rdf.data,
        format: context.rdf.format || 'turtle'
      };

      const result = await this.rdfLoader.loadData(rdfSource);
      return result.success ? result.variables : {};

    } catch (error) {
      if (this.debugMode) {
        console.warn(chalk.yellow(`[Claude Flow Connector] RDF context preparation failed: ${error instanceof Error ? error.message : String(error)}`));
      }
      return {};
    }
  }

  private calculateMemoryUsage(taskId: string): number {
    // Calculate memory usage for the task
    let totalSize = 0;
    
    for (const [key, data] of this.sharedMemory.entries()) {
      if (key.startsWith(taskId)) {
        totalSize += data.size || JSON.stringify(data.value).length;
      }
    }

    return totalSize;
  }

  private updateSwarmMetrics(results: any[], totalTime: number): void {
    if (!this.swarm) {
      return;
    }

    const successfulResults = results.filter(r => !r.result.isError);
    
    this.swarm.metrics.totalTasks++;
    if (successfulResults.length === results.length) {
      this.swarm.metrics.completedTasks++;
    } else {
      this.swarm.metrics.failedTasks++;
    }

    // Update average execution time
    this.swarm.metrics.averageExecutionTime = 
      (this.swarm.metrics.averageExecutionTime * (this.swarm.metrics.totalTasks - 1) + totalTime) / 
      this.swarm.metrics.totalTasks;

    // Calculate parallelism efficiency (successful parallel tasks / total parallel capacity)
    this.swarm.metrics.parallelismEfficiency = 
      (successfulResults.length / results.length) * 100;
  }

  private aggregateResults(results: any[], toolName: string): Record<string, any> {
    const aggregated = {
      tool: toolName,
      totalResults: results.length,
      successfulResults: results.filter(r => !r.result.isError).length,
      errors: results.filter(r => r.result.isError).map(r => r.result._meta?.error).filter(Boolean),
      executionTimes: results.map(r => r.executionTime),
      averageExecutionTime: results.reduce((sum, r) => sum + r.executionTime, 0) / results.length,
      agentPerformance: results.map(r => ({
        agentId: r.agentId,
        success: !r.result.isError,
        executionTime: r.executionTime
      })),
      aggregatedOutput: results.map(r => {
        try {
          return r.result.content?.[0]?.text ? JSON.parse(r.result.content[0].text) : null;
        } catch {
          return r.result.content?.[0]?.text;
        }
      }).filter(Boolean)
    };

    return aggregated;
  }

  private setupEventHandlers(): void {
    // Forward MCP bridge events
    this.mcpBridge.on('initialized', () => this.emit('mcp-bridge-initialized'));
    this.mcpBridge.on('error', (error) => this.emit('mcp-bridge-error', error));
    this.mcpBridge.on('jtbd-completed', (data) => this.emit('jtbd-completed', data));

    // Handle memory synchronization
    this.mcpBridge.on('memory-sync', () => {
      // Sync shared memory with MCP bridge
      if (this.swarm) {
        for (const [key, data] of this.sharedMemory.entries()) {
          this.swarm.sharedMemory.templates.context[key] = data.value;
        }
      }
    });
  }

  /**
   * Cleanup resources and close connections
   */
  async destroy(): Promise<void> {
    // Cleanup MCP bridge
    await this.mcpBridge.destroy();
    
    // Clear active orchestrations
    this.activeOrchestrations.clear();
    
    // Clear shared memory
    this.sharedMemory.clear();
    
    // Reset swarm
    this.swarm = null;
    
    // Remove all listeners
    this.removeAllListeners();

    if (this.debugMode) {
      console.log(chalk.gray('[Claude Flow Connector] Destroyed'));
    }
  }
}

/**
 * Factory function to create and initialize Claude Flow Connector
 */
export async function createClaudeFlowConnector(templatesDir?: string): Promise<ClaudeFlowConnector> {
  const connector = new ClaudeFlowConnector(templatesDir);
  await connector.initialize();
  return connector;
}

/**
 * Export types for external use
 */
export type {
  ClaudeFlowAgent,
  ClaudeFlowSwarm,
  ToolAgentMapping,
  Fortune5JTBD,
  OrchestrationResult
};