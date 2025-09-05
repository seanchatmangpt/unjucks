import { defineCommand } from "citty";
import chalk from "chalk";

export const {{ commandName | pascalCase }}Command = defineCommand({
  meta: {
    name: "{{ commandName | kebabCase }}",
    description: "{{ commandName | titleCase }} command",
  },
  {% if withSubcommands %}
  subCommands: {
    // Add your subcommands here
    // example: exampleCommand,
  },
  {% endif %}
  args: {
    // Add your command arguments here
    // name: {
    //   type: "string",
    //   description: "Name argument",
    // },
  },
  async run({ args }: { args: any }) {
    console.log(chalk.blue.bold("{{ commandName | titleCase }} Command"));
    console.log(chalk.gray("Running {{ commandName | kebabCase }} command..."));
    
    // Add your command logic here
    console.log(chalk.green("✅ {{ commandName | titleCase }} completed successfully!"));
  },
});
