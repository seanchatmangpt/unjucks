#!/usr/bin/env node

import { defineCommand, runMain as cittyRunMain } from "citty";
import chalk from "chalk";

// Import enhanced CLI framework
import { argumentParser } from './parser.js';
import { commandRouter } from './router.js';
import { helpSystem } from './help-system.js';
import { interactiveMode } from './interactive.js';

// Import all commands (corrected paths)
import { generateCommand } from '../commands/generate.js';
import { listCommand } from '../commands/list.js';
import { injectCommand } from '../commands/inject.js';
import { initCommand } from '../commands/init.js';
import { semanticCommand } from '../commands/semantic.js';
import { migrateCommand } from '../commands/migrate.js';
// import { versionCommand } from '../commands/version.js'; // Temporarily commented out
// import { newCommand } from '../commands/new.js'; // Temporarily commented out
// import { previewCommand } from '../commands/preview.js'; // Temporarily commented out

// Import NEW enhanced commands
// import { swarmCommand } from '../commands/swarm.js'; // Temporarily commented out
// import { workflowCommand } from '../commands/workflow.js'; // Temporarily commented out
// import { perfCommand } from '../commands/perf.js'; // Temporarily commented out
import { githubCommand } from '../commands/github.js';
// import { knowledgeCommand } from '../commands/knowledge.js'; // Temporarily commented out
// import { neuralCommand } from '../commands/neural.js'; // Temporarily commented out

// All commands now imported from their respective modules

// Enhanced help command using the help system
const helpCommand = defineCommand({
  meta: {
    name: "help",
    description: "Show contextual help for commands and templates",
  },
  args: {
    template: {
      type: "boolean",
      description: "Show template-specific help"
    }
  },
  async run({ args }) {
    const rawArgs = process.argv.slice(2);
    
    // Remove 'help' from the beginning
    const helpArgs = rawArgs.slice(1);
    
    if (helpArgs.length === 0) {
      console.log(helpSystem.showGeneralHelp());
      return;
    }

    if (args.template && helpArgs.length >= 2) {
      // Template help: unjucks help template <generator> <template>
      const [, generator, template] = helpArgs;
      console.log(await helpSystem.showTemplateHelp(generator, template));
    } else if (helpArgs.length === 1) {
      // Command or generator help
      const target = helpArgs[0];
      console.log(await helpSystem.showHelp(target));
    } else {
      // Contextual help
      console.log(await helpSystem.showContextualHelp(helpArgs));
    }
  },
});

// Interactive command
const interactiveCommand = defineCommand({
  meta: {
    name: "interactive",
    description: "Start interactive template generation mode",
  },
  args: {
    quickStart: {
      type: "string",
      description: "Quick start type (component, page, api, test)"
    }
  },
  async run({ args }) {
    try {
      let result;
      
      if (args.quickStart) {
        result = await interactiveMode.quickStart(args.quickStart);
      } else {
        result = await interactiveMode.start();
      }
      
      if (result.success && !result.cancelled) {
        console.log(chalk.green('✓ Interactive session completed!'));
        console.log(chalk.blue('Command to run:'));
        console.log(chalk.cyan(result.command));
        console.log(chalk.gray('\nYou can now run this command to generate your files.'));
      } else if (result.cancelled) {
        console.log(chalk.yellow('Interactive session cancelled.'));
      } else {
        console.error(chalk.red('Interactive session failed:'), result.error);
      }
    } catch (error) {
      console.error('Interactive mode error:', error.message);
      process.exit(1);
    }
  },
});

// All other commands are now imported from their respective modules

// Import unified version resolver
import { getVersion } from '../lib/version-resolver.js';

/**
 * Enhanced pre-process arguments using the new CLI framework
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
  
  // Don't transform if already using explicit commands
  const knownCommands = [
    'generate', 'new', 'preview', 'help', 'list', 'init', 'inject', 'version', 
    'semantic', 'swarm', 'workflow', 'perf', 'github', 'knowledge', 'neural', 
    'migrate', 'interactive'
  ];
  
  if (knownCommands.includes(firstArg)) {
    return rawArgs;
  }
  
  // Don't transform if first argument is a flag
  if (firstArg.startsWith('-')) {
    return rawArgs;
  }
  
  // Use the argument parser to validate and transform
  try {
    const parsed = argumentParser.parse(rawArgs);
    
    if (parsed.command === 'generate' && parsed.subcommand === 'hygen-style') {
      // Store original args for reference
      process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(rawArgs);
      // Transform to explicit generate command for Citty
      return ['generate', ...rawArgs];
    }
  } catch (error) {
    // Use error handling system for parsing errors
    console.error('Argument parsing error:', error.message);
    return ['help'];
  }
  
  // Single argument that's not a command - show contextual help
  if (rawArgs.length === 1) {
    return ['help', firstArg];
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
    // new: newCommand,        // Primary command - clear intent
    // preview: previewCommand, // Safe exploration
    help: helpCommand,      // Context-sensitive help
    interactive: interactiveCommand, // Interactive mode
    
    // SECONDARY COMMANDS
    list: listCommand,
    init: initCommand,
    inject: injectCommand,
    // version: versionCommand,
    
    // LEGACY SUPPORT
    generate: generateCommand, // Legacy command with deprecation warnings
    
    // ADVANCED FEATURES
    semantic: semanticCommand,
    // swarm: swarmCommand,
    // workflow: workflowCommand,
    // perf: perfCommand,
    github: githubCommand,
    // knowledge: knowledgeCommand,
    // neural: neuralCommand,
    migrate: migrateCommand,
  },
  /**
   * @param {{ args: any }} params - Command parameters
   */
  run({ args }) {
    // If we've detected that a subcommand already executed successfully,
    // don't show the main help to avoid confusion
    const originalArgs = process.argv.slice(2);
    const hasSubcommand = originalArgs.length > 0 && 
      ['semantic', 'github', 'neural', 'workflow', 'perf', 'knowledge', 'migrate', 'swarm'].includes(originalArgs[0]) &&
      !originalArgs.includes('--help') && !originalArgs.includes('-h');
    
    if (hasSubcommand) {
      return { success: true, action: 'subcommand-completed', skipMainHelp: true };
    }
    
    // Handle --version flag
    if (args.version) {
      console.log(getVersion());
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
      console.log(chalk.gray("  help      Show contextual help for commands and templates"));
      console.log(chalk.gray("  interactive  Start interactive template generation mode"));
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
      console.log(chalk.gray("  unjucks interactive                   # Interactive mode"));
      console.log(chalk.gray("  unjucks interactive --quickStart=component  # Quick start"));
      console.log(chalk.gray("  unjucks list                          # List generators"));
      console.log(chalk.gray("  unjucks help component react          # Template help"));
      console.log(chalk.gray("  unjucks semantic generate -o schema.ttl --enterprise  # RDF code generation"));
      console.log(chalk.gray("  unjucks swarm init --topology mesh    # Initialize agent swarm"));
      console.log(chalk.gray("  unjucks workflow create --name api-dev # Create development workflow"));
      console.log(chalk.gray("  unjucks perf benchmark --suite all    # Run performance benchmarks"));
      console.log(chalk.gray("  unjucks github analyze --repo owner/repo # Analyze repository"));
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