import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { Generator, TemplateFile } from "../../../src/lib/generator.js";

describe("Generator Stress Tests", () => {
  let testDir: string;
  let templatesDir: string;
  let generator: Generator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "unjucks-generator-stress-"));
    templatesDir = path.join(testDir, "_templates");
    await fs.ensureDir(templatesDir);
    generator = new Generator(templatesDir);
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe("High-Volume Template Processing", () => {
    it("should process 1000+ template files efficiently", async () => {
      const generatorDir = path.join(templatesDir, "bulk-processor");
      const templateDir = path.join(generatorDir, "mass-files");
      await fs.ensureDir(templateDir);

      // Create 1000 template files
      const fileCount = 1000;
      for (let i = 0; i < fileCount; i++) {
        const content = `// File ${i}
export class Component${i} {
  constructor(public name: string = "{{ componentName }}_${i}") {}
  
  render(): string {
    return \`<div class="{{ cssClass }}">\${this.name}</div>\`;
  }
  
  static id = ${i};
  static type = "{{ componentType }}";
}`;

        await fs.writeFile(
          path.join(templateDir, `component-${i.toString().padStart(4, "0")}.ts`),
          content
        );
      }

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      // Process all templates
      const result = await generator.generate({
        generator: "bulk-processor",
        template: "mass-files",
        dest: path.join(testDir, "output"),
        force: true,
        dry: false,
      });

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      expect(result.files.length).toBe(fileCount);
      expect(endTime - startTime).toBeLessThan(30000); // Should process within 30 seconds

      // Verify all files were processed correctly
      for (let i = 0; i < Math.min(10, fileCount); i++) {
        const file = result.files[i];
        expect(file.content).toContain(`export class Component${i}`);
      }

      // Memory should not exceed reasonable limits
      const memoryIncrease = endMemory - startMemory;
      expect(memoryIncrease).toBeLessThan(1024 * 1024 * 1024); // Less than 1GB
    }, 60000);

    it("should handle deep directory structures under stress", async () => {
      const generatorDir = path.join(templatesDir, "deep-structure");
      const templateDir = path.join(generatorDir, "nested");
      await fs.ensureDir(templateDir);

      // Create deeply nested structure (10 levels deep, 5 files per level)
      const createNestedStructure = async (currentDir: string, depth: number, maxDepth: number) => {
        if (depth >= maxDepth) return;

        for (let i = 0; i < 5; i++) {
          const fileName = `file-${depth}-${i}.ts`;
          const content = `// Depth ${depth}, File ${i}
export const config${depth}_${i} = {
  depth: ${depth},
  index: ${i},
  name: "{{ baseName }}_${depth}_${i}",
  path: "{{ outputPath }}/level-${depth}",
  metadata: {
    created: "{{ timestamp }}",
    type: "{{ fileType }}"
  }
};`;

          await fs.writeFile(path.join(currentDir, fileName), content);
        }

        // Create subdirectory for next level
        if (depth < maxDepth - 1) {
          const nextDir = path.join(currentDir, `level-${depth + 1}`);
          await fs.ensureDir(nextDir);
          await createNestedStructure(nextDir, depth + 1, maxDepth);
        }
      };

      await createNestedStructure(templateDir, 0, 10);

      const startTime = performance.now();

      const result = await generator.generate({
        generator: "deep-structure",
        template: "nested",
        dest: path.join(testDir, "deep-output"),
        force: true,
        dry: false,
      });

      const endTime = performance.now();

      expect(result.files.length).toBe(50); // 10 levels * 5 files per level
      expect(endTime - startTime).toBeLessThan(15000); // Should process within 15 seconds

      // Verify nested structure was preserved
      const outputDir = path.join(testDir, "deep-output");
      const checkNestedOutput = async (dir: string, depth: number) => {
        if (depth >= 10) return;

        for (let i = 0; i < 5; i++) {
          const filePath = path.join(dir, `file-${depth}-${i}.ts`);
          expect(await fs.pathExists(filePath)).toBe(true);
        }

        if (depth < 9) {
          const nextDir = path.join(dir, `level-${depth + 1}`);
          await checkNestedOutput(nextDir, depth + 1);
        }
      };

      await checkNestedOutput(outputDir, 0);
    }, 30000);
  });

  describe("Memory Intensive Operations", () => {
    it("should handle templates with massive variable substitution", async () => {
      const generatorDir = path.join(templatesDir, "variable-heavy");
      const templateDir = path.join(generatorDir, "substitution");
      await fs.ensureDir(templateDir);

      // Create template with 1000 different variable substitutions
      const variables: string[] = [];
      let templateContent = "// Template with massive variable substitution\n";
      
      for (let i = 0; i < 1000; i++) {
        const varName = `var${i}`;
        variables.push(varName);
        templateContent += `export const ${varName} = "{{ ${varName} }}";\n`;
        templateContent += `export const ${varName}Upper = "{{ ${varName} | upper }}";\n`;
        templateContent += `export const ${varName}Lower = "{{ ${varName} | lower }}";\n`;
      }

      await fs.writeFile(
        path.join(templateDir, "variables.ts"),
        templateContent
      );

      // Create a mock args object with values for all variables
      const mockArgs: any = {};
      for (let i = 0; i < 1000; i++) {
        mockArgs[`var${i}`] = `value_${i}`;
      }

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      // Mock the collectVariables method to avoid prompting
      const originalGenerate = generator.generate.bind(generator);
      (generator as any).collectVariables = async () => mockArgs;

      const result = await generator.generate({
        generator: "variable-heavy",
        template: "substitution",
        dest: path.join(testDir, "var-output"),
        force: true,
        dry: false,
      });

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      expect(result.files.length).toBe(1);
      expect(endTime - startTime).toBeLessThan(10000); // Should process within 10 seconds

      // Verify variable substitutions worked
      const outputContent = result.files[0].content;
      expect(outputContent).toContain('export const var0 = "value_0";');
      expect(outputContent).toContain('export const var999 = "value_999";');
      expect(outputContent).toContain('export const var0Upper = "VALUE_0";');

      // Memory should not exceed reasonable limits
      const memoryIncrease = endMemory - startMemory;
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // Less than 500MB
    }, 30000);

    it("should process templates with complex conditional logic efficiently", async () => {
      const generatorDir = path.join(templatesDir, "complex-logic");
      const templateDir = path.join(generatorDir, "conditionals");
      await fs.ensureDir(templateDir);

      // Create template with complex nested conditionals
      let templateContent = `// Complex conditional logic template
export class ConditionalRenderer {
`;

      for (let i = 0; i < 100; i++) {
        templateContent += `
  {% if condition${i} %}
  method${i}() {
    {% if nested${i} %}
      {% for item in items${i} %}
        {% if item.active %}
          console.log("{{ prefix }}_${i}_" + {{ item }});
        {% endif %}
      {% endfor %}
    {% else %}
      return "{{ defaultValue${i} }}";
    {% endif %}
  }
  {% endif %}`;
      }

      templateContent += "\n}";

      await fs.writeFile(
        path.join(templateDir, "complex.ts"),
        templateContent
      );

      // Create mock variables for complex conditionals
      const mockArgs: any = {
        prefix: "test",
      };

      for (let i = 0; i < 100; i++) {
        mockArgs[`condition${i}`] = i % 3 === 0; // Every third condition is true
        mockArgs[`nested${i}`] = i % 2 === 0; // Every other nested condition is true
        mockArgs[`items${i}`] = [`item_${i}_1`, `item_${i}_2`];
        mockArgs[`defaultValue${i}`] = `default_${i}`;
      }

      const startTime = performance.now();

      // Mock the collectVariables method
      (generator as any).collectVariables = async () => mockArgs;

      const result = await generator.generate({
        generator: "complex-logic",
        template: "conditionals",
        dest: path.join(testDir, "logic-output"),
        force: true,
        dry: false,
      });

      const endTime = performance.now();

      expect(result.files.length).toBe(1);
      expect(endTime - startTime).toBeLessThan(15000); // Should process within 15 seconds

      // Verify conditional logic was processed correctly
      const outputContent = result.files[0].content;
      expect(outputContent).toContain("export class ConditionalRenderer");
      
      // Check some of the generated methods
      expect(outputContent).toContain("method0()"); // condition0 should be true (0 % 3 === 0)
      expect(outputContent).not.toContain("method1()"); // condition1 should be false (1 % 3 !== 0)
    }, 30000);
  });

  describe("File System Stress", () => {
    it("should handle simultaneous read/write operations gracefully", async () => {
      const generatorDir = path.join(templatesDir, "concurrent-io");
      const templateDir = path.join(generatorDir, "parallel");
      await fs.ensureDir(templateDir);

      // Create multiple templates that will write to different locations
      for (let i = 0; i < 50; i++) {
        const content = `---
to: "output-${i}/file-{{ index }}.ts"
---
// Concurrent file ${i}
export const file${i} = {
  id: ${i},
  index: "{{ index }}",
  timestamp: {{ timestamp }},
  concurrent: true
};`;

        await fs.writeFile(
          path.join(templateDir, `template-${i}.ts`),
          content
        );
      }

      const startTime = performance.now();

      // Launch multiple concurrent generation operations
      const promises = [];
      for (let i = 0; i < 20; i++) {
        const mockArgs = {
          index: i,
          timestamp: Date.now() + i,
        };

        // Create a new generator instance for each concurrent operation
        const concurrentGenerator = new Generator(templatesDir);
        (concurrentGenerator as any).collectVariables = async () => mockArgs;

        promises.push(
          concurrentGenerator.generate({
            generator: "concurrent-io",
            template: "parallel",
            dest: path.join(testDir, `concurrent-${i}`),
            force: true,
            dry: false,
          })
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = performance.now();

      // Count successful operations
      const successful = results.filter(r => r.status === "fulfilled").length;
      expect(successful).toBeGreaterThan(15); // At least 75% success rate
      expect(endTime - startTime).toBeLessThan(20000); // Should complete within 20 seconds

      // Verify files were created without corruption
      for (let i = 0; i < Math.min(5, successful); i++) {
        const outputDir = path.join(testDir, `concurrent-${i}`);
        if (await fs.pathExists(outputDir)) {
          const subdirs = await fs.readdir(outputDir);
          expect(subdirs.length).toBeGreaterThan(0);
        }
      }
    }, 45000);

    it("should recover gracefully from filesystem errors under load", async () => {
      const generatorDir = path.join(templatesDir, "error-recovery");
      const templateDir = path.join(generatorDir, "resilient");
      await fs.ensureDir(templateDir);

      // Create templates that attempt to write to various problematic locations
      const problematicPaths = [
        "/root/unauthorized.ts", // Permission denied
        "invalid|file:name.ts", // Invalid filename on Windows
        "too-long-" + "x".repeat(300) + ".ts", // Filename too long
        "../../../etc/passwd", // Path traversal attempt
        "normal-file.ts", // This should succeed
      ];

      for (let i = 0; i < problematicPaths.length; i++) {
        const content = `---
to: "${problematicPaths[i]}"
---
// Potentially problematic file ${i}
export const file${i} = "{{ content }}";`;

        await fs.writeFile(
          path.join(templateDir, `template-${i}.ts`),
          content
        );
      }

      const startTime = performance.now();

      // Try to generate files that will cause various errors
      const mockArgs = { content: "test_content" };
      (generator as any).collectVariables = async () => mockArgs;

      let result;
      try {
        result = await generator.generate({
          generator: "error-recovery",
          template: "resilient",
          dest: path.join(testDir, "error-output"),
          force: true,
          dry: false,
        });
      } catch (error) {
        // Generator should handle errors gracefully, not throw
        expect(error).toBeUndefined();
      }

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds

      // At least some files should be processed (the valid ones)
      if (result) {
        expect(result.files.length).toBe(problematicPaths.length);
        
        // Check that the normal file was created successfully
        const normalFile = result.files.find(f => f.path.includes("normal-file.ts"));
        expect(normalFile).toBeDefined();
        expect(normalFile?.injectionResult?.success).toBe(true);
      }

      // Verify the generator is still functional after errors
      const healthCheck = await generator.listGenerators();
      expect(Array.isArray(healthCheck)).toBe(true);
    }, 30000);
  });

  describe("Performance Monitoring", () => {
    it("should maintain consistent performance across multiple operations", async () => {
      // Create a standard template for performance testing
      const generatorDir = path.join(templatesDir, "perf-test");
      const templateDir = path.join(generatorDir, "standard");
      await fs.ensureDir(templateDir);

      const templateContent = `// Performance test template
export class {{ className }} {
  constructor(
    public name: string = "{{ instanceName }}",
    public value: number = {{ numericValue }}
  ) {}

  process(): string {
    return \`Processing \${this.name} with value \${this.value}\`;
  }

  {% if withMethods %}
  additionalMethod(): void {
    console.log("{{ logMessage }}");
  }
  {% endif %}
}`;

      await fs.writeFile(
        path.join(templateDir, "{{ className }}.ts"),
        templateContent
      );

      // Run the same operation 100 times and measure consistency
      const timings: number[] = [];
      const memoryUsages: number[] = [];

      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        const startMemory = process.memoryUsage().heapUsed;

        const mockArgs = {
          className: `PerfTest${i}`,
          instanceName: `instance_${i}`,
          numericValue: i,
          withMethods: i % 2 === 0,
          logMessage: `Log message ${i}`,
        };

        // Create new generator to avoid state accumulation
        const perfGenerator = new Generator(templatesDir);
        (perfGenerator as any).collectVariables = async () => mockArgs;

        await perfGenerator.generate({
          generator: "perf-test",
          template: "standard",
          dest: path.join(testDir, `perf-${i}`),
          force: true,
          dry: true, // Use dry run to avoid filesystem overhead
        });

        const endTime = performance.now();
        const endMemory = process.memoryUsage().heapUsed;

        timings.push(endTime - startTime);
        memoryUsages.push(endMemory - startMemory);
      }

      // Analyze performance consistency
      const avgTiming = timings.reduce((sum, t) => sum + t, 0) / timings.length;
      const maxTiming = Math.max(...timings);
      const minTiming = Math.min(...timings);

      const avgMemory = memoryUsages.reduce((sum, m) => sum + m, 0) / memoryUsages.length;
      const maxMemory = Math.max(...memoryUsages);

      // Performance should be consistent
      expect(avgTiming).toBeLessThan(100); // Average under 100ms
      expect(maxTiming).toBeLessThan(500); // No single operation over 500ms
      expect(maxTiming / minTiming).toBeLessThan(10); // Max time shouldn't be more than 10x min

      // Memory usage should be reasonable
      expect(avgMemory).toBeLessThan(10 * 1024 * 1024); // Average under 10MB
      expect(maxMemory).toBeLessThan(50 * 1024 * 1024); // Max under 50MB

      console.log(`Performance Stats:
        Avg Time: ${avgTiming.toFixed(2)}ms
        Min Time: ${minTiming.toFixed(2)}ms
        Max Time: ${maxTiming.toFixed(2)}ms
        Avg Memory: ${(avgMemory / 1024 / 1024).toFixed(2)}MB
        Max Memory: ${(maxMemory / 1024 / 1024).toFixed(2)}MB`);
    }, 60000);
  });
});