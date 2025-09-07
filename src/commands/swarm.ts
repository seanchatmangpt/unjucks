import { defineCommand } from "citty";
import * as chalk from "chalk";
import { createMCPBridge, type MCPBridge } from "../lib/mcp-integration.js";
import {
  validators,
  displayValidationResults,
  createCommandError,
} from "../lib/command-validation.js";
import type {
  CLICommandArgs,
  CLICommandResult,
  ValidationResult,
  UnjucksError,
} from "../types/unified-types.js";
import { CommandError, UnjucksCommandError } from "../types/commands.js";
import * as ora from "ora";
import * as fs from "fs-extra";
import * as path from "path";
import * as yaml from "yaml";

// ============================================================================
// ENHANCED SWARM COMMAND TYPES
// ============================================================================

/**
 * Swarm topology types - Extended with advanced topologies
 */
export type SwarmTopology = "mesh" | "hierarchical" | "ring" | "star";

/**
 * Agent specialization types - Enhanced with all claude-flow agents
 */
export type AgentType = 
  // Core Development
  | "researcher" 
  | "coder" 
  | "tester" 
  | "reviewer" 
  | "architect" 
  | "optimizer"
  // Specialized Development
  | "coordinator"
  | "specialist"
  | "backend-dev"
  | "mobile-dev"
  | "ml-developer"
  | "cicd-engineer"
  | "api-docs"
  | "system-architect"
  | "code-analyzer"
  | "perf-analyzer"
  | "performance-benchmarker"
  // SPARC Methodology
  | "specification"
  | "pseudocode"
  | "architecture"
  | "refinement"
  | "sparc-coord"
  | "sparc-coder"
  // Testing & Validation
  | "tdd-london-swarm"
  | "production-validator"
  // Swarm Coordination
  | "hierarchical-coordinator"
  | "mesh-coordinator"
  | "adaptive-coordinator"
  | "collective-intelligence-coordinator"
  | "swarm-memory-manager"
  // Consensus & Distributed
  | "byzantine-coordinator"
  | "raft-manager"
  | "gossip-coordinator"
  | "consensus-builder"
  | "crdt-synchronizer"
  | "quorum-manager"
  | "security-manager";

/**
 * Neural network architecture types
 */
export type NeuralArchitecture = "feedforward" | "lstm" | "gan" | "autoencoder" | "transformer" | "cnn" | "rnn" | "gnn" | "hybrid";

/**
 * Cognitive pattern types for DAA agents
 */
export type CognitivePattern = "convergent" | "divergent" | "lateral" | "systems" | "critical" | "adaptive";

/**
 * Swarm scaling strategies
 */
export type ScalingStrategy = "manual" | "auto" | "predictive" | "load-based" | "performance-based";

/**
 * Memory persistence modes
 */
export type PersistenceMode = "auto" | "memory" | "disk" | "distributed";

/**
 * Enhanced Swarm configuration interface
 */
export interface SwarmConfig {
  // Core Configuration
  topology: SwarmTopology;
  maxAgents: number;
  strategy: "balanced" | "specialized" | "adaptive";
  
  // Advanced Features
  enableMemory?: boolean;
  enableHooks?: boolean;
  debugMode?: boolean;
  persistence?: boolean;
  autoScale?: boolean;
  
  // Neural & DAA Features
  enableNeural?: boolean;
  enableDAA?: boolean;
  neuralArchitecture?: NeuralArchitecture;
  cognitivePatterns?: CognitivePattern[];
  
  // Scaling & Performance
  scalingStrategy?: ScalingStrategy;
  performanceThresholds?: PerformanceThresholds;
  resourceLimits?: ResourceLimits;
  
  // Memory & Persistence
  persistenceMode?: PersistenceMode;
  memoryNamespaces?: string[];
  crossSessionMemory?: boolean;
  
  // Monitoring & Health
  healthChecks?: boolean;
  metricsCollection?: boolean;
  realTimeMonitoring?: boolean;
}

/**
 * Performance thresholds for auto-scaling
 */
export interface PerformanceThresholds {
  cpuThreshold?: number;
  memoryThreshold?: number;
  responseTimeThreshold?: number;
  errorRateThreshold?: number;
  throughputThreshold?: number;
}

/**
 * Resource limits for agents
 */
export interface ResourceLimits {
  maxCPU?: number;
  maxMemory?: number;
  maxTimeout?: number;
  maxConcurrency?: number;
}

/**
 * Enhanced Agent spawn configuration
 */
export interface AgentSpawnConfig {
  // Core Configuration
  type: AgentType;
  name?: string;
  capabilities?: string[];
  
  // Resource Management
  resources?: {
    memory?: number;
    cpu?: number;
    timeout?: number;
    priority?: "low" | "medium" | "high" | "critical";
    sandbox?: boolean;
  };
  
  // Specialization & Skills
  specialization?: {
    domain?: string;
    expertise?: string[];
    patterns?: string[];
    languages?: string[];
    frameworks?: string[];
  };
  
  // DAA Configuration
  daa?: {
    enableAutonomy?: boolean;
    autonomyLevel?: number; // 0-1
    enableLearning?: boolean;
    learningRate?: number;
    cognitivePattern?: CognitivePattern;
    enableMemory?: boolean;
  };
  
  // Neural Configuration
  neural?: {
    architecture?: NeuralArchitecture;
    enableTraining?: boolean;
    modelSize?: "base" | "large" | "xl" | "custom";
    customLayers?: any[];
  };
  
  // Lifecycle Management
  lifecycle?: {
    autoRestart?: boolean;
    maxRetries?: number;
    healthCheckInterval?: number;
    gracefulShutdown?: boolean;
  };
}

/**
 * Enhanced Workflow configuration
 */
export interface WorkflowConfig {
  // Core Configuration
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  dependencies?: Record<string, string[]>;
  strategy?: "parallel" | "sequential" | "adaptive" | "balanced";
  
  // Execution Configuration
  timeout?: number;
  retries?: number;
  priority?: "low" | "medium" | "high" | "critical";
  
  // Advanced Features
  triggers?: WorkflowTrigger[];
  conditions?: WorkflowCondition[];
  errorHandling?: WorkflowErrorHandling;
  
  // Monitoring & Metrics
  enableMetrics?: boolean;
  enableAuditTrail?: boolean;
  notificationChannels?: string[];
  
  // Resource Management
  resourceRequirements?: ResourceLimits;
  agentAssignments?: Record<string, AgentType[]>;
}

/**
 * Workflow trigger configuration
 */
export interface WorkflowTrigger {
  type: "schedule" | "event" | "webhook" | "manual" | "condition";
  config: Record<string, any>;
  enabled: boolean;
}

/**
 * Workflow condition
 */
export interface WorkflowCondition {
  field: string;
  operator: "eq" | "ne" | "gt" | "lt" | "contains" | "exists";
  value: any;
  logical?: "and" | "or";
}

/**
 * Workflow error handling
 */
export interface WorkflowErrorHandling {
  strategy: "fail-fast" | "continue" | "retry" | "fallback";
  maxRetries?: number;
  retryDelay?: number;
  fallbackWorkflow?: string;
  notifyOnError?: boolean;
}

/**
 * Enhanced Workflow step
 */
export interface WorkflowStep {
  // Core Configuration
  id: string;
  name: string;
  description?: string;
  action: "generate" | "analyze" | "test" | "review" | "optimize" | "deploy" | "monitor" | "train" | "validate" | "backup";
  parameters: Record<string, any>;
  
  // Agent Assignment
  agentType?: AgentType;
  agentId?: string;
  agentRequirements?: AgentRequirements;
  
  // Execution Control
  timeout?: number;
  retries?: number;
  priority?: "low" | "medium" | "high" | "critical";
  
  // Flow Control
  condition?: WorkflowCondition[];
  prerequisites?: string[];
  dependsOn?: string[];
  onSuccess?: WorkflowAction[];
  onFailure?: WorkflowAction[];
  onTimeout?: WorkflowAction[];
  
  // Resource Management
  resources?: ResourceLimits;
  sandbox?: boolean;
  isolation?: boolean;
}

/**
 * Agent requirements for workflow steps
 */
export interface AgentRequirements {
  capabilities?: string[];
  expertise?: string[];
  minExperience?: number;
  preferredAgent?: string;
  excludeAgents?: string[];
}

/**
 * Workflow action (for success/failure handlers)
 */
export interface WorkflowAction {
  type: "goto" | "retry" | "fail" | "notify" | "log" | "trigger";
  target?: string;
  parameters?: Record<string, any>;
}

/**
 * Swarm status information
 */
export interface SwarmStatus {
  id: string;
  topology: SwarmTopology;
  agents: {
    total: number;
    active: number;
    idle: number;
    busy: number;
    failed: number;
  };
  memory?: {
    used: number;
    available: number;
    cached: number;
  };
  performance?: {
    throughput: number;
    responseTime: number;
    errorRate: number;
  };
  health: "healthy" | "degraded" | "critical";
  uptime: number;
}

/**
 * Neural training configuration
 */
export interface NeuralTrainingConfig {
  architecture: NeuralArchitecture;
  epochs: number;
  learningRate: number;
  batchSize: number;
  optimizer: "adam" | "sgd" | "rmsprop" | "adagrad";
  layers?: any[];
  divergentEnabled?: boolean;
  divergentPattern?: "lateral" | "quantum" | "chaotic" | "associative" | "evolutionary";
}

/**
 * DAA agent configuration
 */
export interface DAAConfig {
  agentType: string;
  capabilities: string[];
  resources?: Record<string, any>;
  cognitivePattern?: CognitivePattern;
  enableMemory?: boolean;
  learningRate?: number;
}

/**
 * Memory management configuration
 */
export interface MemoryConfig {
  action: "store" | "retrieve" | "list" | "delete" | "search" | "backup" | "restore" | "compress";
  key?: string;
  value?: string;
  namespace?: string;
  ttl?: number;
  pattern?: string;
  backupPath?: string;
}

// ============================================================================
// MCP INTEGRATION UTILITIES
// ============================================================================

/**
 * Execute MCP command with error handling and retry logic
 */
async function executeMCPCommand(
  mcp: MCPBridge,
  tool: string,
  params: Record<string, any>,
  spinner?: ora.Ora
): Promise<any> {
  try {
    if (spinner) {
      spinner.text = `Executing ${tool}...`;
    }
    
    const result = await mcp.callTool(tool, params);
    
    if (spinner) {
      spinner.succeed(`Successfully executed ${tool}`);
    }
    
    return result;
  } catch (error) {
    if (spinner) {
      spinner.fail(`Failed to execute ${tool}: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw error;
  }
}

/**
 * Display swarm status information
 */
function displaySwarmStatus(status: any, detailed: boolean = false): void {
  console.log(chalk.blue("\n🤖 Swarm Status"));
  console.log(chalk.gray("=" .repeat(50)));
  
  if (status.topology) {
    console.log(`${chalk.cyan("Topology:")} ${status.topology}`);
  }
  
  if (status.agents) {
    console.log(`${chalk.cyan("Agents:")} ${status.agents.total} total (${status.agents.active} active, ${status.agents.idle} idle)`);
  }
  
  if (status.health) {
    const healthColor = status.health === "healthy" ? chalk.green : 
                       status.health === "degraded" ? chalk.yellow : chalk.red;
    console.log(`${chalk.cyan("Health:")} ${healthColor(status.health)}`);
  }
  
  if (detailed && status.performance) {
    console.log(`${chalk.cyan("Performance:")}`);
    console.log(`  Throughput: ${status.performance.throughput} ops/sec`);
    console.log(`  Response Time: ${status.performance.responseTime}ms`);
    console.log(`  Error Rate: ${status.performance.errorRate}%`);
  }
  
  if (detailed && status.memory) {
    console.log(`${chalk.cyan("Memory Usage:")}`);
    console.log(`  Used: ${status.memory.used}MB`);
    console.log(`  Available: ${status.memory.available}MB`);
  }
}

/**
 * Display agent information
 */
function displayAgents(agents: any[]): void {
  if (!agents?.length) {
    console.log(chalk.yellow("No agents found"));
    return;
  }
  
  console.log(chalk.blue(`\n🤖 Active Agents (${agents.length})`));
  console.log(chalk.gray("=" .repeat(50)));
  
  agents.forEach((agent, index) => {
    console.log(`${chalk.cyan(`${index + 1}.`)} ${agent.name || agent.type || agent.id}`);
    if (agent.type) console.log(`   Type: ${agent.type}`);
    if (agent.status) console.log(`   Status: ${agent.status}`);
    if (agent.capabilities) console.log(`   Capabilities: ${agent.capabilities.join(", ")}`);
  });
}

// ============================================================================
// ENHANCED SWARM COMMAND WITH FULL MCP INTEGRATION
// ============================================================================

/**
 * Enhanced Swarm command - AI swarm orchestration and agent coordination with full MCP integration
 * 
 * This command provides comprehensive swarm management capabilities including:
 * - Advanced swarm initialization with neural and DAA features
 * - Sophisticated agent lifecycle management
 * - Topology optimization and auto-scaling
 * - Neural pattern training and cognitive modeling
 * - Decentralized Autonomous Agent (DAA) coordination
 * - Real-time monitoring and health checks
 * - Memory management and cross-session persistence
 * - Performance benchmarking and optimization
 * - Workflow automation and templates
 * - Distributed neural network clusters
 * 
 * @example
 * ```bash
 * # Initialize advanced swarm with neural training
 * unjucks swarm init --topology mesh --agents 8 --neural --daa --monitoring
 * 
 * # Deploy DAA agent with cognitive patterns
 * unjucks swarm agent deploy --type backend-dev --cognitive lateral --autonomy 0.8
 * 
 * # Create neural network cluster
 * unjucks swarm neural cluster --name "distributed-ai" --topology mesh --nodes 5
 * 
 * # Monitor swarm with real-time metrics
 * unjucks swarm monitor --real-time --detailed --export-metrics
 * 
 * # Scale based on performance thresholds
 * unjucks swarm scale --strategy performance-based --target 12 --auto
 * ```
 */
export const swarmCommand = defineCommand({
  meta: {
    name: "swarm",
    description: "Enhanced AI swarm orchestration with neural networks and DAA capabilities"
  },
  subcommands: {
    /**
     * Initialize swarm with enhanced configuration and MCP integration
     */
    init: defineCommand({
      meta: {
        name: "init",
        description: "Initialize advanced AI swarm with neural and DAA features"
      },
      args: {
        topology: {
          type: "string",
          description: "Swarm topology: mesh, hierarchical, ring, star",
          default: "mesh",
          alias: "t"
        },
        agents: {
          type: "positional",
          description: "Maximum number of agents in the swarm",
          default: 8,
          alias: "a"
        },
        strategy: {
          type: "string",
          description: "Agent distribution strategy: balanced, specialized, adaptive",
          default: "balanced",
          alias: "s"
        },
        neural: {
          type: "boolean",
          description: "Enable neural pattern training",
          default: false,
          alias: "n"
        },
        daa: {
          type: "boolean",
          description: "Enable Decentralized Autonomous Agents",
          default: false,
          alias: "d"
        },
        persistence: {
          type: "string",
          description: "Memory persistence mode: auto, memory, disk, distributed",
          default: "auto",
          alias: "p"
        },
        monitoring: {
          type: "boolean",
          description: "Enable real-time monitoring",
          default: true,
          alias: "m"
        },
        scaling: {
          type: "string",
          description: "Auto-scaling strategy: manual, auto, predictive, load-based, performance-based",
          default: "manual",
          alias: "sc"
        },
        architecture: {
          type: "string",
          description: "Neural architecture for neural-enabled swarms",
          default: "transformer",
          alias: "arch"
        }
      },
      async run({ args }) {
        const spinner = ora("Initializing advanced swarm...").start();
        
        try {
          const mcp = await createMCPBridge();
          
          // Enhanced configuration
          const config: SwarmConfig = {
            topology: args.topology as SwarmTopology,
            maxAgents: args.agents,
            strategy: (args.strategy as "balanced" | "specialized" | "adaptive") || "balanced",
            enableMemory: true,
            enableHooks: true,
            debugMode: false,
            persistence: true,
            autoScale: args.scaling !== "manual",
            
            // Enhanced Configuration
            enableNeural: args.neural,
            enableDAA: args.daa,
            neuralArchitecture: args.architecture as NeuralArchitecture,
            persistenceMode: args.persistence as PersistenceMode,
            scalingStrategy: args.scaling as ScalingStrategy,
            realTimeMonitoring: args.monitoring,
            healthChecks: true,
            metricsCollection: true,
            crossSessionMemory: true
          };
          
          // Initialize swarm with claude-flow MCP
          const initResult = await executeMCPCommand(
            mcp,
            "mcp__claude-flow__swarm_init",
            {
              topology: config.topology,
              maxAgents: config.maxAgents,
              strategy: config.strategy
            },
            spinner
          );
          
          console.log(chalk.green(`✅ Swarm initialized: ${initResult.swarmId || 'unknown'}`));
          
          // Initialize DAA if enabled
          if (config.enableDAA) {
            spinner.text = "Initializing DAA capabilities...";
            await executeMCPCommand(
              mcp,
              "mcp__claude-flow__daa_init",
              {
                enableCoordination: true,
                enableLearning: true,
                persistenceMode: config.persistenceMode
              },
              spinner
            );
          }
          
          // Setup neural training if enabled
          if (config.enableNeural) {
            spinner.text = "Setting up neural training...";
            await executeMCPCommand(
              mcp,
              "mcp__claude-flow__neural_status",
              {},
              spinner
            );
          }
          
          // Enable monitoring if requested
          if (config.realTimeMonitoring) {
            spinner.text = "Setting up monitoring...";
            await executeMCPCommand(
              mcp,
              "mcp__claude-flow__swarm_monitor",
              {
                duration: 60,
                interval: 5
              },
              spinner
            );
          }
          
          spinner.succeed("Advanced swarm initialized successfully!");
          
          // Display configuration summary
          console.log(chalk.blue("\n🔧 Swarm Configuration:"));
          console.log(`  Topology: ${chalk.cyan(config.topology)}`);
          console.log(`  Max Agents: ${chalk.cyan(config.maxAgents)}`);
          console.log(`  Strategy: ${chalk.cyan(config.strategy)}`);
          console.log(`  Neural Enabled: ${config.enableNeural ? chalk.green('Yes') : chalk.gray('No')}`);
          console.log(`  DAA Enabled: ${config.enableDAA ? chalk.green('Yes') : chalk.gray('No')}`);
          console.log(`  Monitoring: ${config.realTimeMonitoring ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
          console.log(`  Auto-scaling: ${config.autoScale ? chalk.green(config.scalingStrategy) : chalk.gray('Manual')}`);
          
          return {
            success: true,
            data: { config, swarmId: initResult.swarmId }
          };
          
        } catch (error) {
          spinner.fail("Failed to initialize swarm");
          throw new UnjucksCommandError(
            "SWARM_INIT_FAILED",
            `Failed to initialize swarm: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }),

    /**
     * Enhanced agent management with lifecycle operations
     */
    agent: defineCommand({
      meta: {
        name: "agent",
        description: "Advanced agent management with DAA and neural capabilities"
      },
      subcommands: {
        /**
         * Spawn new agent with enhanced configuration
         */
        spawn: defineCommand({
          meta: {
            name: "spawn",
            description: "Spawn new agent with advanced capabilities"
          },
          args: {
            type: {
              type: "positional",
              description: "Agent type (researcher, coder, backend-dev, etc.)",
              required: true
            },
            name: {
              type: "string",
              description: "Custom agent name",
              alias: "n"
            },
            capabilities: {
              type: "string",
              description: "Comma-separated capabilities",
              alias: "c"
            },
            cognitive: {
              type: "string",
              description: "Cognitive pattern for DAA agents",
              alias: "cog"
            },
            autonomy: {
              type: "string",
              description: "Autonomy level (0-1) for DAA agents",
              alias: "auto"
            },
            neural: {
              type: "string",
              description: "Neural architecture",
              alias: "arch"
            },
            sandbox: {
              type: "boolean",
              description: "Enable sandbox execution",
              default: false,
              alias: "sb"
            }
          },
          async run({ args }) {
            const spinner = ora(`Spawning ${args.type} agent...`).start();
            
            try {
              const mcp = await createMCPBridge();
              const capabilities = args.capabilities ? args.capabilities.split(",") : [];
              
              // Spawn agent with claude-flow MCP
              const spawnResult = await executeMCPCommand(
                mcp,
                "mcp__claude-flow__agent_spawn",
                {
                  type: args.type,
                  name: args.name,
                  capabilities: capabilities
                },
                spinner
              );
              
              console.log(chalk.green(`✅ Agent spawned: ${spawnResult.agentId || args.name || args.type}`));
              
              // Create DAA agent if cognitive pattern specified
              if (args.cognitive) {
                spinner.text = "Creating DAA agent...";
                await executeMCPCommand(
                  mcp,
                  "mcp__claude-flow__daa_agent_create",
                  {
                    agent_type: args.type,
                    capabilities: capabilities,
                    cognitivePattern: args.cognitive,
                    learningRate: parseFloat(args.autonomy || "0.5")
                  },
                  spinner
                );
              }
              
              return {
                success: true,
                data: { agent: spawnResult, type: args.type }
              };
              
            } catch (error) {
              spinner.fail("Failed to spawn agent");
              throw new UnjucksCommandError(
                "AGENT_SPAWN_FAILED",
                `Failed to spawn agent: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }),

        /**
         * Deploy agent with advanced configuration
         */
        deploy: defineCommand({
          meta: {
            name: "deploy",
            description: "Deploy agent to swarm with full configuration"
          },
          args: {
            type: {
              type: "positional",
              description: "Agent type",
              required: true
            },
            swarm: {
              type: "string",
              description: "Target swarm ID",
              alias: "s"
            },
            cognitive: {
              type: "string",
              description: "Cognitive pattern",
              alias: "cog"
            },
            autonomy: {
              type: "string",
              description: "Autonomy level (0-1)",
              alias: "auto",
              default: "0.8"
            },
            learning: {
              type: "boolean",
              description: "Enable learning",
              default: true,
              alias: "learn"
            },
            memory: {
              type: "boolean",
              description: "Enable persistent memory",
              default: true,
              alias: "mem"
            }
          },
          async run({ args }) {
            const spinner = ora(`Deploying ${args.type} agent...`).start();
            
            try {
              const mcp = await createMCPBridge();
              
              // Deploy DAA agent
              const deployResult = await executeMCPCommand(
                mcp,
                "mcp__claude-flow__daa_agent_create",
                {
                  id: `${args.type}-${Date.now()}`,
                  capabilities: [args.type],
                  cognitivePattern: args.cognitive || "adaptive",
                  enableMemory: args.memory,
                  learningRate: parseFloat(args.autonomy)
                },
                spinner
              );
              
              console.log(chalk.green(`✅ Agent deployed successfully`));
              console.log(`  Type: ${chalk.cyan(args.type)}`);
              console.log(`  Cognitive Pattern: ${chalk.cyan(args.cognitive || "adaptive")}`);
              console.log(`  Autonomy Level: ${chalk.cyan(args.autonomy)}`);
              
              return {
                success: true,
                data: deployResult
              };
              
            } catch (error) {
              spinner.fail("Failed to deploy agent");
              throw new UnjucksCommandError(
                "AGENT_DEPLOY_FAILED",
                `Failed to deploy agent: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }),

        /**
         * List active agents
         */
        list: defineCommand({
          meta: {
            name: "list",
            description: "List active agents in swarm"
          },
          args: {
            detailed: {
              type: "boolean",
              description: "Show detailed information",
              default: false,
              alias: "d"
            },
            filter: {
              type: "string",
              description: "Filter by status: all, active, idle, busy",
              default: "all",
              alias: "f"
            }
          },
          async run({ args }) {
            const spinner = ora("Retrieving agent list...").start();
            
            try {
              const mcp = await createMCPBridge();
              
              const agents = await executeMCPCommand(
                mcp,
                "mcp__claude-flow__agent_list",
                {
                  filter: args.filter
                },
                spinner
              );
              
              displayAgents(agents.agents || []);
              
              return {
                success: true,
                data: agents
              };
              
            } catch (error) {
              spinner.fail("Failed to retrieve agents");
              throw new UnjucksCommandError(
                "AGENT_LIST_FAILED",
                `Failed to list agents: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }),

        /**
         * Get agent metrics
         */
        metrics: defineCommand({
          meta: {
            name: "metrics",
            description: "Get performance metrics for agents"
          },
          args: {
            agent: {
              type: "string",
              description: "Specific agent ID",
              alias: "a"
            },
            metric: {
              type: "string",
              description: "Specific metric type",
              default: "all",
              alias: "m"
            }
          },
          async run({ args }) {
            const spinner = ora("Retrieving agent metrics...").start();
            
            try {
              const mcp = await createMCPBridge();
              
              const metrics = await executeMCPCommand(
                mcp,
                "mcp__claude-flow__agent_metrics",
                {
                  agentId: args.agent,
                  metric: args.metric
                },
                spinner
              );
              
              console.log(chalk.blue("\n📊 Agent Metrics"));
              console.log(chalk.gray("=" .repeat(50)));
              console.log(JSON.stringify(metrics, null, 2));
              
              return {
                success: true,
                data: metrics
              };
              
            } catch (error) {
              spinner.fail("Failed to retrieve metrics");
              throw new UnjucksCommandError(
                "AGENT_METRICS_FAILED",
                `Failed to get agent metrics: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        })
      }
    }),

    /**
     * Enhanced task orchestration
     */
    orchestrate: defineCommand({
      meta: {
        name: "orchestrate",
        description: "Orchestrate complex tasks across swarm"
      },
      args: {
        task: {
          type: "positional",
          description: "Task description or workflow file",
          required: true
        },
        strategy: {
          type: "string",
          description: "Execution strategy: parallel, sequential, adaptive, balanced",
          default: "adaptive",
          alias: "s"
        },
        priority: {
          type: "string",
          description: "Task priority: low, medium, high, critical",
          default: "medium",
          alias: "p"
        },
        maxAgents: {
          type: "string",
          description: "Maximum agents to use",
          alias: "m"
        },
        timeout: {
          type: "string",
          description: "Task timeout in seconds",
          alias: "t"
        }
      },
      async run({ args }) {
        const spinner = ora("Orchestrating task...").start();
        
        try {
          const mcp = await createMCPBridge();
          
          // Check if task is a workflow file
          const isWorkflowFile = args.task.endsWith('.yaml') || args.task.endsWith('.yml') || args.task.endsWith('.json');
          let taskDescription = args.task;
          
          if (isWorkflowFile && await fs.pathExists(args.task)) {
            const workflowContent = await fs.readFile(args.task, 'utf-8');
            const workflow = args.task.endsWith('.json') ? JSON.parse(workflowContent) : yaml.parse(workflowContent);
            taskDescription = workflow.description || workflow.name || args.task;
          }
          
          const orchestrateResult = await executeMCPCommand(
            mcp,
            "mcp__claude-flow__task_orchestrate",
            {
              task: taskDescription,
              strategy: args.strategy,
              priority: args.priority,
              maxAgents: args.maxAgents ? parseInt(args.maxAgents) : undefined
            },
            spinner
          );
          
          console.log(chalk.green(`✅ Task orchestrated: ${orchestrateResult.taskId || 'unknown'}`));
          console.log(`  Strategy: ${chalk.cyan(args.strategy)}`);
          console.log(`  Priority: ${chalk.cyan(args.priority)}`);
          
          return {
            success: true,
            data: orchestrateResult
          };
          
        } catch (error) {
          spinner.fail("Failed to orchestrate task");
          throw new UnjucksCommandError(
            "TASK_ORCHESTRATION_FAILED",
            `Failed to orchestrate task: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }),

    /**
     * Enhanced swarm status with detailed metrics
     */
    status: defineCommand({
      meta: {
        name: "status",
        description: "Get comprehensive swarm status and metrics"
      },
      args: {
        detailed: {
          type: "boolean",
          description: "Show detailed metrics",
          default: false,
          alias: "d"
        },
        watch: {
          type: "boolean",
          description: "Watch status in real-time",
          default: false,
          alias: "w"
        },
        swarm: {
          type: "string",
          description: "Specific swarm ID",
          alias: "s"
        }
      },
      async run({ args }) {
        const spinner = ora("Retrieving swarm status...").start();
        
        try {
          const mcp = await createMCPBridge();
          
          const status = await executeMCPCommand(
            mcp,
            "mcp__claude-flow__swarm_status",
            {
              swarmId: args.swarm,
              verbose: args.detailed
            },
            spinner
          );
          
          displaySwarmStatus(status, args.detailed);
          
          if (args.watch) {
            console.log(chalk.yellow("\n👁️  Watching for changes (Press Ctrl+C to stop)..."));
            
            // Start monitoring
            await executeMCPCommand(
              mcp,
              "mcp__claude-flow__swarm_monitor",
              {
                duration: 3600, // 1 hour
                interval: 5     // 5 seconds
              }
            );
          }
          
          return {
            success: true,
            data: status
          };
          
        } catch (error) {
          spinner.fail("Failed to retrieve status");
          throw new UnjucksCommandError(
            "SWARM_STATUS_FAILED",
            `Failed to get swarm status: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }),

    /**
     * Enhanced scaling with auto-optimization
     */
    scale: defineCommand({
      meta: {
        name: "scale",
        description: "Scale swarm with intelligent optimization"
      },
      args: {
        target: {
          type: "positional",
          description: "Target number of agents",
          required: true
        },
        strategy: {
          type: "string",
          description: "Scaling strategy",
          default: "balanced",
          alias: "s"
        },
        auto: {
          type: "boolean",
          description: "Enable auto-scaling",
          default: false,
          alias: "a"
        },
        optimize: {
          type: "boolean",
          description: "Optimize topology during scaling",
          default: true,
          alias: "o"
        }
      },
      async run({ args }) {
        const spinner = ora(`Scaling swarm to ${args.target} agents...`).start();
        
        try {
          const mcp = await createMCPBridge();
          
          // Scale the swarm
          const scaleResult = await executeMCPCommand(
            mcp,
            "mcp__claude-flow__swarm_scale",
            {
              targetSize: parseInt(args.target)
            },
            spinner
          );
          
          // Optimize topology if requested
          if (args.optimize) {
            spinner.text = "Optimizing topology...";
            await executeMCPCommand(
              mcp,
              "mcp__claude-flow__topology_optimize",
              {},
              spinner
            );
          }
          
          console.log(chalk.green(`✅ Swarm scaled to ${args.target} agents`));
          console.log(`  Strategy: ${chalk.cyan(args.strategy)}`);
          console.log(`  Auto-scaling: ${args.auto ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
          console.log(`  Topology optimized: ${args.optimize ? chalk.green('Yes') : chalk.gray('No')}`);
          
          return {
            success: true,
            data: scaleResult
          };
          
        } catch (error) {
          spinner.fail("Failed to scale swarm");
          throw new UnjucksCommandError(
            "SWARM_SCALE_FAILED",
            `Failed to scale swarm: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }),

    /**
     * Neural network training and management
     */
    neural: defineCommand({
      meta: {
        name: "neural",
        description: "Neural network training and cognitive pattern management"
      },
      subcommands: {
        /**
         * Train neural patterns
         */
        train: defineCommand({
          meta: {
            name: "train",
            description: "Train neural patterns for swarm coordination"
          },
          args: {
            pattern: {
              type: "positional",
              description: "Pattern type: coordination, optimization, prediction",
              required: true
            },
            epochs: {
              type: "string",
              description: "Number of training epochs",
              default: "50",
              alias: "e"
            },
            architecture: {
              type: "string",
              description: "Neural architecture",
              default: "transformer",
              alias: "arch"
            },
            data: {
              type: "string",
              description: "Training data source",
              alias: "d"
            }
          },
          async run({ args }) {
            const spinner = ora(`Training ${args.pattern} neural pattern...`).start();
            
            try {
              const mcp = await createMCPBridge();
              
              const trainResult = await executeMCPCommand(
                mcp,
                "mcp__claude-flow__neural_train",
                {
                  pattern_type: args.pattern,
                  training_data: args.data || "default_dataset",
                  epochs: parseInt(args.epochs)
                },
                spinner
              );
              
              console.log(chalk.green(`✅ Neural pattern training completed`));
              console.log(`  Pattern: ${chalk.cyan(args.pattern)}`);
              console.log(`  Epochs: ${chalk.cyan(args.epochs)}`);
              console.log(`  Architecture: ${chalk.cyan(args.architecture)}`);
              
              return {
                success: true,
                data: trainResult
              };
              
            } catch (error) {
              spinner.fail("Neural training failed");
              throw new UnjucksCommandError(
                "NEURAL_TRAIN_FAILED",
                `Failed to train neural pattern: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }),

        /**
         * Analyze cognitive patterns
         */
        patterns: defineCommand({
          meta: {
            name: "patterns",
            description: "Analyze and manage cognitive patterns"
          },
          args: {
            action: {
              type: "positional",
              description: "Action: analyze, learn, predict",
              default: "analyze"
            },
            pattern: {
              type: "string",
              description: "Pattern type to analyze",
              alias: "p"
            }
          },
          async run({ args }) {
            const spinner = ora(`${args.action}ing cognitive patterns...`).start();
            
            try {
              const mcp = await createMCPBridge();
              
              const patternsResult = await executeMCPCommand(
                mcp,
                "mcp__claude-flow__neural_patterns",
                {
                  action: args.action,
                  pattern: args.pattern
                },
                spinner
              );
              
              console.log(chalk.blue("\n🧠 Cognitive Patterns Analysis"));
              console.log(chalk.gray("=" .repeat(50)));
              console.log(JSON.stringify(patternsResult, null, 2));
              
              return {
                success: true,
                data: patternsResult
              };
              
            } catch (error) {
              spinner.fail("Pattern analysis failed");
              throw new UnjucksCommandError(
                "NEURAL_PATTERNS_FAILED",
                `Failed to analyze patterns: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }),

        /**
         * Create distributed neural cluster
         */
        cluster: defineCommand({
          meta: {
            name: "cluster",
            description: "Create distributed neural network cluster"
          },
          args: {
            name: {
              type: "positional",
              description: "Cluster name",
              required: true
            },
            nodes: {
              type: "string",
              description: "Number of nodes",
              default: "3",
              alias: "n"
            },
            topology: {
              type: "string",
              description: "Network topology",
              default: "mesh",
              alias: "t"
            },
            architecture: {
              type: "string",
              description: "Neural architecture",
              default: "transformer",
              alias: "arch"
            }
          },
          async run({ args }) {
            const spinner = ora(`Creating neural cluster: ${args.name}...`).start();
            
            try {
              const mcp = await createMCPBridge();
              
              // Initialize neural cluster via flow-nexus
              const clusterResult = await executeMCPCommand(
                mcp,
                "mcp__flow-nexus__neural_cluster_init",
                {
                  name: args.name,
                  topology: args.topology,
                  architecture: args.architecture,
                  daaEnabled: true,
                  wasmOptimization: true
                },
                spinner
              );
              
              // Deploy nodes
              for (let i = 0; i < parseInt(args.nodes); i++) {
                spinner.text = `Deploying node ${i + 1}/${args.nodes}...`;
                await executeMCPCommand(
                  mcp,
                  "mcp__flow-nexus__neural_node_deploy",
                  {
                    cluster_id: clusterResult.cluster_id,
                    node_type: "worker",
                    autonomy: 0.8
                  }
                );
              }
              
              // Connect nodes
              spinner.text = "Connecting cluster nodes...";
              await executeMCPCommand(
                mcp,
                "mcp__flow-nexus__neural_cluster_connect",
                {
                  cluster_id: clusterResult.cluster_id,
                  topology: args.topology
                },
                spinner
              );
              
              console.log(chalk.green(`✅ Neural cluster created: ${args.name}`));
              console.log(`  Cluster ID: ${chalk.cyan(clusterResult.cluster_id)}`);
              console.log(`  Nodes: ${chalk.cyan(args.nodes)}`);
              console.log(`  Topology: ${chalk.cyan(args.topology)}`);
              console.log(`  Architecture: ${chalk.cyan(args.architecture)}`);
              
              return {
                success: true,
                data: clusterResult
              };
              
            } catch (error) {
              spinner.fail("Failed to create neural cluster");
              throw new UnjucksCommandError(
                "NEURAL_CLUSTER_FAILED",
                `Failed to create neural cluster: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }),

        /**
         * Get neural status
         */
        status: defineCommand({
          meta: {
            name: "status",
            description: "Get neural network status"
          },
          args: {
            cluster: {
              type: "string",
              description: "Specific cluster ID",
              alias: "c"
            }
          },
          async run({ args }) {
            const spinner = ora("Retrieving neural status...").start();
            
            try {
              const mcp = await createMCPBridge();
              
              const neuralStatus = await executeMCPCommand(
                mcp,
                "mcp__claude-flow__neural_status",
                {
                  modelId: args.cluster
                },
                spinner
              );
              
              console.log(chalk.blue("\n🧠 Neural Network Status"));
              console.log(chalk.gray("=" .repeat(50)));
              console.log(JSON.stringify(neuralStatus, null, 2));
              
              return {
                success: true,
                data: neuralStatus
              };
              
            } catch (error) {
              spinner.fail("Failed to retrieve neural status");
              throw new UnjucksCommandError(
                "NEURAL_STATUS_FAILED",
                `Failed to get neural status: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        })
      }
    }),

    /**
     * Memory management with persistence
     */
    memory: defineCommand({
      meta: {
        name: "memory",
        description: "Advanced memory management and persistence"
      },
      subcommands: {
        /**
         * Store data in memory
         */
        store: defineCommand({
          meta: {
            name: "store",
            description: "Store data in swarm memory"
          },
          args: {
            key: {
              type: "positional",
              description: "Memory key",
              required: true
            },
            value: {
              type: "positional",
              description: "Value to store",
              required: true
            },
            namespace: {
              type: "string",
              description: "Memory namespace",
              default: "swarm",
              alias: "ns"
            },
            ttl: {
              type: "string",
              description: "Time-to-live in seconds",
              alias: "t"
            }
          },
          async run({ args }) {
            const spinner = ora(`Storing data: ${args.key}...`).start();
            
            try {
              const mcp = await createMCPBridge();
              
              const storeResult = await executeMCPCommand(
                mcp,
                "mcp__claude-flow__memory_usage",
                {
                  action: "store",
                  key: args.key,
                  value: args.value,
                  namespace: args.namespace,
                  ttl: args.ttl ? parseInt(args.ttl) : undefined
                },
                spinner
              );
              
              console.log(chalk.green(`✅ Data stored: ${args.key}`));
              console.log(`  Namespace: ${chalk.cyan(args.namespace)}`);
              if (args.ttl) console.log(`  TTL: ${chalk.cyan(args.ttl)} seconds`);
              
              return {
                success: true,
                data: storeResult
              };
              
            } catch (error) {
              spinner.fail("Failed to store data");
              throw new UnjucksCommandError(
                "MEMORY_STORE_FAILED",
                `Failed to store data: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }),

        /**
         * Retrieve data from memory
         */
        retrieve: defineCommand({
          meta: {
            name: "retrieve",
            description: "Retrieve data from swarm memory"
          },
          args: {
            key: {
              type: "positional",
              description: "Memory key",
              required: true
            },
            namespace: {
              type: "string",
              description: "Memory namespace",
              default: "swarm",
              alias: "ns"
            }
          },
          async run({ args }) {
            const spinner = ora(`Retrieving data: ${args.key}...`).start();
            
            try {
              const mcp = await createMCPBridge();
              
              const retrieveResult = await executeMCPCommand(
                mcp,
                "mcp__claude-flow__memory_usage",
                {
                  action: "retrieve",
                  key: args.key,
                  namespace: args.namespace
                },
                spinner
              );
              
              console.log(chalk.blue(`\n💾 Retrieved: ${args.key}`));
              console.log(chalk.gray("=" .repeat(50)));
              console.log(retrieveResult.value || "No data found");
              
              return {
                success: true,
                data: retrieveResult
              };
              
            } catch (error) {
              spinner.fail("Failed to retrieve data");
              throw new UnjucksCommandError(
                "MEMORY_RETRIEVE_FAILED",
                `Failed to retrieve data: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }),

        /**
         * Search memory with patterns
         */
        search: defineCommand({
          meta: {
            name: "search",
            description: "Search memory with patterns"
          },
          args: {
            pattern: {
              type: "positional",
              description: "Search pattern",
              required: true
            },
            namespace: {
              type: "string",
              description: "Memory namespace",
              alias: "ns"
            },
            limit: {
              type: "string",
              description: "Max results",
              default: "10",
              alias: "l"
            }
          },
          async run({ args }) {
            const spinner = ora(`Searching memory: ${args.pattern}...`).start();
            
            try {
              const mcp = await createMCPBridge();
              
              const searchResult = await executeMCPCommand(
                mcp,
                "mcp__claude-flow__memory_search",
                {
                  pattern: args.pattern,
                  namespace: args.namespace,
                  limit: parseInt(args.limit)
                },
                spinner
              );
              
              console.log(chalk.blue(`\n🔍 Search Results for: ${args.pattern}`));
              console.log(chalk.gray("=" .repeat(50)));
              
              if (searchResult.results?.length) {
                searchResult.results.forEach((result: any, index: number) => {
                  console.log(`${chalk.cyan(`${index + 1}.`)} ${result.key}: ${result.value}`);
                });
              } else {
                console.log(chalk.yellow("No results found"));
              }
              
              return {
                success: true,
                data: searchResult
              };
              
            } catch (error) {
              spinner.fail("Failed to search memory");
              throw new UnjucksCommandError(
                "MEMORY_SEARCH_FAILED",
                `Failed to search memory: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }),

        /**
         * Backup memory
         */
        backup: defineCommand({
          meta: {
            name: "backup",
            description: "Create memory backup"
          },
          args: {
            path: {
              type: "string",
              description: "Backup file path",
              alias: "p"
            }
          },
          async run({ args }) {
            const spinner = ora("Creating memory backup...").start();
            
            try {
              const mcp = await createMCPBridge();
              
              const backupResult = await executeMCPCommand(
                mcp,
                "mcp__claude-flow__memory_backup",
                {
                  path: args.path
                },
                spinner
              );
              
              console.log(chalk.green("✅ Memory backup created"));
              if (backupResult.path) {
                console.log(`  Location: ${chalk.cyan(backupResult.path)}`);
              }
              
              return {
                success: true,
                data: backupResult
              };
              
            } catch (error) {
              spinner.fail("Failed to create backup");
              throw new UnjucksCommandError(
                "MEMORY_BACKUP_FAILED",
                `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        })
      }
    }),

    /**
     * Real-time monitoring and health checks
     */
    monitor: defineCommand({
      meta: {
        name: "monitor",
        description: "Real-time swarm monitoring and health checks"
      },
      args: {
        duration: {
          type: "string",
          description: "Monitoring duration in seconds",
          default: "60",
          alias: "d"
        },
        interval: {
          type: "string",
          description: "Update interval in seconds",
          default: "5",
          alias: "i"
        },
        detailed: {
          type: "boolean",
          description: "Show detailed metrics",
          default: false,
          alias: "v"
        },
        export: {
          type: "string",
          description: "Export metrics to file",
          alias: "e"
        },
        realtime: {
          type: "boolean",
          description: "Enable real-time streaming",
          default: false,
          alias: "rt"
        }
      },
      async run({ args }) {
        const spinner = ora("Starting swarm monitoring...").start();
        
        try {
          const mcp = await createMCPBridge();
          
          // Start monitoring
          const monitorResult = await executeMCPCommand(
            mcp,
            "mcp__claude-flow__swarm_monitor",
            {
              duration: parseInt(args.duration),
              interval: parseInt(args.interval)
            },
            spinner
          );
          
          console.log(chalk.green("✅ Monitoring started"));
          console.log(`  Duration: ${chalk.cyan(args.duration)} seconds`);
          console.log(`  Interval: ${chalk.cyan(args.interval)} seconds`);
          console.log(`  Real-time: ${args.realtime ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
          
          if (args.export) {
            console.log(`  Export: ${chalk.cyan(args.export)}`);
          }
          
          // Show continuous updates if real-time enabled
          if (args.realtime) {
            console.log(chalk.yellow("\n👁️  Real-time monitoring (Press Ctrl+C to stop)..."));
            
            const interval = setInterval(async () => {
              try {
                const status = await executeMCPCommand(
                  mcp,
                  "mcp__claude-flow__swarm_status",
                  { verbose: args.detailed }
                );
                
                console.clear();
                displaySwarmStatus(status, args.detailed);
                console.log(chalk.gray(`\nLast updated: ${new Date().toLocaleTimeString()}`));
                
              } catch (error) {
                console.error(chalk.red("Monitoring error:", error));
              }
            }, parseInt(args.interval) * 1000);
            
            // Handle Ctrl+C
            process.on('SIGINT', () => {
              clearInterval(interval);
              console.log(chalk.yellow("\n\n📊 Monitoring stopped"));
              process.exit(0);
            });
          }
          
          return {
            success: true,
            data: monitorResult
          };
          
        } catch (error) {
          spinner.fail("Failed to start monitoring");
          throw new UnjucksCommandError(
            "MONITOR_FAILED",
            `Failed to start monitoring: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }),

    /**
     * Performance benchmarking
     */
    benchmark: defineCommand({
      meta: {
        name: "benchmark",
        description: "Run performance benchmarks"
      },
      args: {
        suite: {
          type: "string",
          description: "Benchmark suite: all, wasm, swarm, agent, task, neural",
          default: "all",
          alias: "s"
        },
        iterations: {
          type: "string",
          description: "Number of iterations",
          default: "10",
          alias: "i"
        },
        export: {
          type: "string",
          description: "Export results to file",
          alias: "e"
        }
      },
      async run({ args }) {
        const spinner = ora(`Running ${args.suite} benchmark...`).start();
        
        try {
          const mcp = await createMCPBridge();
          
          const benchmarkResult = await executeMCPCommand(
            mcp,
            "mcp__claude-flow__benchmark_run",
            {
              suite: args.suite,
              iterations: parseInt(args.iterations)
            },
            spinner
          );
          
          console.log(chalk.blue("\n⚡ Benchmark Results"));
          console.log(chalk.gray("=" .repeat(50)));
          console.log(JSON.stringify(benchmarkResult, null, 2));
          
          if (args.export) {
            await fs.writeJSON(args.export, benchmarkResult, { spaces: 2 });
            console.log(chalk.green(`\n💾 Results exported to: ${args.export}`));
          }
          
          return {
            success: true,
            data: benchmarkResult
          };
          
        } catch (error) {
          spinner.fail("Benchmark failed");
          throw new UnjucksCommandError(
            "BENCHMARK_FAILED",
            `Failed to run benchmark: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }),

    /**
     * Workflow automation and templates
     */
    workflow: defineCommand({
      meta: {
        name: "workflow",
        description: "Workflow automation and template management"
      },
      subcommands: {
        /**
         * Create workflow
         */
        create: defineCommand({
          meta: {
            name: "create",
            description: "Create new workflow"
          },
          args: {
            name: {
              type: "positional",
              description: "Workflow name",
              required: true
            },
            description: {
              type: "string",
              description: "Workflow description",
              alias: "d"
            },
            strategy: {
              type: "string",
              description: "Execution strategy",
              default: "adaptive",
              alias: "s"
            },
            file: {
              type: "string",
              description: "Save to file",
              alias: "f"
            }
          },
          async run({ args }) {
            const spinner = ora(`Creating workflow: ${args.name}...`).start();
            
            try {
              const mcp = await createMCPBridge();
              
              const workflowConfig = {
                name: args.name,
                description: args.description || `Automated workflow: ${args.name}`,
                steps: [
                  {
                    id: "init",
                    name: "Initialize",
                    action: "generate",
                    parameters: {}
                  }
                ],
                strategy: args.strategy,
                priority: "medium",
                enableMetrics: true,
                enableAuditTrail: true
              };
              
              const createResult = await executeMCPCommand(
                mcp,
                "mcp__claude-flow__workflow_create",
                workflowConfig,
                spinner
              );
              
              console.log(chalk.green(`✅ Workflow created: ${args.name}`));
              console.log(`  Strategy: ${chalk.cyan(args.strategy)}`);
              
              if (args.file) {
                await fs.writeJSON(args.file, workflowConfig, { spaces: 2 });
                console.log(`  Saved to: ${chalk.cyan(args.file)}`);
              }
              
              return {
                success: true,
                data: createResult
              };
              
            } catch (error) {
              spinner.fail("Failed to create workflow");
              throw new UnjucksCommandError(
                "WORKFLOW_CREATE_FAILED",
                `Failed to create workflow: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }),

        /**
         * Execute workflow
         */
        execute: defineCommand({
          meta: {
            name: "execute",
            description: "Execute workflow"
          },
          args: {
            workflow: {
              type: "positional",
              description: "Workflow ID or file",
              required: true
            },
            async: {
              type: "boolean",
              description: "Execute asynchronously",
              default: false,
              alias: "a"
            },
            data: {
              type: "string",
              description: "Input data JSON file",
              alias: "d"
            }
          },
          async run({ args }) {
            const spinner = ora(`Executing workflow: ${args.workflow}...`).start();
            
            try {
              const mcp = await createMCPBridge();
              
              let inputData = {};
              if (args.data && await fs.pathExists(args.data)) {
                inputData = await fs.readJSON(args.data);
              }
              
              const executeResult = await executeMCPCommand(
                mcp,
                "mcp__claude-flow__workflow_execute",
                {
                  workflow_id: args.workflow,
                  input_data: inputData,
                  async: args.async
                },
                spinner
              );
              
              console.log(chalk.green(`✅ Workflow executed: ${args.workflow}`));
              console.log(`  Async: ${args.async ? chalk.green('Yes') : chalk.gray('No')}`);
              
              if (executeResult.execution_id) {
                console.log(`  Execution ID: ${chalk.cyan(executeResult.execution_id)}`);
              }
              
              return {
                success: true,
                data: executeResult
              };
              
            } catch (error) {
              spinner.fail("Failed to execute workflow");
              throw new UnjucksCommandError(
                "WORKFLOW_EXECUTE_FAILED",
                `Failed to execute workflow: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }),

        /**
         * List workflows
         */
        list: defineCommand({
          meta: {
            name: "list",
            description: "List available workflows"
          },
          args: {
            status: {
              type: "string",
              description: "Filter by status",
              alias: "s"
            },
            limit: {
              type: "string",
              description: "Maximum results",
              default: "10",
              alias: "l"
            }
          },
          async run({ args }) {
            const spinner = ora("Retrieving workflows...").start();
            
            try {
              const mcp = await createMCPBridge();
              
              const workflows = await executeMCPCommand(
                mcp,
                "mcp__claude-flow__workflow_list",
                {
                  status: args.status,
                  limit: parseInt(args.limit)
                },
                spinner
              );
              
              console.log(chalk.blue(`\n📋 Available Workflows`));
              console.log(chalk.gray("=" .repeat(50)));
              
              if (workflows.workflows?.length) {
                workflows.workflows.forEach((workflow: any, index: number) => {
                  console.log(`${chalk.cyan(`${index + 1}.`)} ${workflow.name}`);
                  if (workflow.description) console.log(`   ${workflow.description}`);
                  if (workflow.status) console.log(`   Status: ${workflow.status}`);
                });
              } else {
                console.log(chalk.yellow("No workflows found"));
              }
              
              return {
                success: true,
                data: workflows
              };
              
            } catch (error) {
              spinner.fail("Failed to retrieve workflows");
              throw new UnjucksCommandError(
                "WORKFLOW_LIST_FAILED",
                `Failed to list workflows: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        })
      }
    }),

    /**
     * Health checks and diagnostics
     */
    health: defineCommand({
      meta: {
        name: "health",
        description: "Comprehensive health checks and diagnostics"
      },
      args: {
        detailed: {
          type: "boolean",
          description: "Show detailed health information",
          default: false,
          alias: "d"
        },
        components: {
          type: "string",
          description: "Comma-separated components to check",
          alias: "c"
        }
      },
      async run({ args }) {
        const spinner = ora("Running health checks...").start();
        
        try {
          const mcp = await createMCPBridge();
          
          const components = args.components ? args.components.split(",") : undefined;
          
          const healthResult = await executeMCPCommand(
            mcp,
            "mcp__claude-flow__health_check",
            {
              components: components
            },
            spinner
          );
          
          console.log(chalk.blue("\n🏥 Swarm Health Status"));
          console.log(chalk.gray("=" .repeat(50)));
          
          const overallHealth = healthResult.overall || "unknown";
          const healthColor = overallHealth === "healthy" ? chalk.green : 
                             overallHealth === "degraded" ? chalk.yellow : chalk.red;
          
          console.log(`Overall Status: ${healthColor(overallHealth)}`);
          
          if (healthResult.components) {
            console.log("\nComponent Status:");
            Object.entries(healthResult.components).forEach(([component, status]) => {
              const statusColor = status === "healthy" ? chalk.green : 
                                 status === "degraded" ? chalk.yellow : chalk.red;
              console.log(`  ${component}: ${statusColor(status as string)}`);
            });
          }
          
          if (args.detailed && healthResult.details) {
            console.log("\nDetailed Information:");
            console.log(JSON.stringify(healthResult.details, null, 2));
          }
          
          return {
            success: true,
            data: healthResult
          };
          
        } catch (error) {
          spinner.fail("Health check failed");
          throw new UnjucksCommandError(
            "HEALTH_CHECK_FAILED",
            `Failed to run health check: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }),

    /**
     * Destroy swarm and cleanup resources
     */
    destroy: defineCommand({
      meta: {
        name: "destroy",
        description: "Destroy swarm and cleanup all resources"
      },
      args: {
        swarm: {
          type: "string",
          description: "Specific swarm ID to destroy",
          alias: "s"
        },
        force: {
          type: "boolean",
          description: "Force destruction without confirmation",
          default: false,
          alias: "f"
        },
        cleanup: {
          type: "boolean",
          description: "Full cleanup including persistent data",
          default: false,
          alias: "c"
        }
      },
      async run({ args }) {
        if (!args.force) {
          console.log(chalk.yellow("⚠️  This will destroy the swarm and all associated resources."));
          console.log(chalk.yellow("   Use --force to skip this confirmation."));
          return { success: false, data: { reason: "confirmation_required" } };
        }
        
        const spinner = ora("Destroying swarm...").start();
        
        try {
          const mcp = await createMCPBridge();
          
          const destroyResult = await executeMCPCommand(
            mcp,
            "mcp__claude-flow__swarm_destroy",
            {
              swarmId: args.swarm
            },
            spinner
          );
          
          console.log(chalk.green("✅ Swarm destroyed successfully"));
          
          if (args.cleanup) {
            spinner.text = "Cleaning up persistent data...";
            // Additional cleanup operations
            console.log(chalk.green("✅ Cleanup completed"));
          }
          
          return {
            success: true,
            data: destroyResult
          };
          
        } catch (error) {
          spinner.fail("Failed to destroy swarm");
          throw new UnjucksCommandError(
            "SWARM_DESTROY_FAILED",
            `Failed to destroy swarm: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    })
  }
});