#!/usr/bin/env node

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { performance } = require('perf_hooks');
const fs = require('fs/promises');
const path = require('path');

class ConcurrencyStressTest {
  constructor() {
    this.results = {
      singleThread: {},
      multiThread: {},
      resourceContention: {},
      scalability: {}
    };
  }

  async measureConcurrentPerformance(testName, concurrency, workFn) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    console.log(`🔄 Running ${testName} with ${concurrency} concurrent operations...`);
    
    try {
      const promises = [];
      for (let i = 0; i < concurrency; i++) {
        promises.push(workFn(i));
      }
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      const result = {
        concurrency,
        duration: endTime - startTime,
        throughput: concurrency / ((endTime - startTime) / 1000), // ops per second
        memoryDelta: endMemory.rss - startMemory.rss,
        successCount: results.filter(r => r !== null).length,
        results: results
      };
      
      this.results[testName] = result;
      console.log(`✅ ${testName}: ${Math.round(result.duration)}ms, Throughput: ${Math.round(result.throughput)} ops/sec`);
      
      return result;
    } catch (error) {
      console.error(`❌ ${testName} failed:`, error.message);
      this.results[testName] = { error: error.message };
      return null;
    }
  }

  async testSingleThreadPerformance() {
    return this.measureConcurrentPerformance('singleThread', 1, async (id) => {
      // CPU intensive task
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i) * Math.sin(i);
      }
      return result;
    });
  }

  async testMultiThreadPerformance() {
    const workerCount = require('os').cpus().length;
    
    return this.measureConcurrentPerformance('multiThread', workerCount, async (id) => {
      return new Promise((resolve, reject) => {
        const worker = new Worker(__filename, {
          workerData: { workerId: id, task: 'cpu-intensive' }
        });
        
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });
    });
  }

  async testResourceContention() {
    const testDir = path.join(__dirname, 'clean-room', 'contention-test');
    await fs.mkdir(testDir, { recursive: true });
    
    return this.measureConcurrentPerformance('resourceContention', 50, async (id) => {
      const filePath = path.join(testDir, `contention-${id}.txt`);
      const content = `Worker ${id} data\n`.repeat(1000);
      
      // Write, read, and delete file
      await fs.writeFile(filePath, content);
      const readContent = await fs.readFile(filePath, 'utf8');
      await fs.unlink(filePath);
      
      return readContent.length;
    });
  }

  async testScalability() {
    const results = {};
    const scales = [1, 5, 10, 25, 50, 100, 200];
    
    for (const scale of scales) {
      console.log(`📈 Testing scalability at ${scale} concurrent operations...`);
      
      const result = await this.measureConcurrentPerformance(`scale_${scale}`, scale, async (id) => {
        // Mixed workload: CPU + I/O
        const data = new Array(1000).fill(0).map((_, i) => Math.random());
        data.sort();
        
        // Simulate async I/O
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        
        return data.reduce((sum, val) => sum + val, 0);
      });
      
      if (result) {
        results[scale] = {
          duration: result.duration,
          throughput: result.throughput,
          memoryDelta: result.memoryDelta
        };
      }
    }
    
    this.results.scalability = results;
    return results;
  }

  async runAllTests() {
    console.log('🚀 Starting Concurrency Stress Tests...\n');
    
    await this.testSingleThreadPerformance();
    await this.testMultiThreadPerformance();
    await this.testResourceContention();
    await this.testScalability();
    
    this.generateReport();
    
    return this.results;
  }

  generateReport() {
    console.log('\n📊 Concurrency Stress Test Report:');
    console.log('===================================');
    
    // Single vs Multi-thread comparison
    if (this.results.singleThread && this.results.multiThread) {
      const single = this.results.singleThread;
      const multi = this.results.multiThread;
      
      if (!single.error && !multi.error) {
        const speedup = single.duration / multi.duration;
        console.log(`🔄 Single Thread: ${Math.round(single.duration)}ms`);
        console.log(`⚡ Multi Thread: ${Math.round(multi.duration)}ms (${speedup.toFixed(2)}x speedup)`);
      }
    }
    
    // Resource contention analysis
    if (this.results.resourceContention && !this.results.resourceContention.error) {
      const contention = this.results.resourceContention;
      console.log(`📊 Resource Contention: ${Math.round(contention.throughput)} ops/sec`);
    }
    
    // Scalability analysis
    if (this.results.scalability && Object.keys(this.results.scalability).length > 0) {
      console.log('\n📈 Scalability Analysis:');
      Object.entries(this.results.scalability).forEach(([scale, result]) => {
        console.log(`  ${scale} ops: ${Math.round(result.duration)}ms (${Math.round(result.throughput)} ops/sec)`);
      });
    }
  }

  async saveResults() {
    const resultsPath = path.join(__dirname, 'results', 'concurrency-stress-test.json');
    await fs.mkdir(path.dirname(resultsPath), { recursive: true });
    
    const fullResults = {
      timestamp: new Date().toISOString(),
      environment: 'clean-room',
      nodeVersion: process.version,
      platform: process.platform,
      cpuCount: require('os').cpus().length,
      results: this.results
    };
    
    await fs.writeFile(resultsPath, JSON.stringify(fullResults, null, 2));
    console.log(`💾 Results saved to: ${resultsPath}`);
    
    return fullResults;
  }
}

// Worker thread code
if (!isMainThread) {
  const { workerId, task } = workerData;
  
  if (task === 'cpu-intensive') {
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i);
    }
    parentPort.postMessage(result);
  }
}

// Run if called directly
if (require.main === module && isMainThread) {
  const test = new ConcurrencyStressTest();
  test.runAllTests()
    .then(() => test.saveResults())
    .catch(console.error);
}

module.exports = ConcurrencyStressTest;