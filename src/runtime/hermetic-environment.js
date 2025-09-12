/**
 * Hermetic Runtime Environment Manager
 * 
 * Implements comprehensive environment capture, validation, and deterministic execution.
 * Ensures "works on my machine" becomes "works everywhere" through hermetic builds.
 * 
 * Agent 12: Hermetic Runtime Manager - Dark-Matter Integration
 */

import { createHash } from 'crypto';
import { promises as fs, constants } from 'fs';
import { resolve, join, dirname } from 'path';
import { platform, arch, cpus, freemem, totalmem, homedir, tmpdir, userInfo } from 'os';
import { performance } from 'perf_hooks';
import { consola } from 'consola';
import { execSync } from 'child_process';

class HermeticEnvironment {
  constructor(options = {}) {
    this.options = {
      strictMode: options.strictMode !== false,
      enforceNodeVersion: options.enforceNodeVersion !== false,
      enforceTimezone: options.enforceTimezone !== false,
      enforceLocale: options.enforceLocale !== false,
      cacheTTL: options.cacheTTL || 3600000, // 1 hour
      allowedVariance: options.allowedVariance || 0.001, // 0.1% variance
      ...options
    };

    this.logger = consola.withTag('hermetic-env');
    this.environmentCache = new Map();
    this.attestationCache = new Map();
    this.runtimeValidators = new Map();
    
    // Environment fingerprint components
    this.criticalComponents = [
      'nodeVersion', 'platform', 'arch', 'timezone', 'locale',
      'workingDirectory', 'homeDirectory', 'tempDirectory'
    ];
    
    this.systemComponents = [
      'cpuCount', 'totalMemory', 'osRelease', 'kernelVersion'
    ];
    
    this.runtimeComponents = [
      'userInfo', 'environmentVariables', 'pathSeparator', 'endOfLine'
    ];

    this.currentFingerprint = null;
    this.baselineFingerprint = null;
    this.isInitialized = false;
  }

  /**
   * Initialize hermetic environment management
   */
  async initialize() {
    if (this.isInitialized) {
      return { success: true, cached: true };
    }

    try {
      this.logger.info('Initializing hermetic environment management...');
      
      // Capture current environment fingerprint
      this.currentFingerprint = await this.captureEnvironmentFingerprint();
      
      // Setup runtime validators
      this.setupRuntimeValidators();
      
      // Initialize deterministic runtime
      await this.initializeDeterministicRuntime();
      
      this.isInitialized = true;
      
      this.logger.success('Hermetic environment initialized');
      this.logger.info(`Environment hash: ${this.currentFingerprint.hash}`);
      
      return {
        success: true,
        fingerprint: this.currentFingerprint,
        timestamp: this.getDeterministicDate().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize hermetic environment:', error);
      throw new Error(`Hermetic environment initialization failed: ${error.message}`);
    }
  }

  /**
   * Capture comprehensive environment fingerprint
   */
  async captureEnvironmentFingerprint() {
    const startTime = performance.now();
    
    const fingerprint = {
      // Critical runtime components
      nodeVersion: process.version,
      platform: platform(),
      arch: arch(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
      
      // Directory paths (normalized)
      workingDirectory: process.cwd(),
      homeDirectory: homedir(),
      tempDirectory: tmpdir(),
      
      // System characteristics
      cpuCount: cpus().length,
      totalMemory: totalmem(),
      freeMemory: freemem(), // This will vary, not used in hash
      
      // OS details
      osRelease: await this.getOSRelease(),
      kernelVersion: await this.getKernelVersion(),
      
      // User context
      userInfo: this.sanitizeUserInfo(userInfo()),
      
      // Environment variables (filtered)
      environmentVariables: this.captureRelevantEnvVars(),
      
      // Runtime characteristics
      pathSeparator: process.platform === 'win32' ? '\\' : '/',
      endOfLine: process.platform === 'win32' ? '\r\n' : '\n',
      
      // Node.js specific
      nodeFlags: process.execArgv,
      maxOldSpaceSize: this.getV8MaxOldSpaceSize(),
      
      // Timestamps
      captureTime: this.getDeterministicDate().toISOString(),
      captureTimestamp: this.getDeterministicTimestamp(),
      buildTime: process.env.SOURCE_DATE_EPOCH ? 
        new Date(parseInt(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString() : 
        null,
      
      // Performance metrics
      capturePerformance: {
        duration: 0, // Will be set below
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      }
    };
    
    // Calculate capture performance
    fingerprint.capturePerformance.duration = performance.now() - startTime;
    
    // Generate deterministic hash (excluding variable components)
    fingerprint.hash = this.calculateEnvironmentHash(fingerprint);
    fingerprint.shortHash = fingerprint.hash.substring(0, 12);
    
    return fingerprint;
  }

  /**
   * Calculate deterministic hash from environment fingerprint
   */
  calculateEnvironmentHash(fingerprint) {
    const hasher = createHash('sha256');
    
    // Hash critical components in deterministic order
    const criticalData = {};
    for (const component of this.criticalComponents) {
      if (fingerprint[component] !== undefined) {
        criticalData[component] = fingerprint[component];
      }
    }
    
    // Hash system components
    const systemData = {};
    for (const component of this.systemComponents) {
      if (fingerprint[component] !== undefined) {
        systemData[component] = fingerprint[component];
      }
    }
    
    // Hash runtime components (excluding user-specific data)
    const runtimeData = {
      pathSeparator: fingerprint.pathSeparator,
      endOfLine: fingerprint.endOfLine,
      nodeFlags: fingerprint.nodeFlags?.sort() || [], // Sort for consistency
      maxOldSpaceSize: fingerprint.maxOldSpaceSize,
      relevantEnvVars: this.normalizeEnvVars(fingerprint.environmentVariables)
    };
    
    // Create deterministic hash input
    const hashInput = JSON.stringify({
      critical: criticalData,
      system: systemData,
      runtime: runtimeData
    }, null, 0); // No formatting for consistency
    
    hasher.update(hashInput);
    return hasher.digest('hex');
  }

  /**
   * Capture relevant environment variables (filtered for security)
   */
  captureRelevantEnvVars() {
    const relevantVars = [
      // Build-time variables
      'NODE_ENV', 'BUILD_ENV', 'SOURCE_DATE_EPOCH',
      
      // Locale and timezone
      'TZ', 'LANG', 'LC_ALL', 'LC_TIME', 'LC_NUMERIC',
      
      // Node.js specific
      'NODE_OPTIONS', 'NODE_PATH', 'NODE_ENV',
      
      // Tool-specific
      'KGEN_*', 'NPM_CONFIG_*',
      
      // Path (normalized)
      'PATH'
    ];
    
    const captured = {};
    
    for (const [key, value] of Object.entries(process.env)) {
      // Check exact matches
      if (relevantVars.includes(key)) {
        captured[key] = value;
        continue;
      }
      
      // Check pattern matches
      for (const pattern of relevantVars) {
        if (pattern.includes('*')) {
          const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
          if (regex.test(key)) {
            captured[key] = value;
            break;
          }
        }
      }
    }
    
    // Normalize PATH for cross-platform consistency
    if (captured.PATH) {
      captured.PATH_NORMALIZED = this.normalizePath(captured.PATH);
    }
    
    return captured;
  }

  /**
   * Normalize environment variables for cross-platform consistency
   */
  normalizeEnvVars(envVars) {
    const normalized = { ...envVars };
    
    // Sort environment variable keys for consistency
    const sortedKeys = Object.keys(normalized).sort();
    const sortedEnvVars = {};
    
    for (const key of sortedKeys) {
      sortedEnvVars[key] = normalized[key];
    }
    
    return sortedEnvVars;
  }

  /**
   * Normalize PATH variable for cross-platform consistency
   */
  normalizePath(pathVar) {
    const delimiter = process.platform === 'win32' ? ';' : ':';
    const paths = pathVar.split(delimiter);
    
    return paths
      .map(p => p.replace(/[\\\/]+/g, '/')) // Normalize separators
      .filter(p => p.length > 0) // Remove empty paths
      .sort() // Sort for consistency
      .join(':'); // Use Unix-style delimiter
  }

  /**
   * Sanitize user info for reproducibility
   */
  sanitizeUserInfo(userInfo) {
    return {
      uid: userInfo.uid,
      gid: userInfo.gid,
      // Remove username and other identifying info for reproducibility
      shell: userInfo.shell?.replace(/.*[\\\/]/, '') || null // Just shell name
    };
  }

  /**
   * Get OS release information
   */
  async getOSRelease() {
    try {
      if (platform() === 'linux') {
        const release = await fs.readFile('/etc/os-release', 'utf8');
        const lines = release.split('\n');
        const info = {};
        
        for (const line of lines) {
          const [key, value] = line.split('=');
          if (key && value) {
            info[key] = value.replace(/"/g, '');
          }
        }
        
        return {
          name: info.NAME || 'Unknown',
          version: info.VERSION_ID || 'Unknown'
        };
      } else if (platform() === 'darwin') {
        const version = execSync('sw_vers -productVersion', { encoding: 'utf8' }).trim();
        return {
          name: 'macOS',
          version: version
        };
      } else if (platform() === 'win32') {
        const version = execSync('ver', { encoding: 'utf8' }).trim();
        return {
          name: 'Windows',
          version: version
        };
      }
      
      return { name: platform(), version: 'Unknown' };
    } catch (error) {
      return { name: platform(), version: 'Unknown' };
    }
  }

  /**
   * Get kernel version
   */
  async getKernelVersion() {
    try {
      if (platform() === 'linux' || platform() === 'darwin') {
        return execSync('uname -r', { encoding: 'utf8' }).trim();
      } else if (platform() === 'win32') {
        return execSync('ver', { encoding: 'utf8' }).trim();
      }
      
      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Get V8 max old space size
   */
  getV8MaxOldSpaceSize() {
    try {
      const v8 = require('v8');
      const heapStats = v8.getHeapStatistics();
      return heapStats.heap_size_limit;
    } catch (error) {
      return null;
    }
  }

  /**
   * Setup runtime validators
   */
  setupRuntimeValidators() {
    // Node.js version validator
    this.runtimeValidators.set('nodeVersion', (baseline, current) => {
      if (baseline.nodeVersion !== current.nodeVersion) {
        return {
          valid: false,
          severity: 'error',
          message: `Node.js version mismatch: baseline=${baseline.nodeVersion}, current=${current.nodeVersion}`,
          recommendation: 'Use the same Node.js version as the baseline environment'
        };
      }
      return { valid: true };
    });
    
    // Platform validator
    this.runtimeValidators.set('platform', (baseline, current) => {
      if (baseline.platform !== current.platform) {
        return {
          valid: false,
          severity: 'warning',
          message: `Platform mismatch: baseline=${baseline.platform}, current=${current.platform}`,
          recommendation: 'Cross-platform builds may have different outputs'
        };
      }
      return { valid: true };
    });
    
    // Architecture validator
    this.runtimeValidators.set('arch', (baseline, current) => {
      if (baseline.arch !== current.arch) {
        return {
          valid: false,
          severity: 'warning',
          message: `Architecture mismatch: baseline=${baseline.arch}, current=${current.arch}`,
          recommendation: 'Different architectures may produce different results'
        };
      }
      return { valid: true };
    });
    
    // Timezone validator
    this.runtimeValidators.set('timezone', (baseline, current) => {
      if (this.options.enforceTimezone && baseline.timezone !== current.timezone) {
        return {
          valid: false,
          severity: 'error',
          message: `Timezone mismatch: baseline=${baseline.timezone}, current=${current.timezone}`,
          recommendation: 'Set TZ environment variable or use UTC for reproducible builds'
        };
      }
      return { valid: true };
    });
    
    // Locale validator
    this.runtimeValidators.set('locale', (baseline, current) => {
      if (this.options.enforceLocale && baseline.locale !== current.locale) {
        return {
          valid: false,
          severity: 'error',
          message: `Locale mismatch: baseline=${baseline.locale}, current=${current.locale}`,
          recommendation: 'Set LANG/LC_ALL environment variables for consistent locale'
        };
      }
      return { valid: true };
    });
    
    // Environment variables validator
    this.runtimeValidators.set('environmentVariables', (baseline, current) => {
      const baselineVars = baseline.environmentVariables || {};
      const currentVars = current.environmentVariables || {};
      
      const missingVars = [];
      const changedVars = [];
      
      for (const [key, baselineValue] of Object.entries(baselineVars)) {
        if (!(key in currentVars)) {
          missingVars.push(key);
        } else if (currentVars[key] !== baselineValue) {
          changedVars.push({ key, baseline: baselineValue, current: currentVars[key] });
        }
      }
      
      if (missingVars.length > 0 || changedVars.length > 0) {
        return {
          valid: false,
          severity: 'warning',
          message: `Environment variable differences detected`,
          details: { missingVars, changedVars },
          recommendation: 'Ensure consistent environment variables for reproducible builds'
        };
      }
      
      return { valid: true };
    });
  }

  /**
   * Initialize deterministic runtime environment
   */
  async initializeDeterministicRuntime() {
    // Set up deterministic random seed if not already set
    if (!process.env.KGEN_RANDOM_SEED) {
      process.env.KGEN_RANDOM_SEED = '12345';
    }
    
    // Set up deterministic build time if not already set
    if (!process.env.SOURCE_DATE_EPOCH && !process.env.KGEN_BUILD_TIME) {
      process.env.KGEN_BUILD_TIME = '2024-01-01T00:00:00.000Z';
    }
    
    // Override Math.random for deterministic behavior if strict mode
    if (this.options.strictMode && !global.__KGEN_DETERMINISTIC_RANDOM__) {
      this.setupDeterministicRandom();
    }
    
    // Override Date.now and this.getDeterministicDate() for deterministic timestamps if strict mode
    if (this.options.strictMode && !global.__KGEN_DETERMINISTIC_TIME__) {
      this.setupDeterministicTime();
    }
  }

  /**
   * Setup deterministic random number generation
   */
  setupDeterministicRandom() {
    const seed = parseInt(process.env.KGEN_RANDOM_SEED) || 12345;
    let state = seed;
    
    // Simple Linear Congruential Generator
    const deterministicRandom = () => {
      state = (state * 1664525 + 1013904223) % Math.pow(2, 32);
      return state / Math.pow(2, 32);
    };
    
    // Override Math.random
    const originalRandom = Math.random;
    Math.random = deterministicRandom;
    
    // Mark as overridden
    global.__KGEN_DETERMINISTIC_RANDOM__ = {
      seed,
      restore: () => {
        Math.random = originalRandom;
        delete global.__KGEN_DETERMINISTIC_RANDOM__;
      }
    };
    
    this.logger.debug(`Deterministic random initialized with seed: ${seed}`);
  }

  /**
   * Setup deterministic time for reproducible builds
   */
  setupDeterministicTime() {
    const buildTime = process.env.SOURCE_DATE_EPOCH ? 
      parseInt(process.env.SOURCE_DATE_EPOCH) * 1000 : 
      new Date(process.env.KGEN_BUILD_TIME || '2024-01-01T00:00:00.000Z').getTime();
    
    // Override Date.now
    const originalNow = Date.now;
    Date.now = () => buildTime;
    
    // Override this.getDeterministicDate() when called without arguments
    const originalDate = Date;
    global.Date = function(...args) {
      if (args.length === 0) {
        return new originalDate(buildTime);
      }
      return new originalDate(...args);
    };
    
    // Copy static methods
    Object.setPrototypeOf(global.Date, originalDate);
    Object.getOwnPropertyNames(originalDate).forEach(name => {
      if (name !== 'length' && name !== 'name' && name !== 'prototype') {
        global.Date[name] = originalDate[name];
      }
    });
    
    // Override Date.now on the new Date constructor
    global.Date.now = () => buildTime;
    
    // Mark as overridden
    global.__KGEN_DETERMINISTIC_TIME__ = {
      buildTime,
      restore: () => {
        Date.now = originalNow;
        global.Date = originalDate;
        delete global.__KGEN_DETERMINISTIC_TIME__;
      }
    };
    
    this.logger.debug(`Deterministic time initialized: ${new Date(buildTime).toISOString()}`);
  }

  /**
   * Validate environment against baseline
   */
  async validateEnvironment(baselineFingerprint, currentFingerprint = null) {
    if (!currentFingerprint) {
      currentFingerprint = await this.captureEnvironmentFingerprint();
    }
    
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      info: [],
      baseline: baselineFingerprint,
      current: currentFingerprint,
      hashMatch: baselineFingerprint.hash === currentFingerprint.hash
    };
    
    // Run all validators
    for (const [component, validator] of this.runtimeValidators) {
      try {
        const result = validator(baselineFingerprint, currentFingerprint);
        
        if (!result.valid) {
          const issue = {
            component,
            severity: result.severity,
            message: result.message,
            recommendation: result.recommendation,
            details: result.details
          };
          
          if (result.severity === 'error') {
            validation.errors.push(issue);
            validation.valid = false;
          } else if (result.severity === 'warning') {
            validation.warnings.push(issue);
          } else {
            validation.info.push(issue);
          }
        }
      } catch (error) {
        validation.errors.push({
          component,
          severity: 'error',
          message: `Validator error: ${error.message}`,
          recommendation: 'Check validator implementation'
        });
        validation.valid = false;
      }
    }
    
    return validation;
  }

  /**
   * Create hermetic execution wrapper
   */
  createHermeticWrapper(operation, options = {}) {
    const wrapper = {
      fingerprint: this.currentFingerprint,
      options,
      
      async execute() {
        const startTime = performance.now();
        
        try {
          // Validate environment before execution
          if (options.validateEnvironment !== false) {
            const validation = await this.validateEnvironment(wrapper.fingerprint);
            if (!validation.valid) {
              throw new Error(`Environment validation failed: ${validation.errors.map(e => e.message).join('; ')}`);
            }
          }
          
          // Execute operation in hermetic context
          const result = await operation();
          
          const executionTime = performance.now() - startTime;
          
          return {
            success: true,
            result,
            executionTime,
            environment: wrapper.fingerprint,
            timestamp: this.getDeterministicDate().toISOString()
          };
          
        } catch (error) {
          const executionTime = performance.now() - startTime;
          
          return {
            success: false,
            error: error.message,
            executionTime,
            environment: wrapper.fingerprint,
            timestamp: this.getDeterministicDate().toISOString()
          };
        }
      }.bind(this)
    };
    
    return wrapper;
  }

  /**
   * Generate environment attestation for .attest.json
   */
  generateEnvironmentAttestation(fingerprint = null) {
    if (!fingerprint) {
      fingerprint = this.currentFingerprint;
    }
    
    if (!fingerprint) {
      throw new Error('No environment fingerprint available. Call initialize() first.');
    }
    
    const attestation = {
      version: '1.0',
      type: 'environment-attestation',
      
      // Environment identification
      environment: {
        hash: fingerprint.hash,
        shortHash: fingerprint.shortHash,
        captureTime: fingerprint.captureTime,
        
        // Critical components for reproducibility
        runtime: {
          nodeVersion: fingerprint.nodeVersion,
          platform: fingerprint.platform,
          arch: fingerprint.arch
        },
        
        // Locale and timezone
        locale: {
          timezone: fingerprint.timezone,
          locale: fingerprint.locale,
          language: fingerprint.environmentVariables?.LANG || 'en-US'
        },
        
        // Build-time environment
        build: {
          buildTime: fingerprint.buildTime,
          sourceEpoch: fingerprint.environmentVariables?.SOURCE_DATE_EPOCH,
          randomSeed: fingerprint.environmentVariables?.KGEN_RANDOM_SEED || '12345'
        },
        
        // System characteristics
        system: {
          osRelease: fingerprint.osRelease,
          kernelVersion: fingerprint.kernelVersion,
          cpuCount: fingerprint.cpuCount,
          totalMemory: fingerprint.totalMemory
        },
        
        // Tool configuration
        tooling: {
          nodeFlags: fingerprint.nodeFlags,
          maxOldSpaceSize: fingerprint.maxOldSpaceSize,
          pathSeparator: fingerprint.pathSeparator,
          endOfLine: fingerprint.endOfLine
        }
      },
      
      // Reproducibility requirements
      requirements: {
        strictMode: this.options.strictMode,
        enforceNodeVersion: this.options.enforceNodeVersion,
        enforceTimezone: this.options.enforceTimezone,
        enforceLocale: this.options.enforceLocale
      },
      
      // Compatibility information
      compatibility: {
        crossPlatform: false, // Conservative default
        crossArchitecture: false,
        crossNodeVersion: false,
        notes: 'Hermetic build - exact environment match required for reproducibility'
      },
      
      // Metadata
      metadata: {
        generator: 'kgen-hermetic-environment',
        version: '1.0.0',
        timestamp: this.getDeterministicDate().toISOString()
      }
    };
    
    return attestation;
  }

  /**
   * Validate environment against attestation
   */
  async validateAgainstAttestation(attestation, currentFingerprint = null) {
    if (!currentFingerprint) {
      currentFingerprint = await this.captureEnvironmentFingerprint();
    }
    
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      attestation,
      current: currentFingerprint,
      exactMatch: attestation.environment.hash === currentFingerprint.hash
    };
    
    // Check critical runtime components
    if (attestation.requirements.enforceNodeVersion && 
        attestation.environment.runtime.nodeVersion !== currentFingerprint.nodeVersion) {
      validation.errors.push({
        type: 'node-version-mismatch',
        expected: attestation.environment.runtime.nodeVersion,
        actual: currentFingerprint.nodeVersion,
        message: 'Node.js version does not match attestation requirement'
      });
      validation.valid = false;
    }
    
    // Check platform compatibility
    if (attestation.environment.runtime.platform !== currentFingerprint.platform) {
      const message = `Platform mismatch: expected ${attestation.environment.runtime.platform}, got ${currentFingerprint.platform}`;
      
      if (attestation.compatibility.crossPlatform) {
        validation.warnings.push({
          type: 'platform-mismatch',
          message,
          note: 'Cross-platform compatibility enabled in attestation'
        });
      } else {
        validation.errors.push({
          type: 'platform-mismatch',
          expected: attestation.environment.runtime.platform,
          actual: currentFingerprint.platform,
          message
        });
        validation.valid = false;
      }
    }
    
    // Check timezone if enforced
    if (attestation.requirements.enforceTimezone &&
        attestation.environment.locale.timezone !== currentFingerprint.timezone) {
      validation.errors.push({
        type: 'timezone-mismatch',
        expected: attestation.environment.locale.timezone,
        actual: currentFingerprint.timezone,
        message: 'Timezone does not match attestation requirement',
        fix: `Set TZ environment variable to ${attestation.environment.locale.timezone}`
      });
      validation.valid = false;
    }
    
    // Check locale if enforced
    if (attestation.requirements.enforceLocale &&
        attestation.environment.locale.locale !== currentFingerprint.locale) {
      validation.errors.push({
        type: 'locale-mismatch',
        expected: attestation.environment.locale.locale,
        actual: currentFingerprint.locale,
        message: 'Locale does not match attestation requirement',
        fix: `Set LANG environment variable to ${attestation.environment.locale.language}`
      });
      validation.valid = false;
    }
    
    return validation;
  }

  /**
   * Get environment compatibility matrix
   */
  getCompatibilityMatrix(fingerprint1, fingerprint2) {
    return {
      identical: fingerprint1.hash === fingerprint2.hash,
      crossPlatform: fingerprint1.platform !== fingerprint2.platform,
      crossArchitecture: fingerprint1.arch !== fingerprint2.arch,
      crossNodeVersion: fingerprint1.nodeVersion !== fingerprint2.nodeVersion,
      crossTimezone: fingerprint1.timezone !== fingerprint2.timezone,
      crossLocale: fingerprint1.locale !== fingerprint2.locale,
      
      compatibility: {
        high: fingerprint1.hash === fingerprint2.hash,
        medium: (
          fingerprint1.nodeVersion === fingerprint2.nodeVersion &&
          fingerprint1.timezone === fingerprint2.timezone &&
          fingerprint1.locale === fingerprint2.locale
        ),
        low: (
          fingerprint1.platform === fingerprint2.platform ||
          fingerprint1.arch === fingerprint2.arch
        )
      }
    };
  }

  /**
   * Restore original runtime environment
   */
  restoreOriginalRuntime() {
    // Restore random
    if (global.__KGEN_DETERMINISTIC_RANDOM__) {
      global.__KGEN_DETERMINISTIC_RANDOM__.restore();
      this.logger.debug('Restored original Math.random');
    }
    
    // Restore time
    if (global.__KGEN_DETERMINISTIC_TIME__) {
      global.__KGEN_DETERMINISTIC_TIME__.restore();
      this.logger.debug('Restored original Date implementation');
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    this.logger.debug('Shutting down hermetic environment');
    
    // Restore original runtime
    this.restoreOriginalRuntime();
    
    // Clear caches
    this.environmentCache.clear();
    this.attestationCache.clear();
    this.runtimeValidators.clear();
    
    this.isInitialized = false;
    this.currentFingerprint = null;
    this.baselineFingerprint = null;
  }
}

export default HermeticEnvironment;
export { HermeticEnvironment };