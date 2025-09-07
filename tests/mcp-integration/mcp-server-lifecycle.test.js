/**
 * MCP Server Lifecycle Tests
 * Tests direct spawning, initialization, and shutdown of claude-flow MCP server
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout } from 'node:timers/promises'
// import type { McpMessage, McpRequest, McpResponse } from '../types/mcp-protocol.js'

/**
 * Spawn and initialize claude-flow MCP server
 */
async function spawnMcpServer(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`MCP server startup timeout after ${timeout}ms`))
    }, timeout)

    const serverProcess = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], { stdio }>()

    // Handle server output
    let initBuffer = ''
    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString()
      initBuffer += output

      // Check for initialization complete signal
      if (output.includes('MCP server initialized') || output.includes('Server ready')) {
        clearTimeout(timeoutId)

        const mcpInterface = {
          process,
          
          async send(message) {
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

          async close() {
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
        serverProcess.stdout?.on('data', (data) => {
          responseBuffer += data.toString()
          
          // Process complete JSON messages
          const lines = responseBuffer.split('\n')
          responseBuffer = lines.pop() || ''
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const response = JSON.parse(line)
                if (response.id && pendingRequests.has(response.id)) {
                  const { resolve, reject } = pendingRequests.get(response.id)!
                  pendingRequests.delete(response.id)
                  
                  if (response.error) {
                    reject(new Error(response.error.message))
                  } else {
                    resolve(response)
                  }
                }
              } catch (parseError) { console.warn('Failed to parse MCP response }
            }
          }
        })

        resolve(mcpInterface)
      }
    })

    serverProcess.stderr?.on('data', (data) => {
      const error = data.toString()
      if (error.includes('error') || error.includes('Error')) {
        clearTimeout(timeoutId)
        reject(new Error(`MCP server error))
      }
    })

    serverProcess.on('error', (error) => {
      clearTimeout(timeoutId)
      reject(new Error(`Failed to spawn MCP server))
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
  let mcpServer

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

  it('should respond to ping/health check requests', async () => { const response = await mcpServer.send({
      jsonrpc })

  it('should list available MCP tools', async () => { const response = await mcpServer.send({
      jsonrpc }
  })

  it('should handle invalid method calls gracefully', async () => { const response = await mcpServer.send({
      jsonrpc })

  it('should initialize swarm with valid topology', async () => { const response = await mcpServer.send({
      jsonrpc })

  it('should handle concurrent MCP requests', async () => { const requests = [
      mcpServer.send({
        jsonrpc }
  })

  it('should maintain session state between requests', async () => { // Initialize swarm
    const initResponse = await mcpServer.send({
      jsonrpc })

  it('should handle server resource cleanup on shutdown', async () => { // Create some resources
    await mcpServer.send({
      jsonrpc }
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
  let mcpServer

  beforeAll(async () => {
    mcpServer = await spawnMcpServer()
  })

  afterAll(async () => {
    if (mcpServer) {
      await mcpServer.close()
    }
  })

  it('should follow JSON-RPC 2.0 specification', async () => { const response = await mcpServer.send({
      jsonrpc })

  it('should validate tool parameters correctly', async () => { const response = await mcpServer.send({
      jsonrpc })

  it('should return structured error responses', async () => { const response = await mcpServer.send({
      jsonrpc })
})