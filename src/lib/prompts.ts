import inquirer from "inquirer";
import chalk from "chalk";
import type { GeneratorConfig, TemplateConfig } from "./generator.js";

export async function promptForGenerator(
  generators: GeneratorConfig[],
): Promise<{
  generator: string;
  template: string;
}> {
  const generatorChoices = generators.map((gen) => ({
    name: `${gen.name}${gen.description ? ` - ${gen.description}` : ""}`,
    value: gen.name,
  }));

  const { generator } = await inquirer.prompt([
    {
      name: "generator",
      type: "list",
      message: "Select a generator:",
      choices: generatorChoices,
    },
  ]);

  // Now prompt for template within the selected generator
  const templateChoices =
    generators
      .find((gen) => gen.name === generator)
      ?.templates.map((template) => ({
        name: `${template.name}${template.description ? ` - ${template.description}` : ""}`,
        value: template.name,
      })) || [];

  const { template } = await inquirer.prompt([
    {
      name: "template",
      type: "list",
      message: "Select a template:",
      choices: templateChoices,
    },
  ]);

  return { generator, template };
}

export async function promptForTemplate(
  templates: TemplateConfig[],
): Promise<string> {
  const templateChoices = templates.map((template) => ({
    name: `${template.name}${template.description ? ` - ${template.description}` : ""}`,
    value: template.name,
  }));

  const { template } = await inquirer.prompt([
    {
      name: "template",
      type: "list",
      message: "Select a template:",
      choices: templateChoices,
    },
  ]);

  return template;
}

export async function promptForProjectType(): Promise<string> {
  const projectTypes = [
    { name: "Citty CLI Tool", value: "citty" },
    { name: "Node.js Library", value: "nodejs" },
    { name: "TypeScript Package", value: "typescript" },
    { name: "Generic Project", value: "generic" },
  ];

  const { projectType } = await inquirer.prompt([
    {
      name: "projectType",
      type: "list",
      message: "What type of project are you initializing?",
      choices: projectTypes,
    },
  ]);

  return projectType;
}
