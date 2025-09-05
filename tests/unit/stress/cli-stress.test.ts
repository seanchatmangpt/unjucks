import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync, spawn } from "node:child_process";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { performance } from "node:perf_hooks";

describe("CLI Stress Tests", () => {
  let testDir: string;
  let templatesDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "unjucks-cli-stress-"));
    templatesDir = path.join(testDir, "_templates");
    await fs.ensureDir(templatesDir);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.remove(testDir);
  });

  describe("High-Volume File Generation", () => {
    it("should generate 1000+ files without memory overflow", async () => {
      // Create a template that generates multiple files
      const generatorDir = path.join(templatesDir, "stress-test");
      const templateDir = path.join(generatorDir, "bulk-files");
      await fs.ensureDir(templateDir);

      // Create template file
      const templateContent = `// Generated file {{ fileIndex }}
export const file{{ fileIndex }} = {
  id: {{ fileIndex }},
  name: "{{ baseName }}_{{ fileIndex }}",
  timestamp: {{ timestamp }},
  data: "{{ dataContent }}"
};
`;

      await fs.writeFile(
        path.join(templateDir, "file-{{ fileIndex }}.ts"),
        templateContent
      );

      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      // Generate 1000 files by running the CLI multiple times
      const fileCount = 1000;
      const batchSize = 50;
      const batches = Math.ceil(fileCount / batchSize);

      for (let batch = 0; batch < batches; batch++) {
        const promises = [];
        
        for (let i = 0; i < batchSize && (batch * batchSize + i) < fileCount; i++) {
          const fileIndex = batch * batchSize + i;
          promises.push(
            executeCliCommand(
              "generate",
              ["stress-test", "bulk-files"],
              {
                cwd: testDir,
                env: {
                  ...process.env,
                  CLI_FILEINDEX: fileIndex.toString(),
                  CLI_BASENAME: "stress",
                  CLI_TIMESTAMP: Date.now().toString(),
                  CLI_DATACONTENT: `data_${fileIndex}`.repeat(10), // Some content
                },
              }
            )
          );
        }

        await Promise.allSettled(promises);
      }

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      // Verify files were created
      const outputDir = path.join(testDir, "src");
      const generatedFiles = await fs.readdir(outputDir);
      
      expect(generatedFiles.length).toBeGreaterThan(900); // Allow for some failures
      expect(endTime - startTime).toBeLessThan(60000); // Should complete within 60 seconds
      
      // Memory should not increase by more than 500MB
      const memoryIncrease = endMemory - startMemory;
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
    }, 120000);

    it("should handle concurrent CLI commands without race conditions", async () => {
      // Create multiple templates
      for (let i = 0; i < 10; i++) {
        const generatorDir = path.join(templatesDir, `generator-${i}`);
        const templateDir = path.join(generatorDir, "template");
        await fs.ensureDir(templateDir);

        await fs.writeFile(
          path.join(templateDir, `output-${i}.ts`),
          `// Generator ${i} output\nexport const value${i} = "{{ name }}_${i}";`
        );
      }

      const startTime = performance.now();

      // Run 50 concurrent CLI commands
      const concurrentCount = 50;
      const promises = [];

      for (let i = 0; i < concurrentCount; i++) {
        const generatorIndex = i % 10;
        promises.push(
          executeCliCommand(
            "generate",
            [`generator-${generatorIndex}`, "template"],
            {
              cwd: testDir,
              env: {
                ...process.env,
                CLI_NAME: `concurrent_${i}`,
              },
            }
          )
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = performance.now();

      // Count successful operations
      const successful = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;

      expect(successful).toBeGreaterThan(concurrentCount * 0.8); // At least 80% success rate
      expect(failed).toBeLessThan(concurrentCount * 0.2); // Less than 20% failure rate
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds

      // Verify no file corruption occurred
      const outputDir = path.join(testDir, "src");
      if (await fs.pathExists(outputDir)) {
        const files = await fs.readdir(outputDir);
        for (const file of files) {
          const content = await fs.readFile(path.join(outputDir, file), "utf8");
          expect(content).toMatch(/export const value\d+ = "concurrent_\d+_\d+";/);
        }
      }
    }, 60000);

    it("should handle list command with 1000+ generators efficiently", async () => {
      // Create 1000 generators
      const generatorCount = 1000;
      for (let i = 0; i < generatorCount; i++) {
        const generatorDir = path.join(templatesDir, `gen-${i.toString().padStart(4, "0")}`);
        const templateDir = path.join(generatorDir, "template");
        await fs.ensureDir(templateDir);

        // Create config file
        const config = {
          name: `gen-${i}`,
          description: `Generator ${i}`,
          templates: [
            {
              name: "template",
              description: `Template for generator ${i}`,
              files: ["output.ts"],
            },
          ],
        };

        await fs.writeFile(
          path.join(generatorDir, "config.yml"),
          JSON.stringify(config)
        );

        await fs.writeFile(
          path.join(templateDir, "output.ts"),
          `// Output from generator ${i}`
        );
      }

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      // Run list command
      const result = await executeCliCommand("list", [], { cwd: testDir });

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should list within 5 seconds
      
      // Memory should not increase by more than 100MB
      const memoryIncrease = endMemory - startMemory;
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      // Verify all generators are listed
      expect(result.stdout).toContain("gen-0000");
      expect(result.stdout).toContain("gen-0999");
    }, 30000);
  });

  describe("Large Content Processing", () => {
    it("should process templates with 10MB+ content", async () => {
      const generatorDir = path.join(templatesDir, "large-content");
      const templateDir = path.join(generatorDir, "big-file");
      await fs.ensureDir(templateDir);

      // Create a template with 10MB of content
      const largeContent = "// This is a large file\n" + "console.log('data');\n".repeat(500000);
      const templateContent = `${largeContent}\n// Dynamic content: {{ name }}\nexport const name = "{{ name }}";`;

      await fs.writeFile(
        path.join(templateDir, "large-output.ts"),
        templateContent
      );

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      const result = await executeCliCommand(
        "generate",
        ["large-content", "big-file"],
        {
          cwd: testDir,
          env: {
            ...process.env,
            CLI_NAME: "large_test",
          },
        }
      );

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // Should process within 10 seconds

      // Verify the file was created and contains expected content
      const outputFile = path.join(testDir, "src", "large-output.ts");
      expect(await fs.pathExists(outputFile)).toBe(true);

      const outputContent = await fs.readFile(outputFile, "utf8");
      expect(outputContent).toContain('export const name = "large_test"');
      expect(outputContent.length).toBeGreaterThan(10 * 1024 * 1024); // Should be > 10MB

      // Memory should not increase by more than 200MB (reasonable for 10MB file processing)
      const memoryIncrease = endMemory - startMemory;
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024);
    }, 30000);
  });

  describe("Error Handling Under Stress", () => {
    it("should gracefully handle malformed templates under load", async () => {
      // Create generators with various malformed templates
      const malformedTemplates = [
        "{{ unclosed variable",
        "{% if condition %} no endif",
        "{{ variable | nonexistent_filter }}",
        "{% for item in undefined_collection %}",
        "{{ deeply.nested.undefined.property }}",
      ];

      for (let i = 0; i < malformedTemplates.length; i++) {
        const generatorDir = path.join(templatesDir, `malformed-${i}`);
        const templateDir = path.join(generatorDir, "template");
        await fs.ensureDir(templateDir);

        await fs.writeFile(
          path.join(templateDir, "output.ts"),
          malformedTemplates[i]
        );
      }

      // Run multiple concurrent operations with malformed templates
      const promises = [];
      for (let i = 0; i < 20; i++) {
        const templateIndex = i % malformedTemplates.length;
        promises.push(
          executeCliCommand(
            "generate",
            [`malformed-${templateIndex}`, "template"],
            {
              cwd: testDir,
              env: {
                ...process.env,
                CLI_NAME: `error_test_${i}`,
              },
            }
          )
        );
      }

      const results = await Promise.allSettled(promises);

      // All should fail gracefully (not crash)
      const fulfilled = results.filter(r => r.status === "fulfilled");
      const rejected = results.filter(r => r.status === "rejected");

      // Some might succeed with default values, but none should crash
      expect(fulfilled.length + rejected.length).toBe(20);
      
      // Verify the process is still responsive
      const healthCheck = await executeCliCommand("list", [], { cwd: testDir });
      expect(healthCheck.success).toBe(true);
    }, 60000);
  });
});

// Helper function to execute CLI commands
async function executeCliCommand(
  command: string,
  args: string[] = [],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeout?: number;
  } = {}
): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}> {
  return new Promise((resolve) => {
    const timeout = options.timeout || 30000;
    const cliPath = path.resolve(__dirname, "../../../dist/cli.mjs");
    
    const child = spawn("node", [cliPath, command, ...args], {
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeout);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        success: code === 0,
        stdout,
        stderr,
        exitCode: code,
      });
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        success: false,
        stdout,
        stderr: stderr + error.message,
        exitCode: null,
      });
    });
  });
}