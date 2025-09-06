/**
 * MCP Integration Bridge - Links Swarm MCP with Unjucks MCP
 * 
 * This module creates a bidirectional communication layer between:
 * - Claude Flow Swarm MCP (coordination, memory, agents)  
 * - Unjucks MCP (template generation, scaffolding)
 * 
 * Responsibilities:
 * - Translate swarm tasks into unjucks operations
 * - Sync swarm memory with template variables
 * - Orchestrate JTBD workflows via MCP protocols
 * - Provide real-time coordination hooks
 */

import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import fs from 'fs-extra';
import chalk from 'chalk';
import type { 
  MCPRequest, 
  MCPResponse, 
  MCPNotification,
  UnjucksGenerateParams,
  UnjucksGenerateResult,
  UnjucksListParams,
  UnjucksHelpParams,
  UnjucksDryRunParams,
  UnjucksInjectParams,
  ToolResult
} from '../mcp/types.js';
import { Generator } from './generator.js';
import type { GenerateOptions, TemplateFile } from './generator.js';
import { RDFDataLoader } from './rdf-data-loader.js';
import type { RDFDataSource, RDFTemplateContext, TurtleData } from './types/turtle-types.js';

/**
 * Swarm task types that can be converted to unjucks operations
 */
export interface SwarmTask {
  id: string;
  type: 'generate' | 'analyze' | 'scaffold' | 'refactor' | 'document';
  description: string;
  parameters: Record<string, any>;
  agentType?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  dependencies?: string[];
}

/**
 * Swarm memory structure for template variables and context
 */
export interface SwarmMemory {
  templates: {
    variables: Record<string, any>;
    context: Record<string, any>;
    metadata: Record<string, any>;
  };
  agents: {
    [agentId: string]: {
      type: string;
      status: string;
      lastActivity: string;
      memory: Record<string, any>;
    };
  };
  tasks: {
    [taskId: string]: {
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
      result?: any;
      errors?: string[];
    };
  };
  workflows: {
    [workflowId: string]: {
      steps: Array<{
        action: string;
        parameters: Record<string, any>;
        status: string;
      }>;
      currentStep: number;
      metadata: Record<string, any>;
    };
  };
}

/**
 * JTBD (Jobs to Be Done) workflow definition
 */
export interface JTBDWorkflow {
  id: string;
  name: string;
  description: string;
  job: string; // The job the user is trying to accomplish
  steps: Array<{
    action: 'generate' | 'inject' | 'analyze' | 'validate';
    description: string;
    generator?: string;
    template?: string;
    parameters: Record<string, any>;
    conditions?: Record<string, any>;
  }>;
  triggers?: Array<{
    event: string;
    condition: string;
  }>;
}

/**
 * MCP Integration configuration
 */
export interface MCPIntegrationConfig {
  swarmMcpCommand?: string[];
  unjucksMcpCommand?: string[];
  memoryNamespace?: string;
  hooksEnabled?: boolean;
  realtimeSync?: boolean;
  debugMode?: boolean;
  timeouts?: {
    swarmRequest: number;
    unjucksRequest: number;
    memorySync: number;
  };
}

/**
 * Main MCP Integration Bridge class
 */
export class MCPBridge extends EventEmitter {
  private swarmMcp: ChildProcess | null = null;
  private unjucksMcp: ChildProcess | null = null;
  private generator: Generator;
  private rdfLoader: RDFDataLoader;
  private memory: SwarmMemory;
  private config: MCPIntegrationConfig;
  private requestId: number = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private isInitialized: boolean = false;
  
  constructor(config: Partial<MCPIntegrationConfig> = {}) {
    super();
    
    this.config = {
      swarmMcpCommand: ['npx', 'claude-flow@alpha', 'mcp', 'start'],
      unjucksMcpCommand: ['node', 'dist/mcp-server.mjs'],
      memoryNamespace: 'hive-mcp-integration',
      hooksEnabled: true,
      realtimeSync: true,
      debugMode: process.env.DEBUG_UNJUCKS === 'true',
      timeouts: {
        swarmRequest: 30000,
        unjucksRequest: 60000,
        memorySync: 5000
      },
      ...config
    };

    this.generator = new Generator();
    this.rdfLoader = new RDFDataLoader();
    this.memory = this.initializeMemory();
  }

  /**
   * Initialize the MCP Bridge and establish connections
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize swarm MCP connection
      await this.initializeSwarmMcp();
      
      // Initialize unjucks MCP connection  
      await this.initializeUnjucksMcp();
      
      // Setup real-time synchronization
      if (this.config.realtimeSync) {
        await this.setupRealtimeSync();
      }
      
      // Setup coordination hooks
      if (this.config.hooksEnabled) {
        await this.setupCoordinationHooks();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      
      if (this.config.debugMode) {
        console.log(chalk.green('[MCP Bridge] Successfully initialized'));
      }
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize MCP Bridge: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert swarm tasks to unjucks generate commands
   */
  async swarmToUnjucks(task: SwarmTask): Promise<UnjucksGenerateParams | UnjucksInjectParams | null> {
    try {
      const { type, parameters, description } = task;
      
      switch (type) {
        case 'generate':
          return this.convertGenerateTask(task);
          
        case 'scaffold':
          return this.convertScaffoldTask(task);
          
        case 'refactor':
          return await this.convertRefactorTask(task);
          
        case 'document':
          return this.convertDocumentTask(task);
          
        default:
          if (this.config.debugMode) {
            console.warn(chalk.yellow(`[MCP Bridge] Unsupported task type: ${type}`));
          }
          return null;
      }
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to convert swarm task: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert unjucks results to swarm memory format
   */
  async unjucksToSwarm(result: ToolResult, taskId: string): Promise<void> {
    try {
      // Extract structured data from unjucks result
      const resultData = this.parseUnjucksResult(result);
      
      // Update swarm memory with results
      await this.updateSwarmMemory(taskId, resultData);
      
      // Sync with swarm MCP if available
      if (this.swarmMcp) {
        await this.syncResultToSwarm(taskId, resultData);
      }
      
      // Emit result event for real-time coordination
      this.emit('unjucks-result', { taskId, result: resultData });
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to convert unjucks result: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Synchronize swarm memory with template variables
   */
  async syncTemplateVariables(
    generator: string, 
    template: string, 
    swarmContext?: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      // Get swarm memory variables
      const swarmVariables = await this.getSwarmVariables();
      
      // Scan template for required variables
      const { variables: templateVariables } = await this.generator.scanTemplateForVariables(generator, template);
      
      // Merge RDF data if available
      const rdfVariables = await this.extractRDFVariables(swarmContext);
      
      // Create merged variable set with precedence: RDF > swarm > template defaults
      const mergedVariables: Record<string, any> = {};
      
      // Start with template defaults
      for (const templateVar of templateVariables) {
        if (templateVar.defaultValue !== undefined) {
          mergedVariables[templateVar.name] = templateVar.defaultValue;
        }
      }
      
      // Override with swarm memory
      Object.assign(mergedVariables, swarmVariables);
      
      // Override with RDF data (highest precedence)
      Object.assign(mergedVariables, rdfVariables);
      
      // Override with explicit context
      if (swarmContext) {
        Object.assign(mergedVariables, swarmContext);
      }
      
      // Update memory with synchronized variables
      this.memory.templates.variables = mergedVariables;
      
      if (this.config.debugMode) {
        console.log(chalk.blue(`[MCP Bridge] Synchronized ${Object.keys(mergedVariables).length} template variables`));
      }
      
      return mergedVariables;
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to sync template variables: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute JTBD (Jobs to Be Done) workflows via MCP
   */
  async orchestrateJTBD(workflow: JTBDWorkflow): Promise<{ success: boolean; results: any[]; errors: string[] }> {
    const results: any[] = [];
    const errors: string[] = [];
    
    try {
      if (this.config.debugMode) {
        console.log(chalk.blue(`[MCP Bridge] Starting JTBD workflow: ${workflow.name}`));
        console.log(chalk.gray(`Job: ${workflow.job}`));
      }
      
      // Update workflow status in memory
      this.memory.workflows[workflow.id] = {
        steps: workflow.steps.map(step => ({ ...step, status: 'pending' })),
        currentStep: 0,
        metadata: {
          startTime: new Date().toISOString(),
          job: workflow.job
        }
      };
      
      // Execute workflow steps sequentially
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        
        try {
          // Update current step status
          this.memory.workflows[workflow.id].currentStep = i;
          this.memory.workflows[workflow.id].steps[i].status = 'in_progress';
          
          if (this.config.debugMode) {
            console.log(chalk.cyan(`[MCP Bridge] Executing step ${i + 1}: ${step.description}`));
          }
          
          // Execute step based on action type
          const stepResult = await this.executeWorkflowStep(step);
          
          results.push({
            stepIndex: i,
            action: step.action,
            description: step.description,
            result: stepResult,
            success: true
          });
          
          // Mark step as completed
          this.memory.workflows[workflow.id].steps[i].status = 'completed';
          
        } catch (stepError) {
          const errorMessage = stepError instanceof Error ? stepError.message : String(stepError);
          errors.push(`Step ${i + 1} (${step.action}): ${errorMessage}`);
          
          // Mark step as failed
          this.memory.workflows[workflow.id].steps[i].status = 'failed';
          
          results.push({
            stepIndex: i,
            action: step.action,
            description: step.description,
            error: errorMessage,
            success: false
          });
          
          if (this.config.debugMode) {
            console.error(chalk.red(`[MCP Bridge] Step ${i + 1} failed: ${errorMessage}`));
          }
          
          // Continue with next step (workflow is resilient)
        }
      }
      
      // Update workflow completion status
      const success = errors.length === 0;
      this.memory.workflows[workflow.id].metadata.endTime = new Date().toISOString();
      this.memory.workflows[workflow.id].metadata.success = success;
      
      // Sync workflow results to swarm memory
      await this.syncWorkflowToSwarm(workflow.id, results, errors);
      
      if (this.config.debugMode) {
        const duration = Date.now() - new Date(this.memory.workflows[workflow.id].metadata.startTime!).getTime();
        console.log(chalk.green(`[MCP Bridge] JTBD workflow completed in ${duration}ms`));
        console.log(chalk.gray(`Success: ${success}, Steps: ${results.length}, Errors: ${errors.length}`));
      }
      
      this.emit('jtbd-completed', { workflow, results, errors, success });
      
      return { success, results, errors };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Workflow execution failed: ${errorMessage}`);
      
      this.emit('error', error);
      return { success: false, results, errors };
    }
  }

  /**
   * Create hooks for real-time coordination between swarm and unjucks
   */
  private async setupCoordinationHooks(): Promise<void> {
    // Hook: Pre-task coordination
    this.on('pre-task', async (task: SwarmTask) => {
      try {
        // Sync memory before task execution
        await this.syncMemoryFromSwarm();
        
        // Update task status in memory
        this.memory.tasks[task.id] = {
          status: 'in_progress'
        };
        
        if (this.config.debugMode) {
          console.log(chalk.blue(`[Hook] Pre-task: ${task.description}`));
        }
        
      } catch (error) {
        this.emit('error', error);
      }
    });
    
    // Hook: Post-task coordination
    this.on('post-task', async (taskId: string, result: any) => {
      try {
        // Update task status in memory
        this.memory.tasks[taskId] = {
          status: 'completed',
          result
        };
        
        // Sync results back to swarm
        await this.syncResultToSwarm(taskId, result);
        
        if (this.config.debugMode) {
          console.log(chalk.green(`[Hook] Post-task completed: ${taskId}`));
        }
        
      } catch (error) {
        this.emit('error', error);
      }
    });
    
    // Hook: Memory synchronization
    this.on('memory-sync', async () => {
      try {
        await this.syncMemoryBidirectional();
      } catch (error) {
        this.emit('error', error);
      }
    });
    
    // Hook: Template variable updates
    this.on('template-variables-updated', async (variables: Record<string, any>) => {
      try {
        this.memory.templates.variables = { ...this.memory.templates.variables, ...variables };
        await this.syncVariablesToSwarm(variables);
      } catch (error) {
        this.emit('error', error);
      }
    });
  }

  /**
   * Setup real-time synchronization between swarm and unjucks MCPs
   */
  private async setupRealtimeSync(): Promise<void> {
    // Sync memory every 5 seconds
    setInterval(async () => {
      try {
        await this.syncMemoryBidirectional();
      } catch (error) {
        if (this.config.debugMode) {
          console.warn(chalk.yellow(`[MCP Bridge] Sync failed: ${error instanceof Error ? error.message : String(error)}`));
        }
      }
    }, this.config.timeouts!.memorySync);
    
    // Listen for swarm memory changes
    if (this.swarmMcp) {
      this.swarmMcp.on('message', this.handleSwarmMessage.bind(this));
    }
  }

  /**
   * Store integration schema in swarm memory using hooks
   */
  async storeIntegrationSchema(): Promise<void> {
    const schema = {
      version: '1.0.0',
      bridge: 'mcp-integration',
      capabilities: {
        swarmToUnjucks: true,
        unjucksToSwarm: true,
        templateVariableSync: true,
        jtbdWorkflows: true,
        realtimeCoordination: this.config.realtimeSync,
        rdfSupport: true
      },
      endpoints: {
        swarmMcp: this.config.swarmMcpCommand,
        unjucksMcp: this.config.unjucksMcpCommand
      },
      memoryNamespace: this.config.memoryNamespace,
      timestamp: new Date().toISOString()
    };

    try {
      // Store in local memory
      this.memory.templates.metadata.integrationSchema = schema;
      
      // Execute hooks to store in swarm memory
      if (this.swarmMcp && this.config.hooksEnabled) {
        await this.executeSwarmHook('post-edit', {
          memoryKey: `${this.config.memoryNamespace}/schema`,
          data: schema
        });
      }
      
      if (this.config.debugMode) {
        console.log(chalk.green('[MCP Bridge] Integration schema stored'));
      }
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to store integration schema: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Coordinate with swarm via hooks notification
   */
  async coordinateWithSwarm(message: string, data?: any): Promise<void> {
    try {
      if (this.swarmMcp && this.config.hooksEnabled) {
        await this.executeSwarmHook('notify', {
          message,
          data
        });
      }
      
      this.emit('swarm-coordination', { message, data });
      
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to coordinate with swarm: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private initializeMemory(): SwarmMemory {
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

  private async initializeSwarmMcp(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.swarmMcpCommand) {
        reject(new Error('Swarm MCP command not configured'));
        return;
      }

      const [command, ...args] = this.config.swarmMcpCommand;
      this.swarmMcp = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'production' }
      });

      this.swarmMcp.on('error', reject);
      this.swarmMcp.on('spawn', () => {
        if (this.config.debugMode) {
          console.log(chalk.green('[MCP Bridge] Swarm MCP connected'));
        }
        resolve();
      });
    });
  }

  private async initializeUnjucksMcp(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.unjucksMcpCommand) {
        reject(new Error('Unjucks MCP command not configured'));
        return;
      }

      const [command, ...args] = this.config.unjucksMcpCommand;
      this.unjucksMcp = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'production' }
      });

      this.unjucksMcp.on('error', reject);
      this.unjucksMcp.on('spawn', () => {
        if (this.config.debugMode) {
          console.log(chalk.green('[MCP Bridge] Unjucks MCP connected'));
        }
        resolve();
      });
    });
  }

  private convertGenerateTask(task: SwarmTask): UnjucksGenerateParams {
    const { parameters } = task;
    
    return {
      generator: parameters.generator || 'default',
      template: parameters.template || 'basic',
      dest: parameters.dest || './generated',
      variables: parameters.variables || {},
      force: parameters.force || false,
      dry: parameters.dry || false
    };
  }

  private convertScaffoldTask(task: SwarmTask): UnjucksGenerateParams {
    const { parameters } = task;
    
    return {
      generator: parameters.type || 'scaffold',
      template: parameters.template || 'project',
      dest: parameters.dest || './scaffolded',
      variables: {
        projectName: parameters.name || 'new-project',
        description: parameters.description || 'Generated by MCP Bridge',
        ...parameters.variables
      },
      force: parameters.force || false,
      dry: parameters.dry || false
    };
  }

  private async convertRefactorTask(task: SwarmTask): Promise<UnjucksInjectParams> {
    const { parameters } = task;
    
    return {
      file: parameters.file,
      content: parameters.content || parameters.code,
      before: parameters.before,
      after: parameters.after,
      append: parameters.append || false,
      prepend: parameters.prepend || false,
      lineAt: parameters.lineAt,
      force: parameters.force || false,
      dry: parameters.dry || false
    };
  }

  private convertDocumentTask(task: SwarmTask): UnjucksGenerateParams {
    const { parameters } = task;
    
    return {
      generator: 'docs',
      template: parameters.docType || 'api',
      dest: parameters.dest || './docs',
      variables: {
        title: parameters.title || task.description,
        content: parameters.content || '',
        ...parameters.variables
      },
      force: parameters.force || false,
      dry: parameters.dry || false
    };
  }

  private parseUnjucksResult(result: ToolResult): any {
    try {
      // Extract structured data from the tool result
      const content = result.content?.[0];
      if (content?.type === 'text') {
        try {
          return JSON.parse(content.text);
        } catch {
          return { message: content.text };
        }
      }
      
      return {
        success: !result.isError,
        metadata: result._meta || {},
        content: result.content
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async updateSwarmMemory(taskId: string, resultData: any): Promise<void> {
    this.memory.tasks[taskId] = {
      status: resultData.success ? 'completed' : 'failed',
      result: resultData,
      errors: resultData.success ? undefined : [resultData.error || 'Unknown error']
    };
  }

  private async syncResultToSwarm(taskId: string, resultData: any): Promise<void> {
    if (!this.swarmMcp || !this.config.hooksEnabled) {
      return;
    }

    try {
      await this.executeSwarmHook('post-task', {
        taskId,
        result: resultData
      });
    } catch (error) {
      if (this.config.debugMode) {
        console.warn(chalk.yellow(`[MCP Bridge] Failed to sync result to swarm: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
  }

  private async getSwarmVariables(): Promise<Record<string, any>> {
    if (!this.swarmMcp) {
      return {};
    }

    try {
      // Request variables from swarm memory
      const response = await this.sendSwarmRequest({
        method: 'memory_usage',
        params: {
          action: 'retrieve',
          namespace: this.config.memoryNamespace,
          key: 'template-variables'
        }
      });

      return response?.result?.variables || {};
      
    } catch (error) {
      if (this.config.debugMode) {
        console.warn(chalk.yellow(`[MCP Bridge] Failed to get swarm variables: ${error instanceof Error ? error.message : String(error)}`));
      }
      return {};
    }
  }

  private async extractRDFVariables(swarmContext?: Record<string, any>): Promise<Record<string, any>> {
    if (!swarmContext?.rdf) {
      return {};
    }

    try {
      const rdfSource: RDFDataSource = {
        type: swarmContext.rdf.type || 'inline',
        source: swarmContext.rdf.source || swarmContext.rdf.data,
        format: swarmContext.rdf.format || 'turtle'
      };

      const result = await this.rdfLoader.loadData(rdfSource);
      if (result.success) {
        return result.variables;
      }

      return {};

    } catch (error) {
      if (this.config.debugMode) {
        console.warn(chalk.yellow(`[MCP Bridge] Failed to extract RDF variables: ${error instanceof Error ? error.message : String(error)}`));
      }
      return {};
    }
  }

  private async executeWorkflowStep(step: JTBDWorkflow['steps'][0]): Promise<any> {
    switch (step.action) {
      case 'generate':
        return await this.executeGenerateStep(step);
      case 'inject':
        return await this.executeInjectStep(step);
      case 'analyze':
        return await this.executeAnalyzeStep(step);
      case 'validate':
        return await this.executeValidateStep(step);
      default:
        throw new Error(`Unsupported workflow step action: ${step.action}`);
    }
  }

  private async executeGenerateStep(step: JTBDWorkflow['steps'][0]): Promise<any> {
    if (!this.unjucksMcp) {
      throw new Error('Unjucks MCP not available for generate step');
    }

    const params: UnjucksGenerateParams = {
      generator: step.generator!,
      template: step.template!,
      dest: step.parameters.dest,
      variables: step.parameters.variables || {},
      force: step.parameters.force || false,
      dry: step.parameters.dry || false
    };

    return await this.sendUnjucksRequest({
      method: 'tools/call',
      params: {
        name: 'unjucks_generate',
        arguments: params
      }
    });
  }

  private async executeInjectStep(step: JTBDWorkflow['steps'][0]): Promise<any> {
    if (!this.unjucksMcp) {
      throw new Error('Unjucks MCP not available for inject step');
    }

    const params: UnjucksInjectParams = {
      file: step.parameters.file,
      content: step.parameters.content,
      before: step.parameters.before,
      after: step.parameters.after,
      append: step.parameters.append,
      prepend: step.parameters.prepend,
      force: step.parameters.force || false,
      dry: step.parameters.dry || false
    };

    return await this.sendUnjucksRequest({
      method: 'tools/call',
      params: {
        name: 'unjucks_inject',
        arguments: params
      }
    });
  }

  private async executeAnalyzeStep(step: JTBDWorkflow['steps'][0]): Promise<any> {
    // Analyze templates or generated files
    const analysisResult = {
      templates: await this.generator.listGenerators(),
      variables: await this.generator.scanTemplateForVariables(
        step.generator || 'default',
        step.template || 'basic'
      ),
      parameters: step.parameters
    };

    return analysisResult;
  }

  private async executeValidateStep(step: JTBDWorkflow['steps'][0]): Promise<any> {
    // Validate generated files or template structure
    const validationResult = {
      valid: true,
      errors: [] as string[],
      warnings: [] as string[],
      parameters: step.parameters
    };

    // Basic file existence validation
    if (step.parameters.files) {
      for (const file of step.parameters.files) {
        if (!await fs.pathExists(file)) {
          validationResult.valid = false;
          validationResult.errors.push(`File not found: ${file}`);
        }
      }
    }

    return validationResult;
  }

  private async syncMemoryBidirectional(): Promise<void> {
    try {
      // Sync from swarm to local memory
      await this.syncMemoryFromSwarm();
      
      // Sync from local memory to swarm
      await this.syncMemoryToSwarm();
      
    } catch (error) {
      if (this.config.debugMode) {
        console.warn(chalk.yellow(`[MCP Bridge] Memory sync failed: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
  }

  private async syncMemoryFromSwarm(): Promise<void> {
    if (!this.swarmMcp) {
      return;
    }

    try {
      const response = await this.sendSwarmRequest({
        method: 'memory_usage',
        params: {
          action: 'retrieve',
          namespace: this.config.memoryNamespace
        }
      });

      if (response?.result) {
        // Merge swarm memory with local memory
        Object.assign(this.memory, response.result);
      }

    } catch (error) {
      // Silent fail for memory sync
    }
  }

  private async syncMemoryToSwarm(): Promise<void> {
    if (!this.swarmMcp) {
      return;
    }

    try {
      await this.sendSwarmRequest({
        method: 'memory_usage',
        params: {
          action: 'store',
          namespace: this.config.memoryNamespace,
          key: 'bridge-state',
          value: this.memory
        }
      });

    } catch (error) {
      // Silent fail for memory sync
    }
  }

  private async syncVariablesToSwarm(variables: Record<string, any>): Promise<void> {
    if (!this.swarmMcp) {
      return;
    }

    try {
      await this.sendSwarmRequest({
        method: 'memory_usage',
        params: {
          action: 'store',
          namespace: this.config.memoryNamespace,
          key: 'template-variables',
          value: { variables }
        }
      });

    } catch (error) {
      // Silent fail for variable sync
    }
  }

  private async syncWorkflowToSwarm(workflowId: string, results: any[], errors: string[]): Promise<void> {
    if (!this.swarmMcp) {
      return;
    }

    try {
      await this.sendSwarmRequest({
        method: 'memory_usage',
        params: {
          action: 'store',
          namespace: this.config.memoryNamespace,
          key: `workflow-${workflowId}`,
          value: { results, errors, timestamp: new Date().toISOString() }
        }
      });

    } catch (error) {
      // Silent fail for workflow sync
    }
  }

  private async executeSwarmHook(hookType: string, params: any): Promise<any> {
    if (!this.swarmMcp || !this.config.hooksEnabled) {
      return null;
    }

    try {
      // Execute claude-flow hooks via spawned process
      const hookProcess = spawn('npx', ['claude-flow@alpha', 'hooks', hookType], {
        input: JSON.stringify(params),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      return new Promise((resolve, reject) => {
        let output = '';
        
        hookProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });

        hookProcess.on('close', (code) => {
          if (code === 0) {
            try {
              resolve(JSON.parse(output));
            } catch {
              resolve(output);
            }
          } else {
            reject(new Error(`Hook ${hookType} exited with code ${code}`));
          }
        });

        hookProcess.on('error', reject);
        
        // Send params as JSON
        hookProcess.stdin?.write(JSON.stringify(params));
        hookProcess.stdin?.end();
      });

    } catch (error) {
      if (this.config.debugMode) {
        console.warn(chalk.yellow(`[MCP Bridge] Hook execution failed: ${error instanceof Error ? error.message : String(error)}`));
      }
      return null;
    }
  }

  private async sendSwarmRequest(request: Partial<MCPRequest>): Promise<MCPResponse | null> {
    if (!this.swarmMcp) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const fullRequest: MCPRequest = {
        jsonrpc: "2.0",
        id,
        method: request.method!,
        params: request.params
      };

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Swarm MCP request timeout'));
      }, this.config.timeouts!.swarmRequest);

      this.pendingRequests.set(id, {
        resolve: (response: MCPResponse) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.swarmMcp!.stdin?.write(JSON.stringify(fullRequest) + '\n');
    });
  }

  private async sendUnjucksRequest(request: Partial<MCPRequest>): Promise<MCPResponse | null> {
    if (!this.unjucksMcp) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const fullRequest: MCPRequest = {
        jsonrpc: "2.0",
        id,
        method: request.method!,
        params: request.params
      };

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Unjucks MCP request timeout'));
      }, this.config.timeouts!.unjucksRequest);

      this.pendingRequests.set(id, {
        resolve: (response: MCPResponse) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.unjucksMcp!.stdin?.write(JSON.stringify(fullRequest) + '\n');
    });
  }

  private handleSwarmMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve } = this.pendingRequests.get(message.id)!;
        this.pendingRequests.delete(message.id);
        resolve(message);
      } else if (message.method) {
        // Handle notifications
        this.emit('swarm-notification', message);
      }
      
    } catch (error) {
      if (this.config.debugMode) {
        console.warn(chalk.yellow(`[MCP Bridge] Failed to parse swarm message: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
  }

  /**
   * Cleanup resources and close connections
   */
  async destroy(): Promise<void> {
    this.isInitialized = false;
    
    // Close MCP connections
    if (this.swarmMcp) {
      this.swarmMcp.kill();
      this.swarmMcp = null;
    }
    
    if (this.unjucksMcp) {
      this.unjucksMcp.kill();
      this.unjucksMcp = null;
    }
    
    // Clear pending requests
    this.pendingRequests.clear();
    
    // Remove all listeners
    this.removeAllListeners();
    
    if (this.config.debugMode) {
      console.log(chalk.gray('[MCP Bridge] Destroyed'));
    }
  }

  /**
   * Get current bridge status and statistics
   */
  getStatus(): {
    initialized: boolean;
    connections: { swarm: boolean; unjucks: boolean };
    memory: SwarmMemory;
    stats: { pendingRequests: number; uptime: number };
  } {
    return {
      initialized: this.isInitialized,
      connections: {
        swarm: !!this.swarmMcp,
        unjucks: !!this.unjucksMcp
      },
      memory: this.memory,
      stats: {
        pendingRequests: this.pendingRequests.size,
        uptime: process.uptime()
      }
    };
  }
}

/**
 * Factory function to create and initialize MCP Bridge
 */
export async function createMCPBridge(config?: Partial<MCPIntegrationConfig>): Promise<MCPBridge> {
  const bridge = new MCPBridge(config);
  await bridge.initialize();
  return bridge;
}

/**
 * Export types for external use
 */
export type {
  SwarmTask,
  SwarmMemory,
  JTBDWorkflow,
  MCPIntegrationConfig
};