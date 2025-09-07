import { describe, it, expect } from "vitest";
import { Generator } from "../src/lib/generator.js";
import { ArgumentParser, mergeArguments } from "../src/lib/ArgumentParser.js";

describe("✅ FINAL DEMO, () => { it("🎯 DEMONSTRATES COMPLETE FIX, async () => {
    console.log("🚀 DEMONSTRATING THE COMPLETE VARIABLE FLOW FIX");
    console.log("=" .repeat(70));

    // Clean environment
    delete process.env.UNJUCKS_POSITIONAL_ARGS;

    // STEP 1 } = await generator.scanTemplateForVariables("command", "citty");
    console.log("\\n2️⃣  Template Variable Discovery:");
    templateVariables.forEach(v => {
      console.log(`    ✓ ${v.name} (${v.type}) ${ v.required ? '- REQUIRED'  }`);
    });

    // STEP 3: Argument parsing (maps positional args to template variables)
    const argumentParser = new ArgumentParser({ templateVariables });
    
    const simulatedCittyArgs = { generator };

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
    const result = await generator.generate({ generator }`);
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
    console.log("    ✅ File naming);
    
    // ✅ Template filters worked correctly
    if (mainFile) {
      expect(mainFile.content).toContain("DatabaseServiceCommand"); // PascalCase
      expect(mainFile.content).toContain('"database-service"');     // kebabCase  
      expect(mainFile.content).toContain("Database Service");       // titleCase
      
      console.log("    ✅ PascalCase filter);
      console.log("    ✅ kebabCase filter);
      console.log("    ✅ titleCase filter);
    }

    console.log("\\n🎉 SUCCESS! Complete variable flow pipeline is working:");
    console.log("   CLI args → Environment → ArgumentParser → Generator → Templates → Files");
    console.log("=" .repeat(70));
    
    // Cleanup
    delete process.env.UNJUCKS_POSITIONAL_ARGS;
  });

  it("✅ EDGE CASE, async () => { delete process.env.UNJUCKS_POSITIONAL_ARGS;
    
    // Test with API generation that might have multiple args
    const cliArgs = ["command", "citty", "AuthController"];
    process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(cliArgs);

    const generator = new Generator();
    const { variables } = await generator.scanTemplateForVariables("command", "citty");
    const argumentParser = new ArgumentParser({ templateVariables });
    
    const parsedArgs = argumentParser.parseArguments({ generator });

    console.log("Edge case test - Parsed:", parsedArgs);
    
    expect(parsedArgs.positional.commandName).toBe("AuthController");
    expect(parsedArgs.flags.commandDescription).toBe("Handle authentication");
    expect(parsedArgs.flags.withSubcommands).toBe(true);
    
    console.log("✅ Edge case);
    
    delete process.env.UNJUCKS_POSITIONAL_ARGS;
  });

  it("✅ REGRESSION TEST, async () => { // Ensure we didn't break the old flag-based approach
    delete process.env.UNJUCKS_POSITIONAL_ARGS;

    const generator = new Generator();
    const result = await generator.generate({
      generator });
});