import { defineCommand } from "citty";
import chalk from "chalk";

export const {{ commandName | pascalCase }}Command = defineCommand({
  meta: {
    name: "{{ commandName | kebabCase }}",
    description: "{{ commandDescription }}",
  },
  args: {
    {% if withOptions %}
    name: {
      type: "string",
      description: "Name parameter",
    },
    verbose: {
      type: "boolean",
      alias: "v",
      description: "Enable verbose output",
    },
    {% endif %}
  },
  {% if withSubcommands %}
  subCommands: {
    // Add subcommands here
    list: defineCommand({
      meta: {
        description: "List {{ commandName | kebabCase }} items",
      },
      run() {
        console.log(chalk.blue("Listing {{ commandName | kebabCase }} items..."));
      },
    }),
    create: defineCommand({
      meta: {
        description: "Create a new {{ commandName | kebabCase }}",
      },
      args: {
        name: {
          type: "string",
          required: true,
          description: "{{ commandName | pascalCase }} name",
        },
      },
      run({ args }) {
        console.log(chalk.green(`Creating {{ commandName | kebabCase }}: ${args.name}`));
      },
    }),
  },
  {% endif %}
  async run({ args }: { args: any }) {
    console.log(chalk.blue.bold("{{ commandName | titleCase }} Command"));
    console.log(chalk.gray("{{ commandDescription }}"));
    
    {% if withOptions %}
    if (args.verbose) {
      console.log(chalk.yellow("Verbose mode enabled"));
    }
    
    if (args.name) {
      console.log(chalk.cyan(`Processing: ${args.name}`));
    }
    {% endif %}
    
    // Add your command logic here
    console.log(chalk.green("{{ commandName | titleCase }} command executed successfully!"));
  },
});