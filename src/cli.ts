#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import chalk from "chalk";
import { createDynamicGenerateCommand, createTemplateHelpCommand } from "./lib/dynamic-commands.js";
import { listCommand } from "./commands/list.js";
import { initCommand } from "./commands/init.js";
import { versionCommand } from "./commands/version.js";

// Get package version from package.json (production ready)
function getVersion(): string {
  if (process.env.npm_package_version) {
    return process.env.npm_package_version;
  }
  return "0.0.0";
}

// Enhanced pre-process arguments to handle comprehensive Hygen-style positional syntax
const preprocessArgs = () => {
  const rawArgs = process.argv.slice(2);
  
  if (rawArgs.length === 0) {
    return rawArgs;
  }
  
  const firstArg = rawArgs[0];
  
  // Don't transform if already using explicit commands
  if (['generate', 'list', 'init', 'version', 'help'].includes(firstArg)) {
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
  if (rawArgs.length >= 2 && !rawArgs[1].startsWith('-')) {
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
    generate: createDynamicGenerateCommand(),
    list: listCommand,
    init: initCommand,
    version: versionCommand,
    help: createTemplateHelpCommand(),
  },
  run({ args }: { args: any }) {
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
      console.log(chalk.gray("  init      Initialize a new project"));
      console.log(chalk.gray("  help      Show template variable help"));
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
    console.log(chalk.gray("  init      Initialize a new project"));
    console.log(chalk.gray("  help      Show template variable help"));
    console.log(chalk.gray("  version   Show version information"));
    console.log();
    console.log(chalk.yellow("Examples:"));
    console.log(chalk.gray("  unjucks component react MyComponent   # Hygen-style positional"));
    console.log(chalk.gray("  unjucks component new UserProfile     # Hygen-style with 'new'"));
    console.log(chalk.gray("  unjucks api endpoint users --auth     # Mixed positional + flags"));
    console.log(chalk.gray("  unjucks generate component citty      # Explicit syntax"));
    console.log(chalk.gray("  unjucks list                          # List generators"));
    console.log();
    console.log(chalk.gray("Use --help with any command for more information."));
  },
});

runMain(main);