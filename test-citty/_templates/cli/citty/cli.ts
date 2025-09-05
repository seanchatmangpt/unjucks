#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import chalk from "chalk";
// Import your commands here
// import { {{ cliName | pascalCase }}Command } from "./commands/{{ cliName | kebabCase }}.js";

const main = defineCommand({
  meta: {
    name: "{{ cliName | kebabCase }}",
    version: "0.0.0",
    description: "{{ description }}",
  },
  subCommands: {
    // Add your commands here
    // {{ cliName | kebabCase }}: {{ cliName | pascalCase }}Command,
  },
  run({ args }: { args: any }) {
    console.log(chalk.blue.bold("{{ cliName | titleCase }} CLI"));
    console.log(chalk.gray("{{ description }}"));
    console.log();
    console.log(chalk.yellow("Available commands:"));
    console.log(chalk.gray("  --help    Show help information"));
    console.log(chalk.gray("  --version Show version information"));
    console.log();
    console.log(chalk.gray("Use {{ cliName | kebabCase }} <command> --help for more information about a command."));
  },
});

runMain(main);
