#!/usr/bin/env tsx

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

const execAsync = promisify(exec);

interface BenchmarkResult {
  test: string;
  category: string;
  duration: number;
  threshold: number;
  passed: boolean;
  metadata?: any;
}

interface BenchmarkSuite {
  name: string;
  description: string;
  tests: BenchmarkResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    averageDuration: number;
  };
}

class PerformanceBenchmarker {
  private results: BenchmarkSuite[] = [];
  private cliPath: string;
  private tempDir: string;

  constructor() {
    this.cliPath = join(process.cwd(), 'dist/cli.mjs');
    this.tempDir = join(process.cwd(), 'tests/temp/benchmark');
    this.setupEnvironment();
  }

  private setupEnvironment(): void {
    // Clean and create temp directory
    if (existsSync(this.tempDir)) {
      rmSync(this.tempDir, { recursive: true, force: true });
    }
    mkdirSync(this.tempDir, { recursive: true });

    // Ensure reports directory exists
    const reportsDir = join(process.cwd(), 'reports');
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    // Build CLI if needed
    if (!existsSync(this.cliPath)) {
      console.error('❌ CLI not built. Please run "npm run build" first.');
      process.exit(1);
    }
  }

  private async measureOperation(
    name: string,
    operation: () => Promise<any>,
    threshold: number,
    category: string = 'general'
  ): Promise<BenchmarkResult> {
    console.log(`🔍 Running ${name}...`);
    
    const startTime = performance.now();
    let error: string | undefined;
    let metadata: any = {};

    try {
      const result = await operation();
      metadata = result?.metadata || {};
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const passed = !error && duration <= threshold;

    const result: BenchmarkResult = {
      test: name,
      category,
      duration,
      threshold,
      passed,
      metadata: { ...metadata, error }
    };

    const status = passed ? '✅' : '❌';
    const timeColor = duration > threshold ? '\x1b[31m' : '\x1b[32m';
    console.log(`${status} ${name}: ${timeColor}${duration.toFixed(2)}ms\x1b[0m (threshold: ${threshold}ms)`);

    return result;
  }

  async runStartupBenchmarks(): Promise<BenchmarkSuite> {
    console.log('\n🚀 Running CLI Startup Benchmarks...');
    
    const tests: BenchmarkResult[] = [];

    // Cold start benchmark
    tests.push(await this.measureOperation(
      'CLI Cold Start (--version)',
      async () => {
        const { stdout } = await execAsync(`node ${this.cliPath} --version`, {
          cwd: this.tempDir,
          timeout: 5000
        });
        return { metadata: { output: stdout.trim() } };
      },
      200,
      'startup'
    ));

    // Help command benchmark
    tests.push(await this.measureOperation(
      'Help Command (--help)',
      async () => {
        const { stdout } = await execAsync(`node ${this.cliPath} --help`, {
          cwd: this.tempDir,
          timeout: 5000
        });
        return { metadata: { outputLength: stdout.length } };
      },
      150,
      'startup'
    ));

    // List command benchmark
    tests.push(await this.measureOperation(
      'List Command',
      async () => {
        const { stdout } = await execAsync(`node ${this.cliPath} list`, {
          cwd: this.tempDir,
          timeout: 5000
        });
        return { metadata: { outputLength: stdout.length } };
      },
      100,
      'startup'
    ));

    const suite: BenchmarkSuite = {
      name: 'CLI Startup',
      description: 'Benchmarks for CLI initialization and basic commands',
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.passed).length,
        failed: tests.filter(t => !t.passed).length,
        averageDuration: tests.reduce((sum, t) => sum + t.duration, 0) / tests.length
      }
    };

    this.results.push(suite);
    return suite;
  }

  async runGenerationBenchmarks(): Promise<BenchmarkSuite> {
    console.log('\n⚡ Running Template Generation Benchmarks...');

    // Setup test templates
    this.setupTestTemplates();

    const tests: BenchmarkResult[] = [];

    // Simple generation
    tests.push(await this.measureOperation(
      'Simple Component Generation',
      async () => {
        const outputDir = join(this.tempDir, 'simple-output');
        mkdirSync(outputDir, { recursive: true });

        await execAsync(`node ${this.cliPath} generate component simple --name TestComponent --dest ${outputDir}`, {
          cwd: this.tempDir,
          timeout: 10000
        });

        return { metadata: { outputDir } };
      },
      50,
      'generation'
    ));

    // Complex generation
    tests.push(await this.measureOperation(
      'Complex Multi-file Generation',
      async () => {
        const outputDir = join(this.tempDir, 'complex-output');
        mkdirSync(outputDir, { recursive: true });

        await execAsync(`node ${this.cliPath} generate component complex --name UserProfile --dest ${outputDir}`, {
          cwd: this.tempDir,
          timeout: 15000
        });

        return { metadata: { outputDir } };
      },
      100,
      'generation'
    ));

    // Batch generation
    tests.push(await this.measureOperation(
      'Batch Generation (10 files)',
      async () => {
        const outputDir = join(this.tempDir, 'batch-output');
        mkdirSync(outputDir, { recursive: true });

        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(
            execAsync(`node ${this.cliPath} generate component simple --name Component${i} --dest ${outputDir}`, {
              cwd: this.tempDir,
              timeout: 15000
            })
          );
        }

        await Promise.all(promises);
        return { metadata: { fileCount: 10, outputDir } };
      },
      500,
      'generation'
    ));

    const suite: BenchmarkSuite = {
      name: 'Template Generation',
      description: 'Benchmarks for template processing and file generation',
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.passed).length,
        failed: tests.filter(t => !t.passed).length,
        averageDuration: tests.reduce((sum, t) => sum + t.duration, 0) / tests.length
      }
    };

    this.results.push(suite);
    return suite;
  }

  async runConcurrencyBenchmarks(): Promise<BenchmarkSuite> {
    console.log('\n🔥 Running Concurrency Benchmarks...');

    const tests: BenchmarkResult[] = [];

    // Concurrent operations
    for (const concurrency of [5, 10, 20]) {
      tests.push(await this.measureOperation(
        `Concurrent Generation (${concurrency} parallel)`,
        async () => {
          const outputDir = join(this.tempDir, `concurrent-${concurrency}`);
          mkdirSync(outputDir, { recursive: true });

          const promises = [];
          for (let i = 0; i < concurrency; i++) {
            promises.push(
              execAsync(`node ${this.cliPath} generate component simple --name Concurrent${i} --dest ${outputDir}`, {
                cwd: this.tempDir,
                timeout: 30000
              })
            );
          }

          const startTime = performance.now();
          await Promise.all(promises);
          const endTime = performance.now();

          return { 
            metadata: { 
              concurrency, 
              totalTime: endTime - startTime,
              averagePerOperation: (endTime - startTime) / concurrency
            } 
          };
        },
        concurrency * 100, // Scale threshold with concurrency
        'concurrency'
      ));
    }

    const suite: BenchmarkSuite = {
      name: 'Concurrency',
      description: 'Benchmarks for concurrent template generation',
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.passed).length,
        failed: tests.filter(t => !t.passed).length,
        averageDuration: tests.reduce((sum, t) => sum + t.duration, 0) / tests.length
      }
    };

    this.results.push(suite);
    return suite;
  }

  async runMemoryBenchmarks(): Promise<BenchmarkSuite> {
    console.log('\n🧠 Running Memory Benchmarks...');

    const tests: BenchmarkResult[] = [];

    // Memory usage test
    tests.push(await this.measureOperation(
      'Memory Usage (50 generations)',
      async () => {
        const memBefore = process.memoryUsage();
        const outputDir = join(this.tempDir, 'memory-test');
        mkdirSync(outputDir, { recursive: true });

        // Generate 50 files
        const promises = [];
        for (let i = 0; i < 50; i++) {
          promises.push(
            execAsync(`node ${this.cliPath} generate component simple --name Memory${i} --dest ${outputDir}`, {
              cwd: this.tempDir,
              timeout: 30000
            })
          );
        }

        await Promise.all(promises);

        if (global.gc) {
          global.gc();
        }

        const memAfter = process.memoryUsage();
        const memoryIncreaseMB = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024);

        return { 
          metadata: { 
            memoryIncreaseMB,
            memBefore: memBefore.heapUsed / (1024 * 1024),
            memAfter: memAfter.heapUsed / (1024 * 1024)
          } 
        };
      },
      100, // 100MB threshold
      'memory'
    ));

    const suite: BenchmarkSuite = {
      name: 'Memory Usage',
      description: 'Benchmarks for memory consumption during operations',
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.passed).length,
        failed: tests.filter(t => !t.passed).length,
        averageDuration: tests.reduce((sum, t) => sum + t.duration, 0) / tests.length
      }
    };

    this.results.push(suite);
    return suite;
  }

  private setupTestTemplates(): void {
    const templatesDir = join(this.tempDir, '_templates');

    // Simple template
    const simpleDir = join(templatesDir, 'component/simple');
    mkdirSync(simpleDir, { recursive: true });
    writeFileSync(join(simpleDir, 'component.tsx.njk'), `---
to: src/components/<%= name %>.tsx
---
export const <%= name %> = () => <div><%= name %></div>;
`);

    // Complex template
    const complexDir = join(templatesDir, 'component/complex');
    mkdirSync(complexDir, { recursive: true });
    
    writeFileSync(join(complexDir, 'component.tsx.njk'), `---
to: src/components/<%= h.changeCase.pascal(name) %>/<%= h.changeCase.pascal(name) %>.tsx
---
import React from 'react';
import { <%= h.changeCase.pascal(name) %>Props } from './types';

export const <%= h.changeCase.pascal(name) %>: React.FC<<%= h.changeCase.pascal(name) %>Props> = ({ name }) => {
  return <div>{name}</div>;
};
`);

    writeFileSync(join(complexDir, 'types.ts.njk'), `---
to: src/components/<%= h.changeCase.pascal(name) %>/types.ts
---
export interface <%= h.changeCase.pascal(name) %>Props {
  name: string;
}
`);

    writeFileSync(join(complexDir, 'index.ts.njk'), `---
to: src/components/<%= h.changeCase.pascal(name) %>/index.ts
---
export { <%= h.changeCase.pascal(name) %> } from './<%= h.changeCase.pascal(name) %>';
export type { <%= h.changeCase.pascal(name) %>Props } from './types';
`);
  }

  generateReport(): void {
    const timestamp = new Date().toISOString();
    const totalTests = this.results.reduce((sum, suite) => sum + suite.summary.total, 0);
    const totalPassed = this.results.reduce((sum, suite) => sum + suite.summary.passed, 0);
    const totalFailed = this.results.reduce((sum, suite) => sum + suite.summary.failed, 0);

    const report = {
      timestamp,
      summary: {
        totalSuites: this.results.length,
        totalTests,
        totalPassed,
        totalFailed,
        passRate: ((totalPassed / totalTests) * 100).toFixed(2) + '%'
      },
      suites: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpuCount: require('os').cpus().length,
        totalMemory: Math.round(require('os').totalmem() / (1024 * 1024 * 1024)) + 'GB'
      }
    };

    // Write detailed JSON report
    const jsonPath = join(process.cwd(), 'reports/performance-benchmark.json');
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Write summary report
    const summaryPath = join(process.cwd(), 'reports/performance-summary.md');
    const markdown = this.generateMarkdownSummary(report);
    writeFileSync(summaryPath, markdown);

    console.log('\n📊 Benchmark Results:');
    console.log(`   Total Suites: ${this.results.length}`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${totalPassed} (${report.summary.passRate})`);
    console.log(`   Failed: ${totalFailed}`);
    console.log(`   JSON Report: ${jsonPath}`);
    console.log(`   Summary: ${summaryPath}`);
  }

  private generateMarkdownSummary(report: any): string {
    let markdown = `# Unjucks Performance Benchmark Report

Generated: ${report.timestamp}

## Summary

- **Total Test Suites**: ${report.summary.totalSuites}
- **Total Tests**: ${report.summary.totalTests}
- **Pass Rate**: ${report.summary.passRate}
- **Environment**: Node.js ${report.environment.nodeVersion} on ${report.environment.platform} ${report.environment.arch}

## Results by Suite

`;

    for (const suite of report.suites) {
      markdown += `### ${suite.name}

${suite.description}

- **Total Tests**: ${suite.summary.total}
- **Passed**: ${suite.summary.passed}
- **Failed**: ${suite.summary.failed}
- **Average Duration**: ${suite.summary.averageDuration.toFixed(2)}ms

| Test | Duration | Threshold | Status |
|------|----------|-----------|--------|
`;

      for (const test of suite.tests) {
        const status = test.passed ? '✅ Pass' : '❌ Fail';
        markdown += `| ${test.test} | ${test.duration.toFixed(2)}ms | ${test.threshold}ms | ${status} |\n`;
      }

      markdown += '\n';
    }

    return markdown;
  }

  async runAll(): Promise<void> {
    console.log('🎯 Starting Comprehensive Performance Benchmark...\n');

    await this.runStartupBenchmarks();
    await this.runGenerationBenchmarks();
    await this.runConcurrencyBenchmarks();
    await this.runMemoryBenchmarks();

    this.generateReport();

    // Clean up
    if (existsSync(this.tempDir)) {
      rmSync(this.tempDir, { recursive: true, force: true });
    }

    console.log('\n🏁 Benchmark complete!');
  }
}

// Run benchmarks if script is called directly
if (require.main === module) {
  const benchmarker = new PerformanceBenchmarker();
  benchmarker.runAll()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    });
}

export { PerformanceBenchmarker };