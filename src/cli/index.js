#!/usr/bin/env node

import { defineCommand, runMain as cittyRunMain } from "citty";
import chalk from "chalk";

// Import all commands (fixed paths - CLI is in src/cli/, commands in src/commands/)
import { generateCommand } from '../commands/generate.js';
import { listCommand } from '../commands/list.js';
import { injectCommand } from '../commands/inject.js';
import { initCommand } from '../commands/init.js';
import { semanticCommand } from '../commands/semantic.js';
import { migrateCommand } from '../commands/migrate.js';
import { githubCommand } from '../commands/github.js';
import { versionCommand } from '../commands/version.js';
import { newCommand } from '../commands/new.js';
import { previewCommand } from '../commands/preview.js';
import { helpCommand as advancedHelpCommand } from '../commands/help.js';
import { latexCommand } from '../commands/latex.js';
import { perfCommand } from '../commands/perf.js';
import { specifyCommand } from '../commands/specify.js';
import { exportCommand } from '../commands/export.js';
import pdfCommand from '../commands/pdf.js';
import exportDocxCommand from './commands/export-docx.js';

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

// Import fast version resolver
import { getVersion } from '../lib/fast-version-resolver.js';

/**
 * Enhanced pre-process arguments to handle comprehensive Hygen-style positional syntax
 * Optimized for performance with early returns
 * @returns {string[]} Processed arguments
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
  
  // Don't transform if already using explicit commands (optimized lookup)
  const explicitCommands = new Set(['generate', 'new', 'preview', 'help', 'list', 'init', 'inject', 'version', 'semantic', 'swarm', 'workflow', 'perf', 'github', 'knowledge', 'neural', 'migrate', 'latex', 'specify', 'export', 'export-docx', 'pdf']);
  if (explicitCommands.has(firstArg)) {
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

// Main CLI application
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
    // PRIMARY UNIFIED COMMANDS
    new: newCommand,            // Primary command - clear intent
    preview: previewCommand,    // Safe exploration
    help: advancedHelpCommand,  // Context-sensitive help
    
    // SECONDARY COMMANDS
    list: listCommand,
    init: initCommand,
    inject: injectCommand,
    version: versionCommand,
    
    // LEGACY SUPPORT
    generate: generateCommand,  // Legacy command with deprecation warnings
    
    // ADVANCED FEATURES
    semantic: semanticCommand,
    github: githubCommand,
    migrate: migrateCommand,
    latex: latexCommand,
    perf: perfCommand,
    specify: specifyCommand,
    export: exportCommand,
    'export-docx': exportDocxCommand,
    pdf: pdfCommand,
  },
  /**
   * @param {{ args: any }} params - Command parameters
   */
  run({ args }) {
    // If we've detected that a subcommand already executed successfully,
    // don't show the main help to avoid confusion
    const originalArgs = process.argv.slice(2);
    const hasSubcommand = originalArgs.length > 0 && 
      ['semantic', 'github', 'neural', 'workflow', 'perf', 'knowledge', 'migrate', 'swarm', 'specify', 'latex', 'export', 'export-docx', 'pdf'].includes(originalArgs[0]) &&
      !originalArgs.includes('--help') && !originalArgs.includes('-h');
    
    if (hasSubcommand) {
      return { success: true, action: 'subcommand-completed', skipMainHelp: true };
    }
    
    // Handle --version flag
    if (args.version) {
      console.log(getVersion());
      // Ensure output is flushed
      if (process.stdout.isTTY === false) {
        process.stdout.write('');
      }
      return { success: true, action: 'version' };
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
      console.log(chalk.gray("  new       Create new projects and components (primary)"));
      console.log(chalk.gray("  preview   Preview template output without writing files"));
      console.log(chalk.gray("  help      Show template variable help"));
      console.log(chalk.gray("  generate  Generate files from templates (legacy)"));
      console.log(chalk.gray("  list      List available generators and templates"));
      console.log(chalk.gray("  inject    Inject or modify content in existing files"));
      console.log(chalk.gray("  init      Initialize a new project with scaffolding"));
      console.log(chalk.gray("  semantic  Generate code from RDF/OWL ontologies with semantic awareness"));
      console.log(chalk.gray("  swarm     Multi-agent swarm coordination and management"));
      console.log(chalk.gray("  workflow  Automated development workflow management"));
      console.log(chalk.gray("  perf      Performance analysis and optimization tools"));
      console.log(chalk.gray("  github    GitHub integration and repository management"));
      console.log(chalk.gray("  knowledge RDF/OWL ontology and semantic knowledge management"));
      console.log(chalk.gray("  neural    AI/ML neural network training and inference"));
      console.log(chalk.gray("  migrate   Database and project migration utilities"));
      console.log(chalk.gray("  latex     LaTeX document generation, compilation, and management"));
      console.log(chalk.gray("  specify   Specification-driven development tools and workflows"));
      console.log(chalk.gray("  version   Show version information"));
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
      console.log(chalk.gray("  unjucks specify init my-project --type api # Spec-driven project setup"));
      // Ensure output is flushed
      if (process.stdout.isTTY === false) {
        process.stdout.write('');
      }
      return { success: true, action: 'help' };
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
    console.log(chalk.gray("  new       Create new projects and components (primary)"));
    console.log(chalk.gray("  preview   Preview template output without writing files"));
    console.log(chalk.gray("  help      Show template variable help"));
    console.log(chalk.gray("  generate  Generate files from templates (legacy)"));
    console.log(chalk.gray("  list      List available generators and templates"));
    console.log(chalk.gray("  inject    Inject code into existing files"));
    console.log(chalk.gray("  init      Initialize a new project"));
    console.log(chalk.gray("  semantic  Generate code from RDF/OWL ontologies with semantic awareness"));
    console.log(chalk.gray("  swarm     Multi-agent swarm coordination and management"));
    console.log(chalk.gray("  workflow  Automated development workflow management"));
    console.log(chalk.gray("  perf      Performance analysis and optimization tools"));
    console.log(chalk.gray("  github    GitHub integration and repository management"));
    console.log(chalk.gray("  knowledge RDF/OWL ontology and semantic knowledge management"));
    console.log(chalk.gray("  neural    AI/ML neural network training and inference"));
    console.log(chalk.gray("  migrate   Database and project migration utilities"));
    console.log(chalk.gray("  latex     LaTeX document generation, compilation, and management"));
    console.log(chalk.gray("  specify   Specification-driven development tools and workflows"));
    console.log(chalk.gray("  version   Show version information"));
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
    console.log(chalk.gray("  unjucks latex generate --template article --interactive # Generate LaTeX document"));
    console.log(chalk.gray("  unjucks latex compile document.tex      # Compile to PDF"));
    console.log(chalk.gray("  unjucks specify init my-project --type api # Spec-driven project setup"));
    console.log();
    console.log(chalk.gray("Use --help with any command for more information."));
    return { success: true, action: 'help' };
  },
});

export const runMain = () => cittyRunMain(main);

// Auto-run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  cittyRunMain(main);
}