#!/usr/bin/env node

import { performance } from 'perf_hooks';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

class PerformanceAnalyzer {
  constructor() {
    this.results = [];
    this.baselineMetrics = {
      cliStartup: { help: null, list: null, version: null },
      templateRendering: { simple: null, complex: null },
      buildProcess: { full: null, validate: null },
      fileOperations: { read: null, write: null, inject: null },
      memoryUsage: { baseline: null, peak: null }
    };
  }

  async measure(name, fn, iterations = 1) {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      if (global.gc) global.gc();
      
      const memBefore = process.memoryUsage();
      const start = performance.now();
      
      let result, error = null;
      try {
        result = await fn();
      } catch (e) {
        error = e.message;
      }
      
      const end = performance.now();
      const memAfter = process.memoryUsage();
      
      results.push({
        duration: end - start,
        memory: {
          heapUsed: memAfter.heapUsed - memBefore.heapUsed,
          rss: memAfter.rss - memBefore.rss
        },
        success: !error,
        error
      });
    }
    
    const successful = results.filter(r => r.success);
    if (successful.length === 0) {
      console.log(`✗ ${name}: All attempts failed`);
      return { success: false, results };
    }
    
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
    const avgMemory = successful.reduce((sum, r) => sum + r.memory.heapUsed, 0) / successful.length;
    
    console.log(`✓ ${name}: ${avgDuration.toFixed(2)}ms avg (${iterations} runs)`);
    
    const benchmark = {
      name,
      iterations,
      avgDuration: parseFloat(avgDuration.toFixed(2)),
      avgMemory: parseFloat((avgMemory / 1024 / 1024).toFixed(2)),
      results,
      success: true
    };
    
    this.results.push(benchmark);
    return benchmark;
  }

  async runCLIPerformanceTests() {
    console.log('⌨️  CLI Performance Analysis:');
    
    // CLI startup times
    const helpResult = await this.measure('CLI Help Command', async () => {
      const { stdout } = await execAsync('node bin/unjucks.cjs help', { timeout: 5000 });
      return stdout.length;
    }, 5);
    this.baselineMetrics.cliStartup.help = helpResult.avgDuration;
    
    const listResult = await this.measure('CLI List Command', async () => {
      const { stdout } = await execAsync('node bin/unjucks.cjs list', { timeout: 5000 });
      return stdout.length;
    }, 5);
    this.baselineMetrics.cliStartup.list = listResult.avgDuration;
    
    const versionResult = await this.measure('CLI Version Command', async () => {
      const { stdout } = await execAsync('node bin/unjucks.cjs --version', { timeout: 5000 });
      return stdout.length;
    }, 5);
    this.baselineMetrics.cliStartup.version = versionResult.avgDuration;
  }

  async runBuildPerformanceTests() {
    console.log('\n🔨 Build Process Performance:');
    
    const buildResult = await this.measure('Full Build Process', async () => {
      const { stdout } = await execAsync('npm run build', { timeout: 30000 });
      return stdout.length;
    }, 3);
    this.baselineMetrics.buildProcess.full = buildResult.avgDuration;
    
    const validateResult = await this.measure('Build Validation', async () => {
      const { stdout } = await execAsync('npm run build:validate', { timeout: 15000 });
      return stdout.length;
    }, 3);
    this.baselineMetrics.buildProcess.validate = validateResult.avgDuration;
  }

  async runTemplatePerformanceTests() {
    console.log('\n🎨 Template Rendering Performance:');
    
    // Import nunjucks dynamically
    const nunjucks = await import('nunjucks').then(m => m.default);
    const env = nunjucks.configure({ autoescape: false });
    
    const simpleResult = await this.measure('Simple Template Rendering', async () => {
      const template = 'Hello {{ name }}! You have {{ count }} items.';
      const results = [];
      
      for (let i = 0; i < 100; i++) {
        results.push(env.renderString(template, { 
          name: `User${i}`, 
          count: i * 10 
        }));
      }
      
      return results.length;
    }, 10);
    this.baselineMetrics.templateRendering.simple = simpleResult.avgDuration;
    
    const complexResult = await this.measure('Complex Template Rendering', async () => {
      const template = `
{%- for user in users -%}
User: {{ user.name }}
{%- for item in user.items -%}
  - {{ item.name }}: {{ item.price }}
{%- endfor -%}
{%- endfor -%}
      `;
      
      const data = {
        users: Array.from({ length: 10 }, (_, i) => ({
          name: `User ${i}`,
          items: Array.from({ length: 3 }, (_, j) => ({
            name: `Item ${j}`,
            price: (Math.random() * 100).toFixed(2)
          }))
        }))
      };
      
      return env.renderString(template, data).length;
    }, 10);
    this.baselineMetrics.templateRendering.complex = complexResult.avgDuration;
  }

  async runFileOperationTests() {
    console.log('\n📁 File Operation Performance:');
    
    const testDir = path.join(process.cwd(), 'tests/.tmp/perf');
    await fs.ensureDir(testDir);
    
    await this.measure('File Write Operations', async () => {
      const writes = [];
      for (let i = 0; i < 10; i++) {
        writes.push(fs.writeFile(
          path.join(testDir, `test-${i}.txt`),
          `Test content ${i}\n`.repeat(100)
        ));
      }
      await Promise.all(writes);
      return writes.length;
    }, 5);
    
    await this.measure('File Read Operations', async () => {
      const reads = [];
      for (let i = 0; i < 10; i++) {
        reads.push(fs.readFile(path.join(testDir, `test-${i}.txt`), 'utf8'));
      }
      const contents = await Promise.all(reads);
      return contents.reduce((sum, content) => sum + content.length, 0);
    }, 5);
    
    await this.measure('File Injection Simulation', async () => {
      const targetFile = path.join(testDir, 'inject-target.js');
      await fs.writeFile(targetFile, 'const config = {};\n// INJECT_POINT\nmodule.exports = config;');
      
      for (let i = 0; i < 5; i++) {
        const content = await fs.readFile(targetFile, 'utf8');
        const injected = content.replace(
          '// INJECT_POINT',
          `// INJECT_POINT\nconfig.feature${i} = true;`
        );
        await fs.writeFile(targetFile, injected);
      }
      
      return 5;
    }, 3);
  }

  async runMemoryAnalysis() {
    console.log('\n🧠 Memory Usage Analysis:');
    
    const baseline = process.memoryUsage();
    this.baselineMetrics.memoryUsage.baseline = baseline.heapUsed / 1024 / 1024;
    
    await this.measure('Memory Allocation Test', async () => {
      const objects = [];
      for (let i = 0; i < 10000; i++) {
        objects.push({
          id: i,
          data: `Data ${i}`.repeat(10),
          nested: { value: i, array: new Array(10).fill(i) }
        });
      }
      return objects.length;
    }, 3);
    
    const peak = process.memoryUsage();
    this.baselineMetrics.memoryUsage.peak = peak.heapUsed / 1024 / 1024;
  }

  analyzeBundleSize() {
    console.log('\n📦 Bundle Size Analysis:');
    
    const binFiles = fs.readdirSync('bin/').map(file => {
      const size = fs.statSync(`bin/${file}`).size;
      return { file, size: (size / 1024).toFixed(2) };
    });
    
    const srcSize = this.calculateDirectorySize('src/');
    const nodeModulesSize = this.calculateDirectorySize('node_modules/');
    
    console.log('Binary files:');
    binFiles.forEach(({ file, size }) => {
      console.log(`  ${file}: ${size}KB`);
    });
    
    console.log(`Source code: ${(srcSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Dependencies: ${(nodeModulesSize / 1024 / 1024).toFixed(2)}MB`);
    
    return {
      binFiles,
      srcSize: srcSize / 1024 / 1024,
      nodeModulesSize: nodeModulesSize / 1024 / 1024
    };
  }

  calculateDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const file of files) {
        const fullPath = path.join(dirPath, file.name);
        
        if (file.isDirectory()) {
          totalSize += this.calculateDirectorySize(fullPath);
        } else {
          totalSize += fs.statSync(fullPath).size;
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
      return 0;
    }
    
    return totalSize;
  }

  identifyBottlenecks() {
    const bottlenecks = [];
    
    // CLI startup analysis
    const cliTimes = this.baselineMetrics.cliStartup;
    if (cliTimes.list > 400) {
      bottlenecks.push({
        area: 'CLI Startup',
        issue: 'List command taking too long',
        current: `${cliTimes.list}ms`,
        target: '<300ms',
        priority: 'high',
        recommendations: [
          'Optimize template discovery algorithm',
          'Implement template indexing cache',
          'Reduce initial dependencies loading'
        ]
      });
    }
    
    if (cliTimes.help > 300) {
      bottlenecks.push({
        area: 'CLI Startup',
        issue: 'Help command startup time',
        current: `${cliTimes.help}ms`,
        target: '<200ms',
        priority: 'medium',
        recommendations: [
          'Lazy load help content',
          'Pre-compile help templates',
          'Optimize import paths'
        ]
      });
    }
    
    // Build process analysis
    const buildTimes = this.baselineMetrics.buildProcess;
    if (buildTimes.full > 3000) {
      bottlenecks.push({
        area: 'Build Process',
        issue: 'Build taking too long',
        current: `${buildTimes.full}ms`,
        target: '<2000ms',
        priority: 'high',
        recommendations: [
          'Parallelize build steps',
          'Implement incremental builds',
          'Optimize file operations'
        ]
      });
    }
    
    // Template rendering analysis
    const templateTimes = this.baselineMetrics.templateRendering;
    if (templateTimes.complex > 50) {
      bottlenecks.push({
        area: 'Template Rendering',
        issue: 'Complex template performance',
        current: `${templateTimes.complex}ms`,
        target: '<30ms',
        priority: 'medium',
        recommendations: [
          'Cache compiled templates',
          'Optimize template structure',
          'Implement template streaming'
        ]
      });
    }
    
    // Memory usage analysis
    const memoryUsage = this.baselineMetrics.memoryUsage;
    const memoryIncrease = memoryUsage.peak - memoryUsage.baseline;
    if (memoryIncrease > 100) {
      bottlenecks.push({
        area: 'Memory Usage',
        issue: 'High memory consumption',
        current: `+${memoryIncrease.toFixed(2)}MB`,
        target: '<50MB increase',
        priority: 'medium',
        recommendations: [
          'Implement object pooling',
          'Use streaming for large operations',
          'Add garbage collection hints'
        ]
      });
    }
    
    return bottlenecks;
  }

  generateOptimizationPlan(bottlenecks) {
    return {
      immediate: bottlenecks.filter(b => b.priority === 'high'),
      shortTerm: bottlenecks.filter(b => b.priority === 'medium'),
      longTerm: bottlenecks.filter(b => b.priority === 'low'),
      quickWins: [
        'Add template compilation cache',
        'Implement CLI command result caching',
        'Optimize import statements',
        'Add performance monitoring'
      ],
      infrastructure: [
        'Set up performance regression testing',
        'Implement automated benchmarking',
        'Add performance budgets to CI/CD',
        'Create performance dashboard'
      ]
    };
  }

  async generateReport() {
    const bundleAnalysis = this.analyzeBundleSize();
    const bottlenecks = this.identifyBottlenecks();
    const optimizationPlan = this.generateOptimizationPlan(bottlenecks);
    
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        cpuCount: os.cpus().length,
        totalMemory: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + 'GB'
      },
      baseline: this.baselineMetrics,
      bundleAnalysis,
      bottlenecks,
      optimizationPlan,
      benchmarks: this.results,
      summary: {
        totalTests: this.results.length,
        successfulTests: this.results.filter(r => r.success).length,
        avgExecutionTime: this.results.reduce((sum, r) => sum + r.avgDuration, 0) / this.results.length,
        totalMemoryImpact: this.results.reduce((sum, r) => sum + r.avgMemory, 0)
      }
    };
    
    return report;
  }

  async run() {
    console.log('🚀 Unjucks Performance Analysis\n');
    console.log(`System: ${os.platform()} ${os.arch()}`);
    console.log(`Node.js: ${process.version}`);
    console.log(`Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB\n`);
    
    await this.runCLIPerformanceTests();
    await this.runBuildPerformanceTests();
    await this.runTemplatePerformanceTests();
    await this.runFileOperationTests();
    await this.runMemoryAnalysis();
    
    const report = await this.generateReport();
    
    // Save results
    const outputDir = path.join(process.cwd(), 'tests/benchmarks');
    await fs.ensureDir(outputDir);
    
    await fs.writeFile(
      path.join(outputDir, 'performance-analysis.json'),
      JSON.stringify(report, null, 2)
    );
    
    // Generate readable report
    const readableReport = this.formatReadableReport(report);
    await fs.writeFile(
      path.join(outputDir, 'performance-analysis.txt'),
      readableReport
    );
    
    console.log('\n' + readableReport);
    console.log(`\n✅ Performance analysis complete!`);
    console.log(`📁 Results saved to: ${outputDir}/`);
    
    return report;
  }

  formatReadableReport(report) {
    return `
Unjucks Performance Analysis Report
===================================
Generated: ${report.timestamp}

System Information:
  Platform: ${report.environment.platform} (${report.environment.arch})
  Node.js: ${report.environment.nodeVersion}
  CPU Cores: ${report.environment.cpuCount}
  Memory: ${report.environment.totalMemory}

Performance Baseline Metrics:
  CLI Startup Times:
    Help Command: ${report.baseline.cliStartup.help}ms
    List Command: ${report.baseline.cliStartup.list}ms
    Version Command: ${report.baseline.cliStartup.version}ms
    
  Build Process:
    Full Build: ${report.baseline.buildProcess.full}ms
    Validation: ${report.baseline.buildProcess.validate}ms
    
  Template Rendering:
    Simple Templates: ${report.baseline.templateRendering.simple}ms
    Complex Templates: ${report.baseline.templateRendering.complex}ms
    
  Memory Usage:
    Baseline: ${report.baseline.memoryUsage.baseline?.toFixed(2)}MB
    Peak: ${report.baseline.memoryUsage.peak?.toFixed(2)}MB
    Increase: +${(report.baseline.memoryUsage.peak - report.baseline.memoryUsage.baseline)?.toFixed(2)}MB

Bundle Analysis:
  Binary Files:
${report.bundleAnalysis.binFiles.map(f => `    ${f.file}: ${f.size}KB`).join('\n')}
  Source Code: ${report.bundleAnalysis.srcSize.toFixed(2)}MB
  Dependencies: ${report.bundleAnalysis.nodeModulesSize.toFixed(2)}MB

Critical Bottlenecks Found: ${report.bottlenecks.length}

${report.bottlenecks.length > 0 ? `
High Priority Issues:
${report.bottlenecks.filter(b => b.priority === 'high').map(b => `
  🔥 ${b.area}: ${b.issue}
     Current: ${b.current} | Target: ${b.target}
     Recommendations:
${b.recommendations.map(r => `       • ${r}`).join('\n')}
`).join('')}

Medium Priority Issues:
${report.bottlenecks.filter(b => b.priority === 'medium').map(b => `
  ⚠️  ${b.area}: ${b.issue}
     Current: ${b.current} | Target: ${b.target}
     Recommendations:
${b.recommendations.map(r => `       • ${r}`).join('\n')}
`).join('')}
` : '  ✅ No critical bottlenecks detected!'}

Optimization Plan:

Quick Wins (Immediate Implementation):
${report.optimizationPlan.quickWins.map(item => `  • ${item}`).join('\n')}

Infrastructure Improvements:
${report.optimizationPlan.infrastructure.map(item => `  • ${item}`).join('\n')}

Detailed Benchmark Results:
${report.benchmarks.map(b => `  ${b.name}: ${b.avgDuration}ms avg (${b.iterations} runs)`).join('\n')}

Summary:
  Total Tests: ${report.summary.totalTests}
  Successful: ${report.summary.successfulTests}
  Average Execution Time: ${report.summary.avgExecutionTime.toFixed(2)}ms
  Total Memory Impact: ${report.summary.totalMemoryImpact.toFixed(2)}MB

Performance Grade: ${this.calculatePerformanceGrade(report)}
`;
  }

  calculatePerformanceGrade(report) {
    let score = 100;
    
    // Deduct points for bottlenecks
    const highPriorityCount = report.bottlenecks.filter(b => b.priority === 'high').length;
    const mediumPriorityCount = report.bottlenecks.filter(b => b.priority === 'medium').length;
    
    score -= highPriorityCount * 20;
    score -= mediumPriorityCount * 10;
    
    // Deduct points for slow operations
    if (report.baseline.cliStartup.list > 500) score -= 15;
    if (report.baseline.buildProcess.full > 3000) score -= 15;
    
    if (score >= 90) return 'A+ (Excellent)';
    if (score >= 80) return 'A (Good)';
    if (score >= 70) return 'B (Fair)';
    if (score >= 60) return 'C (Needs Improvement)';
    return 'D (Critical Issues)';
  }
}

async function main() {
  const analyzer = new PerformanceAnalyzer();
  return await analyzer.run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { PerformanceAnalyzer };