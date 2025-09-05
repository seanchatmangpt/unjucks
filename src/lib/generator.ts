import fs from "fs-extra";
import path from "node:path";
import nunjucks from "nunjucks";
import yaml from "yaml";
import chalk from "chalk";
import { TemplateScanner, TemplateVariable } from "./template-scanner.js";

export interface TemplateFile {
  path: string;
  content: string;
}

export interface GeneratorConfig {
  name: string;
  description?: string;
  templates: TemplateConfig[];
}

export interface TemplateConfig {
  name: string;
  description?: string;
  files: string[];
  prompts?: PromptConfig[];
}

export interface PromptConfig {
  name: string;
  message: string;
  type: "input" | "confirm" | "list" | "checkbox";
  default?: any;
  choices?: string[];
}

export interface GenerateOptions {
  generator: string;
  template: string;
  dest: string;
  force: boolean;
  dry: boolean;
}

export interface GenerateResult {
  files: TemplateFile[];
}

export interface InitOptions {
  type: string;
  dest: string;
}

export class Generator {
  private templatesDir: string;
  private nunjucksEnv: nunjucks.Environment;
  private templateScanner: TemplateScanner;

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || this.findTemplatesDirectory();
    this.nunjucksEnv = this.createNunjucksEnvironment();
    this.templateScanner = new TemplateScanner();
  }

  private findTemplatesDirectory(): string {
    // Start from current working directory and walk up the directory tree
    let currentDir = process.cwd();

    while (currentDir !== path.dirname(currentDir)) {
      // Check for package.json in current directory
      const packageJsonPath = path.join(currentDir, "package.json");

      if (fs.existsSync(packageJsonPath)) {
        // Look for _templates directory in the same directory as package.json
        const templatesPath = path.join(currentDir, "_templates");
        if (fs.existsSync(templatesPath)) {
          return templatesPath;
        }

        // Also check for templates directory (alternative naming)
        const altTemplatesPath = path.join(currentDir, "templates");
        if (fs.existsSync(altTemplatesPath)) {
          return altTemplatesPath;
        }
      }

      // Move up one directory
      currentDir = path.dirname(currentDir);
    }

    // If no templates directory found, default to _templates in current directory
    return path.join(process.cwd(), "_templates");
  }

  getTemplatesDirectory(): string {
    return this.templatesDir;
  }

  /**
   * Scan a specific template for variables and generate CLI arguments
   */
  async scanTemplateForVariables(
    generatorName: string,
    templateName: string,
  ): Promise<{
    variables: TemplateVariable[];
    cliArgs: Record<string, any>;
  }> {
    const templatePath = path.join(
      this.templatesDir,
      generatorName,
      templateName,
    );

    if (!(await fs.pathExists(templatePath))) {
      throw new Error(
        `Template '${templateName}' not found in generator '${generatorName}'`,
      );
    }

    const scanResult = await this.templateScanner.scanTemplate(templatePath);
    const cliArgs = this.templateScanner.generateCliArgs(scanResult.variables);

    return {
      variables: scanResult.variables,
      cliArgs,
    };
  }

  /**
   * Generate dynamic CLI arguments for a template
   */
  async generateDynamicCliArgs(
    generatorName: string,
    templateName: string,
  ): Promise<Record<string, any>> {
    const { cliArgs } = await this.scanTemplateForVariables(
      generatorName,
      templateName,
    );
    return cliArgs;
  }

  private createNunjucksEnvironment(): nunjucks.Environment {
    const env = new nunjucks.Environment(null, {
      autoescape: false,
      throwOnUndefined: false,
      trimBlocks: true,
      lstripBlocks: true,
    });

    // Add custom filters
    this.addCustomFilters(env);

    return env;
  }

  private addCustomFilters(env: nunjucks.Environment): void {
    // kebabCase filter
    env.addFilter("kebabCase", (str: string) => {
      return str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();
    });

    // camelCase filter
    env.addFilter("camelCase", (str: string) => {
      return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
          return index === 0 ? word.toLowerCase() : word.toUpperCase();
        })
        .replace(/\s+/g, "");
    });

    // pascalCase filter
    env.addFilter("pascalCase", (str: string) => {
      return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => {
          return word.toUpperCase();
        })
        .replace(/\s+/g, "");
    });

    // snakeCase filter
    env.addFilter("snakeCase", (str: string) => {
      return str
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/[\s-]+/g, "_")
        .toLowerCase();
    });

    // pluralize filter
    env.addFilter("pluralize", (str: string) => {
      if (str.endsWith("y")) {
        return str.slice(0, -1) + "ies";
      } else if (
        str.endsWith("s") ||
        str.endsWith("sh") ||
        str.endsWith("ch") ||
        str.endsWith("x") ||
        str.endsWith("z")
      ) {
        return str + "es";
      } else {
        return str + "s";
      }
    });

    // singularize filter
    env.addFilter("singularize", (str: string) => {
      if (str.endsWith("ies")) {
        return str.slice(0, -3) + "y";
      } else if (str.endsWith("es") && str.length > 3) {
        return str.slice(0, -2);
      } else if (str.endsWith("s") && str.length > 1) {
        return str.slice(0, -1);
      }
      return str;
    });

    // capitalize filter (override default to handle edge cases)
    env.addFilter("capitalize", (str: string) => {
      if (!str) return str;
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    // titleCase filter
    env.addFilter("titleCase", (str: string) => {
      return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
      });
    });
  }

  async listGenerators(): Promise<GeneratorConfig[]> {
    const generators: GeneratorConfig[] = [];

    if (!(await fs.pathExists(this.templatesDir))) {
      return generators;
    }

    const entries = await fs.readdir(this.templatesDir);

    for (const entry of entries) {
      const entryPath = path.join(this.templatesDir, entry);
      const stat = await fs.stat(entryPath);

      if (stat.isDirectory()) {
        const configPath = path.join(entryPath, "config.yml");

        if (await fs.pathExists(configPath)) {
          try {
            const configContent = await fs.readFile(configPath, "utf8");
            const config = yaml.parse(configContent) as GeneratorConfig;
            config.name = entry;
            generators.push(config);
          } catch {
            console.warn(
              chalk.yellow(
                `Warning: Could not parse config for generator ${entry}`,
              ),
            );
          }
        } else {
          // Generator without config file - create basic config
          generators.push({
            name: entry,
            description: `Generator for ${entry}`,
            templates: await this.discoverTemplates(entryPath),
          });
        }
      }
    }

    return generators;
  }

  async listTemplates(generatorName: string): Promise<TemplateConfig[]> {
    const generatorPath = path.join(this.templatesDir, generatorName);

    if (!(await fs.pathExists(generatorPath))) {
      throw new Error(`Generator '${generatorName}' not found`);
    }

    const configPath = path.join(generatorPath, "config.yml");

    if (await fs.pathExists(configPath)) {
      const configContent = await fs.readFile(configPath, "utf8");
      const config = yaml.parse(configContent) as GeneratorConfig;
      return config.templates || [];
    }

    // Discover templates if no config file
    return await this.discoverTemplates(generatorPath);
  }

  private async discoverTemplates(
    generatorPath: string,
  ): Promise<TemplateConfig[]> {
    const templates: TemplateConfig[] = [];
    const entries = await fs.readdir(generatorPath);

    for (const entry of entries) {
      const entryPath = path.join(generatorPath, entry);
      const stat = await fs.stat(entryPath);

      if (stat.isDirectory()) {
        const templateFiles = await this.getTemplateFiles(entryPath);
        if (templateFiles.length > 0) {
          templates.push({
            name: entry,
            description: `Template for ${entry}`,
            files: templateFiles,
          });
        }
      }
    }

    return templates;
  }

  private async getTemplateFiles(templatePath: string): Promise<string[]> {
    const files: string[] = [];

    const scanDir = async (dir: string, prefix = ""): Promise<void> => {
      const entries = await fs.readdir(dir);

      for (const entry of entries) {
        const entryPath = path.join(dir, entry);
        const stat = await fs.stat(entryPath);

        if (stat.isDirectory()) {
          await scanDir(entryPath, path.join(prefix, entry));
        } else {
          files.push(path.join(prefix, entry));
        }
      }
    };

    await scanDir(templatePath);
    return files;
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const generatorPath = path.join(this.templatesDir, options.generator);
    const templatePath = path.join(generatorPath, options.template);

    if (!(await fs.pathExists(templatePath))) {
      throw new Error(
        `Template '${options.template}' not found in generator '${options.generator}'`,
      );
    }

    // Load template configuration
    const config = await this.loadTemplateConfig(
      generatorPath,
      options.template,
    );

    // Scan template for variables
    const { variables: scannedVariables } = await this.scanTemplateForVariables(
      options.generator,
      options.template,
    );

    // Collect template variables from CLI args and prompts
    const variables = await this.collectVariables(
      config,
      scannedVariables,
      options,
    );

    // Process template files
    const files = await this.processTemplateFiles(
      templatePath,
      variables,
      options.dest,
    );

    // Write files if not dry run
    if (!options.dry) {
      await this.writeFiles(files, options.force);
    }

    return { files };
  }

  private async loadTemplateConfig(
    generatorPath: string,
    templateName: string,
  ): Promise<TemplateConfig> {
    const configPath = path.join(generatorPath, "config.yml");

    if (await fs.pathExists(configPath)) {
      const configContent = await fs.readFile(configPath, "utf8");
      const config = yaml.parse(configContent) as GeneratorConfig;
      const template = config.templates?.find((t) => t.name === templateName);

      if (template) {
        return template;
      }
    }

    // Fallback to discovered template
    const templatePath = path.join(generatorPath, templateName);
    const files = await this.getTemplateFiles(templatePath);

    return {
      name: templateName,
      description: `Template for ${templateName}`,
      files,
    };
  }

  private async collectVariables(
    config: TemplateConfig,
    scannedVariables: TemplateVariable[],
    options: GenerateOptions,
  ): Promise<Record<string, any>> {
    const variables: Record<string, any> = {};

    // First, collect variables from CLI arguments (if provided)
    const cliArgs = this.templateScanner.convertArgsToVariables(
      options as any,
      scannedVariables,
    );
    Object.assign(variables, cliArgs);

    // Then, collect variables from config prompts (for missing variables that are actually used in templates)
    if (config.prompts) {
      const inquirer = await import("inquirer");

      for (const promptConfig of config.prompts) {
        // Skip if variable already provided via CLI
        if (variables[promptConfig.name] !== undefined) {
          continue;
        }

        // Only prompt for variables that are actually used in the templates
        const isUsedInTemplate = scannedVariables.some(
          (v) => v.name === promptConfig.name,
        );
        if (!isUsedInTemplate) {
          continue;
        }

        const answers = await inquirer.default.prompt([
          {
            name: promptConfig.name,
            message: promptConfig.message,
            type: promptConfig.type,
            default: promptConfig.default,
            choices: promptConfig.choices,
          },
        ]);

        Object.assign(variables, answers);
      }
    }

    // Finally, prompt for any remaining scanned variables that weren't provided
    const missingVariables = scannedVariables.filter(
      (v) => variables[v.name] === undefined,
    );

    if (missingVariables.length > 0) {
      const inquirer = await import("inquirer");

      for (const variable of missingVariables) {
        if (variables[variable.name] === undefined) {
          const answers = await inquirer.default.prompt([
            {
              name: variable.name,
              message: variable.description || `Enter ${variable.name}`,
              type: variable.type === "boolean" ? "confirm" : "input",
              default: variable.defaultValue,
            },
          ]);

          Object.assign(variables, answers);
        }
      }
    }

    return variables;
  }

  private async processTemplateFiles(
    templatePath: string,
    variables: Record<string, any>,
    destDir: string,
  ): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    const processDir = async (dir: string, prefix = ""): Promise<void> => {
      const entries = await fs.readdir(dir);

      for (const entry of entries) {
        const entryPath = path.join(dir, entry);
        const stat = await fs.stat(entryPath);

        if (stat.isDirectory()) {
          await processDir(entryPath, path.join(prefix, entry));
        } else {
          const content = await fs.readFile(entryPath, "utf8");

          // Process content with Nunjucks
          const processedContent = this.nunjucksEnv.renderString(
            content,
            variables,
          );

          // Process filename with Nunjucks
          const processedFileName = this.nunjucksEnv.renderString(
            entry,
            variables,
          );

          const filePath = path.join(destDir, prefix, processedFileName);

          files.push({
            path: filePath,
            content: processedContent,
          });
        }
      }
    };

    await processDir(templatePath);
    return files;
  }

  private async writeFiles(
    files: TemplateFile[],
    force: boolean,
  ): Promise<void> {
    for (const file of files) {
      const dir = path.dirname(file.path);

      // Create directory if it doesn't exist
      await fs.ensureDir(dir);

      // Check if file exists
      if ((await fs.pathExists(file.path)) && !force) {
        const inquirer = await import("inquirer");
        const { overwrite } = await inquirer.default.prompt([
          {
            name: "overwrite",
            type: "confirm",
            message: `File ${file.path} already exists. Overwrite?`,
            default: false,
          },
        ]);

        if (!overwrite) {
          continue;
        }
      }

      await fs.writeFile(file.path, file.content, "utf-8");
    }
  }

  async initProject(options: InitOptions): Promise<void> {
    const projectPath = options.dest;

    // Create templates directory
    const templatesDir = path.join(projectPath, "_templates");
    await fs.ensureDir(templatesDir);

    // Create example generators based on project type
    await this.createExampleGenerators(templatesDir, options.type);

    // Create unjucks config file
    const config = {
      version: "1.0.0",
      generators: "_templates",
    };

    await fs.writeFile(
      path.join(projectPath, "unjucks.yml"),
      yaml.stringify(config),
      "utf-8",
    );
  }

  private async createExampleGenerators(
    templatesDir: string,
    projectType: string,
  ): Promise<void> {
    // Create command generator
    const commandDir = path.join(templatesDir, "command");
    await fs.ensureDir(commandDir);

    // Command config
    const commandConfig = {
      name: "command",
      description: "Generate Citty CLI commands",
      templates: [
        {
          name: "citty",
          description: "Citty command with subcommands",
          files: [
            "{{ commandName | pascalCase }}.ts",
            "{{ commandName | pascalCase }}.test.ts",
          ],
          prompts: [
            {
              name: "commandName",
              message: "Command name:",
              type: "input",
              default: "myCommand",
            },
            {
              name: "withTests",
              message: "Include tests?",
              type: "confirm",
              default: true,
            },
            {
              name: "withSubcommands",
              message: "Include subcommands?",
              type: "confirm",
              default: true,
            },
          ],
        },
      ],
    };

    await fs.writeFile(
      path.join(commandDir, "config.yml"),
      yaml.stringify(commandConfig),
      "utf-8",
    );

    // Create Citty command template
    const cittyDir = path.join(commandDir, "citty");
    await fs.ensureDir(cittyDir);

    // Command.ts template
    const commandTemplate = `import { defineCommand } from "citty";
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
`;

    await fs.writeFile(
      path.join(cittyDir, "{{ commandName | pascalCase }}.ts"),
      commandTemplate,
      "utf-8",
    );

    // Command test template
    const testTemplate = `import { describe, expect, it } from "vitest";
import { {{ commandName | pascalCase }}Command } from "./{{ commandName | pascalCase }}";

describe("{{ commandName | pascalCase }}Command", () => {
  it("should be defined", () => {
    expect({{ commandName | pascalCase }}Command).toBeDefined();
  });

  it("should have correct meta", () => {
    expect({{ commandName | pascalCase }}Command.meta?.name).toBe("{{ commandName | kebabCase }}");
    expect({{ commandName | pascalCase }}Command.meta?.description).toBe("{{ commandName | titleCase }} command");
  });

  // Add more tests here
});
`;

    await fs.writeFile(
      path.join(cittyDir, "{{ commandName | pascalCase }}.test.ts"),
      testTemplate,
      "utf-8",
    );

    // Create CLI generator
    const cliDir = path.join(templatesDir, "cli");
    await fs.ensureDir(cliDir);

    const cliConfig = {
      name: "cli",
      description: "Generate CLI applications",
      templates: [
        {
          name: "citty",
          description: "Citty CLI application",
          files: ["cli.ts", "package.json"],
          prompts: [
            {
              name: "cliName",
              message: "CLI name:",
              type: "input",
              default: "my-cli",
            },
            {
              name: "description",
              message: "CLI description:",
              type: "input",
              default: "A CLI tool built with Citty",
            },
          ],
        },
      ],
    };

    await fs.writeFile(
      path.join(cliDir, "config.yml"),
      yaml.stringify(cliConfig),
      "utf-8",
    );

    const cliCittyDir = path.join(cliDir, "citty");
    await fs.ensureDir(cliCittyDir);

    const cliTemplate = `#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import chalk from "chalk";
// Import your commands here
// import { {{ cliName | pascalCase }}Command } from "./commands/{{ cliName | kebabCase }}.js";

const main = defineCommand({
  meta: {
    name: "{{ cliName | kebabCase }}",
    version: "0.0.0",
    description: "{{ description }}",
  },
  subCommands: {
    // Add your commands here
    // {{ cliName | kebabCase }}: {{ cliName | pascalCase }}Command,
  },
  run({ args }: { args: any }) {
    console.log(chalk.blue.bold("{{ cliName | titleCase }} CLI"));
    console.log(chalk.gray("{{ description }}"));
    console.log();
    console.log(chalk.yellow("Available commands:"));
    console.log(chalk.gray("  --help    Show help information"));
    console.log(chalk.gray("  --version Show version information"));
    console.log();
    console.log(chalk.gray("Use {{ cliName | kebabCase }} <command> --help for more information about a command."));
  },
});

runMain(main);
`;

    await fs.writeFile(path.join(cliCittyDir, "cli.ts"), cliTemplate, "utf-8");

    const packageJsonTemplate = `{
  "name": "{{ cliName | kebabCase }}",
  "version": "0.0.0",
  "description": "{{ description }}",
  "type": "module",
  "bin": {
    "{{ cliName | kebabCase }}": "./dist/cli.mjs"
  },
  "exports": {
    ".": "./dist/index.mjs",
    "./cli": "./dist/cli.mjs"
  },
  "scripts": {
    "build": "obuild",
    "dev": "vitest dev",
    "test": "vitest run",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "dependencies": {
    "citty": "^0.1.6",
    "chalk": "^5.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "eslint": "^8.0.0",
    "obuild": "^0.1.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  },
  "files": [
    "dist"
  ],
  "license": "MIT"
}`;

    await fs.writeFile(
      path.join(cliCittyDir, "package.json"),
      packageJsonTemplate,
      "utf-8",
    );
  }
}
