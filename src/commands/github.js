import { defineCommand } from "citty";
import * as chalk from "chalk";

export const githubCommand = defineCommand({
  meta: {
    name: "github",
    description: "GitHub integration and repository management",
  },
  run() {
    console.log(chalk.blue("= Unjucks GitHub"));
    console.log(chalk.yellow("GitHub integration is under development."));
  },
});