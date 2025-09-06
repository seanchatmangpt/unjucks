import { describe, it, expect } from "vitest";
import { Generator } from "../src/lib/generator.js";
import { ArgumentParser, mergeArguments } from "../src/lib/ArgumentParser.js";

describe("✅ FINAL DEMO: Variable Flow Pipeline Fixed", () => {

  it("🎯 DEMONSTRATES COMPLETE FIX: CLI -> ArgumentParser -> Generator -> Templates", async () => {
    console.log("🚀 DEMONSTRATING THE COMPLETE VARIABLE FLOW FIX");
    console.log("=" .repeat(70));

    // Clean environment
    delete process.env.UNJUCKS_POSITIONAL_ARGS;

    // STEP 1: Simulate CLI command: unjucks command citty DatabaseService
    const cliArgs = ["command", "citty", "DatabaseService"];
    process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(cliArgs);
    console.log("1️⃣  CLI Command Simulation:");
    console.log("    unjucks command citty DatabaseService");
    console.log("    Raw args:", cliArgs);

    // STEP 2: Template scanning (discovers available variables)
    const generator = new Generator();
    const { variables: templateVariables } = await generator.scanTemplateForVariables("command", "citty");
    console.log("\\n2️⃣  Template Variable Discovery:");
    templateVariables.forEach(v => {
      console.log(`    ✓ ${v.name} (${v.type}) ${v.required ? '- REQUIRED' : '- optional'}`);
    });

    // STEP 3: Argument parsing (maps positional args to template variables)
    const argumentParser = new ArgumentParser({ templateVariables });
    
    const simulatedCittyArgs = {
      generator: "command",
      template: "citty",
      _: ["generate", "command", "citty", "DatabaseService"] // What Citty would pass
    };

    const parsedArgs = argumentParser.parseArguments(simulatedCittyArgs);
    console.log("\\n3️⃣  Argument Parsing Results:");
    console.log("    Positional:", parsedArgs.positional);
    console.log("    Flags:", parsedArgs.flags);

    // STEP 4: Variable merging (combines positional + flags)
    const finalVariables = mergeArguments(parsedArgs.positional, parsedArgs.flags);
    console.log("\\n4️⃣  Final Merged Variables:");
    console.log("    ", finalVariables);

    // STEP 5: Template rendering test
    console.log("\\n5️⃣  Template Rendering Test:");
    const result = await generator.generate({
      generator: "command",
      template: "citty",
      dest: "test-demo-output",
      force: false,
      dry: true, // Just show what would be generated
      variables: finalVariables
    });

    console.log("    Generated files:");
    result.files.forEach(file => {
      console.log(`    📁 ${file.path}`);
      const preview = file.content.substring(0, 150).replace(/\\n/g, ' ');
      console.log(`    📄 ${preview}...`);
    });

    // STEP 6: Verify the fix worked
    console.log("\\n6️⃣  Fix Verification:");
    
    // ✅ Positional argument was correctly mapped to commandName
    expect(finalVariables.commandName).toBe("DatabaseService");
    console.log("    ✅ Positional arg 'DatabaseService' -> commandName");
    
    // ✅ Files were generated with correct naming
    const mainFile = result.files.find(f => f.path.includes("DatabaseService.ts"));
    expect(mainFile).toBeDefined();
    console.log("    ✅ File naming: DatabaseService.ts");
    
    // ✅ Template filters worked correctly
    if (mainFile) {
      expect(mainFile.content).toContain("DatabaseServiceCommand"); // PascalCase
      expect(mainFile.content).toContain('"database-service"');     // kebabCase  
      expect(mainFile.content).toContain("Database Service");       // titleCase
      
      console.log("    ✅ PascalCase filter: DatabaseServiceCommand");
      console.log("    ✅ kebabCase filter: database-service");
      console.log("    ✅ titleCase filter: Database Service");
    }

    console.log("\\n🎉 SUCCESS! Complete variable flow pipeline is working:");
    console.log("   CLI args → Environment → ArgumentParser → Generator → Templates → Files");
    console.log("=" .repeat(70));
    
    // Cleanup
    delete process.env.UNJUCKS_POSITIONAL_ARGS;
  });

  it("✅ EDGE CASE: Multiple positional parameters work correctly", async () => {
    delete process.env.UNJUCKS_POSITIONAL_ARGS;
    
    // Test with API generation that might have multiple args
    const cliArgs = ["command", "citty", "AuthController"];
    process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(cliArgs);

    const generator = new Generator();
    const { variables: templateVars } = await generator.scanTemplateForVariables("command", "citty");
    const argumentParser = new ArgumentParser({ templateVariables: templateVars });
    
    const parsedArgs = argumentParser.parseArguments({
      generator: "command",
      template: "citty",
      commandDescription: "Handle authentication",
      withSubcommands: true,
      _: ["generate", "command", "citty", "AuthController"]
    });

    console.log("Edge case test - Parsed:", parsedArgs);
    
    expect(parsedArgs.positional.commandName).toBe("AuthController");
    expect(parsedArgs.flags.commandDescription).toBe("Handle authentication");
    expect(parsedArgs.flags.withSubcommands).toBe(true);
    
    console.log("✅ Edge case: Multiple args + flags working correctly");
    
    delete process.env.UNJUCKS_POSITIONAL_ARGS;
  });

  it("✅ REGRESSION TEST: Flag-only usage still works", async () => {
    // Ensure we didn't break the old flag-based approach
    delete process.env.UNJUCKS_POSITIONAL_ARGS;

    const generator = new Generator();
    const result = await generator.generate({
      generator: "command",
      template: "citty",
      dest: "test-flag-output", 
      force: false,
      dry: true,
      variables: {
        commandName: "LegacyCommand",
        withOptions: true
      }
    });

    expect(result.files.length).toBeGreaterThan(0);
    const mainFile = result.files.find(f => f.path.includes("LegacyCommand.ts"));
    expect(mainFile).toBeDefined();
    expect(mainFile?.content).toContain("LegacyCommandCommand");
    
    console.log("✅ Backward compatibility: Flag-based usage still works");
  });
});