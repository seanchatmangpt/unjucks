import { writeFile, appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';

export interface EnterpriseLogConfig {
  service: string;
  environment: 'dev' | 'staging' | 'prod' | 'audit';
  compliance?: 'sox' | 'gdpr' | 'hipaa' | 'none';
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  auditTrail?: boolean;
  encryptLogs?: boolean;
  retentionDays?: number;
}

export interface LogEntry {
  timestamp: Date;
  level: string;
  service: string;
  environment: string;
  message: string;
  metadata?: any;
  traceId?: string;
  userId?: string;
  sessionId?: string;
  compliance?: string;
  hash?: string;
}

export class EnterpriseLogger {
  private config: Required<EnterpriseLogConfig>;
  private logBuffer: LogEntry[] = [];
  private auditBuffer: LogEntry[] = [];

  constructor(config: EnterpriseLogConfig) {
    this.config = {
      service: config.service,
      environment: config.environment,
      compliance: config.compliance || 'none',
      logLevel: config.logLevel || 'info',
      auditTrail: config.auditTrail !== false,
      encryptLogs: config.encryptLogs !== false,
      retentionDays: config.retentionDays || 2555 // 7 years for SOX compliance
    };

    this.initializeLogDirectory();
  }

  public debug(message: string, metadata?: any): void {
    this.log('debug', message, metadata);
  }

  public info(message: string, metadata?: any): void {
    this.log('info', message, metadata);
  }

  public warn(message: string, metadata?: any): void {
    this.log('warn', message, metadata);
  }

  public error(message: string, metadata?: any): void {
    this.log('error', message, metadata);
  }

  public fatal(message: string, metadata?: any): void {
    this.log('fatal', message, metadata);
  }

  public audit(action: string, metadata: any): void {
    const auditEntry: LogEntry = {
      timestamp: new Date(),
      level: 'audit',
      service: this.config.service,
      environment: this.config.environment,
      message: action,
      metadata: {
        ...metadata,
        auditType: 'enterprise-action',
        compliance: this.config.compliance
      },
      compliance: this.config.compliance
    };

    // Add integrity hash for compliance
    if (this.config.compliance !== 'none') {
      auditEntry.hash = this.generateIntegrityHash(auditEntry);
    }

    this.auditBuffer.push(auditEntry);
    this.persistAuditLog(auditEntry);
  }

  public compliance(event: string, metadata: any): void {
    const complianceEntry: LogEntry = {
      timestamp: new Date(),
      level: 'compliance',
      service: this.config.service,
      environment: this.config.environment,
      message: event,
      metadata: {
        ...metadata,
        complianceStandard: this.config.compliance,
        requiresAudit: true
      },
      compliance: this.config.compliance,
      hash: this.generateIntegrityHash({} as LogEntry)
    };

    // Compliance logs are always audited
    this.auditBuffer.push(complianceEntry);
    this.persistAuditLog(complianceEntry);
  }

  private log(level: string, message: string, metadata?: any): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      service: this.config.service,
      environment: this.config.environment,
      message,
      metadata,
      compliance: this.config.compliance
    };

    // Add trace information for enterprise debugging
    if (this.config.environment === 'prod') {
      entry.traceId = this.generateTraceId();
    }

    this.logBuffer.push(entry);
    
    // Console output for development
    if (this.config.environment === 'dev') {
      this.consoleOutput(entry);
    }

    // Persist high-priority logs immediately
    if (['error', 'fatal'].includes(level)) {
      this.persistLogEntry(entry);
    }

    // Audit trail for compliance
    if (this.config.auditTrail && ['error', 'fatal', 'warn'].includes(level)) {
      this.audit(`${level.toUpperCase()}: ${message}`, metadata);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const logLevelIndex = levels.indexOf(level);
    return logLevelIndex >= currentLevelIndex;
  }

  private consoleOutput(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const service = entry.service.padEnd(20);
    const level = entry.level.toUpperCase().padEnd(5);
    const env = `[${entry.environment}]`.padEnd(8);
    
    let output = `${timestamp} ${env} ${service} ${level} ${entry.message}`;
    
    if (entry.metadata) {
      output += ` | ${JSON.stringify(entry.metadata)}`;
    }

    // Color coding for different log levels
    switch (entry.level) {
      case 'debug':
        console.debug(`\x1b[36m${output}\x1b[0m`); // Cyan
        break;
      case 'info':
        console.info(`\x1b[32m${output}\x1b[0m`); // Green
        break;
      case 'warn':
        console.warn(`\x1b[33m${output}\x1b[0m`); // Yellow
        break;
      case 'error':
      case 'fatal':
        console.error(`\x1b[31m${output}\x1b[0m`); // Red
        break;
      default:
        console.log(output);
    }
  }

  private async persistLogEntry(entry: LogEntry): Promise<void> {
    try {
      const logPath = this.getLogPath('application');
      const logLine = JSON.stringify(entry) + '\n';
      
      await appendFile(logPath, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to persist log entry:', error);
    }
  }

  private async persistAuditLog(entry: LogEntry): Promise<void> {
    try {
      const auditPath = this.getLogPath('audit');
      const auditLine = JSON.stringify(entry) + '\n';
      
      await appendFile(auditPath, auditLine, 'utf8');
    } catch (error) {
      console.error('Failed to persist audit log:', error);
    }
  }

  private getLogPath(type: 'application' | 'audit'): string {
    const date = new Date().toISOString().split('T')[0];
    const filename = `${this.config.service}-${type}-${date}.log`;
    return join(process.cwd(), 'logs', this.config.environment, filename);
  }

  private async initializeLogDirectory(): Promise<void> {
    try {
      const logDir = join(process.cwd(), 'logs', this.config.environment);
      await mkdir(logDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to create log directory:', error);
    }
  }

  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateIntegrityHash(entry: LogEntry): string {
    const hashData = JSON.stringify({
      timestamp: entry.timestamp,
      service: entry.service,
      message: entry.message,
      metadata: entry.metadata
    });
    return createHash('sha256').update(hashData).digest('hex');
  }

  public async flush(): Promise<void> {
    // Flush any remaining log entries
    for (const entry of this.logBuffer) {
      await this.persistLogEntry(entry);
    }
    
    for (const entry of this.auditBuffer) {
      await this.persistAuditLog(entry);
    }
    
    this.logBuffer = [];
    this.auditBuffer = [];
  }

  public getLogStats(): any {
    return {
      service: this.config.service,
      environment: this.config.environment,
      compliance: this.config.compliance,
      bufferedLogs: this.logBuffer.length,
      bufferedAudits: this.auditBuffer.length,
      logLevel: this.config.logLevel,
      auditTrail: this.config.auditTrail,
      retentionDays: this.config.retentionDays
    };
  }
}