#!/usr/bin/env node

const { performance } = require('perf_hooks');
const fs = require('fs-extra');
const path = require('path');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class BenchmarkRunner {
  constructor() {
    this.results = [];
    this.systemInfo = this.collectSystemInfo();
  }

  collectSystemInfo() {
    const os = require('os');
    return {
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      cpuCount: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg(),
      timestamp: Date.now(),
    };
  }

  async benchmark(operation, fn, metadata = {}) {
    if (global.gc) {
      global.gc();
    }

    const memoryBefore = process.memoryUsage();
    const startTime = performance.now();

    let result;
    let error = null;

    try {
      result = await fn();
    } catch (e) {
      error = e.message;
      result = null;
    }

    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();

    const benchmarkResult = {
      operation,
      duration: endTime - startTime,
      memoryBefore,
      memoryAfter,
      memoryDelta: {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        external: memoryAfter.external - memoryBefore.external,
        arrayBuffers: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers,
      },
      timestamp: Date.now(),
      metadata,
      error,
      success: !error,
    };

    this.results.push(benchmarkResult);
    console.log(`✓ ${operation}: ${benchmarkResult.duration.toFixed(2)}ms`);

    return { result, benchmark: benchmarkResult };
  }

  async runMemoryBenchmarks() {
    console.log('🧠 Running memory benchmarks...');

    await this.benchmark('Memory Allocation - Small Objects', async () => {
      const objects = [];
      for (let i = 0; i < 10000; i++) {
        objects.push({ id: i, name: `object-${i}`, value: Math.random() });
      }
      return objects.length;
    });

    await this.benchmark('Memory Allocation - Large Arrays', async () => {
      const arrays = [];
      for (let i = 0; i < 100; i++) {
        arrays.push(new Array(10000).fill(`data-${i}`));
      }
      return arrays.length;
    });

    await this.benchmark('Memory Allocation - Strings', async () => {
      let largeString = '';
      for (let i = 0; i < 1000; i++) {
        largeString += `This is a test string number ${i} `.repeat(100);
      }
      return largeString.length;
    });
  }

  async runExecutionBenchmarks() {
    console.log('⚡ Running execution speed benchmarks...');

    await this.benchmark('Array Processing - Map', async () => {
      const data = Array.from({ length: 100000 }, (_, i) => i);
      return data.map(x => x * 2 + 1).length;
    });

    await this.benchmark('Array Processing - Filter + Map', async () => {
      const data = Array.from({ length: 100000 }, (_, i) => i);
      return data.filter(x => x % 2 === 0).map(x => x * 3).length;
    });

    await this.benchmark('String Processing', async () => {
      const strings = Array.from({ length: 1000 }, (_, i) => `Test String ${i}!@#$%^&*()`);
      return strings
        .map(s => s.toLowerCase())
        .map(s => s.replace(/[^a-z0-9 -]/g, ''))
        .map(s => s.replace(/\s+/g, '-'))
        .length;
    });

    await this.benchmark('Object Manipulation', async () => {
      const objects = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Object ${i}`,
        data: { value: i * 2, nested: { deep: i * 3 } },
      }));

      return objects
        .map(obj => ({ ...obj, processed: true }))
        .filter(obj => obj.id % 3 === 0)
        .length;
    });
  }

  async runTemplateRenderingBenchmarks() {
    console.log('🎨 Running template rendering benchmarks...');

    const nunjucks = require('nunjucks');
    const env = nunjucks.configure({ autoescape: false });

    await this.benchmark('Simple Template Rendering', async () => {
      const template = 'Hello {{ name }}! You have {{ count }} items.';
      const results = [];

      for (let i = 0; i < 1000; i++) {
        results.push(env.renderString(template, { name: `User${i}`, count: i * 10 }));
      }

      return results.length;
    });

    await this.benchmark('Complex Template with Loops', async () => {
      const template = \`
{% for user in users %}
  User: {{ user.name }}
  Email: {{ user.email }}
  {% for item in user.items %}
    - {{ item.name }}: $\{{ item.price | round(2) }}
  {% endfor %}
{% endfor %}
      \`;

      const data = {
        users: Array.from({ length: 100 }, (_, i) => ({
          name: `User ${i}`,
          email: `user${i}@example.com`,
          items: Array.from({ length: 5 }, (_, j) => ({
            name: `Item ${j}`,
            price: Math.random() * 100,
          })),
        })),
      };

      return env.renderString(template, data).length;
    });

    await this.benchmark('Template with Filters', async () => {
      env.addFilter('slugify', (str) => {
        return str.toLowerCase()
          .replace(/[^a-z0-9 -]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
      });

      const template = '{{ title | slugify }} - {{ content | upper | truncate(50) }}';
      const results = [];

      for (let i = 0; i < 500; i++) {
        results.push(env.renderString(template, {
          title: `Complex Title ${i} with Special Characters!@#`,
          content: `This is content number ${i} `.repeat(20),
        }));
      }

      return results.length;
    });
  }

  async runFileOperationBenchmarks() {
    console.log('📁 Running file operation benchmarks...');

    const testDir = path.join(process.cwd(), 'tests/.tmp/perf-files');
    await fs.ensureDir(testDir);

    await this.benchmark('Sequential File Writes', async () => {
      for (let i = 0; i < 50; i++) {
        await fs.writeFile(
          path.join(testDir, `sequential-${i}.txt`),
          `Sequential content ${i} `.repeat(100)
        );
      }
      return 50;
    });

    await this.benchmark('Parallel File Writes', async () => {
      const writes = Array.from({ length: 50 }, (_, i) =>
        fs.writeFile(
          path.join(testDir, `parallel-${i}.txt`),
          `Parallel content ${i} `.repeat(100)
        )
      );
      await Promise.all(writes);
      return writes.length;
    });

    await this.benchmark('File Read Operations', async () => {
      const reads = [];
      for (let i = 0; i < 25; i++) {
        reads.push(fs.readFile(path.join(testDir, `sequential-${i}.txt`), 'utf8'));
      }
      const contents = await Promise.all(reads);
      return contents.reduce((sum, content) => sum + content.length, 0);
    });

    await this.benchmark('File Injection Simulation', async () => {
      const targetFile = path.join(testDir, 'inject-target.js');
      await fs.writeFile(targetFile, 'const base = "code";\n\n// INJECT_POINT\n\nmodule.exports = base;');

      for (let i = 0; i < 10; i++) {
        const content = await fs.readFile(targetFile, 'utf8');
        const injected = content.replace(
          '// INJECT_POINT',
          `// INJECT_POINT\nconst injected${i} = "value${i}";`
        );
        await fs.writeFile(targetFile, injected);
      }

      return 10;
    });
  }

  async runCLIBenchmarks() {
    console.log('⌨️  Running CLI benchmarks...');

    await this.benchmark('CLI Help Command', async () => {
      try {
        const { stdout } = await execAsync('node src/cli.ts --help', { timeout: 5000 });
        return stdout.length;
      } catch (error) {
        return 0; // CLI might not be fully implemented
      }
    });

    await this.benchmark('Node.js Startup Time', async () => {
      const { stdout } = await execAsync('node -e "console.log(Date.now())"');
      return parseInt(stdout.trim());
    });

    await this.benchmark('Package.json Parse', async () => {
      const pkg = await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8');
      const parsed = JSON.parse(pkg);
      return Object.keys(parsed).length;
    });
  }

  async runConcurrentOperationBenchmarks() {
    console.log('🔄 Running concurrent operation benchmarks...');

    await this.benchmark('Concurrent Promise Resolution', async () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        new Promise(resolve => setTimeout(() => resolve(i), Math.random() * 10))
      );
      const results = await Promise.all(promises);
      return results.length;
    });

    await this.benchmark('Mixed Async Operations', async () => {
      const operations = [
        ...Array.from({ length: 10 }, () => fs.readFile(__filename, 'utf8')),
        ...Array.from({ length: 10 }, (_, i) => new Promise(resolve => setTimeout(() => resolve(i), 5))),
        ...Array.from({ length: 10 }, () => Promise.resolve(Math.random())),
      ];

      const results = await Promise.all(operations);
      return results.length;
    });
  }

  generateReport() {
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);

    const durations = successful.map(r => r.duration);
    const memoryDeltas = successful.map(r => r.memoryDelta.heapUsed);

    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const avgDuration = totalDuration / durations.length;
    const totalMemoryDelta = memoryDeltas.reduce((sum, m) => sum + m, 0);

    durations.sort((a, b) => a - b);
    const p95Duration = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99Duration = durations[Math.floor(durations.length * 0.99)] || 0;

    return {
      summary: {
        timestamp: new Date().toISOString(),
        totalOperations: this.results.length,
        successfulOperations: successful.length,
        failedOperations: failed.length,
        totalDuration: totalDuration.toFixed(2),
        averageDuration: avgDuration.toFixed(2),
        minDuration: Math.min(...durations).toFixed(2),
        maxDuration: Math.max(...durations).toFixed(2),
        p95Duration: p95Duration.toFixed(2),
        p99Duration: p99Duration.toFixed(2),
        totalMemoryDelta: (totalMemoryDelta / 1024 / 1024).toFixed(2),
        averageMemoryDelta: (totalMemoryDelta / durations.length / 1024 / 1024).toFixed(2),
      },
      systemInfo: this.systemInfo,
      results: this.results,
      bottlenecks: this.identifyBottlenecks(),
    };
  }

  identifyBottlenecks() {
    const successful = this.results.filter(r => r.success);
    const sorted = [...successful].sort((a, b) => b.duration - a.duration);
    const memorySorted = [...successful].sort((a, b) => b.memoryDelta.heapUsed - a.memoryDelta.heapUsed);

    return {
      slowestOperations: sorted.slice(0, 5).map(r => ({
        operation: r.operation,
        duration: r.duration.toFixed(2),
        recommendation: this.getOptimizationRecommendation(r),
      })),
      memoryIntensive: memorySorted.slice(0, 5).map(r => ({
        operation: r.operation,
        memoryDelta: (r.memoryDelta.heapUsed / 1024 / 1024).toFixed(2),
        recommendation: this.getMemoryOptimizationRecommendation(r),
      })),
    };
  }

  getOptimizationRecommendation(result) {
    if (result.operation.includes('Sequential')) {
      return 'Consider parallelizing operations for better performance';
    }
    if (result.operation.includes('Template')) {
      return 'Cache compiled templates and optimize template complexity';
    }
    if (result.operation.includes('File')) {
      return 'Use streaming for large files and implement file operation batching';
    }
    if (result.operation.includes('Array Processing')) {
      return 'Consider using native array methods or streaming for large datasets';
    }
    return 'Profile individual operations to identify specific bottlenecks';
  }

  getMemoryOptimizationRecommendation(result) {
    if (result.memoryDelta.heapUsed > 100 * 1024 * 1024) { // 100MB
      return 'High memory usage detected - implement streaming or chunking';
    }
    if (result.operation.includes('String')) {
      return 'Use StringBuilder pattern or streaming for large string operations';
    }
    if (result.operation.includes('Array')) {
      return 'Process arrays in chunks to reduce memory pressure';
    }
    return 'Monitor for memory leaks and implement proper cleanup';
  }

  async run() {
    console.log('🚀 Starting comprehensive performance benchmarks...');
    console.log(`System: ${this.systemInfo.platform} ${this.systemInfo.arch}`);
    console.log(`Node.js: ${this.systemInfo.nodeVersion}`);
    console.log(`CPU: ${this.systemInfo.cpuModel} (${this.systemInfo.cpuCount} cores)`);
    console.log(`Memory: ${(this.systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2)}GB total\n`);

    await this.runMemoryBenchmarks();
    await this.runExecutionBenchmarks();
    await this.runTemplateRenderingBenchmarks();
    await this.runFileOperationBenchmarks();
    await this.runCLIBenchmarks();
    await this.runConcurrentOperationBenchmarks();

    console.log('\n📊 Generating performance report...');
    return this.generateReport();
  }
}

async function main() {
  const runner = new BenchmarkRunner();
  const report = await runner.run();

  // Save detailed results
  await fs.ensureDir('tests/benchmarks');
  await fs.writeFile(
    'tests/benchmarks/performance-results.json',
    JSON.stringify(report, null, 2)
  );

  // Generate readable report
  const readableReport = `
Performance Benchmark Report
============================
Generated: ${report.summary.timestamp}

System Information:
  Platform: ${report.systemInfo.platform} (${report.systemInfo.arch})
  Node.js: ${report.systemInfo.nodeVersion}
  CPU: ${report.systemInfo.cpuModel} (${report.systemInfo.cpuCount} cores)
  Memory: ${(report.systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2)}GB total

Performance Summary:
  Total Operations: ${report.summary.totalOperations}
  Successful: ${report.summary.successfulOperations}
  Failed: ${report.summary.failedOperations}
  
  Duration Metrics (ms):
    Total: ${report.summary.totalDuration}
    Average: ${report.summary.averageDuration}
    Min: ${report.summary.minDuration}
    Max: ${report.summary.maxDuration}
    P95: ${report.summary.p95Duration}
    P99: ${report.summary.p99Duration}

  Memory Usage:
    Total Delta: ${report.summary.totalMemoryDelta}MB
    Average Delta: ${report.summary.averageMemoryDelta}MB

Bottleneck Analysis:
  
  Slowest Operations:
${report.bottlenecks.slowestOperations.map((op, i) => 
  `    ${i + 1}. ${op.operation}: ${op.duration}ms\n       → ${op.recommendation}`
).join('\n')}

  Memory Intensive Operations:
${report.bottlenecks.memoryIntensive.map((op, i) => 
  `    ${i + 1}. ${op.operation}: ${op.memoryDelta}MB\n       → ${op.recommendation}`
).join('\n')}

Individual Results:
${report.results.filter(r => r.success).map(r => 
  `  ${r.operation}: ${r.duration.toFixed(2)}ms (${(r.memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB)`
).join('\n')}

${report.results.filter(r => !r.success).length > 0 ? `
Failed Operations:
${report.results.filter(r => !r.success).map(r => 
  `  ${r.operation}: FAILED - ${r.error}`
).join('\n')}
` : ''}
  `;

  await fs.writeFile('tests/benchmarks/performance-report.txt', readableReport);

  console.log('\n' + readableReport);
  console.log('\n✅ Benchmark complete! Results saved to tests/benchmarks/');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { BenchmarkRunner };