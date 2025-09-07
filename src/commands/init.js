import { defineCommand } from "citty";
import * as chalk from "chalk";
import { Generator } from "../lib/generator.js";
import { promptForProjectType } from "../lib/prompts.js";
import { validators, displayValidationResults, createCommandError } from "../lib/command-validation.js";
import { CommandError, UnjucksCommandError } from "../types/commands.js";
import { handleError, ConfigurationError, ErrorCategory } from "../lib/actionable-error.js";
import * as ora from "ora";
import * as fs from "fs-extra";
import * as path from "node:path";
import { execSync } from "node:child_process";

/**
 * @typedef {Object} InitCommandArgs
 * @property {string} [type] - Project type
 * @property {string} [name] - Project name
 * @property {string} [dest] - Destination directory
 * @property {boolean} [force] - Force overwrite existing files
 * @property {boolean} [skipGit] - Skip git initialization
 * @property {boolean} [skipInstall] - Skip dependency installation
 * @property {boolean} [quiet] - Suppress output
 * @property {boolean} [verbose] - Enable verbose logging
 */

/**
 * @typedef {Object} CommandResult
 * @property {boolean} success - Whether the command succeeded
 * @property {string} message - Result message
 * @property {string[]} files - Array of files created
 * @property {number} duration - Execution time in milliseconds
 */

/**
 * @typedef {'react'|'vue'|'angular'|'node'|'express'|'next'|'cli'|'library'} ProjectType
 */

/**
 * Get appropriate .gitignore content for project type
 * @param {ProjectType} projectType - The project type
 * @returns {string} Gitignore content
 */
function getGitignoreForProjectType(projectType) {
  const common = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# Build outputs
build/
dist/
out/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE and editor files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Logs
logs
*.log

# Temporary files
.tmp/
.cache/
.parcel-cache/
`;

  const projectSpecific = {
    react: `
# React specific
.env.development.local
.env.test.local
.env.production.local
.env.local

# Production build
/build

# Storybook
storybook-static/
`,
    vue: `
# Vue specific
.env.local
.env.*.local

# Vue build output
/dist

# Vue CLI generated files
.env.local
.env.*.local
`,
    angular: `
# Angular specific
/dist
/tmp
/out-tsc
/bazel-out

# Angular CLI cache
.angular/cache
`,
    next: `
# Next.js specific
/.next/
/out/

# Next.js production build files
*.tsbuildinfo
next-env.d.ts
`,
    node: `
# Node.js specific
lib-cov
*.coverage
.nyc_output
.grunt
bower_components
`,
    express: `
# Express specific
uploads/
public/uploads/
sessions/
`,
    cli: `
# CLI specific
*.tgz
package-lock.json
`,
    library: `
# Library specific
lib/
types/
*.d.ts
`
  };

  return common + (projectSpecific[projectType] || '');
}

/**
 * Get base templates for project type
 * @param {ProjectType} projectType - The project type
 * @returns {Object} Template configuration
 */
function getBaseTemplatesForProjectType(projectType) {
  const templates = {
    react: {
      'component/functional': {
        'component.njk': `---
to: <%= dest %>/components/<%= name %>.jsx
---
import React from 'react';
import PropTypes from 'prop-types';

/**
 * <%= name %> component
 * @param {Object} props - Component props
 */
const <%= name %> = ({ children, className = '' }) => {
  return (
    <div className={\`<%= name.toLowerCase() %> \${className}\`}>
      {children}
    </div>
  );
};

<%= name %>.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

export default <%= name %>;`
      },
      'component/class': {
        'component.njk': `---
to: <%= dest %>/components/<%= name %>.jsx
---
import React, { Component } from 'react';
import PropTypes from 'prop-types';

/**
 * <%= name %> component
 */
class <%= name %> extends Component {
  static propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
  };

  static defaultProps = {
    className: '',
  };

  render() {
    const { children, className } = this.props;

    return (
      <div className={\`<%= name.toLowerCase() %> \${className}\`}>
        {children}
      </div>
    );
  }
}

export default <%= name %>;`
      }
    },
    vue: {
      'component/single-file': {
        'component.njk': `---
to: <%= dest %>/components/<%= name %>.vue
---
<template>
  <div class="<%= name.toLowerCase() %>">
    <slot />
  </div>
</template>

<script>
export default {
  name: '<%= name %>',
  props: {
    // Define props here
  },
  data() {
    return {
      // Component data
    };
  },
  methods: {
    // Component methods
  },
};
</script>

<style scoped>
.<%= name.toLowerCase() %> {
  /* Component styles */
}
</style>`
      }
    },
    node: {
      'module/basic': {
        'module.njk': `---
to: <%= dest %>/<%= name.toLowerCase() %>.js
---
/**
 * <%= name %> module
 * @module <%= name %>
 */

/**
 * Main function for <%= name %>
 * @param {Object} options - Configuration options
 * @returns {Promise<any>} Result
 */
async function <%= name.toLowerCase() %>(options = {}) {
  // Implementation here
  return options;
}

module.exports = {
  <%= name.toLowerCase() %>,
};`
      }
    }
  };

  return templates[projectType] || {};
}

/**
 * Initialize command - Set up a new project with scaffolding
 *
 * Features:
 * - Project type selection (React, Vue, Node.js, etc.)
 * - Base template generation
 * - Git repository initialization
 * - Dependency installation
 * - Project structure creation
 * - Configuration file setup
 *
 * @example
 * ```bash
 * # Interactive mode
 * unjucks init
 *
 * # Specific project type
 * unjucks init --type react --name my-app
 *
 * # Skip git and install
 * unjucks init --type node --skip-git --skip-install
 * ```
 */
export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Initialize a new project with scaffolding and templates",
  },
  args: {
    type: {
      type: "string",
      description: "Project type (react, vue, angular, node, express, next, cli, library)",
    },
    name: {
      type: "string",
      description: "Project name (defaults to current directory name)",
    },
    dest: {
      type: "string",
      description: "Destination directory (defaults to current directory)",
      default: ".",
    },
    force: {
      type: "boolean",
      description: "Force initialization even if directory is not empty",
      default: false,
    },
    skipGit: {
      type: "boolean",
      description: "Skip git repository initialization",
      default: false,
      alias: "skip-git",
    },
    skipInstall: {
      type: "boolean",
      description: "Skip npm/yarn dependency installation",
      default: false,
      alias: "skip-install",
    },
    quiet: {
      type: "boolean",
      description: "Suppress non-essential output",
      default: false,
      alias: "q",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose logging with detailed information",
      default: false,
      alias: "v",
    },
  },
  /**
   * Main execution handler for the init command
   * @param {Object} context - Command context
   * @param {InitCommandArgs} context.args - Parsed command arguments
   * @returns {Promise<CommandResult>} Command execution result
   */
  async run(context) {
    const { args } = context;
    const startTime = Date.now();
    const spinner = ora();
    const createdFiles = [];

    try {
      // Validate command arguments
      const validationResults = [
        validators.projectType(args.type, { required: false }),
        validators.projectName(args.name, { required: false }),
        validators.path(args.dest, { allowCreate: true }),
      ];

      if (!displayValidationResults(validationResults, "init")) {
        throw createCommandError(
          "Invalid arguments provided to init command",
          CommandError.VALIDATION_ERROR,
          [
            "Check valid project types: react, vue, angular, node, express, next, cli, library",
            "Ensure project name follows naming conventions",
            "Verify destination path is valid and writable",
          ]
        );
      }

      if (!args.quiet) {
        console.log(chalk.blue("🎯 Unjucks Init"));
        if (args.verbose) {
          console.log(chalk.gray("Arguments:"), args);
        }
      }

      const destPath = path.resolve(args.dest);
      const projectName = args.name || path.basename(destPath);

      // Check if directory exists and is not empty
      if (await fs.pathExists(destPath)) {
        const files = await fs.readdir(destPath);
        if (files.length > 0 && !args.force) {
          throw createCommandError(
            "Directory is not empty",
            CommandError.DIRECTORY_NOT_EMPTY,
            [
              "Use --force to initialize anyway",
              "Choose a different destination directory",
              "Remove existing files manually",
            ]
          );
        }
      }

      // Interactive project type selection if not provided
      let projectType = args.type;
      if (!projectType) {
        if (!args.quiet) {
          console.log(chalk.cyan("\n📋 Project Type Selection"));
        }
        projectType = await promptForProjectType();
      }

      if (!args.quiet) {
        console.log(chalk.green(`\n🚀 Initializing ${projectType} project: ${projectName}`));
        console.log(chalk.gray(`Destination: ${destPath}`));
      }

      // Ensure destination directory exists
      await fs.ensureDir(destPath);

      // Create _templates directory structure
      const templatesDir = path.join(destPath, '_templates');
      await fs.ensureDir(templatesDir);

      if (!args.quiet) {
        spinner.start("Creating template structure...");
      }

      // Generate base templates for project type
      const baseTemplates = getBaseTemplatesForProjectType(projectType);
      for (const [generatorName, templates] of Object.entries(baseTemplates)) {
        const generatorDir = path.join(templatesDir, generatorName);
        await fs.ensureDir(generatorDir);

        for (const [templateName, templateContent] of Object.entries(templates)) {
          const templatePath = path.join(generatorDir, templateName);
          await fs.writeFile(templatePath, templateContent);
          createdFiles.push(path.relative(destPath, templatePath));
        }
      }

      // Create .gitignore
      const gitignorePath = path.join(destPath, '.gitignore');
      if (!await fs.pathExists(gitignorePath) || args.force) {
        const gitignoreContent = getGitignoreForProjectType(projectType);
        await fs.writeFile(gitignorePath, gitignoreContent);
        createdFiles.push('.gitignore');
      }

      // Create basic README.md
      const readmePath = path.join(destPath, 'README.md');
      if (!await fs.pathExists(readmePath) || args.force) {
        const readmeContent = `# ${projectName}

A ${projectType} project generated with Unjucks.

## Getting Started

### Available Generators

Use \`unjucks list\` to see available generators and templates.

### Generating Files

\`\`\`bash
# List available generators
unjucks list

# Generate files
unjucks generate <generator> <template> [options]
\`\`\`

### Project Structure

- \`_templates/\` - Contains generators and templates
- \`src/\` - Source code (recommended)

### Learn More

- [Unjucks Documentation](https://github.com/ruvnet/unjucks)
- [Template Syntax Guide](https://mozilla.github.io/nunjucks/)
`;
        await fs.writeFile(readmePath, readmeContent);
        createdFiles.push('README.md');
      }

      // Create basic package.json for Node.js projects
      if (['node', 'express', 'cli', 'library'].includes(projectType)) {
        const packagePath = path.join(destPath, 'package.json');
        if (!await fs.pathExists(packagePath) || args.force) {
          const packageContent = {
            name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            version: '0.1.0',
            description: `A ${projectType} project generated with Unjucks`,
            main: projectType === 'cli' ? 'bin/cli.js' : 'src/index.js',
            scripts: {
              start: projectType === 'express' ? 'node src/server.js' : 'node src/index.js',
              test: 'echo "Error: no test specified" && exit 1',
              dev: projectType === 'express' ? 'nodemon src/server.js' : 'nodemon src/index.js'
            },
            keywords: [projectType, 'unjucks'],
            author: '',
            license: 'ISC'
          };

          if (projectType === 'cli') {
            packageContent.bin = {
              [projectName]: 'bin/cli.js'
            };
          }

          await fs.writeFile(packagePath, JSON.stringify(packageContent, null, 2));
          createdFiles.push('package.json');
        }
      }

      if (!args.quiet) {
        spinner.stop();
      }

      // Initialize git repository
      if (!args.skipGit) {
        try {
          if (!args.quiet) {
            spinner.start("Initializing git repository...");
          }

          process.chdir(destPath);
          execSync('git init', { stdio: 'pipe' });
          
          if (!args.quiet) {
            spinner.stop();
          }
          
          if (args.verbose) {
            console.log(chalk.gray("✓ Git repository initialized"));
          }
        } catch (error) {
          if (!args.quiet) {
            spinner.stop();
            console.warn(chalk.yellow("⚠ Could not initialize git repository"));
            if (args.verbose) {
              console.warn(chalk.gray(`  ${error.message}`));
            }
          }
        }
      }

      // Install dependencies
      if (!args.skipInstall && ['node', 'express', 'cli', 'library'].includes(projectType)) {
        try {
          if (!args.quiet) {
            spinner.start("Installing dependencies...");
          }

          // Check for package manager preference
          let packageManager = 'npm';
          if (await fs.pathExists(path.join(destPath, 'yarn.lock'))) {
            packageManager = 'yarn';
          } else if (await fs.pathExists(path.join(destPath, 'pnpm-lock.yaml'))) {
            packageManager = 'pnpm';
          }

          execSync(`${packageManager} install`, { stdio: 'pipe', cwd: destPath });
          
          if (!args.quiet) {
            spinner.stop();
          }
          
          if (args.verbose) {
            console.log(chalk.gray(`✓ Dependencies installed with ${packageManager}`));
          }
        } catch (error) {
          if (!args.quiet) {
            spinner.stop();
            console.warn(chalk.yellow("⚠ Could not install dependencies"));
            if (args.verbose) {
              console.warn(chalk.gray(`  ${error.message}`));
            }
          }
        }
      }

      const duration = Date.now() - startTime;

      // Display results
      if (!args.quiet) {
        console.log(chalk.green(`\n✅ Project initialized successfully!`));
        console.log(chalk.gray(`Created ${createdFiles.length} files in ${duration}ms`));

        if (args.verbose) {
          console.log(chalk.blue("\n📁 Created files:"));
          createdFiles.forEach(file => {
            console.log(chalk.gray(`  + ${file}`));
          });
        }

        console.log(chalk.blue("\n📝 Next steps:"));
        if (destPath !== process.cwd()) {
          console.log(chalk.gray(`  1. cd ${path.relative(process.cwd(), destPath)}`));
        }
        console.log(chalk.gray("  2. unjucks list  # See available generators"));
        console.log(chalk.gray("  3. unjucks generate <generator> <template>  # Generate files"));
        
        if (['node', 'express', 'cli', 'library'].includes(projectType) && !args.skipInstall) {
          console.log(chalk.gray("  4. npm start  # Run the project"));
        }
      }

      return {
        success: true,
        message: `${projectType} project initialized successfully`,
        files: createdFiles,
        duration,
      };

    } catch (error) {
      if (!args.quiet) {
        spinner.stop();
      }

      // Handle different error types appropriately  
      if (error instanceof UnjucksCommandError) {
        console.error(chalk.red(`\n❌ ${error.message}`));

        if (error.suggestions && error.suggestions.length > 0) {
          console.log(chalk.blue("\n💡 Suggestions:"));
          error.suggestions.forEach((suggestion) => {
            console.log(chalk.blue(`  • ${suggestion}`));
          });
        }

        if (args.verbose && error.details) {
          console.log(chalk.gray("\n🔍 Details:"), error.details);
        }
      } else {
        console.error(chalk.red("\n❌ Initialization failed:"));
        console.error(
          chalk.red(
            `  ${error instanceof Error ? error.message : String(error)}`
          )
        );

        if (args.verbose && error instanceof Error) {
          console.error(chalk.gray("\n📍 Stack trace:"));
          console.error(chalk.gray(error.stack));
        }

        console.log(chalk.blue("\n💡 Suggestions:"));
        console.log(chalk.blue("  • Check directory permissions"));
        console.log(chalk.blue("  • Ensure destination path is valid"));
        console.log(chalk.blue("  • Use --force to overwrite existing files"));
        console.log(chalk.blue("  • Run with --verbose for more details"));
      }

      // Use error recovery
      const { errorRecovery } = await import("../lib/error-recovery.js");
      errorRecovery.handleError({
        command: "init",
        args: Object.keys(args),
        error: error,
        context: "init"
      }, { verbose: args.verbose, showSuggestions: true, showNextSteps: true });
    }
  },
});