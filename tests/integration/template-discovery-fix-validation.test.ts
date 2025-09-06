import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import { Generator } from "../../src/lib/generator.js";

describe("Template Discovery Fix Validation", () => {
  let generator: Generator;
  let tempTestDir: string;

  beforeAll(async () => {
    // Create a temporary test templates directory
    tempTestDir = path.join(process.cwd(), "test-templates-temp");
    
    // Create test directory structure
    await fs.ensureDir(path.join(tempTestDir, "empty-generator")); // Empty generator
    await fs.ensureDir(path.join(tempTestDir, "valid-generator", "template1"));
    await fs.writeFile(
      path.join(tempTestDir, "valid-generator", "template1", "test.txt"),
      "Test template file"
    );
    
    generator = new Generator(tempTestDir);
  });

  afterAll(async () => {
    // Clean up temp directory
    if (await fs.pathExists(tempTestDir)) {
      await fs.remove(tempTestDir);
    }
  });

  it("should provide helpful error for empty generator", async () => {
    await expect(
      generator.scanTemplateForVariables("empty-generator", "nonexistent")
    ).rejects.toThrow(
      /Generator 'empty-generator' has no templates available/
    );
  });

  it("should provide helpful error for missing template in valid generator", async () => {
    await expect(
      generator.scanTemplateForVariables("valid-generator", "nonexistent")
    ).rejects.toThrow(
      /Template 'nonexistent' not found in generator 'valid-generator'. Available templates: template1/
    );
  });

  it("should provide helpful error for completely missing generator", async () => {
    await expect(
      generator.scanTemplateForVariables("nonexistent-generator", "template")
    ).rejects.toThrow(
      /Generator 'nonexistent-generator' not found/
    );
  });

  it("should work correctly with valid generator and template", async () => {
    const result = await generator.scanTemplateForVariables("valid-generator", "template1");
    expect(result.variables).toBeDefined();
    expect(result.cliArgs).toBeDefined();
  });

  it("should properly discover available templates", async () => {
    const availableTemplates = await (generator as any).getAvailableTemplates("valid-generator");
    expect(availableTemplates).toContain("template1");
    expect(availableTemplates).not.toContain("nonexistent");
  });

  it("should return empty array for empty generator", async () => {
    const availableTemplates = await (generator as any).getAvailableTemplates("empty-generator");
    expect(availableTemplates).toEqual([]);
  });
});