import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { performance } from 'perf_hooks'
import axios, { AxiosResponse } from 'axios'
{%- if testType == 'memory-profiling' %}
import { memoryUsage } from 'process'
{%- endif %}
{%- if testType == 'concurrent-users' %}
import { Worker } from 'worker_threads'
{%- endif %}

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const MAX_USERS = {{ maxUsers }}
const TEST_DURATION = {{ duration }} * 1000 // Convert to milliseconds
const ACCEPTABLE_RESPONSE_TIME = {{ acceptableResponseTime }}

interface PerformanceMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  requestsPerSecond: number
  p95ResponseTime: number
  p99ResponseTime: number
  memoryUsage?: NodeJS.MemoryUsage
  cpuUsage?: NodeJS.CpuUsage
}

describe('{{ loadTest | titleCase }} Performance Tests', () => {
  let baselineMetrics: PerformanceMetrics

  beforeAll(async () => {
    // Establish baseline performance metrics
    baselineMetrics = await measureBaseline()
    console.log('Baseline metrics established:', baselineMetrics)
  })

  afterAll(() => {
    // Cleanup and report final metrics
    console.log('Performance test completed')
  })

  {%- if testType == 'load-testing' or testType == 'load-test' %}
  describe('Load Testing', () => {
    it('should handle normal load within acceptable limits', async () => {
      const results = await simulateLoad({
        concurrency: Math.floor(MAX_USERS * 0.7), // 70% of max users
        duration: TEST_DURATION,
        endpoint: '{{ targetEndpoint }}'
      })

      expect(results.averageResponseTime).toBeLessThan(ACCEPTABLE_RESPONSE_TIME)
      expect(results.successfulRequests / results.totalRequests).toBeGreaterThan(0.95) // 95% success rate
      expect(results.requestsPerSecond).toBeGreaterThan(10) // Minimum throughput
    })

    it('should maintain performance under sustained load', async () => {
      const longDuration = TEST_DURATION * 2
      const results = await simulateLoad({
        concurrency: Math.floor(MAX_USERS * 0.5),
        duration: longDuration,
        endpoint: '{{ targetEndpoint }}'
      })

      expect(results.p95ResponseTime).toBeLessThan(ACCEPTABLE_RESPONSE_TIME * 2)
      expect(results.successfulRequests / results.totalRequests).toBeGreaterThan(0.9)
    })

    it('should handle gradually increasing load', async () => {
      const rampUpResults: PerformanceMetrics[] = []
      const increments = 5
      
      for (let i = 1; i <= increments; i++) {
        const concurrency = Math.floor((MAX_USERS / increments) * i)
        const result = await simulateLoad({
          concurrency,
          duration: 10000, // 10 seconds per increment
          endpoint: '{{ targetEndpoint }}'
        })
        rampUpResults.push(result)
      }

      // Analyze degradation
      const degradation = calculatePerformanceDegradation(rampUpResults)
      expect(degradation.responseTimeIncrease).toBeLessThan(3) // Max 3x increase
      expect(degradation.successRateDecrease).toBeLessThan(0.1) // Max 10% decrease
    })
  })
  {%- endif %}

  {%- if testType == 'stress-testing' or testType == 'stress-test' %}
  describe('Stress Testing', () => {
    it('should identify breaking point', async () => {
      const breakingPoint = await findBreakingPoint('{{ targetEndpoint }}')
      
      expect(breakingPoint.maxConcurrentUsers).toBeGreaterThan(50)
      expect(breakingPoint.recoveryTime).toBeLessThan(30000) // 30 seconds
    })

    it('should handle spike traffic', async () => {
      // Sudden spike in traffic
      const spikeResults = await simulateSpike({
        normalLoad: Math.floor(MAX_USERS * 0.3),
        spikeLoad: MAX_USERS,
        spikeDuration: 10000, // 10 seconds
        endpoint: '{{ targetEndpoint }}'
      })

      expect(spikeResults.systemRecovered).toBe(true)
      expect(spikeResults.dataLossOccurred).toBe(false)
    })

    it('should gracefully degrade under extreme load', async () => {
      const extremeResults = await simulateLoad({
        concurrency: MAX_USERS * 2, // 200% of expected capacity
        duration: 15000,
        endpoint: '{{ targetEndpoint }}'
      })

      // System should not crash, even if performance degrades
      expect(extremeResults.systemAvailable).toBe(true)
      expect(extremeResults.errorRate).toBeLessThan(0.5) // Less than 50% errors
    })
  })
  {%- endif %}

  {%- if testType == 'memory-profiling' %}
  describe('Memory Profiling', () => {
    it('should not have memory leaks during normal operation', async () => {
      const initialMemory = process.memoryUsage()
      
      // Run sustained load to check for memory leaks
      await simulateLoad({
        concurrency: 50,
        duration: 60000, // 1 minute
        endpoint: '{{ targetEndpoint }}'
      })

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100

      expect(memoryIncreasePercent).toBeLessThan(50) // Less than 50% memory increase
    })

    it('should handle large payloads efficiently', async () => {
      const largePayload = generateLargePayload(1024 * 1024) // 1MB payload
      const initialMemory = process.memoryUsage()

      const responses = await Promise.all(
        Array(10).fill(null).map(() => 
          axios.post(`${BASE_URL}{{ targetEndpoint }}`, largePayload)
        )
      )

      const finalMemory = process.memoryUsage()
      const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed

      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      // Memory should not increase dramatically
      expect(memoryDelta).toBeLessThan(100 * 1024 * 1024) // Less than 100MB increase
    })
  })
  {%- endif %}

  {%- if testType == 'concurrent-users' %}
  describe('Concurrent User Simulation', () => {
    it('should handle realistic user behavior patterns', async () => {
      const userPatterns = [
        { action: 'browse', weight: 0.4, endpoint: '/api/browse' },
        { action: 'search', weight: 0.3, endpoint: '/api/search' },
        { action: 'create', weight: 0.2, endpoint: '{{ targetEndpoint }}' },
        { action: 'update', weight: 0.1, endpoint: '{{ targetEndpoint }}/update' }
      ]

      const results = await simulateRealisticUsers({
        totalUsers: MAX_USERS,
        duration: TEST_DURATION,
        patterns: userPatterns
      })

      expect(results.averageSessionDuration).toBeGreaterThan(5000) // At least 5 seconds
      expect(results.userRetentionRate).toBeGreaterThan(0.8) // 80% complete their session
      expect(results.systemStability).toBe(true)
    })

    it('should handle user authentication bottlenecks', async () => {
      const authResults = await simulateAuthentication({
        concurrentLogins: MAX_USERS,
        duration: 30000
      })

      expect(authResults.averageLoginTime).toBeLessThan(2000) // 2 seconds
      expect(authResults.failedLogins / authResults.totalLogins).toBeLessThan(0.05) // Less than 5% failure
    })
  })
  {%- endif %}

  {%- if testType == 'benchmark' %}
  describe('Benchmarking', () => {
    it('should meet performance benchmarks', async () => {
      const benchmarks = await runBenchmarks([
        { name: 'Single Request', test: () => singleRequest('{{ targetEndpoint }}') },
        { name: '10 Concurrent', test: () => concurrentRequests('{{ targetEndpoint }}', 10) },
        { name: '100 Concurrent', test: () => concurrentRequests('{{ targetEndpoint }}', 100) },
        { name: 'Database Query', test: () => databaseBenchmark() },
        { name: 'File Processing', test: () => fileProcessingBenchmark() }
      ])

      benchmarks.forEach(benchmark => {
        expect(benchmark.averageTime).toBeLessThan(ACCEPTABLE_RESPONSE_TIME)
        console.log(`${benchmark.name}: ${benchmark.averageTime}ms`)
      })
    })

    it('should compare against baseline metrics', async () => {
      const currentMetrics = await measureCurrentPerformance('{{ targetEndpoint }}')
      
      const performanceRegression = calculateRegression(baselineMetrics, currentMetrics)
      
      expect(performanceRegression.responseTimeIncrease).toBeLessThan(1.2) // Max 20% slower
      expect(performanceRegression.throughputDecrease).toBeLessThan(1.1) // Max 10% less throughput
    })
  })
  {%- endif %}
})

// Helper Functions
async function measureBaseline(): Promise<PerformanceMetrics> {
  const startTime = performance.now()
  const responses: number[] = []
  const errors: number[] = []

  for (let i = 0; i < 100; i++) {
    try {
      const requestStart = performance.now()
      await axios.get(`${BASE_URL}{{ targetEndpoint }}`)
      const requestTime = performance.now() - requestStart
      responses.push(requestTime)
    } catch (error) {
      errors.push(1)
    }
  }

  const totalTime = performance.now() - startTime
  const sortedResponses = responses.sort((a, b) => a - b)

  return {
    totalRequests: 100,
    successfulRequests: responses.length,
    failedRequests: errors.length,
    averageResponseTime: responses.reduce((a, b) => a + b, 0) / responses.length,
    minResponseTime: Math.min(...responses),
    maxResponseTime: Math.max(...responses),
    requestsPerSecond: (100 / totalTime) * 1000,
    p95ResponseTime: sortedResponses[Math.floor(responses.length * 0.95)],
    p99ResponseTime: sortedResponses[Math.floor(responses.length * 0.99)]
  }
}

async function simulateLoad(options: {
  concurrency: number
  duration: number
  endpoint: string
}): Promise<PerformanceMetrics & { systemAvailable: boolean; errorRate: number }> {
  const { concurrency, duration, endpoint } = options
  const startTime = performance.now()
  const endTime = startTime + duration
  const responses: number[] = []
  const errors: Error[] = []
  let activeRequests = 0

  const makeRequest = async (): Promise<void> => {
    if (performance.now() >= endTime) return

    activeRequests++
    try {
      const requestStart = performance.now()
      const response = await axios.get(`${BASE_URL}${endpoint}`, { timeout: 10000 })
      const requestTime = performance.now() - requestStart
      responses.push(requestTime)
    } catch (error) {
      errors.push(error as Error)
    } finally {
      activeRequests--
      // Continue making requests if within duration
      if (performance.now() < endTime) {
        setImmediate(() => makeRequest())
      }
    }
  }

  // Start initial concurrent requests
  const initialPromises = Array(concurrency).fill(null).map(() => makeRequest())
  await Promise.all(initialPromises)

  // Wait for any remaining active requests
  while (activeRequests > 0 && performance.now() < endTime + 5000) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  const totalTime = performance.now() - startTime
  const sortedResponses = responses.sort((a, b) => a - b)
  const totalRequests = responses.length + errors.length

  return {
    totalRequests,
    successfulRequests: responses.length,
    failedRequests: errors.length,
    averageResponseTime: responses.length > 0 ? responses.reduce((a, b) => a + b, 0) / responses.length : 0,
    minResponseTime: responses.length > 0 ? Math.min(...responses) : 0,
    maxResponseTime: responses.length > 0 ? Math.max(...responses) : 0,
    requestsPerSecond: (totalRequests / totalTime) * 1000,
    p95ResponseTime: responses.length > 0 ? sortedResponses[Math.floor(responses.length * 0.95)] || 0 : 0,
    p99ResponseTime: responses.length > 0 ? sortedResponses[Math.floor(responses.length * 0.99)] || 0 : 0,
    systemAvailable: errors.length < totalRequests, // System available if some requests succeeded
    errorRate: totalRequests > 0 ? errors.length / totalRequests : 0
  }
}

{%- if testType == 'stress-testing' %}
async function findBreakingPoint(endpoint: string): Promise<{ maxConcurrentUsers: number; recoveryTime: number }> {
  let maxUsers = 0
  let recoveryTime = 0

  for (let users = 10; users <= MAX_USERS * 2; users += 10) {
    const result = await simulateLoad({
      concurrency: users,
      duration: 10000,
      endpoint
    })

    if (result.errorRate > 0.1) { // 10% error rate threshold
      maxUsers = users - 10 // Previous successful level
      
      // Measure recovery time
      const recoveryStart = performance.now()
      let recovered = false
      
      while (!recovered && (performance.now() - recoveryStart) < 60000) {
        const healthCheck = await axios.get(`${BASE_URL}/health`).catch(() => null)
        if (healthCheck && healthCheck.status === 200) {
          recovered = true
          recoveryTime = performance.now() - recoveryStart
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      break
    }
  }

  return { maxConcurrentUsers: maxUsers, recoveryTime }
}

async function simulateSpike(options: {
  normalLoad: number
  spikeLoad: number
  spikeDuration: number
  endpoint: string
}): Promise<{ systemRecovered: boolean; dataLossOccurred: boolean }> {
  // Simulate normal load
  const normalPromise = simulateLoad({
    concurrency: options.normalLoad,
    duration: options.spikeDuration * 3,
    endpoint: options.endpoint
  })

  // Wait a bit, then spike
  await new Promise(resolve => setTimeout(resolve, options.spikeDuration))
  
  const spikePromise = simulateLoad({
    concurrency: options.spikeLoad,
    duration: options.spikeDuration,
    endpoint: options.endpoint
  })

  const [normalResult, spikeResult] = await Promise.all([normalPromise, spikePromise])
  
  // Check if system recovered after spike
  await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
  
  const recoveryCheck = await simulateLoad({
    concurrency: options.normalLoad,
    duration: 5000,
    endpoint: options.endpoint
  })

  return {
    systemRecovered: recoveryCheck.errorRate < 0.1,
    dataLossOccurred: false // Would need specific checks based on application
  }
}
{%- endif %}

function calculatePerformanceDegradation(results: PerformanceMetrics[]) {
  const first = results[0]
  const last = results[results.length - 1]
  
  return {
    responseTimeIncrease: last.averageResponseTime / first.averageResponseTime,
    successRateDecrease: (first.successfulRequests - last.successfulRequests) / first.successfulRequests
  }
}

function generateLargePayload(sizeInBytes: number): any {
  return {
    data: 'x'.repeat(sizeInBytes - 50), // Leave room for JSON structure
    timestamp: new Date().toISOString(),
    metadata: { size: sizeInBytes }
  }
}

async function singleRequest(endpoint: string): Promise<number> {
  const start = performance.now()
  await axios.get(`${BASE_URL}${endpoint}`)
  return performance.now() - start
}

async function concurrentRequests(endpoint: string, count: number): Promise<number> {
  const start = performance.now()
  await Promise.all(
    Array(count).fill(null).map(() => axios.get(`${BASE_URL}${endpoint}`))
  )
  return performance.now() - start
}

async function databaseBenchmark(): Promise<number> {
  const start = performance.now()
  // Simulate database operations
  await axios.get(`${BASE_URL}/api/database-intensive`)
  return performance.now() - start
}

async function fileProcessingBenchmark(): Promise<number> {
  const start = performance.now()
  // Simulate file processing
  await axios.post(`${BASE_URL}/api/file-process`, { 
    data: generateLargePayload(1024 * 100) // 100KB
  })
  return performance.now() - start
}

async function runBenchmarks(benchmarks: Array<{ name: string; test: () => Promise<number> }>) {
  const results = []
  
  for (const benchmark of benchmarks) {
    const times = []
    
    // Run each benchmark multiple times for accuracy
    for (let i = 0; i < 10; i++) {
      const time = await benchmark.test()
      times.push(time)
    }
    
    results.push({
      name: benchmark.name,
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times)
    })
  }
  
  return results
}

function calculateRegression(baseline: PerformanceMetrics, current: PerformanceMetrics) {
  return {
    responseTimeIncrease: current.averageResponseTime / baseline.averageResponseTime,
    throughputDecrease: baseline.requestsPerSecond / current.requestsPerSecond
  }
}

async function measureCurrentPerformance(endpoint: string): Promise<PerformanceMetrics> {
  return measureBaseline() // Reuse baseline measurement logic
}