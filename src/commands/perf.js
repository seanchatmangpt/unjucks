import { defineCommand } from "citty";
import * as chalk from "chalk";

export const perfCommand = defineCommand({
  meta: {
    name: "perf",
    description: "Performance analysis and optimization tools",
  },
  run() {
    console.log(chalk.blue("¡ Unjucks Performance"));
    console.log(chalk.yellow("Performance tools are under development."));
  },
});