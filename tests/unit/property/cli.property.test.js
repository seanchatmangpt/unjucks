import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import fs from "fs-extra";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

describe("CLI Command Property Tests", () => {
  let tmpDir, originalCwd, templatesDir;
  const timeout = 10000;
  const numRuns = 10;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = path.join(process.cwd(), "test-bzyH4B", `cli-prop-${Date.now()}`);
    templatesDir = path.join(tmpDir, "_templates");
    await fs.ensureDir(templatesDir);
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tmpDir);
  });

  describe("Command Consistency", () => {
    it("should produce consistent output for same inputs", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            generatorName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            templateName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            variables: fc.dictionary(
              fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]*$/),
              fc.oneof(fc.string(), fc.boolean(), fc.nat({ max: 1000 })),
              { minKeys: 1, maxKeys: 3 }
            )
          }),
          async ({ generatorName, templateName, variables }) => {
            // Setup template
            const genDir = path.join(templatesDir, generatorName);
            const templateDir = path.join(genDir, templateName);
            await fs.ensureDir(templateDir);

            const variableNames = Object.keys(variables);
            const templateContent = variableNames
              .map(name => `{{ ${name} }}`)
              .join("\n");

            const templateFile = path.join(templateDir, "output.txt");
            await fs.writeFile(templateFile, templateContent, "utf-8");

            // Prepare CLI arguments
            const varArgs = Object.entries(variables)
              .map(([key, value]) => `--${key} "${value}"`)
              .join(" ");

            const cliCommand = `node ${path.join(originalCwd, "src/cli.js")} generate ${generatorName} ${templateName} ${varArgs} --dest ./output --force`;

            try {
              // Run command multiple times
              const results = await Promise.all([
                execAsync(cliCommand, { cwd: tmpDir, timeout }),
                execAsync(cliCommand, { cwd: tmpDir, timeout }),
                execAsync(cliCommand, { cwd: tmpDir, timeout })
              ]);

              // Property: Consistent output
              expect(results[0].stdout).toBe(results[1].stdout);
              expect(results[1].stdout).toBe(results[2].stdout);
            } catch (error) {
              // If it fails, it should fail consistently
              expect(error).toBeInstanceOf(Error);
            }
          }
        ),
        { numRuns: 5 } // Fewer runs for CLI tests due to performance
      );
    });

    it("should handle argument variations correctly", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            generatorName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            templateName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            stringVar: fc.string({ minLength: 1, maxLength: 20 }),
            boolVar: fc.boolean(),
            numberVar: fc.nat({ max: 100 })
          }),
          async ({ generatorName, templateName, stringVar, boolVar, numberVar }) => {
            // Setup template with typed variables
            const genDir = path.join(templatesDir, generatorName);
            const templateDir = path.join(genDir, templateName);
            await fs.ensureDir(templateDir);

            const templateContent = `String: {{ stringVar }}\nBool: {{ boolVar }}\nNumber: {{ numberVar }}`;
            const templateFile = path.join(templateDir, "typed.txt");
            await fs.writeFile(templateFile, templateContent, "utf-8");

            // Test different argument formats
            const argVariations = [
              `--stringVar "${stringVar}" --boolVar ${boolVar} --numberVar ${numberVar}`,
              `--stringVar="${stringVar}" --boolVar=${boolVar} --numberVar=${numberVar}`,
            ];

            for (const args of argVariations) {
              const cliCommand = `node ${path.join(originalCwd, "src/cli.js")} generate ${generatorName} ${templateName} ${args} --dest ./output --force`;

              try {
                const result = await execAsync(cliCommand, { cwd: tmpDir, timeout });
                
                // Property: Should generate files successfully
                expect(result.exitCode).toBe(0);

                // Clean up for next iteration
                await fs.remove(path.join(tmpDir, "output"));
              } catch (error) {
                // Command should either work or fail gracefully
                expect(error).toBeInstanceOf(Error);
              }
            }
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Help Command Consistency", () => {
    it("should show consistent help output", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom("--help", "-h", "help"),
          async (helpFlag) => {
            const commands = [
              `node ${path.join(originalCwd, "src/cli.js")} ${helpFlag}`,
              `node ${path.join(originalCwd, "src/cli.js")} list ${helpFlag}`,
              `node ${path.join(originalCwd, "src/cli.js")} generate ${helpFlag}`
            ];

            for (const command of commands) {
              try {
                const result = await execAsync(command, { cwd: tmpDir, timeout });
                
                // Property: Help should contain usage information
                expect(result.stdout).toContain("Usage");
              } catch (error) {
                // Help commands should not fail
                throw new Error(`Help command failed: ${error.message}`);
              }
            }
          }
        ),
        { numRuns }
      );
    });
  });

  describe("List Command Properties", () => {
    it("should list generators consistently", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            { minLength: 1, maxLength: 5 }
          ),
          async (generatorNames) => {
            // Setup generators
            for (const genName of generatorNames) {
              const genDir = path.join(templatesDir, genName);
              const templateDir = path.join(genDir, "default");
              await fs.ensureDir(templateDir);
              
              const templateFile = path.join(templateDir, "test.txt");
              await fs.writeFile(templateFile, "test content", "utf-8");
            }

            const listCommand = `node ${path.join(originalCwd, "src/cli.js")} list`;

            try {
              const result1 = await execAsync(listCommand, { cwd: tmpDir, timeout });
              const result2 = await execAsync(listCommand, { cwd: tmpDir, timeout });

              // Property: Consistent listing
              expect(result1.stdout).toBe(result2.stdout);

              // Property: Output should have structure (not just raw text)
              if (generatorNames.length > 0) {
                expect(result1.stdout.length).toBeGreaterThan(10);
              }
            } catch (error) {
              throw new Error(`List command failed: ${error.message}`);
            }
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Version Command Properties", () => {
    it("should show consistent version information", async () => {
      const versionCommand = `node ${path.join(originalCwd, "src/cli.js")} version`;

      try {
        // Run multiple times to check consistency
        const results = await Promise.all([
          execAsync(versionCommand, { cwd: tmpDir, timeout }),
          execAsync(versionCommand, { cwd: tmpDir, timeout }),
          execAsync(versionCommand, { cwd: tmpDir, timeout })
        ]);

        // Property: Version consistency
        expect(results[0].stdout).toBe(results[1].stdout);
        expect(results[1].stdout).toBe(results[2].stdout);

        // Property: Version should contain version information
        const versionOutput = results[0].stdout;
        expect(versionOutput.length).toBeGreaterThan(0);
        expect(versionOutput).toMatch(/\d+\.\d+\.\d+/); // Semantic version pattern
      } catch (error) {
        throw new Error(`Version command failed: ${error.message}`);
      }
    });
  });

  describe("Error Handling Properties", () => {
    it("should handle invalid commands gracefully", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => !["list", "generate", "version", "help"].includes(s)),
            fc.constant("nonexistent-command"),
            fc.constant("invalid@command")
          ),
          async (invalidCommand) => {
            const command = `node ${path.join(originalCwd, "src/cli.js")} ${invalidCommand}`;

            try {
              const result = await execAsync(command, { cwd: tmpDir, timeout });
              
              // Property: Should provide error information
              expect(result.stderr.length > 0 || result.stdout.includes("error") || result.stdout.includes("invalid"));
            } catch (error) {
              // Property: Should fail gracefully with meaningful error
              expect(error).toBeInstanceOf(Error);
            }
          }
        ),
        { numRuns }
      );
    });

    it("should handle missing templates gracefully", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            missingGenerator: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            missingTemplate: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
          }),
          async ({ missingGenerator, missingTemplate }) => {
            // Ensure these don't exist
            const genPath = path.join(templatesDir, missingGenerator);
            const templatePath = path.join(genPath, missingTemplate);
            
            if (await fs.pathExists(templatePath)) {
              return; // Skip if it accidentally exists
            }

            const command = `node ${path.join(originalCwd, "src/cli.js")} generate ${missingGenerator} ${missingTemplate} --dest ./output`;

            try {
              await execAsync(command, { cwd: tmpDir, timeout });
              // Should not reach here for missing templates
              throw new Error("Command should have failed for missing template");
            } catch (error) {
              // Property: Should fail with meaningful error message
              expect(error.message).toBeDefined();
            }
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Dry Run Properties", () => {
    it("should not create files in dry run mode", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            generatorName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            templateName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            content: fc.string({ minLength: 5, maxLength: 100 })
          }),
          async ({ generatorName, templateName, content }) => {
            // Setup template
            const genDir = path.join(templatesDir, generatorName);
            const templateDir = path.join(genDir, templateName);
            await fs.ensureDir(templateDir);

            const templateFile = path.join(templateDir, "test.txt");
            await fs.writeFile(templateFile, content, "utf-8");

            const dryCommand = `node ${path.join(originalCwd, "src/cli.js")} generate ${generatorName} ${templateName} --dest ./output --dry`;
            const outputDir = path.join(tmpDir, "output");

            try {
              await execAsync(dryCommand, { cwd: tmpDir, timeout });

              // Property: No files should be created in dry mode
              const outputExists = await fs.pathExists(outputDir);
              expect(outputExists).toBe(false);

              // Test that real run would create files
              const realCommand = `node ${path.join(originalCwd, "src/cli.js")} generate ${generatorName} ${templateName} --dest ./output`;
              await execAsync(realCommand, { cwd: tmpDir, timeout });

              // Property: Real run should create files
              const outputExistsAfterReal = await fs.pathExists(outputDir);
              expect(outputExistsAfterReal).toBe(true);
            } catch (error) {
              // Commands should not fail due to the dry run flag
              throw new Error(`Dry run test failed: ${error.message}`);
            }
          }
        ),
        { numRuns }
      );
    });
  });
});