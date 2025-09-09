#!/usr/bin/env node

/**
 * Basic Load Test - 100 concurrent requests
 * Tests the server's ability to handle simultaneous connections
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';
import { performance } from 'perf_hooks';

class BasicLoadTester {
  constructor(options = {}) {
    this.serverUrl = options.url || 'http://localhost:3000';
    this.concurrency = options.concurrency || 100;
    this.duration = options.duration || 30000; // 30 seconds
    this.path = options.path || '/';
    this.method = options.method || 'GET';
    this.results = {
      requests: 0,
      responses: 0,
      errors: 0,
      timeouts: 0,
      responseTimes: [],
      errorTypes: {},
      startTime: null,
      endTime: null,
      throughput: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0
    };
  }

  async makeRequest() {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const url = new URL(this.serverUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: this.path,
        method: this.method,
        timeout: 5000,
        headers: {
          'User-Agent': 'Unjucks-Load-Tester/1.0'
        }
      };

      const req = client.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = endTime - startTime;
          
          this.results.responses++;
          this.results.responseTimes.push(responseTime);
          
          resolve({
            success: true,
            responseTime,
            statusCode: res.statusCode,
            contentLength: data.length
          });
        });
      });

      req.on('error', (error) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        this.results.errors++;
        const errorType = error.code || 'UNKNOWN_ERROR';
        this.results.errorTypes[errorType] = (this.results.errorTypes[errorType] || 0) + 1;
        
        resolve({
          success: false,
          responseTime,
          error: error.message,
          errorCode: error.code
        });
      });

      req.on('timeout', () => {
        this.results.timeouts++;
        req.destroy();
        
        resolve({
          success: false,
          responseTime: 5000,
          error: 'Request timeout'
        });
      });

      req.end();
      this.results.requests++;
    });
  }

  async runLoadTest() {
    console.log(`🚀 Starting Basic Load Test`);
    console.log(`Target: ${this.serverUrl}${this.path}`);
    console.log(`Concurrency: ${this.concurrency}`);
    console.log(`Duration: ${this.duration}ms`);
    console.log(`Method: ${this.method}`);
    console.log('─'.repeat(50));

    this.results.startTime = performance.now();
    const endTime = this.results.startTime + this.duration;
    const workers = [];

    // Start concurrent workers
    for (let i = 0; i < this.concurrency; i++) {
      workers.push(this.worker(endTime));
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    this.results.endTime = performance.now();
    this.calculateMetrics();
    return this.results;
  }

  async worker(endTime) {
    while (performance.now() < endTime) {
      await this.makeRequest();
      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  calculateMetrics() {
    const totalTime = this.results.endTime - this.results.startTime;
    this.results.throughput = (this.results.responses / totalTime) * 1000; // requests per second

    if (this.results.responseTimes.length > 0) {
      const sorted = this.results.responseTimes.sort((a, b) => a - b);
      this.results.avgResponseTime = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      this.results.minResponseTime = sorted[0];
      this.results.maxResponseTime = sorted[sorted.length - 1];
      this.results.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)];
      this.results.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)];
    }
  }

  printResults() {
    console.log('\n📊 Load Test Results');
    console.log('═'.repeat(50));
    console.log(`Total Requests: ${this.results.requests}`);
    console.log(`Successful Responses: ${this.results.responses}`);
    console.log(`Errors: ${this.results.errors}`);
    console.log(`Timeouts: ${this.results.timeouts}`);
    console.log(`Success Rate: ${((this.results.responses / this.results.requests) * 100).toFixed(2)}%`);
    console.log(`Throughput: ${this.results.throughput.toFixed(2)} req/sec`);
    console.log('');
    console.log('Response Times:');
    console.log(`  Min: ${this.results.minResponseTime.toFixed(2)}ms`);
    console.log(`  Avg: ${this.results.avgResponseTime.toFixed(2)}ms`);
    console.log(`  Max: ${this.results.maxResponseTime.toFixed(2)}ms`);
    console.log(`  P95: ${this.results.p95ResponseTime.toFixed(2)}ms`);
    console.log(`  P99: ${this.results.p99ResponseTime.toFixed(2)}ms`);
    
    if (Object.keys(this.results.errorTypes).length > 0) {
      console.log('\nError Breakdown:');
      Object.entries(this.results.errorTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }
  }
}

// Run the test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new BasicLoadTester({
    url: process.env.TEST_URL || 'http://localhost:3000',
    concurrency: parseInt(process.env.CONCURRENCY) || 100,
    duration: parseInt(process.env.DURATION) || 30000,
    path: process.env.TEST_PATH || '/'
  });

  try {
    const results = await tester.runLoadTest();
    tester.printResults();
    
    // Exit with appropriate code
    const successRate = (results.responses / results.requests) * 100;
    process.exit(successRate > 95 ? 0 : 1);
  } catch (error) {
    console.error('❌ Load test failed:', error.message);
    process.exit(1);
  }
}

export { BasicLoadTester };