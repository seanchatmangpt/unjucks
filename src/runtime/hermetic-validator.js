/**
 * Runtime Environment Validation System
 * 
 * Comprehensive validation engine for ensuring environment compatibility
 * and detecting potential reproducibility issues before execution.
 * 
 * Agent 12: Hermetic Runtime Manager - Runtime Validation
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { consola } from 'consola';
import { performance } from 'perf_hooks';
import { HermeticEnvironment } from './hermetic-environment.js';
import { EnvironmentStamper } from '../attestation/environment-stamper.js';

class HermeticValidator {
  constructor(options = {}) {
    this.options = {
      strictValidation: options.strictValidation !== false,
      warningsAsErrors: options.warningsAsErrors === true,
      skipPlatformChecks: options.skipPlatformChecks === true,
      allowTimezoneVariance: options.allowTimezoneVariance === true,
      maxValidationTime: options.maxValidationTime || 10000, // 10 seconds
      cacheValidationResults: options.cacheValidationResults !== false,
      validationCacheTTL: options.validationCacheTTL || 300000, // 5 minutes
      ...options
    };

    this.logger = consola.withTag('hermetic-validator');
    this.validationCache = new Map();
    this.validationHistory = [];
    this.warningThresholds = new Map();
    
    // Initialize components
    this.hermeticEnv = new HermeticEnvironment(options.hermetic);
    this.stamper = new EnvironmentStamper(options.stamper);
    
    // Validation rule definitions
    this.validationRules = new Map();
    this.setupValidationRules();
    
    this.isInitialized = false;
  }

  /**
   * Initialize the validator
   */
  async initialize() {
    if (this.isInitialized) {
      return { success: true, cached: true };
    }

    try {
      this.logger.info('Initializing hermetic validator...');
      
      // Initialize dependencies
      await this.hermeticEnv.initialize();
      await this.stamper.initialize();
      
      // Setup warning thresholds
      this.setupWarningThresholds();
      
      this.isInitialized = true;
      
      this.logger.success('Hermetic validator initialized');
      
      return { success: true };
      
    } catch (error) {
      this.logger.error('Failed to initialize hermetic validator:', error);
      throw new Error(`Hermetic validator initialization failed: ${error.message}`);
    }
  }

  /**
   * Setup validation rules
   */
  setupValidationRules() {
    // Critical Node.js version rule
    this.validationRules.set('node-version', {
      priority: 'critical',
      category: 'runtime',
      description: 'Node.js version compatibility',
      validate: async (baseline, current, context) => {
        const baselineVersion = baseline.environment?.runtime?.nodeVersion || baseline.nodeVersion;
        const currentVersion = current.nodeVersion;
        
        if (!baselineVersion || !currentVersion) {
          return {
            valid: false,
            severity: 'error',
            message: 'Node.js version information missing',
            recommendation: 'Ensure Node.js version is captured in environment fingerprint'
          };
        }
        
        if (baselineVersion !== currentVersion) {
          const baselineMajor = parseInt(baselineVersion.match(/v(\d+)/)?.[1] || '0');
          const currentMajor = parseInt(currentVersion.match(/v(\d+)/)?.[1] || '0');
          
          if (Math.abs(baselineMajor - currentMajor) > 0) {
            return {
              valid: false,
              severity: 'error',
              message: `Node.js major version mismatch: baseline=${baselineVersion}, current=${currentVersion}`,
              recommendation: `Use Node.js ${baselineVersion} for exact reproducibility`,
              details: { baselineMajor, currentMajor }
            };
          } else {
            return {
              valid: true,
              severity: 'warning',
              message: `Node.js minor version difference: baseline=${baselineVersion}, current=${currentVersion}`,
              recommendation: 'Consider using exact Node.js version for strict reproducibility'
            };
          }
        }
        
        return { valid: true };
      }
    });

    // Platform compatibility rule
    this.validationRules.set('platform', {
      priority: 'high',
      category: 'system',
      description: 'Platform and architecture compatibility',
      validate: async (baseline, current, context) => {
        const baselinePlatform = baseline.environment?.runtime?.platform || baseline.platform;
        const currentPlatform = current.platform;
        const baselineArch = baseline.environment?.runtime?.arch || baseline.arch;
        const currentArch = current.arch;
        
        if (this.options.skipPlatformChecks) {
          return { 
            valid: true,
            severity: 'info',
            message: 'Platform checks skipped by configuration'
          };
        }
        
        const issues = [];
        
        if (baselinePlatform !== currentPlatform) {
          issues.push({
            type: 'platform-mismatch',
            baseline: baselinePlatform,
            current: currentPlatform,
            severity: context.allowCrossPlatform ? 'warning' : 'error'
          });
        }
        
        if (baselineArch !== currentArch) {
          issues.push({
            type: 'arch-mismatch',
            baseline: baselineArch,
            current: currentArch,
            severity: context.allowCrossArch ? 'warning' : 'error'
          });
        }
        
        if (issues.length > 0) {
          const hasErrors = issues.some(issue => issue.severity === 'error');
          
          return {
            valid: !hasErrors,
            severity: hasErrors ? 'error' : 'warning',
            message: `Platform/architecture differences detected`,
            details: issues,
            recommendation: hasErrors ? 
              'Use same platform and architecture for reproducible builds' :
              'Cross-platform build detected - verify output compatibility'
          };
        }
        
        return { valid: true };
      }
    });

    // Timezone and locale rule
    this.validationRules.set('locale', {
      priority: 'medium',
      category: 'environment',
      description: 'Timezone and locale consistency',
      validate: async (baseline, current, context) => {
        const baselineTimezone = baseline.environment?.locale?.timezone || baseline.timezone;
        const currentTimezone = current.timezone;
        const baselineLocale = baseline.environment?.locale?.locale || baseline.locale;
        const currentLocale = current.locale;
        
        const issues = [];
        
        if (!this.options.allowTimezoneVariance && baselineTimezone !== currentTimezone) {
          issues.push({
            type: 'timezone-mismatch',
            baseline: baselineTimezone,
            current: currentTimezone,
            severity: 'warning'
          });
        }
        
        if (baselineLocale !== currentLocale) {
          issues.push({
            type: 'locale-mismatch',
            baseline: baselineLocale,
            current: currentLocale,
            severity: 'warning'
          });
        }
        
        if (issues.length > 0) {
          return {
            valid: true, // Usually not critical
            severity: 'warning',
            message: 'Locale/timezone differences detected',
            details: issues,
            recommendation: 'Set TZ and LANG environment variables for consistent results'
          };
        }
        
        return { valid: true };
      }
    });

    // Build environment rule
    this.validationRules.set('build-environment', {
      priority: 'high',
      category: 'build',
      description: 'Build-time environment variables and settings',
      validate: async (baseline, current, context) => {
        const baselineBuild = baseline.environment?.build || {};
        const currentEnvVars = current.environmentVariables || {};
        
        const criticalEnvVars = [
          'NODE_ENV', 'SOURCE_DATE_EPOCH', 'KGEN_RANDOM_SEED',
          'TZ', 'LANG', 'LC_ALL'
        ];
        
        const issues = [];
        
        for (const envVar of criticalEnvVars) {
          const baselineValue = baselineBuild[envVar.toLowerCase().replace('_', '')] || 
                               baseline.environmentVariables?.[envVar];
          const currentValue = currentEnvVars[envVar];
          
          if (baselineValue && baselineValue !== currentValue) {
            issues.push({
              type: 'env-var-mismatch',
              variable: envVar,
              baseline: baselineValue,
              current: currentValue || '<unset>',
              severity: ['SOURCE_DATE_EPOCH', 'KGEN_RANDOM_SEED'].includes(envVar) ? 'error' : 'warning'
            });
          }
        }
        
        if (issues.length > 0) {
          const hasErrors = issues.some(issue => issue.severity === 'error');
          
          return {
            valid: !hasErrors,
            severity: hasErrors ? 'error' : 'warning',
            message: 'Build environment differences detected',
            details: issues,
            recommendation: 'Set consistent environment variables for reproducible builds'
          };
        }
        
        return { valid: true };
      }
    });

    // Tool configuration rule
    this.validationRules.set('tool-config', {
      priority: 'medium',
      category: 'tooling',
      description: 'Tool configuration and dependencies',
      validate: async (baseline, current, context) => {
        const baselineConfig = baseline.toolConfiguration || {};
        const currentConfig = context.currentToolConfig || {};
        
        const issues = [];
        
        // Check Node.js flags
        const baselineFlags = baselineConfig.nodeFlags || [];
        const currentFlags = current.nodeFlags || [];
        
        if (JSON.stringify(baselineFlags.sort()) !== JSON.stringify(currentFlags.sort())) {
          issues.push({
            type: 'node-flags-mismatch',
            baseline: baselineFlags,
            current: currentFlags,
            severity: 'warning'
          });
        }
        
        // Check package dependencies hash
        if (baselineConfig.nodeModulesHash && currentConfig.nodeModulesHash) {
          if (baselineConfig.nodeModulesHash !== currentConfig.nodeModulesHash) {
            issues.push({
              type: 'dependencies-mismatch',
              message: 'Package dependencies have changed',
              severity: 'warning'
            });
          }
        }
        
        if (issues.length > 0) {
          return {
            valid: true, // Usually not critical
            severity: 'warning',
            message: 'Tool configuration differences detected',
            details: issues,
            recommendation: 'Verify tool configuration consistency for reproducible builds'
          };
        }
        
        return { valid: true };
      }
    });

    // Performance impact rule
    this.validationRules.set('performance', {
      priority: 'low',
      category: 'performance',
      description: 'Performance impact assessment',
      validate: async (baseline, current, context) => {
        const baselineMemory = baseline.environment?.system?.totalMemory || baseline.totalMemory;
        const currentMemory = current.totalMemory;
        const baselineCpu = baseline.environment?.system?.cpuCount || baseline.cpuCount;
        const currentCpu = current.cpuCount;
        
        const warnings = [];
        
        // Check memory availability
        if (baselineMemory && currentMemory) {
          const memoryRatio = currentMemory / baselineMemory;
          if (memoryRatio < 0.75) {
            warnings.push({
              type: 'insufficient-memory',
              message: `Current system has ${Math.round(memoryRatio * 100)}% of baseline memory`,
              severity: 'warning'
            });
          }
        }
        
        // Check CPU availability
        if (baselineCpu && currentCpu) {
          if (currentCpu < baselineCpu) {
            warnings.push({
              type: 'fewer-cpus',
              message: `Current system has ${currentCpu} CPUs vs baseline ${baselineCpu}`,
              severity: 'info'
            });
          }
        }
        
        if (warnings.length > 0) {
          return {
            valid: true,
            severity: 'info',
            message: 'Performance differences detected',
            details: warnings,
            recommendation: 'Build may take longer or use more memory than baseline'
          };
        }
        
        return { valid: true };
      }
    });
  }

  /**
   * Setup warning thresholds
   */
  setupWarningThresholds() {
    this.warningThresholds.set('validation-time', 5000); // 5 seconds
    this.warningThresholds.set('memory-usage', 500 * 1024 * 1024); // 500MB
    this.warningThresholds.set('cache-hit-rate', 0.8); // 80%
  }

  /**
   * Validate environment against baseline
   */
  async validateEnvironment(baseline, options = {}) {
    const validationId = this.generateValidationId();
    const startTime = performance.now();
    
    this.logger.info(`Starting environment validation: ${validationId}`);
    
    try {
      // Check cache first
      if (this.options.cacheValidationResults && !options.skipCache) {
        const cached = this.getCachedValidation(baseline, options);
        if (cached) {
          this.logger.debug('Using cached validation result');
          return { ...cached, cached: true };
        }
      }
      
      // Capture current environment
      const currentEnv = await this.hermeticEnv.captureEnvironmentFingerprint();
      
      // Prepare validation context
      const context = {
        validationId,
        startTime,
        allowCrossPlatform: options.allowCrossPlatform || false,
        allowCrossArch: options.allowCrossArch || false,
        skipRules: options.skipRules || [],
        strictMode: options.strictMode || this.options.strictValidation,
        currentToolConfig: options.toolConfig || {},
        ...options.context
      };
      
      // Execute validation rules
      const results = await this.executeValidationRules(baseline, currentEnv, context);
      
      // Compile validation result
      const validation = this.compileValidationResult(results, context);
      
      // Cache result if enabled
      if (this.options.cacheValidationResults) {
        this.cacheValidationResult(baseline, validation, options);
      }
      
      // Record validation history
      this.recordValidationHistory(validation);
      
      const duration = performance.now() - startTime;
      
      this.logger.info(\n        `Validation completed: ${validationId} (${duration.toFixed(2)}ms) - ` +\n        `${validation.valid ? '✅ VALID' : '❌ INVALID'}`\n      );\n      \n      if (duration > this.warningThresholds.get('validation-time')) {\n        this.logger.warn(`Validation took ${duration.toFixed(2)}ms (threshold: ${this.warningThresholds.get('validation-time')}ms)`);\n      }\n      \n      return {\n        ...validation,\n        validationId,\n        duration\n      };\n      \n    } catch (error) {\n      const duration = performance.now() - startTime;\n      \n      this.logger.error(`Validation failed: ${validationId}`, error);\n      \n      return {\n        valid: false,\n        validationId,\n        duration,\n        error: error.message,\n        errors: [{\n          type: 'validation-error',\n          message: `Validation framework error: ${error.message}`,\n          severity: 'error'\n        }],\n        warnings: [],\n        info: []\n      };\n    }\n  }\n\n  /**\n   * Execute all validation rules\n   */\n  async executeValidationRules(baseline, current, context) {\n    const results = new Map();\n    const rulePromises = [];\n    \n    for (const [ruleName, rule] of this.validationRules) {\n      // Skip rules if specified\n      if (context.skipRules.includes(ruleName)) {\n        results.set(ruleName, {\n          valid: true,\n          severity: 'info',\n          message: `Rule skipped: ${ruleName}`,\n          skipped: true\n        });\n        continue;\n      }\n      \n      // Execute rule with timeout\n      const rulePromise = this.executeRuleWithTimeout(rule, baseline, current, context)\n        .then(result => ({ ruleName, result }))\n        .catch(error => ({ \n          ruleName, \n          result: {\n            valid: false,\n            severity: 'error',\n            message: `Rule execution failed: ${error.message}`,\n            error: true\n          }\n        }));\n      \n      rulePromises.push(rulePromise);\n    }\n    \n    // Wait for all rules to complete\n    const ruleResults = await Promise.all(rulePromises);\n    \n    // Collect results\n    for (const { ruleName, result } of ruleResults) {\n      results.set(ruleName, {\n        ...result,\n        rule: ruleName,\n        category: this.validationRules.get(ruleName).category,\n        priority: this.validationRules.get(ruleName).priority\n      });\n    }\n    \n    return results;\n  }\n\n  /**\n   * Execute validation rule with timeout\n   */\n  async executeRuleWithTimeout(rule, baseline, current, context) {\n    const timeout = context.ruleTimeout || 5000; // 5 seconds default\n    \n    return new Promise(async (resolve, reject) => {\n      const timeoutId = setTimeout(() => {\n        reject(new Error(`Rule execution timeout after ${timeout}ms`));\n      }, timeout);\n      \n      try {\n        const result = await rule.validate(baseline, current, context);\n        clearTimeout(timeoutId);\n        resolve(result);\n      } catch (error) {\n        clearTimeout(timeoutId);\n        reject(error);\n      }\n    });\n  }\n\n  /**\n   * Compile validation results into final result\n   */\n  compileValidationResult(ruleResults, context) {\n    const validation = {\n      valid: true,\n      errors: [],\n      warnings: [],\n      info: [],\n      rules: {},\n      summary: {\n        totalRules: ruleResults.size,\n        passedRules: 0,\n        failedRules: 0,\n        skippedRules: 0,\n        errorCount: 0,\n        warningCount: 0,\n        infoCount: 0\n      },\n      context: {\n        validationId: context.validationId,\n        strictMode: context.strictMode,\n        allowCrossPlatform: context.allowCrossPlatform,\n        skipRules: context.skipRules\n      }\n    };\n    \n    // Process each rule result\n    for (const [ruleName, result] of ruleResults) {\n      validation.rules[ruleName] = result;\n      \n      // Count rule outcomes\n      if (result.skipped) {\n        validation.summary.skippedRules++;\n      } else if (result.valid) {\n        validation.summary.passedRules++;\n      } else {\n        validation.summary.failedRules++;\n        validation.valid = false;\n      }\n      \n      // Categorize messages\n      if (result.severity === 'error') {\n        validation.errors.push({\n          rule: ruleName,\n          category: result.category,\n          priority: result.priority,\n          message: result.message,\n          recommendation: result.recommendation,\n          details: result.details\n        });\n        validation.summary.errorCount++;\n      } else if (result.severity === 'warning') {\n        validation.warnings.push({\n          rule: ruleName,\n          category: result.category,\n          message: result.message,\n          recommendation: result.recommendation,\n          details: result.details\n        });\n        validation.summary.warningCount++;\n        \n        // Treat warnings as errors if configured\n        if (this.options.warningsAsErrors) {\n          validation.valid = false;\n        }\n      } else if (result.severity === 'info') {\n        validation.info.push({\n          rule: ruleName,\n          category: result.category,\n          message: result.message,\n          details: result.details\n        });\n        validation.summary.infoCount++;\n      }\n    }\n    \n    return validation;\n  }\n\n  /**\n   * Generate validation ID\n   */\n  generateValidationId() {\n    const timestamp = this.getDeterministicTimestamp().toString(36);\n    const random = Math.random().toString(36).substring(2, 8);\n    return `val_${timestamp}_${random}`;\n  }\n\n  /**\n   * Get cached validation result\n   */\n  getCachedValidation(baseline, options) {\n    const cacheKey = this.generateCacheKey(baseline, options);\n    const cached = this.validationCache.get(cacheKey);\n    \n    if (cached && (this.getDeterministicTimestamp() - cached.timestamp) < this.options.validationCacheTTL) {\n      return cached.result;\n    }\n    \n    if (cached) {\n      this.validationCache.delete(cacheKey); // Remove expired\n    }\n    \n    return null;\n  }\n\n  /**\n   * Cache validation result\n   */\n  cacheValidationResult(baseline, validation, options) {\n    const cacheKey = this.generateCacheKey(baseline, options);\n    \n    this.validationCache.set(cacheKey, {\n      result: validation,\n      timestamp: this.getDeterministicTimestamp()\n    });\n    \n    // Clean up old cache entries\n    if (this.validationCache.size > 100) {\n      const oldestKey = this.validationCache.keys().next().value;\n      this.validationCache.delete(oldestKey);\n    }\n  }\n\n  /**\n   * Generate cache key for validation result\n   */\n  generateCacheKey(baseline, options) {\n    const keyData = {\n      baselineHash: baseline.environment?.hash || baseline.hash,\n      strictMode: options.strictMode,\n      allowCrossPlatform: options.allowCrossPlatform,\n      skipRules: options.skipRules?.sort() || []\n    };\n    \n    return JSON.stringify(keyData);\n  }\n\n  /**\n   * Record validation in history\n   */\n  recordValidationHistory(validation) {\n    this.validationHistory.unshift({\n      validationId: validation.context.validationId,\n      timestamp: this.getDeterministicDate().toISOString(),\n      valid: validation.valid,\n      errorCount: validation.summary.errorCount,\n      warningCount: validation.summary.warningCount,\n      duration: validation.duration\n    });\n    \n    // Keep only last 100 validations\n    if (this.validationHistory.length > 100) {\n      this.validationHistory = this.validationHistory.slice(0, 100);\n    }\n  }\n\n  /**\n   * Validate against attestation file\n   */\n  async validateAgainstAttestation(attestationPath, options = {}) {\n    try {\n      // Load attestation\n      const attestationContent = await fs.readFile(attestationPath, 'utf8');\n      const attestation = JSON.parse(attestationContent);\n      \n      if (!attestation.environment) {\n        throw new Error('Attestation file does not contain environment information');\n      }\n      \n      return await this.validateEnvironment(attestation, options);\n      \n    } catch (error) {\n      this.logger.error(`Failed to validate against attestation: ${attestationPath}`, error);\n      throw new Error(`Attestation validation failed: ${error.message}`);\n    }\n  }\n\n  /**\n   * Quick validation check (subset of rules)\n   */\n  async quickValidate(baseline, options = {}) {\n    const quickRules = ['node-version', 'build-environment'];\n    \n    return await this.validateEnvironment(baseline, {\n      ...options,\n      skipRules: this.validationRules.keys().filter(rule => !quickRules.includes(rule))\n    });\n  }\n\n  /**\n   * Get validation statistics\n   */\n  getValidationStats() {\n    const recent = this.validationHistory.slice(0, 20); // Last 20 validations\n    \n    return {\n      totalValidations: this.validationHistory.length,\n      recentValidations: recent.length,\n      successRate: recent.length > 0 ? \n        (recent.filter(v => v.valid).length / recent.length) * 100 : 0,\n      averageDuration: recent.length > 0 ? \n        recent.reduce((sum, v) => sum + (v.duration || 0), 0) / recent.length : 0,\n      cacheSize: this.validationCache.size,\n      cacheHitRate: this.calculateCacheHitRate(),\n      rulesCount: this.validationRules.size\n    };\n  }\n\n  /**\n   * Calculate cache hit rate\n   */\n  calculateCacheHitRate() {\n    const recentValidations = this.validationHistory.slice(0, 50);\n    const cacheHits = recentValidations.filter(v => v.cached).length;\n    \n    return recentValidations.length > 0 ? \n      (cacheHits / recentValidations.length) * 100 : 0;\n  }\n\n  /**\n   * Clear validation cache\n   */\n  clearCache() {\n    const cacheSize = this.validationCache.size;\n    this.validationCache.clear();\n    \n    this.logger.debug(`Cleared validation cache (${cacheSize} entries)`);\n  }\n\n  /**\n   * Add custom validation rule\n   */\n  addValidationRule(name, rule) {\n    if (this.validationRules.has(name)) {\n      this.logger.warn(`Overriding existing validation rule: ${name}`);\n    }\n    \n    this.validationRules.set(name, {\n      priority: rule.priority || 'medium',\n      category: rule.category || 'custom',\n      description: rule.description || `Custom rule: ${name}`,\n      validate: rule.validate\n    });\n    \n    this.logger.debug(`Added validation rule: ${name}`);\n  }\n\n  /**\n   * Remove validation rule\n   */\n  removeValidationRule(name) {\n    if (this.validationRules.delete(name)) {\n      this.logger.debug(`Removed validation rule: ${name}`);\n      return true;\n    }\n    return false;\n  }\n\n  /**\n   * Cleanup and shutdown\n   */\n  async shutdown() {\n    this.logger.debug('Shutting down hermetic validator');\n    \n    // Shutdown dependencies\n    await this.hermeticEnv.shutdown();\n    await this.stamper.shutdown();\n    \n    // Clear caches and history\n    this.validationCache.clear();\n    this.validationHistory.length = 0;\n    this.warningThresholds.clear();\n    this.validationRules.clear();\n    \n    this.isInitialized = false;\n  }\n}\n\nexport default HermeticValidator;\nexport { HermeticValidator };"
    }

<function_results>
File created successfully at: /Users/sac/unjucks/src/runtime/hermetic-validator.js
</function_results>

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "Create hermetic runtime environment capture system", "status": "completed", "activeForm": "Created hermetic runtime environment capture system"}, {"content": "Implement environment stamping in .attest.json", "status": "completed", "activeForm": "Implemented environment stamping in .attest.json"}, {"content": "Build runtime validation for environment matching", "status": "completed", "activeForm": "Built runtime validation for environment matching"}, {"content": "Create hermetic execution wrappers", "status": "in_progress", "activeForm": "Creating hermetic execution wrappers"}, {"content": "Add environment compatibility checking", "status": "pending", "activeForm": "Adding environment compatibility checking"}, {"content": "Integrate with fast startup loader", "status": "pending", "activeForm": "Integrating with fast startup loader"}, {"content": "Create hermetic test suite", "status": "pending", "activeForm": "Creating hermetic test suite"}, {"content": "Add deterministic random seeding", "status": "pending", "activeForm": "Adding deterministic random seeding"}]