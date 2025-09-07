import { describe, it, expect } from "vitest";
import { ArgumentParser } from "../../src/lib/ArgumentParser.js";
describe("ArgumentParser", () => { const mockTemplateVariables = [
    {
      name },
    { name },
    { name },
  ];

  describe("parseArguments", () => {
    it("should parse positional arguments correctly", () => {
      const parser = new ArgumentParser({
        templateVariables,
      });

      const args = { generator };

      const result = parser.parseArguments(args);

      expect(result.generator).toBe("command");
      expect(result.template).toBe("citty");
      expect(result.positional.commandName).toBe("MyCommand");
      expect(result.positional.description).toBe("My description");
    });

    it("should extract positional parameters from template variables", () => {
      const parser = new ArgumentParser({
        templateVariables,
      });

      const positionalParams = parser.extractPositionalParameters();

      expect(positionalParams).toHaveLength(2);
      expect(positionalParams[0].name).toBe("commandName");
      expect(positionalParams[0].position).toBe(2);
      expect(positionalParams[0].required).toBe(true);
      
      expect(positionalParams[1].name).toBe("description");
      expect(positionalParams[1].position).toBe(3);
      expect(positionalParams[1].required).toBe(false);
    });

    it("should handle flag arguments", () => {
      const parser = new ArgumentParser({
        templateVariables,
      });

      const args = { generator };

      const result = parser.parseArguments(args);

      expect(result.flags.withTests).toBe(true);
      expect(result.flags.customFlag).toBe("value");
    });

    it("should merge positional and flag arguments with positional taking precedence", () => {
      const parser = new ArgumentParser({
        templateVariables,
      });

      const args = { generator };

      const result = parser.parseArguments(args);

      expect(result.positional.commandName).toBe("PositionalName");
      // The flag version should still be available but not override positional
      expect(args.commandName).toBe("FlagName"); // Original args should be unchanged
    });
  });

  describe("validateArguments", () => {
    it("should validate required parameters", () => {
      const parser = new ArgumentParser({
        templateVariables,
      });

      const positionalParams = parser.extractPositionalParameters();
      const parsedArgs = { positional },
        flags: {},
        generator: "command",
        template: "citty"
      };

      const validation = parser.validateArguments(parsedArgs, positionalParams);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Missing required parameter)");
    });

    it("should pass validation when required parameters are provided", () => {
      const parser = new ArgumentParser({
        templateVariables,
      });

      const positionalParams = parser.extractPositionalParameters();
      const parsedArgs = { positional },
        flags: {},
        generator: "command",
        template: "citty"
      };

      const validation = parser.validateArguments(parsedArgs, positionalParams);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe("generateUsageExamples", () => {
    it("should generate usage examples", () => {
      const parser = new ArgumentParser({
        templateVariables,
      });

      const positionalParams = parser.extractPositionalParameters();
      const examples = parser.generateUsageExamples("command", "citty", positionalParams);

      console.log("Generated examples:", examples);

      expect(examples).toContain("unjucks generate command citty ");
      expect(examples).toContain("unjucks generate command citty  [description]");
      // Fix the expected value based on how the example generation actually works
      expect(examples.length).toBeGreaterThan(0);
    });
  });

  describe("generateHelpText", () => {
    it("should generate help text for positional parameters", () => {
      const parser = new ArgumentParser({
        templateVariables,
      });

      const positionalParams = parser.extractPositionalParameters();
      const helpText = parser.generateHelpText(positionalParams);

      expect(helpText).toContain("Positional Parameters:");
      expect(helpText).toContain("commandName [string] pos 2 (required)");
      expect(helpText).toContain("description [string] pos 3");
    });
  });
});