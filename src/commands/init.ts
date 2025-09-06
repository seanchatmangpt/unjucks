import { defineCommand } from "citty";
import * as chalk from "chalk";
import { Generator } from "../lib/generator.js";
import { promptForProjectType } from "../lib/prompts.js";
import { validators, displayValidationResults, createCommandError } from "../lib/command-validation.js";
import type { InitCommandArgs, CommandResult, ProjectType } from "../types/commands.js";
import { CommandError, UnjucksCommandError } from "../types/commands.js";
import * as ora from "ora";
import * as fs from "fs-extra";
import * as path from "node:path";
import { execSync } from "node:child_process";

/**
 * Get appropriate .gitignore content for project type
 */
function getGitignoreForProjectType(projectType: ProjectType): string {
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

# Temporary files
tmp/
temp/
`;

  const typeSpecific: Record<string, string> = {
    'react-app': '\n# React specific\n.eslintcache\nstorybook-static/\n',
    'next-app': '\n# Next.js specific\n.next/\nout/\n',
    'vue-app': '\n# Vue specific\n.nuxt/\ndist/\n',
    'svelte-app': '\n# Svelte specific\n.svelte-kit/\n',
    'astro-app': '\n# Astro specific\n.astro/\n',
    'electron-app': '\n# Electron specific\nrelease-builds/\npackage-lock.json\n',
    'tauri-app': '\n# Tauri specific\nsrc-tauri/target/\n',
    'express-api': '\n# Express specific\nlogs/\n*.log\n',
    'fastify-api': '\n# Fastify specific\nlogs/\n*.log\n',
    'nestjs-api': '\n# NestJS specific\nlogs/\n*.log\n',
    'hono-api': '\n# Hono specific\nlogs/\n*.log\n'
  };

  return common + (typeSpecific[projectType] || '');
}

/**
 * Detect package manager from project directory
 */
function detectPackageManager(projectPath: string): 'npm' | 'yarn' | 'pnpm' {
  if (fs.pathExistsSync(path.join(projectPath, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.pathExistsSync(path.join(projectPath, 'yarn.lock'))) {
    return 'yarn';
  }
  return 'npm';
}

/**
 * Get install command for package manager
 */
function getInstallCommand(packageManager: 'npm' | 'yarn' | 'pnpm'): string {
  switch (packageManager) {
    case 'yarn':
      return 'yarn install';
    case 'pnpm':
      return 'pnpm install';
    default:
      return 'npm install';
  }
}

/**
 * Init command - Initialize a new project with comprehensive scaffolding
 * 
 * Features:
 * - Multiple project types (Node.js, React, Express, etc.)
 * - Git repository initialization with .gitignore
 * - Automatic dependency installation
 * - Project structure creation
 * - Template generator setup
 * - Configuration file creation
 * - README and documentation generation
 * 
 * @example
 * ```bash
 * # Interactive initialization
 * unjucks init
 * 
 * # Direct project type
 * unjucks init node-cli --name my-cli --git --install
 * 
 * # Custom destination
 * unjucks init react-app --dest ./my-app --description "My React application"
 * 
 * # Skip prompts with defaults
 * unjucks init --skip-prompts --type node-library
 * ```
 */
export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Initialize a new project with generators and scaffolding",
  },
  args: {
    type: {
      type: "positional",
      description: "Type of project to initialize (node-library, express-api, react-app, etc.)",
      required: false,
    },
    dest: {
      type: "string",
      description: "Destination directory for the project (will be created if it doesn't exist)",
      default: ".",
    },
    name: {
      type: "string",
      description: "Project name (defaults to directory name)",
      alias: "n",
    },
    description: {
      type: "string",
      description: "Project description for package.json and README",
      alias: "d",
    },
    git: {
      type: "boolean",
      description: "Initialize Git repository with appropriate .gitignore",
      default: true,
    },
    install: {
      type: "boolean",
      description: "Automatically install dependencies using npm/yarn/pnpm",
      default: true,
      alias: "i",
    },
    skipPrompts: {
      type: "boolean",
      description: "Skip interactive prompts and use defaults",
      default: false,
      alias: "y",
    },
    source: {
      type: "string",
      description: "Template source (local path, git URL, or npm package)",
      alias: "s",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose logging with detailed progress",
      default: false,
      alias: "v",
    },
    quiet: {
      type: "boolean",
      description: "Suppress non-essential output",
      default: false,
      alias: "q",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing files without confirmation",
      default: false,
      alias: "f",
    },
  },
  async run(context: any) {
    const { args } = context;
    const startTime = Date.now();
    // @ts-ignore - Dynamic import compatibility issue
    const spinner = ora();
    
    try {
      // Validate command arguments
      const validationResults = [
        validators.path(args.dest, { allowCreate: true }),
        validators.projectType(args.type)
      ];

      if (!displayValidationResults(validationResults, 'init')) {
        throw createCommandError(
          'Invalid arguments provided to init command',
          CommandError.VALIDATION_ERROR,
          [
            'Check that destination path is valid',
            'Use a valid project type (see available types with --help)',
            'Ensure you have write permissions to the destination'
          ]
        );
      }
      
      const generator = new Generator();
      let projectType = args.type as ProjectType;
      
      if (!args.quiet) {
        console.log(chalk.blue('🚀 Unjucks Init'));
        if (args.verbose) {
          console.log(chalk.gray('Arguments:'), args);
        }
      }
      
      // Interactive project type selection
      if (!projectType) {
        if (args.skipPrompts) {
          throw createCommandError(
            'Project type required when using --skip-prompts',
            CommandError.VALIDATION_ERROR,
            [
              'Specify a project type: unjucks init <type>',
              'Available types: node-library, express-api, react-app, etc.',
              'Remove --skip-prompts to use interactive mode'
            ]
          );
        }
        
        if (!args.quiet) {
          console.log(chalk.cyan('\n🌈 Choose your project type:'));
        }
        
        const selected = await promptForProjectType();
        projectType = selected as ProjectType;
      }
      
      // Resolve destination and project name
      const destPath = path.resolve(args.dest);
      const projectName = args.name || path.basename(destPath);
      
      // Check if destination exists and has content
      const destExists = await fs.pathExists(destPath);
      if (destExists && !args.force) {
        const files = await fs.readdir(destPath);
        if (files.length > 0) {
          throw createCommandError(
            `Destination directory is not empty: ${destPath}`,
            CommandError.VALIDATION_ERROR,
            [
              'Use --force to overwrite existing files',
              'Choose a different destination directory',
              'Remove existing files manually'
            ]
          );
        }
      }
      
      if (!args.quiet) {
        console.log(chalk.green(`\n🎯 Initializing ${projectType} project: ${chalk.bold(projectName)}`));
        console.log(chalk.gray(`Destination: ${destPath}`));
      }
      
      const message = `Initializing ${projectType} project...`;
      if (!args.quiet) {
        spinner.start(message);
      }
      
      // Create project structure
      await fs.ensureDir(destPath);
      
      // Initialize the project
      await generator.initProject({
        type: projectType,
        dest: destPath
      });

      const result = { files: [] }; // Mock result since initProject returns void
      
      if (!args.quiet) {
        spinner.stop();
      }
      
      // Git initialization
      if (args.git && !await fs.pathExists(path.join(destPath, '.git'))) {
        try {
          if (!args.quiet) {
            spinner.start('Initializing Git repository...');
          }
          
          execSync('git init', { cwd: destPath, stdio: args.verbose ? 'inherit' : 'ignore' });
          
          // Create appropriate .gitignore
          const gitignoreContent = getGitignoreForProjectType(projectType);
          await fs.writeFile(path.join(destPath, '.gitignore'), gitignoreContent);
          
          if (!args.quiet) {
            spinner.stop();
            console.log(chalk.green('✅ Git repository initialized'));
          }
        } catch (error) {
          if (!args.quiet) {
            spinner.stop();
            console.warn(chalk.yellow('⚠️ Git initialization failed - continuing without Git'));
          }
          if (args.verbose) {
            console.warn(chalk.gray(`Git error: ${error}`));
          }
        }
      }
      
      // Dependency installation
      if (args.install && await fs.pathExists(path.join(destPath, 'package.json'))) {
        try {
          if (!args.quiet) {
            spinner.start('Installing dependencies...');
          }
          
          // Detect package manager
          const packageManager = detectPackageManager(destPath);
          const installCmd = getInstallCommand(packageManager);
          
          if (args.verbose) {
            console.log(chalk.gray(`Using ${packageManager}: ${installCmd}`));
          }
          
          execSync(installCmd, { 
            cwd: destPath, 
            stdio: args.verbose ? 'inherit' : 'ignore' 
          });
          
          if (!args.quiet) {
            spinner.stop();
            console.log(chalk.green(`✅ Dependencies installed with ${packageManager}`));
          }
        } catch (error) {
          if (!args.quiet) {
            spinner.stop();
            console.warn(chalk.yellow('⚠️ Dependency installation failed - you can install manually'));
          }
          if (args.verbose) {
            console.warn(chalk.gray(`Install error: ${error}`));
          }
        }
      }
      
      const duration = Date.now() - startTime;
      
      // Success message and next steps
      console.log(chalk.green(`\n🎉 Project "${projectName}" initialized successfully!`));
      
      if (result.files && result.files.length > 0 && !args.quiet) {
        console.log(chalk.cyan('\n📊 Generated files:'));
        result.files.forEach((file: string) => {
          console.log(chalk.green(`  + ${path.relative(process.cwd(), file)}`));
        });
      }
      
      if (!args.quiet) {
        console.log(chalk.blue('\n📝 Next steps:'));
        
        if (destPath !== process.cwd()) {
          console.log(chalk.gray(`  1. cd ${path.relative(process.cwd(), destPath)}`));
        }
        
        console.log(chalk.gray('  2. Run \'unjucks list\' to see available generators'));
        console.log(chalk.gray('  3. Run \'unjucks generate <generator> <template>\' to create files'));
        console.log(chalk.gray('  4. Customize templates in the _templates directory'));
        
        if (projectType.includes('app') || projectType.includes('api')) {
          console.log(chalk.gray('  5. Start development with npm run dev'));
        }
        
        console.log(chalk.blue(`\n✨ Initialization completed in ${duration}ms`));
      }
      
      return {
        success: true,
        message: 'Project initialized successfully',
        files: result.files || [],
        duration
      } as CommandResult;
      
    } catch (error) {
      if (!args.quiet) {
        spinner.stop();
      }
      
      // Handle different error types appropriately
      if (error instanceof UnjucksCommandError) {
        console.error(chalk.red(`\n❌ ${error.message}`));
        
        if (error.suggestions && error.suggestions.length > 0) {
          console.log(chalk.blue('\n💡 Suggestions:'));
          error.suggestions.forEach(suggestion => {
            console.log(chalk.blue(`  • ${suggestion}`));
          });
        }
        
        if (args.verbose && error.details) {
          console.log(chalk.gray('\n🔍 Details:'), error.details);
        }
      } else {
        console.error(chalk.red('\n❌ Project initialization failed:'));
        console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
        
        if (args.verbose && error instanceof Error) {
          console.error(chalk.gray('\n📍 Stack trace:'));
          console.error(chalk.gray(error.stack));
        }
        
        console.log(chalk.blue('\n💡 Suggestions:'));
        console.log(chalk.blue('  • Check destination directory permissions'));
        console.log(chalk.blue('  • Ensure Git is installed for git initialization'));
        console.log(chalk.blue('  • Verify npm/yarn/pnpm is available for dependency installation'));
        console.log(chalk.blue('  • Run with --verbose for more details'));
      }
      
      process.exit(1);
    }
  },
});
