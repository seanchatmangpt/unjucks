import { defineCommand } from "citty";
import chalk from "chalk";
import fs from 'fs-extra';
import path from 'node:path';

/**
 * Project and Component Creation Engine
 * Unified entry point for creating new projects and components
 */
class ProjectCreator {
  constructor() {
    this.templatesDir = '_templates';
    this.projectTemplates = new Map([
      ['webapp', { name: 'Web Application', generator: 'project', template: 'webapp' }],
      ['api', { name: 'REST API', generator: 'project', template: 'api' }],
      ['library', { name: 'JavaScript Library', generator: 'project', template: 'library' }],
      ['microservice', { name: 'Microservice', generator: 'project', template: 'microservice' }],
      ['mobile', { name: 'Mobile App', generator: 'project', template: 'mobile' }]
    ]);
    
    this.componentTemplates = new Map([
      ['component', { name: 'React Component', generator: 'component', template: 'react' }],
      ['service', { name: 'Service Class', generator: 'service', template: 'node' }],
      ['model', { name: 'Data Model', generator: 'model', template: 'sequelize' }],
      ['controller', { name: 'API Controller', generator: 'controller', template: 'express' }],
      ['middleware', { name: 'Express Middleware', generator: 'middleware', template: 'express' }]
    ]);
  }

  async getAvailableTypes() {
    const types = [];
    
    // Add project types
    for (const [key, config] of this.projectTemplates) {
      types.push({
        key,
        category: 'project',
        name: config.name,
        description: `Create a new ${config.name.toLowerCase()}`
      });
    }
    
    // Add component types
    for (const [key, config] of this.componentTemplates) {
      types.push({
        key,
        category: 'component',
        name: config.name,
        description: `Create a new ${config.name.toLowerCase()}`
      });
    }
    
    return types;
  }

  async createProject(type, name, options = {}) {
    const template = this.projectTemplates.get(type);
    if (!template) {
      throw new Error(`Unknown project type: ${type}`);
    }
    
    const projectDir = path.resolve(options.dest || '.', name);
    
    if (await fs.pathExists(projectDir) && !options.force) {
      throw new Error(`Directory already exists: ${projectDir}`);
    }
    
    await fs.ensureDir(projectDir);
    
    // Simulate project creation
    const files = await this.generateProjectFiles(template, name, projectDir, options);
    
    return {
      success: true,
      type: 'project',
      name,
      path: projectDir,
      files,
      template: template.name
    };
  }

  async createComponent(type, name, options = {}) {
    const template = this.componentTemplates.get(type);
    if (!template) {
      throw new Error(`Unknown component type: ${type}`);
    }
    
    const destDir = options.dest || '.';
    
    // Simulate component creation
    const files = await this.generateComponentFiles(template, name, destDir, options);
    
    return {
      success: true,
      type: 'component',
      name,
      path: destDir,
      files,
      template: template.name
    };
  }

  async generateProjectFiles(template, name, projectDir, options) {
    const files = [];
    
    // Simulate creating project structure
    const projectFiles = [
      'package.json',
      'README.md',
      'src/index.js',
      '.gitignore',
      'tests/index.test.js'
    ];
    
    if (template.template === 'webapp') {
      projectFiles.push('src/App.jsx', 'public/index.html', 'src/styles/main.css');
    } else if (template.template === 'api') {
      projectFiles.push('src/routes/index.js', 'src/middleware/auth.js', 'config/database.js');
    }
    
    for (const file of projectFiles) {
      const filePath = path.join(projectDir, file);
      await fs.ensureDir(path.dirname(filePath));
      
      const content = this.generateFileContent(file, name, template, options);
      
      if (!options.dry) {
        await fs.writeFile(filePath, content);
      }
      
      files.push({
        path: filePath,
        size: content.length,
        type: path.extname(file) || 'file'
      });
    }
    
    return files;
  }

  async generateComponentFiles(template, name, destDir, options) {
    const files = [];
    
    // Simulate creating component files
    const componentFiles = [];
    
    if (template.template === 'react') {
      componentFiles.push(`${name}.jsx`, `${name}.test.jsx`, `${name}.module.css`);
    } else if (template.template === 'node') {
      componentFiles.push(`${name}.js`, `${name}.test.js`);
    }
    
    for (const file of componentFiles) {
      const filePath = path.join(destDir, file);
      const content = this.generateFileContent(file, name, template, options);
      
      if (!options.dry) {
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, content);
      }
      
      files.push({
        path: filePath,
        size: content.length,
        type: path.extname(file) || 'file'
      });
    }
    
    return files;
  }

  generateFileContent(fileName, entityName, template, options) {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    
    switch (ext) {
      case '.json':
        if (fileName === 'package.json') {
          return JSON.stringify({
            name: entityName.toLowerCase(),
            version: "1.0.0",
            description: `A new ${template.name.toLowerCase()}`,
            main: "src/index.js",
            scripts: {
              start: "node src/index.js",
              test: "jest",
              dev: "nodemon src/index.js"
            },
            dependencies: template.template === 'webapp' 
              ? { react: "^18.0.0", "react-dom": "^18.0.0" }
              : { express: "^4.18.0" }
          }, null, 2);
        }
        break;
      case '.jsx':
        return `import React from 'react';\nimport './${entityName}.module.css';\n\nconst ${entityName} = () => {\n  return (\n    <div className="${entityName.toLowerCase()}">\n      <h1>${entityName}</h1>\n    </div>\n  );\n};\n\nexport default ${entityName};`;
      case '.js':
        if (fileName.includes('test')) {
          return `describe('${entityName}', () => {\n  test('should work correctly', () => {\n    expect(true).toBe(true);\n  });\n});`;
        }
        return `// ${entityName}\n\nclass ${entityName} {\n  constructor() {\n    this.name = '${entityName}';\n  }\n\n  getName() {\n    return this.name;\n  }\n}\n\nmodule.exports = ${entityName};`;
      case '.css':
        return `.${entityName.toLowerCase()} {\n  /* Add your styles here */\n  display: block;\n}`;
      case '.md':
        return `# ${entityName}\n\n## Description\n\nA new ${template.name.toLowerCase()} created with Unjucks.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm start\n\`\`\``;
      default:
        return `# ${entityName}\n# Created with Unjucks New`;
    }
  }
}

/**
 * New command - Create new projects and components (primary command)
 */
export const newCommand = defineCommand({
  meta: {
    name: "new",
    description: "Create new projects and components",
  },
  args: {
    type: {
      type: "positional",
      description: "Type of entity to create (project, component, webapp, api, etc.)",
      required: false,
    },
    name: {
      type: "positional", 
      description: "Name of the entity to create",
      required: false,
    },
    dest: {
      type: "string",
      description: "Destination directory",
      default: ".",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing files/directories",
      default: false,
    },
    dry: {
      type: "boolean",
      description: "Preview what would be created without writing files",
      default: false,
    },
    interactive: {
      type: "boolean",
      description: "Use interactive mode to select options",
      alias: "i",
      default: false,
    },
    template: {
      type: "string",
      description: "Specific template to use",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose output",
      alias: "v",
      default: false,
    }
  },
  /**
   * Main execution handler for the new command
   * @param {Object} context - Command context
   * @param {Object} context.args - Parsed command arguments
   */
  async run(context) {
    const { args } = context;
    const creator = new ProjectCreator();
    
    console.log(chalk.blue("🆕 Unjucks New"));
    console.log(chalk.gray("Create new projects and components with intelligent scaffolding"));
    console.log();
    
    try {
      if (!args.type) {
        // Show available types
        const types = await creator.getAvailableTypes();
        
        console.log(chalk.yellow("📋 Available Types:"));
        console.log();
        
        console.log(chalk.cyan("Projects:"));
        types.filter(t => t.category === 'project').forEach(type => {
          console.log(chalk.gray(`  ${type.key.padEnd(12)} - ${type.description}`));
        });
        
        console.log();
        console.log(chalk.cyan("Components:"));
        types.filter(t => t.category === 'component').forEach(type => {
          console.log(chalk.gray(`  ${type.key.padEnd(12)} - ${type.description}`));
        });
        
        console.log();
        console.log(chalk.yellow("🚀 Examples:"));
        console.log(chalk.gray('  unjucks new webapp MyApp --dest ./projects'));
        console.log(chalk.gray('  unjucks new api UserService --dest ./services'));
        console.log(chalk.gray('  unjucks new component Button --dest ./src/components'));
        console.log(chalk.gray('  unjucks new microservice PaymentService'));
        return;
      }
      
      if (!args.name) {
        console.log(chalk.red("❌ Entity name required"));
        console.log(chalk.gray(`Example: unjucks new ${args.type} MyEntity`));
        return;
      }
      
      const isProjectType = creator.projectTemplates.has(args.type);
      const isComponentType = creator.componentTemplates.has(args.type);
      
      if (!isProjectType && !isComponentType) {
        console.log(chalk.red(`❌ Unknown type: ${args.type}`));
        console.log(chalk.gray("Use 'unjucks new' to see available types"));
        return;
      }
      
      console.log(chalk.cyan(`🚀 Creating ${isProjectType ? 'project' : 'component'}: ${args.name}`));
      console.log(chalk.gray(`Type: ${args.type}`));
      console.log(chalk.gray(`Destination: ${args.dest}`));
      
      if (args.dry) {
        console.log(chalk.yellow("🔍 Dry run mode - no files will be created"));
      }
      
      const startTime = Date.now();
      let result;
      
      if (isProjectType) {
        result = await creator.createProject(args.type, args.name, {
          dest: args.dest,
          force: args.force,
          dry: args.dry,
          template: args.template,
          verbose: args.verbose
        });
      } else {
        result = await creator.createComponent(args.type, args.name, {
          dest: args.dest,
          force: args.force,
          dry: args.dry,
          template: args.template,
          verbose: args.verbose
        });
      }
      
      const endTime = Date.now();
      
      console.log();
      console.log(chalk.green(`✅ Successfully created ${result.type}: ${result.name}`));
      console.log(chalk.gray(`Template: ${result.template}`));
      console.log(chalk.gray(`Files: ${result.files.length}`));
      
      if (args.verbose) {
        console.log();
        console.log(chalk.cyan("📁 Created Files:"));
        result.files.forEach(file => {
          const size = args.dry ? 'N/A' : `${file.size} bytes`;
          console.log(chalk.gray(`  + ${file.path} (${size})`));
        });
      }
      
      console.log();
      console.log(chalk.green(`🎉 ${result.type === 'project' ? 'Project' : 'Component'} created in ${endTime - startTime}ms`));
      
      if (result.type === 'project' && !args.dry) {
        console.log();
        console.log(chalk.blue("📝 Next steps:"));
        console.log(chalk.gray(`  cd ${result.name}`));
        console.log(chalk.gray("  npm install"));
        console.log(chalk.gray("  npm start"));
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
      if (args.verbose || process.env.DEBUG) {
        console.error(error.stack);
      }
    }
  },
});