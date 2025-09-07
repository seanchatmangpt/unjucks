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
        } catch (retryError) { console.warn("Could not clean up test directory }
      }
    }
  });

  it("should handle Hygen-style positional arguments correctly", async () => { // Simulate what the CLI does for };

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

    try { await generateCommand.run({ args });
    } catch (error) { console.error("❌ Command failed } finally {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    }

    console.log("📋 Command output:");
    console.log(output);
    
    if (errorOutput) { console.log("⚠️ Error output }

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
    const { variables } = await generator.scanTemplateForVariables("command", "citty");
    console.log("🔍 Template variables found:", templateVariables.map(v => v.name));

    // Create argument parser with template variables
    const argumentParser = new ArgumentParser({ templateVariables });

    // Simulate CLI args: unjucks command citty Users
    process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(["command", "citty", "Users"]);

    const mockArgs = { generator };

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

  it("should generate actual files with CLI flow", async () => { // Test the complete flow from CLI arguments to file generation
    const originalArgs = ["command", "citty", "MyApiService"];
    process.env.UNJUCKS_POSITIONAL_ARGS = JSON.stringify(originalArgs);

    const generateCommand = createDynamicGenerateCommand();

    const mockArgs = {
      generator };

    console.log("🧪 Testing actual file generation with CLI flow");

    // Capture output
    let generatedFiles = [];
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      const message = args.join(" ");
      if (message.includes("✅ Generated") || message.includes("+ ")) {
        // Extract file paths from generation output
        const match = message.match(/\+ (.+)/);
        if (match) generatedFiles.push(match[1]);
      } else if (message.includes("✓ ")) { // Also capture "✓ Created file }
      }
      originalConsoleLog(...args);
    };

    try { await generateCommand.run({ args });
    } finally {
      console.log = originalConsoleLog;
    }

    console.log("📁 Generated files:", generatedFiles);

    // Verify files were created
    expect(generatedFiles.length).toBeGreaterThan(0);

    // Check the main command file was created
    const mainFile = generatedFiles.find(f => f.includes("MyApiService.ts"));
    expect(mainFile).toBeDefined();

    if (mainFile) { // Verify file exists on disk
      const fileExists = await fs.pathExists(mainFile);
      expect(fileExists).toBe(true);

      // Verify file content
      const content = await fs.readFile(mainFile, "utf-8");
      console.log("📄 Generated file content preview }
  });
});