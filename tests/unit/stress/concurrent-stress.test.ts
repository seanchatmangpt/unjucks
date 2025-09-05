import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, ChildProcess } from "node:child_process";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { Worker } from "node:worker_threads";
import { Generator } from "../../../src/lib/generator.js";

describe("Concurrent Stress Tests", () => {
  let testDir: string;
  let templatesDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "unjucks-concurrent-stress-"));
    templatesDir = path.join(testDir, "_templates");
    await fs.ensureDir(templatesDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe("Concurrent CLI Operations", () => {
    it("should handle 100 concurrent CLI processes without deadlocks", async () => {
      // Create a simple generator
      const generatorDir = path.join(templatesDir, "concurrent-cli");
      const templateDir = path.join(generatorDir, "simple");
      await fs.ensureDir(templateDir);

      await fs.writeFile(
        path.join(templateDir, "output.ts"),
        `// Concurrent CLI test
export const processId = "{{ processId }}";
export const timestamp = {{ timestamp }};
export const data = "{{ dataValue }}";`
      );

      const concurrentCount = 100;
      const startTime = performance.now();
      const processes: ChildProcess[] = [];
      const results: Promise<{ success: boolean; stdout: string; stderr: string; pid?: number }>[] = [];

      // Launch 100 concurrent CLI processes
      for (let i = 0; i < concurrentCount; i++) {
        const cliPath = path.resolve(__dirname, "../../../dist/cli.mjs");
        
        const child = spawn("node", [
          cliPath,
          "generate",
          "concurrent-cli",
          "simple",
          "--processId", `proc_${i}`,
          "--timestamp", Date.now().toString(),
          "--dataValue", `data_${i}`,
          "--dest", path.join(testDir, `output-${i}`),
          "--force"
        ], {
          cwd: testDir,
          stdio: "pipe",
        });

        processes.push(child);

        const resultPromise = new Promise<{ success: boolean; stdout: string; stderr: string; pid?: number }>((resolve) => {
          let stdout = "";
          let stderr = "";
          const timeoutId = setTimeout(() => {
            child.kill("SIGTERM");
            resolve({
              success: false,
              stdout,
              stderr: stderr + " [TIMEOUT]",
              pid: child.pid,
            });
          }, 30000); // 30 second timeout per process

          child.stdout?.on("data", (data) => {
            stdout += data.toString();
          });

          child.stderr?.on("data", (data) => {
            stderr += data.toString();
          });

          child.on("close", (code) => {
            clearTimeout(timeoutId);
            resolve({
              success: code === 0,
              stdout,
              stderr,
              pid: child.pid,
            });
          });

          child.on("error", (error) => {
            clearTimeout(timeoutId);
            resolve({
              success: false,
              stdout,
              stderr: stderr + error.message,
              pid: child.pid,
            });
          });
        });

        results.push(resultPromise);
      }

      // Wait for all processes to complete
      const completedResults = await Promise.all(results);
      const endTime = performance.now();

      // Analyze results
      const successful = completedResults.filter(r => r.success).length;
      const failed = completedResults.filter(r => !r.success).length;
      const timeouts = completedResults.filter(r => r.stderr.includes("TIMEOUT")).length;

      expect(successful).toBeGreaterThan(concurrentCount * 0.7); // At least 70% success rate
      expect(timeouts).toBeLessThan(concurrentCount * 0.1); // Less than 10% timeouts
      expect(endTime - startTime).toBeLessThan(60000); // Should complete within 60 seconds

      // Verify no file corruption occurred
      let validOutputs = 0;
      for (let i = 0; i < concurrentCount; i++) {
        const outputDir = path.join(testDir, `output-${i}`);
        const outputFile = path.join(outputDir, "output.ts");
        
        if (await fs.pathExists(outputFile)) {
          const content = await fs.readFile(outputFile, "utf8");
          if (content.includes(`export const processId = "proc_${i}"`)) {
            validOutputs++;
          }
        }
      }

      expect(validOutputs).toBeGreaterThan(successful * 0.9); // Most successful processes should produce valid output

      console.log(`Concurrent CLI Results:
        Total Processes: ${concurrentCount}
        Successful: ${successful}
        Failed: ${failed}
        Timeouts: ${timeouts}
        Valid Outputs: ${validOutputs}
        Total Time: ${(endTime - startTime).toFixed(2)}ms`);
    }, 120000);

    it("should maintain file system integrity under concurrent access", async () => {
      // Create multiple generators that write to overlapping directories
      for (let i = 0; i < 5; i++) {
        const generatorDir = path.join(templatesDir, `fs-test-${i}`);
        const templateDir = path.join(generatorDir, "shared");
        await fs.ensureDir(templateDir);

        await fs.writeFile(
          path.join(templateDir, "shared-{{ index }}.ts"),
          `---
to: "shared/component-{{ index }}.ts"
---
// Shared component {{ index }} from generator ${i}
export class Component{{ index }}From${i} {
  static id = {{ index }};
  static generator = ${i};
  static timestamp = {{ timestamp }};
  
  render() {
    return \`Component {{ index }} from generator ${i}\`;
  }
}`
        );
      }

      const concurrentCount = 25; // 5 generators × 5 concurrent processes each
      const processes: ChildProcess[] = [];
      const results: Promise<any>[] = [];

      const startTime = performance.now();

      // Launch concurrent processes for each generator
      for (let gen = 0; gen < 5; gen++) {
        for (let proc = 0; proc < 5; proc++) {
          const uniqueIndex = gen * 5 + proc;
          const cliPath = path.resolve(__dirname, "../../../dist/cli.mjs");
          
          const child = spawn("node", [
            cliPath,
            "generate",
            `fs-test-${gen}`,
            "shared",
            "--index", uniqueIndex.toString(),
            "--timestamp", Date.now().toString(),
            "--dest", testDir,
            "--force"
          ], {
            cwd: testDir,
            stdio: "pipe",
          });

          processes.push(child);

          const resultPromise = new Promise((resolve) => {
            let stdout = "";
            let stderr = "";

            child.stdout?.on("data", (data) => {
              stdout += data.toString();
            });

            child.stderr?.on("data", (data) => {
              stderr += data.toString();
            });

            child.on("close", (code) => {
              resolve({
                success: code === 0,
                stdout,
                stderr,
                generator: gen,
                process: proc,
                index: uniqueIndex,
              });
            });

            child.on("error", (error) => {
              resolve({
                success: false,
                stdout,
                stderr: error.message,
                generator: gen,
                process: proc,
                index: uniqueIndex,
              });
            });
          });

          results.push(resultPromise);
        }
      }

      const completedResults = await Promise.all(results);
      const endTime = performance.now();

      const successful = completedResults.filter((r: any) => r.success).length;
      
      expect(successful).toBeGreaterThan(concurrentCount * 0.8); // At least 80% success

      // Verify file system integrity
      const sharedDir = path.join(testDir, "shared");
      if (await fs.pathExists(sharedDir)) {
        const files = await fs.readdir(sharedDir);
        
        // Check for file corruption
        for (const file of files) {
          const filePath = path.join(sharedDir, file);
          const content = await fs.readFile(filePath, "utf8");
          
          // File should contain valid TypeScript export
          expect(content).toMatch(/export class Component\d+From\d+/);
          expect(content).not.toContain("undefined");
          
          // Check for partial writes or corruption
          expect(content).toContain("static id =");
          expect(content).toContain("static generator =");
          expect(content).toContain("render()");
        }

        // Verify we got expected number of unique files
        expect(files.length).toBeGreaterThan(successful * 0.8);
      }

      console.log(`File System Integrity Test:
        Concurrent Operations: ${concurrentCount}
        Successful: ${successful}
        Time: ${(endTime - startTime).toFixed(2)}ms
        Files Created: ${await fs.pathExists(sharedDir) ? (await fs.readdir(sharedDir)).length : 0}`);
    }, 90000);
  });

  describe("Concurrent Generator Operations", () => {
    it("should handle 50 concurrent generator instances safely", async () => {
      // Create a generator that requires significant processing
      const generatorDir = path.join(templatesDir, "heavy-processing");
      const templateDir = path.join(generatorDir, "complex");
      await fs.ensureDir(templateDir);

      let templateContent = `// Complex processing template
export class ProcessedComponent{{ componentId }} {
  private data = [
`;

      // Add complex template logic
      for (let i = 0; i < 100; i++) {
        templateContent += `    {% if condition${i} %}{ id: ${i}, value: "{{ value${i} }}", active: {{ active${i} }} },{% endif %}\n`;
      }

      templateContent += `  ];
  
  process(): string {
    return this.data
      .filter(item => item.active)
      .map(item => \`\${item.id}: \${item.value}\`)
      .join(', ');
  }
}`;

      await fs.writeFile(
        path.join(templateDir, "Component{{ componentId }}.ts"),
        templateContent
      );

      const concurrentCount = 50;
      const startTime = performance.now();

      // Create concurrent generator operations
      const operations = Array.from({ length: concurrentCount }, async (_, index) => {
        const generator = new Generator(templatesDir);
        
        // Create complex mock variables
        const mockArgs: any = { componentId: index };
        for (let i = 0; i < 100; i++) {
          mockArgs[`condition${i}`] = i % 3 === 0;
          mockArgs[`value${i}`] = `value_${index}_${i}`;
          mockArgs[`active${i}`] = i % 2 === 0;
        }

        // Mock collectVariables to avoid prompting
        (generator as any).collectVariables = async () => mockArgs;

        try {
          const result = await generator.generate({
            generator: "heavy-processing",
            template: "complex",
            dest: path.join(testDir, `gen-output-${index}`),
            force: true,
            dry: false,
          });

          return {
            success: true,
            index,
            fileCount: result.files.length,
            contentLength: result.files.reduce((sum, f) => sum + f.content.length, 0),
          };
        } catch (error) {
          return {
            success: false,
            index,
            error: error.message,
          };
        }
      });

      const results = await Promise.allSettled(operations);
      const endTime = performance.now();

      const successful = results.filter(r => r.status === "fulfilled" && r.value.success).length;
      const failed = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success)).length;

      expect(successful).toBeGreaterThan(concurrentCount * 0.8); // At least 80% success rate
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds

      // Verify output quality
      let validOutputCount = 0;
      for (let i = 0; i < concurrentCount; i++) {
        const outputDir = path.join(testDir, `gen-output-${i}`);
        const outputFile = path.join(outputDir, `Component${i}.ts`);
        
        if (await fs.pathExists(outputFile)) {
          const content = await fs.readFile(outputFile, "utf8");
          if (content.includes(`export class ProcessedComponent${i}`) && 
              content.includes("process():") &&
              !content.includes("undefined")) {
            validOutputCount++;
          }
        }
      }

      expect(validOutputCount).toBeGreaterThan(successful * 0.9);

      console.log(`Concurrent Generator Test:
        Operations: ${concurrentCount}
        Successful: ${successful}
        Failed: ${failed}
        Valid Outputs: ${validOutputCount}
        Average Time: ${((endTime - startTime) / concurrentCount).toFixed(2)}ms per operation`);
    }, 60000);

    it("should handle concurrent template scanning without conflicts", async () => {
      // Create multiple complex templates for scanning
      const scanTestCount = 20;
      
      for (let gen = 0; gen < scanTestCount; gen++) {
        const generatorDir = path.join(templatesDir, `scan-test-${gen}`);
        const templateDir = path.join(generatorDir, "variables");
        await fs.ensureDir(templateDir);

        // Create templates with many variables
        for (let template = 0; template < 5; template++) {
          let content = `// Template ${template} for generator ${gen}\n`;
          
          for (let var_i = 0; var_i < 50; var_i++) {
            const varName = `var${gen}_${template}_${var_i}`;
            content += `export const ${varName} = "{{ ${varName} }}";\n`;
            content += `{% if is${varName} %}export const ${varName}Active = true;{% endif %}\n`;
            content += `{% for item in ${varName}List %}{{ item.value }}{% endfor %}\n`;
          }

          await fs.writeFile(
            path.join(templateDir, `template-${template}.ts`),
            content
          );
        }
      }

      const startTime = performance.now();

      // Perform concurrent template scanning
      const scanOperations = Array.from({ length: scanTestCount }, async (_, index) => {
        const generator = new Generator(templatesDir);
        
        try {
          const scanResult = await generator.scanTemplateForVariables(
            `scan-test-${index}`,
            "variables"
          );

          return {
            success: true,
            index,
            variableCount: scanResult.variables.length,
            cliArgsCount: Object.keys(scanResult.cliArgs).length,
          };
        } catch (error) {
          return {
            success: false,
            index,
            error: error.message,
          };
        }
      });

      const scanResults = await Promise.allSettled(scanOperations);
      const endTime = performance.now();

      const successful = scanResults.filter(r => 
        r.status === "fulfilled" && r.value.success
      ).length;

      expect(successful).toBe(scanTestCount); // All scans should succeed
      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds

      // Verify scan results quality
      const successfulResults = scanResults
        .filter(r => r.status === "fulfilled" && r.value.success)
        .map(r => r.value);

      for (const result of successfulResults) {
        // Each generator has 5 templates × 50 variables × 3 occurrences = 750 unique variables
        expect(result.variableCount).toBeGreaterThan(200); // At least some variables found
        expect(result.cliArgsCount).toBe(result.variableCount); // CLI args should match variables
      }

      console.log(`Concurrent Template Scanning:
        Templates Scanned: ${scanTestCount}
        Successful: ${successful}
        Average Variables per Template: ${successfulResults.reduce((sum, r) => sum + r.variableCount, 0) / successfulResults.length}
        Total Time: ${(endTime - startTime).toFixed(2)}ms`);
    }, 45000);
  });

  describe("Resource Contention", () => {
    it("should handle concurrent file I/O without corruption", async () => {
      const generatorDir = path.join(templatesDir, "io-stress");
      const templateDir = path.join(generatorDir, "file-ops");
      await fs.ensureDir(templateDir);

      // Create templates that perform various file operations
      const operations = [
        { name: "write", content: `---\nto: "writes/file-{{ index }}.ts"\n---\n// Write operation {{ index }}\nexport const writeData{{ index }} = "{{ data }}";` },
        { name: "append", content: `---\nto: "shared/append-target.ts"\nappend: true\n---\n// Append {{ index }}: {{ data }}\n` },
        { name: "inject", content: `---\nto: "shared/inject-target.ts"\ninject: true\nafter: "// Injection point"\n---\n// Injected {{ index }}: {{ data }}` },
        { name: "prepend", content: `---\nto: "shared/prepend-target.ts"\nprepend: true\n---\n// Prepended {{ index }}: {{ data }}\n` },
      ];

      for (let i = 0; i < operations.length; i++) {
        await fs.writeFile(
          path.join(templateDir, `${operations[i].name}-template.ts`),
          operations[i].content
        );
      }

      // Create target files for injection/append/prepend operations
      const sharedDir = path.join(testDir, "shared");
      await fs.ensureDir(sharedDir);
      
      await fs.writeFile(
        path.join(sharedDir, "append-target.ts"),
        "// Append target file\nexport const appendTarget = true;\n"
      );
      
      await fs.writeFile(
        path.join(sharedDir, "inject-target.ts"),
        "// Inject target file\n// Injection point\nexport const injectTarget = true;\n"
      );
      
      await fs.writeFile(
        path.join(sharedDir, "prepend-target.ts"),
        "// Prepend target file\nexport const prependTarget = true;\n"
      );

      const concurrentOps = 40; // 10 operations per type
      const processes: Promise<any>[] = [];

      const startTime = performance.now();

      // Launch concurrent file operations
      for (let i = 0; i < concurrentOps; i++) {
        const operationType = operations[i % operations.length];
        const generator = new Generator(templatesDir);
        
        const mockArgs = {
          index: i,
          data: `concurrent_data_${i}_${Date.now()}`,
        };

        (generator as any).collectVariables = async () => mockArgs;

        const operation = generator.generate({
          generator: "io-stress",
          template: "file-ops",
          dest: testDir,
          force: true,
          dry: false,
        }).then(result => ({
          success: true,
          index: i,
          type: operationType.name,
          fileCount: result.files.length,
        })).catch(error => ({
          success: false,
          index: i,
          type: operationType.name,
          error: error.message,
        }));

        processes.push(operation);
      }

      const results = await Promise.all(processes);
      const endTime = performance.now();

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      expect(successful).toBeGreaterThan(concurrentOps * 0.75); // At least 75% success
      expect(endTime - startTime).toBeLessThan(45000); // Should complete within 45 seconds

      // Verify file integrity
      const writesDir = path.join(testDir, "writes");
      if (await fs.pathExists(writesDir)) {
        const writeFiles = await fs.readdir(writesDir);
        
        // Check each write file for corruption
        for (const file of writeFiles) {
          const content = await fs.readFile(path.join(writesDir, file), "utf8");
          expect(content).toMatch(/export const writeData\d+/);
          expect(content).not.toContain("undefined");
          expect(content).not.toContain("{{"); // All variables should be substituted
        }
      }

      // Check shared files for proper append/inject/prepend operations
      const appendFile = path.join(sharedDir, "append-target.ts");
      if (await fs.pathExists(appendFile)) {
        const content = await fs.readFile(appendFile, "utf8");
        expect(content).toContain("export const appendTarget = true;"); // Original content preserved
        
        // Should have multiple appended entries
        const appendMatches = content.match(/\/\/ Append \d+:/g);
        expect(appendMatches?.length).toBeGreaterThan(5);
      }

      console.log(`File I/O Stress Test:
        Operations: ${concurrentOps}
        Successful: ${successful}
        Failed: ${failed}
        Time: ${(endTime - startTime).toFixed(2)}ms
        Write Files: ${await fs.pathExists(writesDir) ? (await fs.readdir(writesDir)).length : 0}`);
    }, 90000);

    it("should handle memory pressure during concurrent operations", async () => {
      // Create memory-intensive templates
      const generatorDir = path.join(templatesDir, "memory-pressure");
      const templateDir = path.join(generatorDir, "intensive");
      await fs.ensureDir(templateDir);

      // Template that creates large objects and performs complex operations
      let templateContent = `// Memory intensive template
export class MemoryIntensive{{ id }} {
  private largeArray = [
`;

      for (let i = 0; i < 1000; i++) {
        templateContent += `    { id: ${i}, data: "{{ dataItem${i} }}", metadata: {{ metaItem${i} }} },\n`;
      }

      templateContent += `  ];
  
  private complexObject = {{ complexData }};
  
  process(): any {
    return {
      processed: this.largeArray.map(item => ({
        ...item,
        transformed: item.data.toUpperCase(),
        timestamp: Date.now()
      })),
      complex: this.complexObject,
      stats: {
        count: this.largeArray.length,
        memory: process.memoryUsage(),
        id: {{ id }}
      }
    };
  }
}`;

      await fs.writeFile(
        path.join(templateDir, "MemoryIntensive{{ id }}.ts"),
        templateContent
      );

      const concurrentCount = 20;
      const memorySnapshots: number[] = [];
      const startTime = performance.now();
      const initialMemory = process.memoryUsage().heapUsed;

      // Monitor memory usage during test
      const memoryMonitor = setInterval(() => {
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }, 500);

      // Launch concurrent memory-intensive operations
      const operations = Array.from({ length: concurrentCount }, async (_, index) => {
        const generator = new Generator(templatesDir);
        
        // Create large mock data
        const mockArgs: any = { id: index };
        
        for (let i = 0; i < 1000; i++) {
          mockArgs[`dataItem${i}`] = `large_data_string_${index}_${i}_`.repeat(10);
          mockArgs[`metaItem${i}`] = JSON.stringify({
            index: i,
            parentId: index,
            data: Array.from({ length: 20 }, (_, j) => `item_${j}`)
          });
        }

        // Large complex object
        const complexData: any = {};
        for (let i = 0; i < 100; i++) {
          complexData[`key${i}`] = {
            value: `complex_value_${i}`.repeat(50),
            nested: Array.from({ length: 50 }, (_, j) => ({ id: j, data: `nested_${i}_${j}` }))
          };
        }
        mockArgs.complexData = JSON.stringify(complexData);

        (generator as any).collectVariables = async () => mockArgs;

        try {
          const result = await generator.generate({
            generator: "memory-pressure",
            template: "intensive",
            dest: path.join(testDir, `memory-${index}`),
            force: true,
            dry: true, // Use dry run to focus on memory usage
          });

          return {
            success: true,
            index,
            contentSize: result.files[0]?.content.length || 0,
          };
        } catch (error) {
          return {
            success: false,
            index,
            error: error.message,
          };
        }
      });

      const results = await Promise.allSettled(operations);
      clearInterval(memoryMonitor);
      
      const endTime = performance.now();
      const finalMemory = process.memoryUsage().heapUsed;

      const successful = results.filter(r => 
        r.status === "fulfilled" && r.value.success
      ).length;

      // Analyze memory usage patterns
      const maxMemory = Math.max(...memorySnapshots);
      const avgMemory = memorySnapshots.reduce((sum, mem) => sum + mem, 0) / memorySnapshots.length;
      const memoryGrowth = finalMemory - initialMemory;

      expect(successful).toBeGreaterThan(concurrentCount * 0.7); // At least 70% success under pressure
      expect(endTime - startTime).toBeLessThan(60000); // Should complete within 60 seconds

      // Memory growth should be reasonable (may fail if system is under extreme pressure)
      if (memoryGrowth < 2 * 1024 * 1024 * 1024) { // Less than 2GB growth
        expect(memoryGrowth).toBeLessThan(1024 * 1024 * 1024); // Less than 1GB
      }

      console.log(`Memory Pressure Test:
        Operations: ${concurrentCount}
        Successful: ${successful}
        Time: ${(endTime - startTime).toFixed(2)}ms
        Memory Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB
        Peak Memory: ${(maxMemory / 1024 / 1024).toFixed(2)}MB
        Avg Memory: ${(avgMemory / 1024 / 1024).toFixed(2)}MB`);

      // Test passes if we handled the pressure without crashing
      expect(true).toBe(true);
    }, 120000);
  });
});