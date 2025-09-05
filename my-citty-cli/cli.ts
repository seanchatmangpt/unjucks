#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import chalk from "chalk";
// Import your commands here
import { UserCommand } from "./commands/User.js";
import { TaskCommand } from "./commands/Task.js";
import { ProjectCommand } from "./commands/Project.js";

const main = defineCommand({
  meta: {
    name: "task-manager",
    version: "1.0.0",
    description: "A powerful task management CLI built with Citty",
  },
  subCommands: {
    // Add your commands here as they are created
    user: UserCommand,
    task: TaskCommand,
    project: ProjectCommand,
  },
  run({ args }: { args: any }) {
    console.log(chalk.blue.bold("Task-manager CLI"));
    console.log(chalk.gray("A powerful task management CLI built with Citty"));
    console.log();
    console.log(chalk.yellow("Available commands:"));
    console.log(chalk.gray("  --help    Show help information"));
    console.log(chalk.gray("  --version Show version information"));
    console.log();
    console.log(chalk.gray("Use task-manager <command> --help for more information about a command."));
  },
});

runMain(main);