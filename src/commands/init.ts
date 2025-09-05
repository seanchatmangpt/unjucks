import { defineCommand } from "citty";
import chalk from "chalk";
import { Generator } from "../lib/generator.js";
import { promptForProjectType } from "../lib/prompts.js";
import ora from "ora";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Initialize a new project with generators",
  },
  args: {
    type: {
      type: "positional",
      description: "Type of project to initialize",
      required: false,
    },
    dest: {
      type: "string",
      description: "Destination directory for the project",
      default: ".",
    },
  },
  async run({ args }: { args: any }) {
    try {
      const generator = new Generator();
      
      let projectType = args.type;
      
      if (!projectType) {
        const selected = await promptForProjectType();
        projectType = selected;
      }
      
      const spinner = ora("Initializing project...").start();
      
      // Initialize the project structure
      await generator.initProject({
        type: projectType,
        dest: args.dest,
      });
      
      spinner.stop();
      
      console.log(chalk.green(`✅ Project initialized successfully!`));
      console.log();
      console.log(chalk.blue("Next steps:"));
      console.log(chalk.gray("  1. Run 'unjucks list' to see available generators"));
      console.log(chalk.gray("  2. Run 'unjucks generate <generator> <template>' to create files"));
      console.log(chalk.gray("  3. Customize templates in the _templates directory"));
      
    } catch (error) {
      console.error(chalk.red("Error initializing project:"), error);
      process.exit(1);
    }
  },
});
