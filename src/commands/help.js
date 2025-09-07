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
        console.log(chalk.yellow("USAGE:"));
        console.log(chalk.gray("  unjucks help                           # Show general help"));
        console.log(chalk.gray("  unjucks help <generator>               # Show generator help"));
        console.log(chalk.gray("  unjucks help <generator> <template>    # Show template-specific help"));
        console.log();
        console.log(chalk.yellow("EXAMPLES:"));
        console.log(chalk.gray("  unjucks help component                 # Help for component generator"));
        console.log(chalk.gray("  unjucks help component react           # Help for React component template"));
        console.log();
        
        // Dynamically scan for available generators
        const availableGenerators = await this.scanGenerators(templatesDir);
        
        console.log(chalk.yellow("AVAILABLE GENERATORS:"));
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
          console.log(chalk.yellow(`No templates found for generator: ${args.generator}`));
          console.log(chalk.gray("Check that _templates/${args.generator} directory exists"));
        } else {
          console.log(chalk.yellow("DESCRIPTION:"));
          console.log(chalk.gray(`  Generates files using ${args.generator} templates`));
          console.log();
          console.log(chalk.yellow("AVAILABLE TEMPLATES:"));
          for (const template of templates) {
            console.log(chalk.gray(`  ${template.name.padEnd(12)} - ${template.description}`));
          }
        }
        
        console.log();
        console.log(chalk.blue(`Use 'unjucks help ${args.generator} <template>' for template-specific help`));
        return { success: true, message: "Generator help displayed", files: [] };
      }

      // Template-specific help
      console.log(chalk.blue.bold(`🆘 Help for Template: ${args.generator}/${args.template}`));
      console.log();
      
      const templateHelp = {
        "component/react": {
          description: "React functional component with TypeScript support",
          variables: [
            { name: "name", required: true, type: "string", description: "Component name (PascalCase)" },
            { name: "withTests", required: false, type: "boolean", description: "Generate test files" },
            { name: "withStorybook", required: false, type: "boolean", description: "Generate Storybook stories" },
            { name: "styled", required: false, type: "boolean", description: "Include styled-components" }
          ],
          outputs: ["Component.tsx", "index.ts", "Component.test.tsx?", "Component.stories.tsx?"],
          examples: [
            "unjucks generate component react UserButton",
            "unjucks generate component react LoginForm --withTests --withStorybook"
          ]
        },
        "component/vue": {
          description: "Vue 3 composition API component with TypeScript",
          variables: [
            { name: "name", required: true, type: "string", description: "Component name (PascalCase)" },
            { name: "withTests", required: false, type: "boolean", description: "Generate test files" },
            { name: "withCSS", required: false, type: "boolean", description: "Include scoped CSS" }
          ],
          outputs: ["Component.vue", "Component.test.ts?"],
          examples: [
            "unjucks generate component vue UserCard",
            "unjucks generate component vue DataTable --withTests --withCSS"
          ]
        },
        "api/express": {
          description: "Express.js router with controller and middleware",
          variables: [
            { name: "name", required: true, type: "string", description: "Route name (camelCase)" },
            { name: "withAuth", required: false, type: "boolean", description: "Include authentication middleware" },
            { name: "withValidation", required: false, type: "boolean", description: "Include request validation" },
            { name: "methods", required: false, type: "array", description: "HTTP methods (GET,POST,PUT,DELETE)" }
          ],
          outputs: ["router.js", "controller.js", "middleware.js?"],
          examples: [
            "unjucks generate api express users",
            "unjucks generate api express posts --withAuth --withValidation"
          ]
        }
      };

      const key = `${args.generator}/${args.template}`;
      const help = templateHelp[key];

      if (!help) {
        console.log(chalk.yellow(`No specific help available for template: ${args.generator}/${args.template}`));
        console.log(chalk.gray("This template may be available but not documented yet"));
        console.log();
        console.log(chalk.blue("💡 Try:"));
        console.log(chalk.blue(`  • unjucks list ${args.generator} - See available templates`));
        console.log(chalk.blue(`  • unjucks generate ${args.generator} ${args.template} --dry - Preview generation`));
        return { success: true, message: "Template help not found", files: [] };
      }

      console.log(chalk.yellow("DESCRIPTION:"));
      console.log(chalk.gray(`  ${help.description}`));
      console.log();

      console.log(chalk.yellow("TEMPLATE VARIABLES:"));
      help.variables.forEach(variable => {
        const requiredLabel = variable.required ? chalk.red("*required") : chalk.gray("optional");
        const typeLabel = chalk.cyan(`[${variable.type}]`);
        console.log(`  ${chalk.green(variable.name)} ${typeLabel} ${requiredLabel}`);
        console.log(`    ${chalk.gray(variable.description)}`);
      });
      console.log();

      console.log(chalk.yellow("OUTPUT FILES:"));
      help.outputs.forEach(output => {
        const isOptional = output.includes("?");
        const fileName = output.replace("?", "");
        const label = isOptional ? chalk.gray(`${fileName} (conditional)`) : chalk.green(fileName);
        console.log(`  ${label}`);
      });
      console.log();

      console.log(chalk.yellow("EXAMPLES:"));
      help.examples.forEach(example => {
        console.log(`  ${chalk.gray(example)}`);
      });

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
  }
});