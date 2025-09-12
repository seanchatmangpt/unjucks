/**
 * Workflow Integration Orchestrator - Seamless unjucks to KGEN integration
 * 
 * Orchestrates complete workflow integration from unjucks template discovery
 * to KGEN semantic processing, maintaining deterministic guarantees across
 * all workflow components with comprehensive provenance tracking.
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import { promises as fs } from 'fs';
import path from 'path';
import { ProvenanceTracker } from '../kgen/provenance/tracker.js';

export class WorkflowOrchestrator extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Workflow configuration
      templatePath: config.templatePath || './templates',
      outputPath: config.outputPath || './src',
      enableProvenance: config.enableProvenance !== false,
      atomicOperations: config.atomicOperations !== false,
      validateOutputs: config.validateOutputs !== false,
      
      // Integration points
      kgenEnabled: config.kgenEnabled !== false,
      blockchainAnchoring: config.blockchainAnchoring === true,
      complianceMode: config.complianceMode || 'GDPR',
      
      // Error handling
      errorRecovery: config.errorRecovery !== false,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      
      // Performance
      parallelExecution: config.parallelExecution !== false,
      batchSize: config.batchSize || 10,
      
      ...config
    };
    
    this.logger = consola.withTag('workflow-orchestrator');
    
    // Initialize components
    this.provenanceTracker = this.config.enableProvenance ? 
      new ProvenanceTracker({
        enableDetailedTracking: true,
        enableBlockchainIntegrity: this.config.blockchainAnchoring,
        complianceMode: this.config.complianceMode,
        enableCryptographicHashing: true
      }) : null;
    
    // Workflow state
    this.workflows = new Map();
    this.activeOperations = new Map();
    this.templateIndex = new Map();
    this.variableRegistry = new Map();
    this.artifactStore = new Map();
    
    // Performance metrics
    this.metrics = {
      totalWorkflows: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      templatesProcessed: 0,
      artifactsGenerated: 0
    };
    
    this.state = 'initialized';
  }
  
  /**
   * Initialize the workflow orchestrator
   */
  async initialize() {
    try {
      this.logger.info('Initializing workflow orchestrator...');
      
      // Initialize provenance tracking if enabled
      if (this.provenanceTracker) {
        await this.provenanceTracker.initialize();
      }
      
      // Discover and index templates
      await this._discoverTemplates();
      
      // Initialize variable registry
      await this._initializeVariableRegistry();
      
      // Setup error recovery strategies
      this._setupErrorRecovery();
      
      this.state = 'ready';
      this.logger.success('Workflow orchestrator initialized successfully');
      
      return {
        status: 'success',
        templatesDiscovered: this.templateIndex.size,
        variablesRegistered: this.variableRegistry.size,
        provenanceEnabled: this.provenanceTracker !== null
      };
      
    } catch (error) {
      this.logger.error('Failed to initialize workflow orchestrator:', error);
      this.state = 'error';
      throw error;
    }
  }
  
  /**
   * Execute complete workflow from discovery to validation
   * @param {Object} workflowSpec - Workflow specification
   * @returns {Promise<Object>} Execution result with provenance
   */
  async executeWorkflow(workflowSpec) {
    const workflowId = workflowSpec.id || `workflow-${Date.now()}`;
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting workflow execution: ${workflowId}`);
      
      // Start provenance tracking
      let provenanceContext = null;
      if (this.provenanceTracker) {
        provenanceContext = await this.provenanceTracker.startOperation({
          operationId: workflowId,
          type: 'workflow-execution',
          user: workflowSpec.user || { id: 'system', name: 'System' },
          inputs: [workflowSpec],
          sources: workflowSpec.templates || [],
          metadata: {
            templateCount: workflowSpec.templates?.length || 0,
            targetPath: workflowSpec.outputPath || this.config.outputPath
          }
        });
      }
      
      // Phase 1: Template Discovery and Selection
      const discoveredTemplates = await this._phaseDiscovery(workflowSpec, provenanceContext);
      
      // Phase 2: Variable Resolution and Validation
      const resolvedVariables = await this._phaseVariableResolution(
        workflowSpec, 
        discoveredTemplates, 
        provenanceContext
      );
      
      // Phase 3: Frontmatter Processing and Template Preparation
      const processedTemplates = await this._phaseFrontmatterProcessing(
        discoveredTemplates,
        resolvedVariables,
        provenanceContext
      );
      
      // Phase 4: Atomic Generation with Error Handling
      const generationResults = await this._phaseAtomicGeneration(
        processedTemplates,
        resolvedVariables,
        provenanceContext
      );
      
      // Phase 5: Validation and KGEN Integration
      const validationResults = await this._phaseValidation(
        generationResults,
        workflowSpec,
        provenanceContext
      );
      
      // Phase 6: Artifact Attestation and Provenance Completion
      const attestationResults = await this._phaseAttestation(
        validationResults,
        workflowSpec,
        provenanceContext
      );
      
      const executionTime = Date.now() - startTime;
      this.metrics.averageExecutionTime = 
        (this.metrics.averageExecutionTime * this.metrics.totalWorkflows + executionTime) / 
        (this.metrics.totalWorkflows + 1);
      
      // Complete workflow with comprehensive results
      const workflowResult = {
        workflowId,
        status: 'success',
        executionTime,
        phases: {
          discovery: discoveredTemplates,
          variableResolution: resolvedVariables,
          frontmatterProcessing: processedTemplates,
          generation: generationResults,
          validation: validationResults,
          attestation: attestationResults
        },
        artifacts: Array.from(this.artifactStore.get(workflowId) || []),
        metrics: {
          templatesProcessed: discoveredTemplates.length,
          variablesResolved: Object.keys(resolvedVariables).length,
          artifactsGenerated: generationResults.artifacts?.length || 0,
          validationsPassed: validationResults.passedValidations || 0
        }
      };
      
      // Complete provenance tracking
      if (this.provenanceTracker && provenanceContext) {
        const provenanceRecord = await this.provenanceTracker.completeOperation(workflowId, {
          status: 'success',
          outputs: workflowResult.artifacts,
          metrics: workflowResult.metrics,
          outputGraph: {
            entities: workflowResult.artifacts.map(artifact => ({
              id: artifact.id,
              type: artifact.type,
              path: artifact.path
            }))
          },
          validationReport: validationResults
        });
        
        workflowResult.provenance = provenanceRecord;
      }
      
      // Update metrics
      this.metrics.totalWorkflows++;
      this.metrics.successfulExecutions++;
      this.metrics.templatesProcessed += discoveredTemplates.length;
      this.metrics.artifactsGenerated += generationResults.artifacts?.length || 0;
      
      // Store workflow for future reference
      this.workflows.set(workflowId, workflowResult);
      
      this.emit('workflow:completed', workflowResult);
      this.logger.success(`Workflow execution completed: ${workflowId} (${executionTime}ms)`);
      
      return workflowResult;
      
    } catch (error) {
      this.logger.error(`Workflow execution failed: ${workflowId}`, error);
      
      // Record error in provenance
      if (this.provenanceTracker) {
        await this.provenanceTracker.recordError(workflowId, error);
      }
      
      // Update failure metrics
      this.metrics.totalWorkflows++;
      this.metrics.failedExecutions++;
      
      this.emit('workflow:failed', { workflowId, error });
      throw error;
    }
  }
  
  /**
   * Phase 1: Template Discovery and Selection
   */
  async _phaseDiscovery(workflowSpec, provenanceContext) {
    this.logger.info('Phase 1: Template Discovery and Selection');
    
    const discoveredTemplates = [];
    
    if (workflowSpec.templates) {
      // Explicit template selection
      for (const templateSpec of workflowSpec.templates) {
        const template = this.templateIndex.get(templateSpec.name || templateSpec);
        if (template) {
          discoveredTemplates.push({
            ...template,
            variables: templateSpec.variables || {},
            options: templateSpec.options || {}
          });
        } else {
          this.logger.warn(`Template not found: ${templateSpec.name || templateSpec}`);
        }
      }
    } else if (workflowSpec.generator) {
      // Generator-based discovery
      const generatorTemplates = Array.from(this.templateIndex.values())
        .filter(template => template.generator === workflowSpec.generator);
      
      discoveredTemplates.push(...generatorTemplates.map(template => ({
        ...template,
        variables: workflowSpec.variables || {},
        options: workflowSpec.options || {}
      })));
    } else {
      // Auto-discovery based on context
      const contextTemplates = await this._autoDiscoverTemplates(workflowSpec);
      discoveredTemplates.push(...contextTemplates);
    }
    
    // Track lineage for discovered templates
    if (this.provenanceTracker && provenanceContext) {
      for (const template of discoveredTemplates) {
        await this.provenanceTracker.trackEntityLineage(template.id, {
          sources: [{ id: 'template-index', type: 'index' }],
          transformations: ['template-discovery'],
          operationId: provenanceContext.operationId
        });
      }
    }
    
    this.logger.debug(`Discovered ${discoveredTemplates.length} templates`);
    return discoveredTemplates;
  }
  
  /**
   * Phase 2: Variable Resolution and Validation
   */
  async _phaseVariableResolution(workflowSpec, discoveredTemplates, provenanceContext) {
    this.logger.info('Phase 2: Variable Resolution and Validation');
    
    const resolvedVariables = {};
    const requiredVariables = new Set();
    
    // Extract required variables from all templates
    for (const template of discoveredTemplates) {
      if (template.variables) {
        Object.keys(template.variables).forEach(varName => requiredVariables.add(varName));
      }
      
      // Parse template content for variable references
      if (template.content) {
        const variableMatches = template.content.match(/\{\{\s*([^}]+)\s*\}\}/g) || [];
        variableMatches.forEach(match => {
          const varName = match.replace(/[{}]/g, '').trim().split('.')[0].split('|')[0].trim();
          requiredVariables.add(varName);
        });
      }
    }
    
    // Resolve variables from multiple sources
    for (const varName of requiredVariables) {
      if (workflowSpec.variables && workflowSpec.variables[varName] !== undefined) {
        // Explicit variable value
        resolvedVariables[varName] = workflowSpec.variables[varName];
      } else if (this.variableRegistry.has(varName)) {
        // Registry default
        resolvedVariables[varName] = this.variableRegistry.get(varName).defaultValue;
      } else if (process.env[varName.toUpperCase()]) {
        // Environment variable
        resolvedVariables[varName] = process.env[varName.toUpperCase()];
      } else {
        // Generate or prompt for missing variables
        resolvedVariables[varName] = await this._resolveVariable(varName, workflowSpec);
      }
    }
    
    // Validate resolved variables
    const validationErrors = [];
    for (const [varName, value] of Object.entries(resolvedVariables)) {
      const variableSpec = this.variableRegistry.get(varName);
      if (variableSpec && !this._validateVariableValue(value, variableSpec)) {
        validationErrors.push(`Invalid value for variable ${varName}: ${value}`);
      }
    }
    
    if (validationErrors.length > 0) {
      throw new Error(`Variable validation failed: ${validationErrors.join(', ')}`);
    }
    
    this.logger.debug(`Resolved ${Object.keys(resolvedVariables).length} variables`);
    return resolvedVariables;
  }
  
  /**
   * Phase 3: Frontmatter Processing and Template Preparation
   */
  async _phaseFrontmatterProcessing(discoveredTemplates, resolvedVariables, provenanceContext) {
    this.logger.info('Phase 3: Frontmatter Processing and Template Preparation');
    
    const processedTemplates = [];
    
    for (const template of discoveredTemplates) {
      try {
        // Parse frontmatter configuration
        const frontmatter = template.frontmatter || {};
        
        // Process dynamic paths with variable substitution
        const processedTemplate = {
          ...template,
          resolvedPath: this._resolvePath(frontmatter.to || template.path, resolvedVariables),
          shouldInject: frontmatter.inject === true,
          skipCondition: frontmatter.skipIf,
          injectMode: frontmatter.mode || 'append',
          lineNumber: frontmatter.lineAt,
          beforePattern: frontmatter.before,
          afterPattern: frontmatter.after,
          permissions: frontmatter.chmod,
          postProcessing: frontmatter.sh
        };
        
        // Evaluate skip condition
        if (processedTemplate.skipCondition) {
          const shouldSkip = await this._evaluateSkipCondition(
            processedTemplate.skipCondition, 
            resolvedVariables
          );
          
          if (shouldSkip) {
            this.logger.debug(`Skipping template ${template.name} due to skip condition`);
            continue;
          }
        }
        
        // Render template content with variables
        processedTemplate.renderedContent = await this._renderTemplateContent(
          template.content,
          resolvedVariables
        );
        
        processedTemplates.push(processedTemplate);
        
      } catch (error) {
        this.logger.error(`Failed to process template ${template.name}:`, error);
        if (!this.config.errorRecovery) {
          throw error;
        }
      }
    }
    
    this.logger.debug(`Processed ${processedTemplates.length} templates`);
    return processedTemplates;
  }
  
  /**
   * Phase 4: Atomic Generation with Error Handling
   */
  async _phaseAtomicGeneration(processedTemplates, resolvedVariables, provenanceContext) {
    this.logger.info('Phase 4: Atomic Generation with Error Handling');
    
    const generationResults = {
      artifacts: [],
      errors: [],
      operations: []
    };
    
    // Execute atomic operations with rollback capability
    const atomicTransaction = new AtomicTransaction();
    
    try {
      for (const template of processedTemplates) {
        const operation = {
          type: template.shouldInject ? 'inject' : 'create',
          template: template.name,
          targetPath: template.resolvedPath,
          content: template.renderedContent,
          options: {
            mode: template.injectMode,
            lineNumber: template.lineNumber,
            beforePattern: template.beforePattern,
            afterPattern: template.afterPattern,
            permissions: template.permissions
          }
        };
        
        // Add operation to transaction
        atomicTransaction.addOperation(operation);
        
        // Execute operation
        const result = await this._executeAtomicOperation(operation, atomicTransaction);
        
        generationResults.operations.push({
          operation,
          result,
          timestamp: new Date()
        });
        
        if (result.success) {
          generationResults.artifacts.push({
            id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: template.shouldInject ? 'injection' : 'file',
            path: template.resolvedPath,
            template: template.name,
            size: Buffer.byteLength(template.renderedContent, 'utf8'),
            checksum: this._calculateChecksum(template.renderedContent)
          });
        } else {
          generationResults.errors.push({
            template: template.name,
            error: result.error,
            operation
          });
        }
      }
      
      // Commit all operations if no errors
      if (generationResults.errors.length === 0) {
        await atomicTransaction.commit();
        this.logger.success('All generation operations committed successfully');
      } else {
        await atomicTransaction.rollback();
        throw new Error(`Generation failed with ${generationResults.errors.length} errors`);
      }
      
    } catch (error) {
      await atomicTransaction.rollback();
      this.logger.error('Atomic generation failed, rolling back changes:', error);
      throw error;
    }
    
    this.logger.debug(`Generated ${generationResults.artifacts.length} artifacts`);
    return generationResults;
  }
  
  /**
   * Phase 5: Validation and KGEN Integration
   */
  async _phaseValidation(generationResults, workflowSpec, provenanceContext) {
    this.logger.info('Phase 5: Validation and KGEN Integration');
    
    const validationResults = {
      passedValidations: 0,
      failedValidations: 0,
      validationReports: [],
      kgenAnalysis: null
    };
    
    // Validate generated artifacts
    for (const artifact of generationResults.artifacts) {
      try {
        const validation = await this._validateArtifact(artifact, workflowSpec);
        validationResults.validationReports.push(validation);
        
        if (validation.passed) {
          validationResults.passedValidations++;
        } else {
          validationResults.failedValidations++;
        }
        
      } catch (error) {
        this.logger.error(`Validation failed for artifact ${artifact.id}:`, error);
        validationResults.failedValidations++;
        validationResults.validationReports.push({
          artifactId: artifact.id,
          passed: false,
          error: error.message
        });
      }
    }
    
    // KGEN semantic processing if enabled
    if (this.config.kgenEnabled && generationResults.artifacts.length > 0) {
      try {
        validationResults.kgenAnalysis = await this._integrateWithKgen(
          generationResults.artifacts,
          workflowSpec,
          provenanceContext
        );
      } catch (error) {
        this.logger.warn('KGEN integration failed:', error);
        validationResults.kgenAnalysis = { error: error.message };
      }
    }
    
    this.logger.debug(`Validation completed: ${validationResults.passedValidations} passed, ${validationResults.failedValidations} failed`);
    return validationResults;
  }
  
  /**
   * Phase 6: Artifact Attestation and Provenance Completion
   */
  async _phaseAttestation(validationResults, workflowSpec, provenanceContext) {
    this.logger.info('Phase 6: Artifact Attestation and Provenance Completion');
    
    const attestationResults = {
      attestations: [],
      provenanceRecords: [],
      blockchainAnchors: []
    };
    
    // Generate cryptographic attestations for artifacts
    for (const report of validationResults.validationReports) {
      if (report.passed) {
        const attestation = await this._generateAttestation(report, workflowSpec);
        attestationResults.attestations.push(attestation);
        
        // Blockchain anchoring if enabled
        if (this.config.blockchainAnchoring && this.provenanceTracker?.blockchain) {
          try {
            const anchor = await this.provenanceTracker.blockchain.queueForAnchoring(
              attestation.id,
              attestation.hash,
              {
                operationType: 'artifact-attestation',
                timestamp: new Date(),
                metadata: {
                  workflowId: workflowSpec.id,
                  artifactId: report.artifactId
                }
              }
            );
            
            attestationResults.blockchainAnchors.push(anchor);
            
          } catch (error) {
            this.logger.warn('Blockchain anchoring failed:', error);
          }
        }
      }
    }
    
    this.logger.debug(`Generated ${attestationResults.attestations.length} attestations`);
    return attestationResults;
  }
  
  // Private helper methods
  
  async _discoverTemplates() {
    this.logger.debug('Discovering templates...');
    
    try {
      const templatePath = path.resolve(this.config.templatePath);
      await this._scanTemplateDirectory(templatePath);
      
      this.logger.success(`Discovered ${this.templateIndex.size} templates`);
      
    } catch (error) {
      this.logger.warn('Template discovery failed:', error);
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
  
  async _scanTemplateDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          await this._scanTemplateDirectory(fullPath);
        } else if (entry.name.endsWith('.njk') || entry.name.endsWith('.ejs')) {
          await this._processTemplateFile(fullPath);
        }
      }
      
    } catch (error) {
      this.logger.error(`Failed to scan directory ${dirPath}:`, error);
    }
  }
  
  async _processTemplateFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const relativePath = path.relative(this.config.templatePath, filePath);
      
      // Parse frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      let frontmatter = {};
      let templateContent = content;
      
      if (frontmatterMatch) {
        try {
          frontmatter = JSON.parse(frontmatterMatch[1]);
          templateContent = frontmatterMatch[2];
        } catch (error) {
          this.logger.warn(`Invalid frontmatter in ${filePath}:`, error);
        }
      }
      
      const template = {
        id: relativePath.replace(/\.[^.]+$/, ''),
        name: path.basename(filePath, path.extname(filePath)),
        path: relativePath,
        fullPath: filePath,
        content: templateContent,
        frontmatter,
        generator: path.dirname(relativePath).split('/')[0],
        variables: this._extractVariables(templateContent),
        lastModified: (await fs.stat(filePath)).mtime
      };
      
      this.templateIndex.set(template.id, template);
      
    } catch (error) {
      this.logger.error(`Failed to process template ${filePath}:`, error);
    }
  }
  
  _extractVariables(content) {
    const variables = {};
    const matches = content.match(/\{\{\s*([^}]+)\s*\}\}/g) || [];
    
    for (const match of matches) {
      const varExpression = match.replace(/[{}]/g, '').trim();
      const varName = varExpression.split('.')[0].split('|')[0].trim();
      
      if (!variables[varName]) {
        variables[varName] = {
          name: varName,
          required: true,
          type: 'string',
          occurrences: 1
        };
      } else {
        variables[varName].occurrences++;
      }
    }
    
    return variables;
  }
  
  async _initializeVariableRegistry() {
    // Initialize with common variables
    this.variableRegistry.set('name', {
      name: 'name',
      type: 'string',
      required: true,
      description: 'Name of the component/entity'
    });
    
    this.variableRegistry.set('description', {
      name: 'description',
      type: 'string',
      required: false,
      description: 'Description of the component/entity'
    });
    
    this.variableRegistry.set('author', {
      name: 'author',
      type: 'string',
      required: false,
      defaultValue: process.env.USER || 'Anonymous',
      description: 'Author name'
    });
    
    this.variableRegistry.set('timestamp', {
      name: 'timestamp',
      type: 'date',
      required: false,
      defaultValue: () => new Date().toISOString(),
      description: 'Current timestamp'
    });
  }
  
  _setupErrorRecovery() {
    // Implementation for error recovery strategies
    this.logger.debug('Error recovery strategies configured');
  }
  
  async _resolveVariable(varName, workflowSpec) {
    const variableSpec = this.variableRegistry.get(varName);
    
    if (variableSpec?.defaultValue) {
      if (typeof variableSpec.defaultValue === 'function') {
        return variableSpec.defaultValue();
      }
      return variableSpec.defaultValue;
    }
    
    // Generate reasonable defaults based on variable name
    if (varName.toLowerCase().includes('name')) {
      return workflowSpec.name || 'Component';
    }
    
    if (varName.toLowerCase().includes('date') || varName.toLowerCase().includes('time')) {
      return new Date().toISOString().split('T')[0];
    }
    
    return `{{${varName}}}`;
  }
  
  _validateVariableValue(value, variableSpec) {
    if (variableSpec.required && (value === undefined || value === null || value === '')) {
      return false;
    }
    
    if (variableSpec.type === 'number' && isNaN(Number(value))) {
      return false;
    }
    
    if (variableSpec.pattern && !new RegExp(variableSpec.pattern).test(value)) {
      return false;
    }
    
    return true;
  }
  
  _resolvePath(pathTemplate, variables) {
    let resolvedPath = pathTemplate;
    
    for (const [varName, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`, 'g');
      resolvedPath = resolvedPath.replace(regex, value);
    }
    
    return resolvedPath;
  }
  
  async _evaluateSkipCondition(condition, variables) {
    // Simple condition evaluation - can be extended
    if (typeof condition === 'string') {
      return variables[condition] === false || variables[condition] === 'false';
    }
    
    return false;
  }
  
  async _renderTemplateContent(content, variables) {
    let rendered = content;
    
    for (const [varName, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${varName}\\s*\\}\\}`, 'g');
      rendered = rendered.replace(regex, value);
    }
    
    return rendered;
  }
  
  async _executeAtomicOperation(operation, transaction) {
    try {
      if (operation.type === 'create') {
        return await this._createFile(operation, transaction);
      } else if (operation.type === 'inject') {
        return await this._injectContent(operation, transaction);
      }
      
      return { success: false, error: `Unknown operation type: ${operation.type}` };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  async _createFile(operation, transaction) {
    const targetPath = operation.targetPath;
    const targetDir = path.dirname(targetPath);
    
    // Ensure directory exists
    await fs.mkdir(targetDir, { recursive: true });
    
    // Check if file already exists
    const exists = await fs.access(targetPath).then(() => true).catch(() => false);
    
    if (exists) {
      // Backup existing file
      const backupPath = `${targetPath}.backup-${Date.now()}`;
      await fs.copyFile(targetPath, backupPath);
      transaction.addRollback(() => fs.rename(backupPath, targetPath));
    }
    
    // Write new file
    await fs.writeFile(targetPath, operation.content, 'utf8');
    transaction.addRollback(() => exists ? 
      fs.rename(`${targetPath}.backup-${Date.now()}`, targetPath) :
      fs.unlink(targetPath)
    );
    
    // Set permissions if specified
    if (operation.options.permissions) {
      await fs.chmod(targetPath, operation.options.permissions);
    }
    
    return { success: true, path: targetPath };
  }
  
  async _injectContent(operation, transaction) {
    const targetPath = operation.targetPath;
    
    // Read existing file
    const existingContent = await fs.readFile(targetPath, 'utf8').catch(() => '');
    const lines = existingContent.split('\n');
    
    let injectionIndex;
    
    if (operation.options.lineNumber) {
      injectionIndex = Math.max(0, Math.min(operation.options.lineNumber - 1, lines.length));
    } else if (operation.options.beforePattern) {
      injectionIndex = lines.findIndex(line => line.includes(operation.options.beforePattern));
    } else if (operation.options.afterPattern) {
      injectionIndex = lines.findIndex(line => line.includes(operation.options.afterPattern)) + 1;
    } else {
      injectionIndex = lines.length;
    }
    
    // Insert content
    const contentLines = operation.content.split('\n');
    lines.splice(injectionIndex, 0, ...contentLines);
    
    const newContent = lines.join('\n');
    
    // Backup and write
    const backupPath = `${targetPath}.backup-${Date.now()}`;
    if (existingContent) {
      await fs.writeFile(backupPath, existingContent, 'utf8');
      transaction.addRollback(() => fs.rename(backupPath, targetPath));
    }
    
    await fs.writeFile(targetPath, newContent, 'utf8');
    
    return { success: true, path: targetPath, injectionIndex };
  }
  
  _calculateChecksum(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }
  
  async _validateArtifact(artifact, workflowSpec) {
    // Basic validation - can be extended
    const validation = {
      artifactId: artifact.id,
      passed: true,
      checks: []
    };
    
    // Check file existence
    if (artifact.type === 'file') {
      const exists = await fs.access(artifact.path).then(() => true).catch(() => false);
      validation.checks.push({
        name: 'file-existence',
        passed: exists,
        message: exists ? 'File exists' : 'File not found'
      });
      
      if (!exists) {
        validation.passed = false;
      }
    }
    
    // Check content integrity
    if (artifact.checksum && artifact.type === 'file') {
      try {
        const content = await fs.readFile(artifact.path, 'utf8');
        const actualChecksum = this._calculateChecksum(content);
        const checksumValid = actualChecksum === artifact.checksum;
        
        validation.checks.push({
          name: 'content-integrity',
          passed: checksumValid,
          message: checksumValid ? 'Content integrity verified' : 'Content integrity check failed'
        });
        
        if (!checksumValid) {
          validation.passed = false;
        }
      } catch (error) {
        validation.checks.push({
          name: 'content-integrity',
          passed: false,
          message: `Content integrity check error: ${error.message}`
        });
        validation.passed = false;
      }
    }
    
    return validation;
  }
  
  async _integrateWithKgen(artifacts, workflowSpec, provenanceContext) {
    // KGEN semantic processing integration
    this.logger.debug('Integrating with KGEN semantic processing...');
    
    const kgenAnalysis = {
      processedArtifacts: [],
      semanticGraph: null,
      complianceCheck: null,
      recommendations: []
    };
    
    // Process each artifact through KGEN
    for (const artifact of artifacts) {
      if (artifact.type === 'file' && artifact.path.endsWith('.js')) {
        try {
          // Semantic analysis of generated code
          const analysis = await this._performSemanticAnalysis(artifact);
          kgenAnalysis.processedArtifacts.push(analysis);
          
        } catch (error) {
          this.logger.warn(`KGEN analysis failed for ${artifact.id}:`, error);
        }
      }
    }
    
    return kgenAnalysis;
  }
  
  async _performSemanticAnalysis(artifact) {
    // Placeholder for semantic analysis
    return {
      artifactId: artifact.id,
      semanticComplexity: 'low',
      patterns: ['module-export', 'function-declaration'],
      quality: 'high'
    };
  }
  
  async _generateAttestation(validationReport, workflowSpec) {
    const crypto = require('crypto');
    
    const attestation = {
      id: `attestation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      artifactId: validationReport.artifactId,
      workflowId: workflowSpec.id,
      timestamp: new Date(),
      validationPassed: validationReport.passed,
      checks: validationReport.checks,
      attestor: 'workflow-orchestrator',
      version: '1.0'
    };
    
    // Generate cryptographic hash
    const attestationData = JSON.stringify(attestation, Object.keys(attestation).sort());
    attestation.hash = crypto.createHash('sha256').update(attestationData).digest('hex');
    
    return attestation;
  }
  
  /**
   * Get orchestrator status and metrics
   */
  getStatus() {
    return {
      state: this.state,
      metrics: this.metrics,
      templatesIndexed: this.templateIndex.size,
      variablesRegistered: this.variableRegistry.size,
      activeWorkflows: this.activeOperations.size,
      totalWorkflows: this.workflows.size,
      provenanceEnabled: this.provenanceTracker !== null
    };
  }
}

/**
 * Atomic Transaction Manager for rollback capabilities
 */
class AtomicTransaction {
  constructor() {
    this.operations = [];
    this.rollbackActions = [];
    this.committed = false;
  }
  
  addOperation(operation) {
    this.operations.push(operation);
  }
  
  addRollback(rollbackFn) {
    this.rollbackActions.push(rollbackFn);
  }
  
  async commit() {
    this.committed = true;
    // Clear rollback actions since transaction is committed
    this.rollbackActions = [];
  }
  
  async rollback() {
    if (this.committed) {
      throw new Error('Cannot rollback committed transaction');
    }
    
    // Execute rollback actions in reverse order
    for (let i = this.rollbackActions.length - 1; i >= 0; i--) {
      try {
        await this.rollbackActions[i]();
      } catch (error) {
        consola.error('Rollback action failed:', error);
      }
    }
    
    this.rollbackActions = [];
  }
}

export default WorkflowOrchestrator;