/**
 * Hermetic Execution Wrapper System
 * 
 * Provides high-level wrappers for executing operations in hermetic environments.
 * Ensures deterministic execution with environment validation and attestation.
 * 
 * Agent 12: Hermetic Runtime Manager - Execution Wrappers
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { performance } from 'perf_hooks';
import { consola } from 'consola';
import { HermeticEnvironment } from './hermetic-environment.js';
import { HermeticValidator } from './hermetic-validator.js';
import { EnvironmentStamper } from '../attestation/environment-stamper.js';

/**
 * Base hermetic wrapper class
 */
class HermeticExecutor {
  constructor(options = {}) {
    this.options = {
      strictMode: options.strictMode !== false,
      validateBeforeExecution: options.validateBeforeExecution !== false,
      generateAttestation: options.generateAttestation !== false,
      timeoutMs: options.timeoutMs || 300000, // 5 minutes
      maxRetries: options.maxRetries || 3,
      retryDelayMs: options.retryDelayMs || 1000,
      captureOutput: options.captureOutput !== false,
      isolateExecution: options.isolateExecution === true,
      ...options
    };

    this.logger = consola.withTag('hermetic-exec');
    this.executionHistory = [];
    
    // Initialize components
    this.hermetic = new HermeticEnvironment({ 
      strictMode: this.options.strictMode,
      ...options.hermetic 
    });
    
    this.validator = new HermeticValidator({ 
      strictValidation: this.options.strictMode,
      ...options.validator 
    });
    
    this.stamper = new EnvironmentStamper({
      generateAttestations: this.options.generateAttestation,
      ...options.stamper
    });

    this.isInitialized = false;
  }

  /**
   * Initialize hermetic executor
   */
  async initialize() {
    if (this.isInitialized) {
      return { success: true, cached: true };
    }

    try {
      this.logger.info('Initializing hermetic executor...');
      
      // Initialize all components
      await this.hermetic.initialize();
      await this.validator.initialize();
      await this.stamper.initialize();
      
      this.isInitialized = true;
      
      this.logger.success('Hermetic executor initialized');
      
      return { success: true };
      
    } catch (error) {
      this.logger.error('Failed to initialize hermetic executor:', error);
      throw new Error(`Hermetic executor initialization failed: ${error.message}`);
    }
  }

  /**
   * Execute operation in hermetic environment
   */
  async execute(operation, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const executionId = this.generateExecutionId();
    const startTime = performance.now();
    
    this.logger.info(`Starting hermetic execution: ${executionId}`);
    
    try {
      // Prepare execution context
      const execContext = await this.prepareExecutionContext(context, executionId);
      
      // Validate environment if requested
      if (this.options.validateBeforeExecution && context.baseline) {
        await this.validateEnvironmentForExecution(context.baseline, execContext);
      }
      
      // Execute operation with retries
      const result = await this.executeWithRetries(operation, execContext);
      
      // Post-process result
      const finalResult = await this.postProcessResult(result, execContext);
      
      // Record execution
      this.recordExecution(executionId, finalResult, performance.now() - startTime);
      
      this.logger.success(`Hermetic execution completed: ${executionId} (${finalResult.executionTime.toFixed(2)}ms)`);
      
      return finalResult;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.logger.error(`Hermetic execution failed: ${executionId}`, error);
      
      const errorResult = {
        success: false,
        executionId,
        error: error.message,
        executionTime: duration,
        environment: await this.hermetic.captureEnvironmentFingerprint(),
        timestamp: this.getDeterministicDate().toISOString()
      };
      
      this.recordExecution(executionId, errorResult, duration);
      
      throw error;
    }
  }

  /**
   * Prepare execution context
   */
  async prepareExecutionContext(userContext, executionId) {
    const context = {
      executionId,
      startTime: this.getDeterministicTimestamp(),
      userContext: userContext || {},
      
      // Environment information
      environment: await this.hermetic.captureEnvironmentFingerprint(),
      
      // Execution options
      strictMode: this.options.strictMode,
      validateBeforeExecution: this.options.validateBeforeExecution,
      generateAttestation: this.options.generateAttestation,
      timeoutMs: userContext.timeoutMs || this.options.timeoutMs,
      maxRetries: userContext.maxRetries || this.options.maxRetries,
      
      // Isolation settings
      isolateExecution: userContext.isolateExecution || this.options.isolateExecution,
      
      // Output capture
      captureOutput: userContext.captureOutput !== false && this.options.captureOutput,
      output: {
        stdout: [],
        stderr: [],
        files: new Map(),
        metrics: {}
      }
    };

    // Setup output capture if requested
    if (context.captureOutput) {
      this.setupOutputCapture(context);
    }

    // Setup execution isolation if requested
    if (context.isolateExecution) {
      await this.setupExecutionIsolation(context);
    }

    return context;
  }

  /**
   * Validate environment for execution
   */
  async validateEnvironmentForExecution(baseline, execContext) {
    this.logger.debug('Validating environment for execution...');
    
    const validation = await this.validator.validateEnvironment(baseline, {
      strictMode: execContext.strictMode,
      allowCrossPlatform: execContext.userContext.allowCrossPlatform,
      skipRules: execContext.userContext.skipValidationRules || []
    });

    if (!validation.valid) {
      const errorMsg = `Environment validation failed: ${validation.errors.map(e => e.message).join('; ')}`;
      throw new Error(errorMsg);
    }

    if (validation.warnings.length > 0) {
      this.logger.warn('Environment validation warnings:');
      for (const warning of validation.warnings) {
        this.logger.warn(`  - ${warning.message}`);
      }
    }

    execContext.validation = validation;
  }

  /**
   * Execute operation with retries
   */
  async executeWithRetries(operation, context) {
    let lastError;
    let attempt = 0;

    while (attempt < context.maxRetries) {
      attempt++;
      
      try {
        this.logger.debug(`Execution attempt ${attempt}/${context.maxRetries}`);
        
        const result = await this.executeOperation(operation, context, attempt);
        
        return {
          success: true,
          result,
          executionId: context.executionId,
          attempt,
          executionTime: this.getDeterministicTimestamp() - context.startTime,
          environment: context.environment,
          validation: context.validation,
          output: context.output,
          timestamp: this.getDeterministicDate().toISOString()
        };
        
      } catch (error) {
        lastError = error;
        
        this.logger.warn(`Execution attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < context.maxRetries) {
          const delayMs = this.options.retryDelayMs * attempt; // Exponential backoff
          this.logger.debug(`Retrying in ${delayMs}ms...`);
          await this.sleep(delayMs);
        }
      }
    }

    throw new Error(`Execution failed after ${context.maxRetries} attempts. Last error: ${lastError.message}`);
  }

  /**
   * Execute single operation
   */
  async executeOperation(operation, context, attempt) {
    const operationStart = performance.now();
    
    // Setup timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timeout after ${context.timeoutMs}ms`));
      }, context.timeoutMs);
    });

    // Execute operation
    const operationPromise = this.runOperationWithContext(operation, context, attempt);

    try {
      const result = await Promise.race([operationPromise, timeoutPromise]);
      
      const operationTime = performance.now() - operationStart;
      context.output.metrics.operationTime = operationTime;
      
      return result;
      
    } catch (error) {
      // Enhance error with context
      error.executionId = context.executionId;
      error.attempt = attempt;
      error.environment = context.environment.shortHash;
      
      throw error;
    }
  }

  /**
   * Run operation with full context
   */
  async runOperationWithContext(operation, context, attempt) {
    // Create execution environment
    const execEnv = {
      ...context,
      attempt,
      logger: this.logger.withTag(`exec-${context.executionId}`),
      
      // Helper methods
      captureFile: (path, content) => this.captureFile(context, path, content),
      captureMetric: (name, value) => this.captureMetric(context, name, value),
      log: (message, level = 'info') => this.captureLog(context, message, level)
    };

    // Execute operation
    if (typeof operation === 'function') {
      return await operation(execEnv);
    } else if (typeof operation === 'object' && operation.execute) {
      return await operation.execute(execEnv);
    } else {
      throw new Error('Invalid operation: must be function or object with execute method');
    }
  }

  /**
   * Setup output capture
   */
  setupOutputCapture(context) {
    // Capture console output
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    };

    console.log = (...args) => {
      context.output.stdout.push({ timestamp: this.getDeterministicTimestamp(), message: args.join(' ') });
      originalConsole.log(...args);
    };

    console.warn = (...args) => {
      context.output.stderr.push({ timestamp: this.getDeterministicTimestamp(), level: 'warn', message: args.join(' ') });
      originalConsole.warn(...args);
    };

    console.error = (...args) => {
      context.output.stderr.push({ timestamp: this.getDeterministicTimestamp(), level: 'error', message: args.join(' ') });
      originalConsole.error(...args);
    };

    // Store restore function
    context._restoreConsole = () => {
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    };
  }

  /**
   * Setup execution isolation
   */
  async setupExecutionIsolation(context) {
    // Create isolated working directory
    const isolatedDir = join(process.cwd(), '.kgen', 'hermetic', context.executionId);
    await fs.mkdir(isolatedDir, { recursive: true });
    
    context.isolatedWorkingDir = isolatedDir;
    context._originalCwd = process.cwd();
    
    // Change to isolated directory
    process.chdir(isolatedDir);
    
    // Store restore function
    context._restoreIsolation = async () => {
      process.chdir(context._originalCwd);
      
      // Optionally clean up isolated directory
      if (context.userContext.cleanupIsolation !== false) {
        try {
          await fs.rm(isolatedDir, { recursive: true, force: true });
        } catch (error) {
          this.logger.warn(`Failed to cleanup isolated directory: ${error.message}`);
        }
      }
    };
  }

  /**
   * Capture file output
   */
  captureFile(context, path, content) {
    if (context.captureOutput) {
      context.output.files.set(path, {
        content,
        timestamp: this.getDeterministicTimestamp(),
        size: content.length
      });
    }
  }

  /**
   * Capture metric
   */
  captureMetric(context, name, value) {
    if (context.captureOutput) {
      context.output.metrics[name] = {
        value,
        timestamp: this.getDeterministicTimestamp()
      };
    }
  }

  /**
   * Capture log message
   */
  captureLog(context, message, level) {
    if (context.captureOutput) {
      const entry = {
        timestamp: this.getDeterministicTimestamp(),
        level,
        message
      };
      
      if (level === 'error') {
        context.output.stderr.push(entry);
      } else {
        context.output.stdout.push(entry);
      }
    }
  }

  /**
   * Post-process execution result
   */
  async postProcessResult(result, context) {
    // Restore console if captured
    if (context._restoreConsole) {
      context._restoreConsole();
    }

    // Restore isolation if used
    if (context._restoreIsolation) {
      await context._restoreIsolation();
    }

    // Generate attestation if requested
    if (this.options.generateAttestation && result.success) {
      try {
        const attestation = await this.generateExecutionAttestation(result, context);
        result.attestation = attestation;
      } catch (error) {
        this.logger.warn('Failed to generate execution attestation:', error.message);
      }
    }

    return result;
  }

  /**
   * Generate execution attestation
   */
  async generateExecutionAttestation(result, context) {
    const stamp = await this.stamper.generateEnvironmentStamp({
      buildId: context.executionId,
      buildType: 'hermetic-execution',
      userContext: context.userContext,
      tags: ['hermetic', 'deterministic', 'validated'],
      notes: `Hermetic execution ${context.executionId}`
    });

    return {
      executionId: context.executionId,
      success: result.success,
      environmentStamp: stamp,
      validation: context.validation,
      executionMetrics: {
        duration: result.executionTime,
        attempt: result.attempt,
        outputSize: context.output.files.size,
        metricsCount: Object.keys(context.output.metrics).length
      },
      timestamp: this.getDeterministicDate().toISOString()
    };
  }

  /**
   * Generate execution ID
   */
  generateExecutionId() {
    const timestamp = this.getDeterministicTimestamp().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `exec_${timestamp}_${random}`;
  }

  /**
   * Record execution in history
   */
  recordExecution(executionId, result, duration) {
    this.executionHistory.unshift({
      executionId,
      timestamp: this.getDeterministicDate().toISOString(),
      success: result.success,
      duration,
      environmentHash: result.environment?.shortHash,
      attempt: result.attempt,
      error: result.error || null
    });

    // Keep only last 100 executions
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(0, 100);
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get execution statistics
   */
  getExecutionStats() {
    const recent = this.executionHistory.slice(0, 20);
    
    return {
      totalExecutions: this.executionHistory.length,
      recentExecutions: recent.length,
      successRate: recent.length > 0 ? 
        (recent.filter(e => e.success).length / recent.length) * 100 : 0,
      averageDuration: recent.length > 0 ?
        recent.reduce((sum, e) => sum + (e.duration || 0), 0) / recent.length : 0,
      averageAttempts: recent.length > 0 ?
        recent.reduce((sum, e) => sum + (e.attempt || 1), 0) / recent.length : 0
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    this.logger.debug('Shutting down hermetic executor');
    
    // Shutdown components
    await this.hermetic.shutdown();
    await this.validator.shutdown();
    await this.stamper.shutdown();
    
    // Clear history
    this.executionHistory.length = 0;
    
    this.isInitialized = false;
  }
}

/**
 * High-level wrapper functions
 */

/**
 * Execute operation in hermetic environment with validation
 */
export async function executeHermetic(operation, options = {}) {
  const executor = new HermeticExecutor(options);
  
  try {
    await executor.initialize();
    const result = await executor.execute(operation, options.context || {});
    
    return result;
  } finally {
    await executor.shutdown();
  }
}

/**
 * Execute with baseline environment validation
 */
export async function executeWithBaseline(operation, baseline, options = {}) {
  return await executeHermetic(operation, {
    ...options,
    validateBeforeExecution: true,
    context: {
      ...options.context,
      baseline
    }
  });
}

/**
 * Execute with attestation generation
 */
export async function executeWithAttestation(operation, options = {}) {
  return await executeHermetic(operation, {
    ...options,
    generateAttestation: true,
    captureOutput: true
  });
}

/**
 * Execute in strict hermetic mode
 */
export async function executeStrictHermetic(operation, options = {}) {
  return await executeHermetic(operation, {
    ...options,
    strictMode: true,
    validateBeforeExecution: true,
    generateAttestation: true,
    isolateExecution: true,
    captureOutput: true
  });
}

/**
 * Batch execute multiple operations
 */
export async function executeBatch(operations, options = {}) {
  const executor = new HermeticExecutor(options);
  
  try {
    await executor.initialize();
    
    const results = [];
    
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      const operationOptions = {
        ...options.context,
        batchIndex: i,
        batchSize: operations.length
      };
      
      try {
        const result = await executor.execute(operation, operationOptions);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          batchIndex: i,
          error: error.message,
          timestamp: this.getDeterministicDate().toISOString()
        });
        
        // Continue with next operation unless stopOnError is true
        if (options.stopOnError) {
          break;
        }
      }
    }
    
    return {
      success: results.every(r => r.success),
      results,
      totalOperations: operations.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length
    };
    
  } finally {
    await executor.shutdown();
  }
}

export default HermeticExecutor;
export { HermeticExecutor };