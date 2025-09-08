#!/usr/bin/env node

import { performance } from 'perf_hooks';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

class PerformanceBenchmarker {
  constructor() {
    this.results = [];
    this.systemInfo = this.getSystemInfo();
  }

  getSystemInfo() {
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

  async measure(name, fn) {
    // Force garbage collection if available
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
        external: memAfter.external - memBefore.external,
        arrayBuffers: memAfter.arrayBuffers - memBefore.arrayBuffers,
      },
      success: !error,
      error,
      timestamp: Date.now(),
    };

    this.results.push(benchmark);
    console.log(`${benchmark.success ? '✓' : '✗'} ${name}: ${benchmark.duration.toFixed(2)}ms`);
    
    return { result, benchmark };
  }

  async runComprehensiveBenchmarks() {
    console.log('🚀 Comprehensive Performance Benchmarking Suite');
    console.log(`System: ${this.systemInfo.platform} ${this.systemInfo.arch}`);
    console.log(`Node.js: ${this.systemInfo.nodeVersion}`);
    console.log(`CPU: ${this.systemInfo.cpuModel} (${this.systemInfo.cpuCount} cores)`);
    console.log(`Memory: ${(this.systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2)}GB total`);
    console.log(`Load Average: ${this.systemInfo.loadAverage.map(l => l.toFixed(2)).join(', ')}\n`);

    // Memory Usage Benchmarks
    console.log('🧠 Memory Usage Benchmarks:');
    await this.measure('Small Object Allocation (10k objects)', async () => {
      const objects = [];
      for (let i = 0; i < 10000; i++) {
        objects.push({ 
          id: i, 
          name: `object-${i}`, 
          value: Math.random(),
          metadata: { created: Date.now(), type: 'test' }
        });
      }
      return objects.length;
    });

    await this.measure('Large Array Creation (100x10k arrays)', async () => {
      const arrays = [];
      for (let i = 0; i < 100; i++) {
        arrays.push(new Array(10000).fill(`data-item-${i}`));
      }
      return arrays.reduce((total, arr) => total + arr.length, 0);
    });

    await this.measure('String Concatenation (1k iterations)', async () => {
      let largeString = '';
      for (let i = 0; i < 1000; i++) {
        largeString += `String segment ${i} with some content `.repeat(50);
      }
      return largeString.length;
    });

    // Execution Speed Benchmarks
    console.log('\n⚡ Execution Speed Benchmarks:');
    await this.measure('Array Map Operations (100k elements)', async () => {
      const data = Array.from({ length: 100000 }, (_, i) => i);
      return data.map(x => x * 2 + 1).reduce((sum, x) => sum + x, 0);
    });

    await this.measure('Array Filter + Map Chain (100k elements)', async () => {
      const data = Array.from({ length: 100000 }, (_, i) => i);
      return data
        .filter(x => x % 3 === 0)
        .map(x => x * 2)
        .filter(x => x > 1000)
        .length;
    });

    await this.measure('Complex String Processing (1k strings)', async () => {
      const strings = Array.from({ length: 1000 }, (_, i) => 
        `Complex Test String ${i}! @#$%^&*()_+ Special Characters 12345`
      );
      return strings
        .map(s => s.toLowerCase())
        .map(s => s.replace(/[^a-z0-9 -]/g, ''))
        .map(s => s.replace(/\s+/g, '-'))
        .map(s => s.substring(0, 50))
        .filter(s => s.length > 10)
        .length;
    });

    await this.measure('Object Transformation (10k objects)', async () => {
      const objects = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Object ${i}`,
        data: { 
          value: i * 2, 
          nested: { deep: i * 3, deeper: { value: i * 4 } },
          array: Array.from({ length: 5 }, (_, j) => j * i)
        },
      }));

      return objects
        .map(obj => ({ ...obj, processed: true, timestamp: Date.now() }))
        .filter(obj => obj.id % 7 === 0)
        .map(obj => ({ ...obj, data: { ...obj.data, computed: obj.data.value * 2 } }))
        .length;
    });

    // Template Rendering Performance
    console.log('\n🎨 Template Rendering Performance:');
    
    // Import nunjucks dynamically
    const nunjucks = await import('nunjucks').then(m => m.default);
    const env = nunjucks.configure({ autoescape: false });

    await this.measure('Simple Template Rendering (1k renders)', async () => {
      const template = 'Hello {{ name }}! You have {{ count }} items. Status: {{ status | upper }}';
      const results = [];
      
      for (let i = 0; i < 1000; i++) {
        results.push(env.renderString(template, { 
          name: `User${i}`, 
          count: i * 10,
          status: i % 2 === 0 ? 'active' : 'inactive'
        }));
      }
      
      return results.join('').length;
    });

    await this.measure('Complex Template with Loops (100 renders)', async () => {
      const template = `
{% for user in users %}
User: {{ user.name }} ({{ user.email }})
{% for item in user.items %}
  - {{ item.name }}: ${{ item.price }} ({{ item.category }})
  {% if item.sale %}SALE: {{ item.sale }}% OFF{% endif %}
{% endfor %}
{% if user.premium %}★ PREMIUM USER {% endif %}
{% endfor %}
      `;

      const results = [];
      for (let i = 0; i < 100; i++) {
        const data = {
          users: Array.from({ length: 10 }, (_, j) => ({
            name: `User ${i}-${j}`,
            email: `user${i}${j}@example.com`,
            premium: Math.random() > 0.7,
            items: Array.from({ length: 3 }, (_, k) => ({
              name: `Item ${k}`,
              price: Math.round(Math.random() * 100 * 100) / 100,
              category: ['electronics', 'books', 'clothing'][k % 3],
              sale: Math.random() > 0.8 ? Math.round(Math.random() * 50) : null,
            })),
          })),
        };
        results.push(env.renderString(template, data));
      }

      return results.join('').length;
    });

    await this.measure('Template with Custom Filters (500 renders)', async () => {
      env.addFilter('slugify', (str) => {
        return str.toLowerCase()
          .replace(/[^a-z0-9 -]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
      });

      env.addFilter('currency', (amount) => {
        return `$${amount.toFixed(2)}`;
      });

      const template = '{{ title | slugify }}: {{ description | truncate(100) }} - {{ price | currency }}';
      const results = [];

      for (let i = 0; i < 500; i++) {
        results.push(env.renderString(template, {
          title: `Product Title ${i} with Special Characters!@# & Symbols`,
          description: `This is a detailed description for product ${i} `.repeat(10),
          price: Math.random() * 1000,
        }));
      }

      return results.join('').length;
    });

    // File Operation Performance
    console.log('\n📁 File Operation Performance:');
    const testDir = path.join(process.cwd(), 'tests/.tmp/perf-files');
    await fs.ensureDir(testDir);

    await this.measure('Sequential File Writes (50 files)', async () => {
      for (let i = 0; i < 50; i++) {
        await fs.writeFile(
          path.join(testDir, `sequential-${i}.txt`),
          `Sequential file content ${i}\n`.repeat(100) + JSON.stringify({
            id: i,
            timestamp: Date.now(),
            data: Array.from({ length: 20 }, (_, j) => `data-${j}`)
          }, null, 2)
        );
      }
      return 50;
    });

    await this.measure('Parallel File Writes (50 files)', async () => {
      const writes = Array.from({ length: 50 }, (_, i) =>
        fs.writeFile(
          path.join(testDir, `parallel-${i}.txt`),
          `Parallel file content ${i}\n`.repeat(100) + JSON.stringify({
            id: i,
            timestamp: Date.now(),
            data: Array.from({ length: 20 }, (_, j) => `data-${j}`)
          }, null, 2)
        )
      );
      await Promise.all(writes);
      return writes.length;
    });

    await this.measure('File Read and Parse Operations (25 files)', async () => {
      const reads = [];
      for (let i = 0; i < 25; i++) {
        reads.push(fs.readFile(path.join(testDir, `sequential-${i}.txt`), 'utf8'));
      }
      const contents = await Promise.all(reads);
      return contents.reduce((sum, content) => {
        const lines = content.split('\n');
        const jsonPart = lines.slice(100).join('\n');
        try {
          const parsed = JSON.parse(jsonPart);
          return sum + parsed.data.length;
        } catch {
          return sum;
        }
      }, 0);
    });

    await this.measure('File Injection Simulation (10 iterations)', async () => {
      const targetFile = path.join(testDir, 'inject-target.js');
      const baseContent = `
const config = {
  version: "1.0.0",
  environment: "test"
};

// INJECT_POINT

module.exports = config;
      `;
      
      await fs.writeFile(targetFile, baseContent);

      for (let i = 0; i < 10; i++) {
        const content = await fs.readFile(targetFile, 'utf8');
        const injected = content.replace(
          '// INJECT_POINT',
          `// INJECT_POINT\nconst feature${i} = {\n  name: "feature${i}",\n  enabled: true,\n  config: ${JSON.stringify({ id: i, timestamp: Date.now() })}\n};`
        );
        await fs.writeFile(targetFile, injected);
      }

      const finalContent = await fs.readFile(targetFile, 'utf8');
      return finalContent.split('\n').length;
    });

    // CLI Response Time Benchmarks
    console.log('\n⌨️  CLI Response Time Benchmarks:');
    
    await this.measure('Node.js Startup Time', async () => {
      const start = Date.now();
      const { stdout } = await execAsync('node -e "console.log(Date.now() - process.env.START_TIME)"', {
        env: { ...process.env, START_TIME: start.toString() }
      });
      return parseInt(stdout.trim()) || 0;
    });

    await this.measure('Package.json Parsing', async () => {
      const pkg = await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8');
      const parsed = JSON.parse(pkg);
      return Object.keys(parsed.dependencies || {}).length + Object.keys(parsed.devDependencies || {}).length;
    });

    await this.measure('CLI Help Command (if available)', async () => {
      try {
        const { stdout, stderr } = await execAsync('node src/cli.ts --help', { 
          timeout: 3000,
          cwd: process.cwd()
        });
        return (stdout + stderr).length;
      } catch (error) {
        return 0; // CLI might not be implemented yet
      }
    });

    // Concurrent Operations
    console.log('\n🔄 Concurrent Operations:');
    
    await this.measure('Promise.all with Mixed Operations (100 promises)', async () => {
      const promises = [];
      
      // Mix of different async operations
      for (let i = 0; i < 30; i++) {
        promises.push(new Promise(resolve => setTimeout(() => resolve(i * 2), Math.random() * 5)));
      }
      
      for (let i = 0; i < 30; i++) {
        promises.push(fs.readFile(__filename, 'utf8').then(content => content.length));
      }
      
      for (let i = 0; i < 40; i++) {
        promises.push(Promise.resolve(Math.random() * 1000));
      }

      const results = await Promise.all(promises);
      return results.reduce((sum, result) => sum + (typeof result === 'number' ? result : 0), 0);
    });

    await this.measure('CPU-Intensive Concurrent Tasks (10 workers)', async () => {
      const workers = Array.from({ length: 10 }, (_, i) => 
        new Promise(resolve => {
          // Simulate CPU-intensive task
          let sum = 0;
          for (let j = 0; j < 100000; j++) {
            sum += Math.sqrt(j * i + 1);
          }
          resolve(sum);
        })
      );

      const results = await Promise.all(workers);
      return results.reduce((total, sum) => total + sum, 0);
    });

    await this.measure('Mixed I/O and CPU Operations (20 operations)', async () => {
      const operations = [];
      
      // File operations
      for (let i = 0; i < 5; i++) {
        operations.push(fs.writeFile(
          path.join(testDir, `mixed-${i}.json`),
          JSON.stringify({ id: i, data: Array.from({ length: 100 }, (_, j) => j) })
        ).then(() => i));
      }
      
      // CPU operations
      for (let i = 0; i < 10; i++) {
        operations.push(new Promise(resolve => {
          let result = 0;
          for (let j = 0; j < 50000; j++) {
            result += Math.sin(j) * Math.cos(i);
          }
          resolve(result);
        }));
      }
      
      // Network-like delays
      for (let i = 0; i < 5; i++) {
        operations.push(new Promise(resolve => 
          setTimeout(() => resolve(Math.random() * 100), Math.random() * 10)
        ));
      }

      const results = await Promise.all(operations);
      return results.length;
    });

    return this.generateDetailedReport();
  }

  generateDetailedReport() {
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);

    if (successful.length === 0) {
      return {
        error: 'No successful operations to analyze',
        failed: failed.length,
        results: this.results
      };
    }

    const durations = successful.map(r => r.duration);
    const memoryDeltas = successful.map(r => r.memoryDelta.heapUsed);

    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const totalMemory = memoryDeltas.reduce((sum, m) => sum + m, 0);

    durations.sort((a, b) => a - b);
    const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] || 0;

    // Identify bottlenecks
    const slowest = [...successful].sort((a, b) => b.duration - a.duration).slice(0, 5);
    const memoryHungry = [...successful].sort((a, b) => b.memoryDelta.heapUsed - a.memoryDelta.heapUsed).slice(0, 5);

    const report = {
      timestamp: new Date().toISOString(),
      environment: 'development',
      systemInfo: this.systemInfo,
      summary: {
        totalOperations: this.results.length,
        successful: successful.length,
        failed: failed.length,
        totalDuration: parseFloat(totalDuration.toFixed(2)),
        averageDuration: parseFloat((totalDuration / successful.length).toFixed(2)),
        medianDuration: parseFloat(p50.toFixed(2)),
        minDuration: parseFloat(Math.min(...durations).toFixed(2)),
        maxDuration: parseFloat(Math.max(...durations).toFixed(2)),
        p95Duration: parseFloat(p95.toFixed(2)),
        p99Duration: parseFloat(p99.toFixed(2)),
        totalMemoryDelta: parseFloat((totalMemory / 1024 / 1024).toFixed(2)),
        averageMemoryDelta: parseFloat((totalMemory / successful.length / 1024 / 1024).toFixed(2)),
      },
      bottleneckAnalysis: {
        slowestOperations: slowest.map(r => ({
          name: r.name,
          duration: parseFloat(r.duration.toFixed(2)),
          memoryDelta: parseFloat((r.memoryDelta.heapUsed / 1024 / 1024).toFixed(2)),
          recommendation: this.getOptimizationRecommendation(r),
          category: this.categorizeOperation(r.name)
        })),
        memoryIntensive: memoryHungry.map(r => ({
          name: r.name,
          memoryDelta: parseFloat((r.memoryDelta.heapUsed / 1024 / 1024).toFixed(2)),
          duration: parseFloat(r.duration.toFixed(2)),
          recommendation: this.getMemoryRecommendation(r),
          category: this.categorizeOperation(r.name)
        }))
      },
      categoryAnalysis: this.analyzeBenchmarkCategories(successful),
      results: this.results.map(r => ({
        ...r,
        duration: parseFloat(r.duration.toFixed(2)),
        memoryDelta: {
          ...r.memoryDelta,
          heapUsed: parseFloat((r.memoryDelta.heapUsed / 1024 / 1024).toFixed(2)),
          rss: parseFloat((r.memoryDelta.rss / 1024 / 1024).toFixed(2)),
          heapTotal: parseFloat((r.memoryDelta.heapTotal / 1024 / 1024).toFixed(2))
        }
      }))
    };

    return report;
  }

  categorizeOperation(name) {
    if (name.toLowerCase().includes('memory') || name.toLowerCase().includes('allocation')) return 'memory';
    if (name.toLowerCase().includes('array') || name.toLowerCase().includes('string') || name.toLowerCase().includes('object')) return 'computation';
    if (name.toLowerCase().includes('template')) return 'templating';
    if (name.toLowerCase().includes('file')) return 'file-io';
    if (name.toLowerCase().includes('cli') || name.toLowerCase().includes('startup')) return 'cli';
    if (name.toLowerCase().includes('concurrent') || name.toLowerCase().includes('promise')) return 'concurrency';
    return 'other';
  }

  analyzeBenchmarkCategories(results) {
    const categories = {};
    
    results.forEach(result => {
      const category = this.categorizeOperation(result.name);
      if (!categories[category]) {
        categories[category] = {
          count: 0,
          totalDuration: 0,
          totalMemory: 0,
          operations: []
        };
      }
      
      categories[category].count++;
      categories[category].totalDuration += result.duration;
      categories[category].totalMemory += result.memoryDelta.heapUsed;
      categories[category].operations.push(result.name);
    });

    Object.keys(categories).forEach(category => {
      const cat = categories[category];
      cat.averageDuration = parseFloat((cat.totalDuration / cat.count).toFixed(2));
      cat.averageMemory = parseFloat((cat.totalMemory / cat.count / 1024 / 1024).toFixed(2));
      cat.totalMemory = parseFloat((cat.totalMemory / 1024 / 1024).toFixed(2));
      cat.totalDuration = parseFloat(cat.totalDuration.toFixed(2));
    });

    return categories;
  }

  getOptimizationRecommendation(result) {
    const name = result.name.toLowerCase();
    
    if (name.includes('sequential')) {
      return 'Parallelize operations using Promise.all() or worker threads for CPU-intensive tasks';
    }
    if (name.includes('template')) {
      return 'Cache compiled templates, reduce template complexity, and consider template streaming';
    }
    if (name.includes('file')) {
      return 'Use streaming for large files, implement file operation batching, and consider worker threads';
    }
    if (name.includes('array') || name.includes('object')) {
      return 'Process data in chunks, use efficient algorithms, and consider lazy evaluation';
    }
    if (name.includes('string')) {
      return 'Use StringBuilder pattern, avoid repeated string concatenation, and consider streaming';
    }
    if (name.includes('memory') || name.includes('allocation')) {
      return 'Implement object pooling, use WeakMap for caching, and consider streaming for large datasets';
    }
    if (result.duration > 1000) {
      return 'Consider breaking down into smaller operations, use caching, or implement background processing';
    }
    
    return 'Profile specific implementation to identify optimization opportunities';
  }

  getMemoryRecommendation(result) {
    const memoryMB = result.memoryDelta.heapUsed / 1024 / 1024;
    
    if (memoryMB > 50) {
      return 'High memory usage - implement streaming, chunking, or background garbage collection';
    }
    if (memoryMB > 20) {
      return 'Moderate memory usage - consider object pooling and efficient data structures';
    }
    if (result.name.toLowerCase().includes('string')) {
      return 'String operations can be memory-intensive - use efficient string handling techniques';
    }
    if (result.name.toLowerCase().includes('array')) {
      return 'Process arrays in smaller chunks to reduce memory pressure';
    }
    
    return 'Monitor for memory leaks and implement proper cleanup procedures';
  }
}

async function main() {
  console.log('Starting comprehensive performance benchmark suite...\n');
  
  const benchmarker = new PerformanceBenchmarker();
  const report = await benchmarker.runComprehensiveBenchmarks();

  // Save results
  const outputDir = path.join(process.cwd(), 'tests/benchmarks');
  await fs.ensureDir(outputDir);
  
  await fs.writeFile(
    path.join(outputDir, 'comprehensive-benchmark-results.json'),
    JSON.stringify(report, null, 2)
  );

  // Generate readable report
  const readableReport = `
Comprehensive Performance Benchmark Report
==========================================
Generated: ${report.timestamp}
Environment: ${report.environment}

System Information:
  Platform: ${report.systemInfo.platform} (${report.systemInfo.arch})
  Node.js: ${report.systemInfo.nodeVersion}
  CPU: ${report.systemInfo.cpuModel} (${report.systemInfo.cpuCount} cores)
  Memory: ${(report.systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2)}GB total
  Load Average: ${report.systemInfo.loadAverage.map(l => l.toFixed(2)).join(', ')}

Performance Summary:
  Total Operations: ${report.summary.totalOperations}
  Successful: ${report.summary.successful}
  Failed: ${report.summary.failed}
  
  Duration Metrics (ms):
    Total: ${report.summary.totalDuration}ms
    Average: ${report.summary.averageDuration}ms
    Median: ${report.summary.medianDuration}ms
    Min: ${report.summary.minDuration}ms
    Max: ${report.summary.maxDuration}ms
    P95: ${report.summary.p95Duration}ms
    P99: ${report.summary.p99Duration}ms

  Memory Usage:
    Total Delta: ${report.summary.totalMemoryDelta}MB
    Average Delta: ${report.summary.averageMemoryDelta}MB

Category Analysis:
${Object.entries(report.categoryAnalysis).map(([category, data]) => `
  ${category.toUpperCase()}:
    Operations: ${data.count}
    Avg Duration: ${data.averageDuration}ms
    Avg Memory: ${data.averageMemory}MB
    Total Duration: ${data.totalDuration}ms`).join('')}

Critical Bottlenecks:

  Slowest Operations:
${report.bottleneckAnalysis.slowestOperations.map((op, i) => `    ${i + 1}. [${op.category.toUpperCase()}] ${op.name}
       Duration: ${op.duration}ms | Memory: ${op.memoryDelta}MB
       → ${op.recommendation}`).join('\n')}

  Memory Intensive Operations:
${report.bottleneckAnalysis.memoryIntensive.map((op, i) => `    ${i + 1}. [${op.category.toUpperCase()}] ${op.name}
       Memory: ${op.memoryDelta}MB | Duration: ${op.duration}ms
       → ${op.recommendation}`).join('\n')}

Individual Results:
${report.results.filter(r => r.success).map(r => 
  `  [${r.duration.toString().padStart(8)}ms] [${r.memoryDelta.heapUsed.toString().padStart(6)}MB] ${r.name}`
).join('\n')}

${report.results.filter(r => !r.success).length > 0 ? `
Failed Operations:
${report.results.filter(r => !r.success).map(r => 
  `  ✗ ${r.name}: ${r.error}`
).join('\n')}
` : ''}

Optimization Recommendations:
1. Focus on the slowest operations in each category
2. Implement parallel processing where possible
3. Use streaming for large data operations
4. Cache frequently accessed data and compiled templates
5. Monitor memory usage and implement cleanup procedures
6. Consider worker threads for CPU-intensive tasks
7. Profile specific implementations for micro-optimizations
`;

  await fs.writeFile(
    path.join(outputDir, 'comprehensive-benchmark-report.txt'),
    readableReport
  );

  console.log('\n' + readableReport);
  console.log(`\n✅ Comprehensive benchmark complete!`);
  console.log(`📁 Results saved to: ${outputDir}/`);
  console.log(`📊 JSON data: comprehensive-benchmark-results.json`);
  console.log(`📋 Text report: comprehensive-benchmark-report.txt`);

  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { PerformanceBenchmarker };