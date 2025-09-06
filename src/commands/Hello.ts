
import { defineCommand } from "citty";
import * as chalk from "chalk";

export const HelloCommand = defineCommand({
  meta: {
    name: "hello",
    description: "Hello command",
  },
  async run(context: any) {
    const { args } = context;
    console.log(chalk.blue.bold("Hello Command"));
  },
});
