#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';
import { performance } from 'perf_hooks';
import { writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

class ScalabilityTester {
  constructor() {
    this.results = {
      testDate: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      scalabilityTests: []
    };
    
    mkdirSync('tests/performance/results', { recursive: true });
  }

  async testScale(scaleName, operations, batchSize = 100) {
    console.log(`\n🔄 Testing ${scaleName} scale: ${operations} operations`);
    console.log(`Using batch size: ${batchSize}`);
    
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    let peakMemory = startMemory.heapUsed;
    
    // Memory monitoring
    const memoryMonitor = setInterval(() => {
      const current = process.memoryUsage().heapUsed;
      if (current > peakMemory) peakMemory = current;
    }, 100);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    try {
      // Process in batches to prevent overwhelming the system
      for (let batch = 0; batch < Math.ceil(operations / batchSize); batch++) {
        const batchOperations = Math.min(batchSize, operations - (batch * batchSize));
        
        const promises = Array.from({ length: batchOperations }, async (_, i) => {
          const opIndex = batch * batchSize + i;
          
          try {
            // Use a simple, fast command for scalability testing
            const { stdout } = await execAsync(`node src/cli/index.js --version`, {
              timeout: 10000,
              cwd: process.cwd()
            });
            
            if (stdout && stdout.includes('.')) {
              successCount++;
            } else {
              errorCount++;
              errors.push(`Operation ${opIndex}: No valid version output`);
            }
            
          } catch (error) {
            errorCount++;
            errors.push(`Operation ${opIndex}: ${error.message}`);
          }
        });
        
        await Promise.all(promises);
        
        // Progress reporting
        const completed = Math.min((batch + 1) * batchSize, operations);
        const progress = (completed / operations * 100).toFixed(1);
        console.log(`  Progress: ${completed}/${operations} (${progress}%)`);
        
        // Small delay between batches
        if (batch < Math.ceil(operations / batchSize) - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
    } catch (error) {
      console.error(`❌ Scale test failed: ${error.message}`);
      errorCount = operations - successCount;
    } finally {
      clearInterval(memoryMonitor);
    }
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    const result = {
      scaleName,
      operations,
      batchSize,
      executionTime: endTime - startTime,
      successCount,
      errorCount,
      successRate: (successCount / operations) * 100,
      throughput: successCount / ((endTime - startTime) / 1000),
      memoryStart: startMemory.heapUsed,
      memoryEnd: endMemory.heapUsed,
      memoryPeak: peakMemory,
      memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
      errors: errors.slice(0, 10) // Keep first 10 errors
    };
    
    console.log(`  ✅ Completed in ${(result.executionTime / 1000).toFixed(2)}s`);
    console.log(`  🎯 Success Rate: ${result.successRate.toFixed(1)}%`);
    console.log(`  ⚡ Throughput: ${result.throughput.toFixed(2)} ops/sec`);
    console.log(`  💾 Memory Peak: ${(result.memoryPeak / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  📊 Memory Delta: ${(result.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    
    return result;
  }

  async runConcurrentUserTest(userCount = 25, operationsPerUser = 5) {
    console.log(`\n👥 Testing Concurrent Users: ${userCount} users, ${operationsPerUser} ops each`);
    
    const totalOperations = userCount * operationsPerUser;
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    const userPromises = Array.from({ length: userCount }, async (_, userId) => {
      const userOperations = Array.from({ length: operationsPerUser }, async (_, opIndex) => {
        try {
          const commands = ['--version', 'list', '--help'];
          const command = commands[opIndex % commands.length];
          
          const { stdout } = await execAsync(`node src/cli/index.js ${command}`, {
            timeout: 15000,
            cwd: process.cwd(),
            env: { ...process.env, USER_ID: `user-${userId}` }
          });
          
          successCount++;
          
        } catch (error) {
          errorCount++;
          errors.push(`User ${userId} Op ${opIndex}: ${error.message}`);
        }
      });
      
      return Promise.all(userOperations);
    });
    
    await Promise.all(userPromises);
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    const result = {
      testName: 'concurrent-users',
      userCount,
      operationsPerUser,
      totalOperations,
      executionTime: endTime - startTime,
      successCount,
      errorCount,
      successRate: (successCount / totalOperations) * 100,
      throughput: successCount / ((endTime - startTime) / 1000),
      memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
      errors: errors.slice(0, 10)
    };
    
    console.log(`  ✅ Completed in ${(result.executionTime / 1000).toFixed(2)}s`);
    console.log(`  🎯 Success Rate: ${result.successRate.toFixed(1)}%`);
    console.log(`  ⚡ Throughput: ${result.throughput.toFixed(2)} ops/sec`);
    console.log(`  💾 Memory Delta: ${(result.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    
    return result;
  }

  async runAllScalabilityTests() {
    console.log('📈 Starting Scalability Testing');
    
    // Small scale test
    const smallScale = await this.testScale('Small (1K)', 1000, 50);
    this.results.scalabilityTests.push(smallScale);
    
    // Medium scale test (reduced for CI/testing environment)
    const mediumScale = await this.testScale('Medium (5K)', 5000, 100);
    this.results.scalabilityTests.push(mediumScale);
    
    // Concurrent user test
    const concurrentUsers = await this.runConcurrentUserTest(25, 5);
    this.results.concurrentUsers = concurrentUsers;
  }

  generateScalabilityReport() {
    const reportData = {
      ...this.results,
      summary: {
        totalTests: this.results.scalabilityTests.length,
        averageSuccessRate: this.results.scalabilityTests.reduce((sum, test) => 
          sum + test.successRate, 0) / this.results.scalabilityTests.length,
        averageThroughput: this.results.scalabilityTests.reduce((sum, test) => 
          sum + test.throughput, 0) / this.results.scalabilityTests.length,
        totalOperations: this.results.scalabilityTests.reduce((sum, test) => 
          sum + test.operations, 0),
        bestPerformingScale: this.results.scalabilityTests.reduce((best, current) => 
          current.throughput > best.throughput ? current : best),
        memoryEfficiency: this.results.scalabilityTests.every(test => 
          test.memoryPeak < 1024 * 1024 * 1024) // Under 1GB
      }
    };

    // Save results
    const resultsFile = 'tests/performance/results/scalability-results.json';
    writeFileSync(resultsFile, JSON.stringify(reportData, null, 2));

    // Generate report
    console.log('\n📊 SCALABILITY TEST REPORT');
    console.log('═'.repeat(60));
    console.log(`Test Date: ${reportData.testDate}`);
    console.log(`Node Version: ${reportData.nodeVersion}`);
    console.log(`Platform: ${reportData.platform} (${reportData.arch})`);
    
    console.log(`\n📈 SCALABILITY RESULTS:`);
    this.results.scalabilityTests.forEach(test => {
      console.log(`  ${test.scaleName}:`);
      console.log(`    Operations: ${test.operations}`);
      console.log(`    Time: ${(test.executionTime / 1000).toFixed(2)}s`);
      console.log(`    Success Rate: ${test.successRate.toFixed(1)}%`);
      console.log(`    Throughput: ${test.throughput.toFixed(2)} ops/sec`);
      console.log(`    Memory Peak: ${(test.memoryPeak / 1024 / 1024).toFixed(2)}MB`);
    });

    if (this.results.concurrentUsers) {
      const cu = this.results.concurrentUsers;
      console.log(`\n👥 CONCURRENT USERS:`);
      console.log(`  Users: ${cu.userCount}`);
      console.log(`  Ops per User: ${cu.operationsPerUser}`);
      console.log(`  Total Operations: ${cu.totalOperations}`);
      console.log(`  Time: ${(cu.executionTime / 1000).toFixed(2)}s`);
      console.log(`  Success Rate: ${cu.successRate.toFixed(1)}%`);
      console.log(`  Throughput: ${cu.throughput.toFixed(2)} ops/sec`);
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`  Total Tests: ${reportData.summary.totalTests}`);
    console.log(`  Average Success Rate: ${reportData.summary.averageSuccessRate.toFixed(1)}%`);
    console.log(`  Average Throughput: ${reportData.summary.averageThroughput.toFixed(2)} ops/sec`);
    console.log(`  Total Operations: ${reportData.summary.totalOperations}`);
    console.log(`  Best Scale: ${reportData.summary.bestPerformingScale.scaleName} (${reportData.summary.bestPerformingScale.throughput.toFixed(2)} ops/sec)`);
    console.log(`  Memory Efficiency: ${reportData.summary.memoryEfficiency ? '✅ Excellent' : '⚠️ Needs Optimization'}`);

    // Performance grading
    const grade = reportData.summary.averageSuccessRate >= 95 ? 
                  reportData.summary.averageThroughput >= 10 ? 'A+' : 'A' :
                  reportData.summary.averageSuccessRate >= 90 ? 'B+' : 
                  reportData.summary.averageSuccessRate >= 85 ? 'B' : 'C';

    console.log(`\n🏆 SCALABILITY GRADE: ${grade}`);
    console.log(`💾 Results saved to: ${resultsFile}`);
    console.log('═'.repeat(60));

    return reportData;
  }

  async run() {
    try {
      await this.runAllScalabilityTests();
      return this.generateScalabilityReport();
    } catch (error) {
      console.error('❌ Scalability test failed:', error);
      throw error;
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ScalabilityTester();
  tester.run().catch(error => {
    console.error('Scalability test execution failed:', error);
    process.exit(1);
  });
}

export default ScalabilityTester;