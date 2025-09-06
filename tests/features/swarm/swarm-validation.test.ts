/**
 * Swarm Validation Tests - Converting BDD scenarios to vitest unit tests
 * Tests MCP swarm orchestration, protocol compliance, and real-time collaboration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { E2ESwarmOrchestrator, type SwarmTopology, type SwarmAgent, type SwarmTask } from '../../../src/mcp/swarm/e2e-orchestrator'
import { startPerformanceTimer, generateTestSwarmId } from '../../setup/swarm-test-setup'

describe('MCP Swarm Orchestration', () => {
  let orchestrator: E2ESwarmOrchestrator
  let swarmId: string

  beforeAll(async () => {
    orchestrator = new E2ESwarmOrchestrator()
  })

  afterAll(async () => {
    // Cleanup handled by orchestrator internally
  })

  beforeEach(() => {
    swarmId = generateTestSwarmId()
  })

  afterEach(async () => {
    // Cleanup handled by orchestrator internally
  })

  describe('Swarm Topology Initialization', () => {
    it('should initialize mesh topology with proper agent connections', async () => {
      const endTimer = startPerformanceTimer('mesh-initialization')
      
      const result = await orchestrator.initializeSwarm({
        action: 'initialize',
        topology: 'mesh',
        agentCount: 4
      })

      const duration = endTimer()
      
      expect(result).toBeDefined()
      expect(result.isError).toBe(false)
      expect(result.content).toBeDefined()
      
      const swarmData = JSON.parse(result.content[0].text)
      expect(swarmData.success).toBe(true)
      expect(swarmData.topology).toBe('mesh')
      expect(swarmData.agents).toHaveLength(4) // Agents spawned automatically
      expect(duration).toBeLessThan(2000) // Should initialize within 2 seconds
    })

    it('should initialize hierarchical topology with coordinator agent', async () => {
      const swarm = await orchestrator.initializeSwarm({
        id: swarmId,
        topology: 'hierarchical',
        maxAgents: 5
      })

      expect(swarm.topology).toBe('hierarchical')
      expect(swarm.config.maxAgents).toBe(5)
    })

    it('should initialize star topology with central hub', async () => {
      const swarm = await orchestrator.initializeSwarm({
        id: swarmId,
        topology: 'star',
        maxAgents: 6
      })

      expect(swarm.topology).toBe('star')
      expect(swarm.config.maxAgents).toBe(6)
    })

    it('should initialize ring topology with circular connections', async () => {
      const swarm = await orchestrator.initializeSwarm({
        id: swarmId,
        topology: 'ring',
        maxAgents: 3
      })

      expect(swarm.topology).toBe('ring')
      expect(swarm.config.maxAgents).toBe(3)
    })
  })

  describe('Agent Management', () => {
    beforeEach(async () => {
      await orchestrator.initializeSwarm({
        id: swarmId,
        topology: 'mesh',
        maxAgents: 5
      })
    })

    it('should spawn researcher agent with correct capabilities', async () => {
      const agent = await orchestrator.spawnAgent(swarmId, {
        type: 'researcher',
        name: 'test-researcher',
        capabilities: ['web-search', 'data-analysis', 'documentation']
      })

      expect(agent.type).toBe('researcher')
      expect(agent.capabilities).toContain('web-search')
      expect(agent.capabilities).toContain('data-analysis')
      expect(agent.status).toBe('idle')
    })

    it('should spawn architect agent with system design capabilities', async () => {
      const agent = await orchestrator.spawnAgent(swarmId, {
        type: 'architect',
        name: 'system-architect',
        capabilities: ['system-design', 'architecture-patterns', 'scalability-planning']
      })

      expect(agent.type).toBe('architect')
      expect(agent.capabilities).toContain('system-design')
      expect(agent.status).toBe('idle')
    })

    it('should limit agent count based on swarm configuration', async () => {
      // Spawn agents up to the limit
      for (let i = 0; i < 5; i++) {
        await orchestrator.spawnAgent(swarmId, {
          type: 'coder',
          name: `coder-${i}`,
          capabilities: ['coding', 'testing']
        })
      }

      // Attempt to spawn one more should fail
      await expect(orchestrator.spawnAgent(swarmId, {
        type: 'tester',
        name: 'excess-tester',
        capabilities: ['testing']
      })).rejects.toThrow('Maximum agent count reached')
    })

    it('should remove agents and update topology', async () => {
      const agent = await orchestrator.spawnAgent(swarmId, {
        type: 'reviewer',
        name: 'code-reviewer',
        capabilities: ['code-review', 'quality-assurance']
      })

      await orchestrator.removeAgent(swarmId, agent.id)
      
      const swarm = await orchestrator.getSwarmStatus(swarmId)
      expect(swarm.agents).not.toContain(agent)
    })
  })

  describe('Task Pipeline Execution', () => {
    beforeEach(async () => {
      await orchestrator.initializeSwarm({
        id: swarmId,
        topology: 'mesh',
        maxAgents: 4
      })
      
      // Spawn essential agents
      await orchestrator.spawnAgent(swarmId, {
        type: 'researcher',
        name: 'researcher-1',
        capabilities: ['research', 'analysis']
      })
      
      await orchestrator.spawnAgent(swarmId, {
        type: 'coder',
        name: 'coder-1',
        capabilities: ['coding', 'implementation']
      })
    })

    it('should execute sequential pipeline with proper task ordering', async () => {
      const endTimer = startPerformanceTimer('sequential-pipeline')
      
      const pipeline = await orchestrator.createPipeline(swarmId, {
        name: 'sequential-test-pipeline',
        strategy: 'sequential',
        tasks: [
          {
            id: 'task-1',
            description: 'Research requirements',
            assignedAgent: 'researcher-1',
            priority: 'high'
          },
          {
            id: 'task-2',
            description: 'Implement solution',
            assignedAgent: 'coder-1',
            priority: 'medium',
            dependencies: ['task-1']
          }
        ]
      })

      const result = await orchestrator.executePipeline(swarmId, pipeline.id)
      const duration = endTimer()

      expect(result.status).toBe('completed')
      expect(result.tasks).toHaveLength(2)
      expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
    })

    it('should execute parallel pipeline with independent tasks', async () => {
      const endTimer = startPerformanceTimer('parallel-pipeline')
      
      const pipeline = await orchestrator.createPipeline(swarmId, {
        name: 'parallel-test-pipeline',
        strategy: 'parallel',
        tasks: [
          {
            id: 'task-a',
            description: 'Research topic A',
            assignedAgent: 'researcher-1',
            priority: 'high'
          },
          {
            id: 'task-b',
            description: 'Implement feature B',
            assignedAgent: 'coder-1',
            priority: 'high'
          }
        ]
      })

      const result = await orchestrator.executePipeline(swarmId, pipeline.id)
      const duration = endTimer()

      expect(result.status).toBe('completed')
      expect(duration).toBeLessThan(6000) // Parallel should be faster than sequential
    })

    it('should handle task failures gracefully', async () => {
      // Spawn an agent that will simulate failure
      await orchestrator.spawnAgent(swarmId, {
        type: 'tester',
        name: 'failing-tester',
        capabilities: ['testing']
      })

      const pipeline = await orchestrator.createPipeline(swarmId, {
        name: 'failure-test-pipeline',
        strategy: 'sequential',
        tasks: [
          {
            id: 'failing-task',
            description: 'This task will fail',
            assignedAgent: 'failing-tester',
            priority: 'high'
          }
        ]
      })

      // Mock failure
      vi.spyOn(orchestrator, 'executeTask').mockRejectedValueOnce(new Error('Task execution failed'))

      const result = await orchestrator.executePipeline(swarmId, pipeline.id)
      
      expect(result.status).toBe('failed')
      expect(result.error).toContain('Task execution failed')
    })
  })

  describe('Performance and Scaling', () => {
    it('should scale swarm up dynamically', async () => {
      await orchestrator.initializeSwarm({
        id: swarmId,
        topology: 'mesh',
        maxAgents: 10
      })

      const initialStatus = await orchestrator.getSwarmStatus(swarmId)
      expect(initialStatus.config.maxAgents).toBe(10)

      await orchestrator.scaleSwarm(swarmId, 15)
      
      const scaledStatus = await orchestrator.getSwarmStatus(swarmId)
      expect(scaledStatus.config.maxAgents).toBe(15)
    })

    it('should maintain performance under high task load', async () => {
      await orchestrator.initializeSwarm({
        id: swarmId,
        topology: 'mesh',
        maxAgents: 8
      })

      // Spawn multiple agents
      for (let i = 0; i < 8; i++) {
        await orchestrator.spawnAgent(swarmId, {
          type: 'coder',
          name: `load-tester-${i}`,
          capabilities: ['load-testing', 'performance']
        })
      }

      const endTimer = startPerformanceTimer('high-load-execution')
      
      // Create high-load pipeline
      const tasks = Array.from({ length: 50 }, (_, i) => ({
        id: `load-task-${i}`,
        description: `Load test task ${i}`,
        assignedAgent: `load-tester-${i % 8}`,
        priority: 'medium' as const
      }))

      const pipeline = await orchestrator.createPipeline(swarmId, {
        name: 'high-load-pipeline',
        strategy: 'parallel',
        tasks
      })

      const result = await orchestrator.executePipeline(swarmId, pipeline.id)
      const duration = endTimer()

      expect(result.status).toBe('completed')
      expect(duration).toBeLessThan(30000) // Should handle high load within 30 seconds
    })

    it('should handle agent failures and recovery', async () => {
      await orchestrator.initializeSwarm({
        id: swarmId,
        topology: 'mesh',
        maxAgents: 3
      })

      const agent1 = await orchestrator.spawnAgent(swarmId, {
        type: 'coder',
        name: 'primary-coder',
        capabilities: ['coding']
      })

      const agent2 = await orchestrator.spawnAgent(swarmId, {
        type: 'coder',
        name: 'backup-coder',
        capabilities: ['coding']
      })

      // Simulate agent failure
      await orchestrator.markAgentOffline(swarmId, agent1.id)

      const swarmStatus = await orchestrator.getSwarmStatus(swarmId)
      const offlineAgent = swarmStatus.agents.find(a => a.id === agent1.id)
      const onlineAgent = swarmStatus.agents.find(a => a.id === agent2.id)

      expect(offlineAgent?.status).toBe('offline')
      expect(onlineAgent?.status).toBe('idle')
      expect(swarmStatus.metrics.healthScore).toBeLessThan(1.0)
    })
  })

  describe('Real-time Collaboration Features', () => {
    it('should sync state across agents in real-time', async () => {
      await orchestrator.initializeSwarm({
        id: swarmId,
        topology: 'mesh',
        maxAgents: 3
      })

      const agent1 = await orchestrator.spawnAgent(swarmId, {
        type: 'coder',
        name: 'collab-coder-1',
        capabilities: ['coding', 'collaboration']
      })

      const agent2 = await orchestrator.spawnAgent(swarmId, {
        type: 'reviewer',
        name: 'collab-reviewer-1',
        capabilities: ['reviewing', 'collaboration']
      })

      // Simulate collaborative document editing
      const documentId = 'test-document-1'
      const operation1 = {
        type: 'insert',
        position: 0,
        content: 'Hello world',
        agentId: agent1.id
      }

      const operation2 = {
        type: 'insert',
        position: 11,
        content: '!',
        agentId: agent2.id
      }

      await orchestrator.applyOperation(swarmId, documentId, operation1)
      await orchestrator.applyOperation(swarmId, documentId, operation2)

      const documentState = await orchestrator.getDocumentState(swarmId, documentId)
      expect(documentState.content).toBe('Hello world!')
      expect(documentState.version).toBe(2)
    })

    it('should handle conflicting operations with operational transformation', async () => {
      await orchestrator.initializeSwarm({
        id: swarmId,
        topology: 'mesh',
        maxAgents: 2
      })

      const agent1 = await orchestrator.spawnAgent(swarmId, {
        type: 'coder',
        name: 'ot-coder-1',
        capabilities: ['coding']
      })

      const agent2 = await orchestrator.spawnAgent(swarmId, {
        type: 'coder',
        name: 'ot-coder-2',
        capabilities: ['coding']
      })

      const documentId = 'conflict-test-document'
      
      // Initialize document
      await orchestrator.initializeDocument(swarmId, documentId, 'initial content')

      // Simulate concurrent operations
      const conflictingOp1 = {
        type: 'insert',
        position: 7,
        content: ' modified',
        agentId: agent1.id
      }

      const conflictingOp2 = {
        type: 'insert',
        position: 7,
        content: ' updated',
        agentId: agent2.id
      }

      // Apply operations concurrently
      await Promise.all([
        orchestrator.applyOperation(swarmId, documentId, conflictingOp1),
        orchestrator.applyOperation(swarmId, documentId, conflictingOp2)
      ])

      const finalState = await orchestrator.getDocumentState(swarmId, documentId)
      
      // Should resolve conflicts via operational transformation
      expect(finalState.content).toMatch(/initial (modified|updated) (modified|updated) content/)
      expect(finalState.conflictsResolved).toBe(1)
    })

    it('should broadcast swarm events to all connected agents', async () => {
      await orchestrator.initializeSwarm({
        id: swarmId,
        topology: 'star',
        maxAgents: 4
      })

      const agents = []
      for (let i = 0; i < 3; i++) {
        agents.push(await orchestrator.spawnAgent(swarmId, {
          type: 'coder',
          name: `event-listener-${i}`,
          capabilities: ['event-handling']
        }))
      }

      // Mock event listeners
      const eventLogs: any[] = []
      vi.spyOn(orchestrator, 'broadcastEvent').mockImplementation(async (swarmId, event) => {
        eventLogs.push({ swarmId, event, timestamp: Date.now() })
      })

      // Trigger an event
      await orchestrator.triggerSwarmEvent(swarmId, {
        type: 'task_completed',
        data: { taskId: 'test-task-123' }
      })

      expect(eventLogs).toHaveLength(1)
      expect(eventLogs[0].event.type).toBe('task_completed')
      expect(eventLogs[0].event.data.taskId).toBe('test-task-123')
    })
  })

  describe('MCP Protocol Compliance', () => {
    it('should validate tool call requests conform to MCP specification', async () => {
      const mcpRequest = {
        jsonrpc: '2.0',
        id: 'test-request-001',
        method: 'tools/call',
        params: {
          name: 'unjucks_e2e_swarm',
          arguments: JSON.stringify({
            action: 'initialize_swarm',
            topology: 'mesh',
            maxAgents: 3
          })
        }
      }

      const result = await orchestrator.handleMCPRequest(mcpRequest)

      expect(result.jsonrpc).toBe('2.0')
      expect(result.id).toBe('test-request-001')
      expect(result.result).toBeDefined()
      expect(result.result.content).toBeInstanceOf(Array)
      expect(result.result.isError).toBe(false)
    })

    it('should return proper error responses for invalid requests', async () => {
      const invalidRequest = {
        jsonrpc: '2.0',
        id: 'invalid-request',
        method: 'unknown/method',
        params: {}
      }

      const result = await orchestrator.handleMCPRequest(invalidRequest)

      expect(result.jsonrpc).toBe('2.0')
      expect(result.id).toBe('invalid-request')
      expect(result.error).toBeDefined()
      expect(result.error.code).toBe(-32601) // Method not found
      expect(result.error.message).toContain('Method not found')
    })

    it('should handle concurrent MCP requests without blocking', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        jsonrpc: '2.0' as const,
        id: `concurrent-request-${i}`,
        method: 'tools/list',
        params: {}
      }))

      const startTime = Date.now()
      const results = await Promise.all(
        requests.map(req => orchestrator.handleMCPRequest(req))
      )
      const duration = Date.now() - startTime

      expect(results).toHaveLength(10)
      results.forEach((result, i) => {
        expect(result.id).toBe(`concurrent-request-${i}`)
        expect(result.result).toBeDefined()
      })
      
      // Should handle concurrently, not sequentially
      expect(duration).toBeLessThan(5000) // Should complete quickly if truly concurrent
    })
  })
})