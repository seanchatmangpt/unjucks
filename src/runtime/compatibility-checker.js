/**
 * Environment Compatibility Checking System
 * 
 * Advanced compatibility analysis for determining cross-platform, cross-environment,
 * and cross-version compatibility of hermetic builds and executions.
 * 
 * Agent 12: Hermetic Runtime Manager - Compatibility Checking
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { consola } from 'consola';
import { HermeticEnvironment } from './hermetic-environment.js';

class CompatibilityChecker {
  constructor(options = {}) {
    this.options = {
      strictCompatibility: options.strictCompatibility === true,
      allowMinorVersionDiffs: options.allowMinorVersionDiffs !== false,
      allowPlatformDiffs: options.allowPlatformDiffs === true,
      allowArchDiffs: options.allowArchDiffs === true,
      cacheCompatibilityResults: options.cacheCompatibilityResults !== false,
      compatibilityCacheTTL: options.compatibilityCacheTTL || 3600000, // 1 hour
      ...options
    };

    this.logger = consola.withTag('compat-checker');
    this.compatibilityCache = new Map();
    this.compatibilityRules = new Map();
    this.knownCompatibilities = new Map();
    
    // Initialize compatibility matrices
    this.platformMatrix = new Map();
    this.nodeVersionMatrix = new Map();
    this.architectureMatrix = new Map();
    
    this.setupCompatibilityRules();
    this.initializeCompatibilityMatrices();
  }

  /**
   * Initialize compatibility matrices with known compatibility data
   */
  initializeCompatibilityMatrices() {
    // Platform compatibility matrix
    this.platformMatrix.set('darwin->linux', { 
      compatible: true, 
      confidence: 0.85,
      notes: 'Generally compatible, watch for path separators and case sensitivity',
      warnings: ['File path case sensitivity', 'Line ending differences']
    });
    
    this.platformMatrix.set('linux->darwin', { 
      compatible: true, 
      confidence: 0.85,
      notes: 'Generally compatible, watch for path separators',
      warnings: ['File path case sensitivity']
    });
    
    this.platformMatrix.set('win32->linux', { 
      compatible: false, 
      confidence: 0.60,
      notes: 'Limited compatibility, significant path and script differences',
      warnings: ['Path separators', 'Line endings', 'Script execution', 'Case sensitivity']
    });
    
    this.platformMatrix.set('win32->darwin', { 
      compatible: false, 
      confidence: 0.60,
      notes: 'Limited compatibility, significant differences',
      warnings: ['Path separators', 'Line endings', 'Script execution', 'Case sensitivity']
    });

    // Node.js version compatibility matrix
    this.nodeVersionMatrix.set('major-diff', {
      compatible: false,
      confidence: 0.20,
      notes: 'Major Node.js version differences likely to cause issues',
      warnings: ['API changes', 'Module compatibility', 'Performance differences']
    });
    
    this.nodeVersionMatrix.set('minor-diff', {
      compatible: true,
      confidence: 0.90,
      notes: 'Minor version differences usually compatible',
      warnings: ['Possible API additions', 'Performance improvements']
    });
    
    this.nodeVersionMatrix.set('patch-diff', {
      compatible: true,
      confidence: 0.98,
      notes: 'Patch version differences are typically safe',
      warnings: ['Bug fixes may change behavior']
    });

    // Architecture compatibility matrix
    this.architectureMatrix.set('x64->arm64', {
      compatible: true,
      confidence: 0.75,
      notes: 'Generally compatible with possible performance differences',
      warnings: ['Performance characteristics', 'Native module compatibility']
    });
    
    this.architectureMatrix.set('arm64->x64', {
      compatible: true,
      confidence: 0.75,
      notes: 'Generally compatible with possible performance differences',
      warnings: ['Performance characteristics', 'Native module compatibility']
    });
    
    this.architectureMatrix.set('ia32->x64', {
      compatible: true,
      confidence: 0.85,
      notes: 'Usually compatible, 64-bit has more memory available',
      warnings: ['Memory usage differences', 'Integer size differences']
    });
  }

  /**
   * Setup compatibility rules
   */
  setupCompatibilityRules() {
    // Critical system compatibility rule
    this.compatibilityRules.set('system-compatibility', {
      priority: 'critical',
      category: 'system',
      description: 'Check core system compatibility (platform, architecture, Node.js)',
      check: async (env1, env2) => {
        const issues = [];
        let overallCompatible = true;
        let confidence = 1.0;

        // Platform compatibility
        const platformCompat = this.checkPlatformCompatibility(env1, env2);
        if (!platformCompat.compatible && !this.options.allowPlatformDiffs) {
          overallCompatible = false;
          confidence = Math.min(confidence, platformCompat.confidence);
          issues.push({
            type: 'platform-incompatible',
            severity: 'error',
            message: `Platform incompatibility: ${env1.platform} -> ${env2.platform}`,
            details: platformCompat
          });
        } else if (!platformCompat.compatible) {
          confidence = Math.min(confidence, platformCompat.confidence);
          issues.push({
            type: 'platform-warning',
            severity: 'warning',
            message: `Platform difference: ${env1.platform} -> ${env2.platform}`,
            details: platformCompat
          });
        }

        // Architecture compatibility
        const archCompat = this.checkArchitectureCompatibility(env1, env2);
        if (!archCompat.compatible && !this.options.allowArchDiffs) {
          overallCompatible = false;
          confidence = Math.min(confidence, archCompat.confidence);
          issues.push({
            type: 'arch-incompatible',
            severity: 'error',
            message: `Architecture incompatibility: ${env1.arch} -> ${env2.arch}`,
            details: archCompat
          });
        } else if (!archCompat.compatible) {
          confidence = Math.min(confidence, archCompat.confidence);
          issues.push({
            type: 'arch-warning',
            severity: 'warning',
            message: `Architecture difference: ${env1.arch} -> ${env2.arch}`,
            details: archCompat
          });
        }

        // Node.js version compatibility
        const nodeCompat = this.checkNodeVersionCompatibility(env1, env2);
        if (!nodeCompat.compatible) {
          overallCompatible = false;
          confidence = Math.min(confidence, nodeCompat.confidence);
          issues.push({
            type: 'node-version-incompatible',
            severity: nodeCompat.confidence < 0.5 ? 'error' : 'warning',
            message: `Node.js version incompatibility: ${env1.nodeVersion} -> ${env2.nodeVersion}`,
            details: nodeCompat
          });
        } else if (nodeCompat.warnings?.length > 0) {
          confidence = Math.min(confidence, nodeCompat.confidence);
          issues.push({
            type: 'node-version-warning',
            severity: 'info',
            message: `Node.js version difference: ${env1.nodeVersion} -> ${env2.nodeVersion}`,
            details: nodeCompat
          });
        }

        return {
          compatible: overallCompatible,
          confidence,
          issues,
          summary: `System compatibility: ${overallCompatible ? 'COMPATIBLE' : 'INCOMPATIBLE'} (${(confidence * 100).toFixed(1)}%)`
        };
      }
    });

    // Environment variables compatibility rule
    this.compatibilityRules.set('env-vars-compatibility', {
      priority: 'high',
      category: 'environment',
      description: 'Check environment variable compatibility',
      check: async (env1, env2) => {
        const env1Vars = env1.environmentVariables || {};
        const env2Vars = env2.environmentVariables || {};
        
        const issues = [];
        let compatible = true;
        let confidence = 1.0;

        const criticalVars = ['NODE_ENV', 'TZ', 'LANG', 'LC_ALL', 'SOURCE_DATE_EPOCH', 'KGEN_RANDOM_SEED'];
        
        for (const varName of criticalVars) {
          if (env1Vars[varName] && env2Vars[varName] && env1Vars[varName] !== env2Vars[varName]) {
            const severity = ['SOURCE_DATE_EPOCH', 'KGEN_RANDOM_SEED'].includes(varName) ? 'error' : 'warning';
            
            if (severity === 'error') {
              compatible = false;
              confidence = Math.min(confidence, 0.3);
            } else {
              confidence = Math.min(confidence, 0.8);
            }
            
            issues.push({
              type: 'env-var-mismatch',
              severity,
              variable: varName,
              env1Value: env1Vars[varName],
              env2Value: env2Vars[varName],
              message: `Environment variable mismatch: ${varName}`
            });
          }
        }

        return {
          compatible,
          confidence,
          issues,
          summary: `Environment variables: ${compatible ? 'COMPATIBLE' : 'INCOMPATIBLE'} (${(confidence * 100).toFixed(1)}%)`
        };
      }
    });

    // Locale and timezone compatibility rule
    this.compatibilityRules.set('locale-compatibility', {
      priority: 'medium',
      category: 'locale',
      description: 'Check locale and timezone compatibility',
      check: async (env1, env2) => {
        const issues = [];
        let compatible = true;
        let confidence = 1.0;

        // Timezone compatibility
        if (env1.timezone !== env2.timezone) {
          confidence = Math.min(confidence, 0.85);
          issues.push({
            type: 'timezone-mismatch',
            severity: 'warning',
            env1Timezone: env1.timezone,
            env2Timezone: env2.timezone,
            message: `Timezone difference: ${env1.timezone} -> ${env2.timezone}`
          });
        }

        // Locale compatibility
        if (env1.locale !== env2.locale) {
          confidence = Math.min(confidence, 0.90);
          issues.push({
            type: 'locale-mismatch',
            severity: 'warning',
            env1Locale: env1.locale,
            env2Locale: env2.locale,
            message: `Locale difference: ${env1.locale} -> ${env2.locale}`
          });
        }

        return {
          compatible,
          confidence,
          issues,
          summary: `Locale compatibility: ${compatible ? 'COMPATIBLE' : 'INCOMPATIBLE'} (${(confidence * 100).toFixed(1)}%)`
        };
      }
    });

    // Tool configuration compatibility rule
    this.compatibilityRules.set('tool-compatibility', {
      priority: 'medium',
      category: 'tooling',
      description: 'Check tool configuration compatibility',
      check: async (env1, env2, context = {}) => {
        const issues = [];
        let compatible = true;
        let confidence = 1.0;

        // Check Node.js flags
        const flags1 = env1.nodeFlags || [];
        const flags2 = env2.nodeFlags || [];
        
        if (JSON.stringify(flags1.sort()) !== JSON.stringify(flags2.sort())) {
          confidence = Math.min(confidence, 0.85);
          issues.push({
            type: 'node-flags-mismatch',
            severity: 'warning',
            env1Flags: flags1,
            env2Flags: flags2,
            message: 'Node.js flags differ between environments'
          });
        }

        // Check tool versions if available in context
        if (context.toolVersions) {
          const version1 = context.toolVersions.env1 || {};
          const version2 = context.toolVersions.env2 || {};
          
          for (const tool of ['kgen', 'npm', 'yarn']) {
            if (version1[tool] && version2[tool] && version1[tool] !== version2[tool]) {
              confidence = Math.min(confidence, 0.90);
              issues.push({
                type: 'tool-version-mismatch',
                severity: 'info',
                tool,
                env1Version: version1[tool],
                env2Version: version2[tool],
                message: `${tool} version difference: ${version1[tool]} -> ${version2[tool]}`
              });
            }
          }
        }

        return {
          compatible,
          confidence,
          issues,
          summary: `Tool compatibility: ${compatible ? 'COMPATIBLE' : 'INCOMPATIBLE'} (${(confidence * 100).toFixed(1)}%)`
        };
      }
    });
  }

  /**
   * Check platform compatibility
   */
  checkPlatformCompatibility(env1, env2) {
    if (env1.platform === env2.platform) {
      return {
        compatible: true,
        confidence: 1.0,
        notes: 'Same platform',
        warnings: []
      };
    }

    const key = `${env1.platform}->${env2.platform}`;
    return this.platformMatrix.get(key) || {
      compatible: false,
      confidence: 0.30,
      notes: 'Unknown platform combination',
      warnings: ['Untested platform combination']
    };
  }

  /**
   * Check architecture compatibility
   */
  checkArchitectureCompatibility(env1, env2) {
    if (env1.arch === env2.arch) {
      return {
        compatible: true,
        confidence: 1.0,
        notes: 'Same architecture',
        warnings: []
      };
    }

    const key = `${env1.arch}->${env2.arch}`;
    return this.architectureMatrix.get(key) || {
      compatible: false,
      confidence: 0.40,
      notes: 'Unknown architecture combination',
      warnings: ['Untested architecture combination']
    };
  }

  /**
   * Check Node.js version compatibility
   */
  checkNodeVersionCompatibility(env1, env2) {
    if (env1.nodeVersion === env2.nodeVersion) {
      return {
        compatible: true,
        confidence: 1.0,
        notes: 'Same Node.js version',
        warnings: []
      };
    }

    const version1 = this.parseNodeVersion(env1.nodeVersion);
    const version2 = this.parseNodeVersion(env2.nodeVersion);

    if (!version1 || !version2) {
      return {
        compatible: false,
        confidence: 0.20,
        notes: 'Cannot parse Node.js versions',
        warnings: ['Unable to determine version compatibility']
      };
    }

    if (version1.major !== version2.major) {
      return this.nodeVersionMatrix.get('major-diff');
    } else if (version1.minor !== version2.minor) {
      return this.nodeVersionMatrix.get('minor-diff');
    } else {
      return this.nodeVersionMatrix.get('patch-diff');
    }
  }

  /**
   * Parse Node.js version string
   */
  parseNodeVersion(versionString) {
    const match = versionString.match(/v?(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;

    return {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3])
    };
  }

  /**
   * Perform comprehensive compatibility check
   */
  async performCompatibilityCheck(env1, env2, options = {}) {
    const checkId = this.generateCheckId();
    const startTime = performance.now();

    this.logger.info(`Starting compatibility check: ${checkId}`);

    try {
      // Check cache first
      if (this.options.cacheCompatibilityResults && !options.skipCache) {
        const cached = this.getCachedCompatibilityResult(env1, env2);
        if (cached) {
          this.logger.debug('Using cached compatibility result');
          return { ...cached, cached: true };
        }
      }

      // Execute all compatibility rules
      const ruleResults = await this.executeCompatibilityRules(env1, env2, options);

      // Compile overall compatibility result
      const result = this.compileCompatibilityResult(ruleResults, checkId, options);

      // Cache result
      if (this.options.cacheCompatibilityResults) {
        this.cacheCompatibilityResult(env1, env2, result);
      }

      const duration = performance.now() - startTime;
      result.duration = duration;

      this.logger.info(
        `Compatibility check completed: ${checkId} (${duration.toFixed(2)}ms) - ` +
        `${result.compatible ? '✅ COMPATIBLE' : '❌ INCOMPATIBLE'} (${(result.confidence * 100).toFixed(1)}%)`
      );

      return result;

    } catch (error) {
      const duration = performance.now() - startTime;

      this.logger.error(`Compatibility check failed: ${checkId}`, error);

      return {
        compatible: false,
        confidence: 0.0,
        checkId,
        duration,
        error: error.message,
        issues: [{
          type: 'check-error',
          severity: 'error',
          message: `Compatibility check failed: ${error.message}`
        }]
      };
    }
  }

  /**
   * Execute compatibility rules
   */
  async executeCompatibilityRules(env1, env2, options) {
    const results = new Map();
    const rulePromises = [];

    for (const [ruleName, rule] of this.compatibilityRules) {
      if (options.skipRules?.includes(ruleName)) {
        results.set(ruleName, {
          compatible: true,
          confidence: 1.0,
          issues: [],
          summary: `Rule skipped: ${ruleName}`,
          skipped: true
        });
        continue;
      }

      const rulePromise = rule.check(env1, env2, options.context || {})
        .then(result => ({ ruleName, result }))
        .catch(error => ({
          ruleName,
          result: {
            compatible: false,
            confidence: 0.0,
            issues: [{
              type: 'rule-error',
              severity: 'error',
              message: `Rule execution failed: ${error.message}`
            }],
            summary: `Rule failed: ${ruleName}`,
            error: true
          }
        }));

      rulePromises.push(rulePromise);
    }

    const ruleResults = await Promise.all(rulePromises);

    for (const { ruleName, result } of ruleResults) {
      results.set(ruleName, {
        ...result,
        rule: ruleName,
        category: this.compatibilityRules.get(ruleName).category,
        priority: this.compatibilityRules.get(ruleName).priority
      });
    }

    return results;
  }

  /**
   * Compile compatibility result
   */
  compileCompatibilityResult(ruleResults, checkId, options) {
    const result = {
      compatible: true,
      confidence: 1.0,
      checkId,
      issues: [],
      ruleResults: {},
      summary: {
        totalRules: ruleResults.size,
        passedRules: 0,
        failedRules: 0,
        skippedRules: 0,
        overallCompatible: true,
        averageConfidence: 0
      },
      recommendations: [],
      timestamp: this.getDeterministicDate().toISOString()
    };

    let confidenceSum = 0;
    let confidenceCount = 0;

    // Process rule results
    for (const [ruleName, ruleResult] of ruleResults) {
      result.ruleResults[ruleName] = ruleResult;

      if (ruleResult.skipped) {
        result.summary.skippedRules++;
      } else if (ruleResult.compatible) {
        result.summary.passedRules++;
      } else {
        result.summary.failedRules++;
        result.compatible = false;
      }

      // Aggregate confidence
      if (!ruleResult.skipped && !isNaN(ruleResult.confidence)) {
        confidenceSum += ruleResult.confidence;
        confidenceCount++;
      }

      // Collect issues
      if (ruleResult.issues?.length > 0) {
        result.issues.push(...ruleResult.issues.map(issue => ({
          ...issue,
          rule: ruleName,
          category: ruleResult.category
        })));
      }
    }

    // Calculate overall confidence
    result.confidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;
    result.summary.averageConfidence = result.confidence;
    result.summary.overallCompatible = result.compatible;

    // Generate recommendations
    result.recommendations = this.generateCompatibilityRecommendations(result);

    return result;
  }

  /**
   * Generate compatibility recommendations
   */
  generateCompatibilityRecommendations(result) {
    const recommendations = [];

    // Critical issues
    const criticalIssues = result.issues.filter(issue => issue.severity === 'error');
    if (criticalIssues.length > 0) {
      recommendations.push({
        type: 'critical',
        title: 'Critical Compatibility Issues',
        description: 'Resolve critical compatibility issues before proceeding',
        actions: criticalIssues.map(issue => `Fix ${issue.type}: ${issue.message}`)
      });
    }

    // Platform differences
    const platformIssues = result.issues.filter(issue => issue.type.includes('platform'));
    if (platformIssues.length > 0) {
      recommendations.push({
        type: 'platform',
        title: 'Platform Compatibility',
        description: 'Consider platform-specific differences',
        actions: [
          'Test on target platform before deployment',
          'Use platform-agnostic path handling',
          'Verify file system case sensitivity requirements'
        ]
      });
    }

    // Node.js version issues
    const nodeIssues = result.issues.filter(issue => issue.type.includes('node'));
    if (nodeIssues.length > 0) {
      recommendations.push({
        type: 'nodejs',
        title: 'Node.js Version Compatibility',
        description: 'Address Node.js version differences',
        actions: [
          'Use same major Node.js version for best compatibility',
          'Test with target Node.js version',
          'Review API compatibility for version differences'
        ]
      });
    }

    // Low confidence warning
    if (result.confidence < 0.70) {
      recommendations.push({
        type: 'confidence',
        title: 'Low Compatibility Confidence',
        description: `Compatibility confidence is ${(result.confidence * 100).toFixed(1)}%`,
        actions: [
          'Perform thorough testing on target environment',
          'Consider creating environment-specific builds',
          'Document known compatibility limitations'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Get compatibility matrix for two environments
   */
  async getCompatibilityMatrix(env1, env2) {
    const matrix = {
      overall: await this.performCompatibilityCheck(env1, env2),
      detailed: {
        platform: this.checkPlatformCompatibility(env1, env2),
        architecture: this.checkArchitectureCompatibility(env1, env2),
        nodeVersion: this.checkNodeVersionCompatibility(env1, env2),
        timezone: env1.timezone === env2.timezone,
        locale: env1.locale === env2.locale
      }
    };

    return matrix;
  }

  /**
   * Generate compatibility report
   */
  async generateCompatibilityReport(environments, options = {}) {
    const report = {
      environments: environments.map((env, index) => ({
        id: `env${index + 1}`,
        name: options.environmentNames?.[index] || `Environment ${index + 1}`,
        hash: env.hash || env.environment?.hash,
        platform: env.platform || env.environment?.runtime?.platform,
        nodeVersion: env.nodeVersion || env.environment?.runtime?.nodeVersion,
        arch: env.arch || env.environment?.runtime?.arch
      })),
      compatibilityMatrix: [],
      summary: {
        totalComparisons: 0,
        compatiblePairs: 0,
        incompatiblePairs: 0,
        averageConfidence: 0
      },
      timestamp: this.getDeterministicDate().toISOString()
    };

    let totalConfidence = 0;
    let comparisonCount = 0;

    // Generate all pairwise comparisons
    for (let i = 0; i < environments.length; i++) {
      for (let j = i + 1; j < environments.length; j++) {
        const env1 = environments[i];
        const env2 = environments[j];

        const compatibility = await this.performCompatibilityCheck(env1, env2, options);

        report.compatibilityMatrix.push({
          env1Id: `env${i + 1}`,
          env2Id: `env${j + 1}`,
          compatible: compatibility.compatible,
          confidence: compatibility.confidence,
          issues: compatibility.issues.length,
          summary: compatibility.ruleResults
        });

        if (compatibility.compatible) {
          report.summary.compatiblePairs++;
        } else {
          report.summary.incompatiblePairs++;
        }

        totalConfidence += compatibility.confidence;
        comparisonCount++;
      }
    }

    report.summary.totalComparisons = comparisonCount;
    report.summary.averageConfidence = comparisonCount > 0 ? 
      totalConfidence / comparisonCount : 0;

    return report;
  }

  /**
   * Cache compatibility result
   */
  cacheCompatibilityResult(env1, env2, result) {
    const cacheKey = this.generateCompatibilityCacheKey(env1, env2);
    
    this.compatibilityCache.set(cacheKey, {
      result,
      timestamp: this.getDeterministicTimestamp()
    });

    // Clean up old entries
    if (this.compatibilityCache.size > 200) {
      const oldest = Array.from(this.compatibilityCache.entries())
        .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0];
      
      if (oldest) {
        this.compatibilityCache.delete(oldest[0]);
      }
    }
  }

  /**
   * Get cached compatibility result
   */
  getCachedCompatibilityResult(env1, env2) {
    const cacheKey = this.generateCompatibilityCacheKey(env1, env2);
    const cached = this.compatibilityCache.get(cacheKey);

    if (cached && (this.getDeterministicTimestamp() - cached.timestamp) < this.options.compatibilityCacheTTL) {
      return cached.result;
    }

    if (cached) {
      this.compatibilityCache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Generate cache key for compatibility result
   */
  generateCompatibilityCacheKey(env1, env2) {
    const hash1 = env1.hash || env1.environment?.hash || 'unknown';
    const hash2 = env2.hash || env2.environment?.hash || 'unknown';
    
    // Ensure consistent ordering
    const [first, second] = [hash1, hash2].sort();
    
    return `${first}:${second}`;
  }

  /**
   * Generate check ID
   */
  generateCheckId() {
    const timestamp = this.getDeterministicTimestamp().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `compat_${timestamp}_${random}`;
  }

  /**
   * Add custom compatibility rule
   */
  addCompatibilityRule(name, rule) {
    if (this.compatibilityRules.has(name)) {
      this.logger.warn(`Overriding existing compatibility rule: ${name}`);
    }

    this.compatibilityRules.set(name, {
      priority: rule.priority || 'medium',
      category: rule.category || 'custom',
      description: rule.description || `Custom compatibility rule: ${name}`,
      check: rule.check
    });

    this.logger.debug(`Added compatibility rule: ${name}`);
  }

  /**
   * Remove compatibility rule
   */
  removeCompatibilityRule(name) {
    if (this.compatibilityRules.delete(name)) {
      this.logger.debug(`Removed compatibility rule: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Clear compatibility cache
   */
  clearCache() {
    const cacheSize = this.compatibilityCache.size;
    this.compatibilityCache.clear();
    
    this.logger.debug(`Cleared compatibility cache (${cacheSize} entries)`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.compatibilityCache.size,
      ttl: this.options.compatibilityCacheTTL,
      enabled: this.options.cacheCompatibilityResults
    };
  }
}

export default CompatibilityChecker;
export { CompatibilityChecker };