#!/usr/bin/env node

/**
 * KGEN Memory Usage Profiler
 * 
 * Measures detailed memory usage patterns during KGEN operations
 * - Heap growth patterns
 * - Garbage collection impact
 * - Memory leaks detection
 * - Peak memory usage
 */

import { performance } from 'perf_hooks';
import { spawn, execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const PROJECT_ROOT = path.resolve(process.cwd());
const KGEN_BINARY = path.join(PROJECT_ROOT, 'bin/kgen.mjs');
const TEST_DATA_DIR = path.join(PROJECT_ROOT, 'tests/performance/data');

class MemoryProfiler {
  constructor() {
    this.profiles = new Map();
    this.gcStats = [];
  }

  async profileCommand(command, args, options = {}) {
    console.log(`📊 Profiling memory: ${command} ${args.join(' ')}`);
    
    const measurements = [];
    let peakMemory = { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 };
    let gcCount = 0;
    
    return new Promise((resolve, reject) => {
      const startMemory = process.memoryUsage();
      const child = spawn('node', [
        '--expose-gc',
        '--trace-gc',
        KGEN_BINARY,
        command,
        ...args
      ], {
        stdio: ['inherit', 'pipe', 'pipe'],
        env: { ...process.env, NODE_OPTIONS: '--expose-gc --trace-gc' }
      });
      
      let output = '';
      let errorOutput = '';
      const startTime = performance.now();
      
      // Monitor memory usage every 10ms
      const memoryMonitor = setInterval(() => {
        try {
          // Get process memory stats
          const memStats = execSync(`ps -o pid,rss,vsz -p ${child.pid}`).toString();
          const lines = memStats.split('\n');
          if (lines.length > 1) {
            const [pid, rss, vsz] = lines[1].trim().split(/\s+/);
            const memoryKB = {
              rss: parseInt(rss) * 1024, // Convert KB to bytes
              vsz: parseInt(vsz) * 1024,
              timestamp: performance.now()
            };
            
            measurements.push(memoryKB);
            
            // Track peak memory
            if (memoryKB.rss > peakMemory.rss) {
              peakMemory.rss = memoryKB.rss;
            }
          }
        } catch (error) {
          // Process might have ended
        }
      }, 10);
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        const stderr = data.toString();
        errorOutput += stderr;
        
        // Count GC events
        if (stderr.includes('[GC')) {
          gcCount++;
        }
      });
      
      child.on('close', (code) => {
        clearInterval(memoryMonitor);
        const endTime = performance.now();
        const endMemory = process.memoryUsage();
        
        const profile = {
          command: `${command} ${args.join(' ')}`,
          success: code === 0,
          duration: endTime - startTime,
          exitCode: code,
          memoryStats: {
            start: startMemory,
            end: endMemory,
            peak: peakMemory,
            delta: {
              rss: endMemory.rss - startMemory.rss,
              heapUsed: endMemory.heapUsed - startMemory.heapUsed,
              heapTotal: endMemory.heapTotal - startMemory.heapTotal,
              external: endMemory.external - startMemory.external
            }
          },
          gcStats: {
            gcCount: gcCount,
            gcEventsPerSecond: gcCount / ((endTime - startTime) / 1000)
          },
          measurements: measurements,
          output: output,
          error: errorOutput
        };
        
        resolve(profile);
      });
      
      child.on('error', (error) => {
        clearInterval(memoryMonitor);
        reject(error);
      });
      
      // Timeout
      setTimeout(() => {
        clearInterval(memoryMonitor);
        child.kill();
        reject(new Error('Memory profiling timeout'));
      }, options.timeout || 60000);
    });
  }

  analyzeMemoryPattern(measurements) {
    if (measurements.length < 2) {
      return { pattern: 'INSUFFICIENT_DATA' };
    }
    
    const startMem = measurements[0].rss;
    const endMem = measurements[measurements.length - 1].rss;
    const peakMem = Math.max(...measurements.map(m => m.rss));
    
    const growth = endMem - startMem;
    const peakGrowth = peakMem - startMem;
    
    // Calculate growth rate
    const timeSpan = measurements[measurements.length - 1].timestamp - measurements[0].timestamp;
    const growthRate = growth / (timeSpan / 1000); // bytes per second
    
    // Detect patterns
    let pattern = 'STABLE';
    if (growthRate > 1024 * 1024) { // 1MB/s
      pattern = 'HIGH_GROWTH';
    } else if (growthRate > 100 * 1024) { // 100KB/s
      pattern = 'MODERATE_GROWTH';
    } else if (Math.abs(growthRate) < 1024) { // <1KB/s
      pattern = 'STABLE';
    } else if (growthRate < -100 * 1024) {
      pattern = 'SHRINKING';
    }
    
    // Detect memory spikes
    const hasSpikes = peakGrowth > growth * 2;
    
    return {
      pattern: pattern,
      growthBytes: growth,
      peakGrowthBytes: peakGrowth,
      growthRateBytesPerSec: growthRate,
      hasMemorySpikes: hasSpikes,
      efficiency: growth < 10 * 1024 * 1024 ? 'GOOD' : 'POOR' // <10MB is good
    };
  }

  async profileMultipleOperations() {
    console.log('🔬 Running comprehensive memory profiling...\n');
    
    const operations = [
      { name: 'version', command: '--version', args: [] },
      { name: 'validate-small', command: 'validate', args: ['graph', path.join(TEST_DATA_DIR, 'test-small.ttl')] },
      { name: 'validate-large', command: 'validate', args: ['graph', path.join(TEST_DATA_DIR, 'test-large.ttl')] },
      { name: 'hash-small', command: 'graph', args: ['hash', path.join(TEST_DATA_DIR, 'test-small.ttl')] },
      { name: 'hash-large', command: 'graph', args: ['hash', path.join(TEST_DATA_DIR, 'test-large.ttl')] },
      { name: 'hash-huge', command: 'graph', args: ['hash', path.join(TEST_DATA_DIR, 'test-huge.ttl')] }
    ];
    
    for (const op of operations) {
      try {
        const profile = await this.profileCommand(op.command, op.args, { timeout: 120000 });
        
        // Analyze memory pattern
        profile.memoryAnalysis = this.analyzeMemoryPattern(profile.measurements);
        
        this.profiles.set(op.name, profile);
        
        console.log(`  ✅ ${op.name}`);
        console.log(`     Duration: ${profile.duration.toFixed(2)}ms`);
        console.log(`     Memory Delta: RSS ${(profile.memoryStats.delta.rss/1024).toFixed(0)}KB, Heap ${(profile.memoryStats.delta.heapUsed/1024).toFixed(0)}KB`);
        console.log(`     Peak Memory: ${(profile.memoryStats.peak.rss/1024/1024).toFixed(1)}MB`);
        console.log(`     GC Events: ${profile.gcStats.gcCount} (${profile.gcStats.gcEventsPerSecond.toFixed(2)}/sec)`);
        console.log(`     Pattern: ${profile.memoryAnalysis.pattern}`);
        
        if (profile.memoryAnalysis.hasMemorySpikes) {
          console.log(`     ⚠️ Memory spikes detected`);
        }
        
        console.log('');
        
      } catch (error) {
        console.log(`  ❌ ${op.name}: ${error.message}\n`);
        this.profiles.set(op.name, { error: error.message, success: false });
      }
    }
  }

  generateMemoryReport() {
    const report = {
      timestamp: this.getDeterministicDate().toISOString(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        totalMemory: Math.round(os.totalmem() / (1024 ** 3)),
        nodeVersion: process.version
      },
      profiles: Object.fromEntries(this.profiles),
      summary: this.generateMemorySummary()
    };
    
    return report;
  }

  generateMemorySummary() {
    const successful = Array.from(this.profiles.values()).filter(p => p.success);
    
    if (successful.length === 0) {
      return { status: 'NO_DATA' };
    }
    
    const memoryDeltas = successful.map(p => p.memoryStats.delta.rss);
    const peakMemories = successful.map(p => p.memoryStats.peak.rss);
    const gcCounts = successful.map(p => p.gcStats.gcCount);
    
    const avgMemoryDelta = memoryDeltas.reduce((sum, d) => sum + d, 0) / memoryDeltas.length;
    const maxMemoryDelta = Math.max(...memoryDeltas);
    const avgPeakMemory = peakMemories.reduce((sum, p) => sum + p, 0) / peakMemories.length;
    const maxPeakMemory = Math.max(...peakMemories);
    const avgGcCount = gcCounts.reduce((sum, g) => sum + g, 0) / gcCounts.length;
    
    // Memory efficiency analysis
    const memoryEfficient = avgMemoryDelta < 50 * 1024 * 1024; // <50MB
    const hasMemoryLeaks = memoryDeltas.some(d => d > 100 * 1024 * 1024); // >100MB
    const excessiveGc = avgGcCount > 10;
    
    return {
      averageMemoryDelta: Math.round(avgMemoryDelta / 1024), // KB
      maxMemoryDelta: Math.round(maxMemoryDelta / 1024), // KB
      averagePeakMemory: Math.round(avgPeakMemory / 1024 / 1024), // MB
      maxPeakMemory: Math.round(maxPeakMemory / 1024 / 1024), // MB
      averageGcCount: Math.round(avgGcCount),
      memoryEfficient: memoryEfficient,
      potentialMemoryLeaks: hasMemoryLeaks,
      excessiveGarbageCollection: excessiveGc,
      overallAssessment: this.assessOverallMemoryPerformance(successful)
    };
  }

  assessOverallMemoryPerformance(profiles) {
    const issues = [];
    
    // Check for memory growth patterns
    const growthProfiles = profiles.filter(p => 
      p.memoryAnalysis && p.memoryAnalysis.pattern === 'HIGH_GROWTH'
    );
    
    if (growthProfiles.length > 0) {
      issues.push('HIGH_MEMORY_GROWTH');
    }
    
    // Check for memory spikes
    const spikeProfiles = profiles.filter(p =>
      p.memoryAnalysis && p.memoryAnalysis.hasMemorySpikes
    );
    
    if (spikeProfiles.length > 0) {
      issues.push('MEMORY_SPIKES');
    }
    
    // Check for excessive GC
    const highGcProfiles = profiles.filter(p => p.gcStats.gcCount > 10);
    
    if (highGcProfiles.length > 0) {
      issues.push('EXCESSIVE_GC');
    }
    
    if (issues.length === 0) {
      return 'EXCELLENT';
    } else if (issues.length <= 2) {
      return 'GOOD';
    } else {
      return 'NEEDS_IMPROVEMENT';
    }
  }

  async saveReport(report) {
    const resultsDir = path.join(PROJECT_ROOT, 'tests/performance/results');
    await fs.mkdir(resultsDir, { recursive: true });
    
    const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(resultsDir, `memory-profile-${timestamp}.json`);
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Memory profile saved: ${reportPath}`);
    
    // Also save latest
    const latestPath = path.join(resultsDir, 'memory-profile-latest.json');
    await fs.writeFile(latestPath, JSON.stringify(report, null, 2));
    
    return reportPath;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const profiler = new MemoryProfiler();
  
  profiler.profileMultipleOperations()
    .then(async () => {
      const report = profiler.generateMemoryReport();
      await profiler.saveReport(report);
      
      console.log('='.repeat(60));
      console.log('📊 MEMORY PROFILING SUMMARY');
      console.log('='.repeat(60));
      console.log(`Overall Assessment: ${report.summary.overallAssessment}`);
      console.log(`Average Memory Delta: ${report.summary.averageMemoryDelta}KB`);
      console.log(`Max Memory Delta: ${report.summary.maxMemoryDelta}KB`);
      console.log(`Average Peak Memory: ${report.summary.averagePeakMemory}MB`);
      console.log(`Max Peak Memory: ${report.summary.maxPeakMemory}MB`);
      console.log(`Average GC Count: ${report.summary.averageGcCount}`);
      console.log(`Memory Efficient: ${report.summary.memoryEfficient ? 'Yes' : 'No'}`);
      console.log(`Potential Leaks: ${report.summary.potentialMemoryLeaks ? 'Yes' : 'No'}`);
      console.log(`Excessive GC: ${report.summary.excessiveGarbageCollection ? 'Yes' : 'No'}`);
      
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Memory profiling failed:', error);
      process.exit(1);
    });
}

export { MemoryProfiler };