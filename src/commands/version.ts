import { defineCommand } from "citty";
import chalk from "chalk";

export const versionCommand = defineCommand({
  meta: {
    name: "version",
    description: "Show version information",
  },
  run() {
    console.log(chalk.blue.bold("Unjucks CLI"));
    console.log(chalk.gray("Version: 0.0.0"));
    console.log(chalk.gray("A Hygen-style CLI generator for creating templates and scaffolding projects"));
  },
});
