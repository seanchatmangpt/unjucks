/**
 * Real-time collaboration MCP tool for multi-user template editing
 */

import type { ToolResult } from '../types.js';
import { createJSONToolResult, handleToolError } from '../utils.js';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface CollaborationParams {
  action: 'join' | 'leave' | 'update' | 'sync' | 'presence' | 'cursor' | 'message';
  sessionId?: string;
  userId?: string;
  data?: {
    content?: string;
    cursor?: { line: number; column: number };
    selection?: { start: number; end: number };
    presence?: { status: string; lastActivity: string };
    message?: string;
    changes?: Array<{
      type: 'insert' | 'delete' | 'replace';
      position: number;
      content?: string;
      length?: number;
    }>;
  };
}

interface CollaborationSession {
  id: string;
  name: string;
  template: string;
  participants: Map<string, Participant>;
  content: string;
  version: number;
  operations: Operation[];
  createdAt: Date;
  lastActivity: Date;
}

interface Participant {
  id: string;
  name: string;
  color: string;
  cursor: { line: number; column: number };
  selection?: { start: number; end: number };
  presence: 'active' | 'idle' | 'away';
  lastActivity: Date;
}

interface Operation {
  id: string;
  userId: string;
  timestamp: Date;
  type: 'insert' | 'delete' | 'replace';
  position: number;
  content?: string;
  length?: number;
  version: number;
}

// Global collaboration state
const sessions = new Map<string, CollaborationSession>();
const eventEmitter = new EventEmitter();

/**
 * Real-time collaboration handler
 */
export async function unjucksRealtimeCollab(params: CollaborationParams): Promise<ToolResult> {
  try {
    const { action } = params;

    switch (action) {
      case 'join':
        return await joinSession(params);
      
      case 'leave':
        return await leaveSession(params);
      
      case 'update':
        return await updateContent(params);
      
      case 'sync':
        return await syncSession(params);
      
      case 'presence':
        return await updatePresence(params);
      
      case 'cursor':
        return await updateCursor(params);
      
      case 'message':
        return await sendMessage(params);
      
      default:
        return createJSONToolResult({
          error: `Unknown action: ${action}`
        });
    }
  } catch (error) {
    return handleToolError(error, 'unjucks_realtime_collab', 'collaboration');
  }
}

async function joinSession(params: CollaborationParams): Promise<ToolResult> {
  const sessionId = params.sessionId || crypto.randomBytes(16).toString('hex');
  const userId = params.userId || 'user_' + Date.now();
  
  let session = sessions.get(sessionId);
  
  if (!session) {
    // Create new session
    session = {
      id: sessionId,
      name: `Template Editing Session`,
      template: 'component/react',
      participants: new Map(),
      content: '// Start collaborating on your template\n',
      version: 0,
      operations: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };
    sessions.set(sessionId, session);
  }

  // Add participant
  const participant: Participant = {
    id: userId,
    name: `User ${userId.slice(-4)}`,
    color: '#' + Math.floor(Math.random()*16777215).toString(16),
    cursor: { line: 0, column: 0 },
    presence: 'active',
    lastActivity: new Date()
  };
  
  session.participants.set(userId, participant);
  session.lastActivity = new Date();

  // Notify other participants
  broadcastToSession(sessionId, userId, {
    type: 'participant_joined',
    participant: {
      id: participant.id,
      name: participant.name,
      color: participant.color
    }
  });

  return createJSONToolResult({
    success: true,
    sessionId,
    userId,
    session: {
      id: session.id,
      name: session.name,
      template: session.template,
      participants: Array.from(session.participants.values()).map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        presence: p.presence
      })),
      content: session.content,
      version: session.version
    }
  });
}

async function leaveSession(params: CollaborationParams): Promise<ToolResult> {
  const { sessionId, userId } = params;
  
  if (!sessionId || !userId) {
    return createJSONToolResult({
      error: 'Session ID and User ID required'
    });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return createJSONToolResult({
      error: 'Session not found'
    });
  }

  const participant = session.participants.get(userId);
  if (participant) {
    session.participants.delete(userId);
    
    // Notify other participants
    broadcastToSession(sessionId, userId, {
      type: 'participant_left',
      userId
    });
  }

  // Clean up empty sessions
  if (session.participants.size === 0) {
    sessions.delete(sessionId);
  }

  return createJSONToolResult({
    success: true,
    message: 'Left collaboration session'
  });
}

async function updateContent(params: CollaborationParams): Promise<ToolResult> {
  const { sessionId, userId, data } = params;
  
  if (!sessionId || !userId || !data?.changes) {
    return createJSONToolResult({
      error: 'Session ID, User ID, and changes required'
    });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return createJSONToolResult({
      error: 'Session not found'
    });
  }

  // Apply operational transformation for each change
  const transformedOperations: Operation[] = [];
  
  for (const change of data.changes) {
    const operation: Operation = {
      id: crypto.randomBytes(8).toString('hex'),
      userId,
      timestamp: new Date(),
      type: change.type,
      position: change.position,
      content: change.content,
      length: change.length,
      version: session.version + 1
    };
    
    // Apply operation to content (simplified OT)
    let content = session.content;
    switch (change.type) {
      case 'insert':
        if (change.content) {
          content = content.slice(0, change.position) + 
                   change.content + 
                   content.slice(change.position);
        }
        break;
      case 'delete':
        if (change.length) {
          content = content.slice(0, change.position) + 
                   content.slice(change.position + change.length);
        }
        break;
      case 'replace':
        if (change.length && change.content) {
          content = content.slice(0, change.position) + 
                   change.content + 
                   content.slice(change.position + change.length);
        }
        break;
    }
    
    session.content = content;
    session.version++;
    session.operations.push(operation);
    transformedOperations.push(operation);
  }
  
  session.lastActivity = new Date();
  
  // Update participant activity
  const participant = session.participants.get(userId);
  if (participant) {
    participant.lastActivity = new Date();
    participant.presence = 'active';
  }

  // Broadcast changes to other participants
  broadcastToSession(sessionId, userId, {
    type: 'content_updated',
    operations: transformedOperations,
    version: session.version
  });

  return createJSONToolResult({
    success: true,
    version: session.version,
    operations: transformedOperations
  });
}

async function syncSession(params: CollaborationParams): Promise<ToolResult> {
  const { sessionId } = params;
  
  if (!sessionId) {
    return createJSONToolResult({
      error: 'Session ID required'
    });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return createJSONToolResult({
      error: 'Session not found'
    });
  }

  return createJSONToolResult({
    success: true,
    session: {
      id: session.id,
      name: session.name,
      template: session.template,
      content: session.content,
      version: session.version,
      participants: Array.from(session.participants.values()).map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        cursor: p.cursor,
        selection: p.selection,
        presence: p.presence
      })),
      operations: session.operations.slice(-50) // Last 50 operations
    }
  });
}

async function updatePresence(params: CollaborationParams): Promise<ToolResult> {
  const { sessionId, userId, data } = params;
  
  if (!sessionId || !userId || !data?.presence) {
    return createJSONToolResult({
      error: 'Session ID, User ID, and presence data required'
    });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return createJSONToolResult({
      error: 'Session not found'
    });
  }

  const participant = session.participants.get(userId);
  if (!participant) {
    return createJSONToolResult({
      error: 'Participant not found'
    });
  }

  // Update presence
  participant.presence = data.presence.status as 'active' | 'idle' | 'away';
  participant.lastActivity = new Date();
  
  // Broadcast presence update
  broadcastToSession(sessionId, userId, {
    type: 'presence_updated',
    userId,
    presence: participant.presence
  });

  return createJSONToolResult({
    success: true,
    presence: participant.presence
  });
}

async function updateCursor(params: CollaborationParams): Promise<ToolResult> {
  const { sessionId, userId, data } = params;
  
  if (!sessionId || !userId || !data?.cursor) {
    return createJSONToolResult({
      error: 'Session ID, User ID, and cursor data required'
    });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return createJSONToolResult({
      error: 'Session not found'
    });
  }

  const participant = session.participants.get(userId);
  if (!participant) {
    return createJSONToolResult({
      error: 'Participant not found'
    });
  }

  // Update cursor position
  participant.cursor = data.cursor;
  if (data.selection) {
    participant.selection = data.selection;
  }
  
  // Broadcast cursor update
  broadcastToSession(sessionId, userId, {
    type: 'cursor_updated',
    userId,
    cursor: participant.cursor,
    selection: participant.selection,
    color: participant.color
  });

  return createJSONToolResult({
    success: true,
    cursor: participant.cursor,
    selection: participant.selection
  });
}

async function sendMessage(params: CollaborationParams): Promise<ToolResult> {
  const { sessionId, userId, data } = params;
  
  if (!sessionId || !userId || !data?.message) {
    return createJSONToolResult({
      error: 'Session ID, User ID, and message required'
    });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return createJSONToolResult({
      error: 'Session not found'
    });
  }

  const participant = session.participants.get(userId);
  if (!participant) {
    return createJSONToolResult({
      error: 'Participant not found'
    });
  }

  // Broadcast message
  const messageData = {
    id: crypto.randomBytes(8).toString('hex'),
    userId,
    userName: participant.name,
    message: data.message,
    timestamp: new Date().toISOString()
  };
  
  broadcastToSession(sessionId, userId, {
    type: 'message_sent',
    message: messageData
  });

  return createJSONToolResult({
    success: true,
    message: messageData
  });
}

function broadcastToSession(sessionId: string, senderId: string, data: any): void {
  // Emit event for WebSocket server to broadcast
  eventEmitter.emit('broadcast', {
    sessionId,
    senderId,
    data
  });
  
  // Log for debugging
  if (process.env.DEBUG_COLLAB) {
    console.error(`[Collab] Broadcasting to session ${sessionId}:`, data.type);
  }
}

// Export schema for tool registration
export const unjucksRealtimeCollabSchema = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['join', 'leave', 'update', 'sync', 'presence', 'cursor', 'message'],
      description: 'Collaboration action'
    },
    sessionId: {
      type: 'string',
      description: 'Collaboration session ID'
    },
    userId: {
      type: 'string',
      description: 'User identifier'
    },
    data: {
      type: 'object',
      description: 'Action-specific data'
    }
  },
  required: ['action']
};