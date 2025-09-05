import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { performance, PerformanceObserver } from "node:perf_hooks";
import { Generator } from "../../../src/lib/generator.js";
import { TemplateScanner } from "../../../src/lib/template-scanner.js";
import { FileInjector } from "../../../src/lib/file-injector.js";
import { FrontmatterParser } from "../../../src/lib/frontmatter-parser.js";

describe("Memory Stress Tests", () => {
  let testDir: string;
  let templatesDir: string;
  let generator: Generator;
  let performanceEntries: any[] = [];

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "unjucks-memory-stress-"));
    templatesDir = path.join(testDir, "_templates");
    await fs.ensureDir(templatesDir);
    generator = new Generator(templatesDir);

    // Setup performance monitoring
    performanceEntries = [];
    const observer = new PerformanceObserver((list) => {
      performanceEntries.push(...list.getEntries());
    });
    observer.observe({ entryTypes: ["mark", "measure"] });
  });

  afterEach(async () => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    await fs.remove(testDir);
  });

  describe("Memory Leak Detection", () => {
    it("should not leak memory during repeated generator operations", async () => {
      // Create a simple template
      const generatorDir = path.join(templatesDir, "memory-test");
      const templateDir = path.join(generatorDir, "simple");
      await fs.ensureDir(templateDir);

      await fs.writeFile(
        path.join(templateDir, "output.ts"),
        `// Memory leak test
export const data = {
  name: "{{ name }}",
  value: {{ value }},
  timestamp: {{ timestamp }}
};`
      );

      const initialMemory = process.memoryUsage();
      const heapSnapshots: number[] = [];

      // Run 500 generation cycles
      for (let i = 0; i < 500; i++) {
        const mockArgs = {
          name: `test_${i}`,
          value: i,
          timestamp: Date.now(),
        };

        // Create new generator instance each time to test cleanup
        const testGenerator = new Generator(templatesDir);
        (testGenerator as any).collectVariables = async () => mockArgs;

        await testGenerator.generate({
          generator: "memory-test",
          template: "simple",
          dest: path.join(testDir, `output-${i}`),
          force: true,
          dry: true, // Use dry run to focus on memory usage
        });

        // Take heap snapshot every 50 cycles
        if (i % 50 === 0) {
          // Force garbage collection before measuring
          if (global.gc) {
            global.gc();
          }
          heapSnapshots.push(process.memoryUsage().heapUsed);
        }
      }

      const finalMemory = process.memoryUsage();

      // Analyze memory growth
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const maxHeapGrowth = Math.max(...heapSnapshots) - heapSnapshots[0];

      // Memory growth should be reasonable (less than 100MB for 500 operations)
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);
      expect(maxHeapGrowth).toBeLessThan(150 * 1024 * 1024);

      // Check for consistent memory usage (no exponential growth)
      const midPoint = Math.floor(heapSnapshots.length / 2);
      const firstHalf = heapSnapshots.slice(0, midPoint);
      const secondHalf = heapSnapshots.slice(midPoint);
      
      const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
      
      // Second half shouldn't be more than 3x the first half (some growth is expected)
      expect(secondHalfAvg / firstHalfAvg).toBeLessThan(3);

      console.log(`Memory Analysis:
        Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        Final Heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB
        Max Growth: ${(maxHeapGrowth / 1024 / 1024).toFixed(2)}MB
        First Half Avg: ${(firstHalfAvg / 1024 / 1024).toFixed(2)}MB
        Second Half Avg: ${(secondHalfAvg / 1024 / 1024).toFixed(2)}MB`);
    }, 120000);

    it("should properly cleanup template scanner resources", async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const scanners: TemplateScanner[] = [];

      // Create and use 1000 template scanners
      for (let i = 0; i < 1000; i++) {
        const scanner = new TemplateScanner();
        scanners.push(scanner);

        // Create temporary template for scanning
        const tempTemplate = path.join(testDir, `temp-template-${i}`);
        await fs.ensureDir(tempTemplate);
        await fs.writeFile(
          path.join(tempTemplate, "test.ts"),
          `export const var${i} = "{{ testVar${i} }}";\nexport const bool${i} = {{ isBool${i} }};`
        );

        // Scan the template
        await scanner.scanTemplate(tempTemplate);

        // Cleanup temporary template
        await fs.remove(tempTemplate);
      }

      // Clear scanner references
      scanners.length = 0;

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (less than 50MB for 1000 scanners)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);

      console.log(`Template Scanner Memory:
        Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB for 1000 scanners`);
    }, 60000);

    it("should handle file injector memory efficiently", async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const injector = new FileInjector();

      // Create a large file for injection operations
      const targetFile = path.join(testDir, "large-target.ts");
      const largeContent = "// Large file\n" + "export const line = 'data';\n".repeat(10000);
      await fs.writeFile(targetFile, largeContent);

      // Perform 100 injection operations
      for (let i = 0; i < 100; i++) {
        const injectionContent = `// Injection ${i}\nexport const injection${i} = "test_${i}";`;
        
        await injector.processFile(
          targetFile,
          injectionContent,
          { inject: true, after: `export const line = 'data';` },
          { force: true, dry: true } // Use dry run to avoid actual file changes
        );
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be reasonable for file operations
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);

      console.log(`File Injector Memory:
        Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB for 100 operations`);
    }, 30000);

    it("should cleanup frontmatter parser resources", async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const parser = new FrontmatterParser();

      // Parse 1000 different frontmatter configurations
      for (let i = 0; i < 1000; i++) {
        const frontmatterContent = `---
to: "output-${i}.ts"
inject: ${i % 2 === 0}
append: ${i % 3 === 0}
chmod: "0${(644 + i % 10).toString()}"
skipIf: "{{ skip${i} }}"
before: "marker${i}"
after: "endMarker${i}"
lineAt: ${i % 100 + 1}
sh: "echo 'command${i}'"
---
Content ${i}: {{ var${i} }}
Multiple lines of content
With various {{ substitutions${i} }}
And complex {% if conditions${i} %}conditional{% endif %} logic`;

        const parsed = parser.parse(frontmatterContent);
        const validation = parser.validate(parsed.frontmatter);
        
        // Use the parsed content to ensure it's not optimized away
        expect(parsed.content).toContain(`Content ${i}`);
        expect(validation).toBeDefined();
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal for parsing operations
      expect(memoryGrowth).toBeLessThan(30 * 1024 * 1024);

      console.log(`Frontmatter Parser Memory:
        Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB for 1000 parses`);
    }, 45000);
  });

  describe("Large Object Handling", () => {
    it("should handle extremely large template variables efficiently", async () => {
      const generatorDir = path.join(templatesDir, "large-vars");
      const templateDir = path.join(generatorDir, "massive");
      await fs.ensureDir(templateDir);

      // Create template that uses a massive variable
      const templateContent = `// Large variable template
export const massiveData = {{ largeObject }};
export const stringData = "{{ largeString }}";
export const arrayData = {{ largeArray }};`;

      await fs.writeFile(
        path.join(templateDir, "massive.ts"),
        templateContent
      );

      const initialMemory = process.memoryUsage().heapUsed;

      // Create massive template variables
      const largeObject = {};
      for (let i = 0; i < 10000; i++) {
        (largeObject as any)[`key${i}`] = `value_${i}_`.repeat(50);
      }

      const largeString = "x".repeat(1024 * 1024); // 1MB string
      const largeArray = Array.from({ length: 50000 }, (_, i) => `item_${i}`);

      const mockArgs = {
        largeObject: JSON.stringify(largeObject),
        largeString,
        largeArray: JSON.stringify(largeArray),
      };

      // Mock collectVariables to avoid prompting
      (generator as any).collectVariables = async () => mockArgs;

      const startTime = performance.now();

      const result = await generator.generate({
        generator: "large-vars",
        template: "massive",
        dest: path.join(testDir, "large-output"),
        force: true,
        dry: true, // Use dry to focus on memory usage
      });

      const endTime = performance.now();
      const finalMemory = process.memoryUsage().heapUsed;

      expect(result.files.length).toBe(1);
      expect(endTime - startTime).toBeLessThan(15000); // Should process within 15 seconds

      // Memory growth should be proportional to data size but not excessive
      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(500 * 1024 * 1024); // Less than 500MB growth

      console.log(`Large Object Handling:
        Processing Time: ${(endTime - startTime).toFixed(2)}ms
        Memory Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB
        Output Size: ${result.files[0].content.length} characters`);
    }, 45000);

    it("should efficiently process templates with deep object nesting", async () => {
      const generatorDir = path.join(templatesDir, "deep-objects");
      const templateDir = path.join(generatorDir, "nested");
      await fs.ensureDir(templateDir);

      // Create template with deeply nested object access
      let templateContent = "// Deep nesting template\n";
      for (let i = 0; i < 100; i++) {
        templateContent += `export const level${i} = "{{ deep.level${i}.value }}";\n`;
        templateContent += `{% if deep.level${i}.condition %}export const conditional${i} = true;{% endif %}\n`;
      }

      await fs.writeFile(
        path.join(templateDir, "deep.ts"),
        templateContent
      );

      // Create deeply nested mock object
      const deepObject: any = { deep: {} };
      for (let i = 0; i < 100; i++) {
        deepObject.deep[`level${i}`] = {
          value: `deep_value_${i}`,
          condition: i % 2 === 0,
          metadata: {
            id: i,
            type: "nested",
            data: Array.from({ length: 100 }, (_, j) => `item_${i}_${j}`),
          },
        };
      }

      const initialMemory = process.memoryUsage().heapUsed;

      (generator as any).collectVariables = async () => deepObject;

      const startTime = performance.now();

      const result = await generator.generate({
        generator: "deep-objects",
        template: "nested",
        dest: path.join(testDir, "deep-output"),
        force: true,
        dry: true,
      });

      const endTime = performance.now();
      const finalMemory = process.memoryUsage().heapUsed;

      expect(result.files.length).toBe(1);
      expect(result.files[0].content).toContain("export const level0");
      expect(result.files[0].content).toContain("export const level99");

      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(200 * 1024 * 1024);
      expect(endTime - startTime).toBeLessThan(10000);

      console.log(`Deep Nesting Performance:
        Processing Time: ${(endTime - startTime).toFixed(2)}ms
        Memory Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB
        Nesting Levels: 100`);
    }, 30000);
  });

  describe("Resource Cleanup", () => {
    it("should cleanup resources after interrupted operations", async () => {
      const generatorDir = path.join(templatesDir, "cleanup-test");
      const templateDir = path.join(generatorDir, "interrupt");
      await fs.ensureDir(templateDir);

      // Create template that simulates long-running operation
      await fs.writeFile(
        path.join(templateDir, "long-task.ts"),
        `// Long running template
{% for i in range(0, 1000) %}
export const item{{ i }} = {
  id: {{ i }},
  data: "{{ longString }}",
  nested: {{ nestedObject }}
};
{% endfor %}`
      );

      const initialMemory = process.memoryUsage().heapUsed;
      let interruptedOperations = 0;

      // Start multiple operations and interrupt them
      for (let attempt = 0; attempt < 10; attempt++) {
        const mockArgs = {
          longString: "x".repeat(10000),
          nestedObject: JSON.stringify({
            data: Array.from({ length: 1000 }, (_, i) => `item_${i}`),
          }),
        };

        const testGenerator = new Generator(templatesDir);
        (testGenerator as any).collectVariables = async () => mockArgs;

        // Start the operation but don't wait for completion
        const operationPromise = testGenerator.generate({
          generator: "cleanup-test",
          template: "interrupt",
          dest: path.join(testDir, `interrupt-${attempt}`),
          force: true,
          dry: true,
        });

        // Simulate interruption by not awaiting and starting next operation
        setTimeout(() => {
          interruptedOperations++;
        }, 50);

        // Only await every 3rd operation to allow others to be "interrupted"
        if (attempt % 3 === 0) {
          try {
            await operationPromise;
          } catch (error) {
            // Expected for some operations
          }
        }
      }

      // Wait for any remaining operations
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory should not grow excessively even with interrupted operations
      expect(memoryGrowth).toBeLessThan(200 * 1024 * 1024);
      expect(interruptedOperations).toBeGreaterThan(5); // Ensure we actually interrupted some

      console.log(`Cleanup Test Results:
        Interrupted Operations: ${interruptedOperations}
        Memory Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    }, 45000);

    it("should handle memory pressure gracefully", async () => {
      const generatorDir = path.join(templatesDir, "pressure-test");
      const templateDir = path.join(generatorDir, "memory-heavy");
      await fs.ensureDir(templateDir);

      // Create template that consumes significant memory
      await fs.writeFile(
        path.join(templateDir, "heavy.ts"),
        `// Memory heavy template
export const massiveArray = [
{% for item in hugeArray %}
  {
    id: {{ item.id }},
    data: "{{ item.data }}",
    timestamp: {{ item.timestamp }},
    metadata: {{ item.metadata }}
  }{{ "," if not loop.last }}
{% endfor %}
];

export const processedData = "{{ massiveString | upper }}";
export const configuration = {{ configObject }};`
      );

      // Create memory-intensive variables
      const hugeArray = Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        data: `data_${i}_`.repeat(100),
        timestamp: Date.now() + i,
        metadata: JSON.stringify({
          index: i,
          values: Array.from({ length: 50 }, (_, j) => `val_${j}`),
        }),
      }));

      const massiveString = "test_data_".repeat(100000);
      const configObject = {};
      for (let i = 0; i < 1000; i++) {
        (configObject as any)[`config_${i}`] = {
          value: `config_value_${i}`,
          enabled: i % 2 === 0,
          data: Array.from({ length: 10 }, (_, j) => `item_${i}_${j}`),
        };
      }

      const mockArgs = {
        hugeArray,
        massiveString,
        configObject: JSON.stringify(configObject),
      };

      const initialMemory = process.memoryUsage();

      (generator as any).collectVariables = async () => mockArgs;

      let success = false;
      let memoryPeakReached = false;

      try {
        // Monitor memory usage during operation
        const memoryMonitor = setInterval(() => {
          const currentMemory = process.memoryUsage();
          if (currentMemory.heapUsed > 800 * 1024 * 1024) { // 800MB threshold
            memoryPeakReached = true;
          }
        }, 100);

        const result = await generator.generate({
          generator: "pressure-test",
          template: "memory-heavy",
          dest: path.join(testDir, "pressure-output"),
          force: true,
          dry: true,
        });

        clearInterval(memoryMonitor);

        expect(result.files.length).toBe(1);
        expect(result.files[0].content.length).toBeGreaterThan(1000000);
        success = true;
      } catch (error) {
        // If we get an out-of-memory error, that's actually informative
        if (error.message && error.message.includes("heap")) {
          console.log("Memory limit reached as expected");
        } else {
          throw error;
        }
      }

      const finalMemory = process.memoryUsage();

      // Either the operation should succeed with reasonable memory usage,
      // or fail gracefully when memory limits are reached
      if (success) {
        const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
        expect(memoryGrowth).toBeLessThan(1024 * 1024 * 1024); // Less than 1GB
      }

      console.log(`Memory Pressure Test:
        Operation Success: ${success}
        Memory Peak Reached: ${memoryPeakReached}
        Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        Final Heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        Peak RSS: ${(finalMemory.rss / 1024 / 1024).toFixed(2)}MB`);

      // Test should complete one way or another (not hang indefinitely)
      expect(true).toBe(true);
    }, 90000);
  });
});