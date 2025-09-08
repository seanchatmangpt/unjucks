#!/usr/bin/env node

const { performance } = require('perf_hooks');
const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

class MemoryBenchmark {
  constructor() {
    this.results = {
      baseline: {},
      templateRendering: {},
      fileOperations: {},
      concurrentOps: {},
      cliResponses: {}
    };
  }

  async measureMemoryUsage(testName, testFn) {
    const startMemory = process.memoryUsage();
    const startTime = performance.now();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const initialRSS = startMemory.rss;
    const initialHeapUsed = startMemory.heapUsed;
    const initialHeapTotal = startMemory.heapTotal;
    
    try {
      await testFn();
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      const result = {
        duration: endTime - startTime,
        memoryDelta: {
          rss: endMemory.rss - initialRSS,
          heapUsed: endMemory.heapUsed - initialHeapUsed,
          heapTotal: endMemory.heapTotal - initialHeapTotal,
          external: endMemory.external - startMemory.external
        },
        memoryPeak: {
          rss: endMemory.rss,
          heapUsed: endMemory.heapUsed,
          heapTotal: endMemory.heapTotal,
          external: endMemory.external
        }
      };
      
      this.results[testName] = result;
      console.log(`✅ ${testName}: ${Math.round(result.duration)}ms, RSS: ${Math.round(result.memoryDelta.rss / 1024 / 1024)}MB`);
      return result;
    } catch (error) {
      console.error(`❌ ${testName} failed:`, error.message);
      this.results[testName] = { error: error.message };
    }
  }

  async benchmarkTemplateRendering() {
    const nunjucks = require('nunjucks');
    const env = new nunjucks.Environment();
    
    return this.measureMemoryUsage('templateRendering', async () => {
      // Simulate heavy template rendering
      const template = `
        {% for i in range(1000) %}
          <div class="item-{{ i }}">
            <h2>{{ title }} - Item {{ i }}</h2>
            <p>{{ description | truncate(100) }}</p>
            {% for prop in properties %}
              <span>{{ prop.key }}: {{ prop.value }}</span>
            {% endfor %}
          </div>
        {% endfor %}
      `;
      
      const data = {
        title: "Performance Test",
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(10),
        properties: Array.from({length: 50}, (_, i) => ({
          key: `property${i}`,
          value: `value${i}`.repeat(5)
        }))
      };
      
      // Render template 100 times
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(new Promise(resolve => {
          const result = env.renderString(template, data);
          resolve(result.length);
        }));
      }
      
      const results = await Promise.all(promises);
      return results.reduce((sum, len) => sum + len, 0);
    });
  }

  async benchmarkFileOperations() {
    return this.measureMemoryUsage('fileOperations', async () => {
      const testDir = path.join(__dirname, 'clean-room', 'file-test');
      await fs.mkdir(testDir, { recursive: true });
      
      // Create 1000 files concurrently
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        const content = `Test file ${i}\n`.repeat(100);
        promises.push(fs.writeFile(path.join(testDir, `test${i}.txt`), content));
      }
      
      await Promise.all(promises);
      
      // Read all files back
      const files = await fs.readdir(testDir);
      const readPromises = files.map(file => 
        fs.readFile(path.join(testDir, file), 'utf8')
      );
      
      const contents = await Promise.all(readPromises);
      
      // Cleanup
      await fs.rm(testDir, { recursive: true, force: true });
      
      return contents.reduce((sum, content) => sum + content.length, 0);
    });
  }

  async benchmarkConcurrentOperations() {
    return this.measureMemoryUsage('concurrentOps', async () => {
      const workers = [];
      
      // Spawn 20 concurrent operations
      for (let i = 0; i < 20; i++) {
        workers.push(this.simulateWork(i));
      }
      
      return Promise.all(workers);
    });
  }

  async simulateWork(id) {
    // Simulate CPU and memory intensive work
    const data = new Array(10000).fill(0).map((_, i) => ({
      id: `${id}_${i}`,
      data: Math.random().toString(36).repeat(100)
    }));
    
    // Sort and filter operations
    data.sort((a, b) => a.id.localeCompare(b.id));
    const filtered = data.filter((_, i) => i % 2 === 0);
    
    return filtered.length;
  }

  async benchmarkCLIResponse() {
    return this.measureMemoryUsage('cliResponses', async () => {
      return new Promise((resolve, reject) => {
        // Test CLI response time
        const startTime = performance.now();
        const child = spawn('node', ['-e', 'console.log("CLI test")'], {
          stdio: 'pipe'
        });
        
        let output = '';
        child.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        child.on('close', (code) => {
          const endTime = performance.now();
          if (code === 0) {
            resolve({
              duration: endTime - startTime,
              output: output.trim()
            });
          } else {
            reject(new Error(`CLI process exited with code ${code}`));
          }
        });
        
        child.on('error', reject);
      });
    });
  }

  async runAllBenchmarks() {
    console.log('🧪 Starting Clean Room Performance Benchmarks...\n');
    
    // Baseline measurement
    await this.measureMemoryUsage('baseline', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    // Run all benchmarks
    await this.benchmarkTemplateRendering();
    await this.benchmarkFileOperations();
    await this.benchmarkConcurrentOperations();
    await this.benchmarkCLIResponse();
    
    // Generate summary
    this.generateSummary();
    
    return this.results;
  }

  generateSummary() {
    console.log('\n📊 Performance Benchmark Summary:');
    console.log('=====================================');
    
    Object.entries(this.results).forEach(([test, result]) => {
      if (result.error) {
        console.log(`❌ ${test}: FAILED - ${result.error}`);
      } else if (result.duration !== undefined) {
        const memMB = Math.round(result.memoryDelta?.rss / 1024 / 1024) || 0;
        console.log(`✅ ${test}: ${Math.round(result.duration)}ms, Memory: ${memMB}MB`);
      }
    });
  }

  async saveResults() {
    const resultsPath = path.join(__dirname, 'results', 'clean-room-benchmark.json');
    await fs.mkdir(path.dirname(resultsPath), { recursive: true });
    
    const fullResults = {
      timestamp: new Date().toISOString(),
      environment: 'clean-room',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      results: this.results
    };
    
    await fs.writeFile(resultsPath, JSON.stringify(fullResults, null, 2));
    console.log(`\n💾 Results saved to: ${resultsPath}`);
    
    return fullResults;
  }
}

// Run if called directly
if (require.main === module) {
  const benchmark = new MemoryBenchmark();
  benchmark.runAllBenchmarks()
    .then(() => benchmark.saveResults())
    .catch(console.error);
}

module.exports = MemoryBenchmark;