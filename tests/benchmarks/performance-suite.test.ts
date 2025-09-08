import { describe, it, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as path from 'path';

const execAsync = promisify(exec);

interface BenchmarkResult {
  operation: string;
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: number;
}

interface SystemMetrics {
  nodeVersion: string;
  platform: string;
  cpuCount: number;
  totalMemory: number;
  freeMemory: number;
}

class PerformanceBenchmarker {
  private results: BenchmarkResult[] = [];
  private baselineMemory: NodeJS.MemoryUsage;
  private systemMetrics: SystemMetrics;

  constructor() {
    this.baselineMemory = process.memoryUsage();
    this.systemMetrics = {
      nodeVersion: process.version,
      platform: process.platform,
      cpuCount: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
      freeMemory: require('os').freemem(),
    };
  }

  async benchmark<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    const result = await fn();
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    this.results.push({
      operation,
      duration: endTime - startTime,
      memoryUsage: {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
      },
      timestamp: Date.now(),
    });

    return result;
  }

  async benchmarkCLI(command: string): Promise<BenchmarkResult> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    try {
      await execAsync(command, { cwd: process.cwd() });
    } catch (error) {
      // Command might fail in benchmark context, that's OK
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    const result = {
      operation: `CLI: ${command}`,
      duration: endTime - startTime,
      memoryUsage: {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
      },
      timestamp: Date.now(),
    };

    this.results.push(result);
    return result;
  }

  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  generateReport(): string {
    const totalOps = this.results.length;
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / totalOps;
    const maxDuration = Math.max(...this.results.map(r => r.duration));
    const minDuration = Math.min(...this.results.map(r => r.duration));

    const totalMemoryDelta = this.results.reduce((sum, r) => sum + r.memoryUsage.heapUsed, 0);
    const avgMemoryDelta = totalMemoryDelta / totalOps;

    return `
Performance Benchmark Report
============================
System: ${this.systemMetrics.platform} - Node ${this.systemMetrics.nodeVersion}
CPUs: ${this.systemMetrics.cpuCount}
Memory: ${(this.systemMetrics.totalMemory / 1024 / 1024 / 1024).toFixed(2)}GB total, ${(this.systemMetrics.freeMemory / 1024 / 1024 / 1024).toFixed(2)}GB free

Operations: ${totalOps}
Duration (ms):
  - Average: ${avgDuration.toFixed(2)}
  - Min: ${minDuration.toFixed(2)}  
  - Max: ${maxDuration.toFixed(2)}

Memory Usage:
  - Average Heap Delta: ${(avgMemoryDelta / 1024 / 1024).toFixed(2)}MB
  - Total Memory Delta: ${(totalMemoryDelta / 1024 / 1024).toFixed(2)}MB

Individual Results:
${this.results.map(r => 
  `  ${r.operation}: ${r.duration.toFixed(2)}ms (${(r.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB)`
).join('\n')}
`;
  }
}

describe('Performance Benchmark Suite', () => {
  let benchmarker: PerformanceBenchmarker;
  let cleanRoomDir: string;

  beforeAll(async () => {
    benchmarker = new PerformanceBenchmarker();
    cleanRoomDir = path.join(process.cwd(), 'tests/.tmp/clean-room-bench');
    await fs.ensureDir(cleanRoomDir);
  });

  afterAll(async () => {
    // Store results in coordination memory
    const report = benchmarker.generateReport();
    const results = benchmarker.getResults();
    
    await fs.writeFile(
      path.join(process.cwd(), 'tests/benchmarks/performance-report.txt'),
      report
    );

    await fs.writeFile(
      path.join(process.cwd(), 'tests/benchmarks/performance-data.json'),
      JSON.stringify({
        systemMetrics: benchmarker.getSystemMetrics(),
        results,
        report,
        timestamp: new Date().toISOString(),
      }, null, 2)
    );

    console.log('Performance Report:');
    console.log(report);
  });

  describe('Memory Usage Benchmarks', () => {
    it('should measure baseline memory consumption', async () => {
      await benchmarker.benchmark('baseline-memory-check', async () => {
        // Simulate typical operations
        const largeArray = new Array(1000000).fill('test');
        await new Promise(resolve => setTimeout(resolve, 10));
        return largeArray.length;
      });
    });

    it('should measure template loading memory usage', async () => {
      await benchmarker.benchmark('template-loading-memory', async () => {
        // Simulate template loading
        const templates = [];
        for (let i = 0; i < 100; i++) {
          templates.push({
            name: `template-${i}`,
            content: 'Sample template content '.repeat(100),
            frontmatter: { to: `output-${i}.js` },
          });
        }
        return templates.length;
      });
    });
  });

  describe('Execution Speed Benchmarks', () => {
    it('should measure CLI response time for list command', async () => {
      await benchmarker.benchmarkCLI('node src/cli.ts list 2>/dev/null || echo "CLI test"');
    });

    it('should measure CLI response time for help command', async () => {
      await benchmarker.benchmarkCLI('node src/cli.ts --help 2>/dev/null || echo "CLI help test"');
    });

    it('should measure concurrent file operations', async () => {
      await benchmarker.benchmark('concurrent-file-ops', async () => {
        const operations = [];
        for (let i = 0; i < 10; i++) {
          operations.push(
            fs.writeFile(
              path.join(cleanRoomDir, `concurrent-${i}.txt`),
              `Content ${i} `.repeat(1000)
            )
          );
        }
        await Promise.all(operations);
        return operations.length;
      });
    });
  });

  describe('Template Rendering Performance', () => {
    it('should measure simple template rendering speed', async () => {
      await benchmarker.benchmark('simple-template-render', async () => {
        const nunjucks = require('nunjucks');
        const env = nunjucks.configure({ autoescape: false });
        
        const template = 'Hello {{ name }}! Your score is {{ score }}.';
        const rendered = [];
        
        for (let i = 0; i < 1000; i++) {
          rendered.push(env.renderString(template, { name: `User${i}`, score: i * 10 }));
        }
        
        return rendered.length;
      });
    });

    it('should measure complex template rendering with loops', async () => {
      await benchmarker.benchmark('complex-template-render', async () => {
        const nunjucks = require('nunjucks');
        const env = nunjucks.configure({ autoescape: false });
        
        const template = `
{% for item in items %}
  - {{ item.name }}: {{ item.value | upper }}
  {% for prop in item.properties %}
    * {{ prop.key }}: {{ prop.value }}
  {% endfor %}
{% endfor %}
        `;
        
        const data = {
          items: Array.from({ length: 100 }, (_, i) => ({
            name: `Item${i}`,
            value: `value-${i}`,
            properties: Array.from({ length: 5 }, (_, j) => ({
              key: `prop${j}`,
              value: `val${i}-${j}`,
            })),
          })),
        };
        
        const result = env.renderString(template, data);
        return result.length;
      });
    });
  });

  describe('File Operation Performance', () => {
    it('should measure sequential file writes', async () => {
      await benchmarker.benchmark('sequential-file-writes', async () => {
        for (let i = 0; i < 50; i++) {
          await fs.writeFile(
            path.join(cleanRoomDir, `sequential-${i}.txt`),
            `Sequential content ${i} `.repeat(100)
          );
        }
        return 50;
      });
    });

    it('should measure parallel file writes', async () => {
      await benchmarker.benchmark('parallel-file-writes', async () => {
        const writes = Array.from({ length: 50 }, (_, i) =>
          fs.writeFile(
            path.join(cleanRoomDir, `parallel-${i}.txt`),
            `Parallel content ${i} `.repeat(100)
          )
        );
        await Promise.all(writes);
        return writes.length;
      });
    });

    it('should measure file injection simulation', async () => {
      await benchmarker.benchmark('file-injection-simulation', async () => {
        // Create base file
        const baseFile = path.join(cleanRoomDir, 'inject-target.js');
        await fs.writeFile(baseFile, 'const existing = "code";\n\n// INJECT_POINT\n\nmodule.exports = existing;');
        
        // Simulate multiple injections
        for (let i = 0; i < 20; i++) {
          const content = await fs.readFile(baseFile, 'utf8');
          const injectedContent = content.replace(
            '// INJECT_POINT',
            `// INJECT_POINT\nconst injected${i} = "value${i}";`
          );
          await fs.writeFile(baseFile, injectedContent);
        }
        
        return 20;
      });
    });
  });

  describe('Filter Processing Speed', () => {
    it('should measure string manipulation filters', async () => {
      await benchmarker.benchmark('string-filters', async () => {
        const nunjucks = require('nunjucks');
        const env = nunjucks.configure({ autoescape: false });
        
        const testStrings = Array.from({ length: 1000 }, (_, i) => `test string ${i}`);
        const results = [];
        
        for (const str of testStrings) {
          results.push(env.renderString('{{ value | upper | replace("STRING", "text") | trim }}', { value: str }));
        }
        
        return results.length;
      });
    });

    it('should measure custom filter processing', async () => {
      await benchmarker.benchmark('custom-filters', async () => {
        const nunjucks = require('nunjucks');
        const env = nunjucks.configure({ autoescape: false });
        
        // Add custom filter
        env.addFilter('slugify', (str) => {
          return str.toLowerCase()
            .replace(/[^a-z0-9 -]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
        });
        
        const testStrings = Array.from({ length: 500 }, (_, i) => `Test String ${i}! With Special Characters @#$%`);
        const results = [];
        
        for (const str of testStrings) {
          results.push(env.renderString('{{ value | slugify }}', { value: str }));
        }
        
        return results.length;
      });
    });
  });
});