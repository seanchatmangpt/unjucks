/**
 * Global setup for MCP Swarm testing
 * Configures test environment, mocks, and utilities
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { performance } from 'perf_hooks'
import { EventEmitter } from 'events'

// Global test configuration
interface SwarmTestGlobals {
  testStartTime: number
  mcpServerPort: number
  websocketPort: number
  testTenantId: string
  testSessionId: string
  performanceMetrics: Map<string, number[]>
  eventEmitter: EventEmitter
  cleanupTasks: Array<() => Promise<void>>
}

declare global {
  var __SWARM_TEST_GLOBALS__: SwarmTestGlobals
}

// Initialize global test state
global.__SWARM_TEST_GLOBALS__ = {
  testStartTime: Date.now(),
  mcpServerPort: 3001,
  websocketPort: 3002,
  testTenantId: 'test-tenant-' + Date.now(),
  testSessionId: 'test-session-' + Math.random().toString(36).substr(2, 9),
  performanceMetrics: new Map(),
  eventEmitter: new EventEmitter(),
  cleanupTasks: []
}

// Performance tracking utilities
export function startPerformanceTimer(operation: string): () => number {
  const startTime = performance.now()
  return () => {
    const duration = performance.now() - startTime
    const metrics = global.__SWARM_TEST_GLOBALS__.performanceMetrics
    
    if (!metrics.has(operation)) {
      metrics.set(operation, [])
    }
    metrics.get(operation)!.push(duration)
    
    return duration
  }
}

export function getPerformanceMetrics(operation: string) {
  const metrics = global.__SWARM_TEST_GLOBALS__.performanceMetrics.get(operation) || []
  if (metrics.length === 0) {
    return { min: 0, max: 0, avg: 0, count: 0 }
  }
  
  return {
    min: Math.min(...metrics),
    max: Math.max(...metrics),
    avg: metrics.reduce((a, b) => a + b, 0) / metrics.length,
    count: metrics.length
  }
}

// Test utilities
export function generateTestUserId(): string {
  return 'test-user-' + Math.random().toString(36).substr(2, 9)
}

export function generateTestSwarmId(): string {
  return 'test-swarm-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now()
}

export function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now()
    
    const checkCondition = async () => {
      try {
        const result = await condition()
        if (result) {
          resolve(true)
          return
        }
      } catch (error) {
        // Continue checking on errors
      }
      
      if (Date.now() - startTime >= timeout) {
        resolve(false)
        return
      }
      
      setTimeout(checkCondition, interval)
    }
    
    checkCondition()
  })
}

export function createMockWebSocket() {
  const events = new Map<string, Function[]>()
  
  return {
    readyState: 1, // WebSocket.OPEN
    send: vi.fn(),
    close: vi.fn(),
    on: (event: string, handler: Function) => {
      if (!events.has(event)) {
        events.set(event, [])
      }
      events.get(event)!.push(handler)
    },
    emit: (event: string, ...args: any[]) => {
      const handlers = events.get(event) || []
      handlers.forEach(handler => handler(...args))
    },
    // Helper to trigger events in tests
    _trigger: (event: string, ...args: any[]) => {
      const handlers = events.get(event) || []
      handlers.forEach(handler => handler(...args))
    }
  }
}

export function addCleanupTask(task: () => Promise<void>) {
  global.__SWARM_TEST_GLOBALS__.cleanupTasks.push(task)
}

// Mock implementations for testing
export const mockMCPResponse = {
  success: (data: any) => ({
    isError: false,
    content: [{ type: 'text' as const, text: JSON.stringify({ success: true, ...data }) }]
  }),
  
  error: (message: string, code: number = -32000) => ({
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify({ error: { code, message } }) }]
  })
}

// Environment variable setup
process.env.NODE_ENV = 'test'
process.env.MCP_SERVER_URL = `ws://localhost:${global.__SWARM_TEST_GLOBALS__.mcpServerPort}`
process.env.MCP_API_KEY = 'test-api-key'
process.env.WEBSOCKET_PORT = global.__SWARM_TEST_GLOBALS__.websocketPort.toString()
process.env.TEST_TENANT_ID = global.__SWARM_TEST_GLOBALS__.testTenantId
process.env.JWT_SECRET = 'test-jwt-secret'

// Global setup
beforeAll(async () => {
  console.log('🧪 Setting up MCP Swarm test environment...')
  
  // Increase event listener limit for testing
  global.__SWARM_TEST_GLOBALS__.eventEmitter.setMaxListeners(100)
  
  // Setup test database or mock services if needed
  console.log(`📡 MCP Server Port: ${global.__SWARM_TEST_GLOBALS__.mcpServerPort}`)
  console.log(`🔌 WebSocket Port: ${global.__SWARM_TEST_GLOBALS__.websocketPort}`)
  console.log(`🏢 Test Tenant: ${global.__SWARM_TEST_GLOBALS__.testTenantId}`)
})

beforeEach(async () => {
  // Reset metrics for each test
  global.__SWARM_TEST_GLOBALS__.performanceMetrics.clear()
  
  // Generate new session ID for each test to avoid conflicts
  global.__SWARM_TEST_GLOBALS__.testSessionId = 
    'test-session-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now()
})

afterEach(async () => {
  // Run cleanup tasks
  const cleanupTasks = global.__SWARM_TEST_GLOBALS__.cleanupTasks.splice(0)
  
  for (const task of cleanupTasks) {
    try {
      await task()
    } catch (error) {
      console.warn('Cleanup task failed:', error)
    }
  }
  
  // Log performance metrics for failed tests
  if (expect.getState().assertionCalls === 0) {
    // Test likely failed, log metrics for debugging
    for (const [operation, metrics] of global.__SWARM_TEST_GLOBALS__.performanceMetrics) {
      const stats = getPerformanceMetrics(operation)
      if (stats.count > 0) {
        console.log(`📊 ${operation}: avg=${stats.avg.toFixed(2)}ms, max=${stats.max.toFixed(2)}ms (${stats.count} samples)`)
      }
    }
  }
})

afterAll(async () => {
  console.log('🧹 Cleaning up MCP Swarm test environment...')
  
  // Generate performance report
  console.log('\n📈 Performance Summary:')
  for (const [operation, metrics] of global.__SWARM_TEST_GLOBALS__.performanceMetrics) {
    const stats = getPerformanceMetrics(operation)
    if (stats.count > 0) {
      console.log(`  ${operation}:`)
      console.log(`    Average: ${stats.avg.toFixed(2)}ms`)
      console.log(`    Min/Max: ${stats.min.toFixed(2)}ms / ${stats.max.toFixed(2)}ms`)
      console.log(`    Samples: ${stats.count}`)
    }
  }
  
  const totalTestTime = Date.now() - global.__SWARM_TEST_GLOBALS__.testStartTime
  console.log(`\n⏱️  Total test execution time: ${totalTestTime}ms`)
})

// Test environment validation
if (!process.env.NODE_ENV) {
  throw new Error('NODE_ENV must be set for testing')
}

if (process.env.NODE_ENV !== 'test') {
  console.warn(`⚠️  NODE_ENV is '${process.env.NODE_ENV}', expected 'test'`)
}

// Export test globals for use in tests
export const testGlobals = global.__SWARM_TEST_GLOBALS__

// Custom matchers for swarm testing
expect.extend({
  toBeWithinLatency(received: number, expected: number) {
    const pass = received <= expected
    if (pass) {
      return {
        message: () => `Expected latency ${received}ms not to be within ${expected}ms`,
        pass: true
      }
    } else {
      return {
        message: () => `Expected latency ${received}ms to be within ${expected}ms`,
        pass: false
      }
    }
  },
  
  toHaveSwarmStructure(received: any) {
    const requiredFields = ['id', 'topology', 'agents']
    const pass = requiredFields.every(field => received && typeof received === 'object' && field in received)
    
    if (pass) {
      return {
        message: () => `Expected object not to have swarm structure`,
        pass: true
      }
    } else {
      return {
        message: () => `Expected object to have swarm structure with fields: ${requiredFields.join(', ')}`,
        pass: false
      }
    }
  },
  
  toHaveMCPFormat(received: any) {
    const hasMCPFormat = received && 
      typeof received === 'object' &&
      'isError' in received &&
      'content' in received &&
      Array.isArray(received.content)
    
    if (hasMCPFormat) {
      return {
        message: () => `Expected object not to have MCP format`,
        pass: true
      }
    } else {
      return {
        message: () => `Expected object to have MCP format with isError and content fields`,
        pass: false
      }
    }
  }
})

declare module 'vitest' {
  interface Assertion<T = any> {
    toBeWithinLatency(expected: number): T
    toHaveSwarmStructure(): T  
    toHaveMCPFormat(): T
  }
}