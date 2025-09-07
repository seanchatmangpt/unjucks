import { defineCommand } from "citty";
import chalk from "chalk";
import fs from 'fs-extra';
import path from 'node:path';
import nunjucks from 'nunjucks';
import matter from 'gray-matter';

/**
 * Template Preview Engine
 * Safe preview of template output without creating files
 */
class PreviewEngine {
  constructor() {
    this.templatesDir = '_templates';
    // Configure Nunjucks environment
    this.nunjucksEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(this.templatesDir),
      {
        autoescape: false,
        throwOnUndefined: false
      }
    );
  }

  async listGenerators() {
    const generators = [];
    const templatesPath = path.resolve(this.templatesDir);
    
    if (!(await fs.pathExists(templatesPath))) {
      return [];
    }
    
    const items = await fs.readdir(templatesPath, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isDirectory()) {
        generators.push({
          name: item.name,
          description: `Generator: ${item.name}`
        });
      }
    }
    
    return generators;
  }

  async listTemplates(generatorName) {
    const templates = [];
    const generatorPath = path.resolve(this.templatesDir, generatorName);
    
    if (!(await fs.pathExists(generatorPath))) {
      return [];
    }
    
    const items = await fs.readdir(generatorPath, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isDirectory()) {
        templates.push({
          name: item.name,
          description: `Template: ${item.name}`
        });
      }
    }
    
    return templates;
  }

  async previewTemplate(generator, template, variables = {}) {
    const templatePath = path.resolve(this.templatesDir, generator, template);
    
    if (!(await fs.pathExists(templatePath))) {
      throw new Error(`Template not found: ${generator}/${template}`);
    }
    
    const templateFiles = await this.getTemplateFiles(templatePath);
    const previews = [];
    
    for (const templateFile of templateFiles) {
      try {
        const preview = await this.previewTemplateFile(templateFile, variables);
        previews.push(preview);
      } catch (error) {
        previews.push({
          templateFile,
          error: error.message,
          success: false
        });
      }
    }
    
    return {
      generator,
      template,
      variables,
      files: previews,
      totalFiles: previews.length
    };
  }

  async previewTemplateFile(templateFilePath, variables) {
    // Read template file
    const templateContent = await fs.readFile(templateFilePath, 'utf8');
    
    // Parse frontmatter
    const { data: frontmatter, content } = matter(templateContent);
    
    // Render output path using Nunjucks
    const outputPath = frontmatter.to 
      ? this.nunjucksEnv.renderString(frontmatter.to, variables)
      : path.basename(templateFilePath, '.njk');
    
    // Render content using Nunjucks
    const renderedContent = this.nunjucksEnv.renderString(content, variables);
    
    return {
      templateFile: templateFilePath,
      outputPath,
      frontmatter,
      renderedContent,
      contentLength: renderedContent.length,
      operation: this.determineOperation(frontmatter),
      success: true
    };
  }

  determineOperation(frontmatter) {
    if (frontmatter.inject) return 'inject';
    if (frontmatter.append) return 'append';
    if (frontmatter.prepend) return 'prepend';
    if (frontmatter.lineAt) return 'insert';
    return 'create';
  }

  async getTemplateFiles(dirPath) {
    const files = [];
    
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      
      if (item.isDirectory()) {
        // Recursively get files from subdirectories
        const subFiles = await this.getTemplateFiles(itemPath);
        files.push(...subFiles);
      } else if (item.isFile() && (item.name.endsWith('.njk') || item.name.endsWith('.hbs'))) {
        files.push(itemPath);
      }
    }
    
    return files;
  }

  async analyzeTemplate(generator, template) {
    const templatePath = path.resolve(this.templatesDir, generator, template);
    
    if (!(await fs.pathExists(templatePath))) {
      throw new Error(`Template not found: ${generator}/${template}`);
    }
    
    const templateFiles = await this.getTemplateFiles(templatePath);
    const variables = new Set();
    const operations = new Map();
    
    for (const templateFile of templateFiles) {
      const templateContent = await fs.readFile(templateFile, 'utf8');
      const { data: frontmatter, content } = matter(templateContent);
      
      // Extract variables from frontmatter 'to' field and content
      const fullContent = (frontmatter.to || '') + '\n' + content;
      
      // Simple regex to find {{ variable }} patterns
      const variableMatches = fullContent.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g);
      
      if (variableMatches) {
        variableMatches.forEach(match => {
          const varName = match.replace(/[{}\s]/g, '');
          variables.add(varName);
        });
      }
      
      // Track operations
      const operation = this.determineOperation(frontmatter);
      if (!operations.has(operation)) {
        operations.set(operation, 0);
      }
      operations.set(operation, operations.get(operation) + 1);
    }
    
    return {
      generator,
      template,
      totalFiles: templateFiles.length,
      variables: Array.from(variables).map(name => ({
        name,
        required: true,
        type: 'string',
        description: `Variable: ${name}`
      })),
      operations: Object.fromEntries(operations),
      templateFiles: templateFiles.map(f => path.relative(templatePath, f))
    };
  }
}

/**
 * Preview command - Preview template output without creating files
 */
export const previewCommand = defineCommand({
  meta: {
    name: "preview",
    description: "Preview what will be generated without creating files",
  },
  args: {
    generator: {
      type: "positional",
      description: "Generator to preview",
      required: false,
    },
    template: {
      type: "positional",
      description: "Template to preview", 
      required: false,
    },
    analyze: {
      type: "boolean",
      description: "Analyze template structure and variables",
      alias: "a",
      default: false,
    },
    variables: {
      type: "string",
      description: "JSON string of template variables",
    },
    content: {
      type: "boolean",
      description: "Show rendered content preview",
      default: false,
    },
    limit: {
      type: "number",
      description: "Limit number of files to preview",
      default: 10,
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose output",
      alias: "v",
      default: false,
    }
  },
  /**
   * Main execution handler for the preview command
   * @param {Object} context - Command context
   * @param {Object} context.args - Parsed command arguments
   */
  async run(context) {
    const { args } = context;
    const engine = new PreviewEngine();
    
    console.log(chalk.blue("👀 Unjucks Preview"));
    console.log(chalk.gray("Safe template preview without creating files"));
    console.log();
    
    try {
      if (!args.generator) {
        // Show available generators
        const generators = await engine.listGenerators();
        
        if (generators.length === 0) {
          console.log(chalk.red("❌ No generators found"));
          console.log(chalk.gray("Create a _templates directory with generator subdirectories"));
          return;
        }
        
        console.log(chalk.yellow("📋 Available Generators:"));
        generators.forEach((gen, index) => {
          console.log(chalk.gray(`  ${index + 1}. ${gen.name}`));
        });
        
        console.log();
        console.log(chalk.yellow("🚀 Examples:"));
        console.log(chalk.gray('  unjucks preview component react --analyze'));
        console.log(chalk.gray('  unjucks preview api express --content'));
        console.log(chalk.gray('  unjucks preview microservice node --variables \'{"name": "UserService"}\''));
        return;
      }
      
      if (!args.template) {
        // Show available templates for generator
        const templates = await engine.listTemplates(args.generator);
        
        if (templates.length === 0) {
          console.log(chalk.red(`❌ No templates found for generator: ${args.generator}`));
          return;
        }
        
        console.log(chalk.yellow(`📋 Available Templates in ${args.generator}:`));
        templates.forEach((tpl, index) => {
          console.log(chalk.gray(`  ${index + 1}. ${tpl.name}`));
        });
        
        console.log();
        console.log(chalk.gray(`Use: unjucks preview ${args.generator} <template>`));
        return;
      }
      
      // Parse variables if provided
      let variables = {};
      if (args.variables) {
        try {
          variables = JSON.parse(args.variables);
        } catch (error) {
          console.log(chalk.red("❌ Invalid JSON in --variables"));
          return;
        }
      }
      
      // Add default variables if none provided
      if (Object.keys(variables).length === 0) {
        variables = {
          name: 'PreviewEntity',
          description: 'A sample entity for preview',
          author: 'Unjucks Preview'
        };
      }
      
      if (args.analyze) {
        // Analyze template structure
        console.log(chalk.cyan("🔍 Analyzing Template Structure..."));
        const analysis = await engine.analyzeTemplate(args.generator, args.template);
        
        console.log(chalk.green(`✅ Template Analysis: ${args.generator}/${args.template}`));
        console.log(chalk.gray(`Files: ${analysis.totalFiles}`));
        console.log();
        
        console.log(chalk.yellow("📋 Required Variables:"));
        analysis.variables.forEach(variable => {
          console.log(chalk.gray(`  ${variable.name} (${variable.type}) - ${variable.description}`));
        });
        
        console.log();
        console.log(chalk.yellow("🔧 Operations:"));
        Object.entries(analysis.operations).forEach(([op, count]) => {
          console.log(chalk.gray(`  ${op}: ${count} files`));
        });
        
        console.log();
        console.log(chalk.yellow("📁 Template Files:"));
        analysis.templateFiles.forEach(file => {
          console.log(chalk.gray(`  ${file}`));
        });
        
      } else {
        // Preview template output
        console.log(chalk.cyan("👀 Previewing Template Output..."));
        console.log(chalk.gray(`Generator: ${args.generator}`));
        console.log(chalk.gray(`Template: ${args.template}`));
        console.log(chalk.gray(`Variables: ${JSON.stringify(variables, null, 2)}`));
        console.log();
        
        const preview = await engine.previewTemplate(args.generator, args.template, variables);
        
        console.log(chalk.green(`✅ Preview Generated: ${preview.totalFiles} files`));
        console.log();
        
        const filesToShow = preview.files.slice(0, args.limit);
        
        filesToShow.forEach((file, index) => {
          if (!file.success) {
            console.log(chalk.red(`❌ ${index + 1}. Error in ${path.basename(file.templateFile)}: ${file.error}`));
            return;
          }
          
          const operation = file.operation;
          const operationColor = operation === 'create' ? 'green' : 
                               operation === 'inject' ? 'yellow' : 
                               operation === 'append' ? 'blue' : 'cyan';
          
          console.log(chalk[operationColor](`${operation.toUpperCase()}: ${file.outputPath}`));
          console.log(chalk.gray(`  Template: ${path.basename(file.templateFile)}`));
          console.log(chalk.gray(`  Size: ${file.contentLength} characters`));
          
          if (file.frontmatter && Object.keys(file.frontmatter).length > 0) {
            console.log(chalk.gray(`  Options: ${Object.keys(file.frontmatter).join(', ')}`));
          }
          
          if (args.content) {
            console.log(chalk.gray("  Content Preview:"));
            const contentPreview = file.renderedContent.split('\n').slice(0, 5).join('\n');
            console.log(chalk.gray(`    ${contentPreview.replace(/\n/g, '\n    ')}`));
            if (file.renderedContent.split('\n').length > 5) {
              console.log(chalk.gray("    ... (truncated)"));
            }
          }
          
          console.log();
        });
        
        if (preview.files.length > args.limit) {
          console.log(chalk.gray(`... and ${preview.files.length - args.limit} more files`));
          console.log(chalk.gray("Use --limit to show more files"));
        }
        
        console.log(chalk.blue("💡 Tips:"));
        console.log(chalk.gray("• Use --content to see rendered content"));
        console.log(chalk.gray("• Use --analyze to see template structure"));
        console.log(chalk.gray("• Use --variables to customize preview"));
        console.log(chalk.gray("• Use 'unjucks generate --dry' to simulate actual generation"));
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
      if (args.verbose || process.env.DEBUG) {
        console.error(error.stack);
      }
    }
  },
});