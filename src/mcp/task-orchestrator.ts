/**
 * Task Orchestrator - Manages parallel task execution across swarm agents
 * 
 * This orchestrator coordinates the execution of template generation tasks
 * across multiple Claude Flow agents, ensuring atomic operations, proper
 * error handling, and efficient resource utilization.
 */

import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';
import chalk from 'chalk';
import type { 
  ClaudeFlowAgent, 
  ClaudeFlowSwarm, 
  OrchestrationResult,
  ToolAgentMapping
} from './claude-flow-connector.js';
import type { SwarmTask, SwarmMemory } from '../lib/mcp-integration.js';

/**
 * Task execution priority levels
 */
export enum TaskPriority {
  LOW = 1,
  MEDIUM = 5,
  HIGH = 10,
  CRITICAL = 20
}

/**
 * Task execution strategy
 */
export enum ExecutionStrategy {
  PARALLEL = 'parallel',
  SEQUENTIAL = 'sequential',
  ADAPTIVE = 'adaptive',
  LOAD_BALANCED = 'load_balanced'
}

/**
 * Task execution context
 */
export interface TaskContext {
  taskId: string;
  priority: TaskPriority;
  strategy: ExecutionStrategy;
  maxConcurrency: number;
  timeout: number;
  retryCount: number;
  dependencies: string[];
  metadata: Record<string, any>;
}

/**
 * Agent assignment result
 */
export interface AgentAssignment {
  agent: ClaudeFlowAgent;
  task: SwarmTask;
  estimatedExecutionTime: number;
  loadScore: number;
}

/**
 * Orchestration metrics
 */
export interface OrchestrationMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageExecutionTime: number;
  peakConcurrency: number;
  resourceUtilization: number;
  errorRate: number;
  throughput: number; // tasks per second
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  taskId: string;
  agentId: string;
  success: boolean;
  result: any;
  executionTime: number;
  memoryUsed: number;
  errors: string[];
  metadata: Record<string, any>;
}

/**
 * Main Task Orchestrator class
 */
export class TaskOrchestrator extends EventEmitter {
  private swarm: ClaudeFlowSwarm | null = null;
  private taskQueue: Map<string, SwarmTask>;
  private runningTasks: Map<string, TaskContext>;
  private completedTasks: Map<string, TaskExecutionResult>;
  private agentLoadMap: Map<string, number>;
  private toolMappings: Map<string, ToolAgentMapping>;
  private metrics: OrchestrationMetrics;
  private debugMode: boolean;
  private maxConcurrentTasks: number;
  private taskTimeout: number;

  constructor(options: {
    maxConcurrentTasks?: number;
    taskTimeout?: number;
    debugMode?: boolean;
  } = {}) {
    super();

    this.taskQueue = new Map();
    this.runningTasks = new Map();
    this.completedTasks = new Map();
    this.agentLoadMap = new Map();
    this.toolMappings = new Map();
    
    this.maxConcurrentTasks = options.maxConcurrentTasks || 10;
    this.taskTimeout = options.taskTimeout || 300000; // 5 minutes default
    this.debugMode = options.debugMode || process.env.DEBUG_UNJUCKS === 'true';

    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageExecutionTime: 0,
      peakConcurrency: 0,
      resourceUtilization: 0,
      errorRate: 0,
      throughput: 0
    };

    this.setupMetricsTracking();
  }

  /**
   * Initialize orchestrator with swarm
   */
  initialize(swarm: ClaudeFlowSwarm, toolMappings: Map<string, ToolAgentMapping>): void {
    this.swarm = swarm;
    this.toolMappings = toolMappings;

    // Initialize agent load tracking
    for (const agent of swarm.agents) {
      this.agentLoadMap.set(agent.id, 0);
    }

    if (this.debugMode) {
      console.log(chalk.green(`[Task Orchestrator] Initialized with ${swarm.agents.length} agents`));
    }
  }

  /**
   * Queue a task for execution
   */
  async queueTask(
    task: SwarmTask,
    context: Partial<TaskContext> = {}
  ): Promise<string> {
    const taskId = task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const fullContext: TaskContext = {
      taskId,
      priority: this.parsePriority(task.priority),
      strategy: ExecutionStrategy.ADAPTIVE,
      maxConcurrency: 1,
      timeout: this.taskTimeout,
      retryCount: 3,
      dependencies: task.dependencies || [],
      metadata: {},
      ...context
    };

    // Add task to queue
    this.taskQueue.set(taskId, { ...task, id: taskId });
    
    this.emit('task-queued', { taskId, task });

    if (this.debugMode) {
      console.log(chalk.blue(`[Task Orchestrator] Task queued: ${taskId} (${task.type})`));
    }

    // Process queue
    setImmediate(() => this.processQueue());

    return taskId;
  }

  /**
   * Execute multiple tasks in parallel with different strategies
   */
  async executeTasks(
    tasks: SwarmTask[],
    strategy: ExecutionStrategy = ExecutionStrategy.ADAPTIVE
  ): Promise<OrchestrationResult[]> {
    const results: OrchestrationResult[] = [];
    
    try {
      if (this.debugMode) {
        console.log(chalk.blue(`[Task Orchestrator] Executing ${tasks.length} tasks with strategy: ${strategy}`));
      }

      switch (strategy) {
        case ExecutionStrategy.PARALLEL:
          return await this.executeParallel(tasks);
        
        case ExecutionStrategy.SEQUENTIAL:
          return await this.executeSequential(tasks);
        
        case ExecutionStrategy.LOAD_BALANCED:
          return await this.executeLoadBalanced(tasks);
        
        case ExecutionStrategy.ADAPTIVE:
        default:
          return await this.executeAdaptive(tasks);
      }

    } catch (error) {
      this.emit('error', error);
      throw new Error(`Task execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get optimal agent assignment for a task
   */
  async getOptimalAgentAssignment(
    task: SwarmTask,
    toolMapping: ToolAgentMapping
  ): Promise<AgentAssignment | null> {
    if (!this.swarm) {
      return null;
    }

    // Filter available agents by type and capabilities
    const candidateAgents = this.swarm.agents.filter(agent => {
      const isPreferredType = toolMapping.preferredAgents.includes(agent.type);
      const hasCapabilities = toolMapping.capabilities.every(cap => 
        agent.capabilities.includes(cap)
      );
      const isAvailable = agent.status === 'idle' || agent.status === 'completed';
      
      return isPreferredType && hasCapabilities && isAvailable;
    });

    if (candidateAgents.length === 0) {
      return null;
    }

    // Score agents based on performance and current load
    const scoredAgents = candidateAgents.map(agent => {
      const loadScore = this.agentLoadMap.get(agent.id) || 0;
      const performanceScore = agent.performance.successRate * 0.7 + 
                              (1 / (agent.performance.averageTime + 1)) * 0.3;
      const availabilityScore = agent.status === 'idle' ? 1.0 : 0.5;
      
      const finalScore = performanceScore * availabilityScore * (1 - loadScore * 0.1);
      
      return {
        agent,
        score: finalScore,
        loadScore,
        estimatedTime: this.estimateExecutionTime(task, agent)
      };
    });

    // Sort by score descending
    scoredAgents.sort((a, b) => b.score - a.score);
    
    const bestAgent = scoredAgents[0];
    
    return {
      agent: bestAgent.agent,
      task,
      estimatedExecutionTime: bestAgent.estimatedTime,
      loadScore: bestAgent.loadScore
    };
  }

  /**
   * Cancel a running task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    try {
      // Remove from queue if not started
      if (this.taskQueue.has(taskId)) {
        this.taskQueue.delete(taskId);
        this.emit('task-cancelled', { taskId, reason: 'queued' });
        return true;
      }

      // Cancel running task
      if (this.runningTasks.has(taskId)) {
        this.runningTasks.delete(taskId);
        this.emit('task-cancelled', { taskId, reason: 'running' });
        return true;
      }

      return false;

    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Get current orchestrator metrics
   */
  getMetrics(): OrchestrationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get task execution status
   */
  getTaskStatus(taskId: string): {
    status: 'queued' | 'running' | 'completed' | 'failed' | 'not_found';
    context?: TaskContext;
    result?: TaskExecutionResult;
  } {
    if (this.taskQueue.has(taskId)) {
      return { status: 'queued' };
    }

    if (this.runningTasks.has(taskId)) {
      return { 
        status: 'running', 
        context: this.runningTasks.get(taskId)
      };
    }

    const result = this.completedTasks.get(taskId);
    if (result) {
      return { 
        status: result.success ? 'completed' : 'failed', 
        result 
      };
    }

    return { status: 'not_found' };
  }

  /**
   * Get agent utilization statistics
   */
  getAgentUtilization(): Array<{
    agentId: string;
    agentType: string;
    currentLoad: number;
    tasksCompleted: number;
    averageTime: number;
    successRate: number;
    status: string;
  }> {
    if (!this.swarm) {
      return [];
    }

    return this.swarm.agents.map(agent => ({
      agentId: agent.id,
      agentType: agent.type,
      currentLoad: this.agentLoadMap.get(agent.id) || 0,
      tasksCompleted: agent.performance.tasksCompleted,
      averageTime: agent.performance.averageTime,
      successRate: agent.performance.successRate,
      status: agent.status
    }));
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async processQueue(): Promise<void> {
    if (!this.swarm || this.runningTasks.size >= this.maxConcurrentTasks) {
      return;
    }

    // Get tasks sorted by priority
    const sortedTasks = Array.from(this.taskQueue.values())
      .sort((a, b) => this.parsePriority(b.priority) - this.parsePriority(a.priority));

    for (const task of sortedTasks) {
      if (this.runningTasks.size >= this.maxConcurrentTasks) {
        break;
      }

      // Check dependencies
      if (task.dependencies && !this.areDependenciesMet(task.dependencies)) {
        continue;
      }

      // Find suitable agent
      const toolMapping = this.getToolMapping(task.type);
      if (!toolMapping) {
        continue;
      }

      const assignment = await this.getOptimalAgentAssignment(task, toolMapping);
      if (!assignment) {
        continue;
      }

      // Execute task
      await this.executeTask(task, assignment);
      
      // Remove from queue
      this.taskQueue.delete(task.id);
    }

    // Process queue again if there are remaining tasks
    if (this.taskQueue.size > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  private async executeTask(
    task: SwarmTask,
    assignment: AgentAssignment
  ): Promise<void> {
    const taskId = task.id;
    const startTime = performance.now();

    try {
      // Mark task as running
      const context: TaskContext = {
        taskId,
        priority: this.parsePriority(task.priority),
        strategy: ExecutionStrategy.ADAPTIVE,
        maxConcurrency: 1,
        timeout: this.taskTimeout,
        retryCount: 3,
        dependencies: task.dependencies || [],
        metadata: { startTime, agentId: assignment.agent.id }
      };

      this.runningTasks.set(taskId, context);
      
      // Update agent load
      const currentLoad = this.agentLoadMap.get(assignment.agent.id) || 0;
      this.agentLoadMap.set(assignment.agent.id, currentLoad + 1);
      
      // Update agent status
      assignment.agent.status = 'busy';
      assignment.agent.lastActivity = new Date().toISOString();

      if (this.debugMode) {
        console.log(chalk.cyan(`[Task Orchestrator] Executing task ${taskId} on agent ${assignment.agent.id}`));
      }

      // Execute the task (this would be integrated with the Claude Flow Connector)
      const result = await this.performTaskExecution(task, assignment.agent);
      
      const executionTime = performance.now() - startTime;

      // Create execution result
      const taskResult: TaskExecutionResult = {
        taskId,
        agentId: assignment.agent.id,
        success: true,
        result,
        executionTime,
        memoryUsed: 0, // TODO: Track memory usage
        errors: [],
        metadata: { ...context.metadata, endTime: performance.now() }
      };

      // Update completed tasks
      this.completedTasks.set(taskId, taskResult);
      
      // Update agent performance
      assignment.agent.performance.tasksCompleted++;
      assignment.agent.performance.averageTime = 
        (assignment.agent.performance.averageTime * (assignment.agent.performance.tasksCompleted - 1) + executionTime) / 
        assignment.agent.performance.tasksCompleted;
      
      // Update agent status and load
      assignment.agent.status = 'completed';
      this.agentLoadMap.set(assignment.agent.id, Math.max(0, currentLoad - 1));

      // Update metrics
      this.updateMetrics(taskResult, true);

      this.emit('task-completed', taskResult);

    } catch (error) {
      const executionTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Create failed execution result
      const taskResult: TaskExecutionResult = {
        taskId,
        agentId: assignment.agent.id,
        success: false,
        result: null,
        executionTime,
        memoryUsed: 0,
        errors: [errorMessage],
        metadata: { error: errorMessage }
      };

      this.completedTasks.set(taskId, taskResult);
      
      // Update agent status and load
      assignment.agent.status = 'error';
      const currentLoad = this.agentLoadMap.get(assignment.agent.id) || 0;
      this.agentLoadMap.set(assignment.agent.id, Math.max(0, currentLoad - 1));

      // Update metrics
      this.updateMetrics(taskResult, false);

      this.emit('task-failed', { taskId, error: errorMessage, agent: assignment.agent });

      if (this.debugMode) {
        console.error(chalk.red(`[Task Orchestrator] Task ${taskId} failed: ${errorMessage}`));
      }

    } finally {
      // Remove from running tasks
      this.runningTasks.delete(taskId);
    }
  }

  private async executeParallel(tasks: SwarmTask[]): Promise<OrchestrationResult[]> {
    const promises = tasks.map(async (task) => {
      const taskId = await this.queueTask(task);
      return this.waitForTaskCompletion(taskId);
    });

    return Promise.all(promises);
  }

  private async executeSequential(tasks: SwarmTask[]): Promise<OrchestrationResult[]> {
    const results: OrchestrationResult[] = [];
    
    for (const task of tasks) {
      const taskId = await this.queueTask(task);
      const result = await this.waitForTaskCompletion(taskId);
      results.push(result);
    }

    return results;
  }

  private async executeLoadBalanced(tasks: SwarmTask[]): Promise<OrchestrationResult[]> {
    // Group tasks by type for optimal load balancing
    const taskGroups = new Map<string, SwarmTask[]>();
    
    for (const task of tasks) {
      const group = taskGroups.get(task.type) || [];
      group.push(task);
      taskGroups.set(task.type, group);
    }

    // Execute groups with load balancing
    const promises: Promise<OrchestrationResult>[] = [];
    
    for (const [type, groupTasks] of taskGroups) {
      for (const task of groupTasks) {
        promises.push(this.queueTask(task).then(taskId => this.waitForTaskCompletion(taskId)));
      }
    }

    return Promise.all(promises);
  }

  private async executeAdaptive(tasks: SwarmTask[]): Promise<OrchestrationResult[]> {
    // Adaptive strategy: start with parallel, fall back to load balancing if needed
    const availableAgents = this.swarm?.agents.filter(a => a.status === 'idle').length || 0;
    
    if (tasks.length <= availableAgents) {
      return this.executeParallel(tasks);
    } else {
      return this.executeLoadBalanced(tasks);
    }
  }

  private async waitForTaskCompletion(taskId: string): Promise<OrchestrationResult> {
    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        const status = this.getTaskStatus(taskId);
        
        if (status.status === 'completed' || status.status === 'failed') {
          const result: OrchestrationResult = {
            taskId,
            success: status.status === 'completed',
            results: status.result ? [status.result as any] : [],
            errors: status.result?.errors || [],
            metrics: {
              totalTime: status.result?.executionTime || 0,
              parallelTasks: 1,
              memoryUsage: status.result?.memoryUsed || 0
            },
            sharedMemory: status.result?.metadata || {}
          };
          
          resolve(result);
          return;
        }

        // Check again after delay
        setTimeout(checkCompletion, 100);
      };

      checkCompletion();
    });
  }

  private async performTaskExecution(task: SwarmTask, agent: ClaudeFlowAgent): Promise<any> {
    // This would integrate with the Claude Flow Connector
    // For now, return a mock result
    return {
      taskId: task.id,
      type: task.type,
      agentId: agent.id,
      result: 'Task executed successfully',
      timestamp: new Date().toISOString()
    };
  }

  private parsePriority(priority?: string): TaskPriority {
    switch (priority) {
      case 'critical': return TaskPriority.CRITICAL;
      case 'high': return TaskPriority.HIGH;
      case 'medium': return TaskPriority.MEDIUM;
      case 'low': return TaskPriority.LOW;
      default: return TaskPriority.MEDIUM;
    }
  }

  private areDependenciesMet(dependencies: string[]): boolean {
    return dependencies.every(depId => {
      const status = this.getTaskStatus(depId);
      return status.status === 'completed';
    });
  }

  private getToolMapping(taskType: string): ToolAgentMapping | undefined {
    // Map task types to tool names
    const toolMappingMap: Record<string, string> = {
      'generate': 'unjucks_generate',
      'analyze': 'unjucks_list',
      'scaffold': 'unjucks_generate',
      'refactor': 'unjucks_inject',
      'document': 'unjucks_generate'
    };

    const toolName = toolMappingMap[taskType];
    return toolName ? this.toolMappings.get(toolName) : undefined;
  }

  private estimateExecutionTime(task: SwarmTask, agent: ClaudeFlowAgent): number {
    // Simple estimation based on agent performance and task complexity
    const baseTime = 5000; // 5 seconds base
    const complexityMultiplier = task.parameters?.complexity || 1;
    const agentEfficiency = agent.performance.averageTime > 0 ? 
      baseTime / agent.performance.averageTime : 1;
    
    return baseTime * complexityMultiplier * agentEfficiency;
  }

  private updateMetrics(result: TaskExecutionResult, success: boolean): void {
    this.metrics.totalTasks++;
    
    if (success) {
      this.metrics.completedTasks++;
    } else {
      this.metrics.failedTasks++;
    }

    // Update average execution time
    this.metrics.averageExecutionTime = 
      (this.metrics.averageExecutionTime * (this.metrics.totalTasks - 1) + result.executionTime) / 
      this.metrics.totalTasks;

    // Update error rate
    this.metrics.errorRate = (this.metrics.failedTasks / this.metrics.totalTasks) * 100;

    // Update peak concurrency
    const currentConcurrency = this.runningTasks.size;
    if (currentConcurrency > this.metrics.peakConcurrency) {
      this.metrics.peakConcurrency = currentConcurrency;
    }

    // Update throughput (tasks per second over last minute)
    this.metrics.throughput = this.calculateThroughput();

    // Update resource utilization
    this.metrics.resourceUtilization = this.calculateResourceUtilization();
  }

  private calculateThroughput(): number {
    // Calculate throughput based on recent completions
    const oneMinuteAgo = Date.now() - 60000;
    const recentTasks = Array.from(this.completedTasks.values())
      .filter(task => {
        const endTime = task.metadata.endTime || 0;
        return endTime > oneMinuteAgo;
      });

    return recentTasks.length / 60; // tasks per second
  }

  private calculateResourceUtilization(): number {
    if (!this.swarm) {
      return 0;
    }

    const busyAgents = this.swarm.agents.filter(a => a.status === 'busy').length;
    return (busyAgents / this.swarm.agents.length) * 100;
  }

  private setupMetricsTracking(): void {
    // Update metrics every 30 seconds
    setInterval(() => {
      this.metrics.throughput = this.calculateThroughput();
      this.metrics.resourceUtilization = this.calculateResourceUtilization();
      this.emit('metrics-updated', this.metrics);
    }, 30000);
  }

  /**
   * Cleanup orchestrator resources
   */
  destroy(): void {
    // Cancel all running tasks
    for (const taskId of this.runningTasks.keys()) {
      this.cancelTask(taskId);
    }

    // Clear all data structures
    this.taskQueue.clear();
    this.runningTasks.clear();
    this.completedTasks.clear();
    this.agentLoadMap.clear();
    this.toolMappings.clear();

    // Remove all listeners
    this.removeAllListeners();

    if (this.debugMode) {
      console.log(chalk.gray('[Task Orchestrator] Destroyed'));
    }
  }
}

/**
 * Export types and enums
 */
export type {
  TaskContext,
  AgentAssignment,
  OrchestrationMetrics,
  TaskExecutionResult
};