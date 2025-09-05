import { defineCommand } from "citty";
import chalk from "chalk";

export const TaskCommand = defineCommand({
  meta: {
    name: "task",
    description: "Manage tasks in your project",
  },
  args: {
    name: {
      type: "string",
      description: "Name parameter",
    },
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Enable verbose output",
    },
  },
  subCommands: {
    // Add subcommands here
    list: defineCommand({
      meta: {
        description: "List task items",
      },
      run() {
        console.log(chalk.blue("Listing task items..."));
      },
    }),
    create: defineCommand({
      meta: {
        description: "Create a new task",
      },
      args: {
        name: {
          type: "string",
          required: true,
          description: "Task name",
        },
      },
      run({ args }) {
        console.log(chalk.green(`Creating task: ${args.name}`));
      },
    }),
  },
  async run({ args }: { args: any }) {
    console.log(chalk.blue.bold("Task Command"));
    console.log(chalk.gray("Manage tasks in your project"));
    
    if (args.verbose) {
      console.log(chalk.yellow("Verbose mode enabled"));
    }
    
    if (args.name) {
      console.log(chalk.cyan(`Processing: ${args.name}`));
    }
    
    // Add your command logic here
    console.log(chalk.green("Task command executed successfully!"));
  },
});