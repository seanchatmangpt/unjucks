/**
 * Production Error Tracking System
 * Comprehensive error tracking, alerting, and analysis
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import logger from '../lib/observability/logger.js';
import { telemetry } from '../lib/observability/telemetry.js';
import { metricsCollector } from './metrics-collector.js';

/**
 * Error severity levels
 */
export const ErrorSeverity = {
  LOW: 'low',           // Minor issues, logs for analysis
  MEDIUM: 'medium',     // Noticeable but not critical
  HIGH: 'high',         // Significant impact on functionality
  CRITICAL: 'critical'  // Service degradation or failure
};

/**
 * Error categories for classification
 */
export const ErrorCategory = {
  VALIDATION: 'validation',     // Input validation errors
  AUTHENTICATION: 'authentication', // Auth/security errors
  AUTHORIZATION: 'authorization',   // Permission errors
  BUSINESS_LOGIC: 'business_logic', // Application logic errors
  TEMPLATE: 'template',         // Template generation errors
  RDF: 'rdf',                  // RDF processing errors
  DATABASE: 'database',         // Database errors
  NETWORK: 'network',          // Network/API errors
  SYSTEM: 'system',            // System resource errors
  UNKNOWN: 'unknown'           // Unclassified errors
};

/**
 * Error occurrence tracking
 */
class ErrorOccurrence {
  constructor(error, context = {}) {
    this.id = this.generateErrorId(error, context);
    this.error = this.normalizeError(error);
    this.context = context;
    this.firstSeen = Date.now();
    this.lastSeen = Date.now();
    this.occurrences = 1;
    this.severity = this.determineSeverity(error, context);
    this.category = this.categorizeError(error, context);
    this.resolved = false;
    this.silenced = false;
    
    // Analysis data
    this.stackTrace = error.stack || '';
    this.fingerprint = this.generateFingerprint(error);
    this.affectedUsers = new Set();
    this.relatedErrors = [];
    
    // Metadata
    this.tags = new Set();
    this.customData = {};
  }
  
  /**
   * Generate unique error ID based on error and context
   */
  generateErrorId(error, context) {
    const hash = createHash('sha256');
    hash.update(error.name || 'Error');
    hash.update(error.message || '');
    hash.update(context.operation || '');
    hash.update(context.component || '');
    return hash.digest('hex').substring(0, 16);
  }
  
  /**
   * Normalize error object
   */
  normalizeError(error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      code: error.code || null,
      status: error.status || null,
      type: error.constructor.name
    };
  }
  
  /**
   * Determine error severity based on error type and context
   */
  determineSeverity(error, context) {
    // Critical errors
    if (error.name === 'OutOfMemoryError' || 
        error.name === 'FatalError' ||
        (error.status && error.status >= 500)) {
      return ErrorSeverity.CRITICAL;
    }
    
    // High severity errors
    if (error.name === 'TypeError' ||
        error.name === 'ReferenceError' ||
        error.name === 'SecurityError' ||
        (error.status && error.status >= 400 && error.status < 500)) {
      return ErrorSeverity.HIGH;
    }
    
    // Medium severity for validation and business logic
    if (error.name === 'ValidationError' ||
        error.name === 'BusinessLogicError' ||
        context.category === ErrorCategory.TEMPLATE) {
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.LOW;
  }
  
  /**
   * Categorize error based on error type and context
   */
  categorizeError(error, context) {
    if (context.category) return context.category;
    
    // Categorize based on error properties
    if (error.name?.includes('Auth')) return ErrorCategory.AUTHENTICATION;
    if (error.name?.includes('Permission')) return ErrorCategory.AUTHORIZATION;
    if (error.name?.includes('Validation')) return ErrorCategory.VALIDATION;
    if (error.name?.includes('Template')) return ErrorCategory.TEMPLATE;
    if (error.name?.includes('RDF')) return ErrorCategory.RDF;
    if (error.name?.includes('Database')) return ErrorCategory.DATABASE;
    if (error.name?.includes('Network')) return ErrorCategory.NETWORK;
    if (error.name?.includes('Memory')) return ErrorCategory.SYSTEM;
    
    // Context-based categorization
    if (context.component?.includes('template')) return ErrorCategory.TEMPLATE;
    if (context.component?.includes('rdf')) return ErrorCategory.RDF;
    if (context.component?.includes('db')) return ErrorCategory.DATABASE;
    
    return ErrorCategory.UNKNOWN;
  }
  
  /**
   * Generate error fingerprint for grouping similar errors
   */
  generateFingerprint(error) {
    const hash = createHash('md5');
    hash.update(error.name || '');
    
    // Normalize stack trace by removing line numbers and file paths
    const normalizedStack = (error.stack || '')
      .replace(/:\d+:\d+/g, '') // Remove line:column numbers
      .replace(/\/[^\s]*\//g, '') // Remove file paths
      .replace(/\s+/g, ' '); // Normalize whitespace
    
    hash.update(normalizedStack);
    return hash.digest('hex');
  }
  
  /**
   * Record new occurrence of this error
   */
  recordOccurrence(context = {}) {
    this.lastSeen = Date.now();
    this.occurrences++;
    
    // Track affected users
    if (context.userId) {
      this.affectedUsers.add(context.userId);
    }
    
    // Add tags
    if (context.tags) {
      context.tags.forEach(tag => this.tags.add(tag));
    }
    
    // Update custom data
    if (context.customData) {
      Object.assign(this.customData, context.customData);
    }
  }
  
  /**
   * Get error summary for reporting
   */
  getSummary() {
    return {
      id: this.id,
      error: this.error,
      severity: this.severity,
      category: this.category,
      occurrences: this.occurrences,
      affectedUsers: this.affectedUsers.size,
      firstSeen: this.firstSeen,
      lastSeen: this.lastSeen,
      resolved: this.resolved,
      silenced: this.silenced,
      fingerprint: this.fingerprint,
      tags: Array.from(this.tags),
      stackTrace: this.stackTrace.split('\n').slice(0, 10), // First 10 lines
      frequency: this.getFrequency()
    };
  }
  
  /**
   * Calculate error frequency
   */
  getFrequency() {
    const timeSpan = this.lastSeen - this.firstSeen;
    if (timeSpan === 0) return this.occurrences;
    
    const hours = timeSpan / (1000 * 60 * 60);
    return Math.round((this.occurrences / hours) * 100) / 100; // Errors per hour
  }
}

/**
 * Main error tracking orchestrator
 */
class ErrorTracker extends EventEmitter {
  constructor() {
    super();
    
    this.errors = new Map(); // errorId -> ErrorOccurrence
    this.alertRules = new Map();
    this.integrations = new Map();
    
    // Configuration
    this.config = {
      maxErrors: 10000,              // Maximum errors to keep in memory
      alertCooldownMs: 5 * 60 * 1000, // 5 minutes between duplicate alerts
      silenceTimeoutMs: 60 * 60 * 1000, // 1 hour silence timeout
      retentionDays: 30              // Keep errors for 30 days
    };
    
    // Alert history
    this.alertHistory = [];
    this.silencedAlerts = new Map();
    
    this.initializeDefaultAlertRules();
    this.startCleanupInterval();
  }
  
  /**
   * Initialize default alert rules
   */
  initializeDefaultAlertRules() {
    // Critical error immediate alert
    this.addAlertRule('critical_errors', {
      condition: (occurrence) => occurrence.severity === ErrorSeverity.CRITICAL,
      cooldown: 0, // Immediate alerts for critical errors
      message: (occurrence) => `Critical error detected: ${occurrence.error.message}`,
      channels: ['email', 'slack', 'pagerduty']
    });
    
    // High frequency error alert
    this.addAlertRule('high_frequency_errors', {
      condition: (occurrence) => occurrence.getFrequency() > 10, // > 10 errors/hour
      cooldown: 15 * 60 * 1000, // 15 minutes
      message: (occurrence) => `High frequency error (${occurrence.getFrequency()}/hour): ${occurrence.error.message}`,
      channels: ['slack']
    });
    
    // New error type alert
    this.addAlertRule('new_error_types', {
      condition: (occurrence) => occurrence.occurrences === 1 && occurrence.severity !== ErrorSeverity.LOW,
      cooldown: 5 * 60 * 1000, // 5 minutes
      message: (occurrence) => `New ${occurrence.severity} error detected: ${occurrence.error.message}`,
      channels: ['slack']
    });
    
    // Multiple users affected alert
    this.addAlertRule('widespread_errors', {
      condition: (occurrence) => occurrence.affectedUsers.size >= 5,
      cooldown: 30 * 60 * 1000, // 30 minutes
      message: (occurrence) => `Error affecting ${occurrence.affectedUsers.size} users: ${occurrence.error.message}`,
      channels: ['email', 'slack']
    });
  }
  
  /**
   * Track an error occurrence
   */
  trackError(error, context = {}) {
    try {
      let occurrence = new ErrorOccurrence(error, context);
      
      // Check if we've seen this error before
      const existingError = this.errors.get(occurrence.id);
      
      if (existingError) {
        existingError.recordOccurrence(context);
        occurrence = existingError;
      } else {
        this.errors.set(occurrence.id, occurrence);
        
        // Maintain size limit
        if (this.errors.size > this.config.maxErrors) {
          this.cleanupOldErrors();
        }
      }
      
      // Log error
      this.logError(occurrence, context);
      
      // Record metrics
      this.recordErrorMetrics(occurrence, context);
      
      // Check alert rules
      this.checkAlertRules(occurrence);
      
      // Emit event
      this.emit('error-tracked', {
        occurrence,
        context,
        isNew: !existingError
      });
      
      return occurrence;
      
    } catch (trackingError) {
      logger.error('Failed to track error', trackingError, {
        originalError: error.message,
        context
      });
    }
  }
  
  /**
   * Log error occurrence
   */
  logError(occurrence, context) {
    const logData = {
      errorId: occurrence.id,
      severity: occurrence.severity,
      category: occurrence.category,
      occurrences: occurrence.occurrences,
      fingerprint: occurrence.fingerprint,
      context
    };
    
    switch (occurrence.severity) {
      case ErrorSeverity.CRITICAL:
        logger.fatal(occurrence.error.message, occurrence.error, logData, context.correlationId);
        break;
      case ErrorSeverity.HIGH:
        logger.error(occurrence.error.message, occurrence.error, logData, context.correlationId);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(occurrence.error.message, logData, context.correlationId);
        break;
      default:
        logger.info(occurrence.error.message, logData, context.correlationId);
    }
  }
  
  /**
   * Record error metrics
   */
  recordErrorMetrics(occurrence, context) {
    if (!metricsCollector) return;
    
    // Record general error metrics
    metricsCollector.recordError(
      occurrence.category,
      occurrence.severity,
      context.component || 'unknown',
      {
        errorType: occurrence.error.name,
        errorId: occurrence.id,
        occurrences: occurrence.occurrences
      }
    );
    
    // Record specific error type metrics
    if (occurrence.category === ErrorCategory.TEMPLATE) {
      metricsCollector.record('template_generation_errors_total', 1, {
        error_type: occurrence.error.name,
        template_type: context.templateType || 'unknown'
      });
    }
    
    // Record in telemetry
    if (telemetry && telemetry.recordMetric) {
      telemetry.recordMetric('errors_total', 1, {
        severity: occurrence.severity,
        category: occurrence.category,
        error_type: occurrence.error.name
      });
    }
  }
  
  /**
   * Check alert rules for error occurrence
   */
  checkAlertRules(occurrence) {
    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.enabled) continue;
      
      try {
        if (rule.condition(occurrence)) {
          this.triggerAlert(ruleId, rule, occurrence);
        }
      } catch (error) {
        logger.error(`Error checking alert rule ${ruleId}`, error);
      }
    }
  }
  
  /**
   * Trigger alert for error occurrence
   */
  triggerAlert(ruleId, rule, occurrence) {
    const alertKey = `${ruleId}_${occurrence.id}`;
    const now = Date.now();
    
    // Check cooldown
    const lastAlert = this.silencedAlerts.get(alertKey);
    if (lastAlert && (now - lastAlert) < (rule.cooldown || this.config.alertCooldownMs)) {
      return;
    }
    
    const alert = {
      id: `${alertKey}_${now}`,
      ruleId,
      errorId: occurrence.id,
      severity: occurrence.severity,
      message: typeof rule.message === 'function' ? rule.message(occurrence) : rule.message,
      channels: rule.channels || ['log'],
      timestamp: now,
      occurrence: occurrence.getSummary()
    };
    
    this.alertHistory.push(alert);
    
    // Maintain alert history size
    if (this.alertHistory.length > 1000) {
      this.alertHistory.shift();
    }
    
    // Set cooldown
    this.silencedAlerts.set(alertKey, now);
    
    // Send alert
    this.sendAlert(alert);
    
    this.emit('alert-triggered', alert);
  }
  
  /**
   * Send alert through configured channels
   */
  async sendAlert(alert) {
    logger.error(`ERROR ALERT: ${alert.message}`, null, {
      alertId: alert.id,
      errorId: alert.errorId,
      severity: alert.severity,
      channels: alert.channels
    });
    
    // Send to configured integrations
    for (const channel of alert.channels) {
      const integration = this.integrations.get(channel);
      if (integration) {
        try {
          await integration.sendAlert(alert);
        } catch (error) {
          logger.error(`Failed to send alert to ${channel}`, error);
        }
      }
    }
  }
  
  /**
   * Add alert rule
   */
  addAlertRule(ruleId, rule) {
    this.alertRules.set(ruleId, {
      enabled: true,
      cooldown: this.config.alertCooldownMs,
      channels: ['log'],
      ...rule
    });
    
    logger.info(`Added error alert rule: ${ruleId}`);
  }
  
  /**
   * Add integration (Slack, email, PagerDuty, etc.)
   */
  addIntegration(name, integration) {
    this.integrations.set(name, integration);
    logger.info(`Added error tracking integration: ${name}`);
  }
  
  /**
   * Get error dashboard data
   */
  getErrorDashboard(timeWindow = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - timeWindow;
    const recentErrors = Array.from(this.errors.values())
      .filter(error => error.lastSeen > cutoff);
    
    // Group by category
    const categoryStats = {};
    const severityStats = {};
    
    recentErrors.forEach(error => {
      // Category stats
      if (!categoryStats[error.category]) {
        categoryStats[error.category] = {
          count: 0,
          occurrences: 0,
          affectedUsers: new Set()
        };
      }
      categoryStats[error.category].count++;
      categoryStats[error.category].occurrences += error.occurrences;
      error.affectedUsers.forEach(user => 
        categoryStats[error.category].affectedUsers.add(user)
      );
      
      // Severity stats
      if (!severityStats[error.severity]) {
        severityStats[error.severity] = {
          count: 0,
          occurrences: 0
        };
      }
      severityStats[error.severity].count++;
      severityStats[error.severity].occurrences += error.occurrences;
    });
    
    // Convert Set to count for affected users
    Object.values(categoryStats).forEach(stats => {
      stats.affectedUsers = stats.affectedUsers.size;
    });
    
    // Top errors by frequency
    const topErrors = recentErrors
      .sort((a, b) => b.getFrequency() - a.getFrequency())
      .slice(0, 20)
      .map(error => error.getSummary());
    
    // Recent alerts
    const recentAlerts = this.alertHistory
      .filter(alert => alert.timestamp > cutoff)
      .slice(-50);
    
    return {
      summary: {
        totalErrors: recentErrors.length,
        totalOccurrences: recentErrors.reduce((sum, error) => sum + error.occurrences, 0),
        totalAffectedUsers: new Set(recentErrors.flatMap(error => Array.from(error.affectedUsers))).size,
        totalAlerts: recentAlerts.length
      },
      categoryStats,
      severityStats,
      topErrors,
      recentAlerts,
      timeWindow: `${timeWindow / (60 * 60 * 1000)}h`,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Get error details by ID
   */
  getErrorDetails(errorId) {
    const error = this.errors.get(errorId);
    if (!error) return null;
    
    return {
      ...error.getSummary(),
      fullStackTrace: error.stackTrace,
      context: error.context,
      customData: error.customData,
      relatedErrors: error.relatedErrors
    };
  }
  
  /**
   * Resolve an error (mark as fixed)
   */
  resolveError(errorId, resolution = {}) {
    const error = this.errors.get(errorId);
    if (!error) return false;
    
    error.resolved = true;
    error.resolution = {
      timestamp: Date.now(),
      ...resolution
    };
    
    logger.info(`Error resolved: ${errorId}`, {
      errorMessage: error.error.message,
      resolution
    });
    
    this.emit('error-resolved', {
      errorId,
      error: error.getSummary(),
      resolution
    });
    
    return true;
  }
  
  /**
   * Silence error alerts temporarily
   */
  silenceError(errorId, durationMs = this.config.silenceTimeoutMs) {
    const error = this.errors.get(errorId);
    if (!error) return false;
    
    error.silenced = true;
    error.silencedUntil = Date.now() + durationMs;
    
    logger.info(`Error silenced: ${errorId}`, {
      duration: `${durationMs / (60 * 1000)}min`
    });
    
    // Auto-unsilence after duration
    setTimeout(() => {
      if (error.silenced) {
        error.silenced = false;
        delete error.silencedUntil;
        logger.info(`Error unsilenced: ${errorId}`);
      }
    }, durationMs);
    
    return true;
  }
  
  /**
   * Start cleanup interval for old errors
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupOldErrors();
      this.cleanupOldAlerts();
    }, 60 * 60 * 1000); // Every hour
  }
  
  /**
   * Clean up old errors based on retention policy
   */
  cleanupOldErrors() {
    const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [errorId, error] of this.errors.entries()) {
      if (error.lastSeen < cutoff && error.resolved) {
        this.errors.delete(errorId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} old resolved errors`);
    }
  }
  
  /**
   * Clean up old alerts
   */
  cleanupOldAlerts() {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    
    this.alertHistory = this.alertHistory.filter(alert => alert.timestamp > cutoff);
    
    // Clean up silenced alerts
    for (const [key, timestamp] of this.silencedAlerts.entries()) {
      if (timestamp < cutoff) {
        this.silencedAlerts.delete(key);
      }
    }
  }
  
  /**
   * Export error data
   */
  exportErrorData(format = 'json', timeRange = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - timeRange;
    const recentErrors = Array.from(this.errors.values())
      .filter(error => error.lastSeen > cutoff)
      .map(error => error.getSummary());
    
    const data = {
      exportTime: new Date().toISOString(),
      timeRange: `${timeRange / (60 * 60 * 1000)}h`,
      errors: recentErrors,
      alerts: this.alertHistory.filter(alert => alert.timestamp > cutoff)
    };
    
    if (format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * Convert data to CSV format
   */
  convertToCSV(data) {
    let csv = 'ErrorId,Severity,Category,Message,Occurrences,AffectedUsers,FirstSeen,LastSeen,Resolved\n';
    
    data.errors.forEach(error => {
      csv += `"${error.id}","${error.severity}","${error.category}","${error.error.message.replace(/"/g, '""')}",${error.occurrences},${error.affectedUsers},"${new Date(error.firstSeen).toISOString()}","${new Date(error.lastSeen).toISOString()}",${error.resolved}\n`;
    });
    
    return csv;
  }
  
  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('[ErrorTracker] Shutting down error tracker...');
    
    this.removeAllListeners();
    
    logger.info('[ErrorTracker] Shutdown complete');
  }
}

/**
 * Global error handler that integrates with error tracker
 */
export function setupGlobalErrorHandling(errorTracker) {
  // Uncaught exceptions
  process.on('uncaughtException', (error) => {
    errorTracker.trackError(error, {
      category: ErrorCategory.SYSTEM,
      component: 'process',
      operation: 'uncaughtException',
      fatal: true
    });
    
    logger.fatal('Uncaught exception', error);
    
    // Give time for error tracking, then exit
    setTimeout(() => process.exit(1), 1000);
  });
  
  // Unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    
    errorTracker.trackError(error, {
      category: ErrorCategory.SYSTEM,
      component: 'process',
      operation: 'unhandledRejection',
      promise: promise.toString()
    });
    
    logger.error('Unhandled promise rejection', error);
  });
  
  // Warning events
  process.on('warning', (warning) => {
    errorTracker.trackError(warning, {
      category: ErrorCategory.SYSTEM,
      component: 'process',
      operation: 'warning',
      severity: ErrorSeverity.MEDIUM
    });
  });
}

/**
 * Error tracking decorator
 */
export function TrackErrors(category = ErrorCategory.UNKNOWN, component = null) {
  return function(target, propertyName, descriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        if (errorTracker) {
          errorTracker.trackError(error, {
            category,
            component: component || target.constructor.name,
            operation: propertyName,
            args: args.length
          });
        }
        throw error;
      }
    };
    
    return descriptor;
  };
}

// Export singleton instance
export const errorTracker = new ErrorTracker();
export { ErrorTracker, ErrorOccurrence };
export default errorTracker;
