import { describe, it, expect, beforeEach } from "vitest";
import { Generator } from "../src/lib/generator.js";
import { ArgumentParser } from "../src/lib/ArgumentParser.js";
import { TemplateScanner } from "../src/lib/template-scanner.js";

describe("Variable Flow Debug", () => {
  let generator;
  let templateScanner;

  beforeEach(() => {
    generator = new Generator();
    templateScanner = new TemplateScanner();
  });

  it("should correctly scan template variables", async () => {
    // Test scanning the command/citty template
    const { variables } = await generator.scanTemplateForVariables("command", "citty");
    
    console.log("🔍 Scanned variables from command/citty template:", variables);
    
    // Should find commandName from the template
    const commandNameVar = variables.find(v => v.name === "commandName");
    expect(commandNameVar).toBeDefined();
    expect(commandNameVar?.type).toBe("string");
  });

  it("should parse positional arguments correctly", async () => { // Simulate CLI args };

    // Set up environment variable like CLI does
    process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(["command", "citty", "Users"]);

    // Get template variables
    const { variables } = await generator.scanTemplateForVariables("command", "citty");
    console.log("📝 Template variables:", variables.map(v => v.name));

    // Create argument parser
    const argumentParser = new ArgumentParser({ templateVariables });
    
    // Parse arguments
    const parsed = argumentParser.parseArguments(mockArgs);
    console.log("🎯 Parsed arguments:", parsed);

    // Check that Users was mapped to commandName
    expect(parsed.positional).toHaveProperty("commandName");
    expect(parsed.positional.commandName).toBe("Users");
    
    // Clean up
    delete process.env.UNJUCKS_POSITIONAL_ARGS;
  });

  it("should merge variables correctly in dynamic-commands", async () => { // Simulate the variable merging logic from dynamic-commands.ts
    const parsedArgs = {
      positional },
      flags: { withTests },
      generator: "command",
      template: "citty"
    };

    // Test mergeArguments function equivalent
    const templateVariables = { ...parsedArgs.flags, ...parsedArgs.positional };
    
    console.log("🔄 Merged template variables:", templateVariables);
    
    expect(templateVariables.commandName).toBe("Users");
    expect(templateVariables.withTests).toBe(true);
  });

  it.skip("should pass variables to generator.generate correctly", async () => {
    // Skip this test for now to avoid prompts
    // Will test the variable flow in isolation
  });

  it("should test template rendering with variables", () => {
    // Simple test of template variable substitution
    const nunjucks = require('nunjucks');
    
    const env = new nunjucks.Environment(null, {
      autoescape,
      throwOnUndefined,
      trimBlocks,
      lstripBlocks,
    });

    // Add Pascal case filter
    env.addFilter('pascalCase', (str) => { return str
        .replace(/(? })
        .replace(/\s+/g, '');
    });

    const template = 'export const {{ commandName | pascalCase }}Command = defineCommand({ ';
    const variables = { commandName, variables);
    console.log('🎨 Rendered template });
});