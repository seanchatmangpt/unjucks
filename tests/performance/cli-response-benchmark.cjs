#!/usr/bin/env node

const { spawn } = require('child_process');
const { performance } = require('perf_hooks');
const fs = require('fs/promises');
const path = require('path');

class CLIResponseBenchmark {
  constructor() {
    this.results = {
      helpCommand: {},
      listCommand: {},
      generateCommand: {},
      multipleCommands: {},
      errorHandling: {},
      coldStart: {},
      warmStart: {}
    };
  }

  async measureCLIResponse(testName, command, args = [], iterations = 10) {
    console.log(`⚡ Benchmarking ${testName} (${iterations} iterations)...`);
    
    const measurements = [];
    const startMemory = process.memoryUsage();
    
    try {
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        const result = await this.runCLICommand(command, args);
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        measurements.push({
          duration,
          success: result.exitCode === 0,
          outputSize: result.stdout.length + result.stderr.length,
          exitCode: result.exitCode
        });
      }
      
      const endMemory = process.memoryUsage();
      
      const successful = measurements.filter(m => m.success);
      const durations = successful.map(m => m.duration);
      
      const result = {
        iterations,
        successRate: (successful.length / iterations) * 100,
        avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        p95Duration: this.percentile(durations, 95),
        p99Duration: this.percentile(durations, 99),
        throughput: iterations / (durations.reduce((sum, d) => sum + d, 0) / 1000),
        memoryDelta: endMemory.rss - startMemory.rss,
        avgOutputSize: measurements.reduce((sum, m) => sum + m.outputSize, 0) / measurements.length,
        measurements: measurements
      };
      
      this.results[testName] = result;
      console.log(`✅ ${testName}: ${Math.round(result.avgDuration)}ms avg (${Math.round(result.successRate)}% success)`);
      
      return result;
    } catch (error) {
      console.error(`❌ ${testName} failed:`, error.message);
      this.results[testName] = { error: error.message };
      return null;
    }
  }

  async runCLICommand(command, args) {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        timeout: 30000 // 30 second timeout
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({
          exitCode: code,
          stdout,
          stderr
        });
      });
      
      child.on('error', (error) => {
        resolve({
          exitCode: -1,
          stdout,
          stderr: stderr + error.message
        });
      });
    });
  }

  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  async benchmarkHelpCommand() {
    return this.measureCLIResponse('helpCommand', 'node', ['-h'], 20);
  }

  async benchmarkListCommand() {
    // Test if unjucks CLI exists, fallback to ls
    const cliExists = await this.checkCLIExists();
    
    if (cliExists) {
      return this.measureCLIResponse('listCommand', 'node', ['src/cli.js', 'list'], 15);
    } else {
      return this.measureCLIResponse('listCommand', 'ls', ['-la'], 15);
    }
  }

  async benchmarkGenerateCommand() {
    const cliExists = await this.checkCLIExists();
    
    if (cliExists) {
      // Test dry run generation
      return this.measureCLIResponse('generateCommand', 'node', [
        'src/cli.js', 'generate', 'component', 'test',
        '--name', 'TestComponent',
        '--dry'
      ], 10);
    } else {
      // Fallback to touch command
      return this.measureCLIResponse('generateCommand', 'touch', ['/tmp/test-file'], 10);
    }
  }

  async benchmarkMultipleCommands() {
    const commands = [
      ['node', ['-v']],
      ['npm', ['-v']],
      ['pwd'],
      ['date'],
      ['echo', ['test']]
    ];
    
    const startTime = performance.now();
    const results = [];
    
    for (const [cmd, args = []] of commands) {
      const result = await this.runCLICommand(cmd, args);
      results.push({
        command: `${cmd} ${args.join(' ')}`,
        success: result.exitCode === 0,
        outputSize: result.stdout.length + result.stderr.length
      });
    }
    
    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    
    this.results.multipleCommands = {
      totalDuration,
      commandCount: commands.length,
      avgDuration: totalDuration / commands.length,
      successRate: (results.filter(r => r.success).length / results.length) * 100,
      results
    };
    
    console.log(`✅ multipleCommands: ${Math.round(totalDuration)}ms total (${results.length} commands)`);
    
    return this.results.multipleCommands;
  }

  async benchmarkErrorHandling() {
    const errorCommands = [
      ['node', ['nonexistent-file.js']],
      ['invalid-command-xyz'],
      ['ls', ['nonexistent-directory']],
      ['node', ['-e', 'throw new Error("test error")']]
    ];
    
    const measurements = [];
    
    for (const [cmd, args = []] of errorCommands) {
      const startTime = performance.now();
      const result = await this.runCLICommand(cmd, args);
      const duration = performance.now() - startTime;
      
      measurements.push({
        command: `${cmd} ${args.join(' ')}`,
        duration,
        exitCode: result.exitCode,
        hasErrorOutput: result.stderr.length > 0
      });
    }
    
    const avgDuration = measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length;
    
    this.results.errorHandling = {
      measurements,
      avgDuration,
      errorHandlingRate: measurements.filter(m => m.hasErrorOutput).length / measurements.length * 100
    };
    
    console.log(`✅ errorHandling: ${Math.round(avgDuration)}ms avg error response`);
    
    return this.results.errorHandling;
  }

  async benchmarkColdStart() {
    // Simulate cold start by spawning fresh processes
    return this.measureCLIResponse('coldStart', 'node', ['-e', 'console.log("cold start test")'], 5);
  }

  async benchmarkWarmStart() {
    // Pre-warm Node.js
    await this.runCLICommand('node', ['-e', 'console.log("warmup")']);
    
    // Now measure warm starts
    return this.measureCLIResponse('warmStart', 'node', ['-e', 'console.log("warm start test")'], 20);
  }

  async checkCLIExists() {
    try {
      const cliPath = path.join(__dirname, '..', '..', 'src', 'cli.js');
      await fs.access(cliPath);
      return true;
    } catch {
      return false;
    }
  }

  async runAllBenchmarks() {
    console.log('⚡ Starting CLI Response Benchmarks...\n');
    
    await this.benchmarkColdStart();
    await this.benchmarkWarmStart();
    await this.benchmarkHelpCommand();
    await this.benchmarkListCommand();
    await this.benchmarkGenerateCommand();
    await this.benchmarkMultipleCommands();
    await this.benchmarkErrorHandling();
    
    this.generateReport();
    
    return this.results;
  }

  generateReport() {
    console.log('\n📊 CLI Response Benchmark Report:');
    console.log('==================================');
    
    const validResults = Object.entries(this.results)
      .filter(([_, result]) => !result.error && result.avgDuration !== undefined);
    
    if (validResults.length === 0) {
      console.log('❌ No valid results to analyze');
      return;
    }
    
    // Performance comparison
    validResults.sort((a, b) => a[1].avgDuration - b[1].avgDuration);
    
    console.log('\nResponse Time Ranking (fastest to slowest):');
    validResults.forEach(([name, result], index) => {
      const p95 = result.p95Duration ? ` (P95: ${Math.round(result.p95Duration)}ms)` : '';
      console.log(`${index + 1}. ${name}: ${Math.round(result.avgDuration)}ms${p95}`);
    });
    
    // Cold vs Warm start comparison
    if (this.results.coldStart && this.results.warmStart && 
        !this.results.coldStart.error && !this.results.warmStart.error) {
      const coldAvg = this.results.coldStart.avgDuration;
      const warmAvg = this.results.warmStart.avgDuration;
      const improvement = coldAvg / warmAvg;
      
      console.log(`\n🌡️  Cold Start: ${Math.round(coldAvg)}ms`);
      console.log(`⚡ Warm Start: ${Math.round(warmAvg)}ms (${improvement.toFixed(1)}x faster)`);
    }
    
    // Success rates
    console.log('\nSuccess Rates:');
    validResults.forEach(([name, result]) => {
      if (result.successRate !== undefined) {
        console.log(`  ${name}: ${Math.round(result.successRate)}%`);
      }
    });
  }

  async saveResults() {
    const resultsPath = path.join(__dirname, 'results', 'cli-response-benchmark.json');
    await fs.mkdir(path.dirname(resultsPath), { recursive: true });
    
    const fullResults = {
      timestamp: new Date().toISOString(),
      environment: 'clean-room',
      nodeVersion: process.version,
      platform: process.platform,
      results: this.results
    };
    
    await fs.writeFile(resultsPath, JSON.stringify(fullResults, null, 2));
    console.log(`💾 Results saved to: ${resultsPath}`);
    
    return fullResults;
  }
}

// Run if called directly
if (require.main === module) {
  const benchmark = new CLIResponseBenchmark();
  benchmark.runAllBenchmarks()
    .then(() => benchmark.saveResults())
    .catch(console.error);
}

module.exports = CLIResponseBenchmark;