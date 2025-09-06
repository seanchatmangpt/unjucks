#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import chalk from "chalk";
// Import your commands here
// import { UserCommand } from "./commands/user.js";
// import { TaskCommand } from "./commands/task.js";

const main = defineCommand({
  meta: {
    name: "validation-cli",
    version: "1.0.0",
    description: "tests/final-validation",
  },
  subCommands: {
    // Add your commands here as they are created
    // user: UserCommand,
    // task: TaskCommand,
  },
  run({ args }: { args: any }) {
    console.log(chalk.blue.bold("Validation Cli CLI"));
    console.log(chalk.gray("tests/final-validation"));
    console.log();
    console.log(chalk.yellow("Available commands:"));
    console.log(chalk.gray("  --help    Show help information"));
    console.log(chalk.gray("  --version Show version information"));
    console.log();
    console.log(chalk.gray("Use validation-cli <command> --help for more information about a command."));
  },
});

runMain(main);