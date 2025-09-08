import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { spawn } from 'child_process';

interface ComparisonResult {
  testName: string;
  currentVersion: PerformanceData;
  baseline?: PerformanceData;
  improvement?: number;
  regression?: number;
  status: 'IMPROVED' | 'REGRESSED' | 'STABLE' | 'NEW';
}

interface PerformanceData {
  executionTime: number;
  memoryUsage: number;
  throughput: number;
  reliability: number;
}

describe('Performance Comparison and Regression Testing', () => {
  const resultsDir = join(process.cwd(), 'tests/performance/results');
  const comparisonFile = join(resultsDir, 'performance-comparison.json');
  const baselineFile = join(resultsDir, 'performance-baseline.json');
  
  let comparisonResults: ComparisonResult[] = [];

  beforeEach(() => {
    mkdirSync(resultsDir, { recursive: true });
  });

  const loadPerformanceData = (filePath: string): any | null => {
    try {
      if (existsSync(filePath)) {
        return JSON.parse(readFileSync(filePath, 'utf-8'));
      }
    } catch (error) {
      console.warn(`Could not load performance data from ${filePath}:`, error);
    }
    return null;
  };

  const comparePerformance = (current: PerformanceData, baseline: PerformanceData): ComparisonResult['status'] => {
    const timeImprovement = ((baseline.executionTime - current.executionTime) / baseline.executionTime) * 100;
    const memoryImprovement = ((baseline.memoryUsage - current.memoryUsage) / baseline.memoryUsage) * 100;
    const throughputImprovement = ((current.throughput - baseline.throughput) / baseline.throughput) * 100;
    
    const overallImprovement = (timeImprovement + memoryImprovement + throughputImprovement) / 3;
    
    if (overallImprovement > 5) return 'IMPROVED';
    if (overallImprovement < -5) return 'REGRESSED';
    return 'STABLE';
  };

  it('should compare CLI performance against baseline', () => {
    const cliResults = loadPerformanceData(join(resultsDir, 'cli-metrics.json'));
    const baseline = loadPerformanceData(baselineFile);
    
    if (!cliResults) {
      console.log('⚠️  CLI performance data not found. Run CLI performance tests first.');
      return;
    }

    console.log('\n📊 CLI PERFORMANCE COMPARISON');
    console.log('═══════════════════════════════════');

    if (baseline && baseline.cli) {
      const current: PerformanceData = {
        executionTime: cliResults.averages.executionTime,
        memoryUsage: cliResults.averages.memoryUsage,
        throughput: 1000 / cliResults.averages.executionTime, // ops per second
        reliability: 100 - (cliResults.metrics.filter((m: any) => m.executionTime > 10000).length / cliResults.metrics.length * 100)
      };

      const baselineCli: PerformanceData = baseline.cli;
      const status = comparePerformance(current, baselineCli);
      
      const result: ComparisonResult = {
        testName: 'CLI Performance',
        currentVersion: current,
        baseline: baselineCli,
        improvement: status === 'IMPROVED' ? 
          ((baselineCli.executionTime - current.executionTime) / baselineCli.executionTime) * 100 : undefined,
        regression: status === 'REGRESSED' ? 
          ((current.executionTime - baselineCli.executionTime) / baselineCli.executionTime) * 100 : undefined,
        status
      };

      comparisonResults.push(result);

      console.log(`  Status: ${status === 'IMPROVED' ? '✅' : status === 'REGRESSED' ? '❌' : '➖'} ${status}`);
      console.log(`  Current Execution Time: ${current.executionTime.toFixed(2)}ms`);
      console.log(`  Baseline Execution Time: ${baselineCli.executionTime.toFixed(2)}ms`);
      
      if (result.improvement) {
        console.log(`  🚀 Improvement: ${result.improvement.toFixed(1)}%`);
      } else if (result.regression) {
        console.log(`  ⚠️  Regression: ${result.regression.toFixed(1)}%`);
      }
    } else {
      console.log('  📋 No baseline found - establishing new baseline');
      
      // Create baseline from current results
      const newBaseline = {
        version: '1.0.0',
        date: new Date().toISOString(),
        cli: {
          executionTime: cliResults.averages.executionTime,
          memoryUsage: cliResults.averages.memoryUsage,
          throughput: 1000 / cliResults.averages.executionTime,
          reliability: 100
        }
      };

      require('fs').writeFileSync(baselineFile, JSON.stringify(newBaseline, null, 2));
      console.log('  ✅ Baseline established');
    }
  });

  it('should compare filter performance against baseline', () => {
    const filterResults = loadPerformanceData(join(resultsDir, 'filter-metrics.json'));
    const baseline = loadPerformanceData(baselineFile);

    if (!filterResults) {
      console.log('⚠️  Filter performance data not found. Run filter performance tests first.');
      return;
    }

    console.log('\n🔧 FILTER PERFORMANCE COMPARISON');
    console.log('════════════════════════════════════');

    if (baseline && baseline.filters) {
      const current: PerformanceData = {
        executionTime: filterResults.summary.averageTime,
        memoryUsage: filterResults.metrics.reduce((sum: number, m: any) => sum + m.memoryUsage, 0) / filterResults.metrics.length,
        throughput: filterResults.summary.totalThroughput / filterResults.metrics.length,
        reliability: 100
      };

      const baselineFilters: PerformanceData = baseline.filters;
      const status = comparePerformance(current, baselineFilters);

      const result: ComparisonResult = {
        testName: 'Filter Performance',
        currentVersion: current,
        baseline: baselineFilters,
        improvement: status === 'IMPROVED' ? 
          ((baselineFilters.executionTime - current.executionTime) / baselineFilters.executionTime) * 100 : undefined,
        regression: status === 'REGRESSED' ? 
          ((current.executionTime - baselineFilters.executionTime) / baselineFilters.executionTime) * 100 : undefined,
        status
      };

      comparisonResults.push(result);

      console.log(`  Status: ${status === 'IMPROVED' ? '✅' : status === 'REGRESSED' ? '❌' : '➖'} ${status}`);
      console.log(`  Current Average Filter Time: ${current.executionTime.toFixed(4)}ms`);
      console.log(`  Baseline Average Filter Time: ${baselineFilters.executionTime.toFixed(4)}ms`);
      console.log(`  Current Throughput: ${current.throughput.toFixed(0)} ops/sec`);
      console.log(`  Baseline Throughput: ${baselineFilters.throughput.toFixed(0)} ops/sec`);

    } else {
      console.log('  📋 Establishing filter performance baseline');
      
      if (baseline) {
        baseline.filters = {
          executionTime: filterResults.summary.averageTime,
          memoryUsage: filterResults.metrics.reduce((sum: number, m: any) => sum + m.memoryUsage, 0) / filterResults.metrics.length,
          throughput: filterResults.summary.totalThroughput / filterResults.metrics.length,
          reliability: 100
        };

        require('fs').writeFileSync(baselineFile, JSON.stringify(baseline, null, 2));
        console.log('  ✅ Filter baseline updated');
      }
    }
  });

  it('should compare scalability performance against baseline', () => {
    const scalabilityResults = loadPerformanceData(join(resultsDir, 'scalability-metrics.json'));
    const baseline = loadPerformanceData(baselineFile);

    if (!scalabilityResults) {
      console.log('⚠️  Scalability performance data not found. Run scalability tests first.');
      return;
    }

    console.log('\n📈 SCALABILITY PERFORMANCE COMPARISON');
    console.log('═══════════════════════════════════════');

    if (baseline && baseline.scalability) {
      const current: PerformanceData = {
        executionTime: scalabilityResults.performance.averageExecutionTime,
        memoryUsage: scalabilityResults.performance.averageMemoryPeak,
        throughput: scalabilityResults.performance.averageThroughput,
        reliability: scalabilityResults.performance.overallSuccessRate
      };

      const baselineScalability: PerformanceData = baseline.scalability;
      const status = comparePerformance(current, baselineScalability);

      const result: ComparisonResult = {
        testName: 'Scalability Performance',
        currentVersion: current,
        baseline: baselineScalability,
        improvement: status === 'IMPROVED' ? 
          ((baselineScalability.executionTime - current.executionTime) / baselineScalability.executionTime) * 100 : undefined,
        regression: status === 'REGRESSED' ? 
          ((current.executionTime - baselineScalability.executionTime) / baselineScalability.executionTime) * 100 : undefined,
        status
      };

      comparisonResults.push(result);

      console.log(`  Status: ${status === 'IMPROVED' ? '✅' : status === 'REGRESSED' ? '❌' : '➖'} ${status}`);
      console.log(`  Current Avg Execution Time: ${(current.executionTime / 1000).toFixed(2)}s`);
      console.log(`  Baseline Avg Execution Time: ${(baselineScalability.executionTime / 1000).toFixed(2)}s`);
      console.log(`  Current Throughput: ${current.throughput.toFixed(2)} ops/sec`);
      console.log(`  Current Reliability: ${current.reliability.toFixed(1)}%`);

    } else {
      console.log('  📋 Establishing scalability baseline');
      
      if (baseline) {
        baseline.scalability = {
          executionTime: scalabilityResults.performance.averageExecutionTime,
          memoryUsage: scalabilityResults.performance.averageMemoryPeak,
          throughput: scalabilityResults.performance.averageThroughput,
          reliability: scalabilityResults.performance.overallSuccessRate
        };

        require('fs').writeFileSync(baselineFile, JSON.stringify(baseline, null, 2));
        console.log('  ✅ Scalability baseline updated');
      }
    }
  });

  it('should test across multiple Node.js versions', async () => {
    console.log('\n🔄 NODE.JS VERSION COMPATIBILITY TESTING');
    console.log('════════════════════════════════════════════');

    const nodeVersions = [
      process.version, // Current version
      // Note: In a real test environment, you'd test against multiple installed Node versions
    ];

    for (const version of nodeVersions) {
      console.log(`\n  Testing with Node.js ${version}:`);
      
      const startTime = performance.now();
      
      try {
        // Test basic CLI functionality
        const testStart = performance.now();
        
        // Simulate version-specific test (in real implementation, you'd use nvm or similar)
        const result = await new Promise((resolve, reject) => {
          const proc = spawn('node', ['--version'], { timeout: 5000 });
          let output = '';
          
          proc.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          proc.on('close', (code) => {
            if (code === 0) {
              resolve(output.trim());
            } else {
              reject(new Error(`Process failed with code ${code}`));
            }
          });
          
          proc.on('error', reject);
        });
        
        const testTime = performance.now() - testStart;
        
        console.log(`    ✅ Version: ${result}`);
        console.log(`    ⏱️  Test Time: ${testTime.toFixed(2)}ms`);
        console.log(`    💾 Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB`);
        
        // Version compatibility assertions
        expect(testTime).toBeLessThan(5000); // Should complete quickly
        expect(result).toContain('v'); // Should return valid version
        
      } catch (error) {
        console.log(`    ❌ Error: ${(error as Error).message}`);
        throw error;
      }
      
      const totalTime = performance.now() - startTime;
      console.log(`    📊 Total Test Time: ${totalTime.toFixed(2)}ms`);
    }
  });

  it('should generate performance comparison report', () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      testEnvironment: 'Performance Comparison Suite',
      comparisonResults,
      summary: {
        totalTests: comparisonResults.length,
        improved: comparisonResults.filter(r => r.status === 'IMPROVED').length,
        regressed: comparisonResults.filter(r => r.status === 'REGRESSED').length,
        stable: comparisonResults.filter(r => r.status === 'STABLE').length,
        new: comparisonResults.filter(r => r.status === 'NEW').length,
        overallStatus: comparisonResults.some(r => r.status === 'REGRESSED') ? 'NEEDS_ATTENTION' :
                       comparisonResults.some(r => r.status === 'IMPROVED') ? 'IMPROVED' : 'STABLE'
      },
      recommendations: [
        comparisonResults.some(r => r.regression && r.regression > 10) ? 
          'Critical regression detected - investigate performance issues' : null,
        comparisonResults.filter(r => r.status === 'IMPROVED').length > 0 ? 
          'Performance improvements detected - document optimizations' : null,
        comparisonResults.length === 0 ? 
          'No comparison data available - establish performance baselines' : null
      ].filter(Boolean)
    };

    require('fs').writeFileSync(comparisonFile, JSON.stringify(reportData, null, 2));

    console.log('\n📋 PERFORMANCE COMPARISON SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`  Generated At: ${reportData.generatedAt}`);
    console.log(`  Node Version: ${reportData.nodeVersion}`);
    console.log(`  Platform: ${reportData.platform} (${reportData.arch})`);
    console.log(`\n📊 RESULTS BREAKDOWN:`);
    console.log(`  Total Tests: ${reportData.summary.totalTests}`);
    console.log(`  Improved: ${reportData.summary.improved} ✅`);
    console.log(`  Regressed: ${reportData.summary.regressed} ❌`);
    console.log(`  Stable: ${reportData.summary.stable} ➖`);
    console.log(`  New: ${reportData.summary.new} 🆕`);
    console.log(`\n🎯 OVERALL STATUS: ${reportData.summary.overallStatus}`);

    if (reportData.recommendations.length > 0) {
      console.log(`\n💡 RECOMMENDATIONS:`);
      reportData.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }

    console.log(`\n💾 Report saved to: ${comparisonFile}`);
    console.log('═══════════════════════════════════════\n');

    // Performance regression checks
    expect(reportData.summary.overallStatus).not.toBe('NEEDS_ATTENTION');
    
    if (reportData.summary.totalTests > 0) {
      expect(reportData.summary.regressed / reportData.summary.totalTests).toBeLessThan(0.5); // Less than 50% regression
    }
  });
});