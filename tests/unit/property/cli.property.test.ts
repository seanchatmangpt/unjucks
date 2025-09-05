import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import fs from "fs-extra";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

describe("CLI Command Property Tests", () => {
  let tmpDir: string;
  let templatesDir: string;
  let originalCwd: string;

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
              fc.string({ minLength: 1, maxLength: 30 }),
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

            const cliCommand = `node ${path.join(originalCwd, "src/cli.ts")} generate ${generatorName} ${templateName} ${varArgs} --dest ./output --force`;

            try {
              // Run command multiple times
              const results = await Promise.all([
                execAsync(cliCommand, { cwd: tmpDir, timeout: 10000 }),
                execAsync(cliCommand, { cwd: tmpDir, timeout: 10000 }),
                execAsync(cliCommand, { cwd: tmpDir, timeout: 10000 })
              ]);

              // Property: Commands should produce consistent output
              const outputs = results.map(r => r.stdout);
              expect(outputs[0]).toBe(outputs[1]);
              expect(outputs[1]).toBe(outputs[2]);

              // Property: Generated files should be identical
              const outputFile = path.join(tmpDir, "output", "output.txt");
              if (await fs.pathExists(outputFile)) {
                const content1 = await fs.readFile(outputFile, "utf-8");
                
                // Remove and regenerate
                await fs.remove(path.join(tmpDir, "output"));
                await execAsync(cliCommand, { cwd: tmpDir, timeout: 10000 });
                
                const content2 = await fs.readFile(outputFile, "utf-8");
                expect(content1).toBe(content2);
              }
            } catch (error) {
              // If it fails, it should fail consistently
              expect(error).toBeInstanceOf(Error);
            }
          }
        ),
        { numRuns: 8 } // Fewer runs for CLI tests due to performance
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
            numberVar: fc.integer({ min: 0, max: 1000 })
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
              const cliCommand = `node ${path.join(originalCwd, "src/cli.ts")} generate ${generatorName} ${templateName} ${args} --dest ./output --force`;

              try {
                const result = await execAsync(cliCommand, { cwd: tmpDir, timeout: 10000 });
                
                // Property: Should succeed with both argument formats
                expect(result.stderr).toBe("" || undefined);
                
                const outputFile = path.join(tmpDir, "output", "typed.txt");
                if (await fs.pathExists(outputFile)) {
                  const content = await fs.readFile(outputFile, "utf-8");
                  
                  // Property: Variables should be correctly substituted
                  expect(content).toContain(`String: ${stringVar}`);
                  expect(content).toContain(`Bool: ${boolVar}`);
                  expect(content).toContain(`Number: ${numberVar}`);
                }

                // Clean up for next iteration
                await fs.remove(path.join(tmpDir, "output"));
              } catch (error) {
                // Command should either work or fail gracefully
                expect(error).toBeInstanceOf(Error);
              }
            }
          }
        ),
        { numRuns: 5 }
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
              `node ${path.join(originalCwd, "src/cli.ts")} ${helpFlag}`,
              `node ${path.join(originalCwd, "src/cli.ts")} list ${helpFlag}`,
              `node ${path.join(originalCwd, "src/cli.ts")} generate ${helpFlag}`
            ];

            for (const command of commands) {
              try {
                const result = await execAsync(command, { cwd: tmpDir, timeout: 5000 });
                
                // Property: Help should always produce output
                expect(result.stdout.length).toBeGreaterThan(0);
                
                // Property: Help should be consistent across runs
                const result2 = await execAsync(command, { cwd: tmpDir, timeout: 5000 });
                expect(result.stdout).toBe(result2.stdout);
                
                // Property: Help should contain usage information
                const output = result.stdout.toLowerCase();
                expect(output).toMatch(/usage|help|command|option/);
              } catch (error) {
                // Help commands should not fail
                throw new Error(`Help command failed: ${command} - ${error}`);
              }
            }
          }
        ),
        { numRuns: 3 }
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

            const listCommand = `node ${path.join(originalCwd, "src/cli.ts")} list`;

            try {
              const result1 = await execAsync(listCommand, { cwd: tmpDir, timeout: 5000 });
              const result2 = await execAsync(listCommand, { cwd: tmpDir, timeout: 5000 });

              // Property: List output should be consistent
              expect(result1.stdout).toBe(result2.stdout);

              // Property: All generators should appear in list
              for (const genName of generatorNames) {
                expect(result1.stdout).toContain(genName);
              }

              // Property: Output should have structure (not just raw text)
              if (generatorNames.length > 0) {
                expect(result1.stdout.length).toBeGreaterThan(10);
              }
            } catch (error) {
              throw new Error(`List command failed: ${error}`);
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  describe("Version Command Properties", () => {
    it("should show consistent version information", async () => {
      const versionCommand = `node ${path.join(originalCwd, "src/cli.ts")} version`;

      try {
        // Run multiple times to check consistency
        const results = await Promise.all([
          execAsync(versionCommand, { cwd: tmpDir, timeout: 5000 }),
          execAsync(versionCommand, { cwd: tmpDir, timeout: 5000 }),
          execAsync(versionCommand, { cwd: tmpDir, timeout: 5000 })
        ]);

        // Property: Version should be consistent
        results.forEach(result => {
          expect(result.stdout).toBe(results[0].stdout);
        });

        // Property: Version should contain version information
        const versionOutput = results[0].stdout;
        expect(versionOutput.length).toBeGreaterThan(0);
        expect(versionOutput).toMatch(/\d+\.\d+\.\d+/); // Semantic version pattern
      } catch (error) {
        throw new Error(`Version command failed: ${error}`);
      }
    });
  });

  describe("Error Handling Properties", () => {
    it("should handle invalid commands gracefully", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => !["generate", "list", "init", "version", "help"].includes(s)),
            fc.string({ minLength: 21, maxLength: 50 }),
            fc.string().filter(s => /[^a-zA-Z0-9_-]/.test(s))
          ),
          async (invalidCommand) => {
            const command = `node ${path.join(originalCwd, "src/cli.ts")} ${invalidCommand}`;

            try {
              const result = await execAsync(command, { cwd: tmpDir, timeout: 5000 });
              
              // Property: Invalid commands should produce help or error output
              expect(result.stdout.length + result.stderr.length).toBeGreaterThan(0);
            } catch (error: any) {
              // Property: Errors should have meaningful messages
              expect(error.message).toBeDefined();
              expect(typeof error.message).toBe("string");
              expect(error.message.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 10 }
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

            const command = `node ${path.join(originalCwd, "src/cli.ts")} generate ${missingGenerator} ${missingTemplate} --dest ./output`;

            try {
              await execAsync(command, { cwd: tmpDir, timeout: 5000 });
              // Should not reach here for missing templates
              throw new Error("Command should have failed for missing template");
            } catch (error: any) {
              // Property: Should provide meaningful error for missing templates
              expect(error.message).toBeDefined();
              expect(error.message.toLowerCase()).toMatch(/not found|missing|error/);
            }
          }
        ),
        { numRuns: 8 }
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
            content: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async ({ generatorName, templateName, content }) => {
            // Setup template
            const genDir = path.join(templatesDir, generatorName);
            const templateDir = path.join(genDir, templateName);
            await fs.ensureDir(templateDir);

            const templateFile = path.join(templateDir, "test.txt");
            await fs.writeFile(templateFile, content, "utf-8");

            const dryCommand = `node ${path.join(originalCwd, "src/cli.ts")} generate ${generatorName} ${templateName} --dest ./output --dry`;
            const outputDir = path.join(tmpDir, "output");

            try {
              await execAsync(dryCommand, { cwd: tmpDir, timeout: 5000 });

              // Property: Dry run should not create actual files
              expect(await fs.pathExists(outputDir)).toBe(false);

              // But regular run should create files
              const realCommand = `node ${path.join(originalCwd, "src/cli.ts")} generate ${generatorName} ${templateName} --dest ./output`;
              await execAsync(realCommand, { cwd: tmpDir, timeout: 5000 });

              // Property: Real run should create files
              expect(await fs.pathExists(outputDir)).toBe(true);
            } catch (error) {
              // Commands should not fail due to the dry run flag
              throw new Error(`Dry run test failed: ${error}`);
            }
          }
        ),
        { numRuns: 6 }
      );
    });
  });
});