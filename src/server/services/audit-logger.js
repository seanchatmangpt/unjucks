import { dbManager } from '../config/database.js';
import { env } from '../config/environment.js';
import crypto from 'crypto';

/**
 * @typedef {Object} AuditEvent
 * @property {string} [id]
 * @property {string} tenantId
 * @property {string} userId
 * @property {string} action
 * @property {string} resource
 * @property {string} [resourceId]
 * @property {Object<string, any>} details
 * @property {string} ipAddress
 * @property {string} userAgent
 * @property {Date} timestamp
 * @property {'low'|'medium'|'high'|'critical'} severity
 * @property {'auth'|'data'|'admin'|'system'|'security'} category
 * @property {'success'|'failure'|'error'} outcome
 * @property {Object<string, any>} [metadata]
 */

/**
 * @typedef {Object} SIEMIntegration
 * @property {boolean} enabled
 * @property {string} [webhookUrl]
 * @property {string} [apiKey]
 * @property {number} batchSize
 * @property {number} flushInterval
 */

class AuditLogger {
  constructor() {
    /** @type {AuditEvent[]} */
    this.eventQueue = [];
    
    /** @type {SIEMIntegration} */
    this.siemConfig = {
      enabled: !!(env.SIEM_WEBHOOK_URL && env.SIEM_API_KEY),
      webhookUrl: env.SIEM_WEBHOOK_URL,
      apiKey: env.SIEM_API_KEY,
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
    };

    /** @type {NodeJS.Timeout} */
    this.flushTimer = undefined;

    if (this.siemConfig.enabled) {
      this.startBatchProcessor();
    }
  }

  /**
   * Log an audit event
   * @param {Omit<AuditEvent, 'id' | 'timestamp'>} event - Event data
   */
  async log(event) {
    /** @type {AuditEvent} */
    const auditEvent = {
      ...event,
      timestamp: this.getDeterministicDate(),
    };

    // Add integrity checksum
    const eventData = JSON.stringify({
      tenantId: auditEvent.tenantId,
      userId: auditEvent.userId,
      action: auditEvent.action,
      resource: auditEvent.resource,
      timestamp: auditEvent.timestamp.toISOString(),
      details: auditEvent.details
    });
    auditEvent.metadata = {
      ...auditEvent.metadata,
      checksum: crypto.createHash('sha256').update(eventData).digest('hex')
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

  /**
   * Store event in database
   * @param {AuditEvent} event - Event to store
   */
  async storeEvent(event) {
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

  /**
   * Log event to console
   * @param {AuditEvent} event - Event to log
   */
  logToConsole(event) {
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

  /**
   * Get console log level based on severity
   * @param {AuditEvent['severity']} severity - Event severity
   * @returns {'error'|'warn'|'info'|'debug'}
   */
  getLogLevel(severity) {
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

  /**
   * Start batch processor for SIEM integration
   */
  startBatchProcessor() {
    this.flushTimer = setInterval(async () => {
      if (this.eventQueue.length > 0) {
        await this.flushToSIEM();
      }
    }, this.siemConfig.flushInterval);
  }

  /**
   * Flush events to SIEM system
   */
  async flushToSIEM() {
    if (!this.siemConfig.enabled || this.eventQueue.length === 0) {
      return;
    }

    const events = this.eventQueue.splice(0, this.siemConfig.batchSize);

    try {
      const response = await fetch(this.siemConfig.webhookUrl, {
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
            timestamp: this.getDeterministicDate().toISOString(),
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

  /**
   * Log authentication event
   * @param {import('../auth/enterprise-auth.js').User} user - User object
   * @param {import('../middleware/tenant-isolation.js').TenantContext} tenant - Tenant context
   * @param {import('express').Request} req - Express request
   * @param {AuditEvent['outcome']} outcome - Event outcome
   * @param {Object<string, any>} [details] - Additional details
   */
  async logAuthentication(user, tenant, req, outcome, details = {}) {
    await this.log({
      tenantId: tenant.tenantId,
      userId: user.id,
      action: 'authentication',
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

  /**
   * Log data access event
   * @param {import('../auth/enterprise-auth.js').User} user - User object
   * @param {import('../middleware/tenant-isolation.js').TenantContext} tenant - Tenant context
   * @param {import('express').Request} req - Express request
   * @param {string} resource - Resource name
   * @param {string} resourceId - Resource ID
   * @param {string} action - Action performed
   * @param {AuditEvent['outcome']} outcome - Event outcome
   * @param {Object<string, any>} [details] - Additional details
   */
  async logDataAccess(user, tenant, req, resource, resourceId, action, outcome, details = {}) {
    await this.log({
      tenantId: tenant.tenantId,
      userId: user.id,
      action: 'data_access',
      resource,
      resourceId,
      details: { ...details, dataAction: action },
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      severity: this.getDataAccessSeverity(action),
      category: 'data',
      outcome,
    });
  }

  /**
   * Log admin action event
   * @param {import('../auth/enterprise-auth.js').User} user - User object
   * @param {import('../middleware/tenant-isolation.js').TenantContext} tenant - Tenant context
   * @param {import('express').Request} req - Express request
   * @param {string} action - Action performed
   * @param {string} resource - Resource name
   * @param {string} resourceId - Resource ID
   * @param {AuditEvent['outcome']} outcome - Event outcome
   * @param {Object<string, any>} [details] - Additional details
   */
  async logAdminAction(user, tenant, req, action, resource, resourceId, outcome, details = {}) {
    await this.log({
      tenantId: tenant.tenantId,
      userId: user.id,
      action: 'admin_action',
      resource,
      resourceId,
      details: { ...details, adminAction: action },
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      severity: 'high',
      category: 'admin',
      outcome,
    });
  }

  /**
   * Log security event
   * @param {string} tenantId - Tenant ID
   * @param {string} userId - User ID
   * @param {import('express').Request} req - Express request
   * @param {string} action - Action performed
   * @param {Object<string, any>} details - Event details
   * @param {AuditEvent['severity']} [severity='high'] - Event severity
   */
  async logSecurityEvent(tenantId, userId, req, action, details, severity = 'high') {
    await this.log({
      tenantId,
      userId,
      action: 'security_event',
      resource: 'security',
      details: { ...details, securityAction: action },
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      severity,
      category: 'security',
      outcome: 'success',
    });
  }

  /**
   * Get client IP address from request
   * @param {import('express').Request} req - Express request
   * @returns {string} Client IP address
   */
  getClientIP(req) {
    return (
      req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      req.get('X-Real-IP') ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Get severity based on data access action
   * @param {string} action - Action name
   * @returns {AuditEvent['severity']}
   */
  getDataAccessSeverity(action) {
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

  /**
   * Get audit history
   * @param {string} tenantId - Tenant ID
   * @param {Object} [filters] - Filter options
   * @param {string} [filters.userId] - User ID
   * @param {string} [filters.resource] - Resource name
   * @param {string} [filters.action] - Action name
   * @param {AuditEvent['category']} [filters.category] - Event category
   * @param {AuditEvent['severity']} [filters.severity] - Event severity
   * @param {Date} [filters.startDate] - Start date
   * @param {Date} [filters.endDate] - End date
   * @param {number} [filters.limit] - Result limit
   * @param {number} [filters.offset] - Result offset
   * @returns {Promise<{events: AuditEvent[], total: number}>}
   */
  async getAuditHistory(tenantId, filters = {}) {
    const conditions = ['tenant_id = $1'];
    const values = [tenantId];
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

    /** @type {AuditEvent[]} */
    const events = eventsResult.rows.map(row => ({
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

  /**
   * Cleanup resources
   */
  async destroy() {
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