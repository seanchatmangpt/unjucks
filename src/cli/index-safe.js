#!/usr/bin/env node

import { defineCommand, runMain as cittyRunMain } from "citty";
import chalk from "chalk";

// Import safe commands 
import { generateCommand } from '../commands/generate-safe.js';
import { listCommand } from '../commands/list-safe.js';
import { getVersion } from '../lib/fast-version-resolver.js';

/**
 * Enhanced pre-process arguments to handle comprehensive Hygen-style positional syntax
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
  const explicitCommands = new Set(['generate', 'list', 'help', 'version', '--help', '--version', '-h', '-v']);
  if (explicitCommands.has(firstArg)) {
    return rawArgs;
  }
  
  // Don't transform if first argument is a flag
  if (firstArg.startsWith('-')) {
    return rawArgs;
  }
  
  // Handle Hygen-style positional syntax: unjucks <generator> <template> [name] [args...]
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

// Simple help command
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

// Simple version command
const versionCommand = defineCommand({
  meta: {
    name: "version",
    description: "Show version information",
  },
  run() {
    const version = getVersion();
    console.log(version);
    return { success: true, action: 'version', output: version };
  },
});

// Simple init command
const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Initialize a new project with scaffolding",
  },
  run() {
    console.log(chalk.blue("🚀 Unjucks Init"));
    console.log(chalk.gray("This command would initialize a new project with scaffolding"));
    console.log(chalk.yellow("Implementation coming soon..."));
    return { success: true, message: "Init placeholder" };
  },
});

// Main CLI application
const main = defineCommand({
  meta: {
    name: "unjucks",
    version: getVersion(),
    description: "A Hygen-style CLI generator for creating templates and scaffolding projects",
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
    // Core working commands
    generate: generateCommand,
    list: listCommand,
    help: helpCommand,
    version: versionCommand,
    init: initCommand,
  },
  run({ args }) {
    // Handle --version flag
    if (args.version) {
      const version = getVersion();
      console.log(version);
      return { success: true, action: 'version', output: version };
    }

    // Handle --help flag or default help
    console.log(chalk.blue.bold("🌆 Unjucks CLI"));
    console.log(chalk.gray("A Hygen-style CLI generator for creating templates and scaffolding projects"));
    console.log();
    console.log(chalk.yellow("Usage:"));
    console.log(chalk.gray("  unjucks <generator> <template> [args...]  # Positional syntax (Hygen-style)"));
    console.log(chalk.gray("  unjucks generate <generator> <template>   # Explicit syntax"));
    console.log();
    console.log(chalk.yellow("COMMANDS:"));
    console.log(chalk.gray("  generate  Generate files from templates"));
    console.log(chalk.gray("  list      List available generators and templates"));
    console.log(chalk.gray("  help      Show template variable help"));
    console.log(chalk.gray("  version   Show version information"));
    console.log(chalk.gray("  init      Initialize a new project (coming soon)"));
    console.log();
    console.log(chalk.yellow("OPTIONS:"));
    console.log(chalk.gray("  --version, -v  Show version information"));
    console.log(chalk.gray("  --help, -h     Show help information"));
    console.log();
    console.log(chalk.yellow("EXAMPLES:"));
    console.log(chalk.gray("  unjucks component react MyComponent   # Hygen-style positional"));
    console.log(chalk.gray("  unjucks generate component react      # Explicit syntax"));
    console.log(chalk.gray("  unjucks list                          # List generators"));
    console.log(chalk.gray("  unjucks list component                # List templates in component generator"));
    console.log();
    console.log(chalk.gray("Use --help with any command for more information."));
    return { success: true, action: 'help' };
  },
});

export const runMain = () => {
  try {
    return cittyRunMain(main);
  } catch (error) {
    const originalArgs = process.argv.slice(2);
    if (originalArgs.length > 0) {
      const firstArg = originalArgs[0];
      const knownCommands = ['generate', 'list', 'help', 'version', 'init'];
      
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
    const originalArgs = process.argv.slice(2);
    if (originalArgs.length > 0) {
      const firstArg = originalArgs[0];
      const knownCommands = ['generate', 'list', 'help', 'version', 'init'];
      
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