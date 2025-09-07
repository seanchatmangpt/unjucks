import { defineCommand } from "citty";
import * as chalk from "chalk";

const workflowCommand = defineCommand({
  meta: {
    name: "workflow",
    description: "Automated development workflow management",
  },
  run() {
    console.log(chalk.blue("¡ Unjucks Workflow"));
    console.log(chalk.yellow("Workflow features are under development."));
  },
});

export default workflowCommand;