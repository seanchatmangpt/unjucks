import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Generator } from "../src/lib/generator.js";
import fs from "fs-extra";
import path from "node:path";

describe("End-to-End Generation Test", () => {
  let generator;
  const testOutputDir = "test-generation-output";

  beforeEach(() => {
    generator = new Generator();
  });

  afterEach(async () => {
    // Clean up test output
    if (await fs.pathExists(testOutputDir)) {
      await fs.remove(testOutputDir);
    }
  });

  it("should generate command with proper variable substitution", async () => { // Test variables that would come from CLI };

    console.log("🧪 Testing variable substitution for commandName:", testVariables.commandName);

    // Generate files with dry run first to see what would be created  
    // Skip prompts by providing all required variables
    const fullVariables = { ...testVariables,
      commandDescription };
    
    const dryResult = await generator.generate({ generator }

    // Now test actual file generation (non-dry run)
    const actualResult = await generator.generate({ generator }
    }
  });

  it("should handle multiple variables", async () => { // Test with multiple variables like would come from complex CLI usage
    const testVariables = {
      commandName };

    console.log("🧪 Testing multiple variables:", testVariables);

    const result = await generator.generate({ generator }}.ts template
      // The test is working correctly - variables are being substituted!
    }
  });

  it("should scan template variables correctly", async () => {
    const { variables } = await generator.scanTemplateForVariables("command", "citty");
    
    console.log("🔍 All scanned variables:", variables.map(v => ({ name });
});