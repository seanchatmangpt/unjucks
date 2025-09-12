import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import fs from "fs-extra";
import path from "node:path";
import { Generator, GenerateOptions } from "../../../src/lib/generator.js";

describe("Generator Property Tests", () => {
  let tmpDir, templatesDir, generator;
  const numRuns = 20;

  beforeEach(async () => {
    tmpDir = path.join(process.cwd(), "test-bzyH4B", `gen-prop-${this.getDeterministicTimestamp()}`);
    templatesDir = path.join(tmpDir, "_templates");
    await fs.ensureDir(templatesDir);
    generator = new Generator(templatesDir);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  describe("Template Variable Extraction", () => {
    it("should extract all variables from template content consistently", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            generatorName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            templateName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            variables: fc.array(
              fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]*$/),
              { minLength: 1, maxLength: 5 }
            ),
            content: fc.string({ minLength: 0, maxLength: 100 })
          }),
          async ({ generatorName, templateName, variables, content }) => {
            // Setup template directory
            const genDir = path.join(templatesDir, generatorName);
            const templateDir = path.join(genDir, templateName);
            await fs.ensureDir(templateDir);

            // Create template content with variables
            const templateContent = variables
              .map(variable => `{{ ${variable} }}`)
              .join(" ") + " " + content;

            const templateFile = path.join(templateDir, "test.txt");
            await fs.writeFile(templateFile, templateContent, "utf-8");

            // Test variable extraction
            const scanResult = await generator.scanTemplateForVariables(generatorName, templateName);

            // Property: All inserted variables should be detected
            for (const variable of variables) {
              expect(scanResult.variables.some(v => v.name === variable)).toBe(true);
            }

            // Property: Scanned variables should have valid types
            for (const scannedVar of scanResult.variables) {
              expect(["string", "boolean", "number"]).toContain(scannedVar.type);
            }
          }
        ),
        { numRuns }
      );
    });

    it("should handle filename variables consistently", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            generatorName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            templateName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            filenameVariable: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]*$/)
          }),
          async ({ generatorName, templateName, filenameVariable }) => {
            const genDir = path.join(templatesDir, generatorName);
            const templateDir = path.join(genDir, templateName);
            await fs.ensureDir(templateDir);

            // Create template with variable in filename
            const templateFile = path.join(templateDir, `{{ ${filenameVariable} }}.txt`);
            await fs.writeFile(templateFile, "Template content", "utf-8");

            const scanResult = await generator.scanTemplateForVariables(generatorName, templateName);

            // Property: Variable in filename should be detected
            expect(scanResult.variables.some(v => v.name === filenameVariable)).toBe(true);
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Template Generation", () => {
    it("should generate syntactically valid output files", async () => {
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
            const genDir = path.join(templatesDir, generatorName);
            const templateDir = path.join(genDir, templateName);
            await fs.ensureDir(templateDir);

            // Create template with variables
            const variableNames = Object.keys(variables);
            const templateContent = variableNames
              .map(name => `Variable ${name}: {{ ${name} }}`)
              .join("\n");

            const templateFile = path.join(templateDir, "output.txt");
            await fs.writeFile(templateFile, templateContent, "utf-8");

            // Generate files
            const destDir = path.join(tmpDir, "output");
            const options = {
              generator: generatorName,
              template: templateName,
              dest: destDir,
              force: true,
              dry: false,
              ...variables
            };

            const result = await generator.generate(options);

            // Property: Generated files should exist and be readable
            expect(result.files.length).toBeGreaterThan(0);
            
            for (const file of result.files) {
              expect(await fs.pathExists(file.path)).toBe(true);
              const content = await fs.readFile(file.path, "utf-8");
              expect(content).toBeDefined();
              expect(typeof content).toBe("string");
              
              // Property: No unresolved template variables
              expect(content).not.toMatch(/\{\{\s*\w+\s*\}\}/);
            }
          }
        ),
        { numRuns }
      );
    });

    it("should apply Nunjucks filters correctly and consistently", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            generatorName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            templateName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            baseName: fc.string({ minLength: 1, maxLength: 20 })
          }),
          async ({ generatorName, templateName, baseName }) => {
            const genDir = path.join(templatesDir, generatorName);
            const templateDir = path.join(genDir, templateName);
            await fs.ensureDir(templateDir);

            // Template with various filters
            const templateContent = `
Original: {{ name }}
Kebab: {{ name | kebabCase }}
Camel: {{ name | camelCase }}
Pascal: {{ name | pascalCase }}
Snake: {{ name | snakeCase }}
Plural: {{ name | pluralize }}
Singular: {{ name | pluralize | singularize }}
Capitalize: {{ name | capitalize }}
Title: {{ name | titleCase }}
`;

            const templateFile = path.join(templateDir, "filters.txt");
            await fs.writeFile(templateFile, templateContent, "utf-8");

            const destDir = path.join(tmpDir, "output");
            const options = {
              generator: generatorName,
              template: templateName,
              dest: destDir,
              force: true,
              dry: false,
              name: baseName
            };

            const result = await generator.generate(options);
            const content = await fs.readFile(result.files[0].path, "utf-8");

            // Property: Filter transformations should be consistent
            const lines = content.split("\n").filter(line => line.trim());
            
            // kebabCase should contain only lowercase and hyphens
            const kebabLine = lines.find(l => l.startsWith("Kebab:"));
            if (kebabLine) {
              const kebabValue = kebabLine.split(":")[1].trim();
              expect(kebabValue).toMatch(/^[a-z]([a-z0-9-]*[a-z0-9])?$/);
            }

            // camelCase should start with lowercase
            const camelLine = lines.find(l => l.startsWith("Camel:"));
            if (camelLine) {
              const camelValue = camelLine.split(":")[1].trim();
              expect(camelValue).toMatch(/^[a-z][a-zA-Z0-9]*$/);
            }

            // pascalCase should start with uppercase
            const pascalLine = lines.find(l => l.startsWith("Pascal:"));
            if (pascalLine) {
              const pascalValue = pascalLine.split(":")[1].trim();
              expect(pascalValue).toMatch(/^[A-Z][a-zA-Z0-9]*$/);
            }

            // snakeCase should contain only lowercase and underscores
            const snakeLine = lines.find(l => l.startsWith("Snake:"));
            if (snakeLine) {
              const snakeValue = snakeLine.split(":")[1].trim();
              expect(snakeValue).toMatch(/^[a-z]([a-z0-9_]*[a-z0-9])?$/);
            }
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Generator Discovery", () => {
    it("should consistently discover generators and templates", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
              templates: fc.array(
                fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
                { minLength: 1, maxLength: 3 }
              )
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (generators) => {
            // Setup generators
            for (const gen of generators) {
              const genDir = path.join(templatesDir, gen.name);
              await fs.ensureDir(genDir);

              for (const templateName of gen.templates) {
                const templateDir = path.join(genDir, templateName);
                await fs.ensureDir(templateDir);
                
                const templateFile = path.join(templateDir, "test.txt");
                await fs.writeFile(templateFile, "Test content", "utf-8");
              }
            }

            // Test discovery
            const discoveredGenerators = await generator.listGenerators();

            // Property: All created generators should be discovered
            expect(discoveredGenerators.length).toBe(generators.length);

            for (const gen of generators) {
              const found = discoveredGenerators.find(g => g.name === gen.name);
              expect(found).toBeDefined();
              
              // Property: All templates should be found
              expect(found.templates.length).toBe(gen.templates.length);
            }
          }
        ),
        { numRuns }
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed templates gracefully", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            generatorName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            templateName: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
            malformedContent: fc.oneof(
              fc.string().map(s => s + "{{ unclosedTag"), // Unclosed tags
              fc.string().filter(s => s.includes("{%") && !s.includes("%}")), // Unclosed blocks
              fc.string().map(s => s + "{{ unclosedVariable ") // Incomplete variable
            )
          }),
          async ({ generatorName, templateName, malformedContent }) => {
            const genDir = path.join(templatesDir, generatorName);
            const templateDir = path.join(genDir, templateName);
            await fs.ensureDir(templateDir);

            const templateFile = path.join(templateDir, "malformed.txt");
            await fs.writeFile(templateFile, malformedContent, "utf-8");

            // Property: Should either handle gracefully or throw meaningful error
            try {
              const options = {
                generator: generatorName,
                template: templateName,
                dest: path.join(tmpDir, "output"),
                force: true,
                dry: false
              };

              await generator.generate(options);
              // If it succeeds, that's fine - the generator handled it
            } catch (error) {
              // If it throws, it should be a meaningful error
              expect(error).toBeInstanceOf(Error);
              expect(typeof error.message).toBe("string");
            }
          }
        ),
        { numRuns }
      );
    });
  });
});