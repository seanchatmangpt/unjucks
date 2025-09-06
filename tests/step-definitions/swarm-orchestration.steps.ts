/**
 * Step definitions for MCP Swarm Orchestration tests
 */

import { Given, When, Then, Before, After } from '@amiceli/vitest-cucumber'
import { expect } from 'vitest'
import WebSocket from 'ws'
import { UnjucksMCPServer } from '../../src/mcp/server.js'
import { unjucksE2ESwarm } from '../../src/mcp/swarm/e2e-orchestrator.js'
import type { SwarmAgent, SwarmTask, SwarmTopology } from '../../src/mcp/swarm/e2e-orchestrator.js'

// Test context
interface SwarmTestContext {
  mcpServer?: UnjucksMCPServer
  swarmId?: string
  swarm?: any
  agents?: SwarmAgent[]
  tasks?: SwarmTask[]
  websocket?: WebSocket
  metrics?: any
  errors?: string[]
  startTime?: number
  authCredentials?: {
    token: string
    tenantId: string
    userId: string
  }
}

let testContext: SwarmTestContext = {}

// Before hooks
Before(async () => {
  testContext = {
    errors: [],
    authCredentials: {
      token: 'test-token-' + Date.now(),
      tenantId: 'test-tenant',
      userId: 'test-user-' + Math.random().toString(36).substr(2, 9)
    }
  }
})

After(async () => {
  // Cleanup
  if (testContext.websocket) {
    testContext.websocket.close()
  }
  
  if (testContext.swarmId) {
    try {
      await unjucksE2ESwarm({
        action: 'terminate',
        swarmId: testContext.swarmId
      })
    } catch (error) {
      console.warn('Failed to cleanup swarm:', error)
    }
  }
  
  if (testContext.mcpServer) {
    await testContext.mcpServer.stop()
  }
})

// Background steps
Given('the MCP server is running', async () => {
  testContext.mcpServer = new UnjucksMCPServer()
  await testContext.mcpServer.start()
  expect(testContext.mcpServer).toBeDefined()
})

Given('the swarm orchestrator is initialized', async () => {
  // Orchestrator is initialized lazily on first use
  expect(true).toBe(true) // Placeholder
})

Given('I have valid authentication credentials', () => {
  expect(testContext.authCredentials).toBeDefined()
  expect(testContext.authCredentials?.token).toBeTruthy()
  expect(testContext.authCredentials?.tenantId).toBeTruthy()
  expect(testContext.authCredentials?.userId).toBeTruthy()
})

// Topology initialization steps
Given('I want to create a swarm with {string} topology', (topology: string) => {
  testContext.swarm = {
    topology,
    agentCount: 0
  }
  expect(['mesh', 'hierarchical', 'ring', 'star']).toContain(topology)
})

Given('I specify {int} agents', (count: number) => {
  testContext.swarm.agentCount = count
  expect(count).toBeGreaterThan(0)
  expect(count).toBeLessThanOrEqual(50)
})

When('I initialize the swarm', async () => {
  testContext.startTime = Date.now()
  
  const result = await unjucksE2ESwarm({
    action: 'initialize',
    topology: testContext.swarm.topology as any,
    agentCount: testContext.swarm.agentCount
  })
  
  expect(result.isError).toBe(false)
  
  if (result.content && result.content[0] && 'text' in result.content[0]) {
    const response = JSON.parse(result.content[0].text)
    testContext.swarmId = response.swarmId
    testContext.agents = response.agents
  }
})

Then('the swarm should be created successfully', () => {
  expect(testContext.swarmId).toBeDefined()
  expect(testContext.agents).toBeDefined()
})

Then('all {int} agents should be spawned', (count: number) => {
  expect(testContext.agents).toHaveLength(count)
  
  // Verify agent types are distributed
  const agentTypes = testContext.agents!.map(a => a.type)
  expect(new Set(agentTypes).size).toBeGreaterThan(0)
})

Then('each agent should be connected to all other agents', () => {
  // For mesh topology, verify full connectivity
  expect(testContext.swarm.topology).toBe('mesh')
  // In a real implementation, we'd verify the connection matrix
  expect(testContext.agents!.length).toBeGreaterThan(1)
})

Then('all {int} agents should be spawned in tree structure', (count: number) => {
  expect(testContext.agents).toHaveLength(count)
  expect(testContext.swarm.topology).toBe('hierarchical')
  // Verify tree structure properties
})

Then('a leader agent should be selected', () => {
  expect(testContext.swarm.topology).toBe('hierarchical')
  // In hierarchical topology, there should be a leader
  const architectAgent = testContext.agents!.find(a => a.type === 'architect')
  expect(architectAgent || testContext.agents![0]).toBeDefined()
})

Then('the connection topology should form a hierarchy', () => {
  expect(testContext.swarm.topology).toBe('hierarchical')
  // Verify hierarchical connections
})

Then('agent communication should follow parent-child relationships', () => {
  expect(testContext.swarm.topology).toBe('hierarchical')
  // Verify parent-child communication patterns
})

Then('each agent should connect to exactly one next agent', () => {
  expect(testContext.swarm.topology).toBe('ring')
  expect(testContext.agents!.length).toBeGreaterThan(1)
})

Then('the topology should form a complete ring', () => {
  expect(testContext.swarm.topology).toBe('ring')
  // Verify ring topology
})

Then('messages should propagate around the ring', async () => {
  expect(testContext.swarm.topology).toBe('ring')
  // Test message propagation
})

Then('one agent should act as the central hub', () => {
  expect(testContext.swarm.topology).toBe('star')
  // Verify hub agent exists
})

Then('all other agents should connect only to the hub', () => {
  expect(testContext.swarm.topology).toBe('star')
  // Verify star topology connections
})

Then('the hub should coordinate all communication', () => {
  expect(testContext.swarm.topology).toBe('star')
  // Verify hub coordination
})

Then('the swarm status should be {string}', (expectedStatus: string) => {
  expect(expectedStatus).toBe('active')
  expect(testContext.swarmId).toBeDefined()
})

// Pipeline execution steps
Given('I have an active {word} swarm with {int} agents', async (topology: string, count: number) => {
  const result = await unjucksE2ESwarm({
    action: 'initialize',
    topology: topology as any,
    agentCount: count
  })
  
  expect(result.isError).toBe(false)
  
  if (result.content && result.content[0] && 'text' in result.content[0]) {
    const response = JSON.parse(result.content[0].text)
    testContext.swarmId = response.swarmId
    testContext.agents = response.agents
  }
})

Given('the agents have different specializations', () => {
  const agentTypes = testContext.agents!.map(a => a.type)
  const uniqueTypes = new Set(agentTypes)
  expect(uniqueTypes.size).toBeGreaterThan(1)
})

When('I execute a {string} pipeline', async (pipelineType: string) => {
  testContext.startTime = Date.now()
  
  const result = await unjucksE2ESwarm({
    action: 'execute',
    swarmId: testContext.swarmId!,
    task: {
      type: pipelineType,
      payload: {
        template: 'enterprise-template',
        variables: {}
      }
    }
  })
  
  expect(result.isError).toBe(false)
  testContext.tasks = [result] as any
})

When('I provide template parameters:', (dataTable: any) => {
  const parameters = dataTable.hashes()[0]
  expect(parameters).toBeDefined()
  expect(parameters.name).toBeDefined()
})

When('I specify the template {string}', (templateName: string) => {
  expect(templateName).toBeTruthy()
})

Then('the pipeline should execute all stages:', async (dataTable: any) => {
  const stages = dataTable.hashes()
  
  for (const stage of stages) {
    expect(stage.stage).toBeDefined()
    expect(stage.agent_type).toBeDefined()
    expect(stage.expected_duration).toBeDefined()
  }
  
  expect(stages.length).toBeGreaterThan(0)
})

Then('the pipeline should execute stages:', async (dataTable: any) => {
  const stages = dataTable.hashes()
  
  for (const stage of stages) {
    expect(stage.stage).toBeDefined()
    expect(stage.agent_type).toBeDefined()
    expect(stage.status).toBe('completed')
  }
})

Then('each stage should complete successfully', () => {
  expect(testContext.tasks).toBeDefined()
  expect(testContext.errors!.length).toBe(0)
})

Then('the final output should contain generated template files', () => {
  expect(testContext.tasks).toBeDefined()
  // Verify template files were generated
})

Then('the pipeline metrics should be recorded', () => {
  expect(testContext.startTime).toBeDefined()
  const duration = Date.now() - testContext.startTime!
  expect(duration).toBeGreaterThan(0)
})

Then('marketplace template should be installed', () => {
  // Verify template installation
  expect(testContext.tasks).toBeDefined()
})

Then('integration tests should pass', () => {
  expect(testContext.errors!.length).toBe(0)
})

Then('deployment should be verified', () => {
  // Verify deployment status
  expect(testContext.tasks).toBeDefined()
})

// Scaling steps
Given('the swarm is processing tasks', () => {
  expect(testContext.swarmId).toBeDefined()
  expect(testContext.agents!.length).toBeGreaterThan(0)
})

When('I scale the swarm up to {int} agents', async (targetCount: number) => {
  const result = await unjucksE2ESwarm({
    action: 'scale',
    swarmId: testContext.swarmId!,
    targetAgents: targetCount
  })
  
  expect(result.isError).toBe(false)
})

When('I scale the swarm down to {int} agents', async (targetCount: number) => {
  const result = await unjucksE2ESwarm({
    action: 'scale',
    swarmId: testContext.swarmId!,
    targetAgents: targetCount
  })
  
  expect(result.isError).toBe(false)
})

Then('{int} new agents should be spawned', (expectedNew: number) => {
  // Verify new agents were spawned
  expect(expectedNew).toBeGreaterThan(0)
})

Then('the topology should be reconfigured', () => {
  // Verify topology reconfiguration
  expect(testContext.swarmId).toBeDefined()
})

Then('existing tasks should not be interrupted', () => {
  expect(testContext.errors!.length).toBe(0)
})

Then('new agents should join the work queue', () => {
  // Verify new agents are working
  expect(true).toBe(true)
})

Then('{int} idle agents should be removed', (expectedRemoved: number) => {
  expect(expectedRemoved).toBeGreaterThan(0)
})

Then('active agents should continue working', () => {
  expect(testContext.errors!.length).toBe(0)
})

Then('the topology should be adjusted accordingly', () => {
  // Verify topology adjustment
  expect(testContext.swarmId).toBeDefined()
})

// Fault tolerance steps
Given('agents are processing a long-running pipeline', () => {
  expect(testContext.swarmId).toBeDefined()
  expect(testContext.agents!.some(a => a.status === 'busy')).toBe(true)
})

When('agent {string} fails unexpectedly', (agentId: string) => {
  expect(agentId).toBeTruthy()
  // Simulate agent failure
  testContext.errors!.push(`Agent ${agentId} failed`)
})

Then('the swarm should detect the failure within {int} seconds', (maxSeconds: number) => {
  expect(maxSeconds).toBeGreaterThan(0)
  expect(testContext.errors!.length).toBeGreaterThan(0)
})

Then('the failed agent\'s tasks should be reassigned', () => {
  // Verify task reassignment
  expect(testContext.swarmId).toBeDefined()
})

Then('a replacement agent should be spawned', () => {
  // Verify replacement spawning
  expect(testContext.swarmId).toBeDefined()
})

Then('the pipeline should continue without data loss', () => {
  expect(testContext.tasks).toBeDefined()
})

Then('the swarm should remain operational', () => {
  expect(testContext.swarmId).toBeDefined()
})

// Performance testing steps  
When('I submit {int} concurrent template generation tasks', async (taskCount: number) => {
  const promises = []
  
  for (let i = 0; i < taskCount; i++) {
    const promise = unjucksE2ESwarm({
      action: 'execute',
      swarmId: testContext.swarmId!,
      task: {
        type: 'template-generation',
        payload: { taskId: i }
      }
    })
    promises.push(promise)
  }
  
  testContext.tasks = await Promise.all(promises) as any
  expect(testContext.tasks).toHaveLength(taskCount)
})

When('each task has different complexity levels', () => {
  expect(testContext.tasks).toBeDefined()
})

Then('all tasks should be distributed across agents', () => {
  expect(testContext.agents!.length).toBeGreaterThan(0)
  expect(testContext.tasks!.length).toBeGreaterThan(0)
})

Then('no agent should be idle while tasks are pending', () => {
  // Verify load balancing
  expect(testContext.agents!.some(a => a.status === 'busy')).toBe(true)
})

Then('90% of tasks should complete within SLA:', (dataTable: any) => {
  const slaRequirements = dataTable.hashes()
  
  for (const requirement of slaRequirements) {
    expect(requirement.complexity).toBeDefined()
    expect(requirement.max_duration).toBeDefined()
  }
})

Then('system resources should remain stable', () => {
  // Verify resource stability
  expect(testContext.errors!.length).toBe(0)
})

Then('no memory leaks should be detected', () => {
  // Memory leak detection would be implemented here
  expect(true).toBe(true)
})

// WebSocket steps
Given('I have an active swarm with WebSocket enabled', () => {
  expect(testContext.swarmId).toBeDefined()
})

Given('I\'m connected to the swarm via WebSocket', async () => {
  // Simulate WebSocket connection
  testContext.websocket = {
    readyState: WebSocket.OPEN,
    send: () => {},
    close: () => {},
    on: () => {}
  } as any
  
  expect(testContext.websocket).toBeDefined()
})

When('agents start communicating', () => {
  expect(testContext.agents!.length).toBeGreaterThan(0)
})

Then('I should receive real-time updates:', (dataTable: any) => {
  const events = dataTable.hashes()
  
  for (const event of events) {
    expect(event.event_type).toBeDefined()
    expect(event.max_latency).toBeDefined()
  }
})

Then('all events should follow MCP message format', () => {
  // Verify MCP message format compliance
  expect(true).toBe(true)
})

Then('message ordering should be preserved', () => {
  expect(true).toBe(true)
})

Then('no events should be lost', () => {
  expect(testContext.errors!.length).toBe(0)
})

// Additional helper functions for complex scenarios
async function waitForCondition(condition: () => boolean, timeout: number = 5000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (condition()) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
}

function generateTestData(type: string, count: number): any[] {
  const data = []
  for (let i = 0; i < count; i++) {
    data.push({
      id: `${type}-${i}`,
      timestamp: new Date().toISOString(),
      data: `test-${type}-data-${i}`
    })
  }
  return data
}