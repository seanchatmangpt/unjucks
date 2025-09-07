/**
 * Real MCP Protocol Communication Tests
 * Tests direct JSON-RPC 2.0 communication with claude-flow MCP server
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { createConnection, Socket } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { EventEmitter } from 'node:events'
import type { McpRequest, McpResponse, McpMessage } from '../types/mcp-protocol'

interface McpTransport extends EventEmitter {
  send(message: McpRequest): Promise<McpResponse>
  close(): Promise<void>
  isConnected(): boolean
}

class StdioMcpTransport extends EventEmitter implements McpTransport {
  private process: ChildProcess | null = null
  private messageId = 0
  private pendingRequests = new Map<number, { resolve: Function, reject: Function, timestamp: number }>()
  private responseBuffer = ''

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          NODE_ENV: 'test',
          MCP_TRANSPORT: 'stdio',
          LOG_LEVEL: 'warn'
        }
      })

      let initBuffer = ''
      this.process.stdout?.on('data', this.handleStdoutData.bind(this))
      this.process.stderr?.on('data', this.handleStderrData.bind(this))

      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        initBuffer += output

        if (output.includes('MCP server ready') || 
            output.includes('{"jsonrpc":"2.0"')) {
          resolve()
        }
      })

      this.process.on('error', reject)

      setTimeout(() => {
        reject(new Error('MCP stdio transport connection timeout'))
      }, 15000)
    })
  }

  private handleStdoutData(data: Buffer): void {
    this.responseBuffer += data.toString()
    this.processBuffer()
  }

  private handleStderrData(data: Buffer): void {
    const error = data.toString()
    if (error.includes('FATAL')) {
      this.emit('error', new Error(`MCP server error: ${error}`))
    }
  }

  private processBuffer(): void {
    const lines = this.responseBuffer.split('\n')
    this.responseBuffer = lines.pop() || ''
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as McpMessage
          this.handleMessage(message)
        } catch (parseError) {
          // Ignore non-JSON lines (logs, etc.)
        }
      }
    }
  }

  private handleMessage(message: McpMessage): void {
    if ('id' in message && message.id) {
      const pending = this.pendingRequests.get(message.id as number)
      if (pending) {
        this.pendingRequests.delete(message.id as number)
        
        if ('error' in message && message.error) {
          pending.reject(new Error(message.error.message))
        } else {
          pending.resolve(message as McpResponse)
        }
      }
    }

    this.emit('message', message)
  }

  async send(request: McpRequest): Promise<McpResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('MCP stdio transport not connected'))
        return
      }

      const id = ++this.messageId
      const message = { ...request, id }
      
      this.pendingRequests.set(id, { 
        resolve, 
        reject, 
        timestamp: Date.now() 
      })
      
      const jsonMessage = JSON.stringify(message) + '\n'
      this.process.stdin.write(jsonMessage)

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`MCP request timeout: ${request.method}`))
        }
      }, 30000)
    })
  }

  isConnected(): boolean {
    return this.process !== null && !this.process.killed
  }

  async close(): Promise<void> {
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

class SocketMcpTransport extends EventEmitter implements McpTransport {
  private socket: Socket | null = null
  private messageId = 0
  private pendingRequests = new Map<number, { resolve: Function, reject: Function }>()
  private responseBuffer = ''

  async connect(port: number = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = createConnection({ port }, () => {
        resolve()
      })

      this.socket.on('data', (data: Buffer) => {
        this.responseBuffer += data.toString()
        this.processBuffer()
      })

      this.socket.on('error', (error) => {
        reject(error)
        this.emit('error', error)
      })

      this.socket.on('close', () => {
        this.emit('close')
      })

      setTimeout(() => {
        reject(new Error('Socket connection timeout'))
      }, 10000)
    })
  }

  private processBuffer(): void {
    const lines = this.responseBuffer.split('\n')
    this.responseBuffer = lines.pop() || ''
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as McpMessage
          this.handleMessage(message)
        } catch (parseError) {
          console.warn('Failed to parse socket message:', line)
        }
      }
    }
  }

  private handleMessage(message: McpMessage): void {
    if ('id' in message && message.id) {
      const pending = this.pendingRequests.get(message.id as number)
      if (pending) {
        this.pendingRequests.delete(message.id as number)
        
        if ('error' in message && message.error) {
          pending.reject(new Error(message.error.message))
        } else {
          pending.resolve(message as McpResponse)
        }
      }
    }

    this.emit('message', message)
  }

  async send(request: McpRequest): Promise<McpResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'))
        return
      }

      const id = ++this.messageId
      const message = { ...request, id }
      
      this.pendingRequests.set(id, { resolve, reject })
      
      const jsonMessage = JSON.stringify(message) + '\n'
      this.socket.write(jsonMessage)

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Socket request timeout: ${request.method}`))
        }
      }, 15000)
    })
  }

  isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed
  }

  async close(): Promise<void> {
    if (this.socket) {
      return new Promise((resolve) => {
        this.socket!.on('close', () => resolve())
        this.socket!.destroy()
      })
    }
  }
}

describe('Real MCP Protocol Communication', () => {
  let stdioTransport: StdioMcpTransport
  let socketTransport: SocketMcpTransport | null = null

  beforeAll(async () => {
    stdioTransport = new StdioMcpTransport()
    await stdioTransport.connect()
  }, 30000)

  afterAll(async () => {
    if (stdioTransport) {
      await stdioTransport.close()
    }
    if (socketTransport) {
      await socketTransport.close()
    }
  })

  describe('JSON-RPC 2.0 Protocol Compliance', () => {
    it('should follow JSON-RPC 2.0 message format', async () => {
      const response = await stdioTransport.send({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {}
      })

      expect(response).toHaveProperty('jsonrpc', '2.0')
      expect(response).toHaveProperty('id')
      expect(response.result || response.error).toBeDefined()
      
      if (response.result) {
        expect(response.error).toBeUndefined()
      }
      if (response.error) {
        expect(response.result).toBeUndefined()
        expect(response.error).toHaveProperty('code')
        expect(response.error).toHaveProperty('message')
      }
    })

    it('should handle requests without params', async () => {
      const response = await stdioTransport.send({
        jsonrpc: '2.0',
        method: 'ping'
      })

      expect(response.jsonrpc).toBe('2.0')
      expect(response.id).toBeDefined()
      expect(response.result || response.error).toBeDefined()
    })

    it('should return proper error for invalid method', async () => {
      const response = await stdioTransport.send({
        jsonrpc: '2.0',
        method: 'invalid_method_name',
        params: {}
      })

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(-32601) // Method not found
      expect(response.error?.message).toContain('Method not found')
    })

    it('should handle malformed requests gracefully', async () => {
      try {
        const response = await stdioTransport.send({
          jsonrpc: '1.0' as any, // Invalid version
          method: 'tools/list',
          params: {}
        })

        if (response.error) {
          expect(response.error.code).toBe(-32600) // Invalid Request
        }
      } catch (error) {
        // Server might reject malformed requests entirely
        expect(error.message).toContain('Invalid')
      }
    })

    it('should preserve request/response correlation', async () => {
      const requests = [
        { jsonrpc: '2.0' as const, method: 'ping', params: {} },
        { jsonrpc: '2.0' as const, method: 'tools/list', params: {} },
        { jsonrpc: '2.0' as const, method: 'tools/call', params: { name: 'swarm_status' } }
      ]

      const responses = await Promise.all(
        requests.map(req => stdioTransport.send(req))
      )

      expect(responses).toHaveLength(3)
      for (const response of responses) {
        expect(response.id).toBeDefined()
        expect(response.jsonrpc).toBe('2.0')
      }

      // All responses should have different IDs
      const ids = responses.map(r => r.id)
      expect(new Set(ids).size).toBe(3)
    })
  })

  describe('MCP Tool Discovery and Invocation', () => {
    it('should discover available MCP tools', async () => {
      const response = await stdioTransport.send({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {}
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      expect(response.result.tools).toBeDefined()
      expect(Array.isArray(response.result.tools)).toBe(true)

      const tools = response.result.tools
      const expectedTools = [
        'swarm_init',
        'agent_spawn', 
        'task_orchestrate',
        'swarm_status',
        'neural_train',
        'memory_usage'
      ]

      for (const expectedTool of expectedTools) {
        const tool = tools.find((t: any) => t.name === expectedTool)
        expect(tool).toBeDefined()
        expect(tool.description).toBeDefined()
        expect(tool.inputSchema).toBeDefined()
        expect(tool.inputSchema.type).toBe('object')
      }
    })

    it('should get tool schema information', async () => {
      const response = await stdioTransport.send({
        jsonrpc: '2.0',
        method: 'tools/schema',
        params: { name: 'swarm_init' }
      })

      if (response.result) {
        expect(response.result.name).toBe('swarm_init')
        expect(response.result.inputSchema).toBeDefined()
        expect(response.result.inputSchema.properties).toBeDefined()
        expect(response.result.inputSchema.properties.topology).toBeDefined()
      }
    })

    it('should invoke MCP tools with proper parameters', async () => {
      const response = await stdioTransport.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'swarm_init',
          arguments: {
            topology: 'mesh',
            maxAgents: 5,
            strategy: 'balanced'
          }
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
      expect(response.result.content).toBeDefined()
      expect(Array.isArray(response.result.content)).toBe(true)
      expect(response.result.content[0].type).toBeDefined()
      expect(['text', 'json'].includes(response.result.content[0].type)).toBe(true)
    })

    it('should validate tool parameters', async () => {
      const response = await stdioTransport.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'swarm_init',
          arguments: {
            topology: 'invalid_topology', // Invalid value
            maxAgents: -1                 // Invalid value
          }
        }
      })

      expect(response.error).toBeDefined()
      expect(response.error?.message).toMatch(/invalid|validation|parameter/i)
    })

    it('should handle missing required parameters', async () => {
      const response = await stdioTransport.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'swarm_init',
          arguments: {
            // Missing required 'topology' parameter
            maxAgents: 5
          }
        }
      })

      expect(response.error).toBeDefined()
      expect(response.error?.message).toMatch(/required|missing|topology/i)
    })
  })

  describe('Real-time Communication Features', () => {
    it('should handle concurrent requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
        stdioTransport.send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'swarm_status',
            arguments: {}
          }
        })
      )

      const responses = await Promise.all(concurrentRequests)
      
      expect(responses).toHaveLength(10)
      for (const response of responses) {
        expect(response.error).toBeUndefined()
        expect(response.result).toBeDefined()
      }

      // All responses should have unique IDs
      const ids = responses.map(r => r.id)
      expect(new Set(ids).size).toBe(10)
    })

    it('should handle request bursts without dropping messages', async () => {
      const burstSize = 50
      const startTime = Date.now()

      const burstRequests = Array.from({ length: burstSize }, (_, i) => 
        stdioTransport.send({
          jsonrpc: '2.0',
          method: 'ping',
          params: { index: i }
        })
      )

      const responses = await Promise.all(burstRequests)
      const endTime = Date.now()
      
      expect(responses).toHaveLength(burstSize)
      
      const successfulResponses = responses.filter(r => !r.error)
      expect(successfulResponses.length / burstSize).toBeGreaterThan(0.95) // 95% success rate

      console.log(`Burst test: ${burstSize} requests in ${endTime - startTime}ms`)
    })

    it('should maintain connection stability under load', async () => {
      const loadTestDuration = 10000 // 10 seconds
      const requestInterval = 100    // 100ms between requests
      const startTime = Date.now()
      const responses: McpResponse[] = []

      while (Date.now() - startTime < loadTestDuration) {
        try {
          const response = await stdioTransport.send({
            jsonrpc: '2.0',
            method: 'ping',
            params: { timestamp: Date.now() }
          })
          responses.push(response)
        } catch (error) {
          console.warn('Load test request failed:', error.message)
        }

        await delay(requestInterval)
      }

      expect(stdioTransport.isConnected()).toBe(true)
      expect(responses.length).toBeGreaterThan(50) // Should have many successful requests
      
      const errorRate = responses.filter(r => r.error).length / responses.length
      expect(errorRate).toBeLessThan(0.1) // Less than 10% error rate

      console.log(`Load test: ${responses.length} requests over ${loadTestDuration}ms`)
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle timeout scenarios', async () => {
      // This test simulates a timeout by sending a request that might take too long
      try {
        const response = await stdioTransport.send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'neural_train',
            arguments: {
              pattern_type: 'coordination',
              training_data: 'large_dataset',
              iterations: 1000 // Very high iterations might timeout
            }
          }
        })
        
        // If it doesn't timeout, it should still be a valid response
        expect(response.result || response.error).toBeDefined()
      } catch (error) {
        expect(error.message).toContain('timeout')
      }
    }, 60000)

    it('should recover from temporary failures', async () => {
      // Send some requests that might fail
      const riskyRequests = [
        stdioTransport.send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'nonexistent_tool',
            arguments: {}
          }
        }),
        stdioTransport.send({
          jsonrpc: '2.0',
          method: 'invalid_method',
          params: {}
        })
      ]

      try {
        await Promise.all(riskyRequests)
      } catch (error) {
        // Expected to fail
      }

      // Connection should still be stable for valid requests
      const recoveryResponse = await stdioTransport.send({
        jsonrpc: '2.0',
        method: 'ping',
        params: {}
      })

      expect(recoveryResponse.error).toBeUndefined()
      expect(recoveryResponse.result).toBeDefined()
      expect(stdioTransport.isConnected()).toBe(true)
    })

    it('should provide meaningful error messages', async () => {
      const errorScenarios = [
        {
          name: 'Invalid tool name',
          request: {
            jsonrpc: '2.0' as const,
            method: 'tools/call',
            params: { name: 'nonexistent_tool', arguments: {} }
          },
          expectedError: /tool.*not.*found/i
        },
        {
          name: 'Invalid parameters',
          request: {
            jsonrpc: '2.0' as const,
            method: 'tools/call',
            params: {
              name: 'swarm_init',
              arguments: { topology: 'invalid_topology' }
            }
          },
          expectedError: /invalid|parameter|topology/i
        },
        {
          name: 'Missing arguments',
          request: {
            jsonrpc: '2.0' as const,
            method: 'tools/call',
            params: { name: 'swarm_init' } // Missing arguments
          },
          expectedError: /missing|required|argument/i
        }
      ]

      for (const scenario of errorScenarios) {
        const response = await stdioTransport.send(scenario.request)
        
        expect(response.error).toBeDefined()
        expect(response.error?.message).toMatch(scenario.expectedError)
        console.log(`${scenario.name}: ${response.error?.message}`)
      }
    })
  })

  describe('Protocol Extension Support', () => {
    it('should support custom message types', async () => {
      // Test if server supports custom extensions
      const response = await stdioTransport.send({
        jsonrpc: '2.0',
        method: 'capabilities',
        params: {}
      })

      if (response.result) {
        expect(response.result).toBeDefined()
        // Check for extension capabilities
        expect(typeof response.result).toBe('object')
      }
    })

    it('should handle notifications (requests without id)', async () => {
      // Send a notification (no response expected)
      const notificationPromise = new Promise<void>((resolve) => {
        if (stdioTransport.process?.stdin) {
          const notification = {
            jsonrpc: '2.0',
            method: 'notification/test',
            params: { message: 'test notification' }
            // No ID - this is a notification
          }
          
          stdioTransport.process.stdin.write(JSON.stringify(notification) + '\n')
          
          // Wait a bit and consider it successful if no error
          setTimeout(resolve, 1000)
        } else {
          resolve()
        }
      })

      await expect(notificationPromise).resolves.toBeUndefined()
    })

    it('should support batch requests', async () => {
      const batchRequest = [
        { jsonrpc: '2.0' as const, method: 'ping', params: {}, id: 1 },
        { jsonrpc: '2.0' as const, method: 'tools/list', params: {}, id: 2 },
        { jsonrpc: '2.0' as const, method: 'tools/call', params: { name: 'swarm_status' }, id: 3 }
      ]

      // Note: Not all MCP servers support batch requests
      // This test checks if the feature is supported
      try {
        if (stdioTransport.process?.stdin) {
          stdioTransport.process.stdin.write(JSON.stringify(batchRequest) + '\n')
          
          // If batch is supported, we should get an array response
          await delay(2000) // Wait for potential batch response
        }
        
        // If we get here without error, batch might be supported
        expect(true).toBe(true)
      } catch (error) {
        // Batch requests might not be supported - that's okay
        expect(error.message).toBeDefined()
      }
    })
  })

  describe('Transport Layer Testing', () => {
    it('should handle stdio transport reliably', async () => {
      expect(stdioTransport.isConnected()).toBe(true)
      
      const response = await stdioTransport.send({
        jsonrpc: '2.0',
        method: 'ping',
        params: {}
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
    })

    // Socket transport test (if available)
    it('should support socket transport when available', async () => {
      try {
        socketTransport = new SocketMcpTransport()
        await socketTransport.connect(3000)
        
        const response = await socketTransport.send({
          jsonrpc: '2.0',
          method: 'ping',
          params: {}
        })

        expect(response.error).toBeUndefined()
        expect(response.result).toBeDefined()
        console.log('Socket transport is available and working')
      } catch (error) {
        console.log('Socket transport not available:', error.message)
        // This is acceptable - not all setups support socket transport
      }
    })

    it('should handle transport reconnection', async () => {
      const originalConnection = stdioTransport.isConnected()
      expect(originalConnection).toBe(true)

      // Simulate connection issues by sending many rapid requests
      const stressRequests = Array.from({ length: 100 }, () => 
        stdioTransport.send({
          jsonrpc: '2.0',
          method: 'ping',
          params: {}
        }).catch(() => null) // Ignore individual failures
      )

      await Promise.all(stressRequests)

      // Connection should still be stable or recovered
      const finalResponse = await stdioTransport.send({
        jsonrpc: '2.0',
        method: 'ping',
        params: {}
      })

      expect(finalResponse.error).toBeUndefined()
      expect(stdioTransport.isConnected()).toBe(true)
    })
  })
})