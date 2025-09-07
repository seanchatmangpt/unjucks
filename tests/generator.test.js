import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { Generator } from "../src/lib/generator.js";
import { TestHelper,
  setupTestEnvironment,
  cleanupTestEnvironment } from "./helpers/test-helper.js";
import path from "node:path";

describe("Generator", () => {
  let helper;
  let generator;

  beforeEach(async () => {
    helper = await setupTestEnvironment();
    generator = new Generator(path.join(helper.getTempDir(), "_templates"));
  });

  afterEach(async () => {
    await cleanupTestEnvironment(helper);
  });

  describe("findTemplatesDirectory", () => { it("should find _templates directory near package.json", async () => {
      // Given });

    it("should find templates directory", async () => { // Given });

    it("should walk up directory tree to find templates", async () => { // Given });
  });

  describe("listGenerators", () => { it("should list generators from config files", async () => {
      // Given });

    it("should discover generators without config files", async () => {
      // Given
      const templateContent = `import { defineCommand } from "citty";

export const MyCommand = defineCommand({
  meta: {
    name: "test",
    description: "Test command"
  },
  async run() {
    console.log("Hello from my command!");
  },
});
`;

      // Create test template
      await helper.writeFile('command/index.js.njk', templateContent);

      // When: Listing generators
      const generators = await generator.listGenerators();

      // Then: Should discover the generator
      expect(generators).toHaveLength(1);
      expect(generators[0].name).toBe("command");
      expect(generators[0].description).toBe("Generator for command");
    });

    it("should return empty array when no templates directory exists", async () => { // Given });
  });

  describe("listTemplates", () => { it("should list templates from config file", async () => {
      // Given });

    it("should discover templates without config file", async () => { // Given });

    it("should throw error for nonexistent generator", async () => { // When/Then });
  });

  describe("scanTemplateForVariables", () => { it("should scan template for variables", async () => {
      // Given }}.ts",
        `
import { defineCommand } from "citty";
import chalk from "chalk";

export const {{ commandName | pascalCase }}Command = defineCommand({ meta }}",
    description: "{{ commandName | titleCase }} command",
  },
  async run({ args }) {
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

    it("should throw error for nonexistent template", async () => { // When/Then });
  });

  describe("generate", () => { it("should generate files from template", async () => {
      // Given }}.ts",
        `
import { defineCommand } from "citty";
import chalk from "chalk";

export const {{ commandName | pascalCase }}Command = defineCommand({ meta }}",
    description: "{{ commandName | titleCase }} command",
  },
  async run({ args }) {
    console.log(chalk.blue.bold("{{ commandName | titleCase }} Command"));
  },
});
`,
      );

      // When: Generating files
      const result = await generator.generate({ generator });

      // Then: Should generate files
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toContain("Hello.ts");
      expect(result.files[0].content).toContain("export const HelloCommand");
      expect(result.files[0].content).toContain("Hello Command");
    });

    it("should handle dry run without writing files", async () => { // Given }}.ts",
        `
import { defineCommand } from "citty";

export const {{ commandName | pascalCase }}Command = defineCommand({ meta }}",
    description,
  },
  async run() {
    console.log("Hello");
  },
});
`,
      );

      // When: Generating files in dry run mode
      const result = await generator.generate({ generator });

      // Then: Should return files but not write them
      expect(result.files).toHaveLength(1);
      expect(await helper.fileExists("src/commands/Hello.ts")).toBe(false);
    });

    it("should process filename templates", async () => { // Given }}.ts",
        "content",
      );

      // When: Generating files
      const result = await generator.generate({ generator });

      // Then: Should process filename
      expect(result.files[0].path).toContain("UserProfile.ts");
    });

    it("should apply filters to variables", async () => { // Given }}.ts",
        `
import { defineCommand } from "citty";
import chalk from "chalk";

export const {{ commandName | pascalCase }}Command = defineCommand({ meta }}",
    description: "{{ commandName | titleCase }} command",
  },
  async run({ args }) {
    console.log(chalk.blue.bold("{{ commandName | titleCase }} Command"));
  },
});
`,
      );

      // When: Generating files
      const result = await generator.generate({ generator });

      // Then: Should apply filters
      expect(result.files[0].content).toContain('name);
      expect(result.files[0].content).toContain("User Profile Command");
    });
  });

  describe("initProject", () => { it("should initialize project with example generators", async () => {
      // When });

      // Then: Should create templates directory and config
      expect(await helper.fileExists("_templates")).toBe(true);
      expect(await helper.fileExists("unjucks.yml")).toBe(true);
      expect(await helper.fileExists("_templates/command")).toBe(true);
      expect(await helper.fileExists("_templates/cli")).toBe(true);
    });

    it("should create example templates", async () => { // When });

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
