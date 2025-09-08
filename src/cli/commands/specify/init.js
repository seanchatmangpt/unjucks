import { defineCommand } from "citty";
import chalk from "chalk";
import fs from 'fs-extra';
import path from 'node:path';

/**
 * Spec-driven project initialization command
 * Creates the foundational structure for specification-driven development
 */
export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Initialize spec-driven project structure with templates and configuration",
  },
  args: {
    project: {
      type: "positional",
      description: "Project name/identifier for the spec-driven setup",
      required: true,
    },
    type: {
      type: "string",
      description: "Project type (web, api, fullstack, library, cli)",
      default: "web",
      alias: "t",
    },
    framework: {
      type: "string",
      description: "Primary framework/technology (react, vue, express, fastify, etc.)",
      alias: "f",
    },
    lang: {
      type: "string",
      description: "Programming language (typescript, javascript, python, go)",
      default: "typescript",
      alias: "l",
    },
    dest: {
      type: "string",
      description: "Destination directory for the project",
      default: ".",
      alias: "d",
    },
    force: {
      type: "boolean",
      description: "Force overwrite existing files",
      default: false,
    },
    dry: {
      type: "boolean",
      description: "Preview what would be created without making changes",
      default: false,
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose logging",
      default: false,
      alias: "v",
    },
  },
  async run(context) {
    const { args } = context;
    const startTime = Date.now();

    try {
      if (!args.verbose && !args.dry) {
        console.log(chalk.blue("🚀 Initializing Spec-Driven Project"));
        console.log(chalk.gray(`Project: ${args.project} (${args.type})`));
      }

      const projectPath = path.resolve(args.dest, args.project);
      const specDir = path.join(projectPath, 'specs');
      const templatesDir = path.join(projectPath, '_templates');
      
      // Create project structure
      const directories = [
        'specs/requirements',
        'specs/architecture', 
        'specs/apis',
        'specs/components',
        'specs/workflows',
        '_templates/component/basic',
        '_templates/api/endpoint',
        '_templates/spec/requirement',
        '_templates/spec/architecture',
        'src',
        'tests',
        'docs',
        'config'
      ];

      // Configuration files to create
      const configFiles = [
        {
          path: 'specs/project.spec.yaml',
          content: this.generateProjectSpec(args)
        },
        {
          path: 'specs/requirements/README.md',
          content: this.generateRequirementsReadme(args)
        },
        {
          path: '_templates/spec/requirement/requirement.yaml.njk',
          content: this.generateRequirementTemplate(args)
        },
        {
          path: '_templates/spec/architecture/component.yaml.njk',
          content: this.generateArchitectureTemplate(args)
        },
        {
          path: 'unjucks.config.js',
          content: this.generateUnjucksConfig(args)
        },
        {
          path: 'package.json',
          content: this.generatePackageJson(args)
        }
      ];

      if (args.dry) {
        console.log(chalk.yellow("\n🔍 Dry Run - Preview of changes:"));
        console.log(chalk.cyan("\nDirectories to create:"));
        directories.forEach(dir => {
          console.log(chalk.gray(`  📁 ${path.join(projectPath, dir)}`));
        });
        
        console.log(chalk.cyan("\nFiles to create:"));
        configFiles.forEach(file => {
          console.log(chalk.gray(`  📄 ${path.join(projectPath, file.path)}`));
        });
        
        console.log(chalk.blue(`\n✨ Dry run completed in ${Date.now() - startTime}ms`));
        console.log(chalk.gray("Run without --dry to create the project structure"));
        
        return {
          success: true,
          message: "Dry run completed",
          created: []
        };
      }

      // Check if project directory exists
      if (await fs.pathExists(projectPath) && !args.force) {
        console.error(chalk.red(`\n❌ Project directory already exists: ${projectPath}`));
        console.log(chalk.blue("💡 Use --force to overwrite or choose a different project name"));
        return {
          success: false,
          message: "Project directory already exists"
        };
      }

      const created = [];

      // Create directories
      for (const dir of directories) {
        const fullPath = path.join(projectPath, dir);
        await fs.ensureDir(fullPath);
        created.push({ type: 'directory', path: fullPath });
        
        if (args.verbose) {
          console.log(chalk.gray(`  📁 Created: ${fullPath}`));
        }
      }

      // Create configuration files
      for (const file of configFiles) {
        const fullPath = path.join(projectPath, file.path);
        await fs.writeFile(fullPath, file.content, 'utf8');
        created.push({ type: 'file', path: fullPath });
        
        if (args.verbose) {
          console.log(chalk.gray(`  📄 Created: ${fullPath}`));
        }
      }

      const duration = Date.now() - startTime;
      
      console.log(chalk.green(`\n✅ Successfully initialized spec-driven project: ${args.project}`));
      console.log(chalk.cyan(`📁 Project location: ${projectPath}`));
      console.log(chalk.gray(`⏱️  Completed in ${duration}ms`));
      
      // Show next steps
      console.log(chalk.blue("\n📝 Next steps:"));
      console.log(chalk.gray(`  1. cd ${args.project}`));
      console.log(chalk.gray("  2. unjucks specify plan"));
      console.log(chalk.gray("  3. unjucks specify tasks"));
      console.log(chalk.gray("  4. npm install"));
      
      return {
        success: true,
        message: "Project initialized successfully",
        created: created.map(item => item.path),
        duration
      };
      
    } catch (error) {
      console.error(chalk.red("\n❌ Initialization failed:"));
      console.error(chalk.red(`  ${error.message}`));
      
      if (args.verbose && error.stack) {
        console.error(chalk.gray("\n📍 Stack trace:"));
        console.error(chalk.gray(error.stack));
      }
      
      return {
        success: false,
        message: "Initialization failed",
        error: error.message
      };
    }
  },

  // Helper methods for generating template content
  generateProjectSpec(args) {
    return `# Project Specification: ${args.project}
# Generated by unjucks specify init

metadata:
  name: "${args.project}"
  type: "${args.type}"
  framework: "${args.framework || 'tbd'}"
  language: "${args.lang}"
  version: "1.0.0"
  created: "${new Date().toISOString()}"
  
description: |
  Spec-driven development project for ${args.project}.
  
  This project follows specification-driven development principles:
  - Requirements are defined as executable specifications
  - Architecture decisions are documented and validated
  - Code generation is driven by specifications
  - Testing is specification-based

structure:
  specs:
    requirements: "Functional and non-functional requirements"
    architecture: "System architecture and design decisions"
    apis: "API specifications (OpenAPI, GraphQL schemas)"
    components: "Component specifications and interfaces"
    workflows: "Business process and workflow definitions"
    
  templates:
    component: "Component generation templates"
    api: "API endpoint generation templates"
    spec: "Specification generation templates"
    
development:
  workflow: "spec-driven"
  testing: "specification-based"
  validation: "automated"
  
tools:
  generator: "unjucks"
  validation: "unjucks specify validate"
  planning: "unjucks specify plan"
  tasks: "unjucks specify tasks"
`;
  },

  generateRequirementsReadme(args) {
    return `# Requirements Specifications

This directory contains the functional and non-functional requirements for **${args.project}**.

## Structure

- \`functional/\` - Functional requirements (user stories, features, use cases)
- \`non-functional/\` - Performance, security, scalability requirements
- \`acceptance/\` - Acceptance criteria and test scenarios
- \`constraints/\` - Technical and business constraints

## Specification Format

Requirements are written in YAML format with the following structure:

\`\`\`yaml
id: REQ-001
title: "User Authentication"
type: functional
priority: high
status: draft

description: |
  Users must be able to authenticate using email/password

acceptance_criteria:
  - User can register with valid email
  - User can login with correct credentials
  - User session is maintained securely
  
dependencies: []
constraints:
  - Must comply with GDPR
  - Session timeout after 24 hours
\`\`\`

## Commands

Generate new requirements:
\`\`\`bash
unjucks generate spec requirement --name AuthenticationRequirement
\`\`\`

Validate requirements:
\`\`\`bash  
unjucks specify validate --type requirements
\`\`\`

Generate technical plan:
\`\`\`bash
unjucks specify plan
\`\`\`
`;
  },

  generateRequirementTemplate(args) {
    return `---
to: specs/requirements/{{ category | lower }}/{{ name | kebabCase }}.yaml
---
id: {{ id | upper }}
title: "{{ title }}"
type: {{ type | default('functional') }}
priority: {{ priority | default('medium') }}
status: draft

description: |
  {{ description }}

acceptance_criteria:
  - {{ acceptanceCriteria | join('\\n  - ') }}

dependencies: {{ dependencies | default([]) | json }}

constraints:
  - {{ constraints | join('\\n  - ') }}

metadata:
  created: {{ 'now' | date('iso') }}
  author: "{{ author }}"
  epic: "{{ epic }}"
  sprint: "{{ sprint }}"

validation:
  testable: {{ testable | default(true) }}
  measurable: {{ measurable | default(true) }}
  
tags: {{ tags | default([]) | json }}
`;
  },

  generateArchitectureTemplate(args) {
    return `---
to: specs/architecture/{{ category | lower }}/{{ name | kebabCase }}.yaml
---
component:
  name: "{{ name }}"
  type: "{{ type }}"
  layer: "{{ layer }}"
  
description: |
  {{ description }}

responsibilities:
  - {{ responsibilities | join('\\n  - ') }}

interfaces:
  public:
    - name: "{{ interfaceName }}"
      type: "{{ interfaceType }}"
      methods: {{ methods | default([]) | json }}
      
  dependencies:
    - name: "{{ depName }}"
      type: "{{ depType }}"
      relationship: "{{ relationship }}"

implementation:
  technology: "{{ technology }}"
  patterns: {{ patterns | default([]) | json }}
  
quality_attributes:
  performance: {{ performance | default('medium') }}
  scalability: {{ scalability | default('medium') }}
  maintainability: {{ maintainability | default('high') }}
  testability: {{ testability | default('high') }}

constraints:
  technical: {{ technicalConstraints | default([]) | json }}
  business: {{ businessConstraints | default([]) | json }}

metadata:
  created: {{ 'now' | date('iso') }}
  author: "{{ author }}"
  version: "{{ version | default('1.0.0') }}"
`;
  },

  generateUnjucksConfig(args) {
    return `// Unjucks configuration for ${args.project}
export default {
  // Template directories
  templates: ['_templates'],
  
  // Output directories
  output: {
    src: 'src',
    tests: 'tests',
    docs: 'docs',
    specs: 'specs'
  },
  
  // Spec-driven development settings
  specDriven: {
    enabled: true,
    specDir: 'specs',
    validationRules: [
      'required-fields',
      'yaml-syntax',
      'dependency-validation'
    ],
    planGeneration: {
      includeArchitecture: true,
      includeRequirements: true,
      includeTasks: true
    }
  },
  
  // Project metadata
  project: {
    name: '${args.project}',
    type: '${args.type}',
    framework: '${args.framework || 'tbd'}',
    language: '${args.lang}'
  },
  
  // Template engine settings
  engine: {
    autoescape: false,
    throwOnUndefined: false,
    trimBlocks: true,
    lstripBlocks: true
  },
  
  // File processing
  files: {
    backup: false,
    dryRun: false,
    force: false
  }
};
`;
  },

  generatePackageJson(args) {
    const packageData = {
      name: args.project,
      version: "1.0.0",
      description: `Spec-driven development project: ${args.project}`,
      type: "module",
      scripts: {
        "spec:init": "unjucks specify init",
        "spec:plan": "unjucks specify plan", 
        "spec:tasks": "unjucks specify tasks",
        "spec:validate": "unjucks specify validate",
        "generate": "unjucks generate",
        "dev": "echo 'Setup your development script'",
        "build": "echo 'Setup your build script'",
        "test": "echo 'Setup your test script'"
      },
      devDependencies: {
        "unjucks": "^1.0.0"
      }
    };

    // Add framework-specific dependencies
    if (args.framework === 'react' || args.framework === 'nextjs') {
      packageData.dependencies = {
        "react": "^18.0.0",
        "react-dom": "^18.0.0"
      };
    } else if (args.framework === 'vue') {
      packageData.dependencies = {
        "vue": "^3.0.0"
      };
    } else if (args.framework === 'express') {
      packageData.dependencies = {
        "express": "^4.18.0"
      };
    }

    // Add TypeScript if specified
    if (args.lang === 'typescript') {
      packageData.devDependencies.typescript = "^5.0.0";
      packageData.devDependencies["@types/node"] = "^20.0.0";
    }

    return JSON.stringify(packageData, null, 2);
  }
});