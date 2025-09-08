/**
 * Runtime Security Monitor and Protection System
 * Real-time monitoring, threat detection, and automated response
 */

import { EventEmitter } from 'events';
import { createHash, randomBytes } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { performance } from 'perf_hooks';
import { SecurityError } from './input-validator.js';

export class RuntimeSecurityMonitor extends EventEmitter {
  constructor() {
    super();
    this.isMonitoring = false;
    this.securityEvents = [];
    this.threats = new Map();
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      suspiciousActivity: 0,
      lastThreatTime: null,
      uptime: Date.now()
    };
    
    // Security thresholds
    this.thresholds = {
      maxRequestsPerMinute: 100,
      maxFailedAttemptsPerMinute: 10,
      maxMemoryUsageMB: 500,
      maxCpuUsagePercent: 80,
      suspiciousPatternThreshold: 5
    };

    // Threat patterns
    this.threatPatterns = {
      injectionAttacks: [
        /(\bselect\b.*\bfrom\b)/gi,
        /(\binsert\b.*\binto\b)/gi,
        /(\bunion\b.*\bselect\b)/gi,
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /onload\s*=/gi,
        /onerror\s*=/gi
      ],
      pathTraversal: [
        /\.\.[\/\\]/g,
        /%2e%2e[\/\\]/gi,
        /~[\/\\]/g,
        /%7e[\/\\]/gi
      ],
      commandInjection: [
        /;\s*(rm|del|format|shutdown)/gi,
        /\|\s*(curl|wget|nc|telnet)/gi,
        /`[^`]*`/g,
        /\$\([^)]*\)/g
      ],
      suspiciousFiles: [
        /\.exe$/i,
        /\.bat$/i,
        /\.cmd$/i,
        /\.vbs$/i,
        /\.ps1$/i
      ]
    };

    // Rate limiting
    this.requestCounts = new Map();
    this.failedAttempts = new Map();
    
    // Memory and CPU monitoring
    this.resourceMonitor = {
      lastCheck: Date.now(),
      memoryAlerts: 0,
      cpuAlerts: 0
    };

    // Initialize monitoring
    this.setupMonitoring();
  }

  /**
   * Start runtime security monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.emit('monitoring:started');
    
    // Start periodic security checks
    this.securityCheckInterval = setInterval(() => {
      this.performSecurityChecks();
    }, 30000); // Every 30 seconds

    // Start resource monitoring
    this.resourceCheckInterval = setInterval(() => {
      this.checkResourceUsage();
    }, 10000); // Every 10 seconds

    // Clean up old events
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldEvents();
    }, 300000); // Every 5 minutes

    console.log('Runtime security monitoring started');
  }

  /**
   * Stop security monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.securityCheckInterval) {
      clearInterval(this.securityCheckInterval);
    }
    if (this.resourceCheckInterval) {
      clearInterval(this.resourceCheckInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.emit('monitoring:stopped');
    console.log('Runtime security monitoring stopped');
  }

  /**
   * Setup initial monitoring infrastructure
   */
  setupMonitoring() {
    // Monitor process events
    process.on('uncaughtException', (error) => {
      this.recordSecurityEvent('uncaught-exception', {
        error: error.message,
        stack: error.stack,
        severity: 'critical'
      });
    });

    process.on('unhandledRejection', (reason) => {
      this.recordSecurityEvent('unhandled-rejection', {
        reason: reason?.toString(),
        severity: 'high'
      });
    });

    // Monitor memory warnings
    process.on('warning', (warning) => {
      if (warning.name === 'MaxListenersExceededWarning') {
        this.recordSecurityEvent('memory-warning', {
          warning: warning.message,
          severity: 'medium'
        });
      }
    });
  }

  /**
   * Validate and monitor incoming requests/operations
   */
  async validateOperation(operationType, data, context = {}) {
    const startTime = performance.now();
    const operationId = this.generateOperationId();
    
    try {
      // Check rate limits
      this.checkRateLimit(context.clientId || 'anonymous');
      
      // Analyze operation for threats
      const threatAnalysis = await this.analyzeThreat(operationType, data);
      
      if (threatAnalysis.threatLevel === 'high' || threatAnalysis.threatLevel === 'critical') {
        this.blockOperation(operationId, threatAnalysis);
        throw new SecurityError(`Operation blocked: ${threatAnalysis.reason}`);
      }

      if (threatAnalysis.threatLevel === 'medium') {
        this.recordSecurityEvent('suspicious-operation', {
          operationId,
          operationType,
          threats: threatAnalysis.threats,
          severity: 'medium'
        });
      }

      // Record successful operation
      this.metrics.totalRequests++;
      
      const duration = performance.now() - startTime;
      this.recordSecurityEvent('operation-validated', {
        operationId,
        operationType,
        duration,
        severity: 'info'
      });

      return {
        operationId,
        allowed: true,
        duration,
        warnings: threatAnalysis.threats.filter(t => t.level === 'low')
      };

    } catch (error) {
      this.metrics.blockedRequests++;
      this.recordFailedAttempt(context.clientId || 'anonymous');
      
      this.recordSecurityEvent('operation-blocked', {
        operationId,
        operationType,
        error: error.message,
        severity: 'high'
      });

      throw error;
    }
  }

  /**
   * Analyze operation for security threats
   */
  async analyzeThreat(operationType, data) {
    const threats = [];
    let maxThreatLevel = 'none';

    // Convert data to string for pattern matching
    const dataString = JSON.stringify(data);

    // Check for injection attacks
    for (const pattern of this.threatPatterns.injectionAttacks) {
      if (pattern.test(dataString)) {
        threats.push({
          type: 'injection',
          pattern: pattern.toString(),
          level: 'high'
        });
        maxThreatLevel = this.escalateThreatLevel(maxThreatLevel, 'high');
      }
    }

    // Check for path traversal
    for (const pattern of this.threatPatterns.pathTraversal) {
      if (pattern.test(dataString)) {
        threats.push({
          type: 'path-traversal',
          pattern: pattern.toString(),
          level: 'high'
        });
        maxThreatLevel = this.escalateThreatLevel(maxThreatLevel, 'high');
      }
    }

    // Check for command injection
    for (const pattern of this.threatPatterns.commandInjection) {
      if (pattern.test(dataString)) {
        threats.push({
          type: 'command-injection',
          pattern: pattern.toString(),
          level: 'critical'
        });
        maxThreatLevel = this.escalateThreatLevel(maxThreatLevel, 'critical');
      }
    }

    // Check for suspicious file operations
    if (operationType.includes('file') || operationType.includes('write')) {
      for (const pattern of this.threatPatterns.suspiciousFiles) {
        if (pattern.test(dataString)) {
          threats.push({
            type: 'suspicious-file',
            pattern: pattern.toString(),
            level: 'medium'
          });
          maxThreatLevel = this.escalateThreatLevel(maxThreatLevel, 'medium');
        }
      }
    }

    // Check data size limits
    if (dataString.length > 100000) { // 100KB
      threats.push({
        type: 'large-payload',
        size: dataString.length,
        level: 'medium'
      });
      maxThreatLevel = this.escalateThreatLevel(maxThreatLevel, 'medium');
    }

    return {
      threatLevel: maxThreatLevel,
      threats,
      reason: threats.length > 0 ? `Detected ${threats.length} security threats` : 'No threats detected'
    };
  }

  /**
   * Escalate threat level to higher severity
   */
  escalateThreatLevel(currentLevel, newLevel) {
    const levels = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
    return levels[newLevel] > levels[currentLevel] ? newLevel : currentLevel;
  }

  /**
   * Check rate limits for client
   */
  checkRateLimit(clientId) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old entries
    for (const [id, timestamps] of this.requestCounts.entries()) {
      this.requestCounts.set(id, timestamps.filter(t => t > oneMinuteAgo));
      if (this.requestCounts.get(id).length === 0) {
        this.requestCounts.delete(id);
      }
    }

    // Check current client
    const clientRequests = this.requestCounts.get(clientId) || [];
    clientRequests.push(now);
    this.requestCounts.set(clientId, clientRequests);

    if (clientRequests.length > this.thresholds.maxRequestsPerMinute) {
      throw new SecurityError('Rate limit exceeded');
    }

    // Check failed attempts
    const failedAttempts = this.failedAttempts.get(clientId) || [];
    const recentFailures = failedAttempts.filter(t => t > oneMinuteAgo);
    
    if (recentFailures.length > this.thresholds.maxFailedAttemptsPerMinute) {
      throw new SecurityError('Too many failed attempts');
    }
  }

  /**
   * Record failed authentication/operation attempt
   */
  recordFailedAttempt(clientId) {
    const now = Date.now();
    const attempts = this.failedAttempts.get(clientId) || [];
    attempts.push(now);
    this.failedAttempts.set(clientId, attempts);

    // Alert on suspicious pattern
    const oneMinuteAgo = now - 60000;
    const recentFailures = attempts.filter(t => t > oneMinuteAgo);
    
    if (recentFailures.length >= this.thresholds.maxFailedAttemptsPerMinute) {
      this.recordSecurityEvent('brute-force-attempt', {
        clientId,
        failedAttempts: recentFailures.length,
        severity: 'high'
      });
    }
  }

  /**
   * Block operation and record threat
   */
  blockOperation(operationId, threatAnalysis) {
    this.threats.set(operationId, {
      ...threatAnalysis,
      timestamp: Date.now(),
      blocked: true
    });

    this.metrics.blockedRequests++;
    this.metrics.lastThreatTime = Date.now();

    this.recordSecurityEvent('operation-blocked', {
      operationId,
      threats: threatAnalysis.threats,
      severity: threatAnalysis.threatLevel
    });
  }

  /**
   * Perform periodic security checks
   */
  performSecurityChecks() {
    // Check for suspicious patterns
    this.checkSuspiciousPatterns();
    
    // Check threat accumulation
    this.checkThreatAccumulation();
    
    // Validate system integrity
    this.checkSystemIntegrity();
  }

  /**
   * Check for accumulating suspicious patterns
   */
  checkSuspiciousPatterns() {
    const oneHourAgo = Date.now() - 3600000;
    const recentEvents = this.securityEvents.filter(e => e.timestamp > oneHourAgo);
    
    // Group events by type
    const eventCounts = {};
    recentEvents.forEach(event => {
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
    });

    // Alert on suspicious patterns
    for (const [eventType, count] of Object.entries(eventCounts)) {
      if (count >= this.thresholds.suspiciousPatternThreshold) {
        this.recordSecurityEvent('suspicious-pattern', {
          eventType,
          count,
          timeWindow: '1 hour',
          severity: 'medium'
        });
      }
    }
  }

  /**
   * Check threat accumulation
   */
  checkThreatAccumulation() {
    const tenMinutesAgo = Date.now() - 600000;
    const recentThreats = Array.from(this.threats.values())
      .filter(t => t.timestamp > tenMinutesAgo);

    if (recentThreats.length >= 10) {
      this.recordSecurityEvent('threat-accumulation', {
        threatCount: recentThreats.length,
        timeWindow: '10 minutes',
        severity: 'high'
      });
    }
  }

  /**
   * Check system resource usage
   */
  checkResourceUsage() {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;

    if (memUsageMB > this.thresholds.maxMemoryUsageMB) {
      this.resourceMonitor.memoryAlerts++;
      this.recordSecurityEvent('high-memory-usage', {
        memoryUsageMB: Math.round(memUsageMB),
        threshold: this.thresholds.maxMemoryUsageMB,
        severity: 'medium'
      });
    }

    // CPU usage check (simplified)
    const cpuTime = process.cpuUsage();
    const cpuPercent = (cpuTime.user + cpuTime.system) / 1000000; // Convert to seconds
    
    if (cpuPercent > this.thresholds.maxCpuUsagePercent) {
      this.resourceMonitor.cpuAlerts++;
      this.recordSecurityEvent('high-cpu-usage', {
        cpuPercent: Math.round(cpuPercent),
        threshold: this.thresholds.maxCpuUsagePercent,
        severity: 'medium'
      });
    }
  }

  /**
   * Check system integrity
   */
  async checkSystemIntegrity() {
    try {
      // Check if critical files have been modified
      const criticalFiles = [
        path.join(process.cwd(), 'package.json'),
        path.join(process.cwd(), 'package-lock.json'),
        path.join(__dirname, 'input-validator.js'),
        path.join(__dirname, 'path-security.js')
      ];

      for (const filePath of criticalFiles) {
        if (await fs.pathExists(filePath)) {
          const stats = await fs.stat(filePath);
          const cacheKey = `integrity:${filePath}`;
          const cached = this.getCachedIntegrity(cacheKey);

          if (cached && cached.mtime !== stats.mtime.getTime()) {
            this.recordSecurityEvent('file-integrity-violation', {
              file: filePath,
              previousModified: new Date(cached.mtime).toISOString(),
              currentModified: stats.mtime.toISOString(),
              severity: 'high'
            });
          }

          // Cache current state
          this.setCachedIntegrity(cacheKey, {
            mtime: stats.mtime.getTime(),
            size: stats.size
          });
        }
      }

    } catch (error) {
      this.recordSecurityEvent('integrity-check-failed', {
        error: error.message,
        severity: 'medium'
      });
    }
  }

  /**
   * Record security event
   */
  recordSecurityEvent(type, data) {
    const event = {
      id: this.generateEventId(),
      type,
      timestamp: Date.now(),
      data,
      severity: data.severity || 'info'
    };

    this.securityEvents.push(event);
    this.emit('security:event', event);

    // Log critical/high severity events
    if (['critical', 'high'].includes(event.severity)) {
      console.warn(`[SECURITY] ${type}: ${JSON.stringify(data)}`);
      this.metrics.suspiciousActivity++;
    }

    // Trigger automated responses for critical events
    if (event.severity === 'critical') {
      this.handleCriticalEvent(event);
    }
  }

  /**
   * Handle critical security events with automated response
   */
  handleCriticalEvent(event) {
    this.emit('security:critical', event);
    
    // Could implement automated responses like:
    // - Temporary service shutdown
    // - Alert notifications
    // - Enhanced monitoring
    // - Automatic backups
    
    console.error(`[CRITICAL SECURITY EVENT] ${event.type}: ${JSON.stringify(event.data)}`);
  }

  /**
   * Clean up old events and data
   */
  cleanupOldEvents() {
    const oneDayAgo = Date.now() - 86400000; // 24 hours
    
    // Remove old security events
    this.securityEvents = this.securityEvents.filter(e => e.timestamp > oneDayAgo);
    
    // Remove old threats
    for (const [id, threat] of this.threats.entries()) {
      if (threat.timestamp < oneDayAgo) {
        this.threats.delete(id);
      }
    }

    // Clean failed attempts
    for (const [clientId, attempts] of this.failedAttempts.entries()) {
      const recentAttempts = attempts.filter(t => t > oneDayAgo);
      if (recentAttempts.length === 0) {
        this.failedAttempts.delete(clientId);
      } else {
        this.failedAttempts.set(clientId, recentAttempts);
      }
    }
  }

  /**
   * Generate unique operation ID
   */
  generateOperationId() {
    return `op_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `evt_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  /**
   * Get cached integrity data
   */
  getCachedIntegrity(key) {
    // In production, this would use a persistent cache
    return this._integrityCache?.get(key);
  }

  /**
   * Set cached integrity data
   */
  setCachedIntegrity(key, data) {
    if (!this._integrityCache) {
      this._integrityCache = new Map();
    }
    this._integrityCache.set(key, data);
  }

  /**
   * Get security metrics and status
   */
  getSecurityStatus() {
    const now = Date.now();
    const uptime = now - this.metrics.uptime;
    
    return {
      monitoring: this.isMonitoring,
      uptime,
      metrics: {
        ...this.metrics,
        requestsPerMinute: this.calculateRequestsPerMinute(),
        threatLevel: this.calculateCurrentThreatLevel(),
        recentEvents: this.securityEvents.slice(-10),
        activeThreats: this.threats.size
      },
      thresholds: this.thresholds,
      resourceUsage: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        memoryAlerts: this.resourceMonitor.memoryAlerts,
        cpuAlerts: this.resourceMonitor.cpuAlerts
      }
    };
  }

  /**
   * Calculate current requests per minute
   */
  calculateRequestsPerMinute() {
    const oneMinuteAgo = Date.now() - 60000;
    let totalRequests = 0;
    
    for (const timestamps of this.requestCounts.values()) {
      totalRequests += timestamps.filter(t => t > oneMinuteAgo).length;
    }
    
    return totalRequests;
  }

  /**
   * Calculate current threat level
   */
  calculateCurrentThreatLevel() {
    const oneHourAgo = Date.now() - 3600000;
    const recentEvents = this.securityEvents.filter(e => e.timestamp > oneHourAgo);
    
    const criticalEvents = recentEvents.filter(e => e.severity === 'critical').length;
    const highEvents = recentEvents.filter(e => e.severity === 'high').length;
    
    if (criticalEvents > 0) return 'critical';
    if (highEvents > 2) return 'high';
    if (recentEvents.length > 10) return 'medium';
    return 'low';
  }
}

// Export singleton instance
export const runtimeSecurityMonitor = new RuntimeSecurityMonitor();