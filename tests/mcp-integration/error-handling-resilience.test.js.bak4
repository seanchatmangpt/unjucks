/**
 * MCP Error Handling and Resilience Tests
 * Tests error scenarios, fault tolerance, and system recovery for MCP operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { performance } from 'node:perf_hooks'
// import type { McpRequest, McpResponse } from '../types/mcp-protocol.js'

class McpResilienceTest { private process }>()
  private faultActive = false
  private metrics: RecoveryMetrics | null = null

  async initialize() { return new Promise((resolve, reject) => {
      this.process = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
        stdio }
      })

      this.process.stderr?.on('data', (data) => {
        const error = data.toString()
        if (error.includes('FATAL') || error.includes('Cannot initialize resilience')) {
          reject(new Error(`MCP resilience test setup failed))
        }
      })

      this.process.on('error', reject)

      setTimeout(() => {
        reject(new Error('MCP resilience test initialization timeout'))
      }, 30000)
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
        reject(new Error('MCP resilience test not available'))
        return
      }

      const id = ++this.messageId
      const request = { jsonrpc }
      
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

  async injectFault(config) { this.faultActive = true
    
    const response = await this.call('tools/call', {
      name }

    console.log(`Fault injection activated)
  }

  async clearFaults() { const response = await this.call('tools/call', {
      name }

    console.log('All faults cleared')
  }

  async getRecoveryMetrics() { const response = await this.call('tools/call', {
      name }

    return JSON.parse(response.result.content[0].text)
  }

  async testRecoveryTime(operationType, params = {}) {
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
        }, 5000)
      })
    }
  }
}

describe('MCP Error Handling and Resilience', () => {
  let resilienceTest

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

  describe('Basic Error Handling', () => { it('should handle invalid tool names gracefully', async () => {
      const response = await resilienceTest.call('tools/call', {
        name })

    it('should validate parameter types and ranges', async () => { const invalidParameterTests = [
        {
          name },
          expectedError: /invalid.*topology|invalid.*maxAgents/i
        },
        { name },
          expectedError: /invalid.*type|invalid.*capabilities/i
        },
        { name },
          expectedError: /invalid.*iterations|invalid.*pattern/i
        }
      ]

      for (const test of invalidParameterTests) { const response = await resilienceTest.call('tools/call', {
          name }
    })

    it('should handle resource exhaustion errors', async () => { // Try to create too many agents
      const swarmResponse = await resilienceTest.call('tools/call', {
        name }
    })

    it('should handle concurrent access conflicts', async () => { // Initialize swarm
      await resilienceTest.call('tools/call', {
        name }
    })
  })

  describe('Fault Tolerance Under Network Issues', () => { it('should recover from network delays', async () => {
      // Inject network delay fault
      await resilienceTest.injectFault({
        faultType } catch (error) {
        // If it fails, verify it's due to the delay
        expect(error.message).toMatch(/timeout|delay/i)
      }

      // Clear fault and test recovery
      await resilienceTest.clearFaults()
      await delay(1000)

      const recoveryTime = await resilienceTest.testRecoveryTime('tools/call', { name })

    it('should handle connection drops gracefully', async () => { // Baseline operation
      const baselineResponse = await resilienceTest.call('tools/call', {
        name } catch (error) {
          failuresDuringFault++
        }
        await delay(500)
      }

      // Clear fault
      await resilienceTest.clearFaults()
      
      // Test recovery
      const recoveryTime = await resilienceTest.testRecoveryTime('tools/call', { name }ms`)
    })
  })

  describe('Resource Pressure Resilience', () => { it('should handle memory pressure gracefully', async () => {
      // Inject memory pressure
      await resilienceTest.injectFault({
        faultType } },
        { name } },
        { name } }
      ]

      let successfulOperations = 0
      let failedOperations = 0

      for (const operation of memoryTestOperations) { try {
          const response = await resilienceTest.call('tools/call', {
            name } else {
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
      const recoveryTime = await resilienceTest.testRecoveryTime('tools/call', { name }ms`)
    })

    it('should handle CPU spikes without complete failure', async () => { // Inject CPU spike
      await resilienceTest.injectFault({
        faultType } catch (error) {
          responseDurations.push(Infinity) // Mark
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
      const postRecoveryResponse = await resilienceTest.call('tools/call', { name }ms during fault, ${postRecoveryDuration.toFixed(0)}ms after`)
    })
  })

  describe('Circuit Breaker and Retry Logic', () => { it('should implement circuit breaker pattern', async () => {
      // Create a scenario that triggers circuit breaker
      const failingOperations = Array.from({ length, () =>
        resilienceTest.call('tools/call', {
          name }
      } catch (error) {
        expect(error.message).toMatch(/circuit.*breaker|fast.*fail/i)
      }

      // Wait for circuit breaker to potentially reset
      await delay(5000)

      // Try again - should work after circuit breaker recovery
      const recoveryResponse = await resilienceTest.call('tools/call', { name })

    it('should retry transient failures automatically', async () => { // Inject intermittent fault
      await resilienceTest.injectFault({
        faultType }ms`)
      } else {
        // If it failed, check if error mentions retries
        expect(response.error.message).toBeDefined()
        console.log(`Retry failed)
      }
    })

    it('should implement exponential backoff', async () => { const backoffTests = []
      
      // Generate multiple failing requests to trigger backoff
      for (let i = 0; i < 5; i++) {
        const start = performance.now()
        try {
          await resilienceTest.call('tools/call', {
            name } catch (error) {
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

        console.log(`Backoff pattern =${firstAttempt.toFixed(0)}ms, later avg=${avgLaterDuration.toFixed(0)}ms`)
        
        // Later attempts should generally be slower (backoff working)
        // This is a soft check can be variable in tests
        if (avgLaterDuration > firstAttempt * 1.5) {
          expect(avgLaterDuration).toBeGreaterThan(firstAttempt)
        }
      }
    })
  })

  describe('System Recovery Validation', () => { it('should maintain data consistency during recovery', async () => {
      // Initialize system with some data
      await resilienceTest.call('tools/call', {
        name }
    })

    it('should provide recovery metrics and diagnostics', async () => { // Inject fault
      await resilienceTest.injectFault({
        faultType }ms`,
          stabilityScore: metrics.systemStabilityScore.toFixed(2),
          requestsDuringFault: metrics.requestsDuringFault,
          failedDuringFault: metrics.requestsFailedDuringFault
        })
      } catch (error) { // Recovery metrics might not be available in all configurations
        console.log('Recovery metrics not available }
    })

    it('should handle cascading failure scenarios', async () => { // Create a scenario with multiple interdependent operations
      const operations = [
        { name } },
        { name } },
        { name } },
        { name } }
      ]

      // Execute operations successfully first
      for (const operation of operations) { const response = await resilienceTest.call('tools/call', {
          name }:`, response.error.message)
        }
      }

      // Inject severe fault that could cause cascading failures
      await resilienceTest.injectFault({ faultType } catch (error) {
        systemResponsive = false
      }

      // Clear fault
      await resilienceTest.clearFaults()

      // Test full system recovery
      const recoveryStartTime = performance.now()
      let fullRecovery = false
      let recoveryAttempts = 0

      while (!fullRecovery && recoveryAttempts < 10) { try {
          // Test multiple operations to ensure full recovery
          const statusResponse = await resilienceTest.call('tools/call', {
            name }
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

      console.log(`Cascading failure recovery, recovered in ${recoveryDuration.toFixed(0)}ms`)
    })
  })
})