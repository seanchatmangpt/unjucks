/**
 * Nitro plugin for MCP WebSocket integration
 * Enables real-time communication between Nuxt app and MCP swarm
 */

import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

interface SwarmConnection {
  id: string;
  ws: WebSocket;
  swarmId?: string;
  agentId?: string;
  authenticated: boolean;
}

let wss: WebSocketServer;
const connections = new Map<string, SwarmConnection>();

export default defineNitroPlugin((nitroApp) => {
  // Initialize WebSocket server on startup
  nitroApp.hooks.hook('request', (event) => {
    if (!wss && event.node.req.url === '/api/mcp/ws') {
      initializeWebSocketServer();
    }
  });

  // Handle WebSocket upgrade
  nitroApp.hooks.hook('upgrade', async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (req.url === '/api/mcp/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });
});

function initializeWebSocketServer() {
  wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, req) => {
    const connectionId = generateConnectionId();
    
    const connection: SwarmConnection = {
      id: connectionId,
      ws: ws as any,
      authenticated: false
    };
    
    connections.set(connectionId, connection);
    
    console.log(`[MCP-WS] New connection: ${connectionId}`);
    
    // Send welcome message
    sendMessage(ws, {
      jsonrpc: '2.0',
      method: 'connection.established',
      params: {
        connectionId,
        serverVersion: '1.0.0',
        capabilities: ['swarm', 'realtime', 'e2e']
      }
    });

    // Handle messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as MCPMessage;
        await handleMCPMessage(connectionId, message);
      } catch (error) {
        console.error('[MCP-WS] Error processing message:', error);
        sendError(ws, null, -32700, 'Parse error');
      }
    });

    // Handle close
    ws.on('close', () => {
      console.log(`[MCP-WS] Connection closed: ${connectionId}`);
      connections.delete(connectionId);
      
      // Notify swarm of disconnection
      broadcastToSwarm(connection.swarmId, {
        jsonrpc: '2.0',
        method: 'agent.disconnected',
        params: {
          agentId: connection.agentId,
          connectionId
        }
      });
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[MCP-WS] Connection error ${connectionId}:`, error);
    });
  });
}

async function handleMCPMessage(connectionId: string, message: MCPMessage) {
  const connection = connections.get(connectionId);
  if (!connection) return;

  // Handle different message types
  if (message.method) {
    switch (message.method) {
      case 'auth.login':
        await handleAuth(connection, message);
        break;
        
      case 'swarm.join':
        await handleSwarmJoin(connection, message);
        break;
        
      case 'swarm.broadcast':
        await handleSwarmBroadcast(connection, message);
        break;
        
      case 'agent.update':
        await handleAgentUpdate(connection, message);
        break;
        
      case 'task.execute':
        await handleTaskExecution(connection, message);
        break;
        
      case 'realtime.sync':
        await handleRealtimeSync(connection, message);
        break;
        
      default:
        sendError(connection.ws, message.id, -32601, 'Method not found');
    }
  } else if (message.id) {
    // Handle response to previous request
    console.log(`[MCP-WS] Received response for request ${message.id}`);
  }
}

async function handleAuth(connection: SwarmConnection, message: MCPMessage) {
  const { token, swarmId, agentId } = message.params || {};
  
  // Validate token (simplified for demo)
  if (token === process.env.MCP_API_KEY || token === 'demo-token') {
    connection.authenticated = true;
    connection.swarmId = swarmId;
    connection.agentId = agentId;
    
    sendResponse(connection.ws, message.id, {
      authenticated: true,
      connectionId: connection.id
    });
    
    console.log(`[MCP-WS] Authenticated: ${connection.id} as agent ${agentId} in swarm ${swarmId}`);
  } else {
    sendError(connection.ws, message.id, -32000, 'Authentication failed');
  }
}

async function handleSwarmJoin(connection: SwarmConnection, message: MCPMessage) {
  if (!connection.authenticated) {
    sendError(connection.ws, message.id, -32000, 'Not authenticated');
    return;
  }

  const { swarmId, agentType, capabilities } = message.params || {};
  
  connection.swarmId = swarmId;
  
  // Notify other swarm members
  broadcastToSwarm(swarmId, {
    jsonrpc: '2.0',
    method: 'swarm.agent_joined',
    params: {
      agentId: connection.agentId,
      agentType,
      capabilities
    }
  }, connection.id);
  
  sendResponse(connection.ws, message.id, {
    joined: true,
    swarmId,
    members: getSwarmMembers(swarmId)
  });
}

async function handleSwarmBroadcast(connection: SwarmConnection, message: MCPMessage) {
  if (!connection.authenticated || !connection.swarmId) {
    sendError(connection.ws, message.id, -32000, 'Not in a swarm');
    return;
  }

  broadcastToSwarm(connection.swarmId, {
    jsonrpc: '2.0',
    method: 'swarm.message',
    params: {
      from: connection.agentId,
      ...message.params
    }
  }, connection.id);
  
  if (message.id) {
    sendResponse(connection.ws, message.id, { broadcasted: true });
  }
}

async function handleAgentUpdate(connection: SwarmConnection, message: MCPMessage) {
  if (!connection.authenticated) {
    sendError(connection.ws, message.id, -32000, 'Not authenticated');
    return;
  }

  const { status, metrics, currentTask } = message.params || {};
  
  // Broadcast agent status to swarm
  broadcastToSwarm(connection.swarmId, {
    jsonrpc: '2.0',
    method: 'agent.status_update',
    params: {
      agentId: connection.agentId,
      status,
      metrics,
      currentTask
    }
  });
  
  if (message.id) {
    sendResponse(connection.ws, message.id, { updated: true });
  }
}

async function handleTaskExecution(connection: SwarmConnection, message: MCPMessage) {
  if (!connection.authenticated) {
    sendError(connection.ws, message.id, -32000, 'Not authenticated');
    return;
  }

  const { taskId, taskType, payload } = message.params || {};
  
  // Simulate task execution (in production, would delegate to actual services)
  setTimeout(() => {
    sendMessage(connection.ws, {
      jsonrpc: '2.0',
      method: 'task.completed',
      params: {
        taskId,
        result: {
          success: true,
          output: `Completed ${taskType} task`,
          data: payload
        }
      }
    });
  }, 2000);
  
  sendResponse(connection.ws, message.id, {
    taskId,
    status: 'executing'
  });
}

async function handleRealtimeSync(connection: SwarmConnection, message: MCPMessage) {
  if (!connection.authenticated) {
    sendError(connection.ws, message.id, -32000, 'Not authenticated');
    return;
  }

  const { sessionId, data } = message.params || {};
  
  // Broadcast sync data to all connections in session
  for (const [id, conn] of connections) {
    if (conn.swarmId === sessionId && id !== connection.id) {
      sendMessage(conn.ws, {
        jsonrpc: '2.0',
        method: 'realtime.update',
        params: {
          from: connection.agentId,
          data
        }
      });
    }
  }
  
  if (message.id) {
    sendResponse(connection.ws, message.id, { synced: true });
  }
}

// Helper functions

function generateConnectionId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function sendMessage(ws: any, message: MCPMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendResponse(ws: any, id: any, result: any): void {
  if (id) {
    sendMessage(ws, {
      jsonrpc: '2.0',
      id,
      result
    });
  }
}

function sendError(ws: any, id: any, code: number, message: string): void {
  sendMessage(ws, {
    jsonrpc: '2.0',
    id,
    error: { code, message }
  });
}

function broadcastToSwarm(swarmId: string | undefined, message: MCPMessage, excludeId?: string): void {
  if (!swarmId) return;
  
  for (const [id, connection] of connections) {
    if (connection.swarmId === swarmId && id !== excludeId) {
      sendMessage(connection.ws, message);
    }
  }
}

function getSwarmMembers(swarmId: string): Array<{ agentId: string; connectionId: string }> {
  const members: Array<{ agentId: string; connectionId: string }> = [];
  
  for (const [id, connection] of connections) {
    if (connection.swarmId === swarmId && connection.agentId) {
      members.push({
        agentId: connection.agentId,
        connectionId: id
      });
    }
  }
  
  return members;
}