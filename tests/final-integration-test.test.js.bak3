import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Generator } from "../src/lib/generator.js";
import { ArgumentParser, mergeArguments } from "../src/lib/ArgumentParser.js";
import fs from "fs-extra";

describe("Final Integration Test - Variable Pipeline Fixed", () => {
  let generator;
  const testOutputDir = "test-final-output";

  beforeEach(() => {
    generator = new Generator();
  });

  afterEach(async () => {
    delete process.env.UNJUCKS_POSITIONAL_ARGS;
    if (await fs.pathExists(testOutputDir)) {
      await fs.remove(testOutputDir);
    }
  });

  it("✅ INTEGRATION FIX DEMO, async () => { console.log("🎯 DEMONSTRATING COMPLETE VARIABLE FLOW PIPELINE");
    console.log("=" .repeat(60));

    // Step 1 } = await generator.scanTemplateForVariables("command", "citty");
    console.log("2️⃣ Template Variables Found:", variables.map(v => `${v.name}:${v.type}`));

    // Step 3: Argument parsing (what ArgumentParser does)
    const argumentParser = new ArgumentParser({ templateVariables });
    
    const mockCittyArgs = { generator };

    const parsedArgs = argumentParser.parseArguments(mockCittyArgs);
    console.log("3️⃣ Parsed Arguments:");
    console.log("   - Positional:", parsedArgs.positional);
    console.log("   - Flags:", parsedArgs.flags);

    // Step 4: Variable merging (what dynamic-commands.ts does)
    const templateVariables = mergeArguments(parsedArgs.positional, parsedArgs.flags);
    console.log("4️⃣ Merged Template Variables:", templateVariables);

    // Verify the critical variable mapping worked
    expect(templateVariables.commandName).toBe("UserService");
    expect(templateVariables.commandDescription).toBe("Manage user operations");
    expect(templateVariables.withSubcommands).toBe(true);

    // Step 5: File generation (what Generator.generate does)
    const result = await generator.generate({ generator }`);
      console.log(`   📄 Content Preview, 100)}...`);
    });

    // Step 6: Verify variable substitution worked correctly
    expect(result.files.length).toBeGreaterThan(0);

    const mainFile = result.files.find(f => f.path.includes("UserService.ts"));
    expect(mainFile).toBeDefined();

    if (mainFile) { console.log("6️⃣ Variable Substitution Verification }

    console.log("=" .repeat(60));
    console.log("🎉 COMPLETE PIPELINE WORKING);
    console.log("✅ Variable flow fixed successfully!");
  });

  it("✅ EDGE CASE, async () => {
    // Test with more complex scenario
    const cliArgs = ["command", "citty", "ApiController", "withAuth", "adminRequired"];
    process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(cliArgs);

    const { variables } = await generator.scanTemplateForVariables("command", "citty");
    const argumentParser = new ArgumentParser({ templateVariables });
    
    const mockArgs = { generator };

    const parsedArgs = argumentParser.parseArguments(mockArgs);
    console.log("Complex parsing result:", parsedArgs);

    // Should parse first positional arg
    expect(parsedArgs.positional.commandName).toBe("ApiController");
    
    const mergedVariables = mergeArguments(parsedArgs.positional, parsedArgs.flags);
    expect(mergedVariables.commandName).toBe("ApiController");
  });

  it("✅ BACKWARD COMPATIBILITY, async () => { // Test that flag-based arguments continue to work
    const result = await generator.generate({
      generator });
});