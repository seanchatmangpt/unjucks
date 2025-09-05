#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import chalk from "chalk";
import { createDynamicGenerateCommand } from "./lib/dynamic-commands.js";
import { listCommand } from "./commands/list.js";
import { initCommand } from "./commands/init.js";
import { versionCommand } from "./commands/version.js";
import { createTemplateHelpCommand } from "./lib/dynamic-commands.js";

const main = defineCommand({
  meta: {
    name: "unjucks",
    version: "0.0.0",
    description:
      "A Hygen-style CLI generator for creating templates and scaffolding projects",
  },
  subCommands: {
    generate: createDynamicGenerateCommand(),
    list: listCommand,
    init: initCommand,
    version: versionCommand,
    help: createTemplateHelpCommand(),
  },
  run({ args }: { args: any }) {
    console.log(chalk.blue.bold("🌆 Unjucks CLI"));
    console.log(
      chalk.gray(
        "A Hygen-style CLI generator for creating templates and scaffolding projects",
      ),
    );
    console.log();
    console.log(chalk.yellow("Available commands:"));
    console.log(chalk.gray("  generate  Generate files from templates"));
    console.log(chalk.gray("  list      List available generators"));
    console.log(chalk.gray("  init      Initialize a new project"));
    console.log(chalk.gray("  help      Show template variable help"));
    console.log(chalk.gray("  version   Show version information"));
    console.log();
    console.log(
      chalk.gray("Use --help with any command for more information."),
    );
  },
});

runMain(main);
