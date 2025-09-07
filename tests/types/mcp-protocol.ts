/**
 * MCP Protocol Type Definitions
 * Standard JSON-RPC 2.0 and MCP-specific types
 */

export interface McpMessage {
  jsonrpc: '2.0'
  id?: string | number
}

export interface McpRequest extends McpMessage {
  method: string
  params?: any
}

export interface McpResponse extends McpMessage {
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

export interface McpTool {
  name: string
  description: string
  inputSchema: {
    type: string
    properties?: Record<string, any>
    required?: string[]
  }
}

export interface McpToolCall {
  name: string
  arguments: Record<string, any>
}

export interface McpToolResult {
  content: Array<{
    type: 'text' | 'json'
    text?: string
    json?: any
  }>
  isError?: boolean
  _meta?: Record<string, any>
}

// Claude Flow specific types
export interface SwarmConfig {
  topology: 'mesh' | 'hierarchical' | 'ring' | 'star'
  maxAgents?: number
  strategy?: 'balanced' | 'specialized' | 'adaptive'
}

export interface AgentConfig {
  type: 'researcher' | 'coder' | 'analyst' | 'optimizer' | 'coordinator'
  name?: string
  capabilities?: string[]
}

export interface TaskConfig {
  task: string
  maxAgents?: number
  priority?: 'low' | 'medium' | 'high' | 'critical'
  strategy?: 'parallel' | 'sequential' | 'adaptive'
}

export interface MemoryOperation {
  action: 'store' | 'retrieve' | 'list' | 'delete' | 'search'
  key?: string
  value?: string
  namespace?: string
  ttl?: number
}

export interface NeuralConfig {
  iterations?: number
  pattern_type?: 'coordination' | 'optimization' | 'prediction'
  training_data?: string
}