/**
 * MCP Server Lifecycle Tests
 * Tests direct spawning, initialization, and shutdown of claude-flow MCP server
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import type { McpMessage, McpRequest, McpResponse } from '../types/mcp-protocol'

interface McpServerProcess {
  process: ChildProcess
  send: (message: McpRequest) => Promise<McpResponse>
  close: () => Promise<void>
}

/**
 * Spawn and initialize claude-flow MCP server
 */
async function spawnMcpServer(timeout = 10000): Promise<McpServerProcess> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`MCP server startup timeout after ${timeout}ms`))
    }, timeout)

    const serverProcess = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    })

    let messageId = 0
    const pendingRequests = new Map<number, { resolve: Function, reject: Function }>()

    // Handle server output
    let initBuffer = ''
    serverProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      initBuffer += output

      // Check for initialization complete signal
      if (output.includes('MCP server initialized') || output.includes('Server ready')) {
        clearTimeout(timeoutId)

        const mcpInterface: McpServerProcess = {
          process: serverProcess,
          
          async send(message: McpRequest): Promise<McpResponse> {
            return new Promise((resolve, reject) => {
              const id = ++messageId
              const requestMessage = { ...message, id }
              
              pendingRequests.set(id, { resolve, reject })
              
              // Send JSON-RPC message
              const jsonMessage = JSON.stringify(requestMessage) + '\n'
              serverProcess.stdin?.write(jsonMessage)

              // Timeout for individual requests
              setTimeout(() => {
                if (pendingRequests.has(id)) {
                  pendingRequests.delete(id)
                  reject(new Error(`Request timeout for message ${id}`))
                }
              }, 5000)
            })
          },

          async close(): Promise<void> {
            return new Promise((resolve) => {
              serverProcess.on('close', () => resolve())
              serverProcess.kill('SIGTERM')
              
              setTimeout(() => {
                if (!serverProcess.killed) {
                  serverProcess.kill('SIGKILL')
                }
                resolve()
              }, 2000)
            })
          }
        }

        // Handle server responses
        let responseBuffer = ''
        serverProcess.stdout?.on('data', (data: Buffer) => {
          responseBuffer += data.toString()
          
          // Process complete JSON messages
          const lines = responseBuffer.split('\n')
          responseBuffer = lines.pop() || ''
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line) as McpResponse
                if (response.id && pendingRequests.has(response.id)) {
                  const { resolve, reject } = pendingRequests.get(response.id)!
                  pendingRequests.delete(response.id)
                  
                  if (response.error) {
                    reject(new Error(response.error.message))
                  } else {
                    resolve(response)
                  }
                }
              } catch (parseError) {
                console.warn('Failed to parse MCP response:', line)
              }
            }
          }
        })

        resolve(mcpInterface)
      }
    })

    serverProcess.stderr?.on('data', (data: Buffer) => {
      const error = data.toString()
      if (error.includes('error') || error.includes('Error')) {
        clearTimeout(timeoutId)
        reject(new Error(`MCP server error: ${error}`))
      }
    })

    serverProcess.on('error', (error) => {
      clearTimeout(timeoutId)
      reject(new Error(`Failed to spawn MCP server: ${error.message}`))
    })

    serverProcess.on('close', (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timeoutId)
        reject(new Error(`MCP server exited with code ${code}`))
      }
    })
  })
}

describe('MCP Server Lifecycle', () => {
  let mcpServer: McpServerProcess

  beforeAll(async () => {
    // Spawn claude-flow MCP server for testing
    mcpServer = await spawnMcpServer(15000)
  })

  afterAll(async () => {
    if (mcpServer) {
      await mcpServer.close()
    }
  })

  it('should successfully spawn claude-flow MCP server', async () => {
    expect(mcpServer).toBeDefined()
    expect(mcpServer.process).toBeDefined()
    expect(mcpServer.process.pid).toBeGreaterThan(0)
  })

  it('should respond to ping/health check requests', async () => {
    const response = await mcpServer.send({
      jsonrpc: '2.0',
      method: 'ping',
      params: {}
    })

    expect(response.result).toBeDefined()
    expect(response.error).toBeUndefined()
  })

  it('should list available MCP tools', async () => {
    const response = await mcpServer.send({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {}
    })

    expect(response.result).toBeDefined()
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

    for (const tool of expectedTools) {
      expect(tools.some((t: any) => t.name === tool)).toBe(true)
    }
  })

  it('should handle invalid method calls gracefully', async () => {
    const response = await mcpServer.send({
      jsonrpc: '2.0',
      method: 'nonexistent_method',
      params: {}
    })

    expect(response.error).toBeDefined()
    expect(response.error?.code).toBe(-32601) // Method not found
  })

  it('should initialize swarm with valid topology', async () => {
    const response = await mcpServer.send({
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

    expect(response.result).toBeDefined()
    expect(response.error).toBeUndefined()
    
    const result = response.result.content?.[0]?.text
    expect(result).toContain('mesh')
    expect(result).toContain('initialized') 
  })

  it('should handle concurrent MCP requests', async () => {
    const requests = [
      mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'swarm_status',
          arguments: {}
        }
      }),
      mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'agent_list',
          arguments: {}
        }
      }),
      mcpServer.send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'memory_usage',
          arguments: { action: 'list' }
        }
      })
    ]

    const responses = await Promise.all(requests)
    
    for (const response of responses) {
      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
    }
  })

  it('should maintain session state between requests', async () => {
    // Initialize swarm
    const initResponse = await mcpServer.send({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'swarm_init',
        arguments: {
          topology: 'star',
          maxAgents: 3
        }
      }
    })
    expect(initResponse.error).toBeUndefined()

    // Check status
    const statusResponse = await mcpServer.send({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'swarm_status',
        arguments: {}
      }
    })
    
    expect(statusResponse.error).toBeUndefined()
    const statusText = statusResponse.result.content?.[0]?.text || ''
    expect(statusText).toContain('star')
  })

  it('should handle server resource cleanup on shutdown', async () => {
    // Create some resources
    await mcpServer.send({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'agent_spawn',
        arguments: {
          type: 'researcher',
          capabilities: ['analysis', 'research']
        }
      }
    })

    // Verify process is alive
    expect(mcpServer.process.killed).toBe(false)

    // Close server
    await mcpServer.close()

    // Process should be terminated
    await delay(1000)
    expect(mcpServer.process.killed || mcpServer.process.exitCode !== null).toBe(true)
  })
})

describe('MCP Protocol Compliance', () => {
  let mcpServer: McpServerProcess

  beforeAll(async () => {
    mcpServer = await spawnMcpServer()
  })

  afterAll(async () => {
    if (mcpServer) {
      await mcpServer.close()
    }
  })

  it('should follow JSON-RPC 2.0 specification', async () => {
    const response = await mcpServer.send({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {}
    })

    expect(response).toHaveProperty('jsonrpc', '2.0')
    expect(response).toHaveProperty('id')
    expect(response.result || response.error).toBeDefined()
  })

  it('should validate tool parameters correctly', async () => {
    const response = await mcpServer.send({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'swarm_init',
        arguments: {
          topology: 'invalid_topology', // Invalid parameter
          maxAgents: -1 // Invalid parameter
        }
      }
    })

    expect(response.error).toBeDefined()
    expect(response.error?.message).toContain('invalid') 
  })

  it('should return structured error responses', async () => {
    const response = await mcpServer.send({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'nonexistent_tool',
        arguments: {}
      }
    })

    expect(response.error).toBeDefined()
    expect(response.error).toHaveProperty('code')
    expect(response.error).toHaveProperty('message')
    expect(typeof response.error?.code).toBe('number')
    expect(typeof response.error?.message).toBe('string')
  })
})