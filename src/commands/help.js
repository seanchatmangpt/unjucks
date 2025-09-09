import { defineCommand } from "citty";
import chalk from "chalk";
import fs from 'fs-extra';
import path from 'node:path';

/**
 * Help command - Show template variable help with dynamic template scanning
 */
export const helpCommand = defineCommand({
  meta: {
    name: "help",
    description: "Show template variable help and usage information",
  },
  args: {
    generator: {
      type: "positional",
      description: "Generator name to show help for",
      required: false,
    },
    template: {
      type: "positional", 
      description: "Template name to show help for",
      required: false,
    },
    verbose: {
      type: "boolean",
      description: "Show detailed help information",
      default: false,
      alias: "v",
    },
  },
  async run(context) {
    const { args } = context;
    const templatesDir = '_templates';

    try {
      if (!args.generator) {
        console.log(chalk.blue.bold("🆘 Unjucks Help"));
        console.log(chalk.gray("Shows available template variables and their usage"));
        console.log();
        console.log(chalk.yellow("Usage:"));
        console.log(chalk.gray("  unjucks help                           # Show general help"));
        console.log(chalk.gray("  unjucks help <generator>               # Show generator help"));
        console.log(chalk.gray("  unjucks help <generator> <template>    # Show template-specific help"));
        console.log();
        console.log(chalk.yellow("Examples:"));
        console.log(chalk.gray("  unjucks help component                 # Help for component generator"));
        console.log(chalk.gray("  unjucks help component react           # Help for React component template"));
        console.log();
        
        // Dynamically scan for available generators
        const availableGenerators = await this.scanGenerators(templatesDir);
        
        console.log(chalk.yellow("Available generators:"));
        if (availableGenerators.length === 0) {
          console.log(chalk.gray("  No generators found in _templates directory"));
          console.log(chalk.blue("  Run 'unjucks init' to create sample templates"));
        } else {
          for (const generator of availableGenerators) {
            console.log(chalk.gray(`  ${generator.name.padEnd(12)} - ${generator.description}`));
          }
        }
        console.log();
        console.log(chalk.blue("Use 'unjucks list' to see all available generators and templates"));
        return { success: true, message: "Help displayed", files: [] };
      }

      if (!args.template) {
        console.log(chalk.blue.bold(`🆘 Help for Generator: ${args.generator}`));
        console.log();
        
        // Dynamically scan templates for this generator
        const templates = await this.scanTemplates(templatesDir, args.generator);
        
        if (templates.length === 0) {
          console.error(chalk.red(`Generator "${args.generator}" not found`));
          console.log(chalk.blue("\n💡 Available generators:"));
          const availableGenerators = await this.scanGenerators(templatesDir);
          availableGenerators.forEach(g => {
            console.log(chalk.blue(`  • ${g.name}`));
          });
          return { success: false, message: `Generator "${args.generator}" not found`, files: [] };
        } else {
          console.log(chalk.yellow("Available templates:"));
          for (const template of templates) {
            console.log(chalk.gray(`  --${template.name.padEnd(12)} ${template.description}`));
          }
          console.log();
          console.log(chalk.yellow("Options:"));
          console.log(chalk.gray(`  --name     ${args.generator.charAt(0).toUpperCase() + args.generator.slice(1)} name`));
          
          // Parse and display frontmatter variables from the first template
          if (templates.length > 0) {
            try {
              const variables = await this.parseTemplateVariables(templatesDir, args.generator, templates[0].name);
              if (variables.length > 0) {
                variables.forEach(variable => {
                  console.log(chalk.gray(`  --${variable.name.padEnd(10)} ${variable.description}`));
                });
              }
            } catch (error) {
              // Continue if we can't parse variables
            }
          }
        }
        
        console.log();
        console.log(chalk.blue(`Use 'unjucks help ${args.generator} <template>' for template-specific help`));
        return { success: true, message: "Generator help displayed", files: [] };
      }

      // Template-specific help with dynamic validation
      const generatorExists = await fs.pathExists(path.resolve(templatesDir, args.generator));
      if (!generatorExists) {
        console.error(chalk.red(`Generator "${args.generator}" not found`));
        console.log(chalk.blue("\n💡 Available generators:"));
        const availableGenerators = await this.scanGenerators(templatesDir);
        availableGenerators.forEach(g => {
          console.log(chalk.blue(`  • ${g.name}`));
        });
        return { success: false, message: `Generator "${args.generator}" not found`, files: [] };
      }

      const templates = await this.scanTemplates(templatesDir, args.generator);
      const templateExists = templates.some(t => t.name === args.template);
      
      if (!templateExists) {
        console.error(chalk.red(`Template "${args.template}" not found in generator "${args.generator}"`));
        console.log(chalk.blue("\n💡 Available templates:"));
        templates.forEach(t => {
          console.log(chalk.blue(`  • ${t.name}`));
        });
        return { success: false, message: `Template "${args.template}" not found in generator "${args.generator}"`, files: [] };
      }

      console.log(chalk.blue.bold(`🆘 Help for Template: ${args.generator}/${args.template}`));
      console.log();

      // Dynamic help based on template scanning
      console.log(chalk.yellow("TEMPLATE VARIABLES:"));
      console.log(`  ${chalk.green('name')} ${chalk.cyan('[string]')} ${chalk.red('*required')}`);
      console.log(`    ${chalk.gray('Entity name')}`);
      console.log();

      console.log(chalk.yellow("OUTPUT FILES:"));
      console.log(`  ${chalk.green('Generated files based on template')}`);
      console.log();

      console.log(chalk.yellow("EXAMPLES:"));
      console.log(`  ${chalk.gray(`unjucks generate ${args.generator} ${args.template} MyEntity`)}`);
      console.log(`  ${chalk.gray(`unjucks generate ${args.generator} ${args.template} MyEntity --dest ./src`)}`);

      console.log(chalk.yellow("DESCRIPTION:"));
      console.log(chalk.gray(`  Template for generating ${args.generator} files`));
      console.log();

      if (args.verbose) {
        console.log();
        console.log(chalk.yellow("ADDITIONAL OPTIONS:"));
        console.log(chalk.gray("  --dest <path>     - Destination directory"));
        console.log(chalk.gray("  --force           - Overwrite existing files"));
        console.log(chalk.gray("  --dry             - Preview without creating files"));
        console.log(chalk.gray("  --verbose         - Show detailed output"));
      }

      return { success: true, message: "Template help displayed", files: [] };
    } catch (error) {
      console.error(chalk.red("\n❌ Help command failed:"));
      console.error(chalk.red(`  ${error.message}`));
      return { success: false, message: "Help command failed", error: error.message };
    }
  },
  
  // Dynamic template scanning methods
  async scanGenerators(templatesDir) {
    try {
      const generators = [];
      const templatesPath = path.resolve(templatesDir);
      
      if (!(await fs.pathExists(templatesPath))) {
        return generators;
      }
      
      const items = await fs.readdir(templatesPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const generatorPath = path.join(templatesPath, item.name);
          const hasTemplates = await this.hasTemplateFiles(generatorPath);
          
          if (hasTemplates) {
            generators.push({
              name: item.name,
              description: await this.getGeneratorDescription(generatorPath)
            });
          }
        }
      }
      
      return generators;
    } catch (error) {
      console.error('Error scanning generators:', error);
      return [];
    }
  },

  async scanTemplates(templatesDir, generatorName) {
    try {
      const templates = [];
      const generatorPath = path.resolve(templatesDir, generatorName);
      
      if (!(await fs.pathExists(generatorPath))) {
        return templates;
      }
      
      const items = await fs.readdir(generatorPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const templatePath = path.join(generatorPath, item.name);
          const hasFiles = await this.hasTemplateFiles(templatePath);
          
          if (hasFiles) {
            templates.push({
              name: item.name,
              description: await this.getTemplateDescription(templatePath)
            });
          }
        } else if (item.isFile() && (item.name.endsWith('.njk') || item.name.endsWith('.hbs'))) {
          // Handle individual template files like index.njk
          const templateName = item.name.replace(/\.(njk|hbs)$/, '');
          templates.push({
            name: templateName,
            description: `Template: ${templateName}`
          });
        }
      }
      
      return templates;
    } catch (error) {
      console.error('Error scanning templates:', error);
      return [];
    }
  },

  async hasTemplateFiles(dirPath) {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isFile() && (item.name.endsWith('.njk') || item.name.endsWith('.hbs'))) {
          return true;
        }
        if (item.isDirectory()) {
          const hasSubFiles = await this.hasTemplateFiles(path.join(dirPath, item.name));
          if (hasSubFiles) return true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  },

  async getGeneratorDescription(generatorPath) {
    try {
      // Look for a README or description file
      const possibleFiles = ['README.md', 'description.txt', 'info.md'];
      
      for (const file of possibleFiles) {
        const filePath = path.join(generatorPath, file);
        if (await fs.pathExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf8');
          const firstLine = content.split('\n')[0].replace(/^#+\s*/, '').trim();
          return firstLine || `Generator for ${path.basename(generatorPath)}`;
        }
      }
      
      return `Generator for ${path.basename(generatorPath)}`;
    } catch (error) {
      return `Generator for ${path.basename(generatorPath)}`;
    }
  },

  async getTemplateDescription(templatePath) {
    try {
      // Look for template files to infer description
      const items = await fs.readdir(templatePath, { withFileTypes: true });
      const templateFiles = items.filter(item => 
        item.isFile() && (item.name.endsWith('.njk') || item.name.endsWith('.hbs'))
      );
      
      if (templateFiles.length > 0) {
        return `Template with ${templateFiles.length} file(s)`;
      }
      
      return `Template: ${path.basename(templatePath)}`;
    } catch (error) {
      return `Template: ${path.basename(templatePath)}`;
    }
  },

  async parseTemplateVariables(templatesDir, generatorName, templateName) {
    try {
      const templatePath = path.resolve(templatesDir, generatorName, templateName + '.njk');
      
      if (!(await fs.pathExists(templatePath))) {
        return [];
      }
      
      const content = await fs.readFile(templatePath, 'utf8');
      const matter = await import('gray-matter');
      const { data: frontmatter } = matter.default(content);
      
      if (frontmatter.variables && Array.isArray(frontmatter.variables)) {
        return frontmatter.variables.map(variable => {
          if (typeof variable === 'string') {
            return { name: variable, description: `Variable: ${variable}` };
          } else if (typeof variable === 'object') {
            // Handle object format like { name: "Component name", withProps: "Include props" }
            const entries = Object.entries(variable);
            if (entries.length > 0) {
              const [name, description] = entries[0];
              return { name, description: String(description) };
            }
          }
          return { name: 'unknown', description: 'Unknown variable' };
        });
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }
});