import { Request } from 'express';
import { User } from '../auth/enterprise-auth.js';
import { TenantContext } from '../middleware/tenant-isolation.js';
import { dbManager } from '../config/database.js';
import { env } from '../config/environment.js';

export interface AuditEvent {
  id?: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'auth' | 'data' | 'admin' | 'system' | 'security';
  outcome: 'success' | 'failure' | 'error';
  metadata?: Record<string, any>;
}

export interface SIEMIntegration {
  enabled: boolean;
  webhookUrl?: string;
  apiKey?: string;
  batchSize: number;
  flushInterval: number;
}

class AuditLogger {
  private eventQueue: AuditEvent[] = [];
  private siemConfig: SIEMIntegration;
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.siemConfig = {
      enabled: !!(env.SIEM_WEBHOOK_URL && env.SIEM_API_KEY),
      webhookUrl: env.SIEM_WEBHOOK_URL,
      apiKey: env.SIEM_API_KEY,
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
    };

    if (this.siemConfig.enabled) {
      this.startBatchProcessor();
    }
  }

  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      ...event,
      timestamp: new Date(),
    };

    try {
      // Store in database
      await this.storeEvent(auditEvent);

      // Add to SIEM queue if enabled
      if (this.siemConfig.enabled) {
        this.eventQueue.push(auditEvent);
        
        // Flush immediately for critical events
        if (event.severity === 'critical') {
          await this.flushToSIEM();
        }
      }

      // Console logging based on severity
      this.logToConsole(auditEvent);
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Fallback to console logging
      this.logToConsole(auditEvent);
    }
  }

  private async storeEvent(event: AuditEvent): Promise<void> {
    const query = `
      INSERT INTO audit_logs (
        tenant_id, user_id, action, resource, resource_id, details,
        ip_address, user_agent, timestamp, severity, category, outcome, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;

    await dbManager.postgres.query(query, [
      event.tenantId,
      event.userId,
      event.action,
      event.resource,
      event.resourceId,
      JSON.stringify(event.details),
      event.ipAddress,
      event.userAgent,
      event.timestamp,
      event.severity,
      event.category,
      event.outcome,
      JSON.stringify(event.metadata || {}),
    ]);
  }

  private logToConsole(event: AuditEvent): void {
    const logLevel = this.getLogLevel(event.severity);
    const message = `[AUDIT] ${event.action} on ${event.resource} by user ${event.userId} - ${event.outcome}`;
    
    console[logLevel](message, {
      tenantId: event.tenantId,
      resourceId: event.resourceId,
      category: event.category,
      severity: event.severity,
      ipAddress: event.ipAddress,
      timestamp: event.timestamp.toISOString(),
      details: event.details,
    });
  }

  private getLogLevel(severity: AuditEvent['severity']): 'error' | 'warn' | 'info' | 'debug' {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warn';
      case 'medium':
        return 'info';
      case 'low':
        return 'debug';
      default:
        return 'info';
    }
  }

  private startBatchProcessor(): void {
    this.flushTimer = setInterval(async () => {
      if (this.eventQueue.length > 0) {
        await this.flushToSIEM();
      }
    }, this.siemConfig.flushInterval);
  }

  private async flushToSIEM(): Promise<void> {
    if (!this.siemConfig.enabled || this.eventQueue.length === 0) {
      return;
    }

    const events = this.eventQueue.splice(0, this.siemConfig.batchSize);

    try {
      const response = await fetch(this.siemConfig.webhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.siemConfig.apiKey}`,
          'X-Source': 'unjucks-enterprise',
        },
        body: JSON.stringify({
          events,
          metadata: {
            source: 'unjucks-enterprise',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            count: events.length,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`SIEM webhook failed: ${response.status} ${response.statusText}`);
      }

      console.log(`Successfully sent ${events.length} audit events to SIEM`);
    } catch (error) {
      console.error('Failed to send events to SIEM:', error);
      
      // Re-queue events for retry (max 3 attempts)
      const retriableEvents = events.filter(event => 
        !event.metadata?.retryCount || event.metadata.retryCount < 3
      );
      
      retriableEvents.forEach(event => {
        event.metadata = {
          ...event.metadata,
          retryCount: (event.metadata?.retryCount || 0) + 1,
        };
      });
      
      this.eventQueue.unshift(...retriableEvents);
    }
  }

  // Convenience methods for common audit events
  async logAuthentication(
    user: User,
    tenant: TenantContext,
    req: Request,
    outcome: AuditEvent['outcome'],
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.log({
      tenantId: tenant.tenantId,
      userId: user.id,
      action: 'authenticate',
      resource: 'user_session',
      details: {
        provider: user.provider,
        roles: user.roles,
        ...details,
      },
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      severity: outcome === 'success' ? 'low' : 'medium',
      category: 'auth',
      outcome,
    });
  }

  async logDataAccess(
    user: User,
    tenant: TenantContext,
    req: Request,
    resource: string,
    resourceId: string,
    action: string,
    outcome: AuditEvent['outcome'],
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.log({
      tenantId: tenant.tenantId,
      userId: user.id,
      action,
      resource,
      resourceId,
      details,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      severity: this.getDataAccessSeverity(action),
      category: 'data',
      outcome,
    });
  }

  async logAdminAction(
    user: User,
    tenant: TenantContext,
    req: Request,
    action: string,
    resource: string,
    resourceId: string,
    outcome: AuditEvent['outcome'],
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.log({
      tenantId: tenant.tenantId,
      userId: user.id,
      action,
      resource,
      resourceId,
      details,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      severity: 'high',
      category: 'admin',
      outcome,
    });
  }

  async logSecurityEvent(
    tenantId: string,
    userId: string,
    req: Request,
    action: string,
    details: Record<string, any>,
    severity: AuditEvent['severity'] = 'high'
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action,
      resource: 'security',
      details,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      severity,
      category: 'security',
      outcome: 'success',
    });
  }

  private getClientIP(req: Request): string {
    return (
      req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      req.get('X-Real-IP') ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  private getDataAccessSeverity(action: string): AuditEvent['severity'] {
    switch (action.toLowerCase()) {
      case 'create':
      case 'update':
      case 'delete':
        return 'medium';
      case 'read':
      case 'list':
        return 'low';
      case 'bulk_delete':
      case 'export':
        return 'high';
      default:
        return 'medium';
    }
  }

  async getAuditHistory(
    tenantId: string,
    filters: {
      userId?: string;
      resource?: string;
      action?: string;
      category?: AuditEvent['category'];
      severity?: AuditEvent['severity'];
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ events: AuditEvent[]; total: number }> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex}`);
      values.push(filters.userId);
      paramIndex++;
    }

    if (filters.resource) {
      conditions.push(`resource = $${paramIndex}`);
      values.push(filters.resource);
      paramIndex++;
    }

    if (filters.action) {
      conditions.push(`action = $${paramIndex}`);
      values.push(filters.action);
      paramIndex++;
    }

    if (filters.category) {
      conditions.push(`category = $${paramIndex}`);
      values.push(filters.category);
      paramIndex++;
    }

    if (filters.severity) {
      conditions.push(`severity = $${paramIndex}`);
      values.push(filters.severity);
      paramIndex++;
    }

    if (filters.startDate) {
      conditions.push(`timestamp >= $${paramIndex}`);
      values.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      conditions.push(`timestamp <= $${paramIndex}`);
      values.push(filters.endDate);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM audit_logs WHERE ${whereClause}`;
    const countResult = await dbManager.postgres.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get events
    const eventsQuery = `
      SELECT * FROM audit_logs 
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const eventsResult = await dbManager.postgres.query(eventsQuery, [
      ...values,
      limit,
      offset,
    ]);

    const events: AuditEvent[] = eventsResult.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      action: row.action,
      resource: row.resource,
      resourceId: row.resource_id,
      details: row.details,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      timestamp: row.timestamp,
      severity: row.severity,
      category: row.category,
      outcome: row.outcome,
      metadata: row.metadata,
    }));

    return { events, total };
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Flush remaining events
    if (this.eventQueue.length > 0) {
      await this.flushToSIEM();
    }
  }
}

export const auditLogger = new AuditLogger();