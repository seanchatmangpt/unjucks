// Plugin System Implementation Examples for Unjucks v2
// This file demonstrates the complete plugin architecture and implementation

/**
 * =============================================================================
 * CORE PLUGIN SYSTEM ARCHITECTURE
 * =============================================================================
 */

// Base Plugin Interface
class UnjucksPlugin {
  constructor(name, version, options = {}) {
    this.name = name;
    this.version = version;
    this.options = options;
    this.hooks = new Map();
    this.middlewares = [];
    this.validators = [];
    this.generators = [];
  }

  // Plugin lifecycle methods
  async initialize() {
    throw new Error(`Plugin ${this.name} must implement initialize() method`);
  }

  async destroy() {
    // Default cleanup implementation
    this.hooks.clear();
    this.middlewares = [];
    this.validators = [];
    this.generators = [];
  }

  // Hook registration system
  registerHook(eventName, callback, priority = 0) {
    if (!this.hooks.has(eventName)) {
      this.hooks.set(eventName, []);
    }
    
    this.hooks.get(eventName).push({
      callback,
      priority,
      plugin: this.name
    });

    // Sort by priority (higher priority first)
    this.hooks.get(eventName).sort((a, b) => b.priority - a.priority);
  }

  // Execute hooks
  async executeHooks(eventName, context = {}) {
    const hooks = this.hooks.get(eventName) || [];
    const results = [];

    for (const hook of hooks) {
      try {
        const result = await hook.callback(context);
        results.push({
          plugin: hook.plugin,
          result
        });
      } catch (error) {
        console.error(`Hook ${eventName} failed in plugin ${hook.plugin}:`, error);
        results.push({
          plugin: hook.plugin,
          error: error.message
        });
      }
    }

    return results;
  }
}

/**
 * =============================================================================
 * PLUGIN MANAGER
 * =============================================================================
 */

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
    this.config = {};
    this.logger = console; // Replace with proper logger
  }

  // Register a plugin
  async registerPlugin(plugin) {
    if (!(plugin instanceof UnjucksPlugin)) {
      throw new Error('Plugin must extend UnjucksPlugin class');
    }

    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }

    try {
      await plugin.initialize();
      this.plugins.set(plugin.name, plugin);
      this.mergePluginHooks(plugin);
      
      this.logger.info(`Plugin ${plugin.name} v${plugin.version} registered successfully`);
    } catch (error) {
      this.logger.error(`Failed to register plugin ${plugin.name}:`, error);
      throw error;
    }
  }

  // Unregister a plugin
  async unregisterPlugin(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} is not registered`);
    }

    try {
      await plugin.destroy();
      this.plugins.delete(pluginName);
      this.removePluginHooks(pluginName);
      
      this.logger.info(`Plugin ${pluginName} unregistered successfully`);
    } catch (error) {
      this.logger.error(`Failed to unregister plugin ${pluginName}:`, error);
      throw error;
    }
  }

  // Merge plugin hooks into global hooks
  mergePluginHooks(plugin) {
    for (const [eventName, hooks] of plugin.hooks) {
      if (!this.hooks.has(eventName)) {
        this.hooks.set(eventName, []);
      }
      
      this.hooks.get(eventName).push(...hooks);
      this.hooks.get(eventName).sort((a, b) => b.priority - a.priority);
    }
  }

  // Remove plugin hooks from global hooks
  removePluginHooks(pluginName) {
    for (const [eventName, hooks] of this.hooks) {
      this.hooks.set(
        eventName,
        hooks.filter(hook => hook.plugin !== pluginName)
      );
    }
  }

  // Execute hooks across all plugins
  async executeHooks(eventName, context = {}) {
    const hooks = this.hooks.get(eventName) || [];
    const results = [];

    for (const hook of hooks) {
      try {
        const result = await hook.callback({
          ...context,
          pluginManager: this
        });
        
        results.push({
          plugin: hook.plugin,
          result
        });
      } catch (error) {
        this.logger.error(`Hook ${eventName} failed in plugin ${hook.plugin}:`, error);
        results.push({
          plugin: hook.plugin,
          error: error.message
        });
      }
    }

    return results;
  }

  // Get plugin instance
  getPlugin(pluginName) {
    return this.plugins.get(pluginName);
  }

  // List all registered plugins
  listPlugins() {
    return Array.from(this.plugins.values()).map(plugin => ({
      name: plugin.name,
      version: plugin.version,
      options: plugin.options
    }));
  }
}

/**
 * =============================================================================
 * EXAMPLE PLUGIN IMPLEMENTATIONS
 * =============================================================================
 */

// TypeScript Generator Plugin
class TypeScriptGeneratorPlugin extends UnjucksPlugin {
  constructor(options = {}) {
    super('typescript-generator', '1.0.0', {
      strict: true,
      target: 'ES2020',
      module: 'ESNext',
      ...options
    });
  }

  async initialize() {
    // Register pre-generation hook
    this.registerHook('pre-generate', async (context) => {
      return this.validateTypeScriptConfig(context);
    }, 10);

    // Register post-generation hook
    this.registerHook('post-generate', async (context) => {
      return this.formatTypeScriptCode(context);
    }, 10);

    // Register file processor
    this.registerHook('process-file', async (context) => {
      if (context.file.endsWith('.ts') || context.file.endsWith('.tsx')) {
        return this.processTypeScriptFile(context);
      }
    }, 5);
  }

  async validateTypeScriptConfig(context) {
    const { project } = context;
    
    if (!project.tsConfig) {
      project.tsConfig = {
        compilerOptions: {
          target: this.options.target,
          module: this.options.module,
          strict: this.options.strict,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          declaration: true,
          outDir: './dist'
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist']
      };
    }

    return {
      message: 'TypeScript configuration validated',
      config: project.tsConfig
    };
  }

  async formatTypeScriptCode(context) {
    const { files } = context;
    const formattedFiles = [];

    for (const file of files) {
      if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
        try {
          // Use prettier or similar formatter
          const formatted = await this.formatWithPrettier(file.content, {
            parser: 'typescript',
            semi: true,
            singleQuote: true,
            trailingComma: 'es5',
            tabWidth: 2
          });

          formattedFiles.push({
            path: file.path,
            content: formatted,
            formatted: true
          });
        } catch (error) {
          console.warn(`Failed to format ${file.path}:`, error.message);
          formattedFiles.push(file);
        }
      } else {
        formattedFiles.push(file);
      }
    }

    return {
      message: 'TypeScript files formatted',
      files: formattedFiles
    };
  }

  async processTypeScriptFile(context) {
    const { file, content, variables } = context;

    // Add type imports if needed
    let processedContent = content;
    
    if (this.needsTypeImports(content)) {
      processedContent = this.addTypeImports(processedContent, variables);
    }

    // Add JSDoc comments
    if (this.options.generateDocs) {
      processedContent = this.addJSDocComments(processedContent);
    }

    return {
      content: processedContent,
      processed: true
    };
  }

  needsTypeImports(content) {
    // Check if content needs additional type imports
    return /interface|type|enum/.test(content);
  }

  addTypeImports(content, variables) {
    const imports = [];
    
    // Add common type imports based on content analysis
    if (content.includes('Request') || content.includes('Response')) {
      imports.push("import { Request, Response, NextFunction } from 'express';");
    }
    
    if (content.includes('Injectable') || content.includes('@')) {
      imports.push("import { Injectable } from '@nestjs/common';");
    }

    if (imports.length > 0) {
      return imports.join('\n') + '\n\n' + content;
    }

    return content;
  }

  addJSDocComments(content) {
    // Add JSDoc comments to functions and classes
    return content.replace(
      /(export\s+(?:class|function|const)\s+\w+)/g,
      '/**\n * Auto-generated by Unjucks TypeScript Plugin\n */\n$1'
    );
  }

  async formatWithPrettier(content, options) {
    // Simulated prettier formatting
    return content;
  }
}

// Validation Plugin
class ValidationPlugin extends UnjucksPlugin {
  constructor(options = {}) {
    super('validation', '1.0.0', {
      strictMode: true,
      validateSchema: true,
      validateFiles: true,
      ...options
    });
  }

  async initialize() {
    this.registerHook('pre-generate', async (context) => {
      return this.validateGenerationContext(context);
    }, 20); // Higher priority

    this.registerHook('validate-template', async (context) => {
      return this.validateTemplateStructure(context);
    }, 10);

    this.registerHook('validate-variables', async (context) => {
      return this.validateVariableSchema(context);
    }, 10);
  }

  async validateGenerationContext(context) {
    const errors = [];
    const warnings = [];

    // Validate required fields
    if (!context.templatePath) {
      errors.push('Template path is required');
    }

    if (!context.outputPath) {
      errors.push('Output path is required');
    }

    // Validate variables
    if (context.variables && typeof context.variables !== 'object') {
      errors.push('Variables must be an object');
    }

    // Check for potential conflicts
    if (context.outputPath && await this.pathExists(context.outputPath)) {
      if (!context.force) {
        warnings.push(`Output path ${context.outputPath} already exists. Use --force to overwrite`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  async validateTemplateStructure(context) {
    const { templatePath } = context;
    const errors = [];

    try {
      // Check if template directory exists
      if (!await this.pathExists(templatePath)) {
        errors.push(`Template path does not exist: ${templatePath}`);
        return { valid: false, errors };
      }

      // Validate template files
      const templateFiles = await this.getTemplateFiles(templatePath);
      
      for (const file of templateFiles) {
        const validation = await this.validateTemplateFile(file);
        if (!validation.valid) {
          errors.push(...validation.errors.map(err => `${file}: ${err}`));
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        templateFiles: templateFiles.length
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Template validation failed: ${error.message}`]
      };
    }
  }

  async validateVariableSchema(context) {
    const { variables, schema } = context;
    
    if (!schema) {
      return { valid: true, message: 'No schema provided, skipping validation' };
    }

    const errors = [];

    try {
      // Validate required fields
      if (schema.required) {
        for (const requiredField of schema.required) {
          if (!(requiredField in variables)) {
            errors.push(`Required variable '${requiredField}' is missing`);
          }
        }
      }

      // Validate field types and formats
      if (schema.properties) {
        for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
          if (fieldName in variables) {
            const fieldValidation = this.validateField(
              fieldName,
              variables[fieldName],
              fieldSchema
            );
            
            if (!fieldValidation.valid) {
              errors.push(...fieldValidation.errors);
            }
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Schema validation failed: ${error.message}`]
      };
    }
  }

  validateField(fieldName, value, schema) {
    const errors = [];

    // Type validation
    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== schema.type) {
        errors.push(`Field '${fieldName}' should be of type '${schema.type}', got '${actualType}'`);
      }
    }

    // Pattern validation
    if (schema.pattern && typeof value === 'string') {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push(`Field '${fieldName}' does not match required pattern: ${schema.pattern}`);
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`Field '${fieldName}' must be one of: ${schema.enum.join(', ')}`);
    }

    // Range validation for numbers
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`Field '${fieldName}' must be >= ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`Field '${fieldName}' must be <= ${schema.maximum}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async pathExists(path) {
    try {
      const fs = require('fs').promises;
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async getTemplateFiles(templatePath) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const files = [];
    const entries = await fs.readdir(templatePath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(templatePath, entry.name);
      if (entry.isFile() && (entry.name.endsWith('.njk') || entry.name.endsWith('.ejs'))) {
        files.push(fullPath);
      } else if (entry.isDirectory()) {
        const subFiles = await this.getTemplateFiles(fullPath);
        files.push(...subFiles);
      }
    }
    
    return files;
  }

  async validateTemplateFile(filePath) {
    const fs = require('fs').promises;
    const errors = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Check for unclosed template tags
      const njkTags = content.match(/{%[^%]*%}/g) || [];
      const openTags = njkTags.filter(tag => !tag.includes('end'));
      const closeTags = njkTags.filter(tag => tag.includes('end'));
      
      if (openTags.length !== closeTags.length) {
        errors.push('Mismatched template tags detected');
      }

      // Check for undefined variable references
      const variableRefs = content.match(/{{\s*([^}]+)\s*}}/g) || [];
      for (const ref of variableRefs) {
        const varName = ref.replace(/[{}]/g, '').trim().split('.')[0];
        // This would need to be checked against available variables
        // For now, just check for common typos
        if (varName.includes('undefind') || varName.includes('nul')) {
          errors.push(`Potential typo in variable reference: ${ref}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };

    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to read template file: ${error.message}`]
      };
    }
  }
}

// Performance Monitoring Plugin
class PerformancePlugin extends UnjucksPlugin {
  constructor(options = {}) {
    super('performance-monitor', '1.0.0', {
      trackGeneration: true,
      trackFileOperations: true,
      reportThreshold: 1000, // ms
      ...options
    });
    
    this.metrics = {
      generations: [],
      fileOperations: [],
      startTime: null,
      endTime: null
    };
  }

  async initialize() {
    this.registerHook('pre-generate', async (context) => {
      return this.startPerformanceTracking(context);
    }, 30);

    this.registerHook('post-generate', async (context) => {
      return this.endPerformanceTracking(context);
    }, -10); // Lower priority to run after other post-hooks

    this.registerHook('file-write', async (context) => {
      return this.trackFileOperation(context, 'write');
    }, 0);

    this.registerHook('file-read', async (context) => {
      return this.trackFileOperation(context, 'read');
    }, 0);
  }

  async startPerformanceTracking(context) {
    this.metrics.startTime = process.hrtime.bigint();
    this.metrics.generations.push({
      id: context.generationId || this.generateId(),
      template: context.templatePath,
      startTime: this.metrics.startTime,
      variables: Object.keys(context.variables || {}).length
    });

    return {
      message: 'Performance tracking started',
      trackingId: context.generationId
    };
  }

  async endPerformanceTracking(context) {
    this.metrics.endTime = process.hrtime.bigint();
    const duration = Number(this.metrics.endTime - this.metrics.startTime) / 1e6; // Convert to ms

    const generation = this.metrics.generations.find(g => 
      g.id === context.generationId || g.template === context.templatePath
    );

    if (generation) {
      generation.endTime = this.metrics.endTime;
      generation.duration = duration;
      generation.filesGenerated = context.files ? context.files.length : 0;
    }

    // Report if duration exceeds threshold
    if (duration > this.options.reportThreshold) {
      console.warn(`Generation took ${duration.toFixed(2)}ms (threshold: ${this.options.reportThreshold}ms)`);
    }

    return {
      message: 'Performance tracking completed',
      duration: `${duration.toFixed(2)}ms`,
      metrics: this.getPerformanceReport()
    };
  }

  async trackFileOperation(context, operation) {
    const startTime = process.hrtime.bigint();
    
    // The actual file operation happens outside this hook
    // This is just for tracking
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e6;

    this.metrics.fileOperations.push({
      operation,
      file: context.filePath,
      duration,
      size: context.size || 0,
      timestamp: Date.now()
    });

    return {
      operation,
      duration: `${duration.toFixed(2)}ms`
    };
  }

  getPerformanceReport() {
    const totalGenerations = this.metrics.generations.length;
    const completedGenerations = this.metrics.generations.filter(g => g.endTime);
    
    const avgDuration = completedGenerations.length > 0 
      ? completedGenerations.reduce((sum, g) => sum + g.duration, 0) / completedGenerations.length
      : 0;

    const fileOpsCount = this.metrics.fileOperations.length;
    const avgFileOpDuration = fileOpsCount > 0
      ? this.metrics.fileOperations.reduce((sum, op) => sum + op.duration, 0) / fileOpsCount
      : 0;

    return {
      summary: {
        totalGenerations,
        completedGenerations: completedGenerations.length,
        averageDuration: `${avgDuration.toFixed(2)}ms`,
        fileOperations: fileOpsCount,
        averageFileOpDuration: `${avgFileOpDuration.toFixed(2)}ms`
      },
      recent: completedGenerations.slice(-5).map(g => ({
        template: g.template.split('/').pop(),
        duration: `${g.duration.toFixed(2)}ms`,
        filesGenerated: g.filesGenerated
      }))
    };
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

/**
 * =============================================================================
 * PLUGIN USAGE EXAMPLES
 * =============================================================================
 */

// Initialize Plugin Manager
const pluginManager = new PluginManager();

// Usage Example 1: Register plugins during startup
async function initializePlugins() {
  try {
    // Register core plugins
    await pluginManager.registerPlugin(new TypeScriptGeneratorPlugin({
      strict: true,
      generateDocs: true
    }));

    await pluginManager.registerPlugin(new ValidationPlugin({
      strictMode: true
    }));

    await pluginManager.registerPlugin(new PerformancePlugin({
      reportThreshold: 500
    }));

    console.log('All plugins registered successfully');
    console.log('Registered plugins:', pluginManager.listPlugins());

  } catch (error) {
    console.error('Plugin initialization failed:', error);
  }
}

// Usage Example 2: Execute generation with plugin hooks
async function generateWithPlugins(templatePath, outputPath, variables) {
  const context = {
    templatePath,
    outputPath,
    variables,
    generationId: Date.now().toString()
  };

  try {
    // Pre-generation hooks
    console.log('Executing pre-generation hooks...');
    const preResults = await pluginManager.executeHooks('pre-generate', context);
    
    // Check for validation errors
    const validationErrors = preResults
      .filter(result => result.result && result.result.errors)
      .flatMap(result => result.result.errors);

    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    // Simulate file generation process
    console.log('Generating files...');
    const files = await simulateGeneration(context);
    context.files = files;

    // Post-generation hooks
    console.log('Executing post-generation hooks...');
    const postResults = await pluginManager.executeHooks('post-generate', context);

    return {
      success: true,
      files,
      pluginResults: {
        pre: preResults,
        post: postResults
      }
    };

  } catch (error) {
    console.error('Generation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Simulate file generation
async function simulateGeneration(context) {
  const { templatePath, outputPath, variables } = context;
  
  return [
    {
      path: `${outputPath}/index.ts`,
      content: `// Generated from ${templatePath}\nexport class ${variables.className} {}\n`,
      size: 1024
    },
    {
      path: `${outputPath}/types.ts`,
      content: `// Type definitions\nexport interface ${variables.className}Props {}\n`,
      size: 512
    }
  ];
}

// Usage Example 3: Custom plugin development
class CustomDocumentationPlugin extends UnjucksPlugin {
  constructor() {
    super('documentation-generator', '1.0.0', {
      format: 'markdown',
      includeExamples: true
    });
  }

  async initialize() {
    this.registerHook('post-generate', async (context) => {
      return this.generateDocumentation(context);
    }, 5);
  }

  async generateDocumentation(context) {
    const { files, variables } = context;
    
    const docContent = this.createDocumentationContent(files, variables);
    
    // Add documentation file to the generation result
    if (!context.files) context.files = [];
    context.files.push({
      path: `${context.outputPath}/README.md`,
      content: docContent,
      generated: true,
      type: 'documentation'
    });

    return {
      message: 'Documentation generated',
      documentationFile: `${context.outputPath}/README.md`
    };
  }

  createDocumentationContent(files, variables) {
    const fileList = files
      .map(file => `- \`${file.path}\` - ${this.getFileDescription(file)}`)
      .join('\n');

    return `# Generated Code Documentation

## Overview
This code was generated using Unjucks v2 with the following configuration:

### Variables Used
${Object.entries(variables)
  .map(([key, value]) => `- **${key}**: ${JSON.stringify(value)}`)
  .join('\n')}

### Generated Files
${fileList}

## Usage
[Add usage examples here]

---
*Generated by Unjucks Documentation Plugin v${this.version}*
`;
  }

  getFileDescription(file) {
    if (file.path.endsWith('.ts')) return 'TypeScript source file';
    if (file.path.endsWith('.test.ts')) return 'Unit test file';
    if (file.path.endsWith('.md')) return 'Documentation file';
    return 'Generated file';
  }
}

// Export for use in other modules
module.exports = {
  UnjucksPlugin,
  PluginManager,
  TypeScriptGeneratorPlugin,
  ValidationPlugin,
  PerformancePlugin,
  CustomDocumentationPlugin,
  
  // Helper functions
  initializePlugins,
  generateWithPlugins
};

/**
 * =============================================================================
 * ADVANCED PLUGIN EXAMPLES
 * =============================================================================
 */

// Database Integration Plugin
class DatabaseIntegrationPlugin extends UnjucksPlugin {
  constructor(options = {}) {
    super('database-integration', '1.0.0', {
      connectionString: process.env.DATABASE_URL,
      trackGenerations: true,
      ...options
    });
  }

  async initialize() {
    if (this.options.trackGenerations) {
      this.registerHook('post-generate', async (context) => {
        return this.logGenerationToDatabase(context);
      }, 0);
    }

    this.registerHook('validate-schema', async (context) => {
      return this.validateDatabaseSchema(context);
    }, 10);
  }

  async logGenerationToDatabase(context) {
    // Log generation details to database for analytics
    const logEntry = {
      template: context.templatePath,
      timestamp: new Date(),
      variables: JSON.stringify(context.variables),
      files_generated: context.files ? context.files.length : 0,
      success: true
    };

    // Simulated database insert
    console.log('Logging generation to database:', logEntry);
    return { logged: true, entry: logEntry };
  }

  async validateDatabaseSchema(context) {
    if (!context.databaseSchema) {
      return { valid: true, message: 'No database schema to validate' };
    }

    // Validate schema against actual database
    const errors = [];
    // ... validation logic
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Git Integration Plugin
class GitIntegrationPlugin extends UnjucksPlugin {
  constructor(options = {}) {
    super('git-integration', '1.0.0', {
      autoCommit: false,
      branchPrefix: 'generated/',
      commitMessage: 'Generated code with Unjucks',
      ...options
    });
  }

  async initialize() {
    this.registerHook('post-generate', async (context) => {
      return this.handleGitOperations(context);
    }, -5); // Low priority to run after other operations
  }

  async handleGitOperations(context) {
    const operations = [];

    if (this.options.autoCommit) {
      operations.push(await this.commitGeneratedFiles(context));
    }

    if (this.options.createBranch) {
      operations.push(await this.createFeatureBranch(context));
    }

    return {
      gitOperations: operations
    };
  }

  async commitGeneratedFiles(context) {
    // Simulated git operations
    const files = context.files || [];
    const filePaths = files.map(f => f.path);

    console.log(`Would commit ${filePaths.length} files with message: "${this.options.commitMessage}"`);
    
    return {
      operation: 'commit',
      files: filePaths,
      message: this.options.commitMessage,
      simulated: true
    };
  }

  async createFeatureBranch(context) {
    const branchName = `${this.options.branchPrefix}${Date.now()}`;
    console.log(`Would create branch: ${branchName}`);
    
    return {
      operation: 'create-branch',
      branchName,
      simulated: true
    };
  }
}

// Advanced example combining all plugins
async function fullExampleWithAllPlugins() {
  const manager = new PluginManager();

  // Register all plugins
  await manager.registerPlugin(new TypeScriptGeneratorPlugin({
    strict: true,
    generateDocs: true
  }));

  await manager.registerPlugin(new ValidationPlugin({
    strictMode: true
  }));

  await manager.registerPlugin(new PerformancePlugin({
    reportThreshold: 200
  }));

  await manager.registerPlugin(new CustomDocumentationPlugin());
  
  await manager.registerPlugin(new DatabaseIntegrationPlugin({
    trackGenerations: true
  }));

  await manager.registerPlugin(new GitIntegrationPlugin({
    autoCommit: true,
    commitMessage: 'Generated TypeScript service with full validation'
  }));

  // Execute generation with all plugins
  const result = await generateWithPlugins(
    './templates/service',
    './output/user-service',
    {
      className: 'UserService',
      databaseType: 'postgresql',
      enableAuth: true
    }
  );

  console.log('Generation complete:', result);
  
  // Get performance report
  const performancePlugin = manager.getPlugin('performance-monitor');
  console.log('Performance Report:', performancePlugin.getPerformanceReport());
}

// Run the full example (commented out for safety)
// fullExampleWithAllPlugins().catch(console.error);