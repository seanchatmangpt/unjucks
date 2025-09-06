import { describe, it, expect, afterEach } from "vitest";
import { createDynamicGenerateCommand } from "../src/lib/dynamic-commands.js";
import fs from "fs-extra";

describe("Simple CLI Integration Test", () => {
  const testOutputDir = "test-simple-cli-output";

  afterEach(async () => {
    // Clean up environment variables first
    delete process.env.UNJUCKS_POSITIONAL_ARGS;
    
    // Clean up test output with retry
    if (await fs.pathExists(testOutputDir)) {
      try {
        await fs.remove(testOutputDir);
      } catch (error) {
        // Retry once after a short delay
        await new Promise(resolve => setTimeout(resolve, 100));
        try {
          await fs.remove(testOutputDir);
        } catch (retryError) {
          console.warn("Could not clean up test directory:", retryError.message);
        }
      }
    }
  });

  it("should handle Hygen-style positional arguments correctly", async () => {
    // Simulate what the CLI does for: unjucks command citty Users
    const originalArgs = ["command", "citty", "Users"];
    process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(originalArgs);

    // Create the dynamic command (like CLI does)
    const generateCommand = createDynamicGenerateCommand();

    // Mock the args that Citty would pass
    const mockArgs = {
      generator: "command",
      template: "citty", 
      dest: testOutputDir,
      force: true,
      dry: true,
      // Provide all template variables to avoid prompts
      commandDescription: "Manage application users",
      withOptions: false,
      withSubcommands: false,
      // Citty would also add _ array but we're handling UNJUCKS_POSITIONAL_ARGS
      _: ["generate", "command", "citty", "Users"]
    };

    console.log("🧪 Testing CLI integration with args:", mockArgs);
    console.log("📝 Environment variable:", process.env.UNJUCKS_POSITIONAL_ARGS);

    // Run the command (dry run to avoid file system operations)
    let output = "";
    let errorOutput = "";
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    console.log = (...args) => {
      output += args.join(" ") + "\\n";
      originalConsoleLog(...args);
    };
    
    console.error = (...args) => {
      errorOutput += args.join(" ") + "\\n";
      originalConsoleError(...args);
    };

    try {
      await generateCommand.run({ args: mockArgs });
    } catch (error) {
      console.error("❌ Command failed:", error);
      throw error;
    } finally {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    }

    console.log("📋 Command output:");
    console.log(output);
    
    if (errorOutput) {
      console.log("⚠️ Error output:");
      console.log(errorOutput);
    }

    // Verify the command executed successfully
    expect(output).toContain("Dry run");
    expect(output).toContain("Users.ts"); // Should create Users.ts file (from commandName=Users)
    expect(output).not.toContain("MyApiService"); // This test uses "Users" not "MyApiService"
    expect(errorOutput).not.toContain("Error"); // No errors
  });

  it("should parse positional arguments and map to template variables", async () => {
    // Test the ArgumentParser directly with real template scanning
    const { ArgumentParser } = await import("../src/lib/ArgumentParser.js");
    const { Generator } = await import("../src/lib/generator.js");

    const generator = new Generator();
    
    // Scan the actual template to get variables
    const { variables: templateVariables } = await generator.scanTemplateForVariables("command", "citty");
    console.log("🔍 Template variables found:", templateVariables.map(v => v.name));

    // Create argument parser with template variables
    const argumentParser = new ArgumentParser({ templateVariables });

    // Simulate CLI args: unjucks command citty Users
    process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(["command", "citty", "Users"]);

    const mockArgs = {
      generator: "command",
      template: "citty",
      _: ["generate", "command", "citty", "Users"]
    };

    // Parse arguments
    const parsedArgs = argumentParser.parseArguments(mockArgs);
    console.log("🎯 Parsed arguments:", parsedArgs);

    // Verify positional argument was mapped correctly
    expect(parsedArgs.positional).toHaveProperty("commandName");
    expect(parsedArgs.positional.commandName).toBe("Users");

    // Test merging with flags
    const mergedVariables = { ...parsedArgs.flags, ...parsedArgs.positional };
    console.log("🔄 Merged variables:", mergedVariables);

    expect(mergedVariables.commandName).toBe("Users");
  });

  it("should generate actual files with CLI flow", async () => {
    // Test the complete flow from CLI arguments to file generation
    const originalArgs = ["command", "citty", "MyApiService"];
    process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(originalArgs);

    const generateCommand = createDynamicGenerateCommand();

    const mockArgs = {
      generator: "command",
      template: "citty",
      dest: testOutputDir, 
      force: true,
      dry: false, // Actual file generation
      // Provide all template variables to avoid prompts
      commandDescription: "Manage API service operations",
      withOptions: false,
      withSubcommands: false,
      _: ["generate", "command", "citty", "MyApiService"]
    };

    console.log("🧪 Testing actual file generation with CLI flow");

    // Capture output
    let generatedFiles: string[] = [];
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      const message = args.join(" ");
      if (message.includes("✅ Generated") || message.includes("+ ")) {
        // Extract file paths from generation output
        const match = message.match(/\+ (.+)/);
        if (match) generatedFiles.push(match[1]);
      } else if (message.includes("✓ ")) {
        // Also capture "✓ Created file:" messages
        const match = message.match(/✓ (.+)/);
        if (match) {
          // Extract file path from success message
          const pathMatch = match[1].match(/([^\s]+\.ts)/);
          if (pathMatch) generatedFiles.push(pathMatch[1]);
        }
      }
      originalConsoleLog(...args);
    };

    try {
      await generateCommand.run({ args: mockArgs });
    } finally {
      console.log = originalConsoleLog;
    }

    console.log("📁 Generated files:", generatedFiles);

    // Verify files were created
    expect(generatedFiles.length).toBeGreaterThan(0);

    // Check the main command file was created
    const mainFile = generatedFiles.find(f => f.includes("MyApiService.ts"));
    expect(mainFile).toBeDefined();

    if (mainFile) {
      // Verify file exists on disk
      const fileExists = await fs.pathExists(mainFile);
      expect(fileExists).toBe(true);

      // Verify file content
      const content = await fs.readFile(mainFile, "utf-8");
      console.log("📄 Generated file content preview:");
      console.log(content.substring(0, 300) + "...");

      expect(content).toContain("MyApiServiceCommand");
      expect(content).toContain('"my-api-service"'); // kebab case
      expect(content).toContain("My Api Service Command"); // title case
    }
  });
});