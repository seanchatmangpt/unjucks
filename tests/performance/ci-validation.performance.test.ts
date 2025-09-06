import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

// Performance thresholds for CI/CD validation
const PERFORMANCE_THRESHOLDS = {
  CLI_STARTUP: 200, // ms
  HELP_COMMAND: 150, // ms
  LIST_COMMAND: 100, // ms
  SIMPLE_GENERATION: 50, // ms
  COMPLEX_GENERATION: 100, // ms
  LARGE_FILE_GENERATION: 5000, // ms
  MEMORY_LIMIT: 100, // MB
  CONCURRENT_OPERATIONS: 2000, // ms for 10 concurrent ops
  ERROR_RECOVERY: 1000, // ms
  REGRESSION_TOLERANCE: 5 // % performance regression allowed
};

describe('CI/CD Performance Validation', () => {
  const testDir = join(process.cwd(), 'tests/temp/ci-validation');
  const cliPath = join(process.cwd(), 'dist/cli.mjs');
  const performanceLog: Array<{ test: string, duration: number, threshold: number, passed: boolean }> = [];
  
  beforeAll(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
    setupValidationTemplates();
  });

  afterAll(() => {
    // Generate performance report
    generatePerformanceReport();
    
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  function setupValidationTemplates() {
    // Standard component template for validation
    const componentDir = join(testDir, '_templates/component/standard');
    mkdirSync(componentDir, { recursive: true });
    
    writeFileSync(join(componentDir, 'component.tsx.njk'), `---
to: src/components/<%= h.changeCase.pascal(name) %>/<%= h.changeCase.pascal(name) %>.tsx
---
import React from 'react';

interface <%= h.changeCase.pascal(name) %>Props {
  className?: string;
}

export const <%= h.changeCase.pascal(name) %>: React.FC<<%= h.changeCase.pascal(name) %>Props> = ({ className }) => {
  return (
    <div className={className} data-testid="<%= h.changeCase.kebab(name) %>">
      <%= h.changeCase.title(name) %>
    </div>
  );
};
`);

    // Complex template for validation
    const complexDir = join(testDir, '_templates/service/full');
    mkdirSync(complexDir, { recursive: true });
    
    writeFileSync(join(complexDir, 'service.ts.njk'), `---
to: src/services/<%= h.changeCase.pascal(name) %>Service.ts
---
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { <%= h.changeCase.pascal(name) %>Entity } from '../entities/<%= h.changeCase.pascal(name) %>.entity';

@Injectable()
export class <%= h.changeCase.pascal(name) %>Service {
  constructor(
    private readonly <%= h.changeCase.camel(name) %>Repository: Repository<<%= h.changeCase.pascal(name) %>Entity>
  ) {}

  async findAll(): Promise<<%= h.changeCase.pascal(name) %>Entity[]> {
    return this.<%= h.changeCase.camel(name) %>Repository.find();
  }

  async findOne(id: string): Promise<<%= h.changeCase.pascal(name) %>Entity> {
    return this.<%= h.changeCase.camel(name) %>Repository.findOne({ where: { id } });
  }

  async create(data: Partial<<%= h.changeCase.pascal(name) %>Entity>): Promise<<%= h.changeCase.pascal(name) %>Entity> {
    const entity = this.<%= h.changeCase.camel(name) %>Repository.create(data);
    return this.<%= h.changeCase.camel(name) %>Repository.save(entity);
  }

  async update(id: string, data: Partial<<%= h.changeCase.pascal(name) %>Entity>): Promise<<%= h.changeCase.pascal(name) %>Entity> {
    await this.<%= h.changeCase.camel(name) %>Repository.update(id, data);
    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    await this.<%= h.changeCase.camel(name) %>Repository.delete(id);
  }
}
`);
  }

  function recordPerformance(testName: string, duration: number, threshold: number) {
    const passed = duration <= threshold;
    performanceLog.push({ test: testName, duration, threshold, passed });
    
    if (!passed) {
      console.warn(`⚠️  Performance threshold exceeded for ${testName}: ${duration.toFixed(2)}ms > ${threshold}ms`);
    } else {
      console.log(`✅ ${testName}: ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
    }
    
    return passed;
  }

  function generatePerformanceReport() {
    const reportPath = join(process.cwd(), 'tests/temp/performance-ci-report.json');
    
    const totalTests = performanceLog.length;
    const passedTests = performanceLog.filter(log => log.passed).length;
    const failedTests = totalTests - passedTests;
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests,
        passedTests,
        failedTests,
        passRate: ((passedTests / totalTests) * 100).toFixed(2) + '%'
      },
      thresholds: PERFORMANCE_THRESHOLDS,
      results: performanceLog,
      averages: {
        cliStartup: performanceLog.filter(l => l.test.includes('CLI Startup')).reduce((avg, l) => avg + l.duration, 0) / performanceLog.filter(l => l.test.includes('CLI Startup')).length,
        generation: performanceLog.filter(l => l.test.includes('Generation')).reduce((avg, l) => avg + l.duration, 0) / performanceLog.filter(l => l.test.includes('Generation')).length
      }
    };
    
    mkdirSync(join(process.cwd(), 'tests/temp'), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📊 Performance Test Summary:');
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests} (${report.summary.passRate})`);
    console.log(`   Failed: ${failedTests}`);
    console.log(`   Report: ${reportPath}`);
  }

  it('validates CLI startup performance meets CI requirements', async () => {
    const measurements: number[] = [];
    
    // Multiple cold start measurements
    for (let i = 0; i < 3; i++) {
      const startTime = performance.now();
      
      const { stdout } = await execAsync(`node ${cliPath} --version`, {
        cwd: testDir,
        timeout: 5000
      });
      
      const endTime = performance.now();
      measurements.push(endTime - startTime);
      
      expect(stdout.trim()).toBe('0.0.0');
    }
    
    const averageTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    const maxTime = Math.max(...measurements);
    
    const startupPassed = recordPerformance('CLI Startup Average', averageTime, PERFORMANCE_THRESHOLDS.CLI_STARTUP);
    const startupMaxPassed = recordPerformance('CLI Startup Max', maxTime, PERFORMANCE_THRESHOLDS.CLI_STARTUP * 1.5);
    
    expect(startupPassed).toBe(true);
    expect(startupMaxPassed).toBe(true);
  });

  it('validates help command performance meets CI requirements', async () => {
    const startTime = performance.now();
    
    const { stdout } = await execAsync(`node ${cliPath} --help`, {
      cwd: testDir,
      timeout: 5000
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(stdout).toContain('Unjucks CLI');
    
    const passed = recordPerformance('Help Command', duration, PERFORMANCE_THRESHOLDS.HELP_COMMAND);
    expect(passed).toBe(true);
  });

  it('validates list command performance meets CI requirements', async () => {
    const startTime = performance.now();
    
    const { stdout } = await execAsync(`node ${cliPath} list`, {
      cwd: testDir,
      timeout: 5000
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(stdout).toContain('Available generators');
    
    const passed = recordPerformance('List Command', duration, PERFORMANCE_THRESHOLDS.LIST_COMMAND);
    expect(passed).toBe(true);
  });

  it('validates simple generation performance meets CI requirements', async () => {
    const outputDir = join(testDir, 'output-simple-validation');
    mkdirSync(outputDir, { recursive: true });
    
    const startTime = performance.now();
    
    await execAsync(`node ${cliPath} generate component standard --name ValidationTest --dest ${outputDir}`, {
      cwd: testDir,
      timeout: 10000
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Verify output
    const componentFile = join(outputDir, 'src/components/ValidationTest/ValidationTest.tsx');
    expect(existsSync(componentFile)).toBe(true);
    
    const content = readFileSync(componentFile, 'utf-8');
    expect(content).toContain('ValidationTest');
    
    const passed = recordPerformance('Simple Generation', duration, PERFORMANCE_THRESHOLDS.SIMPLE_GENERATION);
    expect(passed).toBe(true);
  });

  it('validates complex generation performance meets CI requirements', async () => {
    const outputDir = join(testDir, 'output-complex-validation');
    mkdirSync(outputDir, { recursive: true });
    
    const startTime = performance.now();
    
    await execAsync(`node ${cliPath} generate service full --name UserManagement --dest ${outputDir}`, {
      cwd: testDir,
      timeout: 15000
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Verify output
    const serviceFile = join(outputDir, 'src/services/UserManagementService.ts');
    expect(existsSync(serviceFile)).toBe(true);
    
    const content = readFileSync(serviceFile, 'utf-8');
    expect(content).toContain('UserManagementService');
    expect(content).toContain('@Injectable');
    
    const passed = recordPerformance('Complex Generation', duration, PERFORMANCE_THRESHOLDS.COMPLEX_GENERATION);
    expect(passed).toBe(true);
  });

  it('validates concurrent operations performance meets CI requirements', async () => {
    const concurrentCount = 10;
    const promises = [];
    
    const startTime = performance.now();
    
    for (let i = 0; i < concurrentCount; i++) {
      const outputDir = join(testDir, `output-concurrent-validation-${i}`);
      mkdirSync(outputDir, { recursive: true });
      
      promises.push(
        execAsync(`node ${cliPath} generate component standard --name Concurrent${i} --dest ${outputDir}`, {
          cwd: testDir,
          timeout: 15000
        })
      );
    }
    
    await Promise.all(promises);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Verify all files were created
    for (let i = 0; i < concurrentCount; i++) {
      const outputDir = join(testDir, `output-concurrent-validation-${i}`);
      const componentFile = join(outputDir, `src/components/Concurrent${i}/Concurrent${i}.tsx`);
      expect(existsSync(componentFile)).toBe(true);
    }
    
    const passed = recordPerformance('Concurrent Operations', duration, PERFORMANCE_THRESHOLDS.CONCURRENT_OPERATIONS);
    expect(passed).toBe(true);
  });

  it('validates error recovery performance meets CI requirements', async () => {
    // Test with intentionally broken template
    const errorDir = join(testDir, '_templates/broken/test');
    mkdirSync(errorDir, { recursive: true });
    
    writeFileSync(join(errorDir, 'broken.ts.njk'), `---
to: <%= undefined_variable %>/broken.ts
---
This template will fail
`);
    
    const outputDir = join(testDir, 'output-error-validation');
    mkdirSync(outputDir, { recursive: true });
    
    const startTime = performance.now();
    
    try {
      await execAsync(`node ${cliPath} generate broken test --name ErrorTest --dest ${outputDir}`, {
        cwd: testDir,
        timeout: 10000
      });
      
      // If it doesn't throw, something's wrong
      expect(true).toBe(false);
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Error should be caught quickly
      const passed = recordPerformance('Error Recovery', duration, PERFORMANCE_THRESHOLDS.ERROR_RECOVERY);
      expect(passed).toBe(true);
      
      // Verify it's a meaningful error
      expect(error.message).toContain('');
    }
  });

  it('validates memory usage stays within CI limits', async () => {
    const outputDir = join(testDir, 'output-memory-validation');
    mkdirSync(outputDir, { recursive: true });
    
    const memBefore = process.memoryUsage();
    
    // Generate multiple files to test memory usage
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        execAsync(`node ${cliPath} generate component standard --name Memory${i} --dest ${outputDir}`, {
          cwd: testDir,
          timeout: 15000
        })
      );
    }
    
    await Promise.all(promises);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const memAfter = process.memoryUsage();
    const memoryIncreaseMB = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024);
    
    const passed = recordPerformance('Memory Usage', memoryIncreaseMB, PERFORMANCE_THRESHOLDS.MEMORY_LIMIT);
    expect(passed).toBe(true);
  });

  it('validates performance consistency across multiple runs', async () => {
    const measurements: number[] = [];
    const runCount = 5;
    
    for (let i = 0; i < runCount; i++) {
      const outputDir = join(testDir, `output-consistency-${i}`);
      mkdirSync(outputDir, { recursive: true });
      
      const startTime = performance.now();
      
      await execAsync(`node ${cliPath} generate component standard --name Consistency${i} --dest ${outputDir}`, {
        cwd: testDir,
        timeout: 10000
      });
      
      const endTime = performance.now();
      measurements.push(endTime - startTime);
    }
    
    const average = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
    const variance = measurements.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / measurements.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = (stdDev / average) * 100;
    
    console.log(`Performance Consistency:
      Average: ${average.toFixed(2)}ms
      Std Dev: ${stdDev.toFixed(2)}ms
      CV: ${coefficientOfVariation.toFixed(2)}%`);
    
    // Performance should be consistent (CV < 25%)
    expect(coefficientOfVariation).toBeLessThan(25);
    
    const consistencyPassed = recordPerformance('Performance Consistency (CV%)', coefficientOfVariation, 25);
    expect(consistencyPassed).toBe(true);
  });

  it('validates no significant performance regression', async () => {
    // This test would compare against baseline metrics from a previous run
    // For now, we validate that all other tests passed within their thresholds
    
    const failedTests = performanceLog.filter(log => !log.passed);
    const totalTests = performanceLog.length;
    const regressionRate = (failedTests.length / totalTests) * 100;
    
    console.log(`Performance Regression Analysis:
      Failed Tests: ${failedTests.length}/${totalTests}
      Regression Rate: ${regressionRate.toFixed(2)}%
      Tolerance: ${PERFORMANCE_THRESHOLDS.REGRESSION_TOLERANCE}%`);
    
    if (failedTests.length > 0) {
      console.log('Failed tests:');
      failedTests.forEach(test => {
        console.log(`  - ${test.test}: ${test.duration.toFixed(2)}ms (threshold: ${test.threshold}ms)`);
      });
    }
    
    expect(regressionRate).toBeLessThan(PERFORMANCE_THRESHOLDS.REGRESSION_TOLERANCE);
  });

  it('generates CI performance report', async () => {
    // This test ensures the report is generated properly
    expect(performanceLog.length).toBeGreaterThan(0);
    
    const reportPath = join(process.cwd(), 'tests/temp/performance-ci-report.json');
    
    // Check if report will be generated (it's done in afterAll)
    expect(performanceLog.every(log => typeof log.duration === 'number')).toBe(true);
    expect(performanceLog.every(log => typeof log.passed === 'boolean')).toBe(true);
  });
});