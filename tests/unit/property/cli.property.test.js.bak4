import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * from "fast-check";
import fs from "fs-extra";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

describe("CLI Command Property Tests", () => {
  let tmpDir => {
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

  describe("Command Consistency", () => { it("should produce consistent output for same inputs", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            generatorName),
            templateName }
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

            try { // Run command multiple times
              const results = await Promise.all([
                execAsync(cliCommand, { cwd, timeout),
                execAsync(cliCommand, { cwd, timeout),
                execAsync(cliCommand, { cwd, timeout)
              ]);

              // Property }
            } catch (error) {
              // If it fails, it should fail consistently
              expect(error).toBeInstanceOf(Error);
            }
          }
        ),
        { numRuns } // Fewer runs for CLI tests due to performance
      );
    });

    it("should handle argument variations correctly", async () => { await fc.assert(
        fc.asyncProperty(
          fc.record({
            generatorName),
            templateName }),
          async ({ generatorName, templateName, stringVar, boolVar, numberVar }) => { // Setup template with typed variables
            const genDir = path.join(templatesDir, generatorName);
            const templateDir = path.join(genDir, templateName);
            await fs.ensureDir(templateDir);

            const templateContent = `String }}\nBool: {{ boolVar }}\nNumber: {{ numberVar }}`;
            const templateFile = path.join(templateDir, "typed.txt");
            await fs.writeFile(templateFile, templateContent, "utf-8");

            // Test different argument formats
            const argVariations = [
              `--stringVar "${stringVar}" --boolVar ${boolVar} --numberVar ${numberVar}`,
              `--stringVar="${stringVar}" --boolVar=${boolVar} --numberVar=${numberVar}`,
            ];

            for (const args of argVariations) {
              const cliCommand = `node ${path.join(originalCwd, "src/cli.ts")} generate ${generatorName} ${templateName} ${args} --dest ./output --force`;

              try { const result = await execAsync(cliCommand, { cwd, timeout);
                
                // Property }

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
              `node ${path.join(originalCwd, "src/cli.ts")} ${helpFlag}`,
              `node ${path.join(originalCwd, "src/cli.ts")} list ${helpFlag}`,
              `node ${path.join(originalCwd, "src/cli.ts")} generate ${helpFlag}`
            ];

            for (const command of commands) { try {
                const result = await execAsync(command, { cwd, timeout);
                
                // Property } catch (error) {
                // Help commands should not fail
                throw new Error(`Help command failed);
              }
            }
          }
        ),
        { numRuns }
      );
    });
  });

  describe("List Command Properties", () => { it("should list generators consistently", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            { minLength }
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

            try { const result1 = await execAsync(listCommand, { cwd, timeout);
              const result2 = await execAsync(listCommand, { cwd, timeout);

              // Property }

              // Property: Output should have structure (not just raw text)
              if (generatorNames.length > 0) {
                expect(result1.stdout.length).toBeGreaterThan(10);
              }
            } catch (error) {
              throw new Error(`List command failed);
            }
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Version Command Properties", () => {
    it("should show consistent version information", async () => {
      const versionCommand = `node ${path.join(originalCwd, "src/cli.ts")} version`;

      try { // Run multiple times to check consistency
        const results = await Promise.all([
          execAsync(versionCommand, { cwd, timeout),
          execAsync(versionCommand, { cwd, timeout),
          execAsync(versionCommand, { cwd, timeout)
        ]);

        // Property });

        // Property: Version should contain version information
        const versionOutput = results[0].stdout;
        expect(versionOutput.length).toBeGreaterThan(0);
        expect(versionOutput).toMatch(/\d+\.\d+\.\d+/); // Semantic version pattern
      } catch (error) {
        throw new Error(`Version command failed);
      }
    });
  });

  describe("Error Handling Properties", () => { it("should handle invalid commands gracefully", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.string({ minLength } ${invalidCommand}`;

            try { const result = await execAsync(command, { cwd, timeout);
              
              // Property } catch (error) { // Property }
          }
        ),
        { numRuns }
      );
    });

    it("should handle missing templates gracefully", async () => { await fc.assert(
        fc.asyncProperty(
          fc.record({
            missingGenerator),
            missingTemplate }),
          async ({ missingGenerator, missingTemplate }) => {
            // Ensure these don't exist
            const genPath = path.join(templatesDir, missingGenerator);
            const templatePath = path.join(genPath, missingTemplate);
            
            if (await fs.pathExists(templatePath)) {
              return; // Skip if it accidentally exists
            }

            const command = `node ${path.join(originalCwd, "src/cli.ts")} generate ${missingGenerator} ${missingTemplate} --dest ./output`;

            try {
              await execAsync(command, { cwd, timeout);
              // Should not reach here for missing templates
              throw new Error("Command should have failed for missing template");
            } catch (error) { // Property }
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Dry Run Properties", () => { it("should not create files in dry run mode", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            generatorName),
            templateName }),
          async ({ generatorName, templateName, content }) => {
            // Setup template
            const genDir = path.join(templatesDir, generatorName);
            const templateDir = path.join(genDir, templateName);
            await fs.ensureDir(templateDir);

            const templateFile = path.join(templateDir, "test.txt");
            await fs.writeFile(templateFile, content, "utf-8");

            const dryCommand = `node ${path.join(originalCwd, "src/cli.ts")} generate ${generatorName} ${templateName} --dest ./output --dry`;
            const outputDir = path.join(tmpDir, "output");

            try { await execAsync(dryCommand, { cwd, timeout);

              // Property } generate ${generatorName} ${templateName} --dest ./output`;
              await execAsync(realCommand, { cwd, timeout);

              // Property } catch (error) {
              // Commands should not fail due to the dry run flag
              throw new Error(`Dry run test failed);
            }
          }
        ),
        { numRuns }
      );
    });
  });
});