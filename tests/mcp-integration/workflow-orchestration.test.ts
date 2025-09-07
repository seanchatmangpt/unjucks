/**
 * Workflow MCP Orchestration Tests
 * Tests complex workflow orchestration and task management via MCP tools
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { McpRequest, McpResponse } from '../types/mcp-protocol'

interface WorkflowStep {
  id: string
  name: string
  agent_type: string
  dependencies: string[]
  inputs: Record<string, any>
  outputs: Record<string, any>
}

interface WorkflowDefinition {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  timeout: number
  retry_policy: {
    max_attempts: number
    backoff: 'linear' | 'exponential'
  }
}

class WorkflowMcpOrchestrator {
  private process: ChildProcess | null = null
  private messageId = 0
  private pendingRequests = new Map<number, { resolve: Function, reject: Function }>()
  private workflowId: string | null = null

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          NODE_ENV: 'test',
          ENABLE_WORKFLOWS: 'true',
          ENABLE_ORCHESTRATION: 'true',
          LOG_LEVEL: 'info'
        }
      })

      let initBuffer = ''
      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        initBuffer += output

        if (output.includes('Workflow orchestration enabled') || 
            output.includes('MCP orchestrator ready')) {
          this.setupMessageHandling()
          resolve()
        }
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const error = data.toString()
        if (error.includes('FATAL') || error.includes('Orchestration failed')) {
          reject(new Error(`Workflow MCP orchestrator failed: ${error}`))
        }
      })

      this.process.on('error', reject)

      setTimeout(() => {
        reject(new Error('Workflow MCP orchestrator initialization timeout'))
      }, 25000)
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
            // Ignore non-JSON output
          }
        }
      }
    })
  }

  async call(method: string, params: any = {}): Promise<McpResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('Workflow MCP orchestrator not available'))
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
          reject(new Error(`Workflow MCP request timeout for method ${method}`))
        }
      }, 20000)
    })
  }

  async createWorkflow(definition: WorkflowDefinition): Promise<string> {
    const response = await this.call('tools/call', {
      name: 'workflow_create',
      arguments: {
        name: definition.name,
        description: definition.description,
        steps: definition.steps,
        metadata: {
          timeout: definition.timeout,
          retry_policy: definition.retry_policy
        }
      }
    })

    if (response.error) {
      throw new Error(`Failed to create workflow: ${response.error.message}`)
    }

    const result = JSON.parse(response.result.content[0].text)
    this.workflowId = result.workflow_id || result.id
    return this.workflowId
  }

  async executeWorkflow(workflowId?: string, inputs: Record<string, any> = {}): Promise<string> {
    const id = workflowId || this.workflowId
    if (!id) throw new Error('No workflow ID available')

    const response = await this.call('tools/call', {
      name: 'workflow_execute',
      arguments: {
        workflow_id: id,
        input_data: inputs,
        async: true
      }
    })

    if (response.error) {
      throw new Error(`Failed to execute workflow: ${response.error.message}`)
    }

    const result = JSON.parse(response.result.content[0].text)
    return result.execution_id
  }

  async getWorkflowStatus(workflowId?: string, executionId?: string): Promise<any> {
    const response = await this.call('tools/call', {
      name: 'workflow_status',
      arguments: {
        workflow_id: workflowId || this.workflowId,
        execution_id: executionId,
        include_metrics: true
      }
    })

    if (response.error) {
      throw new Error(`Failed to get workflow status: ${response.error.message}`)
    }

    return JSON.parse(response.result.content[0].text)
  }

  async getWorkflowResults(executionId: string): Promise<any> {
    const response = await this.call('tools/call', {
      name: 'workflow_results',
      arguments: {
        execution_id: executionId,
        format: 'detailed'
      }
    })

    if (response.error) {
      throw new Error(`Failed to get workflow results: ${response.error.message}`)
    }

    return JSON.parse(response.result.content[0].text)
  }

  async assignAgentToTask(taskId: string, agentType?: string): Promise<any> {
    const response = await this.call('tools/call', {
      name: 'workflow_agent_assign',
      arguments: {
        task_id: taskId,
        agent_type: agentType,
        use_vector_similarity: true
      }
    })

    if (response.error) {
      throw new Error(`Failed to assign agent to task: ${response.error.message}`)
    }

    return JSON.parse(response.result.content[0].text)
  }

  async getQueueStatus(): Promise<any> {
    const response = await this.call('tools/call', {
      name: 'workflow_queue_status',
      arguments: {
        include_messages: true
      }
    })

    if (response.error) {
      throw new Error(`Failed to get queue status: ${response.error.message}`)
    }

    return JSON.parse(response.result.content[0].text)
  }

  async getAuditTrail(workflowId?: string, limit: number = 100): Promise<any> {
    const response = await this.call('tools/call', {
      name: 'workflow_audit_trail',
      arguments: {
        workflow_id: workflowId || this.workflowId,
        limit
      }
    })

    if (response.error) {
      throw new Error(`Failed to get audit trail: ${response.error.message}`)
    }

    return JSON.parse(response.result.content[0].text)
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
}

describe('Workflow MCP Orchestration', () => {
  let orchestrator: WorkflowMcpOrchestrator

  beforeAll(async () => {
    orchestrator = new WorkflowMcpOrchestrator()
    await orchestrator.initialize()
  })

  afterAll(async () => {
    if (orchestrator) {
      await orchestrator.shutdown()
    }
  })

  describe('Workflow Creation and Definition', () => {
    it('should create simple linear workflow', async () => {
      const workflow: WorkflowDefinition = {
        id: 'linear-test-workflow',
        name: 'Linear Test Workflow',
        description: 'Simple sequential task execution',
        timeout: 30000,
        retry_policy: { max_attempts: 3, backoff: 'linear' },
        steps: [
          {
            id: 'step-1',
            name: 'Research Phase',
            agent_type: 'researcher',
            dependencies: [],
            inputs: { topic: 'API design patterns' },
            outputs: { research_results: 'analysis_document' }
          },
          {
            id: 'step-2',
            name: 'Implementation Phase',
            agent_type: 'coder',
            dependencies: ['step-1'],
            inputs: { requirements: '{{step-1.research_results}}' },
            outputs: { code: 'implementation_files' }
          },
          {
            id: 'step-3',
            name: 'Testing Phase',
            agent_type: 'analyst',
            dependencies: ['step-2'],
            inputs: { code: '{{step-2.code}}' },
            outputs: { test_results: 'test_report' }
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

    it('should create parallel branching workflow', async () => {
      const workflow: WorkflowDefinition = {
        id: 'parallel-test-workflow',
        name: 'Parallel Branching Workflow',
        description: 'Parallel execution with join point',
        timeout: 45000,
        retry_policy: { max_attempts: 2, backoff: 'exponential' },
        steps: [
          {
            id: 'init',
            name: 'Initialize Project',
            agent_type: 'coordinator',
            dependencies: [],
            inputs: { project_spec: 'web_application' },
            outputs: { project_config: 'config_object' }
          },
          {
            id: 'frontend',
            name: 'Frontend Development',
            agent_type: 'coder',
            dependencies: ['init'],
            inputs: { config: '{{init.project_config}}' },
            outputs: { frontend_code: 'ui_components' }
          },
          {
            id: 'backend',
            name: 'Backend Development',
            agent_type: 'coder',
            dependencies: ['init'],
            inputs: { config: '{{init.project_config}}' },
            outputs: { backend_code: 'api_endpoints' }
          },
          {
            id: 'integration',
            name: 'Integration Testing',
            agent_type: 'analyst',
            dependencies: ['frontend', 'backend'],
            inputs: { 
              frontend: '{{frontend.frontend_code}}',
              backend: '{{backend.backend_code}}'
            },
            outputs: { integration_results: 'test_suite' }
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

    it('should create complex multi-level workflow', async () => {
      const workflow: WorkflowDefinition = {
        id: 'complex-workflow',
        name: 'Complex Multi-Level Workflow',
        description: 'Complex workflow with multiple levels and conditional branches',
        timeout: 60000,
        retry_policy: { max_attempts: 3, backoff: 'exponential' },
        steps: [
          {
            id: 'analysis',
            name: 'Requirements Analysis',
            agent_type: 'researcher',
            dependencies: [],
            inputs: { requirements_doc: 'business_requirements.md' },
            outputs: { analysis_report: 'technical_analysis', complexity_score: 'number' }
          },
          {
            id: 'architecture',
            name: 'System Architecture',
            agent_type: 'coordinator',
            dependencies: ['analysis'],
            inputs: { analysis: '{{analysis.analysis_report}}' },
            outputs: { architecture_design: 'system_design', components: 'component_list' }
          },
          {
            id: 'database-design',
            name: 'Database Design',
            agent_type: 'analyst',
            dependencies: ['architecture'],
            inputs: { components: '{{architecture.components}}' },
            outputs: { schema_design: 'database_schema' }
          },
          {
            id: 'api-implementation',
            name: 'API Implementation',
            agent_type: 'coder',
            dependencies: ['architecture', 'database-design'],
            inputs: { 
              design: '{{architecture.architecture_design}}',
              schema: '{{database-design.schema_design}}'
            },
            outputs: { api_code: 'api_implementation' }
          },
          {
            id: 'optimization',
            name: 'Performance Optimization',
            agent_type: 'optimizer',
            dependencies: ['api-implementation'],
            inputs: { code: '{{api-implementation.api_code}}' },
            outputs: { optimized_code: 'optimized_implementation' }
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

  describe('Workflow Execution and Monitoring', () => {
    let testWorkflowId: string

    beforeEach(async () => {
      const workflow: WorkflowDefinition = {
        id: 'execution-test-workflow',
        name: 'Execution Test Workflow',
        description: 'Workflow for execution testing',
        timeout: 20000,
        retry_policy: { max_attempts: 2, backoff: 'linear' },
        steps: [
          {
            id: 'prepare',
            name: 'Prepare Data',
            agent_type: 'researcher',
            dependencies: [],
            inputs: { data_source: 'test_dataset' },
            outputs: { prepared_data: 'processed_dataset' }
          },
          {
            id: 'process',
            name: 'Process Data',
            agent_type: 'analyst',
            dependencies: ['prepare'],
            inputs: { data: '{{prepare.prepared_data}}' },
            outputs: { results: 'analysis_results' }
          }
        ]
      }

      testWorkflowId = await orchestrator.createWorkflow(workflow)
    })

    it('should execute workflow and track progress', async () => {
      const executionId = await orchestrator.executeWorkflow(testWorkflowId, {
        data_source: 'sample_api_logs',
        analysis_type: 'performance_metrics'
      })

      expect(executionId).toBeTruthy()

      // Wait for execution to start
      await delay(1000)

      const status = await orchestrator.getWorkflowStatus(testWorkflowId, executionId)
      expect(status.execution_id).toBe(executionId)
      expect(['running', 'queued', 'starting'].includes(status.status)).toBe(true)
      expect(status.progress).toBeDefined()
    })

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

    it('should handle workflow errors and retries', async () => {
      const failureWorkflow: WorkflowDefinition = {
        id: 'failure-test-workflow',
        name: 'Failure Test Workflow',
        description: 'Workflow designed to test failure scenarios',
        timeout: 10000,
        retry_policy: { max_attempts: 3, backoff: 'exponential' },
        steps: [
          {
            id: 'failing-step',
            name: 'Intentionally Failing Step',
            agent_type: 'researcher',
            dependencies: [],
            inputs: { simulate_failure: true, failure_type: 'timeout' },
            outputs: { should_not_exist: 'never_created' }
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
        orchestrator.executeWorkflow(testWorkflowId, { batch_id: 'batch_1' }),
        orchestrator.executeWorkflow(testWorkflowId, { batch_id: 'batch_2' }),
        orchestrator.executeWorkflow(testWorkflowId, { batch_id: 'batch_3' })
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

  describe('Advanced Orchestration Features', () => {
    it('should perform intelligent agent assignment', async () => {
      const complexTask = {
        id: 'complex-analysis-task',
        requirements: [
          'machine_learning_expertise',
          'data_visualization',
          'statistical_analysis',
          'python_programming'
        ],
        domain: 'data_science',
        complexity_level: 'high'
      }

      const assignment = await orchestrator.assignAgentToTask(
        complexTask.id, 
        'analyst'
      )

      expect(assignment).toBeDefined()
      expect(assignment.assigned_agent).toBeDefined()
      expect(assignment.match_score).toBeGreaterThan(0.5)
      expect(assignment.reasoning).toBeDefined()
    })

    it('should maintain comprehensive audit trail', async () => {
      const workflow: WorkflowDefinition = {
        id: 'audit-test-workflow',
        name: 'Audit Test Workflow',
        description: 'Workflow for audit trail testing',
        timeout: 15000,
        retry_policy: { max_attempts: 1, backoff: 'linear' },
        steps: [
          {
            id: 'audit-step',
            name: 'Audited Operation',
            agent_type: 'researcher',
            dependencies: [],
            inputs: { audit_enabled: true },
            outputs: { audit_data: 'operation_log' }
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

    it('should handle dynamic workflow modification', async () => {
      // Create initial workflow
      const workflow: WorkflowDefinition = {
        id: 'dynamic-workflow',
        name: 'Dynamic Modification Workflow',
        description: 'Workflow that can be modified during execution',
        timeout: 30000,
        retry_policy: { max_attempts: 2, backoff: 'linear' },
        steps: [
          {
            id: 'initial-step',
            name: 'Initial Processing',
            agent_type: 'researcher',
            dependencies: [],
            inputs: { dynamic_modification: true },
            outputs: { initial_results: 'base_analysis' }
          }
        ]
      }

      const workflowId = await orchestrator.createWorkflow(workflow)

      // Attempt to add step during execution (if supported)
      try {
        const modificationResponse = await orchestrator.call('tools/call', {
          name: 'workflow_modify',
          arguments: {
            workflow_id: workflowId,
            modification_type: 'add_step',
            step_definition: {
              id: 'dynamic-step',
              name: 'Dynamically Added Step',
              agent_type: 'analyst',
              dependencies: ['initial-step'],
              inputs: { data: '{{initial-step.initial_results}}' },
              outputs: { enhanced_results: 'enhanced_analysis' }
            }
          }
        })

        if (!modificationResponse.error) {
          const status = await orchestrator.getWorkflowStatus(workflowId)
          expect(status.steps.some((s: any) => s.id === 'dynamic-step')).toBe(true)
        }
      } catch (error) {
        // Dynamic modification might not be supported - that's acceptable
        expect(error.message).toContain('modification')
      }
    })

    it('should optimize workflow execution based on resource availability', async () => {
      const resourceIntensiveWorkflow: WorkflowDefinition = {
        id: 'resource-intensive-workflow',
        name: 'Resource Intensive Workflow',
        description: 'Workflow that requires resource optimization',
        timeout: 40000,
        retry_policy: { max_attempts: 2, backoff: 'exponential' },
        steps: [
          {
            id: 'cpu-intensive',
            name: 'CPU Intensive Task',
            agent_type: 'optimizer',
            dependencies: [],
            inputs: { resource_requirements: { cpu: 'high', memory: 'medium' } },
            outputs: { cpu_results: 'computational_results' }
          },
          {
            id: 'memory-intensive',
            name: 'Memory Intensive Task',
            agent_type: 'analyst',
            dependencies: [],
            inputs: { resource_requirements: { cpu: 'low', memory: 'high' } },
            outputs: { memory_results: 'data_analysis' }
          },
          {
            id: 'balanced-task',
            name: 'Balanced Resource Task',
            agent_type: 'coder',
            dependencies: ['cpu-intensive', 'memory-intensive'],
            inputs: { 
              cpu_data: '{{cpu-intensive.cpu_results}}',
              memory_data: '{{memory-intensive.memory_results}}'
            },
            outputs: { final_results: 'integrated_solution' }
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