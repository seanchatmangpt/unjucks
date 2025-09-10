/**
 * Interactive Mode Implementation
 * 
 * Provides interactive prompts for template selection, parameter input, and guided workflows
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { z } from 'zod';
import { TemplateScanner } from '../lib/template-scanner.js';
import { FrontmatterParser } from '../lib/frontmatter-parser.js';

// Interactive session schema
const InteractiveSessionSchema = z.object({
  generator: z.string().optional(),
  template: z.string().optional(),
  name: z.string().optional(),
  flags: z.record(z.any()).optional(),
  preferences: z.object({
    style: z.enum(['hygen', 'explicit']).optional(),
    verbose: z.boolean().optional(),
    dry: z.boolean().optional()
  }).optional()
});

export class InteractiveMode {
  constructor() {
    this.templateScanner = new TemplateScanner();
    this.frontmatterParser = new FrontmatterParser();
    this.session = {
      generator: null,
      template: null,
      name: null,
      flags: {},
      preferences: {}
    };
  }

  /**
   * Start interactive session
   * @param {Object} options - Initial options
   * @returns {Promise<Object>} Session result
   */
  async start(options = {}) {
    try {
      console.log(chalk.blue.bold('🎯 Interactive Template Generation'));
      console.log(chalk.gray('Let\'s build something awesome together!\n'));

      // Initialize session with any provided options
      this.session = { ...this.session, ...options };

      // Step 1: Generator selection
      if (!this.session.generator) {
        await this.selectGenerator();
      }

      // Step 2: Template selection
      if (!this.session.template) {
        await this.selectTemplate();
      }

      // Step 3: Collect required parameters
      await this.collectParameters();

      // Step 4: Configure output options
      await this.configureOutput();

      // Step 5: Preview and confirm
      const confirmed = await this.previewAndConfirm();
      
      if (!confirmed) {
        return { success: false, cancelled: true };
      }

      return {
        success: true,
        session: this.session,
        command: this.buildCommand()
      };

    } catch (error) {
      console.error(chalk.red(`Interactive session error: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  /**
   * Select generator interactively
   */
  async selectGenerator() {
    console.log(chalk.yellow('📁 Select a generator:'));
    
    const generators = await this.templateScanner.getGenerators();
    
    if (generators.length === 0) {
      throw new Error('No generators found. Run "unjucks init" to set up templates.');
    }

    const choices = generators.map(gen => ({
      name: `${gen.name} ${chalk.gray(`(${gen.templates.length} templates)`)}`,
      value: gen.name,
      short: gen.name
    }));

    choices.push(new inquirer.Separator());
    choices.push({
      name: chalk.dim('↻ Refresh template list'),
      value: '__refresh__'
    });

    const { generator } = await inquirer.prompt([{
      type: 'list',
      name: 'generator',
      message: 'Choose a generator:',
      choices,
      pageSize: 10
    }]);

    if (generator === '__refresh__') {
      await this.templateScanner.refresh();
      return this.selectGenerator();
    }

    this.session.generator = generator;
    console.log(chalk.green(`✓ Selected generator: ${generator}\n`));
  }

  /**
   * Select template interactively
   */
  async selectTemplate() {
    console.log(chalk.yellow(`📄 Select a template from ${this.session.generator}:`));
    
    const templates = await this.templateScanner.getTemplatesForGenerator(this.session.generator);
    
    if (templates.length === 0) {
      throw new Error(`No templates found for generator: ${this.session.generator}`);
    }

    const choices = await Promise.all(templates.map(async template => {
      const frontmatter = await this.getFrontmatterSafe(template.path);
      const description = frontmatter?.description || 'No description';
      
      return {
        name: `${template.name} ${chalk.gray(`- ${description}`)}`,
        value: template.name,
        short: template.name
      };
    }));

    choices.push(new inquirer.Separator());
    choices.push({
      name: chalk.dim('← Back to generator selection'),
      value: '__back__'
    });

    const { template } = await inquirer.prompt([{
      type: 'list',
      name: 'template',
      message: 'Choose a template:',
      choices,
      pageSize: 10
    }]);

    if (template === '__back__') {
      this.session.generator = null;
      return this.selectGenerator();
    }

    this.session.template = template;
    console.log(chalk.green(`✓ Selected template: ${template}\n`));
  }

  /**
   * Collect required parameters
   */
  async collectParameters() {
    console.log(chalk.yellow('📝 Configure template parameters:'));
    
    const templatePath = await this.templateScanner.getTemplatePath(
      this.session.generator, 
      this.session.template
    );
    
    const frontmatter = await this.getFrontmatterSafe(templatePath);
    const variables = await this.extractVariables(templatePath);

    // Collect name if not provided
    if (!this.session.name) {
      const { name } = await inquirer.prompt([{
        type: 'input',
        name: 'name',
        message: 'Enter the component/file name:',
        validate: input => input.trim().length > 0 ? true : 'Name is required'
      }]);
      this.session.name = name;
    }

    // Collect additional variables
    if (variables.length > 0) {
      console.log(chalk.gray(`Found ${variables.length} template variables:\n`));
      
      for (const variable of variables) {
        await this.collectVariable(variable, frontmatter);
      }
    }

    console.log(chalk.green('✓ Parameters collected\n'));
  }

  /**
   * Collect individual variable value
   */
  async collectVariable(variable, frontmatter) {
    const config = frontmatter?.variables?.[variable] || {};
    const type = config.type || 'string';
    const description = config.description || `Value for ${variable}`;
    const defaultValue = config.default;
    const required = config.required !== false;

    let prompt;

    switch (type) {
      case 'boolean':
        prompt = {
          type: 'confirm',
          name: 'value',
          message: description,
          default: defaultValue || false
        };
        break;
      
      case 'choice':
        prompt = {
          type: 'list',
          name: 'value',
          message: description,
          choices: config.choices || ['yes', 'no'],
          default: defaultValue
        };
        break;
      
      case 'multiline':
        prompt = {
          type: 'editor',
          name: 'value',
          message: description,
          default: defaultValue
        };
        break;
      
      default:
        prompt = {
          type: 'input',
          name: 'value',
          message: description,
          default: defaultValue,
          validate: required ? 
            (input => input.trim().length > 0 ? true : `${variable} is required`) :
            () => true
        };
    }

    const { value } = await inquirer.prompt([prompt]);
    this.session.flags[variable] = value;
  }

  /**
   * Configure output options
   */
  async configureOutput() {
    console.log(chalk.yellow('⚙️  Configure output options:'));

    const questions = [
      {
        type: 'input',
        name: 'dest',
        message: 'Output destination:',
        default: this.session.flags.dest || './',
        filter: input => input.trim()
      },
      {
        type: 'confirm',
        name: 'dry',
        message: 'Dry run (preview only)?',
        default: false
      },
      {
        type: 'confirm',
        name: 'force',
        message: 'Force overwrite existing files?',
        default: false
      },
      {
        type: 'list',
        name: 'style',
        message: 'Preferred command style:',
        choices: [
          { name: 'Hygen-style (unjucks component react Button)', value: 'hygen' },
          { name: 'Explicit (unjucks generate component react --name=Button)', value: 'explicit' }
        ],
        default: 'hygen'
      }
    ];

    const answers = await inquirer.prompt(questions);
    
    Object.assign(this.session.flags, {
      dest: answers.dest,
      dry: answers.dry,
      force: answers.force
    });
    
    this.session.preferences.style = answers.style;
    
    console.log(chalk.green('✓ Output options configured\n'));
  }

  /**
   * Preview and confirm generation
   */
  async previewAndConfirm() {
    console.log(chalk.blue.bold('📋 Generation Preview:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    console.log(chalk.yellow('Generator:'), this.session.generator);
    console.log(chalk.yellow('Template: '), this.session.template);
    console.log(chalk.yellow('Name:     '), this.session.name);
    console.log(chalk.yellow('Output:   '), this.session.flags.dest);
    
    if (Object.keys(this.session.flags).length > 2) { // More than just dest and standard flags
      console.log(chalk.yellow('Flags:'));
      Object.entries(this.session.flags).forEach(([key, value]) => {
        if (!['dest', 'dry', 'force'].includes(key)) {
          console.log(chalk.gray(`  --${key}:`), value);
        }
      });
    }

    console.log(chalk.yellow('Command:  '), chalk.cyan(this.buildCommand()));
    console.log(chalk.gray('─'.repeat(50)));

    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: 'Generate files with these settings?',
      default: true
    }]);

    return confirmed;
  }

  /**
   * Build command string from session
   */
  buildCommand() {
    const style = this.session.preferences.style || 'hygen';
    
    if (style === 'explicit') {
      let cmd = `unjucks generate ${this.session.generator} ${this.session.template}`;
      
      if (this.session.name) {
        cmd += ` --name=${this.session.name}`;
      }
      
      Object.entries(this.session.flags).forEach(([key, value]) => {
        if (value === true) {
          cmd += ` --${key}`;
        } else if (value !== false && value !== null && value !== undefined) {
          cmd += ` --${key}=${value}`;
        }
      });
      
      return cmd;
    } else {
      let cmd = `unjucks ${this.session.generator} ${this.session.template}`;
      
      if (this.session.name) {
        cmd += ` ${this.session.name}`;
      }
      
      Object.entries(this.session.flags).forEach(([key, value]) => {
        if (value === true) {
          cmd += ` --${key}`;
        } else if (value !== false && value !== null && value !== undefined) {
          cmd += ` --${key}=${value}`;
        }
      });
      
      return cmd;
    }
  }

  /**
   * Get frontmatter safely without throwing
   */
  async getFrontmatterSafe(templatePath) {
    try {
      return await this.frontmatterParser.parse(templatePath);
    } catch (error) {
      return {};
    }
  }

  /**
   * Extract variables from template
   */
  async extractVariables(templatePath) {
    try {
      const content = await this.templateScanner.readTemplate(templatePath);
      const variables = new Set();
      
      // Extract Nunjucks variables: {{ variable }}
      const variableMatches = content.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g);
      if (variableMatches) {
        variableMatches.forEach(match => {
          const variable = match.replace(/\{\{\s*|\s*\}\}/g, '');
          if (!['name', 'Name', 'NAME'].includes(variable)) {
            variables.add(variable);
          }
        });
      }
      
      return Array.from(variables);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not extract variables from ${templatePath}`));
      return [];
    }
  }

  /**
   * Quick start mode - minimal prompts for common use cases
   * @param {string} type - Type of quick start ('component', 'page', 'api', etc.)
   */
  async quickStart(type) {
    console.log(chalk.blue.bold(`🚀 Quick Start: ${type}`));
    
    const quickTemplates = {
      component: { generator: 'component', template: 'react' },
      page: { generator: 'page', template: 'react' },
      api: { generator: 'api', template: 'endpoint' },
      test: { generator: 'test', template: 'unit' }
    };

    const template = quickTemplates[type];
    if (!template) {
      throw new Error(`Unknown quick start type: ${type}`);
    }

    this.session.generator = template.generator;
    this.session.template = template.template;

    // Just collect name and basic options
    const { name } = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: `Enter ${type} name:`,
      validate: input => input.trim().length > 0 ? true : 'Name is required'
    }]);

    this.session.name = name;

    // Quick flags
    const { withTests, typescript } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'withTests',
        message: 'Include tests?',
        default: true
      },
      {
        type: 'confirm',
        name: 'typescript',
        message: 'Use TypeScript?',
        default: false
      }
    ]);

    this.session.flags = { withTests, typescript };

    return {
      success: true,
      session: this.session,
      command: this.buildCommand()
    };
  }

  /**
   * Guided workflow for complex multi-step generation
   */
  async guidedWorkflow() {
    console.log(chalk.blue.bold('🎯 Guided Workflow'));
    console.log(chalk.gray('Create multiple related files in a coordinated workflow\n'));

    const { workflowType } = await inquirer.prompt([{
      type: 'list',
      name: 'workflowType',
      message: 'Choose workflow type:',
      choices: [
        { name: 'Full-stack feature (API + UI + Tests)', value: 'fullstack' },
        { name: 'Component library (Component + Stories + Tests)', value: 'component-lib' },
        { name: 'API module (Controller + Service + Tests)', value: 'api-module' },
        { name: 'Custom workflow', value: 'custom' }
      ]
    }]);

    // Implementation would continue based on workflow type
    console.log(chalk.yellow(`Starting ${workflowType} workflow...`));
    
    return { success: true, workflowType, message: 'Workflow feature coming soon!' };
  }

  /**
   * Reset session state
   */
  reset() {
    this.session = {
      generator: null,
      template: null,
      name: null,
      flags: {},
      preferences: {}
    };
  }

  /**
   * Validate session state
   */
  validate() {
    try {
      InteractiveSessionSchema.parse(this.session);
      return { isValid: true };
    } catch (error) {
      return { isValid: false, errors: error.errors };
    }
  }
}

// Export singleton instance
export const interactiveMode = new InteractiveMode();

// Export for testing
export { InteractiveSessionSchema };