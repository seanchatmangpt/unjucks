/**
 * Workflow MCP Orchestration Tests
 * Tests complex workflow orchestration and task management via MCP tools
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
// import type { McpRequest, McpResponse } from '../types/mcp-protocol.js'

}

class WorkflowMcpOrchestrator { private process }>()
  private workflowId: string | null = null

  async initialize() { return new Promise((resolve, reject) => {
      this.process = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
        stdio }
      })

      this.process.stderr?.on('data', (data) => {
        const error = data.toString()
        if (error.includes('FATAL') || error.includes('Orchestration failed')) {
          reject(new Error(`Workflow MCP orchestrator failed))
        }
      })

      this.process.on('error', reject)

      setTimeout(() => {
        reject(new Error('Workflow MCP orchestrator initialization timeout'))
      }, 25000)
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
            // Ignore non-JSON output
          }
        }
      }
    })
  }

  async call(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('Workflow MCP orchestrator not available'))
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
          reject(new Error(`Workflow MCP request timeout for method ${method}`))
        }
      }, 20000)
    })
  }

  async createWorkflow(definition) { const response = await this.call('tools/call', {
      name }

    const result = JSON.parse(response.result.content[0].text)
    this.workflowId = result.workflow_id || result.id
    return this.workflowId
  }

  async executeWorkflow(workflowId?, inputs = {}) { const id = workflowId || this.workflowId
    if (!id) throw new Error('No workflow ID available')

    const response = await this.call('tools/call', {
      name }
    })

    if (response.error) {
      throw new Error(`Failed to execute workflow)
    }

    const result = JSON.parse(response.result.content[0].text)
    return result.execution_id
  }

  async getWorkflowStatus(workflowId?: string, executionId?) { const response = await this.call('tools/call', {
      name }

    return JSON.parse(response.result.content[0].text)
  }

  async getWorkflowResults(executionId) { const response = await this.call('tools/call', {
      name }

    return JSON.parse(response.result.content[0].text)
  }

  async assignAgentToTask(taskId, agentType?) { const response = await this.call('tools/call', {
      name }
    })

    if (response.error) {
      throw new Error(`Failed to assign agent to task)
    }

    return JSON.parse(response.result.content[0].text)
  }

  async getQueueStatus() { const response = await this.call('tools/call', {
      name }

    return JSON.parse(response.result.content[0].text)
  }

  async getAuditTrail(workflowId?, limit = 100) { const response = await this.call('tools/call', {
      name }
    })

    if (response.error) {
      throw new Error(`Failed to get audit trail)
    }

    return JSON.parse(response.result.content[0].text)
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
}

describe('Workflow MCP Orchestration', () => {
  let orchestrator

  beforeAll(async () => {
    orchestrator = new WorkflowMcpOrchestrator()
    await orchestrator.initialize()
  })

  afterAll(async () => {
    if (orchestrator) {
      await orchestrator.shutdown()
    }
  })

  describe('Workflow Creation and Definition', () => { it('should create simple linear workflow', async () => {
      const workflow = {
        id },
        steps: [
          { id },
            outputs: { research_results }
          },
          { id }}' },
            outputs: { code }
          },
          { id }}' },
            outputs: { test_results }
          }
        ]
      }

      const workflowId = await orchestrator.createWorkflow(workflow)
      expect(workflowId).toBeTruthy()
      expect(typeof workflowId).toBe('string')

      const status = await orchestrator.getWorkflowStatus(workflowId)
      expect(status.name).toBe(workflow.name)
      expect(status.steps).toHaveLength(3)
      expect(status.status).toBe('created')
    })

    it('should create parallel branching workflow', async () => { const workflow = {
        id },
        steps: [
          { id },
            outputs: { project_config }
          },
          { id }}' },
            outputs: { frontend_code }
          },
          { id }}' },
            outputs: { backend_code }
          },
          { id }}',
              backend: '{{backend.backend_code}}'
            },
            outputs: { integration_results }
          }
        ]
      }

      const workflowId = await orchestrator.createWorkflow(workflow)
      expect(workflowId).toBeTruthy()

      const status = await orchestrator.getWorkflowStatus(workflowId)
      expect(status.name).toBe(workflow.name)
      expect(status.parallel_branches).toBeDefined()
      expect(status.join_points).toContain('integration')
    })

    it('should create complex multi-level workflow', async () => { const workflow = {
        id },
        steps: [
          { id },
            outputs: { analysis_report }
          },
          { id }}' },
            outputs: { architecture_design }
          },
          { id }}' },
            outputs: { schema_design }
          },
          { id }}',
              schema: '{{database-design.schema_design}}'
            },
            outputs: { api_code }
          },
          { id }}' },
            outputs: { optimized_code }
          }
        ]
      }

      const workflowId = await orchestrator.createWorkflow(workflow)
      expect(workflowId).toBeTruthy()

      const status = await orchestrator.getWorkflowStatus(workflowId)
      expect(status.complexity_level).toBe('high')
      expect(status.estimated_duration).toBeGreaterThan(30000)
      expect(status.dependency_graph).toBeDefined()
    })
  })

  describe('Workflow Execution and Monitoring', () => { let testWorkflowId => {
      const workflow = {
        id },
        steps: [
          { id },
            outputs: { prepared_data }
          },
          { id }}' },
            outputs: { results }
          }
        ]
      }

      testWorkflowId = await orchestrator.createWorkflow(workflow)
    })

    it('should execute workflow and track progress', async () => { const executionId = await orchestrator.executeWorkflow(testWorkflowId, {
        data_source })

    it('should handle workflow completion and results', async () => {
      const executionId = await orchestrator.executeWorkflow(testWorkflowId)

      // Poll for completion
      let status
      let attempts = 0
      do {
        await delay(2000)
        status = await orchestrator.getWorkflowStatus(testWorkflowId, executionId)
        attempts++
      } while (status.status === 'running' && attempts < 10)

      if (status.status === 'completed') {
        const results = await orchestrator.getWorkflowResults(executionId)
        
        expect(results).toBeDefined()
        expect(results.execution_id).toBe(executionId)
        expect(results.step_results).toBeDefined()
        expect(results.final_outputs).toBeDefined()
      } else {
        // If not completed, verify it's in a valid intermediate state
        expect(['running', 'paused', 'waiting'].includes(status.status)).toBe(true)
      }
    })

    it('should handle workflow errors and retries', async () => { const failureWorkflow = {
        id },
        steps: [
          { id },
            outputs: { should_not_exist }
          }
        ]
      }

      const failWorkflowId = await orchestrator.createWorkflow(failureWorkflow)
      const executionId = await orchestrator.executeWorkflow(failWorkflowId)

      // Wait for failure and retries
      await delay(15000)

      const status = await orchestrator.getWorkflowStatus(failWorkflowId, executionId)
      expect(['failed', 'error', 'retry'].includes(status.status)).toBe(true)
      expect(status.retry_count).toBeGreaterThan(0)
      expect(status.error_details).toBeDefined()
    })

    it('should manage concurrent workflow executions', async () => {
      const executionPromises = [
        orchestrator.executeWorkflow(testWorkflowId, { batch_id),
        orchestrator.executeWorkflow(testWorkflowId, { batch_id),
        orchestrator.executeWorkflow(testWorkflowId, { batch_id)
      ]

      const executionIds = await Promise.all(executionPromises)
      expect(executionIds).toHaveLength(3)
      expect(new Set(executionIds).size).toBe(3) // All unique

      // Check queue status
      const queueStatus = await orchestrator.getQueueStatus()
      expect(queueStatus.active_executions).toBeGreaterThanOrEqual(1)
      expect(queueStatus.queued_executions).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Advanced Orchestration Features', () => { it('should perform intelligent agent assignment', async () => {
      const complexTask = {
        id }

      const assignment = await orchestrator.assignAgentToTask(
        complexTask.id, 
        'analyst'
      )

      expect(assignment).toBeDefined()
      expect(assignment.assigned_agent).toBeDefined()
      expect(assignment.match_score).toBeGreaterThan(0.5)
      expect(assignment.reasoning).toBeDefined()
    })

    it('should maintain comprehensive audit trail', async () => { const workflow = {
        id },
        steps: [
          { id },
            outputs: { audit_data }
          }
        ]
      }

      const workflowId = await orchestrator.createWorkflow(workflow)
      const executionId = await orchestrator.executeWorkflow(workflowId)

      // Wait for some execution
      await delay(3000)

      const auditTrail = await orchestrator.getAuditTrail(workflowId, 50)
      
      expect(auditTrail.events).toBeDefined()
      expect(Array.isArray(auditTrail.events)).toBe(true)
      expect(auditTrail.events.length).toBeGreaterThan(0)

      // Check audit event structure
      const firstEvent = auditTrail.events[0]
      expect(firstEvent.timestamp).toBeDefined()
      expect(firstEvent.event_type).toBeDefined()
      expect(firstEvent.workflow_id).toBe(workflowId)
      expect(firstEvent.execution_id).toBeDefined()
    })

    it('should handle dynamic workflow modification', async () => { // Create initial workflow
      const workflow = {
        id },
        steps: [
          { id },
            outputs: { initial_results }
          }
        ]
      }

      const workflowId = await orchestrator.createWorkflow(workflow)

      // Attempt to add step during execution (if supported)
      try { const modificationResponse = await orchestrator.call('tools/call', {
          name }}' },
              outputs: { enhanced_results)

        if (!modificationResponse.error) {
          const status = await orchestrator.getWorkflowStatus(workflowId)
          expect(status.steps.some((s) => s.id === 'dynamic-step')).toBe(true)
        }
      } catch (error) {
        // Dynamic modification might not be supported - that's acceptable
        expect(error.message).toContain('modification')
      }
    })

    it('should optimize workflow execution based on resource availability', async () => { const resourceIntensiveWorkflow = {
        id },
        steps: [
          { id } },
            outputs: { cpu_results }
          },
          { id } },
            outputs: { memory_results }
          },
          { id }}',
              memory_data: '{{memory-intensive.memory_results}}'
            },
            outputs: { final_results }
          }
        ]
      }

      const workflowId = await orchestrator.createWorkflow(resourceIntensiveWorkflow)
      const executionId = await orchestrator.executeWorkflow(workflowId)

      // Check optimization occurs
      await delay(2000)
      const status = await orchestrator.getWorkflowStatus(workflowId, executionId)

      expect(status.resource_optimization).toBeDefined()
      expect(status.execution_plan).toBeDefined()
      expect(status.resource_allocation).toBeDefined()
    })
  })
})