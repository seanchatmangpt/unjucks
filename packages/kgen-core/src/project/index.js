/**
 * Project Module - Reproducible builds and attestation packages
 * 
 * Provides the main interface for:
 * - `kgen project lock` - Generate deterministic lockfiles
 * - `kgen project attest` - Create attestation bundles  
 * - `kgen project verify` - Verify reproducibility
 * - `kgen project version` - Manage component versions
 * 
 * Ensures reproducible builds and complete audit packages for enterprise compliance.
 */

import consola from 'consola';
import { LockfileGenerator } from './lockfile-generator.js';
import { AttestationBundler } from './attestation-bundler.js';
import { VersionManager } from './version-manager.js';
import { ReproducibilityVerifier } from './reproducibility-verifier.js';

export class ProjectManager {
  constructor(config = {}) {
    this.config = {
      // Core settings
      projectRoot: config.projectRoot || process.cwd(),
      lockfileName: config.lockfileName || 'kgen.lock.json',
      attestationDir: config.attestationDir || './attestations',
      verificationDir: config.verificationDir || './verification',
      
      // Component settings
      lockfileConfig: config.lockfileConfig || {},
      bundlerConfig: config.bundlerConfig || {},
      versionConfig: config.versionConfig || {},
      verifierConfig: config.verifierConfig || {},
      
      ...config
    };

    this.logger = consola.withTag('project-manager');
    
    // Initialize components
    this.lockfileGenerator = new LockfileGenerator(this.config.lockfileConfig);
    this.attestationBundler = new AttestationBundler(this.config.bundlerConfig);
    this.versionManager = new VersionManager(this.config.versionConfig);
    this.reproducibilityVerifier = new ReproducibilityVerifier(this.config.verifierConfig);
    
    this.initialized = false;
  }

  /**
   * Initialize project manager and all components
   */
  async initialize() {
    try {
      this.logger.info('Initializing project manager...');
      
      // Initialize version manager first (others may depend on it)
      await this.versionManager.initialize();
      
      this.initialized = true;
      this.logger.success('Project manager initialized successfully');
      
      return {
        status: 'success',
        components: ['lockfileGenerator', 'attestationBundler', 'versionManager', 'reproducibilityVerifier']
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize project manager:', error);
      throw error;
    }
  }

  /**
   * Generate project lockfile - `kgen project lock`
   * @param {Object} options - Lock command options
   * @returns {Promise<Object>} Lock result
   */
  async lock(options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      this.logger.info('Generating project lockfile...');

      // Gather project context
      const projectContext = await this._gatherProjectContext(options);

      // Generate lockfile
      const lockfile = await this.lockfileGenerator.generateLockfile(projectContext);

      // Write lockfile to disk
      const lockfilePath = await this.lockfileGenerator.writeLockfile(
        lockfile, 
        options.output || null
      );

      const result = {
        command: 'lock',
        success: true,
        lockfilePath,
        lockfile,
        projectContext,
        generatedAt: new Date().toISOString()
      };

      this.logger.success(`Lockfile generated successfully: ${lockfilePath}`);
      return result;

    } catch (error) {
      this.logger.error('Failed to generate lockfile:', error);
      throw error;
    }
  }

  /**
   * Create attestation bundle - `kgen project attest`
   * @param {Object} options - Attest command options
   * @returns {Promise<Object>} Attestation result
   */
  async attest(options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      this.logger.info('Creating attestation bundle...');

      // Gather artifacts for attestation
      const artifactPaths = await this._gatherArtifactPaths(options);

      // Create bundle request
      const bundleRequest = {
        bundleId: options.bundleId,
        purpose: options.purpose || 'compliance-attestation',
        description: options.description,
        artifactPaths,
        provenanceRecords: options.includeProvenance ? await this._gatherProvenanceRecords(options) : null,
        complianceFramework: options.framework || 'enterprise',
        complianceStandards: options.standards || [],
        createdBy: options.user || 'kgen-system'
      };

      // Create attestation bundle
      const bundleResult = await this.attestationBundler.createAttestationBundle(bundleRequest);

      const result = {
        command: 'attest',
        success: true,
        bundleId: bundleResult.bundleId,
        bundlePath: bundleResult.bundlePath,
        bundleHash: bundleResult.bundleHash,
        signature: bundleResult.signature,
        manifest: bundleResult.manifest,
        size: bundleResult.size,
        createdAt: bundleResult.createdAt
      };

      this.logger.success(`Attestation bundle created: ${bundleResult.bundlePath}`);
      return result;

    } catch (error) {
      this.logger.error('Failed to create attestation bundle:', error);
      throw error;
    }
  }

  /**
   * Verify project reproducibility - `kgen project verify`
   * @param {Object} options - Verify command options
   * @returns {Promise<Object>} Verification result
   */
  async verify(options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      this.logger.info('Verifying project reproducibility...');

      // Determine what to verify
      const verificationType = options.type || 'build';

      switch (verificationType) {
        case 'build':
          return await this._verifyBuildReproducibility(options);
        case 'artifact':
          return await this._verifyArtifactReproducibility(options);
        case 'bundle':
          return await this._verifyBundleIntegrity(options);
        case 'lockfile':
          return await this._verifyLockfileDeterminism(options);
        default:
          throw new Error(`Unknown verification type: ${verificationType}`);
      }

    } catch (error) {
      this.logger.error('Failed to verify reproducibility:', error);
      throw error;
    }
  }

  /**
   * Manage component versions - `kgen project version`
   * @param {Object} options - Version command options
   * @returns {Promise<Object>} Version result
   */
  async version(options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const action = options.action || 'list';

      switch (action) {
        case 'list':
          return await this._listComponentVersions(options);
        case 'register':
          return await this._registerComponentVersion(options);
        case 'resolve':
          return await this._resolveComponentVersions(options);
        case 'upgrade':
          return await this._getUpgradePath(options);
        case 'check':
          return await this._checkVersionCompatibility(options);
        default:
          throw new Error(`Unknown version action: ${action}`);
      }

    } catch (error) {
      this.logger.error('Failed to manage versions:', error);
      throw error;
    }
  }

  /**
   * Get project status and statistics
   * @returns {Object} Project status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      projectRoot: this.config.projectRoot,
      lockfileName: this.config.lockfileName,
      components: {
        lockfileGenerator: 'ready',
        attestationBundler: 'ready',
        versionManager: this.versionManager ? 'ready' : 'not-initialized',
        reproducibilityVerifier: 'ready'
      }
    };
  }

  // Private methods

  async _gatherProjectContext(options) {
    const context = {
      projectId: options.projectId,
      projectName: options.projectName || 'kgen-project',
      projectVersion: options.projectVersion || '1.0.0',
      engineVersion: options.engineVersion || '1.0.0',
      user: options.user,
      
      // Discover used templates
      usedTemplates: await this._discoverUsedTemplates(options),
      
      // Discover used rules
      usedRules: await this._discoverUsedRules(options),
      
      // Discover used schemas
      usedSchemas: await this._discoverUsedSchemas(options),
      
      // External resources
      externalResources: options.externalResources || [],
      
      // Environment and configuration
      environmentVariables: this._gatherEnvironmentVariables(options),
      generatorConfig: options.generatorConfig || {},
      validationConfig: options.validationConfig || {},
      outputConfig: options.outputConfig || {},
      processingConfig: options.processingConfig || {}
    };

    return context;
  }

  async _discoverUsedTemplates(options) {
    // This would implement template discovery logic
    // For now, return empty array or provided templates
    return options.templates || [];
  }

  async _discoverUsedRules(options) {
    // This would implement rule discovery logic  
    // For now, return empty array or provided rules
    return options.rules || [];
  }

  async _discoverUsedSchemas(options) {
    // This would implement schema discovery logic
    // For now, return empty array or provided schemas
    return options.schemas || [];
  }

  _gatherEnvironmentVariables(options) {
    const relevantVars = [
      'NODE_VERSION', 'NPM_VERSION', 'KGEN_VERSION',
      'NODE_ENV', 'PATH', 'HOME', 'USER'
    ];

    const envVars = {};
    for (const varName of relevantVars) {
      if (process.env[varName]) {
        envVars[varName] = process.env[varName];
      }
    }

    return envVars;
  }

  async _gatherArtifactPaths(options) {
    const artifactPaths = [];

    // Use provided paths if available
    if (options.paths) {
      artifactPaths.push(...options.paths);
    }

    // Discover artifacts if requested
    if (options.discover !== false) {
      const discoveredPaths = await this._discoverArtifacts(options);
      artifactPaths.push(...discoveredPaths);
    }

    return [...new Set(artifactPaths)]; // Remove duplicates
  }

  async _discoverArtifacts(options) {
    // This would implement artifact discovery logic
    // Look for generated files, build outputs, etc.
    const patterns = options.patterns || ['**/*.js', '**/*.json', '**/*.md'];
    
    // For now, return empty array
    return [];
  }

  async _gatherProvenanceRecords(options) {
    // This would integrate with the provenance tracker
    // For now, return empty array
    return [];
  }

  async _verifyBuildReproducibility(options) {
    const lockfilePath = options.lockfile || `${this.config.projectRoot}/${this.config.lockfileName}`;
    
    const verificationRequest = {
      lockfilePath,
      projectPath: this.config.projectRoot,
      buildCommand: options.command || 'kgen generate',
      cleanBuild: options.clean !== false
    };

    const verification = await this.reproducibilityVerifier.verifyReproducibility(verificationRequest);

    return {
      command: 'verify',
      type: 'build',
      success: true,
      verification
    };
  }

  async _verifyArtifactReproducibility(options) {
    if (!options.artifact) {
      throw new Error('Artifact path is required for artifact verification');
    }

    if (!options.attestation) {
      // Try to find .attest.json sidecar file
      const attestationPath = `${options.artifact}.attest.json`;
      try {
        const attestationContent = await require('fs').promises.readFile(attestationPath, 'utf8');
        options.attestation = JSON.parse(attestationContent);
      } catch (error) {
        throw new Error(`No attestation provided and sidecar file not found: ${attestationPath}`);
      }
    }

    const verification = await this.reproducibilityVerifier.verifyArtifactReproducibility(
      options.artifact,
      options.attestation
    );

    return {
      command: 'verify',
      type: 'artifact',
      success: true,
      verification
    };
  }

  async _verifyBundleIntegrity(options) {
    if (!options.bundle) {
      throw new Error('Bundle path is required for bundle verification');
    }

    const verification = await this.attestationBundler.verifyAttestationBundle(options.bundle);

    return {
      command: 'verify',
      type: 'bundle',
      success: true,
      verification
    };
  }

  async _verifyLockfileDeterminism(options) {
    const lockfilePath = options.lockfile || `${this.config.projectRoot}/${this.config.lockfileName}`;

    const verification = await this.reproducibilityVerifier.verifyLockfileDeterminism(lockfilePath);

    return {
      command: 'verify',
      type: 'lockfile',
      success: true,
      verification
    };
  }

  async _listComponentVersions(options) {
    const componentId = options.component;
    
    if (componentId) {
      const history = this.versionManager.getVersionHistory(componentId);
      const latest = this.versionManager.getLatestVersion(componentId);
      
      return {
        command: 'version',
        action: 'list',
        componentId,
        latest,
        history
      };
    } else {
      // List all components
      const status = this.versionManager.getStatus ? this.versionManager.getStatus() : {};
      
      return {
        command: 'version',
        action: 'list',
        components: status
      };
    }
  }

  async _registerComponentVersion(options) {
    const { componentType, componentInfo } = options;
    
    let registrationResult;
    
    switch (componentType) {
      case 'template':
        registrationResult = await this.versionManager.registerTemplate(componentInfo);
        break;
      case 'rule':
        registrationResult = await this.versionManager.registerRule(componentInfo);
        break;
      case 'schema':
        registrationResult = await this.versionManager.registerSchema(componentInfo);
        break;
      default:
        throw new Error(`Unsupported component type: ${componentType}`);
    }

    return {
      command: 'version',
      action: 'register',
      componentType,
      registrationResult
    };
  }

  async _resolveComponentVersions(options) {
    const constraints = options.constraints || {};
    
    const resolution = await this.versionManager.resolveVersions(constraints);

    return {
      command: 'version',
      action: 'resolve',
      constraints,
      resolution
    };
  }

  async _getUpgradePath(options) {
    const { componentId, fromVersion, toVersion } = options;
    
    if (!componentId || !fromVersion) {
      throw new Error('Component ID and from version are required for upgrade path');
    }

    const upgradePath = await this.versionManager.getUpgradePath(componentId, fromVersion, toVersion);

    return {
      command: 'version',
      action: 'upgrade',
      upgradePath
    };
  }

  async _checkVersionCompatibility(options) {
    const components = options.components || {};
    
    const compatibility = await this.versionManager.checkCompatibility(components);

    return {
      command: 'version',
      action: 'check',
      components,
      compatibility
    };
  }
}

// Export individual components for direct use
export {
  LockfileGenerator,
  AttestationBundler,
  VersionManager,
  ReproducibilityVerifier
};

// Export main project manager as default
export default ProjectManager;