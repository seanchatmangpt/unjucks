/**
 * MCP Performance Benchmark Tests
 * Tests performance characteristics and benchmarks for MCP operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { performance } from 'node:perf_hooks'
import type { McpRequest, McpResponse } from '../types/mcp-protocol'

interface PerformanceMetrics {
  operation: string
  duration: number
  throughput: number
  memoryUsage: {
    rss: number
    heapUsed: number
    heapTotal: number
    external: number
  }
  latency: {
    min: number
    max: number
    avg: number
    p50: number
    p95: number
    p99: number
  }
}

interface BenchmarkResult {
  operation: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  totalDuration: number
  avgResponseTime: number
  throughputPerSecond: number
  errorRate: number
  metrics: PerformanceMetrics
}

class McpPerformanceBenchmarker {
  private process: ChildProcess | null = null
  private messageId = 0
  private pendingRequests = new Map<number, { resolve: Function, reject: Function }>()
  private responseTimes: number[] = []

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          NODE_ENV: 'benchmark',
          ENABLE_METRICS: 'true',
          ENABLE_PERFORMANCE_TRACKING: 'true',
          LOG_LEVEL: 'error' // Reduce logging noise
        }
      })

      let initBuffer = ''
      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        initBuffer += output

        if (output.includes('Performance monitoring enabled') || 
            output.includes('MCP server ready')) {
          this.setupMessageHandling()
          resolve()
        }
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const error = data.toString()
        if (error.includes('FATAL') || error.includes('Cannot start benchmarker')) {
          reject(new Error(`MCP benchmarker failed: ${error}`))
        }
      })

      this.process.on('error', reject)

      setTimeout(() => {
        reject(new Error('MCP benchmarker initialization timeout'))
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

  async benchmarkOperation(
    method: string, 
    params: any, 
    iterations: number = 100,
    concurrency: number = 1
  ): Promise<BenchmarkResult> {
    const startTime = performance.now()
    const responseTimes: number[] = []
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

    const latency = {
      min: responseTimes[0] || 0,
      max: responseTimes[responseTimes.length - 1] || 0,
      avg: avgResponseTime,
      p50: this.percentile(responseTimes, 0.5),
      p95: this.percentile(responseTimes, 0.95),
      p99: this.percentile(responseTimes, 0.99)
    }

    const memoryUsage = {
      rss: finalMemory.rss - initialMemory.rss,
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      external: finalMemory.external - initialMemory.external
    }

    const metrics: PerformanceMetrics = {
      operation: method,
      duration: totalDuration,
      throughput: throughputPerSecond,
      memoryUsage,
      latency
    }

    return {
      operation: method,
      totalRequests: iterations,
      successfulRequests,
      failedRequests,
      totalDuration,
      avgResponseTime,
      throughputPerSecond,
      errorRate,
      metrics
    }
  }

  private percentile(arr: number[], p: number): number {
    const index = Math.ceil(arr.length * p) - 1
    return arr[index] || 0
  }

  async call(method: string, params: any = {}): Promise<McpResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('MCP benchmarker not available'))
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
          reject(new Error(`MCP benchmark request timeout for method ${method}`))
        }
      }, 10000)
    })
  }

  async getSystemMetrics(): Promise<any> {
    const response = await this.call('tools/call', {
      name: 'system_metrics',
      arguments: {}
    })

    if (response.error) {
      throw new Error(`Failed to get system metrics: ${response.error.message}`)
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

describe('MCP Performance Benchmarks', () => {
  let benchmarker: McpPerformanceBenchmarker

  beforeAll(async () => {
    benchmarker = new McpPerformanceBenchmarker()
    await benchmarker.initialize()
  }, 60000) // Extended timeout for initialization

  afterAll(async () => {
    if (benchmarker) {
      await benchmarker.shutdown()
    }
  })

  describe('Basic Operation Benchmarks', () => {
    it('should benchmark swarm initialization performance', async () => {
      const result = await benchmarker.benchmarkOperation(
        'tools/call',
        {
          name: 'swarm_init',
          arguments: {
            topology: 'mesh',
            maxAgents: 5,
            strategy: 'balanced'
          }
        },
        50, // iterations
        1   // sequential
      )

      expect(result.successfulRequests).toBeGreaterThan(40) // 80% success rate
      expect(result.avgResponseTime).toBeLessThan(5000) // Under 5 seconds
      expect(result.errorRate).toBeLessThan(0.2) // Less than 20% error rate
      expect(result.metrics.latency.p95).toBeLessThan(10000) // 95th percentile under 10s

      console.log('Swarm Init Benchmark:', {
        avgResponseTime: `${result.avgResponseTime.toFixed(2)}ms`,
        throughput: `${result.throughputPerSecond.toFixed(2)}/sec`,
        errorRate: `${(result.errorRate * 100).toFixed(1)}%`,
        p95Latency: `${result.metrics.latency.p95.toFixed(2)}ms`
      })
    })

    it('should benchmark agent spawning performance', async () => {
      // Initialize swarm first
      await benchmarker.call('tools/call', {
        name: 'swarm_init',
        arguments: {
          topology: 'mesh',
          maxAgents: 100,
          strategy: 'balanced'
        }
      })

      const result = await benchmarker.benchmarkOperation(
        'tools/call',
        {
          name: 'agent_spawn',
          arguments: {
            type: 'researcher',
            capabilities: ['analysis', 'research']
          }
        },
        100,
        5 // concurrent spawning
      )

      expect(result.successfulRequests).toBeGreaterThan(80) // 80% success rate
      expect(result.avgResponseTime).toBeLessThan(2000) // Under 2 seconds
      expect(result.throughputPerSecond).toBeGreaterThan(1) // At least 1 agent per second

      console.log('Agent Spawn Benchmark:', {
        avgResponseTime: `${result.avgResponseTime.toFixed(2)}ms`,
        throughput: `${result.throughputPerSecond.toFixed(2)}/sec`,
        p95Latency: `${result.metrics.latency.p95.toFixed(2)}ms`
      })
    })

    it('should benchmark task orchestration performance', async () => {
      const result = await benchmarker.benchmarkOperation(
        'tools/call',
        {
          name: 'task_orchestrate',
          arguments: {
            task: 'Analyze performance metrics and generate report',
            maxAgents: 3,
            priority: 'medium',
            strategy: 'parallel'
          }
        },
        30,
        2
      )

      expect(result.successfulRequests).toBeGreaterThan(25) // 83% success rate
      expect(result.avgResponseTime).toBeLessThan(8000) // Under 8 seconds
      expect(result.metrics.memoryUsage.heapUsed).toBeLessThan(100 * 1024 * 1024) // Under 100MB

      console.log('Task Orchestration Benchmark:', {
        avgResponseTime: `${result.avgResponseTime.toFixed(2)}ms`,
        memoryUsage: `${(result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        p99Latency: `${result.metrics.latency.p99.toFixed(2)}ms`
      })
    })

    it('should benchmark swarm status queries', async () => {
      const result = await benchmarker.benchmarkOperation(
        'tools/call',
        {
          name: 'swarm_status',
          arguments: {}
        },
        200,
        10 // high concurrency for status queries
      )

      expect(result.successfulRequests).toBeGreaterThan(190) // 95% success rate
      expect(result.avgResponseTime).toBeLessThan(500) // Under 500ms for status queries
      expect(result.throughputPerSecond).toBeGreaterThan(10) // High throughput for status

      console.log('Swarm Status Benchmark:', {
        avgResponseTime: `${result.avgResponseTime.toFixed(2)}ms`,
        throughput: `${result.throughputPerSecond.toFixed(2)}/sec`,
        p50Latency: `${result.metrics.latency.p50.toFixed(2)}ms`
      })
    })
  })

  describe('Memory Management Benchmarks', () => {
    it('should benchmark memory operations performance', async () => {
      const memoryOperations = [
        { action: 'store', key: 'test_key', value: 'test_value' },
        { action: 'retrieve', key: 'test_key' },
        { action: 'list' },
        { action: 'delete', key: 'test_key' }
      ]

      const results = []
      
      for (const operation of memoryOperations) {
        const result = await benchmarker.benchmarkOperation(
          'tools/call',
          {
            name: 'memory_usage',
            arguments: operation
          },
          50,
          5
        )
        
        results.push({
          operation: operation.action,
          ...result
        })
      }

      for (const result of results) {
        expect(result.successfulRequests).toBeGreaterThan(45) // 90% success rate
        expect(result.avgResponseTime).toBeLessThan(1000) // Under 1 second
      }

      // Store operation should be fastest
      const storeResult = results.find(r => r.operation === 'store')!
      const listResult = results.find(r => r.operation === 'list')!
      
      expect(storeResult.avgResponseTime).toBeLessThan(listResult.avgResponseTime)

      console.log('Memory Operations Benchmark:', results.map(r => ({
        operation: r.operation,
        avgTime: `${r.avgResponseTime.toFixed(2)}ms`,
        throughput: `${r.throughputPerSecond.toFixed(2)}/sec`
      })))
    })

    it('should benchmark memory usage under load', async () => {
      const initialMemory = process.memoryUsage()

      // Create many memory entries
      const storeOperations = Array.from({ length: 1000 }, (_, i) => 
        benchmarker.call('tools/call', {
          name: 'memory_usage',
          arguments: {
            action: 'store',
            key: `load_test_${i}`,
            value: `data_${'x'.repeat(100)}_${i}` // 100+ char values
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
        totalMemoryGrowth: `${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`,
        memoryPerEntry: `${memoryPerEntry.toFixed(0)} bytes`,
        heapUsed: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
      })

      // Cleanup
      await benchmarker.call('tools/call', {
        name: 'memory_usage',
        arguments: { action: 'clear_all' }
      })
    })
  })

  describe('Neural Operations Benchmarks', () => {
    it('should benchmark neural training performance', async () => {
      const result = await benchmarker.benchmarkOperation(
        'tools/call',
        {
          name: 'neural_train',
          arguments: {
            pattern_type: 'coordination',
            training_data: 'sample_coordination_patterns',
            iterations: 10
          }
        },
        10, // fewer iterations for training
        1   // sequential only
      )

      expect(result.successfulRequests).toBeGreaterThan(7) // 70% success rate
      expect(result.avgResponseTime).toBeLessThan(15000) // Under 15 seconds
      expect(result.metrics.memoryUsage.heapUsed).toBeLessThan(200 * 1024 * 1024) // Under 200MB

      console.log('Neural Training Benchmark:', {
        avgResponseTime: `${(result.avgResponseTime / 1000).toFixed(2)}s`,
        memoryUsage: `${(result.metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        successRate: `${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%`
      })
    })

    it('should benchmark neural pattern recognition', async () => {
      const result = await benchmarker.benchmarkOperation(
        'tools/call',
        {
          name: 'neural_patterns',
          arguments: {
            pattern: 'convergent',
            analyze: true
          }
        },
        50,
        3
      )

      expect(result.successfulRequests).toBeGreaterThan(40) // 80% success rate
      expect(result.avgResponseTime).toBeLessThan(3000) // Under 3 seconds
      expect(result.throughputPerSecond).toBeGreaterThan(0.5) // Reasonable throughput

      console.log('Neural Patterns Benchmark:', {
        avgResponseTime: `${result.avgResponseTime.toFixed(2)}ms`,
        throughput: `${result.throughputPerSecond.toFixed(2)}/sec`,
        p95Latency: `${result.metrics.latency.p95.toFixed(2)}ms`
      })
    })
  })

  describe('Scalability Benchmarks', () => {
    it('should test performance scaling with agent count', async () => {
      const agentCounts = [1, 5, 10, 25, 50]
      const scalabilityResults = []

      for (const agentCount of agentCounts) {
        // Initialize swarm with different agent limits
        await benchmarker.call('tools/call', {
          name: 'swarm_init',
          arguments: {
            topology: 'mesh',
            maxAgents: agentCount,
            strategy: 'balanced'
          }
        })

        // Benchmark status queries with different swarm sizes
        const result = await benchmarker.benchmarkOperation(
          'tools/call',
          {
            name: 'swarm_status',
            arguments: {}
          },
          20,
          5
        )

        scalabilityResults.push({
          agentCount,
          avgResponseTime: result.avgResponseTime,
          throughput: result.throughputPerSecond,
          memoryUsage: result.metrics.memoryUsage.heapUsed
        })

        await delay(1000) // Brief pause between tests
      }

      // Verify performance doesn't degrade exponentially
      const firstResult = scalabilityResults[0]
      const lastResult = scalabilityResults[scalabilityResults.length - 1]
      
      const responseTimeRatio = lastResult.avgResponseTime / firstResult.avgResponseTime
      const memoryRatio = lastResult.memoryUsage / firstResult.memoryUsage

      expect(responseTimeRatio).toBeLessThan(10) // Response time shouldn't increase 10x
      expect(memoryRatio).toBeLessThan(50) // Memory shouldn't increase 50x

      console.log('Scalability Results:', scalabilityResults.map(r => ({
        agents: r.agentCount,
        avgTime: `${r.avgResponseTime.toFixed(2)}ms`,
        throughput: `${r.throughputPerSecond.toFixed(2)}/sec`,
        memory: `${(r.memoryUsage / 1024).toFixed(0)}KB`
      })))
    })

    it('should test concurrent request handling capacity', async () => {
      const concurrencyLevels = [1, 5, 10, 20, 50]
      const concurrencyResults = []

      for (const concurrency of concurrencyLevels) {
        const result = await benchmarker.benchmarkOperation(
          'tools/call',
          {
            name: 'swarm_status',
            arguments: {}
          },
          100,
          concurrency
        )

        concurrencyResults.push({
          concurrency,
          successRate: result.successfulRequests / result.totalRequests,
          avgResponseTime: result.avgResponseTime,
          throughput: result.throughputPerSecond,
          errorRate: result.errorRate
        })

        await delay(2000) // Pause between concurrency tests
      }

      // Verify system handles concurrency gracefully
      for (const result of concurrencyResults) {
        expect(result.successRate).toBeGreaterThan(0.8) // 80% success rate minimum
        expect(result.errorRate).toBeLessThan(0.3) // Less than 30% error rate
      }

      console.log('Concurrency Results:', concurrencyResults.map(r => ({
        concurrency: r.concurrency,
        successRate: `${(r.successRate * 100).toFixed(1)}%`,
        avgTime: `${r.avgResponseTime.toFixed(2)}ms`,
        throughput: `${r.throughput.toFixed(2)}/sec`,
        errorRate: `${(r.errorRate * 100).toFixed(1)}%`
      })))
    })
  })

  describe('System Resource Benchmarks', () => {
    it('should monitor system resource usage during operations', async () => {
      const initialMetrics = await benchmarker.getSystemMetrics()
      
      // Perform intensive operations
      const intensiveOperations = [
        benchmarker.call('tools/call', {
          name: 'swarm_init',
          arguments: { topology: 'mesh', maxAgents: 20 }
        }),
        benchmarker.call('tools/call', {
          name: 'neural_train',
          arguments: { pattern_type: 'optimization', iterations: 20 }
        }),
        benchmarker.call('tools/call', {
          name: 'task_orchestrate',
          arguments: { task: 'Complex analysis task', maxAgents: 5 }
        })
      ]

      await Promise.all(intensiveOperations)
      
      const finalMetrics = await benchmarker.getSystemMetrics()
      
      // Verify resource usage stays within reasonable bounds
      const cpuIncrease = (finalMetrics.cpu_usage || 0) - (initialMetrics.cpu_usage || 0)
      const memoryIncrease = (finalMetrics.memory_usage || 0) - (initialMetrics.memory_usage || 0)
      
      expect(cpuIncrease).toBeLessThan(80) // CPU usage increase under 80%
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024) // Memory increase under 500MB

      console.log('Resource Usage During Operations:', {
        cpuIncrease: `${cpuIncrease.toFixed(1)}%`,
        memoryIncrease: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
        finalCpu: `${(finalMetrics.cpu_usage || 0).toFixed(1)}%`,
        finalMemory: `${((finalMetrics.memory_usage || 0) / 1024 / 1024).toFixed(2)}MB`
      })
    })

    it('should validate performance SLA compliance', async () => {
      const slaTests = [
        {
          name: 'Status Query SLA',
          operation: 'swarm_status',
          slaResponseTime: 1000, // 1 second SLA
          slaSuccessRate: 0.99,   // 99% success rate SLA
          iterations: 100
        },
        {
          name: 'Agent Spawn SLA',
          operation: 'agent_spawn',
          slaResponseTime: 3000, // 3 second SLA
          slaSuccessRate: 0.95,  // 95% success rate SLA
          iterations: 50
        }
      ]

      const slaResults = []
      
      for (const slaTest of slaTests) {
        const result = await benchmarker.benchmarkOperation(
          'tools/call',
          {
            name: slaTest.operation,
            arguments: slaTest.operation === 'agent_spawn' ? 
              { type: 'researcher', capabilities: [] } : {}
          },
          slaTest.iterations,
          5
        )

        const slaCompliance = {
          name: slaTest.name,
          responseTimeSLA: result.avgResponseTime <= slaTest.slaResponseTime,
          successRateSLA: (result.successfulRequests / result.totalRequests) >= slaTest.slaSuccessRate,
          actualResponseTime: result.avgResponseTime,
          actualSuccessRate: result.successfulRequests / result.totalRequests,
          p95WithinSLA: result.metrics.latency.p95 <= (slaTest.slaResponseTime * 2)
        }

        slaResults.push(slaCompliance)
        
        expect(slaCompliance.responseTimeSLA).toBe(true)
        expect(slaCompliance.successRateSLA).toBe(true)
        expect(slaCompliance.p95WithinSLA).toBe(true)
      }

      console.log('SLA Compliance Results:', slaResults.map(r => ({
        test: r.name,
        responseTime: r.responseTimeSLA ? '✅ PASS' : '❌ FAIL',
        successRate: r.successRateSLA ? '✅ PASS' : '❌ FAIL',
        p95: r.p95WithinSLA ? '✅ PASS' : '❌ FAIL'
      })))
    })
  })
}, 300000) // 5 minute timeout for performance tests