/**
 * Swarm MCP Coordination Tests
 * Tests swarm topology, agent spawning, and coordination via MCP tools
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import type { 
  McpRequest, 
  McpResponse, 
  SwarmConfig, 
  AgentConfig,
  TaskConfig 
} from '../types/mcp-protocol'

class SwarmMcpInterface {
  private process: ChildProcess | null = null
  private messageId = 0
  private pendingRequests = new Map<number, { resolve: Function, reject: Function }>()
  private swarmId: string | null = null

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          NODE_ENV: 'test',
          ENABLE_SWARM: 'true',
          LOG_LEVEL: 'debug'
        }
      })

      let initBuffer = ''
      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        initBuffer += output

        if (output.includes('Swarm capabilities enabled') || 
            output.includes('MCP server initialized')) {
          this.setupMessageHandling()
          resolve()
        }
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const error = data.toString()
        if (error.includes('FATAL') || error.includes('Cannot start')) {
          reject(new Error(`Swarm MCP server failed: ${error}`))
        }
      })

      this.process.on('error', reject)

      setTimeout(() => {
        reject(new Error('Swarm MCP server initialization timeout'))
      }, 20000)
    })
  }

  private setupMessageHandling(): void {
    if (!this.process?.stdout) return

    let responseBuffer = ''
    this.process.stdout.on('data', (data: Buffer) => {
      responseBuffer += data.toString()
      
      const lines = responseBuffer.split('\n')
      responseBuffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line) as McpResponse
            if (response.id && this.pendingRequests.has(response.id)) {
              const { resolve, reject } = this.pendingRequests.get(response.id)!
              this.pendingRequests.delete(response.id)
              
              if (response.error) {
                reject(new Error(response.error.message))
              } else {
                resolve(response)
              }
            }
          } catch (parseError) {
            // Ignore non-JSON lines (logs, etc.)
          }
        }
      }
    })
  }

  async call(method: string, params: any = {}): Promise<McpResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('Swarm MCP server not available'))
        return
      }

      const id = ++this.messageId
      const request: McpRequest = {
        jsonrpc: '2.0',
        method,
        params,
        id
      }
      
      this.pendingRequests.set(id, { resolve, reject })
      
      const jsonMessage = JSON.stringify(request) + '\n'
      this.process.stdin.write(jsonMessage)

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Swarm MCP request timeout for method ${method}`))
        }
      }, 15000)
    })
  }

  async initializeSwarm(config: SwarmConfig): Promise<string> {
    const response = await this.call('tools/call', {
      name: 'swarm_init',
      arguments: config
    })

    if (response.error) {
      throw new Error(`Failed to initialize swarm: ${response.error.message}`)
    }

    // Extract swarm ID from response
    const resultText = response.result.content?.[0]?.text || ''
    const match = resultText.match(/swarm[_-]id[:\s]+([a-f0-9-]+)/i)
    this.swarmId = match?.[1] || 'default'
    
    return this.swarmId
  }

  async spawnAgent(config: AgentConfig): Promise<string> {
    const response = await this.call('tools/call', {
      name: 'agent_spawn',
      arguments: { ...config, swarmId: this.swarmId }
    })

    if (response.error) {
      throw new Error(`Failed to spawn agent: ${response.error.message}`)
    }

    const resultText = response.result.content?.[0]?.text || ''
    const match = resultText.match(/agent[_-]id[:\s]+([a-f0-9-]+)/i)
    return match?.[1] || 'unknown'
  }

  async getSwarmStatus(): Promise<any> {
    const response = await this.call('tools/call', {
      name: 'swarm_status',
      arguments: { swarmId: this.swarmId }
    })

    if (response.error) {
      throw new Error(`Failed to get swarm status: ${response.error.message}`)
    }

    return JSON.parse(response.result.content[0].text)
  }

  async orchestrateTask(config: TaskConfig): Promise<string> {
    const response = await this.call('tools/call', {
      name: 'task_orchestrate',
      arguments: { ...config, swarmId: this.swarmId }
    })

    if (response.error) {
      throw new Error(`Failed to orchestrate task: ${response.error.message}`)
    }

    const resultText = response.result.content?.[0]?.text || ''
    const match = resultText.match(/task[_-]id[:\s]+([a-f0-9-]+)/i)
    return match?.[1] || 'unknown'
  }

  async listAgents(): Promise<any[]> {
    const response = await this.call('tools/call', {
      name: 'agent_list',
      arguments: { swarmId: this.swarmId }
    })

    if (response.error) {
      throw new Error(`Failed to list agents: ${response.error.message}`)
    }

    const result = JSON.parse(response.result.content[0].text)
    return result.agents || []
  }

  async shutdown(): Promise<void> {
    if (this.process) {
      return new Promise((resolve) => {
        this.process!.on('close', () => resolve())
        this.process!.kill('SIGTERM')
        
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL')
          }
          resolve()
        }, 3000)
      })
    }
  }

  getSwarmId(): string | null {
    return this.swarmId
  }
}

describe('Swarm MCP Coordination', () => {
  let swarmInterface: SwarmMcpInterface

  beforeAll(async () => {
    swarmInterface = new SwarmMcpInterface()
    await swarmInterface.initialize()
  })

  afterAll(async () => {
    if (swarmInterface) {
      await swarmInterface.shutdown()
    }
  })

  describe('Swarm Initialization', () => {
    it('should initialize mesh topology swarm', async () => {
      const swarmId = await swarmInterface.initializeSwarm({
        topology: 'mesh',
        maxAgents: 5,
        strategy: 'balanced'
      })

      expect(swarmId).toBeTruthy()
      expect(typeof swarmId).toBe('string')

      const status = await swarmInterface.getSwarmStatus()
      expect(status.topology).toBe('mesh')
      expect(status.maxAgents).toBe(5)
      expect(status.strategy).toBe('balanced')
    })

    it('should initialize hierarchical topology swarm', async () => {
      const swarmId = await swarmInterface.initializeSwarm({
        topology: 'hierarchical',
        maxAgents: 8,
        strategy: 'specialized'
      })

      expect(swarmId).toBeTruthy()

      const status = await swarmInterface.getSwarmStatus()
      expect(status.topology).toBe('hierarchical')
      expect(status.maxAgents).toBe(8)
    })

    it('should initialize star topology swarm', async () => {
      const swarmId = await swarmInterface.initializeSwarm({
        topology: 'star',
        maxAgents: 6,
        strategy: 'adaptive'
      })

      expect(swarmId).toBeTruthy()

      const status = await swarmInterface.getSwarmStatus()
      expect(status.topology).toBe('star')
      expect(status.centralNode).toBeDefined()
    })

    it('should initialize ring topology swarm', async () => {
      const swarmId = await swarmInterface.initializeSwarm({
        topology: 'ring',
        maxAgents: 4,
        strategy: 'balanced'
      })

      expect(swarmId).toBeTruthy()

      const status = await swarmInterface.getSwarmStatus()
      expect(status.topology).toBe('ring')
      expect(status.ringOrder).toBeDefined()
    })
  })

  describe('Agent Spawning and Management', () => {
    beforeEach(async () => {
      await swarmInterface.initializeSwarm({
        topology: 'mesh',
        maxAgents: 10,
        strategy: 'balanced'
      })
    })

    it('should spawn researcher agent', async () => {
      const agentId = await swarmInterface.spawnAgent({
        type: 'researcher',
        name: 'research-agent-1',
        capabilities: ['data-analysis', 'pattern-recognition', 'research']
      })

      expect(agentId).toBeTruthy()

      const agents = await swarmInterface.listAgents()
      const spawnedAgent = agents.find(a => a.id === agentId)
      
      expect(spawnedAgent).toBeDefined()
      expect(spawnedAgent.type).toBe('researcher')
      expect(spawnedAgent.capabilities).toContain('data-analysis')
    })

    it('should spawn multiple specialized agents', async () => {
      const agentConfigs = [
        { type: 'coder' as const, name: 'coder-1', capabilities: ['typescript', 'testing'] },
        { type: 'analyst' as const, name: 'analyst-1', capabilities: ['performance', 'metrics'] },
        { type: 'optimizer' as const, name: 'optimizer-1', capabilities: ['algorithms', 'efficiency'] }
      ]

      const agentIds = await Promise.all(
        agentConfigs.map(config => swarmInterface.spawnAgent(config))
      )

      expect(agentIds).toHaveLength(3)
      expect(agentIds.every(id => id.length > 0)).toBe(true)

      const agents = await swarmInterface.listAgents()
      expect(agents).toHaveLength(3)

      const types = agents.map(a => a.type)
      expect(types).toContain('coder')
      expect(types).toContain('analyst')
      expect(types).toContain('optimizer')
    })

    it('should assign coordinator agent in hierarchical topology', async () => {
      await swarmInterface.initializeSwarm({
        topology: 'hierarchical',
        maxAgents: 6,
        strategy: 'specialized'
      })

      const coordinatorId = await swarmInterface.spawnAgent({
        type: 'coordinator',
        name: 'main-coordinator',
        capabilities: ['orchestration', 'planning', 'coordination']
      })

      expect(coordinatorId).toBeTruthy()

      const status = await swarmInterface.getSwarmStatus()
      expect(status.coordinator).toBeDefined()
      expect(status.coordinator.id).toBe(coordinatorId)
    })

    it('should enforce agent limits per swarm', async () => {
      await swarmInterface.initializeSwarm({
        topology: 'mesh',
        maxAgents: 2,
        strategy: 'balanced'
      })

      // Spawn up to limit
      await swarmInterface.spawnAgent({ type: 'researcher', capabilities: [] })
      await swarmInterface.spawnAgent({ type: 'coder', capabilities: [] })

      // This should fail or be queued
      try {
        await swarmInterface.spawnAgent({ type: 'analyst', capabilities: [] })
        const agents = await swarmInterface.listAgents()
        
        // Either it fails, or agents are queued/managed within limit
        if (agents.length > 2) {
          expect(agents.some(a => a.status === 'queued')).toBe(true)
        } else {
          expect(agents).toHaveLength(2)
        }
      } catch (error) {
        expect(error.message).toContain('limit')
      }
    })
  })

  describe('Task Orchestration', () => {
    beforeEach(async () => {
      await swarmInterface.initializeSwarm({
        topology: 'mesh',
        maxAgents: 8,
        strategy: 'balanced'
      })

      // Spawn some agents
      await swarmInterface.spawnAgent({ type: 'researcher', capabilities: ['analysis'] })
      await swarmInterface.spawnAgent({ type: 'coder', capabilities: ['implementation'] })
      await swarmInterface.spawnAgent({ type: 'analyst', capabilities: ['testing'] })
    })

    it('should orchestrate parallel task execution', async () => {
      const taskId = await swarmInterface.orchestrateTask({
        task: 'Analyze codebase and generate documentation',
        maxAgents: 3,
        priority: 'high',
        strategy: 'parallel'
      })

      expect(taskId).toBeTruthy()

      // Wait a bit for task to be assigned
      await delay(1000)

      const status = await swarmInterface.getSwarmStatus()
      expect(status.activeTasks).toContain(taskId)
      expect(status.taskAssignments[taskId]).toBeDefined()
    })

    it('should orchestrate sequential task execution', async () => {
      const taskId = await swarmInterface.orchestrateTask({
        task: 'Build and test new feature implementation',
        maxAgents: 2,
        priority: 'medium',
        strategy: 'sequential'
      })

      expect(taskId).toBeTruthy()

      const status = await swarmInterface.getSwarmStatus()
      expect(status.activeTasks).toContain(taskId)
      expect(status.executionStrategy[taskId]).toBe('sequential')
    })

    it('should handle adaptive task execution', async () => {
      const taskId = await swarmInterface.orchestrateTask({
        task: 'Optimize performance across multiple modules',
        maxAgents: 5,
        priority: 'critical',
        strategy: 'adaptive'
      })

      expect(taskId).toBeTruthy()

      const status = await swarmInterface.getSwarmStatus()
      expect(status.activeTasks).toContain(taskId)
      expect(status.adaptiveMetrics[taskId]).toBeDefined()
    })

    it('should prioritize critical tasks', async () => {
      // Create multiple tasks with different priorities
      const criticalTaskId = await swarmInterface.orchestrateTask({
        task: 'Fix critical security vulnerability',
        priority: 'critical',
        strategy: 'parallel'
      })

      const lowTaskId = await swarmInterface.orchestrateTask({
        task: 'Update documentation formatting',
        priority: 'low',
        strategy: 'sequential'
      })

      const status = await swarmInterface.getSwarmStatus()
      const taskPriorities = status.taskPriorities || {}
      
      expect(taskPriorities[criticalTaskId]).toBe('critical')
      expect(taskPriorities[lowTaskId]).toBe('low')

      // Critical task should be scheduled first
      const taskOrder = status.executionOrder || []
      const criticalIndex = taskOrder.indexOf(criticalTaskId)
      const lowIndex = taskOrder.indexOf(lowTaskId)
      
      expect(criticalIndex).toBeLessThan(lowIndex)
    })
  })

  describe('Swarm Communication and Coordination', () => {
    beforeEach(async () => {
      await swarmInterface.initializeSwarm({
        topology: 'mesh',
        maxAgents: 6,
        strategy: 'balanced'
      })

      // Spawn agents for communication testing
      await swarmInterface.spawnAgent({ 
        type: 'researcher', 
        name: 'research-node',
        capabilities: ['analysis', 'communication'] 
      })
      await swarmInterface.spawnAgent({ 
        type: 'coder', 
        name: 'coding-node',
        capabilities: ['implementation', 'communication'] 
      })
    })

    it('should enable agent-to-agent communication', async () => {
      const response = await swarmInterface.call('tools/call', {
        name: 'agent_communicate',
        arguments: {
          swarmId: swarmInterface.getSwarmId(),
          fromAgent: 'research-node',
          toAgent: 'coding-node',
          message: {
            type: 'task_handoff',
            payload: {
              analysis_results: 'Code complexity analysis complete',
              next_steps: ['Implement optimizations', 'Add unit tests']
            }
          }
        }
      })

      expect(response.error).toBeUndefined()
      const result = JSON.parse(response.result.content[0].text)
      expect(result.delivered).toBe(true)
      expect(result.messageId).toBeDefined()
    })

    it('should broadcast messages to all agents', async () => {
      await swarmInterface.spawnAgent({ 
        type: 'analyst', 
        name: 'analysis-node',
        capabilities: ['metrics'] 
      })

      const response = await swarmInterface.call('tools/call', {
        name: 'swarm_broadcast',
        arguments: {
          swarmId: swarmInterface.getSwarmId(),
          fromAgent: 'research-node',
          message: {
            type: 'status_update',
            payload: {
              global_state: 'analysis_phase_complete',
              ready_for_next_phase: true
            }
          }
        }
      })

      expect(response.error).toBeUndefined()
      const result = JSON.parse(response.result.content[0].text)
      expect(result.delivered_to_count).toBeGreaterThanOrEqual(2)
      expect(result.broadcast_id).toBeDefined()
    })

    it('should coordinate shared memory access', async () => {
      const response = await swarmInterface.call('tools/call', {
        name: 'swarm_memory_coordinate',
        arguments: {
          swarmId: swarmInterface.getSwarmId(),
          operation: 'write',
          key: 'analysis_results',
          value: {
            performance_metrics: { cpu_usage: 45, memory_usage: 60 },
            recommendations: ['Optimize loops', 'Cache frequently accessed data']
          },
          lock_timeout: 5000
        }
      })

      expect(response.error).toBeUndefined()
      const result = JSON.parse(response.result.content[0].text)
      expect(result.lock_acquired).toBe(true)
      expect(result.write_successful).toBe(true)

      // Test reading the shared memory
      const readResponse = await swarmInterface.call('tools/call', {
        name: 'swarm_memory_coordinate',
        arguments: {
          swarmId: swarmInterface.getSwarmId(),
          operation: 'read',
          key: 'analysis_results'
        }
      })

      const readResult = JSON.parse(readResponse.result.content[0].text)
      expect(readResult.value).toBeDefined()
      expect(readResult.value.performance_metrics).toBeDefined()
    })
  })

  describe('Topology-Specific Behavior', () => {
    it('should route messages through central node in star topology', async () => {
      await swarmInterface.initializeSwarm({
        topology: 'star',
        maxAgents: 5,
        strategy: 'balanced'
      })

      const coordinatorId = await swarmInterface.spawnAgent({
        type: 'coordinator',
        capabilities: ['routing', 'orchestration']
      })
      
      await swarmInterface.spawnAgent({ type: 'researcher', capabilities: [] })
      await swarmInterface.spawnAgent({ type: 'coder', capabilities: [] })

      const status = await swarmInterface.getSwarmStatus()
      expect(status.topology).toBe('star')
      expect(status.centralNode.id).toBe(coordinatorId)
      expect(status.routingTable).toBeDefined()
    })

    it('should maintain ring order in ring topology', async () => {
      await swarmInterface.initializeSwarm({
        topology: 'ring',
        maxAgents: 4,
        strategy: 'balanced'
      })

      const agentIds = await Promise.all([
        swarmInterface.spawnAgent({ type: 'researcher', capabilities: [] }),
        swarmInterface.spawnAgent({ type: 'coder', capabilities: [] }),
        swarmInterface.spawnAgent({ type: 'analyst', capabilities: [] }),
        swarmInterface.spawnAgent({ type: 'optimizer', capabilities: [] })
      ])

      const status = await swarmInterface.getSwarmStatus()
      expect(status.topology).toBe('ring')
      expect(status.ringOrder).toHaveLength(4)
      expect(status.ringOrder).toEqual(expect.arrayContaining(agentIds))
    })

    it('should enable full connectivity in mesh topology', async () => {
      await swarmInterface.initializeSwarm({
        topology: 'mesh',
        maxAgents: 4,
        strategy: 'balanced'
      })

      await Promise.all([
        swarmInterface.spawnAgent({ type: 'researcher', name: 'node-1', capabilities: [] }),
        swarmInterface.spawnAgent({ type: 'coder', name: 'node-2', capabilities: [] }),
        swarmInterface.spawnAgent({ type: 'analyst', name: 'node-3', capabilities: [] })
      ])

      const status = await swarmInterface.getSwarmStatus()
      expect(status.topology).toBe('mesh')
      expect(status.connectivity).toBeDefined()
      
      // In a mesh, every agent should be connected to every other agent
      const expectedConnections = 3 * 2 // n * (n-1) for directed connections
      const actualConnections = Object.values(status.connectivity).flat().length
      expect(actualConnections).toBe(expectedConnections)
    })

    it('should establish hierarchy levels in hierarchical topology', async () => {
      await swarmInterface.initializeSwarm({
        topology: 'hierarchical',
        maxAgents: 7,
        strategy: 'specialized'
      })

      // Spawn coordinator (level 0)
      const coordinatorId = await swarmInterface.spawnAgent({
        type: 'coordinator',
        name: 'root-coordinator',
        capabilities: ['orchestration']
      })

      // Spawn sub-coordinators (level 1)  
      await swarmInterface.spawnAgent({
        type: 'coordinator',
        name: 'sub-coord-1',
        capabilities: ['team-management']
      })
      await swarmInterface.spawnAgent({
        type: 'coordinator', 
        name: 'sub-coord-2',
        capabilities: ['task-management']
      })

      // Spawn workers (level 2)
      await swarmInterface.spawnAgent({ type: 'researcher', capabilities: [] })
      await swarmInterface.spawnAgent({ type: 'coder', capabilities: [] })

      const status = await swarmInterface.getSwarmStatus()
      expect(status.topology).toBe('hierarchical')
      expect(status.hierarchy).toBeDefined()
      expect(status.hierarchy.levels).toBeGreaterThanOrEqual(2)
      expect(status.hierarchy.root).toBe(coordinatorId)
    })
  })
})