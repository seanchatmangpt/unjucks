/**
 * Environment Stamping System for .attest.json
 * 
 * Integrates hermetic environment capture with attestation generation.
 * Ensures all builds include comprehensive environment fingerprints.
 * 
 * Agent 12: Hermetic Runtime Manager - Environment Stamping
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { consola } from 'consola';
import { HermeticEnvironment } from '../runtime/hermetic-environment.js';

class EnvironmentStamper {
  constructor(options = {}) {
    this.options = {
      attestationFile: options.attestationFile || '.attest.json',
      backupAttestation: options.backupAttestation !== false,
      validateOnLoad: options.validateOnLoad !== false,
      strictModeDefault: options.strictModeDefault !== false,
      environmentCacheDir: options.environmentCacheDir || '.kgen/environments',
      ...options
    };

    this.logger = consola.withTag('env-stamper');
    this.hermeticEnv = new HermeticEnvironment({
      strictMode: this.options.strictModeDefault,
      ...options.hermetic
    });

    this.currentAttestation = null;
    this.environmentHistory = new Map();
  }

  /**
   * Initialize environment stamper
   */
  async initialize() {
    try {
      this.logger.info('Initializing environment stamper...');
      
      // Initialize hermetic environment
      await this.hermeticEnv.initialize();
      
      // Load existing attestation if available
      await this.loadExistingAttestation();
      
      // Ensure cache directory exists
      await this.ensureCacheDirectory();
      
      this.logger.success('Environment stamper initialized');
      
      return { success: true };
      
    } catch (error) {
      this.logger.error('Failed to initialize environment stamper:', error);
      throw new Error(`Environment stamper initialization failed: ${error.message}`);
    }
  }

  /**
   * Load existing attestation from file
   */
  async loadExistingAttestation() {
    try {
      const attestationPath = join(process.cwd(), this.options.attestationFile);
      
      if (await this.fileExists(attestationPath)) {
        const content = await fs.readFile(attestationPath, 'utf8');
        this.currentAttestation = JSON.parse(content);
        
        this.logger.debug(`Loaded existing attestation: ${this.currentAttestation?.environment?.shortHash}`);
        
        // Validate loaded attestation if requested
        if (this.options.validateOnLoad) {
          const validation = await this.validateCurrentEnvironmentAgainstAttestation();
          if (!validation.valid) {
            this.logger.warn('Current environment differs from loaded attestation');
            for (const error of validation.errors) {
              this.logger.warn(`  - ${error.message}`);
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Could not load existing attestation: ${error.message}`);
    }
  }

  /**
   * Ensure cache directory exists
   */
  async ensureCacheDirectory() {
    const cacheDir = join(process.cwd(), this.options.environmentCacheDir);
    await fs.mkdir(cacheDir, { recursive: true });
  }

  /**
   * Check if file exists
   */
  async fileExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate comprehensive environment stamp
   */
  async generateEnvironmentStamp(context = {}) {
    this.logger.info('Generating environment stamp...');
    
    try {
      // Capture current environment
      const fingerprint = await this.hermeticEnv.captureEnvironmentFingerprint();
      
      // Generate environment attestation
      const environmentAttestation = this.hermeticEnv.generateEnvironmentAttestation(fingerprint);
      
      // Add build context information
      const stamp = {
        ...environmentAttestation,
        
        // Build context
        buildContext: {
          workingDirectory: process.cwd(),
          command: process.argv.join(' '),
          buildId: context.buildId || this.generateBuildId(),
          buildType: context.buildType || 'development',
          gitCommit: await this.getGitCommit(),
          gitBranch: await this.getGitBranch(),
          gitDirty: await this.isGitDirty(),
          buildStartTime: this.getDeterministicDate().toISOString(),
          processId: process.pid,
          parentProcessId: process.ppid
        },
        
        // Tool configuration
        toolConfiguration: {
          kgenVersion: await this.getKGenVersion(),
          nodeModulesHash: await this.calculateNodeModulesHash(),
          packageLockHash: await this.calculatePackageLockHash(),
          configFiles: await this.captureConfigFiles()
        },
        
        // Performance tracking
        performance: {
          buildStartTime: this.getDeterministicTimestamp(),
          memoryUsageAtStart: process.memoryUsage(),
          cpuUsageAtStart: process.cpuUsage()
        },
        
        // Additional context
        userContext: context.userContext || {},
        tags: context.tags || [],
        notes: context.notes || ''
      };
      
      // Calculate comprehensive stamp hash
      stamp.stampHash = this.calculateStampHash(stamp);
      stamp.stampShortHash = stamp.stampHash.substring(0, 12);
      
      // Store in environment history
      this.environmentHistory.set(stamp.stampHash, stamp);
      
      this.logger.success(`Environment stamp generated: ${stamp.stampShortHash}`);
      
      return stamp;
      
    } catch (error) {
      this.logger.error('Failed to generate environment stamp:', error);
      throw new Error(`Environment stamp generation failed: ${error.message}`);
    }
  }

  /**
   * Generate unique build ID
   */
  generateBuildId() {
    const timestamp = this.getDeterministicTimestamp().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  /**
   * Get Git commit hash
   */
  async getGitCommit() {
    try {
      const { execSync } = await import('child_process');
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  }

  /**
   * Get Git branch name
   */
  async getGitBranch() {
    try {
      const { execSync } = await import('child_process');
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  }

  /**
   * Check if Git working directory is dirty
   */
  async isGitDirty() {
    try {
      const { execSync } = await import('child_process');
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      return status.trim().length > 0;
    } catch {
      return null;
    }
  }

  /**
   * Get KGEN version
   */
  async getKGenVersion() {
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      return packageJson.version || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Calculate node_modules hash for dependency tracking
   */
  async calculateNodeModulesHash() {
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      
      const dependencies = {
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {}
      };
      
      const hasher = createHash('sha256');
      hasher.update(JSON.stringify(dependencies, null, 0));
      return hasher.digest('hex');
    } catch {
      return null;
    }
  }

  /**
   * Calculate package-lock.json hash
   */
  async calculatePackageLockHash() {
    try {
      const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
      
      for (const lockFile of lockFiles) {
        const lockPath = join(process.cwd(), lockFile);
        if (await this.fileExists(lockPath)) {
          const content = await fs.readFile(lockPath, 'utf8');
          const hasher = createHash('sha256');
          hasher.update(content);
          return {
            file: lockFile,
            hash: hasher.digest('hex')
          };
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Capture relevant configuration files
   */
  async captureConfigFiles() {
    const configFiles = {};
    const relevantFiles = [
      '.kgenrc',
      '.kgen.config.js',
      '.kgen.config.ts',
      'kgen.config.js',
      'kgen.config.ts',
      'tsconfig.json',
      '.eslintrc.json',
      '.prettierrc'
    ];

    for (const file of relevantFiles) {
      try {
        const filePath = join(process.cwd(), file);
        if (await this.fileExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf8');
          const hasher = createHash('sha256');
          hasher.update(content);
          
          configFiles[file] = {
            hash: hasher.digest('hex'),
            size: content.length,
            lastModified: (await fs.stat(filePath)).mtime.toISOString()
          };
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return configFiles;
  }

  /**
   * Calculate comprehensive stamp hash
   */
  calculateStampHash(stamp) {
    const hasher = createHash('sha256');
    
    // Hash environment fingerprint
    hasher.update(stamp.environment.hash);
    
    // Hash build context (excluding timestamps and PIDs)
    const buildContext = {
      workingDirectory: stamp.buildContext.workingDirectory,
      command: stamp.buildContext.command,
      buildType: stamp.buildContext.buildType,
      gitCommit: stamp.buildContext.gitCommit,
      gitBranch: stamp.buildContext.gitBranch,
      gitDirty: stamp.buildContext.gitDirty
    };
    hasher.update(JSON.stringify(buildContext, null, 0));
    
    // Hash tool configuration
    hasher.update(JSON.stringify(stamp.toolConfiguration, null, 0));
    
    // Hash user context and tags
    hasher.update(JSON.stringify({
      userContext: stamp.userContext,
      tags: stamp.tags.sort(), // Sort tags for consistency
      notes: stamp.notes
    }, null, 0));
    
    return hasher.digest('hex');
  }

  /**
   * Update existing attestation with environment stamp
   */
  async updateAttestationWithStamp(attestation, environmentStamp) {
    // Merge environment attestation into main attestation
    const updatedAttestation = {
      ...attestation,
      
      // Update metadata
      metadata: {
        ...attestation.metadata,
        lastUpdated: this.getDeterministicDate().toISOString(),
        environmentHash: environmentStamp.environment.hash,
        buildId: environmentStamp.buildContext.buildId
      },
      
      // Add or update environment section
      environment: environmentStamp.environment,
      buildContext: environmentStamp.buildContext,
      toolConfiguration: environmentStamp.toolConfiguration,
      
      // Add reproducibility information
      reproducibility: {
        hermeticBuild: true,
        environmentCaptured: true,
        deterministic: environmentStamp.requirements.strictMode,
        crossPlatformCompatible: environmentStamp.compatibility.crossPlatform,
        requirements: environmentStamp.requirements,
        compatibility: environmentStamp.compatibility
      }
    };

    return updatedAttestation;
  }

  /**
   * Stamp existing attestation file
   */
  async stampAttestationFile(attestationPath = null, context = {}) {
    if (!attestationPath) {
      attestationPath = join(process.cwd(), this.options.attestationFile);
    }

    this.logger.info(`Stamping attestation file: ${attestationPath}`);

    try {
      // Generate environment stamp
      const environmentStamp = await this.generateEnvironmentStamp(context);

      // Load existing attestation or create new one
      let attestation = {};
      if (await this.fileExists(attestationPath)) {
        const content = await fs.readFile(attestationPath, 'utf8');
        attestation = JSON.parse(content);
        
        // Backup existing attestation if requested
        if (this.options.backupAttestation) {
          await this.backupAttestation(attestationPath, attestation);
        }
      }

      // Update attestation with environment stamp
      const stampedAttestation = await this.updateAttestationWithStamp(attestation, environmentStamp);

      // Write updated attestation
      await fs.writeFile(attestationPath, JSON.stringify(stampedAttestation, null, 2));

      // Cache environment stamp
      await this.cacheEnvironmentStamp(environmentStamp);

      this.currentAttestation = stampedAttestation;

      this.logger.success('Attestation file stamped with environment');
      this.logger.info(`Environment hash: ${environmentStamp.environment.shortHash}`);
      this.logger.info(`Build ID: ${environmentStamp.buildContext.buildId}`);

      return {
        success: true,
        attestationPath,
        environmentHash: environmentStamp.environment.hash,
        buildId: environmentStamp.buildContext.buildId,
        stamp: environmentStamp
      };

    } catch (error) {
      this.logger.error('Failed to stamp attestation file:', error);
      throw new Error(`Attestation stamping failed: ${error.message}`);
    }
  }

  /**
   * Backup existing attestation
   */
  async backupAttestation(attestationPath, attestation) {
    try {
      const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
      const backupPath = attestationPath.replace(/\.json$/, `-backup-${timestamp}.json`);
      
      await fs.writeFile(backupPath, JSON.stringify(attestation, null, 2));
      this.logger.debug(`Attestation backed up to: ${backupPath}`);
    } catch (error) {
      this.logger.warn('Failed to backup attestation:', error.message);
    }
  }

  /**
   * Cache environment stamp for future reference
   */
  async cacheEnvironmentStamp(stamp) {
    try {
      const cacheDir = join(process.cwd(), this.options.environmentCacheDir);
      const cachePath = join(cacheDir, `${stamp.stampShortHash}.json`);
      
      await fs.writeFile(cachePath, JSON.stringify(stamp, null, 2));
      
      // Also create a symlink to latest
      const latestPath = join(cacheDir, 'latest.json');
      try {
        await fs.unlink(latestPath);
      } catch {
        // Ignore if doesn't exist
      }
      
      await fs.symlink(`${stamp.stampShortHash}.json`, latestPath);
      
      this.logger.debug(`Environment stamp cached: ${cachePath}`);
    } catch (error) {
      this.logger.warn('Failed to cache environment stamp:', error.message);
    }
  }

  /**
   * Validate current environment against attestation
   */
  async validateCurrentEnvironmentAgainstAttestation(attestation = null) {
    if (!attestation && this.currentAttestation) {
      attestation = this.currentAttestation;
    }

    if (!attestation || !attestation.environment) {
      return {
        valid: false,
        error: 'No environment attestation available for validation'
      };
    }

    try {
      return await this.hermeticEnv.validateAgainstAttestation(attestation);
    } catch (error) {
      return {
        valid: false,
        error: `Validation failed: ${error.message}`
      };
    }
  }

  /**
   * Compare two environment stamps
   */
  compareEnvironmentStamps(stamp1, stamp2) {
    const comparison = {
      identical: stamp1.stampHash === stamp2.stampHash,
      environmentMatch: stamp1.environment.hash === stamp2.environment.hash,
      buildContextMatch: stamp1.buildContext.buildId === stamp2.buildContext.buildId,
      toolConfigMatch: JSON.stringify(stamp1.toolConfiguration) === JSON.stringify(stamp2.toolConfiguration),
      
      differences: {
        environment: [],
        buildContext: [],
        toolConfiguration: []
      }
    };

    // Find environment differences
    if (!comparison.environmentMatch) {
      const env1 = stamp1.environment.runtime;
      const env2 = stamp2.environment.runtime;
      
      for (const key of ['nodeVersion', 'platform', 'arch']) {
        if (env1[key] !== env2[key]) {
          comparison.differences.environment.push({
            component: key,
            stamp1: env1[key],
            stamp2: env2[key]
          });
        }
      }
    }

    // Find build context differences
    if (!comparison.buildContextMatch) {
      const build1 = stamp1.buildContext;
      const build2 = stamp2.buildContext;
      
      for (const key of ['gitCommit', 'gitBranch', 'gitDirty', 'buildType']) {
        if (build1[key] !== build2[key]) {
          comparison.differences.buildContext.push({
            component: key,
            stamp1: build1[key],
            stamp2: build2[key]
          });
        }
      }
    }

    return comparison;
  }

  /**
   * Get environment stamp history
   */
  getEnvironmentHistory() {
    return Array.from(this.environmentHistory.values()).map(stamp => ({
      hash: stamp.stampHash,
      shortHash: stamp.stampShortHash,
      buildId: stamp.buildContext.buildId,
      buildTime: stamp.buildContext.buildStartTime,
      environmentHash: stamp.environment.hash,
      gitCommit: stamp.buildContext.gitCommit,
      gitBranch: stamp.buildContext.gitBranch,
      buildType: stamp.buildContext.buildType
    }));
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    this.logger.debug('Shutting down environment stamper');
    
    // Shutdown hermetic environment
    await this.hermeticEnv.shutdown();
    
    // Clear caches
    this.environmentHistory.clear();
    this.currentAttestation = null;
  }
}

export default EnvironmentStamper;
export { EnvironmentStamper };