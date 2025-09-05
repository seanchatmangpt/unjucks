
import { defineCommand } from "citty";
import chalk from "chalk";

export const HelloCommand = defineCommand({
  meta: {
    name: "hello",
    description: "Hello command",
  },
  async run({ args }: { args: any }) {
    console.log(chalk.blue.bold("Hello Command"));
  },
});
