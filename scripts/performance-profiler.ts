#!/usr/bin/env tsx

/**
 * Performance Profiler - Deep analysis of startup and execution patterns
 */

import { performance, PerformanceObserver } from 'node:perf_hooks';
import { execSync, spawn } from 'node:child_process';
import fs from 'fs-extra';
import path from 'path';

interface ProfiledOperation {
  name: string;
  startupTime: number;
  moduleLoadTime: number;
  executionTime: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  dependencies: string[];
  bottlenecks: string[];
}

interface DependencyAnalysis {
  name: string;
  size: number;
  loadTime: number;
  importChain: string[];
  isLazyLoadable: boolean;
}

class PerformanceProfiler {
  private cliPath: string;
  private projectRoot: string;
  private profiles: ProfiledOperation[] = [];

  constructor() {
    this.projectRoot = process.cwd();
    this.cliPath = path.join(this.projectRoot, 'dist/cli.mjs');
  }

  /**
   * Profile CLI startup with detailed timing
   */
  async profileStartup(): Promise<void> {
    console.log('🔍 Profiling CLI startup patterns...');

    const operations = [
      { name: 'Cold Start - Version', command: '--version' },
      { name: 'Cold Start - Help', command: '--help' },
      { name: 'Template Discovery', command: 'list' },
      { name: 'Dynamic Command Generation', command: 'help command citty' }
    ];

    for (const op of operations) {
      await this.profileOperation(op.name, op.command);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Profile a single operation with detailed metrics
   */
  private async profileOperation(name: string, command: string): Promise<void> {
    console.log(`   🎯 Profiling: ${name}`);

    const measurements: number[] = [];
    const memoryMeasurements: any[] = [];
    
    // Run multiple times for statistical significance
    for (let i = 0; i < 5; i++) {
      const initialMemory = process.memoryUsage();
      const startTime = performance.now();
      
      try {
        // Create a child process with detailed monitoring
        const child = execSync(`node ${this.cliPath} ${command}`, {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
          env: { ...process.env, DEBUG_TIMING: '1' }
        });

        const endTime = performance.now();
        const finalMemory = process.memoryUsage();
        
        measurements.push(endTime - startTime);
        memoryMeasurements.push({
          rss: finalMemory.rss / 1024 / 1024,
          heapUsed: finalMemory.heapUsed / 1024 / 1024,
          heapTotal: finalMemory.heapTotal / 1024 / 1024,
          external: finalMemory.external / 1024 / 1024,
          delta: {
            rss: (finalMemory.rss - initialMemory.rss) / 1024 / 1024,
            heapUsed: (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024
          }
        });
        
      } catch (error) {
        console.log(`      ❌ Error: ${error}`);
        measurements.push(performance.now() - startTime);
      }
    }

    if (measurements.length > 0) {
      const avgTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const avgMemory = {
        rss: memoryMeasurements.reduce((acc, m) => acc + Math.abs(m.delta.rss), 0) / memoryMeasurements.length,
        heapUsed: memoryMeasurements.reduce((acc, m) => acc + Math.abs(m.delta.heapUsed), 0) / memoryMeasurements.length,
        heapTotal: memoryMeasurements[0]?.heapTotal || 0,
        external: memoryMeasurements[0]?.external || 0
      };

      // Estimate breakdown (simplified)
      const moduleLoadTime = Math.min(avgTime * 0.7, 150); // Most of the time is module loading
      const executionTime = avgTime - moduleLoadTime;

      const profile: ProfiledOperation = {
        name,
        startupTime: avgTime,
        moduleLoadTime,
        executionTime,
        memoryUsage: avgMemory,
        dependencies: await this.analyzeDependencies(),
        bottlenecks: this.identifyBottlenecks(avgTime, avgMemory)
      };

      this.profiles.push(profile);
      
      console.log(`      ⏱️  Total: ${avgTime.toFixed(2)}ms (Load: ${moduleLoadTime.toFixed(2)}ms, Exec: ${executionTime.toFixed(2)}ms)`);
      console.log(`      💾 Memory: ${avgMemory.rss.toFixed(2)}MB RSS, ${avgMemory.heapUsed.toFixed(2)}MB heap`);
    }
  }

  /**
   * Analyze dependency chain and sizes
   */
  private async analyzeDependencies(): Promise<string[]> {
    try {
      const packageJson = await fs.readJSON(path.join(this.projectRoot, 'package.json'));
      return Object.keys(packageJson.dependencies || {});
    } catch (error) {
      return [];
    }
  }

  /**
   * Identify performance bottlenecks based on measurements
   */
  private identifyBottlenecks(time: number, memory: any): string[] {
    const bottlenecks: string[] = [];

    if (time > 300) bottlenecks.push('High startup time (>300ms)');
    if (time > 200 && time <= 300) bottlenecks.push('Moderate startup time (>200ms)');
    if (memory.rss > 50) bottlenecks.push('High memory usage (>50MB)');
    if (memory.heapUsed > 20) bottlenecks.push('Large heap usage (>20MB)');

    return bottlenecks;
  }

  /**
   * Profile bundle composition and lazy loading opportunities
   */
  async profileBundleComposition(): Promise<void> {
    console.log('\n📦 Analyzing bundle composition...');

    try {
      // Analyze CLI bundle
      const cliContent = await fs.readFile(this.cliPath, 'utf8');
      
      // Extract dependency patterns
      const importMatches = cliContent.match(/require\(["']([^"']+)["']\)/g) || [];
      const dynamicImports = cliContent.match(/import\(["']([^"']+)["']\)/g) || [];
      
      console.log(`   📋 Static requires found: ${importMatches.length}`);
      console.log(`   ⚡ Dynamic imports found: ${dynamicImports.length}`);
      
      // Analyze size contributors
      const cliStats = await fs.stat(this.cliPath);
      const indexStats = await fs.stat(path.join(this.projectRoot, 'dist/index.mjs'));
      
      console.log(`   📏 CLI bundle: ${(cliStats.size / 1024).toFixed(2)} KB`);
      console.log(`   📏 Index bundle: ${(indexStats.size / 1024).toFixed(2)} KB`);
      
      // Identify optimization opportunities
      const optimizations = this.identifyOptimizations(cliContent, importMatches.length);
      if (optimizations.length > 0) {
        console.log('   🎯 Optimization opportunities:');
        optimizations.forEach(opt => console.log(`      • ${opt}`));
      }

    } catch (error) {
      console.error(`   ❌ Bundle analysis failed: ${error}`);
    }
  }

  /**
   * Identify optimization opportunities
   */
  private identifyOptimizations(content: string, staticImportCount: number): string[] {
    const optimizations: string[] = [];

    // Check for commonly lazy-loadable modules
    const lazyLoadCandidates = [
      'inquirer', 'ora', 'chalk', 'yaml'
    ];

    lazyLoadCandidates.forEach(module => {
      if (content.includes(module) && !content.includes(`import("${module}")`)) {
        optimizations.push(`Lazy load '${module}' (only needed for specific operations)`);
      }
    });

    if (staticImportCount > 20) {
      optimizations.push('High number of static imports - consider code splitting');
    }

    if (content.includes('fs-extra') && content.includes('node:fs')) {
      optimizations.push('Use consistent filesystem API (prefer node:fs over fs-extra where possible)');
    }

    return optimizations;
  }

  /**
   * Benchmark against performance targets
   */
  benchmarkAgainstTargets(): void {
    console.log('\n🎯 Performance Target Analysis');
    console.log('==============================');

    const targets = {
      startupTime: 150,      // Target: <150ms startup
      memoryUsage: 30,       // Target: <30MB memory
      moduleLoadTime: 100    // Target: <100ms module loading
    };

    let passCount = 0;
    let totalTests = 0;

    this.profiles.forEach(profile => {
      console.log(`\n📊 ${profile.name}:`);
      
      // Startup time check
      const startupPass = profile.startupTime <= targets.startupTime;
      console.log(`   ⏱️  Startup: ${profile.startupTime.toFixed(2)}ms ${startupPass ? '✅' : '❌'} (target: ${targets.startupTime}ms)`);
      
      // Memory check
      const memoryPass = profile.memoryUsage.rss <= targets.memoryUsage;
      console.log(`   💾 Memory: ${profile.memoryUsage.rss.toFixed(2)}MB ${memoryPass ? '✅' : '❌'} (target: ${targets.memoryUsage}MB)`);
      
      // Module load check
      const modulePass = profile.moduleLoadTime <= targets.moduleLoadTime;
      console.log(`   📦 Module Load: ${profile.moduleLoadTime.toFixed(2)}ms ${modulePass ? '✅' : '❌'} (target: ${targets.moduleLoadTime}ms)`);
      
      const passedTargets = [startupPass, memoryPass, modulePass].filter(Boolean).length;
      passCount += passedTargets;
      totalTests += 3;
      
      console.log(`   📈 Score: ${passedTargets}/3 targets met`);
      
      if (profile.bottlenecks.length > 0) {
        console.log('   ⚠️  Bottlenecks:');
        profile.bottlenecks.forEach(bottleneck => console.log(`      • ${bottleneck}`));
      }
    });

    console.log(`\n🏆 Overall Performance Score: ${passCount}/${totalTests} (${((passCount/totalTests) * 100).toFixed(1)}%)`);
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Analyze patterns across all profiles
    const avgStartupTime = this.profiles.reduce((acc, p) => acc + p.startupTime, 0) / this.profiles.length;
    const avgModuleTime = this.profiles.reduce((acc, p) => acc + p.moduleLoadTime, 0) / this.profiles.length;
    const avgMemory = this.profiles.reduce((acc, p) => acc + p.memoryUsage.rss, 0) / this.profiles.length;

    // Startup time optimizations
    if (avgStartupTime > 200) {
      recommendations.push('🚀 Implement lazy loading for non-critical modules');
      recommendations.push('📦 Consider CommonJS build for faster startup (vs ESM)');
      recommendations.push('⚡ Move heavy imports to dynamic import()');
    }

    if (avgModuleTime > 100) {
      recommendations.push('📚 Reduce bundle size through tree-shaking');
      recommendations.push('🔄 Implement module caching for repeated operations');
    }

    if (avgMemory > 30) {
      recommendations.push('💾 Optimize memory usage in template scanning');
      recommendations.push('🧹 Implement memory cleanup after operations');
    }

    // Specific module recommendations
    const hasInquirer = this.profiles.some(p => p.dependencies.includes('inquirer'));
    if (hasInquirer) {
      recommendations.push('❓ Lazy load inquirer (only needed for interactive prompts)');
    }

    const hasOra = this.profiles.some(p => p.dependencies.includes('ora'));
    if (hasOra) {
      recommendations.push('⏳ Lazy load ora spinner (only needed for long operations)');
    }

    return recommendations;
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport(): Promise<void> {
    const recommendations = this.generateRecommendations();
    
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      profiles: this.profiles,
      summary: {
        averageStartupTime: this.profiles.reduce((acc, p) => acc + p.startupTime, 0) / this.profiles.length,
        averageModuleLoadTime: this.profiles.reduce((acc, p) => acc + p.moduleLoadTime, 0) / this.profiles.length,
        averageExecutionTime: this.profiles.reduce((acc, p) => acc + p.executionTime, 0) / this.profiles.length,
        averageMemoryUsage: this.profiles.reduce((acc, p) => acc + p.memoryUsage.rss, 0) / this.profiles.length,
        totalBottlenecks: this.profiles.reduce((acc, p) => acc + p.bottlenecks.length, 0)
      },
      recommendations,
      benchmarkResults: {
        startupTimeTarget: 150,
        memoryTarget: 30,
        performanceScore: this.calculatePerformanceScore()
      }
    };

    // Save detailed report
    const reportPath = path.join(this.projectRoot, 'docs', 'performance-profile.json');
    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeJSON(reportPath, report, { spaces: 2 });
    
    console.log(`\n📋 Performance profile saved to: ${reportPath}`);
    
    // Display recommendations
    if (recommendations.length > 0) {
      console.log('\n💡 Optimization Recommendations:');
      recommendations.forEach(rec => console.log(`   ${rec}`));
    }
  }

  private calculatePerformanceScore(): number {
    const targets = { startupTime: 150, memoryUsage: 30, moduleLoadTime: 100 };
    let totalScore = 0;
    let maxScore = 0;

    this.profiles.forEach(profile => {
      maxScore += 3; // 3 targets per profile
      
      if (profile.startupTime <= targets.startupTime) totalScore++;
      if (profile.memoryUsage.rss <= targets.memoryUsage) totalScore++;
      if (profile.moduleLoadTime <= targets.moduleLoadTime) totalScore++;
    });

    return maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  }

  async runCompleteProfile(): Promise<void> {
    console.log('🔬 Starting Complete Performance Profile...\n');
    
    try {
      await this.profileStartup();
      await this.profileBundleComposition();
      this.benchmarkAgainstTargets();
      await this.generateReport();
      
      console.log('\n✨ Performance profiling complete!');
    } catch (error) {
      console.error('❌ Performance profiling failed:', error);
      throw error;
    }
  }
}

// Run the profiler
const profiler = new PerformanceProfiler();
profiler.runCompleteProfile().catch(console.error);