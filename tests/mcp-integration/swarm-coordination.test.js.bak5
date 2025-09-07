/**
 * Swarm MCP Coordination Tests
 * Tests swarm topology, agent spawning, and coordination via MCP tools
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
// import type { 
  McpRequest, 
  McpResponse, 
  SwarmConfig, 
  AgentConfig,
  TaskConfig 
} from '../types/mcp-protocol.js'

class SwarmMcpInterface { private process }>()
  private swarmId: string | null = null

  async initialize() { return new Promise((resolve, reject) => {
      this.process = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
        stdio }
      })

      this.process.stderr?.on('data', (data) => {
        const error = data.toString()
        if (error.includes('FATAL') || error.includes('Cannot start')) {
          reject(new Error(`Swarm MCP server failed))
        }
      })

      this.process.on('error', reject)

      setTimeout(() => {
        reject(new Error('Swarm MCP server initialization timeout'))
      }, 20000)
    })
  }

  private setupMessageHandling() {
    if (!this.process?.stdout) return

    let responseBuffer = ''
    this.process.stdout.on('data', (data) => {
      responseBuffer += data.toString()
      
      const lines = responseBuffer.split('\n')
      responseBuffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line)
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

  async call(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('Swarm MCP server not available'))
        return
      }

      const id = ++this.messageId
      const request = { jsonrpc }
      
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

  async initializeSwarm(config) { const response = await this.call('tools/call', {
      name }

    // Extract swarm ID from response
    const resultText = response.result.content?.[0]?.text || ''
    const match = resultText.match(/swarm[_-]id[:\s]+([a-f0-9-]+)/i)
    this.swarmId = match?.[1] || 'default'
    
    return this.swarmId
  }

  async spawnAgent(config) { const response = await this.call('tools/call', {
      name }

    const resultText = response.result.content?.[0]?.text || ''
    const match = resultText.match(/agent[_-]id[:\s]+([a-f0-9-]+)/i)
    return match?.[1] || 'unknown'
  }

  async getSwarmStatus() { const response = await this.call('tools/call', {
      name }

    return JSON.parse(response.result.content[0].text)
  }

  async orchestrateTask(config) { const response = await this.call('tools/call', {
      name }

    const resultText = response.result.content?.[0]?.text || ''
    const match = resultText.match(/task[_-]id[:\s]+([a-f0-9-]+)/i)
    return match?.[1] || 'unknown'
  }

  async listAgents() { const response = await this.call('tools/call', {
      name }

    const result = JSON.parse(response.result.content[0].text)
    return result.agents || []
  }

  async shutdown() {
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
  let swarmInterface

  beforeAll(async () => {
    swarmInterface = new SwarmMcpInterface()
    await swarmInterface.initialize()
  })

  afterAll(async () => {
    if (swarmInterface) {
      await swarmInterface.shutdown()
    }
  })

  describe('Swarm Initialization', () => { it('should initialize mesh topology swarm', async () => {
      const swarmId = await swarmInterface.initializeSwarm({
        topology })

    it('should initialize hierarchical topology swarm', async () => { const swarmId = await swarmInterface.initializeSwarm({
        topology })

    it('should initialize star topology swarm', async () => { const swarmId = await swarmInterface.initializeSwarm({
        topology })

    it('should initialize ring topology swarm', async () => { const swarmId = await swarmInterface.initializeSwarm({
        topology })
  })

  describe('Agent Spawning and Management', () => { beforeEach(async () => {
      await swarmInterface.initializeSwarm({
        topology })

    it('should spawn researcher agent', async () => { const agentId = await swarmInterface.spawnAgent({
        type })

      expect(agentId).toBeTruthy()

      const agents = await swarmInterface.listAgents()
      const spawnedAgent = agents.find(a => a.id === agentId)
      
      expect(spawnedAgent).toBeDefined()
      expect(spawnedAgent.type).toBe('researcher')
      expect(spawnedAgent.capabilities).toContain('data-analysis')
    })

    it('should spawn multiple specialized agents', async () => { const agentConfigs = [
        { type },
        { type },
        { type }
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

    it('should assign coordinator agent in hierarchical topology', async () => { await swarmInterface.initializeSwarm({
        topology })

      expect(coordinatorId).toBeTruthy()

      const status = await swarmInterface.getSwarmStatus()
      expect(status.coordinator).toBeDefined()
      expect(status.coordinator.id).toBe(coordinatorId)
    })

    it('should enforce agent limits per swarm', async () => { await swarmInterface.initializeSwarm({
        topology } else {
          expect(agents).toHaveLength(2)
        }
      } catch (error) {
        expect(error.message).toContain('limit')
      }
    })
  })

  describe('Task Orchestration', () => { beforeEach(async () => {
      await swarmInterface.initializeSwarm({
        topology })

    it('should orchestrate parallel task execution', async () => { const taskId = await swarmInterface.orchestrateTask({
        task })

    it('should orchestrate sequential task execution', async () => { const taskId = await swarmInterface.orchestrateTask({
        task })

    it('should handle adaptive task execution', async () => { const taskId = await swarmInterface.orchestrateTask({
        task })

    it('should prioritize critical tasks', async () => { // Create multiple tasks with different priorities
      const criticalTaskId = await swarmInterface.orchestrateTask({
        task }
      
      expect(taskPriorities[criticalTaskId]).toBe('critical')
      expect(taskPriorities[lowTaskId]).toBe('low')

      // Critical task should be scheduled first
      const taskOrder = status.executionOrder || []
      const criticalIndex = taskOrder.indexOf(criticalTaskId)
      const lowIndex = taskOrder.indexOf(lowTaskId)
      
      expect(criticalIndex).toBeLessThan(lowIndex)
    })
  })

  describe('Swarm Communication and Coordination', () => { beforeEach(async () => {
      await swarmInterface.initializeSwarm({
        topology })
      await swarmInterface.spawnAgent({ type })
    })

    it('should enable agent-to-agent communication', async () => { const response = await swarmInterface.call('tools/call', {
        name }
          }
        }
      })

      expect(response.error).toBeUndefined()
      const result = JSON.parse(response.result.content[0].text)
      expect(result.delivered).toBe(true)
      expect(result.messageId).toBeDefined()
    })

    it('should broadcast messages to all agents', async () => { await swarmInterface.spawnAgent({ 
        type }
          }
        }
      })

      expect(response.error).toBeUndefined()
      const result = JSON.parse(response.result.content[0].text)
      expect(result.delivered_to_count).toBeGreaterThanOrEqual(2)
      expect(result.broadcast_id).toBeDefined()
    })

    it('should coordinate shared memory access', async () => { const response = await swarmInterface.call('tools/call', {
        name },
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
      const readResponse = await swarmInterface.call('tools/call', { name }
      })

      const readResult = JSON.parse(readResponse.result.content[0].text)
      expect(readResult.value).toBeDefined()
      expect(readResult.value.performance_metrics).toBeDefined()
    })
  })

  describe('Topology-Specific Behavior', () => { it('should route messages through central node in star topology', async () => {
      await swarmInterface.initializeSwarm({
        topology })
      
      await swarmInterface.spawnAgent({ type })

    it('should maintain ring order in ring topology', async () => { await swarmInterface.initializeSwarm({
        topology })

    it('should enable full connectivity in mesh topology', async () => { await swarmInterface.initializeSwarm({
        topology })

    it('should establish hierarchy levels in hierarchical topology', async () => { await swarmInterface.initializeSwarm({
        topology })
  })
})