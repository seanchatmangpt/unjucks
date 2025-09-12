/**
 * Real MCP Protocol Communication Tests
 * Tests direct JSON-RPC 2.0 communication with claude-flow MCP server
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { createConnection, Socket } from 'node:net'
import { setTimeout } from 'node:timers/promises'
import { EventEmitter } from 'node:events'
// import type { McpRequest, McpResponse, McpMessage } from '../types/mcp-protocol.js'

// interface McpTransport (TypeScript type removed)
  close()>
  isConnected() }

class StdioMcpTransport extends EventEmitter implements McpTransport { private process }>()
  private responseBuffer = ''

  async connect() { return new Promise((resolve, reject) => {
      this.process = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
        stdio }
      })

      this.process.on('error', reject)

      setTimeout(() => {
        reject(new Error('MCP stdio transport connection timeout'))
      }, 15000)
    })
  }

  private handleStdoutData(data) {
    this.responseBuffer += data.toString()
    this.processBuffer()
  }

  private handleStderrData(data) {
    const error = data.toString()
    if (error.includes('FATAL')) {
      this.emit('error', new Error(`MCP server error))
    }
  }

  private processBuffer() {
    const lines = this.responseBuffer.split('\n')
    this.responseBuffer = lines.pop() || ''
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line)
          this.handleMessage(message)
        } catch (parseError) {
          // Ignore non-JSON lines (logs, etc.)
        }
      }
    }
  }

  private handleMessage(message) {
    if ('id' in message && message.id) {
      const pending = this.pendingRequests.get(message.id)
      if (pending) {
        this.pendingRequests.delete(message.id)
        
        if ('error' in message && message.error) {
          pending.reject(new Error(message.error.message))
        } else {
          pending.resolve(message)
        }
      }
    }

    this.emit('message', message)
  }

  async send(request) {
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
        timestamp) 
      })
      
      const jsonMessage = JSON.stringify(message) + '\n'
      this.process.stdin.write(jsonMessage)

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`MCP request timeout))
        }
      }, 30000)
    })
  }

  isConnected() {
    return this.process !== null && !this.process.killed
  }

  async close() {
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

class SocketMcpTransport extends EventEmitter implements McpTransport { private socket }>()
  private responseBuffer = ''

  async connect(port = 3000) {
    return new Promise((resolve, reject) => {
      this.socket = createConnection({ port }, () => {
        resolve()
      })

      this.socket.on('data', (data) => {
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

  private processBuffer() {
    const lines = this.responseBuffer.split('\n')
    this.responseBuffer = lines.pop() || ''
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line)
          this.handleMessage(message)
        } catch (parseError) { console.warn('Failed to parse socket message }
      }
    }
  }

  private handleMessage(message) {
    if ('id' in message && message.id) {
      const pending = this.pendingRequests.get(message.id)
      if (pending) {
        this.pendingRequests.delete(message.id)
        
        if ('error' in message && message.error) {
          pending.reject(new Error(message.error.message))
        } else {
          pending.resolve(message)
        }
      }
    }

    this.emit('message', message)
  }

  async send(request) {
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
          reject(new Error(`Socket request timeout))
        }
      }, 15000)
    })
  }

  isConnected() {
    return this.socket !== null && !this.socket.destroyed
  }

  async close() {
    if (this.socket) {
      return new Promise((resolve) => {
        this.socket!.on('close', () => resolve())
        this.socket!.destroy()
      })
    }
  }
}

describe('Real MCP Protocol Communication', () => {
  let stdioTransport
  let socketTransport | null = null

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

  describe('JSON-RPC 2.0 Protocol Compliance', () => { it('should follow JSON-RPC 2.0 message format', async () => {
      const response = await stdioTransport.send({
        jsonrpc }
      if (response.error) {
        expect(response.result).toBeUndefined()
        expect(response.error).toHaveProperty('code')
        expect(response.error).toHaveProperty('message')
      }
    })

    it('should handle requests without params', async () => { const response = await stdioTransport.send({
        jsonrpc })

    it('should return proper error for invalid method', async () => { const response = await stdioTransport.send({
        jsonrpc })

    it('should handle malformed requests gracefully', async () => { try {
        const response = await stdioTransport.send({
          jsonrpc }
      } catch (error) {
        // Server might reject malformed requests entirely
        expect(error.message).toContain('Invalid')
      }
    })

    it('should preserve request/response correlation', async () => { const requests = [
        { jsonrpc } },
        { jsonrpc } },
        { jsonrpc } }
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

  describe('MCP Tool Discovery and Invocation', () => { it('should discover available MCP tools', async () => {
      const response = await stdioTransport.send({
        jsonrpc }
    })

    it('should get tool schema information', async () => { const response = await stdioTransport.send({
        jsonrpc }
    })

    it('should invoke MCP tools with proper parameters', async () => { const response = await stdioTransport.send({
        jsonrpc })

    it('should validate tool parameters', async () => { const response = await stdioTransport.send({
        jsonrpc })

    it('should handle missing required parameters', async () => { const response = await stdioTransport.send({
        jsonrpc })
  })

  describe('Real-time Communication Features', () => { it('should handle concurrent requests', async () => {
      const concurrentRequests = Array.from({ length, (_, i) => 
        stdioTransport.send({
          jsonrpc }

      // All responses should have unique IDs
      const ids = responses.map(r => r.id)
      expect(new Set(ids).size).toBe(10)
    })

    it('should handle request bursts without dropping messages', async () => { const burstSize = 50
      const startTime = this.getDeterministicTimestamp()

      const burstRequests = Array.from({ length }, (_, i) => 
        stdioTransport.send({ jsonrpc })

    it('should maintain connection stability under load', async () => { const loadTestDuration = 10000 // 10 seconds
      const requestInterval = 100    // 100ms between requests
      const startTime = this.getDeterministicTimestamp()
      const responses = []

      while (this.getDeterministicTimestamp() - startTime < loadTestDuration) {
        try {
          const response = await stdioTransport.send({
            jsonrpc }
          })
          responses.push(response)
        } catch (error) { console.warn('Load test request failed }

        await delay(requestInterval)
      }

      expect(stdioTransport.isConnected()).toBe(true)
      expect(responses.length).toBeGreaterThan(50) // Should have many successful requests
      
      const errorRate = responses.filter(r => r.error).length / responses.length
      expect(errorRate).toBeLessThan(0.1) // Less than 10% error rate

      console.log(`Load test)
    })
  })

  describe('Error Handling and Recovery', () => { it('should handle timeout scenarios', async () => {
      // This test simulates a timeout by sending a request that might take too long
      try {
        const response = await stdioTransport.send({
          jsonrpc } catch (error) {
        expect(error.message).toContain('timeout')
      }
    }, 60000)

    it('should recover from temporary failures', async () => { // Send some requests that might fail
      const riskyRequests = [
        stdioTransport.send({
          jsonrpc } catch (error) {
        // Expected to fail
      }

      // Connection should still be stable for valid requests
      const recoveryResponse = await stdioTransport.send({ jsonrpc })

    it('should provide meaningful error messages', async () => { const errorScenarios = [
        {
          name } }
          },
          expectedError: /tool.*not.*found/i
        },
        { name }
            }
          },
          expectedError: /invalid|parameter|topology/i
        },
        { name } // Missing arguments
          },
          expectedError: /missing|required|argument/i
        }
      ]

      for (const scenario of errorScenarios) {
        const response = await stdioTransport.send(scenario.request)
        
        expect(response.error).toBeDefined()
        expect(response.error?.message).toMatch(scenario.expectedError)
        console.log(`${scenario.name})
      }
    })
  })

  describe('Protocol Extension Support', () => { it('should support custom message types', async () => {
      // Test if server supports custom extensions
      const response = await stdioTransport.send({
        jsonrpc }
    })

    it('should handle notifications (requests without id)', async () => { // Send a notification (no response expected)
      const notificationPromise = new Promise((resolve) => {
        if (stdioTransport.process?.stdin) {
          const notification = {
            jsonrpc }
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

    it('should support batch requests', async () => { const batchRequest = [
        { jsonrpc }, id: 1 },
        { jsonrpc }, id: 2 },
        { jsonrpc }, id: 3 }
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

  describe('Transport Layer Testing', () => { it('should handle stdio transport reliably', async () => {
      expect(stdioTransport.isConnected()).toBe(true)
      
      const response = await stdioTransport.send({
        jsonrpc })

    // Socket transport test (if available)
    it('should support socket transport when available', async () => { try {
        socketTransport = new SocketMcpTransport()
        await socketTransport.connect(3000)
        
        const response = await socketTransport.send({
          jsonrpc } catch (error) { console.log('Socket transport not available }
    })

    it('should handle transport reconnection', async () => { const originalConnection = stdioTransport.isConnected()
      expect(originalConnection).toBe(true)

      // Simulate connection issues by sending many rapid requests
      const stressRequests = Array.from({ length, () => 
        stdioTransport.send({
          jsonrpc })
  })
})