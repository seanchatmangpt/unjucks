#!/usr/bin/env node

import { defineCommand, runMain as cittyRunMain } from "citty";
import chalk from "chalk";

// PERFORMANCE OPTIMIZATION: Lazy load commands to reduce startup time
// Only load commands when they're actually needed
const lazyCommands = {
  generate: () => import('../commands/generate.js').then(m => m.generateCommand),
  list: () => import('../commands/list.js').then(m => m.listCommand),
  inject: () => import('../commands/inject.js').then(m => m.injectCommand),
  init: () => import('../commands/init.js').then(m => m.initCommand),
  semantic: () => import('../commands/semantic.js').then(m => m.semanticCommand),
  migrate: () => import('../commands/migrate.js').then(m => m.migrateCommand),
  version: () => import('../commands/version.js').then(m => m.versionCommand),
  new: () => import('../commands/new.js').then(m => m.newCommand),
  preview: () => import('../commands/preview.js').then(m => m.previewCommand),
  help: () => import('../commands/help.js').then(m => m.helpCommand),
  latex: () => import('../commands/latex.js').then(m => m.latexCommand),
  perf: () => import('../commands/perf.js').then(m => m.perfCommand),
  specify: () => import('../commands/specify.js').then(m => m.specifyCommand),
  export: () => import('../commands/export.js').then(m => m.exportCommand),
  pdf: () => import('../commands/pdf.js').then(m => m.default),
  'export-docx': () => import('./commands/export-docx.js').then(m => m.default)
};

// Cache for loaded commands
const commandCache = new Map();

// Lazy command loader utility
async function loadCommand(commandName) {
  if (commandCache.has(commandName)) {
    return commandCache.get(commandName);
  }
  
  if (!lazyCommands[commandName]) {
    throw new Error(`Unknown command: ${commandName}`);
  }
  
  const command = await lazyCommands[commandName]();
  commandCache.set(commandName, command);
  return command;
}

// Template help command - using simple implementation (kept synchronous for speed)
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

// Lazy command wrapper for performance optimization
function createLazyCommand(commandName) {
  return defineCommand({
    meta: {
      name: commandName,
      description: `${commandName} command (lazy-loaded)`,
    },
    async run(context) {
      try {
        const command = await loadCommand(commandName);
        return await command.run(context);
      } catch (error) {
        console.error(chalk.red(`Failed to load command '${commandName}': ${error.message}`));
        process.exit(1);
      }
    },
  });
}

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
    // PERFORMANCE OPTIMIZATION: Use lazy-loading wrapper for all commands
    // This reduces initial memory footprint and startup time significantly
    new: createLazyCommand('new'),
    preview: createLazyCommand('preview'), 
    help: createLazyCommand('help'),
    list: createLazyCommand('list'),
    init: createLazyCommand('init'),
    inject: createLazyCommand('inject'),
    version: createLazyCommand('version'),
    generate: createLazyCommand('generate'),
    semantic: createLazyCommand('semantic'),
    migrate: createLazyCommand('migrate'),
    latex: createLazyCommand('latex'),
    perf: createLazyCommand('perf'),
    specify: createLazyCommand('specify'),
    export: createLazyCommand('export'),
    'export-docx': createLazyCommand('export-docx'),
    pdf: createLazyCommand('pdf'),
  },
  /**
   * @param {{ args: any }} params - Command parameters
   */
  run({ args }) {
    // If we've detected that a subcommand already executed successfully,
    // don't show the main help to avoid confusion
    const originalArgs = process.argv.slice(2);
    const hasSubcommand = originalArgs.length > 0 && 
      ['new', 'preview', 'help', 'list', 'init', 'inject', 'version', 'generate', 'semantic', 'github', 'neural', 'workflow', 'perf', 'knowledge', 'migrate', 'swarm', 'specify', 'latex', 'export', 'export-docx', 'pdf'].includes(originalArgs[0]) &&
      !originalArgs.includes('--help') && !originalArgs.includes('-h');
    
    if (hasSubcommand) {
      return { success: true, action: 'subcommand-completed', skipMainHelp: true };
    }
    
    // Handle --version flag
    if (args.version) {
      const version = getVersion();
      console.log(version);
      // Ensure output is flushed
      if (process.stdout.isTTY === false) {
        process.stdout.write('');
      }
      return { success: true, action: 'version', output: version };
    }

    // Handle --help flag
    if (args.help) {
      console.log(chalk.blue.bold("🌆 Unjucks CLI"));
      console.log(chalk.gray("A Hygen-style CLI generator for creating templates and scaffolding projects"));
      console.log();
      console.log(chalk.yellow("Usage:"));
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

export const runMain = () => {
  try {
    return cittyRunMain(main);
  } catch (error) {
    // Handle unknown commands and errors
    const originalArgs = process.argv.slice(2);
    if (originalArgs.length > 0) {
      const firstArg = originalArgs[0];
      const knownCommands = ['new', 'preview', 'help', 'list', 'init', 'inject', 'version', 'generate', 'semantic', 'github', 'migrate', 'latex', 'perf', 'specify', 'export', 'export-docx', 'pdf'];
      
      if (!knownCommands.includes(firstArg) && !firstArg.startsWith('-')) {
        console.error(chalk.red(`Unknown command: ${firstArg}`));
        console.log(chalk.blue("\n💡 Available commands:"));
        knownCommands.forEach(cmd => {
          console.log(chalk.blue(`  • ${cmd}`));
        });
        process.exit(1);
      }
    }
    
    console.error(chalk.red(`Error: ${error.message || error}`));
    process.exit(1);
  }
};

// Auto-run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    cittyRunMain(main);
  } catch (error) {
    // Handle unknown commands and errors
    const originalArgs = process.argv.slice(2);
    if (originalArgs.length > 0) {
      const firstArg = originalArgs[0];
      const knownCommands = ['new', 'preview', 'help', 'list', 'init', 'inject', 'version', 'generate', 'semantic', 'github', 'migrate', 'latex', 'perf', 'specify', 'export', 'export-docx', 'pdf'];
      
      if (!knownCommands.includes(firstArg) && !firstArg.startsWith('-')) {
        console.error(chalk.red(`Unknown command: ${firstArg}`));
        console.log(chalk.blue("\n💡 Available commands:"));
        knownCommands.forEach(cmd => {
          console.log(chalk.blue(`  • ${cmd}`));
        });
        process.exit(1);
      }
    }
    
    console.error(chalk.red(`Error: ${error.message || error}`));
    process.exit(1);
  }
}