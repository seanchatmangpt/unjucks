/**
 * Lockfile Generator - Deterministic lockfiles for reproducible builds
 * 
 * Creates deterministic lockfiles that capture exact versions of:
 * - Templates and their dependencies
 * - Rule sets and validation schemas  
 * - Engine versions and configuration
 * - External resources and references
 * 
 * Ensures reproducible builds across different environments and times.
 */

import consola from 'consola';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export class LockfileGenerator {
  constructor(config = {}) {
    this.config = {
      lockfileFormat: config.lockfileFormat || 'json',
      lockfileName: config.lockfileName || 'kgen.lock.json',
      hashAlgorithm: config.hashAlgorithm || 'sha256',
      includeDevDependencies: config.includeDevDependencies !== false,
      includeOptionalDependencies: config.includeOptionalDependencies !== false,
      sortDependencies: config.sortDependencies !== false,
      validateIntegrity: config.validateIntegrity !== false,
      ...config
    };

    this.logger = consola.withTag('lockfile-generator');
    this.lockfileVersion = '1.0.0';
  }

  /**
   * Generate deterministic lockfile for current project state
   * @param {Object} projectContext - Project context and metadata
   * @returns {Promise<Object>} Generated lockfile
   */
  async generateLockfile(projectContext) {
    try {
      this.logger.info('Generating deterministic lockfile...');

      const lockfile = {
        // Lockfile metadata
        lockfileVersion: this.lockfileVersion,
        generatedAt: this.getDeterministicDate().toISOString(),
        generatedBy: {
          tool: 'kgen',
          version: projectContext.engineVersion || '1.0.0',
          user: projectContext.user?.id || 'system'
        },

        // Project identification
        projectId: projectContext.projectId || uuidv4(),
        projectName: projectContext.projectName,
        projectVersion: projectContext.projectVersion || '1.0.0',

        // Core dependencies
        templates: await this._lockTemplates(projectContext),
        rules: await this._lockRules(projectContext),
        schemas: await this._lockSchemas(projectContext),
        
        // Engine and runtime
        engine: await this._lockEngine(projectContext),
        runtime: await this._lockRuntime(projectContext),
        
        // External resources
        resources: await this._lockResources(projectContext),
        
        // Environment and configuration
        environment: await this._lockEnvironment(projectContext),
        configuration: await this._lockConfiguration(projectContext),

        // Integrity verification
        integrityHashes: {},
        dependencyTree: {},
        resolution: {}
      };

      // Calculate integrity hashes for all components
      lockfile.integrityHashes = await this._calculateIntegrityHashes(lockfile);

      // Build dependency resolution tree
      lockfile.dependencyTree = await this._buildDependencyTree(lockfile);

      // Generate resolution map
      lockfile.resolution = await this._generateResolutionMap(lockfile);

      // Calculate overall lockfile hash
      lockfile.lockfileHash = await this._calculateLockfileHash(lockfile);

      this.logger.success('Deterministic lockfile generated successfully');
      
      return lockfile;

    } catch (error) {
      this.logger.error('Failed to generate lockfile:', error);
      throw error;
    }
  }

  /**
   * Validate existing lockfile against current project state
   * @param {Object} lockfile - Existing lockfile
   * @param {Object} projectContext - Current project context
   * @returns {Promise<Object>} Validation result
   */
  async validateLockfile(lockfile, projectContext) {
    try {
      this.logger.info('Validating lockfile against current project state...');

      const validation = {
        valid: true,
        issues: [],
        warnings: [],
        recommendations: []
      };

      // Validate lockfile structure
      const structureValidation = await this._validateLockfileStructure(lockfile);
      if (!structureValidation.valid) {
        validation.valid = false;
        validation.issues.push(...structureValidation.issues);
      }

      // Validate template versions
      const templateValidation = await this._validateTemplateVersions(lockfile, projectContext);
      if (!templateValidation.valid) {
        validation.valid = false;
        validation.issues.push(...templateValidation.issues);
      }
      validation.warnings.push(...templateValidation.warnings);

      // Validate rule versions
      const ruleValidation = await this._validateRuleVersions(lockfile, projectContext);
      if (!ruleValidation.valid) {
        validation.valid = false;
        validation.issues.push(...ruleValidation.issues);
      }

      // Validate integrity hashes
      const integrityValidation = await this._validateIntegrityHashes(lockfile);
      if (!integrityValidation.valid) {
        validation.valid = false;
        validation.issues.push(...integrityValidation.issues);
      }

      // Validate engine compatibility
      const engineValidation = await this._validateEngineCompatibility(lockfile, projectContext);
      if (!engineValidation.valid) {
        validation.warnings.push(...engineValidation.warnings);
      }

      // Check for drift and provide recommendations
      const driftAnalysis = await this._analyzeDrift(lockfile, projectContext);
      validation.recommendations.push(...driftAnalysis.recommendations);

      return validation;

    } catch (error) {
      this.logger.error('Failed to validate lockfile:', error);
      throw error;
    }
  }

  /**
   * Update lockfile with new dependencies or changes
   * @param {Object} lockfile - Existing lockfile
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated lockfile
   */
  async updateLockfile(lockfile, updates) {
    try {
      this.logger.info('Updating lockfile with new changes...');

      const updatedLockfile = { ...lockfile };

      // Update version and timestamp
      updatedLockfile.updatedAt = this.getDeterministicDate().toISOString();
      updatedLockfile.previousHash = lockfile.lockfileHash;

      // Apply template updates
      if (updates.templates) {
        updatedLockfile.templates = await this._updateTemplates(
          updatedLockfile.templates, 
          updates.templates
        );
      }

      // Apply rule updates  
      if (updates.rules) {
        updatedLockfile.rules = await this._updateRules(
          updatedLockfile.rules,
          updates.rules
        );
      }

      // Apply schema updates
      if (updates.schemas) {
        updatedLockfile.schemas = await this._updateSchemas(
          updatedLockfile.schemas,
          updates.schemas
        );
      }

      // Recalculate integrity hashes
      updatedLockfile.integrityHashes = await this._calculateIntegrityHashes(updatedLockfile);

      // Rebuild dependency tree
      updatedLockfile.dependencyTree = await this._buildDependencyTree(updatedLockfile);

      // Update resolution map
      updatedLockfile.resolution = await this._generateResolutionMap(updatedLockfile);

      // Calculate new lockfile hash
      updatedLockfile.lockfileHash = await this._calculateLockfileHash(updatedLockfile);

      this.logger.success('Lockfile updated successfully');
      
      return updatedLockfile;

    } catch (error) {
      this.logger.error('Failed to update lockfile:', error);
      throw error;
    }
  }

  /**
   * Write lockfile to disk
   * @param {Object} lockfile - Lockfile to write
   * @param {string} outputPath - Output path (optional)
   * @returns {Promise<string>} Written file path
   */
  async writeLockfile(lockfile, outputPath = null) {
    try {
      const filePath = outputPath || path.resolve(process.cwd(), this.config.lockfileName);
      
      let content;
      switch (this.config.lockfileFormat) {
        case 'json':
          content = JSON.stringify(lockfile, null, 2);
          break;
        case 'yaml':
          // Would implement YAML serialization
          throw new Error('YAML format not implemented yet');
        default:
          throw new Error(`Unsupported lockfile format: ${this.config.lockfileFormat}`);
      }

      await fs.writeFile(filePath, content, 'utf8');
      
      this.logger.success(`Lockfile written to: ${filePath}`);
      return filePath;

    } catch (error) {
      this.logger.error('Failed to write lockfile:', error);
      throw error;
    }
  }

  /**
   * Read and parse lockfile from disk
   * @param {string} filePath - Path to lockfile
   * @returns {Promise<Object>} Parsed lockfile
   */
  async readLockfile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      let lockfile;
      switch (this.config.lockfileFormat) {
        case 'json':
          lockfile = JSON.parse(content);
          break;
        case 'yaml':
          // Would implement YAML parsing
          throw new Error('YAML format not implemented yet');
        default:
          throw new Error(`Unsupported lockfile format: ${this.config.lockfileFormat}`);
      }

      // Validate lockfile structure
      const validation = await this._validateLockfileStructure(lockfile);
      if (!validation.valid) {
        throw new Error(`Invalid lockfile structure: ${validation.issues.join(', ')}`);
      }

      return lockfile;

    } catch (error) {
      this.logger.error(`Failed to read lockfile from ${filePath}:`, error);
      throw error;
    }
  }

  // Private methods

  async _lockTemplates(projectContext) {
    const templates = {};
    
    if (projectContext.usedTemplates) {
      for (const template of projectContext.usedTemplates) {
        templates[template.id] = {
          id: template.id,
          version: template.version || 'latest',
          source: template.source || 'local',
          path: template.path,
          hash: template.hash || await this._calculateHash(template.content || ''),
          dependencies: template.dependencies || [],
          metadata: {
            name: template.name,
            description: template.description,
            author: template.author,
            lastModified: template.lastModified || this.getDeterministicDate().toISOString()
          }
        };
      }
    }

    return this.config.sortDependencies ? 
      this._sortObject(templates) : templates;
  }

  async _lockRules(projectContext) {
    const rules = {};
    
    if (projectContext.usedRules) {
      for (const rule of projectContext.usedRules) {
        rules[rule.id] = {
          id: rule.id,
          version: rule.version || 'latest',
          type: rule.type,
          source: rule.source || 'local',
          hash: rule.hash || await this._calculateHash(rule.content || ''),
          dependencies: rule.dependencies || [],
          metadata: {
            name: rule.name,
            description: rule.description,
            category: rule.category,
            severity: rule.severity
          }
        };
      }
    }

    return this.config.sortDependencies ? 
      this._sortObject(rules) : rules;
  }

  async _lockSchemas(projectContext) {
    const schemas = {};
    
    if (projectContext.usedSchemas) {
      for (const schema of projectContext.usedSchemas) {
        schemas[schema.id] = {
          id: schema.id,
          version: schema.version || 'latest',
          format: schema.format || 'json-schema',
          source: schema.source || 'local',
          hash: schema.hash || await this._calculateHash(schema.content || ''),
          metadata: {
            title: schema.title,
            description: schema.description,
            draft: schema.draft || 'draft-07'
          }
        };
      }
    }

    return this.config.sortDependencies ? 
      this._sortObject(schemas) : schemas;
  }

  async _lockEngine(projectContext) {
    return {
      name: 'kgen',
      version: projectContext.engineVersion || '1.0.0',
      build: projectContext.engineBuild,
      features: projectContext.engineFeatures || [],
      plugins: projectContext.plugins || {},
      configuration: {
        provider: projectContext.provider,
        model: projectContext.model,
        parameters: projectContext.parameters
      }
    };
  }

  async _lockRuntime(projectContext) {
    return {
      nodejs: {
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      os: {
        platform: process.platform,
        release: os.release(),
        type: os.type()
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };
  }

  async _lockResources(projectContext) {
    const resources = {};
    
    if (projectContext.externalResources) {
      for (const resource of projectContext.externalResources) {
        resources[resource.id] = {
          id: resource.id,
          url: resource.url,
          version: resource.version,
          hash: resource.hash,
          lastChecked: this.getDeterministicDate().toISOString(),
          metadata: resource.metadata || {}
        };
      }
    }

    return resources;
  }

  async _lockEnvironment(projectContext) {
    return {
      variables: projectContext.environmentVariables || {},
      paths: projectContext.paths || {},
      locale: projectContext.locale || 'en-US',
      timezone: projectContext.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  async _lockConfiguration(projectContext) {
    return {
      generator: projectContext.generatorConfig || {},
      validation: projectContext.validationConfig || {},
      output: projectContext.outputConfig || {},
      processing: projectContext.processingConfig || {}
    };
  }

  async _calculateIntegrityHashes(lockfile) {
    const hashes = {};

    // Hash templates
    if (lockfile.templates) {
      hashes.templates = await this._calculateHash(JSON.stringify(lockfile.templates, null, 0));
    }

    // Hash rules
    if (lockfile.rules) {
      hashes.rules = await this._calculateHash(JSON.stringify(lockfile.rules, null, 0));
    }

    // Hash schemas
    if (lockfile.schemas) {
      hashes.schemas = await this._calculateHash(JSON.stringify(lockfile.schemas, null, 0));
    }

    // Hash engine configuration
    if (lockfile.engine) {
      hashes.engine = await this._calculateHash(JSON.stringify(lockfile.engine, null, 0));
    }

    return hashes;
  }

  async _buildDependencyTree(lockfile) {
    const tree = {
      templates: {},
      rules: {},
      schemas: {}
    };

    // Build template dependency tree
    if (lockfile.templates) {
      for (const [templateId, template] of Object.entries(lockfile.templates)) {
        tree.templates[templateId] = {
          dependencies: template.dependencies || [],
          dependents: []
        };
      }

      // Calculate dependents
      for (const [templateId, template] of Object.entries(lockfile.templates)) {
        for (const depId of template.dependencies || []) {
          if (tree.templates[depId]) {
            tree.templates[depId].dependents.push(templateId);
          }
        }
      }
    }

    return tree;
  }

  async _generateResolutionMap(lockfile) {
    const resolution = {};

    // Generate template resolution
    if (lockfile.templates) {
      for (const [templateId, template] of Object.entries(lockfile.templates)) {
        resolution[templateId] = {
          resolved: template.version,
          source: template.source,
          path: template.path
        };
      }
    }

    return resolution;
  }

  async _calculateLockfileHash(lockfile) {
    // Create a copy without the hash field itself
    const hashableContent = { ...lockfile };
    delete hashableContent.lockfileHash;
    
    const content = JSON.stringify(hashableContent, Object.keys(hashableContent).sort());
    return await this._calculateHash(content);
  }

  async _calculateHash(content) {
    return crypto.createHash(this.config.hashAlgorithm)
      .update(content, 'utf8')
      .digest('hex');
  }

  async _validateLockfileStructure(lockfile) {
    const validation = { valid: true, issues: [] };

    // Check required fields
    const requiredFields = ['lockfileVersion', 'generatedAt', 'templates', 'rules', 'engine'];
    for (const field of requiredFields) {
      if (!lockfile[field]) {
        validation.valid = false;
        validation.issues.push(`Missing required field: ${field}`);
      }
    }

    // Check lockfile version compatibility
    if (lockfile.lockfileVersion !== this.lockfileVersion) {
      validation.valid = false;
      validation.issues.push(`Incompatible lockfile version: ${lockfile.lockfileVersion}, expected: ${this.lockfileVersion}`);
    }

    return validation;
  }

  async _validateTemplateVersions(lockfile, projectContext) {
    const validation = { valid: true, issues: [], warnings: [] };

    if (!lockfile.templates || !projectContext.usedTemplates) {
      return validation;
    }

    for (const currentTemplate of projectContext.usedTemplates) {
      const lockedTemplate = lockfile.templates[currentTemplate.id];
      
      if (!lockedTemplate) {
        validation.warnings.push(`Template ${currentTemplate.id} not found in lockfile`);
        continue;
      }

      // Check version drift
      if (currentTemplate.version && currentTemplate.version !== lockedTemplate.version) {
        validation.warnings.push(
          `Template ${currentTemplate.id} version drift: locked=${lockedTemplate.version}, current=${currentTemplate.version}`
        );
      }

      // Check hash integrity
      if (currentTemplate.hash && currentTemplate.hash !== lockedTemplate.hash) {
        validation.valid = false;
        validation.issues.push(
          `Template ${currentTemplate.id} hash mismatch: locked=${lockedTemplate.hash}, current=${currentTemplate.hash}`
        );
      }
    }

    return validation;
  }

  async _validateRuleVersions(lockfile, projectContext) {
    const validation = { valid: true, issues: [] };

    if (!lockfile.rules || !projectContext.usedRules) {
      return validation;
    }

    for (const currentRule of projectContext.usedRules) {
      const lockedRule = lockfile.rules[currentRule.id];
      
      if (!lockedRule) {
        continue;
      }

      // Check hash integrity
      if (currentRule.hash && currentRule.hash !== lockedRule.hash) {
        validation.valid = false;
        validation.issues.push(
          `Rule ${currentRule.id} hash mismatch: locked=${lockedRule.hash}, current=${currentRule.hash}`
        );
      }
    }

    return validation;
  }

  async _validateIntegrityHashes(lockfile) {
    const validation = { valid: true, issues: [] };

    if (!lockfile.integrityHashes) {
      validation.valid = false;
      validation.issues.push('Missing integrity hashes');
      return validation;
    }

    // Recalculate and compare hashes
    const currentHashes = await this._calculateIntegrityHashes(lockfile);
    
    for (const [component, expectedHash] of Object.entries(lockfile.integrityHashes)) {
      const currentHash = currentHashes[component];
      if (currentHash !== expectedHash) {
        validation.valid = false;
        validation.issues.push(
          `Integrity hash mismatch for ${component}: expected=${expectedHash}, current=${currentHash}`
        );
      }
    }

    return validation;
  }

  async _validateEngineCompatibility(lockfile, projectContext) {
    const validation = { valid: true, warnings: [] };

    if (!lockfile.engine) {
      return validation;
    }

    const currentEngineVersion = projectContext.engineVersion || '1.0.0';
    const lockedEngineVersion = lockfile.engine.version;

    // Simple version comparison (would be more sophisticated in practice)
    if (currentEngineVersion !== lockedEngineVersion) {
      validation.warnings.push(
        `Engine version drift: locked=${lockedEngineVersion}, current=${currentEngineVersion}`
      );
    }

    return validation;
  }

  async _analyzeDrift(lockfile, projectContext) {
    const analysis = { recommendations: [] };

    // Check for new templates
    if (projectContext.usedTemplates) {
      for (const template of projectContext.usedTemplates) {
        if (!lockfile.templates[template.id]) {
          analysis.recommendations.push(`Add template ${template.id} to lockfile`);
        }
      }
    }

    // Check for removed templates
    if (lockfile.templates) {
      for (const templateId of Object.keys(lockfile.templates)) {
        const found = projectContext.usedTemplates?.find(t => t.id === templateId);
        if (!found) {
          analysis.recommendations.push(`Remove unused template ${templateId} from lockfile`);
        }
      }
    }

    return analysis;
  }

  async _updateTemplates(currentTemplates, templateUpdates) {
    const updated = { ...currentTemplates };

    for (const [templateId, update] of Object.entries(templateUpdates)) {
      if (update.action === 'add' || update.action === 'update') {
        updated[templateId] = {
          ...updated[templateId],
          ...update.template
        };
      } else if (update.action === 'remove') {
        delete updated[templateId];
      }
    }

    return this.config.sortDependencies ? this._sortObject(updated) : updated;
  }

  async _updateRules(currentRules, ruleUpdates) {
    const updated = { ...currentRules };

    for (const [ruleId, update] of Object.entries(ruleUpdates)) {
      if (update.action === 'add' || update.action === 'update') {
        updated[ruleId] = {
          ...updated[ruleId],
          ...update.rule
        };
      } else if (update.action === 'remove') {
        delete updated[ruleId];
      }
    }

    return this.config.sortDependencies ? this._sortObject(updated) : updated;
  }

  async _updateSchemas(currentSchemas, schemaUpdates) {
    const updated = { ...currentSchemas };

    for (const [schemaId, update] of Object.entries(schemaUpdates)) {
      if (update.action === 'add' || update.action === 'update') {
        updated[schemaId] = {
          ...updated[schemaId],
          ...update.schema
        };
      } else if (update.action === 'remove') {
        delete updated[schemaId];
      }
    }

    return this.config.sortDependencies ? this._sortObject(updated) : updated;
  }

  _sortObject(obj) {
    const sorted = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = obj[key];
    }
    return sorted;
  }
}

export default LockfileGenerator;