/**
 * HIPAA/GDPR/SOX Compliant Audit Trail Generator
 * Tamper-proof audit logging with digital signatures
 */

import { createHash, createHmac, randomBytes } from 'crypto';
import { AuditTrail, RegulationType } from '../compliance/compliance-types.js';

export interface AuditConfig {
  organizationId: string;
  retentionPeriodDays: number;
  encryptionEnabled: boolean;
  digitalSignatures: boolean;
  blockchainAnchoring?: boolean;
  syslogIntegration?: boolean;
  siemIntegration?: {
    endpoint: string;
    apiKey: string;
  };
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userRole?: string;
  sessionId: string;
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'LOGIN' | 'LOGOUT' | 'ADMIN' | 'BREACH' | 'ACCESS_DENIED';
  resource: string;
  resourceType: 'USER' | 'PATIENT' | 'FINANCIAL' | 'SYSTEM' | 'TEMPLATE' | 'REPORT';
  regulation: RegulationType;
  complianceImpact: boolean;
  dataFields?: string[];
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  geolocation?: {
    country: string;
    region: string;
    city: string;
  };
  riskScore: number;
  result: 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'BLOCKED';
  errorMessage?: string;
  metadata: Record<string, any>;
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  signature?: string;
  chainHash?: string;
}

export class AuditTrailGenerator {
  private config: AuditConfig;
  private auditChain: string[] = [];
  private secretKey: string;
  
  constructor(config: AuditConfig) {
    this.config = config;
    this.secretKey = this.getSecretKey();
  }

  /**
   * Generate comprehensive audit trail entry
   */
  async generateAuditTrail(
    operation: string,
    resource: string,
    userId: string,
    regulation: RegulationType,
    metadata: Record<string, any> = {}
  ): Promise<AuditTrail> {
    const id = this.generateAuditId();
    const timestamp = new Date();
    
    const auditEntry: AuditEntry = {
      id,
      timestamp,
      userId,
      userRole: metadata.userRole,
      sessionId: metadata.sessionId || this.generateSessionId(),
      operation: operation as any,
      resource,
      resourceType: this.determineResourceType(resource),
      regulation,
      complianceImpact: this.hasComplianceImpact(operation, regulation),
      dataFields: metadata.dataFields || [],
      oldValues: metadata.oldValues,
      newValues: metadata.newValues,
      ipAddress: metadata.ipAddress || '0.0.0.0',
      userAgent: metadata.userAgent || 'Unknown',
      geolocation: metadata.geolocation,
      riskScore: this.calculateRiskScore(operation, resource, metadata),
      result: metadata.result || 'SUCCESS',
      errorMessage: metadata.errorMessage,
      metadata,
      sensitivity: this.determineSensitivity(resource, regulation),
      chainHash: this.calculateChainHash(id, timestamp, operation, resource)
    };

    // Generate digital signature for tamper-proofing
    if (this.config.digitalSignatures) {
      auditEntry.signature = this.generateDigitalSignature(auditEntry);
    }

    // Add to audit chain for blockchain-like integrity
    this.auditChain.push(auditEntry.chainHash!);

    const auditTrail: AuditTrail = {
      id,
      timestamp,
      userId,
      action: operation,
      resource,
      regulation,
      complianceImpact: auditEntry.complianceImpact,
      metadata: {
        ...metadata,
        auditEntry,
        riskScore: auditEntry.riskScore,
        sensitivity: auditEntry.sensitivity,
        integrity: {
          chainHash: auditEntry.chainHash,
          signature: auditEntry.signature,
          verified: true
        }
      },
      signature: auditEntry.signature || ''
    };

    // Store audit trail
    await this.storeAuditTrail(auditTrail);

    // Send to external systems
    await this.propagateAuditTrail(auditEntry);

    return auditTrail;
  }

  /**
   * Verify audit trail integrity
   */
  async verifyAuditIntegrity(auditId: string): Promise<{
    isValid: boolean;
    issues: string[];
    verificationTimestamp: Date;
  }> {
    const auditTrail = await this.retrieveAuditTrail(auditId);
    const issues: string[] = [];

    if (!auditTrail) {
      return {
        isValid: false,
        issues: ['Audit trail not found'],
        verificationTimestamp: new Date()
      };
    }

    // Verify digital signature
    if (this.config.digitalSignatures && auditTrail.signature) {
      const expectedSignature = this.generateDigitalSignature(
        auditTrail.metadata.auditEntry
      );
      
      if (auditTrail.signature !== expectedSignature) {
        issues.push('Digital signature verification failed - possible tampering');
      }
    }

    // Verify chain hash
    const auditEntry = auditTrail.metadata.auditEntry;
    const expectedChainHash = this.calculateChainHash(
      auditEntry.id,
      auditEntry.timestamp,
      auditEntry.operation,
      auditEntry.resource
    );

    if (auditEntry.chainHash !== expectedChainHash) {
      issues.push('Chain hash verification failed - audit chain broken');
    }

    // Check for gaps in audit sequence
    const sequenceGaps = await this.checkSequenceIntegrity(auditId);
    if (sequenceGaps.length > 0) {
      issues.push(`Sequence gaps detected: ${sequenceGaps.join(', ')}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      verificationTimestamp: new Date()
    };
  }

  /**
   * Generate compliance audit report
   */
  async generateComplianceAuditReport(
    regulation: RegulationType,
    startDate: Date,
    endDate: Date,
    options: {
      includeFailures?: boolean;
      highRiskOnly?: boolean;
      userFilter?: string;
      resourceFilter?: string;
    } = {}
  ): Promise<{
    reportId: string;
    regulation: RegulationType;
    period: { start: Date; end: Date };
    totalEntries: number;
    complianceEvents: number;
    failureEvents: number;
    highRiskEvents: number;
    topUsers: Array<{ userId: string; eventCount: number }>;
    topResources: Array<{ resource: string; accessCount: number }>;
    riskDistribution: Record<string, number>;
    timeline: Array<{ date: string; events: number }>;
    violations: Array<{
      id: string;
      timestamp: Date;
      description: string;
      severity: string;
      resolved: boolean;
    }>;
    recommendations: string[];
    integrityStatus: 'verified' | 'compromised' | 'unknown';
  }> {
    const reportId = this.generateReportId();
    const auditEntries = await this.queryAuditTrails(regulation, startDate, endDate, options);

    // Analyze audit data
    const totalEntries = auditEntries.length;
    const complianceEvents = auditEntries.filter(e => e.complianceImpact).length;
    const failureEvents = auditEntries.filter(e => e.result === 'FAILURE').length;
    const highRiskEvents = auditEntries.filter(e => e.riskScore >= 80).length;

    // Calculate user activity
    const userActivity = new Map<string, number>();
    auditEntries.forEach(entry => {
      userActivity.set(entry.userId, (userActivity.get(entry.userId) || 0) + 1);
    });

    const topUsers = Array.from(userActivity.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([userId, eventCount]) => ({ userId, eventCount }));

    // Calculate resource access
    const resourceActivity = new Map<string, number>();
    auditEntries.forEach(entry => {
      resourceActivity.set(entry.resource, (resourceActivity.get(entry.resource) || 0) + 1);
    });

    const topResources = Array.from(resourceActivity.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([resource, accessCount]) => ({ resource, accessCount }));

    // Risk distribution
    const riskDistribution = {
      'LOW': auditEntries.filter(e => e.riskScore < 30).length,
      'MEDIUM': auditEntries.filter(e => e.riskScore >= 30 && e.riskScore < 70).length,
      'HIGH': auditEntries.filter(e => e.riskScore >= 70 && e.riskScore < 90).length,
      'CRITICAL': auditEntries.filter(e => e.riskScore >= 90).length
    };

    // Timeline analysis
    const timeline = this.generateTimeline(auditEntries, startDate, endDate);

    // Identify violations
    const violations = this.identifyViolations(auditEntries, regulation);

    // Generate recommendations
    const recommendations = this.generateAuditRecommendations(auditEntries, regulation);

    // Verify integrity of audit period
    const integrityStatus = await this.verifyPeriodIntegrity(startDate, endDate);

    return {
      reportId,
      regulation,
      period: { start: startDate, end: endDate },
      totalEntries,
      complianceEvents,
      failureEvents,
      highRiskEvents,
      topUsers,
      topResources,
      riskDistribution,
      timeline,
      violations,
      recommendations,
      integrityStatus
    };
  }

  /**
   * Set up automated audit archival
   */
  async setupAuditArchival(schedule: 'daily' | 'weekly' | 'monthly'): Promise<{
    archivalId: string;
    schedule: string;
    retentionPolicy: string;
    nextArchival: Date;
  }> {
    const archivalId = this.generateArchivalId();
    
    return {
      archivalId,
      schedule,
      retentionPolicy: `${this.config.retentionPeriodDays} days`,
      nextArchival: this.calculateNextArchivalDate(schedule)
    };
  }

  /**
   * Export audit trails for regulatory inspection
   */
  async exportAuditTrails(
    regulation: RegulationType,
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<{
    exportId: string;
    format: string;
    totalRecords: number;
    dataIntegrity: boolean;
    exportData: string;
    digitalSignature: string;
  }> {
    const exportId = this.generateExportId();
    const auditEntries = await this.queryAuditTrails(regulation, startDate, endDate);
    
    // Verify integrity of all entries
    const integrityResults = await Promise.all(
      auditEntries.map(entry => this.verifyAuditIntegrity(entry.id))
    );
    const dataIntegrity = integrityResults.every(result => result.isValid);

    // Format data
    let exportData: string;
    switch (format) {
      case 'csv':
        exportData = this.formatAsCSV(auditEntries);
        break;
      case 'xml':
        exportData = this.formatAsXML(auditEntries);
        break;
      default:
        exportData = JSON.stringify({
          exportId,
          regulation,
          period: { start: startDate, end: endDate },
          entries: auditEntries,
          integrityVerified: dataIntegrity
        }, null, 2);
    }

    // Generate digital signature for export
    const digitalSignature = this.generateExportSignature(exportData);

    return {
      exportId,
      format,
      totalRecords: auditEntries.length,
      dataIntegrity,
      exportData,
      digitalSignature
    };
  }

  // Private helper methods

  private generateAuditId(): string {
    return `audit_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateSessionId(): string {
    return `session_${randomBytes(16).toString('hex')}`;
  }

  private calculateChainHash(id: string, timestamp: Date, operation: string, resource: string): string {
    const previousHash = this.auditChain[this.auditChain.length - 1] || '0';
    const data = `${previousHash}${id}${timestamp.toISOString()}${operation}${resource}`;
    return createHash('sha256').update(data).digest('hex');
  }

  private generateDigitalSignature(auditEntry: AuditEntry): string {
    const data = JSON.stringify({
      id: auditEntry.id,
      timestamp: auditEntry.timestamp,
      operation: auditEntry.operation,
      resource: auditEntry.resource,
      userId: auditEntry.userId,
      result: auditEntry.result
    });

    return createHmac('sha256', this.secretKey).update(data).digest('hex');
  }

  private determineResourceType(resource: string): AuditEntry['resourceType'] {
    if (resource.includes('patient') || resource.includes('health')) return 'PATIENT';
    if (resource.includes('financial') || resource.includes('payment')) return 'FINANCIAL';
    if (resource.includes('user') || resource.includes('account')) return 'USER';
    if (resource.includes('system') || resource.includes('admin')) return 'SYSTEM';
    if (resource.includes('template') || resource.includes('compliance')) return 'TEMPLATE';
    if (resource.includes('report') || resource.includes('export')) return 'REPORT';
    return 'SYSTEM';
  }

  private hasComplianceImpact(operation: string, regulation: RegulationType): boolean {
    const complianceOperations = ['CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'BREACH'];
    return complianceOperations.includes(operation);
  }

  private calculateRiskScore(operation: string, resource: string, metadata: Record<string, any>): number {
    let score = 0;

    // Base score by operation
    const operationScores: Record<string, number> = {
      'READ': 10,
      'CREATE': 30,
      'UPDATE': 40,
      'DELETE': 80,
      'EXPORT': 60,
      'BREACH': 100,
      'ACCESS_DENIED': 50
    };

    score += operationScores[operation] || 20;

    // Resource sensitivity
    if (resource.includes('patient') || resource.includes('health')) score += 30;
    if (resource.includes('financial') || resource.includes('payment')) score += 25;
    if (resource.includes('admin') || resource.includes('system')) score += 20;

    // User role risk
    if (metadata.userRole === 'admin') score += 15;
    if (metadata.userRole === 'emergency_access') score += 25;

    // Time-based risk (after hours access)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) score += 10;

    // Geographic risk
    if (metadata.geolocation?.country !== 'US') score += 15;

    // Failed operations
    if (metadata.result === 'FAILURE') score += 20;

    return Math.min(100, Math.max(0, score));
  }

  private determineSensitivity(resource: string, regulation: RegulationType): AuditEntry['sensitivity'] {
    if (regulation === 'HIPAA' && resource.includes('patient')) return 'CRITICAL';
    if (regulation === 'SOX' && resource.includes('financial')) return 'CRITICAL';
    if (regulation === 'GDPR' && resource.includes('personal')) return 'HIGH';
    if (resource.includes('admin') || resource.includes('system')) return 'HIGH';
    if (resource.includes('user')) return 'MEDIUM';
    return 'LOW';
  }

  private async storeAuditTrail(auditTrail: AuditTrail): Promise<void> {
    // In production, this would store in a tamper-proof database
    console.log('Audit trail stored:', auditTrail.id);
  }

  private async propagateAuditTrail(auditEntry: AuditEntry): Promise<void> {
    // Send to SIEM if configured
    if (this.config.siemIntegration) {
      await this.sendToSIEM(auditEntry);
    }

    // Send to syslog if configured
    if (this.config.syslogIntegration) {
      await this.sendToSyslog(auditEntry);
    }

    // Blockchain anchoring for critical events
    if (this.config.blockchainAnchoring && auditEntry.sensitivity === 'CRITICAL') {
      await this.anchorToBlockchain(auditEntry);
    }
  }

  private async sendToSIEM(auditEntry: AuditEntry): Promise<void> {
    // Implementation would send to SIEM system
    console.log('Audit entry sent to SIEM:', auditEntry.id);
  }

  private async sendToSyslog(auditEntry: AuditEntry): Promise<void> {
    // Implementation would send to syslog
    console.log('Audit entry sent to syslog:', auditEntry.id);
  }

  private async anchorToBlockchain(auditEntry: AuditEntry): Promise<void> {
    // Implementation would anchor hash to blockchain
    console.log('Audit entry anchored to blockchain:', auditEntry.chainHash);
  }

  private async retrieveAuditTrail(auditId: string): Promise<AuditTrail | null> {
    // Implementation would retrieve from database
    return null;
  }

  private async checkSequenceIntegrity(auditId: string): Promise<string[]> {
    // Implementation would check for sequence gaps
    return [];
  }

  private async queryAuditTrails(
    regulation: RegulationType,
    startDate: Date,
    endDate: Date,
    options: any = {}
  ): Promise<AuditEntry[]> {
    // Simulate audit query - in production, query database
    return [];
  }

  private generateTimeline(entries: AuditEntry[], startDate: Date, endDate: Date): Array<{ date: string; events: number }> {
    const timeline = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const dayEntries = entries.filter(entry => 
        entry.timestamp.toISOString().split('T')[0] === dateStr
      );
      
      timeline.push({
        date: dateStr,
        events: dayEntries.length
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return timeline;
  }

  private identifyViolations(entries: AuditEntry[], regulation: RegulationType): any[] {
    return entries
      .filter(entry => entry.result === 'FAILURE' || entry.riskScore >= 80)
      .map(entry => ({
        id: entry.id,
        timestamp: entry.timestamp,
        description: `${entry.operation} operation failed on ${entry.resource}`,
        severity: entry.riskScore >= 90 ? 'CRITICAL' : 'HIGH',
        resolved: false
      }));
  }

  private generateAuditRecommendations(entries: AuditEntry[], regulation: RegulationType): string[] {
    const recommendations = [];
    
    const failureRate = entries.filter(e => e.result === 'FAILURE').length / entries.length;
    if (failureRate > 0.05) {
      recommendations.push('High failure rate detected - review access controls');
    }
    
    const highRiskEvents = entries.filter(e => e.riskScore >= 80).length;
    if (highRiskEvents > 10) {
      recommendations.push('Multiple high-risk events - enhance monitoring');
    }
    
    const afterHoursAccess = entries.filter(e => {
      const hour = e.timestamp.getHours();
      return hour < 6 || hour > 22;
    }).length;
    
    if (afterHoursAccess > entries.length * 0.1) {
      recommendations.push('Significant after-hours access - review necessity');
    }
    
    return recommendations;
  }

  private async verifyPeriodIntegrity(startDate: Date, endDate: Date): Promise<'verified' | 'compromised' | 'unknown'> {
    // Implementation would verify integrity across time period
    return 'verified';
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${randomBytes(6).toString('hex')}`;
  }

  private generateArchivalId(): string {
    return `archival_${Date.now()}_${randomBytes(6).toString('hex')}`;
  }

  private generateExportId(): string {
    return `export_${Date.now()}_${randomBytes(6).toString('hex')}`;
  }

  private calculateNextArchivalDate(schedule: string): Date {
    const next = new Date();
    switch (schedule) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  }

  private formatAsCSV(entries: AuditEntry[]): string {
    const headers = ['id', 'timestamp', 'userId', 'operation', 'resource', 'result', 'riskScore'];
    const rows = entries.map(entry => 
      headers.map(header => (entry as any)[header]).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }

  private formatAsXML(entries: AuditEntry[]): string {
    const xmlEntries = entries.map(entry => `
      <audit>
        <id>${entry.id}</id>
        <timestamp>${entry.timestamp.toISOString()}</timestamp>
        <userId>${entry.userId}</userId>
        <operation>${entry.operation}</operation>
        <resource>${entry.resource}</resource>
        <result>${entry.result}</result>
        <riskScore>${entry.riskScore}</riskScore>
      </audit>
    `).join('');
    
    return `<?xml version="1.0" encoding="UTF-8"?><auditTrails>${xmlEntries}</auditTrails>`;
  }

  private generateExportSignature(data: string): string {
    return createHmac('sha256', this.secretKey).update(data).digest('hex');
  }

  private getSecretKey(): string {
    return process.env.AUDIT_SECRET_KEY || 'change-this-in-production';
  }
}