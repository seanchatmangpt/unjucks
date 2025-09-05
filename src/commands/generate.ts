import { defineCommand } from "citty";
import chalk from "chalk";
import { Generator } from "../lib/generator.js";
import { promptForGenerator, promptForTemplate } from "../lib/prompts.js";
import ora from "ora";

export const generateCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Generate files from templates",
  },
  args: {
    generator: {
      type: "positional",
      description: "Name of the generator to use",
      required: false,
    },
    template: {
      type: "positional",
      description: "Name of the template to generate",
      required: false,
    },
    dest: {
      type: "string",
      description: "Destination directory for generated files",
      default: ".",
    },
    force: {
      type: "boolean",
      description: "Overwrite existing files without prompting",
      default: false,
    },
    dry: {
      type: "boolean",
      description: "Show what would be generated without creating files",
      default: false,
    },
  },
  async run({ args }: { args: any }) {
    try {
      const generator = new Generator();

      let generatorName = args.generator;
      let templateName = args.template;

      // Interactive mode if no generator/template specified
      if (!generatorName) {
        const availableGenerators = await generator.listGenerators();
        if (availableGenerators.length === 0) {
          console.log(
            chalk.red(
              "No generators found. Run 'unjucks init' to set up generators.",
            ),
          );
          return;
        }

        const selected = await promptForGenerator(availableGenerators);
        generatorName = selected.generator;
        templateName = selected.template;
      }

      if (!templateName) {
        const templates = await generator.listTemplates(generatorName);
        const selected = await promptForTemplate(templates);
        templateName = selected;
      }

      const spinner = ora("Generating files...").start();

      const result = await generator.generate({
        generator: generatorName,
        template: templateName,
        dest: args.dest,
        force: args.force,
        dry: args.dry,
      });

      spinner.stop();

      if (args.dry) {
        console.log(chalk.yellow("Dry run - no files were created:"));
        console.log(chalk.gray("Files that would be generated:"));
        result.files.forEach((file: any) => {
          console.log(chalk.green(`  + ${file.path}`));
        });
      } else {
        console.log(chalk.green(`✅ Generated ${result.files.length} files:`));
        result.files.forEach((file: any) => {
          console.log(chalk.green(`  + ${file.path}`));
        });
      }
    } catch (error) {
      console.error(chalk.red("Error generating files:"), error);
      process.exit(1);
    }
  },
});
