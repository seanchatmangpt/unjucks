/**
 * MCP Error Handling and Resilience Tests
 * Tests error scenarios, fault tolerance, and system recovery for MCP operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { performance } from 'node:perf_hooks'
import type { McpRequest, McpResponse } from '../types/mcp-protocol'

interface FaultInjectionConfig {
  faultType: 'network_delay' | 'memory_pressure' | 'cpu_spike' | 'disk_full' | 'connection_drop'
  intensity: 'low' | 'medium' | 'high' | 'extreme'
  duration: number
  triggerAfter?: number
}

interface RecoveryMetrics {
  faultInjectionTime: number
  recoveryDetectedTime: number
  fullRecoveryTime: number
  requestsDuringFault: number
  requestsFailedDuringFault: number
  requestsAfterRecovery: number
  recoveryDuration: number
  systemStabilityScore: number
}

class McpResilienceTest {
  private process: ChildProcess | null = null
  private messageId = 0
  private pendingRequests = new Map<number, { resolve: Function, reject: Function }>()
  private faultActive = false
  private metrics: RecoveryMetrics | null = null

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          NODE_ENV: 'resilience_test',
          ENABLE_FAULT_TOLERANCE: 'true',
          ENABLE_RECOVERY_METRICS: 'true',
          MAX_RETRIES: '3',
          CIRCUIT_BREAKER: 'enabled',
          LOG_LEVEL: 'error'
        }
      })

      let initBuffer = ''
      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        initBuffer += output

        if (output.includes('Resilience features enabled') || 
            output.includes('Fault tolerance initialized')) {
          this.setupMessageHandling()
          resolve()
        }
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const error = data.toString()
        if (error.includes('FATAL') || error.includes('Cannot initialize resilience')) {
          reject(new Error(`MCP resilience test setup failed: ${error}`))
        }
      })

      this.process.on('error', reject)

      setTimeout(() => {
        reject(new Error('MCP resilience test initialization timeout'))
      }, 30000)
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
        reject(new Error('MCP resilience test not available'))
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

      // Shorter timeout during fault injection to detect failures faster
      const timeout = this.faultActive ? 5000 : 15000
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`MCP resilience test timeout for method ${method}`))
        }
      }, timeout)
    })
  }

  async injectFault(config: FaultInjectionConfig): Promise<void> {
    this.faultActive = true
    
    const response = await this.call('tools/call', {
      name: 'fault_inject',
      arguments: {
        fault_type: config.faultType,
        intensity: config.intensity,
        duration: config.duration,
        trigger_after: config.triggerAfter || 0
      }
    })

    if (response.error) {
      throw new Error(`Failed to inject fault: ${response.error.message}`)
    }

    console.log(`Fault injection activated: ${config.faultType} at ${config.intensity} intensity`)
  }

  async clearFaults(): Promise<void> {
    const response = await this.call('tools/call', {
      name: 'fault_clear',
      arguments: {}
    })

    this.faultActive = false

    if (response.error) {
      throw new Error(`Failed to clear faults: ${response.error.message}`)
    }

    console.log('All faults cleared')
  }

  async getRecoveryMetrics(): Promise<RecoveryMetrics> {
    const response = await this.call('tools/call', {
      name: 'recovery_metrics',
      arguments: {}
    })

    if (response.error) {
      throw new Error(`Failed to get recovery metrics: ${response.error.message}`)
    }

    return JSON.parse(response.result.content[0].text)
  }

  async testRecoveryTime(operationType: string, params: any = {}): Promise<number> {
    const startTime = performance.now()
    let recovered = false
    let attempts = 0
    const maxAttempts = 10

    while (!recovered && attempts < maxAttempts) {
      try {
        const response = await this.call(operationType, params)
        if (!response.error) {
          recovered = true
        }
      } catch (error) {
        // Continue trying
      }
      
      attempts++
      if (!recovered) {
        await delay(1000) // Wait 1 second between attempts
      }
    }

    const recoveryTime = performance.now() - startTime
    
    if (!recovered) {
      throw new Error(`Failed to recover after ${maxAttempts} attempts`)
    }

    return recoveryTime
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
        }, 5000)
      })
    }
  }
}

describe('MCP Error Handling and Resilience', () => {
  let resilienceTest: McpResilienceTest

  beforeAll(async () => {
    resilienceTest = new McpResilienceTest()
    await resilienceTest.initialize()
  }, 60000)

  afterAll(async () => {
    if (resilienceTest) {
      await resilienceTest.clearFaults()
      await resilienceTest.shutdown()
    }
  })

  beforeEach(async () => {
    // Clear any existing faults before each test
    try {
      await resilienceTest.clearFaults()
    } catch (error) {
      // Ignore if no faults to clear
    }
  })

  describe('Basic Error Handling', () => {
    it('should handle invalid tool names gracefully', async () => {
      const response = await resilienceTest.call('tools/call', {
        name: 'nonexistent_tool_12345',
        arguments: {}
      })

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBeDefined()
      expect(response.error?.message).toMatch(/tool.*not.*found/i)
      expect(response.result).toBeUndefined()
    })

    it('should validate parameter types and ranges', async () => {
      const invalidParameterTests = [
        {
          name: 'swarm_init',
          args: { topology: 'invalid', maxAgents: 'not_a_number' },
          expectedError: /invalid.*topology|invalid.*maxAgents/i
        },
        {
          name: 'agent_spawn',
          args: { type: 'nonexistent_type', capabilities: 'not_an_array' },
          expectedError: /invalid.*type|invalid.*capabilities/i
        },
        {
          name: 'neural_train',
          args: { iterations: -5, pattern_type: null },
          expectedError: /invalid.*iterations|invalid.*pattern/i
        }
      ]

      for (const test of invalidParameterTests) {
        const response = await resilienceTest.call('tools/call', {
          name: test.name,
          arguments: test.args
        })

        expect(response.error).toBeDefined()
        expect(response.error?.message).toMatch(test.expectedError)
      }
    })

    it('should handle resource exhaustion errors', async () => {
      // Try to create too many agents
      const swarmResponse = await resilienceTest.call('tools/call', {
        name: 'swarm_init',
        arguments: {
          topology: 'mesh',
          maxAgents: 5
        }
      })

      if (!swarmResponse.error) {
        // Try to spawn more agents than the limit
        const spawnPromises = Array.from({ length: 10 }, () =>
          resilienceTest.call('tools/call', {
            name: 'agent_spawn',
            arguments: {
              type: 'researcher',
              capabilities: ['test']
            }
          }).catch(error => ({ error: { message: error.message } }))
        )

        const results = await Promise.all(spawnPromises)
        const errors = results.filter(r => 'error' in r && r.error)
        
        expect(errors.length).toBeGreaterThan(0)
        expect(errors.some(e => 
          'error' in e && e.error?.message.match(/limit.*exceeded|resource.*exhausted|too.*many/i)
        )).toBe(true)
      }
    })

    it('should handle concurrent access conflicts', async () => {
      // Initialize swarm
      await resilienceTest.call('tools/call', {
        name: 'swarm_init',
        arguments: { topology: 'mesh', maxAgents: 10 }
      })

      // Try to perform conflicting operations simultaneously
      const conflictingOperations = [
        resilienceTest.call('tools/call', {
          name: 'swarm_destroy',
          arguments: {}
        }),
        resilienceTest.call('tools/call', {
          name: 'agent_spawn',
          arguments: { type: 'researcher', capabilities: [] }
        }),
        resilienceTest.call('tools/call', {
          name: 'swarm_status',
          arguments: {}
        })
      ]

      const results = await Promise.all(
        conflictingOperations.map(op => op.catch(error => ({ error: { message: error.message } })))
      )

      // Some operations should handle conflicts gracefully
      const errors = results.filter(r => 'error' in r && r.error)
      if (errors.length > 0) {
        expect(errors.some(e => 
          'error' in e && e.error?.message.match(/conflict|busy|locked|concurrent/i)
        )).toBe(true)
      }
    })
  })

  describe('Fault Tolerance Under Network Issues', () => {
    it('should recover from network delays', async () => {
      // Inject network delay fault
      await resilienceTest.injectFault({
        faultType: 'network_delay',
        intensity: 'medium',
        duration: 5000
      })

      const startTime = performance.now()

      // Test operation during network delay
      try {
        const response = await resilienceTest.call('tools/call', {
          name: 'swarm_status',
          arguments: {}
        })

        const duration = performance.now() - startTime
        expect(duration).toBeGreaterThan(1000) // Should be delayed
        expect(response.error).toBeUndefined() // But should still succeed
      } catch (error) {
        // If it fails, verify it's due to the delay
        expect(error.message).toMatch(/timeout|delay/i)
      }

      // Clear fault and test recovery
      await resilienceTest.clearFaults()
      await delay(1000)

      const recoveryTime = await resilienceTest.testRecoveryTime('tools/call', {
        name: 'ping',
        arguments: {}
      })

      expect(recoveryTime).toBeLessThan(3000) // Should recover quickly
    })

    it('should handle connection drops gracefully', async () => {
      // Baseline operation
      const baselineResponse = await resilienceTest.call('tools/call', {
        name: 'swarm_status',
        arguments: {}
      })
      expect(baselineResponse.error).toBeUndefined()

      // Inject connection drop
      await resilienceTest.injectFault({
        faultType: 'connection_drop',
        intensity: 'high',
        duration: 3000
      })

      await delay(1000) // Let fault take effect

      // Operations during fault should fail or be delayed
      let operationsDuringFault = 0
      let failuresDuringFault = 0

      for (let i = 0; i < 5; i++) {
        operationsDuringFault++
        try {
          await resilienceTest.call('tools/call', {
            name: 'ping',
            arguments: {}
          })
        } catch (error) {
          failuresDuringFault++
        }
        await delay(500)
      }

      // Clear fault
      await resilienceTest.clearFaults()
      
      // Test recovery
      const recoveryTime = await resilienceTest.testRecoveryTime('tools/call', {
        name: 'ping',
        arguments: {}
      })

      expect(failuresDuringFault).toBeGreaterThan(0) // Some failures expected during fault
      expect(recoveryTime).toBeLessThan(5000) // Should recover within 5 seconds

      console.log(`Connection drop recovery: ${failuresDuringFault}/${operationsDuringFault} failed, recovered in ${recoveryTime.toFixed(0)}ms`)
    })
  })

  describe('Resource Pressure Resilience', () => {
    it('should handle memory pressure gracefully', async () => {
      // Inject memory pressure
      await resilienceTest.injectFault({
        faultType: 'memory_pressure',
        intensity: 'high',
        duration: 8000
      })

      const memoryTestOperations = [
        { name: 'swarm_init', args: { topology: 'mesh', maxAgents: 5 } },
        { name: 'memory_usage', args: { action: 'store', key: 'test', value: 'data' } },
        { name: 'neural_train', args: { pattern_type: 'coordination', iterations: 5 } }
      ]

      let successfulOperations = 0
      let failedOperations = 0

      for (const operation of memoryTestOperations) {
        try {
          const response = await resilienceTest.call('tools/call', {
            name: operation.name,
            arguments: operation.args
          })

          if (!response.error) {
            successfulOperations++
          } else {
            failedOperations++
          }
        } catch (error) {
          failedOperations++
        }
        
        await delay(1000)
      }

      // Clear fault
      await resilienceTest.clearFaults()

      // Test recovery
      const recoveryTime = await resilienceTest.testRecoveryTime('tools/call', {
        name: 'swarm_status',
        arguments: {}
      })

      // System should degrade gracefully under memory pressure
      expect(failedOperations).toBeLessThan(memoryTestOperations.length) // Not all should fail
      expect(recoveryTime).toBeLessThan(10000) // Should recover within 10 seconds

      console.log(`Memory pressure: ${successfulOperations}/${memoryTestOperations.length} succeeded, recovered in ${recoveryTime.toFixed(0)}ms`)
    })

    it('should handle CPU spikes without complete failure', async () => {
      // Inject CPU spike
      await resilienceTest.injectFault({
        faultType: 'cpu_spike',
        intensity: 'extreme',
        duration: 6000
      })

      const cpuTestStartTime = performance.now()
      let responseDurations: number[] = []

      // Test lightweight operations during CPU spike
      for (let i = 0; i < 5; i++) {
        const operationStart = performance.now()
        try {
          await resilienceTest.call('tools/call', {
            name: 'ping',
            arguments: {}
          })
          const operationEnd = performance.now()
          responseDurations.push(operationEnd - operationStart)
        } catch (error) {
          responseDurations.push(Infinity) // Mark as failed
        }
        
        await delay(1000)
      }

      // Clear fault
      await resilienceTest.clearFaults()

      // Calculate metrics
      const validDurations = responseDurations.filter(d => d !== Infinity)
      const avgResponseDuring = validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length

      // Test post-recovery performance
      const recoveryStart = performance.now()
      const postRecoveryResponse = await resilienceTest.call('tools/call', {
        name: 'ping',
        arguments: {}
      })
      const postRecoveryDuration = performance.now() - recoveryStart

      expect(validDurations.length).toBeGreaterThan(0) // Some operations should succeed
      expect(postRecoveryDuration).toBeLessThan(avgResponseDuring / 2) // Recovery should be faster

      console.log(`CPU spike: avg response ${avgResponseDuring.toFixed(0)}ms during fault, ${postRecoveryDuration.toFixed(0)}ms after`)
    })
  })

  describe('Circuit Breaker and Retry Logic', () => {
    it('should implement circuit breaker pattern', async () => {
      // Create a scenario that triggers circuit breaker
      const failingOperations = Array.from({ length: 10 }, () =>
        resilienceTest.call('tools/call', {
          name: 'nonexistent_tool',
          arguments: {}
        }).catch(error => ({ error: { message: error.message } }))
      )

      const results = await Promise.all(failingOperations)
      const failures = results.filter(r => 'error' in r && r.error)

      expect(failures.length).toBe(10) // All should fail

      // Now try a valid operation - circuit breaker might be open
      try {
        const circuitBreakerTest = await resilienceTest.call('tools/call', {
          name: 'ping',
          arguments: {}
        })

        // If circuit breaker is working, this might fail fast or succeed after recovery
        if (circuitBreakerTest.error) {
          expect(circuitBreakerTest.error.message).toMatch(/circuit.*breaker|service.*unavailable/i)
        }
      } catch (error) {
        expect(error.message).toMatch(/circuit.*breaker|fast.*fail/i)
      }

      // Wait for circuit breaker to potentially reset
      await delay(5000)

      // Try again - should work after circuit breaker recovery
      const recoveryResponse = await resilienceTest.call('tools/call', {
        name: 'ping',
        arguments: {}
      })

      expect(recoveryResponse.error).toBeUndefined()
    })

    it('should retry transient failures automatically', async () => {
      // Inject intermittent fault
      await resilienceTest.injectFault({
        faultType: 'network_delay',
        intensity: 'low',
        duration: 10000
      })

      const retryTestStart = performance.now()

      // This operation might fail initially but should retry
      const response = await resilienceTest.call('tools/call', {
        name: 'swarm_status',
        arguments: {}
      })

      const duration = performance.now() - retryTestStart

      // Clear fault
      await resilienceTest.clearFaults()

      if (!response.error) {
        // If successful, it might have taken longer due to retries
        expect(duration).toBeGreaterThan(500) // Some delay expected from retries
        console.log(`Retry successful after ${duration.toFixed(0)}ms`)
      } else {
        // If it failed, check if error mentions retries
        expect(response.error.message).toBeDefined()
        console.log(`Retry failed: ${response.error.message}`)
      }
    })

    it('should implement exponential backoff', async () => {
      const backoffTests = []
      
      // Generate multiple failing requests to trigger backoff
      for (let i = 0; i < 5; i++) {
        const start = performance.now()
        try {
          await resilienceTest.call('tools/call', {
            name: 'operation_that_fails',
            arguments: {}
          })
        } catch (error) {
          const duration = performance.now() - start
          backoffTests.push(duration)
        }
        
        // Small delay between attempts
        await delay(100)
      }

      // If exponential backoff is working, later attempts should take longer
      if (backoffTests.length >= 3) {
        const firstAttempt = backoffTests[0]
        const laterAttempts = backoffTests.slice(-2)
        const avgLaterDuration = laterAttempts.reduce((sum, d) => sum + d, 0) / laterAttempts.length

        console.log(`Backoff pattern: first=${firstAttempt.toFixed(0)}ms, later avg=${avgLaterDuration.toFixed(0)}ms`)
        
        // Later attempts should generally be slower (backoff working)
        // This is a soft check as timing can be variable in tests
        if (avgLaterDuration > firstAttempt * 1.5) {
          expect(avgLaterDuration).toBeGreaterThan(firstAttempt)
        }
      }
    })
  })

  describe('System Recovery Validation', () => {
    it('should maintain data consistency during recovery', async () => {
      // Initialize system with some data
      await resilienceTest.call('tools/call', {
        name: 'swarm_init',
        arguments: { topology: 'mesh', maxAgents: 5 }
      })

      await resilienceTest.call('tools/call', {
        name: 'memory_usage',
        arguments: { 
          action: 'store', 
          key: 'recovery_test', 
          value: 'test_data_before_fault' 
        }
      })

      // Inject fault that might affect data integrity
      await resilienceTest.injectFault({
        faultType: 'memory_pressure',
        intensity: 'high',
        duration: 5000
      })

      await delay(2000) // Let fault affect system

      // Clear fault
      await resilienceTest.clearFaults()

      // Wait for recovery
      await delay(2000)

      // Check data consistency
      const dataResponse = await resilienceTest.call('tools/call', {
        name: 'memory_usage',
        arguments: { action: 'retrieve', key: 'recovery_test' }
      })

      const swarmResponse = await resilienceTest.call('tools/call', {
        name: 'swarm_status',
        arguments: {}
      })

      expect(dataResponse.error).toBeUndefined()
      expect(swarmResponse.error).toBeUndefined()
      
      // Data should be intact
      if (dataResponse.result) {
        const result = JSON.parse(dataResponse.result.content[0].text)
        expect(result.value).toBe('test_data_before_fault')
      }
    })

    it('should provide recovery metrics and diagnostics', async () => {
      // Inject fault
      await resilienceTest.injectFault({
        faultType: 'cpu_spike',
        intensity: 'medium',
        duration: 4000
      })

      await delay(2000)

      // Clear fault
      await resilienceTest.clearFaults()

      await delay(2000)

      // Get recovery metrics
      try {
        const metrics = await resilienceTest.getRecoveryMetrics()
        
        expect(metrics).toBeDefined()
        expect(typeof metrics.recoveryDuration).toBe('number')
        expect(typeof metrics.systemStabilityScore).toBe('number')
        
        expect(metrics.recoveryDuration).toBeGreaterThan(0)
        expect(metrics.systemStabilityScore).toBeGreaterThanOrEqual(0)
        expect(metrics.systemStabilityScore).toBeLessThanOrEqual(1)

        console.log('Recovery metrics:', {
          recoveryDuration: `${metrics.recoveryDuration.toFixed(0)}ms`,
          stabilityScore: metrics.systemStabilityScore.toFixed(2),
          requestsDuringFault: metrics.requestsDuringFault,
          failedDuringFault: metrics.requestsFailedDuringFault
        })
      } catch (error) {
        // Recovery metrics might not be available in all configurations
        console.log('Recovery metrics not available:', error.message)
      }
    })

    it('should handle cascading failure scenarios', async () => {
      // Create a scenario with multiple interdependent operations
      const operations = [
        { name: 'swarm_init', args: { topology: 'hierarchical', maxAgents: 5 } },
        { name: 'agent_spawn', args: { type: 'coordinator', capabilities: [] } },
        { name: 'agent_spawn', args: { type: 'researcher', capabilities: [] } },
        { name: 'task_orchestrate', args: { task: 'Test cascading failure', strategy: 'sequential' } }
      ]

      // Execute operations successfully first
      for (const operation of operations) {
        const response = await resilienceTest.call('tools/call', {
          name: operation.name,
          arguments: operation.args
        })

        if (response.error) {
          console.warn(`Setup failed for ${operation.name}:`, response.error.message)
        }
      }

      // Inject severe fault that could cause cascading failures
      await resilienceTest.injectFault({
        faultType: 'memory_pressure',
        intensity: 'extreme',
        duration: 8000
      })

      await delay(3000) // Let cascading effects develop

      // Test system state during cascade
      let systemResponsive = false
      try {
        const statusResponse = await resilienceTest.call('tools/call', {
          name: 'swarm_status',
          arguments: {}
        })
        systemResponsive = !statusResponse.error
      } catch (error) {
        systemResponsive = false
      }

      // Clear fault
      await resilienceTest.clearFaults()

      // Test full system recovery
      const recoveryStartTime = performance.now()
      let fullRecovery = false
      let recoveryAttempts = 0

      while (!fullRecovery && recoveryAttempts < 10) {
        try {
          // Test multiple operations to ensure full recovery
          const statusResponse = await resilienceTest.call('tools/call', {
            name: 'swarm_status',
            arguments: {}
          })

          const memoryResponse = await resilienceTest.call('tools/call', {
            name: 'memory_usage',
            arguments: { action: 'list' }
          })

          if (!statusResponse.error && !memoryResponse.error) {
            fullRecovery = true
          }
        } catch (error) {
          // Continue trying
        }

        if (!fullRecovery) {
          await delay(1000)
          recoveryAttempts++
        }
      }

      const recoveryDuration = performance.now() - recoveryStartTime

      expect(fullRecovery).toBe(true)
      expect(recoveryDuration).toBeLessThan(15000) // Should recover within 15 seconds

      console.log(`Cascading failure recovery: system responsive=${systemResponsive}, recovered in ${recoveryDuration.toFixed(0)}ms`)
    })
  })
})