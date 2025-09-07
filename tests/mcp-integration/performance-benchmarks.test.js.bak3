/**
 * MCP Performance Benchmark Tests
 * Tests performance characteristics and benchmarks for MCP operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { performance } from 'node:perf_hooks'
// import type { McpRequest, McpResponse } from '../types/mcp-protocol.js'

latency: { min }
}

class McpPerformanceBenchmarker { private process }>()
  private responseTimes = []

  async initialize() { return new Promise((resolve, reject) => {
      this.process = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
        stdio }
      })

      this.process.stderr?.on('data', (data) => {
        const error = data.toString()
        if (error.includes('FATAL') || error.includes('Cannot start benchmarker')) {
          reject(new Error(`MCP benchmarker failed))
        }
      })

      this.process.on('error', reject)

      setTimeout(() => {
        reject(new Error('MCP benchmarker initialization timeout'))
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

  async benchmarkOperation(
    method, 
    params, 
    iterations = 100,
    concurrency = 1
  ) {
    const startTime = performance.now()
    const responseTimes = []
    let successfulRequests = 0
    let failedRequests = 0

    const initialMemory = process.memoryUsage()

    // Execute benchmark iterations
    if (concurrency === 1) {
      // Sequential execution
      for (let i = 0; i < iterations; i++) {
        try {
          const requestStart = performance.now()
          await this.call(method, params)
          const requestEnd = performance.now()
          
          responseTimes.push(requestEnd - requestStart)
          successfulRequests++
        } catch (error) {
          failedRequests++
        }
      }
    } else {
      // Concurrent execution
      const batches = Math.ceil(iterations / concurrency)
      
      for (let batch = 0; batch < batches; batch++) {
        const batchSize = Math.min(concurrency, iterations - batch * concurrency)
        const batchPromises = []

        for (let i = 0; i < batchSize; i++) {
          const requestStart = performance.now()
          batchPromises.push(
            this.call(method, params)
              .then(() => {
                const requestEnd = performance.now()
                responseTimes.push(requestEnd - requestStart)
                successfulRequests++
              })
              .catch(() => {
                failedRequests++
              })
          )
        }

        await Promise.all(batchPromises)
      }
    }

    const endTime = performance.now()
    const finalMemory = process.memoryUsage()
    const totalDuration = endTime - startTime

    // Calculate statistics
    responseTimes.sort((a, b) => a - b)
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    const throughputPerSecond = (successfulRequests / totalDuration) * 1000
    const errorRate = failedRequests / (successfulRequests + failedRequests)

    const latency = { min }

    const memoryUsage = { rss }

    const metrics = {
      operation,
      duration,
      throughput,
      memoryUsage,
      latency
    }

    return {
      operation,
      totalRequests,
      successfulRequests,
      failedRequests,
      totalDuration,
      avgResponseTime,
      throughputPerSecond,
      errorRate,
      metrics
    }
  }

  private percentile(arr, p) {
    const index = Math.ceil(arr.length * p) - 1
    return arr[index] || 0
  }

  async call(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('MCP benchmarker not available'))
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
          reject(new Error(`MCP benchmark request timeout for method ${method}`))
        }
      }, 10000)
    })
  }

  async getSystemMetrics() { const response = await this.call('tools/call', {
      name }

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

describe('MCP Performance Benchmarks', () => {
  let benchmarker

  beforeAll(async () => {
    benchmarker = new McpPerformanceBenchmarker()
    await benchmarker.initialize()
  }, 60000) // Extended timeout for initialization

  afterAll(async () => {
    if (benchmarker) {
      await benchmarker.shutdown()
    }
  })

  describe('Basic Operation Benchmarks', () => { it('should benchmark swarm initialization performance', async () => {
      const result = await benchmarker.benchmarkOperation(
        'tools/call',
        {
          name }ms`,
        throughput: `${result.throughputPerSecond.toFixed(2)}/sec`,
        errorRate: `${(result.errorRate * 100).toFixed(1)}%`,
        p95Latency: `${result.metrics.latency.p95.toFixed(2)}ms`
      })
    })

    it('should benchmark agent spawning performance', async () => { // Initialize swarm first
      await benchmarker.call('tools/call', {
        name }
        },
        100,
        5 // concurrent spawning
      )

      expect(result.successfulRequests).toBeGreaterThan(80) // 80% success rate
      expect(result.avgResponseTime).toBeLessThan(2000) // Under 2 seconds
      expect(result.throughputPerSecond).toBeGreaterThan(1) // At least 1 agent per second

      console.log('Agent Spawn Benchmark:', {
        avgResponseTime)}ms`,
        throughput: `${result.throughputPerSecond.toFixed(2)}/sec`,
        p95Latency: `${result.metrics.latency.p95.toFixed(2)}ms`
      })
    })

    it('should benchmark task orchestration performance', async () => { const result = await benchmarker.benchmarkOperation(
        'tools/call',
        {
          name }ms`,
        memoryUsage: `${(result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        p99Latency: `${result.metrics.latency.p99.toFixed(2)}ms`
      })
    })

    it('should benchmark swarm status queries', async () => { const result = await benchmarker.benchmarkOperation(
        'tools/call',
        {
          name }ms`,
        throughput: `${result.throughputPerSecond.toFixed(2)}/sec`,
        p50Latency: `${result.metrics.latency.p50.toFixed(2)}ms`
      })
    })
  })

  describe('Memory Management Benchmarks', () => { it('should benchmark memory operations performance', async () => {
      const memoryOperations = [
        { action },
        { action },
        { action },
        { action }
      ]

      const results = []
      
      for (const operation of memoryOperations) { const result = await benchmarker.benchmarkOperation(
          'tools/call',
          {
            name })
      }

      for (const result of results) {
        expect(result.successfulRequests).toBeGreaterThan(45) // 90% success rate
        expect(result.avgResponseTime).toBeLessThan(1000) // Under 1 second
      }

      // Store operation should be fastest
      const storeResult = results.find(r => r.operation === 'store')!
      const listResult = results.find(r => r.operation === 'list')!
      
      expect(storeResult.avgResponseTime).toBeLessThan(listResult.avgResponseTime)

      console.log('Memory Operations Benchmark:', results.map(r => ({ operation }ms`,
        throughput: `${r.throughputPerSecond.toFixed(2)}/sec`
      })))
    })

    it('should benchmark memory usage under load', async () => { const initialMemory = process.memoryUsage()

      // Create many memory entries
      const storeOperations = Array.from({ length, (_, i) => 
        benchmarker.call('tools/call', {
          name }`,
            value)}_${i}` // 100+ char values
          }
        })
      )

      await Promise.all(storeOperations.slice(0, 100)) // Execute first 100
      const midMemory = process.memoryUsage()

      await Promise.all(storeOperations) // Execute all
      const finalMemory = process.memoryUsage()

      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed
      const memoryPerEntry = memoryGrowth / 1000

      expect(memoryPerEntry).toBeLessThan(10 * 1024) // Under 10KB per entry
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024) // Under 50MB total

      console.log('Memory Load Test:', {
        totalMemoryGrowth).toFixed(2)}MB`,
        memoryPerEntry: `${memoryPerEntry.toFixed(0)} bytes`,
        heapUsed: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
      })

      // Cleanup
      await benchmarker.call('tools/call', { name })
  })

  describe('Neural Operations Benchmarks', () => { it('should benchmark neural training performance', async () => {
      const result = await benchmarker.benchmarkOperation(
        'tools/call',
        {
          name }s`,
        memoryUsage: `${(result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        successRate: `${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%`
      })
    })

    it('should benchmark neural pattern recognition', async () => { const result = await benchmarker.benchmarkOperation(
        'tools/call',
        {
          name }ms`,
        throughput: `${result.throughputPerSecond.toFixed(2)}/sec`,
        p95Latency: `${result.metrics.latency.p95.toFixed(2)}ms`
      })
    })
  })

  describe('Scalability Benchmarks', () => { it('should test performance scaling with agent count', async () => {
      const agentCounts = [1, 5, 10, 25, 50]
      const scalabilityResults = []

      for (const agentCount of agentCounts) {
        // Initialize swarm with different agent limits
        await benchmarker.call('tools/call', {
          name }

      // Verify performance doesn't degrade exponentially
      const firstResult = scalabilityResults[0]
      const lastResult = scalabilityResults[scalabilityResults.length - 1]
      
      const responseTimeRatio = lastResult.avgResponseTime / firstResult.avgResponseTime
      const memoryRatio = lastResult.memoryUsage / firstResult.memoryUsage

      expect(responseTimeRatio).toBeLessThan(10) // Response time shouldn't increase 10x
      expect(memoryRatio).toBeLessThan(50) // Memory shouldn't increase 50x

      console.log('Scalability Results:', scalabilityResults.map(r => ({ agents }ms`,
        throughput: `${r.throughputPerSecond.toFixed(2)}/sec`,
        memory: `${(r.memoryUsage / 1024).toFixed(0)}KB`
      })))
    })

    it('should test concurrent request handling capacity', async () => { const concurrencyLevels = [1, 5, 10, 20, 50]
      const concurrencyResults = []

      for (const concurrency of concurrencyLevels) {
        const result = await benchmarker.benchmarkOperation(
          'tools/call',
          {
            name }

      // Verify system handles concurrency gracefully
      for (const result of concurrencyResults) {
        expect(result.successRate).toBeGreaterThan(0.8) // 80% success rate minimum
        expect(result.errorRate).toBeLessThan(0.3) // Less than 30% error rate
      }

      console.log('Concurrency Results:', concurrencyResults.map(r => ({ concurrency }%`,
        avgTime: `${r.avgResponseTime.toFixed(2)}ms`,
        throughput: `${r.throughput.toFixed(2)}/sec`,
        errorRate: `${(r.errorRate * 100).toFixed(1)}%`
      })))
    })
  })

  describe('System Resource Benchmarks', () => { it('should monitor system resource usage during operations', async () => {
      const initialMetrics = await benchmarker.getSystemMetrics()
      
      // Perform intensive operations
      const intensiveOperations = [
        benchmarker.call('tools/call', {
          name }%`,
        memoryIncrease: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
        finalCpu: `${(finalMetrics.cpu_usage || 0).toFixed(1)}%`,
        finalMemory: `${((finalMetrics.memory_usage || 0) / 1024 / 1024).toFixed(2)}MB`
      })
    })

    it('should validate performance SLA compliance', async () => { const slaTests = [
        {
          name },
        { name }
      ]

      const slaResults = []
      
      for (const slaTest of slaTests) { const result = await benchmarker.benchmarkOperation(
          'tools/call',
          {
            name } ,
          slaTest.iterations,
          5
        )

        const slaCompliance = { name }

        slaResults.push(slaCompliance)
        
        expect(slaCompliance.responseTimeSLA).toBe(true)
        expect(slaCompliance.successRateSLA).toBe(true)
        expect(slaCompliance.p95WithinSLA).toBe(true)
      }

      console.log('SLA Compliance Results:', slaResults.map(r => ({ test })
  })
}, 300000) // 5 minute timeout for performance tests