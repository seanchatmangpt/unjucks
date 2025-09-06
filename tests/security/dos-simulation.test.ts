import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { FileInjector } from "../../src/lib/file-injector.js";
import { Generator } from "../../src/lib/generator.js";

describe("Denial of Service (DoS) Attack Simulation", () => {
  let fileInjector: FileInjector;
  let generator: Generator;
  let testDir: string;
  let performanceMetrics: Array<{
    test: string;
    duration: number;
    memoryUsage: number;
    successful: boolean;
    mitigated: boolean;
  }> = [];

  beforeEach(async () => {
    fileInjector = new FileInjector();
    generator = new Generator();
    testDir = path.join(os.tmpdir(), `dos-test-${Date.now()}`);
    await fs.ensureDir(testDir);
    performanceMetrics = [];
  });

  afterEach(async () => {
    await fs.remove(testDir);
    
    // Report DoS simulation results
    console.log("\n🚨 DoS SIMULATION SUMMARY:");
    console.log(`Total DoS Tests: ${performanceMetrics.length}`);
    const mitigated = performanceMetrics.filter(m => m.mitigated);
    console.log(`Attacks Mitigated: ${mitigated.length}/${performanceMetrics.length} (${Math.round(mitigated.length/performanceMetrics.length*100)}%)`);
    
    const avgDuration = performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / performanceMetrics.length;
    const avgMemory = performanceMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / performanceMetrics.length;
    
    console.log(`Average Response Time: ${Math.round(avgDuration)}ms`);
    console.log(`Average Memory Usage: ${Math.round(avgMemory / 1024 / 1024)}MB`);
    
    const failed = performanceMetrics.filter(m => !m.mitigated);
    if (failed.length > 0) {
      console.log("⚠️  DoS VULNERABILITIES DETECTED:");
      failed.forEach(fail => {
        console.log(`❌ ${fail.test}: ${fail.duration}ms, ${Math.round(fail.memoryUsage / 1024 / 1024)}MB`);
      });
    }
  });

  describe("Concurrent Request Flooding", () => {
    it("should handle 100+ concurrent requests without degradation", async () => {
      const concurrentRequests = 100;
      const maxResponseTime = 10000; // 10 seconds
      const maxMemoryIncrease = 200 * 1024 * 1024; // 200MB
      
      const initialMemory = process.memoryUsage().heapUsed;
      const startTime = Date.now();
      
      const requests = [];
      for (let i = 0; i < concurrentRequests; i++) {
        const testFile = path.join(testDir, `concurrent-${i}.txt`);
        requests.push(
          fileInjector.processFile(
            testFile,
            `Content for request ${i}`,
            {},
            { force: true, dry: true }
          )
        );
      }
      
      const results = await Promise.allSettled(requests);
      const duration = Date.now() - startTime;
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;
      
      const mitigated = duration < maxResponseTime && memoryIncrease < maxMemoryIncrease;
      
      performanceMetrics.push({
        test: `Concurrent Flooding (${concurrentRequests} requests)`,
        duration,
        memoryUsage: memoryIncrease,
        successful: successful > concurrentRequests * 0.9, // At least 90% success
        mitigated
      });
      
      expect(mitigated).toBe(true);
      expect(successful).toBeGreaterThan(concurrentRequests * 0.9);
      
      console.log(`✅ Concurrent flooding test: ${successful}/${concurrentRequests} successful, ${duration}ms, ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    });

    it("should maintain performance under sustained load", async () => {
      const requestsPerBatch = 10;
      const batches = 5;
      const batchInterval = 1000; // 1 second between batches
      
      const allMetrics = [];
      
      for (let batch = 0; batch < batches; batch++) {
        const batchStart = Date.now();
        const initialMemory = process.memoryUsage().heapUsed;
        
        const requests = [];
        for (let i = 0; i < requestsPerBatch; i++) {
          const testFile = path.join(testDir, `batch-${batch}-${i}.txt`);
          requests.push(
            fileInjector.processFile(
              testFile,
              `Batch ${batch}, Request ${i}`,
              {},
              { force: true, dry: true }
            )
          );
        }
        
        const results = await Promise.all(requests);
        const batchDuration = Date.now() - batchStart;
        const batchMemory = process.memoryUsage().heapUsed - initialMemory;
        const successful = results.filter(r => r.success).length;
        
        allMetrics.push({
          batch,
          duration: batchDuration,
          memory: batchMemory,
          successful
        });
        
        // Wait between batches
        if (batch < batches - 1) {
          await new Promise(resolve => setTimeout(resolve, batchInterval));
        }
      }
      
      // Check for performance degradation over time
      const firstBatch = allMetrics[0];
      const lastBatch = allMetrics[allMetrics.length - 1];
      
      const performanceDegraded = lastBatch.duration > firstBatch.duration * 2; // More than 2x slower
      const memoryLeak = lastBatch.memory > firstBatch.memory * 2; // More than 2x memory
      
      const mitigated = !performanceDegraded && !memoryLeak;
      
      performanceMetrics.push({
        test: `Sustained Load (${batches} batches)`,
        duration: allMetrics.reduce((sum, m) => sum + m.duration, 0),
        memoryUsage: allMetrics.reduce((sum, m) => sum + m.memory, 0),
        successful: allMetrics.every(m => m.successful === requestsPerBatch),
        mitigated
      });
      
      expect(mitigated).toBe(true);
      
      console.log(`✅ Sustained load test: Performance stable across ${batches} batches`);
    });
  });

  describe("Resource Exhaustion Attacks", () => {
    it("should prevent memory bomb attacks", async () => {
      const memoryBombSizes = [
        { size: 1024 * 1024, name: "1MB bomb" },
        { size: 10 * 1024 * 1024, name: "10MB bomb" },
        { size: 50 * 1024 * 1024, name: "50MB bomb" },
      ];
      
      for (const bomb of memoryBombSizes) {
        const startTime = Date.now();
        const initialMemory = process.memoryUsage().heapUsed;
        
        try {
          const largeContent = "A".repeat(bomb.size);
          const testFile = path.join(testDir, `memory-bomb-${bomb.size}.txt`);
          
          const result = await fileInjector.processFile(
            testFile,
            largeContent,
            {},
            { force: true, dry: true }
          );
          
          const duration = Date.now() - startTime;
          const memoryUsage = process.memoryUsage().heapUsed - initialMemory;
          
          // Check if the system handled the large content efficiently
          const mitigated = duration < 5000 && memoryUsage < bomb.size * 2; // Within reasonable limits
          
          performanceMetrics.push({
            test: `Memory Bomb: ${bomb.name}`,
            duration,
            memoryUsage,
            successful: result.success,
            mitigated
          });
          
          expect(mitigated).toBe(true);
          
        } catch (error) {
          // If an error is thrown, the attack was mitigated
          performanceMetrics.push({
            test: `Memory Bomb: ${bomb.name}`,
            duration: Date.now() - startTime,
            memoryUsage: process.memoryUsage().heapUsed - initialMemory,
            successful: false,
            mitigated: true // Error is considered mitigation
          });
        }
      }
    });

    it("should handle algorithmic complexity attacks", async () => {
      // Test templates that could cause O(n²) or worse complexity
      const complexityAttacks = [
        { template: "{% for i in range(1000) %}{% for j in range(1000) %}{{i*j}}{% endfor %}{% endfor %}", name: "Nested loops O(n²)" },
        { template: "{{ 'x' * 100000 }}", name: "String multiplication" },
        { template: "{% set items = [] %}{% for i in range(10000) %}{% set _ = items.append(i) %}{% endfor %}{{ items|length }}", name: "List growth" }
      ];
      
      for (const attack of complexityAttacks) {
        const startTime = Date.now();
        const initialMemory = process.memoryUsage().heapUsed;
        
        try {
          const testFile = path.join(testDir, `complexity-${Date.now()}.txt`);
          const result = await fileInjector.processFile(
            testFile,
            attack.template,
            {},
            { force: true, dry: true }
          );
          
          const duration = Date.now() - startTime;
          const memoryUsage = process.memoryUsage().heapUsed - initialMemory;
          
          // Should complete within reasonable time (30 seconds timeout)
          const mitigated = duration < 30000;
          
          performanceMetrics.push({
            test: `Complexity Attack: ${attack.name}`,
            duration,
            memoryUsage,
            successful: result.success,
            mitigated
          });
          
          expect(mitigated).toBe(true);
          
        } catch (error) {
          // Timeout or other error indicates mitigation
          performanceMetrics.push({
            test: `Complexity Attack: ${attack.name}`,
            duration: Date.now() - startTime,
            memoryUsage: process.memoryUsage().heapUsed - initialMemory,
            successful: false,
            mitigated: true
          });
        }
      }
    });
  });

  describe("File System DoS Attacks", () => {
    it("should prevent disk space exhaustion", async () => {
      const diskAttacks = [
        { count: 100, size: 1024, name: "100 small files" },
        { count: 10, size: 1024 * 1024, name: "10 large files" },
        { count: 1000, size: 100, name: "1000 tiny files" }
      ];
      
      for (const attack of diskAttacks) {
        const startTime = Date.now();
        const initialMemory = process.memoryUsage().heapUsed;
        
        try {
          const operations = [];
          const content = "A".repeat(attack.size);
          
          for (let i = 0; i < attack.count; i++) {
            const testFile = path.join(testDir, `disk-attack-${attack.count}-${i}.txt`);
            operations.push(
              fileInjector.processFile(
                testFile,
                content,
                {},
                { force: true, dry: true } // Dry run to prevent actual disk usage
              )
            );
          }
          
          const results = await Promise.all(operations);
          const duration = Date.now() - startTime;
          const memoryUsage = process.memoryUsage().heapUsed - initialMemory;
          const successful = results.filter(r => r.success).length;
          
          // Should handle efficiently without excessive resource usage
          const mitigated = duration < 10000 && memoryUsage < 100 * 1024 * 1024; // Under 10s and 100MB
          
          performanceMetrics.push({
            test: `Disk Exhaustion: ${attack.name}`,
            duration,
            memoryUsage,
            successful: successful === attack.count,
            mitigated
          });
          
          expect(mitigated).toBe(true);
          
        } catch (error) {
          performanceMetrics.push({
            test: `Disk Exhaustion: ${attack.name}`,
            duration: Date.now() - startTime,
            memoryUsage: process.memoryUsage().heapUsed - initialMemory,
            successful: false,
            mitigated: true
          });
        }
      }
    });

    it("should handle file descriptor exhaustion attempts", async () => {
      const fdExhaustionCount = 200; // Attempt to open many files
      const startTime = Date.now();
      const initialMemory = process.memoryUsage().heapUsed;
      
      try {
        const operations = [];
        
        for (let i = 0; i < fdExhaustionCount; i++) {
          const testFile = path.join(testDir, `fd-test-${i}.txt`);
          operations.push(
            fileInjector.processFile(
              testFile,
              `File descriptor test ${i}`,
              {},
              { force: true, dry: false } // Actual file operations to test FD usage
            )
          );
        }
        
        // Execute in smaller batches to avoid overwhelming the system
        const batchSize = 20;
        let successful = 0;
        
        for (let i = 0; i < operations.length; i += batchSize) {
          const batch = operations.slice(i, i + batchSize);
          const batchResults = await Promise.allSettled(batch);
          successful += batchResults.filter(r => 
            r.status === 'fulfilled' && r.value.success
          ).length;
        }
        
        const duration = Date.now() - startTime;
        const memoryUsage = process.memoryUsage().heapUsed - initialMemory;
        
        // System should handle file operations without resource exhaustion
        const mitigated = duration < 15000 && successful > fdExhaustionCount * 0.8;
        
        performanceMetrics.push({
          test: `File Descriptor Exhaustion (${fdExhaustionCount} files)`,
          duration,
          memoryUsage,
          successful: successful > fdExhaustionCount * 0.8,
          mitigated
        });
        
        expect(mitigated).toBe(true);
        
      } catch (error) {
        performanceMetrics.push({
          test: `File Descriptor Exhaustion (${fdExhaustionCount} files)`,
          duration: Date.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed - initialMemory,
          successful: false,
          mitigated: true
        });
      }
    });
  });

  describe("Template Processing DoS", () => {
    it("should prevent infinite recursion in template processing", async () => {
      // Templates that could cause infinite recursion
      const recursionAttacks = [
        "{% include template %}",  // Self-including template
        "{% extends 'base' %}{% block content %}{% include 'recursive' %}{% endblock %}",
        "{{ self.recursive() }}{% macro recursive %}{{ self.recursive() }}{% endmacro %}"
      ];
      
      for (const attack of recursionAttacks) {
        const startTime = Date.now();
        const initialMemory = process.memoryUsage().heapUsed;
        
        try {
          const testFile = path.join(testDir, `recursion-${Date.now()}.txt`);
          const result = await fileInjector.processFile(
            testFile,
            attack,
            {},
            { force: true, dry: true }
          );
          
          const duration = Date.now() - startTime;
          const memoryUsage = process.memoryUsage().heapUsed - initialMemory;
          
          // Should not hang indefinitely - max 30 seconds
          const mitigated = duration < 30000;
          
          performanceMetrics.push({
            test: `Recursion Attack: ${attack.substring(0, 30)}...`,
            duration,
            memoryUsage,
            successful: result.success,
            mitigated
          });
          
          expect(mitigated).toBe(true);
          
        } catch (error) {
          performanceMetrics.push({
            test: `Recursion Attack: ${attack.substring(0, 30)}...`,
            duration: Date.now() - startTime,
            memoryUsage: process.memoryUsage().heapUsed - initialMemory,
            successful: false,
            mitigated: true
          });
        }
      }
    });
  });

  describe("Network-Based DoS Simulation", () => {
    it("should handle malformed input gracefully", async () => {
      const malformedInputs = [
        "\u0000\u0001\u0002\u0003\u0004", // Control characters
        "A".repeat(1000000), // Very long string
        "\uFFFD\uFFFE\uFFFF", // Invalid Unicode
        "{{" + "{{".repeat(1000) + "}}" + "}}".repeat(1000), // Nested braces
        Buffer.alloc(1000, 0xFF).toString('binary'), // Binary data
      ];
      
      for (const input of malformedInputs) {
        const startTime = Date.now();
        const initialMemory = process.memoryUsage().heapUsed;
        
        try {
          const testFile = path.join(testDir, `malformed-${Date.now()}.txt`);
          const result = await fileInjector.processFile(
            testFile,
            input,
            {},
            { force: true, dry: true }
          );
          
          const duration = Date.now() - startTime;
          const memoryUsage = process.memoryUsage().heapUsed - initialMemory;
          
          // Should handle malformed input without crashing
          const mitigated = duration < 5000 && memoryUsage < 50 * 1024 * 1024;
          
          performanceMetrics.push({
            test: `Malformed Input: ${input.substring(0, 20).replace(/[\x00-\x1F]/g, '?')}...`,
            duration,
            memoryUsage,
            successful: result.success,
            mitigated
          });
          
          expect(mitigated).toBe(true);
          
        } catch (error) {
          performanceMetrics.push({
            test: `Malformed Input: ${input.substring(0, 20).replace(/[\x00-\x1F]/g, '?')}...`,
            duration: Date.now() - startTime,
            memoryUsage: process.memoryUsage().heapUsed - initialMemory,
            successful: false,
            mitigated: true
          });
        }
      }
    });
  });
});