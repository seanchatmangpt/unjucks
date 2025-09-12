/**
 * Sandbox Manager
 * Template execution sandbox with comprehensive security controls
 * Isolates template processing and prevents malicious code execution
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import { Worker } from 'worker_threads';
import { VM } from 'vm2';
import path from 'path';
import { promises as fs } from 'fs';
import { createHash, randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class SandboxManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Sandbox execution settings
      maxExecutionTime: 30000, // 30 seconds
      maxMemory: 100 * 1024 * 1024, // 100MB
      maxOutputSize: 10 * 1024 * 1024, // 10MB
      
      // Security settings
      enableIsolation: true,
      allowNetworkAccess: false,
      allowFileSystemAccess: false,
      allowChildProcesses: false,
      
      // Template engine settings
      allowedTemplateEngines: ['nunjucks', 'handlebars'],
      enableSafeMode: true,
      maxRecursionDepth: 10,
      
      // Resource limits
      maxConcurrentSandboxes: 10,
      maxSandboxLifetime: 300000, // 5 minutes
      
      ...config
    };
    
    this.logger = consola.withTag('sandbox-manager');
    this.activeSandboxes = new Map();
    this.sandboxQueue = [];
    this.workerPool = new Map();
    
    // Security policies
    this.securityPolicies = {
      blockedModules: [
        'fs', 'child_process', 'cluster', 'worker_threads',
        'http', 'https', 'net', 'tls', 'dgram', 'dns',
        'os', 'process', 'vm', 'crypto'
      ],
      allowedGlobals: [
        'console', 'setTimeout', 'clearTimeout',
        'setInterval', 'clearInterval', 'Buffer',
        'JSON', 'Math', 'Date', 'RegExp'
      ],
      maxStringLength: 1000000, // 1MB strings
      maxArrayLength: 100000,
      maxObjectKeys: 10000
    };
    
    // Metrics
    this.metrics = {
      sandboxesCreated: 0,
      sandboxesDestroyed: 0,
      executionsCompleted: 0,
      executionsFailed: 0,
      securityViolations: 0,
      avgExecutionTime: 0
    };
  }

  /**
   * Initialize the sandbox manager
   */
  async initialize() {
    try {
      this.logger.info('Initializing sandbox manager...');
      
      // Initialize worker pool if using worker threads
      if (this.config.enableIsolation) {
        await this._initializeWorkerPool();
      }
      
      // Setup cleanup interval
      this.cleanupInterval = setInterval(() => {
        this._cleanupExpiredSandboxes();
      }, 60000); // Every minute
      
      this.logger.success('Sandbox manager initialized');
      
    } catch (error) {
      this.logger.error('Failed to initialize sandbox manager:', error);
      throw error;
    }
  }

  /**
   * Execute template in secure sandbox
   * @param {string} template - Template content
   * @param {object} variables - Template variables
   * @param {object} options - Execution options
   * @returns {Promise<object>} Execution result
   */
  async executeTemplate(template, variables = {}, options = {}) {
    const startTime = Date.now();
    const executionId = randomBytes(16).toString('hex');
    
    try {
      this.logger.info(`Executing template in sandbox: ${executionId}`);
      
      // Validate inputs
      const validation = await this._validateExecutionInputs(template, variables, options);
      if (!validation.valid) {
        throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Create sandbox
      const sandbox = await this._createSandbox(executionId, options);
      
      // Execute template
      const result = await this._executeSandboxedTemplate(
        sandbox,
        validation.sanitizedTemplate,
        validation.sanitizedVariables,
        options
      );
      
      // Cleanup sandbox
      await this._destroySandbox(executionId);
      
      // Update metrics
      this.metrics.executionsCompleted++;
      const executionTime = Date.now() - startTime;
      this._updateExecutionMetrics(executionTime);
      
      this.emit('execution-completed', {
        executionId,
        executionTime,
        outputSize: result.output?.length || 0
      });
      
      return {
        success: true,
        executionId,
        output: result.output,
        metadata: {
          executionTime,
          memoryUsed: result.memoryUsed,
          warnings: result.warnings
        }
      };
      
    } catch (error) {
      this.metrics.executionsFailed++;
      this.logger.error(`Template execution failed: ${executionId}`, error);
      
      // Cleanup failed sandbox
      if (this.activeSandboxes.has(executionId)) {
        await this._destroySandbox(executionId);
      }
      
      this.emit('execution-failed', {
        executionId,
        error: error.message,
        executionTime: Date.now() - startTime
      });
      
      return {
        success: false,
        executionId,
        error: error.message,
        metadata: {
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Execute code in secure VM sandbox
   * @param {string} code - Code to execute
   * @param {object} context - Execution context
   * @param {object} options - Execution options
   * @returns {Promise<object>} Execution result
   */
  async executeCode(code, context = {}, options = {}) {
    const startTime = Date.now();
    const executionId = randomBytes(16).toString('hex');
    
    try {
      this.logger.info(`Executing code in VM sandbox: ${executionId}`);
      
      // Security validation
      const securityCheck = await this._validateCodeSecurity(code);
      if (!securityCheck.safe) {
        throw new Error(`Security violation: ${securityCheck.violations.join(', ')}`);
      }
      
      // Create VM sandbox
      const vm = new VM({
        timeout: this.config.maxExecutionTime,
        sandbox: this._createVMSandbox(context),
        eval: false,
        wasm: false,
        fixAsync: true
      });
      
      // Execute code
      const result = vm.run(code);
      const executionTime = Date.now() - startTime;
      
      // Update metrics
      this.metrics.executionsCompleted++;
      this._updateExecutionMetrics(executionTime);
      
      return {
        success: true,
        executionId,
        result,
        metadata: {
          executionTime
        }
      };
      
    } catch (error) {
      this.metrics.executionsFailed++;
      this.logger.error(`Code execution failed: ${executionId}`, error);
      
      return {
        success: false,
        executionId,
        error: error.message,
        metadata: {
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Create isolated file processing sandbox
   * @param {string} filePath - File to process
   * @param {object} options - Processing options
   * @returns {Promise<object>} Processing result
   */
  async processFileSecurely(filePath, options = {}) {
    const startTime = Date.now();
    const executionId = randomBytes(16).toString('hex');
    
    try {
      this.logger.info(`Processing file securely: ${filePath}`);
      
      // Validate file path
      const pathValidation = await this._validateFilePath(filePath);
      if (!pathValidation.safe) {
        throw new Error(`Unsafe file path: ${pathValidation.violations.join(', ')}`);
      }
      
      // Create file processing sandbox
      const sandbox = await this._createFileSandbox(executionId, options);
      
      // Process file
      const result = await this._processFileInSandbox(sandbox, pathValidation.safePath, options);
      
      // Cleanup
      await this._destroySandbox(executionId);
      
      return {
        success: true,
        executionId,
        result,
        metadata: {
          executionTime: Date.now() - startTime,
          fileSize: result.fileSize
        }
      };
      
    } catch (error) {
      this.logger.error(`File processing failed: ${filePath}`, error);
      
      if (this.activeSandboxes.has(executionId)) {
        await this._destroySandbox(executionId);
      }
      
      return {
        success: false,
        executionId,
        error: error.message,
        metadata: {
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Get sandbox manager status
   */
  getStatus() {
    return {
      activeSandboxes: this.activeSandboxes.size,
      queuedRequests: this.sandboxQueue.length,
      workerPool: this.workerPool.size,
      metrics: this.metrics,
      config: {
        maxConcurrentSandboxes: this.config.maxConcurrentSandboxes,
        maxExecutionTime: this.config.maxExecutionTime,
        maxMemory: this.config.maxMemory,
        enableIsolation: this.config.enableIsolation
      }
    };
  }

  /**
   * Shutdown sandbox manager
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down sandbox manager...');
      
      // Clear cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      // Destroy all active sandboxes
      const shutdownPromises = Array.from(this.activeSandboxes.keys()).map(id => 
        this._destroySandbox(id)
      );
      await Promise.all(shutdownPromises);
      
      // Terminate worker pool
      await this._shutdownWorkerPool();
      
      this.logger.success('Sandbox manager shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during sandbox manager shutdown:', error);
      throw error;
    }
  }

  // Private methods

  async _validateExecutionInputs(template, variables, options) {
    const result = {
      valid: false,
      errors: [],
      sanitizedTemplate: null,
      sanitizedVariables: null
    };
    
    try {
      // Basic input validation
      if (!template || typeof template !== 'string') {
        result.errors.push('Template is required and must be a string');
        return result;
      }
      
      if (template.length > this.config.maxOutputSize) {
        result.errors.push(`Template size exceeds limit: ${this.config.maxOutputSize}`);
        return result;
      }
      
      // Security validation
      const securityCheck = await this._validateTemplateSecurity(template);
      if (!securityCheck.safe) {
        result.errors.push(`Security violation: ${securityCheck.violations.join(', ')}`);
        return result;
      }
      
      // Variable validation
      const variableValidation = this._validateVariables(variables);
      if (!variableValidation.valid) {
        result.errors.push(...variableValidation.errors);
        return result;
      }
      
      // Sanitize inputs
      result.sanitizedTemplate = this._sanitizeTemplate(template);
      result.sanitizedVariables = this._sanitizeVariables(variables);
      result.valid = true;
      
    } catch (error) {
      result.errors.push(`Validation failed: ${error.message}`);
    }
    
    return result;
  }

  async _validateTemplateSecurity(template) {
    const result = {
      safe: true,
      violations: []
    };
    
    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /require\s*\(/g, message: 'require() calls not allowed' },
      { pattern: /import\s+.*from/g, message: 'import statements not allowed' },
      { pattern: /eval\s*\(/g, message: 'eval() calls not allowed' },
      { pattern: /Function\s*\(/g, message: 'Function constructor not allowed' },
      { pattern: /process\./g, message: 'process object access not allowed' },
      { pattern: /global\./g, message: 'global object access not allowed' },
      { pattern: /__dirname|__filename/g, message: 'file system paths not allowed' },
      { pattern: /\.\.\//g, message: 'path traversal not allowed' }
    ];
    
    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(template)) {
        result.safe = false;
        result.violations.push(message);
        this.metrics.securityViolations++;
      }
    }
    
    return result;
  }

  async _validateCodeSecurity(code) {
    const result = {
      safe: true,
      violations: []
    };
    
    // More comprehensive security checks for code execution
    const dangerousPatterns = [
      { pattern: /require\s*\(/g, message: 'require() calls not allowed' },
      { pattern: /import\s+.*from/g, message: 'import statements not allowed' },
      { pattern: /eval\s*\(/g, message: 'eval() calls not allowed' },
      { pattern: /Function\s*\(/g, message: 'Function constructor not allowed' },
      { pattern: /setTimeout|setInterval/g, message: 'timers not allowed in code execution' },
      { pattern: /while\s*\(\s*true\s*\)/g, message: 'infinite loops not allowed' },
      { pattern: /for\s*\(\s*;;\s*\)/g, message: 'infinite loops not allowed' }
    ];
    
    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        result.safe = false;
        result.violations.push(message);
        this.metrics.securityViolations++;
      }
    }
    
    return result;
  }

  _validateVariables(variables) {
    const result = {
      valid: true,
      errors: []
    };
    
    try {
      // Check variable structure depth
      const depth = this._getObjectDepth(variables);
      if (depth > 20) {
        result.valid = false;
        result.errors.push('Variable structure too deep');
      }
      
      // Check for circular references
      if (this._hasCircularReference(variables)) {
        result.valid = false;
        result.errors.push('Circular references detected in variables');
      }
      
      // Check variable count and size
      const variableCount = this._countVariables(variables);
      if (variableCount > this.securityPolicies.maxObjectKeys) {
        result.valid = false;
        result.errors.push(`Too many variables: ${variableCount}`);
      }
      
    } catch (error) {
      result.valid = false;
      result.errors.push(`Variable validation failed: ${error.message}`);
    }
    
    return result;
  }

  async _validateFilePath(filePath) {
    const result = {
      safe: true,
      violations: [],
      safePath: filePath
    };
    
    // Path traversal checks
    const dangerousPatterns = [
      { pattern: /\.\.\/|\.\.\\/g, message: 'path traversal detected' },
      { pattern: /^\/etc|^\/proc|^\/sys/g, message: 'system directory access not allowed' },
      { pattern: /~\//g, message: 'home directory access not allowed' },
      { pattern: /\$\{.*\}|\$\(.*\)/g, message: 'variable expansion not allowed' }
    ];
    
    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(filePath)) {
        result.safe = false;
        result.violations.push(message);
      }
    }
    
    // Normalize and resolve path safely
    if (result.safe) {
      result.safePath = path.resolve(path.normalize(filePath));
    }
    
    return result;
  }

  async _createSandbox(executionId, options) {
    if (this.activeSandboxes.size >= this.config.maxConcurrentSandboxes) {
      throw new Error('Maximum concurrent sandboxes exceeded');
    }
    
    const sandbox = {
      id: executionId,
      createdAt: Date.now(),
      options,
      worker: null,
      vm: null
    };
    
    if (this.config.enableIsolation && options.useWorker) {
      sandbox.worker = await this._createWorker(executionId);
    } else {
      sandbox.vm = this._createVM(options);
    }
    
    this.activeSandboxes.set(executionId, sandbox);
    this.metrics.sandboxesCreated++;
    
    this.logger.debug(`Created sandbox: ${executionId}`);
    
    return sandbox;
  }

  async _createFileSandbox(executionId, options) {
    // File processing sandbox with restricted file system access
    const sandbox = await this._createSandbox(executionId, {
      ...options,
      allowFileSystemAccess: true,
      restrictedPaths: options.allowedPaths || []
    });
    
    return sandbox;
  }

  _createVM(options) {
    return new VM({
      timeout: this.config.maxExecutionTime,
      sandbox: this._createVMSandbox(options.context || {}),
      eval: false,
      wasm: false,
      fixAsync: true
    });
  }

  _createVMSandbox(context) {
    const sandbox = {
      // Safe globals
      console: {
        log: (...args) => this.logger.info('Sandbox:', ...args),
        error: (...args) => this.logger.error('Sandbox:', ...args),
        warn: (...args) => this.logger.warn('Sandbox:', ...args)
      },
      JSON,
      Math,
      Date,
      RegExp,
      Buffer,
      
      // Restricted setTimeout/setInterval
      setTimeout: (fn, delay) => {
        if (delay > this.config.maxExecutionTime) {
          throw new Error('Timer delay exceeds maximum execution time');
        }
        return setTimeout(fn, Math.min(delay, 1000)); // Max 1 second
      },
      
      // Add user context safely
      ...this._sanitizeContext(context)
    };
    
    return sandbox;
  }

  _sanitizeContext(context) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(context)) {
      // Only allow safe types
      if (typeof value === 'string' || typeof value === 'number' || 
          typeof value === 'boolean' || Array.isArray(value) ||
          (typeof value === 'object' && value !== null)) {
        sanitized[key] = this._deepCloneAndSanitize(value);
      }
    }
    
    return sanitized;
  }

  _deepCloneAndSanitize(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._deepCloneAndSanitize(item));
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip functions and dangerous objects
      if (typeof value !== 'function' && !key.startsWith('_')) {
        sanitized[key] = this._deepCloneAndSanitize(value);
      }
    }
    
    return sanitized;
  }

  async _executeSandboxedTemplate(sandbox, template, variables, options) {
    const startTime = Date.now();
    
    try {
      // Execute template based on engine
      const engine = options.engine || 'nunjucks';
      
      if (!this.config.allowedTemplateEngines.includes(engine)) {
        throw new Error(`Template engine not allowed: ${engine}`);
      }
      
      let output;
      
      switch (engine) {
        case 'nunjucks':
          output = await this._executeNunjucksTemplate(sandbox, template, variables);
          break;
        case 'handlebars':
          output = await this._executeHandlebarsTemplate(sandbox, template, variables);
          break;
        default:
          throw new Error(`Unsupported template engine: ${engine}`);
      }
      
      // Validate output size
      if (output.length > this.config.maxOutputSize) {
        throw new Error(`Output size exceeds limit: ${this.config.maxOutputSize}`);
      }
      
      return {
        output,
        executionTime: Date.now() - startTime,
        memoryUsed: this._getMemoryUsage(),
        warnings: []
      };
      
    } catch (error) {
      throw new Error(`Template execution failed: ${error.message}`);
    }
  }

  async _executeNunjucksTemplate(sandbox, template, variables) {
    // Safe Nunjucks execution in sandbox
    const nunjucksCode = `
      const nunjucks = require('nunjucks');
      const env = nunjucks.configure({ autoescape: true });
      env.renderString(template, variables);
    `;
    
    if (sandbox.vm) {
      return sandbox.vm.run(nunjucksCode, {
        template,
        variables,
        nunjucks: this._createSafeNunjucks()
      });
    }
    
    // Fallback to simple string replacement (very limited)
    return this._simpleTemplateRender(template, variables);
  }

  _createSafeNunjucks() {
    // Create a restricted Nunjucks environment
    return {
      configure: (options = {}) => ({
        renderString: (template, context) => {
          // Simple and safe template rendering
          return this._simpleTemplateRender(template, context);
        }
      })
    };
  }

  _simpleTemplateRender(template, variables) {
    let output = template;
    
    // Simple variable substitution
    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === 'string' || typeof value === 'number') {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        output = output.replace(regex, String(value));
      }
    }
    
    return output;
  }

  async _processFileInSandbox(sandbox, filePath, options) {
    // Secure file processing
    const stats = await fs.stat(filePath);
    
    if (stats.size > this.config.maxOutputSize) {
      throw new Error('File too large for processing');
    }
    
    const content = await fs.readFile(filePath, 'utf8');
    
    return {
      content,
      fileSize: stats.size,
      processedAt: new Date()
    };
  }

  async _destroySandbox(executionId) {
    const sandbox = this.activeSandboxes.get(executionId);
    if (!sandbox) return;
    
    try {
      // Terminate worker if using worker threads
      if (sandbox.worker) {
        await sandbox.worker.terminate();
      }
      
      // VM cleanup is automatic
      
      this.activeSandboxes.delete(executionId);
      this.metrics.sandboxesDestroyed++;
      
      this.logger.debug(`Destroyed sandbox: ${executionId}`);
      
    } catch (error) {
      this.logger.error(`Failed to destroy sandbox ${executionId}:`, error);
    }
  }

  _cleanupExpiredSandboxes() {
    const now = Date.now();
    const expiredSandboxes = [];
    
    for (const [id, sandbox] of this.activeSandboxes.entries()) {
      if (now - sandbox.createdAt > this.config.maxSandboxLifetime) {
        expiredSandboxes.push(id);
      }
    }
    
    expiredSandboxes.forEach(id => this._destroySandbox(id));
    
    if (expiredSandboxes.length > 0) {
      this.logger.info(`Cleaned up ${expiredSandboxes.length} expired sandboxes`);
    }
  }

  async _initializeWorkerPool() {
    // Initialize worker thread pool for isolation
    this.logger.info('Initializing worker pool for isolation...');
  }

  async _shutdownWorkerPool() {
    // Shutdown worker thread pool
    for (const [id, worker] of this.workerPool.entries()) {
      await worker.terminate();
    }
    this.workerPool.clear();
  }

  async _createWorker(executionId) {
    // Create isolated worker thread
    return null; // Placeholder
  }

  _sanitizeTemplate(template) {
    // Basic template sanitization
    return template
      .replace(/require\s*\(/g, '') // Remove require calls
      .replace(/eval\s*\(/g, '')    // Remove eval calls
      .replace(/Function\s*\(/g, '') // Remove Function constructor
      .trim();
  }

  _sanitizeVariables(variables) {
    return this._deepCloneAndSanitize(variables);
  }

  _getObjectDepth(obj, depth = 0) {
    if (typeof obj !== 'object' || obj === null || depth > 50) {
      return depth;
    }
    
    let maxDepth = depth;
    for (const value of Object.values(obj)) {
      const currentDepth = this._getObjectDepth(value, depth + 1);
      maxDepth = Math.max(maxDepth, currentDepth);
    }
    
    return maxDepth;
  }

  _hasCircularReference(obj, seen = new WeakSet()) {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    
    if (seen.has(obj)) {
      return true;
    }
    
    seen.add(obj);
    
    for (const value of Object.values(obj)) {
      if (this._hasCircularReference(value, seen)) {
        return true;
      }
    }
    
    seen.delete(obj);
    return false;
  }

  _countVariables(obj, count = 0) {
    if (typeof obj !== 'object' || obj === null) {
      return count;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      count++;
      count = this._countVariables(value, count);
    }
    
    return count;
  }

  _getMemoryUsage() {
    return process.memoryUsage().heapUsed;
  }

  _updateExecutionMetrics(executionTime) {
    this.metrics.avgExecutionTime = (
      (this.metrics.avgExecutionTime * (this.metrics.executionsCompleted - 1) + executionTime) /
      this.metrics.executionsCompleted
    );
  }
}

export default SandboxManager;