#!/usr/bin/env node

const { performance } = require('perf_hooks');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class SimpleBenchmark {
  constructor() {
    this.results = [];
    this.systemInfo = this.getSystemInfo();
  }

  getSystemInfo() {
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
    };
  }

  async measure(name, fn) {
    if (global.gc) {
      global.gc();
    }

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

    const benchmark = {
      name,
      duration: end - start,
      memoryDelta: {
        rss: memAfter.rss - memBefore.rss,
        heapUsed: memAfter.heapUsed - memBefore.heapUsed,
        heapTotal: memAfter.heapTotal - memBefore.heapTotal,
      },
      success: !error,
      error,
      timestamp: this.getDeterministicTimestamp(),
    };

    this.results.push(benchmark);
    console.log(`${benchmark.success ? '✓' : '✗'} ${name}: ${benchmark.duration.toFixed(2)}ms`);
    
    return { result, benchmark };
  }

  async runAll() {
    console.log('🚀 Running Performance Benchmarks');
    console.log(`System: ${this.systemInfo.platform} ${this.systemInfo.arch}`);
    console.log(`Node.js: ${this.systemInfo.nodeVersion}`);
    console.log(`CPU: ${this.systemInfo.cpuModel} (${this.systemInfo.cpuCount} cores)`);
    console.log(`Memory: ${(this.systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2)}GB total\n`);

    // Memory benchmarks
    console.log('🧠 Memory Benchmarks:');
    await this.measure('Small Object Creation', async () => {
      const objects = [];
      for (let i = 0; i < 10000; i++) {
        objects.push({ id: i, name: `obj-${i}`, value: Math.random() });
      }
      return objects.length;
    });

    await this.measure('Large Array Creation', async () => {
      const arrays = [];
      for (let i = 0; i < 50; i++) {
        arrays.push(new Array(10000).fill(`data-${i}`));
      }
      return arrays.length;
    });

    // Execution speed benchmarks
    console.log('\n⚡ Execution Speed:');
    await this.measure('Array Map Operations', async () => {
      const data = Array.from({ length: 50000 }, (_, i) => i);
      return data.map(x => x * 2 + 1).length;
    });

    await this.measure('String Processing', async () => {
      const strings = Array.from({ length: 1000 }, (_, i) => `Test String ${i}!@#$`);
      return strings
        .map(s => s.toLowerCase())
        .map(s => s.replace(/[^a-z0-9 -]/g, ''))
        .map(s => s.replace(/\s+/g, '-'))
        .length;
    });

    // Template rendering
    console.log('\n🎨 Template Rendering:');
    const nunjucks = require('nunjucks');
    const env = nunjucks.configure({ autoescape: false });

    await this.measure('Simple Template Rendering', async () => {
      const template = 'Hello {{ name }}! Count: {{ count }}';
      const results = [];
      for (let i = 0; i < 500; i++) {
        results.push(env.renderString(template, { name: `User${i}`, count: i }));
      }
      return results.length;
    });

    await this.measure('Complex Template Rendering', async () => {
      const template = 'User: {{ user.name }} - Items: {% for item in user.items %}{{ item.name }}{% if not loop.last %}, {% endif %}{% endfor %}';
      const data = {
        user: {
          name: 'Test User',
          items: Array.from({ length: 10 }, (_, i) => ({ name: `Item ${i}` }))
        }
      };
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(env.renderString(template, data));
      }
      return results.length;
    });

    // File operations
    console.log('\n📁 File Operations:');
    const testDir = path.join(process.cwd(), 'tests/.tmp/bench-files');
    await fs.ensureDir(testDir);

    await this.measure('Sequential File Writes', async () => {
      for (let i = 0; i < 20; i++) {
        await fs.writeFile(
          path.join(testDir, `seq-${i}.txt`),
          `Content ${i} `.repeat(50)
        );
      }
      return 20;
    });

    await this.measure('Parallel File Writes', async () => {
      const writes = Array.from({ length: 20 }, (_, i) =>
        fs.writeFile(
          path.join(testDir, `par-${i}.txt`),
          `Content ${i} `.repeat(50)
        )
      );
      await Promise.all(writes);
      return writes.length;
    });

    // CLI operations
    console.log('\n⌨️  CLI Operations:');
    await this.measure('Node.js Startup', async () => {
      const { stdout } = await execAsync('node -e "console.log(123)"');
      return parseInt(stdout.trim());
    });

    await this.measure('Package.json Parse', async () => {
      const pkg = await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8');
      return JSON.parse(pkg).name.length;
    });

    // Concurrent operations
    console.log('\n🔄 Concurrent Operations:');
    await this.measure('Promise.all Resolution', async () => {
      const promises = Array.from({ length: 50 }, (_, i) =>
        new Promise(resolve => setTimeout(() => resolve(i), Math.random() * 5))
      );
      const results = await Promise.all(promises);
      return results.length;
    });

    return this.generateReport();
  }

  generateReport() {
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);

    if (successful.length === 0) {
      return { summary: 'No successful operations', results: this.results };
    }

    const durations = successful.map(r => r.duration);
    const memoryDeltas = successful.map(r => r.memoryDelta.heapUsed);

    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const totalMemory = memoryDeltas.reduce((sum, m) => sum + m, 0);

    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;

    const slowest = [...successful].sort((a, b) => b.duration - a.duration).slice(0, 3);
    const memoryHungry = [...successful].sort((a, b) => b.memoryDelta.heapUsed - a.memoryDelta.heapUsed).slice(0, 3);

    return {
      timestamp: this.getDeterministicDate().toISOString(),
      systemInfo: this.systemInfo,
      summary: {
        total: this.results.length,
        successful: successful.length,
        failed: failed.length,
        totalDuration: totalDuration.toFixed(2),
        avgDuration: (totalDuration / successful.length).toFixed(2),
        minDuration: Math.min(...durations).toFixed(2),
        maxDuration: Math.max(...durations).toFixed(2),
        p95Duration: p95.toFixed(2),
        totalMemory: (totalMemory / 1024 / 1024).toFixed(2),
        avgMemory: (totalMemory / successful.length / 1024 / 1024).toFixed(2),
      },
      bottlenecks: {
        slowest: slowest.map(r => ({
          name: r.name,
          duration: r.duration.toFixed(2),
          recommendation: this.getRecommendation(r)
        })),
        memoryIntensive: memoryHungry.map(r => ({
          name: r.name,
          memory: (r.memoryDelta.heapUsed / 1024 / 1024).toFixed(2),
          recommendation: this.getMemoryRecommendation(r)
        }))
      },
      results: this.results
    };
  }

  getRecommendation(result) {
    if (result.name.includes('Sequential')) return 'Parallelize operations';
    if (result.name.includes('Template')) return 'Cache templates and reduce complexity';
    if (result.name.includes('String')) return 'Use efficient string operations';
    return 'Profile specific operations for optimization';
  }

  getMemoryRecommendation(result) {
    if (result.memoryDelta.heapUsed > 10 * 1024 * 1024) return 'Use streaming for large data';
    if (result.name.includes('Array')) return 'Process in chunks';
    return 'Monitor for memory leaks';
  }
}

async function main() {
  const benchmark = new SimpleBenchmark();
  const report = await benchmark.runAll();

  await fs.ensureDir('tests/benchmarks');
  await fs.writeFile(
    'tests/benchmarks/benchmark-results.json',
    JSON.stringify(report, null, 2)
  );

  const textReport = `
Performance Benchmark Report
============================
Generated: ${report.timestamp}

System: ${report.systemInfo.platform} ${report.systemInfo.arch}
Node.js: ${report.systemInfo.nodeVersion}
CPU: ${report.systemInfo.cpuModel} (${report.systemInfo.cpuCount} cores)
Memory: ${(report.systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2)}GB

Summary:
  Operations: ${report.summary.total} (${report.summary.successful} successful, ${report.summary.failed} failed)
  Total Duration: ${report.summary.totalDuration}ms
  Average Duration: ${report.summary.avgDuration}ms
  P95 Duration: ${report.summary.p95Duration}ms
  Total Memory Delta: ${report.summary.totalMemory}MB
  Average Memory Delta: ${report.summary.avgMemory}MB

Bottlenecks:
  Slowest Operations:
${report.bottlenecks.slowest.map((op, i) => `    ${i+1}. ${op.name}: ${op.duration}ms → ${op.recommendation}`).join('\n')}

  Memory Intensive:
${report.bottlenecks.memoryIntensive.map((op, i) => `    ${i+1}. ${op.name}: ${op.memory}MB → ${op.recommendation}`).join('\n')}

All Results:
${report.results.filter(r => r.success).map(r => `  ${r.name}: ${r.duration.toFixed(2)}ms (${(r.memoryDelta.heapUsed / 1024 / 1024).toFixed(2)}MB)`).join('\n')}

${report.results.filter(r => !r.success).length > 0 ? `
Failed Operations:
${report.results.filter(r => !r.success).map(r => `  ${r.name}: ${r.error}`).join('\n')}
` : ''}
`;

  await fs.writeFile('tests/benchmarks/benchmark-report.txt', textReport);

  console.log('\n' + textReport);
  console.log('✅ Benchmark complete! Results saved to tests/benchmarks/');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { SimpleBenchmark };