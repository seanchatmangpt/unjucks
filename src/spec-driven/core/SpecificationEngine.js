/**
 * SpecificationEngine - Core engine for processing specifications
 * 
 * This engine handles the complete lifecycle of specification processing,
 * from parsing and validation to plan generation and execution.
 */

import fs from 'fs-extra';
import path from 'node:path';
import yaml from 'yaml';
import { SPEC_API_VERSION, SPEC_KIND_PROJECT, isValidSpecification } from './types.js';
import { ValidationEngine } from './ValidationEngine.js';
import { PlanGenerator } from './PlanGenerator.js';
import { TaskOrchestrator } from './TaskOrchestrator.js';

export class SpecificationEngine {
  constructor(options = {}) {
    this.options = {
      templatesDir: '_templates',
      outputDir: './generated',
      specsDir: './specs',
      plansDir: './plans',
      tasksDir: './tasks',
      validateOnParse: true,
      enableMcpIntegration: true,
      ...options
    };
    
    this.validationEngine = new ValidationEngine({
      enableMcpIntegration: this.options.enableMcpIntegration
    });
    
    this.planGenerator = new PlanGenerator({
      templatesDir: this.options.templatesDir,
      validationEngine: this.validationEngine
    });
    
    this.taskOrchestrator = new TaskOrchestrator({
      outputDir: this.options.outputDir,
      validationEngine: this.validationEngine
    });
  }

  /**
   * Parse a specification file
   * @param {string} specPath - Path to specification file
   * @returns {Promise<ProjectSpecification>}
   */
  async parseSpec(specPath) {
    try {
      const specFile = path.resolve(specPath);
      
      if (!(await fs.pathExists(specFile))) {
        throw new Error(`Specification file not found: ${specPath}`);
      }
      
      const content = await fs.readFile(specFile, 'utf8');
      const spec = yaml.parse(content);
      
      // Validate basic structure
      if (!isValidSpecification(spec)) {
        throw new Error('Invalid specification format');
      }
      
      // Set defaults
      spec.metadata = {
        apiVersion: SPEC_API_VERSION,
        kind: SPEC_KIND_PROJECT,
        ...spec.metadata
      };
      
      // Add source path for reference
      spec.metadata.sourcePath = specFile;
      spec.metadata.parsedAt = new Date().toISOString();
      
      // Validate specification if enabled
      if (this.options.validateOnParse) {
        const validationResult = await this.validateSpec(spec);
        if (!validationResult.valid) {
          const errors = validationResult.errors.map(e => e.message).join(', ');
          throw new Error(`Specification validation failed: ${errors}`);
        }
        spec.validationResult = validationResult;
      }
      
      return spec;
    } catch (error) {
      throw new Error(`Failed to parse specification: ${error.message}`);
    }
  }

  /**
   * Validate a specification
   * @param {ProjectSpecification} spec - Specification to validate
   * @returns {Promise<ValidationResult>}
   */
  async validateSpec(spec) {
    try {
      return await this.validationEngine.validateSpecification(spec);
    } catch (error) {
      return {
        valid: false,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: error.message,
          severity: 'error',
          path: 'specification',
          context: { error: error.message }
        }],
        warnings: [],
        metrics: {},
        context: {}
      };
    }
  }

  /**
   * Generate execution plan from specification
   * @param {ProjectSpecification} spec - Source specification
   * @returns {Promise<ExecutionPlan>}
   */
  async generatePlan(spec) {
    try {
      // Validate spec first
      const validationResult = await this.validateSpec(spec);
      if (!validationResult.valid) {
        throw new Error('Cannot generate plan from invalid specification');
      }
      
      return await this.planGenerator.generatePlan(spec);
    } catch (error) {
      throw new Error(`Failed to generate execution plan: ${error.message}`);
    }
  }

  /**
   * Generate task list from execution plan
   * @param {ExecutionPlan} plan - Execution plan
   * @returns {Promise<TaskList>}
   */
  async generateTasks(plan) {
    try {
      return await this.taskOrchestrator.generateTasks(plan);
    } catch (error) {
      throw new Error(`Failed to generate tasks: ${error.message}`);
    }
  }

  /**
   * Execute a complete specification workflow
   * @param {string} specPath - Path to specification file
   * @param {Object} options - Execution options
   * @returns {Promise<ExecutionResult>}
   */
  async executeSpec(specPath, options = {}) {
    const startTime = new Date();
    const executionId = this.generateExecutionId();
    
    try {
      // Parse specification
      const spec = await this.parseSpec(specPath);
      
      // Generate execution plan
      const plan = await this.generatePlan(spec);
      plan.id = executionId;
      
      // Optionally save plan
      if (options.savePlan) {
        const planPath = path.join(this.options.plansDir, `${plan.id}.plan.yaml`);
        await this.savePlan(plan, planPath);
      }
      
      // Generate tasks
      const taskList = await this.generateTasks(plan);
      
      // Optionally save tasks
      if (options.saveTasks) {
        const tasksPath = path.join(this.options.tasksDir, `${taskList.id}.tasks.yaml`);
        await this.saveTaskList(taskList, tasksPath);
      }
      
      // Execute tasks
      const result = await this.taskOrchestrator.executeTasks(taskList, options);
      
      // Calculate metrics
      const endTime = new Date();
      result.metrics = {
        ...result.metrics,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        executionId
      };
      
      return result;
    } catch (error) {
      const endTime = new Date();
      return {
        success: false,
        executionId,
        error: error.message,
        metrics: {
          startTime,
          endTime,
          duration: endTime.getTime() - startTime.getTime(),
          tasksCompleted: 0,
          tasksTotal: 0,
          filesGenerated: 0
        },
        phases: [],
        tasks: [],
        validation: {
          valid: false,
          errors: [{
            code: 'EXECUTION_ERROR',
            message: error.message,
            severity: 'error'
          }],
          warnings: []
        },
        artifacts: {}
      };
    }
  }

  /**
   * Map tasks to existing generators
   * @param {TaskList} taskList - Task list to map
   * @returns {Promise<GeneratorMapping[]>}
   */
  async mapToGenerators(taskList) {
    try {
      const mappings = [];
      
      for (const task of taskList.tasks) {
        const mapping = await this.createGeneratorMapping(task);
        mappings.push(mapping);
      }
      
      return mappings;
    } catch (error) {
      throw new Error(`Failed to map tasks to generators: ${error.message}`);
    }
  }

  /**
   * Create a specification from template
   * @param {string} templateId - Template identifier
   * @param {Object} variables - Template variables
   * @returns {Promise<ProjectSpecification>}
   */
  async createFromTemplate(templateId, variables = {}) {
    try {
      // Load specification template
      const templatePath = path.join(this.options.templatesDir, 'specs', `${templateId}.spec.yaml`);
      
      if (!(await fs.pathExists(templatePath))) {
        throw new Error(`Specification template not found: ${templateId}`);
      }
      
      const templateContent = await fs.readFile(templatePath, 'utf8');
      
      // Simple variable substitution (could be enhanced with full template engine)
      let processedContent = templateContent;
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        processedContent = processedContent.replace(regex, String(value));
      }
      
      const spec = yaml.parse(processedContent);
      
      // Set metadata
      spec.metadata = {
        ...spec.metadata,
        createdFrom: templateId,
        createdAt: new Date().toISOString(),
        variables: variables
      };
      
      return spec;
    } catch (error) {
      throw new Error(`Failed to create specification from template: ${error.message}`);
    }
  }

  /**
   * List available specification templates
   * @returns {Promise<SpecificationIndex[]>}
   */
  async listSpecTemplates() {
    try {
      const templates = [];
      const specsTemplatesDir = path.join(this.options.templatesDir, 'specs');
      
      if (!(await fs.pathExists(specsTemplatesDir))) {
        return templates;
      }
      
      const files = await fs.readdir(specsTemplatesDir);
      
      for (const file of files) {
        if (file.endsWith('.spec.yaml') || file.endsWith('.spec.yml')) {
          const templatePath = path.join(specsTemplatesDir, file);
          const content = await fs.readFile(templatePath, 'utf8');
          const template = yaml.parse(content);
          
          if (template.metadata) {
            templates.push({
              id: path.basename(file, path.extname(file)).replace('.spec', ''),
              name: template.metadata.name || 'Unnamed Template',
              description: template.metadata.description || 'No description',
              version: template.metadata.version || '1.0.0',
              tags: template.metadata.tags || [],
              created: new Date(),
              modified: new Date(),
              metadata: template.metadata
            });
          }
        }
      }
      
      return templates;
    } catch (error) {
      console.warn('Failed to list specification templates:', error);
      return [];
    }
  }

  /**
   * Save execution plan to file
   * @param {ExecutionPlan} plan - Execution plan to save
   * @param {string} filePath - File path to save to
   * @returns {Promise<void>}
   */
  async savePlan(plan, filePath) {
    try {
      await fs.ensureDir(path.dirname(filePath));
      const yamlContent = yaml.stringify(plan, { indent: 2 });
      await fs.writeFile(filePath, yamlContent, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save plan: ${error.message}`);
    }
  }

  /**
   * Load execution plan from file
   * @param {string} filePath - File path to load from
   * @returns {Promise<ExecutionPlan>}
   */
  async loadPlan(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return yaml.parse(content);
    } catch (error) {
      throw new Error(`Failed to load plan: ${error.message}`);
    }
  }

  /**
   * Save task list to file
   * @param {TaskList} taskList - Task list to save
   * @param {string} filePath - File path to save to
   * @returns {Promise<void>}
   */
  async saveTaskList(taskList, filePath) {
    try {
      await fs.ensureDir(path.dirname(filePath));
      const yamlContent = yaml.stringify(taskList, { indent: 2 });
      await fs.writeFile(filePath, yamlContent, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save task list: ${error.message}`);
    }
  }

  /**
   * Load task list from file
   * @param {string} filePath - File path to load from
   * @returns {Promise<TaskList>}
   */
  async loadTaskList(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return yaml.parse(content);
    } catch (error) {
      throw new Error(`Failed to load task list: ${error.message}`);
    }
  }

  /**
   * Create generator mapping for a task
   * @private
   * @param {Task} task - Task to create mapping for
   * @returns {Promise<GeneratorMapping>}
   */
  async createGeneratorMapping(task) {
    const { generator: generatorName, template: templateName, variables, outputPath } = task.generator;
    
    return {
      generator: generatorName,
      template: templateName,
      variables: variables || {},
      outputPath: outputPath || task.output?.path || '.',
      options: {
        force: false,
        dry: false,
        ...task.configuration
      }
    };
  }

  /**
   * Generate unique execution ID
   * @private
   * @returns {string}
   */
  generateExecutionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `exec-${timestamp}-${random}`;
  }

  /**
   * Get specification engine statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      const stats = {
        specifications: 0,
        plans: 0,
        tasks: 0,
        templates: 0,
        lastExecution: null
      };
      
      // Count specifications
      if (await fs.pathExists(this.options.specsDir)) {
        const specFiles = await fs.readdir(this.options.specsDir);
        stats.specifications = specFiles.filter(f => f.endsWith('.spec.yaml') || f.endsWith('.spec.yml')).length;
      }
      
      // Count plans
      if (await fs.pathExists(this.options.plansDir)) {
        const planFiles = await fs.readdir(this.options.plansDir);
        stats.plans = planFiles.filter(f => f.endsWith('.plan.yaml') || f.endsWith('.plan.yml')).length;
      }
      
      // Count tasks
      if (await fs.pathExists(this.options.tasksDir)) {
        const taskFiles = await fs.readdir(this.options.tasksDir);
        stats.tasks = taskFiles.filter(f => f.endsWith('.tasks.yaml') || f.endsWith('.tasks.yml')).length;
      }
      
      // Count templates
      const templates = await this.listSpecTemplates();
      stats.templates = templates.length;
      
      return stats;
    } catch (error) {
      console.warn('Failed to get statistics:', error);
      return {
        specifications: 0,
        plans: 0,
        tasks: 0,
        templates: 0,
        error: error.message
      };
    }
  }
}