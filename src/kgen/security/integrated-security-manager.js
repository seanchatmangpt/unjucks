/**
 * Integrated Security Manager
 * Enterprise-grade security orchestration bringing together all security components
 * Provides centralized security management for KGEN production deployment
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import { InputValidator } from './input-validator.js';
import { SandboxManager } from './sandbox-manager.js';
import { AccessControlManager } from './access-control.js';
import { ThreatDetector } from './threat-detector.js';
import { SecurityManager } from './manager.js';
import { createHash, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export class IntegratedSecurityManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Security components configuration
      enableInputValidation: true,
      enableSandboxing: true,
      enableAccessControl: true,
      enableThreatDetection: true,
      enableSecurityManager: true,
      
      // Integration settings
      enableRealTimeMonitoring: true,
      enableSecurityOrchestration: true,
      enableAutomaticResponse: false,
      
      // Production hardening
      productionMode: process.env.NODE_ENV === 'production',
      strictSecurityMode: true,
      zeroToleranceMode: false,
      
      // Audit and compliance
      enableComprehensiveAudit: true,
      auditRetentionDays: 90,
      complianceFrameworks: ['SOX', 'HIPAA', 'GDPR'],
      
      // Performance settings
      maxConcurrentSecurityChecks: 100,
      securityCheckTimeout: 30000,
      enableSecurityCaching: true,
      
      ...config
    };
    
    this.logger = consola.withTag('integrated-security');
    this.state = 'uninitialized';
    
    // Security components
    this.components = {
      inputValidator: null,
      sandboxManager: null,
      accessControl: null,
      threatDetector: null,
      securityManager: null
    };
    
    // Security state
    this.securitySessions = new Map();
    this.securityEvents = [];
    this.securityMetrics = {
      totalSecurityChecks: 0,
      threatsBlocked: 0,
      accessDenied: 0,
      validationFailures: 0,
      sandboxViolations: 0,
      avgSecurityCheckTime: 0
    };
    
    // Active security monitoring
    this.activeChecks = new Map();
    this.securityAlerts = [];
    
    // Compliance tracking
    this.complianceStatus = new Map();
  }

  /**
   * Initialize integrated security system
   */
  async initialize() {
    try {
      this.logger.info('🛡️ Initializing integrated security system...');
      this.state = 'initializing';
      
      // Initialize security components
      await this._initializeSecurityComponents();
      
      // Setup component integrations
      await this._setupComponentIntegrations();
      
      // Start security monitoring
      if (this.config.enableRealTimeMonitoring) {
        await this._startSecurityMonitoring();
      }
      
      // Initialize compliance tracking
      if (this.config.enableComprehensiveAudit) {
        await this._initializeComplianceTracking();
      }
      
      this.state = 'ready';
      this.logger.success('✅ Integrated security system ready');
      
      this.emit('security-system-ready', {
        components: Object.keys(this.components),
        productionMode: this.config.productionMode,
        strictMode: this.config.strictSecurityMode
      });
      
    } catch (error) {
      this.state = 'error';
      this.logger.error('❌ Failed to initialize security system:', error);
      throw error;
    }
  }

  /**
   * Comprehensive security validation pipeline
   * @param {object} request - Security validation request
   * @returns {Promise<object>} Security validation result
   */
  async validateSecurity(request) {
    const startTime = this.getDeterministicTimestamp();
    const validationId = randomBytes(16).toString('hex');
    
    try {
      this.logger.info(`🔍 Starting security validation: ${validationId}`);
      
      const validationResult = {
        validationId,
        passed: false,
        riskScore: 0,
        violations: [],
        recommendations: [],
        componentResults: {},
        metadata: {
          timestamp: this.getDeterministicDate(),
          request: {
            type: request.type,
            size: this._getRequestSize(request),
            user: request.user?.id || 'anonymous'
          },
          validationTime: 0
        }
      };
      
      // Track active validation
      this.activeChecks.set(validationId, {
        startTime,
        request,
        status: 'in-progress'
      });
      
      // 1. Input Validation
      if (this.config.enableInputValidation && request.input) {
        const inputValidation = await this._validateInput(request.input, request.context);
        validationResult.componentResults.inputValidation = inputValidation;
        
        if (!inputValidation.valid) {
          validationResult.violations.push(...inputValidation.errors);
          validationResult.riskScore += 30;
        }
        
        if (inputValidation.threats?.length > 0) {
          validationResult.violations.push(`Input threats detected: ${inputValidation.threats.length}`);
          validationResult.riskScore += 40;
        }
      }
      
      // 2. Threat Detection
      if (this.config.enableThreatDetection && request.input) {
        const threatAnalysis = await this._analyzeThreatss(request.input, request.context);
        validationResult.componentResults.threatDetection = threatAnalysis;
        
        if (!threatAnalysis.safe) {
          validationResult.violations.push(...threatAnalysis.threats.map(t => t.description));
          validationResult.riskScore += threatAnalysis.riskScore;
        }
      }
      
      // 3. Access Control Validation
      if (this.config.enableAccessControl && request.filePath) {
        const accessCheck = await this._checkAccess(request.filePath, request.operation, request.user);
        validationResult.componentResults.accessControl = accessCheck;
        
        if (!accessCheck.allowed) {
          validationResult.violations.push(accessCheck.reason);
          validationResult.riskScore += 50;
        }
      }
      
      // 4. Authentication & Authorization
      if (this.config.enableSecurityManager && request.user) {
        const authCheck = await this._validateAuthentication(request.user, request.context);
        validationResult.componentResults.authentication = authCheck;
        
        if (!authCheck.authenticated) {
          validationResult.violations.push('Authentication failed');
          validationResult.riskScore += 60;
        }
      }
      
      // 5. Compliance Validation
      if (this.config.enableComprehensiveAudit) {
        const complianceCheck = await this._validateCompliance(request);
        validationResult.componentResults.compliance = complianceCheck;
        
        if (!complianceCheck.compliant) {
          validationResult.violations.push(...complianceCheck.violations);
          validationResult.riskScore += 25;
        }
      }
      
      // Determine overall result
      validationResult.passed = validationResult.violations.length === 0;
      
      // Generate security recommendations
      validationResult.recommendations = this._generateSecurityRecommendations(validationResult);
      
      // Update metrics
      this.securityMetrics.totalSecurityChecks++;
      if (!validationResult.passed) {
        this.securityMetrics.threatsBlocked++;
      }
      
      const validationTime = this.getDeterministicTimestamp() - startTime;
      validationResult.metadata.validationTime = validationTime;
      this._updateSecurityMetrics(validationTime);
      
      // Log security event
      this._logSecurityEvent({
        type: 'security-validation',
        validationId,
        result: validationResult,
        request: this._sanitizeRequestForLogging(request)
      });
      
      // Handle high-risk scenarios
      if (validationResult.riskScore > 75) {
        await this._handleHighRiskValidation(validationResult, request);
      }
      
      // Cleanup tracking
      this.activeChecks.delete(validationId);
      
      this.logger.info(`✅ Security validation completed: ${validationId} (${validationTime}ms)`);
      
      return validationResult;
      
    } catch (error) {
      this.logger.error(`❌ Security validation failed: ${validationId}`, error);
      
      // Cleanup tracking
      this.activeChecks.delete(validationId);
      
      return {
        validationId,
        passed: false,
        riskScore: 100,
        violations: [`Security validation error: ${error.message}`],
        recommendations: ['Manual security review required'],
        componentResults: {},
        metadata: {
          timestamp: this.getDeterministicDate(),
          validationTime: this.getDeterministicTimestamp() - startTime,
          error: error.message
        }
      };
    }
  }

  /**
   * Execute operation in secure sandbox with full security validation
   * @param {object} operation - Operation to execute securely
   * @returns {Promise<object>} Secure execution result
   */
  async executeSecurely(operation) {
    const executionId = randomBytes(16).toString('hex');
    
    try {
      this.logger.info(`🔒 Starting secure execution: ${executionId}`);
      
      // Pre-execution security validation
      const securityValidation = await this.validateSecurity({
        type: 'execution',
        input: operation.template || operation.code,
        variables: operation.variables,
        context: operation.context,
        user: operation.user,
        filePath: operation.filePath,
        operation: 'execute'
      });
      
      if (!securityValidation.passed) {
        throw new Error(`Security validation failed: ${securityValidation.violations.join(', ')}`);
      }
      
      // Execute in sandbox with security monitoring
      let executionResult;
      
      if (operation.type === 'template') {
        executionResult = await this.components.sandboxManager.executeTemplate(
          operation.template,
          operation.variables,
          {
            ...operation.options,
            securityValidation,
            executionId
          }
        );
      } else if (operation.type === 'code') {
        executionResult = await this.components.sandboxManager.executeCode(
          operation.code,
          operation.context,
          {
            ...operation.options,
            securityValidation,
            executionId
          }
        );
      } else {
        throw new Error(`Unsupported operation type: ${operation.type}`);
      }
      
      // Post-execution security validation
      if (executionResult.success && executionResult.output) {
        const outputValidation = await this._validateOutput(executionResult.output);
        if (!outputValidation.safe) {
          this.logger.warn(`Suspicious output detected in ${executionId}`);
          executionResult.warnings = executionResult.warnings || [];
          executionResult.warnings.push(...outputValidation.warnings);
        }
      }
      
      // Log secure execution
      this._logSecurityEvent({
        type: 'secure-execution',
        executionId,
        success: executionResult.success,
        securityValidation: securityValidation.validationId
      });
      
      return {
        ...executionResult,
        securityValidation,
        executionId
      };
      
    } catch (error) {
      this.logger.error(`❌ Secure execution failed: ${executionId}`, error);
      
      this._logSecurityEvent({
        type: 'secure-execution-failed',
        executionId,
        error: error.message
      });
      
      return {
        success: false,
        executionId,
        error: error.message,
        securityValidation: null
      };
    }
  }

  /**
   * Get comprehensive security status
   */
  getSecurityStatus() {
    return {
      state: this.state,
      productionMode: this.config.productionMode,
      strictMode: this.config.strictSecurityMode,
      components: {
        inputValidator: this.components.inputValidator?.getMetrics(),
        sandboxManager: this.components.sandboxManager?.getStatus(),
        accessControl: this.components.accessControl?.getMetrics(),
        threatDetector: this.components.threatDetector?.getMetrics(),
        securityManager: this.components.securityManager?.getStatus()
      },
      activeChecks: this.activeChecks.size,
      securityEvents: this.securityEvents.length,
      metrics: this.securityMetrics,
      compliance: Object.fromEntries(this.complianceStatus),
      recentAlerts: this.securityAlerts.slice(-10)
    };
  }

  /**
   * Generate comprehensive security audit report
   * @param {object} options - Report options
   * @returns {Promise<object>} Security audit report
   */
  async generateSecurityAuditReport(options = {}) {
    try {
      this.logger.info('📊 Generating comprehensive security audit report...');
      
      const report = {
        generatedAt: this.getDeterministicDate(),
        reportId: randomBytes(16).toString('hex'),
        systemStatus: this.getSecurityStatus(),
        securityEvents: this._getSecurityEventsForReport(options),
        complianceAssessment: await this._generateComplianceAssessment(),
        threatAnalysis: this._generateThreatAnalysis(),
        recommendations: await this._generateSecurityRecommendationsReport(),
        riskAssessment: this._generateRiskAssessment(),
        metadata: {
          reportPeriod: options.period || 'all-time',
          includeDetails: options.includeDetails || false
        }
      };
      
      // Save report if requested
      if (options.saveReport) {
        await this._saveSecurityReport(report);
      }
      
      this.logger.success('✅ Security audit report generated');
      
      return report;
      
    } catch (error) {
      this.logger.error('❌ Failed to generate security audit report:', error);
      throw error;
    }
  }

  /**
   * Shutdown integrated security system
   */
  async shutdown() {
    try {
      this.logger.info('🛑 Shutting down integrated security system...');
      this.state = 'shutting-down';
      
      // Generate final security report
      const finalReport = await this.generateSecurityAuditReport({
        includeDetails: true,
        saveReport: true
      });
      
      // Shutdown all components
      const shutdownPromises = Object.entries(this.components).map(async ([name, component]) => {
        if (component && typeof component.shutdown === 'function') {
          await component.shutdown();
          this.logger.info(`✅ ${name} shut down`);
        }
      });
      
      await Promise.all(shutdownPromises);
      
      // Clear state
      this.securitySessions.clear();
      this.activeChecks.clear();
      this.securityAlerts.length = 0;
      
      this.state = 'shutdown';
      this.logger.success('✅ Integrated security system shutdown complete');
      
      return finalReport;
      
    } catch (error) {
      this.logger.error('❌ Error during security system shutdown:', error);
      throw error;
    }
  }

  // Private methods

  async _initializeSecurityComponents() {
    const componentConfigs = {
      inputValidator: {
        maxGraphSize: 50 * 1024 * 1024, // 50MB
        enableDOMPurification: true,
        validationTimeout: 10000
      },
      sandboxManager: {
        maxExecutionTime: 30000,
        maxMemory: 100 * 1024 * 1024,
        enableIsolation: this.config.productionMode,
        enableSafeMode: true
      },
      accessControl: {
        enableFileSystemACL: true,
        enableAuditLog: true,
        defaultPermissions: { read: false, write: false, execute: false }
      },
      threatDetector: {
        enableRealTimeDetection: true,
        enableBehavioralAnalysis: true,
        riskScoreThreshold: this.config.strictSecurityMode ? 50 : 75
      },
      securityManager: {
        authenticationRequired: this.config.productionMode,
        enableRBAC: true,
        enablePolicyEngine: true,
        enableSecurityAudit: true
      }
    };
    
    // Initialize components in parallel
    const initPromises = [];
    
    if (this.config.enableInputValidation) {
      initPromises.push((async () => {
        this.components.inputValidator = new InputValidator(componentConfigs.inputValidator);
        await this.components.inputValidator.initialize?.();
        this.logger.info('✅ Input validator initialized');
      })());
    }
    
    if (this.config.enableSandboxing) {
      initPromises.push((async () => {
        this.components.sandboxManager = new SandboxManager(componentConfigs.sandboxManager);
        await this.components.sandboxManager.initialize();
        this.logger.info('✅ Sandbox manager initialized');
      })());
    }
    
    if (this.config.enableAccessControl) {
      initPromises.push((async () => {
        this.components.accessControl = new AccessControlManager(componentConfigs.accessControl);
        await this.components.accessControl.initialize();
        this.logger.info('✅ Access control initialized');
      })());
    }
    
    if (this.config.enableThreatDetection) {
      initPromises.push((async () => {
        this.components.threatDetector = new ThreatDetector(componentConfigs.threatDetector);
        await this.components.threatDetector.initialize();
        this.logger.info('✅ Threat detector initialized');
      })());
    }
    
    if (this.config.enableSecurityManager) {
      initPromises.push((async () => {
        this.components.securityManager = new SecurityManager(componentConfigs.securityManager);
        await this.components.securityManager.initialize();
        this.logger.info('✅ Security manager initialized');
      })());
    }
    
    await Promise.all(initPromises);
  }

  async _setupComponentIntegrations() {
    // Setup event forwarding between components
    Object.values(this.components).forEach(component => {
      if (component) {
        component.on('security-violation', (event) => {
          this.emit('security-violation', event);
          this._handleSecurityViolation(event);
        });
        
        component.on('threat-detected', (event) => {
          this.emit('threat-detected', event);
          this._handleThreatDetection(event);
        });
      }
    });
  }

  async _startSecurityMonitoring() {
    // Real-time security monitoring
    setInterval(() => {
      this._performSecurityHealthCheck();
    }, 60000); // Every minute
    
    setInterval(() => {
      this._cleanupSecurityEvents();
    }, 300000); // Every 5 minutes
  }

  async _initializeComplianceTracking() {
    for (const framework of this.config.complianceFrameworks) {
      this.complianceStatus.set(framework, {
        status: 'monitoring',
        lastAssessed: this.getDeterministicDate(),
        violations: 0,
        recommendations: []
      });
    }
  }

  async _validateInput(input, context) {
    if (!this.components.inputValidator) {
      return { valid: true, warnings: ['Input validation disabled'] };
    }
    
    if (context?.type === 'rdf') {
      return await this.components.inputValidator.validateRDFGraph(input, context);
    } else if (context?.type === 'template') {
      return await this.components.inputValidator.validateTemplate(input, context.variables, context);
    } else if (context?.type === 'sparql') {
      return await this.components.inputValidator.validateSPARQLQuery(input, context);
    } else {
      // Generic validation
      const threats = await this.components.threatDetector?.analyzeThreats(input, context);
      return {
        valid: !threats || threats.safe,
        threats: threats?.threats || [],
        sanitizedInput: input // Placeholder for sanitized input
      };
    }
  }

  async _analyzeThreatss(input, context) {
    if (!this.components.threatDetector) {
      return { safe: true, riskScore: 0, threats: [] };
    }
    
    return await this.components.threatDetector.analyzeThreats(input, context);
  }

  async _checkAccess(filePath, operation, user) {
    if (!this.components.accessControl) {
      return { allowed: true, reason: 'Access control disabled' };
    }
    
    return await this.components.accessControl.checkAccess(filePath, operation, user);
  }

  async _validateAuthentication(user, context) {
    if (!this.components.securityManager) {
      return { authenticated: true, reason: 'Authentication disabled' };
    }
    
    // Check session validity
    const session = this.securitySessions.get(user.sessionId);
    if (!session) {
      return { authenticated: false, reason: 'No valid session' };
    }
    
    // Check if session is expired
    if (this.getDeterministicTimestamp() > session.expiresAt) {
      return { authenticated: false, reason: 'Session expired' };
    }
    
    return { authenticated: true, user: session.user };
  }

  async _validateCompliance(request) {
    const complianceResult = {
      compliant: true,
      violations: [],
      frameworks: []
    };
    
    // Check each enabled compliance framework
    for (const framework of this.config.complianceFrameworks) {
      const frameworkResult = await this._checkFrameworkCompliance(framework, request);
      complianceResult.frameworks.push(frameworkResult);
      
      if (!frameworkResult.compliant) {
        complianceResult.compliant = false;
        complianceResult.violations.push(...frameworkResult.violations);
      }
    }
    
    return complianceResult;
  }

  async _checkFrameworkCompliance(framework, request) {
    // Simplified compliance checking - in production, use comprehensive rules
    switch (framework) {
      case 'GDPR':
        return this._checkGDPRCompliance(request);
      case 'HIPAA':
        return this._checkHIPAACompliance(request);
      case 'SOX':
        return this._checkSOXCompliance(request);
      default:
        return { compliant: true, violations: [] };
    }
  }

  _checkGDPRCompliance(request) {
    const violations = [];
    
    // Check for personal data processing
    if (request.input && typeof request.input === 'string') {
      const personalDataPatterns = [
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN-like patterns
        /\+\d{1,3}[-\s]?\d{1,14}/g // Phone numbers
      ];
      
      for (const pattern of personalDataPatterns) {
        if (pattern.test(request.input)) {
          violations.push('Personal data detected without proper consent tracking');
          break;
        }
      }
    }
    
    return {
      compliant: violations.length === 0,
      violations,
      framework: 'GDPR'
    };
  }

  _checkHIPAACompliance(request) {
    const violations = [];
    
    // Check for health information
    if (request.input && typeof request.input === 'string') {
      const healthKeywords = [
        'medical', 'diagnosis', 'patient', 'treatment',
        'medication', 'prescription', 'doctor', 'hospital'
      ];
      
      const lowerInput = request.input.toLowerCase();
      if (healthKeywords.some(keyword => lowerInput.includes(keyword))) {
        violations.push('Health information detected without proper safeguards');
      }
    }
    
    return {
      compliant: violations.length === 0,
      violations,
      framework: 'HIPAA'
    };
  }

  _checkSOXCompliance(request) {
    const violations = [];
    
    // Check for financial data
    if (request.input && typeof request.input === 'string') {
      const financialPatterns = [
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
        /\$[0-9,]+(\.\d{2})?/g, // Money amounts
        /\b(revenue|profit|loss|audit|financial)\b/gi
      ];
      
      for (const pattern of financialPatterns) {
        if (pattern.test(request.input)) {
          violations.push('Financial data requires enhanced audit controls');
          break;
        }
      }
    }
    
    return {
      compliant: violations.length === 0,
      violations,
      framework: 'SOX'
    };
  }

  async _validateOutput(output) {
    // Basic output validation
    const result = {
      safe: true,
      warnings: []
    };
    
    // Check output size
    if (typeof output === 'string' && output.length > 10 * 1024 * 1024) {
      result.warnings.push('Output size is very large');
    }
    
    // Check for sensitive data leakage
    if (this.components.threatDetector) {
      const threatAnalysis = await this.components.threatDetector.analyzeThreats(output, {
        type: 'output-validation'
      });
      
      if (!threatAnalysis.safe) {
        result.safe = false;
        result.warnings.push(`Output contains potential threats: ${threatAnalysis.threats.length}`);
      }
    }
    
    return result;
  }

  _generateSecurityRecommendations(validationResult) {
    const recommendations = [];
    
    if (validationResult.riskScore > 75) {
      recommendations.push('CRITICAL: Immediate manual review required');
      recommendations.push('Consider blocking this operation');
    } else if (validationResult.riskScore > 50) {
      recommendations.push('HIGH RISK: Enhanced monitoring recommended');
      recommendations.push('Apply additional security controls');
    } else if (validationResult.riskScore > 25) {
      recommendations.push('MEDIUM RISK: Standard security monitoring');
    }
    
    // Component-specific recommendations
    if (validationResult.componentResults.inputValidation?.threats?.length > 0) {
      recommendations.push('Apply input sanitization and validation');
    }
    
    if (validationResult.componentResults.accessControl?.allowed === false) {
      recommendations.push('Review and update access permissions');
    }
    
    if (validationResult.componentResults.threatDetection?.riskScore > 50) {
      recommendations.push('Implement threat mitigation measures');
    }
    
    return recommendations;
  }

  async _handleHighRiskValidation(validationResult, request) {
    const alert = {
      id: randomBytes(16).toString('hex'),
      timestamp: this.getDeterministicDate(),
      type: 'high-risk-validation',
      riskScore: validationResult.riskScore,
      violations: validationResult.violations,
      request: this._sanitizeRequestForLogging(request)
    };
    
    this.securityAlerts.push(alert);
    
    this.emit('high-risk-security-event', alert);
    
    // Auto-block if enabled and risk is critical
    if (this.config.enableAutomaticResponse && validationResult.riskScore > 90) {
      await this._blockSecurityThreat(alert);
    }
  }

  async _blockSecurityThreat(alert) {
    this.logger.warn(`🚨 Auto-blocking security threat: ${alert.id}`);
    
    // Add to blocked list (implementation specific)
    // This could involve IP blocking, user suspension, etc.
    
    this.emit('security-threat-blocked', alert);
  }

  _logSecurityEvent(event) {
    this.securityEvents.push({
      ...event,
      timestamp: this.getDeterministicDate(),
      id: randomBytes(8).toString('hex')
    });
    
    // Keep events list manageable
    if (this.securityEvents.length > 10000) {
      this.securityEvents.splice(0, 1000);
    }
  }

  _sanitizeRequestForLogging(request) {
    const sanitized = { ...request };
    
    // Remove or truncate sensitive data
    if (sanitized.input && typeof sanitized.input === 'string') {
      sanitized.input = sanitized.input.length > 200 
        ? sanitized.input.substring(0, 200) + '...'
        : sanitized.input;
    }
    
    if (sanitized.variables) {
      sanitized.variables = Object.keys(sanitized.variables);
    }
    
    return sanitized;
  }

  _getRequestSize(request) {
    let size = 0;
    
    if (request.input) {
      size += typeof request.input === 'string' 
        ? request.input.length 
        : JSON.stringify(request.input).length;
    }
    
    if (request.variables) {
      size += JSON.stringify(request.variables).length;
    }
    
    return size;
  }

  _updateSecurityMetrics(validationTime) {
    const totalChecks = this.securityMetrics.totalSecurityChecks;
    this.securityMetrics.avgSecurityCheckTime = (
      (this.securityMetrics.avgSecurityCheckTime * (totalChecks - 1) + validationTime) /
      totalChecks
    );
  }

  _performSecurityHealthCheck() {
    // Check component health
    const componentHealth = {};
    
    Object.entries(this.components).forEach(([name, component]) => {
      if (component) {
        componentHealth[name] = {
          status: component.state || 'unknown',
          metrics: component.getMetrics?.() || component.getStatus?.()
        };
      }
    });
    
    this.emit('security-health-check', {
      timestamp: this.getDeterministicDate(),
      componentHealth,
      activeChecks: this.activeChecks.size,
      recentAlerts: this.securityAlerts.slice(-5)
    });
  }

  _cleanupSecurityEvents() {
    const retentionMs = this.config.auditRetentionDays * 24 * 60 * 60 * 1000;
    const cutoff = this.getDeterministicTimestamp() - retentionMs;
    
    this.securityEvents = this.securityEvents.filter(event => 
      new Date(event.timestamp).getTime() > cutoff
    );
    
    this.securityAlerts = this.securityAlerts.filter(alert => 
      new Date(alert.timestamp).getTime() > cutoff
    );
  }

  _handleSecurityViolation(event) {
    this._logSecurityEvent({
      type: 'security-violation',
      violation: event
    });
  }

  _handleThreatDetection(event) {
    this._logSecurityEvent({
      type: 'threat-detection',
      threat: event
    });
  }

  _getSecurityEventsForReport(options) {
    let events = [...this.securityEvents];
    
    if (options.period && options.period !== 'all-time') {
      const periodMs = this._parsePeriod(options.period);
      const cutoff = this.getDeterministicTimestamp() - periodMs;
      events = events.filter(event => 
        new Date(event.timestamp).getTime() > cutoff
      );
    }
    
    return events.slice(0, options.maxEvents || 1000);
  }

  async _generateComplianceAssessment() {
    const assessment = {};
    
    for (const [framework, status] of this.complianceStatus.entries()) {
      assessment[framework] = {
        status: status.status,
        lastAssessed: status.lastAssessed,
        violations: status.violations,
        recommendations: status.recommendations
      };
    }
    
    return assessment;
  }

  _generateThreatAnalysis() {
    const threatTypes = {};
    const recentThreats = [];
    
    for (const event of this.securityEvents) {
      if (event.type === 'threat-detection' && event.threat) {
        const threatType = event.threat.type || 'unknown';
        threatTypes[threatType] = (threatTypes[threatType] || 0) + 1;
        
        if (recentThreats.length < 50) {
          recentThreats.push({
            type: threatType,
            severity: event.threat.severity,
            timestamp: event.timestamp
          });
        }
      }
    }
    
    return {
      threatTypes,
      recentThreats,
      totalThreats: Object.values(threatTypes).reduce((sum, count) => sum + count, 0)
    };
  }

  async _generateSecurityRecommendationsReport() {
    const recommendations = [];
    
    // System-level recommendations
    if (this.securityMetrics.threatsBlocked > this.securityMetrics.totalSecurityChecks * 0.1) {
      recommendations.push('HIGH: Consider strengthening input validation');
    }
    
    if (this.securityAlerts.length > 100) {
      recommendations.push('MEDIUM: Review and tune security alert thresholds');
    }
    
    // Component-specific recommendations
    Object.entries(this.components).forEach(([name, component]) => {
      if (component && component.getMetrics) {
        const metrics = component.getMetrics();
        // Add component-specific recommendations based on metrics
      }
    });
    
    return recommendations;
  }

  _generateRiskAssessment() {
    const riskFactors = {
      threatLevel: this._calculateThreatLevel(),
      systemExposure: this._calculateSystemExposure(),
      complianceRisk: this._calculateComplianceRisk(),
      operationalRisk: this._calculateOperationalRisk()
    };
    
    const overallRisk = Object.values(riskFactors).reduce((sum, risk) => sum + risk, 0) / 4;
    
    return {
      overallRisk: Math.round(overallRisk),
      riskFactors,
      riskLevel: overallRisk > 75 ? 'HIGH' : overallRisk > 50 ? 'MEDIUM' : 'LOW'
    };
  }

  _calculateThreatLevel() {
    const recentThreats = this.securityEvents
      .filter(e => e.type === 'threat-detection' && 
                   this.getDeterministicTimestamp() - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000)
      .length;
    
    return Math.min(recentThreats * 10, 100);
  }

  _calculateSystemExposure() {
    // Based on configuration and active components
    let exposure = 0;
    
    if (!this.config.productionMode) exposure += 20;
    if (!this.config.strictSecurityMode) exposure += 15;
    if (!this.config.enableThreatDetection) exposure += 25;
    if (!this.config.enableAccessControl) exposure += 30;
    
    return Math.min(exposure, 100);
  }

  _calculateComplianceRisk() {
    let risk = 0;
    
    for (const [framework, status] of this.complianceStatus.entries()) {
      if (status.violations > 0) {
        risk += status.violations * 5;
      }
    }
    
    return Math.min(risk, 100);
  }

  _calculateOperationalRisk() {
    let risk = 0;
    
    // Based on system metrics
    if (this.securityMetrics.avgSecurityCheckTime > 5000) risk += 20;
    if (this.activeChecks.size > this.config.maxConcurrentSecurityChecks * 0.8) risk += 30;
    if (this.securityAlerts.length > 1000) risk += 25;
    
    return Math.min(risk, 100);
  }

  async _saveSecurityReport(report) {
    const reportsDir = path.join(process.cwd(), 'logs', 'security-reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    const filename = `security-report-${report.reportId}-${this.getDeterministicDate().toISOString().split('T')[0]}.json`;
    const filepath = path.join(reportsDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    this.logger.info(`📄 Security report saved: ${filepath}`);
  }

  _parsePeriod(period) {
    const periods = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    return periods[period] || 24 * 60 * 60 * 1000;
  }
}

export default IntegratedSecurityManager;