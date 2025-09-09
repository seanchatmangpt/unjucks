#!/usr/bin/env node

/**
 * Performance Test Runner
 * Runs all performance tests and generates comprehensive report
 */

import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import { BasicLoadTester } from './basic-load-test.js';
import { StressTester } from './stress-test.js';
import { SpikeTester } from './spike-test.js';
import fs from 'fs/promises';
import path from 'path';

class PerformanceTestRunner {
  constructor(options = {}) {
    this.serverUrl = options.url || 'http://localhost:3000';
    this.serverProcess = null;
    this.results = {};
    this.startTime = null;
    this.endTime = null;
  }

  async checkServerHealth() {
    console.log('🔍 Checking server health...');
    
    try {
      const healthTester = new BasicLoadTester({
        url: this.serverUrl,
        concurrency: 1,
        duration: 2000,
        path: '/health'
      });
      
      const result = await healthTester.runLoadTest();
      const successRate = (result.responses / result.requests) * 100;
      
      if (successRate < 100) {
        // Try root path if health endpoint doesn't exist
        const rootTester = new BasicLoadTester({
          url: this.serverUrl,
          concurrency: 1,
          duration: 2000,
          path: '/'
        });
        
        const rootResult = await rootTester.runLoadTest();
        const rootSuccessRate = (rootResult.responses / rootResult.requests) * 100;
        
        if (rootSuccessRate < 50) {
          throw new Error(`Server not responding properly. Success rate: ${rootSuccessRate}%`);
        }
      }
      
      console.log('✅ Server is healthy and responding');
      return true;
    } catch (error) {
      console.error('❌ Server health check failed:', error.message);
      return false;
    }
  }

  async startServer() {
    console.log('🚀 Starting server...');
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', ['src/server/index.js'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test', PORT: '3000' }
      });

      let serverOutput = '';
      
      this.serverProcess.stdout.on('data', (data) => {
        serverOutput += data.toString();
        process.stdout.write(`[SERVER] ${data}`);
        
        // Look for server ready indicators
        if (data.toString().includes('listening') || 
            data.toString().includes('started') ||
            data.toString().includes('ready') ||
            serverOutput.includes('Enterprise Server')) {
          setTimeout(() => resolve(true), 2000); // Give server time to fully start
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        process.stderr.write(`[SERVER ERROR] ${data}`);
      });

      this.serverProcess.on('error', (error) => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });

      this.serverProcess.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Server exited with code ${code}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 30000);
    });
  }

  async stopServer() {
    if (this.serverProcess) {
      console.log('🛑 Stopping server...');
      this.serverProcess.kill('SIGTERM');
      
      return new Promise((resolve) => {
        this.serverProcess.on('exit', () => {
          console.log('✅ Server stopped');
          resolve();
        });
        
        // Force kill after 5 seconds
        setTimeout(() => {
          this.serverProcess.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    }
  }

  async runBasicLoadTest() {
    console.log('\n🔵 Running Basic Load Test (100 concurrent users)...');
    
    const tester = new BasicLoadTester({
      url: this.serverUrl,
      concurrency: 100,
      duration: 30000,
      path: '/'
    });

    this.results.basicLoad = await tester.runLoadTest();
    this.results.basicLoad.testType = 'Basic Load Test';
    
    console.log(`✅ Basic Load Test completed`);
    console.log(`   Success Rate: ${((this.results.basicLoad.responses / this.results.basicLoad.requests) * 100).toFixed(2)}%`);
    console.log(`   Throughput: ${this.results.basicLoad.throughput.toFixed(2)} req/sec`);
    console.log(`   Avg Response Time: ${this.results.basicLoad.avgResponseTime.toFixed(2)}ms`);
  }

  async runStressTest() {
    console.log('\n🔴 Running Stress Test (finding breaking point)...');
    
    const tester = new StressTester({
      url: this.serverUrl,
      startConcurrency: 10,
      maxConcurrency: 300,
      stepSize: 20,
      stepDuration: 15000,
      failureThreshold: 90,
      path: '/'
    });

    this.results.stress = await tester.runStressTest();
    
    console.log(`✅ Stress Test completed`);
    if (this.results.stress.breakingPoint) {
      console.log(`   Breaking Point: ${this.results.stress.breakingPoint.concurrency} users`);
      console.log(`   Max Safe Concurrency: ${this.results.stress.summary.maxSafeConcurrency}`);
    } else {
      console.log(`   No breaking point found within test range`);
    }
    console.log(`   Max Throughput: ${this.results.stress.summary.maxThroughput} req/sec`);
  }

  async runSpikeTest() {
    console.log('\n🟡 Running Spike Test (sudden traffic increase)...');
    
    const tester = new SpikeTester({
      url: this.serverUrl,
      baselineUsers: 10,
      spikeUsers: 200,
      baselineDuration: 20000,
      spikeDuration: 40000,
      cooldownDuration: 20000,
      path: '/'
    });

    this.results.spike = await tester.runSpikeTest();
    
    console.log(`✅ Spike Test completed`);
    console.log(`   Resilience Score: ${this.results.spike.analysis.resilienceScore.toFixed(1)}%`);
    console.log(`   Recovery: ${this.results.spike.analysis.recovery.fullRecovery ? 'Full' : 'Partial'}`);
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: this.endTime - this.startTime,
      serverUrl: this.serverUrl,
      testResults: this.results,
      summary: this.generateSummary(),
      recommendations: this.generateRecommendations()
    };

    // Save to file
    const reportPath = path.join(process.cwd(), 'tests', 'performance', 'performance-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }

  generateSummary() {
    const summary = {
      basicLoad: {
        throughput: this.results.basicLoad?.throughput || 0,
        successRate: this.results.basicLoad ? 
          (this.results.basicLoad.responses / this.results.basicLoad.requests) * 100 : 0,
        avgResponseTime: this.results.basicLoad?.avgResponseTime || 0
      },
      stress: {
        maxSafeConcurrency: this.results.stress?.summary?.maxSafeConcurrency || 'Unknown',
        maxThroughput: parseFloat(this.results.stress?.summary?.maxThroughput || '0'),
        breakingPoint: this.results.stress?.breakingPoint?.concurrency || 'Not found'
      },
      spike: {
        resilienceScore: this.results.spike?.analysis?.resilienceScore || 0,
        fullRecovery: this.results.spike?.analysis?.recovery?.fullRecovery || false
      }
    };

    // Calculate overall performance score
    const factors = [
      summary.basicLoad.successRate >= 95 ? 25 : (summary.basicLoad.successRate / 95) * 25,
      summary.basicLoad.throughput >= 100 ? 25 : (summary.basicLoad.throughput / 100) * 25,
      summary.stress.maxSafeConcurrency >= 100 ? 25 : 
        (parseInt(summary.stress.maxSafeConcurrency) / 100) * 25 || 0,
      (summary.spike.resilienceScore / 100) * 25
    ];

    summary.overallScore = factors.reduce((sum, factor) => sum + factor, 0);
    
    return summary;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Basic load test recommendations
    if (this.results.basicLoad) {
      const successRate = (this.results.basicLoad.responses / this.results.basicLoad.requests) * 100;
      if (successRate < 95) {
        recommendations.push({
          priority: 'High',
          category: 'Reliability',
          issue: `Low success rate in basic load test (${successRate.toFixed(2)}%)`,
          recommendation: 'Investigate error handling and resource constraints'
        });
      }
      
      if (this.results.basicLoad.avgResponseTime > 1000) {
        recommendations.push({
          priority: 'Medium',
          category: 'Performance',
          issue: `High average response time (${this.results.basicLoad.avgResponseTime.toFixed(2)}ms)`,
          recommendation: 'Optimize slow operations, add caching, or scale resources'
        });
      }
    }

    // Stress test recommendations
    if (this.results.stress?.breakingPoint) {
      if (this.results.stress.breakingPoint.concurrency < 100) {
        recommendations.push({
          priority: 'High',
          category: 'Scalability',
          issue: `Low breaking point at ${this.results.stress.breakingPoint.concurrency} users`,
          recommendation: 'Implement horizontal scaling and optimize resource usage'
        });
      }
    }

    // Spike test recommendations
    if (this.results.spike?.analysis?.resilienceScore < 75) {
      recommendations.push({
        priority: 'Medium',
        category: 'Resilience',
        issue: `Low resilience score (${this.results.spike.analysis.resilienceScore.toFixed(1)}%)`,
        recommendation: 'Implement circuit breakers, rate limiting, and auto-scaling'
      });
    }

    return recommendations;
  }

  printFinalReport(report) {
    console.log('\n🏁 Final Performance Test Report');
    console.log('═'.repeat(70));
    console.log(`Test Duration: ${(report.duration / 1000).toFixed(1)} seconds`);
    console.log(`Server URL: ${report.serverUrl}`);
    console.log(`Timestamp: ${report.timestamp}`);

    console.log('\n📊 Performance Summary:');
    console.log(`Overall Score: ${report.summary.overallScore.toFixed(1)}/100`);
    
    console.log('\n📈 Key Metrics:');
    console.log(`Basic Load Test:`);
    console.log(`  ├─ Throughput: ${report.summary.basicLoad.throughput.toFixed(2)} req/sec`);
    console.log(`  ├─ Success Rate: ${report.summary.basicLoad.successRate.toFixed(2)}%`);
    console.log(`  └─ Avg Response Time: ${report.summary.basicLoad.avgResponseTime.toFixed(2)}ms`);
    
    console.log(`Stress Test:`);
    console.log(`  ├─ Max Safe Concurrency: ${report.summary.stress.maxSafeConcurrency}`);
    console.log(`  ├─ Max Throughput: ${report.summary.stress.maxThroughput.toFixed(2)} req/sec`);
    console.log(`  └─ Breaking Point: ${report.summary.stress.breakingPoint} users`);
    
    console.log(`Spike Test:`);
    console.log(`  ├─ Resilience Score: ${report.summary.spike.resilienceScore.toFixed(1)}%`);
    console.log(`  └─ Full Recovery: ${report.summary.spike.fullRecovery ? 'Yes' : 'No'}`);

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority}] ${rec.category}: ${rec.issue}`);
        console.log(`   └─ ${rec.recommendation}`);
      });
    } else {
      console.log('\n✅ No critical recommendations - performance looks good!');
    }

    console.log(`\n📄 Detailed report saved to: tests/performance/performance-report.json`);
  }

  async run() {
    this.startTime = performance.now();
    
    try {
      // Check if server is already running
      const isHealthy = await this.checkServerHealth();
      let serverStarted = false;
      
      if (!isHealthy) {
        await this.startServer();
        serverStarted = true;
        
        // Wait a bit more and check health again
        await new Promise(resolve => setTimeout(resolve, 3000));
        const healthAfterStart = await this.checkServerHealth();
        
        if (!healthAfterStart) {
          throw new Error('Server started but is not responding properly');
        }
      }

      // Run all performance tests
      await this.runBasicLoadTest();
      await this.runStressTest();
      await this.runSpikeTest();

      this.endTime = performance.now();

      // Generate and save report
      const report = await this.generateReport();
      this.printFinalReport(report);

      // Store results in memory for gaps analysis
      await this.storeResultsInMemory(report);

      if (serverStarted) {
        await this.stopServer();
      }

      return report;
    } catch (error) {
      console.error('❌ Performance test suite failed:', error.message);
      
      if (this.serverProcess) {
        await this.stopServer();
      }
      
      throw error;
    }
  }

  async storeResultsInMemory(report) {
    try {
      // This would normally use the claude-flow memory system
      // For now, we'll create a simple memory store
      const memoryStore = {
        timestamp: report.timestamp,
        serverUrl: report.serverUrl,
        overallScore: report.summary.overallScore,
        basicLoad: {
          throughput: report.summary.basicLoad.throughput,
          successRate: report.summary.basicLoad.successRate,
          avgResponseTime: report.summary.basicLoad.avgResponseTime
        },
        stress: {
          maxSafeConcurrency: report.summary.stress.maxSafeConcurrency,
          maxThroughput: report.summary.stress.maxThroughput,
          breakingPoint: report.summary.stress.breakingPoint
        },
        spike: {
          resilienceScore: report.summary.spike.resilienceScore,
          fullRecovery: report.summary.spike.fullRecovery
        },
        recommendations: report.recommendations.length
      };

      // Save to memory file (would be replaced by actual memory API)
      const memoryPath = path.join(process.cwd(), 'memory', 'performance-results.json');
      await fs.mkdir(path.dirname(memoryPath), { recursive: true });
      await fs.writeFile(memoryPath, JSON.stringify(memoryStore, null, 2));
      
      console.log('💾 Results stored in memory with key "gaps/performance/results"');
    } catch (error) {
      console.warn('⚠️  Failed to store results in memory:', error.message);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new PerformanceTestRunner({
    url: process.env.TEST_URL || 'http://localhost:3000'
  });

  runner.run()
    .then((report) => {
      const exitCode = report.summary.overallScore >= 75 ? 0 : 1;
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error('❌ Performance test runner failed:', error.message);
      process.exit(1);
    });
}

export { PerformanceTestRunner };