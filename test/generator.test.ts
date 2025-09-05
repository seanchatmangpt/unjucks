import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Generator } from "../src/lib/generator.js";
import {
  TestHelper,
  setupTestEnvironment,
  cleanupTestEnvironment,
} from "./helpers/test-helper.js";
import path from "node:path";

describe("Generator", () => {
  let helper: TestHelper;
  let generator: Generator;

  beforeEach(async () => {
    helper = await setupTestEnvironment();
    generator = new Generator(path.join(helper.getTempDir(), "_templates"));
  });

  afterEach(async () => {
    await cleanupTestEnvironment(helper);
  });

  describe("findTemplatesDirectory", () => {
    it("should find _templates directory near package.json", async () => {
      // Given: A project structure with package.json and _templates
      await helper.createFile("package.json", '{"name": "test-project"}');
      await helper.createDirectory("_templates");

      await helper.changeToTempDir();

      // When: Creating a new generator
      const gen = new Generator();

      // Then: Should find the templates directory
      expect(gen.getTemplatesDirectory()).toBe(
        path.join(helper.getTempDir(), "_templates"),
      );
    });

    it("should find templates directory as alternative", async () => {
      // Given: A project structure with package.json and templates (not _templates)
      await helper.createFile("package.json", '{"name": "test-project"}');
      await helper.createDirectory("templates");

      await helper.changeToTempDir();

      // When: Creating a new generator
      const gen = new Generator();

      // Then: Should find the templates directory
      expect(gen.getTemplatesDirectory()).toBe(
        path.join(helper.getTempDir(), "templates"),
      );
    });

    it("should walk up directory tree to find templates", async () => {
      // Given: A nested project structure
      await helper.createFile("package.json", '{"name": "test-project"}');
      await helper.createDirectory("_templates");
      await helper.createDirectory("src/components");

      await helper.changeToTempDir();
      process.chdir(path.join(helper.getTempDir(), "src", "components"));

      // When: Creating a new generator
      const gen = new Generator();

      // Then: Should find the templates directory in parent
      expect(gen.getTemplatesDirectory()).toBe(
        path.join(helper.getTempDir(), "_templates"),
      );
    });
  });

  describe("listGenerators", () => {
    it("should list generators from config files", async () => {
      // Given: A generator with config file
      await helper.createDirectory("_templates/command");
      await helper.createFile(
        "_templates/command/config.yml",
        `
name: command
description: Generate Citty CLI commands
templates:
  - name: citty
    description: Citty command with subcommands
`,
      );

      // When: Listing generators
      const generators = await generator.listGenerators();

      // Then: Should find the generator
      expect(generators).toHaveLength(1);
      expect(generators[0].name).toBe("command");
      expect(generators[0].description).toBe("Generate Citty CLI commands");
    });

    it("should discover generators without config files", async () => {
      // Given: A generator without config file
      await helper.createDirectory("_templates/command/citty");
      await helper.createFile(
        "_templates/command/citty/MyCommand.ts",
        `
import { defineCommand } from "citty";

export const MyCommand = defineCommand({
  meta: {
    name: "my-command",
    description: "My command",
  },
  async run() {
    console.log("Hello from my command!");
  },
});
`,
      );

      // When: Listing generators
      const generators = await generator.listGenerators();

      // Then: Should discover the generator
      expect(generators).toHaveLength(1);
      expect(generators[0].name).toBe("command");
      expect(generators[0].description).toBe("Generator for command");
    });

    it("should return empty array when no templates directory exists", async () => {
      // Given: No templates directory
      const gen = new Generator("/nonexistent/path");

      // When: Listing generators
      const generators = await gen.listGenerators();

      // Then: Should return empty array
      expect(generators).toHaveLength(0);
    });
  });

  describe("listTemplates", () => {
    it("should list templates from config file", async () => {
      // Given: A generator with config file
      await helper.createDirectory("_templates/command");
      await helper.createFile(
        "_templates/command/config.yml",
        `
name: command
description: Generate Citty CLI commands
templates:
  - name: citty
    description: Citty command with subcommands
  - name: simple
    description: Simple command
`,
      );

      // When: Listing templates
      const templates = await generator.listTemplates("command");

      // Then: Should find the templates
      expect(templates).toHaveLength(2);
      expect(templates.find((t) => t.name === "citty")).toBeDefined();
      expect(templates.find((t) => t.name === "simple")).toBeDefined();
    });

    it("should discover templates without config file", async () => {
      // Given: A generator without config file
      await helper.createDirectory("_templates/command/citty");
      await helper.createDirectory("_templates/command/simple");
      await helper.createFile("_templates/command/citty/Command.ts", "content");
      await helper.createFile(
        "_templates/command/simple/Command.ts",
        "content",
      );

      // When: Listing templates
      const templates = await generator.listTemplates("command");

      // Then: Should discover the templates
      expect(templates).toHaveLength(2);
      expect(templates.find((t) => t.name === "citty")).toBeDefined();
      expect(templates.find((t) => t.name === "simple")).toBeDefined();
    });

    it("should throw error for nonexistent generator", async () => {
      // When/Then: Should throw error
      await expect(generator.listTemplates("nonexistent")).rejects.toThrow(
        "Generator 'nonexistent' not found",
      );
    });
  });

  describe("scanTemplateForVariables", () => {
    it("should scan template for variables", async () => {
      // Given: A template with variables
      await helper.createDirectory("_templates/command/citty");
      await helper.createFile(
        "_templates/command/citty/{{ commandName | pascalCase }}.ts",
        `
import { defineCommand } from "citty";
import chalk from "chalk";

export const {{ commandName | pascalCase }}Command = defineCommand({
  meta: {
    name: "{{ commandName | kebabCase }}",
    description: "{{ commandName | titleCase }} command",
  },
  async run({ args }: { args: any }) {
    console.log(chalk.blue.bold("{{ commandName | titleCase }} Command"));
    console.log(chalk.gray("Running {{ commandName | kebabCase }} command..."));
  },
});
`,
      );

      // When: Scanning template for variables
      const result = await generator.scanTemplateForVariables(
        "command",
        "citty",
      );

      // Then: Should find variables and generate CLI args
      expect(result.variables).toHaveLength(1);
      expect(
        result.variables.find((v) => v.name === "commandName"),
      ).toBeDefined();

      expect(result.cliArgs.commandName).toBeDefined();
    });

    it("should throw error for nonexistent template", async () => {
      // When/Then: Should throw error
      await expect(
        generator.scanTemplateForVariables("command", "nonexistent"),
      ).rejects.toThrow(
        "Template 'nonexistent' not found in generator 'command'",
      );
    });
  });

  describe("generate", () => {
    it("should generate files from template", async () => {
      // Given: A template with variables
      await helper.createDirectory("_templates/command/citty");
      await helper.createFile(
        "_templates/command/citty/{{ commandName | pascalCase }}.ts",
        `
import { defineCommand } from "citty";
import chalk from "chalk";

export const {{ commandName | pascalCase }}Command = defineCommand({
  meta: {
    name: "{{ commandName | kebabCase }}",
    description: "{{ commandName | titleCase }} command",
  },
  async run({ args }: { args: any }) {
    console.log(chalk.blue.bold("{{ commandName | titleCase }} Command"));
  },
});
`,
      );

      // When: Generating files
      const result = await generator.generate({
        generator: "command",
        template: "citty",
        dest: "./src/commands",
        force: false,
        dry: false,
        commandName: "Hello",
      });

      // Then: Should generate files
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toContain("Hello.ts");
      expect(result.files[0].content).toContain("export const HelloCommand");
      expect(result.files[0].content).toContain("Hello Command");
    });

    it("should handle dry run without writing files", async () => {
      // Given: A template
      await helper.createDirectory("_templates/command/citty");
      await helper.createFile(
        "_templates/command/citty/{{ commandName | pascalCase }}.ts",
        `
import { defineCommand } from "citty";

export const {{ commandName | pascalCase }}Command = defineCommand({
  meta: {
    name: "{{ commandName | kebabCase }}",
    description: "{{ commandName | titleCase }} command",
  },
  async run() {
    console.log("Hello");
  },
});
`,
      );

      // When: Generating files in dry run mode
      const result = await generator.generate({
        generator: "command",
        template: "citty",
        dest: "./src/commands",
        force: false,
        dry: true,
        commandName: "Hello",
      });

      // Then: Should return files but not write them
      expect(result.files).toHaveLength(1);
      expect(await helper.fileExists("src/commands/Hello.ts")).toBe(false);
    });

    it("should process filename templates", async () => {
      // Given: A template with filename variables
      await helper.createDirectory("_templates/command/citty");
      await helper.createFile(
        "_templates/command/citty/{{ commandName | pascalCase }}.ts",
        "content",
      );

      // When: Generating files
      const result = await generator.generate({
        generator: "command",
        template: "citty",
        dest: "./src",
        force: false,
        dry: false,
        commandName: "UserProfile",
      });

      // Then: Should process filename
      expect(result.files[0].path).toContain("UserProfile.ts");
    });

    it("should apply filters to variables", async () => {
      // Given: A template with filters
      await helper.createDirectory("_templates/command/citty");
      await helper.createFile(
        "_templates/command/citty/{{ commandName | pascalCase }}.ts",
        `
import { defineCommand } from "citty";
import chalk from "chalk";

export const {{ commandName | pascalCase }}Command = defineCommand({
  meta: {
    name: "{{ commandName | kebabCase }}",
    description: "{{ commandName | titleCase }} command",
  },
  async run({ args }: { args: any }) {
    console.log(chalk.blue.bold("{{ commandName | titleCase }} Command"));
  },
});
`,
      );

      // When: Generating files
      const result = await generator.generate({
        generator: "command",
        template: "citty",
        dest: "./src",
        force: false,
        dry: false,
        commandName: "UserProfile",
      });

      // Then: Should apply filters
      expect(result.files[0].content).toContain('name: "user-profile"');
      expect(result.files[0].content).toContain("User Profile Command");
    });
  });

  describe("initProject", () => {
    it("should initialize project with example generators", async () => {
      // When: Initializing project
      await generator.initProject({
        type: "citty",
        dest: helper.getTempDir(),
      });

      // Then: Should create templates directory and config
      expect(await helper.fileExists("_templates")).toBe(true);
      expect(await helper.fileExists("unjucks.yml")).toBe(true);
      expect(await helper.fileExists("_templates/command")).toBe(true);
      expect(await helper.fileExists("_templates/cli")).toBe(true);
    });

    it("should create example templates", async () => {
      // When: Initializing project
      await generator.initProject({
        type: "citty",
        dest: helper.getTempDir(),
      });

      // Then: Should create example templates
      expect(await helper.fileExists("_templates/command/citty")).toBe(true);
      expect(await helper.fileExists("_templates/cli/citty")).toBe(true);

      // Check that template files exist
      const commandFiles = await helper.listFiles("_templates/command/citty");
      expect(commandFiles.length).toBeGreaterThan(0);

      const cliFiles = await helper.listFiles("_templates/cli/citty");
      expect(cliFiles.length).toBeGreaterThan(0);
    });
  });
});
