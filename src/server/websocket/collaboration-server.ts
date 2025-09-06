import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import jwt from 'jsonwebtoken';
import { env } from '../config/environment.js';
import { User } from '../auth/enterprise-auth.js';
import { TenantContext } from '../middleware/tenant-isolation.js';
import { auditLogger } from '../services/audit-logger.js';
import { dbManager } from '../config/database.js';

export interface WSMessage {
  type: string;
  payload: any;
  requestId?: string;
  timestamp: number;
}

export interface CollaborationRoom {
  id: string;
  tenantId: string;
  resourceType: 'template' | 'project' | 'generator';
  resourceId: string;
  participants: Map<string, ParticipantInfo>;
  createdAt: Date;
  lastActivity: Date;
}

export interface ParticipantInfo {
  userId: string;
  user: User;
  tenant: TenantContext;
  ws: WebSocket;
  joinedAt: Date;
  lastSeen: Date;
  cursor?: {
    x: number;
    y: number;
    selection?: {
      start: number;
      end: number;
      file?: string;
    };
  };
  presence: 'active' | 'idle' | 'away';
}

export interface CollaborationEvent {
  type: 'join' | 'leave' | 'cursor_move' | 'selection_change' | 'edit' | 'comment' | 'status_change';
  roomId: string;
  userId: string;
  data: any;
  timestamp: Date;
}

class CollaborationServer {
  private wss: WebSocketServer;
  private rooms = new Map<string, CollaborationRoom>();
  private userConnections = new Map<string, Set<string>>(); // userId -> Set of roomIds
  private heartbeatInterval: NodeJS.Timeout;
  private cleanupInterval: NodeJS.Timeout;

  constructor(server: any) {
    this.wss = new WebSocketServer({
      server,
      port: env.WS_PORT,
      path: '/ws/collaboration',
      verifyClient: this.verifyClient.bind(this),
    });

    this.setupEventHandlers();
    this.startHeartbeat();
    this.startCleanup();
  }

  private async verifyClient(info: {
    origin: string;
    secure: boolean;
    req: IncomingMessage;
  }): Promise<boolean> {
    try {
      const { query } = parse(info.req.url || '', true);
      const token = query.token as string;

      if (!token) {
        return false;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      
      // Store user info in request for later use
      (info.req as any).user = decoded;
      
      return true;
    } catch (error) {
      console.error('WebSocket auth error:', error);
      return false;
    }
  }

  private setupEventHandlers(): void {
    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    console.log(`Collaboration WebSocket server running on port ${env.WS_PORT}`);
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    const user = (req as any).user;
    const { query } = parse(req.url || '', true);
    const roomId = query.roomId as string;

    if (!roomId) {
      ws.close(1002, 'Room ID required');
      return;
    }

    try {
      // Get user and tenant info
      const userInfo = await this.getUserInfo(user.sub);
      const tenantInfo = await this.getTenantInfo(user.tenantId);

      if (!userInfo || !tenantInfo) {
        ws.close(1002, 'Invalid user or tenant');
        return;
      }

      // Join room
      await this.joinRoom(roomId, userInfo, tenantInfo, ws);

      // Setup message handlers
      ws.on('message', async (data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          await this.handleMessage(roomId, userInfo.id, message);
        } catch (error) {
          console.error('Message handling error:', error);
          this.sendError(ws, 'INVALID_MESSAGE', 'Failed to process message');
        }
      });

      ws.on('close', async () => {
        await this.leaveRoom(roomId, userInfo.id);
      });

      ws.on('error', (error) => {
        console.error('WebSocket connection error:', error);
      });

      // Send initial room state
      await this.sendRoomState(roomId, userInfo.id);

    } catch (error) {
      console.error('Connection setup error:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  private async joinRoom(
    roomId: string,
    user: User,
    tenant: TenantContext,
    ws: WebSocket
  ): Promise<void> {
    let room = this.rooms.get(roomId);

    if (!room) {
      // Create new room
      room = {
        id: roomId,
        tenantId: tenant.tenantId,
        resourceType: this.parseResourceType(roomId),
        resourceId: this.parseResourceId(roomId),
        participants: new Map(),
        createdAt: new Date(),
        lastActivity: new Date(),
      };
      this.rooms.set(roomId, room);
    }

    // Validate tenant access
    if (room.tenantId !== tenant.tenantId) {
      throw new Error('Unauthorized access to room');
    }

    // Add participant
    const participant: ParticipantInfo = {
      userId: user.id,
      user,
      tenant,
      ws,
      joinedAt: new Date(),
      lastSeen: new Date(),
      presence: 'active',
    };

    room.participants.set(user.id, participant);
    room.lastActivity = new Date();

    // Track user connections
    if (!this.userConnections.has(user.id)) {
      this.userConnections.set(user.id, new Set());
    }
    this.userConnections.get(user.id)!.add(roomId);

    // Broadcast join event
    await this.broadcastToRoom(roomId, {
      type: 'participant_joined',
      payload: {
        userId: user.id,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
        joinedAt: participant.joinedAt,
      },
      timestamp: Date.now(),
    }, user.id);

    // Store in database for persistence
    await this.storeRoomActivity(roomId, {
      type: 'join',
      roomId,
      userId: user.id,
      data: { participant: participant.user },
      timestamp: new Date(),
    });

    // Audit log
    await auditLogger.log({
      tenantId: tenant.tenantId,
      userId: user.id,
      action: 'join_collaboration',
      resource: 'websocket_room',
      resourceId: roomId,
      details: {
        roomType: room.resourceType,
        resourceId: room.resourceId,
      },
      ipAddress: this.getClientIP(ws),
      userAgent: 'websocket-client',
      severity: 'low',
      category: 'data',
      outcome: 'success',
    });
  }

  private async leaveRoom(roomId: string, userId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(userId);
    if (!participant) return;

    // Remove participant
    room.participants.delete(userId);
    room.lastActivity = new Date();

    // Update user connections
    const userRooms = this.userConnections.get(userId);
    if (userRooms) {
      userRooms.delete(roomId);
      if (userRooms.size === 0) {
        this.userConnections.delete(userId);
      }
    }

    // Broadcast leave event
    await this.broadcastToRoom(roomId, {
      type: 'participant_left',
      payload: {
        userId,
        leftAt: new Date(),
      },
      timestamp: Date.now(),
    });

    // Store activity
    await this.storeRoomActivity(roomId, {
      type: 'leave',
      roomId,
      userId,
      data: {},
      timestamp: new Date(),
    });

    // Remove empty rooms
    if (room.participants.size === 0) {
      this.rooms.delete(roomId);
    }

    // Audit log
    await auditLogger.log({
      tenantId: participant.tenant.tenantId,
      userId,
      action: 'leave_collaboration',
      resource: 'websocket_room',
      resourceId: roomId,
      details: {
        duration: Date.now() - participant.joinedAt.getTime(),
      },
      ipAddress: this.getClientIP(participant.ws),
      userAgent: 'websocket-client',
      severity: 'low',
      category: 'data',
      outcome: 'success',
    });
  }

  private async handleMessage(roomId: string, userId: string, message: WSMessage): Promise<void> {
    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(userId);

    if (!room || !participant) {
      return;
    }

    // Update last seen
    participant.lastSeen = new Date();
    participant.presence = 'active';
    room.lastActivity = new Date();

    switch (message.type) {
      case 'cursor_move':
        await this.handleCursorMove(roomId, userId, message.payload);
        break;

      case 'selection_change':
        await this.handleSelectionChange(roomId, userId, message.payload);
        break;

      case 'file_edit':
        await this.handleFileEdit(roomId, userId, message.payload);
        break;

      case 'comment':
        await this.handleComment(roomId, userId, message.payload);
        break;

      case 'status_change':
        await this.handleStatusChange(roomId, userId, message.payload);
        break;

      case 'typing_start':
      case 'typing_stop':
        await this.handleTypingIndicator(roomId, userId, message);
        break;

      case 'ping':
        this.sendToUser(roomId, userId, {
          type: 'pong',
          payload: { timestamp: Date.now() },
          requestId: message.requestId,
          timestamp: Date.now(),
        });
        break;

      default:
        this.sendError(participant.ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
    }
  }

  private async handleCursorMove(roomId: string, userId: string, payload: any): Promise<void> {
    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(userId);

    if (!participant) return;

    participant.cursor = {
      x: payload.x,
      y: payload.y,
      selection: payload.selection,
    };

    await this.broadcastToRoom(roomId, {
      type: 'cursor_moved',
      payload: {
        userId,
        cursor: participant.cursor,
      },
      timestamp: Date.now(),
    }, userId);
  }

  private async handleSelectionChange(roomId: string, userId: string, payload: any): Promise<void> {
    const room = this.rooms.get(roomId);
    const participant = room?.participants.get(userId);

    if (!participant) return;

    if (participant.cursor) {
      participant.cursor.selection = payload.selection;
    }

    await this.broadcastToRoom(roomId, {
      type: 'selection_changed',
      payload: {
        userId,
        selection: payload.selection,
      },
      timestamp: Date.now(),
    }, userId);
  }

  private async handleFileEdit(roomId: string, userId: string, payload: any): Promise<void> {
    await this.broadcastToRoom(roomId, {
      type: 'file_edited',
      payload: {
        userId,
        file: payload.file,
        changes: payload.changes,
        timestamp: payload.timestamp,
      },
      timestamp: Date.now(),
    }, userId);

    // Store in database
    await this.storeRoomActivity(roomId, {
      type: 'edit',
      roomId,
      userId,
      data: payload,
      timestamp: new Date(),
    });
  }

  private async handleComment(roomId: string, userId: string, payload: any): Promise<void> {
    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.broadcastToRoom(roomId, {
      type: 'comment_added',
      payload: {
        id: commentId,
        userId,
        content: payload.content,
        position: payload.position,
        file: payload.file,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    });

    // Store comment
    await this.storeRoomActivity(roomId, {
      type: 'comment',
      roomId,
      userId,
      data: { ...payload, commentId },
      timestamp: new Date(),
    });
  }

  private async handleStatusChange(roomId: string, userId: string, payload: any): Promise<void> {
    const participant = this.rooms.get(roomId)?.participants.get(userId);
    if (!participant) return;

    participant.presence = payload.status;

    await this.broadcastToRoom(roomId, {
      type: 'status_changed',
      payload: {
        userId,
        status: payload.status,
      },
      timestamp: Date.now(),
    }, userId);
  }

  private async handleTypingIndicator(roomId: string, userId: string, message: WSMessage): Promise<void> {
    await this.broadcastToRoom(roomId, {
      type: message.type,
      payload: {
        userId,
        file: message.payload?.file,
      },
      timestamp: Date.now(),
    }, userId);
  }

  private async broadcastToRoom(roomId: string, message: WSMessage, excludeUserId?: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const broadcastPromises: Promise<void>[] = [];

    for (const [participantId, participant] of room.participants) {
      if (excludeUserId && participantId === excludeUserId) continue;

      if (participant.ws.readyState === WebSocket.OPEN) {
        broadcastPromises.push(
          this.sendMessage(participant.ws, message)
        );
      }
    }

    await Promise.allSettled(broadcastPromises);
  }

  private sendToUser(roomId: string, userId: string, message: WSMessage): void {
    const participant = this.rooms.get(roomId)?.participants.get(userId);
    if (participant && participant.ws.readyState === WebSocket.OPEN) {
      this.sendMessage(participant.ws, message);
    }
  }

  private async sendMessage(ws: WebSocket, message: WSMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      ws.send(JSON.stringify(message), (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        payload: {
          code,
          message,
        },
        timestamp: Date.now(),
      }));
    }
  }

  private async sendRoomState(roomId: string, userId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const participants = Array.from(room.participants.values()).map(p => ({
      userId: p.userId,
      user: {
        id: p.user.id,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        email: p.user.email,
      },
      joinedAt: p.joinedAt,
      presence: p.presence,
      cursor: p.cursor,
    }));

    this.sendToUser(roomId, userId, {
      type: 'room_state',
      payload: {
        roomId,
        participants,
        createdAt: room.createdAt,
      },
      timestamp: Date.now(),
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const room of this.rooms.values()) {
        for (const [userId, participant] of room.participants) {
          if (participant.ws.readyState === WebSocket.OPEN) {
            participant.ws.ping();
            
            // Check for idle users
            const idleTime = Date.now() - participant.lastSeen.getTime();
            if (idleTime > 300000) { // 5 minutes
              participant.presence = 'idle';
            } else if (idleTime > 900000) { // 15 minutes
              participant.presence = 'away';
            }
          } else {
            // Clean up disconnected clients
            this.leaveRoom(room.id, userId);
          }
        }
      }
    }, env.WS_HEARTBEAT_INTERVAL);
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const inactiveRooms: string[] = [];

      for (const [roomId, room] of this.rooms) {
        // Remove empty rooms or inactive rooms (1 hour)
        if (room.participants.size === 0 || 
            now - room.lastActivity.getTime() > 3600000) {
          inactiveRooms.push(roomId);
        }
      }

      inactiveRooms.forEach(roomId => {
        this.rooms.delete(roomId);
      });

      if (inactiveRooms.length > 0) {
        console.log(`Cleaned up ${inactiveRooms.length} inactive collaboration rooms`);
      }
    }, 600000); // 10 minutes
  }

  private async getUserInfo(userId: string): Promise<User | null> {
    try {
      const query = `
        SELECT u.*, array_agg(r.name) as roles, array_agg(p.name) as permissions
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = $1 AND u.is_active = true
        GROUP BY u.id
      `;

      const result = await dbManager.postgres.query(query, [userId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error fetching user info:', error);
      return null;
    }
  }

  private async getTenantInfo(tenantId: string): Promise<TenantContext | null> {
    try {
      const query = `
        SELECT t.*, tq.*, tu.*
        FROM tenants t
        JOIN tenant_quotas tq ON t.id = tq.tenant_id
        LEFT JOIN tenant_usage tu ON t.id = tu.tenant_id
        WHERE t.id = $1 AND t.is_active = true
      `;

      const result = await dbManager.postgres.query(query, [tenantId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error fetching tenant info:', error);
      return null;
    }
  }

  private async storeRoomActivity(roomId: string, event: CollaborationEvent): Promise<void> {
    try {
      await dbManager.postgres.query(`
        INSERT INTO collaboration_events (room_id, type, user_id, data, timestamp)
        VALUES ($1, $2, $3, $4, $5)
      `, [roomId, event.type, event.userId, JSON.stringify(event.data), event.timestamp]);
    } catch (error) {
      console.error('Error storing room activity:', error);
    }
  }

  private parseResourceType(roomId: string): CollaborationRoom['resourceType'] {
    if (roomId.includes('template')) return 'template';
    if (roomId.includes('project')) return 'project';
    return 'generator';
  }

  private parseResourceId(roomId: string): string {
    const parts = roomId.split('_');
    return parts[parts.length - 1];
  }

  private getClientIP(ws: WebSocket): string {
    const req = (ws as any)._socket;
    return req?.remoteAddress || 'unknown';
  }

  getStats(): {
    activeRooms: number;
    totalParticipants: number;
    connectedUsers: number;
  } {
    const totalParticipants = Array.from(this.rooms.values())
      .reduce((sum, room) => sum + room.participants.size, 0);

    return {
      activeRooms: this.rooms.size,
      totalParticipants,
      connectedUsers: this.userConnections.size,
    };
  }

  async shutdown(): Promise<void> {
    clearInterval(this.heartbeatInterval);
    clearInterval(this.cleanupInterval);

    // Close all connections
    for (const room of this.rooms.values()) {
      for (const participant of room.participants.values()) {
        participant.ws.close(1001, 'Server shutting down');
      }
    }

    this.wss.close();
  }
}

export { CollaborationServer };