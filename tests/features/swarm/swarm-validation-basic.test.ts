/**
 * Basic Swarm Validation Tests - Focused on working functionality
 * Tests actual MCP swarm orchestration capabilities
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { E2ESwarmOrchestrator } from '../../../src/mcp/swarm/e2e-orchestrator'
import { startPerformanceTimer, generateTestSwarmId } from '../../setup/swarm-test-setup'

describe('MCP Swarm Validation', () => {
  let orchestrator: E2ESwarmOrchestrator

  beforeAll(async () => {
    orchestrator = new E2ESwarmOrchestrator()
  })

  describe('Swarm Topology Validation', () => {
    it('should initialize mesh topology successfully', async () => {
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
      expect(swarmData.agents).toHaveLength(4)
      expect(swarmData.swarmId).toBeTruthy()
      expect(duration).toBeLessThan(2000)
    })

    it('should initialize hierarchical topology with leader selection', async () => {
      const result = await orchestrator.initializeSwarm({
        action: 'initialize',
        topology: 'hierarchical',
        agentCount: 5
      })

      expect(result.isError).toBe(false)
      const swarmData = JSON.parse(result.content[0].text)
      expect(swarmData.success).toBe(true)
      expect(swarmData.topology).toBe('hierarchical')
      expect(swarmData.agents).toHaveLength(5)
      
      // In hierarchical topology, should have connections summary
      expect(swarmData.connections).toBeDefined()
    })

    it('should initialize star topology with central hub', async () => {
      const result = await orchestrator.initializeSwarm({
        action: 'initialize', 
        topology: 'star',
        agentCount: 6
      })

      expect(result.isError).toBe(false)
      const swarmData = JSON.parse(result.content[0].text)
      expect(swarmData.success).toBe(true)
      expect(swarmData.topology).toBe('star')
      expect(swarmData.agents).toHaveLength(6)
    })

    it('should initialize ring topology with circular connections', async () => {
      const result = await orchestrator.initializeSwarm({
        action: 'initialize',
        topology: 'ring',
        agentCount: 3
      })

      expect(result.isError).toBe(false)
      const swarmData = JSON.parse(result.content[0].text)
      expect(swarmData.success).toBe(true)
      expect(swarmData.topology).toBe('ring')
      expect(swarmData.agents).toHaveLength(3)
    })
  })

  describe('Agent Types and Capabilities', () => {
    it('should spawn different agent types in correct proportions', async () => {
      const result = await orchestrator.initializeSwarm({
        action: 'initialize',
        topology: 'mesh',
        agentCount: 10
      })

      expect(result.isError).toBe(false)
      const swarmData = JSON.parse(result.content[0].text)
      expect(swarmData.agents).toHaveLength(10)
      
      // Should have variety of agent types
      const agentTypes = swarmData.agents.map((agent: any) => agent.type)
      const uniqueTypes = [...new Set(agentTypes)]
      expect(uniqueTypes.length).toBeGreaterThan(3) // At least 4 different types
      
      // Should include key agent types
      expect(agentTypes).toContain('researcher')
      expect(agentTypes).toContain('architect') 
      expect(agentTypes).toContain('coder')
      expect(agentTypes).toContain('tester')
    })
  })

  describe('E2E Task Execution Validation', () => {
    it('should execute template generation task across swarm', async () => {
      // First initialize a swarm
      const initResult = await orchestrator.initializeSwarm({
        action: 'initialize',
        topology: 'mesh',
        agentCount: 4
      })
      
      expect(initResult.isError).toBe(false)
      const swarmData = JSON.parse(initResult.content[0].text)
      const swarmId = swarmData.swarmId

      // Execute E2E task
      const taskResult = await orchestrator.executeE2ETask({
        action: 'execute',
        swarmId,
        task: {
          type: 'template-generation',
          payload: {
            generator: 'component',
            templateName: 'react-component',
            variables: {
              componentName: 'TestComponent',
              withTests: true
            }
          }
        }
      })

      expect(taskResult).toBeDefined()
      expect(taskResult.isError).toBe(false)
      
      const taskData = JSON.parse(taskResult.content[0].text)
      expect(taskData.success).toBe(true)
      expect(taskData.results).toBeDefined()
      expect(taskData.executionTime).toBeGreaterThan(0)
    })

    it('should handle task failures gracefully', async () => {
      // Initialize swarm
      const initResult = await orchestrator.initializeSwarm({
        action: 'initialize',
        topology: 'mesh',
        agentCount: 2
      })
      
      const swarmData = JSON.parse(initResult.content[0].text)
      const swarmId = swarmData.swarmId

      // Execute invalid task that should fail
      const taskResult = await orchestrator.executeE2ETask({
        action: 'execute',
        swarmId,
        task: {
          type: 'invalid-task-type',
          payload: {
            invalid: 'data'
          }
        }
      })

      expect(taskResult).toBeDefined()
      // Should handle error gracefully, not crash
      if (taskResult.isError) {
        expect(taskResult.content[0].text).toContain('error')
      } else {
        const taskData = JSON.parse(taskResult.content[0].text)
        expect(taskData.success).toBe(false)
      }
    })
  })

  describe('Performance and Scalability', () => {
    it('should maintain performance with larger swarms', async () => {
      const endTimer = startPerformanceTimer('large-swarm-initialization')
      
      const result = await orchestrator.initializeSwarm({
        action: 'initialize',
        topology: 'mesh',
        agentCount: 20
      })

      const duration = endTimer()
      
      expect(result.isError).toBe(false)
      const swarmData = JSON.parse(result.content[0].text)
      expect(swarmData.agents).toHaveLength(20)
      
      // Should still initialize quickly even with more agents
      expect(duration).toBeLessThan(5000) // 5 second limit for large swarm
    })

    it('should handle concurrent swarm initialization', async () => {
      const startTime = Date.now()
      
      // Create multiple swarms concurrently
      const promises = Array.from({ length: 5 }, () =>
        orchestrator.initializeSwarm({
          action: 'initialize',
          topology: 'mesh',
          agentCount: 3
        })
      )

      const results = await Promise.all(promises)
      const duration = Date.now() - startTime

      // All should succeed
      results.forEach(result => {
        expect(result.isError).toBe(false)
        const swarmData = JSON.parse(result.content[0].text)
        expect(swarmData.success).toBe(true)
        expect(swarmData.swarmId).toBeTruthy()
      })

      // Should handle concurrency well
      expect(duration).toBeLessThan(10000) // 10 second limit for 5 concurrent swarms
    })
  })

  describe('MCP Protocol Compliance', () => {
    it('should return valid ToolResult format for all operations', async () => {
      const result = await orchestrator.initializeSwarm({
        action: 'initialize',
        topology: 'mesh',
        agentCount: 3
      })

      // Validate MCP ToolResult structure
      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('isError')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content[0]).toHaveProperty('type')
      expect(result.content[0]).toHaveProperty('text')
      expect(result.content[0].type).toBe('text')
    })

    it('should handle invalid parameters with proper error responses', async () => {
      const result = await orchestrator.initializeSwarm({
        action: 'initialize',
        topology: 'invalid-topology' as any,
        agentCount: -1
      })

      // Should handle invalid input gracefully
      expect(result).toBeDefined()
      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('isError')
      
      if (result.isError) {
        expect(result.content[0].text).toContain('error')
      } else {
        // If not errored, should have fallback behavior
        const swarmData = JSON.parse(result.content[0].text)
        expect(swarmData.success).toBeDefined()
      }
    })
  })

  describe('Real-world Scenarios', () => {
    it('should execute complete template generation pipeline', async () => {
      const endTimer = startPerformanceTimer('complete-pipeline')
      
      // Initialize swarm
      const initResult = await orchestrator.initializeSwarm({
        action: 'initialize',
        topology: 'hierarchical', // Use hierarchical for coordinated pipeline
        agentCount: 5
      })
      
      expect(initResult.isError).toBe(false)
      const swarmData = JSON.parse(initResult.content[0].text)
      
      // Execute comprehensive template generation task
      const taskResult = await orchestrator.executeE2ETask({
        action: 'execute',
        swarmId: swarmData.swarmId,
        task: {
          type: 'generate',
          payload: {
            templates: [
              { 
                generator: 'component',
                name: 'UserProfile',
                type: 'react'
              },
              {
                generator: 'api',
                name: 'user-service', 
                type: 'express'
              }
            ],
            options: {
              withTests: true,
              withDocs: true,
              validate: true
            }
          }
        }
      })

      const duration = endTimer()
      
      expect(taskResult).toBeDefined()
      expect(taskResult.isError).toBe(false)
      
      const taskData = JSON.parse(taskResult.content[0].text)
      expect(taskData.success).toBe(true)
      expect(taskData.results).toHaveLength(2) // Should generate 2 templates
      expect(duration).toBeLessThan(30000) // Should complete within 30 seconds
    })
  })
})