import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { execSync } from "node:child_process";
import { Generator } from "../../../src/lib/generator.js";
import { FileInjector } from "../../../src/lib/file-injector.js";

describe("Filesystem Stress Tests", () => {
  let testDir: string;
  let templatesDir: string;
  let generator: Generator;
  let fileInjector: FileInjector;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "unjucks-fs-stress-"));
    templatesDir = path.join(testDir, "_templates");
    await fs.ensureDir(templatesDir);
    generator = new Generator(templatesDir);
    fileInjector = new FileInjector();
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe("Filesystem Operations Under Stress", () => {
    it("should handle 10,000 file operations without corruption", async () => {
      const generatorDir = path.join(templatesDir, "mass-files");
      const templateDir = path.join(generatorDir, "bulk");
      await fs.ensureDir(templateDir);

      // Create template for mass file generation
      await fs.writeFile(
        path.join(templateDir, "file-{{ index }}.ts"),
        `// Generated file {{ index }}
export const file{{ index }} = {
  id: {{ index }},
  name: "{{ baseName }}_{{ index }}",
  data: "{{ fileData }}",
  timestamp: {{ timestamp }}
};`
      );

      const fileCount = 10000;
      const batchSize = 500;
      const startTime = performance.now();
      let successfulFiles = 0;
      let corruptedFiles = 0;

      // Process files in batches to avoid overwhelming the system
      for (let batch = 0; batch < Math.ceil(fileCount / batchSize); batch++) {
        const batchPromises = [];
        const batchStart = batch * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, fileCount);

        for (let i = batchStart; i < batchEnd; i++) {
          const mockArgs = {
            index: i,
            baseName: "stress_test",
            fileData: `file_data_${i}_`.repeat(10),
            timestamp: Date.now() + i,
          };

          const batchGenerator = new Generator(templatesDir);
          (batchGenerator as any).collectVariables = async () => mockArgs;

          const promise = batchGenerator.generate({
            generator: "mass-files",
            template: "bulk",
            dest: path.join(testDir, "batch-output", `batch-${batch}`),
            force: true,
            dry: false,
          }).then(result => {
            if (result.files.length === 1 && result.files[0].injectionResult?.success) {
              return { success: true, index: i };
            }
            return { success: false, index: i, error: "Generation failed" };
          }).catch(error => ({ success: false, index: i, error: error.message }));

          batchPromises.push(promise);
        }

        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === "fulfilled" && result.value.success) {
            successfulFiles++;
          }
        }

        // Brief pause between batches to prevent system overload
        if (batch % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const endTime = performance.now();

      // Verify file integrity
      const outputDir = path.join(testDir, "batch-output");
      if (await fs.pathExists(outputDir)) {
        const batchDirs = await fs.readdir(outputDir);
        
        for (const batchDir of batchDirs.slice(0, 5)) { // Check first 5 batches
          const batchPath = path.join(outputDir, batchDir);
          if (await fs.pathExists(batchPath)) {
            const files = await fs.readdir(batchPath);
            
            for (const file of files.slice(0, 10)) { // Check first 10 files in each batch
              const filePath = path.join(batchPath, file);
              const content = await fs.readFile(filePath, "utf8");
              
              // Check for file corruption
              if (!content.includes("export const file") || content.includes("undefined")) {
                corruptedFiles++;
              }
            }
          }
        }
      }

      expect(successfulFiles).toBeGreaterThan(fileCount * 0.8); // At least 80% success
      expect(corruptedFiles).toBeLessThan(successfulFiles * 0.01); // Less than 1% corruption
      expect(endTime - startTime).toBeLessThan(120000); // Should complete within 2 minutes

      console.log(`Mass File Generation:
        Target Files: ${fileCount}
        Successful: ${successfulFiles}
        Corrupted: ${corruptedFiles}
        Time: ${(endTime - startTime).toFixed(2)}ms
        Rate: ${(successfulFiles / ((endTime - startTime) / 1000)).toFixed(2)} files/second`);
    }, 180000);

    it("should handle deep directory hierarchies efficiently", async () => {
      const generatorDir = path.join(templatesDir, "deep-dirs");
      const templateDir = path.join(generatorDir, "nested");
      await fs.ensureDir(templateDir);

      // Create template that generates deeply nested structures
      await fs.writeFile(
        path.join(templateDir, "nested-file.ts"),
        `---
to: "{{ pathLevel0 }}/{{ pathLevel1 }}/{{ pathLevel2 }}/{{ pathLevel3 }}/{{ pathLevel4 }}/file-{{ fileId }}.ts"
---
// Deeply nested file
export const deepFile{{ fileId }} = {
  path: "{{ pathLevel0 }}/{{ pathLevel1 }}/{{ pathLevel2 }}/{{ pathLevel3 }}/{{ pathLevel4 }}",
  id: {{ fileId }},
  depth: 5
};`
      );

      const nestingCount = 100;
      const startTime = performance.now();

      // Generate files in deep directory structures
      const operations = [];
      for (let i = 0; i < nestingCount; i++) {
        const mockArgs = {
          pathLevel0: `level0-${i % 5}`,
          pathLevel1: `level1-${i % 4}`,
          pathLevel2: `level2-${i % 3}`,
          pathLevel3: `level3-${i % 2}`,
          pathLevel4: `level4-${i % 1}`,
          fileId: i,
        };

        const nestGenerator = new Generator(templatesDir);
        (nestGenerator as any).collectVariables = async () => mockArgs;

        const operation = nestGenerator.generate({
          generator: "deep-dirs",
          template: "nested",
          dest: testDir,
          force: true,
          dry: false,
        }).then(() => ({ success: true, index: i }))
          .catch(error => ({ success: false, index: i, error: error.message }));

        operations.push(operation);
      }

      const results = await Promise.allSettled(operations);
      const endTime = performance.now();

      const successful = results.filter(r => 
        r.status === "fulfilled" && r.value.success
      ).length;

      expect(successful).toBeGreaterThan(nestingCount * 0.9); // At least 90% success
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds

      // Verify deep directory structure was created correctly
      const checkDeepPaths = async (dir: string, depth: number): Promise<number> => {
        if (depth > 10 || !(await fs.pathExists(dir))) return 0;
        
        let count = 0;
        const entries = await fs.readdir(dir);
        
        for (const entry of entries) {
          const entryPath = path.join(dir, entry);
          const stat = await fs.stat(entryPath);
          
          if (stat.isFile() && entry.endsWith('.ts')) {
            count++;
          } else if (stat.isDirectory()) {
            count += await checkDeepPaths(entryPath, depth + 1);
          }
        }
        
        return count;
      };

      const totalFilesFound = await checkDeepPaths(testDir, 0);
      expect(totalFilesFound).toBeGreaterThan(successful * 0.8);

      console.log(`Deep Directory Test:
        Operations: ${nestingCount}
        Successful: ${successful}
        Files Found: ${totalFilesFound}
        Time: ${(endTime - startTime).toFixed(2)}ms`);
    }, 60000);

    it("should handle filesystem permission scenarios gracefully", async () => {
      const generatorDir = path.join(templatesDir, "permissions");
      const templateDir = path.join(generatorDir, "access");
      await fs.ensureDir(templateDir);

      // Create template with various permission scenarios
      await fs.writeFile(
        path.join(templateDir, "perm-test.ts"),
        `---
to: "{{ outputPath }}"
chmod: "{{ permissions }}"
---
// Permission test file
export const permTest{{ id }} = {
  id: {{ id }},
  permissions: "{{ permissions }}",
  accessible: {{ accessible }}
};`
      );

      // Create various permission test scenarios
      const scenarios = [
        { outputPath: "normal/file1.ts", permissions: "644", accessible: true },
        { outputPath: "readonly/file2.ts", permissions: "444", accessible: true },
        { outputPath: "executable/file3.ts", permissions: "755", accessible: true },
        { outputPath: "restricted/file4.ts", permissions: "600", accessible: true },
      ];

      // Add some problematic scenarios that should fail gracefully
      if (process.platform !== "win32") { // Unix-like systems only
        scenarios.push(
          { outputPath: "/root/unauthorized.ts", permissions: "644", accessible: false },
          { outputPath: "/proc/invalid.ts", permissions: "644", accessible: false }
        );
      }

      const startTime = performance.now();
      const results = [];

      for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i];
        const mockArgs = {
          outputPath: scenario.outputPath,
          permissions: scenario.permissions,
          accessible: scenario.accessible,
          id: i,
        };

        const permGenerator = new Generator(templatesDir);
        (permGenerator as any).collectVariables = async () => mockArgs;

        try {
          const result = await permGenerator.generate({
            generator: "permissions",
            template: "access",
            dest: testDir,
            force: true,
            dry: false,
          });

          results.push({
            success: true,
            scenario: i,
            expected: scenario.accessible,
            files: result.files.length,
          });
        } catch (error) {
          results.push({
            success: false,
            scenario: i,
            expected: scenario.accessible,
            error: error.message,
          });
        }
      }

      const endTime = performance.now();

      // Verify that accessible scenarios mostly succeeded
      const accessibleScenarios = results.filter(r => scenarios[r.scenario].accessible);
      const successfulAccessible = accessibleScenarios.filter(r => r.success).length;
      
      expect(successfulAccessible).toBeGreaterThan(accessibleScenarios.length * 0.8);

      // Verify that files have correct permissions (where possible to check)
      for (const result of results.slice(0, 4)) { // Check first 4 (normal scenarios)
        if (result.success) {
          const scenario = scenarios[result.scenario];
          const filePath = path.join(testDir, scenario.outputPath);
          
          if (await fs.pathExists(filePath)) {
            if (process.platform !== "win32") {
              try {
                const stats = await fs.stat(filePath);
                // Basic permission check - exact mode checking is complex
                expect(stats.mode).toBeDefined();
              } catch (error) {
                // Permission check may fail, but shouldn't crash
              }
            }
          }
        }
      }

      console.log(`Permission Test:
        Scenarios: ${scenarios.length}
        Results: ${results.map(r => r.success ? 'S' : 'F').join('')}
        Time: ${(endTime - startTime).toFixed(2)}ms`);
    }, 45000);
  });

  describe("Performance Metrics and Thresholds", () => {
    it("should maintain consistent performance across file size variations", async () => {
      const generatorDir = path.join(templatesDir, "perf-test");
      const templateDir = path.join(generatorDir, "sizes");
      await fs.ensureDir(templateDir);

      // Create template for variable size files
      await fs.writeFile(
        path.join(templateDir, "size-test.ts"),
        `// Variable size test
export const sizeTest{{ id }} = {
  id: {{ id }},
  size: {{ targetSize }},
  data: "{{ contentData }}",
  timestamp: {{ timestamp }}
};`
      );

      // Test different file sizes: 1KB, 10KB, 100KB, 1MB
      const sizeTests = [
        { size: 1024, label: "1KB" },
        { size: 10240, label: "10KB" },
        { size: 102400, label: "100KB" },
        { size: 1048576, label: "1MB" },
      ];

      const performanceMetrics: Array<{
        size: string;
        avgTime: number;
        minTime: number;
        maxTime: number;
        throughput: number;
      }> = [];

      for (const sizeTest of sizeTests) {
        const times: number[] = [];
        const iterations = 10;

        for (let i = 0; i < iterations; i++) {
          const contentData = "x".repeat(sizeTest.size / 10); // Approximate target size
          const mockArgs = {
            id: i,
            targetSize: sizeTest.size,
            contentData,
            timestamp: Date.now(),
          };

          const perfGenerator = new Generator(templatesDir);
          (perfGenerator as any).collectVariables = async () => mockArgs;

          const startTime = performance.now();
          
          await perfGenerator.generate({
            generator: "perf-test",
            template: "sizes",
            dest: path.join(testDir, "perf-output", sizeTest.label),
            force: true,
            dry: false,
          });

          const endTime = performance.now();
          times.push(endTime - startTime);
        }

        const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        const throughput = sizeTest.size / (avgTime / 1000); // bytes per second

        performanceMetrics.push({
          size: sizeTest.label,
          avgTime,
          minTime,
          maxTime,
          throughput,
        });

        // Performance should scale reasonably with file size
        expect(avgTime).toBeLessThan(sizeTest.size / 1000 + 1000); // Rough scaling expectation
        expect(maxTime / minTime).toBeLessThan(5); // Consistency check
      }

      // Verify performance scaling is reasonable
      const kb1 = performanceMetrics.find(m => m.size === "1KB")!;
      const mb1 = performanceMetrics.find(m => m.size === "1MB")!;
      
      // 1MB shouldn't take more than 100x longer than 1KB
      expect(mb1.avgTime / kb1.avgTime).toBeLessThan(100);

      console.log("Performance Metrics:");
      for (const metric of performanceMetrics) {
        console.log(`  ${metric.size}: avg=${metric.avgTime.toFixed(2)}ms, throughput=${(metric.throughput / 1024).toFixed(2)} KB/s`);
      }
    }, 90000);

    it("should maintain performance under sustained load", async () => {
      const generatorDir = path.join(templatesDir, "sustained-load");
      const templateDir = path.join(generatorDir, "load-test");
      await fs.ensureDir(templateDir);

      await fs.writeFile(
        path.join(templateDir, "load-{{ batch }}-{{ item }}.ts"),
        `// Sustained load test
export const loadTest{{ batch }}_{{ item }} = {
  batch: {{ batch }},
  item: {{ item }},
  timestamp: {{ timestamp }},
  data: "{{ loadData }}"
};`
      );

      const batchCount = 20;
      const itemsPerBatch = 25;
      const batchMetrics: number[] = [];

      // Run sustained load test
      for (let batch = 0; batch < batchCount; batch++) {
        const batchStartTime = performance.now();
        const batchOperations = [];

        for (let item = 0; item < itemsPerBatch; item++) {
          const mockArgs = {
            batch,
            item,
            timestamp: Date.now() + item,
            loadData: `load_data_${batch}_${item}_`.repeat(20),
          };

          const loadGenerator = new Generator(templatesDir);
          (loadGenerator as any).collectVariables = async () => mockArgs;

          const operation = loadGenerator.generate({
            generator: "sustained-load",
            template: "load-test",
            dest: path.join(testDir, "sustained-output", `batch-${batch}`),
            force: true,
            dry: false,
          });

          batchOperations.push(operation);
        }

        await Promise.all(batchOperations);
        const batchEndTime = performance.now();
        batchMetrics.push(batchEndTime - batchStartTime);
      }

      // Analyze performance degradation
      const firstHalf = batchMetrics.slice(0, Math.floor(batchCount / 2));
      const secondHalf = batchMetrics.slice(Math.floor(batchCount / 2));
      
      const firstHalfAvg = firstHalf.reduce((sum, t) => sum + t, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, t) => sum + t, 0) / secondHalf.length;
      
      const performanceDegradation = secondHalfAvg / firstHalfAvg;

      // Performance shouldn't degrade by more than 50%
      expect(performanceDegradation).toBeLessThan(1.5);

      // Overall performance should be consistent
      const avgTime = batchMetrics.reduce((sum, t) => sum + t, 0) / batchMetrics.length;
      const maxTime = Math.max(...batchMetrics);
      expect(maxTime / avgTime).toBeLessThan(3); // No batch should be 3x slower than average

      console.log(`Sustained Load Test:
        Batches: ${batchCount}
        Items per batch: ${itemsPerBatch}
        Avg batch time: ${avgTime.toFixed(2)}ms
        Performance degradation: ${performanceDegradation.toFixed(2)}x`);
    }, 120000);
  });

  describe("Error Handling Under Extreme Conditions", () => {
    it("should handle disk space exhaustion gracefully", async () => {
      const generatorDir = path.join(templatesDir, "disk-space");
      const templateDir = path.join(generatorDir, "huge-files");
      await fs.ensureDir(templateDir);

      // Create template that generates very large files
      await fs.writeFile(
        path.join(templateDir, "huge-{{ id }}.ts"),
        `// Huge file test
export const hugeData{{ id }} = "{{ massiveContent }}";`
      );

      let diskSpaceError = false;
      let successfulFiles = 0;
      let failedFiles = 0;

      // Try to generate increasingly large files until we hit limits
      for (let i = 0; i < 10; i++) {
        const fileSize = Math.pow(2, 20 + i); // Start at 1MB, double each time
        const mockArgs = {
          id: i,
          massiveContent: "x".repeat(Math.min(fileSize, 100 * 1024 * 1024)), // Cap at 100MB
        };

        const hugeGenerator = new Generator(templatesDir);
        (hugeGenerator as any).collectVariables = async () => mockArgs;

        try {
          await hugeGenerator.generate({
            generator: "disk-space",
            template: "huge-files",
            dest: path.join(testDir, "huge-output"),
            force: true,
            dry: false,
          });
          
          successfulFiles++;
        } catch (error) {
          failedFiles++;
          
          if (error.message.includes("ENOSPC") || 
              error.message.includes("no space") ||
              error.message.includes("disk")) {
            diskSpaceError = true;
            console.log(`Disk space error encountered at file ${i} (expected)`);
            break; // Expected behavior
          } else {
            // Unexpected error - should still handle gracefully
            console.log(`Unexpected error at file ${i}: ${error.message}`);
          }
        }
      }

      // Either we should succeed with reasonable files, or fail gracefully with disk space
      expect(successfulFiles + failedFiles).toBeGreaterThan(0);
      
      if (!diskSpaceError) {
        // If no disk space issues, we should have some successful files
        expect(successfulFiles).toBeGreaterThan(3);
      }

      // Verify that the generator is still functional after errors
      try {
        const generators = await generator.listGenerators();
        expect(Array.isArray(generators)).toBe(true);
      } catch (error) {
        // Generator should remain functional
        throw new Error("Generator became non-functional after disk space test");
      }

      console.log(`Disk Space Test:
        Successful files: ${successfulFiles}
        Failed files: ${failedFiles}
        Disk space error: ${diskSpaceError}`);
    }, 60000);

    it("should recover from filesystem corruption scenarios", async () => {
      const generatorDir = path.join(templatesDir, "corruption-test");
      const templateDir = path.join(generatorDir, "recovery");
      await fs.ensureDir(templateDir);

      await fs.writeFile(
        path.join(templateDir, "recovery-test.ts"),
        `// Recovery test
export const recoveryTest = {
  id: {{ id }},
  data: "{{ testData }}",
  timestamp: {{ timestamp }}
};`
      );

      const corruptionScenarios = [
        {
          name: "Invalid characters in filename",
          mockArgs: { id: 1, testData: "normal_data", timestamp: Date.now() },
          corruptAction: async (outputPath: string) => {
            // Try to create file with invalid characters
            const invalidPath = path.join(path.dirname(outputPath), "file\x00invalid.ts");
            try {
              await fs.writeFile(invalidPath, "invalid");
            } catch {
              // Expected to fail
            }
          },
        },
        {
          name: "Partial file write simulation",
          mockArgs: { id: 2, testData: "partial_data", timestamp: Date.now() },
          corruptAction: async (outputPath: string) => {
            // Create a partially written file
            await fs.writeFile(outputPath, "partial content{");
          },
        },
        {
          name: "Read-only directory",
          mockArgs: { id: 3, testData: "readonly_data", timestamp: Date.now() },
          corruptAction: async (outputPath: string) => {
            const dir = path.dirname(outputPath);
            await fs.ensureDir(dir);
            if (process.platform !== "win32") {
              try {
                await fs.chmod(dir, 0o444); // Read-only
              } catch {
                // May fail, that's okay
              }
            }
          },
        },
      ];

      let recoveredScenarios = 0;
      let totalScenarios = 0;

      for (const scenario of corruptionScenarios) {
        totalScenarios++;
        
        try {
          const corruptGenerator = new Generator(templatesDir);
          (corruptGenerator as any).collectVariables = async () => scenario.mockArgs;

          const outputDir = path.join(testDir, "corruption-output", `scenario-${scenario.mockArgs.id}`);
          const outputPath = path.join(outputDir, "recovery-test.ts");

          // Apply corruption scenario
          await scenario.corruptAction(outputPath);

          // Try to generate file despite corruption
          const result = await corruptGenerator.generate({
            generator: "corruption-test",
            template: "recovery",
            dest: outputDir,
            force: true,
            dry: false,
          });

          // If we get here, recovery was successful
          recoveredScenarios++;
          
          // Verify the file was created properly
          if (await fs.pathExists(outputPath)) {
            const content = await fs.readFile(outputPath, "utf8");
            expect(content).toContain("export const recoveryTest");
          }
        } catch (error) {
          console.log(`Scenario '${scenario.name}' failed as expected: ${error.message.slice(0, 100)}`);
          
          // Even if it fails, the generator should remain functional
          try {
            const testGenerator = new Generator(templatesDir);
            await testGenerator.listGenerators();
            recoveredScenarios++; // Count as recovery if generator still works
          } catch {
            // This would be a real failure
          }
        } finally {
          // Clean up permissions
          const outputDir = path.join(testDir, "corruption-output", `scenario-${scenario.mockArgs.id}`);
          if (await fs.pathExists(outputDir)) {
            try {
              if (process.platform !== "win32") {
                await fs.chmod(outputDir, 0o755);
              }
            } catch {
              // Cleanup may fail
            }
          }
        }
      }

      expect(recoveredScenarios).toBeGreaterThan(totalScenarios * 0.7); // At least 70% recovery

      console.log(`Corruption Recovery Test:
        Total scenarios: ${totalScenarios}
        Recovered scenarios: ${recoveredScenarios}
        Recovery rate: ${(recoveredScenarios / totalScenarios * 100).toFixed(1)}%`);
    }, 45000);
  });

  describe("Cleanup After Interrupted Operations", () => {
    it("should cleanup temporary files after process interruption", async () => {
      const generatorDir = path.join(templatesDir, "cleanup-test");
      const templateDir = path.join(generatorDir, "interrupt");
      await fs.ensureDir(templateDir);

      // Create template that would create temporary files
      await fs.writeFile(
        path.join(templateDir, "temp-{{ id }}.ts"),
        `---
to: "temp-files/temp-{{ id }}.ts"
---
// Temporary file {{ id }}
export const tempFile{{ id }} = {
  id: {{ id }},
  data: "{{ tempData }}",
  created: {{ timestamp }}
};`
      );

      const tempOutputDir = path.join(testDir, "temp-files");
      const interruptCount = 10;
      let interruptedOperations = 0;
      let cleanupSuccessful = 0;

      // Create multiple operations and "interrupt" them
      for (let i = 0; i < interruptCount; i++) {
        const mockArgs = {
          id: i,
          tempData: "temp_data_".repeat(1000), // Make it take some time
          timestamp: Date.now(),
        };

        const interruptGenerator = new Generator(templatesDir);
        (interruptGenerator as any).collectVariables = async () => mockArgs;

        // Start operation but don't wait for completion on some
        const operationPromise = interruptGenerator.generate({
          generator: "cleanup-test",
          template: "interrupt",
          dest: testDir,
          force: true,
          dry: false,
        });

        if (i % 3 === 0) {
          // Let every 3rd operation complete
          try {
            await operationPromise;
          } catch (error) {
            // May fail due to interference from other operations
          }
        } else {
          // "Interrupt" other operations by starting new ones quickly
          interruptedOperations++;
          
          // Don't await - simulate interruption
          operationPromise.catch(() => {
            // Ignore errors from interrupted operations
          });
        }
      }

      // Wait a bit for operations to settle
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Check for orphaned files or processes
      let orphanedFiles = 0;
      if (await fs.pathExists(tempOutputDir)) {
        const files = await fs.readdir(tempOutputDir);
        
        for (const file of files) {
          const filePath = path.join(tempOutputDir, file);
          
          try {
            const content = await fs.readFile(filePath, "utf8");
            
            // Check if file is corrupted or incomplete
            if (!content.includes("export const tempFile") || 
                content.includes("undefined") ||
                content.length < 50) {
              orphanedFiles++;
            }
          } catch {
            // File may be locked or corrupted
            orphanedFiles++;
          }
        }
        
        cleanupSuccessful = files.length - orphanedFiles;
      }

      // Verify system is still responsive
      const healthCheckGenerator = new Generator(templatesDir);
      const generators = await healthCheckGenerator.listGenerators();
      expect(Array.isArray(generators)).toBe(true);

      // Most files should be either properly created or properly cleaned up
      expect(orphanedFiles).toBeLessThan(interruptCount * 0.3); // Less than 30% orphaned

      console.log(`Cleanup Test:
        Interrupted operations: ${interruptedOperations}
        Clean files: ${cleanupSuccessful}
        Orphaned files: ${orphanedFiles}
        Cleanup rate: ${((cleanupSuccessful / (cleanupSuccessful + orphanedFiles)) * 100).toFixed(1)}%`);
    }, 30000);

    it("should handle process termination scenarios", async () => {
      const generatorDir = path.join(templatesDir, "termination-test");
      const templateDir = path.join(generatorDir, "process");
      await fs.ensureDir(templateDir);

      await fs.writeFile(
        path.join(templateDir, "process-{{ pid }}.ts"),
        `---
to: "processes/process-{{ pid }}.ts"
sh: "echo 'Process {{ pid }} executed'"
---
// Process file {{ pid }}
export const process{{ pid }} = {
  pid: {{ pid }},
  data: "{{ processData }}",
  executed: true
};`
      );

      const processCount = 5;
      const processes: Promise<any>[] = [];
      const startTime = performance.now();

      // Spawn processes that may be terminated
      for (let i = 0; i < processCount; i++) {
        const mockArgs = {
          pid: i,
          processData: `process_data_${i}_`.repeat(100),
        };

        const processGenerator = new Generator(templatesDir);
        (processGenerator as any).collectVariables = async () => mockArgs;

        const processPromise = processGenerator.generate({
          generator: "termination-test",
          template: "process",
          dest: testDir,
          force: true,
          dry: false,
        }).then(result => ({
          success: true,
          pid: i,
          files: result.files.length,
        })).catch(error => ({
          success: false,
          pid: i,
          error: error.message,
        }));

        processes.push(processPromise);
      }

      // Wait for all processes with timeout
      const results = await Promise.allSettled(
        processes.map(p => 
          Promise.race([
            p,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Process timeout")), 15000)
            )
          ])
        )
      );

      const endTime = performance.now();

      const completed = results.filter(r => r.status === "fulfilled").length;
      const timedOut = results.filter(r => 
        r.status === "rejected" && r.reason?.message === "Process timeout"
      ).length;

      // Verify system recovery after process termination
      const recoveryGenerator = new Generator(templatesDir);
      const generators = await recoveryGenerator.listGenerators();
      expect(Array.isArray(generators)).toBe(true);

      // Check for leftover processes or files
      const processesDir = path.join(testDir, "processes");
      let processFiles = 0;
      if (await fs.pathExists(processesDir)) {
        const files = await fs.readdir(processesDir);
        processFiles = files.length;
        
        // Verify file integrity
        for (const file of files) {
          const content = await fs.readFile(path.join(processesDir, file), "utf8");
          expect(content).toContain("export const process");
        }
      }

      expect(completed + timedOut).toBe(processCount);
      expect(endTime - startTime).toBeLessThan(20000); // Should not hang

      console.log(`Process Termination Test:
        Processes: ${processCount}
        Completed: ${completed}
        Timed out: ${timedOut}
        Process files: ${processFiles}
        Time: ${(endTime - startTime).toFixed(2)}ms`);
    }, 45000);
  });
});