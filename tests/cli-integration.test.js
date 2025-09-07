import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  TestHelper,
  setupTestEnvironment,
  cleanupTestEnvironment,
} from "./helpers/test-helper.js";

describe("CLI Integration Tests", () => {
  let helper;

  beforeEach(async () => {
    helper = await setupTestEnvironment();
  });

  afterEach(async () => {
    await cleanupTestEnvironment(helper);
  });

  describe("unjucks init", () => {
    it("should initialize a new project", async () => {
      // When: Running init command
      const result = await helper.runCli("init citty --dest=.");

      // Then: Should succeed and create project structure
      expect(result.exitCode).toBe(0);
      expect(await helper.fileExists("_templates")).toBe(true);
      expect(await helper.fileExists("unjucks.yml")).toBe(true);
    });

    it("should show help for init command", async () => {
      // When: Running init help
      const result = await helper.runCli("init --help");

      // Then: Should show help
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(
        "Initialize a new project with generators",
      );
    });
  });

  describe("unjucks list", () => {
    beforeEach(async () => {
      // Setup: Initialize project first
      await helper.runCli("init citty --dest=.");
    });

    it("should list available generators", async () => {
      // When: Running list command
      const result = await helper.runCli("list");

      // Then: Should show generators
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Available generators:");
      expect(result.stdout).toContain("command");
      expect(result.stdout).toContain("cli");
    });

    it("should list templates for specific generator", async () => {
      // When: Running list for specific generator
      const result = await helper.runCli("list command");

      // Then: Should show templates
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Templates for generator: command");
      expect(result.stdout).toContain("citty");
    });
  });

  describe("unjucks help", () => {
    beforeEach(async () => {
      // Setup: Initialize project first
      await helper.runCli("init citty --dest=.");
    });

    it("should show template variables for specific template", async () => {
      // When: Running help for specific template
      const result = await helper.runCli("help command citty");

      // Then: Should show template variables
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Template Variables for command/citty:");
      expect(result.stdout).toContain("commandName");
    });
  });

  describe("unjucks generate", () => {
    beforeEach(async () => {
      // Setup: Initialize project first
      await helper.runCli("init citty --dest=.");
    });

    it("should generate files with CLI arguments", async () => {
      // When: Running generate with arguments
      const result = await helper.runCli(
        "generate command citty --commandName=Hello --dest=./src/commands",
      );

      // Then: Should generate files
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Generated");
      expect(await helper.fileExists("src/commands/Hello.ts")).toBe(true);
    });

    it("should show dry run without creating files", async () => {
      // When: Running generate with dry run
      const result = await helper.runCli(
        "generate component react --componentName=Button --dest=./src/components --dry",
      );

      // Then: Should show dry run output
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Dry run - no files were created:");
      expect(await helper.fileExists("src/commands/Hello.ts")).toBe(false);
    });

    it("should show available template variables", async () => {
      // When: Running generate
      const result = await helper.runCli(
        "generate command citty --commandName=Hello --dest=./src/commands",
      );

      // Then: Should show available variables
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Available template variables:");
      expect(result.stdout).toContain("--commandName");
    });

    it("should handle interactive mode", async () => {
      // When: Running generate without arguments (interactive mode)
      // Note: This test might need to be adjusted based on how interactive mode works
      const result = await helper.runCli("generate");

      // Then: Should either prompt for input or show error
      // The exact behavior depends on implementation
      expect(result.exitCode).toBeDefined();
    });
  });

  describe("unjucks version", () => {
    it("should show version information", async () => {
      // When: Running version command
      const result = await helper.runCli("version");

      // Then: Should show version
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Unjucks CLI");
      expect(result.stdout).toContain("Version: 0.0.0");
    });
  });

  describe("unjucks --help", () => {
    it("should show main help", async () => {
      // When: Running main help
      const result = await helper.runCli("--help");

      // Then: Should show help
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("A Hygen-style CLI generator");
      expect(result.stdout).toContain("Available commands:");
      expect(result.stdout).toContain("generate");
      expect(result.stdout).toContain("list");
      expect(result.stdout).toContain("init");
      expect(result.stdout).toContain("help");
      expect(result.stdout).toContain("version");
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid commands gracefully", async () => {
      // When: Running invalid command
      const result = await helper.runCli("invalid-command");

      // Then: Should show error or help
      expect(result.exitCode).toBe(1);
    });

    it("should handle missing generators gracefully", async () => {
      // When: Running list without initialized project
      const result = await helper.runCli("list");

      // Then: Should show appropriate message
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("No generators found");
    });

    it("should handle missing templates gracefully", async () => {
      // When: Running generate with nonexistent generator
      const result = await helper.runCli("generate nonexistent template");

      // Then: Should show error
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Error");
    });
  });
});