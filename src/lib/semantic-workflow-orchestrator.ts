/**
 * Semantic Workflow Orchestrator - Advanced orchestration for semantic swarm coordination
 * 
 * Provides high-level workflow orchestration that combines:
 * - Multi-ontology task decomposition
 * - Parallel semantic processing 
 * - Results aggregation with validation
 * - Performance monitoring and optimization
 */

import { EventEmitter } from 'node:events';
import chalk from 'chalk';
import type { 
  SemanticTask, 
  SemanticAgent, 
  TaskDecomposition,
  SemanticValidationResult,
  SemanticSwarmCoordinator 
} from './semantic-swarm-patterns.js';
import type { RDFDataSource } from './types/turtle-types.js';

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  id: string;
  name: string;
  tasks: SemanticTask[];
  agents: SemanticAgent[];
  ontologies: RDFDataSource[];
  startTime: number;
  endTime?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: WorkflowResult[];
  metrics: WorkflowMetrics;
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  taskId: string;
  agentId: string;
  success: boolean;
  output: any;
  processingTime: number;
  validation?: SemanticValidationResult;
  errors?: string[];
}

/**
 * Workflow performance metrics
 */
export interface WorkflowMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskTime: number;
  totalProcessingTime: number;
  parallelEfficiency: number;
  semanticConsistencyScore: number;
  agentUtilization: Record<string, number>;
}

/**
 * Workflow execution strategy
 */
export interface ExecutionStrategy {
  type: 'parallel' | 'sequential' | 'hybrid' | 'adaptive';
  concurrencyLimit?: number;
  failureHandling: 'stop' | 'continue' | 'retry';
  retryAttempts?: number;
  timeout?: number;
  priorityOrder?: string[];
}

/**
 * Workflow orchestration configuration
 */
export interface OrchestratorConfig {
  maxConcurrentWorkflows?: number;
  defaultStrategy?: ExecutionStrategy;
  enablePerformanceMonitoring?: boolean;
  enableSemanticValidation?: boolean;
  debugMode?: boolean;
}

/**
 * Semantic Workflow Orchestrator
 */
export class SemanticWorkflowOrchestrator extends EventEmitter {
  private workflows: Map<string, WorkflowContext> = new Map();
  private coordinator: SemanticSwarmCoordinator;
  private config: OrchestratorConfig;
  private activeWorkflows: Set<string> = new Set();
  private performanceHistory: Array<{ workflowId: string; metrics: WorkflowMetrics; timestamp: number }> = [];

  constructor(coordinator: SemanticSwarmCoordinator, config: OrchestratorConfig = {}) {
    super();
    
    this.coordinator = coordinator;
    this.config = {
      maxConcurrentWorkflows: 5,
      enablePerformanceMonitoring: true,
      enableSemanticValidation: true,
      debugMode: false,
      defaultStrategy: {
        type: 'adaptive',
        concurrencyLimit: 4,
        failureHandling: 'continue',
        retryAttempts: 2,
        timeout: 300000 // 5 minutes
      },
      ...config
    };
  }

  /**
   * Create and execute a semantic workflow
   */
  async executeWorkflow(
    name: string,
    tasks: SemanticTask[],
    ontologies: RDFDataSource[] = [],
    strategy?: ExecutionStrategy
  ): Promise<WorkflowContext> {
    const workflowId = `semantic_workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();
    
    try {
      // Check workflow concurrency limit
      if (this.activeWorkflows.size >= this.config.maxConcurrentWorkflows!) {
        throw new Error(`Maximum concurrent workflows (${this.config.maxConcurrentWorkflows}) reached`);
      }

      // Create workflow context
      const context: WorkflowContext = {
        id: workflowId,
        name,
        tasks,
        agents: [],
        ontologies,
        startTime,
        status: 'pending',
        results: [],
        metrics: this.initializeMetrics(tasks.length)
      };

      this.workflows.set(workflowId, context);
      this.activeWorkflows.add(workflowId);

      if (this.config.debugMode) {
        console.log(chalk.blue(`[Semantic Orchestrator] Starting workflow '${name}' with ${tasks.length} tasks`));
      }

      // Phase 1: Task Analysis and Agent Assignment
      context.status = 'running';
      await this.assignAgentsToTasks(context);

      // Phase 2: Task Decomposition and Optimization  
      const decompositions = await this.decomposeWorkflowTasks(context);

      // Phase 3: Execution Strategy Selection
      const executionStrategy = strategy || this.selectOptimalStrategy(context, decompositions);

      // Phase 4: Parallel Execution with Coordination
      const results = await this.executeTasksWithStrategy(context, executionStrategy, decompositions);

      // Phase 5: Results Aggregation and Validation
      const aggregatedResults = await this.aggregateAndValidateResults(context, results, ontologies);

      // Phase 6: Performance Analysis and Learning
      await this.analyzeWorkflowPerformance(context);

      context.endTime = performance.now();
      context.status = 'completed';
      context.results = aggregatedResults;

      this.activeWorkflows.delete(workflowId);

      if (this.config.debugMode) {
        console.log(chalk.green(`[Semantic Orchestrator] Completed workflow '${name}' in ${(context.endTime - context.startTime).toFixed(2)}ms`));
      }

      this.emit('workflow-completed', context);

      return context;

    } catch (error) {
      const context = this.workflows.get(workflowId);
      if (context) {
        context.status = 'failed';
        context.endTime = performance.now();
      }
      
      this.activeWorkflows.delete(workflowId);
      
      if (this.config.debugMode) {
        console.error(chalk.red(`[Semantic Orchestrator] Workflow '${name}' failed: ${error instanceof Error ? error.message : String(error)}`));
      }

      this.emit('workflow-failed', { workflowId, name, error });
      throw error;
    }
  }

  /**
   * Get workflow status and metrics
   */
  getWorkflowStatus(workflowId: string): WorkflowContext | null {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * Get orchestrator performance metrics
   */
  getOrchestratorMetrics(): {
    activeWorkflows: number;
    totalWorkflowsExecuted: number;
    averageWorkflowTime: number;
    successRate: number;
    agentEfficiency: Record<string, number>;
    recentPerformance: Array<{ workflowId: string; metrics: WorkflowMetrics; timestamp: number }>;
  } {
    const totalWorkflows = this.performanceHistory.length;
    const successfulWorkflows = this.performanceHistory.filter(h => h.metrics.failedTasks === 0).length;
    const avgTime = totalWorkflows > 0 
      ? this.performanceHistory.reduce((sum, h) => sum + h.metrics.totalProcessingTime, 0) / totalWorkflows
      : 0;

    // Calculate agent efficiency across all workflows
    const agentEfficiency: Record<string, number> = {};
    for (const history of this.performanceHistory) {
      for (const [agentId, utilization] of Object.entries(history.metrics.agentUtilization)) {
        if (!agentEfficiency[agentId]) agentEfficiency[agentId] = 0;
        agentEfficiency[agentId] += utilization;
      }
    }

    // Average the efficiency scores
    for (const agentId of Object.keys(agentEfficiency)) {
      agentEfficiency[agentId] /= totalWorkflows;
    }

    return {
      activeWorkflows: this.activeWorkflows.size,
      totalWorkflowsExecuted: totalWorkflows,
      averageWorkflowTime: avgTime,
      successRate: totalWorkflows > 0 ? successfulWorkflows / totalWorkflows : 1,
      agentEfficiency,
      recentPerformance: this.performanceHistory.slice(-10) // Last 10 workflows
    };
  }

  /**
   * Cancel a running workflow
   */
  async cancelWorkflow(workflowId: string): Promise<boolean> {
    const context = this.workflows.get(workflowId);
    if (!context || context.status !== 'running') {
      return false;
    }

    try {
      context.status = 'failed';
      context.endTime = performance.now();
      this.activeWorkflows.delete(workflowId);

      if (this.config.debugMode) {
        console.log(chalk.yellow(`[Semantic Orchestrator] Cancelled workflow ${workflowId}`));
      }

      this.emit('workflow-cancelled', context);
      return true;

    } catch (error) {
      return false;
    }
  }

  // ==================== PRIVATE METHODS ====================

  private initializeMetrics(taskCount: number): WorkflowMetrics {
    return {
      totalTasks: taskCount,
      completedTasks: 0,
      failedTasks: 0,
      averageTaskTime: 0,
      totalProcessingTime: 0,
      parallelEfficiency: 0,
      semanticConsistencyScore: 0,
      agentUtilization: {}
    };
  }

  private async assignAgentsToTasks(context: WorkflowContext): Promise<void> {
    const assignedAgents: Set<string> = new Set();

    for (const task of context.tasks) {
      // Route task to best available agent
      const routedTask = await this.coordinator.routeTaskToAgent(task);
      
      if (routedTask.assignedAgent) {
        assignedAgents.add(routedTask.assignedAgent.id);
        
        // Update task in context
        const taskIndex = context.tasks.findIndex(t => t.id === task.id);
        if (taskIndex >= 0) {
          context.tasks[taskIndex] = routedTask;
        }
      }
    }

    // Store unique agents involved in workflow
    const swarmStatus = this.coordinator.getSwarmStatus();
    context.agents = swarmStatus.agents
      .filter(agent => assignedAgents.has(agent.id))
      .map(agent => ({
        id: agent.id,
        type: agent.type as any,
        name: agent.name,
        expertise: [], // Would be populated from actual agent data
        status: agent.status as any,
        currentTasks: [],
        memory: { ontologies: {}, templates: {}, patterns: {}, crossReferences: {}, lastUpdated: '' },
        performance: agent.performance
      }));
  }

  private async decomposeWorkflowTasks(context: WorkflowContext): Promise<Map<string, TaskDecomposition>> {
    const decompositions = new Map<string, TaskDecomposition>();

    for (const task of context.tasks) {
      try {
        const decomposition = await this.coordinator.decomposeTask(task);
        decompositions.set(task.id, decomposition);
      } catch (error) {
        if (this.config.debugMode) {
          console.warn(chalk.yellow(`[Semantic Orchestrator] Failed to decompose task ${task.id}: ${error instanceof Error ? error.message : String(error)}`));
        }
      }
    }

    return decompositions;
  }

  private selectOptimalStrategy(
    context: WorkflowContext,
    decompositions: Map<string, TaskDecomposition>
  ): ExecutionStrategy {
    // Analyze task dependencies and complexity
    const totalSubTasks = Array.from(decompositions.values())
      .reduce((sum, d) => sum + d.subTasks.length, 0);
    
    const hasDependencies = Array.from(decompositions.values())
      .some(d => d.subTasks.some(st => st.dependencies.length > 0));

    // Select strategy based on analysis
    if (totalSubTasks > 20 && !hasDependencies) {
      return { type: 'parallel', concurrencyLimit: 6, failureHandling: 'continue' };
    } else if (hasDependencies) {
      return { type: 'hybrid', concurrencyLimit: 4, failureHandling: 'continue' };
    } else {
      return this.config.defaultStrategy!;
    }
  }

  private async executeTasksWithStrategy(
    context: WorkflowContext,
    strategy: ExecutionStrategy,
    decompositions: Map<string, TaskDecomposition>
  ): Promise<WorkflowResult[]> {
    const results: WorkflowResult[] = [];

    switch (strategy.type) {
      case 'parallel':
        return await this.executeParallelTasks(context, strategy, decompositions);
      
      case 'sequential':
        return await this.executeSequentialTasks(context, strategy, decompositions);
      
      case 'hybrid':
      case 'adaptive':
        return await this.executeAdaptiveTasks(context, strategy, decompositions);
      
      default:
        throw new Error(`Unsupported execution strategy: ${strategy.type}`);
    }
  }

  private async executeParallelTasks(
    context: WorkflowContext,
    strategy: ExecutionStrategy,
    decompositions: Map<string, TaskDecomposition>
  ): Promise<WorkflowResult[]> {
    const results: WorkflowResult[] = [];
    const concurrencyLimit = strategy.concurrencyLimit || 4;
    const taskQueue = [...context.tasks];
    const activePromises: Array<Promise<WorkflowResult>> = [];

    while (taskQueue.length > 0 || activePromises.length > 0) {
      // Start new tasks up to concurrency limit
      while (activePromises.length < concurrencyLimit && taskQueue.length > 0) {
        const task = taskQueue.shift()!;
        const promise = this.executeTask(task, decompositions.get(task.id));
        activePromises.push(promise);
      }

      // Wait for at least one task to complete
      if (activePromises.length > 0) {
        const result = await Promise.race(activePromises);
        results.push(result);
        
        // Remove completed promise
        const index = activePromises.findIndex(p => p === Promise.resolve(result));
        if (index >= 0) {
          activePromises.splice(index, 1);
        }
      }
    }

    return results;
  }

  private async executeSequentialTasks(
    context: WorkflowContext,
    strategy: ExecutionStrategy,
    decompositions: Map<string, TaskDecomposition>
  ): Promise<WorkflowResult[]> {
    const results: WorkflowResult[] = [];

    for (const task of context.tasks) {
      const result = await this.executeTask(task, decompositions.get(task.id));
      results.push(result);
      
      // Check for failure handling
      if (!result.success && strategy.failureHandling === 'stop') {
        break;
      }
    }

    return results;
  }

  private async executeAdaptiveTasks(
    context: WorkflowContext,
    strategy: ExecutionStrategy,
    decompositions: Map<string, TaskDecomposition>
  ): Promise<WorkflowResult[]> {
    // Hybrid approach: parallel where possible, sequential for dependencies
    const results: WorkflowResult[] = [];
    const completed = new Set<string>();
    const remaining = new Map(context.tasks.map(t => [t.id, t]));

    while (remaining.size > 0) {
      // Find tasks with satisfied dependencies
      const ready = Array.from(remaining.values()).filter(task => {
        const decomp = decompositions.get(task.id);
        if (!decomp) return true;
        
        return decomp.subTasks.every(st => 
          st.dependencies.length === 0 || 
          st.dependencies.every(dep => completed.has(dep))
        );
      });

      if (ready.length === 0) {
        // No ready tasks - might have circular dependencies
        console.warn(chalk.yellow(`[Semantic Orchestrator] No ready tasks found, executing remaining sequentially`));
        break;
      }

      // Execute ready tasks in parallel
      const batchResults = await Promise.all(
        ready.map(task => this.executeTask(task, decompositions.get(task.id)))
      );

      results.push(...batchResults);
      
      // Mark completed and remove from remaining
      for (const result of batchResults) {
        completed.add(result.taskId);
        remaining.delete(result.taskId);
      }
    }

    return results;
  }

  private async executeTask(task: SemanticTask, decomposition?: TaskDecomposition): Promise<WorkflowResult> {
    const startTime = performance.now();
    
    try {
      // Simulate task execution - in real implementation, this would call actual task handlers
      const mockOutput = {
        taskId: task.id,
        type: task.type,
        description: task.description,
        assignedAgent: task.assignedAgent?.name,
        decomposition: decomposition ? {
          subTaskCount: decomposition.subTasks.length,
          executionPlan: decomposition.executionPlan,
          estimatedDuration: decomposition.estimatedDuration
        } : undefined
      };

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

      const processingTime = performance.now() - startTime;
      
      return {
        taskId: task.id,
        agentId: task.assignedAgent?.id || 'unassigned',
        success: true,
        output: mockOutput,
        processingTime
      };

    } catch (error) {
      return {
        taskId: task.id,
        agentId: task.assignedAgent?.id || 'unassigned',
        success: false,
        output: null,
        processingTime: performance.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  private async aggregateAndValidateResults(
    context: WorkflowContext,
    results: WorkflowResult[],
    ontologies: RDFDataSource[]
  ): Promise<WorkflowResult[]> {
    // Update workflow metrics
    context.metrics.completedTasks = results.filter(r => r.success).length;
    context.metrics.failedTasks = results.filter(r => !r.success).length;
    context.metrics.averageTaskTime = results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;

    // Semantic validation if enabled and ontologies provided
    if (this.config.enableSemanticValidation && ontologies.length > 0) {
      try {
        const templates = results
          .filter(r => r.success)
          .map(r => ({
            path: r.taskId,
            content: JSON.stringify(r.output),
            context: {}
          }));

        const validation = await this.coordinator.validateSemanticConsistency(templates, ontologies);
        
        // Add validation results to successful task results
        for (const result of results) {
          if (result.success) {
            result.validation = validation;
          }
        }

        context.metrics.semanticConsistencyScore = validation.valid ? 1.0 : 
          1.0 - (validation.issues.filter(i => i.type === 'error').length / Math.max(validation.issues.length, 1));

      } catch (error) {
        if (this.config.debugMode) {
          console.warn(chalk.yellow(`[Semantic Orchestrator] Semantic validation failed: ${error instanceof Error ? error.message : String(error)}`));
        }
      }
    }

    return results;
  }

  private async analyzeWorkflowPerformance(context: WorkflowContext): Promise<void> {
    if (!this.config.enablePerformanceMonitoring) return;

    // Calculate parallel efficiency
    const totalTaskTime = context.results.reduce((sum, r) => sum + r.processingTime, 0);
    const actualExecutionTime = context.endTime! - context.startTime;
    context.metrics.parallelEfficiency = totalTaskTime > 0 ? actualExecutionTime / totalTaskTime : 0;

    // Calculate agent utilization
    const agentUtilization: Record<string, number> = {};
    for (const result of context.results) {
      if (result.agentId !== 'unassigned') {
        if (!agentUtilization[result.agentId]) {
          agentUtilization[result.agentId] = 0;
        }
        agentUtilization[result.agentId] += result.processingTime;
      }
    }

    // Normalize utilization by total workflow time
    for (const agentId of Object.keys(agentUtilization)) {
      agentUtilization[agentId] /= actualExecutionTime;
    }

    context.metrics.agentUtilization = agentUtilization;
    context.metrics.totalProcessingTime = actualExecutionTime;

    // Store in performance history
    this.performanceHistory.push({
      workflowId: context.id,
      metrics: { ...context.metrics },
      timestamp: Date.now()
    });

    // Keep only recent history to prevent memory growth
    if (this.performanceHistory.length > 100) {
      this.performanceHistory = this.performanceHistory.slice(-50);
    }

    if (this.config.debugMode) {
      console.log(chalk.cyan(`[Semantic Orchestrator] Performance analysis completed for workflow ${context.id}`));
      console.log(chalk.gray(`  Parallel Efficiency: ${(context.metrics.parallelEfficiency * 100).toFixed(1)}%`));
      console.log(chalk.gray(`  Semantic Consistency: ${(context.metrics.semanticConsistencyScore * 100).toFixed(1)}%`));
      console.log(chalk.gray(`  Success Rate: ${((context.metrics.completedTasks / context.metrics.totalTasks) * 100).toFixed(1)}%`));
    }
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    // Cancel all active workflows
    for (const workflowId of this.activeWorkflows) {
      await this.cancelWorkflow(workflowId);
    }

    this.workflows.clear();
    this.activeWorkflows.clear();
    this.performanceHistory.length = 0;
    this.removeAllListeners();

    if (this.config.debugMode) {
      console.log(chalk.gray('[Semantic Workflow Orchestrator] Destroyed'));
    }
  }
}