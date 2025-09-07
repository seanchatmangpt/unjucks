#!/usr/bin/env node

import { defineCommand, runMain as cittyRunMain } from "citty";
import chalk from "chalk";
import { createRequire } from 'module';

// Create require function for ES modules
const require = createRequire(import.meta.url);
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Import all commands (temporarily commented out until converted to JavaScript)
// TODO: Uncomment once all command files are converted to .js
// import { generateCommand } from '../commands/generate.js';
// import { listCommand } from '../commands/list.js';
// import { injectCommand } from '../commands/inject.js';
// import { initCommand } from '../commands/init.js';
// import { semanticCommand } from '../commands/semantic.js';
// import { migrateCommand } from '../commands/migrate.js';
// import { versionCommand } from '../commands/version.js';

// Import NEW enhanced commands
// import { swarmCommand } from '../commands/swarm.js';
// import workflowCommand from '../commands/workflow.js';
// import { perfCommand } from '../commands/perf.js';
// import { githubCommand } from '../commands/github.js';

// Temporary placeholder commands for testing
const createPlaceholderCommand = (name, description) => ({
  meta: { name, description },
  run() {
    console.log(chalk.yellow(`⚠️  ${name} command is not yet available (TypeScript conversion in progress)`));
    console.log(chalk.gray(`   Description: ${description}`));
    console.log(chalk.gray(`   This command will be available once all TypeScript files are converted to JavaScript.`));
  }
});

// Placeholder commands until TypeScript conversion is complete
const generateCommand = createPlaceholderCommand('generate', 'Generate files from templates');
const listCommand = createPlaceholderCommand('list', 'List available generators');
const injectCommand = createPlaceholderCommand('inject', 'Inject code into existing files');
const initCommand = createPlaceholderCommand('init', 'Initialize a new project');
const semanticCommand = createPlaceholderCommand('semantic', 'Generate code from RDF/OWL ontologies');
const migrateCommand = createPlaceholderCommand('migrate', 'Database and project migration utilities');
const versionCommand = createPlaceholderCommand('version', 'Show version information');
const swarmCommand = createPlaceholderCommand('swarm', 'Multi-agent swarm coordination');
const workflowCommand = createPlaceholderCommand('workflow', 'Automated development workflow management');
const perfCommand = createPlaceholderCommand('perf', 'Performance analysis and optimization tools');
const githubCommand = createPlaceholderCommand('github', 'GitHub integration and repository management');

// All commands now imported from their respective modules

// Template help command - using simple implementation
const helpCommand = defineCommand({
  meta: {
    name: "help",
    description: "Show template variable help",
  },
  run() {
    console.log(chalk.blue.bold("🆘 Template Help"));
    console.log(chalk.gray("Shows available template variables and their usage"));
    console.log();
    console.log(chalk.yellow("Use 'unjucks help <generator> <template>' for specific template help"));
  },
});

// All other commands are now imported from their respective modules

/**
 * Get package version from package.json (production ready)
 * @returns {string} The version string
 */
function getVersion() {
  // Try to read from package.json first (more reliable than npm_package_version)
  try {
    const packageJson = require('../../package.json');
    return packageJson.version;
  } catch {
    // Fallback to npm environment variable if available
    if (process.env.npm_package_version && process.env.npm_package_version !== '0.0.0') {
      return process.env.npm_package_version;
    }
    return "2025.09.06.17.40"; // Default fallback version
  }
}

/**
 * Enhanced pre-process arguments to handle comprehensive Hygen-style positional syntax
 * Transforms positional arguments to explicit command syntax for internal processing
 * @returns {string[]} Processed arguments array
 */
const preprocessArgs = () => {
  const rawArgs = process.argv.slice(2);
  
  if (rawArgs.length === 0) {
    return rawArgs;
  }
  
  const firstArg = rawArgs[0];
  
  if (!firstArg) {
    return rawArgs;
  }
  
  // Don't transform if already using explicit commands
  if (['generate', 'list', 'inject', 'init', 'version', 'help', 'semantic', 'swarm', 'workflow', 'perf', 'github', 'migrate'].includes(firstArg)) {
    return rawArgs;
  }
  
  // Don't transform if first argument is a flag
  if (firstArg.startsWith('-')) {
    return rawArgs;
  }
  
  // Handle Hygen-style positional syntax: unjucks <generator> <template> [name] [args...]
  // Examples:
  // - unjucks component react MyComponent
  // - unjucks component new UserProfile 
  // - unjucks api endpoint users --withAuth
  if (rawArgs.length >= 2 && rawArgs[1] && !rawArgs[1].startsWith('-')) {
    // Store original args in environment for ArgumentParser to use
    process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(rawArgs);
    // Transform to: unjucks generate <generator> <template> [remaining-args...]
    return ['generate', ...rawArgs];
  }
  
  // Single argument that's not a command - show help
  if (rawArgs.length === 1) {
    return ['--help'];
  }
  
  return rawArgs;
};

// Override process.argv for Citty
const originalArgv = process.argv;
process.argv = [...process.argv.slice(0, 2), ...preprocessArgs()];

/**
 * Main CLI application definition
 * Handles the primary command routing and help display
 */
const main = defineCommand({
  meta: {
    name: "unjucks",
    version: getVersion(),
    description:
      "A Hygen-style CLI generator for creating templates and scaffolding projects",
  },
  args: {
    version: {
      type: "boolean",
      description: "Show version information",
    },
    help: {
      type: "boolean", 
      description: "Show help information",
    }
  },
  subCommands: {
    generate: generateCommand,
    list: listCommand,
    inject: injectCommand,
    init: initCommand,
    semantic: semanticCommand,
    swarm: swarmCommand,
    workflow: workflowCommand,
    perf: perfCommand,
    github: githubCommand,
    migrate: migrateCommand,
    version: versionCommand,
    help: helpCommand,
  },
  /**
   * Main run handler for the CLI application
   * @param {Object} ctx - Context object containing parsed arguments
   * @param {Object} ctx.args - Parsed command-line arguments
   */
  run({ args }) {
    // Handle --version flag
    if (args.version) {
      console.log(getVersion());
      return;
    }

    // Handle --help flag
    if (args.help) {
      console.log(chalk.blue.bold("🌆 Unjucks CLI"));
      console.log(chalk.gray("A Hygen-style CLI generator for creating templates and scaffolding projects"));
      console.log();
      console.log(chalk.yellow("USAGE:"));
      console.log(chalk.gray("  unjucks <generator> <template> [args...]  # Positional syntax (Hygen-style)"));
      console.log(chalk.gray("  unjucks generate <generator> <template>   # Explicit syntax"));
      console.log();
      console.log(chalk.yellow("COMMANDS:"));
      console.log(chalk.gray("  generate  Generate files from templates"));
      console.log(chalk.gray("  list      List available generators"));
      console.log(chalk.gray("  inject    Inject code into existing files"));
      console.log(chalk.gray("  init      Initialize a new project"));
      console.log(chalk.gray("  semantic  Generate code from RDF/OWL ontologies with semantic awareness"));
      console.log(chalk.gray("  swarm     Multi-agent swarm coordination and management"));
      console.log(chalk.gray("  workflow  Automated development workflow management"));
      console.log(chalk.gray("  perf      Performance analysis and optimization tools"));
      console.log(chalk.gray("  github    GitHub integration and repository management"));
      console.log(chalk.gray("  migrate   Database and project migration utilities"));
      console.log(chalk.gray("  version   Show version information"));
      console.log(chalk.gray("  help      Show template variable help"));
      console.log();
      console.log(chalk.yellow("OPTIONS:"));
      console.log(chalk.gray("  --version, -v  Show version information"));
      console.log(chalk.gray("  --help, -h     Show help information"));
      console.log();
      console.log(chalk.yellow("EXAMPLES:"));
      console.log(chalk.gray("  unjucks component react MyComponent   # Hygen-style positional"));
      console.log(chalk.gray("  unjucks component new UserProfile     # Hygen-style with 'new'"));
      console.log(chalk.gray("  unjucks api endpoint users --auth     # Mixed positional + flags"));
      console.log(chalk.gray("  unjucks generate component citty      # Explicit syntax"));
      console.log(chalk.gray("  unjucks list                          # List generators"));
      console.log(chalk.gray("  unjucks semantic generate -o schema.ttl --enterprise  # RDF code generation"));
      console.log(chalk.gray("  unjucks swarm init --topology mesh    # Initialize agent swarm"));
      console.log(chalk.gray("  unjucks workflow create --name api-dev # Create development workflow"));
      console.log(chalk.gray("  unjucks perf benchmark --suite all    # Run performance benchmarks"));
      console.log(chalk.gray("  unjucks github analyze --repo owner/repo # Analyze repository"));
      return;
    }

    // Default help output when no arguments
    console.log(chalk.blue.bold("🌆 Unjucks CLI"));
    console.log(chalk.gray("A Hygen-style CLI generator for creating templates and scaffolding projects"));
    console.log();
    console.log(chalk.yellow("Usage:"));
    console.log(chalk.gray("  unjucks <generator> <template> [args...]  # Positional syntax (Hygen-style)"));
    console.log(chalk.gray("  unjucks generate <generator> <template>   # Explicit syntax"));
    console.log();
    console.log(chalk.yellow("Available commands:"));
    console.log(chalk.gray("  generate  Generate files from templates"));
    console.log(chalk.gray("  list      List available generators"));
    console.log(chalk.gray("  inject    Inject code into existing files"));
    console.log(chalk.gray("  init      Initialize a new project"));
    console.log(chalk.gray("  semantic  Generate code from RDF/OWL ontologies with semantic awareness"));
    console.log(chalk.gray("  swarm     Multi-agent swarm coordination and management"));
    console.log(chalk.gray("  workflow  Automated development workflow management"));
    console.log(chalk.gray("  perf      Performance analysis and optimization tools"));
    console.log(chalk.gray("  github    GitHub integration and repository management"));
    console.log(chalk.gray("  migrate   Database and project migration utilities"));
    console.log(chalk.gray("  version   Show version information"));
    console.log(chalk.gray("  help      Show template variable help"));
    console.log();
    console.log(chalk.yellow("Examples:"));
    console.log(chalk.gray("  unjucks component react MyComponent   # Hygen-style positional"));
    console.log(chalk.gray("  unjucks component new UserProfile     # Hygen-style with 'new'"));
    console.log(chalk.gray("  unjucks api endpoint users --auth     # Mixed positional + flags"));
    console.log(chalk.gray("  unjucks generate component citty      # Explicit syntax"));
    console.log(chalk.gray("  unjucks list                          # List generators"));
    console.log(chalk.gray("  unjucks semantic generate -o schema.ttl --enterprise  # RDF code generation"));
    console.log(chalk.gray("  unjucks swarm init --topology mesh    # Initialize agent swarm"));
    console.log(chalk.gray("  unjucks workflow create --name api-dev # Create development workflow"));
    console.log(chalk.gray("  unjucks perf benchmark --suite all    # Run performance benchmarks"));
    console.log(chalk.gray("  unjucks github analyze --repo owner/repo # Analyze repository"));
    console.log();
    console.log(chalk.gray("Use --help with any command for more information."));
  },
});

/**
 * Export the main runner function for external use
 * @returns {Promise<void>} Promise that resolves when CLI execution completes
 */
export const runMain = () => cittyRunMain(main);

// Auto-run if this is the main module (ES module compatible check)
if (import.meta.url === `file://${process.argv[1]}`) {
  cittyRunMain(main);
}