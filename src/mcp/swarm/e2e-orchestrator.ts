/**
 * E2E MCP Swarm Orchestrator for Unjucks Enterprise
 * Manages distributed agent swarms for end-to-end template generation
 */

import { EventEmitter } from 'events';
import type { MCPRequest, MCPResponse, ToolResult } from '../types.js';
import { createJSONToolResult, handleToolError } from '../utils.js';

export interface SwarmAgent {
  id: string;
  name: string;
  type: 'researcher' | 'architect' | 'coder' | 'tester' | 'reviewer' | 'deployer';
  status: 'idle' | 'busy' | 'error' | 'offline';
  capabilities: string[];
  currentTask?: SwarmTask;
  metrics: {
    tasksCompleted: number;
    successRate: number;
    avgResponseTime: number;
  };
}

export interface SwarmTask {
  id: string;
  type: 'generate' | 'validate' | 'deploy' | 'test' | 'analyze';
  priority: 1 | 2 | 3 | 4 | 5;
  payload: any;
  assignedAgent?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface SwarmTopology {
  type: 'hierarchical' | 'mesh' | 'ring' | 'star';
  agents: Map<string, SwarmAgent>;
  connections: Map<string, Set<string>>;
  leader?: string;
}

export interface E2ESwarmParams {
  action: 'initialize' | 'spawn' | 'execute' | 'status' | 'terminate' | 'scale';
  topology?: 'hierarchical' | 'mesh' | 'ring' | 'star';
  agentCount?: number;
  task?: {
    type: string;
    payload: any;
    priority?: number;
  };
  swarmId?: string;
  targetAgents?: number;
}

export class E2ESwarmOrchestrator extends EventEmitter {
  private swarms: Map<string, SwarmTopology> = new Map();
  private globalTasks: Map<string, SwarmTask> = new Map();
  private agentRegistry: Map<string, SwarmAgent> = new Map();
  private messageQueue: Array<{ swarmId: string; message: any }> = [];
  
  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Initialize a new swarm with specified topology
   */
  async initializeSwarm(params: E2ESwarmParams): Promise<ToolResult> {
    const swarmId = `swarm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const topology = params.topology || 'mesh';
    const agentCount = params.agentCount || 5;

    // Create swarm topology
    const swarm: SwarmTopology = {
      type: topology,
      agents: new Map(),
      connections: new Map()
    };

    // Spawn initial agents based on topology
    const agentTypes: SwarmAgent['type'][] = ['researcher', 'architect', 'coder', 'tester', 'reviewer'];
    
    for (let i = 0; i < agentCount; i++) {
      const agent = this.createAgent(agentTypes[i % agentTypes.length], i);
      swarm.agents.set(agent.id, agent);
      this.agentRegistry.set(agent.id, agent);
    }

    // Configure connections based on topology
    this.configureTopology(swarm);

    // Select leader for hierarchical topology
    if (topology === 'hierarchical') {
      const architectAgent = Array.from(swarm.agents.values()).find(a => a.type === 'architect');
      swarm.leader = architectAgent?.id || swarm.agents.keys().next().value;
    }

    this.swarms.set(swarmId, swarm);

    // Emit swarm initialized event
    this.emit('swarm:initialized', { swarmId, topology, agentCount });

    return createJSONToolResult({
      success: true,
      swarmId,
      topology,
      agents: Array.from(swarm.agents.values()).map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        status: a.status
      })),
      connections: this.getConnectionSummary(swarm)
    });
  }

  /**
   * Execute E2E task across the swarm
   */
  async executeE2ETask(params: E2ESwarmParams): Promise<ToolResult> {
    const { swarmId, task } = params;
    
    if (!swarmId || !task) {
      return handleToolError(new Error('Swarm ID and task required'), 'e2e_swarm', 'execute');
    }

    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      return handleToolError(new Error('Swarm not found'), 'e2e_swarm', 'execute');
    }

    // Create E2E pipeline tasks
    const pipeline = this.createE2EPipeline(task.type, task.payload);
    const results: any[] = [];

    // Execute pipeline stages
    for (const stage of pipeline) {
      const stageTask: SwarmTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: stage.type as any,
        priority: stage.priority || 3,
        payload: stage.payload,
        status: 'pending',
        createdAt: new Date()
      };

      this.globalTasks.set(stageTask.id, stageTask);

      // Find suitable agent for this task
      const agent = this.findBestAgent(swarm, stage.requiredType);
      
      if (!agent) {
        stageTask.status = 'failed';
        results.push({ stage: stage.name, error: 'No suitable agent available' });
        continue;
      }

      // Assign and execute task
      stageTask.assignedAgent = agent.id;
      stageTask.status = 'in_progress';
      stageTask.startedAt = new Date();
      agent.status = 'busy';
      agent.currentTask = stageTask;

      // Simulate task execution (in production, this would be real agent work)
      const result = await this.simulateAgentWork(agent, stageTask);
      
      stageTask.status = 'completed';
      stageTask.completedAt = new Date();
      stageTask.result = result;
      
      agent.status = 'idle';
      agent.currentTask = undefined;
      agent.metrics.tasksCompleted++;
      
      results.push({
        stage: stage.name,
        agent: agent.name,
        result
      });

      // Broadcast progress to swarm
      this.broadcastToSwarm(swarmId, {
        type: 'stage_completed',
        stage: stage.name,
        progress: (pipeline.indexOf(stage) + 1) / pipeline.length
      });
    }

    return createJSONToolResult({
      success: true,
      pipeline: pipeline.map(s => s.name),
      results,
      duration: results.reduce((acc, r) => acc + (r.result?.duration || 0), 0),
      swarmMetrics: this.getSwarmMetrics(swarm)
    });
  }

  /**
   * Get swarm status and metrics
   */
  async getSwarmStatus(params: E2ESwarmParams): Promise<ToolResult> {
    const { swarmId } = params;
    
    if (!swarmId) {
      // Return all swarms status
      const allSwarms = Array.from(this.swarms.entries()).map(([id, swarm]) => ({
        id,
        topology: swarm.type,
        agentCount: swarm.agents.size,
        activeAgents: Array.from(swarm.agents.values()).filter(a => a.status === 'busy').length,
        metrics: this.getSwarmMetrics(swarm)
      }));
      
      return createJSONToolResult({
        success: true,
        swarms: allSwarms
      });
    }

    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      return handleToolError(new Error('Swarm not found'), 'e2e_swarm', 'status');
    }

    return createJSONToolResult({
      success: true,
      swarmId,
      topology: swarm.type,
      leader: swarm.leader,
      agents: Array.from(swarm.agents.values()).map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        status: a.status,
        currentTask: a.currentTask?.id,
        metrics: a.metrics
      })),
      connections: this.getConnectionSummary(swarm),
      metrics: this.getSwarmMetrics(swarm),
      taskQueue: Array.from(this.globalTasks.values())
        .filter(t => t.status === 'pending')
        .map(t => ({ id: t.id, type: t.type, priority: t.priority }))
    });
  }

  /**
   * Scale swarm up or down
   */
  async scaleSwarm(params: E2ESwarmParams): Promise<ToolResult> {
    const { swarmId, targetAgents } = params;
    
    if (!swarmId || !targetAgents) {
      return handleToolError(new Error('Swarm ID and target agent count required'), 'e2e_swarm', 'scale');
    }

    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      return handleToolError(new Error('Swarm not found'), 'e2e_swarm', 'scale');
    }

    const currentCount = swarm.agents.size;
    
    if (targetAgents > currentCount) {
      // Scale up
      const agentTypes: SwarmAgent['type'][] = ['researcher', 'architect', 'coder', 'tester', 'reviewer'];
      
      for (let i = currentCount; i < targetAgents; i++) {
        const agent = this.createAgent(agentTypes[i % agentTypes.length], i);
        swarm.agents.set(agent.id, agent);
        this.agentRegistry.set(agent.id, agent);
      }
      
      // Reconfigure topology for new agents
      this.configureTopology(swarm);
      
    } else if (targetAgents < currentCount) {
      // Scale down - remove idle agents first
      const agentsToRemove = currentCount - targetAgents;
      const agents = Array.from(swarm.agents.values());
      const idleAgents = agents.filter(a => a.status === 'idle');
      
      for (let i = 0; i < Math.min(agentsToRemove, idleAgents.length); i++) {
        const agent = idleAgents[i];
        swarm.agents.delete(agent.id);
        this.agentRegistry.delete(agent.id);
        swarm.connections.delete(agent.id);
      }
    }

    return createJSONToolResult({
      success: true,
      swarmId,
      previousCount: currentCount,
      currentCount: swarm.agents.size,
      action: targetAgents > currentCount ? 'scaled_up' : 'scaled_down'
    });
  }

  /**
   * Terminate swarm and cleanup resources
   */
  async terminateSwarm(params: E2ESwarmParams): Promise<ToolResult> {
    const { swarmId } = params;
    
    if (!swarmId) {
      return handleToolError(new Error('Swarm ID required'), 'e2e_swarm', 'terminate');
    }

    const swarm = this.swarms.get(swarmId);
    if (!swarm) {
      return handleToolError(new Error('Swarm not found'), 'e2e_swarm', 'terminate');
    }

    // Clean up agents
    for (const agent of swarm.agents.values()) {
      this.agentRegistry.delete(agent.id);
    }

    // Remove swarm
    this.swarms.delete(swarmId);

    // Emit termination event
    this.emit('swarm:terminated', { swarmId });

    return createJSONToolResult({
      success: true,
      message: `Swarm ${swarmId} terminated successfully`
    });
  }

  // Private helper methods

  private createAgent(type: SwarmAgent['type'], index: number): SwarmAgent {
    const capabilities = this.getAgentCapabilities(type);
    
    return {
      id: `agent-${type}-${Date.now()}-${index}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Agent ${index}`,
      type,
      status: 'idle',
      capabilities,
      metrics: {
        tasksCompleted: 0,
        successRate: 1.0,
        avgResponseTime: 0
      }
    };
  }

  private getAgentCapabilities(type: SwarmAgent['type']): string[] {
    const capabilityMap = {
      researcher: ['search', 'analyze', 'document', 'discover'],
      architect: ['design', 'plan', 'structure', 'optimize'],
      coder: ['implement', 'generate', 'refactor', 'debug'],
      tester: ['test', 'validate', 'benchmark', 'verify'],
      reviewer: ['review', 'audit', 'approve', 'suggest'],
      deployer: ['deploy', 'configure', 'monitor', 'scale']
    };
    
    return capabilityMap[type] || [];
  }

  private configureTopology(swarm: SwarmTopology): void {
    const agents = Array.from(swarm.agents.keys());
    
    switch (swarm.type) {
      case 'mesh':
        // Everyone connects to everyone
        agents.forEach(a1 => {
          swarm.connections.set(a1, new Set(agents.filter(a2 => a2 !== a1)));
        });
        break;
        
      case 'ring':
        // Each connects to next in circle
        agents.forEach((agent, i) => {
          const next = agents[(i + 1) % agents.length];
          swarm.connections.set(agent, new Set([next]));
        });
        break;
        
      case 'star':
        // All connect to first agent (hub)
        const hub = agents[0];
        agents.forEach(agent => {
          if (agent === hub) {
            swarm.connections.set(agent, new Set(agents.filter(a => a !== hub)));
          } else {
            swarm.connections.set(agent, new Set([hub]));
          }
        });
        break;
        
      case 'hierarchical':
        // Tree structure with levels
        const levels = Math.ceil(Math.log2(agents.length));
        agents.forEach((agent, i) => {
          const connections = new Set<string>();
          const level = Math.floor(Math.log2(i + 1));
          
          // Connect to parent
          if (i > 0) {
            const parent = agents[Math.floor((i - 1) / 2)];
            connections.add(parent);
          }
          
          // Connect to children
          const leftChild = 2 * i + 1;
          const rightChild = 2 * i + 2;
          
          if (leftChild < agents.length) connections.add(agents[leftChild]);
          if (rightChild < agents.length) connections.add(agents[rightChild]);
          
          swarm.connections.set(agent, connections);
        });
        break;
    }
  }

  private createE2EPipeline(taskType: string, payload: any): Array<{
    name: string;
    type: string;
    requiredType: SwarmAgent['type'];
    priority: number;
    payload: any;
  }> {
    // Create E2E pipeline based on task type
    const pipelines: Record<string, any[]> = {
      'template-generation': [
        { name: 'Research', type: 'analyze', requiredType: 'researcher', priority: 1, payload },
        { name: 'Architecture', type: 'design', requiredType: 'architect', priority: 2, payload },
        { name: 'Implementation', type: 'generate', requiredType: 'coder', priority: 3, payload },
        { name: 'Testing', type: 'test', requiredType: 'tester', priority: 4, payload },
        { name: 'Review', type: 'review', requiredType: 'reviewer', priority: 5, payload }
      ],
      'marketplace-integration': [
        { name: 'Discovery', type: 'search', requiredType: 'researcher', priority: 1, payload },
        { name: 'Validation', type: 'validate', requiredType: 'tester', priority: 2, payload },
        { name: 'Integration', type: 'integrate', requiredType: 'coder', priority: 3, payload },
        { name: 'Deployment', type: 'deploy', requiredType: 'deployer', priority: 4, payload }
      ],
      'enterprise-auth': [
        { name: 'Security Analysis', type: 'analyze', requiredType: 'researcher', priority: 1, payload },
        { name: 'Auth Design', type: 'design', requiredType: 'architect', priority: 2, payload },
        { name: 'Implementation', type: 'implement', requiredType: 'coder', priority: 3, payload },
        { name: 'Security Testing', type: 'test', requiredType: 'tester', priority: 4, payload }
      ]
    };
    
    return pipelines[taskType] || pipelines['template-generation'];
  }

  private findBestAgent(swarm: SwarmTopology, requiredType: SwarmAgent['type']): SwarmAgent | null {
    const agents = Array.from(swarm.agents.values());
    
    // First try to find idle agent of required type
    let agent = agents.find(a => a.type === requiredType && a.status === 'idle');
    
    // If not found, find any idle agent
    if (!agent) {
      agent = agents.find(a => a.status === 'idle');
    }
    
    return agent || null;
  }

  private async simulateAgentWork(agent: SwarmAgent, task: SwarmTask): Promise<any> {
    // Simulate agent doing work (in production, this would call real agent APIs)
    const duration = Math.random() * 2000 + 1000; // 1-3 seconds
    
    await new Promise(resolve => setTimeout(resolve, duration));
    
    // Update agent metrics
    const responseTime = Date.now() - task.startedAt!.getTime();
    agent.metrics.avgResponseTime = 
      (agent.metrics.avgResponseTime * agent.metrics.tasksCompleted + responseTime) /
      (agent.metrics.tasksCompleted + 1);
    
    // Return simulated result based on task type
    return {
      success: true,
      agentId: agent.id,
      taskId: task.id,
      duration,
      output: `${agent.type} completed ${task.type} task`,
      data: {
        processed: true,
        timestamp: new Date().toISOString()
      }
    };
  }

  private getConnectionSummary(swarm: SwarmTopology): Record<string, string[]> {
    const summary: Record<string, string[]> = {};
    
    swarm.connections.forEach((connections, agentId) => {
      const agent = swarm.agents.get(agentId);
      if (agent) {
        summary[agent.name] = Array.from(connections).map(id => {
          const connectedAgent = swarm.agents.get(id);
          return connectedAgent?.name || id;
        });
      }
    });
    
    return summary;
  }

  private getSwarmMetrics(swarm: SwarmTopology): any {
    const agents = Array.from(swarm.agents.values());
    
    return {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === 'busy').length,
      idleAgents: agents.filter(a => a.status === 'idle').length,
      errorAgents: agents.filter(a => a.status === 'error').length,
      totalTasksCompleted: agents.reduce((sum, a) => sum + a.metrics.tasksCompleted, 0),
      avgSuccessRate: agents.reduce((sum, a) => sum + a.metrics.successRate, 0) / agents.length,
      avgResponseTime: agents.reduce((sum, a) => sum + a.metrics.avgResponseTime, 0) / agents.length
    };
  }

  private broadcastToSwarm(swarmId: string, message: any): void {
    this.messageQueue.push({ swarmId, message });
    this.emit('swarm:broadcast', { swarmId, message });
  }

  private setupEventHandlers(): void {
    this.on('agent:status_changed', ({ agentId, status }) => {
      const agent = this.agentRegistry.get(agentId);
      if (agent) {
        agent.status = status;
      }
    });

    this.on('task:completed', ({ taskId, result }) => {
      const task = this.globalTasks.get(taskId);
      if (task) {
        task.status = 'completed';
        task.result = result;
        task.completedAt = new Date();
      }
    });
  }
}

// Global orchestrator instance
let orchestrator: E2ESwarmOrchestrator;

/**
 * MCP tool handler for E2E swarm orchestration
 */
export async function unjucksE2ESwarm(params: E2ESwarmParams): Promise<ToolResult> {
  if (!orchestrator) {
    orchestrator = new E2ESwarmOrchestrator();
  }

  try {
    switch (params.action) {
      case 'initialize':
        return await orchestrator.initializeSwarm(params);
      
      case 'execute':
        return await orchestrator.executeE2ETask(params);
      
      case 'status':
        return await orchestrator.getSwarmStatus(params);
      
      case 'scale':
        return await orchestrator.scaleSwarm(params);
      
      case 'terminate':
        return await orchestrator.terminateSwarm(params);
      
      case 'spawn':
        // Spawn additional agents to existing swarm
        params.action = 'scale';
        const swarm = params.swarmId ? 
          await orchestrator.getSwarmStatus({ action: 'status', swarmId: params.swarmId }) : null;
        
        if (swarm && swarm.content[0].text) {
          const status = JSON.parse(swarm.content[0].text);
          params.targetAgents = status.agents.length + (params.agentCount || 1);
        }
        return await orchestrator.scaleSwarm(params);
      
      default:
        return createJSONToolResult({
          error: `Unknown action: ${params.action}`
        });
    }
  } catch (error) {
    return handleToolError(error, 'unjucks_e2e_swarm', params.action);
  }
}

// Export schema for MCP tool registration
export const unjucksE2ESwarmSchema = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['initialize', 'spawn', 'execute', 'status', 'terminate', 'scale'],
      description: 'Swarm orchestration action'
    },
    topology: {
      type: 'string',
      enum: ['hierarchical', 'mesh', 'ring', 'star'],
      description: 'Swarm network topology'
    },
    agentCount: {
      type: 'number',
      description: 'Number of agents to spawn'
    },
    task: {
      type: 'object',
      description: 'Task to execute across swarm'
    },
    swarmId: {
      type: 'string',
      description: 'Swarm identifier'
    },
    targetAgents: {
      type: 'number',
      description: 'Target number of agents for scaling'
    }
  },
  required: ['action']
};