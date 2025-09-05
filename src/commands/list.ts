import { defineCommand } from "citty";
import chalk from "chalk";
import { Generator } from "../lib/generator.js";

export const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List available generators and templates",
  },
  args: {
    generator: {
      type: "positional",
      description: "Name of generator to list templates for",
      required: false,
    },
  },
  async run({ args }: { args: any }) {
    try {
      const generator = new Generator();
      
      if (args.generator) {
        // List templates for specific generator
        const templates = await generator.listTemplates(args.generator);
        console.log(chalk.blue.bold(`Templates for generator: ${args.generator}`));
        console.log();
        
        if (templates.length === 0) {
          console.log(chalk.gray("No templates found for this generator."));
          return;
        }
        
        for (const template of templates) {
          console.log(chalk.green(`  • ${template.name}`));
          if (template.description) {
            console.log(chalk.gray(`    ${template.description}`));
          }
        }
      } else {
        // List all generators
        const generators = await generator.listGenerators();
        console.log(chalk.blue.bold("Available generators:"));
        console.log();
        
        if (generators.length === 0) {
          console.log(chalk.gray("No generators found. Run 'unjucks init' to set up generators."));
          return;
        }
        
        for (const gen of generators) {
          console.log(chalk.green(`  • ${gen.name}`));
          if (gen.description) {
            console.log(chalk.gray(`    ${gen.description}`));
          }
          
          const templates = await generator.listTemplates(gen.name);
          if (templates.length > 0) {
            console.log(chalk.gray(`    Templates: ${templates.map(t => t.name).join(", ")}`));
          }
          console.log();
        }
      }
      
    } catch (error) {
      console.error(chalk.red("Error listing generators:"), error);
      process.exit(1);
    }
  },
});
