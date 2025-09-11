/**
 * Security Validation Engine
 * 
 * Advanced validation engine for templates, code, data, and file operations
 * with enterprise security scanning and threat detection capabilities.
 */

import { EventEmitter } from 'events';
import path from 'path';
import consola from 'consola';

export class ValidationEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Validation Configuration
      enableTemplateValidation: true,
      enableCodeValidation: true,
      enableDataValidation: true,
      enableFileValidation: true,
      
      // Security Scanning
      enableVulnerabilityScanning: true,
      enableMalwareDetection: false, // Requires additional dependencies
      enableContentFiltering: true,
      
      // Validation Strictness
      strictMode: config.strictMode || true,
      blockOnViolation: config.blockOnViolation || true,
      enableWhitelist: config.enableWhitelist || true,
      
      // Performance
      enableCaching: config.enableCaching || true,
      cacheTimeout: config.cacheTimeout || 300000, // 5 minutes
      maxValidationTime: config.maxValidationTime || 30000, // 30 seconds
      
      ...config
    };
    
    this.logger = consola.withTag('validation-engine');
    this.status = 'uninitialized';
    
    // Validation rules and patterns
    this.templateValidationRules = new Map();
    this.codeValidationRules = new Map();
    this.dataValidationRules = new Map();
    this.fileValidationRules = new Map();
    
    // Security patterns
    this.securityPatterns = new Map();
    this.vulnerabilityPatterns = new Map();
    this.maliciousPatterns = new Map();
    
    // Whitelists and blacklists
    this.whitelistedPaths = new Set();
    this.blacklistedPaths = new Set();
    this.whitelistedExtensions = new Set();
    this.blacklistedExtensions = new Set();
    
    // Caching
    this.validationCache = new Map();
    
    // Metrics
    this.metrics = {
      validationsPerformed: 0,
      validationsPassed: 0,
      validationsFailed: 0,
      securityViolations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageValidationTime: 0
    };
  }

  /**
   * Initialize validation engine
   */
  async initialize() {
    try {
      this.logger.info('Initializing validation engine...');
      this.status = 'initializing';
      
      // Load validation rules
      await this._loadValidationRules();
      
      // Load security patterns
      await this._loadSecurityPatterns();
      
      // Setup whitelists and blacklists
      await this._setupAccessLists();
      
      // Setup caching
      if (this.config.enableCaching) {
        this._setupCacheCleanup();
      }
      
      this.status = 'ready';
      this.logger.success('Validation engine initialized successfully');
      
      this.emit('validation:initialized', {
        rules: this.templateValidationRules.size + this.codeValidationRules.size + 
               this.dataValidationRules.size + this.fileValidationRules.size,
        patterns: this.securityPatterns.size + this.vulnerabilityPatterns.size,
        timestamp: new Date()
      });
      
      return {
        status: 'success',
        rulesLoaded: this.templateValidationRules.size + this.codeValidationRules.size + 
                    this.dataValidationRules.size + this.fileValidationRules.size,
        patternsLoaded: this.securityPatterns.size + this.vulnerabilityPatterns.size
      };
      
    } catch (error) {
      this.status = 'error';
      this.logger.error('Validation engine initialization failed:', error);
      throw error;
    }
  }

  /**
   * Validate template for security issues
   */
  async validateTemplate(template) {
    try {
      const startTime = Date.now();
      this.metrics.validationsPerformed++;
      
      this.logger.debug(`Validating template: ${template.name}`);
      
      // Check cache first
      const cacheKey = this._generateCacheKey('template', template);
      if (this.config.enableCaching && this.validationCache.has(cacheKey)) {
        const cached = this.validationCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
          this.metrics.cacheHits++;
          return cached.result;
        }
      }
      
      this.metrics.cacheMisses++;
      
      const validationResult = {
        valid: true,
        violations: [],
        warnings: [],
        securityIssues: [],
        recommendations: []
      };
      
      // Validate template structure
      const structureResult = await this._validateTemplateStructure(template);
      if (!structureResult.valid) {
        validationResult.valid = false;
        validationResult.violations.push(...structureResult.violations);
      }
      
      // Validate template content
      const contentResult = await this._validateTemplateContent(template);
      if (!contentResult.valid) {
        validationResult.valid = false;
        validationResult.securityIssues.push(...contentResult.securityIssues);
      }
      
      // Validate template syntax
      const syntaxResult = await this._validateTemplateSyntax(template);
      if (!syntaxResult.valid) {
        validationResult.valid = false;
        validationResult.violations.push(...syntaxResult.violations);
      }
      
      // Security scanning
      if (this.config.enableVulnerabilityScanning) {
        const securityResult = await this._scanTemplateForVulnerabilities(template);
        if (securityResult.vulnerabilities.length > 0) {
          validationResult.securityIssues.push(...securityResult.vulnerabilities);
          if (securityResult.critical) {
            validationResult.valid = false;
          }
        }
      }
      
      // Update metrics
      if (validationResult.valid) {
        this.metrics.validationsPassed++;
      } else {
        this.metrics.validationsFailed++;
        if (validationResult.securityIssues.length > 0) {
          this.metrics.securityViolations++;
        }
      }
      
      // Cache result
      this._cacheResult(cacheKey, validationResult);
      
      // Update average validation time
      const validationTime = Date.now() - startTime;
      this.metrics.averageValidationTime = 
        (this.metrics.averageValidationTime + validationTime) / 2;
      
      // Emit validation event
      this.emit('validation:template', {
        templateName: template.name,
        valid: validationResult.valid,
        violations: validationResult.violations.length,
        securityIssues: validationResult.securityIssues.length,
        validationTime
      });
      
      return validationResult;
      
    } catch (error) {
      this.logger.error(`Template validation failed for ${template.name}:`, error);
      throw error;
    }
  }

  /**
   * Validate variables for injection attacks
   */
  async validateVariables(variables) {
    try {
      this.logger.debug('Validating template variables');
      
      const validationResult = {
        valid: true,
        violations: [],
        sanitizedVariables: {},
        securityIssues: []
      };
      
      for (const [key, value] of Object.entries(variables)) {
        const variableResult = await this._validateVariable(key, value);
        
        if (!variableResult.valid) {
          validationResult.valid = false;
          validationResult.violations.push({
            variable: key,
            issue: variableResult.issue,
            severity: variableResult.severity
          });
        }
        
        if (variableResult.securityIssue) {
          validationResult.securityIssues.push({
            variable: key,
            issue: variableResult.securityIssue,
            severity: variableResult.severity
          });
        }
        
        // Apply sanitization
        validationResult.sanitizedVariables[key] = variableResult.sanitizedValue || value;
      }
      
      return validationResult;
      
    } catch (error) {
      this.logger.error('Variable validation failed:', error);
      throw error;
    }
  }

  /**
   * Validate file path for security
   */
  async validateFilePath(filePath) {
    try {
      this.logger.debug(`Validating file path: ${filePath}`);
      
      const validationResult = {
        valid: true,
        violations: [],
        normalizedPath: path.normalize(filePath),
        securityIssues: []
      };
      
      // Check for path traversal attacks
      if (this._hasPathTraversal(filePath)) {
        validationResult.valid = false;
        validationResult.securityIssues.push({
          type: 'path_traversal',
          description: 'Path contains directory traversal patterns',
          severity: 'HIGH'
        });
      }
      
      // Check against blacklisted paths
      if (this._isBlacklistedPath(filePath)) {
        validationResult.valid = false;
        validationResult.violations.push({
          type: 'blacklisted_path',
          description: 'Path is in blacklist',
          severity: 'HIGH'
        });
      }
      
      // Check file extension
      const extension = path.extname(filePath).toLowerCase();
      if (this._isBlacklistedExtension(extension)) {
        validationResult.valid = false;
        validationResult.violations.push({
          type: 'blacklisted_extension',
          description: `File extension ${extension} is not allowed`,
          severity: 'MEDIUM'
        });
      }
      
      // Check for special characters
      if (this._hasUnsafeCharacters(filePath)) {
        validationResult.valid = false;
        validationResult.violations.push({
          type: 'unsafe_characters',
          description: 'Path contains unsafe characters',
          severity: 'MEDIUM'
        });
      }
      
      // Whitelist check (if enabled)
      if (this.config.enableWhitelist && !this._isWhitelistedPath(filePath)) {
        validationResult.valid = false;
        validationResult.violations.push({
          type: 'not_whitelisted',
          description: 'Path is not in whitelist',
          severity: 'LOW'
        });
      }
      
      return validationResult;
      
    } catch (error) {
      this.logger.error(`File path validation failed for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Validate file content for security
   */
  async validateFileContent(content, contentType = 'text') {
    try {
      this.logger.debug(`Validating file content (${contentType})`);
      
      const validationResult = {
        valid: true,
        violations: [],
        securityIssues: [],
        contentInfo: {
          type: contentType,
          size: content.length,
          encoding: 'utf8'
        }
      };
      
      // Check content size
      if (content.length > 10 * 1024 * 1024) { // 10MB limit
        validationResult.violations.push({
          type: 'content_too_large',
          description: 'Content exceeds size limit',
          severity: 'MEDIUM'
        });
      }
      
      // Scan for malicious patterns
      const maliciousPatternResult = await this._scanForMaliciousPatterns(content);
      if (maliciousPatternResult.detected) {
        validationResult.valid = false;
        validationResult.securityIssues.push(...maliciousPatternResult.issues);
      }
      
      // Check for code injection patterns
      const injectionResult = await this._scanForInjectionPatterns(content);
      if (injectionResult.detected) {
        validationResult.valid = false;
        validationResult.securityIssues.push(...injectionResult.issues);
      }
      
      // Content-specific validation
      switch (contentType) {
        case 'javascript':
        case 'typescript':
          const jsResult = await this._validateJavaScriptContent(content);
          if (!jsResult.valid) {
            validationResult.valid = false;
            validationResult.violations.push(...jsResult.violations);
          }
          break;
          
        case 'html':
          const htmlResult = await this._validateHTMLContent(content);
          if (!htmlResult.valid) {
            validationResult.valid = false;
            validationResult.violations.push(...htmlResult.violations);
          }
          break;
          
        case 'sql':
          const sqlResult = await this._validateSQLContent(content);
          if (!sqlResult.valid) {
            validationResult.valid = false;
            validationResult.violations.push(...sqlResult.violations);
          }
          break;
      }
      
      return validationResult;
      
    } catch (error) {
      this.logger.error('File content validation failed:', error);
      throw error;
    }
  }

  /**
   * Add custom validation rule
   */
  async addValidationRule(category, rule) {
    try {
      this.logger.info(`Adding validation rule: ${rule.id} (${category})`);
      
      const ruleMap = this._getRuleMap(category);
      if (!ruleMap) {
        throw new Error(`Invalid rule category: ${category}`);
      }
      
      // Validate rule structure
      this._validateRuleStructure(rule);
      
      ruleMap.set(rule.id, {
        ...rule,
        createdAt: new Date(),
        enabled: rule.enabled !== false
      });
      
      // Clear cache to force re-validation
      this.validationCache.clear();
      
      this.emit('validation:rule_added', {
        category,
        ruleId: rule.id,
        ruleName: rule.name
      });
      
      return rule;
      
    } catch (error) {
      this.logger.error('Add validation rule failed:', error);
      throw error;
    }
  }

  /**
   * Get validation engine status
   */
  getStatus() {
    return {
      status: this.status,
      metrics: { ...this.metrics },
      configuration: {
        enableTemplateValidation: this.config.enableTemplateValidation,
        enableCodeValidation: this.config.enableCodeValidation,
        enableVulnerabilityScanning: this.config.enableVulnerabilityScanning,
        strictMode: this.config.strictMode
      },
      rules: {
        templateRules: this.templateValidationRules.size,
        codeRules: this.codeValidationRules.size,
        dataRules: this.dataValidationRules.size,
        fileRules: this.fileValidationRules.size
      },
      patterns: {
        securityPatterns: this.securityPatterns.size,
        vulnerabilityPatterns: this.vulnerabilityPatterns.size,
        maliciousPatterns: this.maliciousPatterns.size
      },
      cache: {
        size: this.validationCache.size,
        hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100
      }
    };
  }

  /**
   * Shutdown validation engine
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down validation engine...');
      
      // Clear caches
      this.validationCache.clear();
      
      // Clear intervals
      if (this.cacheCleanupInterval) {
        clearInterval(this.cacheCleanupInterval);
      }
      
      this.removeAllListeners();
      this.status = 'shutdown';
      
      this.logger.success('Validation engine shutdown completed');
      
    } catch (error) {
      this.logger.error('Validation engine shutdown failed:', error);
      throw error;
    }
  }

  // Private methods

  async _loadValidationRules() {
    // Load template validation rules
    const templateRules = [
      {
        id: 'no_script_tags',
        name: 'No Script Tags',
        pattern: /<script[^>]*>.*?<\/script>/gi,
        severity: 'HIGH',
        message: 'Script tags are not allowed in templates'
      },
      {
        id: 'no_eval_functions',
        name: 'No Eval Functions',
        pattern: /eval\s*\(/gi,
        severity: 'CRITICAL',
        message: 'Eval functions are prohibited'
      },
      {
        id: 'no_file_inclusion',
        name: 'No File Inclusion',
        pattern: /include\s*\(|require\s*\(|import\s*\(/gi,
        severity: 'HIGH',
        message: 'File inclusion patterns detected'
      }
    ];
    
    for (const rule of templateRules) {
      this.templateValidationRules.set(rule.id, rule);
    }
    
    // Load code validation rules
    const codeRules = [
      {
        id: 'no_hardcoded_secrets',
        name: 'No Hardcoded Secrets',
        pattern: /(password|secret|key|token)\s*[:=]\s*['"'][^'"]{8,}['"']/gi,
        severity: 'CRITICAL',
        message: 'Hardcoded secrets detected'
      },
      {
        id: 'no_sql_injection',
        name: 'No SQL Injection',
        pattern: /(select|insert|update|delete|drop|create|alter)\s+.*\+.*['"']/gi,
        severity: 'HIGH',
        message: 'Potential SQL injection vulnerability'
      }
    ];
    
    for (const rule of codeRules) {
      this.codeValidationRules.set(rule.id, rule);
    }
    
    // Load file validation rules
    const fileRules = [
      {
        id: 'safe_extensions',
        name: 'Safe File Extensions',
        allowedExtensions: ['.js', '.ts', '.json', '.md', '.txt', '.html', '.css'],
        severity: 'MEDIUM',
        message: 'File extension not in allowed list'
      }
    ];
    
    for (const rule of fileRules) {
      this.fileValidationRules.set(rule.id, rule);
    }
  }

  async _loadSecurityPatterns() {
    // Load vulnerability patterns
    const vulnerabilityPatterns = [
      {
        id: 'xss_patterns',
        name: 'Cross-Site Scripting Patterns',
        patterns: [
          /<script[^>]*>.*?<\/script>/gi,
          /javascript\s*:/gi,
          /on\w+\s*=\s*['"'][^'"]*['"']/gi
        ],
        severity: 'HIGH'
      },
      {
        id: 'command_injection',
        name: 'Command Injection Patterns',
        patterns: [
          /\$\(.*\)/g,
          /`.*`/g,
          /system\s*\(/gi,
          /exec\s*\(/gi,
          /shell_exec\s*\(/gi
        ],
        severity: 'CRITICAL'
      }
    ];
    
    for (const pattern of vulnerabilityPatterns) {
      this.vulnerabilityPatterns.set(pattern.id, pattern);
    }
    
    // Load malicious patterns
    const maliciousPatterns = [
      {
        id: 'malware_signatures',
        name: 'Malware Signatures',
        patterns: [
          /virus|malware|trojan|backdoor/gi,
          /wget\s+http|curl\s+http/gi
        ],
        severity: 'CRITICAL'
      }
    ];
    
    for (const pattern of maliciousPatterns) {
      this.maliciousPatterns.set(pattern.id, pattern);
    }
  }

  async _setupAccessLists() {
    // Setup whitelisted paths
    const whitelistedPaths = [
      '/src/**',
      '/templates/**',
      '/docs/**',
      '/tests/**',
      '/examples/**'
    ];
    
    for (const path of whitelistedPaths) {
      this.whitelistedPaths.add(path);
    }
    
    // Setup blacklisted paths
    const blacklistedPaths = [
      '/etc/**',
      '/proc/**',
      '/sys/**',
      '/../**',
      '/node_modules/**'
    ];
    
    for (const path of blacklistedPaths) {
      this.blacklistedPaths.add(path);
    }
    
    // Setup allowed extensions
    const whitelistedExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt', 
      '.html', '.css', '.scss', '.less', '.yaml', '.yml'
    ];
    
    for (const ext of whitelistedExtensions) {
      this.whitelistedExtensions.add(ext);
    }
    
    // Setup blacklisted extensions
    const blacklistedExtensions = [
      '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.scr',
      '.dll', '.so', '.dylib', '.bin', '.com'
    ];
    
    for (const ext of blacklistedExtensions) {
      this.blacklistedExtensions.add(ext);
    }
  }

  _setupCacheCleanup() {
    this.cacheCleanupInterval = setInterval(() => {
      this._cleanupExpiredCache();
    }, 60000); // Every minute
  }

  async _validateTemplateStructure(template) {
    const result = { valid: true, violations: [] };
    
    // Check required fields
    if (!template.name || typeof template.name !== 'string') {
      result.valid = false;
      result.violations.push({
        type: 'missing_name',
        message: 'Template name is required',
        severity: 'HIGH'
      });
    }
    
    if (!template.content) {
      result.valid = false;
      result.violations.push({
        type: 'missing_content',
        message: 'Template content is required',
        severity: 'HIGH'
      });
    }
    
    return result;
  }

  async _validateTemplateContent(template) {
    const result = { valid: true, securityIssues: [] };
    
    // Apply template validation rules
    for (const rule of this.templateValidationRules.values()) {
      if (!rule.enabled) continue;
      
      if (rule.pattern && rule.pattern.test(template.content)) {
        result.valid = false;
        result.securityIssues.push({
          ruleId: rule.id,
          ruleName: rule.name,
          message: rule.message,
          severity: rule.severity
        });
      }
    }
    
    return result;
  }

  async _validateTemplateSyntax(template) {
    const result = { valid: true, violations: [] };
    
    // Basic syntax validation for Nunjucks/Jinja2 templates
    try {
      // Check for balanced braces
      const bracePattern = /\{\{|\}\}|\{%|\%\}|\{#|\#\}/g;
      const braces = template.content.match(bracePattern) || [];
      
      let openBraces = 0;
      for (const brace of braces) {
        if (brace === '{{' || brace === '{%' || brace === '{#') {
          openBraces++;
        } else if (brace === '}}' || brace === '%}' || brace === '#}') {
          openBraces--;
        }
      }
      
      if (openBraces !== 0) {
        result.valid = false;
        result.violations.push({
          type: 'unbalanced_braces',
          message: 'Template has unbalanced braces',
          severity: 'HIGH'
        });
      }
      
    } catch (error) {
      result.valid = false;
      result.violations.push({
        type: 'syntax_error',
        message: `Template syntax error: ${error.message}`,
        severity: 'HIGH'
      });
    }
    
    return result;
  }

  async _scanTemplateForVulnerabilities(template) {
    const result = { vulnerabilities: [], critical: false };
    
    // Scan against vulnerability patterns
    for (const pattern of this.vulnerabilityPatterns.values()) {
      for (const regex of pattern.patterns) {
        if (regex.test(template.content)) {
          const vulnerability = {
            patternId: pattern.id,
            patternName: pattern.name,
            severity: pattern.severity,
            location: 'template_content'
          };
          
          result.vulnerabilities.push(vulnerability);
          
          if (pattern.severity === 'CRITICAL') {
            result.critical = true;
          }
        }
      }
    }
    
    return result;
  }

  async _validateVariable(key, value) {
    const result = {
      valid: true,
      sanitizedValue: value,
      issue: null,
      securityIssue: null,
      severity: 'LOW'
    };
    
    // Check variable name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      result.valid = false;
      result.issue = 'Invalid variable name format';
      result.severity = 'MEDIUM';
    }
    
    // Check variable value for injection patterns
    if (typeof value === 'string') {
      // Check for script injection
      if (/<script|javascript:|on\w+=/i.test(value)) {
        result.valid = false;
        result.securityIssue = 'Script injection detected in variable value';
        result.severity = 'HIGH';
      }
      
      // Check for SQL injection
      if (/(union|select|insert|update|delete|drop)\s/i.test(value)) {
        result.valid = false;
        result.securityIssue = 'SQL injection pattern detected in variable value';
        result.severity = 'HIGH';
      }
      
      // Sanitize HTML characters
      result.sanitizedValue = value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }
    
    return result;
  }

  _hasPathTraversal(filePath) {
    const dangerousPatterns = [
      /\.\.\//g,
      /\.\.\\g,
      /%2e%2e%2f/gi,
      /%2e%2e%5c/gi,
      /\.\.%2f/gi,
      /\.\.%5c/gi
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(filePath));
  }

  _isBlacklistedPath(filePath) {
    const normalizedPath = path.normalize(filePath);
    
    for (const blacklistedPath of this.blacklistedPaths) {
      if (this._pathMatches(normalizedPath, blacklistedPath)) {
        return true;
      }
    }
    
    return false;
  }

  _isWhitelistedPath(filePath) {
    const normalizedPath = path.normalize(filePath);
    
    for (const whitelistedPath of this.whitelistedPaths) {
      if (this._pathMatches(normalizedPath, whitelistedPath)) {
        return true;
      }
    }
    
    return false;
  }

  _isBlacklistedExtension(extension) {
    return this.blacklistedExtensions.has(extension.toLowerCase());
  }

  _hasUnsafeCharacters(filePath) {
    const unsafePattern = /[<>:"|?*\x00-\x1f]/;
    return unsafePattern.test(filePath);
  }

  _pathMatches(filePath, pattern) {
    // Simple glob-like matching
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  async _scanForMaliciousPatterns(content) {
    const result = { detected: false, issues: [] };
    
    for (const pattern of this.maliciousPatterns.values()) {
      for (const regex of pattern.patterns) {
        if (regex.test(content)) {
          result.detected = true;
          result.issues.push({
            patternId: pattern.id,
            patternName: pattern.name,
            severity: pattern.severity,
            type: 'malicious_pattern'
          });
        }
      }
    }
    
    return result;
  }

  async _scanForInjectionPatterns(content) {
    const result = { detected: false, issues: [] };
    
    const injectionPatterns = [
      {
        name: 'Command Injection',
        pattern: /(\$\(|`|system\s*\(|exec\s*\()/gi,
        severity: 'CRITICAL'
      },
      {
        name: 'SQL Injection',
        pattern: /(union\s+select|insert\s+into|update\s+.*set|delete\s+from)/gi,
        severity: 'HIGH'
      },
      {
        name: 'Path Traversal',
        pattern: /(\.\.\/|\.\.\\|%2e%2e%2f)/gi,
        severity: 'HIGH'
      }
    ];
    
    for (const injection of injectionPatterns) {
      if (injection.pattern.test(content)) {
        result.detected = true;
        result.issues.push({
          name: injection.name,
          severity: injection.severity,
          type: 'injection_pattern'
        });
      }
    }
    
    return result;
  }

  async _validateJavaScriptContent(content) {
    const result = { valid: true, violations: [] };
    
    // Apply JavaScript-specific validation rules
    for (const rule of this.codeValidationRules.values()) {
      if (!rule.enabled) continue;
      
      if (rule.pattern && rule.pattern.test(content)) {
        result.valid = false;
        result.violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          message: rule.message,
          severity: rule.severity
        });
      }
    }
    
    return result;
  }

  async _validateHTMLContent(content) {
    const result = { valid: true, violations: [] };
    
    // Check for dangerous HTML patterns
    const dangerousPatterns = [
      {
        pattern: /<script[^>]*>.*?<\/script>/gi,
        message: 'Script tags detected in HTML',
        severity: 'HIGH'
      },
      {
        pattern: /on\w+\s*=\s*['"'][^'"]*['"']/gi,
        message: 'Inline event handlers detected',
        severity: 'MEDIUM'
      }
    ];
    
    for (const check of dangerousPatterns) {
      if (check.pattern.test(content)) {
        result.valid = false;
        result.violations.push({
          type: 'dangerous_html',
          message: check.message,
          severity: check.severity
        });
      }
    }
    
    return result;
  }

  async _validateSQLContent(content) {
    const result = { valid: true, violations: [] };
    
    // Check for dangerous SQL patterns
    const dangerousPatterns = [
      {
        pattern: /drop\s+table/gi,
        message: 'DROP TABLE statement detected',
        severity: 'CRITICAL'
      },
      {
        pattern: /delete\s+from\s+\w+\s*;?\s*$/gi,
        message: 'Unfiltered DELETE statement detected',
        severity: 'HIGH'
      }
    ];
    
    for (const check of dangerousPatterns) {
      if (check.pattern.test(content)) {
        result.valid = false;
        result.violations.push({
          type: 'dangerous_sql',
          message: check.message,
          severity: check.severity
        });
      }
    }
    
    return result;
  }

  _getRuleMap(category) {
    switch (category) {
      case 'template': return this.templateValidationRules;
      case 'code': return this.codeValidationRules;
      case 'data': return this.dataValidationRules;
      case 'file': return this.fileValidationRules;
      default: return null;
    }
  }

  _validateRuleStructure(rule) {
    if (!rule.id || typeof rule.id !== 'string') {
      throw new Error('Rule ID is required and must be a string');
    }
    
    if (!rule.name || typeof rule.name !== 'string') {
      throw new Error('Rule name is required and must be a string');
    }
    
    if (!rule.severity || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(rule.severity)) {
      throw new Error('Rule severity must be LOW, MEDIUM, HIGH, or CRITICAL');
    }
  }

  _generateCacheKey(type, data) {
    const keyData = {
      type,
      name: data.name,
      contentHash: this._simpleHash(data.content || '')
    };
    return `validation_${JSON.stringify(keyData)}`;
  }

  _simpleHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  _cacheResult(cacheKey, result) {
    if (this.config.enableCaching) {
      this.validationCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });
    }
  }

  _cleanupExpiredCache() {
    const now = Date.now();
    
    for (const [key, cached] of this.validationCache.entries()) {
      if (now - cached.timestamp > this.config.cacheTimeout) {
        this.validationCache.delete(key);
      }
    }
  }
}

export default ValidationEngine;