/**
 * Comprehensive Audit Logger
 * Enterprise-grade audit logging system for compliance and security monitoring
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { createHash, createHmac, randomBytes } from 'crypto';
import { EventEmitter } from 'events';

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  action: string;
  resource: string;
  resourceType: 'file' | 'database' | 'api' | 'system' | 'user' | 'configuration' | 'security';
  category: 'access' | 'authentication' | 'authorization' | 'data_change' | 'system_change' | 'security_event' | 'compliance_event';
  severity: 'low' | 'medium' | 'high' | 'critical';
  outcome: 'success' | 'failure' | 'partial';
  oldValue?: any;
  newValue?: any;
  metadata?: Record<string, any>;
  tags?: string[];
  compliance?: {
    sox?: boolean;
    gdpr?: boolean;
    pci?: boolean;
    hipaa?: boolean;
  };
  hash: string;
  signature?: string;
  correlationId?: string;
  parentEventId?: string;
}

export interface AuditQuery {
  startDate?: string;
  endDate?: string;
  userId?: string;
  action?: string;
  resource?: string;
  resourceType?: string;
  category?: string;
  severity?: string[];
  outcome?: string;
  tags?: string[];
  compliance?: string[];
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'severity' | 'outcome';
  orderDirection?: 'asc' | 'desc';
}

export interface AuditStatistics {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByOutcome: Record<string, number>;
  eventsByResourceType: Record<string, number>;
  topUsers: Array<{ userId: string; count: number }>;
  topActions: Array<{ action: string; count: number }>;
  topResources: Array<{ resource: string; count: number }>;
  complianceEvents: {
    sox: number;
    gdpr: number;
    pci: number;
    hipaa: number;
  };
  securityMetrics: {
    failedAuthentications: number;
    unauthorizedAccess: number;
    securityViolations: number;
    suspiciousActivity: number;
  };
  timeline: Array<{
    date: string;
    count: number;
    categories: Record<string, number>;
  }>;
}

export interface AuditAlert {
  id: string;
  name: string;
  description: string;
  condition: {
    eventCount?: number;
    timeWindow?: number; // minutes
    category?: string[];
    severity?: string[];
    action?: string[];
    user?: string[];
    resource?: string[];
  };
  enabled: boolean;
  notificationChannels: string[];
  cooldownPeriod: number; // minutes
  lastTriggered?: string;
}

export interface AuditLoggerConfig {
  logDir: string;
  indexDir: string;
  secretKey: string;
  rotationConfig: {
    maxFileSize: number; // MB
    maxFiles: number;
    rotateDaily: boolean;
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyDerivationRounds: number;
  };
  integrity: {
    enabled: boolean;
    algorithm: string;
    chainValidation: boolean;
  };
  retention: {
    defaultDays: number;
    complianceOverrides: {
      sox: number;
      gdpr: number;
      pci: number;
      hipaa: number;
    };
  };
  alerting: {
    enabled: boolean;
    alertsFile: string;
    checkInterval: number; // minutes
  };
  performance: {
    batchSize: number;
    flushInterval: number; // seconds
    enableIndexing: boolean;
    enableCompression: boolean;
  };
}

export class AuditLogger extends EventEmitter {
  private config: AuditLoggerConfig;
  private eventBuffer: AuditEvent[] = [];
  private lastFlush: number = Date.now();
  private alerts: AuditAlert[] = [];
  private alertLastCheck: number = Date.now();
  private eventIndex: Map<string, Set<string>> = new Map();
  private sequenceNumber: number = 0;
  private lastEventHash: string = '';

  constructor(config: AuditLoggerConfig) {
    super();
    this.config = config;
    this.ensureDirectories();
    this.loadAlerts();
    this.loadLastSequence();
    this.setupPeriodicTasks();
  }

  private ensureDirectories(): void {
    [
      this.config.logDir,
      this.config.indexDir,
      join(this.config.logDir, 'daily'),
      join(this.config.logDir, 'archive'),
      join(this.config.indexDir, 'users'),
      join(this.config.indexDir, 'actions'),
      join(this.config.indexDir, 'resources'),
      join(this.config.indexDir, 'compliance')
    ].forEach(dir => {
      try {
        mkdirSync(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    });
  }

  private loadAlerts(): void {
    try {
      if (existsSync(this.config.alerting.alertsFile)) {
        const content = readFileSync(this.config.alerting.alertsFile, 'utf-8');
        this.alerts = JSON.parse(content);
      } else {
        this.alerts = this.getDefaultAlerts();
        this.saveAlerts();
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
      this.alerts = this.getDefaultAlerts();
    }
  }

  private getDefaultAlerts(): AuditAlert[] {
    return [
      {
        id: 'failed-auth-burst',
        name: 'Failed Authentication Burst',
        description: 'Multiple failed authentication attempts from same user or IP',
        condition: {
          eventCount: 5,
          timeWindow: 5,
          category: ['authentication'],
          outcome: 'failure'
        },
        enabled: true,
        notificationChannels: ['email', 'sms', 'webhook'],
        cooldownPeriod: 15
      },
      {
        id: 'unauthorized-access',
        name: 'Unauthorized Access Attempt',
        description: 'Attempt to access restricted resources',
        condition: {
          eventCount: 1,
          timeWindow: 1,
          category: ['authorization'],
          severity: ['high', 'critical'],
          outcome: 'failure'
        },
        enabled: true,
        notificationChannels: ['email', 'webhook'],
        cooldownPeriod: 5
      },
      {
        id: 'data-modification',
        name: 'Critical Data Modification',
        description: 'Modification of critical system or compliance data',
        condition: {
          eventCount: 1,
          timeWindow: 1,
          category: ['data_change'],
          severity: ['critical'],
          resourceType: ['database', 'configuration']
        },
        enabled: true,
        notificationChannels: ['email', 'sms', 'webhook'],
        cooldownPeriod: 0
      },
      {
        id: 'compliance-violation',
        name: 'Compliance Violation Detected',
        description: 'Action that may violate compliance requirements',
        condition: {
          eventCount: 1,
          timeWindow: 1,
          category: ['compliance_event'],
          severity: ['high', 'critical']
        },
        enabled: true,
        notificationChannels: ['email', 'webhook'],
        cooldownPeriod: 5
      },
      {
        id: 'admin-activity-burst',
        name: 'Unusual Administrative Activity',
        description: 'High volume of administrative actions',
        condition: {
          eventCount: 20,
          timeWindow: 10,
          category: ['system_change'],
          severity: ['medium', 'high']
        },
        enabled: true,
        notificationChannels: ['email'],
        cooldownPeriod: 30
      }
    ];
  }

  private saveAlerts(): void {
    writeFileSync(this.config.alerting.alertsFile, JSON.stringify(this.alerts, null, 2), 'utf-8');
  }

  private loadLastSequence(): void {
    try {
      const sequenceFile = join(this.config.logDir, '.sequence');
      if (existsSync(sequenceFile)) {
        const data = JSON.parse(readFileSync(sequenceFile, 'utf-8'));
        this.sequenceNumber = data.sequence || 0;
        this.lastEventHash = data.lastHash || '';
      }
    } catch (error) {
      console.error('Error loading sequence:', error);
      this.sequenceNumber = 0;
      this.lastEventHash = '';
    }
  }

  private saveSequence(): void {
    const sequenceFile = join(this.config.logDir, '.sequence');
    const data = {
      sequence: this.sequenceNumber,
      lastHash: this.lastEventHash,
      timestamp: new Date().toISOString()
    };
    writeFileSync(sequenceFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  private setupPeriodicTasks(): void {
    // Flush buffer periodically
    setInterval(() => {
      this.flushBuffer();
    }, this.config.performance.flushInterval * 1000);

    // Check alerts periodically
    if (this.config.alerting.enabled) {
      setInterval(() => {
        this.checkAlerts();
      }, this.config.alerting.checkInterval * 60 * 1000);
    }

    // Rotate logs daily
    if (this.config.rotationConfig.rotateDaily) {
      setInterval(() => {
        this.rotateLogs();
      }, 24 * 60 * 60 * 1000);
    }
  }

  public log(event: Omit<AuditEvent, 'id' | 'timestamp' | 'hash'>): string {
    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      hash: ''
    };

    // Calculate hash
    auditEvent.hash = this.calculateEventHash(auditEvent);

    // Add signature if integrity is enabled
    if (this.config.integrity.enabled) {
      auditEvent.signature = this.signEvent(auditEvent);
    }

    // Update sequence
    this.sequenceNumber++;
    this.lastEventHash = auditEvent.hash;

    // Add to buffer
    this.eventBuffer.push(auditEvent);

    // Update indexes
    this.updateIndexes(auditEvent);

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.config.performance.batchSize) {
      this.flushBuffer();
    }

    // Emit event for real-time processing
    this.emit('audit-event', auditEvent);

    return auditEvent.id;
  }

  private generateEventId(): string {
    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    return `AUD-${timestamp}-${random}`;
  }

  private calculateEventHash(event: AuditEvent): string {
    const hashData = {
      id: event.id,
      timestamp: event.timestamp,
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      oldValue: event.oldValue,
      newValue: event.newValue,
      outcome: event.outcome,
      previousHash: this.lastEventHash,
      sequence: this.sequenceNumber
    };

    return createHash('sha256')
      .update(JSON.stringify(hashData))
      .digest('hex');
  }

  private signEvent(event: AuditEvent): string {
    return createHmac('sha256', this.config.secretKey)
      .update(event.hash)
      .digest('hex');
  }

  private updateIndexes(event: AuditEvent): void {
    if (!this.config.performance.enableIndexing) return;

    // User index
    if (!this.eventIndex.has(`user:${event.userId}`)) {
      this.eventIndex.set(`user:${event.userId}`, new Set());
    }
    this.eventIndex.get(`user:${event.userId}`)!.add(event.id);

    // Action index
    if (!this.eventIndex.has(`action:${event.action}`)) {
      this.eventIndex.set(`action:${event.action}`, new Set());
    }
    this.eventIndex.get(`action:${event.action}`)!.add(event.id);

    // Resource index
    if (!this.eventIndex.has(`resource:${event.resource}`)) {
      this.eventIndex.set(`resource:${event.resource}`, new Set());
    }
    this.eventIndex.get(`resource:${event.resource}`)!.add(event.id);

    // Category index
    if (!this.eventIndex.has(`category:${event.category}`)) {
      this.eventIndex.set(`category:${event.category}`, new Set());
    }
    this.eventIndex.get(`category:${event.category}`)!.add(event.id);

    // Compliance indexes
    if (event.compliance) {
      Object.entries(event.compliance).forEach(([framework, enabled]) => {
        if (enabled) {
          const key = `compliance:${framework}`;
          if (!this.eventIndex.has(key)) {
            this.eventIndex.set(key, new Set());
          }
          this.eventIndex.get(key)!.add(event.id);
        }
      });
    }

    // Tag indexes
    if (event.tags) {
      event.tags.forEach(tag => {
        const key = `tag:${tag}`;
        if (!this.eventIndex.has(key)) {
          this.eventIndex.set(key, new Set());
        }
        this.eventIndex.get(key)!.add(event.id);
      });
    }
  }

  private flushBuffer(): void {
    if (this.eventBuffer.length === 0) return;

    console.log(`🔄 Flushing ${this.eventBuffer.length} audit events...`);

    try {
      // Write to daily log file
      const today = new Date().toISOString().slice(0, 10);
      const logFile = join(this.config.logDir, 'daily', `audit-${today}.jsonl`);
      
      const logEntries = this.eventBuffer.map(event => JSON.stringify(event)).join('\n') + '\n';
      
      if (existsSync(logFile)) {
        writeFileSync(logFile, logEntries, { flag: 'a', encoding: 'utf-8' });
      } else {
        writeFileSync(logFile, logEntries, 'utf-8');
      }

      // Update sequence file
      this.saveSequence();

      // Persist indexes
      if (this.config.performance.enableIndexing) {
        this.persistIndexes();
      }

      console.log(`✅ Flushed ${this.eventBuffer.length} events to ${logFile}`);

      // Clear buffer
      this.eventBuffer = [];
      this.lastFlush = Date.now();

    } catch (error) {
      console.error('❌ Error flushing audit buffer:', error);
      this.emit('error', error);
    }
  }

  private persistIndexes(): void {
    try {
      for (const [key, eventIds] of this.eventIndex) {
        const [type, value] = key.split(':', 2);
        const indexDir = join(this.config.indexDir, type);
        const indexFile = join(indexDir, `${value}.json`);
        
        let existingIds: string[] = [];
        if (existsSync(indexFile)) {
          existingIds = JSON.parse(readFileSync(indexFile, 'utf-8'));
        }
        
        const allIds = [...new Set([...existingIds, ...Array.from(eventIds)])];
        writeFileSync(indexFile, JSON.stringify(allIds, null, 2), 'utf-8');
      }
    } catch (error) {
      console.error('Error persisting indexes:', error);
    }
  }

  private checkAlerts(): void {
    const now = Date.now();
    
    for (const alert of this.alerts) {
      if (!alert.enabled) continue;
      
      // Check cooldown
      if (alert.lastTriggered) {
        const cooldownMs = alert.cooldownPeriod * 60 * 1000;
        if (now - new Date(alert.lastTriggered).getTime() < cooldownMs) {
          continue;
        }
      }

      // Check alert condition
      if (this.evaluateAlertCondition(alert)) {
        this.triggerAlert(alert);
        alert.lastTriggered = new Date().toISOString();
      }
    }

    this.alertLastCheck = now;
  }

  private evaluateAlertCondition(alert: AuditAlert): boolean {
    const condition = alert.condition;
    const timeWindow = condition.timeWindow || 60; // Default 1 hour
    const startTime = new Date(Date.now() - timeWindow * 60 * 1000).toISOString();
    
    // Query events matching condition
    const query: AuditQuery = {
      startDate: startTime,
      category: condition.category?.[0],
      severity: condition.severity,
      outcome: condition.outcome
    };

    const events = this.queryEvents(query);
    
    // Check event count threshold
    if (condition.eventCount && events.length >= condition.eventCount) {
      return true;
    }

    return false;
  }

  private triggerAlert(alert: AuditAlert): void {
    console.log(`🚨 AUDIT ALERT: ${alert.name}`);
    console.log(`   Description: ${alert.description}`);
    console.log(`   Triggered: ${new Date().toISOString()}`);

    // Emit alert event
    this.emit('audit-alert', {
      alert,
      timestamp: new Date().toISOString()
    });

    // Send notifications (would integrate with notification services)
    for (const channel of alert.notificationChannels) {
      this.sendNotification(channel, alert);
    }
  }

  private sendNotification(channel: string, alert: AuditAlert): void {
    // Integration point for notification services
    console.log(`📬 Sending ${channel} notification for alert: ${alert.name}`);
  }

  private rotateLogs(): void {
    console.log('🔄 Rotating audit logs...');
    
    try {
      const dailyDir = join(this.config.logDir, 'daily');
      const archiveDir = join(this.config.logDir, 'archive');
      
      const files = readdirSync(dailyDir)
        .filter(file => file.startsWith('audit-') && file.endsWith('.jsonl'))
        .map(file => ({
          name: file,
          path: join(dailyDir, file),
          stat: statSync(join(dailyDir, file))
        }))
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

      // Keep only the most recent files
      const filesToArchive = files.slice(this.config.rotationConfig.maxFiles);
      
      for (const file of filesToArchive) {
        const archivePath = join(archiveDir, file.name);
        
        // Compress if enabled
        if (this.config.performance.enableCompression) {
          // Would compress file here
          console.log(`📦 Compressing ${file.name}`);
        }
        
        // Move to archive
        const content = readFileSync(file.path);
        writeFileSync(archivePath, content);
        
        console.log(`📁 Archived ${file.name}`);
      }

    } catch (error) {
      console.error('Error rotating logs:', error);
    }
  }

  public queryEvents(query: AuditQuery): AuditEvent[] {
    const results: AuditEvent[] = [];
    const limit = query.limit || 1000;
    let found = 0;

    try {
      // Determine date range for file scanning
      const startDate = query.startDate ? new Date(query.startDate) : new Date(0);
      const endDate = query.endDate ? new Date(query.endDate) : new Date();

      // Scan daily log files
      const dailyDir = join(this.config.logDir, 'daily');
      const logFiles = readdirSync(dailyDir)
        .filter(file => file.startsWith('audit-') && file.endsWith('.jsonl'))
        .sort()
        .reverse(); // Most recent first

      for (const file of logFiles) {
        if (found >= limit) break;

        const filePath = join(dailyDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n');

        for (const line of lines) {
          if (found >= limit) break;
          if (!line.trim()) continue;

          try {
            const event: AuditEvent = JSON.parse(line);
            
            if (this.matchesQuery(event, query)) {
              results.push(event);
              found++;
            }
          } catch (error) {
            console.error('Error parsing audit event:', error);
          }
        }
      }

    } catch (error) {
      console.error('Error querying events:', error);
    }

    // Sort results
    if (query.orderBy) {
      results.sort((a, b) => {
        let aVal: any, bVal: any;
        
        switch (query.orderBy) {
          case 'timestamp':
            aVal = new Date(a.timestamp).getTime();
            bVal = new Date(b.timestamp).getTime();
            break;
          case 'severity':
            const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
            aVal = severityOrder[a.severity];
            bVal = severityOrder[b.severity];
            break;
          case 'outcome':
            aVal = a.outcome;
            bVal = b.outcome;
            break;
          default:
            return 0;
        }

        if (query.orderDirection === 'desc') {
          return bVal - aVal;
        } else {
          return aVal - bVal;
        }
      });
    }

    return results;
  }

  private matchesQuery(event: AuditEvent, query: AuditQuery): boolean {
    // Date range check
    if (query.startDate && event.timestamp < query.startDate) return false;
    if (query.endDate && event.timestamp > query.endDate) return false;

    // Field filters
    if (query.userId && event.userId !== query.userId) return false;
    if (query.action && event.action !== query.action) return false;
    if (query.resource && event.resource !== query.resource) return false;
    if (query.resourceType && event.resourceType !== query.resourceType) return false;
    if (query.category && event.category !== query.category) return false;
    if (query.outcome && event.outcome !== query.outcome) return false;

    // Array filters
    if (query.severity && !query.severity.includes(event.severity)) return false;
    if (query.tags && (!event.tags || !query.tags.some(tag => event.tags!.includes(tag)))) return false;

    // Compliance filters
    if (query.compliance && event.compliance) {
      const hasMatchingCompliance = query.compliance.some(framework => 
        event.compliance && event.compliance[framework as keyof typeof event.compliance]
      );
      if (!hasMatchingCompliance) return false;
    }

    return true;
  }

  public generateStatistics(startDate?: string, endDate?: string): AuditStatistics {
    console.log('📊 Generating audit statistics...');

    const query: AuditQuery = { startDate, endDate, limit: 100000 };
    const events = this.queryEvents(query);

    const stats: AuditStatistics = {
      totalEvents: events.length,
      eventsByCategory: {},
      eventsBySeverity: {},
      eventsByOutcome: {},
      eventsByResourceType: {},
      topUsers: [],
      topActions: [],
      topResources: [],
      complianceEvents: { sox: 0, gdpr: 0, pci: 0, hipaa: 0 },
      securityMetrics: {
        failedAuthentications: 0,
        unauthorizedAccess: 0,
        securityViolations: 0,
        suspiciousActivity: 0
      },
      timeline: []
    };

    // Count by categories
    const categoryCounts: Record<string, number> = {};
    const severityCounts: Record<string, number> = {};
    const outcomeCounts: Record<string, number> = {};
    const resourceTypeCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};
    const actionCounts: Record<string, number> = {};
    const resourceCounts: Record<string, number> = {};
    const dailyCounts: Record<string, { count: number; categories: Record<string, number> }> = {};

    for (const event of events) {
      // Categories
      categoryCounts[event.category] = (categoryCounts[event.category] || 0) + 1;
      severityCounts[event.severity] = (severityCounts[event.severity] || 0) + 1;
      outcomeCounts[event.outcome] = (outcomeCounts[event.outcome] || 0) + 1;
      resourceTypeCounts[event.resourceType] = (resourceTypeCounts[event.resourceType] || 0) + 1;
      
      // Top counts
      userCounts[event.userId] = (userCounts[event.userId] || 0) + 1;
      actionCounts[event.action] = (actionCounts[event.action] || 0) + 1;
      resourceCounts[event.resource] = (resourceCounts[event.resource] || 0) + 1;

      // Compliance events
      if (event.compliance) {
        if (event.compliance.sox) stats.complianceEvents.sox++;
        if (event.compliance.gdpr) stats.complianceEvents.gdpr++;
        if (event.compliance.pci) stats.complianceEvents.pci++;
        if (event.compliance.hipaa) stats.complianceEvents.hipaa++;
      }

      // Security metrics
      if (event.category === 'authentication' && event.outcome === 'failure') {
        stats.securityMetrics.failedAuthentications++;
      }
      if (event.category === 'authorization' && event.outcome === 'failure') {
        stats.securityMetrics.unauthorizedAccess++;
      }
      if (event.category === 'security_event') {
        stats.securityMetrics.securityViolations++;
      }
      if (event.severity === 'critical' || (event.severity === 'high' && event.outcome === 'failure')) {
        stats.securityMetrics.suspiciousActivity++;
      }

      // Timeline
      const date = event.timestamp.slice(0, 10);
      if (!dailyCounts[date]) {
        dailyCounts[date] = { count: 0, categories: {} };
      }
      dailyCounts[date].count++;
      dailyCounts[date].categories[event.category] = (dailyCounts[date].categories[event.category] || 0) + 1;
    }

    // Convert to stats format
    stats.eventsByCategory = categoryCounts;
    stats.eventsBySeverity = severityCounts;
    stats.eventsByOutcome = outcomeCounts;
    stats.eventsByResourceType = resourceTypeCounts;

    // Top lists
    stats.topUsers = Object.entries(userCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    stats.topActions = Object.entries(actionCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    stats.topResources = Object.entries(resourceCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([resource, count]) => ({ resource, count }));

    // Timeline
    stats.timeline = Object.entries(dailyCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, count: data.count, categories: data.categories }));

    console.log(`📊 Generated statistics for ${stats.totalEvents} events`);
    return stats;
  }

  public exportEvents(query: AuditQuery, format: 'json' | 'csv' | 'xlsx' = 'json'): string {
    const events = this.queryEvents(query);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `audit-export-${timestamp}.${format}`;
    const filepath = join(this.config.logDir, filename);

    switch (format) {
      case 'json':
        writeFileSync(filepath, JSON.stringify(events, null, 2), 'utf-8');
        break;
        
      case 'csv':
        const headers = [
          'ID', 'Timestamp', 'User ID', 'Action', 'Resource', 'Resource Type',
          'Category', 'Severity', 'Outcome', 'IP Address', 'User Agent'
        ];
        
        let csvContent = headers.join(',') + '\n';
        
        for (const event of events) {
          const row = [
            event.id,
            event.timestamp,
            event.userId,
            event.action,
            event.resource,
            event.resourceType,
            event.category,
            event.severity,
            event.outcome,
            event.ipAddress || '',
            event.userAgent || ''
          ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
          
          csvContent += row + '\n';
        }
        
        writeFileSync(filepath, csvContent, 'utf-8');
        break;
        
      case 'xlsx':
        // Would use a library like xlsx to generate Excel file
        console.log('XLSX export not implemented yet');
        break;
    }

    console.log(`📤 Exported ${events.length} events to ${filepath}`);
    return filepath;
  }

  public verifyIntegrity(startDate?: string, endDate?: string): { valid: boolean; errors: string[] } {
    console.log('🔍 Verifying audit log integrity...');

    const errors: string[] = [];
    let previousHash = '';
    let sequence = 0;

    const query: AuditQuery = { startDate, endDate, orderBy: 'timestamp', orderDirection: 'asc', limit: 100000 };
    const events = this.queryEvents(query);

    for (const event of events) {
      // Verify hash
      const expectedHash = this.calculateEventHashForVerification(event, previousHash, sequence);
      if (event.hash !== expectedHash) {
        errors.push(`Hash mismatch for event ${event.id}: expected ${expectedHash}, got ${event.hash}`);
      }

      // Verify signature
      if (this.config.integrity.enabled && event.signature) {
        const expectedSignature = createHmac('sha256', this.config.secretKey)
          .update(event.hash)
          .digest('hex');
        if (event.signature !== expectedSignature) {
          errors.push(`Signature mismatch for event ${event.id}`);
        }
      }

      previousHash = event.hash;
      sequence++;
    }

    const valid = errors.length === 0;
    console.log(`🔍 Integrity check ${valid ? '✅ PASSED' : '❌ FAILED'} for ${events.length} events`);
    
    if (errors.length > 0) {
      console.log(`   Found ${errors.length} integrity errors`);
    }

    return { valid, errors };
  }

  private calculateEventHashForVerification(event: AuditEvent, previousHash: string, sequence: number): string {
    const hashData = {
      id: event.id,
      timestamp: event.timestamp,
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      oldValue: event.oldValue,
      newValue: event.newValue,
      outcome: event.outcome,
      previousHash,
      sequence
    };

    return createHash('sha256')
      .update(JSON.stringify(hashData))
      .digest('hex');
  }

  public createAlert(alert: Omit<AuditAlert, 'id'>): string {
    const newAlert: AuditAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
    };

    this.alerts.push(newAlert);
    this.saveAlerts();

    console.log(`🚨 Created alert: ${newAlert.name}`);
    return newAlert.id;
  }

  public updateAlert(id: string, updates: Partial<AuditAlert>): boolean {
    const alertIndex = this.alerts.findIndex(alert => alert.id === id);
    if (alertIndex === -1) return false;

    this.alerts[alertIndex] = { ...this.alerts[alertIndex], ...updates };
    this.saveAlerts();

    console.log(`🔄 Updated alert: ${this.alerts[alertIndex].name}`);
    return true;
  }

  public deleteAlert(id: string): boolean {
    const initialLength = this.alerts.length;
    this.alerts = this.alerts.filter(alert => alert.id !== id);
    
    if (this.alerts.length < initialLength) {
      this.saveAlerts();
      console.log(`🗑️  Deleted alert: ${id}`);
      return true;
    }

    return false;
  }

  public getAlerts(): AuditAlert[] {
    return [...this.alerts];
  }

  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down audit logger...');
    
    // Flush remaining events
    this.flushBuffer();
    
    // Wait for any pending operations
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Audit logger shutdown complete');
  }
}

// CLI interface
if (require.main === module) {
  const config: AuditLoggerConfig = {
    logDir: process.env.AUDIT_LOG_DIR || 'logs/audit',
    indexDir: process.env.AUDIT_INDEX_DIR || 'logs/audit/indexes',
    secretKey: process.env.AUDIT_SECRET_KEY || 'your-secret-key-here',
    rotationConfig: {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '100'), // MB
      maxFiles: parseInt(process.env.MAX_FILES || '30'),
      rotateDaily: process.env.ROTATE_DAILY !== 'false'
    },
    encryption: {
      enabled: process.env.ENABLE_ENCRYPTION === 'true',
      algorithm: 'aes-256-gcm',
      keyDerivationRounds: 10000
    },
    integrity: {
      enabled: process.env.ENABLE_INTEGRITY !== 'false',
      algorithm: 'sha256',
      chainValidation: true
    },
    retention: {
      defaultDays: parseInt(process.env.RETENTION_DAYS || '2555'), // 7 years
      complianceOverrides: {
        sox: 2555, // 7 years
        gdpr: 2190, // 6 years
        pci: 365, // 1 year
        hipaa: 2190 // 6 years
      }
    },
    alerting: {
      enabled: process.env.ENABLE_ALERTING !== 'false',
      alertsFile: process.env.ALERTS_FILE || 'config/audit-alerts.json',
      checkInterval: parseInt(process.env.ALERT_CHECK_INTERVAL || '5') // minutes
    },
    performance: {
      batchSize: parseInt(process.env.BATCH_SIZE || '100'),
      flushInterval: parseInt(process.env.FLUSH_INTERVAL || '30'), // seconds
      enableIndexing: process.env.ENABLE_INDEXING !== 'false',
      enableCompression: process.env.ENABLE_COMPRESSION === 'true'
    }
  };

  const logger = new AuditLogger(config);

  // Example usage
  const eventId = logger.log({
    userId: 'system',
    action: 'audit_logger_started',
    resource: 'audit_system',
    resourceType: 'system',
    category: 'system_change',
    severity: 'low',
    outcome: 'success',
    metadata: {
      version: '1.0.0',
      config: 'enterprise'
    },
    compliance: {
      sox: true,
      gdpr: true,
      pci: true
    }
  });

  console.log(`✅ Audit logger started with event ID: ${eventId}`);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await logger.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await logger.shutdown();
    process.exit(0);
  });
}